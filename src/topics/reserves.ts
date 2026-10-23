import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const MONTHS = { zh: '個月', en: 'months' };
const IMF_LICENSE = { zh: '註明來源即可使用', en: 'free to use with attribution' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const reserves: TopicDefinition = {
  id: 'reserves',
  title: { zh: '外匯存底與外債', en: 'Foreign reserves and external debt' },
  shortTitle: { zh: '外匯與外債', en: 'FX reserves' },
  defaultIndicator: 'reserves',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（外匯存底：IMF 國際金融統計；外債：國際債務統計 IDS）',
        en: 'World Bank, World Development Indicators (reserves from IMF International Financial Statistics; external debt from International Debt Statistics)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank/IMF, Quarterly External Debt Statistics（QEDS，不在 IDS 裡的國家的外債）',
        en: 'World Bank/IMF, Quarterly External Debt Statistics (QEDS; external debt of countries not in the IDS)',
      },
      url: 'https://datacatalog.worldbank.org/search/dataset/0037740',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'IMF, World Economic Outlook (October 2026)（經常帳、名目 GDP）',
        en: 'IMF, World Economic Outlook (October 2026) (current account, nominal GDP)',
      },
      url: 'https://www.imf.org/external/datamapper/',
      license: IMF_LICENSE,
    },
    {
      name: {
        zh: 'IMF, Primary Commodity Prices（金價，估算台灣央行黃金的市值）',
        en: "IMF, Primary Commodity Prices (gold price, for the market value of Taiwan's central bank gold)",
      },
      url: 'https://www.imf.org/en/research/commodity-prices',
      license: IMF_LICENSE,
    },
    {
      name: { zh: '中央銀行 外匯存底', en: 'Central Bank of the Republic of China (Taiwan), foreign exchange reserves' },
      url: 'https://data.gov.tw/dataset/6025',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '中央銀行 統計資料庫（國際收支、國際投資部位）與外債統計',
        en: 'Central Bank of the Republic of China (Taiwan), statistical database (balance of payments, international investment position) and external debt statistics',
      },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '行政院主計總處 總體統計資料庫（台灣的 GDP）', en: "DGBAS (Taiwan), National Statistics Database (Taiwan's GDP)" },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '外匯存底含黃金，黃金以年底市價計。外債占 GDP：中低所得國家用世界銀行國際債務統計（IDS；世界銀行公布的是占 GNI，這裡改成除以 GDP），其他國家用 QEDS 的外債總額，都除以 IMF 的名目 GDP（美元）；2003 年以前 QEDS 只有少數國家，所以從 2003 年開始。經常帳 2026 年起為 IMF 推估值。最新一年還沒公布的國家（例如香港的外匯存底）顯示前一年的值。世界的進口月數是各國的外匯存底合計除以進口合計。台灣不在世界銀行與 QEDS 的資料中，改用中央銀行的外匯存底（加上黃金的市值）、國際收支與國際投資部位統計，細節見台灣側欄的附註。',
    en: "Reserves include gold at year-end market prices. External debt as a share of GDP uses the World Bank's International Debt Statistics (IDS) for low- and middle-income countries (the World Bank publishes it as a share of GNI; here it is divided by GDP instead) and gross external debt from the QEDS for other countries, all divided by nominal GDP in US dollars from the IMF; it starts in 2003 because few countries reported to the QEDS before then. Current account figures from 2026 onward are IMF projections. Countries that have not yet reported the latest year (Hong Kong's reserves, for example) show the previous year. The world figure for months of imports is total reserves divided by total imports. Taiwan is not in the World Bank or QEDS data, so the central bank's foreign exchange reserves (plus the market value of its gold), balance of payments and international investment position are used instead; see the notes in Taiwan's panel.",
  },
  indicators: [
    {
      id: 'reserves',
      label: { zh: '外匯存底（含黃金）', en: 'Foreign reserves (incl. gold)' },
      description: {
        zh: '中央銀行持有、隨時可以動用的對外資產：外幣存款與外國債券等外匯、黃金（以年底市價計），以及國際貨幣基金的特別提款權與準備部位。台灣央行公布的「外匯存底」不含黃金，這裡加上黃金的市值。圓的面積與金額成正比。',
        en: "External assets held by the central bank and readily available for use: foreign exchange such as foreign-currency deposits and foreign bonds, gold (at year-end market prices), and IMF special drawing rights and reserve positions. Taiwan's central bank publishes its foreign exchange reserves without gold, so the market value of its gold is added here. Circle area is proportional to the amount.",
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'reserves.json',
      layer: { kind: 'bubble', legendValues: [1e10, 1e11, 1e12] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'reserves-months',
      label: { zh: '外匯存底可支應進口月數', en: 'Reserves in months of imports' },
      description: {
        zh: '外匯存底（含黃金）可以支付幾個月的進口；進口包括商品、服務，以及付給外國的利息、股利與薪資（初次所得）。國際上常以 3 個月當作最低的安全水準。歐元區國家共用歐元，對外支付多半不需要自己的外匯存底，所以月數很低。',
        en: 'How many months of imports the reserves (including gold) could pay for, with imports covering goods, services, and interest, dividends and wages paid abroad (primary income). Three months is a common rule of thumb for the minimum. Euro area countries share the euro and need few reserves of their own for foreign payments, so their figures are low.',
      },
      unit: MONTHS,
      file: 'reserves-months.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 9, 12, 18] } },
      format: (v) => `${fixed(v, 1)} ${tr(MONTHS)}`,
      formatTick: (v) => `${v}`,
      compareWorld: true,
    },
    {
      id: 'external-debt',
      label: { zh: '外債占 GDP', en: 'External debt, % of GDP' },
      description: {
        zh: '政府、央行、銀行、企業與家庭欠外國人的債務總額，占國內生產毛額的比例，含借款、債券、存款與貿易信用，不含股票等股權。香港、新加坡、愛爾蘭、盧森堡、英國這類金融中心的銀行與基金收受大量外國資金，外債是 GDP 的好幾倍，但同時也有相當的對外資產，不代表還不起債。',
        en: "Total debt owed to non-residents by a country's government, central bank, banks, businesses and households, as a share of GDP, including loans, bonds, deposits and trade credit but not equity such as shares. Banks and funds in financial centres such as Hong Kong, Singapore, Ireland, Luxembourg and the UK take in large amounts of foreign money, so their external debt is several times GDP, but they also hold comparable foreign assets; it does not mean they cannot pay.",
      },
      unit: '%',
      file: 'external-debt.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 100, 200, 400] } },
      // 盧森堡約 4,000%：千位以上不留小數
      format: (v) => `${fixed(v, v >= 1000 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'current-account',
      label: { zh: '經常帳占 GDP', en: 'Current account, % of GDP' },
      description: {
        zh: '一年裡跟外國之間商品、服務、所得與移轉收支的差額（經常帳餘額），占國內生產毛額的比例。綠色是順差（從外國賺進的比付出的多），橘色是逆差。長期順差會累積成外匯存底或其他對外資產，長期逆差則要靠外債或外資支應。',
        en: 'The balance of trade in goods and services plus income and transfers with the rest of the world in a year (the current account balance), as a share of GDP. Green is a surplus (earning more from abroad than paying out), orange a deficit. Persistent surpluses build up into reserves or other foreign assets; persistent deficits have to be financed with external debt or foreign investment.',
      },
      unit: '%',
      file: 'current-account.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10, -5, -2, 2, 5, 10] } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, 0),
    },
  ],
};
