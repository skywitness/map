/**
 * 側欄圖表的描述（2026-10-29 換掉 ECharts）：timeSeries.ts、stackedArea.ts 與主題側欄產生這個物件，
 * Chart.tsx 畫成 SVG。只做網站用得到的：折線（含推估的虛線、資料點）、堆疊面積、信賴區間的色帶、並排的長條、
 * 參考線、事件標記、線尾的名稱、依 x 的 tooltip。
 */

/** tooltip 的一列：色塊、數值（粗體）、名稱 */
export interface TooltipRow {
  color: string;
  value: string;
  name: string;
  /** 方形色塊（面積、長條）；預設是一小段線 */
  box?: boolean;
}

export interface TooltipContent {
  head: string;
  rows: TooltipRow[];
}

export type XAxis =
  | {
      type: 'category';
      /** 每個位置的名稱（年份、月份），tooltip 的標題預設也用它 */
      labels: string[];
      /** 哪些位置寫刻度文字；預設全部（放不下時自動跳過） */
      showLabel?: (index: number) => boolean;
    }
  | {
      /** 數值軸（年份不等距：1996、1998、2000…），系列用 xs 給每個點的位置 */
      type: 'value';
      min: number;
      max: number;
      /** 寫字的刻度 */
      ticks: number[];
      format?: (value: number) => string;
    };

export interface YAxis {
  format: (value: number) => string;
  min?: number;
  max?: number;
  /** 範圍一定包含 0（預設）；氣溫、身高這類不從 0 開始比較看得出變化的設 false */
  zero?: boolean;
  /** 刻度只用整數（件數、名次） */
  integer?: boolean;
  /** 固定的刻度（治理分數 0、50、100） */
  ticks?: number[];
}

interface SeriesBase {
  name: string;
  color: string;
  /** 列在圖例上（預設是） */
  legend?: boolean;
}

export interface LineSeries extends SeriesBase {
  type: 'line';
  /** 類別軸：第 i 個值對到 labels[i]；數值軸：對到 xs[i] */
  values: (number | null)[];
  xs?: number[];
  width?: number;
  /** 整條虛線（對照用的世界值、氣候平均） */
  dashed?: boolean;
  /** 從這個位置起畫虛線（推估值）；實線畫到前一個位置，兩段接起來 */
  dashFrom?: number;
  /** 畫出每個資料點（年份零散的資料） */
  dots?: boolean;
  /** 缺值的地方直接連過去（預設斷開） */
  connectNulls?: boolean;
  /** 線下面到 0 填淡色（不透明度，晝長的 0.1） */
  fill?: number;
}

/** 堆疊面積：同一張圖的 area 系列依序往上疊，缺值當 0，層與層之間用 2px 的背景色線分開 */
export interface AreaSeries extends SeriesBase {
  type: 'area';
  values: (number | null)[];
}

/** 色帶（信賴區間）：low 到 high 之間填淡色，任一端缺值的地方斷開 */
export interface BandSeries extends SeriesBase {
  type: 'band';
  low: (number | null)[];
  high: (number | null)[];
  xs?: number[];
  opacity: number;
}

/** 長條：同一張圖的 bar 系列在每個類別裡並排 */
export interface BarSeries extends SeriesBase {
  type: 'bar';
  values: (number | null)[];
}

export type Series = LineSeries | AreaSeries | BandSeries | BarSeries;

/** 參考線：x 是類別的位置（或數值軸的值），y 是數值 */
export interface RefLine {
  x?: number;
  y?: number;
  /** 預設是淡的實線（目前的年份）；dashed 是統計方法改變、估計值的分界、目標線 */
  dashed?: boolean;
  color?: string;
  width?: number;
  /** 垂直線上緣寫的字（晝長選定的那一天） */
  label?: string;
}

/** 事件標記：x 的位置畫一條點線，上緣寫短短的名稱（「一胎化」「COVID-19」） */
export interface EventMark {
  x: number;
  label: string;
}

export interface ChartSpec {
  x: XAxis;
  y: YAxis;
  series: Series[];
  refs?: RefLine[];
  events?: EventMark[];
  /** 線尾寫系列名稱（2–4 條線時，不必來回對圖例） */
  endLabels?: boolean;
  /** 滑到某個位置（類別的索引，或數值軸上最近的資料點的值）時的 tooltip；null 不顯示 */
  tooltip?: (at: number) => TooltipContent | null;
  /** 數值軸的 tooltip 對齊到哪些 x（預設用第一個系列的 xs） */
  tooltipXs?: number[];
}
