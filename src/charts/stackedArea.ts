import type { LineSeriesOption } from 'echarts/charts';
import type { Tokens } from '../theme/tokens';
import { escapeHtml, type ChartOption } from './EChart';

export interface StackedSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface StackedAreaInput {
  years: number[];
  series: StackedSeries[];
  year: number;
  format: (value: number) => string;
  formatTick: (value: number) => string;
  tokens: Tokens;
}

/** 堆疊面積圖（例如各能源發電量）。系列之間用 1px 背景色線分隔，tooltip 列出每一層與合計。 */
export function stackedAreaOption({ years, series, year, format, formatTick, tokens }: StackedAreaInput): ChartOption {
  const lines: LineSeriesOption[] = series.map((s, i) => ({
    type: 'line',
    name: s.name,
    stack: 'total',
    data: s.values.map((v) => v ?? 0),
    showSymbol: false,
    color: s.color,
    lineStyle: { width: 1, color: tokens.surface },
    areaStyle: { color: s.color, opacity: 1 },
    emphasis: { disabled: true },
    z: series.length - i,
  }));
  lines[lines.length - 1].markLine = {
    silent: true,
    symbol: 'none',
    label: { show: false },
    lineStyle: { color: tokens.ink, type: 'solid', width: 1 },
    data: [{ xAxis: String(year) }],
  };

  return {
    animation: false,
    grid: { left: 4, right: 12, top: 8, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = (Array.isArray(params) ? params : [params]).slice().reverse(); // 由上往下，跟圖的堆疊順序一致
        const y = (list[0] as { axisValue?: string }).axisValue ?? '';
        const total = list.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
        const rows = list
          .filter((p) => Number(p.value) > 0)
          .map(
            (p) =>
              `<div class="tt-row"><span class="tt-key tt-key-box" style="background:${p.color}"></span>` +
              `<strong>${escapeHtml(format(Number(p.value)))}</strong>` +
              `<span class="tt-name">${escapeHtml(p.seriesName ?? '')}</span></div>`,
          );
        return `<div class="tt-head">${escapeHtml(y)} · 合計 ${escapeHtml(format(total))}</div>${rows.join('')}`;
      },
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, interval: (_i: number, v: string) => Number(v) % 5 === 0 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (v: number) => formatTick(v) },
    },
    series: lines,
  };
}

/** 從某年往前找最近一個有資料的年份索引 */
export function latestIndexAtOrBefore(years: number[], year: number, hasData: (index: number) => boolean): number {
  for (let i = years.length - 1; i >= 0; i--) {
    if (years[i] <= year && hasData(i)) return i;
  }
  return -1;
}
