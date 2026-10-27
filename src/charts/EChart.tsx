import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type MarkLineComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

// 按需引入，新主題要用 treemap、sankey 等圖表時在這裡加。LabelLayout：折線尾端的名稱靠太近時推開（timeSeries.ts）
echarts.use([LineChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, LabelLayout, SVGRenderer]);

export type ChartOption = echarts.ComposeOption<
  LineSeriesOption | GridComponentOption | LegendComponentOption | MarkLineComponentOption | TooltipComponentOption
>;

interface EChartProps {
  option: ChartOption;
  height: number;
  ariaLabel: string;
}

export function EChart({ option, height, ariaLabel }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, null, { renderer: 'svg' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} style={{ height }} role="img" aria-label={ariaLabel} />;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** ECharts 的 tooltip formatter 回傳 HTML 字串，放進去的文字一律跳脫 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
