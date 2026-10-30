/**
 * 風的粒子動畫（WindOverlayDef，2026-10-29 起，風與季風）：幾千個粒子順著風場移動，每個粒子留下一串漸淡的點（尾巴），
 * 看得出風往哪裡吹、多快。
 *
 * 風場是 pipeline（topics/wind.py）內插到經緯度每 2° 一點的 u、v（東西、南北分量，m/s），粒子的位置在 CPU 上算
 * （雙線性內插，經度方向除以 cos 緯度），每一幀把新的位置寫進「尾巴」的其中一格：buffer 依 [第幾格][第幾個粒子] 排，
 * 一幀只更新連續的一段（粒子數 × 3 個數），著色器用「離最新那一格幾格」算透明度，不必每幀重傳整串尾巴。
 * 投影跟晝夜、類別網格一樣用 MapLibre 的 projectTile／interpolateProjection（地球儀的背面會被裁掉），畫成點（GL_POINTS）：
 * WebGL 的線寬只有 1 個裝置像素，高解析度螢幕上太細。
 *
 * 粒子活一段隨機的時間（MIN_AGE–MAX_AGE 幀）後在畫面上隨機一點重生（隨機的像素換成經緯度，畫面上的密度一樣），
 * 跑出畫面或轉到地球儀背面的也重生；移動的速度依縮放換算成固定的像素速度（SPEED_PX：每 m/s 每秒幾個像素）。
 * 地圖的動畫會讓 MapLibre 一直重畫、不會 idle（底圖第一次載入的「海的顏色」要等 idle 才換回陸地，WorldMap.tsx），
 * 所以等第一次 idle（最多 START_MAX_MS）才開始動；系統設定「減少動態效果」時不動，畫成靜止的一段一段風向線。
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MaplibreMap } from 'maplibre-gl';
import { windAt, type WindField } from './windField';

/** 插在國界之前（類別網格之後加，畫在風速的底色上面） */
const BEFORE = 'data-border';
export const WIND_LAYER_PREFIX = 'wind-';
/** 尾巴有幾格（幀） */
const TRAIL = 28;
/** 每 m/s 每秒移動幾個像素 */
const SPEED_PX = 7;
const MIN_AGE = 50;
const MAX_AGE = 140;
const START_MAX_MS = 4000;
/** 每個粒子占多少平方像素（畫面越大粒子越多）：地球儀只占畫面的一部分，太密會糊成一片 */
const AREA_PER_PARTICLE = 480;
const MIN_PARTICLES = 900;
const MAX_PARTICLES = 3500;


const VERTEX_SOURCE = `
in vec3 a_point;
in float a_slot;
uniform float u_world_offset;
uniform float u_head;
uniform float u_size;
out float v_alpha;
void main() {
  float age = mod(u_head - a_slot + ${TRAIL}.0, ${TRAIL}.0);
  v_alpha = (1.0 - age / ${TRAIL}.0) * smoothstep(0.3, 2.5, a_point.z);
  float lon = radians(a_point.x);
  float lat = radians(a_point.y);
  float clamped = radians(clamp(a_point.y, -85.0511, 85.0511));
  vec2 merc = vec2((a_point.x + 180.0) / 360.0 + u_world_offset, 0.5 - log(tan(0.78539816 + clamped / 2.0)) / 6.28318531);
#ifdef GLOBE
  vec3 sphere = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  gl_Position = interpolateProjection(merc, sphere, 0.0);
#else
  gl_Position = projectTile(merc);
  if (abs(a_point.y) > 85.0) v_alpha = 0.0;
#endif
  gl_PointSize = u_size;
}`;

const FRAGMENT_SOURCE = `
precision highp float;
in float v_alpha;
uniform vec3 u_color;
uniform float u_opacity;
out vec4 fragColor;
void main() {
  float a = v_alpha * u_opacity;
  if (a < 0.01) discard;
  fragColor = vec4(u_color * a, a);
}`;

interface Program {
  program: WebGLProgram;
  point: number;
  slot: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  'u_projection_matrix',
  'u_projection_fallback_matrix',
  'u_projection_tile_mercator_coords',
  'u_projection_clipping_plane',
  'u_projection_transition',
  'u_world_offset',
  'u_head',
  'u_size',
  'u_color',
  'u_opacity',
] as const;

