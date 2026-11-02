/**
 * 日食那一刻的本影（2026-11-02，新14：日食主題選一次日食時播放本影沿著路徑移動）：用 NASA 的貝塞爾根數
 * （pipeline/topics/eclipse_elements.py 的 elements.json）算任一刻影軸打到地面的點與本影的外框。
 * 跟 pipeline/topics/eclipses.py 的 Frame、on_earth、geodetic 同一套算法（Explanatory Supplement 的基本面座標，地球是 WGS 84 的扁橢球）：
 * - t 是 TDT − t0（小時）；x、y 是影軸在基本面上的位置，l2 是本影錐在基本面的半徑（l2 < 0 全食、> 0 環食），d、μ 是度。
 * - 基本面上的點 (ξ, η) 沿影軸方向打到橢球朝月球那一面，換成大地緯度與經度，經度再加 0.00417807° × ΔT（曆書子午線）。
 * - 本影的外框：基本面上以影軸為圓心、半徑 |L2| = |l2 − ζ tan f2| 的圓（ζ 是那一點離基本面的高度，先用中心的 ζ，再用每一點自己的修一次），
 *   一圈 48 點打到地面；打不到地球的點（影子掠過地球邊緣）略過。
 */

/** elements.json 的一列（欄位見 pipeline 的 FIELDS） */
export type ElementsRow = [number, number, number, number, number[], number[], number[], number[], number[], number];

export interface EclipseElements {
  e: number;
  ymd: number;
  t0: number;
  dt: number;
  x: number[];
  y: number[];
  d: number[];
  l2: number[];
  mu: number[];
  tf2: number;
}

export function parseElements(row: ElementsRow): EclipseElements {
  const [e, ymd, t0, dt, x, y, d, l2, mu, tf2] = row;
  return { e, ymd, t0, dt, x, y, d, l2, mu, tf2 };
}

const E2 = 0.00669438;
const K = 1 - E2;
const DT_LON = 0.00417807;
const RAD = Math.PI / 180;

const poly = (c: number[], t: number) => c.reduce((sum, v, i) => sum + v * t ** i, 0);

interface Frame {
  x: number;
  y: number;
  l2: number;
  tf2: number;
  X: [number, number, number];
  Y: [number, number, number];
  Z: [number, number, number];
  dt: number;
}

function frame(el: EclipseElements, t: number): Frame {
  const d = poly(el.d, t) * RAD;
  const mu = poly(el.mu, t) * RAD;
  const [sd, cd, sm, cm] = [Math.sin(d), Math.cos(d), Math.sin(mu), Math.cos(mu)];
  return {
    x: poly(el.x, t),
    y: poly(el.y, t),
    l2: poly(el.l2, t),
    tf2: el.tf2,
    X: [sm, cm, 0],
    Y: [-sd * cm, sd * sm, cd],
    Z: [cd * cm, -cd * sm, sd],
    dt: el.dt,
  };
}

/** 基本面上的 (ξ, η) 打到橢球朝月球那一面：[經度, 緯度, ζ]；打不到是 null */
function onEarth(f: Frame, xi: number, eta: number): [number, number, number] | null {
  const A = [0, 1, 2].map((k) => xi * f.X[k] + eta * f.Y[k]);
  const w = [1, 1, 1 / K];
  let a2 = 0;
  let a1 = 0;
  let a0 = -1;
  for (let k = 0; k < 3; k++) {
    a2 += w[k] * f.Z[k] * f.Z[k];
    a1 += 2 * w[k] * A[k] * f.Z[k];
    a0 += w[k] * A[k] * A[k];
  }
  const disc = a1 * a1 - 4 * a2 * a0;
  if (disc < 0) return null;
  const s = (-a1 + Math.sqrt(disc)) / (2 * a2);
  const P = [0, 1, 2].map((k) => A[k] + s * f.Z[k]);
  const lat = Math.atan2(P[2], K * Math.hypot(P[0], P[1])) / RAD;
  const lon = Math.atan2(P[1], P[0]) / RAD + DT_LON * f.dt;
  return [(((lon + 180) % 360) + 360) % 360 - 180, lat, s];
}

export interface Umbra {
  center: [number, number];
  /** 外框（經度展開成連續的，跨 180° 經線不會斷開）；影子掠過地球邊緣、點太少時是 null */
  ring: [number, number][] | null;
  /** 全食（L2 < 0）或環食 */
  total: boolean;
}

/** t（TDT − t0，小時）那一刻的本影；影軸沒打到地球時是 null */
export function umbraAt(el: EclipseElements, t: number, points = 48): Umbra | null {
  const f = frame(el, t);
  const c = onEarth(f, f.x, f.y);
  if (!c) return null;
  const L = f.l2 - c[2] * f.tf2;
  const ring: [number, number][] = [];
  for (let k = 0; k < points; k++) {
    const a = (2 * Math.PI * k) / points;
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    let p = onEarth(f, f.x + Math.abs(L) * ca, f.y + Math.abs(L) * sa);
    if (!p) continue;
    // 用那一點自己的高度修一次半徑
    const r = Math.abs(f.l2 - p[2] * f.tf2);
    p = onEarth(f, f.x + r * ca, f.y + r * sa) ?? p;
    ring.push([p[0], p[1]]);
  }
  // 經度接成連續的（以中心為準）
  const unwrapped = ring.map(([lon, lat]): [number, number] => [lon + 360 * Math.round((c[0] - lon) / 360), lat]);
  return {
    center: [c[0], c[1]],
    ring: unwrapped.length >= points / 2 ? [...unwrapped, unwrapped[0]] : null,
    total: L < 0,
  };
}

/** 影軸打在地球上的時間範圍（TDT − t0，小時）：每分鐘取一次，回傳 [開始, 結束]；整段都沒打到是 null */
export function centralSpan(el: EclipseElements, span = 3.6, step = 1 / 60): [number, number] | null {
  let first: number | null = null;
  let last: number | null = null;
  for (let t = -span; t <= span; t += step) {
    const f = frame(el, t);
    if (onEarth(f, f.x, f.y)) {
      if (first === null) first = t;
      last = t;
    }
  }
  return first === null || last === null ? null : [first, last];
}

/** TDT − t0（小時）→ 世界時的「HH:MM」（跨日時加 ±1 天的標記） */
export function utcText(el: EclipseElements, t: number): string {
  let minutes = Math.round((el.t0 + t - el.dt / 3600) * 60);
  let day = 0;
  while (minutes < 0) {
    minutes += 1440;
    day -= 1;
  }
  while (minutes >= 1440) {
    minutes -= 1440;
    day += 1;
  }
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}${day ? (day > 0 ? ' (+1)' : ' (−1)') : ''}`;
}
