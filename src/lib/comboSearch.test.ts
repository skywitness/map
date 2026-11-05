import { describe, expect, it } from 'vitest';
import { parseCombo } from './comboSearch';
import type { CountryTable } from './countries';
import { buildSearchIndex } from './countrySearch';

const table: CountryTable = {
  JPN: { iso2: 'JP', name: 'Japan' },
  IND: { iso2: 'IN', name: 'India' },
  TWN: { iso2: 'TW', name: 'Taiwan' },
  USA: { iso2: 'US', name: 'United States of America' },
};
const index = buildSearchIndex(Object.keys(table), table);
const parse = (q: string) => {
  const c = parseCombo(q, index);
  return c && { topic: c.topic?.entry.target.topic ?? null, iso3: c.iso3, year: c.year };
};

describe('parseCombo（指令面板的組合搜尋）', () => {
  it('拆出主題、國家與年份，中文不必空格', () => {
    expect(parse('日本 2010 人口')).toEqual({ topic: 'population', iso3: 'JPN', year: 2010 });
    expect(parse('人口日本2010年')).toEqual({ topic: 'population', iso3: 'JPN', year: 2010 });
    expect(parse('japan 2010 population')).toEqual({ topic: 'population', iso3: 'JPN', year: 2010 });
  });

  it('只有國家與年份時是目前的主題；只有年份也可以', () => {
    expect(parse('印度 1990')).toEqual({ topic: null, iso3: 'IND', year: 1990 });
    expect(parse('2015')).toEqual({ topic: null, iso3: null, year: 2015 });
  });

  it('英文國名要是完整的字；只有國家時不給（一般的國家搜尋就是）', () => {
    expect(parse('india')).toBeNull();
    expect(parse('indiana 2010')?.iso3 ?? null).toBeNull();
  });

  it('剩下的字比對不到主題時不給', () => {
    expect(parse('日本 2010 qwxz')).toBeNull();
  });
});
