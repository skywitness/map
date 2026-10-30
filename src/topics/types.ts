import type React from 'react';
import type { Lang, Localized, Text } from '../i18n/lang';
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
  /**
   * 兩色相 + 中性灰中點；thresholds 需對稱，中間那一級為中性色。
   * 預設負值是橘、正值是青綠（人口減少橘、增加綠）；reverse 為 true 時反過來，正值是橘（例如暖化）
   */
  | { type: 'diverging'; thresholds: number[]; reverse?: boolean };

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
   * diverging 為 true（兩個方向的強弱，例如專制 ↔ 民主）時改用發散色：categories 從一端排到另一端，
   * 前一半是橘色、後一半是青綠，越靠兩端越深，奇數類的正中間是中性色。
   * tooltip、排名表、側欄照常用 format(代碼) 顯示類別名稱。
   * itemCategories 是各子項目自己的類別（2026-10-30 起，颱風的日本氣象廳 10 分鐘風速用中央氣象署的分級），
   * 沒列的子項目用 categories（跟面量圖的 itemScales 一樣在 forItem() 換）。
   */
  | {
      kind: 'categorical';
      categories: CategoryDef[];
      other?: Text;
      ordinal?: boolean;
      diverging?: boolean;
      itemCategories?: Record<string, CategoryDef[]>;
    }
  /**
   * 流向圖：點選國家後，畫出它與主要夥伴之間的大圓弧線，線寬與金額成正比；國家本身不上色。
   * file 是流向檔（FlowFile），相對於 data/topics/<topicId>/，可含 `{item}` 與 `{year}`。
   * 指標檔本身放各國的總額，給 tooltip、排名表與側欄用。
   * 文字（出口對象、進口來源…）預設是貿易的，其他主題（例如移民）用 labels、pickPartners、legendKey 自己給。
   */
  | FlowLayer
  /**
   * 地形圖：國家不上色，畫高程圖磚的分層設色與陰影（主題要設 terrain）；指標資料仍用於 tooltip 與排名。
   * 見 src/map/terrain.ts。
   */
  | { kind: 'terrain' }
  /**
   * 國旗地圖：每個國家塗上自己的國旗（src/map/flagTiles.ts 在瀏覽器裡畫點陣圖磚，小國畫成小國旗）。
   * file 是國旗檔（FlagsFile，相對於 data/topics/<topicId>/）；指標檔本身照常給 tooltip 與排名表用。
   */
  | { kind: 'flags'; file: string };

export type FlowDirection = 'export' | 'import';

export interface FlowLayer {
  kind: 'flow';
  file: string;
  /**
   * 'export'：選取的國家是起點（出口國、移民的來源國）；'import'：選取的國家是終點。
   * 'larger'：依選取國家兩個方向的總額，畫比較大的那一邊（例如難民：收容國畫來源、來源國畫去向）。
   */
  direction: FlowDirection | 'larger';
  /** 兩個方向各自的文字；沒給用貿易的「出口對象／進口來源」 */
  labels?: Record<FlowDirection, FlowLabels>;
  /** 還沒選國家時提示「點選國家，查看它的＿＿」；沒給用 direction 那個方向的 partners */
  pickPartners?: Text;
  /** 圖例上漸層樣本的說明；沒給用「由出口國（淺）到進口國（深）」 */
  legendKey?: Text;
  /**
   * 只有有沒有、沒有數量（2026-10-29 起，海外軍事基地：派駐國→駐在國，流向檔的值都是 1）：線一樣粗（FLOW_PRESENCE_WIDTH），
   * tooltip 只寫「美國在日本有軍事基地」、不寫數值與占比，圖例只畫一條線，說明是這段文字
   */
  presence?: Text;
}

/** 流向圖一個方向的文字 */
export interface FlowLabels {
  /** 夥伴的稱呼，用在提示「點選國家，查看它的出口對象」與「沒有 2023 年的出口對象資料」 */
  partners: Text;
  /** 側欄、匯出圖片的標題：「主要出口對象」 */
  main: Text;
  /** tooltip：(選取的國家, 夥伴) →「台灣出口到日本」，用 tr() 寫兩種語言 */
  verb: (origin: string, partner: string) => string;
}

export interface CategoryDef {
  /** 資料檔裡的代碼 */
  value: number;
  label: Text;
  /**
   * 這一類自己的顏色：類別本身就是顏色時用（國旗的主要顏色：紅色那一類畫紅色），其他類別圖不要用，
   * 一般的類別色要跟底圖、彼此分得開（見 categories.ts）。例外是 ordinal 類別圖裡不在強弱順序上的類別
   * （法定年齡的「禁止」「沒有規定」用灰色），有自己顏色的類別不占循序色階；另一個例外是超過 8 類、
   * 自己用配色驗證工具檢查過的配色（出生的季節的 12 個月：四季色系 × 深淺，2026-10-29）
   */
  color?: string;
  /** 代碼 value 到 max（含）都算這一類（2026-10-28 起）：例如「7–9 歲」一類，資料檔照樣寫實際的歲數 */
  max?: number;
}

/**
 * 流向檔：pipeline/topics/trade.py、migration.py 輸出，一個子項目、一年一個檔。
 * 每個國家是 [總額, [[夥伴, 金額], …]]，夥伴依金額由大到小、只留前幾名；總額含所有夥伴。
 */
export interface FlowFile {
  /** 商品（子項目）代碼 */
  item: string;
  year: number;
  /** 數值的單位，例如貿易的「千美元」、移民的「人」 */
  unit: string;
  /** 檔案裡的數值乘上 scale 是指標的單位（貿易：千美元 → 美元）；沒寫是 1000，舊的貿易檔沒有這個欄位 */
  scale?: number;
  /** 夥伴的第三個值是 1 時，這筆數量是估算的（石油、天然氣與煤：原始數量的單價明顯不對，改用金額 ÷ 中位數單價） */
  export: Record<string, [number, ([string, number] | [string, number, 1])[]]>;
  import: Record<string, [number, ([string, number] | [string, number, 1])[]]>;
  /** 個別組合的說明「起點>終點」→ [中文, 英文]（2026-10-29 起，海外軍事基地的克里米亞、北賽普勒斯…），tooltip 與側欄寫出來 */
  notes?: Record<string, [string, string]>;
}

