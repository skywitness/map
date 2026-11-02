/**
 * 依時間連成一條線的點（PointsOverlayDef.trail，2026-11-02，新1，北磁極的漂移）：
 * - 點依時間欄位排好、連成一條線，顏色依年份漸層（點的分級顏色放在每一級的中間，級與級之間內插），那一年的點畫成大一點的
 *   「現在」並寫年份。累積模式（磁極的軌跡）畫到那一年為止；只看那一年的指標（首都的磁偏角）整條淡淡地畫、只標出那一年。
 * - 用一張 2D canvas 疊在地圖上畫（地圖每畫一格就重畫，`render` 事件），不用 MapLibre 的 GeoJSON 圖層：
 *   GeoJSON 圖磚只到南北緯 85.05°（Web Mercator 的邊界），以北的點會被壓到 85.05° 那一圈上，北磁極 2011 年起都在那以北；
 *   地球儀的投影（map.project）到 90° 都是準的。地球儀背面的線段不畫。
 * - 滑過、點選、右鍵：mapEvents 的 featureAt 先問 trailAt（8 px 內最近的點），回傳跟點圖層一樣的 feature（tooltip 照舊）。
 * - 平面地圖時經度先接成連續的（跨 180° 經線時不會橫過整張地圖）；85.05° 以北畫在世界的上緣外面。
 * - 匯出圖片時 exportImage.ts 的 captureMap 把這張 canvas 疊上去（`.map-overlay-canvas`）。
 */
import { LngLat, type Map as MaplibreMap, type MapGeoJSONFeature } from 'maplibre-gl';
import type { ColorClasses, IndicatorDef, PointRecord } from '../topics/types';
import { unwrapLongitudes } from './routeAnimation';

export const OVERLAY_CANVAS_CLASS = 'map-overlay-canvas';

interface TrailState {
  /** 疊加圖層的 MapLibre id（ov-north） */
  layerId: string;
  points: PointRecord[];
  /** 依時間排好的索引 */
  order: number[];
  /** 接成連續的經度（order 的順序） */
  lons: number[];
  timeField: string;
  colors: ColorClasses;
  year: number;
  mode: IndicatorDef['overlayTime'];
  visible: boolean;
  /** 那一點旁邊寫的字 */
  head: (p: PointRecord) => string;
  /** 深色底圖：外框與字的顏色反過來 */
  dark: boolean;
}

interface Drawn {
  layerId: string;
  index: number;
  x: number;
  y: number;
}

/** 十六進位色 → [r, g, b] */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 分級顏色 → 連續的漸層：每一級的顏色放在那一級的中間（第一級、最後一級放在資料的頭尾與門檻的中間） */
export function gradientStops(colors: ColorClasses, first: number, last: number): [number, [number, number, number]][] {
  const t = colors.thresholds;
  const bounds = [Math.min(first, t[0]), ...t, Math.max(last, t[t.length - 1])];
  return colors.classes.map((c, k) => [(bounds[k] + bounds[k + 1]) / 2, rgb(c.color)]);
}

