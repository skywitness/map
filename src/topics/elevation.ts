import { getLang, tr } from '../i18n/lang';
import { fixed, formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';

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

/** 山系的名稱（pipeline/topics/mountains.py：n 英文、z 中文）：中文介面用中文，英文介面用英文 */
function rangeName(p: PointRecord): string {
  return getLang() === 'zh' && typeof p.z === 'string' && p.z ? p.z : String(p.n ?? '');
}

function rangeTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const countries = typeof p.c === 'string' && p.c ? p.c.split(',') : [];
  const shown = countries.slice(0, 4).map((c) => ctx.countryName(c));
  const more = countries.length - shown.length;
  const where = more > 0 ? tr({ zh: `${shown.join('、')}等 ${countries.length} 國`, en: `${shown.join(', ')} and ${more} more` }) : shown.join(tr({ zh: '、', en: ', ' }));
  const name = rangeName(p);
  return {
    title: name,
    detail: typeof p.s === 'number' ? tr({ zh: `山區面積 ${fixed(p.s, 0)} 平方公里`, en: `Mountain area ${fixed(p.s, 0)} km²` }) : undefined,
    extra: where ? [where] : undefined,
    properNoun: getLang() === 'zh' && name !== p.n ? String(p.n ?? '') : undefined,
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
      name: { zh: 'GMBA 山脈名錄 v2（291 個主要山系）', en: 'GMBA Mountain Inventory v2 (291 major mountain systems)' },
      url: 'https://www.earthenv.org/mountains',
      license: 'CC BY 4.0',
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
  overlays: [
    {
      kind: 'lines',
      id: 'mountains',
      file: 'mountains.json',
      label: { zh: '山脈（GMBA）', en: 'Mountain ranges (GMBA)' },
      width: 0.6,
      color: MAP_TOKENS.ink,
      opacity: 0.45,
      fill: { field: 'f', value: 1, opacity: 0.12, darkOpacity: 0.16, holeField: 'k', hover: true },
      groupField: 'r',
      tooltip: rangeTooltip,
      indicators: ['terrain', 'mountain'],
    },
    {
      kind: 'points',
      id: 'mountain-names',
      file: 'mountain-labels.json',
      label: { zh: '山脈的名稱', en: 'Mountain range names' },
      radius: 0,
      color: MAP_TOKENS.ink,
      sortField: 's',
      pointLabel: rangeName,
      tooltip: rangeTooltip,
      indicators: ['terrain', 'mountain'],
    },
  ],
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
      id: 'mountain',
      label: { zh: '國土在山區的比例', en: 'Land in mountain areas' },
      description: {
        zh: '國土落在 GMBA 山區裡的比例。GMBA 依地形起伏（附近的高低差）劃出山區，不只看海拔：高原上平坦的地方不算，低海拔的陡峭丘陵也算。不丹 99%、尼泊爾 81%、瑞士 68%、台灣 64%、日本 54%，荷蘭是 0。灰色的範圍是 291 個主要山系，滑過看名稱；以島嶼、群島命名的只包括島上的山區。',
        en: 'Share of the country’s land inside GMBA mountain areas. GMBA draws mountains by ruggedness (local differences in elevation), not altitude alone: flat plateaus are excluded and steep low hills are included. Bhutan 99%, Nepal 81%, Switzerland 68%, Taiwan 64%, Japan 54%; the Netherlands 0. The grey areas are 291 major mountain systems; hover for names. Systems named after islands or archipelagos cover only their mountainous parts.',
      },
      unit: PERCENT,
      file: 'mountain.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
      format: share,
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

