/**
 * 地圖上的觀察點（2026-11-01，MapLibre 範例「Create a draggable Marker」；TopicDefinition.pin）：
 * - 一個標記（藍色圓點、白框）旁邊一張小卡寫 label（例如「台灣 · 25.0°N 121.6°E」或那一點的日出日落）。
 * - pair 'antipode'：多一個對蹠點的標記（橘色），拖任何一個，另一個跟著到它的對蹠點。
 * - 可以拖的（draggable）也可以用鍵盤：Tab 移到標記，方向鍵移 1°（Shift 10°）；放開或按完方向鍵才回報位置（onMove）。
 * - 標記是 MapLibre 的 Marker（HTML），跟著地圖移動；地球儀背面的不畫。
 */
import { Marker, type Map as MaplibreMap } from 'maplibre-gl';

export interface PinConfig {
  /** 主要那一點（經度、緯度） */
  at: [number, number];
  pair: boolean;
  draggable: boolean;
  /** 這一點的說明（幾行字） */
  label: (lngLat: [number, number]) => string[];
  /** 拖完、方向鍵移完：主要那一點的新位置 */
  onMove?: (at: [number, number]) => void;
  /** 無障礙標籤：主要那一點、對蹠點 */
  names: [string, string];
  /** pair 時每個標記多寫一行另一個在哪（地球背面的那個看不到）：「另一邊：阿根廷」 */
  otherSide?: (name: string) => string;
}

/** 對蹠點 */
export function antipodeOf([lon, lat]: [number, number]): [number, number] {
  return [lon > 0 ? lon - 180 : lon + 180, -lat];
}

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

function pinElement(kind: 'main' | 'pair', name: string, draggable: boolean): { root: HTMLElement; text: HTMLElement } {
  const root = document.createElement('div');
  root.className = `map-pin is-${kind}`;
  root.setAttribute('role', draggable ? 'slider' : 'img');
  root.setAttribute('aria-label', name);
  if (draggable) root.tabIndex = 0;
  const dot = document.createElement('span');
  dot.className = 'map-pin-dot';
  const text = document.createElement('span');
  text.className = 'map-pin-label';
  root.append(dot, text);
  return { root, text };
}

export class Pins {
  private main: Marker | null = null;
  private pair: Marker | null = null;
  private mainText: HTMLElement | null = null;
  private pairText: HTMLElement | null = null;
  private cfg: PinConfig | null = null;

  constructor(private map: MaplibreMap) {}

  /** 依設定加上、移動或拿掉標記；同一組設定只更新位置與文字 */
  set(cfg: PinConfig | null) {
    const shapeChanged = !cfg || !this.cfg || cfg.pair !== this.cfg.pair || cfg.draggable !== this.cfg.draggable;
    if (shapeChanged) this.remove();
    this.cfg = cfg;
    if (!cfg) return;
    if (!this.main) this.create(cfg);
    this.place(cfg.at);
  }

  private create(cfg: PinConfig) {
    const main = pinElement('main', cfg.names[0], cfg.draggable);
    this.mainText = main.text;
    this.main = new Marker({ element: main.root, draggable: cfg.draggable, anchor: 'center', opacityWhenCovered: '0' }).setLngLat(cfg.at).addTo(this.map);
    if (cfg.pair) {
      const pair = pinElement('pair', cfg.names[1], cfg.draggable);
      this.pairText = pair.text;
      this.pair = new Marker({ element: pair.root, draggable: cfg.draggable, anchor: 'center', opacityWhenCovered: '0' })
        .setLngLat(antipodeOf(cfg.at))
        .addTo(this.map);
    }
    if (!cfg.draggable) return;
    // 拖的時候另一個跟著動、字跟著換；放開時回報主要那一點的位置
    const fromMain = () => this.main!.getLngLat().toArray() as [number, number];
    const fromPair = () => antipodeOf(this.pair!.getLngLat().toArray() as [number, number]);
    this.main.on('drag', () => this.place(fromMain(), 'main'));
    this.main.on('dragend', () => this.cfg?.onMove?.(normalize(fromMain())));
    this.pair?.on('drag', () => this.place(fromPair(), 'pair'));
    this.pair?.on('dragend', () => this.cfg?.onMove?.(normalize(fromPair())));
    // 方向鍵：1°（Shift 10°），經度依緯度放大一點，靠近極點時也走得動
    const keys = (which: 'main' | 'pair') => (e: KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      const move = d[e.key];
      if (!move) return;
      e.preventDefault();
      e.stopPropagation();
      const marker = which === 'main' ? this.main! : this.pair!;
      const [lon, lat] = marker.getLngLat().toArray() as [number, number];
      const next: [number, number] = [wrapLon(lon + move[0]), Math.max(-85, Math.min(85, lat + move[1]))];
      const at = which === 'main' ? next : antipodeOf(next);
      this.place(at);
      this.cfg?.onMove?.(normalize(at));
    };
    main.root.addEventListener('keydown', keys('main'));
    this.pair?.getElement().addEventListener('keydown', keys('pair'));
  }

  private retry = 0;
  private retries = 0;

  /** 主要那一點放到 at（skip：正在拖的那一個不必再設位置） */
  private place(at: [number, number], skip?: 'main' | 'pair') {
    const cfg = this.cfg;
    if (!cfg || !this.main) return;
    if (skip !== 'main') this.main.setLngLat(at);
    const lines = cfg.label(normalize(at));
    const other = this.pair ? cfg.label(antipodeOf(normalize(at))) : [];
    const otherLine = (l: string[]) => (cfg.otherSide && l[0] ? [cfg.otherSide(l[0])] : []);
    this.mainText!.textContent = [...lines, ...otherLine(other)].join('\n');
    // 說明要用的資料還沒下載（晝夜的首都檔、海的名稱，第一次用到才下載）：過一下再寫一次，最多 10 次
    clearTimeout(this.retry);
    if (lines.length === 0 && this.retries < 10) {
      this.retries++;
      this.retry = window.setTimeout(() => this.place(this.main!.getLngLat().toArray() as [number, number]), 600);
    } else if (lines.length) this.retries = 0;
    if (this.pair) {
      if (skip !== 'pair') this.pair.setLngLat(antipodeOf(normalize(at)));
      this.pairText!.textContent = [...other, ...otherLine(lines)].join('\n');
    }
  }

  remove() {
    clearTimeout(this.retry);
    this.main?.remove();
    this.pair?.remove();
    this.main = this.pair = null;
    this.mainText = this.pairText = null;
  }
}

function normalize([lon, lat]: [number, number]): [number, number] {
  return [wrapLon(lon), Math.max(-90, Math.min(90, lat))];
}
