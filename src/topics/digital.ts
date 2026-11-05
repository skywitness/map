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

export const digital: TopicDefinition = {
  id: 'digital',
  title: { zh: '各國網路與通訊普及', en: 'Internet and telecoms by country' },
  shortTitle: { zh: '數位', en: 'Digital' },
  defaultIndicator: 'internet-users',
  defaultYear: 2024,
  sources: [
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
