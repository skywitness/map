/**
 * 等高線（海拔主題的地形圖，2026-11-01，MapLibre 範例「Add Contour Lines」）：maplibre-contour（BSD-3）在自己的 worker 裡
 * 讀跟地形圖同一份 AWS Terrain Tiles（terrarium 編碼），算出等高線，當成向量圖磚給 MapLibre（自訂協定）。
 * - 放大到 CONTOUR_MINZOOM 以上才畫；外掛第一次要畫時才下載（gzip 後約 10 KB）。
 * - 間距依縮放（THRESHOLDS：[一般, 計曲線]）：7 級 500／2,000 m，越放大越密，13 級起 20／100 m；計曲線較粗、沿線寫高度。
 * - 海平面以下不畫（圖磚含海底地形，海上的線由水域蓋住，標籤也不寫）。
 * - 插在底圖的水域下面（跟分層設色、陰影同一個位置），湖海蓋住；標籤在底圖地名的下面。
 */
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification, LayerSpecification, Map as MaplibreMap } from 'maplibre-gl';
import { addProtocol } from 'maplibre-gl';
import { DEM_TILES } from './terrain';
import { ISOBATH_COLOR } from './isobathStyle';

export const CONTOUR_SOURCE = 'contours';
export const CONTOUR_LINES = 'contour-lines';
export const CONTOUR_LABELS = 'contour-labels';
export const CONTOUR_MINZOOM = 7;

/** 縮放級數 → [一般等高線的間距, 計曲線的間距]（公尺） */
const THRESHOLDS: Record<number, [number, number]> = {
  7: [500, 2000],
  8: [250, 1000],
  9: [200, 1000],
  10: [100, 500],
  12: [50, 250],
  13: [20, 100],
};

type Dem = InstanceType<(typeof import('maplibre-contour'))['default']['DemSource']>;
let demPromise: Promise<Dem> | null = null;
let tilesUrl: Promise<string> | null = null;
let isobathUrl: Promise<string> | null = null;

/** 第一次要畫等高線、等深線時才載入外掛、註冊協定（兩種共用同一個 DemSource） */
function demSourceOnce(): Promise<Dem> {
  return (demPromise ??= import('maplibre-contour').then(({ default: mlcontour }) => {
    const dem = new mlcontour.DemSource({ url: DEM_TILES, encoding: 'terrarium', maxzoom: 12, worker: true, cacheSize: 100 });
    dem.setupMaplibre({ addProtocol });
    return dem;
  }));
}

/** 等高線圖磚的網址；之後換底圖重新加圖層時共用同一個網址 */
function contourTiles(): Promise<string> {
  return (tilesUrl ??= demSourceOnce().then((dem) =>
    dem.contourProtocolUrl({ thresholds: THRESHOLDS, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level', overzoom: 1 }),
  ));
}

/** 等深線圖磚的網址：每 200 m 一條（200、1,000、4,000 m 都是 200 的倍數），圖層再只留要畫的那幾條 */
function isobathTiles(): Promise<string> {
  return (isobathUrl ??= demSourceOnce().then((dem) =>
    dem.contourProtocolUrl({ thresholds: { 0: [ISOBATH_STEP] }, contourLayer: 'isobaths', elevationKey: 'ele', overzoom: 1 }),
  ));
}

function layers(font: DataDrivenPropertyValueSpecification<string[]>): LayerSpecification[] {
  const above: ExpressionSpecification = ['>', ['get', 'ele'], 0];
  return [
    {
      id: CONTOUR_LINES,
      type: 'line',
      source: CONTOUR_SOURCE,
      'source-layer': 'contours',
      minzoom: CONTOUR_MINZOOM,
      filter: ['all', above],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['>', ['get', 'level'], 0], 'rgba(92, 70, 40, 0.55)', 'rgba(92, 70, 40, 0.3)'],
        'line-width': ['case', ['>', ['get', 'level'], 0], 1.1, 0.6],
      },
    },
    {
      id: CONTOUR_LABELS,
      type: 'symbol',
      source: CONTOUR_SOURCE,
      'source-layer': 'contours',
      minzoom: CONTOUR_MINZOOM + 1,
      filter: ['all', above, ['>', ['get', 'level'], 0]],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
        'text-font': font,
        'text-size': 11,
        'symbol-spacing': 320,
        'text-max-angle': 25,
        'text-padding': 4,
      },
      paint: { 'text-color': '#5c4628', 'text-halo-color': 'rgba(255, 255, 255, 0.85)', 'text-halo-width': 1.4 },
    },
  ];
}

/**
 * 依 on 加上或藏起等高線。before 是線要插在哪個圖層前面（底圖的水域），labelsBefore 是標籤的（底圖第一個地名）。
 * 換底圖後樣式裡沒有這些圖層，WorldMap 依 revision 重新呼叫
 */