/** 側欄折線圖上標的事件（events.ts） */
export interface ChartEvent {
  year: number;
  label: Text;
  /** 只標在這些國家的圖上；沒寫是每個國家都標 */
  countries?: string[];
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
  /**
   * tooltip、側欄、排名表用的完整格式。year 是這個值的年份（時間軸的年份、側欄折線圖上那一點的年份），
   * 值的意思跟年份有關的指標用：日食路徑的「下一次日全食」存的是還要幾年，format 用 year 寫出哪一年（2026-10-28 起）。
   * 呼叫的地方知道年份就傳；不知道時（圖例刻度以外的少數地方）不傳，format 要能只靠值寫出來
   */
  format: (value: number, year?: number) => string;
  /** 圖例刻度用的精簡格式，預設同 format */
  formatTick?: (value: number) => string;
  /** 側欄折線圖是否加上「世界」作為對照線（總量類指標不適合） */
  compareWorld?: boolean;
  /** 側欄折線圖的 y 軸不從 0 開始（例如身高都在 140–185 公分，從 0 畫起整條線是平的） */
  chartZoom?: boolean;
  /** 側欄折線圖上標的事件（COVID-19、金融海嘯、一胎化…，events.ts），年份不在圖上的不畫 */
  events?: ChartEvent[];
  /** 數值是整數（例如大樓的棟數）：側欄折線圖的 y 軸只用整數刻度，只有 1、2 棟時才不會寫成 0、1、1、2、2 */
  integer?: boolean;
  /** 是否顯示「占全球比例」（只對可加總的總量有意義） */
  shareOfWorld?: boolean;
  /** 數值越小越好（例如性別不平等指數）：排名表、側欄的名次與單一年份的 CSV 由小排到大，第 1 名是最小的 */
  lowerIsBetter?: boolean;
  /** 數值沒有好壞、名次沒有意義（例如跟台灣的時差）：排名表依數值排列但不寫名次，側欄也不寫名次 */
  unranked?: boolean;
  /** 排名表不畫長條：數值是年份這類，長短沒有意義（國旗的採用年份） */
  rankingBars?: false;
  /**
   * 側欄不畫這個指標的歷年圖（2026-10-28 起）：值是代碼、只給 tooltip 與排名表用的不上色指標（日食路徑那一年經過的類型），
   * 畫成折線沒有意義，主題自己的側欄區塊已經列出每一年
   */
  panelChart?: false;
  /**
   * 這個指標自己的子項目選擇器，取代主題的 dimension（同一個主題裡不同指標的子項目不同：國旗的「顏色」與「圖案」）。
   * 網址的子項目不在這份清單裡時用它的 defaultOption（itemFor()），換回原本的指標時網址的子項目還在
   */
  dimension?: DimensionDef;
  /**
   * 地圖可以從國家平均改成網格（點陣圖磚，見 src/map/densityGrid.ts），控制列多一個切換。
   * 例如人口密度的 1 km 網格、暖化的 0.5° 網格。
   */
  grid?: GridSpec;
  /**
   * 有 timeField 的疊加點（地震）要顯示哪些年份：'year' 只有時間軸那一年（預設），'cumulative' 從最早累積到那一年，
   * 數字 n 是那一年起的 n 年（每十年一筆的指標：1990 → 1990–1999）
   */
  overlayTime?: 'year' | 'cumulative' | number;
  /**
   * 資料檔有 projectionFrom 時，時間軸預設把之前的年份標「估計值」、之後標「推估值」。
   * 之後的年份不是推估、之前的也不是估計時（例如海底電纜：之前是已啟用的電纜，之後是規劃中的），
   * 用這個換掉之後的稱呼（tag）與刻度上的說明（from，在呼叫當下讀目前的語言，用 tr()），之前的年份不加標籤。
   */
  projectionLabel?: { tag: Text; from: (year: number) => string };
  /**
   * 時間軸的年份不是「那一年的資料」時（例如平均身高的出生年：1996 = 1996 年出生的人在 18 歲時的身高）：
   * label 寫在時間軸的年份上面（「出生年」），year(年) 取代 tooltip、側欄、排名表、匯出圖片標題裡的年份
   * （「1996 年出生」，在呼叫當下讀目前的語言，用 tr()）。同一個主題裡 label 不同的指標年份的意思不同：
   * 側欄只列 label 相同的數值卡片，從選單換到 label 不同的指標時年份回到預設（見 sameTimeAxis()）。
   */
  timeAxis?: {
    label: Text;
    year: (year: number) => string;
    /**
     * 時間軸上的刻度與目前的值的寫法（2026-10-29 起，各國在讀什麼：年份欄位存的是月份的編號，時間軸寫「2026/9」）；
     * 沒寫時寫數字本身
     */
    tick?: (year: number) => string;
  };
  /** 這個指標的預設年份（網址沒指定年份時），沒寫用主題的 defaultYear */
  defaultYear?: number;
  /** 換到這個指標時地圖移到這個範圍（同主題的 focus，2026-10-30 起，北極航道） */
  focus?: [number, number, number, number];
  /** 只有這個指標不隨時間變化（同主題的 timeless：沒有時間軸、標題不寫年份；2026-10-30 起，南極的冰下湖） */
  timeless?: boolean;
  /**
   * 只在這個指標沒有值的原因（key 是 ISO alpha-3），優先於主題的 noValue：
   * 例如「與美國的投票一致度」裡的美國自己（寫「比較的對象」，不寫「無資料」）
   */
  noValue?: Record<string, Text>;
  /**
   * 只收部分國家的指標（例如監禁人口率只收有開放授權資料的國家）：countries（ISO alpha-3）以外的國家
   * 一律寫 reason，取代「無資料」（排在 noValue 之後）；countries 裡的國家某一年沒有值時照常寫「無資料」
   */
  coverage?: { countries: readonly string[]; reason: Text };
  /**
   * 這個指標的值是 null 時一律寫這句，取代 tooltip、側欄的「無資料」與圖例灰色那一格的「無資料」（排在 noValue、coverage 之後）。
   * 值是算出來的、每個國家都有算，null 有固定意思的指標用：日食路徑的「下一次日全食」null 是「到 2100 年都沒有」
   */
  missing?: Text;
  /**
   * 各子項目自己的單位與格式（2026-10-28 起）：同一個指標在不同子項目的單位不同時用（石油、天然氣與煤的產量：
   * 石油千桶/日、天然氣十億立方公尺、煤百萬公噸）。forItem() 依目前的子項目換掉 unit、format、formatTick，
   * 沒列的子項目用指標本身的；側欄的數值卡片與折線圖也經過 forItem()
   */
  itemFormats?: Record<string, ItemFormat>;
  /**
   * 數值在瀏覽器裡算（時刻主題，TopicDefinition.clock）：file 是算的材料（例如各國首都的經緯度與時區），
   * values(材料, 時刻) 回傳指標檔的格式（IndicatorData，years 只有一個：at.day）。per 是數值跟著什麼變：
   * 'minute' 每一刻都不同（此刻的太陽高度：標題寫到分鐘）、'day' 只跟日期有關（白天長度：標題寫日期）、
   * 'fixed' 不隨時刻變（一年中白天最長與最短的差：標題不寫日期，跟 timeless 一樣）。
   * App 與側欄經過 lib/derive.ts 的 derivedData()，同一個指標、同一個時刻回傳同一個物件（有快取）。
   */
  derive?: {
    per: 'minute' | 'day' | 'fixed';
    /** live：主題的即時資料（TopicDefinition.live，此刻的極光的 OVATION 預報）；其他主題是 undefined */
    values: (source: unknown, at: ClockAt, live?: unknown) => IndicatorData;
  };
}

/**
 * 時刻主題的「現在選的這一刻」：time 是 UTC 毫秒，day 是那一刻在使用者的時區是哪一天（YYYYMMDD 的整數，
 * 例如 20260621）。時刻主題的 year 一律是 day（指標檔的 years、側欄、排名表拿到的年份）。
 */
export interface ClockAt {
  time: number;
  day: number;
}

/** 指標的網格圖層。文字沒寫的用人口密度 1 km 網格的預設（src/map/densityGrid.ts 的 GRID_TEXT） */
export interface GridSpec {
  /** tiles/ 底下的資料夾，由 pipeline 產生（不進版本控制，部署時才有） */
  dir: string;
  /** 切換鈕與標題上的名稱，預設「1 km 網格」 */
  label?: Text;
  /** 網格模式的地圖說明（也是匯出圖片的副標題） */
  subtitle?: Text;
  /** 圖例上這一期的說明（預設「2020 年網格 · 縮小時為範圍內平均」）；在呼叫當下讀目前的語言，用 tr() */
  epochNote?: (epoch: number, projected: boolean) => string;
  /** 網格圖例的單位，沒寫用指標的（航運密度：指標的資料檔是貨櫃吞吐量（TEU），網格是 AIS 船位） */
  unit?: Text;
  /** 圖例上取代「無資料」的說明：沒有上色的格子是什麼（預設「每 km² 不到 0.1 人（不上色）」） */
  empty?: Text;
  /**
   * 國家的值不是平均時，換掉切換鈕上的「國家平均」、tooltip 的「國家平均」與說明裡的 hover 提示
   * （網路速度：國家的值是中位數）
   */
  countryValue?: { label: Text; tooltip: Text; hoverHint: Text };
  /**
   * 預設就顯示網格（網址沒有 grid 參數時；從主題選單換到這個主題時也是）。網格是主角的指標用，
   * 例如夜間燈光；使用者切回國家平均時網址寫 grid=0
   */
  defaultOn?: boolean;
  /**
   * 只有網格、沒有國家平均可以切換（例如航運密度：海上的船位沒有「國家平均」）：一律畫網格，控制列沒有切換鈕，
   * tooltip 不寫「國家平均」。指標本身通常是 kind: 'none'，資料檔只給 tooltip 與排名表用
   */
  only?: boolean;
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
  /**
   * 子項目就是國家（option id 是 ISO alpha-3，例如護照與簽證的「護照」）：點地圖、排名表或搜尋選到國家時，
   * 子項目跟著換成那個國家，地圖改畫那國的資料（「日本護照到各國要不要簽證」）。
   * 網址只有 country、沒有 item 時（例如從別的主題切過來）也用選到的國家。
   */
  followsSelection?: boolean;
  /**
   * 子項目是國家時，那個國家在自己那份資料裡沒有值（自己的護照不用簽證、跟自己的投票一致度）：
   * tooltip 與側欄的數值卡片寫這句，不寫「無資料」。不必 followsSelection（聯合國投票的「比較對象」也用）
   */
  selfLabel?: Text;
}

