/**
 * 數字格式。依目前的介面語言（呼叫當下讀取）：
 * - 中文：萬、億、兆，例如 2,333 萬、14.38 億
 * - 英文：K、M、B、T，例如 23.33M、1.44B
 * 主題設定的 format / formatTick 都用這裡的函式，就會自動跟著語言切換。
 */
import { getLang, LOCALES } from '../i18n/lang';

const ints = new Map<string, Intl.NumberFormat>();

function int(value: number): string {
  const locale = LOCALES[getLang()];
  let f = ints.get(locale);
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    ints.set(locale, f);
  }
  return f.format(value);
}

export function fixed(value: number, digits: number): string {
  return value.toLocaleString(LOCALES[getLang()], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 大數的單位，由大到小 */
const LARGE_UNITS = {
  zh: [
    { size: 1e12, suffix: ' 兆', tick: '兆' },
    { size: 1e8, suffix: ' 億', tick: '億' },
    { size: 1e4, suffix: ' 萬', tick: '萬' },
  ],
  en: [
    { size: 1e12, suffix: 'T', tick: 'T' },
    { size: 1e9, suffix: 'B', tick: 'B' },
    { size: 1e6, suffix: 'M', tick: 'M' },
    // 英文的完整格式在一百萬以下直接寫出數字（980,000），K 只用在圖例刻度
    { size: 1e3, suffix: null, tick: 'K' },
  ],
};

/** 大數：中文 30.86 兆、14.38 億、2,332 萬、9,816；英文 30.86T、1.44B、23.33M、980,000 */
export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  const lang = getLang();
  for (const { size, suffix } of LARGE_UNITS[lang]) {
    if (abs < size || suffix === null) continue;
    const scaled = value / size;
    if (lang === 'en') return `${fixed(scaled, Math.abs(scaled) >= 100 ? 1 : 2)}${suffix}`;
    // 中文：億以上留兩位小數（超過 100 億就不留），萬取整數
    if (size === 1e4) return `${int(scaled)}${suffix}`;
    return `${fixed(scaled, size === 1e8 && abs >= 1e10 ? 0 : 2)}${suffix}`;
  }
  return int(value);
}

/** 圖例刻度用：中文 1,000萬、1億、10億、1兆；英文 10M、100M、1B、1T。負數也適用 */
export function formatLargeTick(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const compact = (v: number) => (v % 1 === 0 ? int(v) : fixed(v, 1));
  for (const { size, tick } of LARGE_UNITS[getLang()]) {
    if (abs >= size) return `${sign}${compact(abs / size)}${tick}`;
  }
  return `${sign}${compact(abs)}`;
}

/** 帶正負號的大數：+12.3 億、−5,600 萬 */
export function formatSignedLarge(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatLargeNumber(Math.abs(value))}`;
}

/** 從最大值挑出 3 個好讀的圖例數值（1、2、5 × 10ⁿ），例如 max = 2.1 億 → [100 萬, 1,000 萬, 2 億] */
export function niceLegendValues(max: number): number[] {
  const nice = (v: number) => {
    const exp = 10 ** Math.floor(Math.log10(v));
    const m = v / exp;
    return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * exp;
  };
  return [max / 100, max / 10, max].filter((v) => v > 0).map(nice);
}

/** 帶正負號的百分比：+1.25%、−0.45%（用真正的減號） */
export function formatSignedPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${fixed(Math.abs(value), digits)}%`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${fixed(value, digits)}%`;
}

/** 把貨幣接在格式化好的數字上（數字可以帶正負號）：中文接在後面，英文是前綴，例如 −$5.2B */
function currency(text: string, unit: { zh: string; en: string }): string {
  if (getLang() !== 'en') return `${text} ${unit.zh}`;
  const sign = /^[+−-]/.test(text) ? text[0] : '';
  return `${sign}${unit.en}${text.slice(sign.length)}`;
}

/** 美元：中文「1.43 兆 美元」，英文「$1.43T」 */
export function usd(text: string): string {
  return currency(text, { zh: '美元', en: '$' });
}

/** 國際元（購買力平價）：中文「12,345 國際元」，英文「Int$12,345」 */
export function intlDollars(text: string): string {
  return currency(text, { zh: '國際元', en: 'Int$' });
}
