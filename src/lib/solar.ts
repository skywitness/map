/**
 * 太陽的位置、日出日落、白天長度（晝夜與季節主題的地圖、tooltip、側欄共用這一份）。
 *
 * 公式是 NOAA Solar Calculator（https://gml.noaa.gov/grad/solcalc/ ，美國政府的著作）用的那一套，出自
 * Jean Meeus《Astronomical Algorithms》：太陽的視黃經、赤緯、均時差（equation of time）都是 Julian 世紀的多項式，
 * 1800–2100 年的誤差約 1 分鐘以內（高緯度的日出日落誤差較大，因為太陽斜斜地穿過地平線）。
 *
 * - 日出、日落：太陽中心在地平線下 0.833°（大氣折射 0.567° 加上太陽的半徑 0.267°），跟 NOAA、各國氣象單位一樣。
 *   先用當地「那一天」的太陽正午算，再用算出來的日出（日落）時刻的赤緯、均時差重算一次（NOAA 的做法）。
 * - 曙暮光：太陽中心在地平線下 6°（民用）、12°（航海）、18°（天文）。
 * - 這裡的高度角都是幾何的（沒有加大氣折射），地圖上的晝夜界線也是同一個高度角，跟日出日落的定義一致。
 * - 時刻一律是 epoch 毫秒（UTC），經度東經為正。
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** 日出、日落時太陽中心在地平線下幾度 */
export const SUNRISE_DEPRESSION = 0.833;
/** 曙暮光的邊界：民用、航海、天文（太陽中心在地平線下幾度） */
export const TWILIGHT_DEPRESSIONS = [6, 12, 18] as const;

/** 太陽在某一刻的位置（地心） */
export interface SunState {
  /** 赤緯（°） */
  declination: number;
  /** 均時差（分鐘）：視太陽時減平太陽時 */
  eqTime: number;
  /** 視黃經（°，0 是春分點） */
  longitude: number;
  /** 黃赤交角（°） */
  obliquity: number;
}

/** J2000.0 起算的 Julian 世紀 */
function julianCentury(ms: number): number {
  return (ms / DAY_MS + 2440587.5 - 2451545) / 36525;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** NOAA 的 calcSunDeclination、calcEquationOfTime（Meeus 第 25 章的低精度算法） */
export function sunAt(ms: number): SunState {
  const T = julianCentury(ms);
  const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  const seconds = 21.448 - T * (46.815 + T * (0.00059 - T * 0.001813));
  const epsilon0 = 23 + (26 + seconds / 60) / 60;
  const epsilon = epsilon0 + 0.00256 * Math.cos(omega);
  const declination = Math.asin(Math.sin(epsilon * RAD) * Math.sin(lambda * RAD)) / RAD;
  const y = Math.tan((epsilon * RAD) / 2) ** 2;
  const L0r = L0 * RAD;
  const eq =
    y * Math.sin(2 * L0r) -
    2 * e * Math.sin(Mr) +
    4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
    0.5 * y * y * Math.sin(4 * L0r) -
    1.25 * e * e * Math.sin(2 * Mr);
  return { declination, eqTime: (4 * eq) / RAD, longitude: mod(lambda, 360), obliquity: epsilon };
}

/** 一天裡的 UTC 分鐘（0–1440） */
function utcMinutes(ms: number): number {
  return mod(ms / MINUTE_MS, 1440);
}

/** 經度換到 −180–180 */
export function wrapLon(lon: number): number {
  return mod(lon + 180, 360) - 180;
}

/** 太陽直射點 [經度, 緯度]：那裡的視太陽時正好是正午，緯度就是赤緯 */
export function subsolarPoint(ms: number): [number, number] {
  const { declination, eqTime } = sunAt(ms);
  return [wrapLon((720 - utcMinutes(ms) - eqTime) / 4), declination];
}

/** 太陽的方向（地心的單位向量 x 指向經度 0、y 指向東經 90°、z 指向北極）；晝夜界線的著色器用它 */
export function sunVector(ms: number): [number, number, number] {
  const [lon, lat] = subsolarPoint(ms);
  const c = Math.cos(lat * RAD);
  return [c * Math.cos(lon * RAD), c * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}

/** 太陽高度角（°，幾何的，沒有加大氣折射）；−0.833° 以上算白天 */
export function solarElevation(lat: number, lon: number, ms: number): number {
  const { declination, eqTime } = sunAt(ms);
  const hourAngle = (utcMinutes(ms) + eqTime + 4 * lon) / 4 - 180;
  const d = declination * RAD;
  const p = lat * RAD;
  const cosZ = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZ))) / RAD;
}

