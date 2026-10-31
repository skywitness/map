/**
 * 主題的舊網址轉址（2026-10-30，第七批的整合）：主題合併或指標搬到別的主題後，舊的分享連結、嵌入碼、收藏的畫面
 * 照樣打開新主題的對應指標，網址也換成新的寫法（lib/url-state.ts 的 read() 讀網址時先經過 redirectTopic()）。
 * 這個檔不 import 任何東西：vite.config.ts 建置時也讀它（舊路徑 t/<舊 id>/ 的 HTML、首頁預載主題 chunk 的那段程式）。
 */

export interface TopicRedirect {
  /** 新的主題 id */
  topic: string;
  /** 網址沒寫指標時打開的指標（舊主題的預設指標在新主題裡的 id）；沒寫用新主題的預設 */
  indicator?: string;
  /** 網址沒寫子項目時用的子項目 */
  item?: string;
  /** 舊主題的指標 id → 新主題的指標與子項目（改名的才列；沒列的照原 id，新主題沒有這個指標時打開預設指標） */
  indicators?: Record<string, { indicator: string; item?: string }>;
  /** 打開新主題時一起打開的疊加圖層（overlay 的 id，例如唐人街併進移民主題成為一個圖層） */
  layer?: string;
}

/** 舊主題 id → 新主題（整個主題併進別的主題） */
export const TOPIC_REDIRECTS: Record<string, TopicRedirect> = {
  // 南極（第七批 116）：研究站、企鵝、冰下湖合成一個主題，指標 id 不變
  'antarctic-stations': { topic: 'antarctica', indicator: 'operating' },
  penguins: { topic: 'antarctica', indicator: 'species' },
  'subglacial-lakes': { topic: 'antarctica', indicator: 'lakes' },
  // 航空（第七批 117）：航空公司（指標 operating 改名 airlines）、最長的直飛航線（指標 id 不變）；
  // 第十一批 186 航空再拆開後，這兩個在航線與航空公司
  airlines: { topic: 'air-routes', indicator: 'airlines', indicators: { operating: { indicator: 'airlines' } } },
  'longest-flights': { topic: 'air-routes', indicator: 'routes-count' },
  // 月球與火星的登陸併進太空（第七批 118），指標 id 不變
  landings: { topic: 'space', indicator: 'moon' },
  // 房價與居住負擔併進住宅（第七批 119，住宅與房價保留 housing 的 id），指標 id 不變
  'house-prices': { topic: 'housing', indicator: 'real-price-10y' },
  // 企業與品牌（第七批 120）：最古老的公司、品牌的發源地，指標 id 不變
  'oldest-companies': { topic: 'companies', indicator: 'companies' },
  brands: { topic: 'companies', indicator: 'brands' },
  // 運動（第七批 121）：奧運獎牌，指標 id 不變
  olympics: { topic: 'sports', indicator: 'medals-total' },
  // F1 賽道與冠軍：第七批 121 併進運動，第九批 160 再搬到賽車，指標 id 不變
  f1: { topic: 'racing', indicator: 'races' },
  // 七個小主題併進大主題（第七批 122）
  'birth-season': { topic: 'fertility', indicator: 'peak-month' },
  'university-entrance': { topic: 'education', indicator: 'main-route' },
  foods: { topic: 'diet', indicator: 'foods', indicators: { count: { indicator: 'foods' } } },
  'urban-heat': { topic: 'cities', indicator: 'uhi' },
  'co2-stations': { topic: 'climate', indicator: 'stations' },
  'cloud-regions': { topic: 'ai', indicator: 'regions' },
  // 唐人街變成移民與難民的疊加圖層：打開僑民人數，並打開唐人街的圖層
  chinatowns: { topic: 'migration', indicator: 'emigrants', indicators: { map: { indicator: 'emigrants' } }, layer: 'chinatowns' },
};

/**
 * 主題留著、但某幾個指標搬到別的主題：主題 id → { 指標 id → 新主題 }。
 * 例如交通的航空旅客量搬到航空：t/transport/?ind=air-passengers 轉到 t/aviation/?ind=air-passengers
 */
export const INDICATOR_MOVES: Record<string, Record<string, TopicRedirect>> = {
  // 交通（id transport，第十一批 186 起叫鐵路）：機場與航空旅客指標搬到航空（第七批 117，第十一批起叫機場與旅客），
  // 地鐵站、第一條高鐵搬到地鐵與城市軌道、高鐵（第十一批 186），指標 id 都不變
  transport: {
    ...Object.fromEntries(
      ['airports-count', 'large-airports', 'air-passengers', 'air-trips', 'busiest-passengers'].map((id) => [id, { topic: 'aviation' }]),
    ),
    'metro-stations': { topic: 'metro' },
    'hsr-first': { topic: 'high-speed-rail' },
  },
  // 航空（id aviation，第十一批 186 起叫機場與旅客）：航空公司、最長航線的指標搬到航線與航空公司，指標 id 不變
  aviation: Object.fromEntries(['airlines', 'routes-count', 'longest', 'discontinued'].map((id) => [id, { topic: 'air-routes' }])),
  // 交通安全：機車、汽車的指標搬到汽機車（第十一批 186），指標 id 不變
  'road-safety': Object.fromEntries(
    ['motorcycles-per-1000', 'motorcycle-share', 'cars-per-1000', 'passenger-cars'].map((id) => [id, { topic: 'vehicles' }]),
  ),
  // 賽車（第九批 160）：運動的 F1 指標搬到賽車，指標 id 不變
  sports: Object.fromEntries(['races', 'champions'].map((id) => [id, { topic: 'racing' }])),
};

export interface Redirected {
  topic: string;
  indicator: string | null;
  item: string | null;
  layer: string | null;
}

/** 網址的主題、指標、子項目轉到現在的主題；不必轉的回傳 null */
export function redirectTopic(topic: string | null, indicator: string | null, item: string | null): Redirected | null {
  if (!topic) return null;
  const whole = TOPIC_REDIRECTS[topic];
  const moved = indicator ? INDICATOR_MOVES[topic]?.[indicator] : undefined;
  const target = whole ?? moved;
  if (!target) return null;
  const renamed = indicator ? target.indicators?.[indicator] : undefined;
  return {
    topic: target.topic,
    indicator: renamed?.indicator ?? indicator ?? target.indicator ?? null,
    item: renamed?.item ?? item ?? (indicator ? null : (target.item ?? null)),
    layer: target.layer ?? null,
  };
}

/** 舊主題 id → 新主題 id（建置時產生舊路徑的 HTML、預載 chunk 用） */
export function redirectedTopicIds(): Record<string, string> {
  return Object.fromEntries(Object.entries(TOPIC_REDIRECTS).map(([from, r]) => [from, r.topic]));
}
