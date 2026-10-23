import type React from 'react';
import type { Localized, Text } from '../i18n/lang';
import type { Tokens } from '../theme/tokens';

export type { Text };

/**
 * 主題外掛的介面。新增主題 = 在 pipeline/topics/ 產生資料 + 在這裡寫一個 TopicDefinition。
 * 地圖引擎、圖例、時間軸、側欄、排名表都只依賴這份介面。
 *
 * 給人看的文字都是 Text（`{ zh: '總人口', en: 'Total population' }`，兩種語言相同時可以直接寫字串）。
 * App 依目前語言把整個主題解析成 Topic（所有 Text 換成字串），元件只拿 Topic / Indicator。
 * format / formatTick 在呼叫當下讀目前的語言：用 lib/format.ts 的函式，單位用 tr({ zh, en })。
 */

/** 面量圖的分級方式。分級門檻固定寫死，所有年份共用，拖動時間軸時顏色才能互相比較。 */
export type ScaleSpec =
  /** 單一色相由淺到深，thresholds 為 N 個門檻 → N+1 級（最多 7 級） */
  | { type: 'sequential'; thresholds: number[] }
  /** 兩色相 + 中性灰中點；thresholds 需對稱，中間那一級為中性色 */
  | { type: 'diverging'; thresholds: number[] };

export type LayerSpec =
  /**
   * 面量圖：適合比率、密度、人均這類「已經除過」的數值。
   * itemScales 是各子項目自己的分級門檻（例如各類食物的人均供給量差好幾倍），沒列的子項目用 scale。
   */
  | { kind: 'choropleth'; scale: ScaleSpec; itemScales?: Record<string, ScaleSpec> }
  /** 比例圓：適合總量（人口數、發電量），圓面積與數值成正比 */
  /** legendValues 為 'auto' 時依資料最大值自動挑（各農產品的量級差很多） */
  | { kind: 'bubble'; legendValues: number[] | 'auto' }
  /** 不依數值上色，只畫疊加圖層（例如鐵路與機場）；資料仍用於 tooltip 與排名 */
  | { kind: 'none' }
  /**
   * 類別圖：每個國家屬於一類（資料檔的數值是類別代碼），每一類一個顏色，圖例列出各類，沒有數值門檻。
   * 顏色不寫在主題裡：一般類別依序取 MAP_TOKENS.categorical；ordinal 為 true（類別有強弱之分，例如官方地位）
   * 時改用循序色，第一類最深。不在 categories 裡的代碼歸到 other（有給的話），否則當成無資料。
   * tooltip、排名表、側欄照常用 format(代碼) 顯示類別名稱。
   */
  | { kind: 'categorical'; categories: CategoryDef[]; other?: Text; ordinal?: boolean }
  /**
   * 流向圖：點選國家後，畫出它與主要夥伴之間的大圓弧線，線寬與金額成正比；國家本身不上色。
   * file 是流向檔（FlowFile），相對於 data/topics/<topicId>/，可含 `{item}` 與 `{year}`。
   * 指標檔本身放各國的總額，給 tooltip、排名表與側欄用。
   */
  | { kind: 'flow'; file: string; direction: FlowDirection };

export type FlowDirection = 'export' | 'import';

export interface CategoryDef {
  /** 資料檔裡的代碼 */
  value: number;
  label: Text;
}

/**
 * 流向檔：pipeline/topics/trade.py 輸出，一個商品、一年一個檔。
 * 每個國家是 [總額, [[夥伴, 金額], …]]，夥伴依金額由大到小、只留前幾名；總額含所有夥伴。
 */
export interface FlowFile {
  /** 商品（子項目）代碼 */
  item: string;
  year: number;
  /** 金額的單位，目前固定是「千美元」 */
  unit: string;
  export: Record<string, [number, [string, number][]]>;
  import: Record<string, [number, [string, number][]]>;
}

export interface IndicatorDef {
  id: string;
  label: Text;
  /** 一句話說明這個指標，顯示在指標選單下方 */
  description: Text;
  unit: Text;
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
  /**
   * 地圖可以從國家平均改成 1 km 網格（點陣圖磚，見 src/map/densityGrid.ts），控制列多一個切換。
   * dir 是 tiles/ 底下的資料夾，由 pipeline 產生（不進版本控制，部署時才有）。
   */
  grid?: { dir: string };
}

