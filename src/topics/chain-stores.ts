import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, PointsOverlayDef, ScaleSpec, Text, TopicDefinition } from './types';

const CONVENIENCE = { zh: '便利商店', en: 'Convenience stores' };
const RESTAURANTS = { zh: '速食與咖啡', en: 'Fast food and coffee' };
const BIG_BOX = { zh: '大型賣場', en: 'Big-box stores' };
const BUBBLE_TEA = { zh: '手搖飲', en: 'Bubble tea' };
const SUPERMARKET = { zh: '超市', en: 'Supermarkets' };
const DRUGSTORE = { zh: '藥妝店與藥局', en: 'Drugstores and pharmacies' };
/** 超市、藥妝與藥局（第二十五批 466，pipeline/topics/chain_retail.py）：全聯每百萬人 45 家、奧地利的 SPAR 112 家 */
const RETAIL_THRESHOLDS = [0.5, 2, 5, 10, 25, 50];
const FUEL = { zh: '加油站', en: 'Fuel stations' };
/** 加油站品牌（第二十五批 467）：台灣中油每百萬人 45 座、希臘的 Shell 80 座 */
const FUEL_THRESHOLDS = [1, 5, 10, 20, 40, 60];

/**
 * 這一國 OSM 上店最多的品牌是本地、外來還是跨國加盟（chain_retail.py 的 largest/）。
 * 用「本地／外來」而不是「本國／外國」：香港、澳門最多的銀行、加油站是中國大陸的品牌
 */
