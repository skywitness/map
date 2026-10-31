import type { Text } from '../i18n/lang';
import type { TopicDefinition } from './types';

export interface TopicSection {
  /** 下拉選單、主題總覽裡的小標題；沒有小標題的分類是 null（2026-10-30 第十一批 187 起每一類都有小標題） */
  label: Text | null;
  /** 主題的 id，順序就是選單裡的順序 */
  topics: string[];
}

export interface TopicGroupSpec {
  id: string;
  label: Text;
  /** 依小標題分段的主題（2026-10-30 起，第七批 124） */
  sections: TopicSection[];
  /**
   * 下拉選單每一欄放幾段（依 sections 的順序，由左往右），例如 [2, 2, 2]：使用者指定的排法（2026-10-30）。
   * 沒有寫的分類由 TopicNav.tsx 的 packColumns 自動分欄（左邊的欄最滿）；手機上照樣是一欄
   */
  columns?: number[];
}

/**
 * 頂列的主題分類，每一類是一個下拉選單；順序就是畫面上的順序。2026-10-30（第七批 124）起 8 類，選單依小標題分段；
 * 同一天第十一批 187 把能源併進科技，變成 7 類。
 * 新增主題時加進最接近的分類與小標題，也在下面的 TOPIC_MODULES 加一行，再跑 npm run catalog（dev、build 會自動跑）。
 * 分類名稱要短，中文 1024px、英文 1280px 寬的螢幕要放得下整列（DESIGN.md 第 11 節）。
 */
export const TOPIC_GROUP_SPECS: TopicGroupSpec[] = [
  {
    id: 'society',
    label: { zh: '社會', en: 'People' },
    sections: [
      { label: { zh: '人口與家庭', en: 'Population & family' }, topics: ['population', 'fertility', 'marriage', 'cities', 'housing'] },
      { label: { zh: '平等與法律', en: 'Equality & law' }, topics: ['inequality', 'gender', 'crime', 'laws'] },
      { label: { zh: '健康', en: 'Health' }, topics: ['health', 'disease', 'vaccination', 'height', 'blood-types', 'tobacco-alcohol', 'diet'] },
      { label: { zh: '教育', en: 'Education' }, topics: ['education', 'pisa'] },
      { label: { zh: '生活與文化', en: 'Life & culture' }, topics: ['religion', 'festivals', 'reads', 'happiness'] },
      { label: { zh: '獎項與運動', en: 'Prizes & sports' }, topics: ['nobel', 'sports', 'racing'] },
    ],
    // 左：人口與家庭、平等與法律；中：健康、教育；右：生活與文化、獎項與運動
    columns: [2, 2, 2],
  },
  {
    id: 'economy',
    label: { zh: '經濟', en: 'Economy' },
    sections: [
      { label: { zh: '產業', en: 'Industries' }, topics: ['sectors', 'industry', 'agriculture', 'minerals'] },
      { label: { zh: '企業', en: 'Companies' }, topics: ['chain-stores', 'companies'] },
      { label: { zh: '所得與財富', en: 'Income & wealth' }, topics: ['income', 'wages', 'employment', 'wealth'] },
      { label: { zh: '財政與金融', en: 'Public finance & markets' }, topics: ['fiscal', 'taxes', 'reserves', 'stock-market'] },
    ],
    // 左：產業、企業；中：所得與財富；右：財政與金融
    columns: [2, 1, 1],
  },
  {
    id: 'global',
    label: { zh: '國際', en: 'Global' },
    sections: [
      { label: { zh: '往來', en: 'Flows' }, topics: ['trade', 'migration', 'aid', 'china-lending', 'tourism', 'passport'] },
      { label: { zh: '政治', en: 'Politics' }, topics: ['empires', 'democracy', 'governance'] },
      { label: { zh: '外交', en: 'Diplomacy' }, topics: ['organizations', 'un-votes', 'taiwan-diplomacy', 'pandas'] },
      { label: { zh: '安全', en: 'Security' }, topics: ['military', 'conflict', 'news'] },
    ],
    // 左：往來；中：政治、外交；右：安全
    columns: [1, 2, 1],
  },
  {
    id: 'environment',
    // 英文 2026-10-30（第十一批 187）由 Climate 改成 Environment
    label: { zh: '環境', en: 'Environment' },
    sections: [
      { label: { zh: '氣候', en: 'Climate' }, topics: ['climate', 'temperature', 'koppen', 'ice', 'wind', 'typhoons'] },
      { label: { zh: '污染', en: 'Pollution' }, topics: ['air-quality', 'ozone-hole', 'plastic', 'ewaste'] },
      { label: { zh: '土地與水', en: 'Land & water' }, topics: ['water-forest', 'oil-palm', 'planted-forests', 'wildfires'] },
    ],
  },
  {
    id: 'tech',
    label: { zh: '科技', en: 'Tech' },
    // 2026-10-30（第十一批 187）「能源」分類併進科技的右欄；第十批的晶圓廠地圖、Starlink、研發投入最多的公司、大型科學設施、
    // 電價與油價、能源政策、核廢料做好時照手冊的表放進對應的欄
    sections: [
      { label: { zh: '數位', en: 'Digital' }, topics: ['ai', 'semiconductors', 'wafer-fabs', 'digital', 'internet-speed', 'starlink', 'developers', 'submarine-cables'] },
      { label: { zh: '研發與太空', en: 'Research & space' }, topics: ['innovation', 'rd-companies', 'publications', 'science-facilities', 'space'] },
      { label: { zh: '能源', en: 'Energy' }, topics: ['electricity', 'power-plants', 'renewables', 'fossil-fuels', 'energy-prices', 'energy-policy', 'nuclear-accidents', 'nuclear-waste'] },
    ],
    // 左：數位；中：研發與太空；右：能源
    columns: [1, 1, 1],
  },
  {
    id: 'transport',
    label: { zh: '交通', en: 'Transport' },
    // 2026-10-30（第十一批 186）交通拆成鐵路（id 照舊 transport）、高鐵、地鐵與城市軌道，航空拆成機場與旅客（id 照舊 aviation）、
    // 航線與航空公司，交通安全拆出汽機車，電動車從能源搬過來；187 排成三欄（使用者要水運放中欄）
    sections: [
      { label: { zh: '鐵道', en: 'Rail' }, topics: ['transport', 'high-speed-rail', 'metro', 'heritage-railways', 'cable-cars'] },
      { label: { zh: '航空', en: 'Air' }, topics: ['aviation', 'air-routes', 'airspace'] },
      { label: { zh: '水運', en: 'Sea' }, topics: ['shipping', 'logbooks'] },
      { label: { zh: '道路', en: 'Road' }, topics: ['road-safety', 'vehicles', 'ev', 'ride-hailing'] },
    ],
    // 左：鐵道；中：航空、水運；右：道路
    columns: [1, 2, 1],
  },
  {
    id: 'geo',
    label: { zh: '地理', en: 'Geography' },
    sections: [
      { label: { zh: '國家', en: 'Countries' }, topics: ['profiles', 'flags', 'language', 'travel', 'taipei-view'] },
      { label: { zh: '天空', en: 'Sky' }, topics: ['daylight', 'eclipses', 'aurora', 'magnetic', 'antipodes'] },
      { label: { zh: '地形與地質', en: 'Land & geology' }, topics: ['elevation', 'rivers', 'oceans', 'lithology', 'special-landforms', 'plates', 'earthquakes', 'reclamation', 'antarctica'] },
      { label: { zh: '景點', en: 'Places to see' }, topics: ['world-heritage', 'national-parks', 'trails', 'attractions', 'oldest-universities', 'skyscrapers', 'night-lights'] },
    ],
    // 左：國家、天空；中：地形與地質；右：景點
    columns: [2, 1, 1],
  },
];

