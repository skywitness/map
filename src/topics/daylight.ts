import { getLang, tr, type Text } from '../i18n/lang';
import { formatDay, dayParts } from '../lib/clock';
import { fixed } from '../lib/format';
import {
  clockTime,
  hoursMinutes,
  offsetText,
  skyPhase,
  solarElevation,
  sunDay,
  zoneOffset,
  type SkyPhase,
  type SunDay,
} from '../lib/solar';
import { moonAltitude, moonPhase, moonRiseSet, sublunarPoint, type MoonPhaseName } from '../lib/moon';
import { MAP_TOKENS } from '../theme/tokens';
import type { ClockAt, IndicatorData, IndicatorDef, LinesOverlayDef, MoonOverlayDef, PointRecord, TopicDefinition } from './types';

/**
 * 晝夜與季節（pipeline/topics/daylight.py，DESIGN.md 第 8 節第 87 點）：地圖是選定那一刻的晝夜界線
 * （nightLayer.ts，夜半邊、三種曙暮光、太陽直射點）與赤道、回歸線、極圈；國家的指標以首都計算，
 * 在瀏覽器裡用 lib/solar.ts（NOAA Solar Calculator 的公式）依日期算（IndicatorDef.derive），
 * 跟地圖、側欄的全年圖表是同一份程式。時間是「某一刻」（TopicDefinition.clock），不是年份。
 * 「月亮」（2026-10-29 起，DESIGN.md 第 8 節第 147 點）用 Astronomy Engine（lib/moon.ts）算月下點、月相與月出月落。
 */

/** pipeline 的 capitals.json */
export interface CapitalsFile {
  fields: string[];
  /** [緯度, 經度, IANA 時區, 標準時間的 UTC 偏移（分鐘）, 中文名, 英文名, 種類（1 首都、2 沒有首都的地區的主要城鎮）] */
  capitals: Record<string, [number, number, string, number, string | null, string, number]>;
  /** 有好幾個首都的國家的其他首都 [中文, 英文, 角色]（角色見 profiles.ts 的 CAPITAL_ROLES） */
  others: Record<string, [string, string, string][]>;
  /** 國土伸進極圈的國家，圈內的參考地點 [緯度, 經度, IANA 時區, 標準時間的 UTC 偏移, 中文名, 英文名] */
  polar: Record<string, [number, number, string, number, string, string]>;
  tzdata: string;
}

export interface Place {
  lat: number;
  lon: number;
  zone: string;
  std: number;
  zh: string;
  en: string;
  /** 首都（true）或沒有首都的地區的主要城鎮 */
  capital: boolean;
}

export function capitalOf(file: CapitalsFile, iso3: string): Place | null {
  const c = file.capitals[iso3];
  if (!c) return null;
  return { lat: c[0], lon: c[1], zone: c[2], std: c[3], zh: c[4] ?? c[5], en: c[5], capital: c[6] !== 2 };
}

export function polarPlaceOf(file: CapitalsFile, iso3: string): Place | null {
  const c = file.polar[iso3];
  if (!c) return null;
  return { lat: c[0], lon: c[1], zone: c[2], std: c[3], zh: c[4], en: c[5], capital: false };
}

export const placeName = (p: Place) => (getLang() === 'en' ? p.en : p.zh);

/** 那一天的太陽：當地日期就是選的日期（各國自己的那一天），時區用標準時間判斷是哪個太陽日（夏令時間不影響） */
export function sunOn(p: Place, day: number): SunDay {
  const [y, m, d] = dayParts(day);
  return sunDay(p.lat, p.lon, y, m, d, p.std);
}

/** 那一刻在這個地點的時鐘（含夏令時間）的 UTC 偏移（分鐘） */
export function offsetAt(p: Place, ms: number): number {
  return zoneOffset(p.zone, ms, p.std);
}

/* ── 格式 ──────────────────────────── */

/** 「13 小時 42 分」「13 h 42 min」 */
export function duration(minutes: number): string {
  const [h, m] = hoursMinutes(minutes);
  return m ? tr({ zh: `${h} 小時 ${m} 分`, en: `${h} h ${m} min` }) : tr({ zh: `${h} 小時`, en: `${h} h` });
}

