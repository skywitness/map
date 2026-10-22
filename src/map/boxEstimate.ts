/**
 * 框選估算：加總框內的網格人口（GHS-POP，pipeline/topics/population_grid.py），
 * 再由呼叫端把每個國家的網格人數縮放到選定年份的總量。另外把國界裁切到框內，算出框內的陸地面積。
 *
 * 框用經緯度範圍 [西, 南, 東, 北] 表示，跟地圖的縮放、旋轉、投影都無關。
 * 西 > 東 代表框跨過 180° 經線（在地球儀上往太平洋拖時會發生），計算時拆成兩段。
 */
import { geoEqualEarth } from 'd3-geo';
import type { CountryFeature } from './geometry';

/** [west, south, east, north]，經緯度 */
export type Box = [number, number, number, number];

const EARTH_RADIUS_KM = 6371.0088;
const RAD = Math.PI / 180;

/** 跨 180° 經線的框拆成兩段 */
function parts([w, s, e, n]: Box): Box[] {
  return w <= e ? [[w, s, e, n]] : [[w, s, 180, n], [-180, s, e, n]];
}

/* ── 陸地面積 ─────────────────────────── */

interface CountryRings {
  iso3: string;
  /** 每個 ring 攤平成 [lon0, lat0, lon1, lat1, …]；外環與內環分開 */
  outer: number[][];
  holes: number[][];
  bbox: Box;
}

const ringCache = new WeakMap<CountryFeature[], CountryRings[]>();

function countryRings(features: CountryFeature[]): CountryRings[] {
  const cached = ringCache.get(features);
  if (cached) return cached;
  const out = features.map(({ iso3, feature }) => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const outer: number[][] = [];
    const holes: number[][] = [];
    let w = 180, s = 90, e = -180, n = -90;
    for (const polygon of polygons) {
      polygon.forEach((ring, i) => {
        const flat = ring.flatMap(([x, y]) => [x, y]);
        (i === 0 ? outer : holes).push(flat);
        for (const [x, y] of ring) {
          w = Math.min(w, x);
          e = Math.max(e, x);
          s = Math.min(s, y);
          n = Math.max(n, y);
        }
      });
    }
    return { iso3, outer, holes, bbox: [w, s, e, n] as Box };
  });
  ringCache.set(features, out);
  return out;
}

/** 框內陸地面積（km²）：每個國家的形狀用 Sutherland–Hodgman 裁切到框內，再算球面面積 */
export function landAreaInBox(features: CountryFeature[], box: Box): number {
  let total = 0;
  for (const part of parts(box)) {
    for (const c of countryRings(features)) {
      const [cw, cs, ce, cn] = c.bbox;
      if (ce < part[0] || cw > part[2] || cn < part[1] || cs > part[3]) continue;
      const area = (rings: number[][]) => rings.reduce((sum, r) => sum + sphericalArea(clipRing(r, part)), 0);
      total += Math.max(0, area(c.outer) - area(c.holes));
    }
  }
  return total;
}

/** 經緯度多邊形的球面面積（km²），常用的近似公式：Σ Δλ·(2 + sin φ₁ + sin φ₂) / 2 */
function sphericalArea(ring: number[]): number {
  const n = ring.length;
  if (n < 6) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    sum += (ring[j] - ring[i]) * RAD * (2 + Math.sin(ring[i + 1] * RAD) + Math.sin(ring[j + 1] * RAD));
  }
  return (Math.abs(sum) * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2;
}

/** Sutherland–Hodgman：依序用矩形的四條邊裁切（凹多邊形也適用，面積仍正確） */
function clipRing(ring: number[], [w, s, e, n]: Box): number[] {
  let pts = ring;
  pts = clipEdge(pts, 0, w, true);
  pts = clipEdge(pts, 0, e, false);
  pts = clipEdge(pts, 1, s, true);
  pts = clipEdge(pts, 1, n, false);
  return pts;
}

/** axis 0 = 經度、1 = 緯度；keepGreater 表示保留座標 ≥ limit 的一側 */
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

/* ── 網格人口 ─────────────────────────── */

/** grid.json（pipeline/topics/population_grid.py）：每筆是「一個網格裡屬於某國的人數」 */
export interface PopulationGrid {
  /** 網格人口的年份 */
  epoch: number;
  /** 網格大小（度） */
  cellSize: number;
  cols: number;
  countries: string[];
  /** 網格編號（row × cols + col，row 0 從北緯 90° 開始）的差分；同一格的第二筆以後是 0 */
  cell: number[];
  /** countries 的索引；−1 代表不在任何國界內（1:50m 圖資沒有形狀的小島） */
  country: number[];
  pop: number[];
}

export interface GridIndex {
  epoch: number;
  countries: string[];
  cellSize: number;
  cols: number;
  /** 有人口的網格編號（遞增） */
  cells: Uint32Array;
  /** 第 i 格的資料在 country、pop 的範圍是 [start[i], start[i + 1]) */
  start: Uint32Array;
  country: Int16Array;
  pop: Float64Array;
  /** 各國的網格總人數（索引同 countries），框內人數除以它就是「占該國人口的比例」 */
  totals: Float64Array;
}

