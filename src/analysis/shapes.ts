/**
 * 分析檢視的世界地圖（2026-10-30）：Equal Earth 投影的平面 SVG，國界用全球視角的 1:110m（app/hooks.ts 的 GEO_COARSE，
 * 已經在快取裡）。路徑在固定的 viewBox（寬 1000）裡算一次，大地圖、小地圖並排、拉簾都用同一份，靠 viewBox 縮放
 */
import { useMemo } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import type { Topology } from 'topojson-specification';
import { GEO_COARSE } from '../app/hooks';
import { useJson } from '../lib/data';
import { toCountryFeatures } from '../map/geometry';

export const VIEW_W = 1000;

export interface WorldShapes {
  /** viewBox 的高（寬固定 VIEW_W；不畫南極洲，依各國的範圍算） */
  height: number;
  /** 海：整顆地球的外框（下緣被 viewBox 切掉） */
  sphere: string;
  countries: { iso3: string; d: string }[];
  /** 比例圓的位置（最大那塊陸地的中心） */
  anchors: Map<string, [number, number]>;
}

export function useWorldShapes(): WorldShapes | null {
  const topo = useJson<Topology>(GEO_COARSE).data;
  return useMemo(() => {
    if (!topo) return null;
    const features = toCountryFeatures(topo);
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: features.map((c) => c.feature) };
    const projection = geoEqualEarth().fitWidth(VIEW_W - 8, collection);
    const path = geoPath(projection);
    const [[, y0], [, y1]] = path.bounds(collection);
    // 上下各留 4 個單位，整張往上移到 y0
    const [tx, ty] = projection.translate();
    projection.translate([tx + 4, ty - y0 + 4]);
    const anchors = new Map<string, [number, number]>();
    const countries = features.flatMap((c) => {
      const d = path(c.feature);
      const at = projection(c.anchor);
      if (at) anchors.set(c.iso3, [at[0], at[1]]);
      return d ? [{ iso3: c.iso3, d }] : [];
    });
    return { height: Math.ceil(y1 - y0 + 8), sphere: path({ type: 'Sphere' }) ?? '', countries, anchors };
  }, [topo]);
}
