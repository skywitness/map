import { tr } from '../i18n/lang';
import type { CategoryDef } from './types';

/**
 * 月份的類別（1–12）與顏色：出生的季節（出生最多的月份）與教育的開學月份共用。
 */

/**
 * 1–12 月的顏色：北半球的四季各一個色系、每季由淺到深（冬 12–2 月紫、春 3–5 月綠、夏 6–8 月黃到橘褐、秋 9–11 月紅），
 * 月份超過類別色的 8 色，用色系＋深淺兩種編碼（2026-10-29 用 dataviz 的配色驗證工具檢查：淺色模式相鄰月份
 * 一般視覺 ΔE ≥ 15、色盲模擬 ≥ 12.6；跟背景對比不到 3:1 的淺色由圖例、tooltip 與排名表的文字補）
 */
const MONTH_COLORS = [
  '#9171cf', '#5043a3', '#9bc264', '#369e4e', '#006a48', '#c1b72c',
  '#c97000', '#9f3c1a', '#e88d94', '#ce514f', '#8c352a', '#d09ce0',
];
export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTHS: (CategoryDef & { color: string })[] = MONTH_COLORS.map((color, i) => ({
  value: i + 1,
  label: { zh: `${i + 1} 月`, en: MONTH_NAMES_EN[i] },
  color,
}));

export const monthLabel = (v: number) => {
  const m = MONTHS.find((c) => c.value === v);
  return m ? tr(m.label) : '';
};

