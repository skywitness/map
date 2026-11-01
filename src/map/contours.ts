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

let tilesUrl: Promise<string> | null = null;

/** 第一次要畫等高線時才載入外掛、註冊協定；之後換底圖重新加圖層時共用同一個網址 */
function contourTiles(): Promise<string> {
  return (tilesUrl ??= import('maplibre-contour').then(({ default: mlcontour }) => {
    const dem = new mlcontour.DemSource({ url: DEM_TILES, encoding: 'terrarium', maxzoom: 12, worker: true, cacheSize: 100 });
    dem.setupMaplibre({ addProtocol });
    return dem.contourProtocolUrl({ thresholds: THRESHOLDS, contourLayer: 'contours', elevationKey: 'ele', levelKey: 'level', overzoom: 1 });
  }));
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
