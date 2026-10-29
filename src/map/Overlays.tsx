import { useState } from 'react';
import { tr, useLang, useT, type Text } from '../i18n';
import type { LinesData, LinesOverlay, LiveGridOverlay, NightOverlay, PointRecord, PointsData, PointsOverlay, RailwaysData } from '../topics/types';
import { NIGHT_LOOK, nightAlphas, SUN_COLOR } from './nightLook';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';

export interface LayerVisibility {
  railways: boolean;
  largeAirports: boolean;
  mediumAirports: boolean;
  /** 地形陰影（有地形圖層的主題才有） */
  hillshade: boolean;
  /** 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的），key 是 overlay 的 id；沒有記錄的看 overlay 的 hidden */
  extra: Record<string, boolean>;
}

// 中型機場有兩千多座，世界全圖時會蓋住鐵路，預設關閉
export const DEFAULT_LAYERS: LayerVisibility = {
  railways: true,
  largeAirports: true,
  mediumAirports: false,
  hillshade: true,
  extra: {},
};

/** 把差分編碼的鐵路還原成經緯度 MultiLineString */
export function decodeRailways(data: RailwaysData): GeoJSON.MultiLineString {
  return { type: 'MultiLineString', coordinates: decodeLines(data).lines };
}

/**
 * 一般線圖層還原後的資料：經緯度的線，types 是每條線的分類代碼，records 是每條線的紀錄（tooltip、時間篩選用），
 * vertexTypes 是每條線每個頂點的代碼（颱風每個時間點的強度）
 */
export interface DecodedLines {
  lines: [number, number][][];
  types: number[] | null;
  records: PointRecord[] | null;
  vertexTypes: number[][] | null;
  /** concatLines() 接起來的原本那幾份（主檔、分區）：地圖上主檔與分區畫在不同的 source，換分區時主檔不必重送 */
  parts?: DecodedLines[];
}

/** 每條線第一個點是量化後的絕對座標，之後是差分；乘上 quantum 得到經緯度（鐵路與一般線圖層同一種格式） */
export function decodeLines(data: LinesData | RailwaysData): DecodedLines {
  const q = data.quantum;
  const lines = data.lines.map((flat) => {
    const line: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      line.push([x * q, y * q]);
    }
    return line;
  });
  let records = 'records' in data && data.records ? decodePoints(data.records) : null;
  // 共用的資料（同一個河流系統的名稱、流入的海…）併進每條線的紀錄
  if (records && 'groups' in data && data.groups) {
    const { field, records: shared } = data.groups;
    const groups = new Map(decodePoints(shared).map((g) => [g[field], g]));
    records = records.map((r) => {
      const g = groups.get(r[field]);
      return g ? { ...g, ...r } : r;
    });
  }
  return {
    lines,
    types: 'types' in data && data.types ? data.types : null,
    records,
    // 一個字元一個頂點，36 進位（pipeline 的 VERTEX_CODES）
    vertexTypes:
      'vertexTypes' in data && data.vertexTypes ? data.vertexTypes.map((s) => Array.from(s, (c) => parseInt(c, 36))) : null,
  };
}

/** 好幾份還原後的線接成一份（線圖層的主檔加上放大後下載的分區）；紀錄、分類沒有的那份補 null */
export function concatLines(parts: DecodedLines[]): DecodedLines {
  if (parts.length === 1) return parts[0];
  const all = <T,>(pick: (p: DecodedLines) => T[] | null, fill: T) =>
    parts.some((p) => pick(p)) ? parts.flatMap((p) => pick(p) ?? p.lines.map(() => fill)) : null;
  return {
    lines: parts.flatMap((p) => p.lines),
    types: all((p) => p.types, 0),
    records: all<PointRecord>((p) => p.records, {}),
    vertexTypes: all<number[]>((p) => p.vertexTypes, []),
    parts,
  };
}

