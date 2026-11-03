import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 河流與流域的擴充：大河一年中的流量（2026-11-03，製作手冊第十七批 277；pipeline/topics/river_flow.py）。
 * Open-Meteo Flood API 的 GloFAS v4 再分析，2015–2024 年每日流量的月平均，河口附近的一個格點：
 * 點的大小是年平均流量、顏色是流量最大的月份落在哪三個月；左側欄依最大的月份分組、依季節差或流量排，每列一個 12 個月的小長條圖。
 * 是模式模擬的值，不是測站的實測。rivers.ts 會接這個檔，所以這裡不從 rivers.ts 拿東西（避免循環）。
 */

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const flow = (v: number) => (v < 0.05 ? '≈ 0 m³/s' : `${fixed(v, v < 10 ? 1 : 0)} m³/s`);
const months = (p: PointRecord) => Array.from({ length: 12 }, (_, i) => num(p[`m${i + 1}`]) ?? 0);
const name = (p: PointRecord) => String((getLang() === 'en' ? p.e : p.z) ?? p.e ?? '');

const MONTH: Text[] = Array.from({ length: 12 }, (_, i) => ({
  zh: `${i + 1} 月`,
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][i],
}));
const month = (m: unknown) => (typeof m === 'number' && m >= 1 && m <= 12 ? tr(MONTH[m - 1]) : '?');

/** 流量最大的月份落在哪三個月（pipeline 的 s）：用月份不用季節，南北半球的季節相反 */
const SEASONS: Text[] = [
  { zh: '12–2 月', en: 'December–February' },
  { zh: '3–5 月', en: 'March–May' },
  { zh: '6–8 月', en: 'June–August' },
  { zh: '9–11 月', en: 'September–November' },
];

/** 年平均流量 → 半徑（px，縮放 2）：面積大約跟流量的平方根成正比，亞馬遜（約 20 萬）最大、台灣的河（約 100）最小 */
const FLOW_STOPS: [number, number][] = [
  [30, 2.5],
  [300, 3.5],
  [3000, 6],
  [30000, 11],
  [200000, 17],
];

function facts(p: PointRecord): string[] {
  const m = months(p);
  const pk = num(p.pk) ?? 1;
  const lo = num(p.lo) ?? 1;
  const r = num(p.r) ?? 0;
  return [
    tr({
      zh: `${month(pk)}最多（${flow(m[pk - 1])}）、${month(lo)}最少（${flow(m[lo - 1])}），差 ${fixed(r, r < 10 ? 1 : 0)} 倍`,
      en: `Highest in ${month(pk)} (${flow(m[pk - 1])}), lowest in ${month(lo)} (${flow(m[lo - 1])}): ${fixed(r, r < 10 ? 1 : 0)} times`,
    }),
  ];
}

/** 12 個月的值寫成兩行（1–6 月、7–12 月），tooltip 用 */
function monthLines(p: PointRecord): string[] {
  const m = months(p).map((v) => fixed(v, v < 10 ? 1 : 0));
  return [
    tr({ zh: `1–6 月：${m.slice(0, 6).join('、')}`, en: `Jan–Jun: ${m.slice(0, 6).join(', ')}` }),
    tr({ zh: `7–12 月：${m.slice(6).join('、')}（m³/s）`, en: `Jul–Dec: ${m.slice(6).join(', ')} (m³/s)` }),
  ];
}

const FLOW: PointsOverlayDef = {
  kind: 'points',
  id: 'river-flow',
  file: 'flow.json',
  label: { zh: '大河河口附近的月流量（GloFAS 模式值）', en: 'Monthly flow near the mouths of big rivers (GloFAS model)' },
  radius: { field: 'q', stops: FLOW_STOPS },
  // 類別色依固定的順序取前四個（MAP_TOKENS.categorical 任兩色都驗證過）
  color: {
    field: 's',
    title: { zh: '流量最大的月份', en: 'Peak flow month' },
    thresholds: [2, 3, 4],
    classes: SEASONS.map((label, i) => ({ color: MAP_TOKENS.categorical[i], label })),
  },
  sizeLegend: { title: { zh: '年平均流量', en: 'Mean annual flow' }, values: [100, 1000, 10000, 100000], format: flow },
  sortField: 'q',
  indicators: ['flow'],
  shareable: false,
  tooltip: (p) => ({
    title: name(p),
    detail: tr({ zh: `年平均 ${flow(num(p.q) ?? 0)}（2015–2024 年）`, en: `Mean ${flow(num(p.q) ?? 0)} (2015–2024)` }),
    extra: [...facts(p), ...monthLines(p)],
    properNoun: getLang() !== 'en' && typeof p.e === 'string' ? p.e : undefined,
  }),
};

