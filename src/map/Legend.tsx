import { scaleLinear, type ScalePower, type ScaleThreshold } from 'd3-scale';
import { niceLegendValues } from '../lib/format';
import { tr, useLang, useT, type Text } from '../i18n';
import type { FlowDirection, Indicator } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
import { FLOW_MAX_WIDTH, flowColors, flowLegendValues, flowText, flowWidth } from './flows';

/** 面量圖圖例的色塊與刻度（畫面上的圖例與匯出的圖片共用） */
export interface ChoroplethLegendModel {
  colors: string[];
  labels: string[];
  swatchWidth: number;
}

export function choroplethLegendModel(indicator: Indicator, scale: ScaleThreshold<number, string>): ChoroplethLegendModel {
  const tick = indicator.formatTick ?? indicator.format;
  const labels = scale.domain().map(tick);
  // 刻度標在色塊交界，色塊要比最長的刻度文字寬，相鄰刻度才不會重疊
  const swatchWidth = Math.max(34, Math.max(...labels.map((l) => l.length)) * 6.5 + 8);
  return { colors: scale.range(), labels, swatchWidth };
}

interface ChoroplethLegendProps {
  indicator: Indicator;
  title: string;
  scale: ScaleThreshold<number, string>;
  /** 3D：色塊畫成階梯，表示每一級的高度 */
  stepped?: boolean;
}

/** 3D 圖例的說明（畫面上的圖例與匯出的圖片共用） */
export const STEPPED_NOTE: Text = {
  zh: '高度：每升一級色階加高一階（同一級內依數值）',
  en: 'Height: one step up per colour class (by value within a class)',
};
export const COLUMN_NOTE: Text = {
  zh: '高度：與數值成正比（柱子粗細固定）',
  en: 'Height: proportional to the value (columns have a fixed width)',
};
/** 3D 階梯色塊的最大高度（px）；第 i 級（從 0 起）是 (i+1)/N 倍 */
export const STEP_MAX_PX = 26;

