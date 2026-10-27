/**
 * 國旗地圖（LayerSpec 的 kind: 'flags'）：每個國家塗上自己的國旗。
 *
 * MapLibre 的 fill-pattern 只能把一張小圖重複鋪滿（每個國家一整片小國旗壁紙），也不能把圖片裁成國界的形狀，
 * 所以改用自訂協定（addProtocol，跟 densityGrid.ts 的網格一樣）在瀏覽器裡畫點陣圖磚：
 * - 每個國家依國土的範圍算出國旗要畫在哪裡（placements()）：最大那塊陸地加上附近的島共用一面旗（日本的四個主島、
 *   法國本土與科西嘉），遠的島與屬地自己一面（阿拉斯加、法屬圭亞那）。國旗蓋滿那個範圍，國土比國旗瘦長或扁平時
 *   最多拉長 25%，其餘裁掉，裁的時候盡量留住國旗的重點（flags.json 的 fx、fy：左上角的方塊、旗桿側的三角形）。
 *   所以地圖上的國旗會變形、被裁切，正確的樣子看側欄。
 * - 每張圖磚：把落在裡面的國家用國界（Path2D，Web Mercator 的 0–1 座標）裁切（clip，evenodd 處理國界裡的洞，
 *   例如南非裡的賴索托），再把國旗畫進去。跨 180° 經線的國家（俄羅斯、斐濟）在左右各畫一次。
 * - 國旗的 SVG 先畫到固定大小的點陣圖（32–2048 px 寬，依圖磚上需要的大小取 2 的次方，最多放大 1.25 倍）再貼到圖磚，有記憶體上限（64 MB）
 *   （最近用的留著，超過就丟掉最舊的）；同一張點陣圖可以給很多張圖磚用，不必每張圖磚重新解析 SVG。
 * - 圖磚的網址帶版本（國界或國旗資料換了就加一），MapLibre 才不會拿到快取的舊圖磚。
 * 這個檔不 import MapLibre：WorldMap.tsx 用 addProtocol 註冊 loadFlagTile。
 */
import type { CountryFeature } from './geometry';
import { unwrapAntimeridian } from './geometry';

export const FLAG_PROTOCOL = 'flagtile';

/** 一個國家的國旗：圖檔網址、寬 ÷ 高、重點（0–1） */
export interface FlagSpec {
  url: string;
  aspect: number;
  fx: number;
  fy: number;
}

/** 一面國旗在地圖上的位置：哪些國土（Path2D）、國旗畫在哪個矩形（Web Mercator 0–1） */
interface Placement {
  flag: FlagSpec;
  path: Path2D;
  /** 國土的範圍 [x0, y0, x1, y1] */
  bbox: [number, number, number, number];
  /** 國旗畫的矩形 [x, y, 寬, 高] */
  rect: [number, number, number, number];
}

/** 國土比國旗瘦長或扁平時最多拉長這麼多倍，再多就裁掉 */
const MAX_STRETCH = 1.25;
/** 附近的島：跟最大那塊陸地的範圍相距不到它大小的這個比例，就共用一面旗 */
const NEAR = 0.25;
const MAX_LAT = 85.0511;

let placementsList: Placement[] = [];
let version = 0;

function mercator(lon: number, lat: number): [number, number] {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
}

interface Part {
  rings: [number, number][][];
  bbox: [number, number, number, number];
  area: number;
}

function partOf(polygon: number[][][]): Part {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const rings = polygon.map((ring) =>
    ring.map(([lon, lat]) => {
      const p = mercator(lon, lat);
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
      return p;
    }),
  );
  // 外環的面積（Web Mercator，只用來挑最大那塊）
  let area = 0;
  const outer = rings[0];
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) area += (outer[j][0] + outer[i][0]) * (outer[j][1] - outer[i][1]);
  return { rings, bbox: [x0, y0, x1, y1], area: Math.abs(area) / 2 };
}

