import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

const twh = (v: number) => `${fixed(v, v < 10 ? 2 : v < 1000 ? 1 : 0)} TWh`;
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;

function share(id: string, label: string, description: string, thresholds: number[]): IndicatorDef {
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
  title: '各國發電量',
  shortTitle: '發電量',
  defaultIndicator: 'generation',
  defaultYear: 2024,
  sources: [{ name: 'Ember, Yearly Electricity Data', url: 'https://ember-energy.org/data/yearly-electricity-data/', license: 'CC BY 4.0' }],
  note: '1 TWh（太瓦時）＝ 10 億度電。',
  panelExtra: () => import('./panels/ElectricityPanel'),
  indicators: [
    {
      id: 'generation',
      label: '總發電量',
      description: '一年的總發電量，1 TWh 等於 10 億度。圓的面積與發電量成正比。',
      unit: 'TWh',
      file: 'generation.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: twh,
      formatTick: (v) => `${fixed(v, 0)} TWh`,
      shareOfWorld: true,
    },
    {
      id: 'demand-per-capita',
      label: '人均用電量',
      description: '全國用電量除以人口，含家庭、工業與商業用電。單位是度（kWh）。',
      unit: '度',
      file: 'demand-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2500, 5000, 7500, 10000] } },
      format: (v) => `${fixed(v, 0)} 度`,
      formatTick: (v) => (v >= 1000 ? `${fixed(v / 1000, v % 1000 === 0 ? 0 : 1)}千` : fixed(v, 0)),
      compareWorld: true,
    },
    share('renewables-share', '再生能源占比', '水力、風力、太陽能、生質能等再生能源占總發電量的比例。', [10, 20, 30, 50, 70, 90]),
    share('clean-share', '低碳能源占比', '再生能源加上核能，也就是發電時幾乎不排放二氧化碳的能源。', [10, 20, 30, 50, 70, 90]),
    share('coal-share', '燃煤占比', '燃煤發電占總發電量的比例。', [5, 10, 20, 40, 60, 80]),
    share('nuclear-share', '核能占比', '核能發電占總發電量的比例。沒有核電廠的國家顯示為 0。', [1, 5, 10, 20, 30, 50]),
    {
      id: 'carbon-intensity',
      label: '發電碳排強度',
      description: '每發一度電排放的二氧化碳（公克）。燃煤越多越高，再生能源與核能越多越低。',
      unit: 'gCO₂/度',
      file: 'carbon-intensity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 300, 400, 500, 700] } },
      format: (v) => `${fixed(v, 0)} 公克/度`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
  ],
};
