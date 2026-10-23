import type { LineSeriesOption } from 'echarts/charts';
import { messages } from '../i18n';
import type { Indicator } from '../topics/types';
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
  /** 從這一年起換了統計方法：畫一條垂直虛線 */
  methodBreak?: number;
  /** 目前選擇的年份，畫一條垂直參考線 */
  year: number;
  indicator: Indicator;
  tokens: Tokens;
}

type MarkLineItem = NonNullable<NonNullable<LineSeriesOption['markLine']>['data']>[number];

/** 統計方法改變的那一年：比目前年份的參考線淡、用虛線，側欄底下另有文字說明 */
export function methodBreakLine(year: number, tokens: Tokens): MarkLineItem {
  return { xAxis: String(year), lineStyle: { color: tokens.inkMuted, type: [4, 3], width: 1 } };
}

/** 歷年折線：估計值實線、推估值虛線，同一個國家用同一個 series 名稱，圖例與 tooltip 才會合併 */
export function timeSeriesOption({
  years,
  lines,
  projectionFrom,
  methodBreak,
  year,
  indicator,
  tokens,
}: TimeSeriesInput): ChartOption {
  const categories = years.map(String);
  // 依年份跨度決定刻度間隔：1950–2100 每 50 年、1960–2025 每 20 年、2000–2025 每 5 年
  const span = years[years.length - 1] - years[0];
  const tickStep = span > 100 ? 50 : span > 50 ? 20 : span > 25 ? 10 : 5;
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
  if (methodBreak !== undefined && years.includes(methodBreak)) {
    markLines.push(methodBreakLine(methodBreak, tokens));
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
        return `<div class="tt-head">${y}${projected ? ` · ${messages().projected}` : ''}</div>${rows.join('')}`;
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
        interval: (_index: number, value: string) => Number(value) % tickStep === 0,
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
