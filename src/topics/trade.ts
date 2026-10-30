import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import { tr } from '../i18n';
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
  { id: 'pharma', label: { zh: '藥品（HS 3004）', en: 'Medicines (HS 3004)' }, group: MADE },
  { id: 'toys', label: { zh: '玩具（HS 9501–9503）', en: 'Toys (HS 9501–9503)' }, group: MADE },
  { id: 'apparel', label: { zh: '成衣（第 61、62 章）', en: 'Clothing (HS 61, 62)' }, group: MADE },
  { id: 'footwear', label: { zh: '鞋（第 64 章）', en: 'Footwear (HS 64)' }, group: MADE },
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
const GOODS_RAW = [{ id: 'logs', label: { zh: '原木（HS 4403）', en: 'Logs (HS 4403)' }, group: RAW }, ...GOODS_TONNES];

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
      '汽車、手機、藥品、黃金、鑽石、回收物、化肥等 25 種商品是 BACI HS92 版（1995 年起，以金額計；回收物與化肥另有公噸）；HS92 分不開的純電車（870380）、手機（851712）、鋰電池（850760）用 HS17 版，2017 年起。' +
      '瑞士、阿聯、香港、比利時、新加坡、荷蘭這類精煉、轉口與物流中心的進出口很大，不代表在那裡生產或使用；品牌國也不是產地。黃金不含央行之間的貨幣用黃金；鑽石的工業用鑽石不列；化肥的磷酸銨在 3105。' +
      '貿易依存度是世界銀行 WDI 的商品與服務出口加進口占 GDP（1960 年起），台灣用主計總處的國民所得統計自行計算；香港、新加坡、盧森堡超過 300% 是轉口貿易與跨國企業的帳，不代表「依賴」；世界合計的最新一年國家數不全，只畫到 2024 年。' +
      '貿易靠的港口、貨櫃量與商船隊見「航運與港口」主題，塑膠廢料的流向見「塑膠污染」主題。',
    en:
      'All goods: CEPII BACI (1995–2024; the HS 1992 version for 1995–2016 and the HS 2017 version from 2017), which reconciles exporter and importer reports, valued FOB; Taiwan appears in UN Comtrade and BACI as "Other Asia, nes". ' +
      "Agricultural products: FAOSTAT detailed trade matrix (from 2000), using the exporter's reports for exports and the importer's for imports; when a country did not report for a year, its partners' reports are used. " +
      'Only the top 15 partners of each country are listed; shares are of the total with all partners. ' +
      'Used clothing is HS 6309 worn clothing from the HS92 version of BACI (from 1995, by value, excluding rags under 6310): about US$4.7 billion in 2024, with the US, China, the UK, Germany and South Korea exporting the most; the UAE and Pakistan are sorting and re-export hubs, so follow their exports to see where the clothes end up. ' +
      'The 25 goods such as cars, phones, medicines, gold, diamonds, scrap and fertilisers come from the HS92 version of BACI (from 1995, by value; scrap and fertilisers also in tonnes); battery-electric cars (870380), mobile phones (851712) and lithium-ion batteries (850760), which HS92 cannot separate, use the HS17 version from 2017. ' +
      'Refining, re-export and logistics hubs such as Switzerland, the UAE, Hong Kong, Belgium, Singapore and the Netherlands trade large amounts without producing or using them, and brand countries are not where goods are made. Gold excludes monetary gold traded between central banks; industrial diamonds are not listed; ammonium phosphates are under 3105. ' +
      'Trade openness is exports plus imports of goods and services as a share of GDP from the World Bank WDI (from 1960); Taiwan is computed from DGBAS national accounts. Hong Kong, Singapore and Luxembourg exceed 300% because of re-exports and multinational accounting, not "dependence"; the world total stops at 2024 because the latest year covers too few countries. ' +
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
