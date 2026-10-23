import { fixed, formatLargeTick, intlDollars, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)}%`;
const pctTick = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v)}%`;
const USD = { zh: '美元', en: 'US$' };
const INTL = { zh: '國際元', en: 'Int$' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const IMF_LICENSE = { zh: '註明出處即可使用', en: 'free to use with attribution' };

// 財富指標共用的說明
const NET_WEALTH = {
  zh: '淨財富是房子、土地、存款、股票、保險等資產，減去房貸等負債。',
  en: 'Net wealth is homes, land, deposits, shares, insurance and other assets minus mortgages and other debts.',
};
const MARKET = {
  zh: '用 2025 年的匯率與物價換算成美元（之前的年份已扣除通膨），也就是這些財富拿到國外值多少錢。',
  en: 'Converted to US dollars at 2025 exchange rates and prices (earlier years are adjusted for inflation), i.e. what the wealth is worth abroad.',
};
const PPP = {
  zh: '用購買力平價換算：扣掉各國物價的差異，表示這些財富在自己國家買得到多少東西，物價低的國家會比用匯率換算高。單位是 2025 年的國際元。',
  en: 'Converted at purchasing power parity, which removes price differences between countries to show what the wealth buys at home; countries with low prices come out higher than at market exchange rates. In 2025 international dollars.',
};
const MEAN = {
  zh: '20 歲以上的人平均擁有多少淨財富。平均數會被少數富豪拉高，請對照財富中位數。',
  en: 'Average net wealth of people aged 20 and over. The average is pulled up by the richest few, so compare it with median wealth.',
};
const MEDIAN = {
  zh: '把所有成年人依財富多寡排隊，站在正中間那個人的淨財富，不受少數富豪影響，比較能代表一般人。平均數比中位數高越多，財富越集中在少數人手上。',
  en: 'The net wealth of the adult in the middle when everyone is lined up from poorest to richest. It is not affected by the richest few, so it better reflects a typical person. The further the average is above the median, the more wealth is concentrated at the top.',
};
const join = (...parts: { zh: string; en: string }[]) => ({
  zh: parts.map((p) => p.zh).join(''),
  en: parts.map((p) => p.en).join(' '),
});

export const wealth: TopicDefinition = {
  id: 'wealth',
  title: { zh: '各國平均存款與財產', en: 'Savings and wealth by country' },
  shortTitle: { zh: '存款與財產', en: 'Wealth' },
  defaultIndicator: 'deposits-per-person',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'IMF, Financial Access Survey（存款）', en: 'IMF, Financial Access Survey (deposits)' },
      url: 'https://data.imf.org/en/datasets/IMF.STA:FAS',
      license: IMF_LICENSE,
    },
    {
      name: {
        zh: 'IMF, World Economic Outlook (October 2026)（人均 GDP、國民儲蓄）',
        en: 'IMF, World Economic Outlook (October 2026) (GDP per capita, national saving)',
      },
      url: 'https://data.imf.org/en/datasets/IMF.RES:WEO',
      license: IMF_LICENSE,
    },
    {
      name: { zh: 'World Inequality Database（財富）', en: 'World Inequality Database (wealth)' },
      url: 'https://wid.world/',
      license: { zh: 'CC BY-NC-SA 4.0（非商業使用）', en: 'CC BY-NC-SA 4.0 (non-commercial)' },
    },
    {
      name: { zh: 'OECD, National Accounts at a Glance（家庭儲蓄率）', en: 'OECD, National Accounts at a Glance (household saving)' },
      url: 'https://www.oecd.org/en/data/indicators/household-savings.html',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '中央銀行 金融統計', en: 'Central Bank of the Republic of China (Taiwan), financial statistics' },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '行政院主計總處 國民所得統計、國富統計、家庭財富分配統計、家庭收支調查',
        en: 'DGBAS (Taiwan), national accounts, national wealth, household wealth distribution and household survey statistics',
      },
      url: 'https://www.stat.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '存款是 IMF 金融服務可及性調查中，家庭與企業在商業銀行、信用合作社與其他收受存款機構（IMF 的定義也含貨幣市場基金）的存款合計，用當年匯率換算；有些國家只有商業銀行的資料（見側欄附註）。財富來自 World Inequality Database（WID）：多數國家沒有財富分布的調查或稅務資料（2010 年只有約 30 國有），中位數與占比是 WID 用模型推估的，最近幾年也是往後推的估計；金額用 2025 年的匯率、物價或購買力平價換算。WID 的數字採 CC BY-NC-SA 4.0 授權（非商業使用、相同方式分享）。台灣的存款用中央銀行金融統計，家庭儲蓄率用主計總處國民所得統計；主計總處國富統計、家庭財富分配統計與家庭收支調查的數字列在台灣的附註。',
    en: "Deposits are the IMF Financial Access Survey totals of household and business deposits at commercial banks, credit unions and other deposit takers (which by the IMF's definition include money market funds), at current exchange rates; some countries report commercial banks only (see the country notes). Wealth comes from the World Inequality Database (WID): most countries have no survey or tax data on the wealth distribution (only about 30 did in 2010), so WID models the medians and shares, and the latest years are extrapolations; amounts use 2025 exchange rates, prices or purchasing power parities. WID-derived figures are under CC BY-NC-SA 4.0 (non-commercial, share-alike). Taiwan's deposits come from the central bank and its household saving rate from DGBAS's national accounts; figures from DGBAS's national wealth, household wealth distribution and household income surveys are listed in Taiwan's notes.",
  },
  panelExtra: () => import('./panels/WealthPanel'),
  indicators: [
    {
      id: 'deposits-per-person',
      label: { zh: '平均每人存款', en: 'Deposits per person' },
      description: {
        zh: '家庭與企業在銀行、信用合作社等機構的存款總額（活期、定期、外幣），除以全國人口，用當年匯率換算成美元。含企業的存款，所以不是一般人戶頭裡有多少錢；香港、新加坡這類金融中心特別高。',
        en: 'Total deposits of households and businesses at banks, credit unions and other deposit takers (current, savings and foreign-currency accounts), divided by the population and converted to US dollars at current exchange rates. Business deposits are included, so this is not what a typical person has in the bank; financial centres such as Hong Kong and Singapore stand out.',
      },
      unit: USD,
      file: 'deposits-per-person.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2500, 5000, 10000, 25000, 50000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'deposits-gdp',
      label: { zh: '存款占 GDP', en: 'Deposits, % of GDP' },
      description: {
        zh: '年底的存款餘額相當於一年 GDP 的多少。超過 100% 表示存款比全國一年生產的價值還多。',
        en: "Deposits outstanding at year end as a share of the year's GDP. Above 100% means deposits exceed the value of everything the country produces in a year.",
      },
      unit: '%',
      file: 'deposits-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 80, 120, 180] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: pctTick,
    },
    {
      id: 'mean-wealth',
      label: { zh: '平均財富', en: 'Average wealth per adult' },
      description: join(MEAN, NET_WEALTH, MARKET),
      unit: USD,
      file: 'mean-wealth.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10000, 25000, 50000, 100000, 250000, 500000] },
      },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'mean-wealth-ppp',
      label: { zh: '平均財富（購買力平價）', en: 'Average wealth per adult (PPP)' },
      description: join(MEAN, NET_WEALTH, PPP),
      unit: INTL,
      file: 'mean-wealth-ppp.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [25000, 50000, 100000, 200000, 400000, 600000] },
      },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'median-wealth',
      label: { zh: '財富中位數', en: 'Median wealth per adult' },
      description: join(MEDIAN, NET_WEALTH, MARKET),
      unit: USD,
      file: 'median-wealth.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2500, 5000, 10000, 25000, 50000, 100000] },
      },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'median-wealth-ppp',
      label: { zh: '財富中位數（購買力平價）', en: 'Median wealth per adult (PPP)' },
      description: join(MEDIAN, NET_WEALTH, PPP),
      unit: INTL,
      file: 'median-wealth-ppp.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [5000, 10000, 25000, 50000, 100000, 200000] },
      },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'top10-wealth-share',
      label: { zh: '最富有 10% 的財富占比', en: 'Wealth share of the richest 10%' },
      description: {
        zh: '財富最多的 10% 成年人，擁有全國淨財富的幾成。顏色越深，財富越集中在少數人手上。多數國家沒有財富分布的直接資料，是 WID 推估的。',
        en: "The share of a country's net wealth owned by the wealthiest 10% of adults. Darker means wealth is more concentrated. For most countries there is no direct data on the wealth distribution, so these are WID estimates.",
      },
      unit: '%',
      file: 'top10-wealth-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [57, 59, 61, 63, 66, 70] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'top1-wealth-share',
      label: { zh: '最富有 1% 的財富占比', en: 'Wealth share of the richest 1%' },
      description: {
        zh: '財富最多的 1% 成年人，擁有全國淨財富的幾成。顏色越深，財富越集中在少數人手上。多數國家沒有財富分布的直接資料，是 WID 推估的。',
        en: "The share of a country's net wealth owned by the wealthiest 1% of adults. Darker means wealth is more concentrated. For most countries there is no direct data on the wealth distribution, so these are WID estimates.",
      },
      unit: '%',
      file: 'top1-wealth-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [22, 25, 28, 31, 35, 40] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'household-saving',
      label: { zh: '家庭儲蓄率', en: 'Household saving rate' },
      description: {
        zh: '家庭可支配所得（稅後收入加上政府給的補助）中沒有花掉、存下來的比例，扣掉了房屋等的折舊（淨儲蓄）。負數表示花得比賺得多，要動用存款或借錢。只有約 35 國，以 OECD 國家為主；台灣用主計總處國民所得統計的同一個算法。',
        en: "The share of households' disposable income (income after taxes plus government benefits) that is saved rather than spent, net of depreciation of homes and other assets. A negative rate means households spend more than they earn, drawing on savings or borrowing. Available for about 35 countries, mostly OECD members; Taiwan's figure is calculated the same way from DGBAS's national accounts.",
      },
      unit: '%',
      file: 'household-saving.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 3, 6, 9, 12, 15] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'gross-savings',
      label: { zh: '國民儲蓄率', en: 'Gross national saving' },
      description: {
        zh: '全國（家庭、企業、政府）一年的所得中沒有用在消費的部分（儲蓄毛額），占 GDP 的比例。這些錢可以投資在國內，或借給外國。',
        en: "The part of a country's income in a year that households, businesses and government do not spend on consumption (gross saving), as a share of GDP. It can be invested at home or lent abroad.",
      },
      unit: '%',
      file: 'gross-savings.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
  ],
};
