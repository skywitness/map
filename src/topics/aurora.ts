import { tr, type Text } from '../i18n/lang';
import type { ClockAt, IndicatorData, IndicatorDef, LiveGridOverlayDef, PointerInfo, TopicDefinition } from './types';

/**
 * 此刻的極光（pipeline/topics/aurora.py，DESIGN.md 第 8 節第 102 點）：NOAA SWPC 的 OVATION 極光預報
 * 在瀏覽器裡即時讀（TopicDefinition.live，每 5 分鐘重讀），地圖是看得到極光的機率（即時網格，liveGridLayer.ts）
 * 加上晝夜（極光只在夜裡看得到）；國家的值是國土上空、首都上空的機率，用 pipeline 的 cells.json（各國碰到哪些格點）在瀏覽器裡算。
 * 只有「現在」：NOAA 不提供歷史，不能選別的時刻。
 */

const OVATION_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
/** 重讀的間隔（分鐘）：OVATION 約每 5 分鐘更新 */
const REFRESH_MINUTES = 5;

/** NOAA SWPC 的 OVATION 預報（ovation_aurora_latest.json） */
export interface Ovation {
  'Observation Time': string;
  'Forecast Time': string;
  /** [經度 0–359°E, 緯度 −90–90°, 機率 %]，依經度、再依緯度排列 */
  coordinates: [number, number, number][];
}

/** pipeline 的 cells.json */
export interface CellsFile {
  /** 只算南、北緯 minLat 以外 */
  minLat: number;
  /** 各國碰到的 OVATION 格點編號（差分編碼） */
  countries: Record<string, number[]>;
  /** 首都最近的格點編號 */
  capitals: Record<string, number>;
}

const NLAT = 181;
/** OVATION 的格點編號 → [經度 −180–180, 緯度] */
export function cellLonLat(index: number): [number, number] {
  const lon = Math.floor(index / NLAT);
  return [lon > 180 ? lon - 360 : lon, (index % NLAT) - 90];
}

/** 經緯度 → 最近的 OVATION 格點編號 */
function cellAt(lon: number, lat: number): number {
  const x = ((Math.round(lon) % 360) + 360) % 360;
  const y = Math.max(-90, Math.min(90, Math.round(lat)));
  return x * NLAT + (y + 90);
}

const isOvation = (v: unknown): v is Ovation => Boolean(v && typeof v === 'object' && Array.isArray((v as Ovation).coordinates));

/** OVATION 的機率依格點編號排好（同一份資料只排一次） */
const probCache = new WeakMap<object, Float32Array>();
export function probabilities(live: unknown): Float32Array | null {
  if (!isOvation(live)) return null;
  let out = probCache.get(live);
  if (!out) {
    out = new Float32Array(360 * NLAT);
    for (const [lon, lat, v] of live.coordinates) out[cellAt(lon, lat)] = v;
    probCache.set(live, out);
  }
  return out;
}

/** 預報的時刻（UTC 毫秒） */
export function forecastTime(live: unknown): number | null {
  if (!isOvation(live)) return null;
  const t = Date.parse(live['Forecast Time']);
  return Number.isFinite(t) ? t : null;
}

export function observationTime(live: unknown): number | null {
  if (!isOvation(live)) return null;
  const t = Date.parse(live['Observation Time']);
  return Number.isFinite(t) ? t : null;
}

/** 各國碰到的格點（還原差分編碼，同一份檔只還原一次） */
const cellsCache = new WeakMap<object, Map<string, number[]>>();
export function countryCells(file: CellsFile, iso3: string): number[] {
  let byCountry = cellsCache.get(file);
  if (!byCountry) cellsCache.set(file, (byCountry = new Map()));
  let cells = byCountry.get(iso3);
  if (!cells) {
    let acc = 0;
    cells = (file.countries[iso3] ?? []).map((d) => (acc += d));
    byCountry.set(iso3, cells);
  }
  return cells;
}

/** 國土上空機率最高的格點：[機率, 格點編號]；國土都在南、北緯 minLat 以內的是 null */
export function countryPeak(file: CellsFile, prob: Float32Array, iso3: string): [number, number] | null {
  const cells = countryCells(file, iso3);
  if (!cells.length) return null;
  let best = cells[0];
  for (const c of cells) if (prob[c] > prob[best]) best = c;
  return [prob[best], best];
}

