/**
 * 類別網格（ClassGridOverlayDef，2026-10-29 起，氣候分區）：經緯度對齊的全球網格，每格一個類別代碼，依代碼上色。
 *
 * 跟即時網格（liveGridLayer.ts）、晝夜圖層同一種做法：MapLibre 的自訂 WebGL 圖層，一張經緯度每 1° 一點的網格
 * （181 × 361 個頂點）蓋住整個地球，地球儀時用 MapLibre 地球儀的投影函式放到球面上，兩極、180° 經線沒有接縫。
 * 不同的是顏色不在頂點上：片段著色器用內插出來的經緯度去讀一張「類別代碼」的貼圖（資料的原始解析度，例如 0.1° 是
 * 3600 × 1800，最近鄰取樣，格子維持方塊），再用代碼查一張 256 × 1 的調色盤貼圖。換時期只換代碼貼圖，
 * 換顏色或標出某一類（其他類變淡）只換調色盤。
 * 平面地圖只到 ±85.05°（Web Mercator 的邊界）。切換底圖後新樣式沒有這個圖層，WorldMap 依 revision 重新加上。
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MaplibreMap } from 'maplibre-gl';
import { WIND_LAYER_PREFIX } from './windLayer';

/** 插在國界、選取外框之前：國界、外框、疊加圖層與地名畫在上面 */
const BEFORE = 'data-border';
const MERCATOR_MAX_LAT = 85.0511287798;
const LONS = 361;
const LATS = 181;

/** 解開的網格：寬 × 高個代碼，第一列是北緯 90°、第一行是西經 180° */
export interface ClassGrid {
  width: number;
  height: number;
  codes: Uint8Array;
}

const VERTEX_SOURCE = `
in vec2 a_merc;
in vec2 a_lonlat;
uniform float u_world_offset;
out vec2 v_lonlat;
void main() {
  v_lonlat = a_lonlat;
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

// 代碼貼圖是單一通道（WebGL 2 的 R8、WebGL 1 的 LUMINANCE，值都在 r），乘 255 是代碼；調色盤 256 × 1，取格子中心
const FRAGMENT_SOURCE = `
precision highp float;
in vec2 v_lonlat;
uniform sampler2D u_codes;
uniform sampler2D u_palette;
uniform float u_opacity;
out vec4 fragColor;
void main() {
  vec2 uv = vec2((v_lonlat.x + 180.0) / 360.0, (90.0 - v_lonlat.y) / 180.0);
  float code = floor(texture(u_codes, uv).r * 255.0 + 0.5);
  vec4 c = texture(u_palette, vec2((code + 0.5) / 256.0, 0.5));
  float a = c.a * u_opacity;
  fragColor = vec4(c.rgb * a, a);
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
  'u_codes',
  'u_palette',
  'u_opacity',
] as const;