/**
 * 某個國家在這個指標沒有值的原因，取代 tooltip 與側欄的「無資料」；沒有特別原因時回傳 undefined。
 * 依序：指標的 noValue（例如「與美國的一致度」裡的美國）→ 主題的 noValue → 子項目就是這個國家時的 selfLabel
 * → 不在指標 coverage 裡的國家（例如監禁人口率的「沒有開放授權的資料」）→ 指標的 missing（例如「到 2100 年都沒有日全食」）。
 */
export function missingReason(
  topic: Pick<Topic, 'noValue' | 'dimension'>,
  indicator: Pick<Indicator, 'noValue' | 'file' | 'coverage' | 'missing'>,
  item: string | null,
  iso3: string,
  data?: Pick<IndicatorData, 'noValue' | 'noValueEn'> | null,
  lang?: Lang,
): string | undefined {
  const self = item === iso3 && usesDimension(indicator) ? topic.dimension?.selfLabel : undefined;
  const outside = indicator.coverage && !indicator.coverage.countries.includes(iso3) ? indicator.coverage.reason : undefined;
  // 資料檔寫的原因（pipeline 依資料決定，例如飲食的咖啡、茶、可可的「數字不可靠」）
  const fromData = (lang === 'en' ? data?.noValueEn : data?.noValue)?.[iso3];
  return indicator.noValue?.[iso3] ?? topic.noValue?.[iso3] ?? self ?? fromData ?? outside ?? indicator.missing;
}

/**
 * 目前的子項目：網址指定的 → 跟著選取國家的子項目用選到的國家 → 預設。沒有子項目的主題是 null。
 * App 與第一個畫面的預先下載共用，兩邊拿到同一個檔。
 */
export function resolveItem(
  dimension: Pick<DimensionDef, 'options' | 'defaultOption' | 'followsSelection'> | undefined,
  wanted: string | null,
  selected: string | null,
): string | null {
  if (!dimension) return null;
  const has = (id: string | null) => id !== null && dimension.options.some((o) => o.id === id);
  if (has(wanted)) return wanted;
  if (dimension.followsSelection && has(selected)) return selected;
  return dimension.defaultOption;
}

/**
 * 疊加在地圖上的點、線圖層，左下角的「圖層」可以開關：
 * - 鐵路、機場（交通主題）有自己的資料格式與樣式
 * - 一般的點（PointsOverlayDef，例如地震、火山、駐外館處）與線（LinesOverlayDef，例如板塊邊界），樣式寫在主題裡
 */
export type OverlayDef =
  /** 鐵路、機場（交通主題）；indicators 同 OverlayBase：只在這些指標顯示 */
  | { id: 'railways' | 'airports'; kind?: undefined; file: string; indicators?: string[]; topic?: string }
  | PointsOverlayDef
  | LinesOverlayDef
  | NightOverlayDef
  | MoonOverlayDef
  | LiveGridOverlayDef
  | ClassGridOverlayDef
  | WindOverlayDef;

/**
 * 晝夜（時刻主題）：依目前的時刻畫出地球的夜半邊與晨昏蒙影（民用、航海、天文曙暮光一層一層變暗），
 * 加上太陽直射點。不讀資料檔，位置用 lib/solar.ts 算；地圖上是 WebGL 的自訂圖層（src/map/nightLayer.ts），
 * 地球儀的兩極、180° 經線都是同一張網格，沒有接縫。
 */
export interface NightOverlayDef {
  kind: 'night';
  id: string;
  label: Text;
  /** 太陽直射點在圖例上的名稱 */
  sunLabel: Text;
  /**
   * 夜半邊的燈光（2026-10-30 起，晝夜與季節）：經緯度對齊的 8 位元灰階 PNG（0 是沒有燈光、255 最亮），
   * 天黑（太陽在地平線下約 6° 以下）的地方疊上燈光色，白天的那一半不畫。file 是 data/ 底下的路徑，
   * bounds 是 [南, 北]（圖的上緣是北），label 是圖例上的名稱
   */
  lights?: { file: string; bounds: [number, number]; label: Text };
  hidden?: boolean;
  /** 只在這些指標顯示（指標 id）；沒寫就是所有指標 */
  indicators?: string[];
  items?: string[];
}

/**
 * 月亮（2026-10-29 起，晝夜與季節的「月亮」）：依目前的時刻畫出看得到月亮的半個地球（月亮在地平線上，淡淡的一層）
 * 與月下點（月亮在正頭頂的地方）。不讀資料檔，位置由主題的 position 算（晝夜與季節用 Astronomy Engine，
 * 套件只進那個主題的程式）；地圖上跟晝夜同一種自訂圖層（src/map/nightLayer.ts）。
 */
export interface MoonOverlayDef {
  kind: 'moon';
  id: string;
  label: Text;
  /** 圖例上「看得到月亮」那一格的名稱 */
  upLabel: Text;
  /** 圖例上邊界（月出月落的那一圈）的名稱 */
  edgeLabel: Text;
  /** 月下點在圖例上的名稱 */
  pointLabel: Text;
  /** 那一刻的月下點與「月亮在地平線上」的地心高度門檻（°，見 lib/moon.ts 的 SublunarPoint） */
  position: (time: number) => { lon: number; lat: number; horizon: number };
  hidden?: boolean;
  /** 只在這些指標顯示（指標 id）；沒寫就是所有指標 */
  indicators?: string[];
  items?: string[];
}

/**
 * 即時的全球網格（2026-10-29 起，此刻的極光）：主題的即時資料（TopicDefinition.live）換算成經緯度每 1° 一點的網格，
 * 地圖上是 WebGL 的自訂圖層（src/map/liveGridLayer.ts，跟晝夜圖層同一種做法：兩極、180° 經線沒有接縫），
 * 一個顏色、依數值調不透明度（數值越大越不透明）。不讀資料檔。
 */
export interface LiveGridOverlayDef {
  kind: 'liveGrid';
  id: string;
  label: Text;
  /**
   * 即時資料 → 網格的值：經度 −180–180°、緯度 −90–90° 每 1° 一點，依緯度、再依經度排列
   * （第 r 列第 c 個是緯度 r − 90、經度 c − 180，共 181 × 361 個）；沒有資料時回傳 null
   */
  values: (live: unknown) => Float32Array | null;
  /** 顏色：淺色、深色底圖 */
  color: { light: string; dark: string };
  /** 數值到不透明度：低於 stops[0][0] 不畫，之間線性內插 */
  opacity: [number, number][];
  /** 圖例：標題與幾格（值與名稱） */
  legend: { title: Text; rows: { value: number; label: Text }[] };
  hidden?: boolean;
  indicators?: string[];
  items?: string[];
}

/**
 * 類別網格（2026-10-29 起，氣候分區）：經緯度對齊的全球網格，每格一個類別代碼（例如柯本的 30 種氣候類型），依代碼上色。
 * 資料檔是 pipeline 寫的 8 位元灰階 PNG（不濾波；像素值是代碼，0 不畫；第一列是北緯 90°、第一行是西經 180°），
 * 瀏覽器裡解開（src/map/classGridLayer.ts 的 loadClassGrid），地圖上是 WebGL 的自訂圖層，用資料的原始解析度取樣
 * （最近鄰，格子維持方塊；兩極、180° 經線沒有接縫）。圖例是分組的小色塊（短名稱，滑過看全名）
 */
