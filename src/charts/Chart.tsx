import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import type { AreaSeries, BandSeries, BarSeries, ChartSpec, LineSeries, Series, TooltipContent } from './spec';

interface ChartProps {
  spec: ChartSpec;
  /** 整張圖（含圖例）的高度 */
  height: number;
  ariaLabel: string;
}

/** 刻度文字的字級（px），量文字寬度用 */
const TICK_FONT = 11;
/** 線尾名稱最寬幾 px（長的國名截掉） */
const END_LABEL_WIDTH = 56;
/** 線尾名稱上下至少隔幾 px */
const END_LABEL_GAP = 12;

let measureContext: CanvasRenderingContext2D | null = null;

/** 文字寬度（px），用跟頁面一樣的字型 */
function textWidth(text: string, size = TICK_FONT): number {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * size * 0.6;
  measureContext.font = `${size}px ${getComputedStyle(document.documentElement).fontFamily}`;
  return measureContext.measureText(text).width;
}

/** 截到 max px 以內，超過的用「…」 */
function truncate(text: string, max: number, size = TICK_FONT): string {
  if (textWidth(text, size) <= max) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`, size) > max) out = out.slice(0, -1);
  return `${out}…`;
}

interface Point {
  x: number;
  y: number;
}

/** 把點連成線：null 斷開（connectNulls 時跳過），回傳一段一段 */
function segments(points: (Point | null)[], connectNulls = false): Point[][] {
  const out: Point[][] = [];
  let current: Point[] = [];
  for (const p of points) {
    if (p) current.push(p);
    else if (!connectNulls && current.length) {
      out.push(current);
      current = [];
    }
  }
  if (current.length) out.push(current);
  return out;
}

const pathOf = (segs: Point[][]) =>
  segs.map((s) => `M${s.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}`).join('');

/** 圖例上的小圖示：線、虛線、方塊 */
function LegendKey({ series }: { series: Series }) {
  if (series.type === 'line') {
    return (
      <svg width="14" height="8" aria-hidden="true">
        <line
          x1="1"
          x2="13"
          y1="4"
          y2="4"
          stroke={series.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={series.dashed ? '4 3' : undefined}
        />
      </svg>
    );
  }
  return (
    <span
      className="chart-legend-box"
      style={{ background: series.color, opacity: series.type === 'band' ? Math.max(0.35, series.opacity) : 1 }}
    />
  );
}

/**
 * 自己畫的 SVG 圖表（2026-10-29 取代 ECharts，壓縮後省約 180 KB）。圖例是 HTML（放不下自動換行），
 * 下面是 SVG：y 軸刻度與格線、x 軸刻度、各系列、參考線、事件標記、線尾名稱；滑到圖上依 x 對齊顯示 tooltip
 * （觸控：點一下或拖過去）。顏色用 CSS 變數（--grid、--axis、--ink-muted），深淺色跟著換。
 */
export function Chart({ spec, height, ariaLabel }: ChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tipLeft, setTipLeft] = useState(0);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const update = () => {
      const { width, height: h } = el.getBoundingClientRect();
      setSize((s) => (s && s.width === width && s.height === h ? s : { width, height: h }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const legendItems = spec.series.filter((s) => s.legend !== false);
  const showLegend = legendItems.length > 1;

  const layout = useMemo(() => (size && size.width > 40 ? computeLayout(spec, size.width, size.height) : null), [spec, size]);

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (!layout || !spec.tooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHover(layout.nearest(e.clientX - rect.left));
  };

  const tip: TooltipContent | null = hover !== null && spec.tooltip ? spec.tooltip(hover) : null;
  const hoverX = hover !== null && layout ? layout.xOf(hover) : null;

  // 觸控：點到圖外面才收起 tooltip
  useLayoutEffect(() => {
    if (hover === null) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!(e.target instanceof Node && plotRef.current?.contains(e.target))) setHover(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [hover]);

  // tooltip 放在指示線右邊，放不下就放左邊，再不行就貼著圖的邊（窄的小圖：治理的六個面向）
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || hoverX === null || !size) return;
    const w = el.offsetWidth;
    const left = hoverX + 12 + w <= size.width ? hoverX + 12 : hoverX - 12 - w >= 0 ? hoverX - 12 - w : Math.max(0, size.width - w);
    setTipLeft((l) => (l === left ? l : left));
  });

  return (
    <div className="chart" style={{ height }} role="img" aria-label={ariaLabel}>
      {showLegend && (
        <ul className="chart-legend" aria-hidden="true">
          {legendItems.map((s) => (
            <li key={s.name}>
              <LegendKey series={s} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="chart-plot" ref={plotRef}>
        {layout && size && (
          <svg
            width={size.width}
            height={size.height}
            aria-hidden="true"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            // 觸控放開手指時也會觸發 pointerleave：手指的 tooltip 留著，點圖外面才收（下面的 effect）
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          >
            {/* 格線與 y 軸刻度 */}
            {layout.yTicks.map((t) => (
              <g key={t.value}>
                <line className="chart-grid" x1={layout.left} x2={layout.right} y1={t.y} y2={t.y} />
                <text className="chart-tick" x={layout.left - 6} y={t.y + 4} textAnchor="end">
                  {t.label}
                </text>
              </g>
            ))}
            {/* 長條的 tooltip：整個類別的範圍打底 */}
            {hoverX !== null && tip && layout.band > 0 && (
              <rect
                className="chart-hover-band"
                x={hoverX - layout.band / 2}
                width={layout.band}
                y={layout.top}
                height={layout.bottom - layout.top}
              />
            )}
            {layout.shapes}
            <line className="chart-axis" x1={layout.left} x2={layout.right} y1={layout.bottom} y2={layout.bottom} />
            {layout.xTicks.map((t) => (
              <text key={t.key} className="chart-tick" x={t.x} y={layout.bottom + 14} textAnchor={t.anchor}>
                {t.label}
              </text>
            ))}
            {hoverX !== null && tip && layout.band === 0 && (
              <line className="chart-pointer" x1={hoverX} x2={hoverX} y1={layout.top} y2={layout.bottom} />
            )}
            {layout.overlay}
          </svg>
        )}
        {tip && hoverX !== null && size && (
          <div ref={tipRef} className="chart-tooltip" aria-hidden="true" style={{ left: tipLeft }}>
            <div className="tt-head">{tip.head}</div>
            {tip.rows.map((row, i) => (
              <div key={i} className="tt-row">
                <span className={`tt-key${row.box ? ' tt-key-box' : ''}`} style={{ background: row.color }} />
                <strong>{row.value}</strong>
                <span className="tt-name">{row.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Layout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** 長條圖一個類別的寬度；不是長條圖時是 0 */
  band: number;
  yTicks: { value: number; y: number; label: string }[];
  xTicks: { key: number; x: number; label: string; anchor: 'start' | 'middle' | 'end' }[];
  shapes: React.ReactNode;
  /** 畫在 tooltip 指示線上面的：線尾名稱、事件標記的文字 */
  overlay: React.ReactNode;
  xOf: (at: number) => number;
  nearest: (px: number) => number | null;
}

function computeLayout(spec: ChartSpec, width: number, height: number): Layout {
  const { x: xAxis, y: yAxis, series } = spec;
  const lines = series.filter((s): s is LineSeries => s.type === 'line');
  const areas = series.filter((s): s is AreaSeries => s.type === 'area');
  const bands = series.filter((s): s is BandSeries => s.type === 'band');
  const bars = series.filter((s): s is BarSeries => s.type === 'bar');
  const count = xAxis.type === 'category' ? xAxis.labels.length : 0;

  // 堆疊面積每一層的上緣
  const stackTops: number[][] = [];
  for (const area of areas) {
    const below = stackTops[stackTops.length - 1];
    stackTops.push(area.values.map((v, i) => (below?.[i] ?? 0) + (v ?? 0)));
  }

  // y 的範圍：所有系列（含堆疊的總和、色帶、參考線）；預設包含 0
  const values: number[] = [];
  const push = (list: (number | null | undefined)[]) => {
    for (const v of list) if (v != null && Number.isFinite(v)) values.push(v);
  };
  for (const s of lines) push(s.values);
  for (const s of bars) push(s.values);
  for (const s of bands) push([...s.low, ...s.high]);
  for (const top of stackTops) push(top);
  push((spec.refs ?? []).map((r) => r.y));
  if (yAxis.zero !== false) values.push(0);
  let lo = yAxis.min ?? Math.min(...values);
  let hi = yAxis.max ?? Math.max(...values);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1];
  if (lo === hi) [lo, hi] = lo === 0 ? [0, 1] : [lo - Math.abs(lo) * 0.1, hi + Math.abs(hi) * 0.1];

  const top = spec.events?.length ? 16 : 6;
  const bottom = height - 20;
  const y = scaleLinear().domain([lo, hi]).range([bottom, top]);
  if (yAxis.min === undefined || yAxis.max === undefined) {
    const nice = scaleLinear().domain([lo, hi]).nice(4).domain();
    y.domain([yAxis.min ?? nice[0], yAxis.max ?? nice[1]]);
  }
  let tickValues = yAxis.ticks ?? y.ticks(4);
  if (yAxis.integer) {
    const ints = tickValues.filter((t) => Number.isInteger(t));
    tickValues = ints.length >= 2 ? ints : tickValues;
  }
  const yTicks = tickValues.map((value) => ({ value, y: y(value), label: yAxis.format(value) }));

  const labelWidth = Math.max(0, ...yTicks.map((t) => textWidth(t.label)));
  const left = Math.ceil(labelWidth) + 8;
  const right = width - (spec.endLabels ? END_LABEL_WIDTH + 8 : 10);
  const plotWidth = Math.max(1, right - left);

  // x 的位置：類別軸的折線從左緣畫到右緣，長條圖每個類別一格；數值軸用比例尺
  const band = bars.length && count ? plotWidth / count : 0;
  const xValue = xAxis.type === 'value' ? scaleLinear().domain([xAxis.min, xAxis.max]).range([left, right]) : null;
  const xOf = (at: number) =>
    xValue ? xValue(at) : band ? left + band * (at + 0.5) : count <= 1 ? left + plotWidth / 2 : left + (plotWidth * at) / (count - 1);
  const pointsOf = (vals: (number | null)[], xs?: number[]) =>
    vals.map((v, i) => (v == null || !Number.isFinite(v) ? null : { x: xOf(xs ? xs[i] : i), y: y(v) }));

  const shapes: React.ReactNode[] = [];
  const overlay: React.ReactNode[] = [];

  // 色帶
  bands.forEach((s, k) => {
    const n = s.low.length;
    const both = Array.from({ length: n }, (_, i) => s.low[i] != null && s.high[i] != null);
    const lowPts = pointsOf(s.low.map((v, i) => (both[i] ? v : null)), s.xs);
    const highPts = pointsOf(s.high.map((v, i) => (both[i] ? v : null)), s.xs);
    const lowSegs = segments(lowPts);
    const highSegs = segments(highPts);
    const d = highSegs
      .map((seg, j) => {
        const back = lowSegs[j] ?? [];
        return `M${[...seg, ...back.slice().reverse()].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`;
      })
      .join('');
    shapes.push(<path key={`band-${k}`} d={d} fill={s.color} fillOpacity={s.opacity} stroke="none" />);
  });

  // 堆疊面積：由下往上填色，再畫每一層上緣的 2 px 背景色線（層與層分開）
  areas.forEach((s, k) => {
    const topPts = stackTops[k].map((v, i) => ({ x: xOf(i), y: y(v) }));
    const below = k ? stackTops[k - 1] : null;
    const bottomPts = stackTops[k].map((_v, i) => ({ x: xOf(i), y: y(below ? below[i] : 0) })).reverse();
    const d = `M${[...topPts, ...bottomPts].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`;
    shapes.push(<path key={`area-${k}`} d={d} fill={s.color} stroke="none" />);
  });
  areas.forEach((_s, k) => {
    const topPts = stackTops[k].map((v, i) => ({ x: xOf(i), y: y(v) }));
    shapes.push(<path key={`area-edge-${k}`} className="chart-area-edge" d={pathOf([topPts])} />);
  });

  // 並排的長條：每個類別留 30% 的空隙，同一類別的長條之間 15%
  if (bars.length && band) {
    const inner = band * 0.7;
    const barWidth = inner / (bars.length + (bars.length - 1) * 0.15);
    bars.forEach((s, k) => {
      const offset = -inner / 2 + k * barWidth * 1.15;
      const zero = y(Math.max(y.domain()[0], Math.min(0, y.domain()[1])));
      const d = s.values
        .map((v, i) => {
          if (v == null || !Number.isFinite(v)) return '';
          const x0 = xOf(i) + offset;
          const yv = y(v);
          const h = zero - yv;
          const r = Math.min(3, barWidth / 2, Math.abs(h));
          if (Math.abs(h) < 0.5) return '';
          // 數值那一端是圓角
          return h > 0
            ? `M${x0},${zero}V${yv + r}Q${x0},${yv} ${x0 + r},${yv}H${x0 + barWidth - r}Q${x0 + barWidth},${yv} ${x0 + barWidth},${yv + r}V${zero}Z`
            : `M${x0},${zero}V${yv - r}Q${x0},${yv} ${x0 + r},${yv}H${x0 + barWidth - r}Q${x0 + barWidth},${yv} ${x0 + barWidth},${yv - r}V${zero}Z`;
        })
        .join('');
      shapes.push(<path key={`bar-${k}`} d={d} fill={s.color} />);
    });
  }

  // 參考線（目前的年份、統計方法改變、0、目標）
  (spec.refs ?? []).forEach((r, k) => {
    const cls = `chart-ref${r.dashed ? ' is-dashed' : ''}`;
    const style = r.color || r.width ? { stroke: r.color, strokeWidth: r.width } : undefined;
    if (r.x !== undefined) {
      const px = xOf(r.x);
      if (px >= left - 0.5 && px <= right + 0.5) {
        shapes.push(<line key={`ref-${k}`} className={cls} style={style} x1={px} x2={px} y1={top} y2={bottom} />);
        if (r.label) {
          const anchorEnd = px + 4 + textWidth(r.label) > width - 2;
          overlay.push(
            <text key={`ref-label-${k}`} className="chart-event-label" x={anchorEnd ? px - 4 : px + 4} y={top + 10} textAnchor={anchorEnd ? 'end' : 'start'}>
              {r.label}
            </text>,
          );
        }
      }
    }
    if (r.y !== undefined) {
      const py = y(r.y);
      if (py >= top - 0.5 && py <= bottom + 0.5) {
        shapes.push(<line key={`ref-${k}`} className={cls} style={style} x1={left} x2={right} y1={py} y2={py} />);
        // 水平線的字寫在右端上方（援助的「0.7% 目標」）
        if (r.label) {
          overlay.push(
            <text key={`ref-label-${k}`} className="chart-event-label" x={right - 2} y={py - 4} textAnchor="end">
              {r.label}
            </text>,
          );
        }
      }
    }
  });

  // 事件標記：點線，名稱寫在上緣；跟前一個重疊時往下一行
  let lastEnd = -Infinity;
  let row = 0;
  (spec.events ?? []).forEach((ev, k) => {
    const px = xOf(ev.x);
    if (px < left - 0.5 || px > right + 0.5) return;
    shapes.push(<line key={`event-${k}`} className="chart-event" x1={px} x2={px} y1={top - 4} y2={bottom} />);
    const label = truncate(ev.label, 90, 10);
    const w = textWidth(label, 10);
    const anchorEnd = px + 3 + w > width - 2;
    const start = anchorEnd ? px - 3 - w : px + 3;
    row = start < lastEnd + 4 ? row + 1 : 0;
    lastEnd = start + w;
    overlay.push(
      <text key={`event-label-${k}`} className="chart-event-label" x={anchorEnd ? px - 3 : px + 3} y={top - 6 + row * 11} textAnchor={anchorEnd ? 'end' : 'start'}>
        {label}
      </text>,
    );
  });

  // 折線（推估的部分虛線）與資料點
  lines.forEach((s, k) => {
    const pts = pointsOf(s.values, s.xs);
    if (s.fill) {
      const zero = y(Math.max(y.domain()[0], Math.min(0, y.domain()[1])));
      const d = segments(pts, s.connectNulls)
        .map((seg) => `${pathOf([seg])}L${seg[seg.length - 1].x.toFixed(1)},${zero}L${seg[0].x.toFixed(1)},${zero}Z`)
        .join('');
      shapes.push(<path key={`fill-${k}`} d={d} fill={s.color} fillOpacity={s.fill} stroke="none" />);
    }
    const stroke = { stroke: s.color, strokeWidth: s.width ?? 2 };
    if (s.dashFrom !== undefined && s.dashFrom > 0) {
      const solid = pts.map((p, i) => (i < s.dashFrom! ? p : null));
      const dashed = pts.map((p, i) => (i >= s.dashFrom! - 1 ? p : null));
      shapes.push(<path key={`line-${k}`} className="chart-line" d={pathOf(segments(solid, s.connectNulls))} {...stroke} />);
      shapes.push(<path key={`line-${k}-p`} className="chart-line" d={pathOf(segments(dashed, s.connectNulls))} {...stroke} strokeDasharray="5 4" />);
    } else {
      shapes.push(
        <path
          key={`line-${k}`}
          className="chart-line"
          d={pathOf(segments(pts, s.connectNulls))}
          {...stroke}
          strokeDasharray={s.dashed ? '5 4' : undefined}
        />,
      );
    }
    // 資料點：要求畫的（零散的年份），或前後都沒有值的孤立點（否則看不到）
    pts.forEach((p, i) => {
      if (!p) return;
      const lonely = !s.connectNulls && !pts[i - 1] && !pts[i + 1];
      if (s.dots || lonely) shapes.push(<circle key={`dot-${k}-${i}`} className="chart-dot" cx={p.x} cy={p.y} r={2.5} fill={s.color} />);
    });
  });

  // 線尾的名稱：寫在最後一個有值的點右邊，太靠近的上下推開
  if (spec.endLabels) {
    const ends = lines
      .filter((s) => s.legend !== false)
      .flatMap((s) => {
        const pts = pointsOf(s.values, s.xs);
        const last = pts.findLastIndex((p) => p !== null);
        return last < 0 ? [] : [{ name: s.name, x: pts[last]!.x, y: pts[last]!.y }];
      })
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + END_LABEL_GAP);
    const overflow = ends.length ? ends[ends.length - 1].y - (bottom - 2) : 0;
    if (overflow > 0) for (const e of ends) e.y -= overflow;
    ends.forEach((e) =>
      overlay.push(
        <text key={`end-${e.name}`} className="chart-end-label" x={Math.max(e.x, right) + 4} y={e.y + 4}>
          {truncate(e.name, END_LABEL_WIDTH)}
        </text>,
      ),
    );
  }

  // x 軸刻度：放不下就跳過（前一個的右緣之後至少 6 px）
  const candidates =
    xAxis.type === 'category'
      ? xAxis.labels.map((label, i) => ({ at: i, label })).filter((c) => xAxis.showLabel?.(c.at) ?? true)
      : xAxis.ticks.map((t) => ({ at: t, label: xAxis.format ? xAxis.format(t) : String(t) }));
  const xTicks: Layout['xTicks'] = [];
  let edge = -Infinity;
  for (const c of candidates) {
    const px = xOf(c.at);
    const w = textWidth(c.label);
    // 貼著左右邊的刻度靠內對齊，不超出圖
    const anchor = px - w / 2 < 0 ? 'start' : px + w / 2 > width ? 'end' : 'middle';
    const start = anchor === 'start' ? px : anchor === 'end' ? px - w : px - w / 2;
    if (start < edge + 6) continue;
    edge = start + w;
    xTicks.push({ key: c.at, x: px, label: c.label, anchor });
  }

  // tooltip 對齊的位置
  const tooltipXs =
    xAxis.type === 'value' ? (spec.tooltipXs ?? lines[0]?.xs ?? bands[0]?.xs ?? []) : null;
  const nearest = (px: number): number | null => {
    if (px < left - 8 || px > right + 8) return null;
    if (tooltipXs) {
      let best: number | null = null;
      for (const v of tooltipXs) if (best === null || Math.abs(xOf(v) - px) < Math.abs(xOf(best) - px)) best = v;
      return best;
    }
    if (!count) return null;
    const i = band ? Math.floor((px - left) / band) : Math.round(((px - left) / plotWidth) * (count - 1));
    return Math.max(0, Math.min(count - 1, i));
  };

  return { left, right, top, bottom, band, yTicks, xTicks, shapes, overlay, xOf, nearest };
}
