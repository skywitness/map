import { fixed, formatSignedPercent } from '../lib/format';
import type { TopicDefinition } from './types';

const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
/** 通膨率：負值用真正的減號；惡性通膨（委內瑞拉 2018 年 65,374%）不留小數 */
const inflation = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`;
const IMF_LICENSE = { zh: '註明來源即可使用', en: 'free to use with attribution' };
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

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
      name: { zh: '財政部 財政統計資料庫', en: 'Ministry of Finance (Taiwan), fiscal statistics database' },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjspf2',
      license: OPEN_DATA_TW,
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
    zh: '通膨率、政府債務、財政收支與物價水準 2026 年起為 IMF 推估值；開曼群島、古拉索等 IMF 未涵蓋的地區改用世界銀行資料。稅收用 OECD 全球稅收統計，印度、俄羅斯、沙烏地阿拉伯等 OECD 沒有的國家用 IMF 世界稅收資料庫補；日本等最新一年還沒公布的國家顯示前一年。台灣的稅收用財政部的賦稅負擔率（含社會安全捐）；IMF 的台灣債務與財政收支就是財政部的數字，範圍比其他國家窄，見台灣側欄的附註。法定的稅率（營所稅、所得稅最高稅率、營業稅）見「稅率」主題。',
    en: "Inflation, government debt, budget balance and price level figures from 2026 onward are IMF projections; places the IMF does not cover, such as the Cayman Islands and Curaçao, use World Bank data. Tax revenue is from the OECD Global Revenue Statistics, with the IMF's World Revenue Longitudinal Data filling in countries the OECD does not cover, such as India, Russia and Saudi Arabia; countries that have not yet reported the latest year, such as Japan, show the previous year. Taiwan's tax revenue is the Ministry of Finance's tax burden ratio including social security contributions. The IMF's debt and budget balance figures for Taiwan are the Ministry of Finance's own, with a narrower scope than other countries' figures; see the notes in Taiwan's panel. Statutory tax rates (corporate, top income tax, VAT) are in the Tax rates topic.",
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
  ],
};
