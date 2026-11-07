import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent, usd } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

const MONTHS = { zh: '個月', en: 'months' };
const IMF_LICENSE = { zh: '註明來源即可使用', en: 'free to use with attribution' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/**
 * OECD 國家風險等級（pipeline/topics/country_risk.py）：0–7 是等級，8 是高所得 OECD、歐元區與用歐元的歐洲小國（不評級），
 * 9 是未評級。類別圖、循序色，7 級最深；0 級只有新加坡、1 級目前沒有國家，併成一類，才不會超過循序色的 7 階。
 * 「不評級」不是「風險為零」，用藍色另外標（不在等級的色階上），「未評級」用淺的中性色。
 */
const RISK_NOT_CLASSIFIED = 8;
const RISK_NOT_REVIEWED = 9;
const grade = (n: number) => ({ zh: `${n} 級`, en: `${n}` });
const RISK_CATEGORIES: CategoryDef[] = [
  { value: 7, label: { zh: '7 級（風險最高）', en: '7 (highest risk)' } },
  ...[6, 5, 4, 3, 2].map((n) => ({ value: n, label: grade(n) })),
  { value: 0, max: 1, label: { zh: '0–1 級（風險最低）', en: '0–1 (lowest risk)' } },
  {
    value: RISK_NOT_CLASSIFIED,
    label: { zh: '不評級（高所得 OECD 會員國、歐元區）', en: 'Not classified (high-income OECD, euro area)' },
    color: MAP_TOKENS.hues.blue,
  },
  { value: RISK_NOT_REVIEWED, label: { zh: '未評級', en: 'Not reviewed' }, color: MAP_TOKENS.categoricalOther },
];
const riskLabel = (v: number) =>
  v === RISK_NOT_CLASSIFIED || v === RISK_NOT_REVIEWED
    ? tr(RISK_CATEGORIES.find((c) => c.value === v)?.label ?? '')
    : tr(grade(v));

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
    {
      name: { zh: 'World Bank, International Debt Statistics（公共外債的幣別組成，DT.CUR.*）', en: 'World Bank, International Debt Statistics (currency composition of public external debt, DT.CUR.*)' },
      url: 'https://www.worldbank.org/en/programs/debt-statistics/ids',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'OECD, Country Risk Classifications of the Participants to the Arrangement on Officially Supported Export Credits（2026 年 10 月 16 日起適用）',
        en: 'OECD, Country Risk Classifications of the Participants to the Arrangement on Officially Supported Export Credits (valid as of 16 October 2026)',
      },
      url: 'https://www.oecd.org/en/topics/sub-issues/country-risk-classification.html',
      license: { zh: 'OECD 使用條款（資料可轉載、改作，註明出處）', en: 'OECD Terms and Conditions (data may be reused and adapted with attribution)' },
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
    {
      id: 'debt-currency',
      label: { zh: '外債用什麼貨幣借的', en: 'Currency of external debt' },
      description: {
        zh: '中低所得國家的公共與公共保證長期外債裡，用各種貨幣計價的比例（世界銀行國際債務統計，1970 年起，約 120 國）。美元：2024 年聖露西亞 99.3%、巴拉圭 99.1%、瓜地馬拉 98.8%、薩爾瓦多 98.2%、厄瓜多 97.9%、巴西 96.4%，拉丁美洲幾乎全是美元；北馬其頓 22.9%、索馬利亞 18.3%、阿爾及利亞 0%。歐元：北馬其頓 76.8%、波士尼亞 66.5%、阿爾巴尼亞 61.7%、象牙海岸 57.2%。日圓：緬甸 41.6%、伊拉克 37.7%、越南 25.0%。美元計價的比例越高，美國升息、美元升值時，還債的負擔就越重。只算政府借或保證的長期外債，不含民間外債與短期債；高所得國家（台灣、日本、美國等）不向世界銀行報告，沒有資料。',
        en: 'Shares of the public and publicly guaranteed long-term external debt of low- and middle-income countries by currency (World Bank International Debt Statistics, from 1970, about 120 countries). US dollars: in 2024 Saint Lucia 99.3%, Paraguay 99.1%, Guatemala 98.8%, El Salvador 98.2%, Ecuador 97.9% and Brazil 96.4%, Latin America almost entirely in dollars; North Macedonia 22.9%, Somalia 18.3% and Algeria 0%. Euros: North Macedonia 76.8%, Bosnia 66.5%, Albania 61.7% and Côte d’Ivoire 57.2%. Yen: Myanmar 41.6%, Iraq 37.7% and Vietnam 25.0%. The larger the dollar share, the heavier the burden when US rates rise and the dollar strengthens. Only long-term debt borrowed or guaranteed by the government, not private or short-term debt; high-income countries (Taiwan, Japan, the US and others) do not report to the World Bank.',
      },
      unit: '%',
      file: 'debt-currency/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [30, 50, 65, 80, 90, 95] },
        itemScales: {
          eur: { type: 'sequential', thresholds: [1, 5, 15, 30, 45, 60] },
          jpy: { type: 'sequential', thresholds: [0.5, 2, 5, 10, 20, 35] },
          gbp: { type: 'sequential', thresholds: [0.01, 0.1, 0.3, 0.6, 1, 2] },
          chf: { type: 'sequential', thresholds: [0.01, 0.1, 0.5, 1, 5, 10] },
          sdr: { type: 'sequential', thresholds: [0.5, 2, 4, 7, 10, 15] },
          multi: { type: 'sequential', thresholds: [0.1, 0.5, 1, 2, 4, 6] },
          other: { type: 'sequential', thresholds: [2, 5, 10, 20, 35, 50] },
        },
      },
      dimension: {
        label: { zh: '貨幣', en: 'Currency' },
        options: [
          { id: 'usd', label: { zh: '美元', en: 'US dollar' } },
          { id: 'eur', label: { zh: '歐元', en: 'Euro' } },
          { id: 'jpy', label: { zh: '日圓', en: 'Japanese yen' } },
          { id: 'gbp', label: { zh: '英鎊', en: 'Pound sterling' } },
          { id: 'chf', label: { zh: '瑞士法郎', en: 'Swiss franc' } },
          { id: 'sdr', label: { zh: '特別提款權（SDR）', en: 'Special drawing rights (SDR)' } },
          { id: 'multi', label: { zh: '多種貨幣', en: 'Multiple currencies' } },
          { id: 'other', label: { zh: '其他貨幣', en: 'Other currencies' } },
        ],
        defaultOption: 'usd',
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
      noValue: {
        TWN: { zh: '只有向世界銀行報告債務的中低所得國家', en: 'Only low- and middle-income countries reporting to the World Bank' },
      },
    },
    {
      id: 'country-risk',
      label: { zh: '國家風險等級（OECD）', en: 'Country risk classification (OECD)' },
      description: {
        zh: 'OECD《官方支持出口信用安排》的參加國共同評定的國家風險等級，從 0 到 7，數字越大，這一國的債務人因為外匯管制、戰亂或天災這類國家層級的原因還不起錢的風險越高；參加國的出口信用機構照這個等級收最低保費。2026 年 10 月 16 日起適用的版本列了 201 國：新加坡是唯一的 0 級；台灣 2 級，跟保加利亞、中國、香港、科威特、馬來西亞、卡達、沙烏地阿拉伯、阿聯同級；印度、印尼、墨西哥、菲律賓、泰國、越南 3 級；俄羅斯、阿根廷、烏克蘭、委內瑞拉等 58 國 7 級。前次跟這次不同的只有喀麥隆（6 → 7）、幾內亞（7 → 6）、蓋亞那（5 → 4）。美國、日本、南韓、德國這類高所得的 OECD 會員國與歐元區國家照規則不評級（藍色），不代表沒有風險；另有 24 個小國與地區未評級。這不是主權信用評等：衡量的是出口信用的國家風險，OECD 也提醒不要跟信評機構的評等比較。OECD 只公布最新一版，沒有歷年的資料。',
        en: 'The country risk classification agreed by the Participants to the OECD Arrangement on Officially Supported Export Credits, from 0 to 7: the higher the number, the greater the risk that borrowers in the country cannot pay because of country-level causes such as transfer restrictions, war or natural disasters. The Participants’ export credit agencies charge minimum premiums based on it. The version valid from 16 October 2026 lists 201 countries: Singapore is the only one at 0; Taiwan is at 2, alongside Bulgaria, China, Hong Kong, Kuwait, Malaysia, Qatar, Saudi Arabia and the UAE; India, Indonesia, Mexico, the Philippines, Thailand and Vietnam are at 3; and 58 countries including Russia, Argentina, Ukraine and Venezuela are at 7. Only Cameroon (6 → 7), Guinea (7 → 6) and Guyana (5 → 4) changed from the previous classification. High-income OECD members and euro area countries such as the US, Japan, South Korea and Germany are not classified under the rules (blue), which does not mean they are risk-free; another 24 small countries and territories are not reviewed. This is not a sovereign credit rating: it measures country risk for export credits, and the OECD cautions against comparing it with credit agencies’ ratings. The OECD publishes only the latest version, with no history.',
      },
      unit: { zh: '級', en: 'grade' },
      file: 'country-risk.json',
      timeless: true,
      layer: { kind: 'categorical', ordinal: true, categories: RISK_CATEGORIES },
      format: riskLabel,
    },
  ],
};
