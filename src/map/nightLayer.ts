/**
 * 晝夜的疊加圖層（NightOverlayDef，晝夜與季節主題）：地球的夜半邊與晨昏蒙影，加上太陽直射點。
 *
 * 用 MapLibre 的自訂 WebGL 圖層（custom layer）畫：一張經緯度每 2° 一格的網格蓋住整個地球（含兩極），
 * 每個像素在片段著色器裡算太陽高度角 h = asin(n · s)（n 是那一點的單位向量、s 是太陽直射點的方向，
 * lib/solar.ts 的 sunVector），依 h 落在哪一段決定變暗多少：
 *   −0.833° 以上白天（不畫）、到 −6° 民用曙暮光、到 −12° 航海、到 −18° 天文、再往下是夜晚，一段比一段暗，
 *   段與段之間柔和地漸變（約 1°，再窄也至少一個像素）。
 *
 * 為什麼不用 GeoJSON 的多邊形：
 * - 夜半邊幾乎永遠蓋住一個極點，MapLibre 的 GeoJSON 圖磚只到 ±85.05°（Web Mercator 的邊界），
 *   地球儀上極點附近會破一個洞（晝夜界線的經典錯誤）；這裡的網格直接畫到 ±90°，用 MapLibre 地球儀的投影函式
 *   （interpolateProjection）把每個頂點放到球面上。
 * - 不必處理 180° 經線與極點的多邊形切割：單位向量在球面上是連續的。
 * - 播放時每一格只換一個 uniform（太陽的方向），不必重送幾何、不必讓 worker 重新切圖磚。
 * 平面地圖時一樣的網格用 Web Mercator 座標畫（只到 ±85.05°），左右各多畫一份世界（縮小時看得到旁邊的副本）。
 *
 * 太陽直射點是一般的 GeoJSON 圓點（`night-sun`），每一格 setData 一個點。
 * 切換底圖後新樣式沒有這些圖層，WorldMap 依 revision 重新加上。
 *
 * 夜半邊的燈光（NightOverlayDef.lights，2026-10-30 起）：同一個片段著色器依經緯度讀一張 0.1° 的灰階燈光圖
 * （pipeline/topics/daylight_lights.py），天黑的地方疊上燈光色，白天的那一半不畫；跟夜色在同一個像素裡合成，
 * 不必另一個圖層去遮白天。圖不大（3600 × 1370），放大後是模糊的光暈。
 *
 * 月亮（MoonOverlayDef，2026-10-29 起）用同一個圖層畫「看得到月亮的半個地球」：方向換成月下點的反方向，
 * 只用第一道邊界（月亮的地心高度門檻），淡淡一層月光色；月下點是另一個 GeoJSON 圓點（`moon-point`）。
 */
import type {
  CircleLayerSpecification,
  CustomLayerInterface,
  CustomRenderMethodInput,
  GeoJSONSource,
  Map as MaplibreMap,
} from 'maplibre-gl';
import { subsolarPoint, sunVector, SUNRISE_DEPRESSION, TWILIGHT_DEPRESSIONS } from '../lib/solar';
import { LIGHTS_LOOK, MOON_COLOR, MOON_LOOK, NIGHT_LOOK, SUN_COLOR } from './nightLook';

/** 自訂圖層插在國界、選取外框之前：夜色蓋住底圖與國家的顏色，國界、外框、疊加圖層與地名畫在上面 */
const NIGHT_BEFORE = 'data-border';
/** 太陽直射點插在框選範圍之前（疊加圖層最上面） */
const SUN_BEFORE = 'box-fill';
const SUN_SOURCE = 'night-sun';
const MOON_SOURCE = 'moon-point';

/** 網格的間隔（°） */
const STEP = 2;
/** Web Mercator 的緯度上限 */
const MERCATOR_MAX_LAT = 85.0511287798;

// 頂點：v_n 是那一點的單位向量（給片段著色器算太陽高度）。地球儀時用 MapLibre 地球儀的座標放到球面上：
// x 往東經 90°、y 往北極、z 往經度 0（projectToSphere 的寫法），極點也是精確的
const VERTEX_SOURCE = `
in vec2 a_merc;
in vec2 a_lonlat;
uniform float u_world_offset;
out vec3 v_n;
void main() {
  float lon = radians(a_lonlat.x);
  float lat = radians(a_lonlat.y);
  v_n = vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
  vec2 merc = a_merc + vec2(u_world_offset, 0.0);
#ifdef GLOBE
  vec3 sphere = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  gl_Position = interpolateProjection(merc, sphere, 0.0);
#else
  gl_Position = projectTile(merc);
#endif
}`;

