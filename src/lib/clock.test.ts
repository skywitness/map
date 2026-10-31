import { describe, expect, it } from 'vitest';
import { dayOfYear, daysInYear, formatTimeParam, parseTimeParam } from './clock';

describe('網址的 time 參數', () => {
  it('讀寫一致（分鐘為止）', () => {
    const ms = Date.UTC(2026, 5, 21, 4, 0);
    expect(formatTimeParam(ms)).toBe('2026-06-21T0400Z');
    expect(parseTimeParam('2026-06-21T0400Z')).toBe(ms);
  });

  it('也接受有冒號的寫法', () => {
    expect(parseTimeParam('2026-06-21T04:00Z')).toBe(Date.UTC(2026, 5, 21, 4, 0));
  });

  it('不存在的日期、看不懂的寫法是 null', () => {
    expect(parseTimeParam('2026-02-30T0000Z')).toBeNull();
    expect(parseTimeParam('2026-06-21 04:00')).toBeNull();
    expect(parseTimeParam(null)).toBeNull();
  });
});

describe('日期', () => {
  it('閏年', () => {
    expect(daysInYear(2024)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
  });

  it('一年的第幾天', () => {
    expect(dayOfYear(Date.UTC(2026, 0, 1, 12))).toBe(1);
    expect(dayOfYear(Date.UTC(2024, 11, 31, 12))).toBe(366);
  });
});
