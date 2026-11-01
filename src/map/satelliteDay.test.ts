import { describe, expect, it } from 'vitest';
import { blackShare, fillBlack, validDay } from './satelliteDay';

const px = (...colors: [number, number, number][]) => new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('黑縫', () => {
  it('黑的比例（三個顏色加起來小於 30）', () => {
    expect(blackShare(px([0, 0, 0], [10, 20, 40], [5, 5, 5], [200, 200, 200]))).toBe(0.5);
  });
  it('用下一張補黑的像素，兩張都黑的留著', () => {
    const base = px([0, 0, 0], [10, 20, 40], [2, 2, 2]);
    const share = fillBlack(base, px([30, 60, 90], [99, 99, 99], [1, 1, 1]), 0, 1);
    expect([...base.slice(0, 3)]).toEqual([30, 60, 90]);
    expect([...base.slice(4, 7)]).toEqual([10, 20, 40]);
    expect(share).toBeCloseTo(1 / 3);
  });
});

describe('黑區往外擴', () => {
  it('黑的旁邊的暗邊也換掉', () => {
    // 一列 4 格：黑、暗邊、正常、正常；往外擴 1 格時暗邊也用下一張的
    const base = px([0, 0, 0], [20, 20, 20], [100, 100, 100], [100, 100, 100]);
    fillBlack(base, px([50, 60, 70], [51, 61, 71], [52, 62, 72], [53, 63, 73]), 1, 1);
    expect([...base.slice(0, 3)]).toEqual([50, 60, 70]);
    expect([...base.slice(4, 7)]).toEqual([51, 61, 71]);
    expect([...base.slice(8, 11)]).toEqual([100, 100, 100]);
  });
});

describe('validDay', () => {
  it('2000-02-24 到今天', () => {
    expect(validDay('2012-09-15', '2026-11-01')).toBe('2012-09-15');
    expect(validDay('1999-09-15', '2026-11-01')).toBeNull();
    expect(validDay('2027-01-01', '2026-11-01')).toBeNull();
    expect(validDay('2012-9-15', '2026-11-01')).toBeNull();
  });
});
