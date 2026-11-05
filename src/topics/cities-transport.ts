import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { DimensionDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';
import type { TopicPart } from './parts';

/**
 * 歐洲城市的通勤與市民對大眾運輸的評價（2026-11-05，製作手冊第二十三批 408；pipeline/topics/cities_transport.py）：
 * Eurostat Urban Audit 的 urb_ctran（五種運具的比例、通勤時間）與 urb_percep（同意大眾運輸便宜、安全…的比例）。
 * 城市的值畫成點，國家不上色（排名表是有資料的城市數）。
 */

const COMMUTE_FILE = 'commute.json';
const MODE_LABELS: [string, { zh: string; en: string }][] = [
  ['pt', { zh: '大眾運輸', en: 'public transport' }],
  ['car', { zh: '開車', en: 'car' }],
  ['walk', { zh: '走路', en: 'walking' }],
  ['bike', { zh: '自行車', en: 'cycling' }],
  ['moto', { zh: '機車', en: 'motorcycle' }],
];
const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個城市`, en: `${fixed(v, 0)} cities` });

function place(p: PointRecord, countryName: (iso3: string) => string): string {
  return [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, p.g === 1 ? tr({ zh: '大城市範圍', en: 'greater city' }) : null]
    .filter(Boolean)
    .join(' · ');
}

function modes(p: PointRecord): string | null {
  if (typeof p.pt !== 'number') return null;
  const parts = MODE_LABELS.filter(([k]) => typeof p[k] === 'number').map(([k, l]) => tr({ zh: `${l.zh} ${fixed(Number(p[k]), 1)}%`, en: `${l.en} ${fixed(Number(p[k]), 1)}%` }));
  return tr({ zh: `上班：${parts.join('、')}（${p.y} 年）`, en: `To work: ${parts.join(', ')} (${p.y})` });
}

function commuteTime(p: PointRecord): string | null {
  return typeof p.t === 'number'
    ? tr({ zh: `平均單程通勤 ${fixed(Number(p.t), 1)} 分鐘（${p.ty} 年）`, en: `Average one-way commute ${fixed(Number(p.t), 1)} min (${p.ty})` })
    : null;
}

const SHARE_CLASSES = (colors: string[]) => [
  { label: { zh: '不到 10%', en: 'Under 10%' }, color: colors[0] },
  { label: '10–20%', color: colors[1] },
  { label: '20–35%', color: colors[2] },
  { label: '35–50%', color: colors[3] },
  { label: { zh: '50% 以上', en: '50% or more' }, color: colors[4] },
];
const BLUES = ['#dfe9f5', '#a9c6e8', '#6a9fd6', '#2f6fb7', '#16467e'];
const ORANGES = ['#fbe6cf', '#f6c08a', '#ee9548', '#d0661c', '#8f3f0b'];
const GREENS = ['#e6efd9', '#bcd9a0', '#86bd63', '#4f9a37', '#2a6520'];

const COMMUTE_MODE: PointsOverlayDef = {
  kind: 'points',
  id: 'commute-mode',
  file: COMMUTE_FILE,
  indicators: ['commute-transit'],
  label: { zh: '搭大眾運輸上班的比例（歐洲城市）', en: 'Share commuting by public transport (European cities)' },
  radius: { field: 'pt', stops: [[0, 3], [60, 8]] },
  color: { field: 'pt', title: { zh: '搭大眾運輸上班', en: 'Public transport to work' }, thresholds: [10, 20, 35, 50], classes: SHARE_CLASSES(BLUES) },
  minValue: { field: 'pt', stops: [[0, 0]] },
  sortField: 'pt',
  tooltip: (p, { countryName }) => ({ title: String(p.n ?? ''), properNoun: String(p.n ?? ''), detail: place(p, countryName), extra: [modes(p), commuteTime(p)].filter((x): x is string => Boolean(x)) }),
};

const COMMUTE_TIME: PointsOverlayDef = {
  kind: 'points',
  id: 'commute-time',
  file: COMMUTE_FILE,
  indicators: ['commute-time'],
  label: { zh: '平均單程通勤時間（歐洲城市）', en: 'Average one-way commute time (European cities)' },
  radius: { field: 't', stops: [[15, 3], [50, 8]] },
  color: {
    field: 't',
    title: { zh: '單程通勤', en: 'One-way commute' },
    thresholds: [20, 25, 30, 35],
    classes: [
      { label: { zh: '不到 20 分鐘', en: 'Under 20 min' }, color: ORANGES[0] },
      { label: { zh: '20–25 分鐘', en: '20–25 min' }, color: ORANGES[1] },
      { label: { zh: '25–30 分鐘', en: '25–30 min' }, color: ORANGES[2] },
      { label: { zh: '30–35 分鐘', en: '30–35 min' }, color: ORANGES[3] },
      { label: { zh: '35 分鐘以上', en: '35 min or more' }, color: ORANGES[4] },
    ],
  },
  minValue: { field: 't', stops: [[0, 0]] },
  sortField: 't',
  tooltip: (p, { countryName }) => ({ title: String(p.n ?? ''), properNoun: String(p.n ?? ''), detail: place(p, countryName), extra: [commuteTime(p), modes(p)].filter((x): x is string => Boolean(x)) }),
};

export const OPINION: DimensionDef = {
  label: { zh: '題目', en: 'Question' },
  options: [
    { id: 'cheap', label: { zh: '大眾運輸便宜', en: 'Affordable' } },
    { id: 'safe', label: { zh: '大眾運輸安全', en: 'Safe' } },
    { id: 'easy', label: { zh: '容易搭到', en: 'Easy to get' } },
    { id: 'frequent', label: { zh: '班次夠密', en: 'Frequent' } },
    { id: 'reliable', label: { zh: '準時', en: 'Reliable' } },
  ],
  defaultOption: 'reliable',
};

const OPINION_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'transit-opinion',
  file: 'transit-opinion/{item}.json',
  indicators: ['transit-opinion'],
  label: { zh: '同意的市民比例（歐洲城市）', en: 'Residents who agree (European cities)' },
  radius: 5,
  color: {
    field: 'v',
    title: { zh: '同意的比例', en: 'Agree' },
    thresholds: [40, 55, 70, 85],
    classes: [
      { label: { zh: '不到 40%', en: 'Under 40%' }, color: GREENS[0] },
      { label: '40–55%', color: GREENS[1] },
      { label: '55–70%', color: GREENS[2] },
      { label: '70–85%', color: GREENS[3] },
      { label: { zh: '85% 以上', en: '85% or more' }, color: GREENS[4] },
    ],
  },
  sortField: 'v',
  tooltip: (p, { countryName }) => ({
    title: String(p.n ?? ''),
    properNoun: String(p.n ?? ''),
    detail: place(p, countryName),
    extra: [tr({ zh: `${fixed(Number(p.v), 1)}% 非常或有點同意（${p.y} 年）`, en: `${fixed(Number(p.v), 1)}% strongly or somewhat agree (${p.y})` })],
  }),
};

function cityList(label: { zh: string; en: string }, indicator: string, file: string, field: string, line: (p: PointRecord) => string | null, asc = false): ListPanelDef {
  return {
    label,
    indicators: [indicator],
    file,
    countryField: 'iso3',
    rows: (points, { countryName }) =>
      points
        .filter((p) => typeof p[field] === 'number')
        .sort((a, b) => (asc ? 1 : -1) * (Number(a[field]) - Number(b[field])))
        .map((p, i): ListRow => ({
          key: `${p.n}-${i}`,
          title: String(p.n ?? ''),
          titleProper: true,
          lines: [place(p, countryName), line(p)].filter((x): x is string => Boolean(x)),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        })),
  };
}

const NOT_TW = { zh: '台灣沒有可以比的城市統計。', en: 'Taiwan has no comparable city statistics.' };

export const cityTransportPart: TopicPart = {
  name: { zh: '歐洲城市的通勤', en: 'Commuting in European cities' },
  sources: [
    {
      name: { zh: 'Eurostat Urban Audit：城市的交通（urb_ctran）與市民的看法（urb_percep）', en: 'Eurostat Urban Audit: city transport (urb_ctran) and perception survey (urb_percep)' },
      url: 'https://ec.europa.eu/eurostat/web/cities/database',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: `Eurostat Urban Audit 的城市統計，每個城市用最近一次有資料的年份，年份差很多（運具多半是 2011、2016 年，問卷是 2023、2019 年）。五種運具（大眾運輸、開車、走路、自行車、機車）加起來不在 95–105% 的城市年不用；問卷的「同意」是非常同意加有點同意。城市的位置依名稱對 Wikidata，有些對不到的城市沒有畫；英國、科索沃照 Eurostat 的授權不收。${NOT_TW.zh}`,
    en: `City statistics from Eurostat’s Urban Audit, each city’s most recent year with data, which varies a lot (mode shares mostly 2011 or 2016; the survey 2023 or 2019). City-years whose five modes (public transport, car, walking, cycling, motorcycle) do not add up to 95–105% are left out; “agree” in the survey is strongly plus somewhat agree. Cities are placed by matching their names to Wikidata, and a few that could not be matched are not shown; the UK and Kosovo are left out under Eurostat’s licence. ${NOT_TW.en}`,
  },
  overlays: [COMMUTE_MODE, COMMUTE_TIME, OPINION_LAYER],
  listPanel: [
    cityList({ zh: '搭大眾運輸上班的比例', en: 'Share commuting by public transport' }, 'commute-transit', COMMUTE_FILE, 'pt', modes),
    cityList({ zh: '平均單程通勤時間', en: 'Average one-way commute' }, 'commute-time', COMMUTE_FILE, 't', commuteTime),
    cityList({ zh: '同意的市民比例', en: 'Residents who agree' }, 'transit-opinion', 'transit-opinion/{item}.json', 'v', (p) => tr({ zh: `${fixed(Number(p.v), 1)}% 同意（${p.y} 年）`, en: `${fixed(Number(p.v), 1)}% agree (${p.y})` })),
  ],
  indicators: [
    {
      id: 'commute-transit',
      label: { zh: '搭大眾運輸上班（歐洲城市）', en: 'Commuting by public transport (European cities)' },
      description: {
        zh: `歐洲 432 個城市搭大眾運輸上班的比例（Eurostat Urban Audit，每個城市最近一次五種運具加起來合理的年份），點的顏色是比例，滑過看開車、走路、自行車、機車的比例。布拉提斯拉瓦 86.8%（2008 年）、科希策 69.0%、蘇黎世 60.4%（2024 年）、伯恩 52.8%、赫爾辛基 52.0%（2018 年）。國家不上色，排名表是有資料的城市數。${NOT_TW.zh}`,
        en: `Share commuting to work by public transport in 432 European cities (Eurostat Urban Audit; each city’s most recent year whose five modes add up sensibly); dot colour shows the share, and hovering lists car, walking, cycling and motorcycle shares. Bratislava 86.8% (2008), Košice 69.0%, Zurich 60.4% (2024), Bern 52.8% and Helsinki 52.0% (2018). Countries are not shaded; the ranking counts cities with data. ${NOT_TW.en}`,
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'commute-transit.json',
      layer: { kind: 'none' },
      format: count,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
    {
      id: 'commute-time',
      label: { zh: '平均通勤時間（歐洲城市）', en: 'Average commute time (European cities)' },
      description: {
        zh: `歐洲 433 個城市上班的平均單程通勤時間（Eurostat Urban Audit，每個城市最近一年）。布達佩斯 71 分鐘（2001 年）最長，米什科爾奇 53 分鐘、佩奇 49 分鐘、亞眠 49 分鐘（2014 年）；保加利亞的多布里奇、哈斯科沃等 15 分鐘最短。這是單程上班的時間，跟時間運用調查一天花在交通的時間不能比。${NOT_TW.zh}`,
        en: `Average one-way commuting time in 433 European cities (Eurostat Urban Audit, each city’s most recent year). Budapest is longest at 71 minutes (2001), then Miskolc 53, Pécs 49 and Amiens 49 (2014); Bulgarian cities such as Dobrich and Haskovo are shortest at 15. This is the one-way trip to work, not comparable with daily travel time in time-use surveys. ${NOT_TW.en}`,
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'commute-time.json',
      layer: { kind: 'none' },
      format: count,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
    {
      id: 'transit-opinion',
      label: { zh: '市民覺得大眾運輸好不好（歐洲城市）', en: 'What residents think of public transport (European cities)' },
      description: {
        zh: `歐洲 96 個城市的問卷（Eurostat Urban Audit，2023 或 2019 年），同意「大眾運輸便宜」「安全」「容易搭到」「班次夠密」「準時」的市民比例（非常同意加有點同意），用上方的「題目」切換。準時：蘇黎世 94.4%、德勒斯登 91.7%、布拉格 90.8% 最高，巴勒摩 17.7%、拿坡里 19.9%、羅馬 20.2% 最低；班次夠密：日內瓦 91.5%、哥本哈根 90.0%、斯德哥爾摩 89.1%，拿坡里 19.9% 最低；便宜：塔林 89.4%（市民免費）、盧森堡 88.5%（全國免費）。這是主觀評價，各國的答題習慣不同，跨國比較要小心。${NOT_TW.zh}`,
        en: `A survey in 96 European cities (Eurostat Urban Audit, 2023 or 2019): the share of residents who agree (strongly or somewhat) that public transport is affordable, safe, easy to get, frequent or reliable; switch with “Question” above. Reliable: Zurich 94.4%, Dresden 91.7% and Prague 90.8% are highest, Palermo 17.7%, Naples 19.9% and Rome 20.2% lowest; frequent: Geneva 91.5%, Copenhagen 90.0% and Stockholm 89.1%, with Naples lowest at 19.9%; affordable: Tallinn 89.4% (free for residents) and Luxembourg 88.5% (free nationwide). These are subjective ratings, and answering habits differ between countries, so compare with care. ${NOT_TW.en}`,
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'transit-opinion-count/{item}.json',
      dimension: OPINION,
      layer: { kind: 'none' },
      format: count,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
  ],
};
