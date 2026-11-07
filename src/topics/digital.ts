import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, DimensionDef, IndicatorDef, Text, TopicDefinition } from './types';

const PER_100 = { zh: '門/百人', en: 'per 100 people' };

function per100(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_100,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)} ${tr(PER_100)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
/** ITU DataHub 與資安指數只准非商業使用，這幾個指標檔也用同一種授權（使用者 2026-10-30 決定照做、頁尾寫明） */
const ITU_NC = {
  zh: 'CC BY-NC-SA 3.0 IGO（只准非商業使用；4G／5G、國際頻寬、家戶、資安指數的資料檔同樣用這個授權）',
  en: 'CC BY-NC-SA 3.0 IGO (non-commercial only; the coverage, bandwidth, household and cybersecurity data files are shared under the same licence)',
};

/** 百分比的指標（第十批 169 的擴充） */
function percent(id: string, label: Text, description: Text, thresholds: number[], extra: Partial<IndicatorDef> = {}): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${v}%`,
    ...extra,
  };
}

/** 國際頻寬（bit/s）：100 萬以上寫 Mbit/s，1,000 以上寫 kbit/s */
function bps(v: number, digits = 1): string {
  if (v >= 1e6) return `${fixed(v / 1e6, digits)} Mbit/s`;
  if (v >= 1e3) return `${fixed(v / 1e3, digits)} kbit/s`;
  return `${fixed(v, 0)} bit/s`;
}

/** ITU 國家資安指數 2024 的五級（第 1 級最好） */
const GCI_TIERS: CategoryDef[] = [
  { value: 1, label: { zh: '第 1 級：模範（95–100 分）', en: 'Tier 1: Role-modelling (95–100)' } },
  { value: 2, label: { zh: '第 2 級：進階（85–95 分）', en: 'Tier 2: Advancing (85–95)' } },
  { value: 3, label: { zh: '第 3 級：建立中（55–85 分）', en: 'Tier 3: Establishing (55–85)' } },
  { value: 4, label: { zh: '第 4 級：發展中（20–55 分）', en: 'Tier 4: Evolving (20–55)' } },
  { value: 5, label: { zh: '第 5 級：起步（0–20 分）', en: 'Tier 5: Building (0–20)' } },
];

/** 只用現金的子項目（pipeline/topics/digital_cash.py 的 CASH；網購貨到付現另外一個指標） */
const CASH_USE: DimensionDef = {
  label: { zh: '哪一件事', en: 'Which transaction' },
  options: [
    { id: 'utilities', label: { zh: '付水電費', en: 'Utility bills' } },
    { id: 'wages', label: { zh: '領薪水', en: 'Wages' } },
    { id: 'agriculture', label: { zh: '賣農產品收款', en: 'Farm sales' } },
  ],
  defaultOption: 'utilities',
};

/** ITU 的資費籃子（2026-11-07，第二十五批 505）：低用量行動電話只到 2024 年 */
const PRICE_BASKETS = {
  label: { zh: '方案', en: 'Basket' },
  options: [
    { id: 'mobile-data', label: { zh: '只用數據的行動寬頻', en: 'Data-only mobile broadband' } },
    { id: 'fixed', label: { zh: '固網寬頻 5 GB', en: 'Fixed broadband 5 GB' } },
    { id: 'voice-low', label: { zh: '語音＋數據（低用量）', en: 'Voice and data (low usage)' } },
    { id: 'voice-high', label: { zh: '語音＋數據（高用量）', en: 'Voice and data (high usage)' } },
    { id: 'mobile-low', label: { zh: '行動電話（低用量，到 2024 年）', en: 'Mobile cellular (low usage, to 2024)' } },
  ],
  defaultOption: 'mobile-data',
};

export const digital: TopicDefinition = {
  id: 'digital',
  title: { zh: '各國網路與通訊普及', en: 'Internet and telecoms by country' },
  shortTitle: { zh: '數位', en: 'Digital' },
  defaultIndicator: 'internet-users',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD Government at a Glance 2025：Digital Government Index、OURdata Index', en: 'OECD Government at a Glance 2025: Digital Government Index, OURdata Index' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_GOV%40DF_GOV_DGOGD_2025&df[ag]=OECD.GOV.GIP',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: { zh: 'ITU：ICT Price Baskets（世界銀行 Data360 轉載的 ITU DataHub）', en: 'ITU: ICT Price Baskets (ITU DataHub via World Bank Data360)' },
      url: 'https://data360.worldbank.org/en/dataset/ITU_DH',
      license: { zh: 'CC BY-NC-SA 3.0 IGO（只准非商業使用）', en: 'CC BY-NC-SA 3.0 IGO (non-commercial use only)' },
    },
    {
      name: { zh: 'UNESCO UIS：ICT skills（ITU 家戶調查，上網活動與 SDG 4.4.1 數位技能）', en: 'UNESCO UIS: ICT skills (ITU household surveys; online activities and SDG 4.4.1 digital skills)' },
      url: 'https://databrowser.uis.unesco.org/',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'World Bank, World Development Indicators（ITU 資料）', en: 'World Bank, World Development Indicators (ITU data)' },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '數位發展部 數位近用調查', en: 'Ministry of Digital Affairs (Taiwan), Digital Access Survey' },
      url: 'https://data.gov.tw/dataset/5960',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '主計總處 家庭收支調查：家庭主要設備普及率（家用電腦）', en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure: household equipment (home computers)' },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908&sms=11530',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '國家通訊傳播委員會 電信統計', en: 'National Communications Commission (Taiwan), telecom statistics' },
      url: 'https://data.gov.tw/dataset/22589',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'ITU DataHub（世界銀行 Data360 轉載）：4G／5G 人口涵蓋率、每位網路使用者的國際頻寬、家戶上網率、家戶電腦擁有率',
        en: 'ITU DataHub (via World Bank Data360): 4G/5G population coverage, international bandwidth per internet user, households with internet and with a computer',
      },
      url: 'https://datahub.itu.int/',
      license: ITU_NC,
    },
    {
      name: { zh: 'ITU：Global Cybersecurity Index 2024', en: 'ITU, Global Cybersecurity Index 2024' },
      url: 'https://www.itu.int/epublications/publication/global-cybersecurity-index-2024',
      license: ITU_NC,
    },
    {
      name: { zh: 'World Bank：Global Findex Database 2025（數位支付、手機持有、現金）', en: 'World Bank, Global Findex Database 2025 (digital payments, mobile phone ownership, cash use)' },
      url: 'https://www.worldbank.org/en/publication/globalfindex',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '數位發展部 國內各場域行動支付滲透率（台灣的側欄）', en: 'Ministry of Digital Affairs (Taiwan), mobile payment use by venue (Taiwan panel)' },
      url: 'https://data.gov.tw/dataset/128268',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（換算台灣每百人用）',
        en: "United Nations, World Population Prospects 2024 (for Taiwan's per-100 rates)",
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  panelExtra: () => import('./panels/CashPanel'),
  note: {
    zh: '網路使用率、門號與寬頻的台灣不在 ITU 的資料庫中，改用數位發展部的調查與 NCC 的用戶數，定義與 ITU 大致相同，細節見台灣側欄的附註；ITU DataHub（4G／5G、國際頻寬、家戶）有台灣，家戶上網率仍用數位部的值，家戶電腦擁有率用主計總處家庭收支調查的值（ITU 與數位部的寫附註）。4G／5G、國際頻寬、家戶、資安指數是 ITU 的資料，只准非商業使用（CC BY-NC-SA 3.0 IGO），這幾個資料檔也用同一種授權。數位支付、手機持有是 15 歲以上的調查，各國用自己最新的一年。固網與行動網路的速度見「網路速度」主題，GitHub 上的開發者見「開發者與開源」主題。',
    en: "For internet use, subscriptions and broadband, Taiwan is not in the ITU database, so the Ministry of Digital Affairs survey and NCC subscription counts are used instead; their definitions are broadly the same as the ITU's (see the note in Taiwan's panel). ITU DataHub (4G/5G, bandwidth, households) does include Taiwan, but household internet access still uses the ministry's figure and household computer ownership the DGBAS Survey of Family Income and Expenditure, with the other figures in the note. The coverage, bandwidth, household and cybersecurity indicators are ITU data licensed for non-commercial use only (CC BY-NC-SA 3.0 IGO), and their data files are shared under the same licence. Digital payments and phone ownership come from surveys of people aged 15 and over, using each country's latest year. For fixed and mobile connection speeds, see the Internet speed topic; for developers on GitHub, the Developers topic.",
  },
  indicators: [
    {
      id: 'internet-users',
      label: { zh: '網路使用率', en: 'Internet users' },
      description: {
        zh: '過去 3 個月內曾經上網（任何裝置、任何地點）的人占總人口的比例。',
        en: 'Share of the population who used the internet (on any device, anywhere) in the last 3 months.',
      },
      unit: '%',
      file: 'internet-users.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 70, 85, 95] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    per100(
      'mobile-subscriptions',
      { zh: '行動電話用戶', en: 'Mobile subscriptions' },
      {
        zh: '每 100 人的行動電話門號數（月租與預付卡），一人可能有多個門號，所以可以超過 100。',
        en: 'Mobile phone subscriptions (postpaid and prepaid) per 100 people; one person can have several, so it can exceed 100.',
      },
      [25, 50, 75, 100, 125, 150],
    ),
    per100(
      'fixed-broadband',
      { zh: '固網寬頻用戶', en: 'Fixed broadband subscriptions' },
      {
        zh: '每 100 人的固定寬頻網路用戶數（光纖、纜線、ADSL 等，下載速率 256 kbps 以上）。通常一戶一個帳號，所以比個人使用率低。',
        en: 'Fixed broadband subscriptions (fibre, cable, DSL and so on, at least 256 kbit/s download) per 100 people. Usually one per household, so lower than individual usage rates.',
      },
      [1, 5, 10, 20, 30, 40],
    ),
    percent(
      'coverage-4g',
      { zh: '4G 人口涵蓋率', en: '4G coverage' },
      {
        zh: '住在 4G（或更快）行動網路訊號範圍內的人口比例，由各國主管機關申報（多半是室外訊號）。2024 年 215 個經濟體有值，中國、沙烏地、比利時等 100%，中非共和國 0.2%，北韓、厄利垂亞 0；台灣 100%。',
        en: 'Share of the population within range of a 4G (or faster) mobile signal, as reported by national regulators (mostly outdoor coverage). 215 economies have 2024 data: China, Saudi Arabia, Belgium and others are at 100%, the Central African Republic 0.2%, and North Korea and Eritrea 0; Taiwan 100%.',
      },
      [25, 50, 75, 90, 95, 99],
    ),
    percent(
      'coverage-5g',
      { zh: '5G 人口涵蓋率', en: '5G coverage' },
      {
        zh: '住在 5G 訊號範圍內的人口比例。2024 年有值的 112 個：巴林、丹麥、賽普勒斯、馬爾他 100%，美國、中國約 96%，印度 82%；台灣 98.2%（2021 年 85.0%）。有 69 個經濟體最新只到 2021 年。',
        en: 'Share of the population within range of a 5G signal. Of the 112 economies with 2024 data, Bahrain, Denmark, Cyprus and Malta are at 100%, the US and China about 96% and India 82%; Taiwan 98.2% (85.0% in 2021). For 69 economies the latest figure is from 2021.',
      },
      [10, 25, 50, 75, 90, 95],
    ),
    percent(
      'internet-women',
      { zh: '女性的網路使用率', en: 'Internet use: women' },
      {
        zh: '過去 3 個月內曾經上網的女性占女性人口的比例（ITU）。台灣用數位部的調查：2025 年女性 88.2%、男性 92.5%。很多國家只有一兩年，美國最後一年是 2015 年。',
        en: 'Share of women who used the internet in the last 3 months (ITU). Taiwan uses the Ministry of Digital Affairs survey: 88.2% of women and 92.5% of men in 2025. Many countries have only a year or two of data; the latest for the US is 2015.',
      },
      [10, 25, 50, 70, 85, 95],
      { compareWorld: true },
    ),
    percent(
      'internet-men',
      { zh: '男性的網路使用率', en: 'Internet use: men' },
      {
        zh: '過去 3 個月內曾經上網的男性占男性人口的比例（ITU）；台灣用數位部的調查。',
        en: 'Share of men who used the internet in the last 3 months (ITU); Taiwan uses the Ministry of Digital Affairs survey.',
      },
      [10, 25, 50, 70, 85, 95],
      { compareWorld: true },
    ),
    {
      id: 'internet-gender-gap',
      label: { zh: '網路使用的性別差距', en: 'Internet gender gap' },
      description: {
        zh: '女性網路使用率減男性（百分點），負的是女性較低。埃及 2022 年女 65.2%、男 79.3%（差 14.1），印度 2025 年差 13.6，巴基斯坦 2020 年差 10.4；女性較高的有馬爾地夫、牙買加、菲律賓。世界 2024 年女 68.2%、男 74.2%。台灣 2025 年差 −4.3（數位部）。',
        en: "Women's internet use rate minus men's, in percentage points; negative means women are lower. Egypt in 2022: 65.2% of women and 79.3% of men (a gap of 14.1); India's gap in 2025 was 13.6 and Pakistan's in 2020 10.4. Women are ahead in the Maldives, Jamaica and the Philippines. Worldwide in 2024: 68.2% of women and 74.2% of men. Taiwan's gap in 2025 was −4.3 (Ministry of Digital Affairs).",
      },
      unit: { zh: '百分點', en: 'points' },
      file: 'internet-gender-gap.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10, -5, -2, 2, 5, 10] } },
      format: (v) => tr({ zh: `${v > 0 ? '+' : ''}${fixed(v, 1)} 個百分點`, en: `${v > 0 ? '+' : ''}${fixed(v, 1)} points` }),
      formatTick: (v) => `${v > 0 ? '+' : ''}${v}`,
      compareWorld: true,
    },
    {
      id: 'bandwidth-per-user',
      label: { zh: '每位網路使用者的國際頻寬', en: 'International bandwidth per user' },
      description: {
        zh: '國際網路出口實際使用的頻寬除以網路使用者（ITU）。2023 年香港約 31 Mbit/s、新加坡 10.5、冰島 7.8、台灣 4.5 Mbit/s（第 4），南蘇丹約 0.5 kbit/s。香港、新加坡是轉運樞紐，所以偏高；日本、美國只到 2017 年、南韓到 2018 年。世界銀行 Data360 標的單位是 kbit/s，對照 ITU 原站的指標定義（bits/second）應是 bit/s。',
        en: 'International internet bandwidth actually used, divided by the number of internet users (ITU). In 2023: Hong Kong about 31 Mbit/s, Singapore 10.5, Iceland 7.8 and Taiwan 4.5 Mbit/s (4th); South Sudan about 0.5 kbit/s. Hong Kong and Singapore are transit hubs, so their figures are high; data for Japan and the US end in 2017 and South Korea in 2018. World Bank Data360 labels the unit kbit/s, but ITU’s own indicator definitions (bits per second) show it is bit/s.',
      },
      unit: 'bit/s',
      file: 'bandwidth-per-user.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000] } },
      format: (v) => bps(v),
      formatTick: (v) => bps(v, 0),
    },
    percent(
      'household-internet',
      { zh: '家戶上網率', en: 'Households with internet' },
      {
        zh: '家裡可以上網的家戶比例（ITU）。2024 年南韓 99.97%、挪威 99.5%，沙烏地、巴林、阿聯 100%，莫三比克 11.1%、尚比亞與馬拉威 21.2%。台灣用數位部的家戶連網率：2025 年 93.4%（ITU 的台灣 2024 年 89.5%）。',
        en: 'Share of households with internet access at home (ITU). In 2024: South Korea 99.97%, Norway 99.5%, Saudi Arabia, Bahrain and the UAE 100%; Mozambique 11.1%, Zambia and Malawi 21.2%. Taiwan uses the Ministry of Digital Affairs household rate: 93.4% in 2025 (ITU’s figure for Taiwan is 89.5% in 2024).',
      },
      [25, 50, 70, 85, 95],
    ),
    percent(
      'household-computer',
      { zh: '家戶電腦擁有率', en: 'Households with a computer' },
      {
        zh: '家裡有電腦（桌機、筆電或平板）的家戶比例（ITU），各國最新年份很分散。沙烏地、阿聯 2023 年 99.5%，馬拉威、莫三比克 3.3%。台灣用主計總處家庭收支調查的家庭主要設備普及率：2025 年 68.1%，2012 年最高（72.3%）以後沒有再超過。數位部的調查只到 2016 年（83.1%，同年主計總處 68.8%），兩個調查的定義不同；ITU 的台灣 2023 年 76.8%。',
        en: 'Share of households with a computer (desktop, laptop or tablet; ITU); the latest year varies widely by country. Saudi Arabia and the UAE: 99.5% in 2023; Malawi and Mozambique 3.3%. Taiwan uses the DGBAS Survey of Family Income and Expenditure: 68.1% in 2025, never higher since its 2012 peak (72.3%). The Ministry of Digital Affairs survey ended in 2016 (83.1%, against 68.8% in the DGBAS survey that year); the two define it differently. ITU’s figure for Taiwan is 76.8% in 2023.',
      },
      [10, 25, 50, 75, 90],
      // 年份到 2025 年（台灣主計總處），但 ITU 2021 年以後只有少數國家：預設 2021 年（197 國在 4 年內有資料，2024 年只有 82 國）
      { defaultYear: 2021 },
    ),
    percent(
      'digital-payments',
      { zh: '用過數位支付的人', en: 'Digital payments' },
      {
        zh: '15 歲以上過去一年用手機、網路或卡片付過款或收過款的比例（世界銀行 Global Findex）。2024 年調查的 108 個經濟體多半是中低所得國：蒙古 94.9%、肯亞 89.3%、中國 88.7%，尼日 12.3%、阿爾及利亞 13.1%；高所得國 2024 年多半沒有這題，用 2021 年。台灣 2021 年 87.7%。',
        en: 'Share of people aged 15 and over who made or received a payment by phone, internet or card in the past year (World Bank Global Findex). Most of the 108 economies surveyed in 2024 are low and middle income: Mongolia 94.9%, Kenya 89.3%, China 88.7%; Niger 12.3%, Algeria 13.1%. Most high-income countries were not asked in 2024, so their 2021 figures are used. Taiwan: 87.7% in 2021.',
      },
      [25, 50, 70, 85, 95],
    ),
    percent(
      'mobile-ownership',
      { zh: '自己有手機的人', en: 'Own a mobile phone' },
      {
        zh: '15 歲以上自己有手機的比例（世界銀行 Global Findex 2025，只有 2024 年）。挪威 99.8%、丹麥 99.4%，馬達加斯加 45.8%、查德 53.4%、尼日 53.7%；台灣 95.6%。跟「行動電話用戶」不同：那是門號數，一人可能有好幾個。',
        en: 'Share of people aged 15 and over who own a mobile phone (World Bank Global Findex 2025; 2024 only). Norway 99.8%, Denmark 99.4%; Madagascar 45.8%, Chad 53.4%, Niger 53.7%; Taiwan 95.6%. Unlike mobile subscriptions, which count SIM cards (one person can have several), this counts people.',
      },
      [50, 70, 85, 95],
    ),
    percent(
      'smartphone-main',
      { zh: '主要用智慧型手機的人', en: 'Main phone is a smartphone' },
      {
        zh: '15 歲以上主要使用的手機是智慧型手機的比例（世界銀行 Global Findex 2025，只有 2024 年）；台灣 89.2%。',
        en: 'Share of people aged 15 and over whose main mobile phone is a smartphone (World Bank Global Findex 2025; 2024 only); Taiwan 89.2%.',
      },
      [25, 50, 70, 85, 95],
    ),
    // 2026-11-05（製作手冊第二十二批 381）：離不開現金的人，Findex 2025 的現金題組；側欄 CashPanel
    {
      ...percent(
        'cash-only',
        { zh: '只用現金', en: 'Paid only in cash' },
        {
          zh: '15 歲以上過去一年只用現金做這件事的人占全部成年人的比例，選上方的「哪一件事」切換（世界銀行 Global Findex 2025，各國用 2021–2024 年最新的一年）。付水電費只用現金：阿爾巴尼亞 65.2%、菲律賓 62.5%、柬埔寨 59.6%、印尼 54.9% 最高，肯亞只有 1.4%、蒙古 2.2%、馬拉威 3.0%（行動支付普及的非洲國家反而最低，肯亞是因為 M-Pesa 手機錢包）。領薪水只領現金：埃及 26.5%、尼加拉瓜 24.7%，克羅埃西亞 0.7%。分母是全部成年人，不是有付水電費或有領薪水的人。Findex 以中低所得國家為主，高所得國家多半沒有問這幾題；台灣的現金題組是空的，點台灣看數位部的各場域行動支付滲透率。',
          en: 'Share of all adults (15+) who did this only in cash in the past year; switch with “Which transaction” above (World Bank Global Findex 2025, each country’s latest year in 2021–2024). Utility bills paid only in cash: Albania 65.2%, the Philippines 62.5%, Cambodia 59.6% and Indonesia 54.9% are highest; Kenya only 1.4%, Mongolia 2.2%, Malawi 3.0% (African countries with widespread mobile money are lowest; in Kenya that means M-Pesa). Wages received only in cash: Egypt 26.5%, Nicaragua 24.7%; Croatia 0.7%. The denominator is all adults, not just those who paid bills or received wages. Findex focuses on low and middle-income economies, and most high-income countries were not asked these questions; Taiwan’s cash questions are blank, so click Taiwan for the Ministry of Digital Affairs survey of mobile payment use by venue.',
        },
        [2, 5, 10, 20, 35, 50],
      ),
      file: 'cash/{item}.json',
      dimension: CASH_USE,
    },
    percent(
      'cash-on-delivery',
      { zh: '網購貨到付現的人', en: 'Cash on delivery for online purchases' },
      {
        zh: '15 歲以上過去一年網購時貨到用現金付款的比例（世界銀行 Global Findex，2021 年起）。菲律賓 21.6%、印尼 20.3%、泰國 19.0%、波士尼亞 18.8% 最高；衣索比亞 0.1%、坦尚尼亞 0.7%（很少人網購）。',
        en: 'Share of people aged 15 and over who paid cash on delivery for an online purchase in the past year (World Bank Global Findex, from 2021). The Philippines 21.6%, Indonesia 20.3%, Thailand 19.0% and Bosnia and Herzegovina 18.8% are highest; Ethiopia 0.1% and Tanzania 0.7% (few people shop online).',
      },
      [2, 5, 10, 15, 20],
      { file: 'cash/cod.json' },
    ),
    percent(
      'cash-habit',
      { zh: '習慣付現金的人', en: 'Pay cash out of habit' },
      {
        zh: '15 歲以上在店裡付現金、主要原因是「習慣付現金」的比例（世界銀行 Global Findex 2025 新增的題目，只有 2024 年）。斯里蘭卡 56.4%、印度 55.9%、加彭 50.7%、坦尚尼亞 50.5% 最高；波蘭只有 5.5%、蒙古 2.2%。另外四個原因（商家只收現金、用卡或手機比較貴、不信任卡或手機付款、其他）在側欄；「商家只收現金」孟加拉 22.8%、塞內加爾 17.2% 最高。',
        en: 'Share of people aged 15 and over who paid cash in shops mainly because they are used to paying in cash (a new question in the World Bank Global Findex 2025; 2024 only). Sri Lanka 56.4%, India 55.9%, Gabon 50.7% and Tanzania 50.5% are highest; Poland only 5.5% and Mongolia 2.2%. The other four reasons (the merchant only accepts cash, cards or phones cost more, distrust of card or phone payments, other) are in the side panel; “merchant only accepts cash” is highest in Bangladesh (22.8%) and Senegal (17.2%).',
      },
      [10, 20, 30, 40, 50],
      { file: 'cash-reason/habit.json' },
    ),
    // 2026-11-07（製作手冊第二十五批 505）ITU 的資費籃子（Data360 轉載），pipeline/topics/ict_prices.py
    {
      id: 'ict-price',
      label: { zh: '上網要花多少錢（每月美元）', en: 'Monthly price of mobile and fixed internet (USD)' },
      description: {
        zh: 'ITU 的資費籃子：在這一國買到符合規格的最便宜方案，每月要付多少美元（照各國當年匯率換算；ITU 經世界銀行 Data360 轉載）。2025 年只用數據的行動寬頻：伊朗 0.52、印尼 0.92、奈及利亞 0.99、印度 2.02、中國 2.75 美元最便宜，開曼群島 83.88、百慕達 80.00、福克蘭 62.96、諾魯 62.10、土庫曼 51.43 最貴；台灣 16.20、南韓 11.36、日本 18.54、美國 43.52。固網寬頻 5 GB：台灣 20.10、南韓 23.85、日本 28.85、美國 54.44、中國 4.12、印度 5.43，最貴英屬維京群島 121.00、開曼 108.00、卡達 100.27。小島貴是真的（靠衛星或海纜回傳）；價格 0（沒有商業服務）不畫。Data360 的標籤沒寫只用數據的籃子是幾 GB。',
        en: 'ITU price baskets: the monthly price in US dollars of the cheapest plan meeting each basket’s specification (converted at each year’s exchange rate; ITU data via the World Bank’s Data360). Data-only mobile broadband in 2025: cheapest in Iran 0.52, Indonesia 0.92, Nigeria 0.99, India 2.02 and China 2.75; most expensive in the Cayman Islands 83.88, Bermuda 80.00, the Falklands 62.96, Nauru 62.10 and Turkmenistan 51.43; Taiwan 16.20, South Korea 11.36, Japan 18.54, the US 43.52. Fixed broadband 5 GB: Taiwan 20.10, South Korea 23.85, Japan 28.85, the US 54.44, China 4.12, India 5.43; most expensive in the British Virgin Islands 121.00, the Caymans 108.00 and Qatar 100.27. Small islands really are expensive (satellite or submarine-cable backhaul); prices of 0 (no commercial service) are not shown. Data360’s label does not state how many GB the data-only basket includes.',
      },
      unit: { zh: '美元／月', en: 'USD/month' },
      file: 'prices/usd/{item}.json',
      dimension: PRICE_BASKETS,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2, 5, 10, 15, 25, 40] },
        itemScales: { fixed: { type: 'sequential', thresholds: [5, 10, 20, 30, 50, 80] } },
      },
      format: (v) => tr({ zh: `${fixed(v, 2)} 美元`, en: `$${fixed(v, 2)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'ict-price-gni',
      label: { zh: '上網的月費占人均所得', en: 'Monthly internet price as a share of income' },
      description: {
        zh: '同一個資費籃子的月費占每人每月國民所得毛額（GNI）的比例，看的是負不負擔得起；聯合國寬頻委員會 2025 年的目標是中低所得國家的入門寬頻不超過 2%。2025 年只用數據的行動寬頻：列支敦斯登 0.07%、香港 0.09% 最低，中非 53.67%、古巴 26.64%、蒲隆地 25.18% 最高；南韓 0.45%、日本 0.65%、美國 0.61%、中國 0.25%、印度 0.93%。固網寬頻 5 GB：賴比瑞亞 146.84%、中非 76.58%、尼日 50.98%。台灣沒有這個比例（ITU 原檔的台灣 GNI 是空的），只看得到美元價格。',
        en: 'The same baskets’ monthly price as a share of monthly gross national income (GNI) per person, i.e. how affordable they are; the UN Broadband Commission’s 2025 target is entry-level broadband below 2% in low- and middle-income countries. Data-only mobile broadband in 2025: lowest in Liechtenstein 0.07% and Hong Kong 0.09%, highest in the Central African Republic 53.67%, Cuba 26.64% and Burundi 25.18%; South Korea 0.45%, Japan 0.65%, the US 0.61%, China 0.25%, India 0.93%. Fixed broadband 5 GB: Liberia 146.84%, the Central African Republic 76.58%, Niger 50.98%. Taiwan has no share (its GNI is blank in the ITU data), only the dollar price.',
      },
      unit: '%',
      file: 'prices/gni/{item}.json',
      dimension: PRICE_BASKETS,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: (v) => fixed(v, 2) + '%',
      formatTick: (v) => v + '%',
      lowerIsBetter: true,
    },
    // 2026-11-07（製作手冊第二十五批 508）OECD 的數位政府指數與開放資料指數，pipeline/topics/digital_gov.py
    {
      id: 'digital-government',
      label: { zh: '數位政府指數（OECD）', en: 'Digital Government Index (OECD)' },
      description: {
        zh: 'OECD 的數位政府指數（DGI，0–1 分，Government at a Glance 2025；政府填問卷、OECD 查核，不是客觀量測）。這是候選「數位政府指數」的替代來源：聯合國的 EGDI 條款禁止轉載與改作，改用 OECD 自己的指數，只有 OECD 會員與少數夥伴。2025 年：南韓 0.948、澳洲 0.883、葡萄牙 0.857、英國 0.843、挪威 0.830、愛沙尼亞 0.828、丹麥與愛爾蘭 0.827、法國 0.803、日本 0.670；最低羅馬尼亞 0.237、克羅埃西亞 0.348、保加利亞 0.366、哥斯大黎加 0.451。子項目是六個面向。2022 與 2025 兩版題目有調整，OECD 提醒不要直接比名次。美國、德國、台灣沒有參加。',
        en: 'The OECD Digital Government Index (DGI, 0–1, Government at a Glance 2025; based on government questionnaires checked by the OECD, not objective measurement). This replaces the UN E-Government Development Index, whose terms prohibit republication and adaptation, and covers only OECD members and a few partners. 2025: South Korea 0.948, Australia 0.883, Portugal 0.857, the UK 0.843, Norway 0.830, Estonia 0.828, Denmark and Ireland 0.827, France 0.803, Japan 0.670; lowest Romania 0.237, Croatia 0.348, Bulgaria 0.366, Costa Rica 0.451. The sub-items are its six dimensions. The 2022 and 2025 questionnaires differ, and the OECD advises against comparing ranks directly. The US, Germany and Taiwan did not take part.',
      },
      unit: { zh: '分（0–1）', en: 'score (0–1)' },
      file: 'gov/dgi/{item}.json',
      dimension: {
        label: { zh: '面向', en: 'Dimension' },
        options: [
          { id: 'total', label: { zh: '總分', en: 'Overall' } },
          { id: 'design', label: { zh: '從設計就數位化', en: 'Digital by design' } },
          { id: 'data', label: { zh: '用資料驅動的公部門', en: 'Data-driven public sector' } },
          { id: 'platform', label: { zh: '政府即平台', en: 'Government as a platform' } },
          { id: 'open', label: { zh: '預設開放', en: 'Open by default' } },
          { id: 'user', label: { zh: '以使用者為中心', en: 'User-driven' } },
          { id: 'proactive', label: { zh: '主動提供服務', en: 'Proactiveness' } },
        ],
        defaultOption: 'total',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } },
      format: (v) => fixed(v, 3),
      formatTick: (v) => fixed(v, 1),
      missing: { zh: '沒有資料（只有參加 OECD 調查的約 40 國，沒有台灣）', en: 'No data (only about 40 countries in the OECD survey; Taiwan is not included)' },
    },
    {
      id: 'open-data',
      label: { zh: '開放資料指數（OECD OURdata）', en: 'Open data index (OECD OURdata)' },
      description: {
        zh: 'OECD 的開放政府資料指數（OURdata：open, useful, reusable government data，0–1 分，Government at a Glance 2025），看政府資料開了多少、好不好取用、有沒有推動再利用。2025 年：法國 0.960、南韓 0.951、波蘭 0.821、愛沙尼亞 0.762、西班牙 0.756、捷克 0.721、挪威 0.720、巴西 0.696、日本 0.657；英國 0.499、德國 0.469；最低土耳其 0.060、哥斯大黎加 0.136、泰國 0.142、印尼 0.143。子項目是三個面向。2022 與 2025 兩版題目有調整。台灣不在 OECD 的調查裡。',
        en: 'The OECD Open, Useful and Reusable Government Data index (OURdata, 0–1, Government at a Glance 2025): how much government data is open, how accessible it is and whether re-use is supported. 2025: France 0.960, South Korea 0.951, Poland 0.821, Estonia 0.762, Spain 0.756, Czechia 0.721, Norway 0.720, Brazil 0.696, Japan 0.657; the UK 0.499, Germany 0.469; lowest Türkiye 0.060, Costa Rica 0.136, Thailand 0.142, Indonesia 0.143. The sub-items are its three dimensions. The 2022 and 2025 questionnaires differ. Taiwan is not in the OECD survey.',
      },
      unit: { zh: '分（0–1）', en: 'score (0–1)' },
      file: 'gov/ourdata/{item}.json',
      dimension: {
        label: { zh: '面向', en: 'Dimension' },
        options: [
          { id: 'total', label: { zh: '總分', en: 'Overall' } },
          { id: 'availability', label: { zh: '資料有沒有開', en: 'Data availability' } },
          { id: 'accessibility', label: { zh: '好不好取用', en: 'Data accessibility' } },
          { id: 'reuse', label: { zh: '政府推動再利用', en: 'Government support for data re-use' } },
        ],
        defaultOption: 'total',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.2, 0.3, 0.4, 0.5, 0.6, 0.8] } },
      format: (v) => fixed(v, 3),
      formatTick: (v) => fixed(v, 1),
      missing: { zh: '沒有資料（只有參加 OECD 調查的約 40 國，沒有台灣）', en: 'No data (only about 40 countries in the OECD survey; Taiwan is not included)' },
    },
    {
      id: 'online-activity',
      label: { zh: '上網都在做什麼', en: 'What people do online' },
      description: {
        zh: '過去三個月有上網的人裡，做過這件事的比例（UNESCO UIS 轉載的 ITU 家戶調查；分母是網路使用者，不是全人口，網路普及率低的國家會偏高）。資料到 2024 年，各國最近一次調查在 2020–2024 年（超過 4 年的不畫）。社群網路：馬來西亞 97.1%、香港 94.3%、丹麥 90.0%、挪威 88.0%；中國 73.5%、日本 69.1%、南韓 66.7%、德國 58.0%、法國 40.1%。網路銀行：丹麥 97.7%、挪威 96.0%、芬蘭 90.0%、南韓 79.5%、德國 66.9%、日本 20.0%、中國 13.1%。網購：丹麥 81.7%、英國 78.9%（2020）、挪威 76.0%、瑞典 75.2%、南韓 73.4%、中國 59.9%、日本 51.4%。寫過程式：汶萊 31.9%、沙烏地 31.8%、阿聯 26.0%、馬來西亞 19.2%；中國 9.4%、南韓 7.5%、日本 5.8%。台灣與印度不在這份資料裡；美國只有 2015 年的調查，不畫。',
        en: 'Share of people who used the internet in the last three months who did each activity (ITU household surveys via UNESCO UIS; the denominator is internet users, not the whole population, so countries with low internet use can score high). Data run to 2024; each country’s latest survey is from 2020–2024 (surveys more than 4 years old are not shown). Social networks: Malaysia 97.1%, Hong Kong 94.3%, Denmark 90.0%, Norway 88.0%; China 73.5%, Japan 69.1%, South Korea 66.7%, Germany 58.0%, France 40.1%. Internet banking: Denmark 97.7%, Norway 96.0%, Finland 90.0%, South Korea 79.5%, Germany 66.9%, Japan 20.0%, China 13.1%. Online shopping: Denmark 81.7%, the UK 78.9% (2020), Norway 76.0%, Sweden 75.2%, South Korea 73.4%, China 59.9%, Japan 51.4%. Programming: Brunei 31.9%, Saudi Arabia 31.8%, the UAE 26.0%, Malaysia 19.2%; China 9.4%, South Korea 7.5%, Japan 5.8%. Taiwan and India are not in this dataset; the US has only a 2015 survey, which is not shown.',
      },
      unit: '%',
      file: 'activity/{item}.json',
      dimension: {
        label: { zh: '活動', en: 'Activity' },
        options: [
          { id: 'social', label: { zh: '社群網路', en: 'Social networks' } },
          { id: 'banking', label: { zh: '網路銀行', en: 'Internet banking' } },
          { id: 'shopping', label: { zh: '網購', en: 'Online shopping' } },
          { id: 'calls', label: { zh: '網路通話', en: 'Internet calls' } },
          { id: 'health', label: { zh: '找健康資訊', en: 'Health information' } },
          { id: 'course', label: { zh: '線上課程', en: 'Online courses' } },
          { id: 'civic', label: { zh: '線上參與公共事務', en: 'Online civic consultation or voting' } },
          { id: 'coding', label: { zh: '寫程式', en: 'Programming' } },
        ],
        defaultOption: 'social',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [20, 40, 60, 70, 80, 90] },
        itemScales: {
          course: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 50] },
          civic: { type: 'sequential', thresholds: [2, 5, 10, 15, 20, 30] },
          coding: { type: 'sequential', thresholds: [2, 4, 6, 10, 15, 25] },
          banking: { type: 'sequential', thresholds: [10, 20, 40, 60, 80, 90] },
          shopping: { type: 'sequential', thresholds: [10, 20, 40, 50, 60, 75] },
        },
      },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
    },
    {
      id: 'digital-skills',
      label: { zh: '數位技能達到進階以上的比例', en: 'Above-basic digital skills' },
      description: {
        zh: '成人在 SDG 4.4.1 定義的五個數位能力領域裡，達到「進階以上」的比例（UNESCO UIS，各國家戶調查的自陳，不是測驗；最近一次在 2022–2024 年，只有 24–40 國）。資訊與資料素養：南韓 90.1%、瑞士 83.3%、瑞典 83.2%、馬爾他 80.7%、西班牙 79.0%；俄羅斯 36.8%、多明尼加 21.6%、馬拉威 1.5%。數位內容創作：汶萊 87.1%、南韓 79.4%、阿曼 76.0%、日本 56.7%。安全：瑞典 91.8%、瑞士 65.5%、西班牙 62.9%、南韓 25.1%。「進階以上」跟只到「基本」的人是不同的兩群，這裡只畫進階以上。',
        en: 'Share of adults with above-basic skills in the five digital competence areas defined for SDG 4.4.1 (UNESCO UIS; self-reported in household surveys, not tested; latest survey 2022–2024, only 24–40 countries). Information and data literacy: South Korea 90.1%, Switzerland 83.3%, Sweden 83.2%, Malta 80.7%, Spain 79.0%; Russia 36.8%, the Dominican Republic 21.6%, Malawi 1.5%. Digital content creation: Brunei 87.1%, South Korea 79.4%, Oman 76.0%, Japan 56.7%. Safety: Sweden 91.8%, Switzerland 65.5%, Spain 62.9%, South Korea 25.1%. People at the above-basic level and those only at the basic level are separate groups; only above-basic is shown.',
      },
      unit: '%',
      file: 'skills/{item}.json',
      dimension: {
        label: { zh: '能力領域', en: 'Competence area' },
        options: [
          { id: 'information', label: { zh: '資訊與資料素養', en: 'Information and data literacy' } },
          { id: 'communication', label: { zh: '溝通與協作', en: 'Communication and collaboration' } },
          { id: 'content', label: { zh: '數位內容創作', en: 'Digital content creation' } },
          { id: 'safety', label: { zh: '安全', en: 'Safety' } },
          { id: 'problem', label: { zh: '問題解決', en: 'Problem solving' } },
        ],
        defaultOption: 'information',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 55, 70, 85] } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
    },
    {
      id: 'cybersecurity',
      label: { zh: '國家資安指數', en: 'Cybersecurity index' },
      description: {
        zh: 'ITU Global Cybersecurity Index 2024（第五版）依法律、技術、組織、能力建構、合作五個支柱打分，分成五級，不再公布名次。第 1 級 46 國（美國、英國、日本、南韓、印度、巴西、愛沙尼亞等），105 國在第 3、4 級。分數來自各國填的問卷，量的是政策與制度，不是實際的資安能力；跟 2020 年以前的版本不能直接比。台灣不是 ITU 會員，沒有評比。',
        en: 'The ITU Global Cybersecurity Index 2024 (fifth edition) scores countries on five pillars (legal, technical, organisational, capacity development and cooperation) and places them in five tiers instead of publishing ranks. 46 countries are in Tier 1 (including the US, the UK, Japan, South Korea, India, Brazil and Estonia), and 105 are in Tiers 3 and 4. Scores come from questionnaires filled in by each country and measure policies and institutions, not actual security capability; they are not comparable with editions before 2020. Taiwan is not an ITU member and is not assessed.',
      },
      unit: '',
      file: 'cybersecurity.json',
      layer: { kind: 'categorical', categories: GCI_TIERS, ordinal: true },
      format: (v) => tr(GCI_TIERS.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      timeless: true,
    },
  ],
};
