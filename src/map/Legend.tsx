import { useMemo, type CSSProperties } from 'react';
import { bisectRight } from 'd3-array';
import { scaleLinear, type ScalePower, type ScaleThreshold } from 'd3-scale';
import { niceLegendValues } from '../lib/format';
import { tr, useLang, useT, type Text } from '../i18n';
import type { FlowDirection, Indicator } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
import { FLOW_MAX_WIDTH, flowColors, flowLegendValues, flowText, flowWidth } from './flows';
import type { CategoryScale } from './categories';
import { PaletteMenu } from './PaletteMenu';
import { RELIEF_NOTE, type ReliefLegendModel } from './terrain';

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

/** 面量圖圖例的色塊可以滑過、點選某一級（跟類別圖的圖例一樣），地圖上其他國家淡化 */
export interface ClassHighlight {
  values: Map<string, number>;
  highlight: number | null;
  onPreview: (index: number | null) => void;
  pinned: number | null;
  onPin: (index: number | null) => void;
}

interface ChoroplethLegendProps {
  indicator: Indicator;
  title: string;
  scale: ScaleThreshold<number, string>;
  /** 3D：色塊畫成階梯，表示每一級的高度 */
  stepped?: boolean;
  /** 標題下的說明（1 km 網格：哪一期、3D 時不拉高） */
  notes?: string[];
  /** 取代「無資料」：沒有上色的部分是什麼（1 km 網格：人口太少的格子） */
  emptyKey?: string;
  /** 標題旁放「配色」按鈕（PaletteMenu），列出這一種的選項；網格的顏色畫在圖磚裡，不傳 */
  paletteKind?: 'sequential' | 'diverging';
  /** 有傳才能滑過、點選分級（色塊的說明與下面那一行寫那一級的國家數）；網格、3D 不傳 */
  classes?: ClassHighlight;
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

export function ChoroplethLegend(props: ChoroplethLegendProps) {
  const { indicator, title, scale, stepped = false, notes = [], emptyKey, paletteKind, classes } = props;
  const t = useT();
  const lang = useLang();
  const { colors, labels, swatchWidth } = choroplethLegendModel(indicator, scale);
  const classValues = classes?.values;
  const counts = useMemo(() => {
    if (!classValues) return null;
    const thresholds = scale.domain();
    const out = scale.range().map(() => 0);
    for (const v of classValues.values()) out[bisectRight(thresholds, v)]++;
    return out;
  }, [classValues, scale]);
  const binLabel = (i: number) =>
    i === 0 ? t.binBelow(labels[0]) : i === labels.length ? t.binAbove(labels[i - 1]) : t.binRange(labels[i - 1], labels[i]);
  const highlight = classes?.highlight ?? null;
  return (
    <div className="legend">
      <div className="legend-head">
        <div className="legend-title">
          {title}
          <span className="legend-unit">{t.unitSuffix(indicator.unit)}</span>
        </div>
        {paletteKind && <PaletteMenu kind={paletteKind} />}
      </div>
      {stepped && <div className="legend-note">{tr(STEPPED_NOTE, lang)}</div>}
      {notes.map((note) => (
        <div key={note} className="legend-note">
          {note}
        </div>
      ))}
      <div
        className={`legend-scale${stepped ? ' is-stepped' : ''}`}
        style={{ width: colors.length * swatchWidth }}
      >
        <div className="legend-swatches">
          {colors.map((c, i) =>
            classes && counts ? (
              <button
                key={c}
                type="button"
                className={`legend-bin${highlight !== null && highlight !== i ? ' is-faded' : ''}`}
                style={{ background: c }}
                aria-pressed={classes.pinned === i}
                aria-label={t.binTitle(binLabel(i), counts[i])}
                title={t.binTitle(binLabel(i), counts[i])}
                onMouseEnter={() => classes.onPreview(i)}
                onMouseLeave={() => classes.onPreview(null)}
                onFocus={() => classes.onPreview(i)}
                onBlur={() => classes.onPreview(null)}
                onClick={() => classes.onPin(classes.pinned === i ? null : i)}
              />
            ) : (
              <span
                key={c}
                style={{ background: c, height: stepped ? ((i + 1) / colors.length) * STEP_MAX_PX : undefined }}
              />
            ),
          )}
        </div>
        <div className="legend-ticks">
          {labels.map((label, i) => (
            <span key={label} style={{ left: `${((i + 1) / colors.length) * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
      {counts && (
        // 沒有強調時也留著這一行（空的）：圖例貼著地圖下緣，文字出現時圖例變高會把色塊往上推，
        // 游標滑出色塊、文字消失、色塊掉回來，一直閃
        <div className="legend-note legend-bin-status">{highlight !== null && t.binStatus(binLabel(highlight), counts[highlight])}</div>
      )}
      {emptyKey ? (
        <div className="legend-nodata">
          <span className="swatch-empty" />
          {emptyKey}
        </div>
      ) : (
        <NoDataKey label={indicator.missing} />
      )}
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
  return {
    rows,
    colors: flowColors(direction),
    lineLength: 36,
    height: rows.length * rowHeight,
    key: flowText(indicator.layer).legendKey,
  };
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

/** 類別圖圖例：每一類一列（色塊、名稱、國家數），類別多時排成兩欄（畫面上的圖例與匯出的圖片共用） */
export interface CategoricalLegendModel {
  items: { label: string; color: string; count: number }[];
  columns: number;
}

/** 超過這麼多類就排成兩欄，圖例才不會太高（手機上會蓋住半張地圖） */
const ONE_COLUMN_MAX = 5;

export function categoricalLegendModel(scale: CategoryScale, values: Map<string, number>): CategoricalLegendModel {
  const counts = scale.items.map(() => 0);
  for (const v of values.values()) {
    const i = scale.index(v);
    if (i !== null) counts[i]++;
  }
  return {
    items: scale.items.map((item, i) => ({ label: item.label, color: item.color, count: counts[i] })),
    columns: scale.items.length > ONE_COLUMN_MAX ? 2 : 1,
  };
}

interface CategoricalLegendProps {
  title: string;
  scale: CategoryScale;
  values: Map<string, number>;
  /** 目前強調的類別（地圖上其他類別淡化） */
  highlight: number | null;
  /** 滑過或聚焦時強調；離開時傳 null */
  onPreview: (index: number | null) => void;
  /** 點一下固定強調（觸控裝置沒有滑過），再點一下取消 */
  pinned: number | null;
  onPin: (index: number | null) => void;
  /** 有強弱的類別（ordinal、diverging）用分級色、正負色，標題旁放「配色」按鈕 */
  paletteKind?: 'sequential' | 'diverging';
}

/** 類別圖：色塊與名稱，沒有數值刻度。滑過、點選某一類時地圖上只突顯那一類的國家 */
export function CategoricalLegend({ title, scale, values, highlight, onPreview, pinned, onPin, paletteKind }: CategoricalLegendProps) {
  const t = useT();
  const { items, columns } = categoricalLegendModel(scale, values);
  return (
    <div className="legend legend-categorical">
      <div className="legend-head">
        <div className="legend-title">{title}</div>
        {paletteKind && <PaletteMenu kind={paletteKind} />}
      </div>
      <ul
        className={`legend-categories${columns > 1 ? ' is-two-columns' : ''}`}
        style={{ '--rows': Math.ceil(items.length / columns) } as CSSProperties}
        aria-label={title}
      >
        {items.map(({ label, color, count }, i) => (
          <li key={label}>
            <button
              type="button"
              className={`legend-category${highlight !== null && highlight !== i ? ' is-faded' : ''}`}
              aria-pressed={pinned === i}
              onMouseEnter={() => onPreview(i)}
              onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview(i)}
              onBlur={() => onPreview(null)}
              onClick={() => onPin(pinned === i ? null : i)}
              title={t.categoryTitle(label, count)}
            >
              <span className="legend-swatch" style={{ background: color }} />
              <span className="legend-category-label">{label}</span>
              <span className="legend-count">{count}</span>
            </button>
          </li>
        ))}
      </ul>
      <NoDataKey />
    </div>
  );
}

/** 灰色的「無資料」；指標的 missing（值是 null 有固定意思，例如「到 2100 年都沒有」）取代那幾個字 */
function NoDataKey({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="legend-nodata">
      <span className="swatch-nodata" style={{ background: MAP_TOKENS.noData }} />
      {label ?? t.noData}
    </div>
  );
}

interface ReliefLegendProps {
  title: string;
  unit: string;
  model: ReliefLegendModel;
}

/** 地形圖的圖例：分層設色的漸層色條（刻度等距，海拔間距不等） */
export function ReliefLegend({ title, unit, model }: ReliefLegendProps) {
  const t = useT();
  const lang = useLang();
  const gradient = `linear-gradient(to right, ${model.stops.map((s) => `${s.color} ${(s.at * 100).toFixed(1)}%`).join(', ')})`;
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">{t.unitSuffix(unit)}</span>
      </div>
      <div className="legend-note">{tr(RELIEF_NOTE, lang)}</div>
      <div className="legend-scale legend-relief" style={{ width: model.width }}>
        <div className="legend-gradient" style={{ background: gradient }} />
        <div className="legend-ticks">
          {model.ticks.map(({ at, label }) => (
            <span key={label} style={{ left: `${at * 100}%` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
