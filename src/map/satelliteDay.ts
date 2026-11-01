/**
 * 那一天的衛星照片（2026-11-01，MapLibre 範例「Add a WMS source」「Add a raster tile source」的做法；主題的 satellite）：
 * NASA GIBS 的每日真彩影像（Web Mercator 的 GoogleMapsCompatible_Level9，JPEG，不收費、不需金鑰、可以跨網域讀取），
 * 畫在資料圖層下面、底圖上面；換日期時換圖磚網址（setTiles）。
 *
 * **補黑縫**（同一天使用者問「衛星圖怎麼有黑色的縫」）：極軌衛星一天繞地球十幾圈，MODIS 每一圈拍約 2,300 km 寬，
 * 低緯度相鄰兩圈之間漏掉的地方 GIBS 填成黑色，變成一道道斜帶。所以圖磚經過自訂協定（`gibsday://日期/z/y/x`，loadDayTile）：
 * 依序讀幾顆衛星的同一張圖磚（DAY_LAYERS：2015-11-24 起 VIIRS 優先，它拍 3,000 km 寬、赤道也沒有縫；再來 NOAA-20 的 VIIRS、
 * MODIS Terra、下午經過的 MODIS Aqua；都沒拍到的再用前一天、後一天的 MODIS），前一張黑的像素（往外多 2 格，JPEG 的暗邊）用下一張補，
 * 黑的少於 0.2% 就停。2012-09-15 的圖磚實測黑縫 2% → 0–0.7%（只用當天）、2024-01-26 的 9.7% → 0。剩下的是極夜（本來就是暗的）。
 */
import type { AddProtocolResponseData, GetResourceResponse, Map as MaplibreMap, RasterTileSource, RequestParameters } from 'maplibre-gl';
import { GIBS_ATTRIBUTION } from './style';

export const SATELLITE_DAY = 'satellite-day';
export const SATELLITE_PROTOCOL = 'gibsday';
const FIRST_DAY = '2000-02-24';