/** 一般點圖層的資料檔（pipeline 的 common.points_file()）還原成一個點一筆的紀錄 */
export function decodePoints(data: PointsData): PointRecord[] {
  const n = data.columns[0]?.length ?? 0;
  const records: PointRecord[] = Array.from({ length: n }, () => ({}));
  const table = data.strings?.table;
  const stringFields = new Set(data.strings?.fields ?? []);
  data.fields.forEach((field, f) => {
    const column = data.columns[f];
    const scale = data.scale[field];
    const delta = data.delta.includes(field);
    // 字串表的欄位：存的是索引，0 是沒有值
    if (table && stringFields.has(field)) {
      for (let i = 0; i < n; i++) {
        const v = column[i];
        records[i][field] = typeof v === 'number' && v > 0 ? (table[v] ?? null) : null;
      }
      return;
    }
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const v = column[i];
      if (v === null || scale === undefined || typeof v === 'string') {
        records[i][field] = v;
        continue;
      }
      acc = delta ? acc + v : v;
      // 乘上量化單位後再依它的小數位數四捨五入，0.1 × 3 才不會變成 0.30000000000000004
      records[i][field] = roundTo(acc * scale, scale);
    }
  });
  return records;
}

function roundTo(value: number, scale: number): number {
  if (scale >= 1) return value;
  const digits = Math.ceil(-Math.log10(scale) - 1e-9);
  return Number(value.toFixed(digits));
}

/** 一般疊加圖層目前的狀態：解析過的設定、有沒有打開、資料（還沒下載或關著沒下載時是 null） */
export type OverlayLayer =
  | { kind: 'points'; def: PointsOverlay; visible: boolean; points: PointRecord[] | null }
  | { kind: 'lines'; def: LinesOverlay; visible: boolean; lines: DecodedLines | null }
  /** 晝夜（時刻主題）：沒有資料檔，依時刻畫（nightLayer.ts） */
  | { kind: 'night'; def: NightOverlay; visible: boolean }
  /** 即時網格（此刻的極光）：值由主題的即時資料算（liveGridLayer.ts）；還沒讀到是 null */
  | { kind: 'liveGrid'; def: LiveGridOverlay; visible: boolean; values: Float32Array | null };

export function overlayVisible(layers: LayerVisibility, def: { id: string; hidden?: boolean }): boolean {
  return layers.extra[def.id] ?? !def.hidden;
}

/** 點圖層的半徑（px，縮放 2 時）：固定值，或依欄位在 stops 之間線性內插 */
export function pointRadius(def: PointsOverlay, value: number | null): number {
  return interpolateStops(def.radius, value);
}

/** 固定值，或依欄位在 stops [[值, 大小], …] 之間線性內插（點的半徑、線寬） */
export function interpolateStops(size: number | { stops: [number, number][] }, value: number | null): number {
  if (typeof size === 'number') return size;
  const stops = size.stops;
  if (value === null) return stops[0][1];
  if (value <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, r1] = stops[i];
    if (value <= x1) {
      const [x0, r0] = stops[i - 1];
      return r0 + ((value - x0) / (x1 - x0)) * (r1 - r0);
    }
  }
  return stops[stops.length - 1][1];
}

/** 圖例上的一個符號 */
export interface OverlaySwatch {
  /**
   * band：半透明的帶子加上兩側的邊與中間的線（有 fill 的線圖層，例如日食的路徑）；
   * fill：一塊半透明的色塊（晝夜的夜色，opacity 是它的不透明度；0 是只有外框的白天）
   */
  shape: 'line' | 'dash' | 'dot' | 'triangle' | 'shade' | 'band' | 'fill';
  /** 線寬或半徑（px） */
  size: number;
  color: string;
  opacity?: number;
  /** fill 的色塊底下墊的顏色（像地圖的陸地：淺色底圖米白、深色底圖深藍灰） */
  base?: string;
}

/** 晝夜圖層的圖例：白天、三種曙暮光、夜晚的色塊（太陽在地平線下幾度），加上太陽直射點 */
const NIGHT_ROWS: { label: Text }[] = [
  { label: { zh: '白天', en: 'Day' } },
  { label: { zh: '民用曙暮光（太陽在地平線下 0.8°–6°）', en: 'Civil twilight (sun 0.8°–6° below the horizon)' } },
  { label: { zh: '航海曙暮光（6°–12°）', en: 'Nautical twilight (6°–12°)' } },
  { label: { zh: '天文曙暮光（12°–18°）', en: 'Astronomical twilight (12°–18°)' } },
  { label: { zh: '夜晚（18° 以下）', en: 'Night (more than 18°)' } },
];
const NIGHT_TITLE: Text = { zh: '晝夜與晨昏', en: 'Day, twilight and night' };
/** 夜色色塊（與面的分類）底下墊的顏色：彩色地形的陸地、深藍底圖的陸地 */
const NIGHT_BASE = { light: '#ece6d6', dark: '#33435a' };
/** 疊在海上的面的色塊底下墊的顏色：彩色地形、深藍底圖的海 */
const SEA_BASE = { light: '#9ebdff', dark: '#38435c' };

