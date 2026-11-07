import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const COMPANIES = { zh: '家', en: 'companies' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const stockMarket: TopicDefinition = {
  id: 'stock-market',
  title: { zh: '各國股市規模', en: 'Stock markets by country' },
  shortTitle: { zh: '股市規模', en: 'Stocks' },
  defaultIndicator: 'cap-gdp',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（世界交易所聯合會 WFE 的資料）',
        en: 'World Bank, World Development Indicators (World Federation of Exchanges data)',
      },
      url: 'https://data.worldbank.org/indicator/CM.MKT.LCAP.GD.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '金融監督管理委員會證券期貨局 公開發行公司股票發行概況統計表、證券暨期貨市場重要指標',
        en: 'Financial Supervisory Commission (Taiwan), Securities and Futures Bureau: equity issuance statistics and key securities market indicators',
      },
      url: 'https://data.gov.tw/dataset/103533',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '中央銀行 新臺幣對美元匯率（年底）', en: 'Central Bank of the Republic of China (Taiwan), NT$/US$ exchange rate (year-end)' },
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
    zh: '各國的股市資料來自世界交易所聯合會（WFE），是世界銀行轉載的版本；一國有多個交易所時是各交易所的合計。泛歐交易所、那斯達克北歐這類跨國的交易所集團 WFE 只公布集團合計，所以法國、荷蘭、北歐各國、英國等近年沒有資料，世界值（有資料國家的合計）也因此偏低。印度、伊朗、波札那有幾年世界銀行的數字有誤，沒有收，見各國附註。台灣不在世界銀行的資料裡，改用金管會證期局的上市加上櫃公司（市值含第一上市櫃的外國企業，家數只算本國公司，跟 WFE 的口徑相同），美元用中央銀行的年底匯率換算，細節見台灣側欄的附註。周轉率與成交值（2026-11-07 加）：台灣用證期局「證券暨期貨市場重要指標」最近 11 年，周轉率是證期局依 WFE 月報推計的證交所數字（不含櫃買），成交值是證交所加櫃買中心上櫃股票的總成交值除以主計總處的 GDP；印度 2018 年的周轉率因為市值重複計算被壓低，沒有收。',
    en: "Stock market data for each country come from the World Federation of Exchanges (WFE), as republished by the World Bank; where a country has several exchanges, the figures are their total. For multinational exchange groups such as Euronext and Nasdaq Nordic the WFE publishes only group totals, so France, the Netherlands, the Nordic countries, the UK and others have no data in recent years, and the world figure (the total for countries with data) is low as a result. Some years for India, Iran and Botswana are left out because the World Bank's figures are wrong; see the country notes. Taiwan is not in the World Bank data, so figures for the Taiwan Stock Exchange plus the Taipei Exchange from the Financial Supervisory Commission's Securities and Futures Bureau are used instead (market value includes primary-listed foreign companies; the company count is domestic companies only, as reported to the WFE), converted at the central bank's year-end exchange rate; see the notes in Taiwan's panel. Turnover and value traded (added 7 November 2026): Taiwan uses the last 11 years of the bureau's key securities market indicators; turnover is the bureau's estimate for the Taiwan Stock Exchange from WFE monthly reports (excluding TPEx), and value traded is the Taiwan Stock Exchange plus TPEx-listed shares divided by DGBAS GDP. India's 2018 turnover is held down by double-counted market value and is left out.",
  },
  indicators: [
    {
      id: 'cap-gdp',
      label: { zh: '上市公司市值占 GDP', en: 'Stock market value, % of GDP' },
      description: {
        zh: '所有上市公司股票的年底總市值（股價乘上股數），占國內生產毛額的比例；不含投資基金與只持有其他上市公司股份的控股公司。超過 100% 表示股市的價值比一年的 GDP 還多。香港、瑞士這類金融中心有很多在外地營運的公司在這裡上市，所以特別高；股價漲跌也會讓比例一年內變動很多。',
        en: 'The total year-end market value of all listed companies (share price times shares outstanding) as a share of GDP, excluding investment funds and companies that only hold shares in other listed companies. Above 100% means the stock market is worth more than a year of GDP. Financial centres such as Hong Kong and Switzerland host many companies that operate elsewhere, so they are especially high; share price swings can also move the ratio a lot within a year.',
      },
      unit: '%',
      file: 'cap-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 200, 400] } },
      format: (v) => `${fixed(v, v >= 100 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'cap',
      label: { zh: '上市公司市值', en: 'Stock market value' },
      description: {
        zh: '所有上市公司股票的年底總市值，用年底匯率換算成美元，股價與匯率的變動都會影響。圓的面積與市值成正比。',
        en: 'The total year-end market value of all listed companies, converted to US dollars at year-end exchange rates, so it moves with both share prices and exchange rates. Circle area is proportional to market value.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'cap.json',
      layer: { kind: 'bubble', legendValues: [1e11, 1e12, 1e13] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
    },
    {
      id: 'companies',
      label: { zh: '上市公司家數', en: 'Listed companies' },
      description: {
        zh: '年底在交易所上市的本國公司家數，一家公司有好幾種股票只算一次，不含投資基金。各國的統計範圍不太一樣，例如中國 2019 年起含新三板、日本 2013 年起含 JASDAQ，見各國附註。圓的面積與家數成正比。',
        en: 'The number of domestic companies listed on stock exchanges at year end, counting a company with several classes of shares once and excluding investment funds. Coverage varies between countries; for example, China includes the NEEQ ("New Third Board") from 2019 and Japan includes JASDAQ from 2013 (see the country notes). Circle area is proportional to the number of companies.',
      },
      unit: COMPANIES,
      file: 'companies.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => `${fixed(v, 0)} ${tr(COMPANIES)}`,
      formatTick: formatLargeTick,
    },
    // 2026-11-07（製作手冊第二十五批 464）：周轉率與成交值占 GDP（pipeline/topics/stock_turnover.py），區分「股市大」與「股市熱」
    {
      id: 'turnover',
      label: { zh: '股票周轉率', en: 'Stock turnover ratio' },
      description: {
        zh: '一年的股票成交值除以市值：100% 表示一年內平均每一股換手一次，看股市「熱」不熱，跟市值占 GDP 的「大」不大是兩回事。2024 年中國大陸 296.7%、土耳其 253.1%、南韓 200.8%、卡達 171.7%、巴西 138.1%、台灣 135.4%（只算證交所）、日本 117.0% 最高；美國 68.5%、香港 65.9%、印度 65.2%，世界 94.2%；盧森堡、烏茲別克 0.1%、亞美尼亞接近 0。盧森堡是許多公司掛牌、卻不在那裡交易的地方。市值大跌的年份周轉率會虛高，當沖熱潮也會讓數字暴衝（台灣 2021 年 176.6%）。',
        en: 'A year’s value of shares traded divided by market value: 100% means each share changed hands once on average during the year. It shows how “hot” a market is, as opposed to how “big” (market value as a share of GDP). In 2024 mainland China (296.7%), Turkey (253.1%), South Korea (200.8%), Qatar (171.7%), Brazil (138.1%), Taiwan (135.4%, Taiwan Stock Exchange only) and Japan (117.0%) were highest; the US 68.5%, Hong Kong 65.9%, India 65.2%, and the world 94.2%; Luxembourg and Uzbekistan 0.1% and Armenia close to zero. Luxembourg is where many companies list but not where they trade. The ratio is inflated in years when market value falls sharply, and day-trading booms can make it spike (Taiwan 176.6% in 2021).',
      },
      unit: '%',
      file: 'turnover.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 60, 100, 200] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'traded-gdp',
      label: { zh: '股票成交值占 GDP', en: 'Value of stocks traded, % of GDP' },
      description: {
        zh: '一年的股票成交總值占 GDP 的比例，同時反映股市的大小與熱度。2025 年香港 1,372.4%（很多在中國大陸營運的公司在香港交易）、台灣 414.2%（上市加上櫃）、中國大陸 303.7%、日本 187.9%、美國 180.3%、南韓 176.3%、加拿大 126.0%；德國 29.4%，世界 158.7%。台灣 2021 年 517.0% 是當沖與散戶熱潮的高峰。',
        en: 'The total value of shares traded in a year as a share of GDP, reflecting both the size and the activity of a stock market. In 2025 Hong Kong 1,372.4% (many companies operating in mainland China trade there), Taiwan 414.2% (Taiwan Stock Exchange plus TPEx), mainland China 303.7%, Japan 187.9%, the US 180.3%, South Korea 176.3% and Canada 126.0%; Germany 29.4% and the world 158.7%. Taiwan’s 517.0% in 2021 was the peak of a day-trading and retail investor boom.',
      },
      unit: '%',
      file: 'traded-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 40, 80, 150, 300] } },
      format: (v) => `${fixed(v, v >= 100 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 2025,
    },
  ],
};
