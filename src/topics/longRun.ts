/**
 * 人口、人均收入、健康主題「1800 年起」的指標共用的資料來源與說明（Gapminder fasttrack，pipeline/topics/long_run.py）。
 * 授權條款規定「GAPMINDER」只能出現在引用文字：來源名稱就是它要求的引用（改過的資料的寫法），指標名稱不寫（DESIGN.md 第 8 節第 98 點）。
 */
import type { SourceDef } from './types';

export const LONG_RUN_SOURCE: SourceDef = {
  name: {
    zh: 'Based on free material from GAPMINDER.ORG, CC-BY LICENSE（1800 年起的長期資料）',
    en: 'Based on free material from GAPMINDER.ORG, CC-BY LICENSE (long-run data from 1800)',
  },
  url: 'https://www.gapminder.org/data/',
  license: 'CC BY 4.0',
};

/** 指標說明的後半段：1950 年以前多半是估計、國界是今天的範圍 */
export const LONG_RUN_CAVEAT = {
  zh: '1950 年以前多半是歷史研究的估計或內插；國界是今天的國家，1800 年的德國、印度是今天的範圍回推。',
  en: "Values before 1950 are mostly historical estimates or interpolations. Borders are today's: Germany or India in 1800 means the area of today's country.",
};
