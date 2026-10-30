import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { TopicDefinition } from './types';
import { COVID } from './events';

const ARRIVALS = { zh: '人次', en: 'arrivals' };
const PER_PERSON = { zh: '人次/人', en: 'arrivals per resident' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const tourism: TopicDefinition = {
  id: 'tourism',
  title: { zh: '各國國際觀光', en: 'International tourism by country' },
  shortTitle: { zh: '觀光', en: 'Tourism' },
  defaultIndicator: 'arrivals',
  defaultYear: 2019,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（UN Tourism 資料）',
        en: 'World Bank, World Development Indicators (UN Tourism data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（IMF 國際收支：旅行收入）',
        en: 'World Bank, World Development Indicators (IMF balance of payments: travel receipts)',
      },
      url: 'https://data.worldbank.org/indicator/BX.GSR.TRVL.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '交通部觀光署 來臺旅客人次', en: 'Tourism Administration (Taiwan), visitor arrivals' },
      url: 'https://data.gov.tw/dataset/7322',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '中央銀行 國際收支統計', en: 'Central Bank of the Republic of China (Taiwan), balance of payments' },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（旅客與人口比）',
        en: 'United Nations, World Population Prospects 2024 (arrivals per resident)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '國際旅客、觀光收入與觀光收入占出口只到 2020 年：UN Tourism 之後的資料不開放轉載。旅行收入與旅行收入占出口是世界銀行轉載的 IMF 國際收支，到最新一年；IMF 的「旅行」不含國際客運（觀光收入含付給本國航空公司的機票錢），兩者不能直接接起來比。旅客人次有些國家只算過夜旅客、有些含當日來回的旅客，跨國比較時要留意。2020 年起受疫情影響大幅減少。',
    en: 'International arrivals, tourism receipts and their share of exports end in 2020 because later UN Tourism data may not be republished. Travel receipts and their share of exports come from IMF balance-of-payments data republished by the World Bank and run to the latest year; IMF "travel" excludes international passenger transport (tourism receipts include fares paid to national carriers), so the two series cannot be joined directly. Some countries count only overnight visitors and others include same-day visitors, so compare with care. Figures drop sharply from 2020 because of the pandemic.',
  },
  indicators: [
    {
      id: 'arrivals',
      label: { zh: '國際旅客', en: 'International arrivals' },
      description: {
        zh: '一年有多少人次的外國旅客入境。圓的面積與人次成正比。',
        en: 'Number of international visitor arrivals in a year. Circle area is proportional to arrivals.',
      },
      unit: ARRIVALS,
      file: 'arrivals.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => `${formatLargeNumber(v)} ${tr(ARRIVALS)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts',
      label: { zh: '觀光收入', en: 'Tourism receipts' },
      description: {
        zh: '外國旅客在當地的花費，加上付給本國航空、交通業者的國際客運費用，以當年美元計。圓的面積與收入成正比。',
        en: "Spending by international visitors in the country plus international passenger fares paid to the country's carriers, in current US dollars. Circle area is proportional to receipts.",
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'receipts.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'receipts-exports',
      label: { zh: '觀光收入占出口', en: 'Tourism receipts, % of exports' },
      description: {
        zh: '觀光收入占商品與服務出口總額的比例，可以看出一國經濟有多依賴觀光。',
        en: 'Tourism receipts as a share of total exports of goods and services, a measure of how much an economy depends on tourism.',
      },
      unit: '%',
      file: 'receipts-exports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'travel',
      label: { zh: '旅行收入（IMF）', en: 'Travel receipts (IMF)' },
      description: {
        zh: '外國旅客在當地的食宿、交通、購物等花費（國際收支的「旅行」服務出口），以當年美元計，到最新一年。不含國際客運，比觀光收入少一些，兩者不能直接接起來比。圓的面積與收入成正比。',
        en: 'What foreign visitors spend in the country on lodging, food, local transport, shopping and so on ("travel" services exports in the balance of payments), in current US dollars, up to the latest year. It excludes international passenger transport, so it is somewhat lower than tourism receipts and the two cannot be joined directly. Circle area is proportional to receipts.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'travel.json',
      events: [COVID],
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'travel-exports',
      label: { zh: '旅行收入占出口（IMF）', en: 'Travel receipts, % of exports (IMF)' },
      description: {
        zh: '旅行收入占商品與服務出口總額的比例，到最新一年。不含國際客運，比「觀光收入占出口」低一些。',
        en: 'Travel receipts as a share of total exports of goods and services, up to the latest year. It excludes international passenger transport, so it is somewhat lower than tourism receipts as a share of exports.',
      },
      unit: '%',
      file: 'travel-exports.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'arrivals-per-capita',
      label: { zh: '旅客與人口比', en: 'Arrivals per resident' },
      description: {
        zh: '一年的國際旅客人次除以人口。大於 1 表示來訪旅客比當地居民還多。',
        en: 'International arrivals in a year divided by population. Above 1 means more visitors than residents.',
      },
      unit: PER_PERSON,
      file: 'arrivals-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.1, 0.25, 0.5, 1, 2] } },
      format: (v) => `${fixed(v, 2)} ${tr(PER_PERSON)}`,
      // 0.05、0.1、0.25、0.5、1、2：小數位數跟著刻度走
      formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : Number.isInteger(Math.round(v * 1e6) / 1e5) ? 1 : 2),
      compareWorld: true,
    },
  ],
};