/**
 * 最近一次讀到的預報：游標的 tooltip（pointer）拿不到即時資料，用這一份（App 每次讀到新的預報都會經過下面的 derive）
 */
let latest: Ovation | null = null;
export const latestOvation = () => latest;

function derived(source: unknown, at: ClockAt, live: unknown, value: (file: CellsFile, prob: Float32Array, iso3: string) => number): IndicatorData {
  const file = source as CellsFile;
  const prob = probabilities(live);
  if (isOvation(live)) latest = live;
  const values: Record<string, (number | null)[]> = {};
  if (prob && file?.capitals) {
    const codes = new Set([...Object.keys(file.capitals), ...Object.keys(file.countries)]);
    for (const iso3 of codes) values[iso3] = [value(file, prob, iso3)];
  }
  return { indicator: '', unit: '%', years: [at.day], values };
}

const peakValue = (file: CellsFile, prob: Float32Array, iso3: string) => countryPeak(file, prob, iso3)?.[0] ?? 0;
const capitalValue = (file: CellsFile, prob: Float32Array, iso3: string) => {
  const c = file.capitals[iso3];
  return c === undefined ? 0 : prob[c];
};

/* ── 格式 ──────────────────────────── */

const percent = (v: number) => `${Math.round(v)}%`;
const PERCENT: Text = { zh: '%', en: '%' };

/** 「北緯 64°、西經 150°」 */
export function placeText(lon: number, lat: number): string {
  const ns = lat >= 0 ? tr({ zh: `北緯 ${lat}°`, en: `${lat}°N` }) : tr({ zh: `南緯 ${-lat}°`, en: `${-lat}°S` });
  const ew = lon >= 0 ? tr({ zh: `東經 ${lon}°`, en: `${lon}°E` }) : tr({ zh: `西經 ${-lon}°`, en: `${-lon}°W` });
  return tr({ zh: `${ns}、${ew}`, en: `${ns}, ${ew}` });
}

const SCALE = { type: 'sequential' as const, thresholds: [1, 5, 10, 20, 30, 50] };

const ABOUT: Text = {
  zh: '機率是 NOAA 的 OVATION 模型預報的那一點上空看得到極光的機率（約 30–90 分鐘後），天氣晴朗、遠離光害、天色夠暗才看得到；極光很強時，離橢圓帶幾百公里外的地平線上也可能看得到。',
  en: 'The probability is NOAA’s OVATION forecast of seeing the aurora overhead at that point, about 30–90 minutes ahead; you also need clear, dark skies away from city lights. In strong displays the aurora can be seen low on the horizon a few hundred kilometres from the oval.',
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '極光預報地圖', en: 'Aurora forecast' },
    description: {
      zh: `現在哪裡看得到極光：綠色越濃，那裡上空看得到極光的機率越高，通常是繞著南北磁極的一圈（極光橢圓帶），磁暴時往低緯度擴大。地圖同時畫出此刻的晝夜，極光只在夜裡看得到。${ABOUT.zh}滑到地圖上任一點看那裡的機率，滑到國家看國土上空最高的機率。`,
      en: `Where the aurora can be seen right now: the deeper the green, the higher the chance of seeing it overhead, usually in a ring around each magnetic pole (the auroral oval) that spreads towards the equator during geomagnetic storms. The map also shows where it is night now, since the aurora is only visible in the dark. ${ABOUT.en} Hover anywhere for the probability there, or over a country for the highest probability over it.`,
    },
    unit: PERCENT,
    file: 'cells.json',
    layer: { kind: 'none' },
    format: percent,
    formatTick: percent,
    unranked: true,
    rankingBars: false,
    derive: { per: 'minute', values: (source, at, live) => derived(source, at, live, peakValue) },
  },
  {
    id: 'country',
    label: { zh: '國土上空的機率', en: 'Over the country' },
    description: {
      zh: `國土上空此刻看得到極光的最高機率（國土碰到的經緯度 1° 格點中最高的）：加拿大、俄羅斯、北歐、阿拉斯加（美國）、格陵蘭最常有，南半球是南極洲與紐西蘭、澳洲的塔斯馬尼亞。國土都在南、北緯 35° 以內的國家（包括台灣）看不到。${ABOUT.zh}`,
      en: `The highest probability of seeing the aurora overhead anywhere over the country right now (the highest of the 1° grid points it touches): most often Canada, Russia, the Nordic countries, Alaska (US) and Greenland, and in the south Antarctica, New Zealand and Tasmania. Countries lying entirely within 35° of the equator, including Taiwan, never see it. ${ABOUT.en}`,
    },
    unit: PERCENT,
    file: 'cells.json',
    layer: { kind: 'choropleth', scale: SCALE },
    format: percent,
    formatTick: percent,
    derive: { per: 'minute', values: (source, at, live) => derived(source, at, live, peakValue) },
  },
  {
    id: 'capital',
    label: { zh: '首都上空的機率', en: 'Over the capital' },
    description: {
      zh: `首都上空此刻看得到極光的機率（首都最近的經緯度 1° 格點）：平常只有雷克雅維克、努克等高緯度的首都有，磁暴時奧斯陸、斯德哥爾摩、赫爾辛基、塔林、渥太華也可能有。首都用國家小檔案的 Wikidata 首都。${ABOUT.zh}`,
      en: `The probability of seeing the aurora overhead at the capital right now (the 1° grid point nearest to it): usually only high-latitude capitals such as Reykjavík and Nuuk, and during storms also Oslo, Stockholm, Helsinki, Tallinn and Ottawa. Capitals are from Wikidata, as in Country facts. ${ABOUT.en}`,
    },
    unit: PERCENT,
    file: 'cells.json',
    layer: { kind: 'choropleth', scale: SCALE },
    format: percent,
    formatTick: percent,
    derive: { per: 'minute', values: (source, at, live) => derived(source, at, live, capitalValue) },
  },
];

