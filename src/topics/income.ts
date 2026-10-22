import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent } from '../lib/format';
import type { TopicDefinition } from './types';

const usd = (v: number) => `${fixed(v, 0)} 美元`;

export const income: TopicDefinition = {
  id: 'income',
  title: '各國人均收入',
  shortTitle: '人均收入',
  defaultIndicator: 'gdp-per-capita',
  defaultYear: 2025,
  sources: [
    {
      name: 'IMF, World Economic Outlook (October 2026)',
      url: 'https://www.imf.org/external/datamapper/',
      license: '註明來源即可使用',
    },
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
  ],
  note: '2026 年起為 IMF 推估值。古巴、格陵蘭等 IMF 未涵蓋的地區改用世界銀行資料。',
  indicators: [
    {
      id: 'gdp-per-capita',
      label: '人均 GDP',
      description: '每人平均國內生產毛額，以當年匯率換算成美元。',
      unit: '美元',
      file: 'gdp-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2500, 5000, 10000, 25000, 50000] } },
      format: usd,
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp-per-capita-ppp',
      label: '人均 GDP（購買力平價）',
      description: '用購買力平價換算，扣除各國物價差異，比較實際生活水準。單位是國際元。',
      unit: '國際元',
      file: 'gdp-per-capita-ppp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2500, 5000, 10000, 25000, 50000, 75000] } },
      format: (v) => `${fixed(v, 0)} 國際元`,
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp',
      label: 'GDP 總額',
      description: '國內生產毛額，以當年匯率換算成美元。圓的面積與經濟規模成正比。',
      unit: '美元',
      file: 'gdp.json',
      layer: { kind: 'bubble', legendValues: [1e11, 1e12, 1e13] },
      format: (v) => `${formatLargeNumber(v)} 美元`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'gdp-growth',
      label: '經濟成長率',
      description: '實質 GDP 相較前一年的變化（已扣除物價上漲）。橘色為經濟衰退、綠色為成長。',
      unit: '%',
      file: 'gdp-growth.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-5, -2, -0.5, 0.5, 2, 5] } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
  ],
};