/** 依優先順序的影像（from：GIBS 有資料的第一天） */
export const DAY_LAYERS: { id: string; from: string }[] = [
  { id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', from: '2015-11-24' },
  { id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', from: '2018-01-05' },
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', from: '2000-02-24' },
  { id: 'MODIS_Aqua_CorrectedReflectance_TrueColor', from: '2002-07-04' },
];

const tilesFor = (date: string) => `${SATELLITE_PROTOCOL}://${date}/{z}/{y}/{x}`;
const gibsTile = (layer: string, date: string, z: string, y: string, x: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/${z}/${y}/${x}.jpg`;

/** 沒拍到的像素（GIBS 填黑；JPEG 壓縮後不是剛好 0，三個顏色加起來小於這個值都算） */
const BLACK = 30;
const DONE_SHARE = 0.002;
const SIZE = 256;
/** 黑區往外多補幾個像素：JPEG 在黑邊留下的暗邊（不夠黑、但看得到一條虛線）一起換掉 */
const GROW = 2;

const isBlack = (px: Uint8ClampedArray, i: number) => px[i] + px[i + 1] + px[i + 2] < BLACK;

/** 圖磚的像素裡黑的比例 */
export function blackShare(px: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (isBlack(px, i)) n++;
  return n / (px.length / 4);
}

/** 黑的像素往外擴 grow 格的遮罩（先橫向、再縱向） */
function grownMask(px: Uint8ClampedArray, size: number, grow: number): Uint8Array {
  const n = px.length / 4;
  const black = new Uint8Array(n);
  for (let k = 0; k < n; k++) black[k] = isBlack(px, k * 4) ? 1 : 0;
  if (grow <= 0) return black;
  const width = n / size;
  const h = new Uint8Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < width; x++) {
      if (!black[y * width + x]) continue;
      for (let d = Math.max(0, x - grow); d <= Math.min(width - 1, x + grow); d++) h[y * width + d] = 1;
    }
  }
  const out = new Uint8Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < width; x++) {
      if (!h[y * width + x]) continue;
      for (let d = Math.max(0, y - grow); d <= Math.min(size - 1, y + grow); d++) out[d * width + x] = 1;
    }
  }
  return out;
}

/**
 * 把 next 補進 base 黑的像素（含往外 grow 格的暗邊；next 那一點也是黑的就不補），就地改 base，回傳補完後黑的比例。
 * rows 是圖磚的列數（預設當成正方形）
 */
export function fillBlack(base: Uint8ClampedArray, next: Uint8ClampedArray, grow = GROW, rows = Math.round(Math.sqrt(base.length / 4))): number {
  const mask = grownMask(base, rows, grow);
  let n = 0;
  for (let k = 0; k < mask.length; k++) {
    const i = k * 4;
    if (mask[k] && !isBlack(next, i)) {
      base[i] = next[i];
      base[i + 1] = next[i + 1];
      base[i + 2] = next[i + 2];
      base[i + 3] = 255;
    }
    if (isBlack(base, i)) n++;
  }
  return n / mask.length;
}

async function readTile(url: string, signal: AbortSignal): Promise<Uint8ClampedArray | null> {
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  bitmap.close();
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** 這一天要依序讀的圖磚：當天的各顆衛星，再來前一天、後一天的 MODIS（幾顆都沒拍到的赤道附近） */
export function dayCandidates(date: string): { layer: string; date: string }[] {
  const today = new Date().toISOString().slice(0, 10);
  const out: { layer: string; date: string }[] = [];
  for (const layer of DAY_LAYERS) if (date >= layer.from) out.push({ layer: layer.id, date });
  for (const d of [shiftDay(date, -1), shiftDay(date, 1)]) {
    if (d > today) continue;
    for (const layer of DAY_LAYERS.slice(2)) if (d >= layer.from) out.push({ layer: layer.id, date: d });
  }
  return out;
}

/** gibsday://日期/z/y/x：幾顆衛星（與前後一天）的同一張圖磚疊起來，補掉黑縫；同時先抓下一張，等的時間短一點 */
export async function loadDayTile(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<AddProtocolResponseData>> {
  const [date, z, y, x] = params.url.slice(SATELLITE_PROTOCOL.length + 3).split('/');
  const list = dayCandidates(date);
  const read = (k: number) =>
    k < list.length
      ? readTile(gibsTile(list[k].layer, list[k].date, z, y, x), abort.signal).catch((e: unknown) => {
          if ((e as { name?: string }).name === 'AbortError') throw e;
          return null;
        })
      : Promise.resolve(null);
  let base: Uint8ClampedArray | null = null;
  let pending = read(0);
  for (let k = 0; k < list.length; k++) {
    const ahead = read(k + 1);
    const px = await pending;
    pending = ahead;
    if (!px) continue;
    const share = base ? fillBlack(base, px) : blackShare((base = px));
    if (share < DONE_SHARE) break;
  }
  const canvas = new OffscreenCanvas(SIZE, SIZE);
  if (base) canvas.getContext('2d')!.putImageData(new ImageData(base as Uint8ClampedArray<ArrayBuffer>, SIZE, SIZE), 0, 0);
  return { data: canvas.transferToImageBitmap() };
}

/** GIBS 有影像的日子（2000-02-24 到今天；格式要是 YYYY-MM-DD） */
export function validDay(date: string | null, today = new Date().toISOString().slice(0, 10)): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= FIRST_DAY && date <= today ? date : null;
}

/** 依日期加上、換掉或藏起影像；before 是要插在哪個圖層前面（資料圖層的第一層） */
export function syncSatelliteDay(map: MaplibreMap, date: string | null, before?: string): void {
  const source = map.getSource(SATELLITE_DAY) as RasterTileSource | undefined;
  if (!date) {
    if (map.getLayer(SATELLITE_DAY)) map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'none');
    return;
  }
  if (!source) {
    map.addSource(SATELLITE_DAY, { type: 'raster', tiles: [tilesFor(date)], tileSize: 256, maxzoom: 9, attribution: GIBS_ATTRIBUTION });
    map.addLayer(
      { id: SATELLITE_DAY, type: 'raster', source: SATELLITE_DAY, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 200 } },
      before && map.getLayer(before) ? before : undefined,
    );
    return;
  }
  if (source.tiles?.[0] !== tilesFor(date)) source.setTiles([tilesFor(date)]);
  map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'visible');
}
