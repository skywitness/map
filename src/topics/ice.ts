import { getLang, tr } from '../i18n/lang';
import { dataUrl } from '../lib/data';
import { fixed } from '../lib/format';
import { classAt, loadClassGrid, type ClassGrid } from '../map/classGridData';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PlaceDef, PointRecord, TopicDefinition } from './types';

/**
 * 冰河、海冰與海平面（pipeline/topics/ice.py）：WGMS 的冰河年質量變化（各國冰河平均變薄多少、少了多少質量）、
 * NSIDC 北極 9 月與南極 2 月的海冰邊緣（1979 年起一年一條線）、NOAA STAR 衛星測高的海平面上升速度（0.5° 網格）；
 * 北極航道能通航幾天（pipeline/topics/arctic_routes.py，2026-10-30）：NOAA/NSIDC 海冰濃度 CDR 每天的網格沿兩條航道取樣，
 * 航道上每一格都低於 15% 的天數。兩條航道是 places（_NSR、_NWP），國家的指標檔用它們當鍵，側欄就是一般的歷年折線。
 */

const n1 = (v: number) => fixed(v, 1);

/** 冰河的國家：panel.json 的 glaciers 也是這幾國（有 RGI 冰河的國家與地區） */
const NO_GLACIER = { zh: '沒有冰河（RGI 冰河目錄裡沒有）', en: 'No glaciers (none in the Randolph Glacier Inventory)' };

/** 海冰邊緣的年代（ice-edges.json 的 types）：越近越深，1981–2010 年的中位數是虛線 */
const SEQ = MAP_TOKENS.sequential;
export const DECADES = [
  { value: 0, color: SEQ[1], label: { zh: '1979–1989 年', en: '1979–1989' } },
  { value: 1, color: SEQ[2], label: { zh: '1990 年代', en: '1990s' } },
  { value: 2, color: SEQ[3], label: { zh: '2000 年代', en: '2000s' } },
  { value: 3, color: SEQ[5], label: { zh: '2010 年代', en: '2010s' } },
  { value: 4, color: SEQ[6], label: { zh: '2020 年代', en: '2020s' } },
];
const MEDIAN = 5;

/** 海平面上升速度的分級（grid/sea-level.png 的代碼，pipeline 的 SEA_LEVEL_BINS）：下降是青綠，上升是橘色，越快越深 */
export const SEA_LEVEL_CLASSES = [
  { value: 1, color: MAP_TOKENS.diverging[5], short: '< 0', label: { zh: '下降', en: 'Falling' } },
  { value: 2, color: SEQ[0], short: '0–2', label: { zh: '每年上升 0–2 mm', en: 'Rising 0–2 mm a year' } },
  { value: 3, color: SEQ[1], short: '2–3', label: { zh: '每年上升 2–3 mm', en: 'Rising 2–3 mm a year' } },
  { value: 4, color: SEQ[2], short: '3–4', label: { zh: '每年上升 3–4 mm', en: 'Rising 3–4 mm a year' } },
  { value: 5, color: SEQ[3], short: '4–5', label: { zh: '每年上升 4–5 mm', en: 'Rising 4–5 mm a year' } },
  { value: 6, color: SEQ[4], short: '5–6', label: { zh: '每年上升 5–6 mm', en: 'Rising 5–6 mm a year' } },
  { value: 7, color: SEQ[6], short: '≥ 6', label: { zh: '每年上升 6 mm 以上', en: 'Rising 6 mm a year or more' } },
];

/**
 * 海平面上升推估（2026-11-02，製作手冊第十七批 275，pipeline/topics/sea_level_rise.py）：IPCC AR6，相對 1995–2014 年，
 * 2050、2100 年，三個情境（使用者決定）。國家用海岸外 200 公里內 1° 網格的平均，潮位站畫成點（一個情境一個檔，
 * 兩期用 epochs 換成那一年的中位數 v），左側欄依上升量排名
 */
