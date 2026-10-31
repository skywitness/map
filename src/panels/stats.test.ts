import { describe, expect, it } from 'vitest';
import type { IndicatorData } from '../topics/types';
import { latestAt, maxAcrossYears, rankOf, ranking, rowRanks, valuesAt } from './stats';

const data = {
  years: [2000, 2005, 2010],
  values: { TWN: [1, null, 3], JPN: [5, 6, null], KOR: [null, null, null] },
} as unknown as IndicatorData;

describe('valuesAt / latestAt', () => {
  it('只有那一年有值的國家', () => {
    expect([...valuesAt(data, 2)]).toEqual([['TWN', 3]]);
  });

  it('latestWithin：沒有當年的值時用幾年內最近的一年，並記下資料年份', () => {
    const within = { ...data, latestWithin: 5 } as IndicatorData;
    const { values, years } = latestAt(within, 2);
    expect(values.get('JPN')).toBe(6);
    expect(years.get('JPN')).toBe(2005);
    expect(values.has('KOR')).toBe(false);
  });

  it('超過 latestWithin 年就不用', () => {
    const within = { ...data, latestWithin: 4 } as IndicatorData;
    expect(latestAt(within, 2).values.has('JPN')).toBe(false);
  });
});

describe('名次', () => {
  const values = new Map([
    ['A', 10],
    ['B', 7],
    ['C', 7],
    ['D', 1],
  ]);

  it('同分同名次（1、2、2、4）', () => {
    expect(rowRanks(ranking(values))).toEqual([1, 2, 2, 4]);
    expect(rankOf(values, 'C')).toBe(2);
    expect(rankOf(values, 'D')).toBe(4);
  });

  it('數值越小越好的指標', () => {
    expect(rankOf(values, 'D', true)).toBe(1);
    expect(ranking(values, true)[0]).toEqual(['D', 1]);
  });

  it('沒有值的國家沒有名次', () => {
    expect(rankOf(values, 'TWN')).toBeNull();
  });

  it('歷年的最大值', () => {
    expect(maxAcrossYears(data)).toBe(6);
  });
});
