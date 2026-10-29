/**
 * 即時的全球網格（LiveGridOverlayDef，此刻的極光）：經緯度每 1° 一點的數值，畫成一個顏色、數值越大越不透明。
 *
 * 跟晝夜圖層（nightLayer.ts）同一種做法：MapLibre 的自訂 WebGL 圖層，一張經度 −180–180°、緯度 −90–90° 每 1° 一點的網格
 * （181 × 361 = 65,341 個頂點）蓋住整個地球，地球儀時用 MapLibre 地球儀的投影函式把頂點放到球面上，
 * 兩極、180° 經線都是同一張網格，沒有接縫；格點之間的值由 GPU 線性內插。平面地圖只到 ±85.05°（Web Mercator 的邊界）。
 * 位置固定（static），數值另一個 buffer，資料更新時只換數值（dynamic）。
 * 切換底圖後新樣式沒有這個圖層，WorldMap 依 revision 重新加上。
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MaplibreMap } from 'maplibre-gl';

/** 插在國界、選取外框之前：蓋住底圖與國家的顏色，國界、外框、疊加圖層與地名畫在上面（晝夜圖層之後加，畫在夜色上面） */
const BEFORE = 'data-border';
const MERCATOR_MAX_LAT = 85.0511287798;
export const GRID_LONS = 361;
export const GRID_LATS = 181;
/** 不透明度的折線最多幾個點 */
const MAX_STOPS = 4;

const VERTEX_SOURCE = `
in vec2 a_merc;
in vec2 a_lonlat;
in float a_value;
uniform float u_world_offset;
out float v_value;
void main() {
  v_value = a_value;
  float lon = radians(a_lonlat.x);
  float lat = radians(a_lonlat.y);
  vec2 merc = a_merc + vec2(u_world_offset, 0.0);
#ifdef GLOBE
  vec3 sphere = vec3(sin(lon) * cos(lat), sin(lat), cos(lon) * cos(lat));
  gl_Position = interpolateProjection(merc, sphere, 0.0);
#else
  gl_Position = projectTile(merc);
#endif
}`;

// 不透明度：低於第一個點不畫，點與點之間線性內插，最後一點以上維持
const FRAGMENT_SOURCE = `
precision highp float;
in float v_value;
uniform vec3 u_color;
uniform vec4 u_values;
uniform vec4 u_alphas;
uniform float u_count;
out vec4 fragColor;
void main() {
  float v = v_value;
  float a = 0.0;
  if (v >= u_values.x) {
    a = u_alphas.x;
    if (u_count > 1.5) a = mix(a, u_alphas.y, clamp((v - u_values.x) / max(u_values.y - u_values.x, 1e-6), 0.0, 1.0));
    if (u_count > 2.5 && v > u_values.y) a = mix(u_alphas.y, u_alphas.z, clamp((v - u_values.y) / max(u_values.z - u_values.y, 1e-6), 0.0, 1.0));
    if (u_count > 3.5 && v > u_values.z) a = mix(u_alphas.z, u_alphas.w, clamp((v - u_values.z) / max(u_values.w - u_values.z, 1e-6), 0.0, 1.0));
  }
  fragColor = vec4(u_color * a, a);
}`;

interface Program {
  program: WebGLProgram;
  merc: number;
  lonlat: number;
  value: number;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  'u_projection_matrix',
  'u_projection_fallback_matrix',
  'u_projection_tile_mercator_coords',
  'u_projection_clipping_plane',
  'u_projection_transition',
  'u_world_offset',
  'u_color',
  'u_values',
  'u_alphas',
  'u_count',
] as const;

/** WebGL 1 沒有 in/out：照 MapLibre 的做法改寫 */
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

export interface GridLook {
  color: string;
  /** [數值, 不透明度]，最多 4 點 */
  opacity: [number, number][];
}

class LiveGridLayer implements CustomLayerInterface {
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  readonly id: string;
  look: GridLook = { color: '#000000', opacity: [[0, 0]] };
  private values: Float32Array | null = null;
  private dirty = false;
  private map: MaplibreMap | null = null;
  private vertices: WebGLBuffer | null = null;
  private valueBuffer: WebGLBuffer | null = null;
  private indices: WebGLBuffer | null = null;
  private count = 0;
  private programs = new Map<string, Program | null>();
  private webgl2 = true;

  constructor(id: string) {
    this.id = id;
  }