/** 一般疊加圖層的圖例：開關那一列的符號，加上打開時下面的分級說明（顏色分級、大小） */
export interface OverlayKey {
  swatch: OverlaySwatch;
  label: string;
  details: { title?: string; layout: 'rows' | 'sizes'; rows: (OverlaySwatch & { label: string })[] }[];
}

/** 線、點的外框與中性色：大小圖例不代表顏色，用中性的深灰 */
const SIZE_KEY_COLOR = MAP_TOKENS.inkMuted;

/**
 * 一般疊加圖層的圖例。tokens 是介面的配色：圖例卡片跟著深淺色切換，中性的深灰線（板塊邊界）
 * 在深色卡片上看不到，換成介面的文字色（跟鐵路一樣）。
 */
export function overlayKey(o: OverlayLayer, tokens?: Tokens, darkMap = false): OverlayKey {
  if (o.kind === 'liveGrid') {
    // 一個顏色、依數值調不透明度：每一格是那個值的不透明度，墊在像地圖陸地的底色上
    const color = darkMap ? o.def.color.dark : o.def.color.light;
    const base = darkMap ? NIGHT_BASE.dark : NIGHT_BASE.light;
    const alpha = (v: number) => interpolateStops({ stops: o.def.opacity }, v);
    const rows = o.def.legend.rows.map((r) => ({ shape: 'fill' as const, size: 5, color, opacity: alpha(r.value), base, label: r.label }));
    return {
      swatch: { shape: 'fill', size: 5, color, opacity: alpha(o.def.opacity[o.def.opacity.length - 1][0]), base },
      label: o.def.label,
      details: [{ title: o.def.legend.title, layout: 'rows', rows }],
    };
  }
  if (o.kind === 'night') {
    const color = (darkMap ? NIGHT_LOOK.dark : NIGHT_LOOK.light).color;
    const alphas = [0, ...nightAlphas(darkMap)];
    const base = darkMap ? NIGHT_BASE.dark : NIGHT_BASE.light;
    return {
      swatch: { shape: 'fill', size: 5, color, opacity: alphas[4], base },
      label: o.def.label,
      details: [
        {
          title: tr(NIGHT_TITLE),
          layout: 'rows',
          rows: [
            ...NIGHT_ROWS.map((r, i) => ({ shape: 'fill' as const, size: 5, color, opacity: alphas[i], base, label: tr(r.label) })),
            { shape: 'dot' as const, size: 4.5, color: SUN_COLOR, label: o.def.sunLabel },
          ],
        },
      ],
    };
  }
  if (o.kind === 'lines') {
    const { def } = o;
    // onlyTypes：圖例也只列畫出來的那幾類
    const classes =
      typeof def.color === 'string' ? null : def.color.classes.filter((c) => !def.onlyTypes || def.onlyTypes.includes(c.value));
    const neutral: Record<string, string> = tokens
      ? { [MAP_TOKENS.ink]: tokens.ink, [MAP_TOKENS.inkSecondary]: tokens.inkSecondary, [MAP_TOKENS.inkMuted]: tokens.inkMuted }
      : {};
    // 依欄位變粗的線，開關與顏色分級的符號用中間那一級的線寬
    const typical = typeof def.width === 'number' ? def.width : def.width.stops[Math.floor(def.width.stops.length / 2)][1];
    // 有 fill、每個環都畫外框的圖層畫成帶子（日食的路徑）；fill 只給部分分類外框時（地球的另一邊），線的分類是普通的線
    const banded = Boolean(def.fill) && def.fill?.outline === undefined;
    const lineSwatch = (color: string, dash?: boolean): OverlaySwatch => ({
      shape: banded ? 'band' : dash ? 'dash' : 'line',
      size: Math.max(1.5, typical),
      color: neutral[color] ?? color,
    });
    // 深色底圖上有另一個顏色的分類（河流的紫 → 淡紫），圖例跟地圖畫的一樣
    const classColor = (c: { color: string; dark?: string }) => (darkMap && c.dark ? c.dark : c.color);
    // 面的分類（地球的另一邊翻過去的陸地）：半透明的色塊，墊在像地圖陸地的底色上，不透明度跟地圖一樣
    const areaSwatch = (c: { value: number; color: string; dark?: string; area?: 'land' | 'sea' }): OverlaySwatch => {
      const [light, dark] = def.fill?.typeOpacity?.[c.value] ?? [def.fill?.opacity ?? 0.3, def.fill?.darkOpacity ?? def.fill?.opacity ?? 0.3];
      const base = c.area === 'sea' ? SEA_BASE : NIGHT_BASE;
      // 中性的深灰在深色底圖上換成淺色（跟地圖上的 ON_DARK 一樣）；色塊墊著地圖的底色，不跟著介面換
      const color = darkMap && !c.dark && c.color === MAP_TOKENS.ink ? '#f0efec' : classColor(c);
      return { shape: 'fill', size: 5, color, opacity: darkMap ? dark : light, base: darkMap ? base.dark : base.light };
    };
    const swatchOf = (c: (NonNullable<typeof classes>)[number]) => (c.area ? areaSwatch(c) : lineSwatch(classColor(c), c.dash));
    const details: OverlayKey['details'] = [];
    if (classes && typeof def.color !== 'string') {
      details.push({
        title: def.color.title,
        layout: 'rows',
        rows: classes.map((c) => ({ ...swatchOf(c), label: c.label })),
      });
    }
    if (def.sizeLegend) {
      const { title, values, format } = def.sizeLegend;
      const ink = tokens?.inkSecondary ?? SIZE_KEY_COLOR;
      details.push({
        title,
        layout: 'rows',
        rows: values.map((v) => ({ shape: 'line', size: interpolateStops(def.width, v), color: ink, label: format(v) })),
      });
    }
    return {
      swatch: classes ? (classes[0].area ? areaSwatch(classes[0]) : lineSwatch(classColor(classes[0]))) : lineSwatch(def.color as string),
      label: def.label,
      details,
    };
  }
  const { def } = o;
  const shape = def.shape === 'triangle' ? 'triangle' : 'dot';
  const classes = typeof def.color === 'string' ? null : def.color;
  const details: OverlayKey['details'] = [];
  if (classes) {
    details.push({
      title: classes.title,
      layout: 'rows',
      rows: classes.classes.map((c) => ({ shape, size: 4, color: c.color, label: c.label })),
    });
  }
  if (def.sizeLegend) {
    const { title, values, format } = def.sizeLegend;
    details.push({
      title,
      layout: 'sizes',
      rows: values.map((v) => ({ shape, size: pointRadius(def, v), color: SIZE_KEY_COLOR, label: format(v) })),
    });
  }
  return {
    swatch: {
      shape,
      size: Math.min(5, typeof def.radius === 'number' ? def.radius : 4),
      color: classes ? classes.classes[0].color : (def.color as string),
    },
    label: def.label,
    details,
  };
}

