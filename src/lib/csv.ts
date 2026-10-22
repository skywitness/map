import type { IndicatorData } from '../topics/types';
import { enName, zhName, type CountryTable } from './countries';

/**
 * 指標資料轉成 CSV：每列一個國家，欄位是 ISO3、國名、英文名、單位，接著是年份。
 * - 開頭加 UTF-8 BOM、換行用 CRLF，Excel 直接開啟時中文才不會變亂碼。
 * - 數值保留原始精度、不加千分位、不換算成「萬」「億」，試算表才能直接計算。
 * - 推估值的年份在欄名標示「（推估）」；世界合計放在最後一列。
 */
export function indicatorCsv(
  data: IndicatorData,
  options: { unit: string; countries: CountryTable | null; /** 只輸出這一年；不給就輸出所有年份 */ year?: number },
): string {
  const { unit, countries, year } = options;
  const columns = year === undefined ? data.years.map((_, i) => i) : [data.years.indexOf(year)].filter((i) => i >= 0);
  const yearHeader = (i: number) => {
    const y = data.years[i];
    return data.projectionFrom !== undefined && y >= data.projectionFrom ? `${y}（推估）` : String(y);
  };
  const hasNotes = Boolean(data.notes && Object.keys(data.notes).length);

  const name = (iso3: string) => zhName(iso3, countries);
  let codes = Object.keys(data.values).sort((a, b) => name(a).localeCompare(name(b), 'zh-Hant-TW'));
  if (columns.length === 1) {
    // 單一年份：依數值由大到小，跟排名表一樣；沒有資料的國家排最後
    const i = columns[0];
    const v = (iso3: string) => data.values[iso3][i] ?? -Infinity;
    codes = [...codes].sort((a, b) => v(b) - v(a));
  }

  const rows: (string | number | null | undefined)[][] = [
    ['ISO3', '國名', '英文名', '單位', ...columns.map(yearHeader), ...(hasNotes ? ['附註'] : [])],
  ];
  for (const iso3 of codes) {
    rows.push([
      iso3,
      name(iso3),
      enName(iso3, countries),
      unit,
      ...columns.map((i) => data.values[iso3][i]),
      ...(hasNotes ? [data.notes?.[iso3]] : []),
    ]);
  }
  const world = data.aggregates?.WLD;
  if (world) rows.push(['WLD', '世界', 'World', unit, ...columns.map((i) => world[i]), ...(hasNotes ? [''] : [])]);

  return `\uFEFF${rows.map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

function csvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
