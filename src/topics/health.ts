import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const perThousand = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}‰`;
const YEARS = { zh: '歲', en: 'years' };
const PER_1000 = { zh: '人/千人', en: 'per 1,000 people' };

export const health: TopicDefinition = {
  id: 'health',
  title: { zh: '各國健康與醫療', en: 'Health by country' },
  shortTitle: { zh: '健康', en: 'Health' },
  defaultIndicator: 'life-expectancy',
  defaultYear: 2023,
  sources: [
    {
      name: 'United Nations, World Population Prospects 2024',
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（WHO 醫療支出與醫師資料）',
        en: 'World Bank, World Development Indicators (WHO health spending and physician data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部統計處', en: 'Ministry of Health and Welfare (Taiwan), Department of Statistics' },
      url: 'https://dep.mohw.gov.tw/dos/',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '平均壽命與嬰幼兒死亡率是聯合國用同一套方法估計的，可能跟各國官方統計不同，例如台灣 2023 年的嬰兒死亡率聯合國估 3.0‰，內政部生命表是 4.3‰。醫療支出與醫師數的台灣資料來自衛生福利部。',
    en: "Life expectancy and child mortality are UN estimates made with one method for every country and may differ from official national figures: for Taiwan's 2023 infant mortality, for example, the UN estimate is 3.0‰ and the Ministry of the Interior's life table gives 4.3‰. Taiwan's health spending and physician figures come from the Ministry of Health and Welfare.",
  },
  panelExtra: () => import('./panels/HealthPanel'),
  indicators: [
    {
      id: 'life-expectancy',
      label: { zh: '平均壽命', en: 'Life expectancy' },
      description: {
        zh: '出生時的平均餘命：照當年各年齡的死亡率，一個新生兒預期可以活幾歲。',
        en: "Life expectancy at birth: how long a newborn would live on average at that year's death rates for each age.",
      },
      unit: YEARS,
      file: 'life-expectancy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 65, 70, 75, 80] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'infant-mortality',
      label: { zh: '嬰兒死亡率', en: 'Infant mortality' },
      description: {
        zh: '每 1,000 個活產嬰兒中，未滿 1 歲就死亡的人數（‰）。顏色越深死亡率越高。',
        en: 'Deaths before age 1 per 1,000 live births (‰). Darker means higher mortality.',
      },
      unit: '‰',
      file: 'infant-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 100] } },
      format: perThousand,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'under5-mortality',
      label: { zh: '五歲以下死亡率', en: 'Under-5 mortality' },
      description: {
        zh: '每 1,000 個活產嬰兒中，未滿 5 歲就死亡的人數（‰）。顏色越深死亡率越高。',
        en: 'Deaths before age 5 per 1,000 live births (‰). Darker means higher mortality.',
      },
      unit: '‰',
      file: 'under5-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 150] } },
      format: perThousand,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'health-spending-per-capita',
      label: { zh: '人均醫療支出', en: 'Health spending per person' },
      description: {
        zh: '全國一年的經常性醫療支出（政府、保險與民眾自付合計）除以人口，以當年匯率換算成美元。',
        en: 'Current health spending in a year (government, insurance and out-of-pocket combined) divided by population, in US dollars at current exchange rates.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'health-spending-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 250, 500, 1000, 2500, 5000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'health-spending-gdp',
      label: { zh: '醫療支出占 GDP', en: 'Health spending, % of GDP' },
      description: { zh: '經常性醫療支出占國內生產毛額的比例。', en: 'Current health spending as a share of GDP.' },
      unit: '%',
      file: 'health-spending-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 4, 5, 6, 8, 10] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'physicians',
      label: { zh: '每千人醫師數', en: 'Physicians per 1,000 people' },
      description: {
        zh: '每 1,000 人有幾位醫師（西醫，含一般科與專科，不含中醫等傳統醫學）。很多國家不是每年都有統計。',
        en: 'Medical doctors per 1,000 people (generalists and specialists, excluding traditional medicine). Many countries do not report every year.',
      },
      unit: PER_1000,
      file: 'physicians.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.2, 0.5, 1, 2, 3, 4] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 人`, en: `${fixed(v, 2)} per 1,000` }),
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
  ],
};
