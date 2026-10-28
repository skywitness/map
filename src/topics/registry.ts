import type { Text } from '../i18n/lang';
import type { TopicDefinition } from './types';

export interface TopicGroupSpec {
  id: string;
  label: Text;
  /** 主題的 id，順序就是選單裡的順序 */
  topics: string[];
}

/**
 * 頂列的主題分類，每一類是一個下拉選單；順序就是畫面上的順序。
 * 新增主題時加進最接近的一類，也在下面的 TOPIC_MODULES 加一行，再跑 npm run catalog（dev、build 會自動跑）。
 * 分類名稱要短，1280px 寬的螢幕要放得下整列（英文也是）。
 */
export const TOPIC_GROUP_SPECS: TopicGroupSpec[] = [
  { id: 'society', label: { zh: '社會', en: 'People' }, topics: ['population', 'fertility', 'marriage', 'cities', 'health', 'disease', 'vaccination', 'height', 'blood-types', 'tobacco-alcohol', 'education', 'pisa', 'diet', 'housing', 'religion', 'inequality', 'gender', 'crime', 'laws', 'happiness', 'nobel', 'olympics'] },
  { id: 'economy', label: { zh: '經濟', en: 'Economy' }, topics: ['income', 'wages', 'employment', 'wealth', 'fiscal', 'taxes', 'reserves', 'stock-market', 'house-prices', 'sectors', 'industry', 'agriculture', 'minerals', 'chain-stores'] },
  { id: 'global', label: { zh: '國際', en: 'Global' }, topics: ['trade', 'migration', 'aid', 'china-lending', 'tourism', 'passport', 'military', 'conflict', 'democracy', 'governance', 'organizations', 'un-votes', 'taiwan-diplomacy'] },
  { id: 'energy', label: { zh: '能源', en: 'Energy' }, topics: ['electricity', 'power-plants', 'renewables', 'climate', 'temperature', 'air-quality', 'water-forest', 'plastic', 'ev'] },
  { id: 'tech', label: { zh: '科技與交通', en: 'Tech & transport' }, topics: ['ai', 'semiconductors', 'digital', 'internet-speed', 'developers', 'innovation', 'publications', 'submarine-cables', 'space', 'transport', 'shipping', 'road-safety'] },
  { id: 'geo', label: { zh: '地理', en: 'Geography' }, topics: ['profiles', 'flags', 'language', 'elevation', 'rivers', 'oceans', 'daylight', 'eclipses', 'antipodes', 'magnetic', 'earthquakes', 'typhoons', 'wildfires', 'night-lights', 'world-heritage', 'skyscrapers', 'travel'] },
];

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
  olympics: () => import('./olympics'),
  income: () => import('./income'),
  wages: () => import('./wages'),
  employment: () => import('./employment'),
  wealth: () => import('./wealth'),
  fiscal: () => import('./fiscal'),
  taxes: () => import('./taxes'),
  reserves: () => import('./reserves'),
  'stock-market': () => import('./stock-market'),
  'house-prices': () => import('./house-prices'),
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
  democracy: () => import('./democracy'),
  governance: () => import('./governance'),
  organizations: () => import('./organizations'),
  'un-votes': () => import('./un-votes'),
  'taiwan-diplomacy': () => import('./diplomacy'),
  electricity: () => import('./electricity'),
  'power-plants': () => import('./power-plants'),
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
  profiles: () => import('./profiles'),
  flags: () => import('./flags'),
  language: () => import('./language'),
  elevation: () => import('./elevation'),
  rivers: () => import('./rivers'),
  oceans: () => import('./oceans'),
  daylight: () => import('./daylight'),
  eclipses: () => import('./eclipses'),
  antipodes: () => import('./antipodes'),
  magnetic: () => import('./magnetic'),
  earthquakes: () => import('./earthquakes'),
  typhoons: () => import('./typhoons'),
  wildfires: () => import('./wildfires'),
  'night-lights': () => import('./night-lights'),
  'world-heritage': () => import('./world-heritage'),
  skyscrapers: () => import('./skyscrapers'),
  travel: () => import('./travel'),
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