export interface ClassGridOverlayDef {
  kind: 'classGrid';
  id: string;
  label: Text;
  /** 資料檔（相對於這個主題的資料夾），依時間軸的年份與子項目 */
  file: (year: number, item: string | null) => string;
  /** 代碼、顏色、圖例上的短名稱（例如 Cfa）與全名；group 是 groups 的索引 */
  classes: { value: number; color: string; short: string | Text; label: Text; group: number }[];
  /** 圖例的分組標題（例如 A 熱帶） */
  groups: Text[];
  /** 不透明度，預設 0.85 */
  opacity?: number;
  /** 網格只涵蓋這個範圍 [西, 南, 東, 北]（2026-10-30 起，油棕園：熱帶的 4096 × 640）；沒寫是全球 */
  bounds?: [number, number, number, number];
  /**
   * 依時間軸只畫代碼不大於 upTo(年) 的格子（2026-10-30 起，油棕園：代碼是種下去的年份，播放就是擴張）。
   * 只換調色盤，不必每年一張網格
   */
  upTo?: (year: number) => number;
  hidden?: boolean;
  indicators?: string[];
  items?: string[];
}

/**
 * 風的粒子動畫（2026-10-29 起，風與季風）：資料檔是 pipeline 內插到經緯度網格的風場（u、v，`map/windLayer.ts` 的
 * WindFieldFile），地圖上是 WebGL 的自訂圖層（src/map/windLayer.ts）：幾千個粒子順著風移動、留下漸淡的尾巴。
 */
export interface WindOverlayDef {
  kind: 'wind';
  id: string;
  label: Text;
  /** 資料檔（相對於這個主題的資料夾），依時間軸的年份與子項目 */
  file: (year: number, item: string | null) => string;
  /** 粒子的顏色：淺色、深色底圖 */
  color: { light: string; dark: string };
  /** 圖例裡的說明（例如「粒子順著風移動，越快走得越快」） */
  legend: Text;
  hidden?: boolean;
  indicators?: string[];
  items?: string[];
}

/** 一般疊加圖層共用的欄位 */
interface OverlayBase {
  /** 主題內唯一：圖層開關、MapLibre 圖層 id（`ov-<id>`）用 */
  id: string;
  /**
   * 資料檔，相對於 data/topics/<topicId>/（有 topic 時是那個主題的資料夾）。
   * 含 `{item}` 時換成目前的子項目（例如便利商店與連鎖品牌的 'points/{item}.json'：一個品牌一個檔，只下載選到的品牌）
   */
  file: string;
  /** 資料檔屬於另一個主題（例如發電量主題借用發電廠地圖的電廠點）；沒寫就是這個主題 */
  topic?: string;
  /** 圖層開關上的名稱 */
  label: Text;
  /** 預設關閉；關閉時不下載資料檔，第一次打開才下載 */
  hidden?: boolean;
  /** 只在這些指標顯示（指標 id）；沒寫就是所有指標 */
  indicators?: string[];
  /** 只在這些子項目顯示（dimension 的選項 id，例如奧運的夏季、冬季）；沒寫就是所有子項目 */
  items?: string[];
  /**
   * 共用疊加圖層（shared-layers.ts，2026-10-30）：疊在別的主題時依自己的方式跟時間軸（例如地震累積到那一年），
   * 取代目前指標的 overlayTime
   */
  overlayTime?: IndicatorDef['overlayTime'];
  /** 共用疊加圖層：資料有的年份範圍，時間軸超出時用最接近的一年（颱風 1950–2026，時間軸在 2030 年時畫 2026 年） */
  timeRange?: [number, number];
}

/** 依數值欄位分級的顏色：thresholds N 個 → classes N+1 個（由小到大），顏色取自 MAP_TOKENS */
export interface ColorClasses {
  field: string;
  /** 圖例標題，例如「震源深度」 */
  title: Text;
  thresholds: number[];
  classes: { color: string; label: Text }[];
}

/**
 * 一般的點圖層（資料檔是 PointsData）。
 * 每個點的欄位由 decodePoints() 還原成 PointRecord；有 iso3 欄位的點，點一下會選取那個國家。
 */
export interface PointsOverlayDef extends OverlayBase {
  kind: 'points';
  /**
   * 點來自主題的即時資料（2026-10-29 起，此刻世界的新聞熱點）：不讀資料檔（file 寫 ''），
   * 每次讀到新的即時資料就用它算出點；還沒讀到時回傳 null
   */
  fromLive?: (live: unknown) => PointRecord[] | null;
  /** 圓點或三角形（火山）；預設圓點 */
  shape?: 'circle' | 'triangle';
  /**
   * 圓點的樣式（2026-10-30 起，發電廠的狀態）：'hollow' 空心粗框（淡淡的底色）、'faint' 空心細框、
   * 'muted' 灰色實心（顏色分級不畫，只看大小）；沒寫是一般的實心圓點加白框
   */
  look?: 'hollow' | 'faint' | 'muted';
  /** 半徑（px，縮放 2 的大小，放大時跟著變大）：固定值，或依數值欄位線性內插 [[值, 半徑], …] */
  radius: number | { field: string; stops: [number, number][] };
  /** 顏色：固定色，或依數值欄位分級 */
  color: string | ColorClasses;
  /** 依這個欄位由小到大畫，大的疊在上面（例如規模） */
  sortField?: string;
  /** 年份欄位：依時間軸篩選要顯示的點，篩選方式看指標的 overlayTime */
  timeField?: string;
  /**
   * 結束年份欄位（例如大樓拆除、毀損的年份）：overlayTime 是 'cumulative' 時，這一年（含）以後不畫；
   * 沒有這個欄位的點一直畫。跟 timeField 一起用
   */
  endField?: string;
  /**
   * 跟著時間軸變的數值（例如城市每 5 年一期的人口與面積）：years 是資料的各期，時間軸的年份換成不晚於它的最近一期
   * （比第一期早時用第一期，`overlayEpoch()`），values(紀錄, 期) 算出這一期的欄位（例如 { pop: 那一期的人口 }），
   * radius、color、sortField、minValue 可以用這些欄位；值是 null 的欄位不放（例如還不是城市的期沒有人口，minValue 會把它篩掉）。
   * 換到另一期時才重算、重送資料。
   */
  epochs?: { years: number[]; values: (p: PointRecord, epoch: number) => Record<string, number | null> };
  /**
   * 換到另一期時地圖移過去（2026-10-30 起，奧運場館：換屆時框住那一屆的場館）：框住這一期畫得出來的點
   * （epochs 算出的 minValue 欄位不是 null 的）。點分散時只框離中位數 core 度以內的那一群（主辦城市；足球分散在別的城市的不算），
   * 那一群不到一半時框全部。maxZoom 是最多放大到幾級。要有 epochs 與 minValue
   */
  fitOnEpoch?: { core: number; maxZoom: number };
  /**
   * 依縮放篩選：縮小時只畫數值大的點（例如世界全圖只畫 100 萬人以上的城市），stops 是 [縮放級數, 最小值]，
   * 由小到大，第一個的級數是 0。用 MapLibre 的 filter（['zoom'] 在 filter 裡是圖磚的整數級數），跟時間篩選合併；
   * 沒有這個欄位的點不畫。
   */
  minValue?: { field: string; stops: [number, number][] };
  /**
   * 放大到這個縮放級數才畫（MapLibre 圖層的 minzoom），例如上萬家便利商店縮小時會糊成一片、蓋住面量圖。
   * 跟 minValue 不同，所有點都一樣，不必每個點多一個欄位
   */
  minZoom?: number;
  /** 圖層開關下面的大小圖例（例如規模 6、7、8 各畫一個圓），values 是 radius.field 的值 */
  sizeLegend?: { title: Text; values: number[]; format: (v: number) => string };
  /**
   * 點旁邊寫的文字（2026-10-29 起，各國在讀什麼：那個月讀最多的條目名稱）：回傳空字串不寫。
   * 彼此碰到時只留一個（有 sortField 時留數值大的），在呼叫當下讀目前的語言（tr()、getLang()）
   */
  pointLabel?: (p: PointRecord) => string;
  /**
   * tooltip：title 是第一行（粗體），detail 是第二行。
   * countryName 由 App 提供（目前語言的國名），原文專有名詞（地名、館處英文名）可以放在 properNoun，畫面上不翻譯。
   * year 是時間軸的年份（有 epochs 的圖層用 overlayEpoch() 換成那一期）；item 是目前的子項目（例如店家的品牌）。
   * extra 是 detail 下面另外幾行（例如港口的班輪航運連結指數、貨櫃吞吐量），一個字串一行。
   */
  tooltip: (
    p: PointRecord,
    ctx: { countryName: (iso3: string) => string; year: number; item: string | null },
  ) => PointTooltip;
}