const deg = (v: number) => `${fixed(v, Math.abs(v) < 10 ? 1 : 0)}°`;

const PHASES: Record<SkyPhase, Text> = {
  day: { zh: '白天', en: 'Day' },
  civil: { zh: '民用曙暮光', en: 'Civil twilight' },
  nautical: { zh: '航海曙暮光', en: 'Nautical twilight' },
  astronomical: { zh: '天文曙暮光', en: 'Astronomical twilight' },
  night: { zh: '夜晚', en: 'Night' },
};

/** 此刻的太陽高度：「白天，太陽高度 35°」「夜晚，太陽在地平線下 20°」 */
function elevationText(v: number): string {
  const phase = tr(PHASES[skyPhase(v)]);
  if (v >= 0) return tr({ zh: `${phase}，太陽高度 ${deg(v)}`, en: `${phase}, sun ${deg(v)} up` });
  return tr({ zh: `${phase}，太陽在地平線下 ${deg(-v)}`, en: `${phase}, sun ${deg(-v)} below the horizon` });
}

/** 此刻的月亮高度：「月亮在地平線上 35°」「月亮在地平線下 20°」 */
function moonElevationText(v: number): string {
  if (v >= 0) return tr({ zh: `月亮在地平線上 ${deg(v)}`, en: `Moon ${deg(v)} up` });
  return tr({ zh: `月亮在地平線下 ${deg(-v)}`, en: `Moon ${deg(-v)} below the horizon` });
}

/** 月相的名稱（lib/moon.ts 的八個月相） */
export const MOON_PHASES: Record<MoonPhaseName, Text> = {
  new: { zh: '新月', en: 'New moon' },
  waxingCrescent: { zh: '眉月', en: 'Waxing crescent' },
  firstQuarter: { zh: '上弦月', en: 'First quarter' },
  waxingGibbous: { zh: '盈凸月', en: 'Waxing gibbous' },
  full: { zh: '滿月', en: 'Full moon' },
  waningGibbous: { zh: '虧凸月', en: 'Waning gibbous' },
  lastQuarter: { zh: '下弦月', en: 'Last quarter' },
  waningCrescent: { zh: '殘月', en: 'Waning crescent' },
};

/** 主要月相（lib/moon.ts 的 nextQuarters：0 新月、1 上弦、2 滿月、3 下弦） */
export const MOON_QUARTERS: Text[] = [
  { zh: '新月', en: 'New moon' },
  { zh: '上弦', en: 'First quarter' },
  { zh: '滿月', en: 'Full moon' },
  { zh: '下弦', en: 'Last quarter' },
];

/** 「虧凸月，亮面 85%」 */
export function phaseText(ms: number): string {
  const ph = moonPhase(ms);
  const pct = Math.round(ph.fraction * 100);
  return tr({ zh: `${tr(MOON_PHASES[ph.name])}，亮面 ${pct}%`, en: `${tr(MOON_PHASES[ph.name])}, ${pct}% lit` });
}

/** 這個地點那一天（當地標準時間的 0 時起 24 小時）的月出、月落 */
export function moonOn(p: Place, day: number): { rise: number | null; set: number | null } {
  const [y, m, d] = dayParts(day);
  return moonRiseSet(p.lat, p.lon, Date.UTC(y, m - 1, d) - p.std * 60_000);
}

/** 月出、月落的時鐘時間：「月出 19:47、月落 10:16（UTC+8）」；沒有的寫「沒有月出」 */
export function moonRiseSetText(p: Place, moon: { rise: number | null; set: number | null }, day: number): string {
  const [y, m, d] = dayParts(day);
  const off = offsetAt(p, Date.UTC(y, m - 1, d, 12) - p.std * 60_000);
  const zone = `${offsetText(off)}${off !== p.std ? tr({ zh: '，夏令時間', en: ', DST' }) : ''}`;
  const rise = moon.rise !== null ? tr({ zh: `月出 ${clockTime(moon.rise, off)}`, en: `moonrise ${clockTime(moon.rise, off)}` }) : tr({ zh: '沒有月出', en: 'no moonrise' });
  const set = moon.set !== null ? tr({ zh: `月落 ${clockTime(moon.set, off)}`, en: `moonset ${clockTime(moon.set, off)}` }) : tr({ zh: '沒有月落', en: 'no moonset' });
  // 依時間先後排（月落常在月出前面）
  const parts = moon.set !== null && (moon.rise === null || moon.set < moon.rise) ? [set, rise] : [rise, set];
  const text = parts.join(tr({ zh: '、', en: ', ' }));
  return tr({ zh: `${text}（${zone}）`, en: `${text.charAt(0).toUpperCase()}${text.slice(1)} (${zone})` });
}

