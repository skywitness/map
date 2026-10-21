const int = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

export function fixed(value: number, digits: number): string {
  return value.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 中文習慣的大數：30.86 兆、14.38 億、2,332 萬、9,816 */
export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${fixed(value / 1e12, 2)} 兆`;
  if (abs >= 1e8) return `${fixed(value / 1e8, abs >= 1e10 ? 0 : 2)} 億`;
  if (abs >= 1e4) return `${int.format(value / 1e4)} 萬`;
  return int.format(value);
}

/** 圖例刻度用：1,000萬、1億、10億、1兆；負數也適用 */
export function formatLargeTick(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const compact = (v: number) => (v % 1 === 0 ? int.format(v) : fixed(v, 1));
  if (abs >= 1e12) return `${sign}${compact(abs / 1e12)}兆`;
  if (abs >= 1e8) return `${sign}${compact(abs / 1e8)}億`;
  if (abs >= 1e4) return `${sign}${compact(abs / 1e4)}萬`;
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