// 片段：太陽高度 h 落在哪一段決定不透明度，段與段之間柔和地漸變（約 1°，縮小時至少一個像素寬）
// 燈光（u_lights_on）：燈光圖是經緯度對齊的，x 是經度 −180°–180°，y 從北緣 u_lights_lat.y 到南緣 u_lights_lat.x；
// u_lights_look 是最亮的不透明度、開始出現與全亮的太陽高度（LIGHTS_LOOK）
const FRAGMENT_SOURCE = `
precision highp float;
in vec3 v_n;
uniform vec3 u_sun;
uniform vec3 u_color;
uniform vec4 u_steps;
uniform vec4 u_edges;
uniform sampler2D u_lights;
uniform float u_lights_on;
uniform vec2 u_lights_lat;
uniform vec3 u_lights_color;
uniform vec3 u_lights_look;
out vec4 fragColor;
float below(float edge, float h, float w) {
  return 1.0 - smoothstep(edge - w, edge + w, h);
}
void main() {
  vec3 n = normalize(v_n);
  float h = degrees(asin(clamp(dot(n, u_sun), -1.0, 1.0)));
  float w = max(fwidth(h) * 0.75, 0.5);
  float a = u_steps.x * below(u_edges.x, h, w) + u_steps.y * below(u_edges.y, h, w)
    + u_steps.z * below(u_edges.z, h, w) + u_steps.w * below(u_edges.w, h, w);
  vec3 rgb = u_color * a;
  if (u_lights_on > 0.5) {
    float lat = degrees(asin(clamp(n.z, -1.0, 1.0)));
    float lon = degrees(atan(n.y, n.x));
    vec2 uv = vec2((lon + 180.0) / 360.0, (u_lights_lat.y - lat) / (u_lights_lat.y - u_lights_lat.x));
    float inside = step(0.0, uv.y) * step(uv.y, 1.0);
    float c = texture(u_lights, uv).r * inside;
    float l = pow(c, 1.3) * u_lights_look.x * (1.0 - smoothstep(u_lights_look.z, u_lights_look.y, h));
    rgb = u_lights_color * l + rgb * (1.0 - l);
    a = l + a * (1.0 - l);
  }
  fragColor = vec4(rgb, a);
}`;

interface Program {
  program: WebGLProgram;
  merc: number;
  lonlat: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  'u_projection_matrix',
  'u_projection_fallback_matrix',
  'u_projection_tile_mercator_coords',
  'u_projection_clipping_plane',
  'u_projection_transition',
  'u_world_offset',
  'u_sun',
  'u_color',
  'u_steps',
  'u_edges',
  'u_lights',
  'u_lights_on',
  'u_lights_lat',
  'u_lights_color',
  'u_lights_look',
] as const;

