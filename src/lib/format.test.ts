import { describe, expect, it } from 'vitest';
import { setLang } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent, formatSignedPercent, niceLegendValues } from './format';

describe('數字格式（中文）', () => {
  it('大數用萬、億、兆', () => {
    setLang('zh');
    expect(formatLargeNumber(23_320_000)).toBe('2,332 萬');
    expect(formatLargeNumber(1_438_000_000)).toBe('14.38 億');
    expect(formatLargeNumber(30_860_000_000_000)).toBe('30.86 兆');
    expect(formatLargeNumber(9816)).toBe('9,816');
  });

  it('圖例刻度', () => {
    setLang('zh');
    expect(formatLargeTick(10_000_000)).toBe('1,000萬');
    expect(formatLargeTick(-100_000_000)).toBe('−1億');
  });

  it('百分比與正負號（真正的減號）', () => {
    setLang('zh');
    expect(formatPercent(12.345)).toBe('12.3%');
    expect(formatSignedPercent(-0.45)).toBe('−0.45%');
    expect(formatSignedPercent(1.25)).toBe('+1.25%');
    expect(fixed(1234.5, 0)).toBe('1,235');
  });
});

describe('數字格式（英文）', () => {
  it('大數用 K、M、B、T', () => {
    setLang('en');
    expect(formatLargeNumber(23_330_000)).toBe('23.33M');
    expect(formatLargeNumber(1_440_000_000)).toBe('1.44B');
    expect(formatLargeNumber(980_000)).toBe('980,000');
    setLang('zh');
  });
});

describe('niceLegendValues', () => {
  it('最大值、十分之一、百分之一，各取 1、2、5 × 10ⁿ', () => {
    expect(niceLegendValues(2.1e8)).toEqual([2e6, 2e7, 2e8]);
    expect(niceLegendValues(0)).toEqual([]);
  });
});
