import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { FlowDirection, IndicatorDef, Text, TopicDefinition } from './types';

const BATTERY = { zh: '電池材料', en: 'Battery materials' };
const ELECTRONICS = { zh: '稀土與電子', en: 'Rare earths and electronics' };
const ALLOYS = { zh: '合金與特殊用途', en: 'Alloys and special uses' };
const PRECIOUS = { zh: '貴金屬', en: 'Precious metals' };
const BASE = { zh: '基本金屬', en: 'Base metals' };
const INDUSTRIAL = { zh: '工業礦物', en: 'Industrial minerals' };

/**
 * 地圖上可選的礦種（與 pipeline/topics/minerals.py 的 MINERALS 對應）。
 * 括號裡是 USGS 的計量口徑：都是礦場產量的金屬（或氧化物）含量，鎵是初級產量、鍺是精煉產量、石墨與鋁土礦是礦石重量。
 */
export const MINERALS: { id: string; label: Text; group: Text }[] = [
  { id: 'lithium', label: { zh: '鋰（鋰含量）', en: 'Lithium (Li content)' }, group: BATTERY },
  { id: 'cobalt', label: { zh: '鈷（鈷含量）', en: 'Cobalt (Co content)' }, group: BATTERY },
  { id: 'nickel', label: { zh: '鎳（鎳含量）', en: 'Nickel (Ni content)' }, group: BATTERY },
  { id: 'graphite', label: { zh: '天然石墨', en: 'Natural graphite' }, group: BATTERY },
  { id: 'manganese', label: { zh: '錳（錳含量）', en: 'Manganese (Mn content)' }, group: BATTERY },
  { id: 'rare-earths', label: { zh: '稀土（氧化物當量）', en: 'Rare earths (oxide equivalent)' }, group: ELECTRONICS },
  { id: 'gallium', label: { zh: '鎵（初級產量）', en: 'Gallium (primary)' }, group: ELECTRONICS },
  { id: 'germanium', label: { zh: '鍺（精煉產量）', en: 'Germanium (refined)' }, group: ELECTRONICS },
  { id: 'tin', label: { zh: '錫（錫含量）', en: 'Tin (Sn content)' }, group: ELECTRONICS },
  { id: 'tungsten', label: { zh: '鎢（鎢含量）', en: 'Tungsten (W content)' }, group: ALLOYS },
  { id: 'vanadium', label: { zh: '釩（釩含量）', en: 'Vanadium (V content)' }, group: ALLOYS },
  { id: 'niobium', label: { zh: '鈮（鈮含量）', en: 'Niobium (Nb content)' }, group: ALLOYS },
  { id: 'antimony', label: { zh: '銻（銻含量）', en: 'Antimony (Sb content)' }, group: ALLOYS },
  { id: 'gold', label: { zh: '黃金（金含量）', en: 'Gold (Au content)' }, group: PRECIOUS },
  { id: 'platinum', label: { zh: '鉑', en: 'Platinum' }, group: PRECIOUS },
  { id: 'palladium', label: { zh: '鈀', en: 'Palladium' }, group: PRECIOUS },
  { id: 'copper', label: { zh: '銅（銅含量）', en: 'Copper (Cu content)' }, group: BASE },
  { id: 'bauxite', label: { zh: '鋁土礦（乾重）', en: 'Bauxite (dry weight)' }, group: BASE },
  { id: 'salt', label: { zh: '鹽', en: 'Salt' }, group: INDUSTRIAL },
];

const TONNES = { zh: '公噸', en: 'tonnes' };

/**
 * 公噸：鎵、鉑、鈀的產量只有幾噸到幾百噸，銅、鋁土礦是幾千萬到幾億噸。
 * 中文的 formatLargeNumber 萬位取整數（美國稀土 45,500 噸會變成「5 萬」），一百萬噸以下直接寫出噸數；
 * 10 噸以下留一位小數，1 噸以下改寫公斤。
 */
export function tonnes(v: number): string {
  if (v > 0 && v < 1) return `${fixed(v * 1000, 0)} ${tr({ zh: '公斤', en: 'kg' })}`;
  const r = Math.round(v * 10) / 10;
  const text = v >= 1e6 ? formatLargeNumber(v) : v >= 10 ? fixed(v, 0) : fixed(r, r % 1 === 0 ? 0 : 1);
  return `${text} ${tr(TONNES)}`;
}

const tonnesTick = (v: number) => `${formatLargeTick(v)}${tr({ zh: '噸', en: ' t' })}`;
const percent = (v: number) => (v === 0 ? '0%' : `${fixed(v, v < 1 ? 2 : 1)}%`);

// 占比的分級：中國的稀土約七成、石墨與鎢約八成、鎵將近百分之百，75% 以上另成一級才分得出來
const SHARE_SCALE = { type: 'sequential' as const, thresholds: [1, 5, 10, 25, 50, 75] };

function total(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: TONNES,
    file: `${id}/{item}.json`,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: tonnes,
    formatTick: tonnesTick,
    shareOfWorld: true,
  };
}

