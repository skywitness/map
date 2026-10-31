import { describe, expect, it } from 'vitest';
import { bubbleRadius, changeThresholds, classOf } from './scales';

describe('changeThresholds（變化地圖的分級）', () => {
  it('對稱、由小到大', () => {
    const t = changeThresholds([-30, -12, -4, -1, 0, 2, 5, 9, 15, 40]);
    expect(t).toHaveLength(6);
    expect(t.slice(0, 3).map((v) => -v)).toEqual(t.slice(3).reverse());
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });

  it('相鄰的門檻至少差一倍', () => {
    const [, , , a, b, c] = changeThresholds([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6]);
    expect(b).toBeGreaterThanOrEqual(a * 2);
    expect(c).toBeGreaterThanOrEqual(b * 2);
  });

  it('變化都是 0 時照樣有門檻', () => {
    const t = changeThresholds([0, 0, 0]);
    expect(t[3]).toBeGreaterThan(0);
  });
});

describe('classOf', () => {
  it('跟 d3 的 scaleThreshold 一樣：等於門檻算上一級', () => {
    const t = [-10, 0, 10];
    expect(classOf(t, -20)).toBe(0);
    expect(classOf(t, -10)).toBe(1);
    expect(classOf(t, 5)).toBe(2);
    expect(classOf(t, 10)).toBe(3);
  });
});

describe('bubbleRadius', () => {
  it('面積跟數值成正比，0 或負的不畫', () => {
    expect(bubbleRadius(100, 100)).toBe(26);
    expect(bubbleRadius(25, 100)).toBeCloseTo(13);
    expect(bubbleRadius(0, 100)).toBe(0);
  });
});