/* ── tooltip ──────────────────────────── */

const LOW_LATITUDE: Text = {
  zh: '國土都在南、北緯 35° 以內，看不到極光',
  en: 'Lies entirely within 35° of the equator: no aurora',
};

function tooltipLines(iso3: string, ctx: { indicator: string; source: unknown }): string[] {
  const file = ctx.source as CellsFile | null;
  const prob = probabilities(latest);
  if (!file?.countries || !prob) return [];
  const peak = countryPeak(file, prob, iso3);
  if (!peak) return [tr(LOW_LATITUDE)];
  const [lon, lat] = cellLonLat(peak[1]);
  const lines: string[] = [];
  if (ctx.indicator !== 'capital' && peak[0] > 0) {
    lines.push(tr({ zh: `最高在${placeText(lon, lat)}`, en: `Highest at ${placeText(lon, lat)}` }));
  }
  if (ctx.indicator !== 'capital') {
    const c = file.capitals[iso3];
    if (c !== undefined) lines.push(tr({ zh: `首都上空 ${percent(prob[c])}`, en: `Over the capital: ${percent(prob[c])}` }));
  } else {
    lines.push(tr({ zh: `國土上空最高 ${percent(peak[0])}`, en: `Highest over the country: ${percent(peak[0])}` }));
  }
  return lines;
}

/** 滑到地圖上任一點（含海上）：那一點上空的機率 */
function pointer(lngLat: [number, number], ctx: { iso3: string | null }): PointerInfo | null {
  const prob = probabilities(latest);
  if (!prob) return null;
  const v = prob[cellAt(lngLat[0], lngLat[1])];
  const lat = Math.round(lngLat[1]);
  const lon = Math.round(((((lngLat[0] + 180) % 360) + 360) % 360) - 180);
  const line = tr({ zh: `這裡上空看得到極光的機率 ${percent(v)}`, en: `Chance of aurora overhead here: ${percent(v)}` });
  return ctx.iso3 ? { lines: [line] } : { title: placeText(lon, lat), lines: [line] };
}

/* ── 地圖：看得到極光的機率 ─────────── */

