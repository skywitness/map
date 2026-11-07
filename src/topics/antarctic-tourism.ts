import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { seasonText } from './penguins';

/**
 * 南極：觀光船去了哪裡（2026-11-07，製作手冊第二十四批 435；pipeline/topics/antarctic_tourism.py）。
 * 南極條約秘書處 EIES 的「Most Visited Sites」：每個場址一季的造訪趟數（2007/08 起）與人次（2012/13 起才有填），
 * 場址的座標用 Wikidata 比對名稱。點的大小是時間軸那一季的人次或趟數，顏色是 EIES 的地區（併成 7 組）。
 */

const C = MAP_TOKENS.categorical;
const FIRST = 2007;
const VISITORS_FROM = 2012;
const LAST = 2025; // 2026/27 季還沒有通報
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** 地區分組（pipeline 的 REGION_GROUP）；白色的冰面上不用淺色 */
const REGIONS: { code: number; label: Text; color: string }[] = [
  { code: 1, label: { zh: '南極半島西北側', en: 'Antarctic Peninsula, north-west' }, color: C[1] },
  { code: 2, label: { zh: '南昔得蘭群島', en: 'South Shetland Islands' }, color: C[3] },
  { code: 3, label: { zh: '南極半島東側（威德爾海北部）', en: 'Antarctic Peninsula, east (northern Weddell Sea)' }, color: C[5] },
  { code: 4, label: { zh: '南極半島西南側（含阿德萊德島、亞歷山大島）', en: 'Antarctic Peninsula, south-west (incl. Adelaide and Alexander islands)' }, color: C[7] },
  { code: 5, label: { zh: '南奧克尼群島', en: 'South Orkney Islands' }, color: C[2] },
  { code: 6, label: { zh: '羅斯海', en: 'Ross Sea' }, color: C[6] },
  { code: 7, label: { zh: '東南極與其他', en: 'East Antarctica and elsewhere' }, color: MAP_TOKENS.diverging[0] },
];
const REGION_COLORS: ColorClasses = {
  field: 'g',
  title: { zh: '地區', en: 'Region' },
  thresholds: REGIONS.slice(1).map((r) => r.code),
  classes: REGIONS.map((r) => ({ color: r.color, label: r.label })),
};

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);
const clamp = (y: number, a: number) => Math.min(LAST, Math.max(a, y));
const regionLabel = (p: PointRecord) => tr(REGIONS.find((r) => r.code === p.g)?.label ?? REGIONS[6].label);
const tripsText = (n: number) => tr({ zh: `${fixed(n, 0)} 趟`, en: `${fixed(n, 0)} ${n === 1 ? 'visit' : 'visits'}` });
const visitorsText = (n: number) => tr({ zh: `${fixed(n, 0)} 人次`, en: `${fixed(n, 0)} visitors` });

function facts(p: PointRecord, y: number): string[] {
  const t = num(p, `t${y}`);
  const v = num(p, `v${y}`);
  const out = [
    t == null
      ? tr({ zh: `${seasonText(y)} 季沒有通報`, en: `None reported in ${seasonText(y)}` })
      : tr({
          zh: `${seasonText(y)} 季：${tripsText(t)}${v ? `、${visitorsText(v)}` : ''}`,
          en: `${seasonText(y)}: ${tripsText(t)}${v ? `, ${visitorsText(v)}` : ''}`,
        }),
  ];
  if (p.w === 1) out.push(tr({ zh: '海峽或水道：多半是船上巡遊、不上岸', en: 'A strait or channel: mostly cruised past, not landed on' }));
  if (p.gl === 1) out.push(tr({ zh: '有《南極條約》的場址指引', en: 'Covered by Antarctic Treaty Site Guidelines' }));
  return out;
}

