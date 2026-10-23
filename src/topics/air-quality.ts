import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const UG = 'μg/m³';
const PER_100K = { zh: '人/十萬人', en: 'per 100,000 people' };
const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 100,000` });
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 兩個死亡率用同一組門檻，切換時顏色可以直接比 */
function deathRate(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_100K,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 100, 150] } },
    format: per100k,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const airQuality: TopicDefinition = {
  id: 'air-quality',
  title: { zh: '各國空氣品質', en: 'Air quality by country' },
  shortTitle: { zh: '空氣品質', en: 'Air quality' },
  defaultIndicator: 'pm25',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'WHO, Global Health Observatory（SDG 11.6.2 PM2.5 濃度、SDG 3.9.1 空氣污染死亡率）',
        en: 'WHO, Global Health Observatory (SDG 11.6.2 PM2.5 concentrations, SDG 3.9.1 air pollution mortality)',
      },
      url: 'https://www.who.int/data/gho/data/themes/air-pollution',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'WashU Atmospheric Composition Analysis Group, SatPM2.5 V6.GL.02 各國人口加權統計（Shen et al., 2024）',
        en: 'WashU Atmospheric Composition Analysis Group, SatPM2.5 V6.GL.02 country-level population-weighted statistics (Shen et al., 2024)',
      },
      url: 'https://sites.wustl.edu/acag/datasets/surface-pm2-5/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '環境部 全國細懸浮微粒手動監測資料', en: 'Ministry of Environment (Taiwan), manual PM2.5 monitoring data' },
      url: 'https://data.moenv.gov.tw/dataset/detail/AQX_P_10',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '環境部 空氣污染物濃度測值（全國 PM2.5 年平均，交叉比對用）',
        en: 'Ministry of Environment (Taiwan), air pollutant concentrations (national PM2.5 annual mean, for cross-checking)',
      },
      url: 'https://data.gov.tw/dataset/89030',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      'PM2.5 年平均與死亡率是 WHO 用同一套方法估計的（衛星、化學傳輸模式、地面測站與人口分布），不是各國測站的直接量測，可能跟各國官方數字不同。' +
      'WHO 2021 年把 PM2.5 年平均的指引值從 10 下修到 5 μg/m³，另訂 35、25、15、10 μg/m³ 四個過渡目標，地圖的分級對齊這些值。' +
      '超過指引值的人口比例來自另一套衛星推估（WashU ACAG）。' +
      '台灣不在 WHO 資料庫中：PM2.5 年平均用環境部手動監測站的平均（2015 年起），是測站的平均、不是人口加權；死亡率沒有同樣方法的台灣數字，留空。',
    en:
      'The PM2.5 annual means and death rates are WHO estimates made with one method for every country (satellites, chemical transport models, ground monitors and population distribution), ' +
      'not direct measurements at national monitoring stations, so they may differ from official national figures. ' +
      'In 2021 WHO lowered its guideline for annual mean PM2.5 from 10 to 5 μg/m³ and set four interim targets of 35, 25, 15 and 10 μg/m³; the map classes follow these values. ' +
      'The share of people above the guideline comes from a different satellite-based estimate (WashU ACAG). ' +
      "Taiwan is not in the WHO database: its PM2.5 annual mean is the average of the Ministry of Environment's manual monitoring stations (from 2015), " +
      'a station average rather than a population-weighted one; there is no Taiwanese death rate made with the same method, so it is left blank.',
  },
  indicators: [
    {
      id: 'pm25',
      label: { zh: 'PM2.5 年平均濃度', en: 'PM2.5 annual mean' },
      description: {
        zh: '細懸浮微粒（直徑 2.5 微米以下，能深入肺部）的年平均濃度，依人口分布加權，也就是一般人平均吸到的濃度。WHO 的空氣品質指引值是 5 μg/m³，四個過渡目標是 35、25、15、10 μg/m³。',
        en: 'Annual mean concentration of fine particulate matter (particles under 2.5 micrometres across, which reach deep into the lungs), weighted by where people live: what the average person breathes. The WHO air quality guideline is 5 μg/m³, with interim targets of 35, 25, 15 and 10 μg/m³.',
      },
      unit: UG,
      file: 'pm25.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 25, 35, 50] } },
      format: (v) => `${fixed(v, 1)} ${UG}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'pm25-above-guideline',
      label: { zh: '超過 WHO 指引值的人口比例', en: 'People above WHO guideline' },
      description: {
        zh: '住在 PM2.5 年平均 5 μg/m³（WHO 指引值）以上地方的人口比例，全世界超過 99% 的人都是。來自 WashU ACAG 的衛星推估，跟「PM2.5 年平均濃度」（WHO 的估計）是不同的模型，同一國的兩個數字可能對不上。',
        en: "Share of people living where annual mean PM2.5 is 5 μg/m³ (the WHO guideline) or higher; over 99% of the world's population does. From WashU ACAG's satellite-based estimates, a different model from the WHO estimates behind “PM2.5 annual mean”, so the two figures for a country may not match.",
      },
      unit: '%',
      file: 'pm25-above-guideline.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 75, 90, 99] } },
      format: (v) => `${fixed(v, v >= 99.95 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    deathRate(
      'ambient-deaths',
      { zh: '戶外空氣污染死亡率', en: 'Outdoor air pollution deaths' },
      {
        zh: '每十萬人一年有幾人的死亡可歸因於戶外空氣污染（PM2.5），年齡標準化（用同一個年齡結構比較，老年人口多的國家不會因此偏高）。WHO 依各國的 PM2.5 暴露量，以及缺血性心臟病、中風、肺癌、慢性阻塞性肺病、下呼吸道感染的暴露—反應關係推估，只有 2021 年。',
        en: 'Deaths per 100,000 people a year attributable to outdoor (ambient) air pollution, age-standardised (compared using the same age structure, so countries with older populations do not come out higher just for that). WHO estimates from each country’s PM2.5 exposure and exposure–response relationships for ischaemic heart disease, stroke, lung cancer, COPD and lower respiratory infections; 2021 only.',
      },
    ),
    deathRate(
      'air-pollution-deaths',
      { zh: '戶外與室內空氣污染死亡率', en: 'All air pollution deaths' },
      {
        zh: '聯合國永續發展目標 SDG 3.9.1：戶外空氣污染，加上家裡用柴火、木炭、煤炭等固體燃料煮飯取暖造成的室內空氣污染，每十萬人一年的歸因死亡，年齡標準化，只有 2021 年。撒哈拉以南非洲、南亞很多家庭還在用固體燃料，所以比只算戶外高很多；WHO 算的是兩者的合併效果，不是直接相加。',
        en: 'Outdoor plus household air pollution (UN Sustainable Development Goal indicator 3.9.1): deaths per 100,000 people a year attributable to outdoor air pollution and to household air pollution from cooking and heating with solid fuels such as wood, charcoal and coal, age-standardised; 2021 only. Much higher than outdoor pollution alone in sub-Saharan Africa and South Asia, where many households still use solid fuels; WHO estimates the joint effect, not a simple sum.',
      },
    ),
  ],
};