/** WebGL 1 沒有 in/out、texture()：照 MapLibre 的做法改寫（classGridLayer.ts 同一份） */
function toWebGL1(source: string, fragment: boolean): string {
  let out = source.replace(/^\s*#version 300 es\s*$/m, '');
  if (fragment) {
    out = out
      .replace(/\bin\s+(?=\w+\s+\w+;)/g, 'varying ')
      .replace(/out vec4 fragColor;/, '')
      .replace(/fragColor/g, 'gl_FragColor');
  } else {
    out = out.replace(/\bin\s+(?=\w+\s+\w+;)/g, 'attribute ').replace(/\bout\s+(?=\w+\s+\w+;)/g, 'varying ');
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface WindLook {
  color: string;
  opacity: number;
}

/** 粒子重生的範圍：地球儀看得到的半球（中心與角半徑），或經緯度的方框 */
type Region =
  | { kind: 'cap'; lon: number; lat: number; cos: number }
  | { kind: 'box'; west: number; east: number; south: number; north: number };

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

class WindLayer implements CustomLayerInterface {
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  readonly id: string;
  look: WindLook = { color: '#000000', opacity: 1 };
  private field: WindField | null = null;
  private map: MaplibreMap | null = null;
  private programs = new Map<string, Program | null>();
  private webgl2 = true;
  private points: WebGLBuffer | null = null;
  private slots: WebGLBuffer | null = null;
  private n = 0;
  private lon = new Float32Array(0);
  private lat = new Float32Array(0);
  private age = new Float32Array(0);
  private life = new Float32Array(0);
  /** 一格尾巴的資料（粒子數 × [經度, 緯度, 風速]），每幀寫進 buffer 的第 head 格 */
  private head = 0;
  private slice = new Float32Array(0);
  private last = 0;
  private started = false;
  private seeded = false;
  /** 上次整批撒粒子時的畫面 */
  private view: { lng: number; lat: number; zoom: number; globe: boolean } | null = null;
  private frame = 0;
  private globe = false;
  private region: Region | null = null;
  /** 減少動態效果時：畫面或風場換了才重畫一次靜止的風向線 */
  private staticKey = '';

  constructor(id: string) {
    this.id = id;
  }

  setField(field: WindField) {
    if (field === this.field) return;
    this.field = field;
    this.staticKey = '';
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const canvas = map.getCanvas();
    const area = canvas.clientWidth * canvas.clientHeight;
    this.n = Math.round(Math.max(MIN_PARTICLES, Math.min(MAX_PARTICLES, area / AREA_PER_PARTICLE)));
    this.lon = new Float32Array(this.n);
    this.lat = new Float32Array(this.n);
    this.age = new Float32Array(this.n);
    this.life = new Float32Array(this.n);
    this.slice = new Float32Array(this.n * 3);
    const slots = new Float32Array(this.n * TRAIL);
    for (let s = 0; s < TRAIL; s++) slots.fill(s, s * this.n, (s + 1) * this.n);
    this.slots = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.slots);
    gl.bufferData(gl.ARRAY_BUFFER, slots, gl.STATIC_DRAW);
    this.points = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.points);
    // 一開始全部是 0 風速（透明），粒子出生後才看得到
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.n * TRAIL * 3), gl.DYNAMIC_DRAW);
    this.started = false;
    const start = () => {
      clearTimeout(timer);
      map.off('idle', start);
      if (this.map !== map) return;
      this.started = true;
      this.last = 0;
      map.triggerRepaint();
    };
    const timer = setTimeout(start, START_MAX_MS);
    map.once('idle', start);
  }

  onRemove(_map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const b of [this.points, this.slots]) if (b) gl.deleteBuffer(b);
    for (const p of this.programs.values()) if (p) gl.deleteProgram(p.program);
    this.programs.clear();
    this.map = null;
  }

  private program(gl: WebGLRenderingContext | WebGL2RenderingContext, shader: CustomRenderMethodInput['shaderData']): Program | null {
    const cached = this.programs.get(shader.variantName);
    if (cached !== undefined) return cached;
    const header = this.webgl2 ? '#version 300 es\n' : '';
    const vertex = `${header}${shader.vertexShaderPrelude}\n${shader.define}\n${VERTEX_SOURCE}`;
    const fragment = `${header}${shader.define}\n${FRAGMENT_SOURCE}`;
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, this.webgl2 ? source : toWebGL1(source, type === gl.FRAGMENT_SHADER));
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('wind shader', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    let result: Program | null = null;
    if (vs && fs) {
      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        result = {
          program,
          point: gl.getAttribLocation(program, 'a_point'),
          slot: gl.getAttribLocation(program, 'a_slot'),
          uniforms: Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(program, u)])),
        };
      } else {
        console.warn('wind program', gl.getProgramInfoLog(program));
      }
    }
    this.programs.set(shader.variantName, result);
    return result;
  }

  /**
   * 粒子重生的範圍：地球儀是以畫面中心為中心、包住整個畫面的圓（球的半徑約 512 × 2^縮放 ÷ 2π 像素，畫面對角線的
   * 一半換成角度；比球大就是整個半球）。地球儀上 getBounds 常常回傳整圈經度，粒子會散到看不到的地方。
   * 平面地圖用畫面的經緯度範圍
   */
  private updateRegion(map: MaplibreMap) {
    const zoom = map.getZoom();
    if (this.globe) {
      const c = map.getCenter();
      const canvas = map.getCanvas();
      const half = Math.hypot(canvas.clientWidth, canvas.clientHeight) / 2;
      const r = (512 * 2 ** zoom) / (2 * Math.PI);
      const radius = half >= r ? 90 : (Math.asin(half / r) * 180) / Math.PI;
      this.region = { kind: 'cap', lon: c.lng, lat: c.lat, cos: Math.cos((radius * Math.PI) / 180) };
      return;
    }
    const b = map.getBounds();
    let west = b.getWest();
    let east = b.getEast();
    if (east - west >= 360) {
      west = -180;
      east = 180;
    }
    this.region = {
      kind: 'box',
      west,
      east,
      south: Math.max(-85, b.getSouth()),
      north: Math.min(85, b.getNorth()),
    };
  }

  private inRegion(lon: number, lat: number): boolean {
    const r = this.region;
    if (!r) return true;
    if (r.kind === 'cap') {
      const d = Math.PI / 180;
      const la = lat * d;
      const lb = r.lat * d;
      return Math.sin(la) * Math.sin(lb) + Math.cos(la) * Math.cos(lb) * Math.cos((lon - r.lon) * d) >= r.cos;
    }
    if (lat < r.south || lat > r.north) return false;
    const x = ((((lon - r.west) % 360) + 360) % 360) + r.west;
    return x <= r.east;
  }

  /**
   * 粒子在畫面上隨機一點出生（畫面上的密度一樣；在地球儀上依球面均勻的話，邊緣會擠成一片）：隨機的像素換成經緯度，
   * 地球儀外面的像素（換回來跟原本差 4 px 以上）重抽，抽 8 次都在外面時用 region 的範圍
   */
  private spawn(i: number) {
    const map = this.map;
    if (map) {
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const ll = map.unproject([x, y]);
        if (!Number.isFinite(ll.lat) || Math.abs(ll.lat) > 85) continue;
        if (this.globe) {
          const p = map.project(ll);
          if (Math.hypot(p.x - x, p.y - y) > 4) continue;
        }
        this.lon[i] = ((((ll.lng + 180) % 360) + 360) % 360) - 180;
        this.lat[i] = ll.lat;
        this.age[i] = 0;
        this.life[i] = MIN_AGE + Math.random() * (MAX_AGE - MIN_AGE);
        return;
      }
    }
    const r = this.region;
    const d = Math.PI / 180;
    let lon: number;
    let lat: number;
    if (!r || r.kind === 'cap') {
      // 球面上均勻：半球（或整個地球）裡的隨機方向
      const cosR = r ? r.cos : -1;
      const cosT = 1 - Math.random() * (1 - cosR);
      const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
      const phi = Math.random() * 2 * Math.PI;
      const cl = r ? r.lon * d : 0;
      const ca = r ? r.lat * d : Math.PI / 2;
      // 中心的單位向量與兩個垂直的方向
      const cx = Math.cos(ca) * Math.cos(cl);
      const cy = Math.cos(ca) * Math.sin(cl);
      const cz = Math.sin(ca);
      const ex = -Math.sin(cl);
      const ey = Math.cos(cl);
      const fx = -Math.sin(ca) * Math.cos(cl);
      const fy = -Math.sin(ca) * Math.sin(cl);
      const fz = Math.cos(ca);
      const px = cx * cosT + (ex * Math.cos(phi) + fx * Math.sin(phi)) * sinT;
      const py = cy * cosT + (ey * Math.cos(phi) + fy * Math.sin(phi)) * sinT;
      const pz = cz * cosT + fz * Math.sin(phi) * sinT;
      lat = Math.asin(Math.max(-1, Math.min(1, pz))) / d;
      lon = Math.atan2(py, px) / d;
    } else {
      // 方框裡依面積均勻（緯度用 sin 均勻）
      const s = Math.sin(r.south * d);
      const n = Math.sin(r.north * d);
      lat = Math.asin(s + Math.random() * (n - s)) / d;
      lon = r.west + Math.random() * (r.east - r.west);
      lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    }
    this.lon[i] = lon;
    this.lat[i] = lat;
    this.age[i] = 0;
    this.life[i] = MIN_AGE + Math.random() * (MAX_AGE - MIN_AGE);
  }

  /** 所有粒子往前走 dt 秒，新位置寫進 slice */
  private step(dt: number, zoom: number) {
    const field = this.field!;
    // 跑出畫面的粒子重生：每幀只檢查八分之一（map.project 不便宜）
    const map = this.map;
    const canvas = map?.getCanvas();
    const w = canvas?.clientWidth ?? 0;
    const h = canvas?.clientHeight ?? 0;
    this.frame = (this.frame + 1) % 8;
    // 每 m/s 每秒 SPEED_PX 像素換成度：縮放 z 時整個世界寬 512 × 2^z 像素
    const k = (SPEED_PX * dt * 360) / (512 * 2 ** zoom);
    for (let i = 0; i < this.n; i++) {
      let lon = this.lon[i];
      let lat = this.lat[i];
      this.age[i] += 1;
      let gone = this.age[i] > this.life[i] || !this.inRegion(lon, lat);
      if (!gone && map && i % 8 === this.frame) {
        const p = map.project([lon, lat]);
        gone = p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20;
      }
      if (gone) {
        this.spawn(i);
        lon = this.lon[i];
        lat = this.lat[i];
      }
      const [u, v] = windAt(field, lon, lat);
      const c = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      lon += (u * k) / c;
      lat += v * k;
      if (lat > 89.5 || lat < -89.5) {
        this.spawn(i);
        lon = this.lon[i];
        lat = this.lat[i];
      }
      lon = ((((lon + 180) % 360) + 360) % 360) - 180;
      this.lon[i] = lon;
      this.lat[i] = lat;
      this.slice[i * 3] = lon;
      this.slice[i * 3 + 1] = lat;
      // 剛出生的那一格不畫（不然重生的粒子跟舊尾巴之間沒有連起來，但看起來像一個亮點跳過去）
      this.slice[i * 3 + 2] = this.age[i] === 0 ? 0 : Math.hypot(u, v);
    }
  }

  private writeSlice(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.points);
    gl.bufferSubData(gl.ARRAY_BUFFER, this.head * this.n * 3 * 4, this.slice);
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const map = this.map;
    if (!this.points || !this.slots || !map || !this.field) return;
    const p = this.program(gl, args.shaderData);
    if (!p) return;
    this.globe = args.shaderData.define.includes('GLOBE');
    this.updateRegion(map);
    const zoom = map.getZoom();

    if (reducedMotion()) {
      // 不動：畫面或風場換了，就讓每個粒子從頭走一整段尾巴，畫成靜止的風向線
      const c = map.getCenter();
      const key = `${c.lng.toFixed(2)},${c.lat.toFixed(2)},${zoom.toFixed(2)},${this.globe}`;
      if (key !== this.staticKey) {
        this.staticKey = key;
        for (let i = 0; i < this.n; i++) this.spawn(i);
        for (let s = 0; s < TRAIL; s++) {
          this.head = s;
          this.step(1 / 30, zoom);
          for (let i = 0; i < this.n; i++) this.age[i] = 1;
          this.writeSlice(gl);
        }
      }
    } else if (this.started) {
      const now = performance.now();
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
      this.last = now;
      // 畫面跳了一大段（切換地球儀與平面、縮放差 1 級以上、中心移出畫面的一半）：整批重新撒，不必等粒子慢慢重生
      const c = map.getCenter();
      const last = this.view;
      if (last) {
        const p = map.project([last.lng, last.lat]);
        const canvas = map.getCanvas();
        const moved = Math.hypot(p.x - canvas.clientWidth / 2, p.y - canvas.clientHeight / 2);
        if (last.globe !== this.globe || Math.abs(last.zoom - zoom) > 1 || moved > Math.min(canvas.clientWidth, canvas.clientHeight) / 2) {
          this.seeded = false;
        }
      }
      if (!last || !this.seeded) this.view = { lng: c.lng, lat: c.lat, zoom, globe: this.globe };
      if (!this.seeded) {
        this.seeded = true;
        for (let i = 0; i < this.n; i++) {
          this.spawn(i);
          // 一開始的年齡錯開，不會同時重生
          this.age[i] = Math.random() * this.life[i];
        }
      }
      this.head = (this.head + 1) % TRAIL;
      this.step(dt, zoom);
      this.writeSlice(gl);
    }

    const u = p.uniforms;
    const proj = args.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.u_projection_matrix, false, new Float32Array(proj.mainMatrix));
    gl.uniformMatrix4fv(u.u_projection_fallback_matrix, false, new Float32Array(proj.fallbackMatrix));
    gl.uniform4f(u.u_projection_tile_mercator_coords, ...proj.tileMercatorCoords);
    gl.uniform4f(u.u_projection_clipping_plane, ...proj.clippingPlane);
    gl.uniform1f(u.u_projection_transition, proj.projectionTransition);
    gl.uniform1f(u.u_head, this.head);
    gl.uniform1f(u.u_size, Math.max(1.2, 1.3 * (window.devicePixelRatio || 1)));
    gl.uniform3f(u.u_color, ...hexToRgb(this.look.color));
    gl.uniform1f(u.u_opacity, this.look.opacity);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.points);
    gl.enableVertexAttribArray(p.point);
    gl.vertexAttribPointer(p.point, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.slots);
    gl.enableVertexAttribArray(p.slot);
    gl.vertexAttribPointer(p.slot, 1, gl.FLOAT, false, 4, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const offsets = this.globe ? [0] : worldOffsets(map);
    for (const offset of offsets) {
      gl.uniform1f(u.u_world_offset, offset);
      gl.drawArrays(gl.POINTS, 0, this.n * TRAIL);
    }
    gl.disableVertexAttribArray(p.point);
    gl.disableVertexAttribArray(p.slot);
    if (this.started && !reducedMotion()) map.triggerRepaint();
  }
}

