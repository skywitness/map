import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

export const tourism: TopicDefinition = {
  id: 'tourism',
  title: '各國國際觀光',
  shortTitle: '觀光',
  defaultIndicator: 'arrivals',
  defaultYear: 2019,
  sources: [
    { name: 'World Bank, World Development Indicators（UN Tourism 資料）', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    { name: '交通部觀光署 來臺旅客人次', url: 'https://data.gov.tw/dataset/7322', license: '政府資料開放授權條款' },
    { name: '中央銀行 國際收支統計', url: 'https://cpx.cbc.gov.tw/', license: '政府資料開放授權條款' },
    { name: 'United Nations, World Population Prospects 2024（旅客與人口比）', url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: '資料只到 2020 年：UN Tourism 之後的資料不開放轉載。旅客人次有些國家只算過夜旅客、有些含當日來回的旅客，跨國比較時要留意。2020 年起受疫情影響大幅減少。',
  indicators: [
    {
      id: 'arrivals',
      label: '國際旅客',
      description: '一年有多少人次的外國旅客入境。圓的面積與人次成正比。',
      unit: '人次',
      file: 'arrivals.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => `${formatLargeNumber(v)} 人次`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts',
      label: '觀光收入',
      description: '外國旅客在當地的花費，加上付給本國航空、交通業者的國際客運費用，以當年美元計。圓的面積與收入成正比。',
      unit: '美元',
      file: 'receipts.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => `${formatLargeNumber(v)} 美元`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts-exports',
      label: '觀光收入占出口',
      description: '觀光收入占商品與服務出口總額的比例，可以看出一國經濟有多依賴觀光。',
      unit: '%',
      file: 'receipts-exports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'arrivals-per-capita',
      label: '旅客與人口比',
      description: '一年的國際旅客人次除以人口。大於 1 表示來訪旅客比當地居民還多。',
      unit: '人次/人',
      file: 'arrivals-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.1, 0.25, 0.5, 1, 2] } },
      format: (v) => `${fixed(v, 2)} 人次/人`,
      // 0.05、0.1、0.25、0.5、1、2：小數位數跟著刻度走
      formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1e6) / 1e5) ? 1 : 2),
      compareWorld: true,
    },
  ],
};