/** 太陽中心在地平線下 depression 度時的時角（°）；整天在上面回傳 180、整天在下面回傳 0 */
function hourAngleAt(lat: number, declination: number, depression: number): number {
  const p = lat * RAD;
  const d = declination * RAD;
  const cosH = (Math.cos((90 + depression) * RAD) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
  if (cosH <= -1) return 180;
  if (cosH >= 1) return 0;
  return Math.acos(cosH) / RAD;
}

/** 晝夜的分類：白天、民用、航海、天文曙暮光、夜晚（地圖的圖例、tooltip 共用） */
export type SkyPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';

export function skyPhase(elevation: number): SkyPhase {
  if (elevation >= -SUNRISE_DEPRESSION) return 'day';
  if (elevation >= -TWILIGHT_DEPRESSIONS[0]) return 'civil';
  if (elevation >= -TWILIGHT_DEPRESSIONS[1]) return 'nautical';
  if (elevation >= -TWILIGHT_DEPRESSIONS[2]) return 'astronomical';
  return 'night';
}

/** 某個地點某一天的太陽 */
export interface SunDay {
  /** 太陽正午（UTC 毫秒） */
  noon: number;
  /** 日出、日落（UTC 毫秒）；極晝、極夜時是 null */
  sunrise: number | null;
  sunset: number | null;
  /** 白天長度（分鐘，0–1440）：極晝 1440、極夜 0 */
  dayLength: number;
  /** 'day' 極晝（太陽整天不落）、'night' 極夜（整天不升），其他是 null */
  polar: 'day' | 'night' | null;
  /** 正午的太陽高度角（°，幾何的）；極夜時是負的 */
  noonElevation: number;
}

/**
 * 當地日期 (year, month, day) 那一天的太陽正午（UTC 毫秒）。utcOffset 是當地時鐘的 UTC 偏移（分鐘）：
 * 經度跟時區差很多的地方（吉里巴斯的 UTC+14、經度 −157°），經度上的那一天跟時鐘上的那一天不同，
 * 取落在時鐘的那一天 00:00–24:00 之間的正午。
 */
export function solarNoon(lon: number, year: number, month: number, day: number, utcOffset: number): number {
  const midnight = Date.UTC(year, month - 1, day);
  const approx = 720 - 4 * lon;
  // 時鐘上那一天的範圍（UTC 分鐘，相對於 UTC 的 00:00）：[−utcOffset, 1440 − utcOffset)
  const shift = Math.floor((approx + utcOffset) / 1440);
  let noon = midnight + (approx - shift * 1440) * MINUTE_MS;
  for (let i = 0; i < 2; i++) {
    const { eqTime } = sunAt(noon);
    noon = midnight + (approx - shift * 1440 - eqTime) * MINUTE_MS;
  }
  return noon;
}

/**
 * 當地日期那一天的日出、日落、白天長度、正午太陽高度。
 * 日出（日落）先用正午的赤緯算，再用算出來的那個時刻的赤緯、均時差重算一次（NOAA 的 calcSunriseSet）。
 */
export function sunDay(lat: number, lon: number, year: number, month: number, day: number, utcOffset: number): SunDay {
  const noon = solarNoon(lon, year, month, day, utcOffset);
  const atNoon = sunAt(noon);
  const noonElevation = Math.min(90, 90 - Math.abs(lat - atNoon.declination));
  const h0 = hourAngleAt(lat, atNoon.declination, SUNRISE_DEPRESSION);
  if (h0 === 180) return { noon, sunrise: null, sunset: null, dayLength: 1440, polar: 'day', noonElevation };
  if (h0 === 0) return { noon, sunrise: null, sunset: null, dayLength: 0, polar: 'night', noonElevation };
  const refine = (sign: -1 | 1) => {
    let t = noon + sign * 4 * h0 * MINUTE_MS;
    for (let i = 0; i < 2; i++) {
      const s = sunAt(t);
      const h = hourAngleAt(lat, s.declination, SUNRISE_DEPRESSION);
      // 剛好在極晝、極夜的邊界：重算的時刻已經沒有日出（日落），用前一次的
      if (h === 0 || h === 180) break;
      // 那個時刻的太陽正午（用那個時刻的均時差）加減時角
      const noonThere = noon + (atNoon.eqTime - s.eqTime) * MINUTE_MS;
      t = noonThere + sign * 4 * h * MINUTE_MS;
    }
    return t;
  };
  const sunrise = refine(-1);
  const sunset = refine(1);
  const dayLength = Math.max(0, Math.min(1440, (sunset - sunrise) / MINUTE_MS));
  return { noon, sunrise, sunset, dayLength, polar: null, noonElevation };
}

/**
 * Meeus 第 27 章表 27.C 的週期項 [A, B, C]：S = Σ A·cos(B + C·T)。
 * 上面 NOAA 的低精度視黃經算春分、夏至差到 10 分鐘，日期落在半夜附近時會差一天，這裡另外用第 27 章（約 1 分鐘）
 */
const SEASON_TERMS: [number, number, number][] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

/** Meeus 表 27.B（1000–3000 年）的平均春分、夏至、秋分、冬至（JDE）多項式係數 */
const SEASON_MEAN: [number, number, number, number, number][] = [
  [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
];

/** 一年裡的春分、夏至、秋分、冬至（UTC 毫秒），Meeus 第 27 章；ΔT（地球時減世界時）用 NASA 2005–2050 年的近似式 */
export function seasonMoments(year: number): { march: number; june: number; september: number; december: number } {
  const Y = (year - 2000) / 1000;
  const t = year - 2000;
  const deltaT = 62.92 + 0.32217 * t + 0.005589 * t * t;
  const [march, june, september, december] = SEASON_MEAN.map(([a, b, c, d, e]) => {
    const jde0 = a + b * Y + c * Y ** 2 + d * Y ** 3 + e * Y ** 4;
    const T = (jde0 - 2451545) / 36525;
    const W = (35999.373 * T - 2.47) * RAD;
    const dLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
    const S = SEASON_TERMS.reduce((sum, [A, B, C]) => sum + A * Math.cos((B + C * T) * RAD), 0);
    const jde = jde0 + (0.00001 * S) / dLambda;
    return (jde - 2440587.5) * DAY_MS - deltaT * 1000;
  });
  return { march, june, september, december };
}

/* ── 時區與當地日期（瀏覽器的 Intl 有 IANA 時區資料庫，含夏令時間） ── */

const zoneFormats = new Map<string, Intl.DateTimeFormat | null>();

function zoneFormat(zone: string): Intl.DateTimeFormat | null {
  let f = zoneFormats.get(zone);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } catch {
      // 瀏覽器不認得這個時區（很舊的瀏覽器）：用 pipeline 給的標準時間
      f = null;
    }
    zoneFormats.set(zone, f);
  }
  return f;
}