/**
 * 貿易流向的商品（pipeline/topics/minerals_trade.py，CEPII BACI HS92）：流向指標自己的子項目，跟產量的礦種分開。
 * 稀土的產量是 USGS 的礦場產量；這裡是稀土金屬與化合物的貿易，永久磁鐵另列；鈾沒有產量，只有貿易
 */
const TRADE_DIMENSION = {
  label: { zh: '商品', en: 'Product' },
  options: [
    { id: 'rare-earths', label: { zh: '稀土金屬與化合物（HS 280530、2846）', en: 'Rare-earth metals and compounds (HS 280530, 2846)' } },
    { id: 'magnets', label: { zh: '永久磁鐵（HS 850511）', en: 'Permanent magnets (HS 850511)' } },
    { id: 'uranium', label: { zh: '鈾礦砂與天然鈾（HS 261210、284410）', en: 'Uranium ore and natural uranium (HS 261210, 284410)' } },
  ],
  defaultOption: 'rare-earths',
};

function flow(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: `${direction}-flow`,
    label,
    description,
    unit: { zh: '美元', en: 'US$' },
    file: `${direction}/{item}.json`,
    layer: { kind: 'flow', file: 'flows/{item}/{year}.json', direction },
    format: (v) => usd(formatLargeNumber(v)),
    formatTick: formatLargeTick,
    shareOfWorld: true,
    dimension: TRADE_DIMENSION,
  };
}