/** 時鐘和太陽的差（分鐘，正的是太陽正午比 12:00 晚）：「晚 1 小時 15 分」「早 6 分」 */
function clockGap(v: number): string {
  const late = v > 0;
  const abs = Math.abs(Math.round(v));
  const [h, m] = hoursMinutes(abs);
  if (abs === 0) return tr({ zh: '跟 12:00 相同', en: 'Same as 12:00' });
  const amount = h ? (m ? duration(abs) : tr({ zh: `${h} 小時`, en: `${h} h` })) : tr({ zh: `${m} 分`, en: `${m} min` });
  return tr({ zh: `太陽正午${late ? '晚' : '早'} ${amount}`, en: `Solar noon ${amount} ${late ? 'late' : 'early'}` });
}

/* ── 指標：依時刻算 ────────────────────── */

/** 各國依這個函式算出一個數值（null 是不算），包成指標檔的格式 */
function perCapital(source: unknown, at: ClockAt, unit: string, value: (p: Place) => number | null): IndicatorData {
  const file = source as CapitalsFile;
  const values: Record<string, (number | null)[]> = {};
  for (const iso3 of Object.keys(file.capitals ?? {})) {
    const v = value(capitalOf(file, iso3)!);
    if (v !== null && Number.isFinite(v)) values[iso3] = [v];
  }
  return { indicator: '', unit, years: [at.day], values };
}

/** 一年中白天最長與最短的差（分鐘）：夏至、冬至前後各 8 天裡的最長與最短（極端值都在至日附近） */
function annualRange(p: Place, year: number): number {
  let max = 0;
  let min = 1440;
  for (const [month, center] of [
    [6, 21],
    [12, 21],
  ]) {
    for (let k = -8; k <= 8; k++) {
      const date = new Date(Date.UTC(year, month - 1, center + k));
      const len = sunDay(p.lat, p.lon, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), p.std).dayLength;
      max = Math.max(max, len);
      min = Math.min(min, len);
    }
  }
  return max - min;
}

