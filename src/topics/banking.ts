import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 銀行與信貸（新主題，2026-11-07，製作手冊第二十五批 463，合併候選 1105、1106；pipeline/topics/banking.py）：
 * 世界銀行 WDI 的私部門信貸、廣義貨幣、不良貸款、銀行資本，經濟的「金融服務」小類。
 * 台灣：信貸用央行的金融機構放款 ÷ 主計總處 GDP，不良貸款用金管會的本國銀行逾放比（2026 年 8 月）
 */
const pct = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)}%`;
const tick = (v: number) => `${v}%`;

export const banking: TopicDefinition = {
  id: 'banking',
  title: { zh: '銀行與信貸', en: 'Banking and credit' },
  shortTitle: { zh: '銀行與信貸', en: 'Banking' },
  defaultIndicator: 'private-credit',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（私部門信貸、廣義貨幣；不良貸款與銀行資本是 IMF Financial Soundness Indicators）',
        en: 'World Bank, World Development Indicators (private credit, broad money; non-performing loans and bank capital from IMF Financial Soundness Indicators)',
      },
      url: 'https://data.worldbank.org/indicator/FS.AST.PRVT.GD.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '中央銀行「金融機構放款與投資及金融市場票債券發行餘額」（台灣的放款）', en: 'Central Bank of the Republic of China (Taiwan), loans and investments of financial institutions (Taiwan’s loans)' },
      url: 'https://data.gov.tw/dataset/10748',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: '金管會銀行局「本國銀行逾放等財務資料」（台灣的逾放比）', en: 'Financial Supervisory Commission (Taiwan), domestic banks’ non-performing loans (Taiwan’s NPL ratio)' },
      url: 'https://data.gov.tw/dataset/10525',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: '行政院主計總處 國民所得統計（台灣的 GDP）', en: 'DGBAS (Taiwan), national accounts (Taiwan’s GDP)' },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '各國最新一年差很多，信貸與廣義貨幣用 5 年內、不良貸款與銀行資本用 4 年內最近一年，並標年份。香港、澳門這類金融中心的分母（本地 GDP）小，比值會特別高；信貸占 GDP 高不一定好，2008 年金融危機前的冰島（2007 年 243%）、愛爾蘭、西班牙都很高。各國對不良貸款的認定（逾期 90 天或其他）不完全一樣。台灣不在世界銀行的資料裡：私部門信貸用中央銀行「金融機構放款（含催收及轉銷呆帳）」年底餘額除以主計總處的名目 GDP，口徑比其他國家寬（含對政府與公營事業的放款、也含已經轉銷的呆帳）；不良貸款是金管會 38 家本國銀行 2026 年 8 月的逾期放款 ÷ 放款，不含外商銀行與農漁會信用部，畫在 2026 年。台灣的廣義貨幣與銀行資本沒有放。',
    en: 'Latest years vary a lot, so credit and broad money use each country’s latest year within 5 years, and non-performing loans and bank capital within 4 years, with the year labelled. Financial centres such as Hong Kong and Macao have small local GDP denominators and so very high ratios; high credit is not necessarily good: Iceland (243% in 2007), Ireland and Spain were all high before the 2008 crisis. Definitions of non-performing loans (90 days overdue or otherwise) are not fully harmonised. Taiwan is not in the World Bank data: its private credit is the central bank’s year-end loans of financial institutions (including overdue loans and written-off bad debts) divided by DGBAS nominal GDP, a wider scope than other countries’ (it includes loans to government and state enterprises, and written-off debts); its non-performing loan ratio is overdue loans over total loans at 38 domestic banks in August 2026 from the Financial Supervisory Commission, excluding foreign banks and farmers’ and fishermen’s credit unions, shown in 2026. Taiwan’s broad money and bank capital are not shown.',
  },
  panelExtra: () => import('./panels/BankingPanel'),
  indicators: [
    {
      id: 'private-credit',
      label: { zh: '銀行對私部門的信貸占 GDP', en: 'Bank credit to the private sector (% of GDP)' },
      description: {
        zh: '國內銀行與其他存款機構借給企業與家庭的錢占 GDP 的比例，是「金融體系有多大」最常用的度量。2025 年香港 222.6%、美國 201.3%、中國大陸 194.3%（2024 年）、日本 188.7%、台灣 174.3%（口徑較寬，見附註）、南韓 160.3%（2024 年），英國 112.4%（2024 年）、德國 77.3%（2023 年），世界 140.3%（2024 年）；海地與南蘇丹 3.2%、索馬利亞 5.4%（2024 年）、獅子山 5.5%、赤道幾內亞 5.8%（2023 年）最低。科威特的數字 2020 年起從 92% 掉到 6% 左右，是世界銀行資料的斷點，沒有用。',
        en: 'Loans from domestic banks and other deposit-taking institutions to firms and households as a share of GDP, the most common measure of how big a financial system is. In 2025 Hong Kong 222.6%, the US 201.3%, mainland China 194.3% (2024), Japan 188.7%, Taiwan 174.3% (wider scope, see the notes) and South Korea 160.3% (2024); the UK 112.4% (2024), Germany 77.3% (2023), and the world 140.3% (2024). Haiti and South Sudan (3.2%), Somalia (5.4%, 2024), Sierra Leone (5.5%) and Equatorial Guinea (5.8%, 2023) are lowest. Kuwait’s figure drops from 92% to about 6% from 2020, a break in the World Bank series, and is left out.',
      },
      unit: '%',
      file: 'private-credit.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 30, 50, 80, 120, 160] } },
      format: pct,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'broad-money',
      label: { zh: '廣義貨幣占 GDP', en: 'Broad money (% of GDP)' },
      description: {
        zh: '現金加上活期、定期、外幣存款等（各國的 M2、M3 等）占 GDP 的比例，看一國的存款與貨幣有多深。2025 年香港 481.0%、日本 246.8%、中國大陸 227.7%（2024 年）、澳門 201.2%、南韓 162.7%（2024 年）、英國 141.9%（2024 年），美國 99.7%，世界 135.7%（2024 年）；辛巴威 11.2%（2023 年）、赤道幾內亞 13.7%（2023 年）、安哥拉 13.8%、查德 16.0%（2021 年）、尼日 17.3% 最低。',
        en: 'Currency plus demand, time and foreign-currency deposits (each country’s M2, M3 or similar) as a share of GDP, a measure of financial depth. In 2025 Hong Kong 481.0%, Japan 246.8%, mainland China 227.7% (2024), Macao 201.2%, South Korea 162.7% (2024) and the UK 141.9% (2024); the US 99.7% and the world 135.7% (2024). Zimbabwe 11.2% (2023), Equatorial Guinea 13.7% (2023), Angola 13.8%, Chad 16.0% (2021) and Niger 17.3% are lowest.',
      },
      unit: '%',
      file: 'broad-money.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 40, 60, 80, 120, 180] } },
      format: pct,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'npl',
      label: { zh: '不良貸款占總貸款', en: 'Non-performing loans (% of total loans)' },
      description: {
        zh: '借款人逾期不還（通常是超過 90 天）的貸款占銀行總貸款的比例，看銀行的資產品質。查德 31.5%、赤道幾內亞 31.1%（都是 2023 年）、阿爾及利亞 20.7%、孟加拉 19.0%（2024 年）、迦納 18.9% 最高；中國大陸 1.5%（2024 年）、美國 1.0%、英國 0.9%、瑞士 0.8%，瑞典、挪威 0.4%、南韓 0.3%（2023 年）；台灣 38 家本國銀行 2026 年 8 月 0.14%，是最低的一群。預設看 2026 年，其他國家顯示 4 年內最近一年。',
        en: 'Loans whose borrowers have stopped paying (usually more than 90 days overdue) as a share of banks’ total loans, a measure of asset quality. Chad (31.5%) and Equatorial Guinea (31.1%, both 2023), Algeria (20.7%), Bangladesh (19.0%, 2024) and Ghana (18.9%) are highest; mainland China 1.5% (2024), the US 1.0%, the UK 0.9%, Switzerland 0.8%, Sweden and Norway 0.4% and South Korea 0.3% (2023). Taiwan’s 38 domestic banks were at 0.14% in August 2026, among the lowest. The default year is 2026; other countries show their latest year within 4 years.',
      },
      unit: '%',
      file: 'npl.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 10, 15] } },
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: tick,
      defaultYear: 2026,
      compareWorld: false,
    },
    {
      id: 'capital',
      label: { zh: '銀行資本占資產', en: 'Bank capital to assets' },
      description: {
        zh: '銀行的自有資本（股本與保留盈餘等）占總資產的比例，越高表示越能承受損失（這是不加風險權數的簡單比率，跟巴塞爾的資本適足率不同）。2025 年阿根廷 19.7%、馬爾地夫 17.4%、聖多美普林西比 16.7% 最高；美國 9.2%、香港 7.9%、德國 7.5%、南韓 6.3%（2023 年）、英國 5.6%、加拿大 4.9%、日本 4.1%（2022 年）、澳門 3.7%、孟加拉 2.3%（2024 年）；查德 −1.0%、赤道幾內亞 −6.4%（都是 2023 年）資本是負的。',
        en: 'Banks’ own capital (share capital, retained earnings and so on) as a share of total assets; higher means more room to absorb losses (a simple unweighted ratio, unlike the Basel risk-weighted capital ratio). In 2025 Argentina (19.7%), the Maldives (17.4%) and São Tomé and Príncipe (16.7%) are highest; the US 9.2%, Hong Kong 7.9%, Germany 7.5%, South Korea 6.3% (2023), the UK 5.6%, Canada 4.9%, Japan 4.1% (2022), Macao 3.7% and Bangladesh 2.3% (2024); Chad (−1.0%) and Equatorial Guinea (−6.4%, both 2023) have negative capital.',
      },
      unit: '%',
      file: 'capital.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 15] } },
      format: pct,
      formatTick: tick,
      compareWorld: false,
    },
  ],
};
