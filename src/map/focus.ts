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

/**
 * 地圖上被蓋住的部分（像素）：右邊的縮放按鈕那一欄、手機底部的國家抽屜（`data-occludes-map`）。
 * 移到某國時避開這些地方，國家才不會停在按鈕或抽屜底下（2026-10-30）
 */
export function mapInsets(container: HTMLElement): { left: number; right: number; top: number; bottom: number } {
  const rect = container.getBoundingClientRect();
  let bottom = 0;
  for (const el of document.querySelectorAll('[data-occludes-map]')) {
    bottom = Math.max(bottom, rect.bottom - el.getBoundingClientRect().top);
  }
  const overlaps = (r: DOMRect | undefined): r is DOMRect => Boolean(r && r.width > 0 && r.left < rect.right && r.right > rect.left);
  // 按鈕列：窄螢幕是右邊直的一列（蓋住右邊），寬螢幕是右上角橫的一列（蓋住上面）
  const tools = container.parentElement?.querySelector('.map-zoom')?.getBoundingClientRect();
  const column = tools && tools.width > 0 && tools.height > tools.width;
  let right = column ? Math.max(0, rect.right - tools.left) : 0;
  const top = tools && tools.width > 0 && !column ? Math.max(0, tools.bottom - rect.top) : 0;
  // 寬螢幕時浮在地圖上的清單（左邊）、國家側欄（右邊）（styles.css 的 .stage.is-map）；窄螢幕清單在地圖下面，跟地圖不重疊
  const stage = container.closest('.stage');
  const list = stage?.querySelector(':scope > .list-side')?.getBoundingClientRect();
  const left = overlaps(list) ? Math.max(0, list.right - rect.left) : 0;
  const panel = stage?.querySelector(':scope > .panel')?.getBoundingClientRect();
  if (overlaps(panel)) right = Math.max(right, rect.right - panel.left);
  return {
    left: Math.min(left, rect.width * 0.5),
    right: Math.min(right, rect.width * 0.5),
    top: Math.min(top, rect.height * 0.3),
    bottom: Math.min(Math.max(0, bottom), rect.height * 0.6),
  };
}

/** MapLibre 地球儀的半徑在這個緯度以上不再變（`cos(min(|緯度|, 85.051129°))`，6.16 的 Tk） */
const GLOBE_MAX_LAT = 85.051129;

/**
 * 主題的 focus 範圍是不是一整圈極區（經度 −180 到 180、整個在南緯或北緯 30° 以外）：是的話回傳哪一極與極區的外緣緯度。
 * 這種範圍用 fitBounds 會停在範圍中間的緯度（南極是南緯 77°），改成從極點正上方看（2026-11-01，MapLibre 6.13 起地球儀的中心可以到極點）
 */
export function polarCap(box: readonly [number, number, number, number]): { pole: 1 | -1; edge: number } | null {
  const [w, s, e, n] = box;
  if (w > -180 || e < 180) return null;
  if (s >= 30) return { pole: 1, edge: s };
  if (n <= -30) return { pole: -1, edge: n };
  return null;
}

/**
 * 從極點正上方看、讓外緣緯度 edge 那一圈在畫面上的半徑是 radius（px）時的縮放級數。
 * 相機在地球儀中心的正上方、距離畫面中心點 cameraDistance（MapLibre 的 cameraToCenterDistance：0.5 × 高 ÷ tan(視角 ÷ 2)）；
 * 角半徑 θ 的一圈在畫面上的半徑 = 距離 × R sinθ ÷ (距離 + R(1 − cosθ))，反解出地球儀的半徑 R（px），
 * 再用 MapLibre 的 R = 512 × 2^zoom ÷ 2π ÷ cos(min(|緯度|, 85.05°)) 換成縮放級數
 */
export function poleZoom(edge: number, radius: number, viewportHeight: number, fovDeg: number): number {
  const theta = ((90 - Math.abs(edge)) * Math.PI) / 180;
  const distance = (0.5 * viewportHeight) / Math.tan((fovDeg * Math.PI) / 360);
  const denominator = distance * Math.sin(theta) - radius * (1 - Math.cos(theta));
  // 半徑大到畫面放不下那一圈（理論上不會）時，讓整個地球儀小一點
  const globeRadius = denominator > 0 ? (radius * distance) / denominator : radius * 4;
  return Math.log2((globeRadius * 2 * Math.PI * Math.cos((GLOBE_MAX_LAT * Math.PI) / 180)) / 512);
}
