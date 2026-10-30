/**
 * 年份與子項目選單的小工具（App.tsx，2026-10-29 拆出來）。
 */
import { LOCALES, type Lang } from '../i18n';
import type { Indicator } from '../topics/types';

/**
 * 網址指定的年份 → 主題預設年份 → 資料中最接近預設年份的一年。
 * bin 是每筆資料涵蓋的年數（每十年一筆的指標：1990 = 1990–1999），這時取包含那一年的那一筆：
 * 從「當年的地震」的 1999 年換到「每十年的地震次數」，留在 1990 年代，不會跳到 2000 年代。
 */
export function pickYear(years: number[], wanted: number | null, fallback: number, bin?: number): number {
  if (wanted !== null && years.includes(wanted)) return wanted;
  const containing = bin ? years.findLast((y) => y <= (wanted ?? fallback) && (wanted ?? fallback) < y + bin) : undefined;
  if (containing !== undefined) return containing;
  // 年份不連續（每 5 年一筆）時，拖到中間沒有資料的年份就用最接近的那一年（一樣近取較早的）
  if (wanted !== null && wanted > years[0] && wanted < years[years.length - 1]) {
    return years.reduce((best, y) => (Math.abs(y - wanted) < Math.abs(best - wanted) ? y : best), years[0]);
  }
  if (years.includes(fallback)) return fallback;
  return years.reduce((best, y) => (Math.abs(y - fallback) < Math.abs(best - fallback) ? y : best), years[0]);
}

/**
 * 子項目選單依 group 分組，組的順序照第一次出現的順序。
 * sortIn 是語言時，各組裡依目前語言的名稱排序：子項目是國家的選單（護照）中文依筆畫、英文依字母，
 * 其他子項目（農產品…）照主題寫的順序。
 */
export function groupOptions<T extends { group?: string; label: string }>(options: T[], sortIn: Lang | null): [string | undefined, T[]][] {
  const groups = new Map<string | undefined, T[]>();
  for (const o of options) {
    const list = groups.get(o.group) ?? [];
    list.push(o);
    groups.set(o.group, list);
  }
  if (sortIn) {
    const collator = new Intl.Collator(LOCALES[sortIn]);
    for (const list of groups.values()) list.sort((a, b) => collator.compare(a.label, b.label));
  }
  return [...groups];
}

/** 分析檢視（src/analysis/）用得到的指標：面量圖、比例圓、類別圖，而且是資料檔（不是在瀏覽器裡算的） */
export function canAnalyse(indicator: Indicator): boolean {
  const kind = indicator.layer.kind;
  return !indicator.derive && (kind === 'choropleth' || kind === 'bubble' || kind === 'categorical');
}