export const SLR_SCENARIOS = [
  { id: 'ssp126', label: { zh: '低排放（SSP1-2.6）', en: 'Low emissions (SSP1-2.6)' } },
  { id: 'ssp245', label: { zh: '中排放（SSP2-4.5）', en: 'Intermediate emissions (SSP2-4.5)' } },
  { id: 'ssp585', label: { zh: '高排放（SSP5-8.5）', en: 'High emissions (SSP5-8.5)' } },
];
const SLR_YEARS = [2050, 2100];
const SLR_LIST_TOP = 100;
/** 地圖上潮位站的中文名稱（只有台灣的兩站） */
const GAUGE_ZH: Record<string, string> = { 'KEELUNG II': '基隆', 'KAOHSIUNG II': '高雄' }; // i18n-ignore：只在中文介面用（gaugeName）
const slrEpoch = (year: number) => SLR_YEARS.reduce((e, y) => (y <= year ? y : e), SLR_YEARS[0]);
const rise = (v: number) =>
  v >= 0
    ? tr({ zh: `上升 ${fixed(v, 0)} 公分`, en: `${fixed(v, 0)} cm higher` })
    : tr({ zh: `下降 ${fixed(-v, 0)} 公分`, en: `${fixed(-v, 0)} cm lower` });
const gaugeValue = (p: PointRecord, key: string, year: number) => {
  const v = p[`${key}${slrEpoch(year)}`];
  return typeof v === 'number' ? v : null;
};
const gaugeName = (p: PointRecord) => tr({ zh: GAUGE_ZH[String(p.name)] ?? String(p.name), en: String(p.name) });
const likely = (p: PointRecord, year: number) => {
  const l = gaugeValue(p, 'l', year);
  const h = gaugeValue(p, 'h', year);
  return l === null || h === null ? null : tr({ zh: `可能範圍 ${fixed(l, 0)}–${fixed(h, 0)} 公分`, en: `likely range ${fixed(l, 0)}–${fixed(h, 0)} cm` });
};
/** 潮位站的分級：下降是青綠，上升是橘色（國家的面量圖同一組門檻，再多一級「下降」） */
const SLR_CLASSES = [
  { color: MAP_TOKENS.diverging[5], label: { zh: '下降', en: 'Falling' } },
  { color: SEQ[0], label: { zh: '0–20 公分', en: '0–20 cm' } },
  { color: SEQ[1], label: { zh: '20–30 公分', en: '20–30 cm' } },
  { color: SEQ[2], label: { zh: '30–40 公分', en: '30–40 cm' } },
  { color: SEQ[3], label: { zh: '40–50 公分', en: '40–50 cm' } },
  { color: SEQ[4], label: { zh: '50–60 公分', en: '50–60 cm' } },
  { color: SEQ[5], label: { zh: '60–80 公分', en: '60–80 cm' } },
  { color: SEQ[6], label: { zh: '80 公分以上', en: '80 cm or more' } },
];

const SLR_LIST: ListPanelDef = {
  label: { zh: '潮位站的推估', en: 'Tide-gauge projections' },
  indicators: ['sea-level-rise'],
  file: 'slr-gauges/{item}.json',
  countryField: 'iso3',
  empty: { zh: '沒有潮位站的推估。', en: 'No tide-gauge projections.' },
  rows: (points, { countryName, year, country }) =>
    points
      .map((p) => ({ p, v: gaugeValue(p, 'm', year) }))
      .filter((r): r is { p: PointRecord; v: number } => r.v !== null)
      .sort((a, b) => b.v - a.v)
      .slice(0, country ? Infinity : SLR_LIST_TOP)
      .map(({ p, v }, i): ListRow => ({
        key: `${p.name}-${p.lon}-${p.lat}`,
        title: gaugeName(p),
        titleProper: !GAUGE_ZH[String(p.name)],
        lines: [
          [`${i + 1}. ${rise(v)}`, likely(p, year), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
        ],
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 8 },
      })),
};

export function hemisphereName(h: string | number | null): string {
  return h === 'S' ? tr({ zh: '南極', en: 'Antarctic' }) : tr({ zh: '北極', en: 'Arctic' });
}

export function iceMonth(h: string | number | null): string {
  return h === 'S' ? tr({ zh: '2 月', en: 'February' }) : tr({ zh: '9 月', en: 'September' });
}

