import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const KM = { zh: '公里', en: 'km' };
const KM_PER_1000 = { zh: '公里/千平方公里', en: 'km per 1,000 km²' };
const km = (v: number) => `${fixed(v, 0)} ${tr(KM)}`;
const airports = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'airport' : 'airports'}` });

export const transport: TopicDefinition = {
  id: 'transport',
  title: { zh: '各國交通', en: 'Transport by country' },
  shortTitle: { zh: '交通', en: 'Transport' },
  defaultIndicator: 'network',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Natural Earth（1:10m 鐵路）', en: 'Natural Earth (1:10m railways)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    { name: 'OurAirports', url: 'https://ourairports.com/data/', license: { zh: '公有領域', en: 'public domain' } },
  ],
  note: {
    zh: '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。機場只含大型機場與有定期航班的中型機場。',
    en: 'Railways come from simplified Natural Earth 1:10m map data and may miss branch lines; North America includes main lines only, so rail lengths for the US and Canada are clearly too low. Airports include only large airports and medium airports with scheduled flights.',
  },
  overlays: [
    { id: 'railways', file: 'railways.json' },
    { id: 'airports', file: 'airports.json' },
  ],
  panelExtra: () => import('./panels/TransportPanel'),
  indicators: [
    {
      id: 'network',
      label: { zh: '路網地圖', en: 'Network map' },
      description: {
        zh: '全球鐵路路線與機場位置，可在左下角開關圖層；滑鼠移到機場上可看名稱，移到國家上可看鐵路長度。',
        en: 'Railway lines and airports around the world; toggle the layers at the bottom left. Hover over an airport to see its name, or over a country to see its rail length.',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `鐵路 ${km(v)}`, en: `Railways: ${km(v)}` }),
    },
    {
      id: 'rail-length',
      label: { zh: '鐵路長度', en: 'Rail length' },
      description: {
        zh: '依地圖上的鐵路路線計算的總長度（近似值，複線可能重複計算、支線可能缺漏）。',
        en: 'Total length of the railway lines on the map (approximate: multi-track lines may be counted twice and branch lines may be missing).',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: km,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'rail-density',
      label: { zh: '鐵路密度', en: 'Rail density' },
      description: {
        zh: '每 1,000 平方公里國土上的鐵路長度，比總長度更能比較大小不同的國家。',
        en: 'Kilometres of railway per 1,000 km² of land, which compares countries of different sizes better than total length.',
      },
      unit: KM_PER_1000,
      file: 'rail-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 70] } },
      format: (v) => `${fixed(v, 1)} ${tr(KM_PER_1000)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'airports-count',
      label: { zh: '機場數', en: 'Airports' },
      description: {
        zh: '大型機場加上有定期航班的中型機場。',
        en: 'Large airports plus medium airports with scheduled flights.',
      },
      unit: { zh: '座', en: 'airports' },
      file: 'airports-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 500] },
      format: airports,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'large-airports',
      label: { zh: '大型機場數', en: 'Large airports' },
      description: {
        zh: 'OurAirports 分類為大型機場的數量（通常是國際機場或主要樞紐）。',
        en: 'Airports classified as large by OurAirports (usually international airports or major hubs).',
      },
      unit: { zh: '座', en: 'airports' },
      file: 'large-airports.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: airports,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
