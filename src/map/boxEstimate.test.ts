import { describe, expect, it } from 'vitest';
import { boxFromCorners } from './boxEstimate';

describe('boxFromCorners（框選）', () => {
  it('兩個角落的順序不影響', () => {
    expect(boxFromCorners([130, 40], [100, 20])).toEqual([100, 20, 130, 40]);
  });

  it('經度差超過 180° 視為跨過 180° 經線', () => {
    expect(boxFromCorners([170, -20], [-170, 10])).toEqual([170, -20, -170, 10]);
  });

  it('緯度夾在 ±90 內', () => {
    expect(boxFromCorners([0, -95], [10, 100])).toEqual([0, -90, 10, 90]);
  });
});
