import { describe, expect, it } from 'vitest';
import { nationType, SHIP_VIEWS, viewTypes, voyagesOverlay } from './logbooks';

describe('航海日誌的指標（只看某一國的船）', () => {
  it('全部的船用原本的圖層，不篩分類', () => {
    expect(voyagesOverlay('ships')).toBe('voyages');
    expect(viewTypes('ships')).toBeNull();
  });

  it('英、荷、西、法各一類，其他四國併成一類', () => {
    expect(viewTypes('ships-uk')).toEqual([0]);
    expect(viewTypes('ships-fr')).toEqual([3]);
    expect(viewTypes('ships-other')).toEqual([4]);
    expect(nationType(7)).toBe(4);
    expect(nationType(2)).toBe(2);
  });

  it('每個指標的圖層 id 不重複', () => {
    const ids = SHIP_VIEWS.map((v) => v.overlay);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
