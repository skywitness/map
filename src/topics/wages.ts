import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, intlDollars, usd } from '../lib/format';
import type { TopicDefinition } from './types';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const USD_MONTH = { zh: '美元/月', en: 'US$/month' };
const INTL_MONTH = { zh: '國際元/月', en: 'Int$/month' };
const hours = (v: number, digits: number) => tr({ zh: `${fixed(v, digits)} 小時`, en: `${fixed(v, digits)} hours` });

export const wages: TopicDefinition = {
  id: 'wages',
  title: { zh: '各國薪資與工時', en: 'Wages and working hours by country' },
  shortTitle: { zh: '薪資與工時', en: 'Wages & hours' },
  defaultIndicator: 'monthly-earnings-usd',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: '國際勞工組織 ILOSTAT（平均月薪、最低工資、每週工時）',
        en: 'International Labour Organization, ILOSTAT (earnings, minimum wages, weekly hours)',
      },
      url: 'https://ilostat.ilo.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Penn World Table 11.0（每年工時；Feenstra, Inklaar & Timmer, 2015, American Economic Review）',
        en: 'Penn World Table 11.0 (annual hours; Feenstra, Inklaar & Timmer, 2015, American Economic Review)',
      },
      url: 'https://www.rug.nl/ggdc/productivity/pwt/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '主計總處 薪資及生產力統計、人力資源調查',
        en: 'DGBAS (Taiwan), Earnings and Productivity Survey and Manpower Survey',
      },
      url: 'https://www.stat.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '勞動部 基本工資與最低工資', en: 'Ministry of Labor (Taiwan), basic wage and minimum wage' },
      url: 'https://www.mol.gov.tw/1607/28162/28166/28180/28182/28184/29016/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '中央銀行 新臺幣對美元年平均匯率',
        en: 'Central Bank of the Republic of China (Taiwan), NT$/US$ annual average exchange rate',
      },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'IMF, World Economic Outlook（台灣與美國的消費者物價，用來推算台灣的購買力平價）',
        en: "IMF, World Economic Outlook (Taiwan's and US consumer prices, used to carry Taiwan's PPP forward)",
      },
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明出處', en: 'Attribution' },
    },
  ],
  note: {
    zh:
      '平均月薪、最低工資與每週工時是國際勞工組織彙整的各國統計，調查方式與涵蓋範圍不同，只適合比較大致的高低；' +
      '很多國家隔幾年才公布一次，地圖用每個國家幾年內最近一年的資料，滑到國家上可以看到資料年份。' +
      '台灣不是國際勞工組織會員，月薪與每週工時改用主計總處、最低工資改用勞動部的數字，國際元用民間消費的購買力平價換算（跟國際勞工組織同一個概念），細節見台灣側欄的附註。' +
      '每年工時是 Penn World Table 的估計，本身有台灣。',
    en:
      'Earnings, minimum wages and weekly hours are national statistics compiled by the International Labour Organization; ' +
      'survey methods and coverage differ, so compare broad levels only. Many countries publish only every few years, ' +
      "so the map shows each country's latest data within a few years; hover over a country to see the data year. " +
      'Taiwan is not an ILO member: its earnings and weekly hours come from DGBAS and its minimum wage from the Ministry of Labor, ' +
      'with international dollars based on the household consumption PPP (the same concept the ILO uses); see the notes in ' +
      "Taiwan's panel. Annual hours are Penn World Table estimates, which cover Taiwan.",
  },
  indicators: [
    {
      id: 'monthly-earnings-usd',
      label: { zh: '平均月薪（美元）', en: 'Average monthly earnings (US$)' },
      description: {
        zh: '受僱員工平均每月的稅前薪資，以當年匯率換算成美元。資料來自各國的勞動力調查或廠商調查，涵蓋範圍不完全一樣（例如有的不含獎金，有的只算民間部門）。',
        en: "Employees' average gross monthly earnings, converted to US dollars at the year's exchange rate. The figures come from each country's labour force or establishment surveys, whose coverage differs (some leave out bonuses or cover only the private sector, for example).",
      },
      unit: USD_MONTH,
      file: 'monthly-earnings-usd.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [200, 400, 800, 1500, 3000, 5000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'monthly-earnings-ppp',
      label: { zh: '平均月薪（購買力平價）', en: 'Average monthly earnings (PPP)' },
      description: {
        zh: '同樣的平均月薪，改用購買力平價換算成國際元，扣掉各國物價的差異，比較薪水實際買得到多少東西。',
        en: 'The same average earnings converted at purchasing power parity into international dollars, taking out price differences between countries to compare what the pay can actually buy.',
      },
      unit: INTL_MONTH,
      file: 'monthly-earnings-ppp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 1500, 2500, 4000, 5500] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'minimum-wage-usd',
      label: { zh: '最低工資（美元）', en: 'Minimum wage (US$)' },
      description: {
        zh: '法律規定的每月最低工資（稅前），以當年匯率換算成美元。只有行業別或地區別最低工資的國家，取最有代表性的一種；北歐、義大利、奧地利、新加坡等由勞資協商決定工資、沒有法定最低工資的國家是灰色。',
        en: "The statutory gross monthly minimum wage, converted to US dollars at the year's exchange rate. Where minimum wages are set by sector or region, the most representative rate is used. Countries without a statutory minimum, where pay is set by collective bargaining (the Nordic countries, Italy, Austria, Singapore and others), are grey.",
      },
      unit: USD_MONTH,
      file: 'minimum-wage-usd.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 200, 400, 800, 1600] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'minimum-wage-ppp',
      label: { zh: '最低工資（購買力平價）', en: 'Minimum wage (PPP)' },
      description: {
        zh: '同樣的法定每月最低工資，改用購買力平價換算成國際元，扣掉各國物價的差異。',
        en: 'The same statutory monthly minimum wage converted at purchasing power parity into international dollars, taking out price differences between countries.',
      },
      unit: INTL_MONTH,
      file: 'minimum-wage-ppp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [150, 300, 500, 800, 1200, 2000] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
    },
    {
      id: 'weekly-hours',
      label: { zh: '每週工時', en: 'Weekly hours worked' },
      description: {
        zh: '就業者（含自營作業者與雇主）平均每週實際工作的時數，多數國家只算主要工作。部分工時的人也算在內，所以兼職多的國家（例如荷蘭、德國）會比較低。國際勞工組織沒有日本、中國的調查值，可以改看「每年工時」；世界平均是國際勞工組織的模型估計。',
        en: 'Average hours actually worked per week by employed people (including the self-employed and employers), in most countries counting the main job only. Part-time workers are included, so countries with a lot of part-time work (such as the Netherlands and Germany) come out lower. ILOSTAT has no survey figures for Japan or China; see annual hours instead. The world average is an ILO modelled estimate.',
      },
      unit: { zh: '小時/週', en: 'hours/week' },
      file: 'weekly-hours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [32, 35, 38, 41, 44, 47] } },
      format: (v) => hours(v, 1),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'annual-hours',
      label: { zh: '每年工時', en: 'Annual hours worked' },
      description: {
        zh: '就業者平均一年工作的總時數（已扣掉休假與國定假日），含部分工時與自營作業者。是 Penn World Table 依各國統計整理的估計。',
        en: 'Average total hours worked in a year per employed person (net of holidays and leave), including part-time workers and the self-employed. Penn World Table estimates based on national statistics.',
      },
      unit: { zh: '小時/年', en: 'hours/year' },
      file: 'annual-hours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1500, 1700, 1900, 2100, 2300, 2500] } },
      format: (v) => hours(v, 0),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
