import { formatLargeNumber, formatLargeTick, formatPercent, usd } from '../lib/format';
import type { FlowDirection, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 半導體：各國晶片與半導體設備的貿易（CEPII BACI HS17，pipeline/topics/semiconductors.py）。
 * 出口、進口是流向圖（跟貿易主題同一種流向檔，側欄重用 TradePanel），另外兩個是占全球比例的面量圖。
 * 商品是子項目：HS 8542（IC）、8541 不含太陽能電池與 LED（854140）、8486 等設備；854140 另列。
 */

const CHIPS = { zh: '晶片', en: 'Chips' };
const EQUIPMENT = { zh: '設備', en: 'Equipment' };
const SEPARATE = { zh: '另列', en: 'Listed separately' };

const ITEMS = [
  { id: 'ic', label: { zh: '積體電路（IC）', en: 'Integrated circuits' }, group: CHIPS },
  { id: 'discrete', label: { zh: '分離式半導體', en: 'Discrete semiconductors' }, group: CHIPS },
  { id: 'chips', label: { zh: '晶片合計', en: 'All chips' }, group: CHIPS },
  { id: 'equipment', label: { zh: '半導體設備', en: 'Semiconductor equipment' }, group: EQUIPMENT },
  { id: 'photo', label: { zh: '光電元件（含太陽能、LED）', en: 'Photosensitive (solar, LED)' }, group: SEPARATE },
];

// 指標檔只收有貿易的國家，占比都大於 0；百萬分之一 % 以下的值壓縮後會變成 0（common.compact_series 最多 6 位小數），也寫成 <0.01%
const share = (v: number) => (v < 0.01 ? '<0.01%' : formatPercent(v, v < 1 ? 2 : 1));
// 圖例與折線圖的刻度：只寫需要的小數位（0.01%、0.5%、1.5%、15%）
const decimals = (v: number) => [0, 1, 2].find((d) => Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-9) ?? 2;
const shareTick = (v: number) => formatPercent(v, decimals(v));

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

function shareOfWorld(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: `${direction}_share`,
    label,
    description,
    unit: '%',
    file: `${direction}_share/{item}.json`,
    // 各商品共用一組門檻。貿易很集中：2024 年 IC 出口的台灣、中國大陸、南韓，設備的日本、荷蘭、美國都在 15% 以上，
    // 兩百多國裡約 170 國不到 0.01%
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 0.1, 0.5, 2, 5, 15] } },
    format: share,
    formatTick: shareTick,
  };
}

export const semiconductors: TopicDefinition = {
  id: 'semiconductors',
  title: { zh: '各國半導體貿易', en: 'Semiconductor trade by country' },
  shortTitle: { zh: '半導體', en: 'Chips' },
  defaultIndicator: 'export_share',
  defaultYear: 2024,
  sources: [
    {
      name: 'CEPII, BACI (HS 2017, V202601)',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
    {
      name: {
        zh: '財政部 統計資料庫 進出口貿易統計（台灣的附註對照）',
        en: 'Ministry of Finance (Taiwan), trade statistics database (for the notes on Taiwan)',
      },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjsptgl',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      'CEPII BACI（2017–2024 年）已調和進出口雙方的申報，以離岸價（FOB）計。商品依 HS 2017：積體電路 8542；分離式半導體 8541，' +
      '不含太陽能電池與 LED（854140，另列為光電元件）與壓電晶體（854160）；晶片合計是前兩項；半導體設備是 8486（不含平面顯示器設備）' +
      '加上晶圓檢測儀器（903082、903141）。晶片從晶圓廠到封裝測試、組裝常跨國好幾次，每次都算一次貿易。' +
      '台灣在 UN Comtrade 與 BACI 列為「Other Asia, nes」，沒有自己的申報，台灣的出口、進口來自貿易夥伴的申報，跟財政部的統計不同（見台灣的附註）。' +
      'BACI 不計香港的轉口，經香港轉往中國大陸的貨記在香港的進口。每個國家只列前 15 大夥伴。',
    en:
      'CEPII BACI (2017–2024) reconciles exporter and importer reports, valued FOB. Products follow HS 2017: integrated circuits are 8542; ' +
      'discrete semiconductors are 8541 excluding solar cells and LEDs (854140, listed separately as photosensitive devices) and piezo-electric crystals (854160); ' +
      'all chips is the sum of the two; semiconductor equipment is 8486 (excluding flat-panel display equipment) plus wafer inspection and testing instruments (903082, 903141). ' +
      'Chips often cross borders several times between wafer fabs, assembly and testing, and final assembly, and each crossing counts as trade. ' +
      'Taiwan appears in UN Comtrade and BACI as "Other Asia, nes" with no reports of its own, so its exports and imports come from partner reports and differ from the Ministry of Finance figures (see the notes on Taiwan). ' +
      "BACI leaves out Hong Kong's re-exports, so goods passing through Hong Kong to mainland China count as Hong Kong's imports. Only the top 15 partners of each country are listed.",
  },
  dimension: { label: { zh: '商品', en: 'Product' }, options: ITEMS, defaultOption: 'ic' },
  panelExtra: () => import('./panels/TradePanel'),
  indicators: [
    shareOfWorld(
      'export',
      { zh: '出口占全球比例', en: 'Share of world exports' },
      {
        zh: '出口金額占全球同類商品出口的比例。BACI 依原產地計算：在台灣製造、從其他國家出貨的產品也算台灣的出口。',
        en: 'Exports as a share of world exports of the product. BACI attributes trade to the country of origin, so goods made in Taiwan but shipped from another country still count as Taiwan’s exports.',
      },
    ),
    shareOfWorld(
      'import',
      { zh: '進口占全球比例', en: 'Share of world imports' },
      {
        zh: '進口金額占全球同類商品進口的比例。香港是轉口港，經香港轉往中國大陸的貨記在香港。',
        en: 'Imports as a share of world imports of the product. Hong Kong is an entrepôt: goods passing through it to mainland China are counted as Hong Kong’s imports.',
      },
    ),
    flow(
      'export',
      { zh: '出口（流向）', en: 'Exports (flows)' },
      {
        zh: '點選國家，弧線連到它的前 15 大出口對象，線寬與出口金額成正比。',
        en: 'Click a country to draw arcs to its top 15 export destinations; line width is proportional to the value of exports.',
      },
    ),
    flow(
      'import',
      { zh: '進口（流向）', en: 'Imports (flows)' },
      {
        zh: '點選國家，弧線連到它的前 15 大進口來源，線寬與進口金額成正比。',
        en: 'Click a country to draw arcs to its top 15 import sources; line width is proportional to the value of imports.',
      },
    ),
  ],
};
