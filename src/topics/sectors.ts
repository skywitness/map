import { fixed } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

function share(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${v}%`,
    compareWorld: true,
  };
}

export const DGBAS_SOURCE = {
  name: { zh: '行政院主計總處 總體統計資料庫', en: 'DGBAS (Taiwan), National Statistics Database' },
  url: 'https://nstatdb.dgbas.gov.tw/',
  license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
};

export const sectors: TopicDefinition = {
  id: 'sectors',
  title: { zh: '各國產業結構', en: 'Economic structure by country' },
  shortTitle: { zh: '產業結構', en: 'Economy' },
  defaultIndicator: 'services',
  defaultYear: 2022,
  sources: [
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    DGBAS_SOURCE,
  ],
  note: {
    zh: '台灣資料由行政院主計總處的各業 GDP 與就業人數計算。三業占 GDP 的比重加總略小於 100%，差額是產品稅。',
    en: "Taiwan's figures are calculated from DGBAS GDP and employment by industry. The three sectors' shares of GDP add up to slightly less than 100%; the difference is taxes on products.",
  },
  panelExtra: () => import('./panels/SectorsPanel'),
  indicators: [
    share(
      'agriculture',
      { zh: '農業占 GDP', en: 'Agriculture, % of GDP' },
      {
        zh: '農、林、漁、牧業的附加價值占 GDP 的比例。',
        en: 'Value added by agriculture, forestry, fishing and livestock as a share of GDP.',
      },
      [2, 5, 10, 15, 25, 40],
    ),
    share(
      'industry',
      { zh: '工業占 GDP', en: 'Industry, % of GDP' },
      {
        zh: '工業（製造、礦業、水電燃氣、營造）的附加價值占 GDP 的比例。',
        en: 'Value added by industry (manufacturing, mining, utilities and construction) as a share of GDP.',
      },
      [10, 20, 25, 30, 40, 50],
    ),
    share(
      'manufacturing',
      { zh: '製造業占 GDP', en: 'Manufacturing, % of GDP' },
      {
        zh: '製造業的附加價值占 GDP 的比例，是工業的一部分。',
        en: 'Value added by manufacturing, a part of industry, as a share of GDP.',
      },
      [5, 10, 15, 20, 25, 30],
    ),
    share(
      'services',
      { zh: '服務業占 GDP', en: 'Services, % of GDP' },
      {
        zh: '批發零售、金融、運輸、醫療、教育等服務業的附加價值占 GDP 的比例。',
        en: 'Value added by services such as trade, finance, transport, health and education as a share of GDP.',
      },
      [30, 40, 50, 60, 70, 80],
    ),
    share(
      'employment-agriculture',
      { zh: '農業就業占比', en: 'Employment in agriculture' },
      {
        zh: '在農、林、漁、牧業工作的人占就業人口的比例。',
        en: 'Share of employed people working in agriculture, forestry, fishing and livestock.',
      },
      [2, 5, 10, 20, 40, 60],
    ),
    share(
      'employment-industry',
      { zh: '工業就業占比', en: 'Employment in industry' },
      { zh: '在工業部門工作的人占就業人口的比例。', en: 'Share of employed people working in industry.' },
      [10, 15, 20, 25, 30, 35],
    ),
    share(
      'employment-services',
      { zh: '服務業就業占比', en: 'Employment in services' },
      { zh: '在服務業工作的人占就業人口的比例。', en: 'Share of employed people working in services.' },
      [20, 35, 50, 60, 70, 80],
    ),
  ],
};
