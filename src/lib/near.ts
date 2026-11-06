import { tr } from '../i18n/lang';
import { fixed } from './format';
import { distanceBearing } from './greatCircle';
import type { PointRecord } from '../topics/types';

/**
 * 這一點附近的清單（2026-11-06，城4；ListPanelDef.near）：離中心 km 公里以內的點，由近到遠，
 * 每個點多 _km（距離）、_brg（方位角）兩個欄位
 */
export function nearPoints(points: PointRecord[], center: [number, number], km: number): PointRecord[] {
  const [lon0, lat0] = center;
  // 先用經緯度粗篩（1° 緯度約 111 公里），再算大圓距離
  const dLat = km / 111 + 0.01;
  const out: PointRecord[] = [];
  for (const p of points) {
    const lon = p.lon;
    const lat = p.lat;
    if (typeof lon !== 'number' || typeof lat !== 'number' || Math.abs(lat - lat0) > dLat) continue;
    const [d, b] = distanceBearing(lon0, lat0, lon, lat);
    if (d <= km) out.push({ ...p, _km: d, _brg: b });
  }
  return out.sort((a, b) => (a._km as number) - (b._km as number));
}

const DIRS = {
  zh: ['北', '東北', '東', '東南', '南', '西南', '西', '西北'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

/** 「西北 20 公里」「20 km NW」；1 公里以內寫「就在這裡」 */
export function nearText(p: PointRecord): string {
  const km = typeof p._km === 'number' ? p._km : 0;
  if (km < 1) return tr({ zh: '就在這裡（不到 1 公里）', en: 'Right here (under 1 km)' });
  const i = Math.round((((typeof p._brg === 'number' ? p._brg : 0) % 360) + 360) % 360 / 45) % 8;
  const dist = fixed(km, km < 10 ? 1 : 0);
  return tr({ zh: `${DIRS.zh[i]} ${dist} 公里`, en: `${dist} km ${DIRS.en[i]}` });
}

/** 依權重隨機挑一個（城7）；權重都是 0 或沒有點時是 null */
export function weightedPick<T>(items: T[], weight?: (x: T) => number, random = Math.random): T | null {
  if (!items.length) return null;
  if (!weight) return items[Math.floor(random() * items.length)];
  const ws = items.map((x) => Math.max(0, weight(x) || 0));
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
