import type { ScalePower, ScaleThreshold } from 'd3-scale';
import { niceLegendValues } from '../lib/format';
import type { FlowDirection, IndicatorDef } from '../topics/types';
import type { Tokens } from '../theme/tokens';
import { FLOW_MAX_WIDTH, flowColors, flowLegendValues, flowWidth } from './flows';

interface ChoroplethLegendProps {
  indicator: IndicatorDef;
  title: string;
  scale: ScaleThreshold<number, string>;
}

export function ChoroplethLegend({ indicator, title, scale }: ChoroplethLegendProps) {
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
      <div className="legend-scale" style={{ width: colors.length * swatchWidth }}>
        <div className="legend-swatches">
          {colors.map((c) => (
            <span key={c} style={{ background: c }} />
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

interface FlowLegendProps {
  title: string;
  unit: string;
  direction: FlowDirection;
  /** 最大夥伴的金額（線寬以它為最粗） */
  max: number;
  formatTick: (value: number) => string;
  tokens: Tokens;
}

/** 流向圖：幾條不同粗細的線對照金額，加上「淺 → 深」的流向說明 */
export function FlowLegend({ title, unit, direction, max, formatTick, tokens }: FlowLegendProps) {
  const colors = flowColors(direction);
  const values = flowLegendValues(max);
  const rowHeight = FLOW_MAX_WIDTH + 4;
  const gradientId = `flow-legend-${direction}`;
  return (
    <div className="legend">
      <div className="legend-title">
        {title}
        <span className="legend-unit">（{unit}）</span>
      </div>
      <svg width={120} height={values.length * rowHeight} aria-hidden="true">
        {values.map((v, i) => {
          const y = i * rowHeight + rowHeight / 2;
          return (
            <g key={v}>
              <line x1={2} x2={38} y1={y} y2={y} stroke={colors.mid} strokeWidth={flowWidth(v, max)} strokeLinecap="round" />
              <text x={48} y={y} dy="0.35em" fill={tokens.inkSecondary} fontSize={11}>
                {formatTick(v)}
              </text>
            </g>
          );
        })}
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
        由出口國（淺）到進口國（深）
      </div>
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
