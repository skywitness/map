import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;

export const education: TopicDefinition = {
  id: 'education',
  title: '各國教育程度',
  shortTitle: '教育',
  defaultIndicator: 'mean-years-schooling',
  defaultYear: 2023,
  sources: [
    { name: 'UNDP, Human Development Report 2025（平均受教育年數）', url: 'https://hdr.undp.org/data-center', license: 'CC BY 3.0 IGO' },
    { name: 'World Bank, World Development Indicators（UNESCO 統計研究所資料）', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    { name: '教育部統計處 教育統計', url: 'https://stats.moe.gov.tw/', license: '政府資料開放授權條款' },
    { name: '內政部 15 歲以上人口識字率', url: 'https://data.gov.tw/dataset/14246', license: '政府資料開放授權條款' },
  ],
  note: '台灣不在聯合國與世界銀行的教育資料庫中，改用教育部與內政部的統計，定義見台灣側欄的附註。學年度以開始的那一年標示（2024 = 2024–25 學年度）。',
  indicators: [
    {
      id: 'mean-years-schooling',
      label: '平均受教育年數',
      description: '25 歲以上的人平均讀了幾年書，用最高學歷換算。',
      unit: '年',
      file: 'mean-years-schooling.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 13] } },
      format: (v) => `${fixed(v, 1)} 年`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'tertiary-enrollment',
      label: '高等教育粗在學率',
      description: '大專院校（含研究所）的在學人數，除以 18–22 歲的人口。有很多成年學生或留學生的國家會超過 100%。',
      unit: '%',
      file: 'tertiary-enrollment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 35, 50, 70, 90] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'education-spending',
      label: '政府教育支出占 GDP',
      description: '各級政府花在教育上的經費占國內生產毛額的比例，不含家庭與私校自己出的錢。',
      unit: '%',
      file: 'education-spending.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6, 7] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'literacy',
      label: '成人識字率',
      description: '15 歲以上能讀寫簡單句子的人所占的比例。很多國家十幾年才調查一次，多數高所得國家已經不統計，所以每年只有幾十個國家有資料。',
      unit: '%',
      file: 'literacy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 70, 80, 90, 95, 99] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
  ],
};
