import type { LineSeriesOption } from 'echarts/charts';
import type { IndicatorDef } from '../topics/types';
import type { Tokens } from '../theme/tokens';
import { escapeHtml, type ChartOption } from './EChart';

export interface TimeSeriesLine {
  name: string;
  values: (number | null)[];
  color: string;
}

interface TimeSeriesInput {
  years: number[];
  lines: TimeSeriesLine[];
  /** 從這一年起畫虛線（推估值） */
  projectionFrom?: number;
  /** 目前選擇的年份，畫一條垂直參考線 */
  year: number;
  indicator: IndicatorDef;
  tokens: Tokens;
}

/** 歷年折線：估計值實線、推估值虛線，同一個國家用同一個 series 名稱，圖例與 tooltip 才會合併 */
export function timeSeriesOption({ years, lines, projectionFrom, year, indicator, tokens }: TimeSeriesInput): ChartOption {
  const categories = years.map(String);
  const tick = indicator.formatTick ?? indicator.format;

  const series: LineSeriesOption[] = lines.flatMap((line, lineIndex) => {
    const base: LineSeriesOption = {
      type: 'line',
      name: line.name,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 8,
      color: line.color,
      lineStyle: { width: 2, color: line.color },
      emphasis: { disabled: true },
      z: lines.length - lineIndex,
    };
    if (projectionFrom === undefined) return [{ ...base, data: line.values }];
    return [
      { ...base, data: line.values.map((v, i) => (years[i] < projectionFrom ? v : null)) },
      {
        ...base,
        // 從推估前一年開始，讓實線與虛線接起來
        data: line.values.map((v, i) => (years[i] >= projectionFrom - 1 ? v : null)),
        lineStyle: { ...base.lineStyle, type: 'dashed' },
      },
    ];
  });

  const markLines: NonNullable<LineSeriesOption['markLine']>['data'] = [{ xAxis: String(year) }];
  if (indicator.layer.kind === 'choropleth' && indicator.layer.scale.type === 'diverging') {
    markLines.push({ yAxis: 0 });
  }
  series[0].markLine = {
    silent: true,
    symbol: 'none',
    label: { show: false },
    lineStyle: { color: tokens.inkMuted, type: 'solid', width: 1 },
    data: markLines,
  };

  return {
    animation: false,
    grid: {
      left: 4,
      right: 12,
      top: lines.length > 1 ? 32 : 12,
      bottom: 4,
      // ECharts 6 取代 containLabel 的寫法：座標軸標籤留在 grid 範圍內
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    legend:
      lines.length > 1
        ? {
            top: 0,
            left: 0,
            data: lines.map((l) => l.name),
            icon: 'path://M0,0H12V2H0Z',
            itemWidth: 12,
            itemHeight: 2,
            textStyle: { color: tokens.inkSecondary, fontSize: 12 },
            selectedMode: false,
          }
        : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const y = Number((list[0] as { axisValue?: string }).axisValue);
        const seen = new Set<string>();
        const rows = list.flatMap((p) => {
          const value = p.value as number | null | undefined;
          const name = p.seriesName ?? '';
          if (value == null || seen.has(name)) return [];
          seen.add(name);
          return [
            `<div class="tt-row"><span class="tt-key" style="background:${p.color}"></span>` +
              `<strong>${escapeHtml(indicator.format(value))}</strong>` +
              `<span class="tt-name">${escapeHtml(name)}</span></div>`,
          ];
        });
        const projected = projectionFrom !== undefined && y >= projectionFrom;
        return `<div class="tt-head">${y}${projected ? ' · 推估值' : ''}</div>${rows.join('')}`;
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.inkMuted,
        fontSize: 11,
        interval: (_index: number, value: string) => Number(value) % 50 === 0,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (v: number) => tick(v) },
    },
    series,
  };
}
