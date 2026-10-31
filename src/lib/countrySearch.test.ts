import { describe, expect, it } from 'vitest';
import type { CountryTable } from './countries';
import { buildSearchIndex, normalize, searchCountries } from './countrySearch';

const table: CountryTable = {
  TWN: { iso2: 'TW', name: 'Taiwan' },
  KOR: { iso2: 'KR', name: 'Korea, Republic of' },
  PRK: { iso2: 'KP', name: "Korea, Democratic People's Republic of" },
  USA: { iso2: 'US', name: 'United States of America' },
  CIV: { iso2: 'CI', name: "Côte d'Ivoire" },
};
const index = buildSearchIndex(Object.keys(table), table);
const top = (q: string, lang: 'zh' | 'en' = 'zh') => searchCountries(index, q, lang)[0]?.entry.iso3;

describe('normalize', () => {
  it('小寫、去重音、全形轉半形、簡轉繁、臺→台', () => {
    expect(normalize('Côte d’Ivoire')).toBe('cote d ivoire');
    expect(normalize('ＴＡＩＷＡＮ')).toBe('taiwan');
    expect(normalize('韩国')).toBe('韓國');
    expect(normalize('臺灣')).toBe('台灣');
  });
});

describe('searchCountries', () => {
  it('中文、英文、ISO 代碼都找得到', () => {
    expect(top('臺灣')).toBe('TWN');
    expect(top('taiwan', 'en')).toBe('TWN');
    expect(top('tw')).toBe('TWN');
    expect(top('usa')).toBe('USA');
  });

  it('英文單字的開頭也算（korea 找到南北韓）', () => {
    const hits = searchCountries(index, 'korea', 'en').map((h) => h.entry.iso3);
    expect(hits).toContain('KOR');
    expect(hits).toContain('PRK');
  });

  it('簡體字、沒有重音符號也找得到', () => {
    expect(top('韩国')).toBe('KOR');
    expect(top('cote divoire', 'en')).toBe('CIV');
  });

  it('空字串沒有結果', () => {
    expect(searchCountries(index, '  ')).toEqual([]);
  });
});
