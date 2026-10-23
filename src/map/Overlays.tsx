import { useState } from 'react';
import { tr, useLang, useT, type Text } from '../i18n';
import type { LinesData, LinesOverlay, PointRecord, PointsData, PointsOverlay, RailwaysData } from '../topics/types';
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

/** 一般線圖層還原後的資料：經緯度的線，types 是每條線的分類代碼，records 是每條線的紀錄（tooltip、時間篩選用） */
export interface DecodedLines {
  lines: [number, number][][];
  types: number[] | null;
  records: PointRecord[] | null;
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
  return {
    lines,
    types: 'types' in data && data.types ? data.types : null,
    records: 'records' in data && data.records ? decodePoints(data.records) : null,
  };
}

/** 一般點圖層的資料檔（pipeline 的 common.points_file()）還原成一個點一筆的紀錄 */
export function decodePoints(data: PointsData): PointRecord[] {
  const n = data.columns[0]?.length ?? 0;
  const records: PointRecord[] = Array.from({ length: n }, () => ({}));
  data.fields.forEach((field, f) => {
    const column = data.columns[f];
    const scale = data.scale[field];
    const delta = data.delta.includes(field);
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
  | { kind: 'lines'; def: LinesOverlay; visible: boolean; lines: DecodedLines | null };

export function overlayVisible(layers: LayerVisibility, def: { id: string; hidden?: boolean }): boolean {
  return layers.extra[def.id] ?? !def.hidden;
}

/** 點圖層的半徑（px，縮放 2 時）：固定值，或依欄位在 stops 之間線性內插 */
export function pointRadius(def: PointsOverlay, value: number | null): number {
  if (typeof def.radius === 'number') return def.radius;
  const stops = def.radius.stops;
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
  shape: 'line' | 'dash' | 'dot' | 'triangle' | 'shade';
  /** 線寬或半徑（px） */
  size: number;
  color: string;
}

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
export function overlayKey(o: OverlayLayer, tokens?: Tokens): OverlayKey {
  if (o.kind === 'lines') {
    const { def } = o;
    const classes = typeof def.color === 'string' ? null : def.color.classes;
    const neutral: Record<string, string> = tokens
      ? { [MAP_TOKENS.ink]: tokens.ink, [MAP_TOKENS.inkSecondary]: tokens.inkSecondary, [MAP_TOKENS.inkMuted]: tokens.inkMuted }
      : {};
    const lineSwatch = (color: string, dash?: boolean): OverlaySwatch => ({
      shape: dash ? 'dash' : 'line',
      size: Math.max(1.5, def.width),
      color: neutral[color] ?? color,
    });
    return {
      swatch: lineSwatch(classes ? classes[0].color : (def.color as string)),
      label: def.label,
      details:
        classes && typeof def.color !== 'string'
          ? [
              {
                title: def.color.title,
                layout: 'rows',
                rows: classes.map((c) => ({ ...lineSwatch(c.color, c.dash), label: c.label })),
              },
            ]
          : [],
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
export function overlayKeys(overlays: OverlayLayer[], tokens?: Tokens): Map<OverlayLayer, OverlayKey> {
  const seen = new Set<string>();
  const out = new Map<OverlayLayer, OverlayKey>();
  for (const o of overlays) {
    const key = overlayKey(o, tokens);
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
): { label: string; swatch: OverlaySwatch; details: OverlayKey['details'] }[] {
  const visible = overlays.filter((o) => o.visible);
  const keys = overlayKeys(visible, tokens);
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
}: LayerControlsProps) {
  const t = useT();
  const lang = useLang();
  const toggle = (key: LayerKey['key']) => onChange({ ...layers, [key]: !layers[key] });
  const toggleOverlay = (o: OverlayLayer) => onChange({ ...layers, extra: { ...layers.extra, [o.def.id]: !o.visible } });
  const has = { railways: hasRailways, airports: hasAirports, terrain: hasTerrain };
  const keys = LAYER_KEYS.filter((k) => has[k.source]);
  const extraKeys = overlayKeys(overlays, tokens);
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