  setValues(values: Float32Array) {
    this.values = values;
    this.dirty = true;
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    // 每個頂點 4 個數：Web Mercator 的 x、y（超出 ±85.05° 的夾在邊上，平面時那幾列是退化的三角形）、經度、緯度
    const data = new Float32Array(GRID_LATS * GRID_LONS * 4);
    let k = 0;
    for (let r = 0; r < GRID_LATS; r++) {
      const lat = r - 90;
      const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
      const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / (2 * Math.PI);
      for (let c = 0; c < GRID_LONS; c++) {
        const lon = c - 180;
        data[k++] = (lon + 180) / 360;
        data[k++] = y;
        data[k++] = lon;
        data[k++] = lat;
      }
    }
    const index: number[] = [];
    for (let r = 0; r < GRID_LATS - 1; r++) {
      for (let c = 0; c < GRID_LONS - 1; c++) {
        const a = r * GRID_LONS + c;
        index.push(a, a + 1, a + GRID_LONS, a + 1, a + GRID_LONS + 1, a + GRID_LONS);
      }
    }
    this.count = index.length;
    this.vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.valueBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.values ?? new Float32Array(GRID_LATS * GRID_LONS), gl.DYNAMIC_DRAW);
    this.dirty = false;
    this.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
  }

  onRemove(_map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const b of [this.vertices, this.valueBuffer, this.indices]) if (b) gl.deleteBuffer(b);
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
        console.warn('live grid shader', gl.getShaderInfoLog(s));
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
          value: gl.getAttribLocation(program, 'a_value'),
          uniforms: Object.fromEntries(UNIFORMS.map((u) => [u, gl.getUniformLocation(program, u)])),
        };
      } else {
        console.warn('live grid program', gl.getProgramInfoLog(program));
      }
    }
    this.programs.set(shader.variantName, result);
    return result;
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.vertices || !this.valueBuffer || !this.indices || !this.map || !this.values) return;
    const p = this.program(gl, args.shaderData);
    if (!p) return;
    if (this.dirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.values);
      this.dirty = false;
    }
    const u = p.uniforms;
    const proj = args.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.u_projection_matrix, false, new Float32Array(proj.mainMatrix));
    gl.uniformMatrix4fv(u.u_projection_fallback_matrix, false, new Float32Array(proj.fallbackMatrix));
    gl.uniform4f(u.u_projection_tile_mercator_coords, ...proj.tileMercatorCoords);
    gl.uniform4f(u.u_projection_clipping_plane, ...proj.clippingPlane);
    gl.uniform1f(u.u_projection_transition, proj.projectionTransition);
    gl.uniform3f(u.u_color, ...hexToRgb(this.look.color));
    const stops = this.look.opacity.slice(0, MAX_STOPS);
    const pad = (i: number, k: 0 | 1) => (stops[Math.min(i, stops.length - 1)] ?? [0, 0])[k];
    gl.uniform4f(u.u_values, pad(0, 0), pad(1, 0), pad(2, 0), pad(3, 0));
    gl.uniform4f(u.u_alphas, pad(0, 1), pad(1, 1), pad(2, 1), pad(3, 1));
    gl.uniform1f(u.u_count, stops.length);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.enableVertexAttribArray(p.merc);
    gl.vertexAttribPointer(p.merc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(p.lonlat);
    gl.vertexAttribPointer(p.lonlat, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.valueBuffer);
    gl.enableVertexAttribArray(p.value);
    gl.vertexAttribPointer(p.value, 1, gl.FLOAT, false, 4, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
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
    gl.disableVertexAttribArray(p.value);
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

const layers = new WeakMap<MaplibreMap, LiveGridLayer>();

/**
 * 讓地圖上的即時網格跟設定一致：要畫（visible 且有數值）時加上自訂圖層，不要時拿掉；換底圖後重新加上。
 * id 是 null 時（這個主題沒有即時網格）拿掉
 */
export function syncLiveGrid(map: MaplibreMap, id: string | null, visible: boolean, values: Float32Array | null, look: GridLook) {
  const layerId = id ? `live-grid-${id}` : null;
  let layer = layers.get(map);
  if (layer && (layer.id !== layerId || !visible || !values || !map.getLayer(layer.id))) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    layers.delete(map);
    layer = undefined;
  }
  if (!layerId || !visible || !values) return;
  if (!layer) {
    layer = new LiveGridLayer(layerId);
    layer.setValues(values);
    map.addLayer(layer, map.getLayer(BEFORE) ? BEFORE : undefined);
    layers.set(map, layer);
  } else {
    layer.setValues(values);
  }
  layer.look = look;
  map.triggerRepaint();
}