function share(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}/{item}.json`,
    layer: { kind: 'choropleth', scale: SHARE_SCALE },
    format: percent,
    formatTick: (v) => `${v}%`,
  };
}

export const minerals: TopicDefinition = {
  id: 'minerals',
  title: { zh: '各國關鍵礦產', en: 'Critical minerals by country' },
  shortTitle: { zh: '關鍵礦產', en: 'Minerals' },
  defaultIndicator: 'production',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'U.S. Geological Survey, Mineral Commodity Summaries 2020–2026（各礦種一章的世界產量與蘊藏量表）',
        en: 'U.S. Geological Survey, Mineral Commodity Summaries 2020–2026 (world production and reserves table in each chapter)',
      },
      url: 'https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries',
      license: { zh: '公有領域（美國政府著作）', en: 'public domain (U.S. Government work)' },
    },
    {
      name: { zh: 'CEPII, BACI（HS 1992, V202601；稀土、永久磁鐵、鈾的貿易流向）', en: 'CEPII, BACI (HS 1992, V202601; trade flows of rare earths, permanent magnets and uranium)' },
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
  ],
  note: {
    zh: '每一年用最新一版 MCS 的數字（2024 年是 2026 版的修正值），2025 年是 USGS 的初估。USGS 只列出主要生產國，其餘併入「其他國家」，地圖上是灰色；占全球比例的分母是表上的世界總計（含其他國家）。W（為保護公司資料不公布）與 NA 當作缺值，美國的鋰、鋁土礦（與 2025 年的銻）是 W，世界總計也不含美國。USGS 從 2023 年版起不再公布各國的鍺產量，所以鍺只到 2020 年。黃金是礦場產量；鹽的產量各國的定義不同（岩鹽、海鹽、滷水），USGS 表上很多是估計值，沒有蘊藏量。台灣不是這些礦產的生產國，USGS 的表上沒有台灣（台灣的曬鹽 2002 年停止），所需的礦產原料幾乎全部仰賴進口。貿易流向（稀土金屬與化合物、永久磁鐵、鈾，2000–2024 年）用 CEPII BACI 的 HS 1992 版：台灣沒有自己的申報，數字來自貿易夥伴（BACI 的「Other Asia, nes」）；中國大陸 2025 年 4 月起管制中重稀土與磁鐵的出口，BACI 2027 年才會有 2025 年。鈾的產量（OECD NEA 與 IAEA 的《Uranium》紅皮書）授權還沒確認，先只畫貿易；濃縮鈾（核燃料）不在這裡。',
    en: 'Each year uses the latest edition of the MCS (2024 figures are the revised ones from the 2026 edition); 2025 is a preliminary USGS estimate. USGS lists only the main producers and groups the rest as "Other countries", shown in grey; shares of world output use the world total in the table, which includes other countries. W (withheld to protect company data) and NA are treated as missing; US lithium and bauxite (and antimony in 2025) are W, and the world totals exclude US output. Germanium data end in 2020 because USGS stopped publishing country-level output from its 2023 edition. Gold is mine production; salt output is defined differently from country to country (rock salt, solar salt, brine), many USGS figures are estimates, and there are no reserves figures. Taiwan does not produce any of these minerals and does not appear in the USGS tables (its solar salt works closed in 2002); it relies almost entirely on imports. Trade flows (rare-earth metals and compounds, permanent magnets and uranium, 2000–2024) come from the HS 1992 edition of CEPII BACI: Taiwan does not report its own trade, so its figures come from its partners (BACI’s “Other Asia, nes”). Mainland China has restricted exports of medium and heavy rare earths and magnets since April 2025, which BACI will cover only from 2027. Uranium production (the OECD NEA–IAEA “Red Book”) awaits a licence check, so only trade is shown; enriched uranium (nuclear fuel) is not included.',
  },
  // tooltip 與側欄的數值卡片取代「無資料」，要短；完整的說明在側欄的「主要生產的礦產」與頁尾
  noValue: {
    TWN: { zh: '台灣不是生產國，仰賴進口', en: 'Not a producer; relies on imports' },
  },
  dimension: {
    label: { zh: '礦種', en: 'Mineral' },
    options: MINERALS,
    defaultOption: 'rare-earths',
  },
  panelExtra: () => import('./panels/MineralsPanel'),
  indicators: [
    total(
      'production',
      { zh: '產量', en: 'Production' },
      {
        zh: '一年的礦場產量（公噸），圓的面積與產量成正比。多數礦種是金屬含量（黃金是金含量），稀土是稀土氧化物（REO）當量，石墨與鋁土礦是礦石重量，鹽是各種鹽（岩鹽、海鹽、滷水、真空鹽）合計，鎵是初級（低純度）產量，鍺是精煉產量（只到 2020 年）。2025 年是 USGS 的初估。',
        en: 'Mine production in a year (tonnes); circle area is proportional to output. Most minerals are metal content (gold is gold content), rare earths are rare-earth-oxide (REO) equivalent, graphite and bauxite are ore weight, salt is all types combined (rock salt, solar salt, brine and vacuum-pan salt), gallium is primary (low-purity) output and germanium is refinery output (to 2020 only). 2025 figures are preliminary USGS estimates.',
      },
    ),
    share(
      'share',
      { zh: '占全球產量', en: 'Share of world production' },
      {
        zh: '這個國家的產量占 USGS 世界總計（含未列出的其他國家）的比例。',
        en: "The country's output as a share of the USGS world total, which includes unlisted other countries.",
      },
    ),
    total(
      'reserves',
      { zh: '蘊藏量', en: 'Reserves' },
      {
        zh: '已探明、以目前的技術與價格可以經濟開採的量（USGS 的 reserves，不是全部資源），口徑同產量。各版會依公司與政府的報告修正，年份之間的變化多半是修正。鉑、鈀是鉑族金屬合計；鎵、鍺沒有蘊藏量資料，鹽的蘊藏量 USGS 只寫「很大」。',
        en: 'Known deposits that can be mined economically with current technology and prices (USGS reserves, not total resources), measured as for production. Each edition revises them from company and government reports, so most year-to-year changes are revisions. Platinum and palladium show all platinum-group metals combined; there are no reserves data for gallium or germanium, and USGS describes salt reserves only as “large”.',
      },
    ),
    share(
      'reserves-share',
      { zh: '占全球蘊藏量', en: 'Share of world reserves' },
      {
        zh: '這個國家的蘊藏量占世界總計的比例。世界總計標成「大於」時，用它跟列出國家加總的較大值，比例可能偏高。',
        en: "The country's reserves as a share of the world total. Where USGS gives the world total only as a lower bound (\">\"), the larger of that bound and the sum of listed countries is used, so shares may be overstated.",
      },
    ),
    flow(
      'export',
      { zh: '出口（流向）', en: 'Exports (flows)' },
      {
        zh: '稀土金屬與化合物、永久磁鐵、鈾的出口：點選國家，畫出前 15 大出口對象，線寬與金額成正比（美元，CEPII BACI，已調和進出口兩邊的申報）。稀土精礦沒有專屬的稅則，看不到礦砂的貿易；永久磁鐵含釤鈷、鋁鎳鈷，不全是釹鐵硼；鈾不含濃縮鈾。',
        en: 'Exports of rare-earth metals and compounds, permanent magnets and uranium: select a country to draw its top 15 export destinations, line width proportional to value (US$, CEPII BACI, which reconciles exporter and importer reports). Rare-earth concentrates have no dedicated tariff code, so ore trade is not visible; permanent magnets include samarium-cobalt and alnico, not only NdFeB; uranium excludes enriched uranium.',
      },
    ),
    flow(
      'import',
      { zh: '進口（流向）', en: 'Imports (flows)' },
      {
        zh: '稀土金屬與化合物、永久磁鐵、鈾的進口：點選國家，畫出前 15 大進口來源（美元，CEPII BACI）。中國大陸是稀土化合物最大的進口國（緬甸、寮國的中重稀土原料），出口的大宗是磁鐵；俄羅斯的天然鈾進口多半是哈薩克送去轉化，不是自用。',
        en: 'Imports of rare-earth metals and compounds, permanent magnets and uranium: select a country to draw its top 15 sources (US$, CEPII BACI). Mainland China is the largest importer of rare-earth compounds (heavy rare-earth feedstock from Myanmar and Laos) while its exports are mostly magnets; much of Russia’s natural uranium imports is Kazakh uranium sent for conversion, not for domestic use.',
      },
    ),
  ],
};
