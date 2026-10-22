import { scaleLinear, type ScalePower, type ScaleThreshold } from 'd3-scale';
import { niceLegendValues } from '../lib/format';
import type { IndicatorDef } from '../topics/types';
import type { Tokens } from '../theme/tokens';

interface ChoroplethLegendProps {
  indicator: IndicatorDef;
  title: string;
  scale: ScaleThreshold<number, string>;
  /** 3D：色塊畫成階梯，表示每一級的高度 */
  stepped?: boolean;
}

/** 3D 階梯色塊的最大高度（px） */
const STEP_MAX_PX = 26;

export function ChoroplethLegend({ indicator, title, scale, stepped = false }: ChoroplethLegendProps) {
  const colors = scale.range();
  const thresholds = scale.domain();
  const tick = indicator.formatTick ?? indicator.format;
  const labels = thresholds.map(tick);
  // 刻度標在色塊交界，色塊要比最長的刻度文字寬，相鄰刻度才不會重疊
  const swatchWidth = Math.max(34, Math.max(...labels.map((l) => l.length)) * 6.5 + 8);
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">（{indicator.unit}）</span>
      </div>
      {stepped && <div className="legend-note">高度：每升一級色階加高一階（同一級內依數值）</div>}
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

const LABEL_GAP = 13;

interface BubbleLegendProps {
  indicator: IndicatorDef;
  title: string;
  radius: ScalePower<number, number>;
  tokens: Tokens;
}

export function BubbleLegend({ indicator, title, radius, tokens }: BubbleLegendProps) {
  const spec = indicator.layer.kind === 'bubble' ? indicator.layer.legendValues : [];
  const values = spec === 'auto' ? niceLegendValues(radius.domain()[1]) : spec;
  const tick = indicator.formatTick ?? indicator.format;
  const maxR = Math.max(...values.map(radius));
  const top = 7; // 最大圓的標籤在圓頂，留半行字高
  const baseline = top + maxR * 2;
  const labelX = maxR * 2 + 12;

  // 同心圓底部對齊，標籤放在圓頂高度；小圓的圓頂很接近時往下推開，避免文字重疊
  const items = [...values]
    .sort((a, b) => b - a)
    .map((v) => ({ v, r: radius(v), labelY: baseline - radius(v) * 2 }));
  for (let i = 1; i < items.length; i++) {
    items[i].labelY = Math.max(items[i].labelY, items[i - 1].labelY + LABEL_GAP);
  }
  const height = Math.max(baseline, items[items.length - 1]?.labelY ?? 0) + 7;

  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">（{indicator.unit}）</span>
      </div>
      <svg width={labelX + 52} height={height} aria-hidden="true">
        {items.map(({ v, r, labelY }) => (
          <g key={v}>
            <circle cx={maxR} cy={baseline - r} r={r} fill="none" stroke={tokens.inkMuted} />
            <polyline
              points={`${maxR},${baseline - r * 2} ${labelX - 10},${baseline - r * 2} ${labelX - 4},${labelY}`}
              fill="none"
              stroke={tokens.axis}
            />
            <text x={labelX} y={labelY} dy="0.35em" fill={tokens.inkSecondary} fontSize={11}>
              {tick(v)}
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

interface ColumnLegendProps {
  indicator: IndicatorDef;
  title: string;
  /** 所有年份的最大值，地圖上最高的柱子 */
  max: number;
  /** 柱子的顏色（地圖資料色） */
  color: string;
  tokens: Tokens;
}

/** 3D 柱子：高度與數值成正比，所以圖例用等距的刻度（比例圓的圖例是 1、10、100 倍的同心圓） */
export function ColumnLegend({ indicator, title, max, color, tokens }: ColumnLegendProps) {
  const values = scaleLinear().domain([0, max]).ticks(3).filter((v) => v > 0);
  const tick = indicator.formatTick ?? indicator.format;
  const labels = values.map(tick);
  const slot = Math.max(30, Math.max(...labels.map((l) => l.length)) * 6.5 + 10);
  const top = 14; // 最高長條上方留一行字
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">（{indicator.unit}）</span>
      </div>
      <div className="legend-note">高度：與數值成正比（柱子粗細固定）</div>
      <svg width={slot * values.length} height={top + COLUMN_MAX_PX + 1} aria-hidden="true">
        {values.map((v, i) => {
          const h = (v / max) * COLUMN_MAX_PX;
          const x = slot * i + slot / 2;
          const y = top + COLUMN_MAX_PX - h;
          return (
            <g key={v}>
              <rect x={x - 6} y={y} width={12} height={h} rx={1.5} fill={color} />
              <text x={x} y={y - 4} textAnchor="middle" fill={tokens.inkSecondary} fontSize={11}>
                {labels[i]}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={slot * values.length} y1={top + COLUMN_MAX_PX + 0.5} y2={top + COLUMN_MAX_PX + 0.5} stroke={tokens.axis} />
      </svg>
      <NoDataKey />
    </div>
  );
}

function NoDataKey() {
  return (
    <div className="legend-nodata">
      <span className="swatch-nodata" />
      無資料
    </div>
  );
}