/**
 * 那一刻在這個時區的 UTC 偏移（分鐘，含夏令時間）。瀏覽器不認得這個時區時回傳 fallback（標準時間）。
 */
export function zoneOffset(zone: string, ms: number, fallback: number): number {
  const f = zoneFormat(zone);
  if (!f) return fallback;
  const parts: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') parts[p.type] = Number(p.value);
  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return Math.round((local - Math.floor(ms / 1000) * 1000) / MINUTE_MS);
}

/** 時鐘上的時刻「05:04」：ms 加上 UTC 偏移（分鐘）以後的時、分 */
export function clockTime(ms: number, offset: number): string {
  const d = new Date(Math.round((ms + offset * MINUTE_MS) / MINUTE_MS) * MINUTE_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** 那一刻在時鐘上是哪一天 [年, 月, 日] */
export function clockDate(ms: number, offset: number): [number, number, number] {
  const d = new Date(ms + offset * MINUTE_MS);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/** UTC 偏移的寫法「UTC+8」「UTC+5:30」「UTC−3」 */
export function offsetText(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** 白天長度「13 小時 34 分」「13 h 34 min」的時、分（四捨五入到分） */
export function hoursMinutes(minutes: number): [number, number] {
  const total = Math.round(minutes);
  return [Math.floor(total / 60), total % 60];
}
