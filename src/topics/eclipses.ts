import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 日食路徑（pipeline/topics/eclipses.py，DESIGN.md 第 8 節第 88 點）：1900–2100 年每一次日全食、日環食、混合食的本影（偽本影）路徑，
 * 由 NASA 公布的貝塞爾根數（Espenak & Meeus 五千年日食典，與 NASA 路徑表那一組較新的根數）自己算。
 * 地圖上是時間軸那一年的路徑（一個半透明的帶子加中心線，依類型上色）；國家的指標是那一年有沒有經過、
 * 1900 年到那一年的日全食與日環食次數、從那一年起下一次日全食還要幾年。
 * 月食（pipeline/topics/lunar.py，第 99 點）：那一年的月全食與月偏食看得到的範圍；國家以首都計算看不看得到月全食。
 */

/** 日食的類型（paths.json 的 types、panel.json；pipeline 的 TOTAL、ANNULAR、HYBRID） */
export const KIND = { total: 1, annular: 2, hybrid: 3 } as const;

export const KIND_NAMES: Record<number, Text> = {
  [KIND.total]: { zh: '日全食', en: 'Total' },
  [KIND.annular]: { zh: '日環食', en: 'Annular' },
  [KIND.hybrid]: { zh: '混合食', en: 'Hybrid' },
};
/** tooltip 標題用的完整名稱 */
const KIND_FULL: Record<number, Text> = {
  [KIND.total]: { zh: '日全食', en: 'Total solar eclipse' },
  [KIND.annular]: { zh: '日環食', en: 'Annular solar eclipse' },
  [KIND.hybrid]: { zh: '混合食（全環食）', en: 'Hybrid solar eclipse' },
};

/**
 * 顏色（DESIGN.md 第 5 節「日食路徑的顏色」）：MAP_TOKENS.categorical 的固定位置，跟河流一樣兩種底圖各一組、同一類同一個色相：
 * 日全食紫 → 深色底圖淡紫，日環食鏽紅 → 琥珀（環食的「火環」），混合食洋紅（兩種底圖都是）。
 * 這三組是河流已經用 dataviz 驗證工具驗過的（淺色那組在彩色地形、海上，深色那組在深藍底圖上，任兩色一般視覺 ≥ 20、
 * 紅綠色盲 ≥ 10），只取其中三色。
 */
const CAT = MAP_TOKENS.categorical;
export const KIND_COLORS: Record<number, { color: string; dark: string }> = {
  [KIND.total]: { color: CAT[6], dark: CAT[1] },
  [KIND.annular]: { color: CAT[5], dark: CAT[2] },
  [KIND.hybrid]: { color: CAT[7], dark: CAT[7] },
};

export const kindName = (code: number | null) => (code !== null && KIND_NAMES[code] ? tr(KIND_NAMES[code]) : '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 年月日（YYYYMMDD）→「2027 年 8 月 2 日」「2 Aug 2027」（UTC，食甚的日期） */
export function dateText(ymd: number): string {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor(ymd / 100) % 100;
  const d = ymd % 100;
  return tr({ zh: `${y} 年 ${m} 月 ${d} 日`, en: `${d} ${MONTHS[m - 1]} ${y}` });
}

/** 秒 →「6 分 23 秒」「6m 23s」 */
export function durationText(s: number): string {
  const t = Math.round(s);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return m
    ? tr({ zh: `${m} 分 ${sec} 秒`, en: `${m}m ${String(sec).padStart(2, '0')}s` })
    : tr({ zh: `${sec} 秒`, en: `${sec}s` });
}

export const km = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/**
 * 路徑的 tooltip（要短）：日期與類型；食甚時中心線上的持續時間與在哪裡（國家或海）；路徑寬度與沙羅週期。
 * 食甚是影軸離地心最近的那一刻（NASA 目錄的定義）：全食的食甚與最長的持續時間只差 1 秒以內，
 * 環食最長的地方常在日出、日落的兩端，所以寫食甚
 */
function pathTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const k = num(p.k) ?? KIND.total;
  const d = num(p.d) ?? 0;
  const dur = num(p.D);
  const where = str(p.c) ? ctx.countryName(p.c as string) : getLang() === 'en' ? str(p.se) : str(p.sz);
  const lines: string[] = [];
  const w = num(p.w);
  const s = num(p.s);
  lines.push(
    [w !== null ? tr({ zh: `路徑寬 ${km(w)}`, en: `${km(w)} wide` }) : null, s !== null ? tr({ zh: `沙羅週期 ${s}`, en: `Saros ${s}` }) : null]
      .filter(Boolean)
      .join(' · '),
  );
  return {
    title: tr({ zh: `${dateText(d)} ${tr(KIND_FULL[k])}`, en: `${tr(KIND_FULL[k])} · ${dateText(d)}` }),
    detail:
      num(p.nc) === 1
        ? tr({ zh: '非中心食：只有影子的邊緣掠過地球，沒有中心線', en: 'Non-central: only the shadow’s edge grazes Earth, no central line' })
        : dur !== null
          ? tr({
              zh: `食甚時中心線上 ${durationText(dur)}${where ? `（${where}）` : ''}`,
              en: `${durationText(dur)} on the central line at greatest eclipse${where ? ` (${where})` : ''}`,
            })
          : undefined,
    extra: lines.filter(Boolean),
  };
}

