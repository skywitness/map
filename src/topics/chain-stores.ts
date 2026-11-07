import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, PointsOverlayDef, ScaleSpec, Text, TopicDefinition } from './types';

const CONVENIENCE = { zh: '便利商店', en: 'Convenience stores' };
const RESTAURANTS = { zh: '速食與咖啡', en: 'Fast food and coffee' };
const BIG_BOX = { zh: '大型賣場', en: 'Big-box stores' };
const BUBBLE_TEA = { zh: '手搖飲', en: 'Bubble tea' };
/** 手搖飲品牌（第二十四批 415，pipeline/topics/chain_bubble_tea.py）：密度都低，同一組門檻；台灣的 50嵐、清心福全每百萬人十幾家 */
const BUBBLE_THRESHOLDS = [0.1, 0.25, 0.5, 1, 2.5, 10];

/** 這一國 OSM 上店最多的手搖飲品牌（2026-11-07，415 的補強）：值是 chain_bubble_tea.py 的 BRANDS 順序 */
const TOP_BUBBLE_TEA: CategoryDef[] = [
  { value: 1, label: { zh: 'CoCo都可（台灣）', en: 'CoCo Fresh Tea & Juice (Taiwan)' } },
  { value: 2, label: { zh: '貢茶（台灣）', en: 'Gong Cha (Taiwan)' } },
  { value: 7, label: { zh: '日出茶太（台灣）', en: 'Chatime (Taiwan)' } },
  { value: 5, label: { zh: '清心福全（台灣）', en: 'Ching Shin (Taiwan)' } },
  { value: 4, label: { zh: '50嵐（台灣）', en: '50 Lan (Taiwan)' } },
  { value: 3, label: { zh: '喜茶（中國）', en: 'HEYTEA (China)' } },
  { value: 6, label: { zh: '霸王茶姬（中國）', en: 'Chagee (China)' } },
];

/**
 * 地圖上可選的品牌（與 pipeline/topics/chain_stores.py 的 BRANDS 對應）。
 * 每個品牌的密度差很多（台灣的 7-Eleven 每百萬人三百多家、IKEA 每百萬人不到一家），分級門檻各自訂，
 * 最後一級都讓台灣、日本這種密度最高的國家突出來。
 */
