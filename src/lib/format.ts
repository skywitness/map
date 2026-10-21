const int = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });

export function fixed(value: number, digits: number): string {
  return value.toLocaleString('zh-TW', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 中文習慣的大數：14.38 億、2,332 萬、9,816 */
export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${fixed(value / 1e8, 2)} 億`;
  if (abs >= 1e4) return `${int.format(value / 1e4)} 萬`;
  return int.format(value);
}

/** 圖例刻度用：1,000萬、1億、10億 */
export function formatLargeTick(value: number): string {
  if (value >= 1e8) return `${int.format(value / 1e8)}億`;
  if (value >= 1e4) return `${int.format(value / 1e4)}萬`;
  return int.format(value);
}

/** 帶正負號的百分比：+1.25%、−0.45%（用真正的減號） */
export function formatSignedPercent(value: number, digits = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${fixed(Math.abs(value), digits)}%`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${fixed(value, digits)}%`;
}
