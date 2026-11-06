import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import { tr } from '../i18n';
import { MAP_TOKENS } from '../theme/tokens';
import { PRODUCTS } from './agriculture';
import type { FlowDirection, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 貿易流向：出口、進口兩個指標就是地圖上的「出口／進口」切換，商品是子項目選單。
 * 獨立成一個主題而不是併進農業：農業已有 6 個指標（下拉選單），流向圖的操作方式
 * （先點國家、弧線、方向切換）跟其他指標完全不同；全部商品的貿易也不屬於農業。
 */

// 跟農業主題同一組農產品，但貿易是用金額加總，乳品是所有乳製品的合計（不是生乳當量）
const LABEL_OVERRIDES: Record<string, Text> = {
  milk: { zh: '乳製品', en: 'Dairy products' },
  pork: { zh: '豬肉（含加工品）', en: 'Pork (incl. processed)' },
};

const TOTALS = { zh: '合計', en: 'Totals' };

const MADE = { zh: '工業製品', en: 'Manufactured goods' };
const LUXURY = { zh: '貴金屬、奢侈品與酒', en: 'Precious goods, luxuries and drinks' };
const RAW = { zh: '原料與回收物', en: 'Raw materials and scrap' };

const GOODS_MADE = [
  { id: 'cars', label: { zh: '乘用車（HS 8703）', en: 'Passenger cars (HS 8703)' }, group: MADE },
  { id: 'electric-cars', label: { zh: '純電動乘用車（2017 年起）', en: 'Battery-electric cars (from 2017)' }, group: MADE },
  { id: 'aircraft', label: { zh: '飛機與直升機（HS 8802）', en: 'Aircraft and helicopters (HS 8802)' }, group: MADE },
  { id: 'computers', label: { zh: '電腦與伺服器（HS 8471）', en: 'Computers and servers (HS 8471)' }, group: MADE },
  { id: 'phones', label: { zh: '手機（2017 年起）', en: 'Mobile phones (from 2017)' }, group: MADE },
  { id: 'lithium-batteries', label: { zh: '鋰離子電池（2017 年起）', en: 'Lithium-ion batteries (from 2017)' }, group: MADE },
  // 第二十二批 386（2026-11-05）：HS 847950 只是「其他未列名的工業機器人」，焊接、噴塗、搬運用的報在各自的稅號，是下限
  { id: 'industrial-robots', label: { zh: '工業機器人（2017 年起，HS 847950）', en: 'Industrial robots (from 2017, HS 847950)' }, group: MADE },
  { id: 'pharma', label: { zh: '藥品（HS 3004）', en: 'Medicines (HS 3004)' }, group: MADE },
  { id: 'apparel', label: { zh: '成衣（第 61、62 章）', en: 'Clothing (HS 61, 62)' }, group: MADE },
  { id: 'footwear', label: { zh: '鞋（第 64 章）', en: 'Footwear (HS 64)' }, group: MADE },
];
// 第二十四批 413（2026-11-06，pipeline/topics/trade_leisure.py）：HS 第 95 章的運動器材與遊戲用品（玩具從工業製品搬過來），BACI HS92（1995 年起）。
// 運動器材不含運動服、運動鞋、自行車；遊戲用品是實體的遊戲機、牌與桌遊，數位下載的遊戲不在貿易統計裡
const LEISURE = { zh: '玩具、遊戲與運動用品（第 95 章）', en: 'Toys, games and sports goods (HS 95)' };
const GOODS_LEISURE = [
  { id: 'toys', label: { zh: '玩具（HS 9501–9503）', en: 'Toys (HS 9501–9503)' }, group: LEISURE },
  { id: 'sports-goods', label: { zh: '運動器材（HS 9506）', en: 'Sports equipment (HS 9506)' }, group: LEISURE },
  { id: 'fitness-equipment', label: { zh: '健身與田徑器材（HS 950691）', en: 'Gym and athletics equipment (HS 950691)' }, group: LEISURE },
  { id: 'games', label: { zh: '遊戲機、撲克牌與桌遊（HS 9504）', en: 'Game consoles, cards and board games (HS 9504)' }, group: LEISURE },
  { id: 'video-game-consoles', label: { zh: '電視遊戲機（2017 年起，HS 950450）', en: 'Video game consoles (from 2017, HS 950450)' }, group: LEISURE },
  { id: 'playing-cards', label: { zh: '撲克牌與集換式卡牌（HS 950440）', en: 'Playing and trading cards (HS 950440)' }, group: LEISURE },
];
const GOODS_LUXURY = [
  { id: 'gold', label: { zh: '黃金（HS 7108）', en: 'Gold (HS 7108)' }, group: LUXURY },
  { id: 'diamonds-rough', label: { zh: '鑽石原石', en: 'Rough diamonds' }, group: LUXURY },
  { id: 'diamonds-cut', label: { zh: '切磨好的鑽石', en: 'Cut diamonds' }, group: LUXURY },
  { id: 'art', label: { zh: '藝術品與古董（第 97 章）', en: 'Art and antiques (HS 97)' }, group: LUXURY },
  { id: 'wine', label: { zh: '葡萄酒（HS 2204）', en: 'Wine (HS 2204)' }, group: LUXURY },
  { id: 'whisky', label: { zh: '威士忌（HS 220830）', en: 'Whisky (HS 220830)' }, group: LUXURY },
  { id: 'human-hair', label: { zh: '人髮（HS 0501、6703）', en: 'Human hair (HS 0501, 6703)' }, group: LUXURY },
  { id: 'wigs', label: { zh: '假髮（HS 6704）', en: 'Wigs (HS 6704)' }, group: LUXURY },
];
// 回收物與化肥另有公噸的一組指標（export-t、import-t）
const GOODS_TONNES = [
  { id: 'waste-paper', label: { zh: '廢紙（HS 4707）', en: 'Waste paper (HS 4707)' }, group: RAW },
  { id: 'scrap-iron', label: { zh: '廢鋼鐵（HS 7204）', en: 'Iron and steel scrap (HS 7204)' }, group: RAW },
  { id: 'fertilizers', label: { zh: '化肥合計（HS 3102–3105）', en: 'All fertilisers (HS 3102–3105)' }, group: RAW },
  { id: 'fertilizers-n', label: { zh: '氮肥（HS 3102）', en: 'Nitrogen fertilisers (HS 3102)' }, group: RAW },
  { id: 'fertilizers-p', label: { zh: '磷肥與複合肥（HS 3103、3105）', en: 'Phosphate and mixed fertilisers (HS 3103, 3105)' }, group: RAW },
  { id: 'fertilizers-k', label: { zh: '鉀肥（HS 3104）', en: 'Potash fertilisers (HS 3104)' }, group: RAW },
];
const GOODS_RAW = [
  { id: 'logs', label: { zh: '原木（HS 4403）', en: 'Logs (HS 4403)' }, group: RAW },
  // 第二十批 307（2026-11-04）：藥用、香料與殺蟲用的植物，含古柯葉、罌粟稈，不等於中藥材
  { id: 'medicinal-plants', label: { zh: '藥用植物（HS 1211）', en: 'Medicinal plants (HS 1211)' }, group: RAW },
  ...GOODS_TONNES,
];

const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` });

const ITEMS = [
  { id: 'all', label: { zh: '全部商品', en: 'All goods' }, group: TOTALS },
  { id: 'agri', label: { zh: '農產品合計', en: 'All agricultural products' }, group: TOTALS },
  ...PRODUCTS.map((p) => ({ ...p, label: LABEL_OVERRIDES[p.id] ?? p.label })),
  // 二手衣（2026-10-29 擴充）：CEPII BACI HS92 的 HS 6309，1995 年起
  { id: 'used-clothing', label: { zh: '二手衣（舊衣，HS 6309）', en: 'Used clothing (HS 6309)' }, group: { zh: '其他商品', en: 'Other goods' } },
  // 貿易的商品流向（2026-10-30 擴充，pipeline/topics/trade_goods.py）：BACI HS92（1995 年起）；純電車、手機、鋰電池用 HS17（2017 年起）
  ...GOODS_MADE,
  ...GOODS_LEISURE,
  ...GOODS_LUXURY,
  ...GOODS_RAW,
];

function flow(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: direction,
    label,
    description,
    unit: { zh: '美元', en: 'US$' },
    file: `${direction}/{item}.json`,
    layer: { kind: 'flow', file: 'flows/{item}/{year}.json', direction },
    format: (v) => usd(formatLargeNumber(v)),
    formatTick: formatLargeTick,
    shareOfWorld: true,
  };
}

/** 公噸的流向（回收物與化肥，2026-10-30）：只有這幾種商品，子項目選單是指標自己的 */
function flowTonnes(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: `${direction}-t`,
    label,
    description,
    unit: TONNES,
    file: `${direction}-t/{item}.json`,
    layer: { kind: 'flow', file: 'flows-t/{item}/{year}.json', direction },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
    dimension: { label: { zh: '商品', en: 'Product' }, options: GOODS_TONNES, defaultOption: 'waste-paper' },
  };
}

/**
 * 1962 年起的長期流向（2026-11-02，製作手冊第十七批 270，pipeline/topics/atlas_sitc.py）：Harvard Atlas 的 SITC Rev. 2，
 * 只有全部商品（檔名沒有 {item}，商品選單不出現）。使用者決定另做一組、整段用 Atlas，不接 BACI 的「出口／進口」
 */
function flowLong(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: `${direction}-sitc`,
    label,
    description,
    unit: { zh: '美元', en: 'US$' },
    file: `${direction}-sitc/all.json`,
    layer: { kind: 'flow', file: 'flows-sitc/all/{year}.json', direction },
    format: (v) => usd(formatLargeNumber(v)),
    formatTick: formatLargeTick,
    shareOfWorld: true,
    defaultYear: 1975,
  };
}

/**
 * 服務出口的組成（2026-11-02，製作手冊第十七批 271，pipeline/topics/services_trade.py）：WDI 轉載的 IMF 國際收支，
 * 台灣用中央銀行國際收支。pipeline 的 GROUPS 同一組 id 與順序；顏色依順序取 MAP_TOKENS.categorical（圓餅、側欄的堆疊圖一樣）
 */
export const SERVICE_GROUPS: { id: string; label: Text }[] = [
  { id: 'transport', label: { zh: '運輸', en: 'Transport' } },
  { id: 'travel', label: { zh: '旅行', en: 'Travel' } },
  { id: 'ict', label: { zh: '電信、電腦與資訊', en: 'Telecom, computer and information' } },
  { id: 'finance', label: { zh: '保險與金融', en: 'Insurance and finance' } },
  { id: 'other', label: { zh: '其他服務', en: 'Other services' } },
];

/** 側欄畫服務出口組成的指標 */
export const SERVICES_INDICATORS = ['services-export', 'services-mix', 'services-share'];

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;

export const trade: TopicDefinition = {
  id: 'trade',
  title: { zh: '國際貿易流向', en: 'International trade flows' },
  shortTitle: { zh: '貿易', en: 'Trade' },
  defaultIndicator: 'export',
  defaultYear: 2023,
  sources: [
    {
      name: 'CEPII, BACI',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
    {
      name: { zh: 'FAO, FAOSTAT（詳細貿易矩陣）', en: 'FAO, FAOSTAT (detailed trade matrix)' },
      url: 'https://www.fao.org/faostat/en/#data/TM',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Harvard Growth Lab, Atlas of Economic Complexity：International Trade Data (SITC, Rev. 2)（1962 年起的長期流向）',
        en: 'Harvard Growth Lab, Atlas of Economic Complexity: International Trade Data (SITC, Rev. 2) (long-run flows from 1962)',
      },
      url: 'https://doi.org/10.7910/DVN/H8SFD2',
      license: 'CC0 1.0',
    },
    {
      name: {
        zh: '世界銀行 WDI（服務出口與組成，轉載 IMF 國際收支）',
        en: 'World Bank, WDI (service exports and their composition; IMF balance of payments)',
      },
      url: 'https://data.worldbank.org/indicator/BX.GSR.NFSV.CD',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '中央銀行 國際收支統計（台灣的服務出口）', en: 'Central Bank of the Republic of China (Taiwan), balance of payments (Taiwan’s service exports)' },
      url: 'https://cpx.cbc.gov.tw/',
      license: { zh: '政府資料開放授權條款－第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '世界銀行 WDI（貿易占 GDP）', en: 'World Bank, WDI (trade, % of GDP)' },
      url: 'https://data.worldbank.org/indicator/NE.TRD.GNFS.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處（國民所得統計，台灣的貿易占 GDP）', en: 'DGBAS, Taiwan (national accounts; Taiwan’s trade share of GDP)' },
      url: 'https://data.gov.tw/dataset/44224',
      license: { zh: '政府資料開放授權條款－第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh:
      '全部商品為 CEPII BACI（1995–2024 年；1995–2016 年用 HS 1992 版、2017 年起用 HS 2017 版），已調和進出口雙方的申報，以離岸價（FOB）計；台灣在 UN Comtrade 與 BACI 列為「Other Asia, nes」。' +
      '農產品為 FAOSTAT 詳細貿易矩陣（2000 年起），出口以出口國、進口以進口國的申報為準，該年沒有申報的國家改用貿易夥伴的申報。' +
      '每個國家只列前 15 大夥伴，占比以對所有夥伴的總額計算。' +
      '二手衣是 BACI HS92 版的舊衣（HS 6309，1995 年起，以金額計，不含碎布 6310）：2024 年全球約 47 億美元，美國、中國、英國、德國、韓國出口最多；阿聯、巴基斯坦這類是分類與轉口中心，衣服最後去哪裡要再看它們的出口。' +
      '汽車、手機、藥品、黃金、鑽石、回收物、化肥、運動器材、遊戲用品等 31 種商品是 BACI HS92 版（1995 年起，以金額計；回收物與化肥另有公噸）；HS92 分不開的純電車（870380）、手機（851712）、鋰電池（850760）、電視遊戲機（950450）用 HS17 版，2017 年起。' +
      '運動器材（HS 9506）不含運動服、運動鞋與自行車；健身與田徑器材（950691）是跑步機、重訓器材、瑜珈墊都在內的大項。遊戲用品（HS 9504）是實體的遊戲機、投幣式遊戲機、撲克牌與桌遊（也含撞球用品），數位下載的遊戲不在貿易統計裡；撲克牌（950440）含寶可夢、遊戲王這類集換式卡牌。' +
      '藥用植物是 HS 1211「主要供香料、藥用、殺蟲、殺菌用的植物」（甘草、人參、古柯葉、罌粟稈與其他，九成以上是「其他」），也含薰衣草這類香料植物；中藥材還散在別的章節（植物萃取物 1302、紅棗枸杞 0813、薑黃 0910…），所以不等於中藥材。全球一年約幾十億美元，跟藥品（HS 3004）差兩個數量級。' +
      '瑞士、阿聯、香港、比利時、新加坡、荷蘭這類精煉、轉口與物流中心的進出口很大，不代表在那裡生產或使用；品牌國也不是產地。黃金不含央行之間的貨幣用黃金；鑽石的工業用鑽石不列；化肥的磷酸銨在 3105。' +
      '貿易依存度是世界銀行 WDI 的商品與服務出口加進口占 GDP（1960 年起），台灣用主計總處的國民所得統計自行計算；香港、新加坡、盧森堡超過 300% 是轉口貿易與跨國企業的帳，不代表「依賴」；世界合計的最新一年國家數不全，只畫到 2024 年。' +
      '長期出口、長期進口是 Harvard Atlas 的 SITC Rev. 2（1962–2024 年），UN Comtrade 的申報由 Growth Lab 用雙邊申報互相調和；台灣沒有向聯合國申報，台灣的值來自貿易夥伴的申報。1991 年以前的蘇聯算在俄羅斯，捷克斯洛伐克、南斯拉夫、東德沒有資料（拆分後的國家從獨立那一年起才有）。調和方法跟 BACI 不同，1995 年以後兩份的數字不一樣（2024 年台灣出口 Atlas 4,625 億美元、BACI 5,313 億），所以分成兩組，不接成一條。' +
      '服務出口是世界銀行 WDI 轉載的 IMF 國際收支（BPM6，2005 年起），組成用 WDI 的運輸、旅行、電信電腦與資訊（ICT）、保險與金融四類，其他服務是 100% 減這四類（顧問、研發、權利金、加工、營建、政府服務…）；WDI 的「Communications, computer, etc.」是大的剩餘類別，不少國家缺項，所以不用。四類都有的國家才畫組成。旅行是外國旅客在當地的花費，不含國際客運（客運算在運輸）。台灣用中央銀行國際收支，保險與金融是保險及退休金服務加金融服務。世界的組成是四類都有的國家依服務出口加權（涵蓋世界服務出口九成以上）；2025 年的國家數還不全，預設看 2024 年。' +
      '貿易靠的港口、貨櫃量與商船隊見「航運與港口」主題，塑膠廢料的流向見「塑膠污染」主題。',
    en:
      'All goods: CEPII BACI (1995–2024; the HS 1992 version for 1995–2016 and the HS 2017 version from 2017), which reconciles exporter and importer reports, valued FOB; Taiwan appears in UN Comtrade and BACI as "Other Asia, nes". ' +
      "Agricultural products: FAOSTAT detailed trade matrix (from 2000), using the exporter's reports for exports and the importer's for imports; when a country did not report for a year, its partners' reports are used. " +
      'Only the top 15 partners of each country are listed; shares are of the total with all partners. ' +
      'Used clothing is HS 6309 worn clothing from the HS92 version of BACI (from 1995, by value, excluding rags under 6310): about US$4.7 billion in 2024, with the US, China, the UK, Germany and South Korea exporting the most; the UAE and Pakistan are sorting and re-export hubs, so follow their exports to see where the clothes end up. ' +
      'The 31 goods such as cars, phones, medicines, gold, diamonds, scrap, fertilisers, sports equipment and games come from the HS92 version of BACI (from 1995, by value; scrap and fertilisers also in tonnes); battery-electric cars (870380), mobile phones (851712), lithium-ion batteries (850760) and video game consoles (950450), which HS92 cannot separate, use the HS17 version from 2017. ' +
      'Sports equipment (HS 9506) excludes sportswear, sports shoes and bicycles; gym and athletics equipment (950691) is a broad heading covering treadmills, weights and yoga mats. Games (HS 9504) are physical consoles, coin-operated machines, playing cards and board games (billiards equipment too); downloaded games are not in trade statistics. Playing cards (950440) include trading cards such as Pokémon and Yu-Gi-Oh!. ' +
      'Medicinal plants are HS 1211, plants used mainly in perfumery, pharmacy or as insecticides and fungicides (liquorice, ginseng, coca leaf, poppy straw and others, over 90% in the "other" line), including aromatic plants such as lavender; traditional Chinese medicine ingredients are also spread across other headings (plant extracts 1302, jujubes and goji 0813, turmeric 0910…), so this is not the same as TCM. World trade is a few billion US dollars a year, two orders of magnitude below medicines (HS 3004). ' +
      'Refining, re-export and logistics hubs such as Switzerland, the UAE, Hong Kong, Belgium, Singapore and the Netherlands trade large amounts without producing or using them, and brand countries are not where goods are made. Gold excludes monetary gold traded between central banks; industrial diamonds are not listed; ammonium phosphates are under 3105. ' +
      'Trade openness is exports plus imports of goods and services as a share of GDP from the World Bank WDI (from 1960); Taiwan is computed from DGBAS national accounts. Hong Kong, Singapore and Luxembourg exceed 300% because of re-exports and multinational accounting, not "dependence"; the world total stops at 2024 because the latest year covers too few countries. ' +
      'Long-run exports and imports come from the Harvard Atlas SITC Rev. 2 data (1962–2024): UN Comtrade reports reconciled by the Growth Lab using both sides of each flow; Taiwan does not report to the UN, so its figures come from its partners. The Soviet Union is counted as Russia before 1992; Czechoslovakia, Yugoslavia and East Germany have no data (successor states appear from independence). The reconciliation differs from BACI, so the two disagree after 1995 (Taiwan’s 2024 exports: US$462.5 billion in the Atlas, US$531.3 billion in BACI); they are kept as separate indicators rather than spliced. ' +
      'Service exports are IMF balance-of-payments data (BPM6, from 2005) republished in the World Bank WDI. The mix uses four WDI categories, transport, travel, telecommunications, computer and information services (ICT), and insurance and finance; other services are 100% minus these four (consulting, R&D, royalties, manufacturing services, construction, government services and so on). The WDI "Communications, computer, etc." series is a large residual with many gaps, so it is not used. Only countries with all four categories are shown. Travel is spending by foreign visitors and excludes international passenger fares, which fall under transport. Taiwan uses Central Bank balance-of-payments data, with insurance and finance combining insurance and pension services and financial services. The world mix weights countries with all four categories by their service exports (covering over 90% of world service exports); 2025 is still incomplete, so 2024 is the default year. ' +
      'For the ports, container volumes and merchant fleets that carry trade, see the Shipping and ports topic; for plastic waste flows, see Plastic pollution.',
  },
  dimension: { label: { zh: '商品', en: 'Product' }, options: ITEMS, defaultOption: 'all' },
  panelExtra: () => import('./panels/TradePanel'),
  indicators: [
    flow(
      'export',
      { zh: '出口', en: 'Exports' },
      {
        zh: '點選國家，弧線連到它的前 15 大出口對象，線寬與出口金額成正比。',
        en: 'Click a country to draw arcs to its top 15 export destinations; line width is proportional to the value of exports.',
      },
    ),
    flow(
      'import',
      { zh: '進口', en: 'Imports' },
      {
        zh: '點選國家，弧線連到它的前 15 大進口來源，線寬與進口金額成正比。',
        en: 'Click a country to draw arcs to its top 15 import sources; line width is proportional to the value of imports.',
      },
    ),
    flowTonnes(
      'export',
      { zh: '出口（公噸）', en: 'Exports (tonnes)' },
      {
        zh: '回收物與化肥的出口重量。點選國家，弧線連到它的前 15 大出口對象，線寬與公噸數成正比；廢料與化肥的價格起伏大，看重量比較準。',
        en: 'Export weight of scrap and fertilisers. Click a country to draw arcs to its top 15 destinations; line width is proportional to tonnes. Prices of scrap and fertilisers swing widely, so weight is a steadier measure.',
      },
    ),
    flowTonnes(
      'import',
      { zh: '進口（公噸）', en: 'Imports (tonnes)' },
      {
        zh: '回收物與化肥的進口重量。點選國家，弧線連到它的前 15 大進口來源，線寬與公噸數成正比。',
        en: 'Import weight of scrap and fertilisers. Click a country to draw arcs to its top 15 sources; line width is proportional to tonnes.',
      },
    ),
    flowLong(
      'export',
      { zh: '長期出口（1962 年起）', en: 'Long-run exports (from 1962)' },
      {
        zh: '全部商品的出口，1962–2024 年（Harvard Atlas，SITC 分類），拖時間軸看冷戰時期誰跟誰做生意。點選國家，弧線連到它的前 15 大出口對象。跟 1995 年起的「出口」是不同的資料，數字不同。台灣 1962 年出口日本 25.2%、美國 22.8%，2024 年中國大陸 20.9%、美國 20.6%。',
        en: 'Exports of all goods, 1962–2024 (Harvard Atlas, SITC classification); drag the timeline to see who traded with whom during the Cold War. Click a country to draw arcs to its top 15 destinations. A different dataset from Exports (from 1995), so the figures differ. Taiwan sent 25.2% of its exports to Japan and 22.8% to the US in 1962; 20.9% to mainland China and 20.6% to the US in 2024.',
      },
    ),
    flowLong(
      'import',
      { zh: '長期進口（1962 年起）', en: 'Long-run imports (from 1962)' },
      {
        zh: '全部商品的進口，1962–2024 年（Harvard Atlas，SITC 分類）。點選國家，弧線連到它的前 15 大進口來源。跟 1995 年起的「進口」是不同的資料，數字不同。',
        en: 'Imports of all goods, 1962–2024 (Harvard Atlas, SITC classification). Click a country to draw arcs to its top 15 sources. A different dataset from Imports (from 1995), so the figures differ.',
      },
    ),
    {
      id: 'services-export',
      label: { zh: '服務出口', en: 'Service exports' },
      description: {
        zh: '賣給外國人的服務：運輸、外國旅客在當地的花費、軟體與資訊服務、金融保險、顧問與研發、權利金等，2005 年起（IMF 國際收支）。圓的面積與金額成正比，圓餅是五類各占幾成；點國家看組成的變化。',
        en: 'Services sold to non-residents: transport, spending by foreign visitors, software and information services, finance and insurance, consulting and R&D, royalties and more, from 2005 (IMF balance of payments). Circle area is proportional to value; the pie shows the five categories. Click a country to see how the mix changed.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'services-export.json',
      layer: {
        kind: 'bubble',
        legendValues: [1e9, 1e10, 1e11],
        pie: {
          parts: SERVICE_GROUPS.map((g, i) => ({
            indicator: 'services-mix',
            item: g.id,
            color: MAP_TOKENS.categorical[i],
            label: g.label,
          })),
        },
      },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'services-mix',
      label: { zh: '占服務出口比重', en: 'Share of service exports' },
      description: {
        zh: '選定類別占服務出口的比例，2005 年起，選上方的「服務類別」切換。旅行是外國旅客在當地的花費（觀光大國很高），運輸含國際客運、貨運與港口機場服務；電信、電腦與資訊是軟體、資料處理、雲端這類，愛爾蘭、以色列、印度超過四成。其他服務包括顧問、研發、權利金、加工、營建。',
        en: 'The selected category as a share of service exports, from 2005; switch with "Service type" above. Travel is spending by foreign visitors (high in tourism economies); transport covers international passenger and freight transport and port and airport services. Telecom, computer and information services cover software, data processing and cloud services, over 40% in Ireland, Israel and India. Other services include consulting, R&D, royalties, manufacturing services and construction.',
      },
      unit: '%',
      file: 'services-mix/{item}.json',
      dimension: {
        label: { zh: '服務類別', en: 'Service type' },
        options: SERVICE_GROUPS,
        defaultOption: 'ict',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] },
        itemScales: {
          transport: { type: 'sequential', thresholds: [5, 10, 15, 25, 35, 50] },
          travel: { type: 'sequential', thresholds: [10, 20, 30, 45, 60, 75] },
          ict: { type: 'sequential', thresholds: [2, 5, 10, 15, 25, 40] },
          finance: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 15, 25] },
          other: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] },
        },
      },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'services-share',
      label: { zh: '服務出口占總出口', en: 'Service exports, % of total exports' },
      description: {
        zh: '服務出口占商品加服務出口的比例，2005 年起。英國、印度、美國這類服務業強的經濟體與觀光島國比較高，製造業出口大國（台灣、中國、德國、韓國）比較低。',
        en: 'Service exports as a share of exports of goods and services, from 2005. High in service-heavy economies such as the UK, India and the US and in tourism islands; low in big manufacturing exporters such as Taiwan, China, Germany and South Korea.',
      },
      unit: '%',
      file: 'services-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 45, 60, 80] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      defaultYear: 2024,
    },
    // 貿易依存度（2026-10-30 擴充）：WDI NE.TRD.GNFS.ZS，台灣用主計總處自行計算
    {
      id: 'trade-gdp',
      label: { zh: '貿易依存度（占 GDP）', en: 'Trade openness (% of GDP)' },
      description: {
        zh: '商品與服務的出口加進口占 GDP 的比例。超過 100% 的多半是轉口港或小型開放經濟，進口後再出口的貨物進出各算一次。',
        en: 'Exports plus imports of goods and services as a share of GDP. Values above 100% are mostly entrepôts and small open economies, where re-exported goods are counted on both sides.',
      },
      unit: '%',
      file: 'trade-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 50, 70, 100, 150, 200] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 2024,
    },
  ],
};