const LARGEST: CategoryDef[] = [
  { value: 1, label: { zh: '本地品牌', en: 'Local brand' } },
  { value: 2, label: { zh: '外來品牌', en: 'Brand from elsewhere' } },
  { value: 3, label: { zh: '跨國加盟（SPAR、BENU）或國籍不明', en: 'International franchise (SPAR, BENU) or unknown' } },
];
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
  { id: 'lidl', label: 'Lidl', group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'aldi', label: { zh: 'Aldi（南、北兩家）', en: 'Aldi (Süd and Nord)' }, group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'pyaterochka', label: 'Pyaterochka', group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'walmart', label: { zh: '沃爾瑪（Walmart）', en: 'Walmart' }, group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'carrefour', label: { zh: '家樂福（Carrefour）', en: 'Carrefour' }, group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'spar', label: 'SPAR', group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'pxmart', label: { zh: '全聯福利中心', en: 'PX Mart' }, group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'simple-mart', label: { zh: '美廉社', en: 'Simple Mart' }, group: SUPERMARKET, thresholds: RETAIL_THRESHOLDS },
  { id: 'watsons', label: { zh: '屈臣氏（Watsons）', en: 'Watsons' }, group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'walgreens', label: 'Walgreens', group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'cvs', label: 'CVS', group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'rossmann', label: 'Rossmann', group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'dm', label: 'dm', group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'boots', label: 'Boots', group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'matsukiyo', label: { zh: '松本清（Matsumoto Kiyoshi）', en: 'Matsumoto Kiyoshi' }, group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'cosmed', label: { zh: '康是美', en: 'Cosmed' }, group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'poya', label: { zh: '寶雅', en: 'Poya' }, group: DRUGSTORE, thresholds: RETAIL_THRESHOLDS },
  { id: 'shell', label: { zh: '殼牌（Shell）', en: 'Shell' }, group: FUEL, thresholds: FUEL_THRESHOLDS },
  { id: 'bp', label: 'BP', group: FUEL, thresholds: FUEL_THRESHOLDS },
  { id: 'exxonmobil', label: { zh: '埃克森美孚（Esso、Exxon、Mobil）', en: 'ExxonMobil (Esso, Exxon, Mobil)' }, group: FUEL, thresholds: FUEL_THRESHOLDS },
  { id: 'totalenergies', label: { zh: '道達爾（TotalEnergies）', en: 'TotalEnergies' }, group: FUEL, thresholds: FUEL_THRESHOLDS },
  { id: 'cpc', label: { zh: '台灣中油', en: 'CPC Corporation, Taiwan' }, group: FUEL, thresholds: FUEL_THRESHOLDS },
  { id: 'formosa', label: { zh: '台塑石化', en: 'Formosa Petrochemical' }, group: FUEL, thresholds: FUEL_THRESHOLDS },
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
    zh: `${OSM_CAVEAT.zh} 品牌依店家的 brand:wikidata 認（name-suggestion-index 的標法），沒有標的店只在名稱以品牌名稱開頭、店型對（便利商店、速食店、咖啡店、量販店），而且在品牌有開店的國家時才算（IKEA 只認 brand:wikidata）；同一個品牌 25 公尺內（IKEA、Costco 400 公尺內）的兩個點當成同一家店。IKEA 不含餐廳、規劃訂購點與取貨點，Costco 不含加油站與美食區。已經退出俄羅斯的麥當勞、星巴克、肯德基與退出俄羅斯、白俄羅斯的 IKEA，OSM 上留著的舊標示不算；人口不到 10 萬的地方不算每百萬人的店數。「所有便利商店」是 OSM 上所有的 shop=convenience（不分品牌，含獨立的小店與加油站附設的），各國對便利商店的標法不一。手搖飲的 7 個品牌（2026-11-06 加）是 2026 年 11 月的快照，經 QLever 查 OSM，只依 brand:wikidata 認：OSM 上 CoCo都可 624 家、貢茶 506、喜茶 399、50嵐 380、清心福全 337、霸王茶姬 323、日出茶太 286，前五大有四個是台灣的品牌（CoCo都可、貢茶、50嵐、清心福全；日出茶太也是），霸王茶姬是中國的（Wikidata 的國家）；實際的店數多很多，中國的手搖飲店 OSM 上標得很少：公司自己公布的全球店數是 CoCo都可 5,000 家以上、喜茶 3,500 家以上、貢茶將近 2,200 家（33 個市場）、日出茶太 1,000 家以上（63 個國家與地區），霸王茶姬、50嵐的最新店數沒有核對到（2026-11-07 查官網、新聞稿與年報）；有一國數字的（貢茶美國 240 家以上、喜茶美國 45 家以上與香港 11 家、CoCo都可荷蘭 5 家與比利時 3 家，清心福全官網門市查詢逐筆數出台灣 875 家）在滑過的說明與側欄比涵蓋率。50嵐在中國的 83 家是 OSM 上名稱「1点点」「一点点」、品牌標成 50嵐 的店。超市與藥妝店、藥局（2026-11-07 加）也是經 QLever 查 OSM 2026 年 11 月的快照，只依 brand:wikidata 認：所有有品牌的 shop=supermarket（23 萬個物件），與有品牌的 shop=chemist、amenity=pharmacy（10 萬個；日本的松本清標成藥局、台灣的屈臣氏標成藥妝店，各國用法不一，所以兩個一起算），沒有跟公司公布的店數比。Aldi 是南、北兩家各自經營的公司，合在一起畫；家樂福含家樂福超市；SPAR 是各國獨立經營的加盟招牌。「這一國最大的超市（藥妝）品牌」的國籍用 Wikidata 的總部所在地，屈臣氏、萬寧、惠康改成香港。加油站、銀行分行、電信門市、汽車經銷（2026-11-07 第二輪加）用同樣的做法；加油站可以選 6 個品牌（埃克森美孚把 Esso、Exxon、Mobil 三個招牌合在一起畫，是母公司的角度），銀行只畫「最大的品牌」，不算每人分行數。中國大陸的中石化、中石油，加油站與分行在 OSM 上都嚴重漏標；電信門市（shop=mobile_phone）也包括手機品牌的專賣店（中國大陸最多的是小米）；汽車經銷常被標成維修廠或不標，數字偏低。這個主題的資料檔是 OpenStreetMap 的衍生資料庫，以 ODbL 提供。`,
    en: `${OSM_CAVEAT.en} Brands are identified by the brand:wikidata tag (as used by the name-suggestion-index); untagged shops count only if their name starts with the brand name, the shop type matches (convenience store, fast food, café, warehouse club) and the brand operates in that country (IKEA is matched by brand:wikidata only). Two points of the same brand within 25 m (400 m for IKEA and Costco) count as one store. IKEA excludes restaurants, planning studios and pick-up points; Costco excludes fuel stations and food courts. Outdated entries for McDonald’s, Starbucks and KFC in Russia and IKEA in Russia and Belarus, which these brands have left, are not counted, and places with fewer than 100,000 people have no per-million figure. “All convenience stores” is every shop=convenience on OSM (any brand, including independent shops and those at fuel stations); what gets tagged as a convenience store varies by country. The seven bubble tea brands (added 6 November 2026) are a November 2026 snapshot queried from OSM via QLever and matched by brand:wikidata only: CoCo Fresh Tea & Juice 624 stores, Gong Cha 506, HEYTEA 399, 50 Lan 380, Ching Shin 337, Chagee 323 and Chatime 286 on OSM. Four of the top five are Taiwanese brands (CoCo, Gong Cha, 50 Lan and Ching Shin; Chatime too) and Chagee is from China (country per Wikidata). Real store counts are much higher, and bubble tea shops in China are sparsely mapped: the companies’ own global counts are more than 5,000 for CoCo, more than 3,500 for HEYTEA, nearly 2,200 for Gong Cha (33 markets) and more than 1,000 for Chatime (63 countries and territories), while recent counts for Chagee and 50 Lan could not be verified (company websites, press releases and annual reports checked on 7 November 2026). Where a country figure exists (Gong Cha more than 240 in the US, HEYTEA more than 45 in the US and 11 in Hong Kong, CoCo 5 in the Netherlands and 3 in Belgium, and 875 Ching Shin shops in Taiwan counted from its store finder), the hover text and side panel compare OSM coverage. The 83 50 Lan stores in China are shops named Yidiandian whose brand is tagged as 50 Lan on OSM. Supermarkets, drugstores and pharmacies (added 7 November 2026) are also a November 2026 OSM snapshot via QLever, matched by brand:wikidata only: every branded shop=supermarket (230,000 objects) and every branded shop=chemist or amenity=pharmacy (100,000; usage varies, with Matsumoto Kiyoshi tagged as pharmacies in Japan and Watsons as chemists in Taiwan, so both are counted together); they are not compared with company counts. Aldi’s two separately run companies, Süd and Nord, are shown together; Carrefour includes Carrefour Market; SPAR is a franchise run by independent companies in each country. For “largest brand”, nationality is the brand’s headquarters country on Wikidata, with Watsons, Mannings and Wellcome set to Hong Kong. Fuel stations, bank branches, phone shops and car dealers (a second round on 7 November 2026) use the same method; six fuel brands can be mapped (ExxonMobil combines its Esso, Exxon and Mobil signs, the parent-company view), while banks appear only in “largest brand”, with no branches-per-person figure. Sinopec and PetroChina stations and Chinese bank branches are badly under-mapped on OSM; phone shops (shop=mobile_phone) include handset makers’ stores (Xiaomi leads in mainland China); car dealers are often tagged as repair shops or not at all, so counts are low. The data files of this topic are a derived database of OpenStreetMap, available under the ODbL.`,
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
    {
      id: 'largest',
      label: { zh: '最大的品牌是本地的嗎', en: 'Is the largest chain local?' },
      description: {
        zh: '這一國在 OpenStreetMap 上店最多的超市、藥妝店與藥局、加油站、銀行、電信門市或汽車經銷品牌，總部在本地還是外地，滑過看前三名。超市：94 國裡 68 國是本地品牌，24 國是外來的，例如法國最多的是德國的 Lidl、美國是沃爾瑪但第二是德國的 Aldi、中國大陸是沃爾瑪；台灣是全聯（1,050 家），美廉社第二。藥妝與藥局：71 國裡 22 國是外來品牌，台灣、中國大陸、馬來西亞、泰國、土耳其都是香港的屈臣氏（台灣 386 家，康是美 315、寶雅 236），波蘭、匈牙利是德國的 Rossmann。加油站：147 國裡 82 國最多的是外來品牌（美國最多的是英國的 Shell、英國與加拿大是 Esso），日本的 ENEOS、印度的 Indian Oil、墨西哥的 Pemex、西班牙的 Repsol、中國大陸的中石化、台灣的中油（1,045 座，台塑石化 108）是本地的。銀行：121 國裡 89 國是本地銀行，台灣是合作金庫（252 家）；香港、澳門最多的是中國銀行。電信門市：76 國裡 42 國是外來品牌（德國最多的是英國的 Vodafone、拉丁美洲多半是墨西哥的 Claro），台灣是台灣大哥大。汽車經銷：60 國裡只有 12 國最多的是本地車廠（日本的 Toyota、美國的 Ford、德國的 Volkswagen、法國的 Renault、印度的 Maruti Suzuki、俄羅斯的 Lada…），台灣也是 Toyota（70 家），本土的納智捷只有個位數。只算 OSM 上有 brand:wikidata、最大的品牌 10 家以上的國家，不是市占率。',
        en: 'Whether the supermarket, drugstore and pharmacy, fuel, bank, phone shop or car dealer brand with the most outlets mapped on OpenStreetMap in each country is headquartered locally or elsewhere; hover for the top three. For supermarkets, 68 of 94 countries are led by a local brand and 24 by one from elsewhere: France’s largest is Germany’s Lidl, the US has Walmart with Germany’s Aldi second, and mainland China has Walmart; Taiwan’s is PX Mart (1,050 shops), with Simple Mart second. For drugstores and pharmacies, 22 of 71 are led by a brand from elsewhere: Hong Kong’s Watsons in Taiwan (386, against 315 for Cosmed and 236 for Poya), mainland China, Malaysia, Thailand and Turkey, and Germany’s Rossmann in Poland and Hungary. For fuel, 82 of 147 countries are led by a brand from elsewhere (Britain’s Shell in the US, Esso in the UK and Canada), while Japan’s ENEOS, India’s Indian Oil, Mexico’s Pemex, Spain’s Repsol, mainland China’s Sinopec and Taiwan’s CPC (1,045 stations, against 108 for Formosa) are local. For banks, 89 of 121 are led by a local bank, Taiwan’s being Taiwan Cooperative Bank (252 branches); Bank of China leads in Hong Kong and Macao. For phone shops, 42 of 76 are led by a brand from elsewhere (Britain’s Vodafone in Germany, Mexico’s Claro across much of Latin America); Taiwan’s is Taiwan Mobile. For car dealers, only 12 of 60 are led by a local carmaker (Toyota in Japan, Ford in the US, Volkswagen in Germany, Renault in France, Maruti Suzuki in India, Lada in Russia…); Taiwan’s is also Toyota (70), with the local Luxgen in single figures. Only outlets with brand:wikidata count, in countries where the largest brand has at least 10; this is not market share.',
      },
      unit: '',
      file: 'largest/{item}.json',
      dimension: {
        label: { zh: '業態', en: 'Type' },
        options: [
          { id: 'supermarket', label: SUPERMARKET },
          { id: 'drugstore', label: DRUGSTORE },
          { id: 'fuel', label: FUEL },
          { id: 'bank', label: { zh: '銀行分行', en: 'Bank branches' } },
          { id: 'mobile', label: { zh: '電信與手機門市', en: 'Phone shops' } },
          { id: 'car', label: { zh: '汽車經銷', en: 'Car dealers' } },
        ],
        defaultOption: 'supermarket',
      },
      layer: { kind: 'categorical', categories: LARGEST },
      format: (v) => tr(LARGEST.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      timeless: true,
      missing: { zh: 'OSM 上最大的品牌不到 10 家', en: 'The largest brand has fewer than 10 shops on OSM' },
    },
  ],
};
