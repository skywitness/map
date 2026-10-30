import { fixed, formatSignedPercent } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
/** 通膨率：負值用真正的減號；惡性通膨（委內瑞拉 2018 年 65,374%）不留小數 */
const inflation = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`;
const IMF_LICENSE = { zh: '註明來源即可使用', en: 'free to use with attribution' };
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 政府支出的用途（COFOG，pipeline/topics/fiscal_structure.py 的 SPENDING） */
const SPENDING: DimensionDef = {
  label: { zh: '用途', en: 'Function' },
  defaultOption: 'education',
  options: [
    { id: 'social', label: { zh: '社會保障', en: 'Social protection' } },
    { id: 'health', label: { zh: '醫療保健', en: 'Health' } },
    { id: 'education', label: { zh: '教育', en: 'Education' } },
    { id: 'defence', label: { zh: '國防', en: 'Defence' } },
    { id: 'public', label: { zh: '一般公共服務', en: 'General public services' } },
    { id: 'economic', label: { zh: '經濟事務', en: 'Economic affairs' } },
  ],
};

/** 稅收的類別（OECD 稅收分類，pipeline 的 TAX_MIX） */
const TAX_MIX: DimensionDef = {
  label: { zh: '稅收類別', en: 'Revenue type' },
  defaultOption: 'personal',
  options: [
    { id: 'personal', label: { zh: '個人所得稅', en: 'Personal income tax' } },
    { id: 'corporate', label: { zh: '公司所得稅', en: 'Corporate income tax' } },
    { id: 'ssc', label: { zh: '社會安全捐', en: 'Social security contributions' } },
    { id: 'property', label: { zh: '財產稅', en: 'Property taxes' } },
    { id: 'goods', label: { zh: '商品與勞務稅', en: 'Taxes on goods and services' } },
  ],
};

export const fiscal: TopicDefinition = {
  id: 'fiscal',
  title: { zh: '各國物價與財政', en: 'Prices and public finances by country' },
  shortTitle: { zh: '物價與財政', en: 'Prices & debt' },
  defaultIndicator: 'inflation',
  defaultYear: 2025,
  sources: [
    {
      name: 'IMF, World Economic Outlook (October 2026)',
      url: 'https://www.imf.org/external/datamapper/',
      license: IMF_LICENSE,
    },
    {
      name: { zh: 'OECD, Global Revenue Statistics Database（稅收）', en: 'OECD, Global Revenue Statistics Database (tax revenue)' },
      url: 'https://www.oecd.org/en/data/dashboards/global-revenue-statistics.html',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'IMF, World Revenue Longitudinal Data（WoRLD，OECD 沒有的國家的稅收）',
        en: 'IMF, World Revenue Longitudinal Data (WoRLD; tax revenue for countries the OECD does not cover)',
      },
      url: 'https://data.imf.org/en/datasets/IMF.FAD:WORLD',
      license: IMF_LICENSE,
    },
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    {
      name: { zh: 'World Bank, International Comparison Program 2021（食物支出占消費）', en: 'World Bank, International Comparison Program 2021 (food share of consumption)' },
      url: 'https://datacatalog.worldbank.org/search/dataset/0066092/international-comparison-program-2021',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '財政部 財政統計資料庫', en: 'Ministry of Finance (Taiwan), fiscal statistics database' },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjspf2',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'IMF, Government Finance Statistics：Expenditure by Function of Government（COFOG）',
        en: 'IMF, Government Finance Statistics: Expenditure by Function of Government (COFOG)',
      },
      url: 'https://data.imf.org/en/datasets/IMF.STA:GFS_COFOG',
      license: IMF_LICENSE,
    },
    {
      name: 'IMF, Historical Public Debt Database',
      url: 'https://data.imf.org/en/datasets/IMF.FAD:HPD',
      license: IMF_LICENSE,
    },
    {
      name: {
        zh: '行政院主計總處 總體統計資料庫（台灣債務附註用的 GDP）',
        en: "DGBAS (Taiwan), National Statistics Database (GDP for the note on Taiwan's debt)",
      },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '通膨率、政府債務、財政收支與物價水準 2026 年起為 IMF 推估值；開曼群島、古拉索等 IMF 未涵蓋的地區改用世界銀行資料。稅收用 OECD 全球稅收統計，印度、俄羅斯、沙烏地阿拉伯等 OECD 沒有的國家用 IMF 世界稅收資料庫補；日本等最新一年還沒公布的國家顯示前一年。台灣的稅收用財政部的賦稅負擔率（含社會安全捐）；IMF 的台灣債務與財政收支就是財政部的數字，範圍比其他國家窄，見台灣側欄的附註。法定的稅率（營所稅、所得稅最高稅率、營業稅）見「稅率」主題。政府支出的用途用 IMF 的 COFOG 分類（一般政府，約 90 國），教育、醫療兩項在 IMF 沒有或比較舊的國家用世界銀行 WDI（UNESCO、WHO）補；台灣用財政部各級政府歲出的政事別對到最接近的類別。稅收的組成是 OECD 全球稅收統計占稅收總額的比例，台灣用財政部依 OECD 分類編的賦稅收入結構。1800 年起的政府債務是 IMF 的歷史公共債務資料庫（到 2015 年，早年多半只有中央政府），跟現在的「政府債務占 GDP」分開。',
    en: "Inflation, government debt, budget balance and price level figures from 2026 onward are IMF projections; places the IMF does not cover, such as the Cayman Islands and Curaçao, use World Bank data. Tax revenue is from the OECD Global Revenue Statistics, with the IMF's World Revenue Longitudinal Data filling in countries the OECD does not cover, such as India, Russia and Saudi Arabia; countries that have not yet reported the latest year, such as Japan, show the previous year. Taiwan's tax revenue is the Ministry of Finance's tax burden ratio including social security contributions. The IMF's debt and budget balance figures for Taiwan are the Ministry of Finance's own, with a narrower scope than other countries' figures; see the notes in Taiwan's panel. Statutory tax rates (corporate, top income tax, VAT) are in the Tax rates topic. Spending by function uses the IMF's COFOG classification (general government, about 90 countries); for education and health, countries the IMF lacks or has only older data for use World Bank WDI figures (UNESCO, WHO); Taiwan's figures map the Ministry of Finance's functional classification of all levels of government to the closest categories. The tax mix is each category's share of total tax revenue from the OECD Global Revenue Statistics; Taiwan uses the Ministry of Finance's tax revenue structure under the OECD classification. Government debt since 1800 comes from the IMF Historical Public Debt Database (to 2015; early years are mostly central government only) and is kept separate from the current government debt indicator.",
  },
  indicators: [
    {
      id: 'inflation',
      label: { zh: '通膨率', en: 'Inflation' },
      description: {
        zh: '消費者物價（CPI）全年平均比前一年漲了多少。負值表示物價下跌（通縮），在最淺的一級；一年漲 25% 以上的嚴重通膨（例如委內瑞拉、辛巴威、阿根廷）都在最深的一級。',
        en: 'How much average consumer prices (CPI) rose from the previous year. Negative values mean falling prices (deflation) and fall in the lightest class; inflation of 25% a year or more (as in Venezuela, Zimbabwe or Argentina) is all in the darkest class.',
      },
      unit: '%',
      file: 'inflation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 2, 4, 6, 10, 25] } },
      format: inflation,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'price-level',
      label: { zh: '物價水準', en: 'Price level' },
      description: {
        zh: '同樣一籃商品與服務，換算成美元後在各國要花多少錢，以美國為 100：50 表示只要美國的一半。用購買力平價除以匯率算出，所以匯率變動也有影響（例如日圓貶值，日本就變便宜）。',
        en: 'What the same basket of goods and services costs in each country once converted to US dollars, with the United States at 100: 50 means half the US price. It is the purchasing power parity rate divided by the exchange rate, so currency moves matter too (a weaker yen makes Japan cheaper, for example).',
      },
      unit: { zh: '美國 = 100', en: 'US = 100' },
      file: 'price-level.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 80, 100] } },
      format: (v) => fixed(v, 0),
      formatTick: (v) => `${v}`,
      compareWorld: true,
    },
    {
      id: 'government-debt',
      label: { zh: '政府債務占 GDP', en: 'Government debt, % of GDP' },
      description: {
        zh: '各級政府（含社會保險基金）的債務總額占國內生產毛額的比例。歐盟以 60% 為上限。台灣用的是公共債務法的口徑，範圍比較窄，見台灣的附註。',
        en: "Total debt of all levels of government (including social security funds) as a share of GDP. The EU sets a limit of 60%. Taiwan's figure follows its Public Debt Act and has a narrower scope; see the note in Taiwan's panel.",
      },
      unit: '%',
      file: 'government-debt.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 80, 100, 150] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'fiscal-balance',
      label: { zh: '財政收支占 GDP', en: 'Budget balance, % of GDP' },
      description: {
        zh: '政府一年的收入減支出（各級政府的淨借貸），占國內生產毛額的比例。橘色是赤字、綠色是盈餘；歐盟要求赤字不超過 3%。',
        en: 'Government revenue minus spending in a year (net lending or borrowing of all levels of government) as a share of GDP. Orange means a deficit, green a surplus; the EU caps deficits at 3%.',
      },
      unit: '%',
      file: 'fiscal-balance.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-6, -3, -1, 1, 3, 6] } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, 0),
      compareWorld: true,
    },
    {
      id: 'tax-revenue',
      label: { zh: '稅收占 GDP', en: 'Tax revenue, % of GDP' },
      description: {
        zh: '各級政府的稅收加上社會安全捐（勞保、健保這類強制保費），占國內生產毛額的比例，也就是 OECD 定義的租稅負擔率。OECD 沒有的國家改用 IMF 的資料，有些只有中央政府。',
        en: 'Taxes collected by all levels of government plus social security contributions (compulsory social insurance premiums) as a share of GDP: the tax-to-GDP ratio as defined by the OECD. Countries the OECD does not cover use IMF data, some for central government only.',
      },
      unit: '%',
      file: 'tax-revenue.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] } },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'spending',
      label: { zh: '占政府支出', en: 'Share of government spending' },
      description: {
        zh: '一般政府（中央、地方加社會保險基金）的總支出裡，花在這個用途的比例（聯合國的政府功能分類 COFOG）。歐洲的社會保障占四成上下，美國醫療占四分之一；社會保障是年金、失業、家庭與社會救助，一般公共服務含債務利息，經濟事務是交通、產業與能源。台灣用財政部的政事別，教育含科學與文化，比其他國家寬。',
        en: "The share of total general government spending (central, local and social security funds) that goes to this function, by the UN Classification of the Functions of Government (COFOG). Social protection takes around 40% in Europe, health a quarter in the US. Social protection covers pensions, unemployment, family and social assistance; general public services include interest on debt; economic affairs cover transport, industry and energy. Taiwan's figures use the Ministry of Finance's functional classification, where education also includes science and culture.",
      },
      unit: { zh: '% 的政府支出', en: '% of government spending' },
      file: 'spending/{item}.json',
      dimension: SPENDING,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [8, 10, 12, 14, 17, 20] },
        itemScales: {
          social: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 40] },
          health: { type: 'sequential', thresholds: [5, 8, 10, 12, 15, 20] },
          defence: { type: 'sequential', thresholds: [2, 3, 4, 6, 8, 12] },
          public: { type: 'sequential', thresholds: [8, 10, 12, 15, 20, 25] },
          economic: { type: 'sequential', thresholds: [6, 8, 10, 12, 15, 20] },
        },
      },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'tax-mix',
      label: { zh: '占稅收', en: 'Share of tax revenue' },
      description: {
        zh: '這類稅收占稅收總額（含社會安全捐）的比例。丹麥的個人所得稅占一半以上、社會安全捐幾乎是零；日本、捷克靠社會安全捐，中國靠營業稅這類商品與勞務稅，資源國靠公司所得稅。財產稅含證券交易稅、遺產稅，商品與勞務稅含營業稅、貨物稅與關稅。',
        en: 'This type of revenue as a share of total tax revenue (including social security contributions). Personal income tax brings in more than half in Denmark, where social security contributions are almost nil; Japan and Czechia rely on social security contributions, China on taxes on goods and services such as VAT, and resource exporters on corporate income tax. Property taxes include transaction and estate taxes; taxes on goods and services include VAT, excise and customs duties.',
      },
      unit: { zh: '% 的稅收', en: '% of tax revenue' },
      file: 'tax-mix/{item}.json',
      dimension: TAX_MIX,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 40] },
        itemScales: {
          corporate: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] },
          property: { type: 'sequential', thresholds: [1, 2, 4, 6, 8, 12] },
          goods: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 70] },
        },
      },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'debt-history',
      label: { zh: '政府債務（1800–2015 年）', en: 'Government debt, 1800–2015' },
      description: {
        zh: '政府總債務占 GDP，IMF 歷史公共債務資料庫。英國打完拿破崙戰爭的 1819 年 260%、二戰後的 1946 年 270%，日本 1944 年 204%，法國 1922 年 236%；1800 年只有 3 國有資料，1900 年 21 國，2000 年起才幾乎全有。早年多半只算中央政府，資料到 2015 年，之後見「政府債務占 GDP」。',
        en: 'Gross government debt as a share of GDP, from the IMF Historical Public Debt Database. Britain hit 260% in 1819 after the Napoleonic Wars and 270% in 1946, Japan 204% in 1944, France 236% in 1922. Only 3 countries have data for 1800, 21 for 1900, and nearly all only from 2000. Early years mostly cover central government only; the data end in 2015 (see Government debt, % of GDP for later years).',
      },
      unit: '%',
      file: 'debt-history.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 80, 100, 150] } },
      format: percent,
      formatTick: percentTick,
      defaultYear: 1946,
    },
    {
      id: 'food-share',
      label: { zh: '收入有多少花在吃', en: 'Share spent on food' },
      description: {
        zh: '食物與非酒精飲料占個人實際消費的比例（世界銀行國際比較計畫，2017、2021 兩期）。越窮的國家越高：南蘇丹 84%、安哥拉 66%、尼泊爾 59%，奈及利亞 44%、印度 29%、中國 16%，日本 13%、台灣 12%、南韓 10%，美國 6% 最低。分母含政府提供的醫療、教育，比只算家庭支出的比例低。',
        en: 'Food and non-alcoholic beverages as a share of individual actual consumption (World Bank International Comparison Program, 2017 and 2021). The poorer the country, the higher the share: South Sudan 84%, Angola 66%, Nepal 59%, Nigeria 44%, India 29%, China 16%, Japan 13%, Taiwan 12%, South Korea 10%, and the US lowest at 6%. The denominator includes health and education provided by the government, so shares are lower than those based on household spending alone.',
      },
      unit: '%',
      file: 'food-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 30, 40, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
