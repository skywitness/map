import { describe, expect, it } from 'vitest';
import { blackShare, dayCandidates, fillBlack, fillClear, validDay } from './satelliteDay';

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

describe('其他產品', () => {
  it('臭氧：OMPS 之前用 OMI，再用前一天的', () => {
    const list = dayCandidates('2010-09-20', 'ozone');
    expect(list.map((c) => c.layer)).toEqual(['OMI_Ozone_TOMS_Total_Column', 'OMI_Ozone_TOMS_Total_Column']);
    expect(list[1].date).toBe('2010-09-19');
  });
  it('葉綠素：當天再往前 7 天，只用那時有資料的衛星', () => {
    const list = dayCandidates('2023-07-15', 'chlorophyll');
    expect(list[0]).toEqual({ layer: 'VIIRS_NOAA20_Chlorophyll_a', date: '2023-07-15' });
    expect(list.some((c) => c.layer === 'MODIS_Aqua_L2_Chlorophyll_A')).toBe(false);
    expect(list.filter((c) => c.layer === 'VIIRS_NOAA20_Chlorophyll_a')).toHaveLength(8);
  });
  it('透明的像素用下一張補', () => {
    const rgba = (...p: [number, number, number, number][]) => new Uint8ClampedArray(p.flat());
    const base = rgba([0, 0, 0, 0], [10, 20, 30, 255]);
    const share = fillClear(base, rgba([5, 6, 7, 255], [1, 1, 1, 255]));
    expect([...base]).toEqual([5, 6, 7, 255, 10, 20, 30, 255]);
    expect(share).toBe(0);
  });
});