const CLASSES = [KIND.total, KIND.annular, KIND.hybrid].map((value) => ({ value, ...KIND_COLORS[value], label: KIND_NAMES[value] }));
const COLOR = { title: { zh: '類型（帶子是路徑，中間的線是中心線）', en: 'Type (band: path; line: central line)' }, classes: CLASSES };
/** 只有中心線的圖層 */
const LINE_COLOR = { title: { zh: '中心線的類型', en: 'Central line by type' }, classes: CLASSES };

/**
 * 那一年的路徑：一次日食一條中心線（r = 1）與一個封閉的路徑環（r = 0，北界、終點、南界、起點），環畫成半透明的面。
 * 滑過或側欄點一下時，同一次日食（e）的環與中心線一起標出
 */
export const PATHS: LinesOverlayDef = {
  kind: 'lines',
  id: 'paths',
  file: 'paths.json',
  label: { zh: '日食路徑', en: 'Eclipse paths' },
  width: {
    field: 'r',
    stops: [
      [0, 0.9],
      [1, 1.7],
    ],
  },
  color: COLOR,
  fill: { field: 'r', value: 0, opacity: 0.24, darkOpacity: 0.32 },
  timeField: 'y',
  groupField: 'e',
  casing: true,
  hoverHalo: true,
  tooltip: pathTooltip,
};

/**
 * 其他年份的中心線（淡，預設關閉）：1900–2100 年全部約 300 次日食的中心線疊在一起是一張很密的網，
 * 預設打開會蓋過那一年的路徑，所以只當對照，要看再打開。minValue 只留中心線（r ≥ 1）
 */
const CONTEXT: LinesOverlayDef = {
  kind: 'lines',
  id: 'context',
  file: 'paths.json',
  label: { zh: '1900–2100 年所有的中心線（淡）', en: 'All central lines, 1900–2100 (faint)' },
  width: 0.7,
  opacity: 0.35,
  color: LINE_COLOR,
  minValue: { field: 'r', stops: [[0, 1]] },
  hidden: true,
};

/**
 * 次數的指標：1900 年到時間軸那一年的中心線（累積），說明國家的次數從哪裡來。不給 tooltip，國家才滑得到；
 * 有 groupField，側欄點一次日食時還是標得出那一條
 */
const HISTORY: Omit<LinesOverlayDef, 'id' | 'label'> = {
  kind: 'lines',
  file: 'paths.json',
  width: 0.8,
  opacity: 0.55,
  color: LINE_COLOR,
  timeField: 'y',
  groupField: 'e',
  minValue: { field: 'r', stops: [[0, 1]] },
};
/** 日全食次數：日全食與混合食（全食段也算）的中心線；日環食次數：日環食與混合食 */
export const HISTORY_TOTAL: LinesOverlayDef = {
  ...HISTORY,
  id: 'history-total',
  label: { zh: '到這一年為止的日全食中心線', en: 'Total-eclipse central lines so far' },
  onlyTypes: [KIND.total, KIND.hybrid],
};
export const HISTORY_ANNULAR: LinesOverlayDef = {
  ...HISTORY,
  id: 'history-annular',
  label: { zh: '到這一年為止的日環食中心線', en: 'Annular-eclipse central lines so far' },
  onlyTypes: [KIND.annular, KIND.hybrid],
};

