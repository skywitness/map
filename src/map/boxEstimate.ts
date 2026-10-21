/**
 * 框選估算：加總框內的網格人口（GHS-POP，pipeline/topics/population_grid.py），
 * 再由呼叫端把每個國家的網格人數縮放到選定年份的總量。另外在 Equal Earth（等面積投影）
 * 的平面座標裡把國界裁切到框內，算出框內的陸地面積。
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

/** 框內陸地面積（km²）：每個國家的形狀用 Sutherland–Hodgman 裁切到框內再算面積 */
export function landAreaInBox(index: RawIndex, box: Box): number {
  let landUnits = 0;
  for (const c of index.countries) {
    const [bx0, by0, bx1, by1] = c.bbox;
    if (bx1 < box[0] || bx0 > box[2] || by1 < box[1] || by0 > box[3] || c.signedArea === 0) continue;
    const contained = bx0 >= box[0] && bx1 <= box[2] && by0 >= box[1] && by1 <= box[3];
    const clipped = contained
      ? c.signedArea
      : c.rings.reduce((sum, ring) => sum + ringArea(clipRing(ring, box)), 0);
    landUnits += Math.abs(clipped);
  }
  return landUnits * index.km2PerUnit;
}

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
  /** 每一列網格上緣的原始投影 y（最後多一個是最後一列的下緣）；北邊 y 較小 */
  rowY: Float64Array;
  /** 每一列網格中心緯度上，經度 1° 對應的原始投影 x（Equal Earth 的 x 跟經度成正比） */
  rowXPerDeg: Float64Array;
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

  const rows = Math.round(180 / grid.cellSize);
  const rowY = new Float64Array(rows + 1);
  const rowXPerDeg = new Float64Array(rows);
  for (let r = 0; r <= rows; r++) {
    rowY[r] = rawProjection([0, 90 - r * grid.cellSize])![1];
    if (r < rows) rowXPerDeg[r] = rawProjection([1, 90 - (r + 0.5) * grid.cellSize])![0];
  }

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
    rowY,
    rowXPerDeg,
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
 * 加總框內的網格人數。框邊切過的網格依重疊面積比例計入（假設網格內平均分布），
 * 框拖動時數字才會連續變化，不會一格一格跳。網格在投影後近似成「中心緯度寬度」的長方形。
 */
export function gridInBox(grid: GridIndex, [bx0, by0, bx1, by1]: Box): GridInBox {
  const byCountry = new Float64Array(grid.countries.length);
  let unassigned = 0;
  const { cols, cellSize, rowY, rowXPerDeg } = grid;
  const rows = rowXPerDeg.length;

  // y 只跟緯度有關：先找出跟框重疊的列，再用二分搜尋找到這幾列的網格
  let r0 = 0;
  while (r0 < rows && rowY[r0 + 1] <= by0) r0++;
  let r1 = r0;
  while (r1 < rows && rowY[r1] < by1) r1++;
  const end = lowerBound(grid.cells, r1 * cols);

  for (let i = lowerBound(grid.cells, r0 * cols); i < end; i++) {
    const row = Math.floor(grid.cells[i] / cols);
    const col = grid.cells[i] - row * cols;
    const fy = overlap(rowY[row], rowY[row + 1], by0, by1);
    if (fy <= 0) continue;
    const x0 = (col * cellSize - 180) * rowXPerDeg[row];
    const fx = overlap(x0, x0 + cellSize * rowXPerDeg[row], bx0, bx1);
    if (fx <= 0) continue;
    const f = fx * fy;
    for (let j = grid.start[i]; j < grid.start[i + 1]; j++) {
      const c = grid.country[j];
      if (c >= 0) byCountry[c] += grid.pop[j] * f;
      else unassigned += grid.pop[j] * f;
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
