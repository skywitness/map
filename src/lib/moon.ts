/**
 * 月亮的位置、月相與月出月落（2026-10-29 起，晝夜與季節的「月亮」）：用 Astronomy Engine（MIT，Don Cross，
 * 跟 NOVAS、JPL Horizons 比對，約 1 角分）在瀏覽器裡算。只有晝夜與季節主題 import，套件不進首頁的程式。
 *
 * - 月下點（月亮在正頭頂的地方）用地心的位置：赤經 − 格林威治視恆星時、赤緯（月亮很近，從地表不同地方看差約 1°，
 *   所以「看得到月亮」的範圍另外依月亮的視差與半徑算門檻，各國首都的月亮高度用站心的位置加大氣折射）。
 * - 月出、月落：Astronomy Engine 的 SearchRiseSet，月亮上緣碰到地平線，含視差與大氣折射（不是太陽的 0.833°）。
 */
import {
  Body,
  EquatorFromVector,
  Equator,
  GeoMoon,
  Horizon,
  Illumination,
  KM_PER_AU,
  MakeTime,
  MoonPhase,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  SearchMoonQuarter,
  SearchRiseSet,
  SiderealTime,
} from 'astronomy-engine';

const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6378.14;
const DAY_MS = 86_400_000;

function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

export interface SublunarPoint {
  lon: number;
  lat: number;
  /** 地心距離（km） */
  distance: number;
  /**
   * 月亮剛升起時（上緣碰到地平線、含大氣折射）月亮中心的地心高度（°）：Meeus《Astronomical Algorithms》第 15 章的
   * h0 = 0.7275 × 地平視差 − 34′，約 +0.1°；地圖上「看得到月亮」是地心高度高於它的地方
   */
  horizon: number;
}

/** 那一刻的月下點（地心，真赤道與春分點） */
export function sublunarPoint(ms: number): SublunarPoint {
  const date = new Date(ms);
  const eq = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoMoon(date)));
  const distance = eq.dist * KM_PER_AU;
  const parallax = Math.asin(EARTH_RADIUS_KM / distance) / RAD;
  return {
    lon: wrapLon((eq.ra - SiderealTime(date)) * 15),
    lat: eq.dec,
    distance,
    horizon: 0.7275 * parallax - 34 / 60,
  };
}

/** 月亮的方向（地心的單位向量，座標軸跟 lib/solar.ts 的 sunVector 一樣） */
export function moonVector(p: Pick<SublunarPoint, 'lon' | 'lat'>): [number, number, number] {
  const c = Math.cos(p.lat * RAD);
  return [c * Math.cos(p.lon * RAD), c * Math.sin(p.lon * RAD), Math.sin(p.lat * RAD)];
}

/** 在這個地點看到的月亮高度（°，站心、含大氣折射）：0 以上在地平線上 */
export function moonAltitude(lat: number, lon: number, ms: number): number {
  const date = new Date(ms);
  const observer = new Observer(lat, lon, 0);
  const eq = Equator(Body.Moon, date, observer, true, true);
  return Horizon(date, observer, eq.ra, eq.dec, 'normal').altitude;
}

/** 八個月相：新月、眉月、上弦月、盈凸月、滿月、虧凸月、下弦月、殘月（月相角每 45° 一段，主要月相在中間） */
export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

const PHASE_NAMES: MoonPhaseName[] = [
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
];

export interface MoonPhaseInfo {
  /** 月相角（°）：月亮與太陽的黃經差，0 新月、90 上弦、180 滿月、270 下弦 */
  angle: number;
  /** 亮面比例（0–1） */
  fraction: number;
  name: MoonPhaseName;
}

export function moonPhase(ms: number): MoonPhaseInfo {
  const date = new Date(ms);
  const angle = MoonPhase(date);
  return {
    angle,
    fraction: Illumination(Body.Moon, date).phase_fraction,
    name: PHASE_NAMES[Math.floor((((angle + 22.5) % 360) + 360) % 360 / 45)],
  };
}

/** 接下來的主要月相：quarter 0 新月、1 上弦、2 滿月、3 下弦；time 是 UTC 毫秒 */
export function nextQuarters(ms: number, count = 4): { quarter: 0 | 1 | 2 | 3; time: number }[] {
  const out: { quarter: 0 | 1 | 2 | 3; time: number }[] = [];
  let q = SearchMoonQuarter(new Date(ms));
  for (let i = 0; i < count; i++) {
    out.push({ quarter: q.quarter as 0 | 1 | 2 | 3, time: q.time.date.getTime() });
    // 下一個月相在約 7.4 天後；從這一刻往後 1 天開始找，不會找回同一個
    q = SearchMoonQuarter(new Date(q.time.date.getTime() + DAY_MS));
  }
  return out;
}

/**
 * 從 start（UTC 毫秒，通常是當地的午夜）起 24 小時裡的月出、月落；那一天沒有（月出每天晚約 50 分鐘，
 * 一個月裡有一天沒有月出、一天沒有月落）或高緯度整天在地平線上、下時是 null
 */
export function moonRiseSet(lat: number, lon: number, start: number): { rise: number | null; set: number | null } {
  const observer = new Observer(lat, lon, 0);
  const from = MakeTime(new Date(start));
  const rise = SearchRiseSet(Body.Moon, observer, +1, from, 1);
  const set = SearchRiseSet(Body.Moon, observer, -1, from, 1);
  return { rise: rise ? rise.date.getTime() : null, set: set ? set.date.getTime() : null };
}
