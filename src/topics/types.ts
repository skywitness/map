import type React from 'react';
import type { Tokens } from '../theme/tokens';

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
  /** legendValues 為 'auto' 時依資料最大值自動挑（各農產品的量級差很多） */
  | { kind: 'bubble'; legendValues: number[] | 'auto' }
  /** 不依數值上色，只畫疊加圖層（例如鐵路與機場）；資料仍用於 tooltip 與排名 */
  | { kind: 'none' };

export interface IndicatorDef {
  id: string;
  label: string;
  /** 一句話說明這個指標，顯示在指標選單下方 */
  description: string;
  unit: string;
  /**
   * 資料檔，相對於 data/topics/<topicId>/。
   * 含 `{item}` 的指標會跟著子項目切換，例如 'production/{item}.json'。
   */
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

/** 子項目選擇器：例如農業主題的「農產品」 */
export interface DimensionDef {
  label: string;
  options: { id: string; label: string; group?: string }[];
  defaultOption: string;
}

/** 疊加在地圖上的點、線圖層 */
export interface OverlayDef {
  id: 'railways' | 'airports';
  /** 相對於 data/topics/<topicId>/ */
  file: string;
}

/** 鐵路：每條線第一個點是量化後的絕對座標，之後是差分；乘上 quantum 得到經緯度 */
export interface RailwaysData {
  quantum: number;
  lines: number[][];
}

/** 機場：rows 的欄位順序見 fields（lon, lat, type, name, iata, city, iso3），type 1 為大型、2 為中型 */
export interface AirportsData {
  fields: string[];
  rows: [number, number, number, string, string, string, string][];
}

/** 主題自訂的側欄區塊，接在通用側欄下方 */
export interface PanelExtraProps {
  topic: TopicDefinition;
  iso3: string;
  year: number;
  /** 目前選的子項目（有 dimension 的主題才有） */
  item: string | null;
  countryName: string;
  tokens: Tokens;
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
  dimension?: DimensionDef;
  /**
   * 側欄的額外區塊。用動態 import，ECharts 等大型依賴才不會進到首頁的 bundle：
   * `panelExtra: () => import('./electricity-panel')`
   */
  panelExtra?: () => Promise<{ default: React.ComponentType<PanelExtraProps> }>;
  /**
   * 地圖框選：加總框內的網格人口估算框內的總量。indicator 必須是可加總的總量，
   * 網格只決定國內的分布，各國水準縮放到 indicator 當年的值。grid 是主題資料夾裡的網格檔。
   */
  boxEstimate?: { indicator: string; label: string; grid: string };
  /** 顯示在頁尾的資料說明 */
  note?: string;
  /** 疊加圖層（鐵路、機場），使用者可以在地圖上開關 */
  overlays?: OverlayDef[];
}

export function indicatorPath(topic: TopicDefinition, indicator: IndicatorDef, item: string | null): string {
  const file = indicator.file.replace('{item}', item ?? topic.dimension?.defaultOption ?? '');
  return `topics/${topic.id}/${file}`;
}

export function usesDimension(indicator: IndicatorDef): boolean {
  return indicator.file.includes('{item}');
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
  /** 個別國家的資料附註，例如改用其他來源補上的國家 */
  notes?: Record<string, string>;
}
