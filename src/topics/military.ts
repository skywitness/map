import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const PEOPLE = { zh: '人', en: 'people' };

export const military: TopicDefinition = {
  id: 'military',
  title: { zh: '各國軍費與兵力', en: 'Military spending and armed forces' },
  shortTitle: { zh: '軍事', en: 'Military' },
  defaultIndicator: 'spending',
  defaultYear: 2025,
  sources: [
    {
      name: 'Information from the Stockholm International Peace Research Institute (SIPRI), Military Expenditure Database',
      url: 'https://doi.org/10.55163/CQGC9685',
      license: {
        zh: '依 SIPRI 條款非商業使用，只收錄 2011–2025 年',
        en: 'non-commercial use under SIPRI terms; 2011–2025 only',
      },
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（IISS The Military Balance 兵力資料）',
        en: 'World Bank, World Development Indicators (armed forces data from IISS, The Military Balance)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'SIPRI 資料不是開放授權，依其使用條款只供非商業使用，且只轉載少於資料集 10% 的範圍（軍費與占 GDP 兩項、2011–2025 年）。軍費以當年匯率換算成美元，含國防部以外的軍事相關支出（例如軍人退休金、準軍事部隊）。兵力資料只到 2020 年，不含台灣。',
    en: 'SIPRI data is not openly licensed: under its terms it is for non-commercial use only, and less than 10% of the dataset is reproduced here (spending and share of GDP, 2011–2025). Spending is converted to US dollars at current exchange rates and includes military spending outside the defence ministry (such as military pensions and paramilitary forces). Armed forces data ends in 2020 and does not include Taiwan.',
  },
  indicators: [
    {
      id: 'spending',
      label: { zh: '軍費', en: 'Military spending' },
      description: {
        zh: '一年的軍事支出，以當年匯率換算成美元。圓的面積與軍費成正比。',
        en: 'Military spending in a year, in US dollars at current exchange rates. Circle area is proportional to spending.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'spending.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'spending-gdp',
      label: { zh: '軍費占 GDP', en: 'Military spending, % of GDP' },
      description: {
        zh: '軍事支出占國內生產毛額的比例，可以看出國防負擔的輕重。',
        en: 'Military spending as a share of gross domestic product, a measure of the defence burden.',
      },
      unit: '%',
      file: 'spending-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 4, 6] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'armed-forces',
      label: { zh: '兵力', en: 'Armed forces' },
      description: {
        zh: '現役軍人加上準軍事部隊（例如邊防、憲兵）的人數，不含後備軍人。圓的面積與人數成正比。到 2020 年。',
        en: 'Active-duty military plus paramilitary forces (such as border guards and gendarmerie), excluding reserves. Circle area is proportional to personnel. Up to 2020.',
      },
      unit: PEOPLE,
      file: 'armed-forces.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: (v) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'armed-forces-labor',
      label: { zh: '兵力占勞動力', en: 'Armed forces, % of labour force' },
      description: {
        zh: '軍人與準軍事人員占全國勞動力（有工作或在找工作的人）的比例。到 2020 年。',
        en: 'Military and paramilitary personnel as a share of the labour force (people working or looking for work). Up to 2020.',
      },
      unit: '%',
      file: 'armed-forces-labor.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 1.5, 2.5, 4] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
  ],
};
