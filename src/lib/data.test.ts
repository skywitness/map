import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IndicatorData } from '../topics/types';
import { decode } from './data';

describe('decode（指標檔的差分編碼）', () => {
  it('第一個數是十進位指數，之後是跟前一個非 null 值的差', () => {
    const out = decode({ indicator: 'x', years: [2000, 2001, 2002, 2003], encoding: 'delta', values: { TWN: [-1, 12, 3, null, -5] } });
    expect(out).toEqual({ indicator: 'x', years: [2000, 2001, 2002, 2003], values: { TWN: [1.2, 1.5, null, 1] } });
  });

  it('正的指數是乘', () => {
    expect((decode({ encoding: 'delta', values: { USA: [3, 5, 1] } }) as IndicatorData).values.USA).toEqual([5000, 6000]);
  });

  it('aggregates 也還原', () => {
    const out = decode({ encoding: 'delta', values: {}, aggregates: { WLD: [0, 10, -2] } }) as IndicatorData;
    expect(out.aggregates?.WLD).toEqual([10, 8]);
  });

  it('沒有 encoding 的檔案原樣回傳', () => {
    const json = { years: [1], values: { JPN: [1.5] } };
    expect(decode(json)).toBe(json);
  });

  it('真的資料檔：每個序列跟 years 一樣長', () => {
    const raw = JSON.parse(readFileSync('public/data/topics/logbooks/ships-uk.json', 'utf8'));
    const data = decode(raw) as IndicatorData;
    expect(Object.keys(data.values)).toEqual(['GBR']);
    expect(data.values.GBR).toHaveLength(data.years.length);
    for (const v of data.values.GBR) if (v !== null) expect(Number.isInteger(v)).toBe(true);
  });
});