export const BRANDS: { id: string; label: Text; group: Text; thresholds: number[] }[] = [
  { id: '7-eleven', label: '7-Eleven', group: CONVENIENCE, thresholds: [1, 10, 25, 50, 100, 200] },
  {
    id: 'familymart',
    label: { zh: '全家（FamilyMart）', en: 'FamilyMart' },
    group: CONVENIENCE,
    thresholds: [1, 10, 25, 50, 100, 150],
  },
  { id: 'lawson', label: 'Lawson', group: CONVENIENCE, thresholds: [0.5, 2, 5, 10, 25, 50] },
  { id: 'mcdonalds', label: { zh: '麥當勞', en: "McDonald's" }, group: RESTAURANTS, thresholds: [1, 3, 5, 10, 20, 30] },
  { id: 'starbucks', label: { zh: '星巴克', en: 'Starbucks' }, group: RESTAURANTS, thresholds: [1, 3, 5, 10, 20, 30] },
  { id: 'kfc', label: { zh: '肯德基（KFC）', en: 'KFC' }, group: RESTAURANTS, thresholds: [0.5, 1, 3, 5, 10, 20] },
  { id: 'subway', label: 'Subway', group: RESTAURANTS, thresholds: [0.5, 1, 3, 5, 10, 30] },
  { id: 'ikea', label: 'IKEA', group: BIG_BOX, thresholds: [0.05, 0.1, 0.2, 0.4, 0.8, 1.5] },
  { id: 'costco', label: 'Costco', group: BIG_BOX, thresholds: [0.05, 0.1, 0.2, 0.4, 0.8, 1.5] },
  { id: 'coco', label: { zh: 'CoCo都可', en: 'CoCo Fresh Tea & Juice' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: 'gong-cha', label: { zh: '貢茶（Gong Cha）', en: 'Gong Cha' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: 'heytea', label: { zh: '喜茶（HEYTEA）', en: 'HEYTEA' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: '50-lan', label: { zh: '50嵐', en: '50 Lan' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: 'ching-shin', label: { zh: '清心福全', en: 'Ching Shin' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: 'chagee', label: { zh: '霸王茶姬（Chagee）', en: 'Chagee' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
  { id: 'chatime', label: { zh: '日出茶太（Chatime）', en: 'Chatime' }, group: BUBBLE_TEA, thresholds: BUBBLE_THRESHOLDS },
];

/**
 * 子項目多一個「所有便利商店」：OSM 上所有 shop=convenience（不分品牌），跟品牌用同樣的兩個指標
 * （做成第三個指標的話，控制列在 1280px 的英文版放不下一行）。沒有店家位置的點（全球約 80 萬家，檔案太大）。
 */
export const ALL_CONVENIENCE = 'convenience';
const OPTIONS = [
  ...BRANDS.slice(0, 3),
  {
    id: ALL_CONVENIENCE,
    label: { zh: '所有便利商店', en: 'All convenience stores' },
    group: CONVENIENCE,
    thresholds: [25, 50, 100, 200, 400, 800],
  },
  ...BRANDS.slice(3),
];

export const brandLabel = (id: string) => OPTIONS.find((b) => b.id === id)?.label ?? id;

const STORES = { zh: '家', en: ['store', 'stores'] as const };
const PER_MILLION = { zh: '家/百萬人', en: 'per million people' };

/** 每百萬人的店數：不到 10 留一位小數，IKEA、Costco 這種不到 1 的留兩位（不到 0.01 留三位，中國的 Costco），0 就寫 0 */
export const perMillion = (v: number) => (v === 0 ? '0' : fixed(v, v < 0.01 ? 3 : v < 1 ? 2 : v < 10 ? 1 : 0));
export const storeCount = (v: number) =>
  `${fixed(v, 0)} ${tr({ zh: STORES.zh, en: STORES.en[Math.round(v) === 1 ? 0 : 1] })}`;
const densityText = (v: number) =>
  tr({ zh: `每百萬人 ${perMillion(v)} 家`, en: `${perMillion(v)} per million people` });
const tick = (v: number) => fixed(v, v < 0.1 ? 2 : v % 1 ? 1 : 0);
const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });

/**
 * WPP 2026 年人口不到 10 萬的地方：不算每百萬人的店數（一兩家店就是每百萬人幾十家），店數照常有。
 * 跟 pipeline/topics/chain_stores.py 的 MIN_POPULATION 算出來的清單一樣，build() 會比對，對不上時報錯
 */
// prettier-ignore
const SMALL_POPULATION = [
  'AIA', 'AND', 'ASM', 'ATG', 'BES', 'BLM', 'BMU', 'COK', 'CYM', 'DMA', 'FLK', 'FRO', 'GGY', 'GIB', 'GRL', 'IMN', 'KNA',
  'LIE', 'MAF', 'MCO', 'MHL', 'MNP', 'MSR', 'NIU', 'NRU', 'PLW', 'SHN', 'SMR', 'SPM', 'SXM', 'TCA', 'TKL', 'TUV', 'VAT',
  'VCT', 'VGB', 'VIR', 'WLF',
];
const SMALL_REASON = {
  zh: '人口不到 10 萬，一兩家店就差很多，不算每百萬人（看「店數」）',
  en: 'Population under 100,000, where one or two stores swing the rate (see Store count)',
};

const OSM_CAVEAT = {
  zh: '店數是 OpenStreetMap 上標示的店家（志願者繪製的地圖，2026 年 10 月的快照），不是官方店數；各國標得完不完整差很多，側欄與滑過國家時列出跟公司公布店數的比較（涵蓋率）。',
  en: 'Counts are the stores mapped on OpenStreetMap (a volunteer-built map; October 2026 snapshot), not official store counts. Completeness varies a lot by country; the side panel and the map tooltip compare them with the companies’ own published counts (coverage).',
};

/** 選到的品牌的店家位置：放大才畫（縮小時上萬個點會蓋住面量圖），一個品牌一個檔，只下載選到的品牌 */
const STORE_POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'stores',
  file: 'points/{item}.json',
  label: { zh: '店家位置', en: 'Store locations' },
  indicators: ['density', 'stores'],
  items: BRANDS.map((b) => b.id),
  radius: 1.8,
  color: MAP_TOKENS.accent,
  minZoom: 5,
  // 2026-11-02（新5）：放大到 5 級之前畫店家的熱度圖（東京、曼谷、台北這些密集的地方一眼看得出來），放大後換成一家家的點
  heatmap: {
    maxZoom: 4,
    intensity: 0.04,
    ramp: 'violet',
    label: { zh: '縮小時畫成店家的密度（越深越密），放大後是一家家的店', en: 'Store density when zoomed out (darker is denser); individual stores when zoomed in' },
  },
  tooltip: (_p, ctx) => ({
    title: tr(brandLabel(ctx.item ?? '')),
    detail: tr({ zh: 'OpenStreetMap 上標示的店家', en: 'Store mapped on OpenStreetMap' }),
  }),
};

export const chainStores: TopicDefinition = {
  id: 'chain-stores',
  title: { zh: '便利商店與連鎖品牌', en: 'Convenience stores and chains' },
  shortTitle: { zh: '連鎖品牌', en: 'Chain stores' },
  defaultIndicator: 'density',
  defaultYear: 2026,
  dimension: {
    label: { zh: '品牌', en: 'Brand' },
    options: OPTIONS.map(({ id, label, group }) => ({ id, label, group })),
    defaultOption: '7-eleven',
  },
  sources: [
    {
      name: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
    {
      name: { zh: 'UN World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '各公司公布的店數（年報、10-K、法說會簡報、官網，出處見側欄）',
        en: 'Store counts published by each company (annual reports, 10-Ks, investor decks, corporate sites; sources in the side panel)',
      },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/sources/chain_official.py',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
  ],
  note: {
    zh: `${OSM_CAVEAT.zh} 品牌依店家的 brand:wikidata 認（name-suggestion-index 的標法），沒有標的店只在名稱以品牌名稱開頭、店型對（便利商店、速食店、咖啡店、量販店），而且在品牌有開店的國家時才算（IKEA 只認 brand:wikidata）；同一個品牌 25 公尺內（IKEA、Costco 400 公尺內）的兩個點當成同一家店。IKEA 不含餐廳、規劃訂購點與取貨點，Costco 不含加油站與美食區。已經退出俄羅斯的麥當勞、星巴克、肯德基與退出俄羅斯、白俄羅斯的 IKEA，OSM 上留著的舊標示不算；人口不到 10 萬的地方不算每百萬人的店數。「所有便利商店」是 OSM 上所有的 shop=convenience（不分品牌，含獨立的小店與加油站附設的），各國對便利商店的標法不一。手搖飲的 7 個品牌（2026-11-06 加）是 2026 年 11 月的快照，經 QLever 查 OSM，只依 brand:wikidata 認：OSM 上 CoCo都可 624 家、貢茶 506、喜茶 399、50嵐 380、清心福全 337、霸王茶姬 323、日出茶太 286，前五大有四個是台灣的品牌（CoCo都可、貢茶、50嵐、清心福全；日出茶太也是），霸王茶姬是中國的（Wikidata 的國家）；實際的店數多很多，中國的手搖飲店 OSM 上標得很少：公司自己公布的全球店數是 CoCo都可 5,000 家以上、喜茶 3,500 家以上、貢茶將近 2,200 家（33 個市場）、日出茶太 1,000 家以上（63 個國家與地區），霸王茶姬、50嵐的最新店數沒有核對到（2026-11-07 查官網、新聞稿與年報）；有一國數字的（貢茶美國 240 家以上、喜茶美國 45 家以上與香港 11 家、CoCo都可荷蘭 5 家與比利時 3 家，清心福全官網門市查詢逐筆數出台灣 875 家）在滑過的說明與側欄比涵蓋率。50嵐在中國的 83 家是 OSM 上名稱「1点点」「一点点」、品牌標成 50嵐 的店。這個主題的資料檔是 OpenStreetMap 的衍生資料庫，以 ODbL 提供。`,
    en: `${OSM_CAVEAT.en} Brands are identified by the brand:wikidata tag (as used by the name-suggestion-index); untagged shops count only if their name starts with the brand name, the shop type matches (convenience store, fast food, café, warehouse club) and the brand operates in that country (IKEA is matched by brand:wikidata only). Two points of the same brand within 25 m (400 m for IKEA and Costco) count as one store. IKEA excludes restaurants, planning studios and pick-up points; Costco excludes fuel stations and food courts. Outdated entries for McDonald’s, Starbucks and KFC in Russia and IKEA in Russia and Belarus, which these brands have left, are not counted, and places with fewer than 100,000 people have no per-million figure. “All convenience stores” is every shop=convenience on OSM (any brand, including independent shops and those at fuel stations); what gets tagged as a convenience store varies by country. The seven bubble tea brands (added 6 November 2026) are a November 2026 snapshot queried from OSM via QLever and matched by brand:wikidata only: CoCo Fresh Tea & Juice 624 stores, Gong Cha 506, HEYTEA 399, 50 Lan 380, Ching Shin 337, Chagee 323 and Chatime 286 on OSM. Four of the top five are Taiwanese brands (CoCo, Gong Cha, 50 Lan and Ching Shin; Chatime too) and Chagee is from China (country per Wikidata). Real store counts are much higher, and bubble tea shops in China are sparsely mapped: the companies’ own global counts are more than 5,000 for CoCo, more than 3,500 for HEYTEA, nearly 2,200 for Gong Cha (33 markets) and more than 1,000 for Chatime (63 countries and territories), while recent counts for Chagee and 50 Lan could not be verified (company websites, press releases and annual reports checked on 7 November 2026). Where a country figure exists (Gong Cha more than 240 in the US, HEYTEA more than 45 in the US and 11 in Hong Kong, CoCo 5 in the Netherlands and 3 in Belgium, and 875 Ching Shin shops in Taiwan counted from its store finder), the hover text and side panel compare OSM coverage. The 83 50 Lan stores in China are shops named Yidiandian whose brand is tagged as 50 Lan on OSM. The data files of this topic are a derived database of OpenStreetMap, available under the ODbL.`,
  },
  panelExtra: () => import('./panels/ChainStoresPanel'),
  overlays: [STORE_POINTS],
  indicators: [
    {
      id: 'density',
      label: { zh: '每百萬人店數', en: 'Stores per million' },
      description: {
        zh: '選定品牌在 OpenStreetMap 上的店數 ÷ 人口（百萬人），放大後畫出每一家店的位置。OSM 不是官方店數，各國完整度差很多，滑過國家看跟公司公布店數的比較。「所有便利商店」是不分品牌的 shop=convenience。',
        en: 'Stores of the selected brand mapped on OpenStreetMap per million people; zoom in to see each store. OSM is not an official count and completeness varies by country: hover over a country to compare with the company’s published count. “All convenience stores” counts every shop=convenience, any brand.',
      },
      unit: PER_MILLION,
      file: 'density/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: sequential(BRANDS[0].thresholds),
        itemScales: Object.fromEntries(OPTIONS.map((b) => [b.id, sequential(b.thresholds)])),
      },
      format: densityText,
      formatTick: tick,
      noValue: Object.fromEntries(SMALL_POPULATION.map((iso3) => [iso3, SMALL_REASON])),
    },
    {
      id: 'stores',
      label: { zh: '店數', en: 'Store count' },
      description: {
        zh: '選定品牌在 OpenStreetMap 上的店數（圓的面積與店數成正比），放大後畫出每一家店的位置。不是官方店數，滑過國家看跟公司公布店數的比較。',
        en: 'Stores of the selected brand mapped on OpenStreetMap (circle area proportional to the count); zoom in to see each store. Not an official count: hover over a country to compare with the company’s published count.',
      },
      unit: { zh: '家', en: 'stores' },
      file: 'stores/{item}.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: storeCount,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'top-bubble-tea',
      label: { zh: '店最多的手搖飲品牌', en: 'Leading bubble tea brand' },
      description: {
        zh: '七個手搖飲品牌裡，這一國在 OpenStreetMap 上店最多的是哪一個（七個合計 3 家以上的 33 國），滑過看各品牌的店數。CoCo都可在 15 國最多（美洲、歐洲大半），貢茶 9 國（日本、韓國、美國、香港、新加坡、越南…），日出茶太 5 國（澳洲、英國、愛爾蘭、印尼、菲律賓），喜茶是中國與澳門，霸王茶姬是馬來西亞；台灣是清心福全（OSM 上 337 家，50嵐 297 家）。七個品牌裡五個來自台灣。只算這七個品牌，各國 OSM 標得完不完整差很多，不是市占率。',
        en: 'Which of the seven bubble tea brands has the most shops mapped on OpenStreetMap in each country (33 countries with at least 3 shops of the seven); hover for each brand’s count. CoCo leads in 15 countries (much of the Americas and Europe), Gong Cha in 9 (Japan, South Korea, the US, Hong Kong, Singapore, Vietnam…), Chatime in 5 (Australia, the UK, Ireland, Indonesia, the Philippines), HEYTEA in China and Macao, and Chagee in Malaysia; in Taiwan it is Ching Shin (337 shops on OSM, against 297 for 50 Lan). Five of the seven brands are Taiwanese. Only these seven brands count, and OSM completeness varies widely, so this is not market share.',
      },
      unit: '',
      file: 'top-bubble-tea.json',
      layer: { kind: 'categorical', categories: TOP_BUBBLE_TEA },
      format: (v) => tr(TOP_BUBBLE_TEA.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      timeless: true,
      missing: { zh: 'OSM 上這七個品牌合計不到 3 家', en: 'Fewer than 3 shops of the seven brands on OSM' },
    },
  ],
};