/** 國旗要蓋滿 bbox：先把長寬比往國土靠（最多拉長 MAX_STRETCH 倍），再放大到蓋滿，位置盡量讓重點落在國土的中央 */
function rectFor(bbox: [number, number, number, number], flag: FlagSpec): [number, number, number, number] {
  const [x0, y0, x1, y1] = bbox;
  const bw = Math.max(x1 - x0, 1e-9);
  const bh = Math.max(y1 - y0, 1e-9);
  const aspect = Math.min(flag.aspect * MAX_STRETCH, Math.max(flag.aspect / MAX_STRETCH, bw / bh));
  const w = bw / bh > aspect ? bw : bh * aspect;
  const h = w / aspect;
  const x = Math.min(x0, Math.max(x1 - w, (x0 + x1) / 2 - flag.fx * w));
  const y = Math.min(y0, Math.max(y1 - h, (y0 + y1) / 2 - flag.fy * h));
  return [x, y, w, h];
}

function pathOf(parts: Part[]): Path2D {
  const path = new Path2D();
  for (const part of parts) {
    for (const ring of part.rings) {
      ring.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
    }
  }
  return path;
}

function union(parts: Part[]): [number, number, number, number] {
  return [
    Math.min(...parts.map((p) => p.bbox[0])),
    Math.min(...parts.map((p) => p.bbox[1])),
    Math.max(...parts.map((p) => p.bbox[2])),
    Math.max(...parts.map((p) => p.bbox[3])),
  ];
}

/** 依國界與國旗算出每一面旗畫在哪裡；回傳新的版本號（圖磚網址用） */
export function setFlagLayout(countries: CountryFeature[], flags: Map<string, FlagSpec>): number {
  const list: Placement[] = [];
  for (const c of countries) {
    const flag = flags.get(c.iso3);
    if (!flag) continue;
    const parts = unwrapAntimeridian(c.feature.geometry).coordinates.map(partOf);
    const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
    const pad = NEAR * Math.max(main.bbox[2] - main.bbox[0], main.bbox[3] - main.bbox[1]);
    const near = (p: Part) =>
      p.bbox[0] <= main.bbox[2] + pad && p.bbox[2] >= main.bbox[0] - pad && p.bbox[1] <= main.bbox[3] + pad && p.bbox[3] >= main.bbox[1] - pad;
    const group = parts.filter(near);
    const bbox = union(group);
    list.push({ flag, path: pathOf(group), bbox, rect: rectFor(bbox, flag) });
    for (const p of parts) {
      if (near(p)) continue;
      list.push({ flag, path: pathOf([p]), bbox: p.bbox, rect: rectFor(p.bbox, flag) });
    }
  }
  placementsList = list;
  return ++version;
}

/* ── 國旗的點陣圖（依需要的寬度取 2 的次方，有記憶體上限） ──────────────── */

const images = new Map<string, Promise<HTMLImageElement>>();
const rasters = new Map<string, Promise<ImageBitmap>>();
const rasterBytes = new Map<string, number>();
const RASTER_BUDGET = 64 * 1024 * 1024;
const MIN_RASTER = 32;
const MAX_RASTER = 2048;

function loadImage(url: string): Promise<HTMLImageElement> {
  let promise = images.get(url);
  if (!promise) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    promise = img.decode().then(() => img);
    promise.catch(() => images.delete(url));
    images.set(url, promise);
  }
  return promise;
}

/** 國旗畫成寬 width（2 的次方）的點陣圖 */
function raster(flag: FlagSpec, width: number): Promise<ImageBitmap> {
  const key = `${flag.url}@${width}`;
  let promise = rasters.get(key);
  if (promise) {
    // 最近用過的移到最後（Map 依加入的順序），丟的時候從最前面丟
    rasters.delete(key);
    rasters.set(key, promise);
    return promise;
  }
  promise = loadImage(flag.url).then((img) => {
    const height = Math.max(1, Math.round(width / flag.aspect));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.transferToImageBitmap();
  });
  promise.catch(() => rasters.delete(key));
  rasters.set(key, promise);
  rasterBytes.set(key, width * Math.round(width / flag.aspect) * 4);
  let total = [...rasterBytes.values()].reduce((a, b) => a + b, 0);
  for (const old of rasters.keys()) {
    if (total <= RASTER_BUDGET || old === key) break;
    total -= rasterBytes.get(old) ?? 0;
    rasters.get(old)?.then((bitmap) => bitmap.close()).catch(() => {});
    rasters.delete(old);
    rasterBytes.delete(old);
  }
  return promise;
}

