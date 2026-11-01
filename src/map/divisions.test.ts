import { describe, expect, it } from 'vitest';
import {
  divisionBounds,
  divisionCountry,
  divisionLevel,
  divisionName,
  divisionParent,
  divisionView,
  toDivision,
  type DivisionRow,
  type DivisionsModel,
} from './divisions';

const ROWS1: DivisionRow[] = [
  ['TWN-63000', '臺北市', 'Taipei City', '直轄市', null, 272, [121.457, 24.96, 121.666, 25.21], [121.56, 25.06]],
  ['TWN-09007', '連江縣', 'Lienchiang County', '縣', null, 29, [119.9, 25.93, 120.51, 26.39], [119.95, 26.15]],
];
const ROWS2: DivisionRow[] = [
  ['TWN-63000-010', '松山區', 'Songshan District', '區', null, 9, [121.54, 25.04, 121.58, 25.07], [121.56, 25.05], 'TWN-63000'],
  ['TWN-63000-020', '信義區', 'Xinyi District', '區', null, 11, [121.55, 25.01, 121.6, 25.05], [121.57, 25.03], 'TWN-63000'],
];

function model(): DivisionsModel {
  const level1 = ROWS1.map(toDivision);
  const kids = ROWS2.map(toDivision);
  return {
    file: { sources: [], tiles2: 'divisions2-asia', u1: ROWS1, u2: ROWS2 },
    byId: new Map([...level1, ...kids].map((d) => [d.id, d])),
    level1,
    children: new Map([['TWN-63000', kids]]),
  };
}

describe('行政區的 id', () => {
  it('層級、國家、上一層', () => {
    expect(divisionLevel('TWN')).toBe(0);
    expect(divisionLevel('TWN-63000')).toBe(1);
    expect(divisionLevel('TWN-63000-010')).toBe(2);
    expect(divisionCountry('TWN-63000-010')).toBe('TWN');
    expect(divisionParent('TWN-63000-010')).toBe('TWN-63000');
    expect(divisionParent('TWN-63000')).toBe('TWN');
    expect(divisionParent('TWN')).toBeNull();
  });
});

describe('行政區的資料', () => {
  it('國家的範圍是所有第一級合起來，第一級、第二級用自己的', () => {
    const m = model();
    expect(divisionBounds(m, 'TWN')).toEqual([119.9, 24.96, 121.666, 26.39]);
    expect(divisionBounds(m, 'TWN-63000')).toEqual([121.457, 24.96, 121.666, 25.21]);
    expect(divisionBounds(m, 'TWN-63000-020')).toEqual([121.55, 25.01, 121.6, 25.05]);
  });

  it('地圖上寫的名稱：國家寫第一級，選了第一級寫它裡面的第二級，大的在前', () => {
    const m = model();
    const country = divisionView(m, 'TWN', 'zh');
    expect(country).toMatchObject({ country: 'TWN', level1: null, level2: null, tiles2: 'divisions2-asia' });
    expect(country.labels.map((l) => l.name)).toEqual(['臺北市', '連江縣']);
    const city = divisionView(m, 'TWN-63000-010', 'en');
    expect(city).toMatchObject({ level1: 'TWN-63000', level2: 'TWN-63000-010' });
    expect(city.labels.map((l) => l.name)).toEqual(['Xinyi District', 'Songshan District']);
  });

  it('沒有中文名稱時用英文', () => {
    const d = toDivision(['FRA-r1', null, 'Île-de-France', null, 'Region', 12011, [1, 48, 3, 49], [2.5, 48.7]]);
    expect(divisionName(d, 'zh')).toBe('Île-de-France');
  });
});
