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
 *
 * **其他產品**（2026-11-02，新22、新35；SatelliteProduct）：同一個協定 `gibsday://產品/日期/z/y/x`，各產品自己的 GIBS 圖層、
 * 格式與最大縮放（PRODUCTS）：臭氧總量（OMPS 2012 年起、OMI 2004 年起，PNG，6 級）、葉綠素（VIIRS、MODIS 的每日 L2，PNG，
 * 7 級；雲擋住的地方用前幾天的補，等於幾天的合成）、夜間影像（VIIRS 的 Day/Night Band，PNG，7 級）。PNG 的空白是透明的，
 * 透明的像素用下一張補；陸地（葉綠素）永遠是透明的，所以補到「這一張幾乎沒有補到新的像素」就停。
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

/** 每日影像的種類（TopicDefinition.satellite.product） */
export type SatelliteProduct = 'truecolor' | 'ozone' | 'chlorophyll' | 'night';

interface Product {
  /** 依優先順序的 GIBS 圖層（from–to：有資料的日子） */
  layers: { id: string; from: string; to?: string }[];
  ext: 'jpg' | 'png';
  /** GoogleMapsCompatible_Level 幾（也是 MapLibre source 的 maxzoom） */
  level: number;
  /** 沒拍到的像素：真彩影像是黑的，其他是透明的 */
  gap: 'black' | 'transparent';
  /** 當天之外再用哪幾天補（天數差）；truecolor 另外只用 MODIS（DAY_LAYERS 的後兩個） */
  extraDays: number[];
  opacity: number;
}

export const PRODUCTS: Record<SatelliteProduct, Product> = {
  truecolor: { layers: DAY_LAYERS, ext: 'jpg', level: 9, gap: 'black', extraDays: [-1, 1], opacity: 0.9 },
  ozone: {
    layers: [
      { id: 'OMPS_Ozone_Total_Column', from: '2012-01-26' },
      { id: 'OMI_Ozone_TOMS_Total_Column', from: '2004-10-01' },
    ],
    ext: 'png',
    level: 6,
    gap: 'transparent',
    extraDays: [-1],
    opacity: 0.8,
  },
  chlorophyll: {
    layers: [
      { id: 'VIIRS_NOAA20_Chlorophyll_a', from: '2017-12-13' },
      { id: 'VIIRS_SNPP_L2_Chlorophyll_A', from: '2012-01-02', to: '2024-05-29' },
      { id: 'MODIS_Aqua_L2_Chlorophyll_A', from: '2002-07-04', to: '2022-03-31' },
    ],
    ext: 'png',
    level: 7,
    gap: 'transparent',
    extraDays: [-1, -2, -3, -4, -5, -6, -7],
    opacity: 0.6,
  },
  night: {
    layers: [
      { id: 'VIIRS_NOAA20_DayNightBand', from: '2018-01-05' },
      { id: 'VIIRS_SNPP_DayNightBand', from: '2012-03-01' },
    ],
    ext: 'png',
    level: 7,
    gap: 'transparent',
    extraDays: [],
    // 夜間影像是整個地球的灰階（雲在月光下也看得到），淡一點，底圖與極光預報才看得到
    opacity: 0.6,
  },
};