/** 有 epochs 的點圖層：時間軸的年份對到哪一期（不晚於這一年的最近一期；比第一期早時用第一期）；沒有 epochs 是 null */
export function overlayEpoch(def: { epochs?: { years: number[] } }, year: number): number | null {
  const years = def.epochs?.years;
  if (!years?.length) return null;
  let epoch = years[0];
  for (const y of years) if (y <= year) epoch = y;
  return epoch;
}

/** 一般的線圖層（資料檔是 LinesData），例如板塊邊界、海底電纜 */
export interface LinesOverlayDef extends OverlayBase {
  kind: 'lines';
  /**
   * 線不是網站的資料檔，是使用者在這個瀏覽器匯入的（2026-10-30 起，我的路線：lib/personalRoutes.ts）：
   * file 不用，App 把解析好的線交給 useOverlays
   */
  local?: boolean;
  /**
   * 線寬（px，縮放 2 時）：固定值，或依紀錄的數值欄位在 stops [[值, 線寬], …] 之間線性內插
   * （例如河流依平均流量，stops 依對數間隔取，看起來就是依流量的對數變粗）
   */
  width: number | { field: string; stops: [number, number][] };
  /**
   * 線寬隨縮放的倍數 [[縮放, 倍數], …]（線性內插），取代預設的 zoomed()（縮放 0 是 0.7 倍、6 是 1.6 倍、10 是 2.4 倍）。
   * 河流放大到一個國家的大小時要比預設粗，才不會跟底圖的道路混在一起
   */
  widthZoom?: [number, number][];
  /**
   * 滑過時一起標出的組別：紀錄的這個欄位相同的線是同一組（例如同一個河流系統的幹流與所有支流）。
   * 沒寫時紀錄完全相同的線是同一組（同一條電纜被切成的好幾段）
   */
  groupField?: string;
  /**
   * 依縮放篩選（跟點圖層的 minValue 一樣）：紀錄的 field 要大於等於這一級的門檻，stops 是 [縮放級數, 最小值]，
   * 由小到大，第一個的級數是 0。例如縮小時只畫大河、放大後小河才出現
   */
  minValue?: { field: string; stops: [number, number][] };
  /** 放大到這個範圍時淡出 [開始, 完全不見]（例如底圖本身有更精細的河道時） */
  fadeOut?: [number, number];
  /**
   * 滑過時標出的那一組線下面墊一圈光暈（淺色底圖深色、深色底圖白色），一整個河流系統跟旁邊同色的線才分得開
   */
  hoverHalo?: boolean;
  /**
   * 放大才下載的細節：資料檔的 detail 列出分區的檔案與範圍，地圖放大到 minZoom 以上時，下載跟畫面重疊的分區，
   * 併進同一個圖層（同一組 tooltip、組別與篩選）。已經下載的分區留著，移回去不必再下載
   */
  detail?: { minZoom: number };
  /** 圖層開關下面的線寬圖例（width 依欄位變化時），values 是 width.field 的值 */
  sizeLegend?: { title: Text; values: number[]; format: (v: number) => string };
  /**
   * 封閉的環畫成半透明的面（2026-10-28 起，日食路徑的本影帶）：紀錄的 field 欄位是 value 的線是封閉的環（第一點等於最後一點），
   * 另外畫一層面 `ov-<id>-fill`（在線的下面，顏色跟線一樣依分類，不透明度 opacity、深色底圖 darkOpacity），
   * 外框照樣由線的圖層畫（MapLibre 的線圖層畫多邊形的外框）。滑過或側欄標出這一組時，那一組的面加深（`ov-<id>-hover-fill`）。
   * 面本身不給 hover 查詢：路徑裡面還是滑得到國家（線的查詢層照舊）
   */
  fill?: {
    field: string;
    value: number;
    opacity: number;
    darkOpacity?: number;
    /**
     * 洞（2026-10-28 起，地球的另一邊）：紀錄的這個欄位是 1 的環是前一個外環的洞（翻過去的陸地裡挖掉的湖、
     * 陸地對陸地的那幾塊）。沒寫時每個環各自是一個面
     */
    holeField?: string;
    /**
     * 哪些環另外做成外框的線（2026-10-28 起）：false 都不做、代碼的清單只做這幾類；沒寫是全部（日食的路徑環）。
     * 地球的另一邊的面是陸地切出來的，外框是另外的海岸線，只有側欄標出一國時的那一類要外框
     */
    outline?: false | number[];
    /** 依分類代碼的不透明度 { 代碼: [淺色底圖, 深色底圖] }，沒列的用 opacity、darkOpacity（2026-10-28 起） */
    typeOpacity?: Record<number, [number, number]>;
    /**
     * 面本身也給 hover 查詢（2026-10-29 起，山脈）：滑到面裡面就出現那一組的 tooltip、加深那一組，不必剛好滑到外框；
     * 面底下的國家滑不到（點一下照樣選國家）。要有 tooltip
     */
    hover?: boolean;
  };
  /** 線的不透明度，取代預設的淺色底圖 0.8、深色底圖 0.9（日食其他年份的中心線畫得很淡，2026-10-28 起） */
  opacity?: number;
  /**
   * 只畫這些分類代碼的線（color.classes 的 value），圖例也只列這幾類（2026-10-28 起）：同一個資料檔給不同指標用，
   * 例如日全食次數只畫日全食與混合食的中心線
   */
  onlyTypes?: number[];
  /**
   * 固定色，或依分類代碼上色（value 對應代碼），dash 畫虛線。
   * 代碼是 LinesData.types（一條線一個），或 LinesData.vertexTypes（每個頂點一個，例如颱風每個時間點的強度）：
   * 有 vertexTypes 時一條線依代碼切成好幾段，每段的顏色是那段起點的代碼。
   */
  color:
    | string
    | {
        title?: Text;
        /**
         * dark：深色底圖上改用的顏色（同一個色相比較亮的那一階，例如河流的紫 → 淡紫）。沒寫的照原色，
         * 中性的深灰自動換成淺灰
         */
        /**
         * area：這一類是面（有 fill 的圖層），圖例畫成半透明的色塊（不是帶子），墊在它在地圖上疊著的底色上：
         * 'land' 陸地、'sea' 海（2026-10-28 起，地球的另一邊）
         */
        classes: { value: number; color: string; dark?: string; label: Text; dash?: boolean; area?: 'land' | 'sea' }[];
      };
  /**
   * 年份欄位（LinesData.records 裡的欄位）：依時間軸篩選要顯示的線，篩選方式看指標的 overlayTime（跟點圖層一樣）。
   * 例如海底電纜的啟用年份、颱風生成的年份。
   */
  timeField?: string;
  /**
   * 結束年份欄位（2026-10-29 起，帝國與疆界：那個範圍的最後一年的下一年）：跟點圖層的 endField 一樣，
   * overlayTime 是 'cumulative' 時這一年（含）以後不畫；沒有這個欄位的線一直畫
   */
  endField?: string;
  /**
   * false：圖例不列顏色的分類（2026-10-29 起，帝國與疆界：10 種顏色只是讓相鄰的政體分得開，沒有意義）；
   * 開關那一列的符號照常用第一類的顏色
   */
  keyClasses?: false;
  /** 代碼大的畫在上面（例如颱風路徑強的那段疊在弱的上面） */
  sortByType?: boolean;
  /**
   * 線下面墊一條細邊：淺色底圖用深色、深色底圖用白色。颱風路徑最淺的幾級在藍色的海上、最深的幾級在深色底圖上
   * 都不容易看清楚，墊了邊才分得出來。
   */
  casing?: boolean;
  /**
   * 沿著線寫的文字（例如「北回歸線」）：回傳那條線要寫的字（空字串不寫），每隔一段距離重複一次，
   * 放大到哪裡都看得到。顏色跟線一樣、加一圈底圖色的光暈；字型用底圖的地名字型
   */
  lineLabel?: (p: PointRecord) => string;
  /**
   * 滑到線上時的 tooltip（要有 LinesData.records）：p 是那條線的紀錄。有 tooltip 的線可以 hover，
   * 滑過時整條線（紀錄完全相同的所有段，例如同一條電纜的各段）加粗標出。
   */
  tooltip?: (
    p: PointRecord,
    ctx: { countryName: (iso3: string) => string; year: number; item: string | null },
  ) => PointTooltip;
}

