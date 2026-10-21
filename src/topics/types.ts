/**
 * 主題外掛的介面。新增主題 = 在 pipeline/topics/ 產生資料 + 在這裡寫一個 TopicDefinition。
 * 地圖引擎、圖例、時間軸、側欄、排名表都只依賴這份介面。
 */

/** 面量圖的分級方式。分級門檻固定寫死，所有年份共用，拖動時間軸時顏色才能互相比較。 */
export type ScaleSpec =
  /** 單一色相由淺到深，thresholds 為 N 個門檻 → N+1 級（最多 7 級） */
  | { type: 'sequential'; thresholds: number[] }
  /** 兩色相 + 中性灰中點；thresholds 需對稱，中間那一級為中性色 */
  | { type: 'diverging'; thresholds: number[] };

export type LayerSpec =
  /** 面量圖：適合比率、密度、人均這類「已經除過」的數值 */
  | { kind: 'choropleth'; scale: ScaleSpec }
  /** 比例圓：適合總量（人口數、發電量），圓面積與數值成正比 */
  | { kind: 'bubble'; legendValues: number[] };

export interface IndicatorDef {
  id: string;
  label: string;
  /** 一句話說明這個指標，顯示在指標選單下方 */
  description: string;
  unit: string;
  /** 資料檔，相對於 data/topics/<topicId>/ */
  file: string;
  layer: LayerSpec;
  /** tooltip、側欄、排名表用的完整格式 */
  format: (value: number) => string;
  /** 圖例刻度用的精簡格式，預設同 format */
  formatTick?: (value: number) => string;
  /** 側欄折線圖是否加上「世界」作為對照線（總量類指標不適合） */
  compareWorld?: boolean;
  /** 是否顯示「占全球比例」（只對可加總的總量有意義） */
  shareOfWorld?: boolean;
}

export interface SourceDef {
  name: string;
  url: string;
  license: string;
}

export interface TopicDefinition {
  id: string;
  title: string;
  /** 主題選單上的短名稱 */
  shortTitle: string;
  sources: SourceDef[];
  indicators: IndicatorDef[];
  defaultIndicator: string;
  defaultYear: number;
}

/** pipeline 輸出的指標檔格式（見 pipeline/common.py indicator_file） */
export interface IndicatorData {
  indicator: string;
  unit: string;
  years: number[];
  /** 從這一年開始是推估值（例如 UN WPP 的未來推估） */
  projectionFrom?: number;
  /** 世界、區域等合計，key 例如 WLD */
  aggregates?: Record<string, (number | null)[]>;
  /** key 為 ISO alpha-3，陣列與 years 一一對應，缺值為 null */
  values: Record<string, (number | null)[]>;
}
