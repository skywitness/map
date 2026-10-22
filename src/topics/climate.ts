import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

const tonnes = (v: number) => `${formatLargeNumber(v)} 公噸`;
const tonnesTick = (v: number) => `${formatLargeTick(v)}噸`;

function perCapita(id: string, label: string, description: string): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '公噸/人',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 10, 15] } },
    format: (v) => `${fixed(v, v < 10 ? 2 : 1)} 公噸/人`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const climate: TopicDefinition = {
  id: 'climate',
  title: '各國二氧化碳排放',
  shortTitle: '氣候',
  defaultIndicator: 'co2-per-capita',
  defaultYear: 2024,
  sources: [
    {
      name: 'Our World in Data, CO₂ and Greenhouse Gas Emissions（Global Carbon Project）',
      url: 'https://github.com/owid/co2-data',
      license: 'CC BY 4.0',
    },
  ],
  note: '只計化石燃料燃燒與水泥等工業製程的二氧化碳，不含土地利用變化（砍伐森林等）與其他溫室氣體。1 億公噸 ＝ 100 百萬公噸（Mt）。',
  panelExtra: () => import('./panels/ClimatePanel'),
  indicators: [
    perCapita('co2-per-capita', '人均排放', '一年的二氧化碳排放量除以人口，依排放發生的地點計算（生產端）。'),
    {
      id: 'co2',
      label: '年排放量',
      description: '一年的二氧化碳排放總量。圓的面積與排放量成正比。',
      unit: '公噸',
      file: 'co2.json',
      layer: { kind: 'bubble', legendValues: [1e8, 1e9, 1e10] },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    {
      id: 'cumulative-co2',
      label: '累積排放量',
      description: '從 1750 年到當年的排放總和，可以看出歷史責任。圓的面積與累積排放量成正比。',
      unit: '公噸',
      file: 'cumulative-co2.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    perCapita(
      'consumption-co2-per-capita',
      '人均消費端排放',
      '把進出口商品生產時的排放算給最後消費的國家。出口大國會比人均排放低，進口大國會比較高。1990 年起。',
    ),
    {
      id: 'co2-per-gdp',
      label: '每單位 GDP 排放',
      description: '每創造 1 國際元（2011 年購買力平價）的 GDP 排放多少公斤二氧化碳，越低代表經濟越低碳。到 2022 年。',
      unit: '公斤/國際元',
      file: 'co2-per-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.15, 0.2, 0.3, 0.5, 0.8] } },
      format: (v) => `${fixed(v, 3)} 公斤/國際元`,
      formatTick: (v) => fixed(v, 2),
      compareWorld: true,
    },
  ],
};