/** 海冰範圍（百萬 km²） */
export function extentText(v: number): string {
  return tr({ zh: `${fixed(v, 2)} 百萬 km²`, en: `${fixed(v, 2)} million km²` });
}

// 游標下那一格的海平面速度：跟地圖同一張網格（loadClassGrid 同一個網址只讀一次）
let seaLevelGrid: ClassGrid | null = null;
let seaLevelLoading = false;
function seaLevelAt(lon: number, lat: number): number {
  if (!seaLevelGrid && !seaLevelLoading) {
    seaLevelLoading = true;
    loadClassGrid(dataUrl('topics/ice/grid/sea-level.png')).then(
      (g) => (seaLevelGrid = g),
      () => (seaLevelLoading = false),
    );
  }
  return seaLevelGrid ? classAt(seaLevelGrid, lon, lat) : 0;
}

function edgeTooltip(p: PointRecord) {
  const hemi = hemisphereName(p.h);
  const month = iceMonth(p.h);
  if (p.m) {
    return {
      title: tr({ zh: `${hemi} ${month}的中位數邊緣`, en: `${hemi} ${month} median edge` }),
      detail: tr({ zh: '1981–2010 年的中位數（比較的基準）', en: 'Median for 1981–2010 (the reference)' }),
    };
  }
  return {
    title: tr({ zh: `${p.y} 年 ${month}${hemi}的海冰邊緣`, en: `${hemi} sea-ice edge, ${month} ${p.y}` }),
    detail:
      typeof p.e === 'number'
        ? tr({ zh: `月平均海冰範圍 ${extentText(p.e)}`, en: `Monthly mean extent ${extentText(p.e)}` })
        : undefined,
  };
}

/** 北極航道（arctic-routes-lines.json 的 types 與 records.r；places 的 id 是指標檔的鍵） */
const FIRST_ROUTE_YEAR = 1979;
export const ROUTES = [
  { value: 1, id: '_NSR', color: MAP_TOKENS.categorical[5], label: { zh: '北方海航道', en: 'Northern Sea Route' } },
  { value: 2, id: '_NWP', color: MAP_TOKENS.categorical[1], label: { zh: '西北航道', en: 'Northwest Passage' } },
];

/** 航道的圓點放在航道的中段（側欄、排名表、tooltip 用航道的名稱） */
const ROUTE_PLACES: PlaceDef[] = [
  { id: '_NSR', name: ROUTES[0].label, lon: 125, lat: 75.3 },
  { id: '_NWP', name: ROUTES[1].label, lon: -103, lat: 68.3 },
];

const daysText = (v: number) => tr({ zh: `${fixed(v, 0)} 天`, en: `${fixed(v, 0)} ${v === 1 ? 'day' : 'days'}` });

function routeTooltip(p: PointRecord, year: number) {
  const route = ROUTES.find((r) => r.value === p.r);
  const days = String(p.d ?? '').split(',').map(Number);
  const i = year - FIRST_ROUTE_YEAR;
  const y = Math.max(FIRST_ROUTE_YEAR, Math.min(FIRST_ROUTE_YEAR + days.length - 1, year));
  const v = days[Math.max(0, Math.min(days.length - 1, i))];
  const best = Math.max(...days);
  const bestYear = FIRST_ROUTE_YEAR + days.indexOf(best);
  return {
    title: route ? tr(route.label) : '',
    detail: tr({ zh: `${y} 年海冰濃度都低於 15% 的天數：${daysText(v)}`, en: `Days with all ice below 15% in ${y}: ${daysText(v)}` }),
    extra: [tr({ zh: `最多是 ${bestYear} 年的 ${daysText(best)}`, en: `Most: ${daysText(best)} in ${bestYear}` })],
  };
}

