import { messages } from '../i18n';
import type { Indicator } from '../topics/types';
import type { Tokens } from '../theme/tokens';
import type { ChartSpec, EventMark, LineSeries, RefLine } from './spec';

export interface TimeSeriesLine {
  name: string;
  values: (number | null)[];
  color: string;
  /** 整條畫虛線（例如對照用的世界值）；沒有推估年份的圖才用 */
  dashed?: boolean;
}

interface TimeSeriesInput {
  years: number[];
  lines: TimeSeriesLine[];
  /** 從這一年起畫虛線（推估值） */
  projectionFrom?: number;
  /** 從這一年起換了統計方法：畫一條垂直虛線 */
  methodBreak?: number;
  /** 這一年以前多半是估計值：在這一年畫一條垂直虛線，tooltip 的年份後面寫「估計值」 */
  estimatesBefore?: number;
  /** 目前選擇的年份，畫一條垂直參考線 */
  year: number;
  indicator: Indicator;
  tokens: Tokens;
  /** 年份零散的資料（普查、隔幾年一次的調查）：畫出每個資料點，缺值的年份直接連過去 */
  sparse?: boolean;
  /** 事件標記（一胎化、COVID-19…），年份不在範圍內的不畫 */
  events?: { year: number; label: string }[];
}

/** 線的尾端寫名稱：最多幾條線（再多會擠成一團，只留圖例） */
const MAX_END_LABELS = 4;

/** 依年份跨度決定刻度間隔：1950–2100 每 50 年、1960–2025 每 20 年、2000–2025 每 5 年 */
export function yearTickStep(years: number[]): number {
  const span = years[years.length - 1] - years[0];
  return span > 100 ? 50 : span > 50 ? 20 : span > 25 ? 10 : 5;
}

/** 統計方法改變的那一年（索引）：比目前年份的參考線淡、用虛線，側欄底下另有文字說明 */
export function methodBreakLine(index: number): RefLine {
  return { x: index, dashed: true };
}

/**
 * 年份不連續（每 5 年一筆、FRA 的 1990、2000、2010、2015…）：補成連續的年份、缺的填 null 再連起來，
 * x 軸是類別軸，這樣間隔才跟實際的年數成比例（10 年的間隔不會畫得跟 5 年一樣寬）
 */
function consecutiveYears({ years, lines, sparse }: TimeSeriesInput): Pick<TimeSeriesInput, 'years' | 'lines' | 'sparse'> {
  if (years.every((y, i) => i === 0 || y - years[i - 1] === 1)) return { years, lines, sparse };
  const full = Array.from({ length: years[years.length - 1] - years[0] + 1 }, (_, i) => years[0] + i);
  const index = new Map(years.map((y, i) => [y, i]));
  return {
    years: full,
    lines: lines.map((l) => ({ ...l, values: full.map((y) => (index.has(y) ? l.values[index.get(y)!] : null)) })),
    sparse: true,
  };
}

/** 歷年折線：估計值實線、推估值虛線；2–4 條線時線尾寫名稱 */
export function timeSeriesOption(input: TimeSeriesInput): ChartSpec {
  // tokens 不用了（參考線、格線用 CSS 變數），參數留著，呼叫的地方不必改
  const { projectionFrom, methodBreak, estimatesBefore, year, indicator } = input;
  const { years, lines, sparse } = consecutiveYears(input);
  const tickStep = yearTickStep(years);
  const tick = indicator.formatTick ?? indicator.format;
  const indexOf = (y: number) => years.indexOf(y);

  const series: LineSeries[] = lines.map((line) => ({
    type: 'line',
    name: line.name,
    values: line.values,
    color: line.color,
    dashed: line.dashed,
    dashFrom: projectionFrom !== undefined && indexOf(projectionFrom) > 0 ? indexOf(projectionFrom) : undefined,
    dots: Boolean(sparse),
    connectNulls: Boolean(sparse),
  }));

  const refs: RefLine[] = [];
  if (indexOf(year) >= 0) refs.push({ x: indexOf(year) });
  if (indicator.layer.kind === 'choropleth' && indicator.layer.scale.type === 'diverging') refs.push({ y: 0 });
  if (methodBreak !== undefined && indexOf(methodBreak) >= 0) refs.push(methodBreakLine(indexOf(methodBreak)));
  // 估計值的分界也畫成淡的垂直虛線（側欄底下另有文字說明）
  if (estimatesBefore !== undefined && estimatesBefore > years[0] && indexOf(estimatesBefore) >= 0) {
    refs.push(methodBreakLine(indexOf(estimatesBefore)));
  }
  const events: EventMark[] = (input.events ?? [])
    .filter((e) => indexOf(e.year) >= 0)
    .map((e) => ({ x: indexOf(e.year), label: e.label }));

  return {
    x: { type: 'category', labels: years.map(String), showLabel: (i) => years[i] % tickStep === 0 },
    y: { format: (v) => tick(v), integer: indicator.integer },
    series,
    refs,
    events,
    endLabels: lines.length >= 2 && lines.length <= MAX_END_LABELS,
    tooltip: (i) => {
      const y = years[i];
      const rows = lines.flatMap((line) => {
        const value = line.values[i];
        return value == null ? [] : [{ color: line.color, value: indicator.format(value, y), name: line.name }];
      });
      if (!rows.length) return null;
      const projected = projectionFrom !== undefined && y >= projectionFrom;
      const estimated = estimatesBefore !== undefined && y < estimatesBefore;
      const tag = projected ? messages().projected : estimated ? messages().estimated : null;
      return { head: `${y}${tag ? ` · ${tag}` : ''}`, rows };
    },
  };
}