const gridCache = new WeakMap<PopulationGrid, GridIndex>();

export function buildGridIndex(grid: PopulationGrid): GridIndex {
  const cached = gridCache.get(grid);
  if (cached) return cached;

  const n = grid.cell.length;
  const cells: number[] = [];
  const start: number[] = [];
  const totals = new Float64Array(grid.countries.length);
  let cell = 0;
  for (let j = 0; j < n; j++) {
    cell += grid.cell[j];
    if (j === 0 || grid.cell[j] !== 0) {
      cells.push(cell);
      start.push(j);
    }
    const c = grid.country[j];
    if (c >= 0) totals[c] += grid.pop[j];
  }
  start.push(n);

  const index: GridIndex = {
    epoch: grid.epoch,
    countries: grid.countries,
    cellSize: grid.cellSize,
    cols: grid.cols,
    cells: Uint32Array.from(cells),
    start: Uint32Array.from(start),
    country: Int16Array.from(grid.country),
    pop: Float64Array.from(grid.pop),
    totals,
  };
  gridCache.set(grid, index);
  return index;
}

export interface GridInBox {
  /** 各國落在框內的網格人數（索引同 GridIndex.countries） */
  byCountry: Float64Array;
  /** 不在任何國界內的人數 */
  unassigned: number;
}

/**
 * 加總框內的網格人數。網格是經緯度對齊的，框邊切過的網格依重疊比例計入（假設網格內平均分布），
 * 框拖動時數字才會連續變化，不會一格一格跳。
 */
export function gridInBox(grid: GridIndex, box: Box): GridInBox {
  const byCountry = new Float64Array(grid.countries.length);
  let unassigned = 0;
  const { cols, cellSize } = grid;
  for (const [w, s, e, n] of parts(box)) {
    // row 0 從北緯 90° 開始往南
    const r0 = Math.max(0, Math.floor((90 - n) / cellSize));
    const r1 = Math.ceil((90 - s) / cellSize);
    const end = lowerBound(grid.cells, r1 * cols);
    for (let i = lowerBound(grid.cells, r0 * cols); i < end; i++) {
      const row = Math.floor(grid.cells[i] / cols);
      const col = grid.cells[i] - row * cols;
      const top = 90 - row * cellSize;
      const fy = overlap(top - cellSize, top, s, n);
      if (fy <= 0) continue;
      const left = col * cellSize - 180;
      const fx = overlap(left, left + cellSize, w, e);
      if (fx <= 0) continue;
      const f = fx * fy;
      for (let j = grid.start[i]; j < grid.start[i + 1]; j++) {
        const c = grid.country[j];
        if (c >= 0) byCountry[c] += grid.pop[j] * f;
        else unassigned += grid.pop[j] * f;
      }
    }
  }
  return { byCountry, unassigned };
}

/** [a0, a1] 有多少比例落在 [b0, b1] 內 */
function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / (a1 - a0);
}

/** 第一個 ≥ value 的位置 */
function lowerBound(sorted: Uint32Array, value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/* ── 框的建立與舊網址相容 ─────────────── */

/** 兩個角落的經緯度 → 框；經度差超過 180° 時視為跨過 180° 經線 */
export function boxFromCorners(a: [number, number], b: [number, number]): Box {
  const [w, e] = a[0] <= b[0] ? [a[0], b[0]] : [b[0], a[0]];
  const s = Math.max(-90, Math.min(a[1], b[1]));
  const n = Math.min(90, Math.max(a[1], b[1]));
  return e - w > 180 ? [e, s, w, n] : [w, s, e, n];
}

/** 舊版網址的 box= 是 Equal Earth 原始投影座標（scale 1），換成經緯度 */
export function boxFromLegacyRaw([x0, y0, x1, y1]: Box): Box | null {
  const projection = geoEqualEarth().scale(1).translate([0, 0]);
  const nw = projection.invert?.([x0, y0]);
  const se = projection.invert?.([x1, y1]);
  return nw && se ? boxFromCorners(nw, se) : null;
}

/** 框的外框線（經緯度多邊形），邊上加點，地球儀上才會沿著經緯線彎曲 */
export function boxPolygon([w, s, e, n]: Box): GeoJSON.Polygon {
  const east = w <= e ? e : e + 360;
  const steps = 24;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) ring.push([w + ((east - w) * i) / steps, n]);
  for (let i = 1; i <= steps; i++) ring.push([east, n - ((n - s) * i) / steps]);
  for (let i = 1; i <= steps; i++) ring.push([east - ((east - w) * i) / steps, s]);
  for (let i = 1; i < steps; i++) ring.push([w, s + ((n - s) * i) / steps]);
  ring.push(ring[0]);
  // 跨 180° 經線時經度會超過 180，MapLibre 可以直接畫，保持連續才不會繞地球一圈
  return { type: 'Polygon', coordinates: [ring] };
}
