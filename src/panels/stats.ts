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

/** 由大到小排序，回傳 [iso3, value] */
export function ranking(values: Map<string, number>): [string, number][] {
  return [...values].sort((a, b) => b[1] - a[1]);
}

export function rankOf(values: Map<string, number>, iso3: string): number | null {
  const v = values.get(iso3);
  if (v === undefined) return null;
  let rank = 1;
  for (const other of values.values()) if (other > v) rank++;
  return rank;
}

export function maxAcrossYears(data: IndicatorData): number {
  let max = 0;
  for (const series of Object.values(data.values)) {
    for (const v of series) if (v != null && v > max) max = v;
  }
  return max;
}
