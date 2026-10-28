/**
 * 時刻主題（TopicDefinition.clock，晝夜與季節）的時間：網址的 time 參數、使用者時區的日期與時間、標題上的寫法。
 *
 * - 一刻是 UTC 毫秒，網址寫成 time=2026-06-21T0400Z（分鐘為止，UTC），分享出去在別的時區打開是同一刻。
 * - 畫面上的日期、時間一律是使用者電腦的時區（控制列、標題、地圖上播放時的大字），旁邊寫 UTC 偏移。
 * - 「那一天」（ClockAt.day）是使用者時區的日期，各國首都的白天長度算的是它們自己那一天（同一個日期）。
 */
import { getLang } from '../i18n/lang';
import type { ClockAt } from '../topics/types';

const MINUTE_MS = 60_000;

/** NOAA 公式的有效範圍（大約），網址的年份超出就不用 */
export const CLOCK_MIN_YEAR = 1900;
export const CLOCK_MAX_YEAR = 2100;

/** 2026-06-21T0400Z（ISO 8601 的基本格式，不寫冒號：網址裡的冒號會被編碼成 %3A）；也接受 04:00Z 的寫法 */
const TIME_PARAM = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):?(\d{2})Z$/;

/** 網址的 time 參數 → UTC 毫秒；看不懂或超出範圍是 null */
export function parseTimeParam(text: string | null): number | null {
  const m = text ? TIME_PARAM.exec(text) : null;
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (y < CLOCK_MIN_YEAR || y > CLOCK_MAX_YEAR || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  // 2 月 30 日這類不存在的日期
  return new Date(ms).getUTCDate() === d ? ms : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC 毫秒 → 網址的 time 參數（分鐘為止） */
export function formatTimeParam(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}Z`;
}

/** 捨去到整分鐘 */
export function floorMinute(ms: number): number {
  return Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/** 使用者時區的日期 YYYYMMDD */
export function dayKey(ms: number): number {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** YYYYMMDD → [年, 月, 日] */
export function dayParts(key: number): [number, number, number] {
  return [Math.floor(key / 10000), Math.floor(key / 100) % 100, key % 100];
}

export function clockAt(ms: number): ClockAt {
  return { time: ms, day: dayKey(ms) };
}

/** 使用者時區那一天 00:00 起的分鐘 */
export function minuteOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/** 同一天（使用者的時區）換成另一個時間；夏令時間切換那天由 Date 處理 */
export function atMinuteOfDay(ms: number, minutes: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
}

/** 一年裡的第幾天（1 起算，使用者的時區） */
export function dayOfYear(ms: number): number {
  const d = new Date(ms);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86_400_000) + 1;
}

export function daysInYear(year: number): number {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** 同一年、同一個時間，換成那一年的第幾天 */
export function atDayOfYear(ms: number, day: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), 0, day, d.getHours(), d.getMinutes()).getTime();
}

/** 使用者時區的某個日期（<input type="date"> 的值 YYYY-MM-DD），時間不變；看不懂是 null */
export function atDate(ms: number, value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  if (y < CLOCK_MIN_YEAR || y > CLOCK_MAX_YEAR) return null;
  const t = new Date(ms);
  return new Date(y, mo - 1, d, t.getHours(), t.getMinutes()).getTime();
}

/** <input type="date"> 的值 */
export function dateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 使用者時區的 UTC 偏移「UTC+8」 */
export function viewerOffsetText(ms: number): string {
  const minutes = -new Date(ms).getTimezoneOffset();
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ''}`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 日期：「6月21日」「Jun 21」；不是今年時加上年份（「2030年6月21日」「Jun 21, 2030」） */
export function formatDay(key: number, now = Date.now()): string {
  const [y, m, d] = dayParts(key);
  const thisYear = new Date(now).getFullYear() === y;
  if (getLang() === 'en') return `${MONTHS_EN[m - 1]} ${d}${thisYear ? '' : `, ${y}`}`;
  return `${thisYear ? '' : `${y}年`}${m}月${d}日`; // i18n-ignore（上一行已經處理英文）
}

/** 使用者時區的時間「14:05」 */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 日期加時間：「6月21日 14:05」「Jun 21, 14:05」 */
export function formatMoment(ms: number, now = Date.now()): string {
  const day = formatDay(dayKey(ms), now);
  return getLang() === 'en' ? `${day}, ${formatClock(ms)}` : `${day} ${formatClock(ms)}`;
}

/** 一年裡第幾天 → 月日「6/21」「Jun 21」（圖表的座標軸、tooltip） */
export function monthDayOfYear(year: number, day: number): string {
  const d = new Date(Date.UTC(year, 0, day));
  const m = d.getUTCMonth();
  return getLang() === 'en' ? `${MONTHS_EN[m]} ${d.getUTCDate()}` : `${m + 1}/${d.getUTCDate()}`;
}
