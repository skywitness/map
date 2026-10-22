import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent, intlDollars, usd } from '../lib/format';
import type { TopicDefinition } from './types';

export const income: TopicDefinition = {
  id: 'income',
  title: { zh: '各國人均收入', en: 'Income by country' },
  shortTitle: { zh: '人均收入', en: 'Income' },
  defaultIndicator: 'gdp-per-capita',
  defaultYear: 2025,
  sources: [
    {
      name: 'IMF, World Economic Outlook (October 2026)',
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明來源即可使用', en: 'free to use with attribution' },
    },
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
  ],
  note: {
    zh: '2026 年起為 IMF 推估值。古巴、格陵蘭等 IMF 未涵蓋的地區改用世界銀行資料。',
    en: 'Figures from 2026 onward are IMF projections. Places the IMF does not cover, such as Cuba and Greenland, use World Bank data.',
  },
  indicators: [
    {
      id: 'gdp-per-capita',
      label: { zh: '人均 GDP', en: 'GDP per capita' },
      description: {
        zh: '每人平均國內生產毛額，以當年匯率換算成美元。',
        en: 'Gross domestic product per person, converted to US dollars at current exchange rates.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'gdp-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2500, 5000, 10000, 25000, 50000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp-per-capita-ppp',
      label: { zh: '人均 GDP（購買力平價）', en: 'GDP per capita (PPP)' },
      description: {
        zh: '用購買力平價換算，扣除各國物價差異，比較實際生活水準。單位是國際元。',
        en: 'Converted at purchasing power parity to remove price differences between countries, so living standards can be compared. In international dollars.',
      },
      unit: { zh: '國際元', en: 'international $' },
      file: 'gdp-per-capita-ppp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2500, 5000, 10000, 25000, 50000, 75000] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp',
      label: { zh: 'GDP 總額', en: 'GDP' },
      description: {
        zh: '國內生產毛額，以當年匯率換算成美元。圓的面積與經濟規模成正比。',
        en: 'Gross domestic product in US dollars at current exchange rates. Circle area is proportional to the size of the economy.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'gdp.json',
      layer: { kind: 'bubble', legendValues: [1e11, 1e12, 1e13] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'gdp-growth',
      label: { zh: '經濟成長率', en: 'GDP growth' },
      description: {
        zh: '實質 GDP 相較前一年的變化（已扣除物價上漲）。橘色為經濟衰退、綠色為成長。',
        en: 'Change in real GDP from the previous year (adjusted for inflation). Orange means contraction, green means growth.',
      },
      unit: '%',
      file: 'gdp-growth.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-5, -2, -0.5, 0.5, 2, 5] } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
  ],
};
