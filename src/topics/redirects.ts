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
  'house-prices': { topic: 'real-estate', indicator: 'real-price-10y' }, // 2026-11-07 起房價在「房價與房租」
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
  // 2026-11-04 主題整併（使用者看過盤點後選「都做」；topics/merge.ts）：小主題併進相關的大主題，資料照舊在原本的資料夾
  vehicles: { topic: 'ev', indicator: 'motorcycles-per-1000' }, // 併5 汽機車與電動車
  ewaste: {
    // 併6 廢棄物與回收：電子垃圾的指標加 ewaste- 前綴（塑膠也有 per-capita）
    topic: 'plastic',
    indicator: 'ewaste-per-capita',
    indicators: {
      'per-capita': { indicator: 'ewaste-per-capita' },
      generated: { indicator: 'ewaste-generated' },
      'recycling-rate': { indicator: 'ewaste-recycling-rate' },
      recycled: { indicator: 'ewaste-recycled' },
    },
  },
  'road-races': {
    // 併12 運動：races 以前是運動的 F1 指標（轉到賽車），路跑的改名 road-races
    topic: 'sports',
    indicator: 'road-races',
    indicators: { races: { indicator: 'road-races' }, founded: { indicator: 'road-races-founded' } },
  },
  ivf: { topic: 'fertility', indicator: 'births-share' }, // 併14 生育率與高齡化
  retirement: { topic: 'employment', indicator: 'retirement-age' }, // 併16 就業、失業與退休
  climbing: { topic: 'diving', indicator: 'crag-count' }, // 併11 戶外運動場地：潛水與攀岩
  'box-office-tw': { topic: 'culture', indicator: 'share' }, // 併10 文化
  // 併1 核能：能源政策（核能政策；燃煤退場的兩個指標見 INDICATOR_MOVES）、核子事故、核廢料（指標原本都叫 map）
  'energy-policy': { topic: 'nuclear', indicator: 'nuclear-policy' },
  'nuclear-accidents': { topic: 'nuclear', indicator: 'accidents', indicators: { map: { indicator: 'accidents' } } },
  'nuclear-waste': { topic: 'nuclear', indicator: 'repositories', indicators: { map: { indicator: 'repositories' } } },
  // 併2 觀光鐵道與纜車（纜車的 map 改名 cable-cars）
  'cable-cars': { topic: 'heritage-railways', indicator: 'cable-cars', indicators: { map: { indicator: 'cable-cars' } } },
  // 併3 森林（森林覆蓋率、年變化率見 INDICATOR_MOVES 的 water-forest）
  'oil-palm': { topic: 'forest', indicator: 'area' },
  'planted-forests': { topic: 'forest', indicator: 'planted-share' },
  // 併4 企業與品牌（據點的 companies 改名 site-companies）
  'company-sites': { topic: 'companies', indicator: 'sites', indicators: { companies: { indicator: 'site-companies' } } },
  pandas: { topic: 'china-lending', indicator: 'received' }, // 併7 中國的海外影響力
  sectors: { topic: 'industry', indicator: 'services' }, // 併13 產業結構與工業
  // 併15 步道與自行車路線（自行車的 map 改名 cycle-map）
  cycling: { topic: 'trails', indicator: 'cycle-map', indicators: { map: { indicator: 'cycle-map' } } },
  // 整1 醫學影像、醫院的表現併進醫療人力與設備，血漿製劑併進藥品支出與取得
  'medical-imaging': { topic: 'health-care', indicator: 'devices' },
  'hospital-quality': { topic: 'health-care', indicator: 'mortality' },
  plasma: { topic: 'medicines', indicator: 'fractionation' },
  'covid-policy': { topic: 'covid', indicator: 'stringency' }, // 整2 COVID-19
  // 整3 的「稅率」併進政府財政（taxes → fiscal）2026-11-07 第二十五批 439 又拆回來，t/taxes/ 是主題本身，不轉址
};

/**
 * 主題留著、但某幾個指標搬到別的主題：主題 id → { 指標 id → 新主題 }。
 * 例如交通的航空旅客量搬到航空：t/transport/?ind=air-passengers 轉到 t/aviation/?ind=air-passengers
 */