/** 分類裡的所有主題（依小標題的順序） */
export const groupTopics = (g: TopicGroupSpec): string[] => g.sections.flatMap((s) => s.topics);

/**
 * 每個主題的定義各自一個 chunk，換到那個主題才下載（全部放在首頁的程式裡約 220 KB，gzip 後）。
 * 人口（預設主題）與純地圖直接放在首頁（index.ts），不在這裡
 */
export const TOPIC_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  fertility: () => import('./fertility'),
  marriage: () => import('./marriage'),
  cities: () => import('./cities'),
  health: () => import('./health'),
  disease: () => import('./disease'),
  vaccination: () => import('./vaccination'),
  height: () => import('./height'),
  'blood-types': () => import('./blood-types'),
  'tobacco-alcohol': () => import('./tobacco-alcohol'),
  education: () => import('./education'),
  pisa: () => import('./pisa'),
  diet: () => import('./diet'),
  housing: () => import('./housing'),
  religion: () => import('./religion'),
  inequality: () => import('./inequality'),
  gender: () => import('./gender'),
  crime: () => import('./crime'),
  laws: () => import('./laws'),
  happiness: () => import('./happiness'),
  nobel: () => import('./nobel'),
  sports: () => import('./sports'),
  racing: () => import('./racing'),
  income: () => import('./income'),
  wages: () => import('./wages'),
  employment: () => import('./employment'),
  wealth: () => import('./wealth'),
  fiscal: () => import('./fiscal'),
  taxes: () => import('./taxes'),
  reserves: () => import('./reserves'),
  'stock-market': () => import('./stock-market'),
  sectors: () => import('./sectors'),
  industry: () => import('./industry'),
  agriculture: () => import('./agriculture'),
  minerals: () => import('./minerals'),
  'chain-stores': () => import('./chain-stores'),
  trade: () => import('./trade'),
  migration: () => import('./migration'),
  aid: () => import('./aid'),
  'china-lending': () => import('./china-lending'),
  tourism: () => import('./tourism'),
  passport: () => import('./passport'),
  military: () => import('./military'),
  conflict: () => import('./conflict'),
  news: () => import('./news'),
  democracy: () => import('./democracy'),
  governance: () => import('./governance'),
  organizations: () => import('./organizations'),
  'un-votes': () => import('./un-votes'),
  'taiwan-diplomacy': () => import('./diplomacy'),
  electricity: () => import('./electricity'),
  'power-plants': () => import('./power-plants'),
  'fossil-fuels': () => import('./fossil-fuels'),
  'energy-prices': () => import('./energy-prices'),
  'energy-policy': () => import('./energy-policy'),
  'science-facilities': () => import('./science-facilities'),
  starlink: () => import('./starlink'),
  'wafer-fabs': () => import('./wafer-fabs'),
  'rd-companies': () => import('./rd-companies'),
  renewables: () => import('./renewables'),
  climate: () => import('./climate'),
  temperature: () => import('./temperature'),
  'air-quality': () => import('./air-quality'),
  'water-forest': () => import('./water-forest'),
  'oil-palm': () => import('./oil-palm'),
  'planted-forests': () => import('./planted-forests'),
  plastic: () => import('./plastic'),
  ev: () => import('./ev'),
  ai: () => import('./ai'),
  semiconductors: () => import('./semiconductors'),
  digital: () => import('./digital'),
  'internet-speed': () => import('./internet-speed'),
  developers: () => import('./developers'),
  innovation: () => import('./innovation'),
  publications: () => import('./publications'),
  'submarine-cables': () => import('./submarine-cables'),
  space: () => import('./space'),
  transport: () => import('./transport'),
  shipping: () => import('./shipping'),
  'road-safety': () => import('./road-safety'),
  vehicles: () => import('./vehicles'),
  'high-speed-rail': () => import('./high-speed-rail'),
  metro: () => import('./metro'),
  'air-routes': () => import('./air-routes'),
  profiles: () => import('./profiles'),
  flags: () => import('./flags'),
  language: () => import('./language'),
  elevation: () => import('./elevation'),
  rivers: () => import('./rivers'),
  oceans: () => import('./oceans'),
  daylight: () => import('./daylight'),
  eclipses: () => import('./eclipses'),
  antipodes: () => import('./antipodes'),
  pandas: () => import('./pandas'),
  attractions: () => import('./attractions'),
  'oldest-universities': () => import('./oldest-universities'),
  antarctica: () => import('./antarctica'),
  'national-parks': () => import('./national-parks'),
  trails: () => import('./trails'),
  festivals: () => import('./festivals'),
  companies: () => import('./companies'),
  aviation: () => import('./aviation'),
  'cable-cars': () => import('./cable-cars'),
  'ride-hailing': () => import('./ride-hailing'),
  'heritage-railways': () => import('./heritage-railways'),
  airspace: () => import('./airspace'),
  ewaste: () => import('./ewaste'),
  'taipei-view': () => import('./taipei-view'),
  magnetic: () => import('./magnetic'),
  aurora: () => import('./aurora'),
  logbooks: () => import('./logbooks'),
  koppen: () => import('./koppen'),
  ice: () => import('./ice'),
  reads: () => import('./reads'),
  empires: () => import('./empires'),
  plates: () => import('./plates'),
  'nuclear-accidents': () => import('./nuclear-accidents'),
  'nuclear-waste': () => import('./nuclear-waste'),
  lithology: () => import('./lithology'),
  'special-landforms': () => import('./special-landforms'),
  reclamation: () => import('./reclamation'),
  wind: () => import('./wind'),
  earthquakes: () => import('./earthquakes'),
  typhoons: () => import('./typhoons'),
  wildfires: () => import('./wildfires'),
  'night-lights': () => import('./night-lights'),
  'world-heritage': () => import('./world-heritage'),
  skyscrapers: () => import('./skyscrapers'),
  travel: () => import('./travel'),
  'ozone-hole': () => import('./ozone-hole'),
};

/**
 * 模組裡的主題定義（每個主題檔 export 一個 TopicDefinition）。同一個檔可能還有同一個 id 的疊加圖層
 * （城市的 CITY_LAYER 也叫 cities），所以要有主題才有的欄位
 */
export function topicOf(module: Record<string, unknown>, id: string): TopicDefinition {
  for (const value of Object.values(module)) {
    const topic = value as Partial<TopicDefinition> | null;
    if (topic && typeof topic === 'object' && topic.id === id && topic.title && topic.defaultIndicator && Array.isArray(topic.indicators)) {
      return topic as TopicDefinition;
    }
  }
  throw new Error(`topic ${id} not found in its module`);
}
