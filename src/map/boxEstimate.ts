/**
 * 框選估算：在 Equal Earth（等面積投影）的平面座標裡，把每個國家的形狀裁切到框內，
 * 用「框內面積 ÷ 全國面積」乘上該國總量。等於假設每個國家內部密度平均。
 *
 * 框用「原始投影座標」表示（scale = 1、translate = 0），跟版面大小、縮放都無關，
 * 側欄開關造成地圖重新縮放時，框仍然對著同一塊地方。
 */
import { geoEqualEarth, geoPath, geoStream } from 'd3-geo';
import type { CountryFeature } from './geometry';

/** [x0, y0, x1, y1]，原始投影座標，x0 < x1、y0 < y1 */
export type Box = [number, number, number, number];

interface RawCountry {
  iso3: string;
  /** 每個 ring 是攤平的 [x0, y0, x1, y1, …] */
  rings: number[][];
  bbox: Box;
  /** 帶正負號的面積總和（外環與內環方向相反，相加就扣掉湖泊、飛地） */
  signedArea: number;
}

export interface RawIndex {
  countries: RawCountry[];
  /** 每單位原始投影面積代表多少 km² */
  km2PerUnit: number;
}

const EARTH_SURFACE_KM2 = 510_072_000;

export const rawProjection = geoEqualEarth().scale(1).translate([0, 0]).precision(0);

const indexCache = new WeakMap<CountryFeature[], RawIndex>();

export function buildRawIndex(features: CountryFeature[]): RawIndex {
  const cached = indexCache.get(features);
  if (cached) return cached;

  const countries = features.map(({ iso3, feature }) => {
    const rings: number[][] = [];
    let current: number[] | null = null;
    geoStream(
      feature,
      rawProjection.stream({
        point: (x, y) => current?.push(x, y),
        lineStart: () => (current = []),
        lineEnd: () => {
          if (current && current.length >= 6) rings.push(current);
          current = null;
        },
        polygonStart: () => {},
        polygonEnd: () => {},
        sphere: () => {},
      }),
    );
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        x0 = Math.min(x0, ring[i]);
        x1 = Math.max(x1, ring[i]);
        y0 = Math.min(y0, ring[i + 1]);
        y1 = Math.max(y1, ring[i + 1]);
      }
    }
    const signedArea = rings.reduce((sum, ring) => sum + ringArea(ring), 0);
    return { iso3, rings, bbox: [x0, y0, x1, y1] as Box, signedArea };
  });

  const sphereArea = geoPath(rawProjection).area({ type: 'Sphere' });
  const index = { countries, km2PerUnit: EARTH_SURFACE_KM2 / sphereArea };
  indexCache.set(features, index);
  return index;
}

export interface BoxShares {
  /** iso3 → 該國有多少比例的面積落在框內（0–1） */
  shares: Map<string, number>;
  /** 框內陸地面積（km²） */
  landKm2: number;
}

export function sharesInBox(index: RawIndex, box: Box): BoxShares {
  const shares = new Map<string, number>();
  let landUnits = 0;
  for (const c of index.countries) {
    const [bx0, by0, bx1, by1] = c.bbox;
    if (bx1 < box[0] || bx0 > box[2] || by1 < box[1] || by0 > box[3] || c.signedArea === 0) continue;
    const contained = bx0 >= box[0] && bx1 <= box[2] && by0 >= box[1] && by1 <= box[3];
    const clipped = contained
      ? c.signedArea
      : c.rings.reduce((sum, ring) => sum + ringArea(clipRing(ring, box)), 0);
    const share = Math.min(1, Math.max(0, clipped / c.signedArea));
    if (share > 0) {
      shares.set(c.iso3, share);
      landUnits += Math.abs(clipped);
    }
  }
  return { shares, landKm2: landUnits * index.km2PerUnit };
}

function ringArea(ring: number[]): number {
  const n = ring.length;
  if (n < 6) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    sum += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return sum / 2;
}

/** Sutherland–Hodgman：依序用矩形的四條邊裁切（凹多邊形也適用，面積仍正確） */
function clipRing(ring: number[], [x0, y0, x1, y1]: Box): number[] {
  let pts = ring;
  pts = clipEdge(pts, 0, x0, true);
  pts = clipEdge(pts, 0, x1, false);
  pts = clipEdge(pts, 1, y0, true);
  pts = clipEdge(pts, 1, y1, false);
  return pts;
}

/** axis 0 = x、1 = y；keepGreater 表示保留座標 ≥ limit 的一側 */
function clipEdge(pts: number[], axis: 0 | 1, limit: number, keepGreater: boolean): number[] {
  const n = pts.length;
  if (n === 0) return pts;
  const out: number[] = [];
  const inside = (i: number) => (keepGreater ? pts[i + axis] >= limit : pts[i + axis] <= limit);
  for (let i = 0; i < n; i += 2) {
    const prev = (i - 2 + n) % n;
    const currIn = inside(i);
    const prevIn = inside(prev);
    if (currIn !== prevIn) {
      const t = (limit - pts[prev + axis]) / (pts[i + axis] - pts[prev + axis]);
      out.push(pts[prev] + t * (pts[i] - pts[prev]), pts[prev + 1] + t * (pts[i + 1] - pts[prev + 1]));
    }
    if (currIn) out.push(pts[i], pts[i + 1]);
  }
  return out;
}

export function normalizeBox(a: [number, number], b: [number, number]): Box {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