/** WebGL 1 沒有 in/out 與 fwidth：照 MapLibre 的做法改寫（fwidth 要 OES_standard_derivatives） */
function toWebGL1(source: string, fragment: boolean): string {
  let out = source.replace(/^\s*#version 300 es\s*$/m, '');
  if (fragment) {
    out = `#extension GL_OES_standard_derivatives : enable\n${out}`
      .replace(/\bin\s+(?=\w+\s+\w+;)/g, 'varying ')
      .replace(/out vec4 fragColor;/, '')
      .replace(/fragColor/g, 'gl_FragColor')
      .replace(/\btexture\(/g, 'texture2D(');
  } else {
    out = out.replace(/\bin\s+(?=\w+\s+\w+;)/g, 'attribute ').replace(/\bout\s+(?=\w+\s+\w+;)/g, 'varying ');
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** 圖層的樣子：顏色、四道邊界（高度角，由高到低）與過了每一道各加多少不透明度 */
interface Shade {
  color: string;
  steps: readonly number[];
  edges: readonly number[];
}

/** 晝夜：夜色，四道邊界是日出日落與三種曙暮光 */
function nightShade(layer: NightLayer): Shade {
  const look = layer.dark ? NIGHT_LOOK.dark : NIGHT_LOOK.light;
  return { color: look.color, steps: look.steps, edges: [-SUNRISE_DEPRESSION, -TWILIGHT_DEPRESSIONS[0], -TWILIGHT_DEPRESSIONS[1], -TWILIGHT_DEPRESSIONS[2]] };
}

/**
 * 月亮：方向是月下點的反方向，「從反方向看的高度」低於 −門檻就是月亮在地平線上，蓋一層月光色。
 * 邊界的細環：第一道邊界往外推 ringWidth、加 ring，第二道邊界（真正的門檻）再減回去只剩淡淡的一層
 * （ring + (opacity − ring) = opacity；兩段之間就是細環）。其他兩道放在 −91°（永遠碰不到）
 */
function moonShade(layer: NightLayer): Shade {
  const look = layer.dark ? MOON_LOOK.dark : MOON_LOOK.light;
  return {
    color: look.color,
    steps: [look.ring, look.opacity - look.ring, 0, 0],
    edges: [-layer.threshold + MOON_LOOK.ringWidth, -layer.threshold, -91, -91],
  };
}

class NightLayer implements CustomLayerInterface {
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  readonly id: string;
  /** 著色器的方向（晝夜是太陽，月亮是月下點的反方向） */
  sun: [number, number, number] = [1, 0, 0];
  dark = false;
  /** 月亮的地心高度門檻（°） */
  threshold = 0;
  /** 月亮：那一刻的月下點（主題給的 MoonOverlayDef.position） */
  position: ((time: number) => { lon: number; lat: number; horizon: number }) | null = null;
  /** 夜半邊的燈光（NightOverlayDef.lights）：圖的網址、[南, 北]、讀好的圖（還沒讀好是 null） */
  lights: { url: string; bounds: [number, number]; image: HTMLImageElement | null } | null = null;
  private lightsTexture: WebGLTexture | null = null;
  private lightsUploaded: HTMLImageElement | null = null;
  private readonly shade: (layer: NightLayer) => Shade;
  private map: MaplibreMap | null = null;
  private vertices: WebGLBuffer | null = null;
  private indices: WebGLBuffer | null = null;
  private count = 0;
  private programs = new Map<string, Program | null>();
  private webgl2 = true;

  constructor(id: string, shade: (layer: NightLayer) => Shade = nightShade) {
    this.id = id;
    this.shade = shade;
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!this.webgl2) gl.getExtension('OES_standard_derivatives');
    // 每個頂點 4 個數：Web Mercator 的 x、y（超出 ±85.05° 的夾在邊上，平面時那幾列是退化的三角形）、經度、緯度
    const lats: number[] = [];
    for (let lat = -90; lat <= 90; lat += STEP) lats.push(lat);
    const lons: number[] = [];
    for (let lon = -180; lon <= 180; lon += STEP) lons.push(lon);
    const data = new Float32Array(lats.length * lons.length * 4);
    let k = 0;
    for (const lat of lats) {
      const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
      const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / (2 * Math.PI);
      for (const lon of lons) {
        data[k++] = (lon + 180) / 360;
        data[k++] = y;
        data[k++] = lon;
        data[k++] = lat;
      }
    }
    const index: number[] = [];
    const cols = lons.length;
    for (let r = 0; r < lats.length - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        index.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
      }
    }
    this.count = index.length;
    this.vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  }

  onRemove(_map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    if (this.vertices) gl.deleteBuffer(this.vertices);
    if (this.indices) gl.deleteBuffer(this.indices);
    if (this.lightsTexture) gl.deleteTexture(this.lightsTexture);
    this.lightsTexture = null;
    this.lightsUploaded = null;
    for (const p of this.programs.values()) if (p) gl.deleteProgram(p.program);
    this.programs.clear();
    this.map = null;
  }

  /** 依投影（地球儀、平面）編譯不同的著色器，MapLibre 給的 variantName 當快取的鍵 */
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
        console.warn('night layer shader', gl.getShaderInfoLog(s));
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
          merc: gl.getAttribLocation(program, 'a_merc'),
          lonlat: gl.getAttribLocation(program, 'a_lonlat'),
          uniforms: Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(program, u)])),
        };
      } else {
        console.warn('night layer program', gl.getProgramInfoLog(program));
      }
    }
    this.programs.set(shader.variantName, result);
    return result;
  }

  /** 燈光圖讀好了就上傳成貼圖（只傳一次）；沒有燈光、還沒讀好、或貼圖太大這張顯示卡放不下時回傳 null */
  private lightsReady(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    const lights = this.lights;
    if (!lights?.image) return null;
    if (this.lightsUploaded !== lights.image) {
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      if (lights.image.width > max || lights.image.height > max) return null;
      if (!this.lightsTexture) this.lightsTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.lightsTexture);
      // 寬高不是 2 的次方：WebGL 1 只能 CLAMP_TO_EDGE、不用 mipmap
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lights.image);
      this.lightsUploaded = lights.image;
    }
    return lights;
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.vertices || !this.indices || !this.map) return;
    const p = this.program(gl, args.shaderData);
    if (!p) return;
    const u = p.uniforms;
    const proj = args.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.u_projection_matrix, false, new Float32Array(proj.mainMatrix));
    gl.uniformMatrix4fv(u.u_projection_fallback_matrix, false, new Float32Array(proj.fallbackMatrix));
    gl.uniform4f(u.u_projection_tile_mercator_coords, ...proj.tileMercatorCoords);
    gl.uniform4f(u.u_projection_clipping_plane, ...proj.clippingPlane);
    gl.uniform1f(u.u_projection_transition, proj.projectionTransition);
    gl.uniform3f(u.u_sun, ...this.sun);
    const look = this.shade(this);
    gl.uniform3f(u.u_color, ...hexToRgb(look.color));
    gl.uniform4f(u.u_steps, look.steps[0], look.steps[1], look.steps[2], look.steps[3]);
    gl.uniform4f(u.u_edges, look.edges[0], look.edges[1], look.edges[2], look.edges[3]);
    const lights = this.lightsReady(gl);
    gl.uniform1f(u.u_lights_on, lights ? 1 : 0);
    if (lights) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.lightsTexture);
      gl.uniform1i(u.u_lights, 0);
      gl.uniform2f(u.u_lights_lat, lights.bounds[0], lights.bounds[1]);
      gl.uniform3f(u.u_lights_color, ...hexToRgb(LIGHTS_LOOK.color));
      gl.uniform3f(u.u_lights_look, LIGHTS_LOOK.strength, LIGHTS_LOOK.fadeFrom, LIGHTS_LOOK.fadeTo);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.enableVertexAttribArray(p.merc);
    gl.vertexAttribPointer(p.merc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(p.lonlat);
    gl.vertexAttribPointer(p.lonlat, 2, gl.FLOAT, false, 16, 8);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // 平面地圖縮小時看得到左右的副本，各畫一份；地球儀只有一份
    const globe = args.shaderData.define.includes('GLOBE');
    const offsets = globe ? [0] : worldOffsets(this.map);
    for (const offset of offsets) {
      gl.uniform1f(u.u_world_offset, offset);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.disableVertexAttribArray(p.merc);
    gl.disableVertexAttribArray(p.lonlat);
  }
}