/** 平面地圖畫面上看得到的世界副本（classGridLayer.ts 同一個做法） */
function worldOffsets(map: MaplibreMap): number[] {
  const b = map.getBounds();
  const west = Math.floor((b.getWest() + 180) / 360);
  const east = Math.floor((b.getEast() + 180) / 360);
  const out: number[] = [];
  for (let i = Math.max(west, -3); i <= Math.min(east, 3); i++) out.push(i);
  return out.length ? out : [0];
}

const layers = new WeakMap<MaplibreMap, WindLayer>();

/**
 * 讓地圖上的風的粒子跟設定一致：要畫（visible 且有風場）時加上自訂圖層，不要時拿掉；換底圖後重新加上。
 * id 是 null 時（這個主題沒有風）拿掉
 */
export function syncWind(map: MaplibreMap, id: string | null, visible: boolean, field: WindField | null, look: WindLook) {
  const layerId = id ? `${WIND_LAYER_PREFIX}${id}` : null;
  let layer = layers.get(map);
  if (layer && (layer.id !== layerId || !visible || !field || !map.getLayer(layer.id))) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    layers.delete(map);
    layer = undefined;
  }
  if (!layerId || !visible || !field) return;
  if (!layer) {
    layer = new WindLayer(layerId);
    layer.setField(field);
    layer.look = look;
    map.addLayer(layer, map.getLayer(BEFORE) ? BEFORE : undefined);
    layers.set(map, layer);
  } else {
    layer.setField(field);
    layer.look = look;
  }
  map.triggerRepaint();
}