/** 點（或線）的 tooltip：title 粗體、detail 第二行、extra 另外幾行、properNoun 是不翻譯的原文名稱（最後一行） */
export interface PointTooltip {
  title: string;
  detail?: string;
  extra?: string[];
  properNoun?: string;
}

/** decodePoints() 還原後的一個點：數值欄位是數字，字串欄位是字串，缺值為 null */
export type PointRecord = Record<string, number | string | null>;

/**
 * 一般點圖層的資料檔（pipeline/common.py 的 points_file()）：欄位分開存（columnar）。
 * - 數值欄位存量化後的整數，乘上 scale[欄位] 還原；沒有 scale 的欄位是字串（或 null）
 * - delta 列出的欄位存跟前一個非 null 值的差（依檔案順序累加），排序過的欄位（年份、經度）差分後很小
 */
export interface PointsData {
  fields: string[];
  scale: Record<string, number>;
  delta: string[];
  /** 跟 fields 一一對應，每一欄的長度都是點的數量 */
  columns: (number | string | null)[][];
  /**
   * 字串表（選填）：strings 裡列出的欄位存的是這個表的索引（0 是沒有值），重複很多次的名稱只存一次
   * （例如河流的名稱：同一條河切成好幾段）
   */
  strings?: { fields: string[]; table: string[] };
}

/**
 * 一般線圖層的資料檔（pipeline/common.py 的 lines_file()）：跟鐵路同一種差分編碼。
 * - types（選填）：每條線的分類代碼
 * - vertexTypes（選填）：每條線每個頂點的分類代碼，一個字元一個頂點（36 進位的 0–9、a–z），長度等於那條線的頂點數
 * - records（選填）：每條線一筆紀錄（欄位分開存，格式同 PointsData），第 i 條線對應第 i 筆；tooltip 與時間篩選用
 */
export interface LinesData {
  quantum: number;
  lines: number[][];
  types?: number[];
  vertexTypes?: string[];
  records?: PointsData;
  /**
   * 放大才下載的分區（LinesOverlayDef.detail）：file 是分區檔的路徑（相對於這個主題的資料夾，含 `{tile}`），
   * tiles 是每個分區的 [id, 西, 南, 東, 北]（分區裡所有線的實際範圍，可能超出 ±180°）
   */
  detail?: { file: string; tiles: [string, number, number, number, number][] };
  /**
   * 很多條線共用的資料只存一次（例如同一個河流系統的名稱、流入的海、長度）：records 裡 field 欄位的值跟線的紀錄
   * 同一個欄位相同的那一筆，decodeLines() 把它的欄位併進每條線的紀錄（每個檔只放自己用到的）
   */
  groups?: { field: string; records: PointsData };
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
  /** 目前的指標（年份的意思可能跟著指標變，見 IndicatorDef.timeAxis） */
  indicator: Indicator;
  iso3: string;
  year: number;
  /** 目前選的子項目（有 dimension 的主題才有） */
  item: string | null;
  countryName: string;
  tokens: Tokens;
  /**
   * 在地圖上標出線圖層的一組線（跟滑過一樣，例如側欄滑到某條河時標出整個河流系統）；group 是 null 時取消。
   * overlay 是疊加圖層的 id，group 是 groupField 的值
   */
  highlightLine?: (overlay: string, group: number | null) => void;
  /** 把地圖移到這個範圍 [西, 南, 東, 北]（經緯度） */
  focusBox?: (box: [number, number, number, number]) => void;
  /** 把時間軸換到這一年（側欄點某一次日食：換到那一年、標出路徑、移過去，2026-10-28 起） */
  selectYear?: (year: number) => void;
  /** 時刻主題（TopicDefinition.clock）目前選的這一刻 */
  at?: ClockAt;
  /** 主題的即時資料（TopicDefinition.live，2026-10-29 起）；還沒讀到是 null，其他主題是 undefined */
  live?: unknown;
  /**
   * 在地圖上放幾個標記（2026-10-28 起，地球的另一邊：首都與它的對蹠點）；null 時拿掉。
   * 換國家、換主題時 App 會拿掉，側欄不必自己清
   */
  setMarks?: (marks: MapMark[] | null) => void;
}

/**
 * 側欄放在地圖上的標記（PanelExtraProps.setMarks）：圓點加名稱。link 是另一個標記的索引：點一下這個標記，
 * 地圖移到那一個（首都 ↔ 它的對蹠點，在地球儀上通常在背面）
 */
/** 清單側欄的設定（TopicDefinition.listPanel） */
export interface ListPanelDef {
  /** 側欄的標題（例如「賽程」） */
  label: Text;
  /** 只在這些指標顯示；沒寫是所有指標 */
  indicators?: string[];
  /** 點的資料檔（PointsData），相對於這個主題的資料夾，可以含 {item} */
  file: string;
  /**
   * 點 → 清單的每一列（已經排好）。在呼叫當下讀目前的語言（tr()）；year 是時間軸的年份，item 是目前的子項目
   */
  rows: (points: PointRecord[], ctx: { countryName: (iso3: string) => string; year: number; item: string | null }) => ListRow[];
  /** 沒有任何一列時的說明 */
  empty?: Text;
}

/** 清單側欄的一列 */
export interface ListRow {
  key: string;
  /** 第一行（粗體） */
  title: string;
  /** 第二行起（日期、地點…），一個字串一行 */
  lines?: string[];
  /** 不翻譯的原文名稱（另起一行，translate="no"） */
  properNoun?: string;
  /** 淡一點（例如已經比完的） */
  muted?: boolean;
  /** 標題旁的小標籤（例如「下一站」）；有標籤的第一列，打開時捲到它 */
  badge?: string;
  /** 點了移過去：一個點（放大到 zoom，預設 11）或一個範圍 [西, 南, 東, 北] */
  target: { lon: number; lat: number; zoom?: number } | { box: [number, number, number, number] };
  /** 點了在地圖上標出的位置（沒寫時用 target 的點；範圍不標） */
  mark?: { lon: number; lat: number };
  /** 點了把時間軸換到這一年（例如每月賽程換到那一站的月份） */
  year?: number;
}

export interface MapMark {
  lon: number;
  lat: number;
  label: string;
  /** 'here' 實心、'there' 空心（對蹠點） */
  kind: 'here' | 'there';
  link?: number;
}

/**
 * 滑到地圖上任一點時主題另外給的資訊（TopicDefinition.pointer）：title 是游標不在國家上（海上）時 tooltip 的第一行，
 * lines 是接在後面的幾行（在國家上時接在國家的 tooltip 下面），mark 是地圖上跟著游標動的小記號（對蹠點）
 */
