import type { ChartEvent } from './types';

/**
 * 側欄折線圖上標的事件（2026-10-29 起，指標的 events）：那一年畫一條點線，上緣寫名稱，讓起伏有個對照。
 * 只標影響很大、年份明確的；只跟某些國家有關的寫 countries（一胎化只標在中國的圖上）。
 */
export const COVID: ChartEvent = { year: 2020, label: 'COVID-19' };
/** 雷曼兄弟 2008 年 9 月倒閉；多數國家的經濟成長率在 2009 年掉到谷底 */
export const FINANCIAL_CRISIS: ChartEvent = { year: 2008, label: { zh: '金融海嘯', en: 'Financial crisis' } };
export const FLU_1918: ChartEvent = { year: 1918, label: { zh: '1918 流感', en: '1918 flu' } };

/** 中國的生育政策：1980 年一胎化、2016 年全面二孩、2021 年三孩 */
export const CHINA_BIRTH_POLICY: ChartEvent[] = [
  { year: 1980, label: { zh: '一胎化', en: 'One-child policy' }, countries: ['CHN'] },
  { year: 2016, label: { zh: '全面二孩', en: 'Two-child policy' }, countries: ['CHN'] },
  { year: 2021, label: { zh: '三孩', en: 'Three-child policy' }, countries: ['CHN'] },
];
