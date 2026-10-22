import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const km = (v: number) => `${fixed(v, 0)} 公里`;

export const transport: TopicDefinition = {
  id: 'transport',
  title: '各國交通',
  shortTitle: '交通',
  defaultIndicator: 'network',
  defaultYear: 2026,
  sources: [
    { name: 'Natural Earth（1:10m 鐵路）', url: 'https://www.naturalearthdata.com/', license: '公有領域' },
    { name: 'OurAirports', url: 'https://ourairports.com/data/', license: '公有領域' },
  ],
  note: '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。機場只含大型機場與有定期航班的中型機場。',
  overlays: [
    { id: 'railways', file: 'railways.json' },
    { id: 'airports', file: 'airports.json' },
  ],
  panelExtra: () => import('./panels/TransportPanel'),
  indicators: [
    {
      id: 'network',
      label: '路網地圖',
      description: '全球鐵路路線與機場位置，可在左下角開關圖層；滑鼠移到機場上可看名稱，移到國家上可看鐵路長度。',
      unit: '公里',
      file: 'rail-length.json',
      layer: { kind: 'none' },
      format: (v) => `鐵路 ${km(v)}`,
    },
    {
      id: 'rail-length',
      label: '鐵路長度',
      description: '依地圖上的鐵路路線計算的總長度（近似值，複線可能重複計算、支線可能缺漏）。',
      unit: '公里',
      file: 'rail-length.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: km,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'rail-density',
      label: '鐵路密度',
      description: '每 1,000 平方公里國土上的鐵路長度，比總長度更能比較大小不同的國家。',
      unit: '公里/千平方公里',
      file: 'rail-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 70] } },
      format: (v) => `${fixed(v, 1)} 公里/千平方公里`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'airports-count',
      label: '機場數',
      description: '大型機場加上有定期航班的中型機場。',
      unit: '座',
      file: 'airports-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 500] },
      format: (v) => `${fixed(v, 0)} 座`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'large-airports',
      label: '大型機場數',
      description: 'OurAirports 分類為大型機場的數量（通常是國際機場或主要樞紐）。',
      unit: '座',
      file: 'large-airports.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => `${fixed(v, 0)} 座`,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
