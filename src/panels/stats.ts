import type { IndicatorData } from '../topics/types';

/** 某年所有國家的數值（只含有資料的） */
export function valuesAt(data: IndicatorData, yearIndex: number): Map<string, number> {
  const out = new Map<string, number>();
  if (yearIndex < 0) return out;
  for (const [iso3, series] of Object.entries(data.values)) {
    const v = series[yearIndex];
    if (v != null) out.set(iso3, v);
  }
  return out;
}

/**
 * 某年各國的值；指標檔有 latestWithin 時，沒有當年資料的國家改用 latestWithin 年內最近一年的值。
 * years 只記「資料年份不是 years[yearIndex]」的國家，畫面上據此標出資料年份。
 */
export function latestAt(data: IndicatorData, yearIndex: number): { values: Map<string, number>; years: Map<string, number> } {
  const values = valuesAt(data, yearIndex);
  const years = new Map<string, number>();
  const within = data.latestWithin;
  if (!within || yearIndex < 0) return { values, years };
  const year = data.years[yearIndex];
  for (const [iso3, series] of Object.entries(data.values)) {
    if (values.has(iso3)) continue;
    for (let i = yearIndex - 1; i >= 0 && year - data.years[i] <= within; i--) {
      const v = series[i];
      if (v != null) {
        values.set(iso3, v);
        years.set(iso3, data.years[i]);
        break;
      }
    }
  }
  return { values, years };
}

/** 由大到小排序（ascending 時由小到大），回傳 [iso3, value] */
export function ranking(values: Map<string, number>, ascending = false): [string, number][] {
  return [...values].sort((a, b) => (ascending ? a[1] - b[1] : b[1] - a[1]));
}

/** 名次：預設數值越大越前面；ascending（數值越小越好的指標）時數值越小越前面 */
export function rankOf(values: Map<string, number>, iso3: string, ascending = false): number | null {
  const v = values.get(iso3);
  if (v === undefined) return null;
  let rank = 1;
  for (const other of values.values()) if (ascending ? other < v : other > v) rank++;
  return rank;
}

/** ranking() 排好的各列的名次：同值同名次（1、2、2、4），跟側欄的 rankOf 一致 */
export function rowRanks(rows: [string, number][]): number[] {
  const ranks: number[] = [];
  rows.forEach(([, v], i) => ranks.push(i > 0 && v === rows[i - 1][1] ? ranks[i - 1] : i + 1));
  return ranks;
}

export function maxAcrossYears(data: IndicatorData): number {
  let max = 0;
  for (const series of Object.values(data.values)) {
    for (const v of series) if (v != null && v > max) max = v;
  }
  return max;
}
