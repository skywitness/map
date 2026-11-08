import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 獵人高台與釣魚點（新主題，2026-11-07，製作手冊第二十四批 437；pipeline/topics/hunting_fishing.py）。
 * OpenStreetMap 的 amenity=hunting_stand（約 31 萬座，在 QLever 端聚合成 0.1° 的網格）與 leisure=fishing（約 2 萬處，全部畫點）。
 * 德語區社群特別愛畫獵人高台，數量有一部分是測繪習慣；國家只替 OSM 覆蓋良好的上色。
 */

const C = MAP_TOKENS.categorical;
const S = MAP_TOKENS.sequential;

const GRID: PointsOverlayDef = {
  kind: 'points',
  id: 'hunting-grid',
  file: 'hunting-grid.json',
  label: { zh: '獵人高台（約 10 公里的網格）', en: 'Hunting stands (about 10 km grid)' },
  indicators: ['hunting-density', 'hunting-count'],
  radius: { field: 'n', stops: [[1, 1.6], [10, 2.2], [100, 3], [400, 3.6]] },
  color: {
    field: 'n',
    title: { zh: '一格幾座', en: 'Stands per cell' },
    thresholds: [5, 25, 100, 250],
    classes: [
      { color: S[1], label: '1–4' },
      { color: S[2], label: '5–24' },
      { color: S[4], label: '25–99' },
      { color: S[5], label: '100–249' },
      { color: S[6], label: { zh: '250 座以上', en: '250+' } },
    ],
  },
  sortField: 'n',
  tooltip: (p) => ({
    title: tr({ zh: `${fixed(Number(p.n), 0)} 座獵人高台`, en: `${fixed(Number(p.n), 0)} hunting ${Number(p.n) === 1 ? 'stand' : 'stands'}` }),
    detail: tr({ zh: '經緯度 0.1° 的格子（約 10 公里）', en: 'A 0.1° grid cell (about 10 km)' }),
  }),
};

const fishName = (p: PointRecord) => String((getLang() === 'zh' ? p.nz || p.n : p.ne || p.n) ?? '') || tr({ zh: '釣魚點', en: 'Fishing spot' });
const fishOriginal = (p: PointRecord, title: string) => (typeof p.n === 'string' && p.n !== title ? p.n : undefined);

