/**
 * 點圖層縮小時聚成甜甜圈（2026-11-01，MapLibre 範例「Display HTML clusters with custom properties」；點圖層的 `cluster`）：
 * - 另一個開了 cluster 的 GeoJSON source（`<點圖層>~cl`，overlayLayers.ts 的 syncOverlays 加上、applyTimeFilters 依
 *   時間軸送資料），`clusterProperties` 依點的分類（color 的 ColorClasses）加總個數或 weight 欄位（電廠的 MW）。
 * - 聚在一起的畫成 HTML 標記（這個檔）：甜甜圈的各片是各類的比例，中間寫總數，大小依 size(總數)；點一下放大到分開。
 *   標記跟著地圖移動（MapLibre 的 Marker），地球儀背面的會被藏起來。
 * - 沒有聚在一起的點畫在同一個 source 的點圖層（原本的點圖層的複本，`~cl`），maxZoom 以上換回原本的點圖層，
 *   tooltip、點選照舊。
 */
import { Marker, type GeoJSONSource, type Map as MaplibreMap, type MapGeoJSONFeature } from 'maplibre-gl';
import { pieSlices } from './pies';

export interface DonutSpec {
  /** 聚成甜甜圈的最大縮放級數（含）；再放大就畫一個個點 */
  maxZoom: number;
  colors: string[];
  labels: string[];
  /** 總數 → 甜甜圈的半徑（px） */
  size: (total: number) => number;
  /** 中間與 tooltip 寫的總數 */
  format: (total: number) => string;
  /** 「這一區：燃煤 52%、水力 20%…」的開頭（無障礙標籤與 title） */
  title: string;
}

/** 各類的加總放在聚合點的這幾個屬性（c0、c1…） */
export const clusterKey = (k: number) => `c${k}`;

const SVG = 'http://www.w3.org/2000/svg';

/** 甜甜圈的一片（外半徑 r、內半徑 r0，角度 0 是 12 點鐘、順時針） */
function arc(cx: number, r: number, r0: number, start: number, end: number): string {
  // 一整圈時 SVG 的弧畫不出來，分成兩半
  if (end - start >= 2 * Math.PI - 1e-6) return arc(cx, r, r0, start, start + Math.PI) + arc(cx, r, r0, start + Math.PI, end);
  const p = (rad: number, a: number) => `${cx + rad * Math.sin(a)} ${cx - rad * Math.cos(a)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M${p(r, start)}A${r} ${r} 0 ${large} 1 ${p(r, end)}L${p(r0, end)}A${r0} ${r0} 0 ${large} 0 ${p(r0, start)}Z`;
}

let measurer: CanvasRenderingContext2D | null | undefined;
/** 甜甜圈中間的字（.cluster-donut 的 600 10px）有多寬 */
function measure(text: string): number {
  if (measurer === undefined) {
    measurer = document.createElement('canvas').getContext('2d');
    if (measurer) measurer.font = `600 10px ${getComputedStyle(document.body).fontFamily}`;
  }
  return measurer ? measurer.measureText(text).width : text.length * 6.5;
}

function donutElement(spec: DonutSpec, parts: number[], total: number, onClick: () => void): HTMLElement {
  const r = spec.size(total);
  const size = Math.round(r * 2);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cluster-donut';
  button.style.width = button.style.height = `${size}px`;
  const shares = parts
    .map((v, k) => ({ v, k }))
    .filter((p) => p.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 4)
    .map((p) => `${spec.labels[p.k]} ${Math.round((p.v / total) * 100)}%`);
  const label = `${spec.title}${spec.format(total)}：${shares.join('、')}`;
  button.title = label;
  button.setAttribute('aria-label', label);
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  const c = size / 2;
  const outer = c - 0.5;
  const inner = Math.max(outer * 0.58, outer - 7);
  const hole = document.createElementNS(SVG, 'circle');
  hole.setAttribute('cx', String(c));
  hole.setAttribute('cy', String(c));
  hole.setAttribute('r', String(inner));
  hole.setAttribute('class', 'cluster-donut-hole');
  svg.appendChild(hole);
  for (const s of pieSlices(parts)) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', arc(c, outer, inner, s.start, s.end));
    path.setAttribute('fill', spec.colors[s.index] ?? '#999999');
    svg.appendChild(path);
  }
  button.appendChild(svg);
  // 中間的洞放得下才寫總數，放不下的只寫在 title
  const text = spec.format(total);
  const room = inner * 2 - 3;
  const width = measure(text);
  // 10px 放不下時試 9px
  if (width * 0.9 <= room) {
    const span = document.createElement('span');
    span.textContent = text;
    if (width > room) span.style.fontSize = '9px';
    button.appendChild(span);
  }
  // 點甜甜圈不要同時變成點地圖（選取底下的國家）：MapLibre 的點選是從地圖容器的 mousedown、mouseup 判斷的
  for (const type of ['mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'pointerdown', 'pointerup']) {
    button.addEventListener(type, (e) => e.stopPropagation());
  }
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return button;
}

