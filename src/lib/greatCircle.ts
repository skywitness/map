/**
 * 大圓的距離、方位、終點（2026-11-02，新33：從台北看世界的中心可以拖，指標、航線、距離圈在瀏覽器裡算）。
 * 跟 pipeline/topics/taipei_view.py 同一套公式（地球是半徑 6,371.0088 km 的球）。
 */
export const EARTH_KM = 6371.0088;
const RAD = Math.PI / 180;

/** [距離（km）, 一開始的方位（度，0 是北、順時針）] */
export function distanceBearing(lon1: number, lat1: number, lon2: number, lat2: number): [number, number] {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dl = (lon2 - lon1) * RAD;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const d = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return [d, ((Math.atan2(y, x) / RAD) + 360) % 360];
}

/** 從 (lon, lat) 朝 bearing 走 km 公里到哪裡 */
export function destination(lon: number, lat: number, bearing: number, km: number): [number, number] {
  const p1 = lat * RAD;
  const l1 = lon * RAD;
  const b = bearing * RAD;
  const dr = km / EARTH_KM;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(dr) + Math.cos(p1) * Math.sin(dr) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(p1), Math.cos(dr) - Math.sin(p1) * Math.sin(p2));
  return [l2 / RAD, p2 / RAD];
}

/** 經度改成連續的（可以超過 ±180），線才不會橫越整個地圖 */
export function unwrap(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [lon, lat] of points) {
    const prev = out.length ? out[out.length - 1][0] : lon;
    out.push([lon + 360 * Math.round((prev - lon) / 360), lat]);
  }
  return out;
}

/** 八方位：1 北、2 東北、3 東、4 東南、5 南、6 西南、7 西、8 西北 */
export function octant(bearing: number): number {
  return Math.floor((((bearing + 22.5) % 360) + 360) % 360 / 45) + 1;
}

/** 大圓航線：每隔 stepKm 一點 */
export function greatCircle(from: [number, number], to: [number, number], stepKm = 150): [number, number][] {
  const [d, b] = distanceBearing(from[0], from[1], to[0], to[1]);
  const n = Math.max(2, Math.ceil(d / stepKm));
  return unwrap(Array.from({ length: n + 1 }, (_, i) => destination(from[0], from[1], b, (d * i) / n)));
}

/** 以 center 為中心、半徑 km 的距離圈（每 2° 一點） */
export function distanceRing(center: [number, number], km: number): [number, number][] {
  return unwrap(Array.from({ length: 181 }, (_, i) => destination(center[0], center[1], i * 2, km)));
}
