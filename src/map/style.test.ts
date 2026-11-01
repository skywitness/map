import { describe, expect, it } from 'vitest';
import { scaleTextSize } from './style';

describe('scaleTextSize', () => {
  it('數字、interpolate、step 的輸出值與舊的 stops 寫法都乘上倍數，縮放級數不變', () => {
    expect(scaleTextSize(10, 1.2)).toBe(12);
    expect(scaleTextSize(['interpolate', ['linear'], ['zoom'], 0, 10, 3, 12, 4, 14], 1.2)).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      12,
      3,
      14.4,
      4,
      16.8,
    ]);
    expect(scaleTextSize(['step', ['zoom'], 10, 5, 14], 1.5)).toEqual(['step', ['zoom'], 15, 5, 21]);
    expect(scaleTextSize({ stops: [[0, 10], [6, 12]] }, 1.2)).toEqual({ stops: [[0, 12], [6, 14.4]] });
  });

  it('看不懂的運算式照舊', () => {
    const expr = ['get', 'size'];
    expect(scaleTextSize(expr, 1.2)).toBe(expr);
  });
});
