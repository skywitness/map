import { geoArea } from 'd3-geo';
import type { CountryFeature } from './geometry';

type Bounds = [[number, number], [number, number]];
interface Part {
  w: number;
  s: number;
  e: number;
  n: number;
  area: number;
}

/** 附近的島（跟目前範圍相距幾度以內）才一起框進來 */
const NEAR_DEG = 8;
/** 比最大那塊陸地的這個比例還小的島不管，阿留申群島、夏威夷才不會把美國拉成半個地球 */
const MIN_SHARE = 0.01;

/**
 * 把地圖移到某國時要框住的經緯度範圍：最大那塊陸地，加上附近夠大的島（科西嘉、九州、蘇門答臘），
 * 不含遠方的屬地（法屬圭亞那、留尼旺）。經度展開成跟最大那塊連續的，跨 180° 經線的斐濟、俄羅斯遠東才不會變成橫跨全球。
 */
export function focusBounds(country: CountryFeature): Bounds {
  const geometry = country.feature.geometry;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const parts = polygons.map((rings): Part => {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    let offset = 0;
    rings[0].forEach(([lon, lat], i) => {
      if (i > 0) {
        const prev = rings[0][i - 1][0];
        if (lon - prev > 180) offset -= 360;
        else if (prev - lon > 180) offset += 360;
      }
      w = Math.min(w, lon + offset);
      e = Math.max(e, lon + offset);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    });
    return { w, s, e, n, area: geoArea({ type: 'Polygon', coordinates: rings }) };
  });
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const center = (main.w + main.e) / 2;
  for (const p of parts) {
    const shift = Math.round((center - (p.w + p.e) / 2) / 360) * 360;
    p.w += shift;
    p.e += shift;
  }

  const box = { ...main };
  const pending = parts.filter((p) => p !== main && p.area >= main.area * MIN_SHARE);
  let grew = true;
  while (grew) {
    grew = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      const gap = Math.max(p.w - box.e, box.w - p.e, p.s - box.n, box.s - p.n);
      if (gap > NEAR_DEG) continue;
      box.w = Math.min(box.w, p.w);
      box.e = Math.max(box.e, p.e);
      box.s = Math.min(box.s, p.s);
      box.n = Math.max(box.n, p.n);
      pending.splice(i, 1);
      grew = true;
    }
  }
  return [[box.w, box.s], [box.e, box.n]];
}