/** WebGL 1 沒有 in/out、texture()：照 MapLibre 的做法改寫 */
function toWebGL1(source: string, fragment: boolean): string {
  let out = source.replace(/^\s*#version 300 es\s*$/m, '').replace(/\btexture\(/g, 'texture2D(');
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
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface ClassGridLook {
  /** 代碼 → 顏色；沒列的代碼不畫 */
  colors: Map<number, string>;
  opacity: number;
  /** 只標出這一類（其他類變淡）；null 是全部照常 */
  only: number | null;
}

class ClassGridLayer implements CustomLayerInterface {
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;
  readonly id: string;
  look: ClassGridLook = { colors: new Map(), opacity: 1, only: null };
  private grid: ClassGrid | null = null;
  private gridDirty = false;
  private paletteDirty = true;
  private map: MaplibreMap | null = null;
  private vertices: WebGLBuffer | null = null;
  private indices: WebGLBuffer | null = null;
  private codes: WebGLTexture | null = null;
  private palette: WebGLTexture | null = null;
  private count = 0;
  private programs = new Map<string, Program | null>();
  private webgl2 = true;

  constructor(id: string) {
    this.id = id;
  }

  setGrid(grid: ClassGrid) {
    if (grid === this.grid) return;
    this.grid = grid;
    this.gridDirty = true;
  }

  setLook(look: ClassGridLook) {
    const same =
      look.opacity === this.look.opacity &&
      look.only === this.look.only &&
      look.colors.size === this.look.colors.size &&
      [...look.colors].every(([k, v]) => this.look.colors.get(k) === v);
    this.look = look;
    if (!same) this.paletteDirty = true;
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    // 每個頂點 4 個數：Web Mercator 的 x、y（超出 ±85.05° 的夾在邊上）、經度、緯度
    const data = new Float32Array(LATS * LONS * 4);
    let k = 0;
    for (let r = 0; r < LATS; r++) {
      const lat = r - 90;
      const clamped = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
      const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360)) / (2 * Math.PI);
      for (let c = 0; c < LONS; c++) {
        const lon = c - 180;
        data[k++] = (lon + 180) / 360;
        data[k++] = y;
        data[k++] = lon;
        data[k++] = lat;
      }
    }
    const index: number[] = [];
    for (let r = 0; r < LATS - 1; r++) {
      for (let c = 0; c < LONS - 1; c++) {
        const a = r * LONS + c;
        index.push(a, a + 1, a + LONS, a + 1, a + LONS + 1, a + LONS);
      }
    }
    this.count = index.length;
    this.vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
    this.codes = this.texture(gl);
    this.palette = this.texture(gl);
    this.gridDirty = true;
    this.paletteDirty = true;
  }

  private texture(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLTexture | null {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private upload(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (this.gridDirty && this.grid) {
      const { width, height, codes } = this.grid;
      gl.bindTexture(gl.TEXTURE_2D, this.codes);
      if (this.webgl2) {
        const gl2 = gl as WebGL2RenderingContext;
        gl2.texImage2D(gl2.TEXTURE_2D, 0, gl2.R8, width, height, 0, gl2.RED, gl2.UNSIGNED_BYTE, codes);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, codes);
      }
      this.gridDirty = false;
    }
    if (this.paletteDirty) {
      const rgba = new Uint8Array(256 * 4);
      for (const [code, hex] of this.look.colors) {
        if (code < 0 || code > 255) continue;
        const [r, g, b] = hexToRgb(hex);
        rgba.set([r, g, b, this.look.only === null || this.look.only === code ? 255 : 40], code * 4);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.palette);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      this.paletteDirty = false;
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  onRemove(_map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const b of [this.vertices, this.indices]) if (b) gl.deleteBuffer(b);
    for (const t of [this.codes, this.palette]) if (t) gl.deleteTexture(t);
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
        console.warn('class grid shader', gl.getShaderInfoLog(s));
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
        console.warn('class grid program', gl.getProgramInfoLog(program));
      }
    }
    this.programs.set(shader.variantName, result);
    return result;
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.vertices || !this.indices || !this.map || !this.grid) return;
    const p = this.program(gl, args.shaderData);
    if (!p) return;
    this.upload(gl);
    const u = p.uniforms;
    const proj = args.defaultProjectionData;
    gl.useProgram(p.program);
    gl.uniformMatrix4fv(u.u_projection_matrix, false, new Float32Array(proj.mainMatrix));
    gl.uniformMatrix4fv(u.u_projection_fallback_matrix, false, new Float32Array(proj.fallbackMatrix));
    gl.uniform4f(u.u_projection_tile_mercator_coords, ...proj.tileMercatorCoords);
    gl.uniform4f(u.u_projection_clipping_plane, ...proj.clippingPlane);
    gl.uniform1f(u.u_projection_transition, proj.projectionTransition);
    gl.uniform1f(u.u_opacity, this.look.opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.codes);
    gl.uniform1i(u.u_codes, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.palette);
    gl.uniform1i(u.u_palette, 1);
    gl.activeTexture(gl.TEXTURE0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices);
    gl.enableVertexAttribArray(p.merc);
    gl.vertexAttribPointer(p.merc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(p.lonlat);
    gl.vertexAttribPointer(p.lonlat, 2, gl.FLOAT, false, 16, 8);
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

const layers = new WeakMap<MaplibreMap, ClassGridLayer>();

/**
 * 讓地圖上的類別網格跟設定一致：要畫（visible 且有網格）時加上自訂圖層，不要時拿掉；換底圖後重新加上。
 * id 是 null 時（這個主題沒有類別網格）拿掉
 */
export function syncClassGrid(map: MaplibreMap, id: string | null, visible: boolean, grid: ClassGrid | null, look: ClassGridLook) {
  const layerId = id ? `class-grid-${id}` : null;
  let layer = layers.get(map);
  if (layer && (layer.id !== layerId || !visible || !grid || !map.getLayer(layer.id))) {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    layers.delete(map);
    layer = undefined;
  }
  if (!layerId || !visible || !grid) return;
  if (!layer) {
    layer = new ClassGridLayer(layerId);
    layer.setGrid(grid);
    layer.setLook(look);
    // 風的粒子（windLayer.ts）畫在類別網格上面：已經有的話插在它前面
    const wind = map.getStyle().layers.find((l) => l.id.startsWith(WIND_LAYER_PREFIX))?.id;
    map.addLayer(layer, wind ?? (map.getLayer(BEFORE) ? BEFORE : undefined));
    layers.set(map, layer);
  } else {
    layer.setGrid(grid);
    layer.setLook(look);
  }
  map.triggerRepaint();
}

// ── 讀取：pipeline 自己編碼的 8 位元灰階 PNG（不濾波），在瀏覽器裡解開，拿到原本的代碼 ──────────

const grids = new Map<string, Promise<ClassGrid>>();

/**
 * 讀一張類別網格（同一個網址只讀一次）。PNG 是 pipeline（例如 topics/koppen.py 的 png_gray）寫的：
 * 灰階 8 位元、每列濾波方式 0；用 DecompressionStream 解 zlib，不經過 canvas（canvas 可能做色彩轉換，代碼會變）
 */
export function loadClassGrid(url: string): Promise<ClassGrid> {
  let p = grids.get(url);
  if (!p) {
    p = fetchGrid(url);
    grids.set(url, p);
    p.catch(() => grids.delete(url));
  }
  return p;
}

async function fetchGrid(url: string): Promise<ClassGrid> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      if (body[8] !== 8 || body[9] !== 0) throw new Error(`${url} (not an 8-bit greyscale PNG)`);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    pos += 12 + len;
  }
  const stream = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  const codes = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) {
    const start = r * (width + 1);
    if (raw[start] !== 0) throw new Error(`${url} (row ${r} uses a PNG filter)`);
    codes.set(raw.subarray(start + 1, start + 1 + width), r * width);
  }
  return { width, height, codes };
}

/** 網格在這個經緯度的代碼（0 是沒有資料，例如海） */
export function classAt(grid: ClassGrid, lon: number, lat: number): number {
  const x = Math.floor((((((lon + 180) % 360) + 360) % 360) / 360) * grid.width);
  const y = Math.floor(((90 - lat) / 180) * grid.height);
  if (y < 0 || y >= grid.height) return 0;
  return grid.codes[y * grid.width + Math.min(grid.width - 1, x)];
}
