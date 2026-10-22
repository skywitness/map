import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const YEARS = { zh: '年', en: 'years' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const education: TopicDefinition = {
  id: 'education',
  title: { zh: '各國教育程度', en: 'Education by country' },
  shortTitle: { zh: '教育', en: 'Education' },
  defaultIndicator: 'mean-years-schooling',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'UNDP, Human Development Report 2025（平均受教育年數）',
        en: 'UNDP, Human Development Report 2025 (mean years of schooling)',
      },
      url: 'https://hdr.undp.org/data-center',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（UNESCO 統計研究所資料）',
        en: 'World Bank, World Development Indicators (UNESCO Institute for Statistics data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '教育部統計處 教育統計', en: 'Ministry of Education (Taiwan), education statistics' },
      url: 'https://stats.moe.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部 15 歲以上人口識字率', en: 'Ministry of the Interior (Taiwan), literacy rate of people aged 15 and over' },
      url: 'https://data.gov.tw/dataset/14246',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '台灣不在聯合國與世界銀行的教育資料庫中，改用教育部與內政部的統計，定義見台灣側欄的附註。學年度以開始的那一年標示（2024 = 2024–25 學年度）。',
    en: "Taiwan is not in the UN and World Bank education databases, so statistics from the Ministry of Education and the Ministry of the Interior are used instead; see the notes in Taiwan's panel for definitions. School years are labelled by the year they start (2024 = 2024–25).",
  },
  indicators: [
    {
      id: 'mean-years-schooling',
      label: { zh: '平均受教育年數', en: 'Mean years of schooling' },
      description: {
        zh: '25 歲以上的人平均讀了幾年書，用最高學歷換算。',
        en: 'Average number of years of education of people aged 25 and over, based on their highest level completed.',
      },
      unit: YEARS,
      file: 'mean-years-schooling.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 13] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'tertiary-enrollment',
      label: { zh: '高等教育粗在學率', en: 'Tertiary enrolment (gross)' },
      description: {
        zh: '大專院校（含研究所）的在學人數，除以 18–22 歲的人口。有很多成年學生或留學生的國家會超過 100%。',
        en: 'Students in tertiary education (including graduate school) divided by the population aged 18–22. Countries with many adult or international students can exceed 100%.',
      },
      unit: '%',
      file: 'tertiary-enrollment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 35, 50, 70, 90] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'education-spending',
      label: { zh: '政府教育支出占 GDP', en: 'Government education spending, % of GDP' },
      description: {
        zh: '各級政府花在教育上的經費占國內生產毛額的比例，不含家庭與私校自己出的錢。',
        en: 'Spending on education by all levels of government as a share of GDP, excluding money paid by households and private schools.',
      },
      unit: '%',
      file: 'education-spending.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6, 7] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'literacy',
      label: { zh: '成人識字率', en: 'Adult literacy' },
      description: {
        zh: '15 歲以上能讀寫簡單句子的人所占的比例。很多國家十幾年才調查一次，多數高所得國家已經不統計，所以每年只有幾十個國家有資料。',
        en: 'Share of people aged 15 and over who can read and write a simple sentence. Many countries survey it only every decade or so and most high-income countries no longer measure it, so each year has data for only a few dozen countries.',
      },
      unit: '%',
      file: 'literacy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 70, 80, 90, 95, 99] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
  ],
};