const n0 = (v: number) => fixed(v, 0);

// ── 月食（pipeline/topics/lunar.py，第 99 點）──────────────────────

/** 月食的類型（lunar.json 的紀錄 k、lunar-panel.json；pipeline 的 TOTAL、PARTIAL）。半影月食不收 */
export const LUNAR = { total: 1, partial: 2 } as const;
export const LUNAR_NAMES: Record<number, Text> = {
  [LUNAR.total]: { zh: '月全食', en: 'Total lunar eclipse' },
  [LUNAR.partial]: { zh: '月偏食', en: 'Partial lunar eclipse' },
};
/** 地圖上的範圍（lunar.json 的 types；pipeline 的 ZONE_*） */
const ZONE = { totalWhole: 1, totalPart: 2, partial: 3 } as const;

/**
 * 顏色：月全食是紅銅色的月亮，整個全食都看得到的範圍用鏽紅、看得到一部分的範圍用琥珀（疊在一起，裡面那一圈比較深）；
 * 月偏食用淡紫。都是 MAP_TOKENS.categorical 裡日食已經用過的顏色（兩種底圖都驗過），深色底圖上鏽紅換成琥珀太接近，改用洋紅
 */
export const ZONE_COLORS: Record<number, { color: string; dark: string }> = {
  [ZONE.totalWhole]: { color: CAT[5], dark: CAT[7] },
  [ZONE.totalPart]: { color: CAT[2], dark: CAT[2] },
  [ZONE.partial]: { color: CAT[1], dark: CAT[1] },
};
const ZONE_NAMES: Record<number, Text> = {
  [ZONE.totalWhole]: { zh: '月全食：整個全食都看得到', en: 'Total: all of totality visible' },
  [ZONE.totalPart]: { zh: '月全食：看得到一部分', en: 'Total: part visible' },
  [ZONE.partial]: { zh: '月偏食：看得到', en: 'Partial: visible' },
};

/** 分鐘 →「1 小時 42 分」「1h 42m」 */
export function minutesText(m: number): string {
  const t = Math.round(m);
  const h = Math.floor(t / 60);
  const mm = t % 60;
  return h ? tr({ zh: `${h} 小時 ${mm} 分`, en: `${h}h ${String(mm).padStart(2, '0')}m` }) : tr({ zh: `${mm} 分鐘`, en: `${mm} min` });
}

/** 月食範圍的 tooltip：日期與類型、全食與偏食多久、食甚的世界時 */
function lunarTooltip(p: PointRecord) {
  const k = num(p.k) ?? LUNAR.total;
  const d = num(p.d) ?? 0;
  const T = num(p.T) ?? 0;
  const P = num(p.P) ?? 0;
  const h = num(p.h) ?? 0;
  const hhmm = `${String(Math.floor(h / 100)).padStart(2, '0')}:${String(h % 100).padStart(2, '0')}`;
  return {
    title: tr({ zh: `${dateText(d)} ${tr(LUNAR_NAMES[k])}`, en: `${tr(LUNAR_NAMES[k])} · ${dateText(d)}` }),
    detail:
      k === LUNAR.total
        ? tr({ zh: `全食 ${minutesText(T)}・偏食階段 ${minutesText(P)}`, en: `Totality ${minutesText(T)} · partial phases ${minutesText(P)}` })
        : tr({ zh: `偏食 ${minutesText(P)}`, en: `Partial phase ${minutesText(P)}` }),
    extra: [tr({ zh: `食甚 ${hhmm}（世界時）`, en: `Greatest eclipse ${hhmm} UTC` })],
  };
}

/**
 * 那一年的月食：每次月食一個「看得到一部分」的範圍（初虧到復圓之間月亮在地平線上的地方），月全食另外一個
 * 「整個全食都看得到」的範圍（食既與生光時月亮都在地平線上）。範圍是半透明的面，滑到邊界上看那一次月食
 */