export function colorAt(stops: [number, [number, number, number]][], v: number): string {
  if (v <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  for (let k = 1; k < stops.length; k++) {
    const [b, cb] = stops[k];
    if (v <= b) {
      const [a, ca] = stops[k - 1];
      const f = (v - a) / (b - a || 1);
      return `rgb(${ca.map((x, j) => Math.round(x + (cb[j] - x) * f)).join(',')})`;
    }
  }
  return `rgb(${stops[stops.length - 1][1].join(',')})`;
}

/** 累積模式畫到 year 為止的最後一點；只看那一年時是那一年的點（沒有就不標） */
export function headIndex(times: number[], year: number, cumulative: boolean): number {
  let found = -1;
  for (let k = 0; k < times.length; k++) {
    if (cumulative ? times[k] <= year : times[k] === year) found = k;
  }
  return found;
}

class Trails {
  private canvas: HTMLCanvasElement;
  private trails = new Map<string, TrailState>();
  private drawn: Drawn[] = [];

  constructor(private map: MaplibreMap) {
    const canvas = document.createElement('canvas');
    canvas.className = OVERLAY_CANVAS_CLASS;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    map.getCanvasContainer().appendChild(canvas);
    this.canvas = canvas;
    map.on('render', this.draw);
  }

  set(layerId: string, state: TrailState | null) {
    if (state) this.trails.set(layerId, state);
    else this.trails.delete(layerId);
    this.map.triggerRepaint();
  }

  ids(): string[] {
    return [...this.trails.keys()];
  }

  hit(x: number, y: number, radius = 8): Drawn | null {
    let best: Drawn | null = null;
    let bestD = radius;
    // 後畫的（上面的、比較新的）優先
    for (let k = this.drawn.length - 1; k >= 0; k--) {
      const d = this.drawn[k];
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    return best;
  }

  private draw = () => {
    const map = this.map;
    const source = map.getCanvas();
    const ratio = map.getPixelRatio();
    const w = source.clientWidth;
    const h = source.clientHeight;
    const canvas = this.canvas;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawn = [];
    for (const t of this.trails.values()) if (t.visible) this.drawTrail(ctx, t, t.dark);
  };

  private drawTrail(ctx: CanvasRenderingContext2D, t: TrailState, dark: boolean) {
    const map = this.map;
    // 地球儀背面：MapLibre 的 Marker 也是這樣判斷（_camera.transform 不在公開的型別裡，拿不到時當成都看得到）
    const transform = (map as unknown as { _camera?: { transform?: { isLocationOccluded?: (ll: LngLat) => boolean } } })._camera?.transform;
    const times = t.order.map((i) => Number(t.points[i][t.timeField]));
    if (times.length === 0) return;
    const cumulative = t.mode === 'cumulative';
    const head = headIndex(times, t.year, cumulative);
    const last = cumulative ? head : times.length - 1;
    const stops = gradientStops(t.colors, times[0], times[times.length - 1]);
    const screen: ({ x: number; y: number } | null)[] = t.order.map((i, k) => {
      if (k > last) return null;
      const p = t.points[i];
      const ll = new LngLat(t.lons[k], p.lat as number);
      if (transform?.isLocationOccluded?.(ll)) return null;
      const s = map.project(ll);
      return { x: s.x, y: s.y };
    });
    // 線：先畫一條較寬的白色外框（深色底圖上近年的深棕色才看得到），再一段一段依年份上色
    const faint = !cumulative;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = faint ? 0.45 : 1;
    ctx.strokeStyle = dark ? 'rgba(240,239,236,0.7)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    let open = false;
    for (let k = 0; k <= last; k++) {
      const s = screen[k];
      if (!s) {
        open = false;
        continue;
      }
      if (open) ctx.lineTo(s.x, s.y);
      else ctx.moveTo(s.x, s.y);
      open = true;
    }
    ctx.stroke();
    ctx.lineWidth = 2.5;
    for (let k = 1; k <= last; k++) {
      const a = screen[k - 1];
      const b = screen[k];
      if (!a || !b) continue;
      ctx.strokeStyle = colorAt(stops, times[k]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let k = 0; k <= last; k++) {
      const s = screen[k];
      if (s) this.drawn.push({ layerId: t.layerId, index: t.order[k], x: s.x, y: s.y });
    }
    // 那一年的點：大一點的圓，白框，旁邊寫年份
    const s = head >= 0 ? screen[head] : null;
    if (!s) return;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6.5, 0, 2 * Math.PI);
    ctx.fillStyle = colorAt(stops, times[head]);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const label = t.head(t.points[t.order[head]]);
    if (!label) return;
    ctx.font = `600 12px ${getComputedStyle(map.getContainer()).fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? 'rgba(11,11,11,0.9)' : 'rgba(255,255,255,0.92)';
    ctx.fillStyle = dark ? '#f0efec' : '#0b0b0b';
    ctx.strokeText(label, s.x + 10, s.y);
    ctx.fillText(label, s.x + 10, s.y);
  }

  destroy() {
    this.map.off('render', this.draw);
    this.canvas.remove();
  }
}

const registry = new WeakMap<MaplibreMap, Trails>();

export interface TrailInput {
  layerId: string;
  points: PointRecord[] | null;
  timeField: string;
  colors: ColorClasses;
  visible: boolean;
  head: (p: PointRecord) => string;
  dark: boolean;
}

/** 讓地圖上的軌跡跟 wanted 一致（syncOverlays 呼叫）；同一份點不重排 */
export function syncTrails(map: MaplibreMap, wanted: TrailInput[]): void {
  let trails = registry.get(map);
  if (!trails && wanted.length === 0) return;
  if (!trails) registry.set(map, (trails = new Trails(map)));
  const keep = new Set(wanted.map((w) => w.layerId));
  for (const id of trails.ids()) if (!keep.has(id)) trails.set(id, null);
  for (const w of wanted) {
    const prev = prevState.get(map)?.get(w.layerId);
    if (!w.points) {
      trails.set(w.layerId, null);
      continue;
    }
    let order = prev?.points === w.points ? prev.order : null;
    let lons = prev?.points === w.points ? prev.lons : null;
    if (!order || !lons) {
      order = w.points
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => typeof p.lon === 'number' && typeof p.lat === 'number' && typeof p[w.timeField] === 'number')
        .sort((a, b) => Number(a.p[w.timeField]) - Number(b.p[w.timeField]))
        .map(({ i }) => i);
      lons = unwrapLongitudes(order.map((i) => [w.points![i].lon as number, w.points![i].lat as number])).map(([lon]) => lon);
    }
    const state: TrailState = {
      layerId: w.layerId,
      points: w.points,
      order,
      lons,
      timeField: w.timeField,
      colors: w.colors,
      year: prev?.year ?? 0,
      mode: prev?.mode,
      visible: w.visible,
      head: w.head,
      dark: w.dark,
    };
    remember(map, state);
    trails.set(w.layerId, state);
  }
}

const prevState = new WeakMap<MaplibreMap, Map<string, TrailState>>();
function remember(map: MaplibreMap, state: TrailState) {
  let m = prevState.get(map);
  if (!m) prevState.set(map, (m = new Map()));
  m.set(state.layerId, state);
}

/** 換年份、換指標（時間模式）：applyTimeFilters 呼叫 */
export function setTrailYear(map: MaplibreMap, layerId: string, year: number, mode: IndicatorDef['overlayTime']): void {
  const state = prevState.get(map)?.get(layerId);
  const trails = registry.get(map);
  if (!state || !trails || (state.year === year && state.mode === mode)) return;
  state.year = year;
  state.mode = mode;
  trails.set(layerId, state);
}

/** 游標底下（8 px 內）的軌跡點：做成跟點圖層一樣的 feature（layer.id、properties.i、geometry） */
export function trailAt(map: MaplibreMap, point: { x: number; y: number }): MapGeoJSONFeature | null {
  const hit = registry.get(map)?.hit(point.x, point.y);
  if (!hit) return null;
  const state = prevState.get(map)?.get(hit.layerId);
  const p = state?.points[hit.index];
  if (!p) return null;
  return {
    type: 'Feature',
    layer: { id: hit.layerId },
    properties: { i: hit.index },
    geometry: { type: 'Point', coordinates: [p.lon as number, p.lat as number] },
  } as unknown as MapGeoJSONFeature;
}
