/**
 * 地形圖層（海拔主題）：AWS Terrain Tiles 的高程圖磚（terrarium 編碼的 PNG，公開、可跨網域讀取），
 * 在 MapLibre 裡當 raster-dem source，畫成分層設色（color-relief）與陰影（hillshade），3D 時當立體地形。
 *
 * 這個檔不 import MapLibre（只用型別），分層設色的顏色也給側欄的高度分布長條圖用。
 */
import type { ExpressionSpecification, RasterDEMSourceSpecification } from 'maplibre-gl';
import type { Text } from '../i18n/lang';

const TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
/** 圖磚的資料來源要標示（https://github.com/tilezen/joerd/blob/master/docs/attribution.md）；匯出圖片的頁尾由主題的資料來源列出 */
const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Terrain Tiles</a>' +
  ' (Mapzen, AWS Open Data: SRTM, GMTED2010, ETOPO1, EU-DEM, ArcticDEM, NED, …)';

export function demSource(): RasterDEMSourceSpecification {
  return { type: 'raster-dem', tiles: [TILES], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: TERRAIN_ATTRIBUTION };
}

/**
 * 分層設色：低地綠、丘陵黃、山地褐、高山灰白（地形圖慣用的配色，比單一色相好認出平原與山地）。
 * 圖磚含海底地形，海面由底圖的水域圖層蓋住（分層設色插在水域圖層下面），所以負值只會出現在
 * 死海、裏海窪地這類低於海平面的陸地。
 */
const RELIEF_STOPS: [number, string][] = [
  [-500, '#4f8a5e'],
  [0, '#86b77b'],
  [200, '#b9d392'],
  [500, '#e5e2a6'],
  [1000, '#e3c486'],
  [1500, '#d3a36c'],
  [2000, '#bd885a'],
  [3000, '#9f7056'],
  [4000, '#a8988f'],
  [5000, '#dcd6d0'],
  [6000, '#ffffff'],
];

export const RELIEF_COLOR: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['elevation'],
  ...RELIEF_STOPS.flat(),
] as ExpressionSpecification;

/** 某個海拔的分層設色（跟地圖上一樣在相鄰兩個色標之間線性內插） */
export function reliefColor(elevation: number): string {
  const stops = RELIEF_STOPS;
  if (elevation <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [e1, c1] = stops[i];
    if (elevation <= e1) {
      const [e0, c0] = stops[i - 1];
      return mix(c0, c1, (elevation - e0) / (e1 - e0));
    }
  }
  return stops[stops.length - 1][1];
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** 分層設色圖例：漸層色條，刻度等距排列（海拔的間距不等，等距才排得下） */
export interface ReliefLegendModel {
  /** 漸層的色標（0–1 的位置） */
  stops: { at: number; color: string }[];
  ticks: { at: number; label: string }[];
  width: number;
}

const LEGEND_TICKS = [0, 200, 500, 1000, 2000, 3000, 4000, 5000];

export function reliefLegendModel(formatTick: (v: number) => string): ReliefLegendModel {
  const n = LEGEND_TICKS.length - 1;
  const ticks = LEGEND_TICKS.map((v, i) => ({ at: i / n, label: formatTick(v) }));
  // 每個刻度區間再細分幾段，漸層才會跟地圖上的內插一致（1,000–2,000 之間還有 1,500 的色標）
  const stops: { at: number; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const v = LEGEND_TICKS[i] + ((LEGEND_TICKS[i + 1] - LEGEND_TICKS[i]) * k) / 4;
      stops.push({ at: (i + k / 4) / n, color: reliefColor(v) });
    }
  }
  stops.push({ at: 1, color: reliefColor(LEGEND_TICKS[n]) });
  return { stops, ticks, width: 280 };
}

/** 地形圖圖例的標題（指標名稱是「地形」，圖例說明的是顏色代表的海拔） */
export const RELIEF_TITLE: Text = { zh: '海拔', en: 'Elevation' };

export const RELIEF_NOTE: Text = {
  zh: '地形陰影光源在西北方；海面不上色',
  en: 'Hillshade lit from the north-west; seas are not tinted',
};

/**
 * 3D 地形的垂直誇張倍率：全球視角時山脈只有地球半徑的千分之一，要放大很多倍才看得出起伏；
 * 放大到城市時接近實際比例。每一級縮放一個固定值，縮放結束時才換，不必每一格都重建地形。
 */
export function terrainExaggeration(zoom: number): number {
  const z = Math.max(0, Math.round(zoom));
  return Math.max(1.5, Math.min(30, 2 ** (5.5 - z * 0.55)));
}