export const LUNAR_ZONES: LinesOverlayDef = {
  kind: 'lines',
  id: 'lunar',
  file: 'lunar.json',
  label: { zh: '那一年的月食看得到的範圍', en: 'Where the year’s lunar eclipses are visible' },
  width: 1.6,
  color: {
    title: { zh: '看得到的範圍（月亮在地平線上）', en: 'Visible where the Moon is up' },
    classes: [ZONE.totalWhole, ZONE.totalPart, ZONE.partial].map((value) => ({ value, ...ZONE_COLORS[value], label: ZONE_NAMES[value] })),
  },
  // r = 0 是畫成面的環（沿 180° 經線與極點封閉，不畫外框），r = 1 是界線本身
  fill: { field: 'r', value: 0, opacity: 0.28, darkOpacity: 0.34, outline: false },
  timeField: 'y',
  groupField: 'e',
  hoverHalo: true,
  tooltip: lunarTooltip,
};

/** 首都那一年看到的月全食（lunar-year.json；pipeline 的 YEAR_*） */
const LUNAR_YEAR: Record<number, Text> = {
  0: { zh: '看不到月全食', en: 'No total lunar eclipse visible' },
  1: { zh: '看得到一部分的月全食', en: 'Part of a total eclipse visible' },
  2: { zh: '整個月全食都看得到', en: 'All of a total eclipse visible' },
};
const LUNAR_RULE = {
  zh: '以首都計算：全食（食既到生光）期間月亮在地平線上就算看得到；不修正大氣折射與月亮的視差（兩者大致抵銷），界線的誤差約 1°。不收半影月食（肉眼幾乎看不出來）',
  en: 'computed for the capital: a total eclipse counts if the Moon is above the horizon during totality; refraction and lunar parallax are not corrected (they roughly cancel), so limits are good to about 1°. Penumbral eclipses, barely visible to the eye, are not included',
};