/** OVATION（依經度排）→ 即時網格（依緯度、再依經度 −180–180 排，LiveGridOverlayDef.values） */
function gridValues(live: unknown): Float32Array | null {
  const prob = probabilities(live);
  if (!prob) return null;
  const out = new Float32Array(181 * 361);
  for (let r = 0; r < 181; r++) {
    for (let c = 0; c < 361; c++) out[r * 361 + c] = prob[(((c - 180 + 360) % 360) * NLAT) + r];
  }
  return out;
}

const AURORA: LiveGridOverlayDef = {
  kind: 'liveGrid',
  id: 'aurora',
  label: { zh: '極光預報', en: 'Aurora forecast' },
  values: gridValues,
  // 極光的綠：淺色底圖用深一點的綠（米白的陸地上看得清楚），深藍底圖用亮綠
  color: { light: '#0f8a4a', dark: '#4ee28a' },
  // 平常最高約 15–20%，磁暴時 50% 以上：低的一段就要看得清楚
  opacity: [
    [3, 0],
    [8, 0.45],
    [20, 0.75],
    [50, 0.95],
  ],
  legend: {
    title: { zh: '看得到極光的機率', en: 'Chance of seeing the aurora' },
    rows: [
      { value: 8, label: '8%' },
      { value: 20, label: '20%' },
      { value: 50, label: { zh: '50% 以上', en: '50% or more' } },
    ],
  },
  // 國家上色的指標不疊綠色（跟面量圖的顏色混在一起看不清楚）
  indicators: ['map'],
};

export const aurora: TopicDefinition = {
  id: 'aurora',
  title: { zh: '此刻的極光', en: 'Aurora right now' },
  shortTitle: { zh: '極光', en: 'Aurora' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  live: { url: OVATION_URL, minutes: REFRESH_MINUTES, time: forecastTime },
  sources: [
    {
      name: { zh: 'NOAA 太空天氣預報中心（SWPC）OVATION 極光預報、行星 K 指數', en: 'NOAA Space Weather Prediction Center (SWPC): OVATION aurora forecast, planetary K-index' },
      url: 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
    {
      name: { zh: '國界：Natural Earth 1:10m', en: 'Borders: Natural Earth 1:10m' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: '首都：Wikidata（國家小檔案）', en: 'Capitals: Wikidata (Country facts)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: '極光預報由你的瀏覽器直接向 NOAA 太空天氣預報中心讀取（OVATION Prime 模型，依太陽風的即時觀測預報約 30–90 分鐘後的極光，NOAA 約每 5 分鐘更新，這一頁每 5 分鐘重讀）；讀不到時這個主題沒有資料。NOAA 不提供歷史，所以只有「現在」，不能選別的時刻。地圖的格點是經緯度每 1°，國家的值是國土碰到的格點中最高的（Natural Earth 1:10m 的國界，只算南、北緯 35° 以外）與首都最近的格點；平面地圖只畫到南北緯 85°。機率是上空看得到極光的機率，不考慮雲、光害與月光。台灣在北緯 22–25°，即使是 2024 年 5 月那樣的大磁暴也看不到極光。側欄的 Kp 指數也是 NOAA 的即時資料。',
    en: 'The aurora forecast is read directly from the NOAA Space Weather Prediction Center by your browser (the OVATION Prime model, which forecasts the aurora about 30–90 minutes ahead from live solar-wind measurements; NOAA updates it about every 5 minutes and this page re-reads it every 5 minutes). If it cannot be reached, this topic has no data. NOAA keeps no history, so there is only “now”, with no other times to choose. The map grid is every 1° of latitude and longitude; country values are the highest grid point the country touches (Natural Earth 1:10m borders, counting only beyond 35° north or south) and the grid point nearest the capital. The flat map stops at 85°. The probability is for seeing the aurora overhead and ignores cloud, light pollution and moonlight. Taiwan, at 22–25°N, cannot see the aurora even in a storm as strong as May 2024’s. The Kp index in the side panel is also live NOAA data.',
  },
  panelExtra: () => import('./panels/AuroraPanel'),
  tooltipLines,
  pointer,
  overlays: [
    {
      kind: 'night',
      id: 'night',
      label: { zh: '晝夜', en: 'Day and night' },
      sunLabel: { zh: '太陽直射點', en: 'Subsolar point (sun overhead)' },
    },
    AURORA,
  ],
  indicators,
};