/** 需要 px 寬時用哪一張點陣圖：2 的次方，最多放大 1.25 倍（看不出來），不必每次都取大一號、記憶體多一倍 */
function bucket(px: number): number {
  return Math.min(MAX_RASTER, Math.max(MIN_RASTER, 2 ** Math.ceil(Math.log2(Math.max(1, px / 1.25)))));
}

/* ── 圖磚 ─────────────────────────────────────────────────────────── */

/** 圖磚的像素：256 乘上裝置像素比（最多 2），高解析度螢幕上國旗的邊才清楚 */
const TILE = 256 * Math.min(2, Math.max(1, Math.round(globalThis.devicePixelRatio || 1)));
let empty: Promise<ImageBitmap> | null = null;

/** 圖磚網址：flagtile://<版本>/{z}/{x}/{y} */
export function flagTileUrl(v: number): string {
  return `${FLAG_PROTOCOL}://${v}/{z}/{x}/{y}`;
}

export async function loadFlagTile(
  params: { url: string },
  abort: AbortController,
): Promise<{ data: ImageBitmap }> {
  const m = /^\w+:\/\/(\d+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
  if (!m) throw new Error(`bad flag tile url ${params.url}`);
  const [z, tx, ty] = [Number(m[2]), Number(m[3]), Number(m[4])];
  const n = 2 ** z;
  const tile: [number, number, number, number] = [tx / n, ty / n, (tx + 1) / n, (ty + 1) / n];
  // 落在這張圖磚裡的國旗（跨 180° 經線的左右各試一次）
  const hits: [Placement, number][] = [];
  for (const p of placementsList) {
    for (const shift of [0, -1, 1]) {
      if (p.bbox[0] + shift < tile[2] && p.bbox[2] + shift > tile[0] && p.bbox[1] < tile[3] && p.bbox[3] > tile[1]) {
        hits.push([p, shift]);
      }
    }
  }
  if (!hits.length) {
    empty ??= createImageBitmap(new ImageData(1, 1));
    return { data: await empty };
  }
  const scale = n * TILE;
  const t0 = performance.now();
  const bitmaps = await Promise.all(hits.map(([p]) => raster(p.flag, bucket(p.rect[2] * scale))));
  if (abort.signal.aborted) throw new DOMException('aborted', 'AbortError');
  const t1 = performance.now();
  const canvas = new OffscreenCanvas(TILE, TILE);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  hits.forEach(([p, shift], i) => {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, (shift - tile[0]) * scale, -tile[1] * scale);
    ctx.clip(p.path, 'evenodd');
    const [x, y, w, h] = p.rect;
    ctx.drawImage(bitmaps[i], x, y, w, h);
    ctx.restore();
  });
  const data = canvas.transferToImageBitmap();
  // 開發模式留下每張圖磚的時間（等點陣圖、畫圖磚），效能量測用
  if (import.meta.env.DEV) {
    performance.measure('flagtile', { start: t0, end: performance.now(), detail: { z, wait: Math.round(t1 - t0), draw: Math.round(performance.now() - t1), hits: hits.length } });
  }
  return { data };
}

/* ── 小國的小國旗（地圖上太小、畫不出國土的國家，跟小國圓點同一個位置） ─────────── */

/** 小國旗的圖示（MapLibre addImage 用）：高 ICON_H px、依國旗比例，外面一圈深色細邊 */
export const ICON_H = 13;

export async function flagIcon(flag: FlagSpec, pixelRatio: number): Promise<ImageData> {
  const img = await loadImage(flag.url);
  const h = Math.round(ICON_H * pixelRatio);
  const w = Math.round(Math.min(2.2, Math.max(1, flag.aspect)) * ICON_H * pixelRatio);
  const pad = Math.max(1, Math.round(pixelRatio));
  const canvas = new OffscreenCanvas(w + pad * 2, h + pad * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(40, 40, 38, 0.85)';
  ctx.fillRect(0, 0, w + pad * 2, h + pad * 2);
  ctx.drawImage(img, pad, pad, w, h);
  return ctx.getImageData(0, 0, w + pad * 2, h + pad * 2);
}