export function ChoroplethLegend({ indicator, title, scale, stepped = false }: ChoroplethLegendProps) {
  const t = useT();
  const lang = useLang();
  const { colors, labels, swatchWidth } = choroplethLegendModel(indicator, scale);
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">{t.unitSuffix(indicator.unit)}</span>
      </div>
      {stepped && <div className="legend-note">{tr(STEPPED_NOTE, lang)}</div>}
      <div className={`legend-scale${stepped ? ' is-stepped' : ''}`} style={{ width: colors.length * swatchWidth }}>
        <div className="legend-swatches">
          {colors.map((c, i) => (
            <span
              key={c}
              style={{ background: c, height: stepped ? ((i + 1) / colors.length) * STEP_MAX_PX : undefined }}
            />
          ))}
        </div>
        <div className="legend-ticks">
          {labels.map((label, i) => (
            <span key={label} style={{ left: `${((i + 1) / colors.length) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <NoDataKey />
    </div>
  );
}

/** 類別圖圖例：只列出這一年有出現的類別，附上國家數（畫面上的圖例與匯出的圖片共用） */
export interface CategoricalLegendModel {
  items: { color: string; label: string; count: number }[];
}

export function categoricalLegendModel(indicator: Indicator, values: Map<string, number>): CategoricalLegendModel {
  if (indicator.layer.kind !== 'categorical') return { items: [] };
  const counts = new Map<number, number>();
  for (const v of values.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
  return {
    items: indicator.layer.categories
      .filter((c) => counts.has(c.value))
      .map((c) => ({ color: MAP_TOKENS.hues[c.hue], label: c.label, count: counts.get(c.value)! })),
  };
}

interface CategoricalLegendProps {
  indicator: Indicator;
  title: string;
  values: Map<string, number>;
}

export function CategoricalLegend({ indicator, title, values }: CategoricalLegendProps) {
  const t = useT();
  const { items } = categoricalLegendModel(indicator, values);
  return (
    <div className="legend">
      <div className="legend-title">{title}</div>
      <ul className="legend-categories">
        {items.map(({ color, label, count }) => (
          <li key={label}>
            <span className="legend-swatch" style={{ background: color }} />
            {label}
            <span className="legend-count">{t.countryCount(count)}</span>
          </li>
        ))}
      </ul>
      <NoDataKey />
    </div>
  );
}

const LABEL_GAP = 13;

/** 比例圓圖例的版面（px）：同心圓底部對齊，標籤在圓頂高度 */
export interface BubbleLegendModel {
  items: { label: string; r: number; labelY: number }[];
  maxR: number;
  baseline: number;
  labelX: number;
  width: number;
  height: number;
}

export function bubbleLegendModel(indicator: Indicator, radius: ScalePower<number, number>): BubbleLegendModel {
  const spec = indicator.layer.kind === 'bubble' ? indicator.layer.legendValues : [];
  const values = spec === 'auto' ? niceLegendValues(radius.domain()[1]) : spec;
  const tick = indicator.formatTick ?? indicator.format;
  const maxR = Math.max(...values.map(radius));
  const top = 7; // 最大圓的標籤在圓頂，留半行字高
  const baseline = top + maxR * 2;
  const labelX = maxR * 2 + 12;

  // 小圓的圓頂很接近時，標籤往下推開，避免文字重疊
  const items = [...values]
    .sort((a, b) => b - a)
    .map((v) => ({ label: tick(v), r: radius(v), labelY: baseline - radius(v) * 2 }));
  for (let i = 1; i < items.length; i++) {
    items[i].labelY = Math.max(items[i].labelY, items[i - 1].labelY + LABEL_GAP);
  }
  const height = Math.max(baseline, items[items.length - 1]?.labelY ?? 0) + 7;
  return { items, maxR, baseline, labelX, width: labelX + 52, height };
}

interface BubbleLegendProps {
  indicator: Indicator;
  title: string;
  radius: ScalePower<number, number>;
  tokens: Tokens;
}

export function BubbleLegend({ indicator, title, radius, tokens }: BubbleLegendProps) {
  const t = useT();
  const { items, maxR, baseline, labelX, width, height } = bubbleLegendModel(indicator, radius);
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">{t.unitSuffix(indicator.unit)}</span>
      </div>
      <svg width={width} height={height} aria-hidden="true">
        {items.map(({ label, r, labelY }) => (
          <g key={label}>
            <circle cx={maxR} cy={baseline - r} r={r} fill="none" stroke={tokens.inkMuted} />
            <polyline
              points={`${maxR},${baseline - r * 2} ${labelX - 10},${baseline - r * 2} ${labelX - 4},${labelY}`}
              fill="none"
              stroke={tokens.axis}
            />
            <text x={labelX} y={labelY} dy="0.35em" fill={tokens.inkSecondary} fontSize={11}>
              {label}
            </text>
          </g>
        ))}
      </svg>
      <NoDataKey />
    </div>
  );
}

/** 3D 柱子圖例的最高長條（px） */
const COLUMN_MAX_PX = 44;
/** 最高長條上方留一行字 */
const COLUMN_LABEL_ROW = 14;

/**
 * 3D 柱子圖例的版面（px）。柱高與數值成正比，所以用等距的刻度
 * （比例圓的圖例是 1、10、100 倍的同心圓，放在線性的長條上，小的會看不到）
 */
export interface ColumnLegendModel {
  bars: { label: string; x: number; h: number }[];
  /** 長條的底部 */
  baseline: number;
  width: number;
  height: number;
}

export function columnLegendModel(indicator: Indicator, max: number): ColumnLegendModel {
  const values = scaleLinear().domain([0, max]).ticks(3).filter((v) => v > 0);
  const tick = indicator.formatTick ?? indicator.format;
  const labels = values.map(tick);
  const slot = Math.max(30, Math.max(...labels.map((l) => l.length)) * 6.5 + 10);
  const baseline = COLUMN_LABEL_ROW + COLUMN_MAX_PX;
  return {
    bars: values.map((v, i) => ({ label: labels[i], x: slot * i + slot / 2, h: (v / max) * COLUMN_MAX_PX })),
    baseline,
    width: slot * values.length,
    height: baseline + 1,
  };
}

interface ColumnLegendProps {
  indicator: Indicator;
  title: string;
  /** 所有年份的最大值，地圖上最高的柱子 */
  max: number;
  /** 柱子的顏色（地圖資料色） */
  color: string;
  tokens: Tokens;
}

/** 3D 柱子的圖例：等距刻度的長條 */
export function ColumnLegend({ indicator, title, max, color, tokens }: ColumnLegendProps) {
  const t = useT();
  const lang = useLang();
  const { bars, baseline, width, height } = columnLegendModel(indicator, max);
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">{t.unitSuffix(indicator.unit)}</span>
      </div>
      <div className="legend-note">{tr(COLUMN_NOTE, lang)}</div>
      <svg width={width} height={height} aria-hidden="true">
        {bars.map(({ label, x, h }) => (
          <g key={label}>
            <rect x={x - 6} y={baseline - h} width={12} height={h} rx={1.5} fill={color} />
            <text x={x} y={baseline - h - 4} textAnchor="middle" fill={tokens.inkSecondary} fontSize={11}>
              {label}
            </text>
          </g>
        ))}
        <line x1={0} x2={width} y1={baseline + 0.5} y2={baseline + 0.5} stroke={tokens.axis} />
      </svg>
      <NoDataKey />
    </div>
  );
}

/** 流向圖圖例：幾條不同粗細的線對照金額（版面 px，畫面上的圖例與匯出的圖片共用） */
export interface FlowLegendModel {
  rows: { label: string; width: number; y: number }[];
  colors: { start: string; mid: string; end: string };
  /** 線段樣本的長度，標籤畫在 lineLength + 12 */
  lineLength: number;
  height: number;
  /** 漸層樣本旁的說明 */
  key: string;
}

export function flowLegendModel(indicator: Indicator, direction: FlowDirection, max: number): FlowLegendModel {
  const tick = indicator.formatTick ?? indicator.format;
  const rowHeight = FLOW_MAX_WIDTH + 4;
  const rows = flowLegendValues(max).map((v, i) => ({
    label: tick(v),
    width: flowWidth(v, max),
    y: i * rowHeight + rowHeight / 2,
  }));
  return { rows, colors: flowColors(direction), lineLength: 36, height: rows.length * rowHeight, key: flowText().legendKey };
}

interface FlowLegendProps {
  indicator: Indicator;
  title: string;
  direction: FlowDirection;
  /** 最大夥伴的金額（線寬以它為最粗） */
  max: number;
  tokens: Tokens;
}

/** 流向圖：幾條不同粗細的線對照金額，加上「淺 → 深」的流向說明 */
export function FlowLegend({ indicator, title, direction, max, tokens }: FlowLegendProps) {
  const t = useT();
  const { rows, colors, lineLength, height, key } = flowLegendModel(indicator, direction, max);
  const gradientId = `flow-legend-${direction}`;
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">{t.unitSuffix(indicator.unit)}</span>
      </div>
      <svg width={lineLength + 84} height={height} aria-hidden="true">
        {rows.map(({ label, width, y }) => (
          <g key={label}>
            <line x1={2} x2={2 + lineLength} y1={y} y2={y} stroke={colors.mid} strokeWidth={width} strokeLinecap="round" />
            <text x={lineLength + 12} y={y} dy="0.35em" fill={tokens.inkSecondary} fontSize={11}>
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="legend-nodata">
        <svg width={40} height={10} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId}>
              <stop offset="0" stopColor={colors.start} />
              <stop offset="1" stopColor={colors.end} />
            </linearGradient>
          </defs>
          {/* 漸層不能畫在水平線上（外框高度為 0，漸層不會顯示），改用矩形 */}
          <rect x={2} y={3} width={36} height={4} rx={2} fill={`url(#${gradientId})`} />
        </svg>
        {key}
      </div>
    </div>
  );
}

function NoDataKey() {
  const t = useT();
  return (
    <div className="legend-nodata">
      <span className="swatch-nodata" />
      {t.noData}
    </div>
  );
}