function overlay(id: string, indicator: string, field: 'v' | 't', from: number): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: 'tourism-sites.json',
    label: { zh: '觀光場址', en: 'Visitor sites' },
    indicators: [indicator],
    epochs: { years: range(from, LAST), values: (p, y) => ({ n: num(p, `${field}${y}`) }) },
    minValue: { field: 'n', stops: [[0, 1]] },
    radius:
      field === 'v'
        ? { field: 'n', stops: [[1, 2.2], [1000, 3.2], [10000, 5.5], [50000, 9], [120000, 13]] }
        : { field: 'n', stops: [[1, 2.2], [10, 3], [100, 5], [400, 8], [700, 11]] },
    color: REGION_COLORS,
    sortField: 'n',
    sizeLegend:
      field === 'v'
        ? { title: { zh: '一季的人次', en: 'Visitors a season' }, values: [1000, 10000, 50000], format: (v) => fixed(v, 0) }
        : { title: { zh: '一季的造訪趟數', en: 'Visits a season' }, values: [10, 100, 500], format: (v) => fixed(v, 0) },
    tooltip: (p, { year }) => ({
      title: String(p.name ?? ''),
      detail: regionLabel(p),
      extra: facts(p, clamp(year ?? 2024, from)),
      properNoun: undefined,
    }),
  };
}

function list(id: string, indicator: string, field: 'v' | 't', from: number): ListPanelDef {
  return {
    label: { zh: '觀光場址', en: 'Visitor sites' },
    tabLabel: { zh: '觀光場址', en: 'Visitor sites' },
    indicators: [indicator],
    file: 'tourism-sites.json',
    rows: (points, { year }) => {
      const y = clamp(year, from);
      return points
        .filter((p) => num(p, `${field}${y}`))
        .sort((a, b) => Number(b[`${field}${y}`]) - Number(a[`${field}${y}`]))
        .map((p, i): ListRow => ({
          key: `${id}-${i}-${p.name}`,
          title: `${i + 1}. ${p.name}`,
          titleProper: true,
          lines: [regionLabel(p), ...facts(p, y)],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 7 },
        }));
    },
  };
}

const TIME_AXIS = {
  label: { zh: '觀光季', en: 'Season' },
  year: (y: number) => tr({ zh: `${seasonText(y)} 季`, en: `the ${seasonText(y)} season` }),
  tick: seasonText,
};

const base = {
  unit: '',
  layer: { kind: 'none' } as const,
  unranked: true,
  rankingBars: false,
  panelChart: false,
  format: () => '',
  missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
  noValue: { TWN: { zh: '台灣沒有觀光船登陸的場址', en: 'Taiwan has no Antarctic visitor sites' } },
  timeAxis: TIME_AXIS,
  defaultYear: 2024,
} satisfies Partial<IndicatorDef>;

