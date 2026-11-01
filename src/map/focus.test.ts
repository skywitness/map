import { describe, expect, it } from 'vitest';
import { polarCap, poleZoom } from './focus';

describe('polarCap', () => {
  it('一整圈的極區範圍', () => {
    expect(polarCap([-180, -88, 180, -62])).toEqual({ pole: -1, edge: -62 });
    expect(polarCap([-180, 62, 180, 82])).toEqual({ pole: 1, edge: 62 });
    expect(polarCap([-180, -90, 180, -40])).toEqual({ pole: -1, edge: -40 });
  });
  it('不是一整圈或不夠靠近極點的範圍照舊', () => {
    expect(polarCap([-170, -88, 180, -62])).toBeNull();
    expect(polarCap([-180, -60, 180, 10])).toBeNull();
    expect(polarCap([-180, 20, 180, 70])).toBeNull();
    expect(polarCap([100, 20, 130, 40])).toBeNull();
  });
});

describe('poleZoom', () => {
  it('外緣離極點越遠、畫面越小，縮放越小', () => {
    const z62 = poleZoom(-62, 250, 700, 36.87);
    expect(poleZoom(-40, 250, 700, 36.87)).toBeLessThan(z62);
    expect(poleZoom(-62, 150, 700, 36.87)).toBeLessThan(z62);
  });
  it('南緯 62° 以南在 700px 高的畫面上半徑 250px：比全球視角小一級左右', () => {
    // 實際在 6.16 看過：極點正上方 −1 級時整個南極洲在畫面裡
    const z = poleZoom(-62, 250, 700, 36.87);
    expect(z).toBeGreaterThan(-2);
    expect(z).toBeLessThan(0);
  });
});
