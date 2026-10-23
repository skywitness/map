import { getLang } from '../i18n/lang';
import { latestAt } from '../panels/stats';
import type { IndicatorData } from '../topics/types';
import { enName, zhName, type CountryTable } from './countries';

/** CSV 欄名：中文版有國名與英文名兩欄，英文版只有英文名 */
const HEADERS = {
  zh: { name: ['國名', '英文名'], unit: '單位', note: '附註', world: ['世界', 'World'], projected: '（推估）', dataYear: '資料年份' },
  en: { name: ['Country'], unit: 'Unit', note: 'Note', world: ['World'], projected: ' (projection)', dataYear: 'Data year' },
};

/**
 * 指標資料轉成 CSV：每列一個國家，欄位是 ISO3、國名（中文版另有英文名）、單位，接著是年份。欄名跟著介面語言。
 * - 開頭加 UTF-8 BOM、換行用 CRLF，Excel 直接開啟時中文才不會變亂碼。
 * - 數值保留原始精度、不加千分位、不換算成「萬」「億」，試算表才能直接計算。
 * - 推估值的年份在欄名標示「（推估）」；世界合計放在最後一列。
 * - 年份零散的指標（latestWithin）匯出單一年份時，跟地圖一樣用之前最近一年的值，另加一欄「資料年份」；
 *   所有年份只輸出實際有的值。
 */
export function indicatorCsv(
  data: IndicatorData,
  options: {
    unit: string;
    countries: CountryTable | null;
    /** 只輸出這一年；不給就輸出所有年份 */
    year?: number;
    /** 類別圖：輸出類別名稱（indicator.format）而不是代碼 */
    label?: (value: number) => string;
    /** 數值越小越好的指標：單一年份由小排到大（跟排名表一樣） */
    ascending?: boolean;
  },
): string {
  const { unit, countries, year, label, ascending } = options;
  const lang = getLang();
  const h = HEADERS[lang];
  const columns = year === undefined ? data.years.map((_, i) => i) : [data.years.indexOf(year)].filter((i) => i >= 0);
  const yearHeader = (i: number) => {
    const y = data.years[i];
    return data.projectionFrom !== undefined && y >= data.projectionFrom ? `${y}${h.projected}` : String(y);
  };
  const notes = lang === 'en' ? data.notesEn : data.notes;
  const hasNotes = Boolean(notes && Object.keys(notes).length);

  const names = (iso3: string) =>
    lang === 'en' ? [enName(iso3, countries)] : [zhName(iso3, countries), enName(iso3, countries)];
  const sortName = (iso3: string) => names(iso3)[0];
  let codes = Object.keys(data.values).sort((a, b) =>
    sortName(a).localeCompare(sortName(b), lang === 'en' ? 'en' : 'zh-Hant-TW'),
  );
  const latest = columns.length === 1 && data.latestWithin ? latestAt(data, columns[0]) : null;
  const value = (iso3: string, i: number) => (latest ? latest.values.get(iso3) : data.values[iso3][i]);
  if (columns.length === 1) {
    // 單一年份：依數值由大到小，跟排名表一樣；沒有資料的國家排最後
    const i = columns[0];
    const v = (iso3: string) => value(iso3, i) ?? (ascending ? Infinity : -Infinity);
    // 類別沒有大小，維持依國名排
    if (!label) codes = [...codes].sort((a, b) => (ascending ? v(a) - v(b) : v(b) - v(a)));
  }

  const rows: (string | number | null | undefined)[][] = [
    [
      'ISO3', ...h.name, h.unit, ...columns.map(yearHeader),
      ...(latest ? [h.dataYear] : []), ...(hasNotes ? [h.note] : []),
    ],
  ];
  for (const iso3 of codes) {
    const v = value(iso3, columns[0]);
    rows.push([
      iso3,
      ...names(iso3),
      unit,
      ...columns.map((i) => {
        const x = value(iso3, i);
        return label && x != null ? label(x) : x;
      }),
      ...(latest ? [v == null ? '' : (latest.years.get(iso3) ?? data.years[columns[0]])] : []),
      ...(hasNotes ? [notes?.[iso3]] : []),
    ]);
  }
  const world = data.aggregates?.WLD;
  if (world) {
    rows.push([
      'WLD', ...h.world, unit, ...columns.map((i) => world[i]), ...(latest ? [''] : []), ...(hasNotes ? [''] : []),
    ]);
  }

  return `﻿${rows.map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

function csvField(value: string | number | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