export const tourismPart = {
  sources: [
    {
      name: {
        zh: '南極條約秘書處，電子資訊交換系統（EIES）「Most Visited Sites」報表（船載觀光，2007/08–2025/26 季）',
        en: 'Antarctic Treaty Secretariat, Electronic Information Exchange System (EIES) “Most Visited Sites” report (ship-based tourism, 2007/08–2025/26)',
      },
      url: 'https://eies.ats.aq/',
      license: { zh: 'CC BY 4.0（註明出處即可使用）', en: 'CC BY 4.0 (may be used with the source indicated)' },
    },
  ],
  note: {
    zh:
      '南極條約秘書處的電子資訊交換系統（EIES）收各締約國通報的船載觀光：每個場址一季被造訪幾趟（2007/08 季起）、幾人次（2012/13 季才開始填）。' +
      '「人次」不是人數：一個旅客一趟航程會造訪十幾個場址，每個場址各算一次。海峽與水道（傑拉許海峽、勒梅爾水道）多半是船上巡遊、沒有上岸，點上有標。' +
      'EIES 是官方通報，只收通報了的；國際南極旅遊業者協會（IAATO）的會員統計是另一套，兩邊的數字對不起來，跨季的變化也有一部分是通報多寡的差別（2019/20、2020/21 季受 COVID-19 影響）。' +
      'EIES 沒有座標，場址的位置用 Wikidata 的地名比對（名稱、西班牙文或法文別名），826 個場址裡 766 個對得到，55 個對不到的（例如 Stony Point、Punta Vidt）不畫；南喬治亞、福克蘭這類條約區以外的不畫。南極不屬於任何國家，國家不上色。',
    en:
      'The Antarctic Treaty Secretariat’s Electronic Information Exchange System (EIES) collects the ship-based tourism reported by treaty parties: how many visits each site received in a season (from 2007/08) and how many visitors (only filled in from 2012/13). ' +
      'Visitors are counted per site, not per person: one traveller on one voyage may visit a dozen sites, each counted once. Straits and channels (the Gerlache Strait, the Lemaire Channel) are mostly cruised through without landing, and are marked as such. ' +
      'EIES holds only what parties report; the International Association of Antarctica Tour Operators (IAATO) counts its members separately and the two do not match, and some changes between seasons reflect reporting (the 2019/20 and 2020/21 seasons were hit by COVID-19). ' +
      'EIES has no coordinates, so sites are located by matching names (and Spanish or French alternatives) against Wikidata: 766 of 826 sites were matched; the 55 that were not (such as Stony Point and Punta Vidt) are not drawn, nor are sites outside the treaty area such as South Georgia and the Falklands. Antarctica belongs to no country, so countries are not coloured.',
  },
  overlays: [overlay('tourism-visitors', 'tourism-visitors', 'v', VISITORS_FROM), overlay('tourism-visits', 'tourism-visits', 't', FIRST)],
  listPanel: [list('tv', 'tourism-visitors', 'v', VISITORS_FROM), list('tt', 'tourism-visits', 't', FIRST)],
  indicators: [
    {
      ...base,
      id: 'tourism-visitors',
      label: { zh: '觀光場址的人次', en: 'Visitors to tourist sites' },
      description: {
        zh: '南極觀光船每個場址一季的人次（同一人在不同場址各算一次），點的大小是人次、顏色是地區，拖時間軸看 2012/13 季起的每一季。2024/25 季 495 個場址被造訪、合計 341 萬人次（2012/13 季 15 萬），最多的是傑拉許海峽 20.4 萬人次（船上巡遊）、布蘭斯菲爾德海峽 9.8 萬、諾伊邁爾水道 9.7 萬、天堂港 9.3 萬、內科港 9.2 萬、達莫伊角 9.1 萬；72% 的人次在南極半島西北側、18.5% 在南昔得蘭群島，羅斯海只有 1.1%。2025/26 季通報的是 406 個場址、212 萬人次。左邊的清單依人次列出。',
        en: 'Visitors to each Antarctic tourist site in a season (one person visiting several sites counts at each), sized by visitors and coloured by region; drag the time slider through the seasons since 2012/13. In 2024/25, 495 sites received 3.41 million visits in total (150,000 in 2012/13). The busiest were the Gerlache Strait with 204,000 (cruised through), the Bransfield Strait 98,000, the Neumayer Channel 97,000, Paradise Harbour 93,000, Neko Harbour 92,000 and Damoy Point 91,000; 72% of visitors went to the north-west side of the Antarctic Peninsula and 18.5% to the South Shetland Islands, while the Ross Sea had 1.1%. For 2025/26, 406 sites and 2.12 million visits have been reported. The list on the left ranks sites by visitors.',
      },
      file: 'tourism-visitors.json',
    },
    {
      ...base,
      id: 'tourism-visits',
      label: { zh: '觀光船造訪的趟數', en: 'Ship visits to tourist sites' },
      description: {
        zh: '每個場址一季被觀光船造訪幾趟，拖時間軸看 2007/08 季起場址一個一個被開發出來：2007/08 季通報了 115 個場址、559 趟，2024/25 季 495 個場址、33,324 趟。最多的是內科港 1,309 趟、達莫伊角 1,169 趟、波特爾角 1,124 趟（2024/25 季）。早幾季的通報比較少，2019/20、2020/21 季受 COVID-19 影響。',
        en: 'How many times tour ships visited each site in a season; drag the time slider to watch sites open up one by one since 2007/08. In 2007/08, 115 sites and 559 visits were reported; in 2024/25, 495 sites and 33,324 visits. The busiest were Neko Harbour with 1,309 visits, Damoy Point 1,169 and Portal Point 1,124 (2024/25). Fewer parties reported in the early seasons, and 2019/20 and 2020/21 were hit by COVID-19.',
      },
      file: 'tourism-visits.json',
    },
  ] satisfies IndicatorDef[],
} satisfies Partial<TopicDefinition>;
