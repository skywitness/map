import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 實質利率與食物價格通膨（2026-11-07，製作手冊第二十五批 461，合併候選 1107、1108；pipeline/topics/prices_food_rates.py，
 * 資料在 fiscal/）：物價與消費主題（prices.ts）用 withParts 接上
 */
const signed = (v: number, digits = 1) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : digits)}`;
const pct = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`;
const tick = (v: number) => `${v}%`;

export const pricesRatesPart: TopicPart = {
  name: { zh: '實質利率與食物價格', en: 'Real interest rates and food prices' },
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（實質利率 FR.INR.RINR、放款利率、GDP 平減指數，原始資料是 IMF 國際金融統計）',
        en: 'World Bank, World Development Indicators (real interest rate FR.INR.RINR, lending rate, GDP deflator; originally IMF International Financial Statistics)',
      },
      url: 'https://data.worldbank.org/indicator/FR.INR.RINR',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'FAOSTAT：Consumer Price Indices（食物與總消費者物價指數，月資料）', en: 'FAOSTAT: Consumer Price Indices (food and general CPI, monthly)' },
      url: 'https://www.fao.org/faostat/en/#data/CP',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處 消費者物價基本分類暨項目群指數（台灣的食物類與總指數）', en: 'DGBAS (Taiwan), CPI basic categories (food and all items for Taiwan)' },
      url: 'https://data.gov.tw/dataset/9158',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '實質利率是世界銀行轉載 IMF 的放款利率減 GDP 平減指數的變動率，不是央行的政策利率；各國最新年份差很多，地圖用 5 年內最近一年並標年份，台灣不在世界銀行的資料裡。食物價格通膨用 FAOSTAT 的食物與總消費者物價指數，各自 12 個月平均比前一年（缺月份的年不算），各國的食物籃不同；台灣用主計總處的「食物類」，含外食費，多數國家的食物指數不含餐廳。戰亂中的國家（蘇丹、敘利亞、巴勒斯坦）物價調查常中斷，數字要小心看。',
    en: "The real interest rate is the World Bank's figure, from the IMF, for the lending rate minus the change in the GDP deflator; it is not a central bank policy rate. Latest years differ widely, so the map uses each country's latest year within 5 years and labels it; Taiwan is not in the World Bank data. Food price inflation uses FAOSTAT's food and general consumer price indices, comparing each year's 12-month average with the previous year (years with missing months are left out); food baskets differ between countries. Taiwan uses the DGBAS food category, which includes eating out, while most countries' food indices exclude restaurants. Price surveys in countries at war (Sudan, Syria, Palestine) are often disrupted, so read those figures with care.",
  },
  panelExtra: () => import('./panels/PricesRatesPanel'),
  indicators: [
    {
      id: 'real-interest-rate',
      label: { zh: '實質利率（把錢放銀行會變多還是變少）', en: 'Real interest rate' },
      description: {
        zh: '不是央行的政策利率：這是銀行的放款利率扣掉通膨（GDP 平減指數的變動率）之後的實質利率，負的表示利息追不上物價、錢放著會被通膨吃掉。5 年內有資料的 111 國裡，2025 年馬達加斯加 +47.6%、巴西 +37.5%、莫三比克 +18.7%、獅子山 +18.3%、蓋亞那 +17.6% 最高（名目利率極高）；南蘇丹 −55.0%、辛巴威 −20.1%、海地 −15.9%、玻利維亞 −8.1%、埃及 −7.0%（2024 年）最低，負的有 18 國。南韓 +1.0%、中國大陸 +5.2%（2024 年）、香港 +4.1%、美國 −1.3%（2021 年）；日本、英國、德國近 5 年沒有放款利率資料。用 GDP 平減指數而不是消費者物價，跟一般人感受的實質利率不完全一樣；高通膨國家的數字很不穩定。',
        en: "Not a central bank policy rate: this is the banks' lending rate minus inflation (the change in the GDP deflator), so a negative value means interest does not keep up with prices and money in the bank loses value. Of 111 countries with data within 5 years, in 2025 Madagascar (+47.6%), Brazil (+37.5%), Mozambique (+18.7%), Sierra Leone (+18.3%) and Guyana (+17.6%) were highest, driven by very high nominal rates; South Sudan (−55.0%), Zimbabwe (−20.1%), Haiti (−15.9%), Bolivia (−8.1%) and Egypt (−7.0%, 2024) were lowest, and 18 countries were negative. South Korea +1.0%, mainland China +5.2% (2024), Hong Kong +4.1%, the US −1.3% (2021); Japan, the UK and Germany have no lending rate data in the last 5 years. It uses the GDP deflator rather than consumer prices, so it differs from the real rate people feel, and figures for high-inflation countries are very volatile.",
      },
      unit: '%',
      file: 'real-interest-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10, -5, -1, 1, 5, 10] } },
      format: (v) => `${signed(v)}%`,
      formatTick: tick,
      compareWorld: false,
      noValue: { TWN: { zh: '世界銀行沒有台灣的實質利率', en: 'The World Bank has no real interest rate for Taiwan' } },
    },
    {
      id: 'food-inflation',
      label: { zh: '食物價格通膨', en: 'Food price inflation' },
      description: {
        zh: '食物的消費者物價指數全年平均比前一年漲了多少，可以換成「食物減總指數」看吃的東西是不是比整體物價漲得快（正的表示食物漲得比較快）。2022 年全球糧價衝擊：201 國的食物通膨中位數 10.7%、86% 的國家食物比整體漲得快，德國 12.6%、美國 11.4%、英國 10.9%；2025 年中位數回到 3.0%。2025 年南蘇丹 113.9%、蘇丹 85.8%、伊朗 49.0%、辛巴威 42.2%、阿根廷 36.0% 最高；日本 6.1%（比整體多 3.0 個百分點，米價大漲）、台灣 3.0%、南韓 3.2%、美國 2.5%，中國大陸 −1.5%。各國的食物籃不同；台灣的食物類含外食費。',
        en: 'How much the average food consumer price index rose from the previous year; switch to “food minus all items” to see whether food rose faster than prices overall (positive means food rose faster). In the 2022 global food price shock, the median across 201 countries was 10.7% and food outpaced overall prices in 86% of countries: Germany 12.6%, the US 11.4%, the UK 10.9%. By 2025 the median was back to 3.0%. In 2025 South Sudan (113.9%), Sudan (85.8%), Iran (49.0%), Zimbabwe (42.2%) and Argentina (36.0%) were highest; Japan 6.1% (3.0 points above overall inflation, as rice prices soared), Taiwan 3.0%, South Korea 3.2%, the US 2.5%, and mainland China −1.5%. Food baskets differ between countries; Taiwan’s food category includes eating out.',
      },
      unit: '%',
      file: 'food-inflation/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [0, 2, 4, 6, 10, 25] },
        itemScales: { gap: { type: 'diverging', thresholds: [-5, -2, -0.5, 0.5, 2, 5] } },
      },
      dimension: {
        label: { zh: '看', en: 'Show' },
        options: [
          { id: 'food', label: { zh: '食物價格年增率', en: 'Food price inflation' } },
          { id: 'gap', label: { zh: '食物減總指數（百分點）', en: 'Food minus all items (points)' } },
        ],
        defaultOption: 'food',
      },
      format: pct,
      formatTick: tick,
      itemFormats: {
        gap: {
          unit: { zh: '百分點', en: 'percentage points' },
          format: (v) => tr({ zh: `${signed(v)} 個百分點`, en: `${signed(v)} pp` }),
          formatTick: (v) => `${v}`,
        },
      },
      compareWorld: false,
    },
  ],
};