export interface PointerInfo {
  title?: string;
  lines: string[];
  mark?: [number, number] | null;
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
   * 舊網址的指標 id → 現在的指標（與子項目）：指標改名或併進子項目後，舊的分享連結照樣打開同一份資料，
   * 網址也換成新的寫法（resolveAlias()）。例如氣候主題原本只有二氧化碳的 co2-per-capita，
   * 現在是「人均排放」選二氧化碳（{ indicator: 'ghg-per-capita', item: 'co2' }）
   */
  indicatorAliases?: Record<string, { indicator: string; item?: string }>;
  /**
   * 側欄的額外區塊。用動態 import，各主題側欄的程式才不會進到首頁的 bundle：
   * `panelExtra: () => import('./electricity-panel')`
   */
  panelExtra?: () => Promise<{ default: React.ComponentType<PanelExtraProps> }>;
  /**
   * 清單側欄（2026-10-30 起，賽車的賽程）：地圖左邊列出主題的點（依日期或名稱排），點一列地圖移到那裡並標出來。
   * 桌機在地圖左邊、可以收成一條窄邊；窄螢幕在地圖下面、預設收起來（收合記在版面偏好，lib/layoutPrefs.ts 的 list）。
   * 程式在 panels/ListSide.tsx，任何有點的清單（節慶、日食、奧運場館…）都可以套用
   */
  listPanel?: ListPanelDef;
  /**
   * 我的路線（2026-10-30 起，賽車）：圖層選單多一區，使用者可以匯入自己下載的路線檔（GPX、KML、KMZ、GeoJSON、zip，
   * 一次很多個或一整個資料夾），只存在這個瀏覽器（lib/personalRoutes.ts），畫成一個線圖層。
   * color 跟線圖層一樣（分類代碼由 type 算，沒有分類的用 0），seriesLabel 是 tooltip 上的分類名稱；
   * forItem 決定選了某個子項目時畫哪些路線（2026-10-31 起，賽車選了某個賽事只畫那個賽事的），沒有就全部都畫
   */
  personalRoutes?: {
    color: LinesOverlayDef['color'];
    type?: (series: string | undefined) => number;
    seriesLabel?: (series: string) => Text | undefined;
    forItem?: (series: string | undefined, item: string | null) => boolean;
  };
  /**
   * 地圖框選：加總框內的網格人口估算框內的總量。indicator 必須是可加總的總量，
   * 網格只決定國內的分布，各國水準縮放到 indicator 當年的值。grid 是主題資料夾裡的網格檔。
   */
  boxEstimate?: { indicator: string; label: Text; grid: string };
  /** 顯示在頁尾的資料說明 */
  note?: Text;
  /** 疊加圖層（鐵路、機場、地震、火山、板塊邊界…），使用者可以在地圖上開關 */
  overlays?: OverlayDef[];
  /** 純地圖頁：不載入任何統計資料，不顯示指標、時間軸與資料側欄 */
  pure?: boolean;
  /**
   * 地形圖層（AWS Terrain Tiles）：kind 為 'terrain' 的指標畫分層設色與陰影，面量圖上疊一層地形陰影
   * （左下角可以開關），3D 模式改成真的立體地形（不畫立體國家與柱子）。
   */
  terrain?: boolean;
  /**
   * 只留海的底圖（2026-10-29 起，板塊漂移）：今天的陸地、地名、國界與國家的 hover、點選都拿掉，整個地球是海的顏色，
   * 只畫主題的疊加圖層。國家要用搜尋選；滑過的資訊由 pointer 給（游標下是哪一國過去的位置）
   */
  bareMap?: boolean;
  /** 資料不隨時間變化（例如海拔）：不顯示時間軸，tooltip、側欄、標題也不寫年份 */
  timeless?: boolean;
  /**
   * 時刻主題（晝夜與季節）：時間不是年份，是某一刻（日期加時間）。控制列下面換成時刻的控制
   * （controls/MomentControl.tsx：日期、一天裡的時間、「現在」、播放一天或一年），網址是 time=2026-06-21T0400Z，
   * 沒有 time 時是現在（每分鐘更新）。指標的值用 derive 在瀏覽器裡算，year 是那一刻的日期（ClockAt.day）
   */
  clock?: boolean;
  /**
   * 即時資料（2026-10-29 起，此刻的極光）：瀏覽器直接讀外部的網址（要允許跨網域讀取），每 minutes 分鐘重讀一次。
   * 資料交給在瀏覽器裡算的指標（derive 的第三個參數）與即時的網格圖層（LiveGridOverlayDef）；
   * time 是資料的時刻（UTC 毫秒），當成時刻主題的「這一刻」：標題寫到分鐘、晝夜圖層依它畫。沒有時間軸，也不能選別的時刻
   */
  live?: {
    url: string;
    minutes: number;
    time: (data: unknown) => number | null;
    /**
     * 自己讀（2026-10-29 起，此刻世界的新聞熱點：先讀 lastupdate.txt 找到最新的檔，再讀 zip、解壓、解析）；
     * 沒寫是 fetch(url) 的 JSON。讀不到要丟出錯誤，跟 fetch 失敗一樣處理（留著上一份，下一輪再試）
     */
    load?: (url: string) => Promise<unknown>;
  };
  /**
   * tooltip 在數值與國名下面另外加的幾行（一個字串一行，跟 hints 一樣是 .tt-hint）：滑過時才算，
   * 例如晝夜與季節的「以首都台北計算：日出 05:05、日落 18:46」。at 是時刻主題目前的這一刻，其他主題是 null；
   * source 是目前指標的資料檔（在瀏覽器裡算的指標是算的材料，例如各國首都的經緯度）
   */
  tooltipLines?: (
    iso3: string,
    /** countryName：目前語言的國名（2026-10-28 起，地球的另一邊寫對蹠點落在哪些國家） */
    ctx: {
      indicator: string;
      at: ClockAt | null;
      item: string | null;
      source: unknown;
      countryName: (iso3: string) => string;
      /** 時間軸的年份（2026-10-29 起，各國在讀什麼：那個月讀最多的條目） */
      year?: number;
    },
  ) => string[];
  /**
   * 滑到地圖上任何一點（含海上）時的資訊（2026-10-28 起，地球的另一邊：游標的對蹠點在哪一國或哪一片海）。
   * lngLat 是游標的經緯度、iso3 是游標底下的國家（海上是 null）；countryAt 查任一經緯度在哪一國
   * （地圖的 1:50m 國界，不在畫面上的地方也查得到）。回傳 null 時照舊（海上沒有 tooltip）
   */
  pointer?: (
    lngLat: [number, number],
    ctx: {
      iso3: string | null;
      countryAt: (lon: number, lat: number) => string | null;
      countryName: (iso3: string) => string;
      /** 目前的指標 id（2026-10-29 起：冰河與海平面只在海平面的指標寫游標下那一格） */
      indicator: string;
      /** 時間軸的年份（2026-10-29 起，板塊漂移：游標下是哪一國過去的位置，依那個時間點的檔判斷） */
      year: number;
      /** 時刻主題目前選的這一刻（2026-10-30 起，晝夜與季節：游標這一點的日出日落）；其他主題是 null */
      at: ClockAt | null;
    },
  ) => PointerInfo | null;
  /**
   * 某些國家沒有值的原因，取代 tooltip 與側欄的「無資料」（key 是 ISO alpha-3）：
   * 例如台灣的外交主題裡台灣是觀點、中國大陸與香港由陸委會主管，寫「無資料」會誤導
   */
  noValue?: Record<string, Text>;
  /**
   * 排名表國名前面的小圖示（國旗主題的小國旗）。元件自己載入需要的資料；放在首頁的 bundle，要小
   */
  rowIcon?: (props: { iso3: string }) => React.ReactNode;
  /**
   * 地圖上沒有形狀、也不是 ISO 國家的資料單位（例如奧運的蘇聯、東德等歷史隊伍）：指標檔用 id（底線開頭，例如 `_URS`）當鍵，
   * 地圖在 lon/lat 畫一個小圓點與比例圓（跟吐瓦魯這類沒有形狀的國家一樣），排名表、tooltip、側欄用 name 當名稱。
   */
  places?: PlaceDef[];
  /**
   * 換到這個主題時（沒有選國家）地圖移到這個範圍 [西, 南, 東, 北]（2026-10-30 起，企鵝在哪裡、南極的冰下湖：
   * 資料都在南極，預設以台灣為中心的地球儀看不到）。跟側欄的 focusBox 走同一條路（App 的 moveToBox）。
   * 也可以是依時間軸年份給範圍的函式（2026-10-30 起，板塊漂移：打開時對著那個年代的大陸），只在換過來時算一次
   */
  focus?: [number, number, number, number] | ((year: number) => [number, number, number, number]);
}