/** 平面地圖畫面上看得到的世界副本（Web Mercator 的 x 平移幾個世界） */
function worldOffsets(map: MaplibreMap): number[] {
  const b = map.getBounds();
  const west = Math.floor((b.getWest() + 180) / 360);
  const east = Math.floor((b.getEast() + 180) / 360);
  const out: number[] = [];
  for (let i = Math.max(west, -3); i <= Math.min(east, 3); i++) out.push(i);
  return out.length ? out : [0];
}

const layers = new WeakMap<MaplibreMap, NightLayer>();

function sunPoint(time: number): GeoJSON.FeatureCollection {
  const [lon, lat] = subsolarPoint(time);
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }] };
}

const SUN_LAYERS: CircleLayerSpecification[] = [
  {
    // 外面一圈柔和的光暈，在任何底圖上都找得到
    id: 'night-sun-glow',
    type: 'circle',
    source: SUN_SOURCE,
    paint: { 'circle-radius': 16, 'circle-color': SUN_COLOR, 'circle-opacity': 0.28, 'circle-blur': 0.8 },
  },
  {
    id: 'night-sun',
    type: 'circle',
    source: SUN_SOURCE,
    paint: {
      'circle-radius': 6.5,
      'circle-color': SUN_COLOR,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  },
];

/**
 * 讓地圖上的晝夜圖層跟設定一致：要畫（visible）時加上自訂圖層與太陽直射點，不要時拿掉；換底圖後重新加上。
 * id 是 null 時（這個主題沒有晝夜圖層）全部拿掉。lights 是夜半邊的燈光圖（網址與 [南, 北]），沒有是 null
 */
export function syncNight(
  map: MaplibreMap,
  id: string | null,
  visible: boolean,
  dark: boolean,
  time: number | null,
  lights: { url: string; bounds: [number, number] } | null = null,
) {
  const layerId = id ? `night-${id}` : null;
  let layer = layers.get(map);
  if (layer && (layer.id !== layerId || !visible || time === null || !map.getLayer(layer.id))) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    layers.delete(map);
    layer = undefined;
  }
  if (!layerId || !visible || time === null) {
    for (const l of SUN_LAYERS) if (map.getLayer(l.id)) map.removeLayer(l.id);
    if (map.getSource(SUN_SOURCE)) map.removeSource(SUN_SOURCE);
    return;
  }
  if (!layer) {
    layer = new NightLayer(layerId);
    map.addLayer(layer, map.getLayer(NIGHT_BEFORE) ? NIGHT_BEFORE : undefined);
    layers.set(map, layer);
  }
  if (!map.getSource(SUN_SOURCE)) map.addSource(SUN_SOURCE, { type: 'geojson', data: sunPoint(time) });
  for (const l of SUN_LAYERS) if (!map.getLayer(l.id)) map.addLayer(l, map.getLayer(SUN_BEFORE) ? SUN_BEFORE : undefined);
  layer.dark = dark;
  setNightLights(map, layer, lights);
  setNightTime(map, time);
}

