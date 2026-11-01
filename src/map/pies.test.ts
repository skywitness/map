import { describe, expect, it } from 'vitest';
import { pieSlices, pieTier } from './pies';

describe('pieTier', () => {
  it('直徑 2r 以上最小的一級', () => {
    expect(pieTier(3)).toBe(24);
    expect(pieTier(12)).toBe(24);
    expect(pieTier(12.5)).toBe(48);
    expect(pieTier(30)).toBe(96);
    expect(pieTier(80)).toBe(96);
  });
});

describe('pieSlices', () => {
  it('依比例分一整圈，從 0 開始順時針接起來', () => {
    const s = pieSlices([50, 25, 25]);
    expect(s.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(s[0].start).toBe(0);
    expect(s[0].end).toBeCloseTo(Math.PI);
    expect(s[2].end).toBeCloseTo(2 * Math.PI);
  });
  it('加起來不是 100 時照比例；0、負值、空值不畫；太小的片不畫但照樣佔位置', () => {
    const s = pieSlices([30, 0, -1, 10, 0.1]);
    expect(s.map((x) => x.index)).toEqual([0, 3]);
    expect(s[1].start).toBeCloseTo((30 / 40.1) * 2 * Math.PI);
  });
  it('全部是 0 時沒有片', () => {
    expect(pieSlices([0, 0])).toEqual([]);
  });
});