export const INDICATOR_MOVES: Record<string, Record<string, TopicRedirect>> = {
  // 住宅（2026-11-07，第二十五批 470）：房價的 5 個指標搬到經濟類「不動產」的「房價與房租」，指標 id 不變
  housing: Object.fromEntries(
    ['real-price-10y', 'real-price-5y', 'price-income', 'price-rent', 'real-rent-5y'].map((id) => [id, { topic: 'real-estate' }]),
  ),
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
  // 交通安全：機車、汽車的指標搬到汽機車（第十一批 186），2026-11-04 汽機車再併進電動車（汽機車與電動車），指標 id 不變
  'road-safety': Object.fromEntries(
    ['motorcycles-per-1000', 'motorcycle-share', 'cars-per-1000', 'passenger-cars'].map((id) => [id, { topic: 'ev' }]),
  ),
  // 2026-11-04 主題整併：薪資與工時的法定年假搬到國定假日與年假（併9），法律與制度的博弈的合法性搬到博弈（併8，改名 legality）
  wages: { 'annual-leave': { topic: 'holidays' }, 'annual-leave-max': { topic: 'holidays' } },
  laws: { gambling: { topic: 'gambling', indicators: { gambling: { indicator: 'legality' } } } },
  // 併1 能源政策的燃煤退場到石油、天然氣與煤（能源政策整個併掉，這兩個指標優先於 TOPIC_REDIRECTS）；併3 森林的兩個指標到森林
  'energy-policy': { 'coal-phaseout': { topic: 'fossil-fuels' }, ppca: { topic: 'fossil-fuels' } },
  'water-forest': { 'forest-cover': { topic: 'forest' }, 'forest-change': { topic: 'forest' } },
  // 整1 健康與醫療拆成三個（壽命與死亡留在 health）
  health: {
    ...Object.fromEntries(
      [
        'health-spending-per-capita',
        'health-spending-gdp',
        'oop-share',
        'oop-per-capita',
        'government-share',
        'health-system',
        'health-financing',
        'uhc-start',
      ].map((id) => [id, { topic: 'health-spending' }]),
    ),
    ...Object.fromEntries(
      [
        'physicians',
        'nurses',
        'hospital-beds',
        'icu-beds',
        'icu-beds-adult',
        'surgery',
        'surgical-workforce',
        'laparoscopic',
        'obstetric-trauma',
        'teleconsult-share',
        'teleconsult-per-person',
        'ltc-beds',
        'ltc-recipients',
      ].map((id) => [id, { topic: 'health-care' }]),
    ),
  },
  // 整2 疫苗與防疫的 COVID-19 指標到 COVID-19
  vaccination: Object.fromEntries(
    ['covid-deaths', 'covid-vaccinated', 'covid-doses', 'covid-boosters', 'excess-deaths', 'excess-wmd', 'undercount'].map((id) => [
      id,
      { topic: 'covid' },
    ]),
  ),
  // 整3 物價與財政的物價、消費指標到物價與消費
  // 第二十五批 439（2026-11-07）稅率拆回 taxes：t/fiscal/?ind=cit 等（11-04 到 11-07 分享出去的網址）轉到稅率
  fiscal: Object.fromEntries([
    ...['inflation', 'price-level', 'food-share', 'recreation-share', 'restaurants-share'].map((id) => [id, { topic: 'prices' }]),
    ...['cit', 'pit-top', 'pit-threshold', 'vat', 'tax-wedge'].map((id) => [id, { topic: 'taxes' }]),
  ]),
  // 整4 國際觀光的旅遊習慣指標到旅遊習慣
  tourism: Object.fromEntries(
    [
      'main-accommodation',
      'hotel-share',
      'free-accommodation-share',
      'long-trips-domestic',
      'long-trips-abroad',
      'no-trip',
      'no-trip-reason',
      'air-share-abroad',
      'package-share-abroad',
      'web-booked-abroad',
      'trips-per-resident',
      'trips-abroad-per-resident',
      'participation',
      'nights-per-trip-abroad',
      'spend-per-trip-abroad',
    ].map((id) => [id, { topic: 'travel-habits' }]),
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
  // 整個主題併掉、但其中幾個指標搬到另一個主題時（2026-11-04 能源政策：核能政策到核能、燃煤退場到石油天然氣與煤），指標的優先
  const target = moved ?? whole;
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