function row(p: PointRecord, group?: string): ListRow {
  const m = months(p);
  const pk = num(p.pk) ?? 1;
  const tw = p.t === 1;
  return {
    key: `${p.g}`,
    title: name(p),
    lines: [tr({ zh: `年平均 ${flow(num(p.q) ?? 0)}`, en: `Mean ${flow(num(p.q) ?? 0)}` }), ...facts(p)],
    bars: {
      values: m,
      highlight: [pk - 1],
      labels: [tr({ zh: '1 月', en: 'Jan' }), tr({ zh: '12 月', en: 'Dec' })],
      aria: tr({
        zh: `${name(p)}每個月的平均流量：${m.map((v, i) => `${i + 1} 月 ${flow(v)}`).join('、')}`,
        en: `Mean flow of the ${name(p)} by month: ${m.map((v, i) => `${tr(MONTH[i])} ${flow(v)}`).join(', ')}`,
      }),
    },
    target: { lon: Number(p.lon), lat: Number(p.lat), zoom: tw ? 8 : 5 },
    ...(group ? { group } : {}),
  };
}

const LIST: ListPanelDef = {
  label: { zh: '大河一年中的流量', en: 'River flow through the year' },
  indicators: ['flow'],
  file: 'flow.json',
  sorts: [
    { id: 'peak', label: { zh: '依最大的月份', en: 'By peak month' } },
    { id: 'ratio', label: { zh: '季節差', en: 'Seasonality' } },
    { id: 'flow', label: { zh: '流量', en: 'Flow' } },
  ],
  rows: (records, { sort }) => {
    const byFlow = [...records].sort((a, b) => (num(b.q) ?? 0) - (num(a.q) ?? 0));
    if (sort === 'ratio') return [...records].sort((a, b) => (num(b.r) ?? 0) - (num(a.r) ?? 0)).map((p) => row(p));
    if (sort === 'flow') return byFlow.map((p) => row(p));
    // 依最大的月份分組（1 月到 12 月），組裡依流量
    return [...byFlow]
      .sort((a, b) => (num(a.pk) ?? 0) - (num(b.pk) ?? 0))
      .map((p) => row(p, tr({ zh: `${month(p.pk)}流量最大`, en: `Peak in ${month(p.pk)}` })));
  },
};

const FLOW_INDICATOR: IndicatorDef = {
  id: 'flow',
  label: { zh: '大河一年中的流量', en: 'River flow through the year' },
  description: {
    zh: '大河河口附近每個月的平均流量（2015–2024 年）：點越大流量越大，顏色是流量最大的月份落在哪三個月。亞馬遜、恆河、長江這類季風或雨季的河，夏天的流量是冬天的好幾倍；西伯利亞的河春夏融雪時暴漲；台灣的河 5–9 月梅雨、颱風時最多，冬天只剩一點。左側欄每條河有 12 個月的小長條圖，可以依最大的月份、季節差（最多的月 ÷ 最少的月）或流量排。數字是 GloFAS 水文模式模擬的值，不是測站的實測，水庫調節與取水多的河（黃河、墨瑞河、格蘭德河）跟實際差很多；尼羅河、科羅拉多河的模式值是 HydroRIVERS 長期平均的 5 倍以上（實際流到海的水很少），沒有放。',
    en: 'Mean monthly flow near the mouths of big rivers (2015–2024): bigger dots carry more water, and the colour shows the three months in which the peak month falls. Monsoon and rainy-season rivers such as the Amazon, Ganges and Yangtze carry several times more water in summer than in winter; Siberian rivers surge with the spring and summer snowmelt; Taiwan’s rivers peak during the May–September plum rains and typhoons and shrink to a trickle in winter. Each river in the list on the left has a 12-month bar chart and can be sorted by peak month, seasonality (highest month ÷ lowest) or flow. Figures are simulated by the GloFAS hydrological model, not gauged, and rivers heavily regulated by dams or abstraction (the Yellow, Murray and Rio Grande) differ greatly from reality; the Nile and Colorado are left out because the model gives more than five times the HydroRIVERS long-term mean (little water actually reaches the sea).',
  },
  unit: '',
  file: 'flow-years.json',
  layer: { kind: 'none' },
  shade: 'land',
  unranked: true,
  rankingBars: false,
  panelChart: false,
  format: () => '',
  missing: { zh: '國家不上色，看河口的點', en: 'Countries are not coloured; see the dots at river mouths' },
};