const tilesFor = (product: SatelliteProduct, date: string) => `${SATELLITE_PROTOCOL}://${product}/${date}/{z}/{y}/{x}`;
const gibsTile = (product: Product, layer: string, date: string, z: string, y: string, x: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level${product.level}/${z}/${y}/${x}.${product.ext}`;

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

/**
 * 這一天要依序讀的圖磚：當天的各顆衛星，再來其他日子（真彩影像：前一天、後一天的 MODIS，幾顆都沒拍到的赤道附近；
 * 葉綠素：前 7 天，雲擋住的地方）
 */
export function dayCandidates(date: string, productId: SatelliteProduct = 'truecolor'): { layer: string; date: string }[] {
  const product = PRODUCTS[productId];
  const today = new Date().toISOString().slice(0, 10);
  const has = (l: { from: string; to?: string }, d: string) => d >= l.from && (!l.to || d <= l.to);
  const out: { layer: string; date: string }[] = [];
  for (const layer of product.layers) if (has(layer, date)) out.push({ layer: layer.id, date });
  const others = productId === 'truecolor' ? DAY_LAYERS.slice(2) : product.layers;
  for (const d of product.extraDays.map((n) => shiftDay(date, n))) {
    if (d > today) continue;
    for (const layer of others) if (has(layer, d)) out.push({ layer: layer.id, date: d });
  }
  return out;
}

/** 透明的像素（PNG 的產品沒有資料的地方） */
const isClear = (px: Uint8ClampedArray, i: number) => px[i + 3] < 10;

/** 透明的比例 */
function clearShare(px: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (isClear(px, i)) n++;
  return n / (px.length / 4);
}

/** 把 next 補進 base 透明的像素，就地改 base，回傳補完後透明的比例 */
export function fillClear(base: Uint8ClampedArray, next: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < base.length; i += 4) {
    if (isClear(base, i) && !isClear(next, i)) {
      base[i] = next[i];
      base[i + 1] = next[i + 1];
      base[i + 2] = next[i + 2];
      base[i + 3] = next[i + 3];
    }
    if (isClear(base, i)) n++;
  }
  return n / (base.length / 4);
}

/** gibsday://產品/日期/z/y/x：幾顆衛星（與其他日子）的同一張圖磚疊起來，補掉黑縫或透明的空白；同時先抓下一張，等的時間短一點 */
export async function loadDayTile(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<AddProtocolResponseData>> {
  const [productId, date, z, y, x] = params.url.slice(SATELLITE_PROTOCOL.length + 3).split('/') as [SatelliteProduct, string, string, string, string];
  const product = PRODUCTS[productId] ?? PRODUCTS.truecolor;
  const list = dayCandidates(date, productId);
  const transparent = product.gap === 'transparent';
  const read = (k: number) => {
    if (k >= list.length) return Promise.resolve(null);
    const p = readTile(gibsTile(product, list[k].layer, list[k].date, z, y, x), abort.signal).catch((e: unknown) => {
      if ((e as { name?: string }).name === 'AbortError') throw e;
      return null;
    });
    // 先抓的下一張可能沒用到（補完了先停、或圖磚被取消）：標成已處理，取消時不會變成沒接住的錯誤
    p.catch(() => undefined);
    return p;
  };
  let base: Uint8ClampedArray | null = null;
  let pending = read(0);
  let prev = 1;
  for (let k = 0; k < list.length; k++) {
    const ahead = read(k + 1);
    const px = await pending;
    pending = ahead;
    if (!px) continue;
    if (transparent) {
      const share = base ? fillClear(base, px) : clearShare((base = px));
      // 陸地（葉綠素）、極夜永遠是空白：補到這一張幾乎沒補到新的像素就停
      if (share < DONE_SHARE || (k > 0 && prev - share < DONE_SHARE)) break;
      prev = share;
      continue;
    }
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

/** 依日期加上、換掉或藏起影像；before 是要插在哪個圖層前面（資料圖層的第一層）。換產品時 source 重建（最大縮放不同） */
export function syncSatelliteDay(map: MaplibreMap, date: string | null, before?: string, productId: SatelliteProduct = 'truecolor'): void {
  let source = map.getSource(SATELLITE_DAY) as RasterTileSource | undefined;
  if (!date) {
    if (map.getLayer(SATELLITE_DAY)) map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'none');
    return;
  }
  const product = PRODUCTS[productId];
  const tiles = tilesFor(productId, date);
  if (source && source.maxzoom !== product.level) {
    if (map.getLayer(SATELLITE_DAY)) map.removeLayer(SATELLITE_DAY);
    map.removeSource(SATELLITE_DAY);
    source = undefined;
  }
  if (!source) {
    map.addSource(SATELLITE_DAY, { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom: product.level, attribution: GIBS_ATTRIBUTION });
    map.addLayer(
      { id: SATELLITE_DAY, type: 'raster', source: SATELLITE_DAY, paint: { 'raster-opacity': product.opacity, 'raster-fade-duration': 200 } },
      before && map.getLayer(before) ? before : undefined,
    );
    return;
  }
  if (source.tiles?.[0] !== tiles) source.setTiles([tiles]);
  map.setPaintProperty(SATELLITE_DAY, 'raster-opacity', product.opacity);
  map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'visible');
}
