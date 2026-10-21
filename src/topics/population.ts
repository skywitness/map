import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent } from '../lib/format';
import type { TopicDefinition } from './types';

export const population: TopicDefinition = {
  id: 'population',
  title: '各國人口',
  shortTitle: '人口',
  defaultIndicator: 'total',
  defaultYear: 2023,
  boxEstimate: { indicator: 'total', label: '人口', grid: 'grid.json' },
  sources: [
    {
      name: 'United Nations, World Population Prospects 2024（中推估）',
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: 'European Commission JRC, GHS-POP R2023A（框選估算的網格人口）',
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'total',
      label: '總人口',
      description: '每年 7 月 1 日的年中人口。圓的面積與人口數成正比。',
      unit: '人',
      file: 'total.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: (v) => `${formatLargeNumber(v)} 人`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'density',
      label: '人口密度',
      description: '每平方公里的人數。',
      unit: '人/km²',
      file: 'density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 250, 500] } },
      format: (v) => `${fixed(v, v < 100 ? 1 : 0)} 人/km²`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'growth',
      label: '人口年增率',
      description: '相較前一年的人口變化，含自然增加與移民。紅色為人口減少。',
      unit: '%',
      file: 'growth.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-2, -1, -0.25, 0.25, 1, 2] } },
      format: (v) => formatSignedPercent(v),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 2),
      compareWorld: true,
    },
    {
      id: 'median-age',
      label: '年齡中位數',
      description: '一半人口比這個年齡年輕、一半比較年長，可以看出人口老化程度。',
      unit: '歲',
      file: 'median-age.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 45] } },
      format: (v) => `${fixed(v, 1)} 歲`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
  ],
};