export interface SourceDef {
  name: Text;
  url: string;
  license: Text;
}

/** 子項目選擇器：例如農業主題的「農產品」 */
export interface DimensionDef {
  label: Text;
  options: { id: string; label: Text; group?: Text }[];
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
  /** 已依目前語言解析過的主題 */
  topic: Topic;
  iso3: string;
  year: number;
  /** 目前選的子項目（有 dimension 的主題才有） */
  item: string | null;
  countryName: string;
  tokens: Tokens;
}

export interface TopicDefinition {
  id: string;
  title: Text;
  /** 主題選單上的短名稱 */
  shortTitle: Text;
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
  boxEstimate?: { indicator: string; label: Text; grid: string };
  /** 顯示在頁尾的資料說明 */
  note?: Text;
  /** 疊加圖層（鐵路、機場），使用者可以在地圖上開關 */
  overlays?: OverlayDef[];
  /** 純地圖頁：不載入任何統計資料，不顯示指標、時間軸與資料側欄 */
  pure?: boolean;
}

/** 依目前語言解析過的主題與指標：所有 Text 都換成字串 */
export type Topic = Localized<TopicDefinition>;
export type Indicator = Localized<IndicatorDef>;

export function indicatorPath(
  topic: Pick<Topic, 'id' | 'dimension'>,
  indicator: Pick<Indicator, 'file'>,
  item: string | null,
): string {
  const file = indicator.file.replace('{item}', item ?? topic.dimension?.defaultOption ?? '');
  return `topics/${topic.id}/${file}`;
}

export function usesDimension(indicator: Pick<Indicator, 'file'>): boolean {
  return indicator.file.includes('{item}');
}

const itemScaleCache = new WeakMap<Indicator, Map<string, Indicator>>();

/**
 * 面量圖有 itemScales 時，換成目前子項目的分級門檻。
 * 同一個指標與子項目回傳同一個物件，地圖依 indicator 重算色階的 useMemo 才不會每次重畫。
 */
export function forItem(indicator: Indicator, item: string | null): Indicator {
  const layer = indicator.layer;
  const scale = layer.kind === 'choropleth' && item ? layer.itemScales?.[item] : undefined;
  if (!scale || layer.kind !== 'choropleth') return indicator;
  let byItem = itemScaleCache.get(indicator);
  if (!byItem) itemScaleCache.set(indicator, (byItem = new Map()));
  let resolved = byItem.get(item!);
  if (!resolved) byItem.set(item!, (resolved = { ...indicator, layer: { ...layer, scale } }));
  return resolved;
}

/** 流向圖指標的流向檔路徑；不是流向圖時回傳 null */
export function flowPath(
  topic: Pick<Topic, 'id' | 'dimension'>,
  indicator: Pick<Indicator, 'layer'>,
  item: string | null,
  year: number,
): string | null {
  if (indicator.layer.kind !== 'flow') return null;
  const file = indicator.layer.file
    .replace('{item}', item ?? topic.dimension?.defaultOption ?? '')
    .replace('{year}', String(year));
  return `topics/${topic.id}/${file}`;
}

/** pipeline 輸出的指標檔格式（見 pipeline/common.py indicator_file） */
export interface IndicatorData {
  indicator: string;
  unit: string;
  years: number[];
  /** 從這一年開始是推估值（例如 UN WPP 的未來推估） */
  projectionFrom?: number;
  /** 從這一年起換了統計方法，跟之前的年份不完全可比（例如 FAO 糧食平衡表 2010 年起的新方法）；折線圖畫一條垂直虛線 */
  methodBreak?: number;
  /** 世界、區域等合計，key 例如 WLD */
  aggregates?: Record<string, (number | null)[]>;
  /** key 為 ISO alpha-3，陣列與 years 一一對應，缺值為 null */
  values: Record<string, (number | null)[]>;
  /** 個別國家的資料附註，例如改用其他來源補上的國家 */
  notes?: Record<string, string>;
  /** notes 的英文版 */
  notesEn?: Record<string, string>;
  /**
   * 普查、調查年份零散的指標：某年沒有資料時，改用該國 latestWithin 年內最近一年的值，
   * 地圖、tooltip、排名表、側欄都會標出實際的資料年份（見 panels/stats.ts 的 latestAt）。
   * values 本身只放實際有的年份，歷年折線圖與「所有年份」的 CSV 不會出現補上的值。
   */
  latestWithin?: number;
}