const times = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'eclipse' : 'eclipses'}` });

/** 那一年的路徑經過（paths-year.json 的值：pipeline 的 YEAR_ANNULAR、YEAR_TOTAL、YEAR_BOTH） */
const YEAR_TEXT: Record<number, Text> = {
  0: { zh: '這一年沒有日全食或日環食經過', en: 'No total or annular eclipse this year' },
  1: { zh: '日環食經過', en: 'Annular eclipse passes' },
  2: { zh: '日全食經過', en: 'Total eclipse passes' },
  3: { zh: '日全食、日環食都經過', en: 'Total and annular eclipses pass' },
};

const RULE = {
  zh: '路徑經過國家的陸地才算（NASA 的貝塞爾根數自己算出路徑的範圍，每約 2 公里取一點，用 Natural Earth 1:10m 的國界判斷）；混合食在全食的那一段算日全食、環食的那一段算日環食',
  en: 'a path counts when it crosses the country’s land (paths computed from NASA’s Besselian elements, sampled about every 2 km against Natural Earth 1:10m borders); hybrid eclipses count as total where they are total and as annular where they are annular',
};

const THROUGH = {
  label: { zh: '累計到', en: 'Through' },
  year: (y: number) => tr({ zh: `1900–${y} 年`, en: `1900–${y}` }),
};

const indicators: IndicatorDef[] = [
  {
    id: 'paths',
    label: { zh: '日食路徑', en: 'Eclipse paths' },
    description: {
      zh: '時間軸那一年的日全食、日環食與混合食：帶子是月球的本影（環食是偽本影）掃過的範圍，在帶子裡才看得到全食或環食，帶子外面只看得到偏食；中間的線是中心線。紫色是日全食、鏽紅是日環食、洋紅是混合食。滑到路徑上看日期、食甚的持續時間與位置、路徑寬度與沙羅週期；點國家看 1900–2100 年經過它的每一次日食。',
      en: 'The year’s total, annular and hybrid solar eclipses: each band is the ground track of the Moon’s umbra (antumbra for annular eclipses), where the eclipse is total or annular; outside it only a partial eclipse is seen. The line in the middle is the central line. Purple is total, rust is annular, magenta is hybrid. Hover over a path for its date, duration and place of greatest eclipse, path width and Saros series; select a country for every eclipse crossing it from 1900 to 2100.',
    },
    unit: '',
    file: 'paths-year.json',
    layer: { kind: 'none' },
    overlayTime: 'year',
    format: (v) => tr(YEAR_TEXT[v] ?? YEAR_TEXT[0]),
    unranked: true,
    rankingBars: false,
    // 值是類型的代碼，畫成折線沒有意義；側欄的日食清單已經列出每一次
    panelChart: false,
  },
  {
    id: 'total-count',
    label: { zh: '日全食次數', en: 'Total eclipses' },
    description: {
      zh: `1900 年到時間軸那一年，日全食的路徑經過幾次（${RULE.zh}）。拖到 2100 年是整個 1900–2100 年的次數；地圖上的線是到那一年為止所有的中心線。`,
      en: `How many total-eclipse paths crossed the country from 1900 to the year on the time slider (${RULE.en}). Drag to 2100 for the whole 1900–2100 count; the lines are every central line up to that year.`,
    },
    unit: { zh: '次', en: 'eclipses' },
    file: 'total-count.json',
    layer: { kind: 'bubble', legendValues: [5, 15, 30] },
    overlayTime: 'cumulative',
    timeAxis: THROUGH,
    defaultYear: 2100,
    integer: true,
    format: times,
    formatTick: n0,
  },
  {
    id: 'annular-count',
    label: { zh: '日環食次數', en: 'Annular eclipses' },
    description: {
      zh: `1900 年到時間軸那一年，日環食的路徑經過幾次（${RULE.zh}）。拖到 2100 年是整個 1900–2100 年的次數。`,
      en: `How many annular-eclipse paths crossed the country from 1900 to the year on the time slider (${RULE.en}). Drag to 2100 for the whole 1900–2100 count.`,
    },
    unit: { zh: '次', en: 'eclipses' },
    file: 'annular-count.json',
    layer: { kind: 'bubble', legendValues: [5, 15, 30] },
    overlayTime: 'cumulative',
    timeAxis: THROUGH,
    defaultYear: 2100,
    integer: true,
    format: times,
    formatTick: n0,
  },
  {
    id: 'next-total',
    label: { zh: '下一次日全食', en: 'Next total eclipse' },
    description: {
      zh: `從時間軸那一年（含）起，日全食的路徑下一次經過是哪一年，顏色是還要等幾年（${RULE.zh}）。預設的 2027 年就等於「今天以後的下一次」（2026 年 8 月 12 日之後，下一次日全食是 2027 年 8 月 2 日）；灰色的國家到 2100 年都沒有。`,
      en: `The next year a total-eclipse path crosses the country, counting from the year on the time slider (inclusive); the colour is how many years away it is (${RULE.en}). The default year, 2027, gives the next one after today (after 12 August 2026 the next total eclipse is on 2 August 2027). Grey countries have none through 2100.`,
    },
    unit: { zh: '年後', en: 'years away' },
    file: 'next-total.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 70] } },
    overlayTime: 'year',
    format: (v, year) =>
      year === undefined
        ? tr({ zh: `${n0(v)} 年後`, en: `in ${n0(v)} years` })
        : v === 0
          ? tr({ zh: `${year}（就是這一年）`, en: `${year} (this year)` })
          : tr({ zh: `${year + v}（${n0(v)} 年後）`, en: `${year + v} (in ${n0(v)} years)` }),
    formatTick: (v) => tr({ zh: `${n0(v)} 年`, en: `${n0(v)} y` }),
    missing: { zh: '到 2100 年都沒有日全食經過', en: 'No total eclipse through 2100' },
    unranked: true,
    lowerIsBetter: true,
  },
  {
    id: 'lunar-year',
    label: { zh: '那一年的月全食', en: 'Total lunar eclipses' },
    description: {
      zh: `時間軸那一年的月全食與月偏食在哪裡看得到：月食時看得到的地方同時看到同一個階段，只要月亮在地平線上就看得到。鏽紅的範圍整個全食都看得到，琥珀色的看得到一部分，淡紫是月偏食；滑到國家上看首都看不看得到那一年的月全食（${LUNAR_RULE.zh}）。點國家看 1900–2100 年首都看得到的每一次月食與當地時間。`,
      en: `Where the year’s total and partial lunar eclipses can be seen: everyone who can see the Moon sees the same stage at the same moment, so it is visible wherever the Moon is above the horizon. The rust area sees all of totality and the amber area part of it, with partial eclipses in lilac; hover over a country to see whether its capital sees that year’s total eclipse (${LUNAR_RULE.en}). Select a country for every eclipse visible from its capital from 1900 to 2100, in local time.`,
    },
    unit: '',
    file: 'lunar-year.json',
    // 國家不上色：地圖上的範圍已經畫出哪裡看得到（國家的顏色只是首都落在哪一圈，疊上去反而看不清楚範圍），
    // 首都看不看得到寫在 tooltip 與排名表
    layer: { kind: 'none' },
    overlayTime: 'year',
    defaultYear: 2028,
    format: (v) => tr(LUNAR_YEAR[v] ?? LUNAR_YEAR[0]),
    unranked: true,
    rankingBars: false,
    panelChart: false,
  },
  {
    id: 'lunar-count',
    label: { zh: '月全食次數', en: 'Total lunar eclipses seen' },
    description: {
      zh: `1900 年到時間軸那一年，首都看得到幾次月全食（至少看得到一部分的全食；${LUNAR_RULE.zh}）。拖到 2100 年是整個 1900–2100 年的次數：全世界每個地方都差不多，約 80–100 次。`,
      en: `How many total lunar eclipses the capital could see (at least part of totality) from 1900 to the year on the time slider (${LUNAR_RULE.en}). Drag to 2100 for the whole 1900–2100 count: every place sees about 80–100.`,
    },
    unit: { zh: '次', en: 'eclipses' },
    file: 'lunar-count.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 55, 70, 85] } },
    timeAxis: THROUGH,
    defaultYear: 2100,
    integer: true,
    format: times,
    formatTick: n0,
  },
  {
    id: 'next-lunar',
    label: { zh: '下一次月全食', en: 'Next total lunar eclipse' },
    description: {
      zh: `從時間軸那一年（含）起，首都下一次看得到月全食是哪一年，顏色是還要等幾年（${LUNAR_RULE.zh}）。預設的 2027 年就等於「今天以後的下一次」（2026 年 8 月 28 日的月偏食之後，下一次月全食是 2028 年 12 月 31 日）。`,
      en: `The next year the capital can see a total lunar eclipse, counting from the year on the time slider (inclusive); the colour is how many years away it is (${LUNAR_RULE.en}). The default year, 2027, gives the next one after today (after the partial eclipse of 28 August 2026, the next total lunar eclipse is on 31 December 2028).`,
    },
    unit: { zh: '年後', en: 'years away' },
    file: 'next-lunar.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 6] } },
    overlayTime: 'year',
    format: (v, year) =>
      year === undefined
        ? tr({ zh: `${n0(v)} 年後`, en: `in ${n0(v)} years` })
        : v === 0
          ? tr({ zh: `${year}（就是這一年）`, en: `${year} (this year)` })
          : tr({ zh: `${year + v}（${n0(v)} 年後）`, en: `${year + v} (in ${n0(v)} years)` }),
    formatTick: (v) => tr({ zh: `${n0(v)} 年`, en: `${n0(v)} y` }),
    missing: { zh: '到 2100 年都看不到月全食', en: 'No total lunar eclipse visible through 2100' },
    unranked: true,
    lowerIsBetter: true,
    // 每 1–3 年就有一次，逐年畫成折線只是一排鋸齒；側欄的月食清單已經列出每一次
    panelChart: false,
  },
];

/** 今天（YYYYMMDD，世界時）：清單從這天起算「下一次」 */
const todayYmd = () => {
  const now = new Date();
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
};
const TW_SOLAR: Record<number, Text> = {
  1: { zh: '台灣看得到：日環食經過', en: 'Seen in Taiwan: annular path crosses' },
  2: { zh: '台灣看得到：日全食經過', en: 'Seen in Taiwan: total path crosses' },
  3: { zh: '台灣看得到：全食與環食經過', en: 'Seen in Taiwan: total and annular paths cross' },
};
const NEXT: Text = { zh: '下一次', en: 'Next' };

/**
 * 左邊的清單（第十二批 189，L1）：1900–2100 年的日食（eclipse-list.json，pipeline/topics/eclipse_lists.py），依日期；
 * 過去的淡一點，第一個還沒發生的標「下一次」並捲到它；點了框住整條路徑、標出那一條、時間軸換到那一年
 */
const SOLAR_LIST: ListPanelDef = {
  label: { zh: '日全食與日環食', en: 'Total and annular eclipses' },
  indicators: ['paths', 'next-total'],
  file: 'eclipse-list.json',
  rows: (points, { countryName }) => {
    const today = todayYmd();
    let next = false;
    return [...points]
      .sort((a, b) => Number(a.d) - Number(b.d))
      .map((p): ListRow => {
        const d = Number(p.d);
        const k = num(p.k) ?? KIND.total;
        const past = d < today;
        const isNext = !past && !next;
        if (isNext) next = true;
        const dur = num(p.D);
        const countries = str(p.c)
          ?.split(',')
          .map((c) => countryName(c))
          .join(tr({ zh: '、', en: ', ' }));
        const tw = num(p.tw) ?? 0;
        return {
          key: `s${p.e}`,
          title: tr({ zh: `${dateText(d)} ${tr(KIND_NAMES[k])}`, en: `${dateText(d)} · ${tr(KIND_NAMES[k])}` }),
          lines: [
            [dur !== null ? tr({ zh: `最長 ${durationText(dur)}`, en: `up to ${durationText(dur)}` }) : null, num(p.w) !== null ? tr({ zh: `路徑寬 ${km(num(p.w) as number)}`, en: `${km(num(p.w) as number)} wide` }) : null]
              .filter(Boolean)
              .join(' · '),
            countries ? tr({ zh: `經過：${countries}`, en: `Crosses: ${countries}` }) : tr({ zh: '只經過海上或南極', en: 'Over sea or Antarctica only' }),
            tw ? tr(TW_SOLAR[tw]) : '',
          ].filter(Boolean),
          muted: past,
          badge: isNext ? tr(NEXT) : undefined,
          target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
          line: { overlay: 'paths', group: Number(p.e) },
          year: Math.floor(d / 10000),
        };
      });
  },
};

/** 月全食的清單（lunar-list.json）：點了移到月亮在天頂的點（看得到的那一半地球的中心）、標出那一次的範圍 */
const LUNAR_LIST: ListPanelDef = {
  label: { zh: '月全食', en: 'Total lunar eclipses' },
  indicators: ['lunar-year', 'next-lunar'],
  file: 'lunar-list.json',
  rows: (points) => {
    const today = todayYmd();
    let next = false;
    return [...points]
      .sort((a, b) => Number(a.d) - Number(b.d))
      .map((p): ListRow => {
        const d = Number(p.d);
        const past = d < today;
        const isNext = !past && !next;
        if (isNext) next = true;
        const tw = num(p.tw) ?? 0;
        return {
          key: `l${p.e}`,
          title: tr({ zh: `${dateText(d)} 月全食`, en: `${dateText(d)} · Total lunar eclipse` }),
          lines: [
            tr({ zh: `全食 ${minutesText(Number(p.T))}，偏食 ${minutesText(Number(p.P))}`, en: `Totality ${minutesText(Number(p.T))}, partial phase ${minutesText(Number(p.P))}` }),
            tw === 3
              ? tr({ zh: '台北看得到整個全食', en: 'All of totality visible from Taipei' })
              : tw === 2
                ? tr({ zh: '台北看得到一部分的全食', en: 'Part of totality visible from Taipei' })
                : '',
          ].filter(Boolean),
          muted: past,
          badge: isNext ? tr(NEXT) : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 1.5 },
          line: { overlay: 'lunar', group: Number(p.e) },
          year: Math.floor(d / 10000),
        };
      });
  },
};

export const eclipses: TopicDefinition = {
  id: 'eclipses',
  // 2026-10-28 加上月食後改名（原本是「日食路徑」，id 與網址不變）
  title: { zh: '日食與月食', en: 'Solar and lunar eclipses' },
  shortTitle: { zh: '日食與月食', en: 'Eclipses' },
  defaultIndicator: 'paths',
  defaultYear: 2027,
  sources: [
    {
      name: {
        zh: 'NASA 五千年日食目錄與貝塞爾根數（Espenak & Meeus, NASA TP-2006-214141）、NASA 日食路徑表；Eclipse Predictions by Fred Espenak, NASA’s GSFC',
        en: 'NASA Five Millennium Catalog of Solar Eclipses and Besselian elements (Espenak & Meeus, NASA TP-2006-214141), NASA eclipse path tables; Eclipse Predictions by Fred Espenak, NASA’s GSFC',
      },
      url: 'https://eclipse.gsfc.nasa.gov/solar.html',
      license: { zh: '公有領域（NASA）', en: 'public domain (NASA)' },
    },
    {
      name: {
        zh: 'NASA 五千年月食目錄（Espenak & Meeus, NASA TP-2009-214172、214173）；Eclipse Predictions by Fred Espenak and Jean Meeus (NASA’s GSFC)',
        en: 'NASA Five Millennium Catalog of Lunar Eclipses (Espenak & Meeus, NASA TP-2009-214172, 214173); Eclipse Predictions by Fred Espenak and Jean Meeus (NASA’s GSFC)',
      },
      url: 'https://eclipse.gsfc.nasa.gov/lunar.html',
      license: { zh: '公有領域（NASA）', en: 'public domain (NASA)' },
    },
  ],
  note: {
    zh: 'Eclipse Predictions by Fred Espenak, NASA’s GSFC（NASA 日食網站要求的標示；五千年日食目錄另寫 Fred Espenak and Jean Meeus）。路徑是用 NASA 公布的貝塞爾根數自己算的：每 2 秒取一條垂直於影子運動方向的橫切線，找出落在本影裡的範圍，連成北界、南界與中心線，地球用 WGS 84 橢球；NASA 有路徑表的日食（299 次裡的 152 次）用路徑表那一組較新的根數，其餘用五千年日食典的根數。跟 NASA 的路徑表比，同一組根數時界線與中心線相差 0.15 公里以內，用五千年日食典的根數時約 0.2–0.9 公里（星曆與 ΔT 不同）。月球邊緣的山谷會讓界線有 1–2 公里的誤差；未來的日食還受地球自轉變化（ΔT，NASA 用外推的值）的影響，越後面越不確定。一個國家只算路徑經過陸地的；海上的島太小（2 公里以下）可能漏掉。日期是食甚的世界時（UTC）日期。月食：Eclipse Predictions by Fred Espenak and Jean Meeus (NASA’s GSFC)（五千年月食目錄，只收月全食與月偏食，不收半影月食）。看得到的範圍是月亮在地平線上的地方：目錄的食甚時刻、各階段的持續時間（各接觸的時刻從食甚往前後各推一半）與食甚時月亮在天頂的位置（整數度），月亮天頂點的經度每小時往西移約 14.5°；不修正大氣折射與月亮的視差（大致抵銷），界線的誤差約 1°。國家以首都計算。',
    en: 'Eclipse Predictions by Fred Espenak, NASA’s GSFC (the credit NASA’s eclipse website asks for; the Five Millennium Catalog adds Jean Meeus). Paths are computed here from NASA’s Besselian elements: every 2 seconds a cross-section perpendicular to the shadow’s motion is cut through the umbra and its ends joined into the northern and southern limits, with the central line in the middle, on the WGS 84 ellipsoid. Eclipses that have a NASA path table (152 of the 299) use that table’s newer elements, the rest the Five Millennium Canon’s. Against NASA’s path tables the limits and central line agree within 0.15 km with the same elements, and within about 0.2–0.9 km with the Canon’s (different ephemerides and ΔT). The lunar limb profile shifts the limits by 1–2 km, and future paths depend on Earth’s rotation (ΔT, which NASA extrapolates), so they grow less certain towards 2100. A country counts only when a path crosses its land; islands smaller than about 2 km may be missed. Dates are the UTC date of greatest eclipse. Lunar eclipses: Eclipse Predictions by Fred Espenak and Jean Meeus (NASA’s GSFC) (Five Millennium Catalog of Lunar Eclipses; total and partial eclipses only, penumbral eclipses are not included). The visible area is wherever the Moon is above the horizon, from the catalogue’s time of greatest eclipse, phase durations (contacts placed half a duration either side of greatest eclipse) and the Moon’s zenith position at greatest eclipse (whole degrees), with the sub-lunar point moving west about 14.5° an hour; refraction and lunar parallax are not corrected (they roughly cancel), so limits are good to about 1°. Countries are computed for their capitals.',
  },
  panelExtra: () => import('./panels/EclipsesPanel'),
  overlays: [
    { ...CONTEXT, indicators: ['paths', 'next-total'] },
    { ...PATHS, indicators: ['paths', 'next-total'] },
    { ...HISTORY_TOTAL, indicators: ['total-count'] },
    { ...HISTORY_ANNULAR, indicators: ['annular-count'] },
    { ...LUNAR_ZONES, indicators: ['lunar-year', 'next-lunar'] },
  ],
  listPanel: [SOLAR_LIST, LUNAR_LIST],
  indicators,
};
