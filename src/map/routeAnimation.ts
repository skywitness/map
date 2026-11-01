/**
 * 沿路線移動的點（2026-11-01，MapLibre 範例「Animate a point along a route」；線圖層的 `animate`）：清單側欄點一個颱風、
 * 一次航程時，一個圓點沿著那條線從頭走到尾，旁邊寫名稱與那一刻的日期，走完停 2 秒再消失。
 * - 依頂點的順序等速走（颱風每 6 小時、航海日誌每天正午一個頂點，所以跟時間成正比），兩個頂點之間直線內插；經度先展開成連續的，
 *   跨過 180° 經線的路徑不會繞地球一圈。
 * - 點的顏色是那一段的分類色（颱風的強度），白色外框；畫在最上面（`route-anim` source 的兩個圖層）。
 * - 使用者偏好減少動態效果時直接停在終點。
 */
import type { DataDrivenPropertyValueSpecification, GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';

export const ROUTE_SOURCE = 'route-anim';
const HOLD_MS = 2000;

export interface RoutePath {
  coords: [number, number][];
  /** 每個頂點的顏色 */
  colors: string[];
  label: (fraction: number) => string;
  seconds: number;
}

/** 經度展開成連續的（相鄰兩點差超過 180° 時加減 360°） */
export function unwrapLongitudes(coords: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let offset = 0;
  coords.forEach(([lon, lat], k) => {
    if (k > 0) {
      const prev = coords[k - 1][0];
      if (lon - prev > 180) offset -= 360;
      else if (prev - lon > 180) offset += 360;
    }
    out.push([lon + offset, lat]);
  });
  return out;
}

/** 走到 fraction（0–1）時的位置與那一段的頂點 */
export function pointAt(coords: [number, number][], fraction: number): { at: [number, number]; index: number } {
  const f = Math.min(1, Math.max(0, fraction)) * (coords.length - 1);
  const index = Math.min(coords.length - 2, Math.floor(f));
  const t = f - index;
  const [a, b] = [coords[index], coords[index + 1]];
  return { at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index };
}

export function routeLayers(font: DataDrivenPropertyValueSpecification<string[]>, dark: boolean) {
  return [
    {
      id: 'route-anim-dot',
      type: 'circle' as const,
      source: ROUTE_SOURCE,
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'] as ['get', string],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2.5,
        'circle-pitch-alignment': 'map' as const,
      },
    },
    {
      id: 'route-anim-label',
      type: 'symbol' as const,
      source: ROUTE_SOURCE,
      layout: {
        'text-field': ['get', 'label'] as ['get', string],
        'text-font': font,
        'text-size': 13,
        'text-anchor': 'left' as const,
        'text-offset': [1, 0] as [number, number],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': dark ? '#ffffff' : '#111111',
        'text-halo-color': dark ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.92)',
        'text-halo-width': 1.6,
      },
    },
  ];
}

/** 開始沿著 path 走；回傳停止的函式（換一組、換主題時呼叫） */
export function playRoute(map: MaplibreMap, path: RoutePath, reduceMotion: boolean): () => void {
  const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  if (!source) return () => {};
  const coords = unwrapLongitudes(path.coords);
  const duration = path.seconds * 1000;
  const start = performance.now();
  let frame = 0;
  let hold = 0;
  const draw = (fraction: number) => {
    const { at, index } = pointAt(coords, fraction);
    source.setData({
      type: 'Feature',
      properties: { color: path.colors[index] ?? '#333333', label: path.label(fraction) },
      geometry: { type: 'Point', coordinates: at },
    });
  };
  const clear = () => source.setData({ type: 'FeatureCollection', features: [] });
  const step = (now: number) => {
    const fraction = reduceMotion ? 1 : (now - start) / duration;
    draw(fraction);
    if (fraction < 1) frame = requestAnimationFrame(step);
    else hold = window.setTimeout(clear, HOLD_MS);
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(hold);
    if (map.getSource(ROUTE_SOURCE)) clear();
  };
}
