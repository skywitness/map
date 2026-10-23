import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
// 失業率、勞參率跟主計總處公布的一樣留兩位小數（台灣 2024 年 3.38%）；非正式就業是調查的調和值，一位就好
const pct2 = (v: number) => `${fixed(v, 2)}%`;
const pct1 = (v: number) => `${fixed(v, 1)}%`;
const tick = (v: number) => `${fixed(v, Number.isInteger(v) ? 0 : 1)}%`;

export const employment: TopicDefinition = {
  id: 'employment',
  title: { zh: '就業與失業', en: 'Employment and unemployment' },
  shortTitle: { zh: '就業與失業', en: 'Jobs' },
  defaultIndicator: 'unemployment',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: '國際勞工組織 ILOSTAT（ILO 模型估計 2025 年 11 月版、非正式就業比例）',
        en: 'International Labour Organization, ILOSTAT (ILO modelled estimates, November 2025; informal employment rate)',
      },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '主計總處 人力資源調查、人力運用調查',
        en: 'DGBAS (Taiwan), Manpower Survey and Manpower Utilization Survey',
      },
      url: 'https://www.stat.gov.tw/cl.aspx?n=2700',
      license: OPEN_DATA_TW,
    },
  ],
  panelExtra: () => import('./panels/EmploymentPanel'),
  note: {
    zh:
      '失業率、青年失業率與勞動力參與率是國際勞工組織的模型估計：有申報勞動力調查的國家用各國的數字，沒有的國家與年份（例如中國、北韓）由模型推算，所以每個國家每年都有值；' +
      '2025 年是 2025 年 11 月時的推估，那時還沒有任何國家的全年資料。' +
      '非正式就業是沒有勞動保障的工作（雇主沒有登記、沒有社會保險或帶薪假，包括多數的自營作業者與無酬家屬工作者），由國際勞工組織用各國勞動力調查的原始資料依同一套定義重新計算，只有約 130 國，美國、日本、中國等都沒有；很多國家隔幾年才調查一次，地圖用每個國家 5 年內最近一年的資料。' +
      '台灣不是國際勞工組織會員，模型估計裡的台灣近幾年是推算的，改用主計總處人力資源調查的數字（不含現役軍人與監管人口）；台灣沒有非正式就業的統計，側欄的附註列出主計總處「非典型就業」的數字對照。',
    en:
      'Unemployment, youth unemployment and labour force participation are ILO modelled estimates: countries that report labour force surveys keep their own figures, and the model fills in the countries and years without data (China and North Korea, for example), so every country has a value every year. ' +
      'The 2025 figures are projections made in November 2025, before any country had full-year data. ' +
      'Informal employment means jobs without labour protection (unregistered employers, no social insurance or paid leave, including most own-account and contributing family workers). The ILO recomputes it from the microdata of national labour force surveys with a common definition; only about 130 countries are covered, not including the United States, Japan or China. Many countries run these surveys only every few years, so the map shows the latest year within five years. ' +
      "Taiwan is not an ILO member and its recent figures in the model are estimates, so Taiwan's figures come from DGBAS's Manpower Survey (which excludes the armed forces and institutionalised people). Taiwan has no statistics on informal employment; the note in the side panel gives DGBAS's figures on atypical employment for comparison.",
  },
  indicators: [
    {
      id: 'unemployment',
      label: { zh: '失業率', en: 'Unemployment rate' },
      description: {
        zh: '15 歲以上的勞動力中，沒有工作、可以馬上工作而且正在找工作的人所占的比例。很多低所得國家沒有失業保險，大多數人必須做點零工維生，失業率反而很低。',
        en: 'Share of the labour force aged 15 and over who have no job, are available to start and are looking for work. Many low-income countries have no unemployment benefits, so most people must take whatever odd jobs they can and measured unemployment is low.',
      },
      unit: '%',
      file: 'unemployment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 7.5, 10, 15, 20] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'youth-unemployment',
      label: { zh: '青年失業率（15–24 歲）', en: 'Youth unemployment (ages 15–24)' },
      description: {
        zh: '15–24 歲的勞動力中失業者的比例。分母只有已經在工作或找工作的年輕人，還在上學、沒有找工作的不算在內。',
        en: 'Share of the labour force aged 15–24 who are unemployed. Only young people who are working or looking for work count; students who are not looking for a job are left out.',
      },
      unit: '%',
      file: 'youth-unemployment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'informal',
      label: { zh: '非正式就業比例', en: 'Informal employment' },
      description: {
        zh: '非正式就業占所有就業者的比例：雇主沒有登記、沒有社會保險或帶薪假的工作，包括多數的自營作業者與無酬家屬工作者（SDG 8.3.1）。約 130 國，台灣沒有這項統計。',
        en: 'Informal jobs as a share of all employment: work for unregistered employers or without social insurance or paid leave, including most own-account and contributing family workers (SDG 8.3.1). About 130 countries; Taiwan has no such statistics.',
      },
      unit: '%',
      file: 'informal.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 75, 90] } },
      format: pct1,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'participation',
      label: { zh: '勞動力參與率', en: 'Labour force participation' },
      description: {
        zh: '15 歲以上人口中，有工作或正在找工作的人的比例。高齡化、年輕人讀書讀得久、女性較少外出工作的國家比較低。',
        en: 'Share of the population aged 15 and over who are working or looking for work. It is lower where the population is older, young people study longer or fewer women work outside the home.',
      },
      unit: '%',
      file: 'participation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [45, 50, 55, 60, 65, 70] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
  ],
};
