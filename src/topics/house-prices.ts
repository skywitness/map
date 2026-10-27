import { fixed, formatSignedPercent } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const INDEX_UNIT = { zh: '2015 年 = 100', en: '2015 = 100' };

const change = (v: number) => formatSignedPercent(v, 1);
const changeTick = (v: number) => formatSignedPercent(v, 0);
const index = (v: number) => fixed(v, 1);
const indexTick = (v: number) => fixed(v, 0);

/** 房價所得比、房價租金比共用的門檻：跟 2015 年比，兩個指數可以放在一起看 */
const INDEX_SCALE: ScaleSpec = { type: 'diverging', thresholds: [70, 85, 95, 105, 115, 130], reverse: true };

export const housePrices: TopicDefinition = {
  id: 'house-prices',
  title: { zh: '房價與居住負擔', en: 'House prices and affordability' },
  shortTitle: { zh: '房價', en: 'House prices' },
  defaultIndicator: 'real-price-10y',
  defaultYear: 2025,
  sources: [
    {
      name: 'OECD, Analytical house price indicators',
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_AN_HOUSE_PRICES%40DF_HOUSE_PRICES&df[ag]=OECD.ECO.MPD',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'BIS, Residential property prices（11 個經濟體，各國的原始來源見附註）',
        en: 'BIS, Residential property prices (11 economies; national sources in the country notes)',
      },
      url: 'https://data.bis.org/topics/RPP',
      license: { zh: 'BIS 統計使用條款', en: 'BIS terms of use' },
    },
    {
      name: {
        zh: '內政部不動產資訊平台 住宅價格指數、房價負擔能力指標',
        en: 'Ministry of the Interior (Taiwan): housing price index and affordability indicators',
      },
      url: 'https://pip.moi.gov.tw/Publicize/Info/E2010',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '主計總處 消費者物價指數（總指數、住宅租金）', en: 'DGBAS (Taiwan), consumer prices (all items, housing rent)' },
      url: 'https://data.gov.tw/dataset/9158',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '各國只能比漲跌，不能比房價高低：房價所得比、房價租金比是 2015 年 = 100 的指數，不是「幾年的所得」，跨國的倍數只有不開放的資料（Demographia、Numbeo），沒有用。' +
      '實質房價用 OECD（民間消費平減），香港、新加坡等 11 個經濟體用 BIS（消費者物價平減；中文不是 BIS 的官方翻譯）；' +
      '台灣用內政部與主計總處的資料，倍數與各縣市的房貸負擔率在台灣的側欄。住房負擔過重率見「住宅」主題。',
    en:
      'Countries can be compared only on changes, not price levels: price-to-income and price-to-rent are indices (2015 = 100), ' +
      'not "years of income"; cross-country ratios exist only in proprietary data (Demographia, Numbeo), which is not used. ' +
      'Real prices come from the OECD (consumption deflator) and, for 11 economies such as Hong Kong and Singapore, the BIS ' +
      "(CPI-deflated). Taiwan uses Ministry of the Interior and DGBAS data; the ratio in years of income and the mortgage burden " +
      "by city are in Taiwan's panel. The housing cost overburden rate is in the Housing topic.",
  },
  panelExtra: () => import('./panels/HousePricesPanel'),
  indicators: [
    {
      id: 'real-price-10y',
      label: { zh: '實質房價 10 年', en: 'Real price 10y' },
      description: {
        zh: '扣掉物價上漲後，房價比 10 年前漲（橘色）或跌（青綠）了多少。各國的房價指數定義不同（成交價或估價、新成屋或全部住宅），只能比漲跌，不能比房價高低。台灣是內政部的住宅價格指數除以消費者物價，2023 年起才有 10 年的變化。',
        en: 'How much house prices rose (orange) or fell (teal) over the past 10 years after adjusting for inflation. National indices differ (transaction prices or valuations, new or all homes), so they compare changes only, not price levels. Taiwan uses the Ministry of the Interior housing price index divided by consumer prices, with 10-year changes from 2023.',
      },
      unit: '%',
      file: 'real-price-10y.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-50, -25, -10, 10, 25, 50], reverse: true } },
      format: change,
      formatTick: changeTick,
    },
    {
      id: 'real-price-5y',
      label: { zh: '實質房價 5 年', en: 'Real price 5y' },
      description: {
        zh: '扣掉物價上漲後，房價比 5 年前漲（橘色）或跌（青綠）了多少。各國的房價指數定義不同，只能比漲跌，不能比房價高低。',
        en: 'How much house prices rose (orange) or fell (teal) over the past 5 years after adjusting for inflation. National indices differ, so they compare changes only, not price levels.',
      },
      unit: '%',
      file: 'real-price-5y.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-30, -15, -5, 5, 15, 30], reverse: true } },
      format: change,
      formatTick: changeTick,
    },
    {
      id: 'price-income',
      label: { zh: '房價所得比', en: 'Price/income' },
      description: {
        zh: '房價漲得比所得快還是慢：OECD 的名目房價指數 ÷ 每人可支配所得，2015 年 = 100。高於 100（橘色）表示跟 2015 年比，房價漲得比所得快、比較難買得起。這是指數，不是「房價等於幾年的所得」，各國的數字不能比誰的房子比較貴。台灣用內政部的房價所得比（中位數房價 ÷ 中位數家戶所得）換算，倍數見台灣的側欄。',
        en: 'Whether house prices have risen faster than incomes: the OECD nominal house price index divided by disposable income per person, 2015 = 100. Above 100 (orange) means prices have outpaced incomes since 2015, so homes are harder to afford. It is an index, not "years of income", so it cannot show where homes are most expensive. Taiwan is rebased from the Ministry of the Interior ratio (median home price ÷ median household income); the ratio itself is in Taiwan’s panel.',
      },
      unit: INDEX_UNIT,
      file: 'price-income.json',
      layer: { kind: 'choropleth', scale: INDEX_SCALE },
      format: index,
      formatTick: indexTick,
    },
    {
      id: 'price-rent',
      label: { zh: '房價租金比', en: 'Price/rent' },
      description: {
        zh: '買房跟租房比：名目房價指數 ÷ 房租指數，2015 年 = 100。高於 100（橘色）表示跟 2015 年比，房價漲得比房租快，買房相對租房變貴了。跟房價所得比一樣只能看變化，不能比各國的水準。',
        en: 'Buying compared with renting: the nominal house price index divided by the rent index, 2015 = 100. Above 100 (orange) means prices have risen faster than rents since 2015, so buying has become dearer relative to renting. Like price-to-income, it shows changes only, not levels across countries.',
      },
      unit: INDEX_UNIT,
      file: 'price-rent.json',
      layer: { kind: 'choropleth', scale: INDEX_SCALE },
      format: index,
      formatTick: indexTick,
    },
    {
      id: 'real-rent-5y',
      label: { zh: '實質房租 5 年', en: 'Real rent 5y' },
      description: {
        zh: '扣掉物價上漲後，房租比 5 年前漲（橘色）或跌（青綠）了多少。房租是消費者物價裡的房租類指數，多半包括既有租約，漲得比新租約的行情慢。',
        en: 'How much rents rose (orange) or fell (teal) over the past 5 years after adjusting for inflation. Rents are the rent component of consumer prices, which mostly includes existing leases and so rises more slowly than rents on new leases.',
      },
      unit: '%',
      file: 'real-rent-5y.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10, -5, -2, 2, 5, 10], reverse: true } },
      format: change,
      formatTick: changeTick,
    },
  ],
};
