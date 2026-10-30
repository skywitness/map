import { useState } from 'react';
import { tr, useLang, useT, type Text } from '../i18n';
import type { PointsOverlay } from '../topics/types';
import { MOON_COLOR, MOON_LOOK, NIGHT_LOOK, nightAlphas, SUN_COLOR } from './nightLook';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
import type { LayerVisibility, OverlayLayer } from './overlayData';

// 資料的部分在 overlayData.ts（首頁的程式與側欄只要它）；地圖這邊照舊從這裡 import
export {
  type LayerVisibility,
  DEFAULT_LAYERS,
  decodeRailways,
  type DecodedLines,
  decodeLines,
  concatLines,
  decodePoints,
  type OverlayLayer,
  overlayVisible,
} from './overlayData';

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
const MOON_TITLE: Text = { zh: '月亮在哪裡', en: 'Where the moon is' };
/** 夜色色塊（與面的分類）底下墊的顏色：彩色地形的陸地、深藍底圖的陸地 */
const NIGHT_BASE = { light: '#ece6d6', dark: '#33435a' };
/** 類別網格預設的不透明度（ClassGridOverlayDef.opacity） */
export const CLASS_GRID_OPACITY = 0.85;
/** 疊在海上的面的色塊底下墊的顏色：彩色地形、深藍底圖的海 */
const SEA_BASE = { light: '#9ebdff', dark: '#38435c' };

/** 一般疊加圖層的圖例：開關那一列的符號，加上打開時下面的分級說明（顏色分級、大小） */
export interface OverlayKey {
  swatch: OverlaySwatch;
  label: string;
  /** chips：一格一格的小色塊加短名稱（類別網格的 30 類），hint 是滑過時的全名 */
  details: { title?: string; layout: 'rows' | 'sizes' | 'chips'; rows: (OverlaySwatch & { label: string; hint?: string })[] }[];
}

/** 線、點的外框與中性色：大小圖例不代表顏色，用中性的深灰 */
const SIZE_KEY_COLOR = MAP_TOKENS.inkMuted;

/**
 * 一般疊加圖層的圖例。tokens 是介面的配色：圖例卡片跟著深淺色切換，中性的深灰線（板塊邊界）
 * 在深色卡片上看不到，換成介面的文字色（跟鐵路一樣）。
 */
export function overlayKey(o: OverlayLayer, tokens?: Tokens, darkMap = false): OverlayKey {
  if (o.kind === 'wind') {
    // 粒子是一個顏色的小點：符號是一串由淡到濃的點，說明寫在下面
    const color = darkMap ? o.def.color.dark : o.def.color.light;
    return {
      swatch: { shape: 'dot', size: 3, color },
      label: o.def.label,
      details: [{ layout: 'rows', rows: [{ shape: 'dot', size: 3, color, label: o.def.legend }] }],
    };
  }
  if (o.kind === 'classGrid') {
    // 依分組（A 熱帶…）一組一列小色塊，色塊墊在像地圖陸地的底色上、跟地圖一樣的不透明度
    const base = darkMap ? NIGHT_BASE.dark : NIGHT_BASE.light;
    const opacity = o.def.opacity ?? CLASS_GRID_OPACITY;
    const details: OverlayKey['details'] = o.def.groups.map((title, g) => ({
      title,
      layout: 'chips',
      rows: o.def.classes
        .filter((c) => c.group === g)
        .map((c) => ({ shape: 'fill' as const, size: 5, color: c.color, opacity, base, label: c.short, hint: `${c.short} ${c.label}` })),
    }));
    const first = o.def.classes[0];
    return { swatch: { shape: 'fill', size: 5, color: first?.color ?? '#888888', opacity, base }, label: o.def.label, details };
  }
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
  if (o.kind === 'moon') {
    const look = darkMap ? MOON_LOOK.dark : MOON_LOOK.light;
    const base = darkMap ? NIGHT_BASE.dark : NIGHT_BASE.light;
    return {
      swatch: { shape: 'fill', size: 5, color: look.color, opacity: look.ring, base },
      label: o.def.label,
      details: [
        {
          title: tr(MOON_TITLE),
          layout: 'rows',
          rows: [
            { shape: 'line' as const, size: 2, color: look.color, label: o.def.edgeLabel },
            { shape: 'fill' as const, size: 5, color: look.color, opacity: look.opacity, base, label: o.def.upLabel },
            { shape: 'dot' as const, size: 4.5, color: MOON_COLOR, label: o.def.pointLabel },
          ],
        },
      ],
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
    if (classes && typeof def.color !== 'string' && def.keyClasses !== false) {
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
                <div
                  key={d.title ?? d.rows[0]?.label}
                  className={`map-layer-detail${d.layout === 'sizes' ? ' is-sizes' : d.layout === 'chips' ? ' is-chips' : ''}`}
                >
                  {d.title && <div className="legend-note">{d.title}</div>}
                  <div className="map-layer-rows">
                    {d.rows.map((r) => (
                      <span key={r.label} title={r.hint}>
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