const GLACIER_NOTE = {
  zh: '依冰河的面積加權，1976 年起累計到時間軸那一年（WGMS 的水文年：北半球 10 月起、南半球 4 月起）。',
  en: 'Area-weighted, accumulated from 1976 to the selected year (WGMS hydrological years: from October in the Northern Hemisphere, April in the Southern).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'glacier-thinning',
    label: { zh: '冰河變薄了多少', en: 'Glacier thinning' },
    description: {
      zh: `國內的冰河 1976 年起平均變薄了多少（公尺水當量：少掉的冰換成水的厚度）。${GLACIER_NOTE.zh}`,
      en: `How much the country's glaciers have thinned on average since 1976, in metres of water equivalent (the lost ice as a depth of water). ${GLACIER_NOTE.en}`,
    },
    unit: { zh: '公尺水當量', en: 'm w.e.' },
    file: 'glacier-thinning.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
    format: (v) =>
      v >= 0
        ? tr({ zh: `變薄 ${n1(v)} 公尺水當量`, en: `${n1(v)} m w.e. thinner` })
        : tr({ zh: `變厚 ${n1(-v)} 公尺水當量`, en: `${n1(-v)} m w.e. thicker` }),
    formatTick: (v) => fixed(v, 0),
    missing: NO_GLACIER,
  },
  {
    id: 'glacier-gt',
    label: { zh: '冰河少了多少冰', en: 'Glacier ice lost' },
    description: {
      zh: `國內的冰河 1976 年起總共少了多少冰（十億公噸，Gt；1 Gt 的水約是 40 萬座標準泳池）。冰河多的國家（加拿大、美國阿拉斯加、格陵蘭周邊）最多。${GLACIER_NOTE.zh}`,
      en: `How much ice the country's glaciers have lost in total since 1976, in gigatonnes (Gt). Countries with the most glacier ice (Canada, Alaska in the United States, the glaciers around Greenland) lose the most. ${GLACIER_NOTE.en}`,
    },
    unit: 'Gt',
    file: 'glacier-gt.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    format: (v) => tr({ zh: `少了 ${fixed(v, v < 10 ? 1 : 0)} Gt`, en: `${fixed(v, v < 10 ? 1 : 0)} Gt lost` }),
    formatTick: (v) => fixed(v, 0),
    missing: NO_GLACIER,
  },
  {
    id: 'sea-ice',
    label: { zh: '海冰邊緣', en: 'Sea-ice edge' },
    description: {
      zh: '北極每年 9 月、南極每年 2 月（各自海冰最少的月份）的海冰邊緣（海面至少 15% 有冰的範圍），1979 年起累積到時間軸那一年，一年一條線，越近的顏色越深；虛線是 1981–2010 年的中位數。滑到線上看那一年的海冰範圍；國家不上色。',
      en: 'The sea-ice edge (where at least 15% of the sea is ice-covered) each September in the Arctic and each February in the Antarctic, the months of least ice, one line per year from 1979 to the selected year, darker for recent years; the dashed line is the 1981–2010 median. Hover over a line for that year’s extent; countries are not coloured.',
    },
    unit: '',
    file: 'sea-ice.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: (v) => fixed(v, 0),
    missing: { zh: '海冰不屬於任何國家，看地圖上的線', en: 'Sea ice belongs to no country; see the lines on the map' },
  },
  {
    id: 'sea-level',
    label: { zh: '海平面上升速度', en: 'Sea-level rise' },
    description: {
      zh: '1993–2025 年衛星測高量到的海平面上升速度（mm/年，0.5° 網格）。國家不上色，滑到國家上看沿海（離國界 200 公里以內的海）的平均；滑到海上看那一格。各地的速度不一樣：洋流、風、海水變暖膨脹的程度不同，西太平洋熱帶一帶最快。',
      en: 'The rate of sea-level rise measured by satellite altimetry, 1993–2025 (mm a year, 0.5° grid). Countries are not coloured; hover over one for the average of its coastal waters (within 200 km), or over the sea for that cell. Rates differ from place to place with currents, winds and how much the water has warmed; they are fastest in the tropical western Pacific.',
    },
    unit: { zh: 'mm/年', en: 'mm/yr' },
    file: 'sea-level.json',
    layer: { kind: 'none' },
    format: (v) => tr({ zh: `沿海每年上升 ${fixed(v, 2)} mm`, en: `Coastal rise ${fixed(v, 2)} mm a year` }),
    formatTick: (v) => fixed(v, 1),
    panelChart: false,
    missing: { zh: '內陸國，沒有沿海的海', en: 'Landlocked: no coastal waters' },
  },
  {
    id: 'sea-level-rise',
    label: { zh: '海平面上升（推估）', en: 'Projected sea-level rise' },
    description: {
      zh: 'IPCC 第六次評估報告推估 2050、2100 年的海平面比 1995–2014 年的平均高多少（公分，中位數），選上方的「排放情境」切換。國家是沿海（海岸外 200 公里以內的 1° 網格）的平均；點是潮位站，含當地地層下陷或隆起，所以同一國的站差很多（日本鳥羽 2 公尺多、阿拉斯加因冰河消退後地殼回彈反而下降）。中排放下 2100 年世界 56 公分、台灣沿海 59 公分、基隆 57 公分（可能範圍 38–84）。',
      en: 'How much higher than the 1995–2014 average the sea is projected to be in 2050 and 2100 (cm, median) in the IPCC Sixth Assessment Report; switch with "Emissions scenario" above. Countries show the average of their coastal waters (1° grid cells within 200 km); points are tide gauges, which include local land subsidence or uplift, so gauges in one country can differ widely (over 2 m at Toba in Japan; falling in Alaska, where land is still rebounding after deglaciation). Under intermediate emissions: world 56 cm in 2100, Taiwan’s coast 59 cm, Keelung 57 cm (likely range 38–84).',
    },
    unit: { zh: '公分', en: 'cm' },
    file: 'sea-level-rise/{item}.json',
    dimension: { label: { zh: '排放情境', en: 'Emissions scenario' }, options: SLR_SCENARIOS, defaultOption: 'ssp245' },
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 80] } },
    format: rise,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    defaultYear: 2100,
    missing: { zh: '內陸國，沒有沿海', en: 'Landlocked: no coast' },
  },
  {
    id: 'arctic-routes',
    label: { zh: '北極航道能通航幾天', en: 'Arctic shipping routes' },
    description: {
      zh: '北方海航道（俄羅斯沿岸）與西北航道（加拿大北極群島）每年有幾天整條航道的海冰濃度都低於 15%（圓點的大小）。1979 年起逐年變長，但年年差很多：北方海航道 2020 年有 97 天，2024 年一天也沒有；西北航道的窄海峽常卡著從北邊漂下來的多年冰，最多一年只有 7 天。點航道的圓點看 1979 年起的折線；滑到航道上看那一年的天數。',
      en: 'How many days a year the sea-ice concentration stays below 15% along the whole of the Northern Sea Route (off Russia) and the Northwest Passage (through the Canadian Arctic Archipelago), shown by circle size. The open season has lengthened since 1979 but swings from year to year: the Northern Sea Route had 97 days in 2020 and none in 2024, while the Northwest Passage’s narrow straits are often choked by old ice drifting down from the north, giving at most 7 days a year. Click a route’s circle for its line chart since 1979; hover over a route for that year’s count.',
    },
    unit: { zh: '天', en: 'days' },
    file: 'arctic-routes.json',
    layer: { kind: 'bubble', legendValues: [10, 50, 100] },
    focus: [-180, 62, 180, 82],
    format: daysText,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    missing: { zh: '只算兩條北極航道，看地圖上的航道與圓點', en: 'Only the two Arctic routes are counted; see the routes and circles on the map' },
  },
];

