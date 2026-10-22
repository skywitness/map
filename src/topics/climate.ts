import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const TONNES = { zh: '公噸', en: 'tonnes' };
const PER_PERSON = { zh: '公噸/人', en: 'tonnes/person' };
const KG_PER_DOLLAR = { zh: '公斤/國際元', en: 'kg/int$' };
const tonnes = (v: number) => `${formatLargeNumber(v)} ${tr(TONNES)}`;
const tonnesTick = (v: number) => `${formatLargeTick(v)}${tr({ zh: '噸', en: ' t' })}`;

function perCapita(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_PERSON,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 10, 15] } },
    format: (v) => `${fixed(v, v < 10 ? 2 : 1)} ${tr(PER_PERSON)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const climate: TopicDefinition = {
  id: 'climate',
  title: { zh: '各國二氧化碳排放', en: 'CO₂ emissions by country' },
  shortTitle: { zh: '氣候', en: 'Climate' },
  defaultIndicator: 'co2-per-capita',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Our World in Data, CO₂ and Greenhouse Gas Emissions（Global Carbon Project）',
        en: 'Our World in Data, CO₂ and Greenhouse Gas Emissions (Global Carbon Project)',
      },
      url: 'https://github.com/owid/co2-data',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '只計化石燃料燃燒與水泥等工業製程的二氧化碳，不含土地利用變化（砍伐森林等）與其他溫室氣體。1 億公噸 ＝ 100 百萬公噸（Mt）。',
    en: 'Covers CO₂ from burning fossil fuels and industrial processes such as cement only, excluding land-use change (such as deforestation) and other greenhouse gases. 1 Mt = 1 million tonnes.',
  },
  panelExtra: () => import('./panels/ClimatePanel'),
  indicators: [
    perCapita(
      'co2-per-capita',
      { zh: '人均排放', en: 'CO₂ per person' },
      {
        zh: '一年的二氧化碳排放量除以人口，依排放發生的地點計算（生產端）。',
        en: 'Annual CO₂ emissions divided by population, counted where the emissions occur (production-based).',
      },
    ),
    {
      id: 'co2',
      label: { zh: '年排放量', en: 'Annual emissions' },
      description: {
        zh: '一年的二氧化碳排放總量。圓的面積與排放量成正比。',
        en: 'Total CO₂ emitted in a year. Circle area is proportional to emissions.',
      },
      unit: TONNES,
      file: 'co2.json',
      layer: { kind: 'bubble', legendValues: [1e8, 1e9, 1e10] },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    {
      id: 'cumulative-co2',
      label: { zh: '累積排放量', en: 'Cumulative emissions' },
      description: {
        zh: '從 1750 年到當年的排放總和，可以看出歷史責任。圓的面積與累積排放量成正比。',
        en: 'Total emissions from 1750 up to the selected year, a measure of historical responsibility. Circle area is proportional to cumulative emissions.',
      },
      unit: TONNES,
      file: 'cumulative-co2.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    perCapita(
      'consumption-co2-per-capita',
      { zh: '人均消費端排放', en: 'Consumption-based CO₂ per person' },
      {
        zh: '把進出口商品生產時的排放算給最後消費的國家。出口大國會比人均排放低，進口大國會比較高。1990 年起。',
        en: 'Emissions from producing traded goods are assigned to the country that finally consumes them, so big exporters come out lower than their production-based figure and big importers higher. From 1990.',
      },
    ),
    {
      id: 'co2-per-gdp',
      label: { zh: '每單位 GDP 排放', en: 'CO₂ per unit of GDP' },
      description: {
        zh: '每創造 1 國際元（2011 年購買力平價）的 GDP 排放多少公斤二氧化碳，越低代表經濟越低碳。到 2022 年。',
        en: 'Kilograms of CO₂ emitted per international dollar of GDP (2011 PPP); lower means a less carbon-intensive economy. Up to 2022.',
      },
      unit: KG_PER_DOLLAR,
      file: 'co2-per-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.15, 0.2, 0.3, 0.5, 0.8] } },
      format: (v) => `${fixed(v, 3)} ${tr(KG_PER_DOLLAR)}`,
      formatTick: (v) => fixed(v, 2),
      compareWorld: true,
    },
  ],
};