/** 平均太陽正午（只看經度，不含均時差）比時鐘的 12:00 晚幾分鐘：標準時間的 UTC 偏移 − 經度 ÷ 15 */
function clockOffset(p: Place): number {
  const diff = p.std - p.lon * 4;
  return ((((diff + 720) % 1440) + 1440) % 1440) - 720;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

const MINUTES = { zh: '分鐘', en: 'minutes' };
const HOURS = { zh: '小時', en: 'hours' };
/** 小時（數值）→「13 小時 42 分」 */
const hoursText = (v: number) => duration(v * 60);
const hoursTick = (v: number) => fixed(v, v % 1 ? 1 : 0);
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const DEGREES = { zh: '度', en: 'degrees' };

/** 首都的說明（每個指標的說明最後一句） */
const CAPITAL_NOTE = {
  zh: '以首都計算（台灣是台北、中國是北京；有好幾個首都的國家用法定或行政首都，香港、澳門等沒有首都的地區用主要的城市）。',
  en: 'Computed for the capital (Taipei for Taiwan, Beijing for China; the official or executive capital where a country has several, and the main city for places without one such as Hong Kong).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '晝夜地圖', en: 'Day & night' },
    description: {
      zh: '選定那一刻地球上哪裡是白天、哪裡是晚上：越往夜半邊越暗，三層是民用、航海、天文曙暮光（太陽在地平線下 6°、12°、18° 以內），琥珀色的點是太陽直射點。細線是赤道、北回歸線、南回歸線與南北極圈。按播放看一天裡晝夜界線怎麼移動，或切到「一年」看四季。滑到國家上看首都此刻的太陽高度與日出、日落。',
      en: 'Where it is day and night at the chosen moment: the night side darkens in steps through civil, nautical and astronomical twilight (sun up to 6°, 12° and 18° below the horizon), and the amber dot is the subsolar point, where the sun is overhead. Thin lines mark the Equator, the Tropics and the polar circles. Play to watch the day–night line sweep through a day, or switch to “Year” for the seasons. Hover over a country for the sun’s height at its capital right now and its sunrise and sunset.',
    },
    unit: DEGREES,
    file: 'capitals.json',
    layer: { kind: 'none' },
    format: elevationText,
    formatTick: deg,
    unranked: true,
    rankingBars: false,
    derive: {
      per: 'minute',
      values: (source, at) => perCapital(source, at, '°', (p) => round1(solarElevation(p.lat, p.lon, at.time))),
    },
  },
  {
    id: 'day-length',
    label: { zh: '白天長度', en: 'Day length' },
    description: {
      zh: `選定那一天從日出到日落有多長（太陽中心在地平線下 0.833° 算日出、日落，含大氣折射）。白天越長越橘、越短越綠，12 小時左右是灰色；春分、秋分全世界都接近 12 小時，夏至、冬至南北半球相反。${CAPITAL_NOTE.zh}`,
      en: `How long the sun is up on the chosen day, from sunrise to sunset (with the sun’s centre 0.833° below the horizon, which allows for refraction). Longer days are more orange, shorter ones more teal, and about 12 hours is grey; near the equinoxes the whole world is close to 12 hours, while at the solstices the hemispheres swap. ${CAPITAL_NOTE.en}`,
    },
    unit: HOURS,
    file: 'capitals.json',
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [8, 10, 11.5, 12.5, 14, 16], reverse: true } },
    format: hoursText,
    formatTick: hoursTick,
    unranked: true,
    derive: {
      per: 'day',
      values: (source, at) => perCapital(source, at, 'h', (p) => round3(sunOn(p, at.day).dayLength / 60)),
    },
  },
  {
    id: 'range',
    label: { zh: '晝長年較差', en: 'Yearly range' },
    description: {
      zh: `一年中白天最長與最短的差（夏至與冬至的白天長度相減）：赤道附近幾乎是 0，越往高緯度越大，北極圈、南極圈以內是 24 小時（有整天不落與整天不升的日子）。${CAPITAL_NOTE.zh}`,
      en: `The difference between the longest and shortest day of the year (day length at the two solstices): almost nothing near the equator, growing towards the poles, and 24 hours inside the polar circles, where the sun neither sets nor rises on some days. ${CAPITAL_NOTE.en}`,
    },
    unit: HOURS,
    file: 'capitals.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 9, 15] } },
    format: hoursText,
    formatTick: hoursTick,
    unranked: true,
    derive: {
      per: 'fixed',
      values: (source, at) => perCapital(source, at, 'h', (p) => round3(annualRange(p, Math.floor(at.day / 10000)) / 60)),
    },
  },
  {
    id: 'noon',
    label: { zh: '正午太陽高度', en: 'Noon sun' },
    description: {
      zh: `選定那一天太陽正午時，太陽離地平線有多高（90° 是正頭頂）。直射點在南北回歸線之間來回，正頭頂的那一帶跟著季節移動；高緯度的冬天太陽只在地平線上一點點。${CAPITAL_NOTE.zh}`,
      en: `How high the sun stands above the horizon at solar noon on the chosen day (90° is straight overhead). The overhead sun moves between the Tropics with the seasons, and at high latitudes in winter it barely clears the horizon. ${CAPITAL_NOTE.en}`,
    },
    unit: DEGREES,
    file: 'capitals.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 30, 45, 60, 75, 85] } },
    format: (v) => `${fixed(v, 1)}°`,
    formatTick: (v) => fixed(v, 0),
    unranked: true,
    derive: {
      per: 'day',
      values: (source, at) => perCapital(source, at, '°', (p) => round1(sunOn(p, at.day).noonElevation)),
    },
  },
  {
    id: 'moon',
    label: { zh: '月亮', en: 'Moon' },
    description: {
      zh: '選定那一刻月亮在哪裡：淡淡一層的半個地球看得到月亮（月亮在地平線上），銀灰色的點是月下點（月亮在正頭頂的地方）。月下點約 24 小時 50 分往西繞地球一圈（每天比太陽晚約 50 分鐘），一個月裡往北、往南各擺到約 28°（2026 年接近 18.6 年週期的最大值）；切到「一年」播放看它南北擺動。滑到國家上看首都此刻的月亮高度、那一天的月出月落與月相。月相全世界一樣，南半球看到的亮面左右相反。',
      en: 'Where the moon is at the chosen moment: the faintly shaded half of the globe can see the moon (it is above the horizon), and the silver dot is the sublunar point, where the moon is overhead. The sublunar point circles the globe westwards about every 24 hours 50 minutes (some 50 minutes later each day than the sun) and swings to about 28° north and south over a month (near the top of its 18.6-year cycle in 2026); switch to “Year” and play to watch it swing. Hover over a country for the moon’s height at its capital right now, that day’s moonrise and moonset, and the phase. The phase is the same everywhere, but the southern hemisphere sees the lit side mirrored.',
    },
    unit: DEGREES,
    file: 'capitals.json',
    layer: { kind: 'none' },
    format: moonElevationText,
    formatTick: deg,
    unranked: true,
    rankingBars: false,
    derive: {
      per: 'minute',
      values: (source, at) => perCapital(source, at, '°', (p) => round1(moonAltitude(p.lat, p.lon, at.time))),
    },
  },
  {
    id: 'clock',
    label: { zh: '時鐘與太陽', en: 'Clock vs sun' },
    description: {
      zh: '首都的平均太陽正午（太陽最高的時候）在時鐘上是幾點，跟 12:00 差多少：時區比經度「快」的地方太陽正午晚（越橘），例如西班牙用中歐時間、太陽正午約 13:15，冰島約 13:28；比經度「慢」的早（越綠）。用標準時間（不含夏令時間，夏令時間再晚 1 小時），也不含一年裡 ±16 分鐘的均時差。中國全國用北京時間，首都北京只差 14 分，西邊的烏魯木齊差 2 小時多。',
      en: 'When the sun is highest at the capital (mean solar noon) by the clock, compared with 12:00: where the time zone runs ahead of the longitude, solar noon comes late (more orange), as in Spain on Central European Time with solar noon around 13:15, or Iceland around 13:28; where it runs behind, it comes early (more teal). Uses standard time (daylight saving time adds another hour) and leaves out the ±16-minute equation of time. All of China uses Beijing time: Beijing is only 14 minutes off, but Ürümqi in the west is more than two hours off.',
    },
    unit: MINUTES,
    file: 'capitals.json',
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-60, -30, -10, 10, 30, 60], reverse: true } },
    format: clockGap,
    formatTick: (v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${fixed(Math.abs(v), 0)}`),
    unranked: true,
    derive: {
      per: 'fixed',
      values: (source, at) => perCapital(source, at, 'min', (p) => round1(clockOffset(p))),
    },
  },
];

/* ── tooltip ──────────────────────────── */

/** 日出、日落的時鐘時間（含夏令時間）：「日出 05:05、日落 18:46（UTC+8）」 */
export function riseSetText(p: Place, sun: SunDay): string {
  if (sun.polar === 'day') return tr({ zh: '極晝：太陽整天不落', en: 'Midnight sun: the sun does not set' });
  if (sun.polar === 'night') return tr({ zh: '極夜：太陽整天不升', en: 'Polar night: the sun does not rise' });
  const off = offsetAt(p, sun.noon);
  const dst = off !== p.std;
  const zone = `${offsetText(off)}${dst ? tr({ zh: '，夏令時間', en: ', DST' }) : ''}`;
  return tr({
    zh: `日出 ${clockTime(sun.sunrise!, off)}、日落 ${clockTime(sun.sunset!, off)}（${zone}）`,
    en: `Sunrise ${clockTime(sun.sunrise!, off)}, sunset ${clockTime(sun.sunset!, off)} (${zone})`,
  });
}

function tooltipLines(iso3: string, ctx: { indicator: string; at: ClockAt | null; source: unknown }): string[] {
  const file = ctx.source as CapitalsFile | null;
  const p = file?.capitals ? capitalOf(file, iso3) : null;
  if (!p || !ctx.at) return [];
  const sun = sunOn(p, ctx.at.day);
  const name = placeName(p);
  const where = p.capital
    ? tr({ zh: `以首都${name}計算`, en: `For the capital, ${name}` })
    : tr({ zh: `以${name}計算`, en: `For ${name}` });
  const second: string[] = [];
  if (ctx.indicator !== 'day-length' && !sun.polar) second.push(tr({ zh: `白天 ${duration(sun.dayLength)}`, en: `Day ${duration(sun.dayLength)}` }));
  const noon = `${fixed(sun.noonElevation, 1)}°`;
  if (ctx.indicator !== 'noon') second.push(tr({ zh: `正午太陽高度 ${noon}`, en: `noon sun ${noon}` }));
  if (ctx.indicator === 'clock') {
    const off = offsetAt(p, sun.noon);
    second.push(tr({ zh: `${formatDay(ctx.at.day)}太陽正午 ${clockTime(sun.noon, off)}`, en: `solar noon ${clockTime(sun.noon, off)} on ${formatDay(ctx.at.day)}` }));
  }
  if (ctx.indicator !== 'map') {
    const phase = skyPhase(solarElevation(p.lat, p.lon, ctx.at.time));
    second.push(tr({ zh: `此刻是${tr(PHASES[phase])}`, en: `now: ${tr(PHASES[phase]).toLowerCase()}` }));
  }
  if (ctx.indicator === 'moon') {
    // 月亮：月出月落、月相，再加日出日落
    const moonFirst = `${where}${tr({ zh: '：', en: ': ' })}${moonRiseSetText(p, moonOn(p, ctx.at.day), ctx.at.day)}`;
    return [moonFirst, phaseText(ctx.at.time), riseSetText(p, sun)];
  }
  const first = `${where}${tr({ zh: '：', en: ': ' })}${riseSetText(p, sun)}`;
  return [first, second.join(tr({ zh: '・', en: ' · ' }))];
}

/** 月亮：看得到月亮的半個地球與月下點（lib/moon.ts） */
const MOON: MoonOverlayDef = {
  kind: 'moon',
  id: 'moon',
  label: { zh: '月亮', en: 'Moon' },
  upLabel: { zh: '看得到月亮（月亮在地平線上）', en: 'Moon above the horizon' },
  edgeLabel: { zh: '正在月出或月落', en: 'Moonrise or moonset now' },
  pointLabel: { zh: '月下點（月亮在正頭頂）', en: 'Sublunar point (moon overhead)' },
  position: sublunarPoint,
  indicators: ['moon'],
};

/* ── 地圖上的線：赤道、回歸線、極圈 ─────────── */

/** 線的種類（pipeline 的 circles.json 的 types）：赤道、回歸線、極圈 */
const CIRCLE_KIND = { equator: 1, tropic: 2, polar: 3 } as const;

function circleName(p: PointRecord): string {
  return String((getLang() === 'en' ? p.e : p.n) ?? '');
}

const CIRCLES: LinesOverlayDef = {
  kind: 'lines',
  id: 'circles',
  file: 'circles.json',
  label: { zh: '赤道、回歸線與極圈', en: 'Equator, Tropics and polar circles' },
  width: 1.1,
  color: {
    classes: [
      { value: CIRCLE_KIND.equator, color: MAP_TOKENS.inkSecondary, label: { zh: '赤道', en: 'Equator' } },
      {
        value: CIRCLE_KIND.tropic,
        color: MAP_TOKENS.inkSecondary,
        label: { zh: '北回歸線、南回歸線', en: 'Tropics of Cancer and Capricorn' },
        dash: true,
      },
      { value: CIRCLE_KIND.polar, color: MAP_TOKENS.inkSecondary, label: { zh: '北極圈、南極圈', en: 'Arctic and Antarctic Circles' }, dash: true },
    ],
  },
  // 不放 tooltip：北回歸線穿過台灣，滑過台灣時要看到國家的 tooltip，線的名稱已經沿線寫出來
  lineLabel: circleName,
};

const NO_CAPITAL: Text = { zh: '沒有首都或常住的城鎮，不計算', en: 'No capital or permanent town to compute for' };

export const daylight: TopicDefinition = {
  id: 'daylight',
  title: { zh: '晝夜與季節', en: 'Day, night and the seasons' },
  shortTitle: { zh: '晝夜與季節', en: 'Day & night' },
  clock: true,
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'NOAA Solar Calculator 的公式（Meeus《Astronomical Algorithms》）', en: 'NOAA Solar Calculator formulas (Meeus, Astronomical Algorithms)' },
      url: 'https://gml.noaa.gov/grad/solcalc/',
      license: { zh: '美國政府著作', en: 'US Government work' },
    },
    {
      name: { zh: '首都：Wikidata（國家小檔案）', en: 'Capitals: Wikidata (Country facts)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: '月亮：Astronomy Engine 2.1.19（Don Cross）', en: 'Moon: Astronomy Engine 2.1.19 (Don Cross)' },
      url: 'https://github.com/cosinekitty/astronomy',
      license: 'MIT',
    },
    {
      name: { zh: 'IANA 時區資料庫（tzdata 2026e）', en: 'IANA Time Zone Database (tzdata 2026e)' },
      url: 'https://www.iana.org/time-zones',
      license: { zh: '公有領域', en: 'public domain' },
    },
  ],
  note: {
    zh: '太陽的位置用 NOAA Solar Calculator 的公式（出自 Meeus《Astronomical Algorithms》）在瀏覽器裡算，1800–2100 年約 1 分鐘以內，高緯度的日出日落誤差較大；春分、夏至等的時刻用 Meeus 第 27 章。日出、日落是太陽中心在地平線下 0.833°（含大氣折射），沒有考慮地形與海拔。國家的數值以首都計算（國家小檔案主題的 Wikidata 首都，台灣是台北；有好幾個首都的國家用法定或行政首都，例如南非用普勒托利亞、玻利維亞用拉巴斯，側欄列出其他首都；香港、澳門、西撒哈拉等沒有首都的地區用主要的城鎮），國土大的國家各地差很多。日出日落的時間是當地時鐘（IANA 時區資料庫，瀏覽器換算，含夏令時間）；「時鐘與太陽」用標準時間。月亮的位置、月相與月出月落用 Astronomy Engine（MIT）在瀏覽器裡算，約 1 角分；月出月落是月亮上緣碰到地平線，含月亮的視差與大氣折射。網址的時間是 UTC，畫面上是你電腦的時區。',
    en: 'The sun’s position is computed in your browser with the NOAA Solar Calculator formulas (from Meeus, Astronomical Algorithms), accurate to about a minute for 1800–2100 and less so for sunrise and sunset at high latitudes; equinox and solstice times use Meeus chapter 27. Sunrise and sunset are when the sun’s centre is 0.833° below the horizon (allowing for refraction), ignoring terrain and altitude. Country values are for the capital (Wikidata, as in Country facts; Taipei for Taiwan; the official or executive capital where there are several, such as Pretoria for South Africa and La Paz for Bolivia, with the others listed in the side panel; the main town for places without a capital such as Hong Kong, Macau and Western Sahara), so large countries vary a lot. Sunrise and sunset times are local clock times (IANA time zones, converted by your browser, including daylight saving time); “Clock vs sun” uses standard time. The moon’s position, phase, moonrise and moonset are computed in your browser with Astronomy Engine (MIT), to about an arcminute; moonrise and moonset are when the moon’s upper edge touches the horizon, allowing for its parallax and refraction. The time in the link is UTC; the page shows your computer’s time zone.',
  },
  panelExtra: () => import('./panels/DaylightPanel'),
  noValue: { ATA: NO_CAPITAL, HMD: NO_CAPITAL, _SIA: NO_CAPITAL },
  tooltipLines,
  overlays: [
    {
      kind: 'night',
      id: 'night',
      label: { zh: '晝夜', en: 'Day and night' },
      sunLabel: { zh: '太陽直射點', en: 'Subsolar point (sun overhead)' },
      indicators: ['map', 'day-length', 'noon', 'moon'],
    },
    MOON,
    CIRCLES,
  ],
  indicators,
};