/** 圖層的圖例：畫面上的開關與匯出的圖片共用 */
export interface LayerKey {
  key: Exclude<keyof LayerVisibility, 'extra'>;
  source: 'railways' | 'airports' | 'terrain';
  label: Text;
  /** 線（鐵路）、圓點（機場）或陰影色塊（地形陰影），size 是線寬或半徑（px） */
  shape: 'line' | 'dot' | 'shade';
  size: number;
}

export const LAYER_KEYS: LayerKey[] = [
  { key: 'railways', source: 'railways', label: { zh: '鐵路', en: 'Railways' }, shape: 'line', size: 1.2 },
  {
    key: 'largeAirports',
    source: 'airports',
    label: { zh: '大型機場', en: 'Large airports' },
    shape: 'dot',
    size: 4,
  },
  {
    key: 'mediumAirports',
    source: 'airports',
    label: { zh: '中型機場（有定期航班）', en: 'Medium airports (scheduled flights)' },
    shape: 'dot',
    size: 2.5,
  },
  { key: 'hillshade', source: 'terrain', label: { zh: '地形陰影', en: 'Hillshade' }, shape: 'shade', size: 5 },
];

/** 陰影色塊：左上亮、右下暗（光源在西北方，跟地圖上的地形陰影一樣） */
export const SHADE_KEY: [string, string] = ['#f4f1ea', '#6b6355'];