/**
 * 網址的指標是舊的 id（`TopicDefinition.indicatorAliases`）時，換成現在的指標與子項目；不是的話原樣回傳同一個物件
 * （App 依「是不是同一個物件」決定要不要改寫網址）
 */
export function resolveAlias<T extends { indicator: string | null; item: string | null }>(
  topic: Pick<TopicDefinition, 'indicatorAliases'>,
  state: T,
): T {
  const alias = state.indicator ? topic.indicatorAliases?.[state.indicator] : undefined;
  return alias ? { ...state, indicator: alias.indicator, item: alias.item ?? state.item } : state;
}

/** 主題自訂的地點（`TopicDefinition.places`） */
export interface PlaceDef {
  /** 指標檔裡的鍵，底線開頭，不跟 ISO 代碼衝突 */
  id: string;
  name: Text;
  lon: number;
  lat: number;
}

/** 兩個指標的時間軸是不是同一種年份（timeAxis 的 label 一樣，或都沒有 timeAxis） */
export function sameTimeAxis(a: Pick<Indicator, 'timeAxis'>, b: Pick<Indicator, 'timeAxis'>): boolean {
  return (a.timeAxis?.label ?? null) === (b.timeAxis?.label ?? null);
}

/** 每筆資料涵蓋的年數：overlayTime 是數字 n 的指標（每十年一筆），年份 1990 代表 1990–1999；其他指標是 undefined */
export function yearBin(indicator: Pick<IndicatorDef, 'overlayTime'>): number | undefined {
  return typeof indicator.overlayTime === 'number' ? indicator.overlayTime : undefined;
}

/** 依目前語言解析過的主題與指標：所有 Text 都換成字串 */
export type Topic = Localized<TopicDefinition>;
export type Indicator = Localized<IndicatorDef>;
export type PointsOverlay = Localized<PointsOverlayDef>;
export type LinesOverlay = Localized<LinesOverlayDef>;
export type NightOverlay = Localized<NightOverlayDef>;
export type MoonOverlay = Localized<MoonOverlayDef>;
export type LiveGridOverlay = Localized<LiveGridOverlayDef>;
export type ClassGridOverlay = Localized<ClassGridOverlayDef>;
export type WindOverlay = Localized<WindOverlayDef>;

export function indicatorPath(
  topic: Pick<Topic, 'id' | 'dimension'>,
  indicator: Pick<Indicator, 'file' | 'dimension'>,
  item: string | null,
): string {
  const file = indicator.file.replace('{item}', itemFor(topic, indicator, item) ?? '');
  // ../<主題>/<檔名>：讀另一個主題的檔（2026-10-30，治安與司法的法治分數讀政府治理的，兩邊不另外存一份）
  return file.startsWith('../') ? `topics/${file.slice(3)}` : `topics/${topic.id}/${file}`;
}

export function usesDimension(indicator: Pick<Indicator, 'file'>): boolean {
  return indicator.file.includes('{item}');
}

/** 指標用的子項目選擇器：指標自己的 dimension 優先，沒有就是主題的 */
export function dimensionOf<D>(topic: { dimension?: D }, indicator: { dimension?: D }): D | undefined {
  return indicator.dimension ?? topic.dimension;
}

/**
 * 這個指標實際用的子項目：目前的子項目在它的選項裡就用它，否則用它的預設（指標有自己的 dimension 時，
 * 換到另一個指標，網址留著的是上一個指標的子項目）。不用子項目的指標原樣回傳
 */
export function itemFor(
  topic: Pick<Topic, 'dimension'>,
  indicator: Pick<Indicator, 'file' | 'dimension'>,
  item: string | null,
): string | null {
  const dimension = dimensionOf(topic, indicator);
  if (!dimension || !usesDimension(indicator)) return item;
  return item !== null && dimension.options.some((o) => o.id === item) ? item : dimension.defaultOption;
}

/** 子項目的名稱（側欄的數值卡片標題「紅色占國旗的面積」）；不用子項目的指標是 undefined */
export function itemLabelOf(
  topic: Pick<Topic, 'dimension'>,
  indicator: Pick<Indicator, 'file' | 'dimension'>,
  item: string | null,
): string | undefined {
  if (!usesDimension(indicator)) return undefined;
  const id = itemFor(topic, indicator, item);
  return dimensionOf(topic, indicator)?.options.find((o) => o.id === id)?.label;
}

const itemScaleCache = new WeakMap<Indicator, Map<string, Indicator>>();

/** 指標在某個子項目的單位與格式（IndicatorDef.itemFormats） */
export interface ItemFormat {
  unit: Text;
  format: (value: number, year?: number) => string;
  formatTick?: (value: number) => string;
}

/**
 * 面量圖有 itemScales 時，換成目前子項目的分級門檻；網格的 dir 含 `{item}` 時換成目前子項目的資料夾
 * （網路速度的固網、行動各一組圖磚：`internet-speed-{item}`）。
 * 同一個指標與子項目回傳同一個物件，地圖依 indicator 重算色階的 useMemo 才不會每次重畫。
 */
export function forItem(indicator: Indicator, item: string | null): Indicator {
  const layer = indicator.layer;
  const scale = layer.kind === 'choropleth' && item ? layer.itemScales?.[item] : undefined;
  const categories = layer.kind === 'categorical' && item ? layer.itemCategories?.[item] : undefined;
  const grid = indicator.grid?.dir.includes('{item}') ? indicator.grid : undefined;
  const fmt = item ? indicator.itemFormats?.[item] : undefined;
  if (!item || (!scale && !categories && !grid && !fmt)) return indicator;
  let byItem = itemScaleCache.get(indicator);
  if (!byItem) itemScaleCache.set(indicator, (byItem = new Map()));
  let resolved = byItem.get(item);
  if (!resolved) {
    resolved = { ...indicator };
    if (scale && layer.kind === 'choropleth') resolved.layer = { ...layer, scale };
    if (categories && layer.kind === 'categorical') resolved.layer = { ...layer, categories };
    if (grid) resolved.grid = { ...grid, dir: grid.dir.replace('{item}', item) };
    if (fmt) Object.assign(resolved, { unit: fmt.unit, format: fmt.format, formatTick: fmt.formatTick ?? fmt.format });
    byItem.set(item, resolved);
  }
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
  /**
   * 這一年以前的值多半是估計或內插（例如 Gapminder 1800 年起的長期資料，1950 年以前）：
   * 時間軸在這之前的年份標「估計值」，側欄折線圖在這一年畫一條垂直虛線
   */
  estimatesBefore?: number;
  /** 世界、區域等合計，key 例如 WLD */
  aggregates?: Record<string, (number | null)[]>;
  /** key 為 ISO alpha-3，陣列與 years 一一對應，缺值為 null */
  values: Record<string, (number | null)[]>;
  /** 個別國家的資料附註，例如改用其他來源補上的國家 */
  notes?: Record<string, string>;
  /** notes 的英文版 */
  notesEn?: Record<string, string>;
  /**
   * tooltip 第三行的短註（key 為 ISO alpha-3），例如「OSM 只標了官方店數的 3%」：完整的說明放 notes（側欄），
   * 這裡只放滑過地圖時就該看到的一句
   */
  hints?: Record<string, string>;
  /** hints 的英文版 */
  hintsEn?: Record<string, string>;
  /**
   * 沒有值的原因（key 為 ISO alpha-3），取代 tooltip 與側欄的「無資料」（missingReason()，排在指標、主題的 noValue 後面）。
   * 原因依資料而定、主題裡寫不出來時用：飲食的咖啡、茶、可可拿掉明顯不合理的年份，寫「數字不可靠」（2026-10-28 起）
   */
  noValue?: Record<string, string>;
  /** noValue 的英文版 */
  noValueEn?: Record<string, string>;
  /**
   * 普查、調查年份零散的指標：某年沒有資料時，改用該國 latestWithin 年內最近一年的值，
   * 地圖、tooltip、排名表、側欄都會標出實際的資料年份（見 panels/stats.ts 的 latestAt）。
   * values 本身只放實際有的年份，歷年折線圖與「所有年份」的 CSV 不會出現補上的值。
   */
  latestWithin?: number;
}
