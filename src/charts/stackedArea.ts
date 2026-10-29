import { messages } from '../i18n';
import type { Tokens } from '../theme/tokens';
import type { AreaSeries, ChartSpec, RefLine } from './spec';
import { methodBreakLine, yearTickStep } from './timeSeries';

export interface StackedSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface StackedAreaInput {
  years: number[];
  series: StackedSeries[];
  year: number;
  /** 從這一年起換了統計方法：畫一條垂直虛線 */
  methodBreak?: number;
  format: (value: number) => string;
  formatTick: (value: number) => string;
  /** 不用了（顏色用 CSS 變數），參數留著，呼叫的地方不必改 */
  tokens?: Tokens;
}

/** 堆疊面積圖（例如各能源發電量）。系列之間用 2px 背景色線分隔（dataviz 的 2px 間隔），tooltip 列出每一層與合計。 */
export function stackedAreaOption({ years, series, year, methodBreak, format, formatTick }: StackedAreaInput): ChartSpec {
  const areas: AreaSeries[] = series.map((s) => ({ type: 'area', name: s.name, values: s.values, color: s.color }));
  const refs: RefLine[] = [];
  if (years.includes(year)) refs.push({ x: years.indexOf(year), color: 'var(--ink)' });
  if (methodBreak !== undefined && years.includes(methodBreak)) refs.push(methodBreakLine(years.indexOf(methodBreak)));
  // 跟折線圖一樣依年份跨度調整刻度間隔，排放來源從 1850 年起
  const tickStep = yearTickStep(years);

  return {
    x: { type: 'category', labels: years.map(String), showLabel: (i) => years[i] % tickStep === 0 },
    y: { format: formatTick },
    series: areas,
    refs,
    tooltip: (i) => {
      // 由上往下，跟圖的堆疊順序一致
      const layers = series.slice().reverse();
      const total = layers.reduce((sum, s) => sum + (s.values[i] ?? 0), 0);
      const rows = layers
        .filter((s) => (s.values[i] ?? 0) > 0)
        .map((s) => ({ color: s.color, value: format(s.values[i]!), name: s.name, box: true }));
      return { head: `${years[i]} · ${messages().chartTotal} ${format(total)}`, rows };
    },
  };
}

/** 從某年往前找最近一個有資料的年份索引 */
export function latestIndexAtOrBefore(years: number[], year: number, hasData: (index: number) => boolean): number {
  for (let i = years.length - 1; i >= 0; i--) {
    if (years[i] <= year && hasData(i)) return i;
  }
  return -1;
}
