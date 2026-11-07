import { formatLargeNumber, formatLargeTick, formatPercent, usd } from '../lib/format';
import { electronicsHs92Part } from './electronics-hs92';
import { withParts } from './parts';
import type { FlowDirection, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 半導體：各國晶片與半導體設備的貿易（CEPII BACI HS17，pipeline/topics/semiconductors.py）。
 * 出口、進口是流向圖（跟貿易主題同一種流向檔，側欄重用 TradePanel），另外兩個是占全球比例的面量圖。
 * 商品是子項目：HS 8542（IC）、8541 不含太陽能電池與 LED（854140）、8486 等設備；854140 另列。
 */

const CHIPS = { zh: '晶片', en: 'Chips' };
const EQUIPMENT = { zh: '設備', en: 'Equipment' };
const SEPARATE = { zh: '另列', en: 'Listed separately' };
const SOLAR = { zh: '太陽能（HS 2022）', en: 'Solar (HS 2022)' };
const COMPONENTS = { zh: '電子零組件', en: 'Electronic components' };

const ITEMS = [
  { id: 'ic', label: { zh: '積體電路（IC）', en: 'Integrated circuits' }, group: CHIPS },
  { id: 'discrete', label: { zh: '分離式半導體', en: 'Discrete semiconductors' }, group: CHIPS },
  { id: 'chips', label: { zh: '晶片合計', en: 'All chips' }, group: CHIPS },
  { id: 'equipment', label: { zh: '半導體設備', en: 'Semiconductor equipment' }, group: EQUIPMENT },
  { id: 'photo', label: { zh: '光電元件（含太陽能、LED）', en: 'Photosensitive (solar, LED)' }, group: SEPARATE },
  // 太陽能板（2026-10-30 擴充，pipeline/topics/solar_panels.py）：HS 2022 才從 854140 拆出來，BACI HS22 版只有 2022–2024 年
  { id: 'solar-modules', label: { zh: '太陽能模組（板，2022 年起）', en: 'Solar modules (panels, from 2022)' }, group: SOLAR },
  { id: 'solar-cells', label: { zh: '太陽能電池（2022 年起）', en: 'Solar cells (from 2022)' }, group: SOLAR },
  // 電子零組件（2026-11-07，製作手冊第二十五批 506，pipeline/topics/electronic_components.py）：面板模組是 HS 2022 新增的代碼，只有 2022–2024 年
  { id: 'display-modules', label: { zh: '平板顯示模組（2022 年起）', en: 'Flat panel display modules (from 2022)' }, group: COMPONENTS },
  { id: 'pcb', label: { zh: '印刷電路板', en: 'Printed circuit boards' }, group: COMPONENTS },
  { id: 'capacitors', label: { zh: '電容器', en: 'Capacitors' }, group: COMPONENTS },
  { id: 'resistors', label: { zh: '電阻器', en: 'Resistors' }, group: COMPONENTS },
  { id: 'crystals', label: { zh: '壓電晶體（石英振盪器）', en: 'Piezoelectric crystals (quartz)' }, group: COMPONENTS },
  { id: 'fpd-equipment', label: { zh: '平面顯示器製造設備', en: 'Flat panel display equipment' }, group: COMPONENTS },
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

const NO_TAIWAN_WDI: Text = { zh: '沒有資料（WDI 沒有台灣）', en: 'No data (WDI does not include Taiwan)' };

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

export const semiconductors: TopicDefinition = withParts({
  id: 'semiconductors',
  title: { zh: '各國半導體貿易', en: 'Semiconductor trade by country' },
  shortTitle: { zh: '半導體', en: 'Chips' },
  defaultIndicator: 'export_share',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'The Growth Lab at Harvard University, Atlas of Economic Complexity（3D 列印機 HS 8485）', en: 'The Growth Lab at Harvard University, Atlas of Economic Complexity (3D printers, HS 8485)' },
      url: 'https://atlas.hks.harvard.edu/',
      license: 'CC0',
    },
    {
      name: { zh: 'World Bank, World Development Indicators（ICT 貨品與服務占出口：UNCTAD、IMF）', en: 'World Bank, World Development Indicators (ICT goods and services exports: UNCTAD, IMF)' },
      url: 'https://data.worldbank.org/indicator/TX.VAL.ICTG.ZS.UN',
      license: 'CC BY 4.0',
    },
    {
      name: 'CEPII, BACI (HS 2017, HS 2022, V202601)',
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
      'BACI 不計香港的轉口，經香港轉往中國大陸的貨記在香港的進口。每個國家只列前 15 大夥伴。' +
      '太陽能模組（854143）與電池（854142）是 HS 2022 才從 854140 拆出來的代碼，用 BACI 的 HS22 版，只有 2022–2024 年；2023–2024 年價格大跌，金額減少不代表裝置量減少；美國對中國大陸的關稅讓產地移到越南、泰國、馬來西亞、柬埔寨。' +
      '電子零組件（2026-11-07 加）：印刷電路板 853400、電容器 8532、電阻器 8533、壓電晶體（石英振盪器）854160、平面顯示器製造設備 848630 用 HS 2017（2017–2024 年）；平板顯示模組 8524 是 HS 2022 新增的代碼（以前散在 9013.80 等，不能接成長序列），只有 2022–2024 年，很多是在中國大陸組裝後出口，上游的面板在台灣、南韓。',
    en:
      'CEPII BACI (2017–2024) reconciles exporter and importer reports, valued FOB. Products follow HS 2017: integrated circuits are 8542; ' +
      'discrete semiconductors are 8541 excluding solar cells and LEDs (854140, listed separately as photosensitive devices) and piezo-electric crystals (854160); ' +
      'all chips is the sum of the two; semiconductor equipment is 8486 (excluding flat-panel display equipment) plus wafer inspection and testing instruments (903082, 903141). ' +
      'Chips often cross borders several times between wafer fabs, assembly and testing, and final assembly, and each crossing counts as trade. ' +
      'Taiwan appears in UN Comtrade and BACI as "Other Asia, nes" with no reports of its own, so its exports and imports come from partner reports and differ from the Ministry of Finance figures (see the notes on Taiwan). ' +
      "BACI leaves out Hong Kong's re-exports, so goods passing through Hong Kong to mainland China count as Hong Kong's imports. Only the top 15 partners of each country are listed. " +
      'Solar modules (854143) and cells (854142) were split out of 854140 only in HS 2022, so they use the HS22 version of BACI and cover 2022–2024; prices fell sharply in 2023–2024, so lower values do not mean fewer installations, and US tariffs on mainland China moved production to Vietnam, Thailand, Malaysia and Cambodia. ' +
      'Electronic components (added 7 November 2026): printed circuit boards 853400, capacitors 8532, resistors 8533, mounted piezoelectric crystals (quartz) 854160 and flat panel display manufacturing equipment 848630 use HS 2017 (2017–2024); flat panel display modules 8524 are a new HS 2022 heading (previously spread over 9013.80 and others, so there is no longer series) and cover only 2022–2024; many are assembled in mainland China and exported, with the panels themselves made upstream in Taiwan and South Korea.',
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
    // ICT 貨品與服務占出口的比例（2026-11-07，第二十五批 506，候選 1177；pipeline/topics/ict_exports.py，WDI）：不用子項目「商品」
    {
      id: 'ict-goods',
      label: { zh: 'ICT 貨品占貨品出口', en: 'ICT goods as a share of goods exports' },
      description: {
        zh: '電腦、通訊設備、電子零組件、消費性電子等 ICT 貨品占這一國全部貨品出口的比例（世界銀行 WDI，來源 UNCTAD；各國依 COMTRADE 自行編算，口徑不完全一致）。2024 年：香港 61.5%（大半是轉口）、菲律賓 43.6%、越南 35.9%（2023）、馬來西亞 35.2%、新加坡 34.7%、南韓 28.3%、馬爾他 24.3%、中國 21.3%；以色列 17.7%、美國 9.1%、日本 7.6%、印度 5.7%、德國 4.6%。WDI 沒有台灣。',
        en: 'ICT goods (computers, communication equipment, electronic components, consumer electronics, etc.) as a share of a country’s total goods exports (World Bank WDI, sourced from UNCTAD; each country compiles it from COMTRADE, so coverage is not fully consistent). 2024: Hong Kong 61.5% (mostly re-exports), the Philippines 43.6%, Vietnam 35.9% (2023), Malaysia 35.2%, Singapore 34.7%, South Korea 28.3%, Malta 24.3%, China 21.3%; Israel 17.7%, the US 9.1%, Japan 7.6%, India 5.7%, Germany 4.6%. WDI does not include Taiwan.',
      },
      unit: '%',
      file: 'ict/goods.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 35] } },
      format: (v) => formatPercent(v, 1),
      formatTick: (v) => v + '%',
      missing: NO_TAIWAN_WDI,
    },
    {
      id: 'ict-services',
      label: { zh: 'ICT 服務占服務出口', en: 'ICT services as a share of services exports' },
      description: {
        zh: '電信、電腦（軟體、資料處理、雲端）與資訊服務占這一國全部服務出口的比例（世界銀行 WDI，來源 IMF 國際收支）。2025 年：愛爾蘭 65.5%、以色列 64.6%、科威特 49.3%、印度 48.6%、巴基斯坦 46.1%、烏克蘭 42.8%、芬蘭 32.7%；中國 19.1%、南韓 12.5%、德國 11.5%、美國 8.2%、新加坡 8.0%、日本 6.0%。跟 ICT 貨品一起看，分得出硬體出口國（東亞）跟軟體與服務出口國（愛爾蘭、以色列、印度、烏克蘭）。服務出口不到 10 億美元的國家分母太小、比例會亂跳，不畫。WDI 沒有台灣。',
        en: 'Telecommunications, computer (software, data processing, cloud) and information services as a share of a country’s total services exports (World Bank WDI, sourced from IMF balance of payments). 2025: Ireland 65.5%, Israel 64.6%, Kuwait 49.3%, India 48.6%, Pakistan 46.1%, Ukraine 42.8%, Finland 32.7%; China 19.1%, South Korea 12.5%, Germany 11.5%, the US 8.2%, Singapore 8.0%, Japan 6.0%. Together with ICT goods this separates hardware exporters (East Asia) from software and services exporters (Ireland, Israel, India, Ukraine). Countries with services exports below US$1 billion are not shown because the small denominator makes the share jump around. WDI does not include Taiwan.',
      },
      unit: '%',
      file: 'ict/services.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 15, 25, 40] } },
      format: (v) => formatPercent(v, 1),
      formatTick: (v) => v + '%',
      missing: NO_TAIWAN_WDI,
    },
    // 2026-11-07（製作手冊第二十五批 514）3D 列印機（HS 8485）的貿易，Harvard Atlas（pipeline/topics/printers3d.py）：不用子項目「商品」
    {
      id: 'printers3d',
      label: { zh: '3D 列印機的出口與進口', en: '3D printer exports and imports' },
      description: {
        zh: 'HS 2022 新設的 8485「積層製造機器」（3D 列印機）的出口與進口金額（Harvard Growth Lab Atlas，2022–2024 年；2022 年以前散在別的稅號，不能往前接）。2024 年全球出口只有約 28.3 億美元：中國 12.7 億、德國 5.48 億、美國 2.07 億、以色列 1.22 億、捷克 9,020 萬、荷蘭 8,620 萬；台灣出口 749 萬、進口 1,516 萬美元。進口最多的是美國 8.77 億、德國 4.95 億。2022 年是新稅號的第一年，新加坡（6.6 億）、台灣（2.1 億）的金額特別大，可能是歸類還沒穩定。金額小，少數大訂單就會讓排名跳動。',
        en: 'Exports and imports of HS 2022 heading 8485, additive manufacturing machines (3D printers) (Harvard Growth Lab Atlas, 2022–2024; before 2022 they were spread over other headings, so there is no longer series). World exports in 2024 were only about US$2.83 billion: China 1.27 billion, Germany 548 million, the US 207 million, Israel 122 million, Czechia 90.2 million, the Netherlands 86.2 million; Taiwan exported 7.49 million and imported 15.16 million. The largest importers are the US (877 million) and Germany (495 million). 2022 was the heading’s first year, and Singapore (662 million) and Taiwan (213 million) are unusually large, perhaps because classification had not settled. Values are small, so a few large orders can reshuffle the ranking.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'printers3d/{item}.json',
      dimension: {
        label: { zh: '方向', en: 'Direction' },
        options: [
          { id: 'exports', label: { zh: '出口', en: 'Exports' } },
          { id: 'imports', label: { zh: '進口', en: 'Imports' } },
        ],
        defaultOption: 'exports',
      },
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
    },
  ],
}, electronicsHs92Part);
