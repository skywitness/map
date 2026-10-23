import { tr } from '../i18n/lang';
import { fixed, formatPercent } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

const M = { zh: '公尺', en: 'm' };
const PERCENT = '%';
/** 海拔用真正的減號（−442 公尺），不用連字號 */
const signed = (v: number, digits = 0) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`;
const metres = (v: number) => `${signed(v, Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0)} ${tr(M)}`;
const share = (v: number) => formatPercent(v, v > 0 && v < 1 ? 2 : 1);

function above(threshold: number): IndicatorDef {
  const label = fixed(threshold, 0);
  return {
    id: `above-${threshold}`,
    label: { zh: `海拔 ${label} 公尺以上的土地`, en: `Land above ${label} m` },
    description: {
      zh: `海拔 ${label} 公尺以上的土地占全國陸地面積的比例（含湖面，依緯度換算成實際面積）。`,
      en: `Share of the country's land area (lakes included, weighted by true cell area) that lies above ${label} m.`,
    },
    unit: PERCENT,
    file: `above/${threshold}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
    format: share,
    formatTick: (v) => fixed(v, 0),
  };
}

export const elevation: TopicDefinition = {
  id: 'elevation',
  title: { zh: '各國海拔與地形', en: 'Elevation and terrain by country' },
  shortTitle: { zh: '海拔', en: 'Elevation' },
  defaultIndicator: 'terrain',
  defaultYear: 2010,
  timeless: true,
  terrain: true,
  sources: [
    {
      name: { zh: 'USGS GMTED2010（30 角秒數值高程模型）', en: 'USGS GMTED2010 (30 arc-second elevation model)' },
      url: 'https://www.usgs.gov/coastal-changes-and-impacts/gmted2010',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Wikidata（各國最高點、最低點的名稱與標高）', en: 'Wikidata (names and heights of highest and lowest points)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: '內政部 100 公尺數值高程模型（台灣交叉比對）', en: 'Ministry of the Interior 100 m DEM (Taiwan cross-check)' },
      url: 'https://data.gov.tw/dataset/7507',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'Terrain Tiles（地圖上的地形，Mapzen、AWS Open Data）', en: 'Terrain Tiles (map relief; Mapzen, AWS Open Data)' },
      url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
      license: { zh: '依各資料來源標示', en: 'attribution per data source' },
    },
  ],
  note: {
    zh: '統計用 GMTED2010 的 1 公里網格（主要來自 2000 年的 SRTM 雷達測高，量的是地表，含樹冠與建築），每格依緯度換算成實際面積；國界是地圖用的 Natural Earth 1:50m 簡化國界，法國海外省等依聯合國的劃分分開計算。網格會把山頂平均掉，所以最高點優先用 Wikidata 的標高（DEM 對得上才採用）。沿海低地是海拔低於 5 公尺、而且跟海相連的陸地，裏海窪地這類內陸窪地不算。',
    en: 'Statistics use the 1 km GMTED2010 grid (mostly from the 2000 SRTM radar survey, which measures the surface including tree canopy and buildings), with each cell weighted by its true area; borders are the simplified Natural Earth 1:50m borders used on the map, with French overseas departments and similar areas split out as in UN statistics. Grids smooth out summits, so highest points use Wikidata heights where the DEM agrees. Low-lying coastal land is land below 5 m that is connected to the sea; inland depressions such as the Caspian Depression are excluded.',
  },
  panelExtra: () => import('./panels/ElevationPanel'),
  indicators: [
    {
      id: 'terrain',
      label: { zh: '地形', en: 'Terrain' },
      description: {
        zh: '依海拔分層設色，加上地形陰影，放大後越來越細；滑鼠移到國家上可看平均海拔。按右上角的「3D」看立體地形。',
        en: 'Elevation tints with hillshading that sharpen as you zoom in; hover over a country to see its mean elevation. Press “3D” at the top right for 3D terrain.',
      },
      unit: M,
      file: 'mean.json',
      layer: { kind: 'terrain' },
      format: (v) => tr({ zh: `平均海拔 ${metres(v)}`, en: `Mean elevation: ${metres(v)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mean',
      label: { zh: '平均海拔', en: 'Mean elevation' },
      description: {
        zh: '全國陸地的平均海拔（每格依緯度換算成實際面積再平均）。',
        en: 'Average elevation of all land in the country, weighting each grid cell by its true area.',
      },
      unit: M,
      file: 'mean.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 500, 1000, 1500, 2000] } },
      format: metres,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'highest',
      label: { zh: '最高點', en: 'Highest point' },
      description: {
        zh: '全國最高的山頂。名稱與標高來自 Wikidata（DEM 對得上才採用），沒有的用 DEM 網格的最高格；側欄有名稱與位置。',
        en: 'The highest summit in the country. Names and heights come from Wikidata where the DEM agrees, otherwise the highest DEM cell is used; the side panel shows the name and location.',
      },
      unit: M,
      file: 'highest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2000, 3000, 4000, 5000] } },
      format: metres,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'lowest',
      label: { zh: '最低點', en: 'Lowest point' },
      description: {
        zh: '全國最低的地方：靠海的國家通常是海平面（0 公尺），死海、蓋塔拉窪地這類窪地低於海平面，內陸國是邊境的河谷或湖面。',
        en: 'The lowest place in the country: sea level (0 m) for most coastal countries, below sea level in depressions such as the Dead Sea or the Qattara Depression, and a border valley or lake for landlocked countries.',
      },
      unit: M,
      file: 'lowest.json',
      // 以海平面為中點：低於海平面一種色相、高於海平面另一種，靠海的國家（0 公尺）是中性灰
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-100, -10, -1, 1, 100, 500] } },
      format: (v) => (v === 0 ? tr({ zh: '0 公尺（海平面）', en: '0 m (sea level)' }) : metres(v)),
      formatTick: (v) => signed(v),
    },
    above(500),
    above(1000),
    above(2000),
    {
      id: 'lowland',
      label: { zh: '沿海低地', en: 'Low-lying coastal land' },
      description: {
        zh: '海拔低於 5 公尺、而且跟海相連的土地占全國陸地的比例，是海平面上升與暴潮最先影響的地方（DEM 量的是地表，樹林、城市會被高估，實際可能更多）。',
        en: 'Share of land below 5 m that is connected to the sea, the area most exposed to sea-level rise and storm surges (the DEM measures the surface, so forests and cities read too high and the true share may be larger).',
      },
      unit: PERCENT,
      file: 'lowland.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: share,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
    },
    {
      id: 'slope',
      label: { zh: '平均坡度', en: 'Mean slope' },
      description: {
        zh: '全國陸地的平均坡度，用 1 公里網格計算（比實際的坡度平緩，但各國可以互相比較），數字越大地形越崎嶇。',
        en: 'Average slope of the land, computed on the 1 km grid (gentler than real slopes, but comparable between countries); higher means more rugged terrain.',
      },
      unit: { zh: '度', en: 'degrees' },
      file: 'slope.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 9, 12] } },
      format: (v) => `${fixed(v, 1)}°`,
      formatTick: (v) => `${fixed(v, 0)}°`,
    },
  ],
};

