import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const twh = (v: number) => `${fixed(v, v < 10 ? 2 : v < 1000 ? 1 : 0)} TWh`;
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const KWH = { zh: '度', en: 'kWh' };

function share(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: pct,
    formatTick: pctTick,
    compareWorld: true,
  };
}

export const electricity: TopicDefinition = {
  id: 'electricity',
  title: { zh: '各國發電量', en: 'Electricity by country' },
  shortTitle: { zh: '發電量', en: 'Electricity' },
  defaultIndicator: 'generation',
  defaultYear: 2024,
  sources: [{ name: 'Ember, Yearly Electricity Data', url: 'https://ember-energy.org/data/yearly-electricity-data/', license: 'CC BY 4.0' }],
  note: { zh: '1 TWh（太瓦時）＝ 10 億度電。', en: '1 TWh (terawatt-hour) = 1 billion kWh.' },
  panelExtra: () => import('./panels/ElectricityPanel'),
  indicators: [
    {
      id: 'generation',
      label: { zh: '總發電量', en: 'Electricity generation' },
      description: {
        zh: '一年的總發電量，1 TWh 等於 10 億度。圓的面積與發電量成正比。',
        en: 'Total electricity generated in a year; 1 TWh is 1 billion kWh. Circle area is proportional to generation.',
      },
      unit: 'TWh',
      file: 'generation.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: twh,
      formatTick: (v) => `${fixed(v, 0)} TWh`,
      shareOfWorld: true,
    },
    {
      id: 'demand-per-capita',
      label: { zh: '人均用電量', en: 'Electricity use per person' },
      description: {
        zh: '全國用電量除以人口，含家庭、工業與商業用電。單位是度（kWh）。',
        en: 'National electricity demand divided by population, including households, industry and businesses. In kWh.',
      },
      unit: KWH,
      file: 'demand-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2500, 5000, 7500, 10000] } },
      format: (v) => `${fixed(v, 0)} ${tr(KWH)}`,
      formatTick: (v) =>
        v >= 1000 ? `${fixed(v / 1000, v % 1000 === 0 ? 0 : 1)}${tr({ zh: '千', en: 'K' })}` : fixed(v, 0),
      compareWorld: true,
    },
    share(
      'renewables-share',
      { zh: '再生能源占比', en: 'Renewables share' },
      {
        zh: '水力、風力、太陽能、生質能等再生能源占總發電量的比例。',
        en: 'Share of electricity generated from renewables such as hydro, wind, solar and bioenergy.',
      },
      [10, 20, 30, 50, 70, 90],
    ),
    share(
      'clean-share',
      { zh: '低碳能源占比', en: 'Low-carbon share' },
      {
        zh: '再生能源加上核能，也就是發電時幾乎不排放二氧化碳的能源。',
        en: 'Renewables plus nuclear: sources that emit almost no CO₂ when generating electricity.',
      },
      [10, 20, 30, 50, 70, 90],
    ),
    share(
      'coal-share',
      { zh: '燃煤占比', en: 'Coal share' },
      { zh: '燃煤發電占總發電量的比例。', en: 'Share of electricity generated from coal.' },
      [5, 10, 20, 40, 60, 80],
    ),
    share(
      'nuclear-share',
      { zh: '核能占比', en: 'Nuclear share' },
      {
        zh: '核能發電占總發電量的比例。沒有核電廠的國家顯示為 0。',
        en: 'Share of electricity generated from nuclear power. Countries without nuclear plants show 0.',
      },
      [1, 5, 10, 20, 30, 50],
    ),
    {
      id: 'carbon-intensity',
      label: { zh: '發電碳排強度', en: 'Carbon intensity of electricity' },
      description: {
        zh: '每發一度電排放的二氧化碳（公克）。燃煤越多越高，再生能源與核能越多越低。',
        en: 'Grams of CO₂ emitted per kWh generated. More coal means higher; more renewables and nuclear means lower.',
      },
      unit: { zh: 'gCO₂/度', en: 'gCO₂/kWh' },
      file: 'carbon-intensity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 300, 400, 500, 700] } },
      format: (v) => `${fixed(v, 0)} ${tr({ zh: '公克/度', en: 'g/kWh' })}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
  ],
};