export function syncContours(
  map: MaplibreMap,
  on: boolean,
  opts: { before?: string; labelsBefore?: string; font: DataDrivenPropertyValueSpecification<string[]> },
): void {
  const visibility = on ? 'visible' : 'none';
  if (map.getLayer(CONTOUR_LINES)) {
    for (const id of [CONTOUR_LINES, CONTOUR_LABELS]) map.setLayoutProperty(id, 'visibility', visibility);
    return;
  }
  if (!on) return;
  void contourTiles().then((url) => {
    if (map.getLayer(CONTOUR_LINES) || !map.style) return;
    if (!map.getSource(CONTOUR_SOURCE)) {
      map.addSource(CONTOUR_SOURCE, { type: 'vector', tiles: [url], minzoom: CONTOUR_MINZOOM, maxzoom: 15 });
    }
    const [lines, labels] = layers(opts.font);
    map.addLayer(lines, opts.before && map.getLayer(opts.before) ? opts.before : undefined);
    map.addLayer(labels, opts.labelsBefore && map.getLayer(opts.labelsBefore) ? opts.labelsBefore : undefined);
  });
}

// ── 等深線（2026-11-02，新13，海洋與漁業：TopicDefinition.isobaths）──────────────────────────
// 同一份 AWS Terrain Tiles（含海底地形）用 maplibre-contour 算出每 200 m 一條的線，圖層只留主題要的深度（200、1,000、4,000 m：
// 大陸棚的邊緣、大陸坡、深海平原）。世界全圖就畫（低縮放的圖磚粗，線是平滑的大概位置），放大後跟著變細緻。
// 插在國家的面下面：陸地上低於海平面的窪地（死海）被陸地蓋住；標籤沿線寫深度。

export const ISOBATH_SOURCE = 'isobaths';
export const ISOBATH_LINES = 'isobath-lines';
export const ISOBATH_LABELS = 'isobath-labels';
const ISOBATH_STEP = 200;

function isobathLayers(depths: number[], font: DataDrivenPropertyValueSpecification<string[]>, dark: boolean): LayerSpecification[] {
  const wanted: ExpressionSpecification = ['in', ['get', 'ele'], ['literal', depths.map((d) => -d)]];
  const color = dark ? '#8fb8e8' : ISOBATH_COLOR;
  return [
    {
      id: ISOBATH_LINES,
      type: 'line',
      source: ISOBATH_SOURCE,
      'source-layer': 'isobaths',
      filter: wanted,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': color,
        // 淺的（大陸棚的邊緣）實一點，深的淡一點
        'line-opacity': ['interpolate', ['linear'], ['-', 0, ['get', 'ele']], 200, 0.85, 4000, 0.5],
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 1.2],
      },
    },
    {
      id: ISOBATH_LABELS,
      type: 'symbol',
      source: ISOBATH_SOURCE,
      'source-layer': 'isobaths',
      minzoom: 3,
      filter: wanted,
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['number-format', ['-', 0, ['get', 'ele']], {}], ' m'],
        'text-font': font,
        'text-size': 10.5,
        'symbol-spacing': 400,
        'text-max-angle': 25,
        'text-padding': 4,
      },
      paint: {
        'text-color': color,
        'text-halo-color': dark ? 'rgba(11, 11, 11, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        'text-halo-width': 1.3,
      },
    },
  ];
}

/**
 * 依 depths 加上、藏起或拿掉等深線（null 是不畫）。before 是插在哪個圖層前面（國家的面）。
 * 換底圖（深淺色）後樣式裡沒有這些圖層，WorldMap 依 revision 重新呼叫
 */
export function syncIsobaths(
  map: MaplibreMap,
  depths: number[] | null,
  opts: { before?: string; font: DataDrivenPropertyValueSpecification<string[]>; dark: boolean },
): void {
  if (map.getLayer(ISOBATH_LINES)) {
    for (const id of [ISOBATH_LINES, ISOBATH_LABELS]) map.setLayoutProperty(id, 'visibility', depths ? 'visible' : 'none');
    if (depths) {
      const wanted: ExpressionSpecification = ['in', ['get', 'ele'], ['literal', depths.map((d) => -d)]];
      for (const id of [ISOBATH_LINES, ISOBATH_LABELS]) map.setFilter(id, wanted);
    }
    return;
  }
  if (!depths) return;
  void isobathTiles().then((url) => {
    if (map.getLayer(ISOBATH_LINES) || !map.style) return;
    if (!map.getSource(ISOBATH_SOURCE)) map.addSource(ISOBATH_SOURCE, { type: 'vector', tiles: [url], maxzoom: 10 });
    const before = opts.before && map.getLayer(opts.before) ? opts.before : undefined;
    for (const layer of isobathLayers(depths, opts.font, opts.dark)) map.addLayer(layer, before);
  });
}