/** 線用介面的文字色（圖例卡片跟著深淺色切換），機場點跟地圖上一樣用地圖色 */
export function layerKeyColor(k: LayerKey, tokens: Tokens): string {
  return k.shape === 'line' ? tokens.ink : MAP_TOKENS.hues.orange;
}

/**
 * 開著的一般疊加圖層的圖例；同一組分級說明（例如規模 5–6 與 6 以上共用的震源深度）只列在第一個圖層下面。
 * 畫面上的圖層開關與匯出的圖片共用。
 */
export function overlayKeys(overlays: OverlayLayer[], tokens?: Tokens, darkMap = false): Map<OverlayLayer, OverlayKey> {
  const seen = new Set<string>();
  const out = new Map<OverlayLayer, OverlayKey>();
  for (const o of overlays) {
    const key = overlayKey(o, tokens, darkMap);
    if (o.visible) {
      key.details = key.details.filter((d) => {
        const signature = JSON.stringify(d);
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    }
    out.set(o, key);
  }
  return out;
}

/** 匯出圖片的圖層圖例：鐵路、機場等固定的圖層，加上打開的一般疊加圖層（含分級說明） */
export function exportLayerKeys(
  fixed: { key: LayerKey; color: string }[],
  overlays: OverlayLayer[],
  tokens: Tokens,
  darkMap = false,
): { label: string; swatch: OverlaySwatch; details: OverlayKey['details'] }[] {
  const visible = overlays.filter((o) => o.visible);
  const keys = overlayKeys(visible, tokens, darkMap);
  return [
    ...fixed.map(({ key, color }) => ({ label: tr(key.label), swatch: { shape: key.shape, size: key.size, color }, details: [] })),
    ...visible.map((o) => keys.get(o)!),
  ];
}

interface LayerControlsProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  hasRailways: boolean;
  hasAirports: boolean;
  hasTerrain?: boolean;
  /** 主題的一般疊加圖層（地震、火山、板塊邊界…） */
  overlays?: OverlayLayer[];
  tokens: Tokens;
  /** 底圖是深色的（分類有深色底圖用的顏色時，圖例跟地圖一樣） */
  darkMap?: boolean;
}

const SHOW_DETAILS: Text = { zh: '顯示圖例', en: 'Show key' };
const HIDE_DETAILS: Text = { zh: '收起圖例', en: 'Hide key' };
/** 手機上圖層開關下面的分級說明（震源深度、規模、邊界類型）預設收起，否則蓋住一半的地圖 */
const NARROW = '(max-width: 768px)';

/** 圖層開關，同時當作圖例 */
export function LayerControls({
  layers,
  onChange,
  hasRailways,
  hasAirports,
  hasTerrain = false,
  overlays = [],
  tokens,
  darkMap = false,
}: LayerControlsProps) {
  const t = useT();
  const lang = useLang();
  const toggle = (key: LayerKey['key']) => onChange({ ...layers, [key]: !layers[key] });
  const toggleOverlay = (o: OverlayLayer) => onChange({ ...layers, extra: { ...layers.extra, [o.def.id]: !o.visible } });
  const has = { railways: hasRailways, airports: hasAirports, terrain: hasTerrain };
  const keys = LAYER_KEYS.filter((k) => has[k.source]);
  const extraKeys = overlayKeys(overlays, tokens, darkMap);
  const [showDetails, setShowDetails] = useState(() => !(typeof matchMedia === 'function' && matchMedia(NARROW).matches));
  const hasDetails = overlays.some((o) => o.visible && extraKeys.get(o)!.details.length > 0);
  return (
    <fieldset className="legend map-layers">
      <legend className="legend-title">{t.layers}</legend>
      {keys.map((k) => (
        <label key={k.key}>
          <input type="checkbox" checked={layers[k.key]} onChange={() => toggle(k.key)} />
          <Swatch swatch={{ shape: k.shape, size: k.size, color: layerKeyColor(k, tokens) }} />
          {tr(k.label, lang)}
        </label>
      ))}
      {overlays.map((o) => {
        const key = extraKeys.get(o)!;
        return (
          <div key={o.def.id} className="map-layer">
            <label>
              <input type="checkbox" checked={o.visible} onChange={() => toggleOverlay(o)} />
              <Swatch swatch={key.swatch} />
              {key.label}
            </label>
            {o.visible &&
              showDetails &&
              key.details.map((d) => (
                <div key={d.title ?? d.rows[0]?.label} className={`map-layer-detail${d.layout === 'sizes' ? ' is-sizes' : ''}`}>
                  {d.title && <div className="legend-note">{d.title}</div>}
                  <div className="map-layer-rows">
                    {d.rows.map((r) => (
                      <span key={r.label}>
                        <Swatch swatch={r} />
                        {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
      {hasDetails && (
        <button type="button" className="map-layer-toggle" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
          {tr(showDetails ? HIDE_DETAILS : SHOW_DETAILS, lang)}
        </button>
      )}
    </fieldset>
  );
}

/** 圖例符號（SVG），大小圖例的圓點依半徑放大 */
function Swatch({ swatch }: { swatch: OverlaySwatch }) {
  const { shape, size, color } = swatch;
  if (shape === 'dot' || shape === 'triangle') {
    const r = size;
    const w = Math.max(18, 2 * r + 4);
    const h = Math.max(10, 2 * r + 2);
    return (
      <svg width={w} height={h} aria-hidden="true">
        {shape === 'dot' ? (
          <circle cx={w / 2} cy={h / 2} r={r} fill={color} stroke="#ffffff" strokeWidth={0.8} />
        ) : (
          <polygon points={trianglePoints(w / 2, h / 2, r)} fill={color} stroke="#ffffff" strokeWidth={0.8} />
        )}
      </svg>
    );
  }
  if (shape === 'band') {
    // 半透明的帶子、兩側的邊、中間的線（跟地圖上的路徑一樣）
    return (
      <svg width="18" height="10" aria-hidden="true">
        <rect x="1" y="1" width="16" height="8" fill={color} fillOpacity={0.3} />
        <line x1="1" y1="1" x2="17" y2="1" stroke={color} strokeWidth={1} />
        <line x1="1" y1="9" x2="17" y2="9" stroke={color} strokeWidth={1} />
        <line x1="1" y1="5" x2="17" y2="5" stroke={color} strokeWidth={Math.min(size, 2)} />
      </svg>
    );
  }
  if (shape === 'fill') {
    // 夜色的色塊：畫在跟地圖一樣的淺色（或深色）底上，透明度跟地圖一樣；白天只有外框
    return (
      <svg width="18" height="10" aria-hidden="true">
        <rect x="2" y="0.5" width="14" height="9" rx="2" fill={swatch.base ?? '#ece6d6'} stroke="var(--grid)" strokeWidth="1" />
        <rect x="2" y="0.5" width="14" height="9" rx="2" fill={color} fillOpacity={swatch.opacity ?? 1} />
      </svg>
    );
  }
  return (
    <svg width="18" height="10" aria-hidden="true">
      {shape === 'shade' ? (
        <>
          <defs>
            <linearGradient id="shade-key" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={SHADE_KEY[0]} />
              <stop offset="1" stopColor={SHADE_KEY[1]} />
            </linearGradient>
          </defs>
          <rect x="2" y="0" width="14" height="10" rx="2" fill="url(#shade-key)" />
        </>
      ) : (
        <line
          x1="1"
          y1="5"
          x2="17"
          y2="5"
          stroke={color}
          strokeWidth={size}
          strokeDasharray={shape === 'dash' ? '4 2.5' : undefined}
        />
      )}
    </svg>
  );
}

/** 正三角形（頂點朝上）的三個頂點，r 是外接圓半徑；地圖上的火山圖示與圖例共用同一個比例 */
export function trianglePoints(cx: number, cy: number, r: number): string {
  const h = r * 1.5;
  const half = r * Math.sqrt(3) * 0.5;
  return `${cx},${cy - r} ${cx + half},${cy - r + h} ${cx - half},${cy - r + h}`;
}