export const riverFlowPart: TopicPart = {
  name: { zh: '大河一年中的流量', en: 'River flow through the year' },
  sources: [
    {
      name: {
        zh: 'Open-Meteo Flood API（GloFAS v4 再分析，2015–2024 年的每日流量，算成月平均）',
        en: 'Open-Meteo Flood API (GloFAS v4 reanalysis, daily flow 2015–2024, averaged by month)',
      },
      url: 'https://open-meteo.com/',
      license: { zh: 'CC BY 4.0（免費 API 只准非商業使用）', en: 'CC BY 4.0 (free API for non-commercial use only)' },
    },
    {
      name: {
        zh: 'Copernicus 緊急管理服務 Global Flood Awareness System（GloFAS）：Contains modified Copernicus Emergency Management Service information 2026',
        en: 'Copernicus Emergency Management Service, Global Flood Awareness System (GloFAS): contains modified Copernicus Emergency Management Service information 2026',
      },
      url: 'https://ecds.ecmwf.int/licences/cems-floods',
      license: { zh: 'CEMS-FLOODS datasets licence', en: 'CEMS-FLOODS datasets licence' },
    },
  ],
  note: {
    zh: '河口附近的月流量是 Open-Meteo（CC BY 4.0）轉發的 GloFAS v4 再分析（Copernicus 緊急管理服務，0.05° 網格的水文模式模擬，不是實測），2015–2024 年每日流量的月平均。河口的格點不一定落在主流上，pipeline 在河口、往上游 50 公里內與前後左右 0.1° 幾個點各抓兩週，取流量最大的那一格。挑的河是 HydroRIVERS 流量前 40 名有名稱的河，加上黃河、阿拉伯河（底格里斯河、幼發拉底河）、墨瑞河、格蘭德河、奧蘭治河、萊茵河、聶伯河、昭拍耶河，與台灣流域面積前 10 大的河，共 58 條。水庫調節、灌溉取水多的河，模式值跟實際差很多；尼羅河、科羅拉多河差太多，沒有放。',
    en: 'Monthly flow near the mouths is from the GloFAS v4 reanalysis (Copernicus Emergency Management Service; a hydrological model simulation on a 0.05° grid, not gauged), served by Open-Meteo (CC BY 4.0): monthly means of daily flow for 2015–2024. Grid cells at a mouth may miss the main channel, so the pipeline samples two weeks at the mouth, at points up to 50 km upstream and 0.1° to each side, and keeps the cell with the most flow. The rivers are the 40 largest named rivers by HydroRIVERS flow, plus the Yellow, Shatt al-Arab (Tigris–Euphrates), Murray, Rio Grande, Orange, Rhine, Dnieper and Chao Phraya, and Taiwan’s 10 largest by basin area: 58 in all. Rivers heavily regulated by dams or irrigation differ greatly from the model; the Nile and Colorado differ so much that they are left out.',
  },
  overlays: [FLOW],
  indicators: [FLOW_INDICATOR],
  listPanel: [LIST],
};