class Donuts {
  private markers = new Map<number, Marker>();
  private shown = new Map<number, Marker>();
  private frame = 0;
  visible = false;

  constructor(
    private map: MaplibreMap,
    private source: string,
    public spec: DonutSpec,
  ) {
    map.on('move', this.schedule);
    map.on('moveend', this.update);
    map.on('sourcedata', this.onData);
  }

  private onData = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
    if (e.sourceId === this.source && e.isSourceLoaded) this.schedule();
  };

  private schedule = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.update);
  };

  /** 資料換了（換年份）：聚合點的編號會重用，舊的標記不能留 */
  reset() {
    for (const m of this.shown.values()) m.remove();
    this.shown.clear();
    this.markers.clear();
    this.schedule();
  }

  update = () => {
    const map = this.map;
    if (!this.visible || !map.getSource(this.source) || map.getZoom() >= this.spec.maxZoom + 1) {
      for (const m of this.shown.values()) m.remove();
      this.shown.clear();
      return;
    }
    const next = new Map<number, Marker>();
    const n = this.spec.colors.length;
    for (const f of map.querySourceFeatures(this.source) as MapGeoJSONFeature[]) {
      const p = f.properties;
      if (!p?.cluster || f.geometry.type !== 'Point') continue;
      const id = Number(p.cluster_id);
      if (next.has(id)) continue;
      let marker = this.markers.get(id);
      if (!marker) {
        const parts = Array.from({ length: n }, (_, k) => Number(p[clusterKey(k)] ?? 0));
        const total = parts.reduce((a, b) => a + b, 0);
        if (!(total > 0)) continue;
        const at = f.geometry.coordinates as [number, number];
        const zoomIn = () => {
          void (map.getSource(this.source) as GeoJSONSource).getClusterExpansionZoom(id).then((zoom) => {
            map.easeTo({ center: at, zoom: Math.min(zoom, this.spec.maxZoom + 1) + 0.01 });
          });
        };
        // 地球儀背面的標記 MapLibre 預設畫成 20% 不透明，背面的甜甜圈疊在正面的上面很亂，改成不畫
        marker = new Marker({ element: donutElement(this.spec, parts, total, zoomIn), opacityWhenCovered: '0' }).setLngLat(at);
        this.markers.set(id, marker);
      }
      next.set(id, marker);
      if (!this.shown.has(id)) marker.addTo(map);
    }
    for (const [id, m] of this.shown) if (!next.has(id)) m.remove();
    this.shown = next;
  };

  destroy() {
    cancelAnimationFrame(this.frame);
    this.map.off('move', this.schedule);
    this.map.off('moveend', this.update);
    this.map.off('sourcedata', this.onData);
    for (const m of this.shown.values()) m.remove();
    this.shown.clear();
    this.markers.clear();
  }
}

const registry = new WeakMap<MaplibreMap, Map<string, Donuts>>();

/**
 * 讓地圖上的甜甜圈跟 wanted 一致（source id → 規格與開關）：沒有的加上、不要的拿掉、規格換了（換語言、深淺色）重畫。
 * 換底圖後 source 是新的，標記照用（querySourceFeatures 讀新的 source）
 */
export function syncDonuts(map: MaplibreMap, wanted: Map<string, { spec: DonutSpec; visible: boolean }>): void {
  let all = registry.get(map);
  if (!all) registry.set(map, (all = new Map()));
  for (const [source, d] of all) {
    if (!wanted.has(source)) {
      d.destroy();
      all.delete(source);
    }
  }
  for (const [source, { spec, visible }] of wanted) {
    let d = all.get(source);
    if (d && d.spec !== spec) {
      d.destroy();
      d = undefined;
    }
    if (!d) all.set(source, (d = new Donuts(map, source, spec)));
    d.visible = visible;
    d.update();
  }
}

/** 甜甜圈的 source 換了資料（換年份）：清掉舊的標記 */
export function resetDonuts(map: MaplibreMap, source: string): void {
  registry.get(map)?.get(source)?.reset();
}