export const ice: TopicDefinition = {
  id: 'ice',
  title: { zh: '冰河、海冰與海平面', en: 'Glaciers, sea ice and sea level' },
  shortTitle: { zh: '冰河與海平面', en: 'Ice & sea level' },
  defaultIndicator: 'glacier-thinning',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'NASA GIBS：VIIRS、MODIS 每日真彩影像（那一天的衛星照片）', en: 'NASA GIBS: VIIRS and MODIS daily true colour (satellite image of the day)' },
      url: 'https://nasa-gibs.github.io/gibs-api-docs/',
      license: { zh: 'NASA 開放資料（依要求標示 GIBS）', en: 'NASA open data (GIBS acknowledged as requested)' },
    },
    {
      name: {
        zh: 'WGMS（2026）冰河年質量變化 AMCE（Dussaillant 等 2025）',
        en: 'WGMS (2026) Annual mass-change estimates for the world’s glaciers (AMCE; Dussaillant et al. 2025)',
      },
      url: 'https://doi.org/10.5904/wgms-amce-2026-02-10',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'NSIDC 海冰指數第 4 版（G02135）', en: 'NSIDC Sea Ice Index, Version 4 (G02135)' },
      url: 'https://nsidc.org/data/g02135/versions/4',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
    {
      name: {
        zh: 'NOAA/NSIDC 海冰濃度氣候資料紀錄第 6 版（G02202，Meier 等）',
        en: 'NOAA/NSIDC Climate Data Record of Passive Microwave Sea Ice Concentration, Version 6 (G02202; Meier et al.)',
      },
      url: 'https://doi.org/10.7265/b18j-z797',
      license: { zh: '美國政府著作（要引用）', en: 'US Government work (citation required)' },
    },
    {
      name: {
        zh: 'NOAA STAR 衛星測高的海平面趨勢（Altimetry data are provided by NOAA Laboratory for Satellite Altimetry）',
        en: 'NOAA STAR sea-level trends (Altimetry data are provided by NOAA Laboratory for Satellite Altimetry)',
      },
      url: 'https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
    {
      name: {
        zh: 'Garner, G. G. 等（2021）IPCC AR6 Sea Level Projections，版本 20210809（海平面上升推估）',
        en: 'Garner, G. G. et al. (2021), IPCC AR6 Sea Level Projections, version 20210809 (projected sea-level rise)',
      },
      url: 'https://doi.org/10.5281/zenodo.5914709',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '冰河是 WGMS（世界冰河監測服務）2026 年 2 月的 AMCE：全世界約 21 萬條冰河（RGI 6.0 的輪廓）1976–2025 年每年的質量變化，由衛星與航測的多年高程變化，配上實地量測的逐年變化推算（Dussaillant 等 2025）；格陵蘭與南極的冰蓋本體不算冰河，只有周邊的冰河。每條冰河依中心點歸到國家（Natural Earth 1:10m），國家的值依面積加權；冰河少的國家（例如赤道附近的高山）誤差大。台灣沒有冰河（雪山、南湖大山的圈谷是冰河期留下的地形）。海冰是 NSIDC 海冰指數第 4 版的月平均範圍與邊緣（衛星被動微波，海面至少 15% 有冰算在範圍內），北極 9 月與南極 2 月各自是一年裡最少的月份；1981–2010 年的中位數邊緣當比較的基準。海平面是 NOAA STAR 的衛星測高（TOPEX、Jason-1/2/3、Sentinel-6MF）1993–2025 年的線性趨勢，0.5° 網格，NOAA 標示為實驗性產品；沿海的平均是離國界 200 公里以內的格子依緯度加權，內陸國不算。全球海洋格子的平均約 3.2 mm/年。衛星測高量的是海面高度，不含地層下陷：台灣西南沿海的地層下陷讓陸地看到的海平面上升比這個快。' +
      '北極航道是 NOAA/NSIDC 海冰濃度氣候資料紀錄第 6 版（25 km 網格，每天一張）沿兩條航道取樣：航道線是自己沿主要航線畫的示意線（沒有開放的官方 GIS），北方海航道從喀拉海峽到白令海峽，西北航道是多數船走的南線（蘭開斯特海峽、皮爾海峽、毛德皇后灣、阿蒙森灣到巴羅角）。一天裡航道上每一格的海冰濃度都低於 15% 才算一天，一格（25 km）有冰就不算；比 25 km 窄的海峽（例如辛普森海峽）在網格上是陸地，不算在內。能不能通航還看冰的種類、破冰船的護航與船級，不只看濃度：北方海航道有破冰船時，濃度更高也有船走。' +
      '海平面上升推估是 IPCC 第六次評估報告第一工作組的區域推估（中等信心，FACTS 模型），相對 1995–2014 年的平均，取中位數，提示框另寫 17%–83% 的可能範圍；「total」含垂直地殼運動（地層下陷、冰河消退後的地殼回彈），潮位站的值因此跟附近的網格不同。國家的值是海岸外 200 公里以內有值的 1° 網格點依緯度加權平均（跟上面的上升速度同一個做法），世界值是報告的全球平均海平面。依資料集的要求引用：Fox-Kemper, B. 等（2021）Ocean, Cryosphere and Sea Level Change，IPCC AR6 WG1 第 9 章，doi:10.1017/9781009157896.011；Kopp, R. E. 等（2023）The Framework for Assessing Changes To Sea-Level (FACTS) v1.0，Geoscientific Model Development 16, 7461–7489，doi:10.5194/gmd-16-7461-2023；Garner, G. G. 等（2021）IPCC AR6 Sea Level Projections，版本 20210809，doi:10.5281/zenodo.5914709（2026-11-02 取用）。致謝（原文）：We thank the projection authors for developing and making the sea-level rise projections available, multiple funding agencies for supporting the development of the projections, and the NASA Sea Level Change Team for developing and hosting the IPCC AR6 Sea Level Projection Tool.',
    en: 'Glaciers come from the WGMS (World Glacier Monitoring Service) AMCE of February 2026: yearly mass change of some 210,000 glaciers worldwide (RGI 6.0 outlines) for 1976–2025, combining multi-year elevation changes from satellites and aerial surveys with year-to-year field measurements (Dussaillant et al. 2025). The Greenland and Antarctic ice sheets themselves are not glaciers; only the glaciers around them are included. Each glacier is assigned to a country by its centre point (Natural Earth 1:10m) and country values are area-weighted; countries with few glaciers (such as tropical mountains) are less certain. Taiwan has no glaciers (the cirques on Xueshan and Nanhu Mountain are relics of the ice age). Sea ice is the monthly mean extent and edge from the NSIDC Sea Ice Index, Version 4 (passive microwave satellites; the extent counts sea at least 15% covered by ice); September in the Arctic and February in the Antarctic are each the month of least ice, and the 1981–2010 median edge is the reference. Sea level is the linear trend for 1993–2025 from NOAA STAR satellite altimetry (TOPEX, Jason-1/2/3, Sentinel-6MF) on a 0.5° grid, labelled experimental by NOAA; coastal averages use cells within 200 km of the country, weighted by latitude, and exclude landlocked countries. The average over all ocean cells is about 3.2 mm a year. Altimetry measures the height of the sea surface and does not include land subsidence: along Taiwan’s south-western coast, subsidence makes the sea rise faster relative to the land. ' +
      'The Arctic routes sample the NOAA/NSIDC Sea Ice Concentration Climate Data Record, Version 6 (25 km grid, one map a day) along two routes drawn by hand along the main shipping lanes (there is no open official GIS): the Northern Sea Route from the Kara Gate to the Bering Strait, and the southern Northwest Passage most ships use (Lancaster Sound, Peel Sound, Queen Maud Gulf and Amundsen Gulf to Point Barrow). A day counts only if every grid cell along the route is below 15% ice; one 25 km cell of ice rules it out, and straits narrower than 25 km (such as Simpson Strait) are land on the grid and left out. Whether ships can pass also depends on the type of ice, icebreaker escort and ship class, not just concentration: with icebreakers, ships use the Northern Sea Route at higher concentrations. ' +
      'Projected sea-level rise is the regional projection of the IPCC Sixth Assessment Report, Working Group I (medium confidence, FACTS), relative to the 1995–2014 average; the median is mapped and the tooltip gives the 17–83% likely range. The “total” projection includes vertical land motion (subsidence, rebound after deglaciation), so tide gauges can differ from nearby grid cells. Country values average the 1° grid cells with data within 200 km of the coast, weighted by latitude (as for the rate above); the world value is the report’s global mean sea level. Cited as the dataset requires: Fox-Kemper, B. et al. (2021), Ocean, Cryosphere and Sea Level Change, IPCC AR6 WG1 Chapter 9, doi:10.1017/9781009157896.011; Kopp, R. E. et al. (2023), The Framework for Assessing Changes To Sea-Level (FACTS) v1.0, Geoscientific Model Development 16, 7461–7489, doi:10.5194/gmd-16-7461-2023; Garner, G. G. et al. (2021), IPCC AR6 Sea Level Projections, version 20210809, doi:10.5281/zenodo.5914709 (accessed 2026-11-02). We thank the projection authors for developing and making the sea-level rise projections available, multiple funding agencies for supporting the development of the projections, and the NASA Sea Level Change Team for developing and hosting the IPCC AR6 Sea Level Projection Tool.',
  },
  panelExtra: () => import('./panels/IcePanel'),
  listPanel: [SLR_LIST],
  places: ROUTE_PLACES,
  pointer: ([lon, lat], { indicator }) => {
    if (indicator !== 'sea-level') return null;
    const c = SEA_LEVEL_CLASSES.find((k) => k.value === seaLevelAt(lon, lat));
    if (!c) return null;
    const line = tr({ zh: `這一格：${c.label.zh}`, en: `This cell: ${c.label.en}` });
    return { title: tr({ zh: '海平面（1993–2025）', en: 'Sea level (1993–2025)' }), lines: [line] };
  },
  overlays: [
    {
      kind: 'lines',
      id: 'ice-edges',
      file: 'ice-edges.json',
      label: { zh: '海冰邊緣', en: 'Sea-ice edge' },
      width: 1.4,
      color: {
        title: { zh: '年代', en: 'Decade' },
        classes: [
          ...[...DECADES].reverse(),
          {
            value: MEDIAN,
            color: MAP_TOKENS.ink,
            dash: true,
            label: { zh: '1981–2010 年的中位數', en: '1981–2010 median' },
          },
        ],
      },
      timeField: 'y',
      sortByType: true,
      casing: true,
      tooltip: edgeTooltip,
      indicators: ['sea-ice'],
    },
    {
      kind: 'lines',
      id: 'arctic-routes',
      file: 'arctic-routes-lines.json',
      label: { zh: '北極航道（示意）', en: 'Arctic routes (schematic)' },
      width: 2.4,
      color: { title: { zh: '航道', en: 'Route' }, classes: ROUTES.map((r) => ({ value: r.value, color: r.color, label: r.label })) },
      casing: true,
      tooltip: (p, ctx) => routeTooltip(p, ctx.year),
      indicators: ['arctic-routes'],
    },
    {
      kind: 'points',
      id: 'slr-gauges',
      file: 'slr-gauges/{item}.json',
      label: { zh: '潮位站的推估', en: 'Tide-gauge projections' },
      radius: 4,
      color: {
        field: 'v',
        title: { zh: '比 1995–2014 年高（公分）', en: 'Rise since 1995–2014 (cm)' },
        thresholds: [0, 20, 30, 40, 50, 60, 80],
        classes: SLR_CLASSES,
      },
      sortField: 'v',
      epochs: { years: SLR_YEARS, values: (p, epoch) => ({ v: gaugeValue(p, 'm', epoch) }) },
      tooltip: (p, ctx) => {
        const v = gaugeValue(p, 'm', ctx.year);
        const range = likely(p, ctx.year);
        return {
          title: gaugeName(p),
          // 原文的站名（PSMSL）另起一行，畫面上不翻譯
          ...(GAUGE_ZH[String(p.name)] && getLang() === 'zh' ? { properNoun: String(p.name) } : {}),
          detail: v === null ? '' : tr({ zh: `${slrEpoch(ctx.year)} 年：${rise(v)}`, en: `${slrEpoch(ctx.year)}: ${rise(v)}` }),
          extra: [range, typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter((x): x is string => Boolean(x)),
        };
      },
      indicators: ['sea-level-rise'],
    },
    {
      kind: 'classGrid',
      id: 'sea-level',
      label: { zh: '海平面上升速度（0.5° 網格）', en: 'Sea-level rise (0.5° grid)' },
      file: () => 'grid/sea-level.png',
      classes: SEA_LEVEL_CLASSES.map((c) => ({ ...c, group: 0 })),
      groups: [{ zh: 'mm/年，1993–2025', en: 'mm a year, 1993–2025' }],
      opacity: 0.85,
      indicators: ['sea-level'],
    },
  ],
  // 海冰邊緣：那一年 9 月 15 日（北極海冰接近最少、南極接近最多）的 MODIS 真彩影像，白色的冰看得到（2026-11-01；2000 年起）
  satellite: { date: ({ year, indicator }) => (indicator === 'sea-ice' ? `${year}-09-15` : null) },
  indicators,
};
