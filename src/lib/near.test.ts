import { describe, expect, it } from 'vitest';
import { setLang } from '../i18n/lang';
import { nearPoints, nearText, weightedPick } from './near';

describe('nearPoints（城4：這一點附近的點）', () => {
  const taipei: [number, number] = [121.5625, 25.0375];
  const points = [
    { lon: 121.4329, lat: 25.1753, n: '紅毛城' },
    { lon: 121.7398, lat: 25.1566, n: '大武崙砲台' },
    { lon: 120.1606, lat: 23.0015, n: '安平古堡' },
  ];
  it('只留 km 以內的，由近到遠，加上距離與方位', () => {
    const near = nearPoints(points, taipei, 100);
    expect(near.map((p) => p.n)).toEqual(['紅毛城', '大武崙砲台']);
    expect(near[0]._km).toBeGreaterThan(18);
    expect(near[0]._km).toBeLessThan(22);
    // 紅毛城在台北的西北方
    expect(near[0]._brg).toBeGreaterThan(292);
    expect(near[0]._brg).toBeLessThan(338);
  });
  it('寫成「西北 20 公里」', () => {
    setLang('zh');
    const [p] = nearPoints(points, taipei, 100);
    expect(nearText(p)).toMatch(/^西北 \d+ 公里$/);
    setLang('en');
    expect(nearText(p)).toMatch(/^\d+ km NW$/);
    setLang('zh');
  });
});

describe('weightedPick（城7：隨機看一個）', () => {
  it('依權重挑；權重 0 的不挑', () => {
    const items = [{ w: 0 }, { w: 1 }, { w: 3 }];
    expect(weightedPick(items, (x) => x.w, () => 0)).toBe(items[1]);
    expect(weightedPick(items, (x) => x.w, () => 0.3)).toBe(items[2]);
    expect(weightedPick(items, (x) => x.w, () => 0.999)).toBe(items[2]);
  });
  it('沒有點、權重都是 0 時是 null', () => {
    expect(weightedPick([], () => 1)).toBeNull();
    expect(weightedPick([{ w: 0 }], (x) => x.w)).toBeNull();
  });
});
