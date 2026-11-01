import { describe, expect, it } from 'vitest';
import { pointAt, unwrapLongitudes } from './routeAnimation';

describe('unwrapLongitudes', () => {
  it('跨過 180° 經線時接成連續的經度', () => {
    expect(unwrapLongitudes([[170, 10], [179, 11], [-178, 12], [-170, 13]])).toEqual([[170, 10], [179, 11], [182, 12], [190, 13]]);
  });
});

describe('pointAt', () => {
  const line: [number, number][] = [[0, 0], [10, 0], [10, 10]];
  it('依頂點的順序等速：一半在第二個頂點', () => {
    expect(pointAt(line, 0.5)).toEqual({ at: [10, 0], index: 1 });
  });
  it('兩個頂點之間內插、頭尾夾在範圍內', () => {
    expect(pointAt(line, 0.25).at).toEqual([5, 0]);
    expect(pointAt(line, 1).at).toEqual([10, 10]);
    expect(pointAt(line, -1).at).toEqual([0, 0]);
  });
});
