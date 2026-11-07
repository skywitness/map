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
 * 同一天第十一批 187 把能源併進科技，變成 7 類；2026-11-03（第十九批）加醫藥，又是 8 類；同一天景點與獎項與運動獨立成「休閒」，9 類。
 * 新增主題時加進最接近的分類與小標題，也在下面的 TOPIC_MODULES 加一行，再跑 npm run catalog（dev、build 會自動跑）。
 * 分類名稱要短，中文 1024px、英文 1280px 寬的螢幕要放得下整列（DESIGN.md 第 11 節）。
 */
export const TOPIC_GROUP_SPECS: TopicGroupSpec[] = [
  {
    id: 'society',
    label: { zh: '社會', en: 'People' },
    sections: [
      // 夜間燈光 2026-11-03 從地理的「景點」搬過來（使用者要求）
      { label: { zh: '人口與家庭', en: 'Population & family' }, topics: ['population', 'fertility', 'marriage', 'cities', 'housing', 'night-lights'] },
      // 飲食 2026-11-03 從「健康」搬過來（健康那一組搬到醫藥分類）
      { label: { zh: '生活與文化', en: 'Life & culture' }, topics: ['religion', 'festivals', 'reads', 'happiness', 'diet', 'cuisines', 'banknotes', 'origin-names', 'show-caves', 'hunting-fishing'] },
      { label: { zh: '平等與法律', en: 'Equality & law' }, topics: ['inequality', 'gender', 'crime', 'laws'] },
      // 2026-11-05 使用者要求每個小類各占一欄、教育放最右邊
      { label: { zh: '教育', en: 'Education' }, topics: ['education', 'pisa'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求）：人口與家庭；生活與文化；平等與法律；教育
    columns: [1, 1, 1, 1],
  },
  {
    // 2026-11-03（製作手冊第十九批，使用者選 A）：社會分類原本的「健康」那一組與血型搬過來，加上基因與藥物的主題
    id: 'medicine',
    label: { zh: '醫藥', en: 'Health' },
    sections: [
      { label: { zh: '健康與疾病', en: 'Health & disease' }, topics: ['health', 'health-spending', 'health-care', 'disease', 'vaccination', 'covid', 'height', 'tobacco-alcohol'] },
      { label: { zh: '基因', en: 'Genes' }, topics: ['blood-types', 'newborn-screening', 'red-cell-traits', 'lactase', 'drug-genes'] },
      { label: { zh: '藥物', en: 'Medicines' }, topics: ['medicines', 'drug-consumption', 'taiwan-medicines', 'antimicrobial-resistance'] },
    ],
    // 左：健康與疾病；中：基因；右：藥物
    columns: [1, 1, 1],
  },
  {
    id: 'economy',
    label: { zh: '經濟', en: 'Economy' },
    // 2026-11-07（製作手冊第二十五批 439，使用者 2026-11-05 核准）：新開農業與糧食、稅（「稅率」拆回自己的主題）、金融服務、
    // 消費與零售四個小類，「財政與金融」剩下財政；「不動產」小類在第一個主題「房價與房租」（第二十五批 470）做好時加上
    sections: [
      { label: { zh: '產業', en: 'Industries' }, topics: ['industry', 'minerals'] },
      { label: { zh: '農業與糧食', en: 'Agriculture & food' }, topics: ['agriculture'] },
      { label: { zh: '所得與財富', en: 'Income & wealth' }, topics: ['income', 'wages', 'employment', 'wealth', 'redistribution', 'social-protection', 'labour-rights'] },
      { label: { zh: '財政', en: 'Public finance' }, topics: ['fiscal', 'reserves'] },
      { label: { zh: '稅', en: 'Taxes' }, topics: ['taxes'] },
      { label: { zh: '金融服務', en: 'Financial services' }, topics: ['banking', 'stock-market', 'insurance'] },
      { label: { zh: '消費與零售', en: 'Consumption & retail' }, topics: ['prices', 'chain-stores', 'retail'] },
      { label: { zh: '企業', en: 'Companies' }, topics: ['companies', 'business-demography', 'market-regulation'] },
      { label: { zh: '不動產', en: 'Real estate' }, topics: ['real-estate', 'housing-market', 'property-costs'] },
    ],
    // 四欄（2026-11-05 使用者要求企業放最右邊；第二十五批小類變多，一欄放幾個小類）：
    // 產業、農業與糧食；所得與財富；財政、稅、金融服務；消費與零售、企業
    columns: [2, 1, 3, 2],
  },
  {
    id: 'global',
    label: { zh: '國際', en: 'Global' },
    sections: [
      { label: { zh: '往來', en: 'Flows' }, topics: ['trade', 'migration', 'aid', 'china-lending', 'tourism', 'passport'] },
      { label: { zh: '政治', en: 'Politics' }, topics: ['empires', 'democracy', 'governance'] },
      { label: { zh: '外交', en: 'Diplomacy' }, topics: ['organizations', 'un-votes', 'taiwan-diplomacy'] },
      { label: { zh: '安全', en: 'Security' }, topics: ['military', 'conflict', 'news', 'travel-advisories'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求，外交在政治右邊、安全左邊）：往來；政治；外交；安全
    columns: [1, 1, 1, 1],
  },
  {
    id: 'environment',
    // 英文 2026-10-30（第十一批 187）由 Climate 改成 Environment
    label: { zh: '環境', en: 'Environment' },
    sections: [
      { label: { zh: '氣候', en: 'Climate' }, topics: ['climate', 'temperature', 'koppen', 'ice', 'wind', 'typhoons'] },
      { label: { zh: '污染', en: 'Pollution' }, topics: ['air-quality', 'ozone-hole', 'plastic'] },
      { label: { zh: '土地與水', en: 'Land & water' }, topics: ['water-forest', 'forest', 'wildfires', 'megafauna'] },
      // 2026-11-07（製作手冊第二十五批 480）新開
      { label: { zh: '碳與氣候政策', en: 'Climate policy' }, topics: ['climate-action', 'climate-finance'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求）：氣候；污染；土地與水；碳與氣候政策
    columns: [1, 1, 1, 1],
  },
  {
    id: 'tech',
    label: { zh: '科技', en: 'Tech' },
    // 2026-10-30（第十一批 187）「能源」分類併進科技的右欄；第十批的晶圓廠地圖、Starlink、研發投入最多的公司、大型科學設施、
    // 電價與油價、能源政策、核廢料做好時照手冊的表放進對應的欄
    // 2026-11-07（第二十五批 439）：能源升成自己的大類；「研發與太空」拆出太空（太空、Starlink），原小類改名「研發與創新」
    sections: [
      { label: { zh: '數位', en: 'Digital' }, topics: ['ai', 'semiconductors', 'wafer-fabs', 'digital', 'internet-speed', 'developers', 'submarine-cables'] },
      { label: { zh: '研發與創新', en: 'Research & innovation' }, topics: ['innovation', 'rd-companies', 'publications', 'science-facilities'] },
      { label: { zh: '太空', en: 'Space' }, topics: ['space', 'starlink'] },
    ],
    // 左：數位；中：研發與創新；右：太空
    columns: [1, 1, 1],
  },
  {
    // 2026-11-07（製作手冊第二十五批 439，使用者 2026-11-05 核准）：能源從科技分出來成為大類。手冊的五個小類裡核能只有一個主題，
    // 先跟電力併在一起（補到兩個再分開）；「能源的使用與政策」等第一個主題（523–528）做好時再加
    id: 'energy',
    label: { zh: '能源', en: 'Energy' },
    sections: [
      { label: { zh: '電力', en: 'Electricity' }, topics: ['electricity', 'power-plants', 'energy-prices', 'nuclear'] },
      { label: { zh: '化石燃料', en: 'Fossil fuels' }, topics: ['fossil-fuels'] },
      { label: { zh: '再生能源', en: 'Renewables' }, topics: ['renewables'] },
    ],
    // 左：電力；中：化石燃料；右：再生能源
    columns: [1, 1, 1],
  },
  {
    id: 'transport',
    label: { zh: '交通', en: 'Transport' },
    // 2026-10-30（第十一批 186）交通拆成鐵路（id 照舊 transport）、高鐵、地鐵與城市軌道，航空拆成機場與旅客（id 照舊 aviation）、
    // 航線與航空公司，交通安全拆出汽機車，電動車從能源搬過來；187 排成三欄（使用者要水運放中欄）
    sections: [
      { label: { zh: '鐵道', en: 'Rail' }, topics: ['transport', 'high-speed-rail', 'metro', 'heritage-railways'] },
      { label: { zh: '航空', en: 'Air' }, topics: ['aviation', 'air-routes', 'airspace'] },
      { label: { zh: '道路', en: 'Road' }, topics: ['road-safety', 'ev', 'ride-hailing'] },
      { label: { zh: '水運', en: 'Sea' }, topics: ['shipping', 'logbooks'] },
    ],
    // 每個小類各占一欄（2026-11-05 使用者要求，水運放最右邊）：鐵道；航空；道路；水運
    columns: [1, 1, 1, 1],
  },
  {
    id: 'geo',
    label: { zh: '地理', en: 'Geography' },
    sections: [
      { label: { zh: '國家', en: 'Countries' }, topics: ['profiles', 'flags', 'language', 'travel', 'taipei-view'] },
      { label: { zh: '地形與地質', en: 'Land & geology' }, topics: ['elevation', 'rivers', 'oceans', 'lithology', 'special-landforms', 'plates', 'earthquakes', 'reclamation', 'antarctica'] },
      { label: { zh: '天空', en: 'Sky' }, topics: ['daylight', 'eclipses', 'aurora', 'magnetic', 'antipodes'] },
    ],
    // 左：國家；中：地形與地質；右：天空（2026-11-03 使用者要求從左欄搬到右欄；原本右欄的景點搬到「休閒」）
    columns: [1, 1, 1],
  },
  {
    // 2026-11-03 使用者要求：地理的「景點」與社會的「獎項與運動」獨立成一類（景點原本的夜間燈光搬到社會的人口與家庭）
    id: 'leisure',
    label: { zh: '休閒', en: 'Leisure' },
    sections: [
      { label: { zh: '景點', en: 'Places to see' }, topics: ['world-heritage', 'castles', 'national-parks', 'trails', 'attractions', 'oldest-universities', 'skyscrapers'] },
      { label: { zh: '獎項與運動', en: 'Prizes & sports' }, topics: ['nobel', 'sports', 'racing', 'esports', 'horses'] },
      // 2026-11-04 製作手冊第二十一批（休閒的追加主題；社會已經有「生活與文化」，這裡叫日常休閒）
      { label: { zh: '日常休閒', en: 'Everyday leisure' }, topics: ['dining', 'diving', 'gambling', 'holidays', 'travel-habits', 'time-use', 'culture'] },
    ],
    // 左：景點；中：獎項與運動；右：日常休閒（2026-11-05 使用者要求分成三欄）
    columns: [1, 1, 1],
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
  holidays: () => import('./holidays'),
  dining: () => import('./dining'),
  culture: () => import('./culture'),
  esports: () => import('./esports'),
  horses: () => import('./horses'),
  'origin-names': () => import('./origin-names'),
  cuisines: () => import('./cuisines'),
  'show-caves': () => import('./show-caves'),
  'hunting-fishing': () => import('./hunting-fishing'),
  diving: () => import('./diving'),
  gambling: () => import('./gambling'),
  'time-use': () => import('./time-use'),
  marriage: () => import('./marriage'),
  cities: () => import('./cities'),
  health: () => import('./health'),
  disease: () => import('./disease'),
  vaccination: () => import('./vaccination'),
  height: () => import('./height'),
  'blood-types': () => import('./blood-types'),
  'newborn-screening': () => import('./newborn-screening'),
  'red-cell-traits': () => import('./red-cell-traits'),
  lactase: () => import('./lactase'),
  'drug-genes': () => import('./drug-genes'),
  medicines: () => import('./medicines'),
  'drug-consumption': () => import('./drug-consumption'),
  'taiwan-medicines': () => import('./taiwan-medicines'),
  'antimicrobial-resistance': () => import('./antimicrobial-resistance'),
  'tobacco-alcohol': () => import('./tobacco-alcohol'),
  education: () => import('./education'),
  pisa: () => import('./pisa'),
  diet: () => import('./diet'),
  // 2026-11-05 第二十二批 397（加上候選 681）：鈔票上是誰、最大面額
  banknotes: () => import('./banknotes'),
  // 2026-11-05 第二十二批 398：大型哺乳類還剩下幾種（PHYLACINE）
  megafauna: () => import('./megafauna'),
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
  redistribution: () => import('./redistribution'),
  'social-protection': () => import('./social-protection'),
  'labour-rights': () => import('./labour-rights'),
  reserves: () => import('./reserves'),
  'stock-market': () => import('./stock-market'),
  insurance: () => import('./insurance'),
  banking: () => import('./banking'),
  'business-demography': () => import('./business-demography'),
  'market-regulation': () => import('./market-regulation'),
  'real-estate': () => import('./real-estate'),
  'housing-market': () => import('./housing-market'),
  'property-costs': () => import('./property-costs'),
  retail: () => import('./retail'),
  'climate-action': () => import('./climate-action'),
  'climate-finance': () => import('./climate-finance'),
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
  // 2026-11-06 第二十四批 420：美國、加拿大與台灣的旅遊警示
  'travel-advisories': () => import('./travel-advisories'),
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
  nuclear: () => import('./nuclear'),
  'health-spending': () => import('./health-spending'),
  'health-care': () => import('./health-care'),
  covid: () => import('./covid'),
  prices: () => import('./prices'),
  'travel-habits': () => import('./travel-habits'),
  forest: () => import('./forest'),
  'energy-prices': () => import('./energy-prices'),
  'science-facilities': () => import('./science-facilities'),
  starlink: () => import('./starlink'),
  'wafer-fabs': () => import('./wafer-fabs'),
  'rd-companies': () => import('./rd-companies'),
  renewables: () => import('./renewables'),
  climate: () => import('./climate'),
  temperature: () => import('./temperature'),
  'air-quality': () => import('./air-quality'),
  'water-forest': () => import('./water-forest'),
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
  attractions: () => import('./attractions'),
  'oldest-universities': () => import('./oldest-universities'),
  antarctica: () => import('./antarctica'),
  'national-parks': () => import('./national-parks'),
  trails: () => import('./trails'),
  festivals: () => import('./festivals'),
  companies: () => import('./companies'),
  aviation: () => import('./aviation'),
  'ride-hailing': () => import('./ride-hailing'),
  'heritage-railways': () => import('./heritage-railways'),
  airspace: () => import('./airspace'),
  'taipei-view': () => import('./taipei-view'),
  magnetic: () => import('./magnetic'),
  aurora: () => import('./aurora'),
  logbooks: () => import('./logbooks'),
  koppen: () => import('./koppen'),
  ice: () => import('./ice'),
  reads: () => import('./reads'),
  empires: () => import('./empires'),
  plates: () => import('./plates'),
  lithology: () => import('./lithology'),
  'special-landforms': () => import('./special-landforms'),
  reclamation: () => import('./reclamation'),
  wind: () => import('./wind'),
  earthquakes: () => import('./earthquakes'),
  typhoons: () => import('./typhoons'),
  wildfires: () => import('./wildfires'),
  'night-lights': () => import('./night-lights'),
  'world-heritage': () => import('./world-heritage'),
  castles: () => import('./castles'),
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