const FISHING: PointsOverlayDef = {
  kind: 'points',
  id: 'fishing',
  file: 'fishing.json',
  label: { zh: '釣魚點', en: 'Fishing spots' },
  indicators: ['fishing-density', 'fishing-count'],
  radius: 2.6,
  color: C[1],
  tooltip: (p, { countryName }) => {
    const title = fishName(p);
    return {
      title,
      detail: [tr({ zh: '釣魚點（OpenStreetMap）', en: 'Fishing spot (OpenStreetMap)' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      properNoun: fishOriginal(p, title),
    };
  },
};

const FISH_LIST: ListPanelDef = {
  label: { zh: '有名稱的釣魚點', en: 'Named fishing spots' },
  indicators: ['fishing-density', 'fishing-count'],
  file: 'fishing.json',
  countryField: 'iso3',
  empty: { zh: '選一個國家看它有名稱的釣魚點', en: 'Select a country to list its named fishing spots' },
  rows: (points, { countryName, country }) => {
    if (!country) return [];
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return points
      .filter((p) => typeof p.n === 'string' && p.n)
      .map((p) => ({ p, title: fishName(p) }))
      .sort((a, b) => collator.compare(a.title, b.title))
      .map(({ p, title }, i): ListRow => ({
        key: `f${i}`,
        title,
        properNoun: fishOriginal(p, title),
        lines: typeof p.iso3 === 'string' ? [countryName(p.iso3)] : [],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      }));
  },
};

const common = {
  missing: { zh: '沒有資料，或 OpenStreetMap 在這國的覆蓋不夠完整', en: 'No data, or OpenStreetMap coverage is not complete enough' },
  panelChart: false,
} satisfies Partial<IndicatorDef>;

export const huntingFishing: TopicDefinition = {
  id: 'hunting-fishing',
  title: { zh: '獵人高台與釣魚點', en: 'Hunting stands and fishing spots' },
  shortTitle: { zh: '狩獵與釣魚', en: 'Hunting and fishing' },
  defaultIndicator: 'hunting-density',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 的 amenity=hunting_stand 與 leisure=fishing（2026 年 11 月，經 QLever）', en: 'OpenStreetMap amenity=hunting_stand and leisure=fishing (November 2026, via QLever)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap contributors；網格與點的資料檔同樣用 ODbL 分享）', en: 'ODbL 1.0 (© OpenStreetMap contributors; the grid and point files are shared under the ODbL)' },
    },
    {
      name: { zh: '陸地面積：FAOSTAT 土地利用', en: 'Land area: FAOSTAT land use' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
  ],
  note: withTerritories({
    zh: '資料是 OpenStreetMap 志工畫的獵人高台（amenity=hunting_stand：獵人在林子邊架的木造瞭望台，中歐特別多）與釣魚點（leisure=fishing），2026 年 11 月的快照。數量同時反映狩獵、釣魚的習慣與各地社群畫得多仔細：德語區的社群特別愛畫獵人高台，德國一國占全球的 57.8%，是英國的 17 倍，方向跟現實一致，但落差有一部分是測繪習慣。國家只替 OSM 覆蓋良好的國家上色（其他國家寫原因），陸地面積用 FAOSTAT。獵人高台約 31 萬座，地圖上依經緯度 0.1°（約 10 公里）的格子計數；畫成面的約 1% 不在格子裡，國家的座數照樣算。台灣的 25 筆多半是獵寮、工寮（山上的寮屋），也有一座瞭望臺，不是中歐那種高台；台灣的 65 個釣魚點多是釣魚池、釣蝦場與海釣場。各國有多少人有狩獵執照沒有可用的資料（歐盟獵人協會 FACE 的網站沒有授權聲明，也沒有分國的數字），沒有做。',
    en: 'The data are hunting stands (amenity=hunting_stand: the wooden high seats hunters build at forest edges, especially common in central Europe) and fishing spots (leisure=fishing) mapped by OpenStreetMap volunteers, as of November 2026. Counts reflect both hunting and angling habits and how thoroughly each community maps: German-speaking mappers are especially keen on hunting stands, so Germany alone has 57.8% of the world’s, 17 times as many as the UK. The direction matches reality, but part of the gap is mapping habit. Countries are shaded only where OSM coverage is good (others give the reason), using FAOSTAT land area. The roughly 310,000 hunting stands are counted on a 0.1° grid (about 10 km); the 1% mapped as areas are left out of the grid but still counted for countries. Taiwan’s 25 are mostly hunters’ and work huts in the mountains plus one lookout, not central-European high seats, and its 65 fishing spots are mostly fishing ponds, shrimp-fishing halls and sea-fishing platforms. How many people hold hunting licences in each country is not shown: no usable data exist (the European hunters’ federation FACE publishes no licence terms and no country figures).',
  }),
  overlays: [GRID, FISHING],
  listPanel: FISH_LIST,
  indicators: [
    {
      ...common,
      id: 'hunting-density',
      label: { zh: '獵人高台的密度', en: 'Hunting stand density' },
      description: {
        zh: 'OpenStreetMap 上每千平方公里有幾座獵人高台：德國 511 座最密，奧地利 329、斯洛伐克 236、荷蘭 153、匈牙利 149、捷克 115、波蘭 97、斯洛維尼亞 84，英國 44、法國 7.4，美國只有 0.15；台灣 0.71。全世界 309,199 座、148 個國家或地區，德語區加中東歐占了九成以上，英國以外的西歐、南歐與北美幾乎是空白。地圖上的點是約 10 公里的格子裡有幾座。',
        en: 'Hunting stands per 1,000 km² on OpenStreetMap: Germany is densest with 511, then Austria 329, Slovakia 236, the Netherlands 153, Hungary 149, Czechia 115, Poland 97 and Slovenia 84; the UK has 44, France 7.4 and the US just 0.15. Taiwan has 0.71. Worldwide there are 309,199 in 148 countries and territories, over nine in ten in the German-speaking countries and central and eastern Europe, while western and southern Europe outside the UK and North America are nearly empty. Dots show how many fall in each roughly 10 km grid cell.',
      },
      unit: { zh: '座／千平方公里', en: 'per 1,000 km²' },
      file: 'hunting-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 20, 50, 100, 250] } },
      format: (v) => tr({ zh: `每千平方公里 ${fixed(v, v < 1 ? 2 : v < 10 ? 1 : 0)} 座`, en: `${fixed(v, v < 1 ? 2 : v < 10 ? 1 : 0)} per 1,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      ...common,
      id: 'hunting-count',
      label: { zh: '獵人高台的座數', en: 'Hunting stands' },
      description: {
        zh: 'OpenStreetMap 上各國的獵人高台座數（比例圓）：德國 178,625 座，占全球的 57.8%；波蘭 29,795、奧地利 27,127、匈牙利 13,585、斯洛伐克 11,359、英國 10,732、捷克 8,838、義大利 5,232、荷蘭 5,164、法國 4,005；美國 1,373；台灣 25（多半是獵寮與工寮）。',
        en: 'Hunting stands on OpenStreetMap by country (bubbles): Germany has 178,625, 57.8% of the world total, followed by Poland 29,795, Austria 27,127, Hungary 13,585, Slovakia 11,359, the UK 10,732, Czechia 8,838, Italy 5,232, the Netherlands 5,164 and France 4,005; the US has 1,373 and Taiwan 25 (mostly huts).',
      },
      unit: { zh: '座', en: '' },
      file: 'hunting-count.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
    {
      ...common,
      id: 'fishing-density',
      label: { zh: '釣魚點的密度', en: 'Fishing spot density' },
      description: {
        zh: 'OpenStreetMap 上每萬平方公里有幾個釣魚點：比利時 119 最密，荷蘭 72、英國 59、丹麥 58、匈牙利 40、法國 30、德國 30（島國馬爾地夫、新加坡、馬爾他也高）；台灣 18。全世界 19,646 處、143 個國家或地區。點是每一個釣魚點；選了國家，左邊列出它有名稱的釣魚點。',
        en: 'Fishing spots per 10,000 km² on OpenStreetMap: Belgium is densest with 119, then the Netherlands 72, the UK 59, Denmark 58, Hungary 40, France 30 and Germany 30 (small island states such as the Maldives, Singapore and Malta are also high); Taiwan has 18. Worldwide there are 19,646 in 143 countries and territories. Dots mark each spot; select a country to list its named spots on the left.',
      },
      unit: { zh: '處／萬平方公里', en: 'per 10,000 km²' },
      file: 'fishing-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 10, 20, 40, 80] } },
      format: (v) => tr({ zh: `每萬平方公里 ${fixed(v, v < 1 ? 2 : v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 1 ? 2 : v < 10 ? 1 : 0)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      ...common,
      id: 'fishing-count',
      label: { zh: '釣魚點的個數', en: 'Fishing spots' },
      description: {
        zh: 'OpenStreetMap 上各國的釣魚點個數（比例圓）：美國 2,426、俄羅斯 1,984、法國 1,628、英國 1,436、加拿大 1,240、德國 1,039、烏克蘭 825、印度 802、波蘭 657、巴基斯坦 654；台灣 65（多是釣魚池、釣蝦場與海釣場）。',
        en: 'Fishing spots on OpenStreetMap by country (bubbles): the US has 2,426, Russia 1,984, France 1,628, the UK 1,436, Canada 1,240, Germany 1,039, Ukraine 825, India 802, Poland 657 and Pakistan 654; Taiwan has 65 (mostly fishing ponds, shrimp-fishing halls and sea-fishing platforms).',
      },
      unit: { zh: '處', en: '' },
      file: 'fishing-count.json',
      layer: { kind: 'bubble', legendValues: [100, 500, 2000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
};