/** 換燈光圖：網址不同時重新讀（讀好才畫，讀不到就不畫燈光） */
function setNightLights(map: MaplibreMap, layer: NightLayer, lights: { url: string; bounds: [number, number] } | null) {
  if (!lights) {
    layer.lights = null;
    return;
  }
  if (layer.lights?.url === lights.url) return;
  const entry: NonNullable<NightLayer['lights']> = { url: lights.url, bounds: lights.bounds, image: null };
  layer.lights = entry;
  const image = new Image();
  image.onload = () => {
    entry.image = image;
    map.triggerRepaint();
  };
  image.src = lights.url;
}

/** 換一個時刻：太陽的方向（uniform）與直射點；不重送網格 */
export function setNightTime(map: MaplibreMap, time: number) {
  const layer = layers.get(map);
  if (!layer) return;
  layer.sun = sunVector(time);
  (map.getSource(SUN_SOURCE) as GeoJSONSource | undefined)?.setData(sunPoint(time));
  map.triggerRepaint();
}

/* ── 月亮（MoonOverlayDef）：看得到月亮的半個地球與月下點 ── */

const moonLayers = new WeakMap<MaplibreMap, NightLayer>();

function pointCollection(lon: number, lat: number): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }] };
}

const MOON_LAYERS: CircleLayerSpecification[] = [
  {
    id: 'moon-point-glow',
    type: 'circle',
    source: MOON_SOURCE,
    paint: { 'circle-radius': 15, 'circle-color': MOON_COLOR, 'circle-opacity': 0.3, 'circle-blur': 0.8 },
  },
  {
    id: 'moon-point',
    type: 'circle',
    source: MOON_SOURCE,
    paint: { 'circle-radius': 6, 'circle-color': MOON_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
  },
];

/**
 * 讓地圖上的月亮圖層跟設定一致（跟 syncNight 一樣）：要畫時加上自訂圖層與月下點，不要時拿掉；換底圖後重新加上。
 * position 是主題給的月下點（MoonOverlayDef.position）
 */
export function syncMoon(
  map: MaplibreMap,
  id: string | null,
  visible: boolean,
  dark: boolean,
  time: number | null,
  position: ((time: number) => { lon: number; lat: number; horizon: number }) | null,
) {
  const layerId = id ? `moon-${id}` : null;
  let layer = moonLayers.get(map);
  const off = !layerId || !visible || time === null || !position;
  if (layer && (layer.id !== layerId || off || !map.getLayer(layer.id))) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    moonLayers.delete(map);
    layer = undefined;
  }
  if (off) {
    for (const l of MOON_LAYERS) if (map.getLayer(l.id)) map.removeLayer(l.id);
    if (map.getSource(MOON_SOURCE)) map.removeSource(MOON_SOURCE);
    return;
  }
  if (!layer) {
    layer = new NightLayer(layerId, moonShade);
    map.addLayer(layer, map.getLayer(NIGHT_BEFORE) ? NIGHT_BEFORE : undefined);
    moonLayers.set(map, layer);
  }
  const p = position(time);
  if (!map.getSource(MOON_SOURCE)) map.addSource(MOON_SOURCE, { type: 'geojson', data: pointCollection(p.lon, p.lat) });
  for (const l of MOON_LAYERS) if (!map.getLayer(l.id)) map.addLayer(l, map.getLayer(SUN_BEFORE) ? SUN_BEFORE : undefined);
  layer.dark = dark;
  layer.position = position;
  setMoonTime(map, time);
}

/** 換一個時刻：月亮的方向、門檻與月下點；不重送網格 */
export function setMoonTime(map: MaplibreMap, time: number) {
  const layer = moonLayers.get(map);
  if (!layer?.position) return;
  const p = layer.position(time);
  const c = Math.cos((p.lat * Math.PI) / 180);
  const lon = (p.lon * Math.PI) / 180;
  layer.sun = [-c * Math.cos(lon), -c * Math.sin(lon), -Math.sin((p.lat * Math.PI) / 180)];
  layer.threshold = p.horizon;
  (map.getSource(MOON_SOURCE) as GeoJSONSource | undefined)?.setData(pointCollection(p.lon, p.lat));
  map.triggerRepaint();
}
