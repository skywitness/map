import { describe, expect, it } from 'vitest';
import type { PointRecord } from '../topics/types';
import { buildPlaceIndex, searchPlaces, type PlaceLayer } from './placeSearch';

const layer: PlaceLayer = {
  id: 'circuits',
  label: { zh: '賽道', en: 'Circuits' },
  points: [
    { lon: 5.9714, lat: 50.4372, name: 'Circuit de Spa-Francorchamps', loc: 'Spa' },
    { lon: 9.2811, lat: 45.6156, name: 'Autodromo Nazionale di Monza', loc: 'Monza' },
    { lon: 136.541, lat: 34.8431, name: 'Suzuka Circuit', loc: 'Suzuka' },
    { lon: null, lat: null, name: 'No position' },
    { lon: 1, lat: 1, name: '' },
  ] as PointRecord[],
  tooltip: (p) => ({ title: String(p.name ?? ''), detail: String(p.loc ?? '') }),
};
const index = buildPlaceIndex([layer]);

describe('地圖上的點的搜尋', () => {
  it('沒有經緯度或沒有名稱的點不收', () => {
    expect(index.map((e) => e.name)).toEqual(['Circuit de Spa-Francorchamps', 'Autodromo Nazionale di Monza', 'Suzuka Circuit']);
  });

  it('名稱的單字開頭找得到，第二行是圖層名稱與說明', () => {
    const [hit] = searchPlaces(index, 'spa');
    expect(hit.entry.name).toBe('Circuit de Spa-Francorchamps');
    expect(hit.entry.meta).toBe('賽道 · Spa');
    expect([hit.entry.lng, hit.entry.lat]).toEqual([5.9714, 50.4372]);
  });

  it('不分大小寫，最多 limit 個', () => {
    expect(searchPlaces(index, 'MONZA')[0].entry.index).toBe(1);
    expect(searchPlaces(index, 'circuit', 1)).toHaveLength(1);
  });

  it('空白沒有結果', () => {
    expect(searchPlaces(index, ' ')).toEqual([]);
  });
});
