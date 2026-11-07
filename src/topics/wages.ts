import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, intlDollars, usd } from '../lib/format';
import type { TopicDefinition } from './types';
import { topicPart } from './merge';

const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const USD_MONTH = { zh: '美元/月', en: 'US$/month' };
const INTL_MONTH = { zh: '國際元/月', en: 'Int$/month' };
// 最低工資有幾國不到 10 美元（蘇丹 0.8、盧安達 2.2），整數會變成「1 美元」，小於 10 的留一位小數
const money = (v: number) => fixed(v, v < 10 ? 1 : 0);
const hours = (v: number, digits: number) => tr({ zh: `${fixed(v, digits)} 小時`, en: `${fixed(v, digits)} hours` });

/** 法定年假的兩個指標（2026-11-04 主題整併 併9 搬到國定假日主題，用下面的 wagesLeavePart） */
const LEAVE_INDICATORS = ['annual-leave', 'annual-leave-max'];

/** 薪資與工時原本的定義（含法定年假） */
const wagesWithLeave: TopicDefinition = {
  id: 'wages',
  title: { zh: '各國薪資與工時', en: 'Wages and working hours by country' },
  shortTitle: { zh: '薪資與工時', en: 'Wages & hours' },
  defaultIndicator: 'monthly-earnings-usd',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: '英文維基百科「List of minimum annual leave by country」（法定年假，2026 年 10 月的版本）', en: 'Wikipedia, “List of minimum annual leave by country” (October 2026 revision)' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_minimum_annual_leave_by_country&oldid=1380870617',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '全國法規資料庫：勞動基準法第 38 條（台灣的特別休假）', en: 'Laws & Regulations Database of Taiwan: Labour Standards Act Art. 38' },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0030001',
      license: { zh: '法律條文不是著作權的標的（著作權法第 9 條）', en: 'Statutes are not subject to copyright (Copyright Act, Article 9)' },
    },
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
        zh: 'OECD, 每年實際工時（墨西哥、哥倫比亞）',
        en: 'OECD, average annual hours actually worked (Mexico and Colombia)',
      },
      url: 'https://www.oecd.org/en/data/indicators/hours-worked.html',
      license: OECD_TERMS,
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
      url: 'https://www.mol.gov.tw/1607/28162/28166/28180/99861/28184/29016/',
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
    {
      name: { zh: 'OECD Earnings Distribution Database（薪資的十分位比、低薪比例、最低工資占中位數與平均薪資）', en: 'OECD Earnings Distribution Database (decile ratios, incidence of low pay, minimum relative to median and mean wages)' },
      url: 'https://www.oecd.org/en/data/datasets/earnings-database.html',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '平均月薪、最低工資與每週工時是國際勞工組織彙整的各國統計，調查方式與涵蓋範圍不同，只適合比較大致的高低；' +
      '很多國家隔幾年才公布一次，地圖用每個國家幾年內最近一年的資料，滑到國家上可以看到資料年份。' +
      '台灣不是國際勞工組織會員，月薪與每週工時改用主計總處、最低工資改用勞動部的數字，國際元用民間消費的購買力平價換算（跟國際勞工組織同一個概念），細節見台灣側欄的附註。' +
      '每年工時是 Penn World Table 的估計，本身有台灣；墨西哥、哥倫比亞跟 OECD 的數字差太多，改用 OECD。',
    en:
      'Earnings, minimum wages and weekly hours are national statistics compiled by the International Labour Organization; ' +
      'survey methods and coverage differ, so compare broad levels only. Many countries publish only every few years, ' +
      "so the map shows each country's latest data within a few years; hover over a country to see the data year. " +
      'Taiwan is not an ILO member: its earnings and weekly hours come from DGBAS and its minimum wage from the Ministry of Labor, ' +
      'with international dollars based on the household consumption PPP (the same concept the ILO uses); see the notes in ' +
      "Taiwan's panel. Annual hours are Penn World Table estimates, which cover Taiwan; for Mexico and Colombia, " +
      'where they differ too much from the OECD figures, the OECD data are used.',
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
        zh: '法律規定的每月最低工資（稅前），以當年匯率換算成美元。只有行業別或地區別最低工資的國家，取最有代表性的一種；瑞典、丹麥、挪威、芬蘭、義大利、奧地利、新加坡等由勞資協商決定工資、沒有法定最低工資的國家是灰色。',
        en: "The statutory gross monthly minimum wage, converted to US dollars at the year's exchange rate. Where minimum wages are set by sector or region, the most representative rate is used. Countries without a statutory minimum, where pay is set by collective bargaining (Sweden, Denmark, Norway, Finland, Italy, Austria, Singapore and others), are grey.",
      },
      unit: USD_MONTH,
      file: 'minimum-wage-usd.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 200, 400, 800, 1600] } },
      format: (v) => usd(money(v)),
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
      format: (v) => intlDollars(money(v)),
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
        zh: '就業者平均一年工作的總時數（已扣掉休假與國定假日），含部分工時與自營作業者。是 Penn World Table 依各國統計整理的估計（墨西哥、哥倫比亞改用 OECD 的數字）。',
        en: 'Average total hours worked in a year per employed person (net of holidays and leave), including part-time workers and the self-employed. Penn World Table estimates based on national statistics (OECD figures for Mexico and Colombia).',
      },
      unit: { zh: '小時/年', en: 'hours/year' },
      file: 'annual-hours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1500, 1700, 1900, 2100, 2300, 2500] } },
      format: (v) => hours(v, 0),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'earnings-ratio',
      label: { zh: '高薪與低薪差幾倍', en: 'Earnings ratio, high vs low paid' },
      description: {
        zh: '全時受僱者的毛薪資，第 9 十分位（比 90% 的人高）是第 1 十分位（比 10% 的人高）的幾倍（OECD，各國最近一次的調查）。印度 6.08 倍、阿根廷 6.00、以色列 5.61、美國 4.69 最高；瑞典 2.20、挪威 2.32、西班牙 2.37、義大利 2.38 最低。子項目另有第 9 比第 5（上面拉得多開）、第 5 比第 1（下面壓得多低）：葡萄牙的第 5 比第 1 只有 1.07，最低工資幾乎就是中位數。不含自營作業者與部分工時；台灣沒有開放的薪資十分位資料。',
        en: 'Gross earnings of full-time employees: the 9th decile (higher than 90% of workers) as a multiple of the 1st decile (higher than 10%) (OECD, each country’s latest survey). India is 6.08, Argentina 6.00, Israel 5.61 and the US 4.69, the highest; Sweden 2.20, Norway 2.32, Spain 2.37 and Italy 2.38 the lowest. Options also show the 9th to 5th decile (how far the top stretches) and the 5th to 1st (how far the bottom falls): Portugal’s 5th-to-1st ratio is only 1.07, its minimum wage being close to the median. Excludes the self-employed and part-time workers; there are no open decile data for Taiwan.',
      },
      unit: { zh: '倍', en: '×' },
      file: 'earnings-ratio/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2.5, 3, 3.5, 4, 4.5, 5] },
        itemScales: {
          d9d5: { type: 'sequential', thresholds: [1.7, 1.8, 1.9, 2, 2.2, 2.5] },
          d5d1: { type: 'sequential', thresholds: [1.4, 1.6, 1.7, 1.8, 1.9, 2.1] },
        },
      },
      dimension: {
        label: { zh: '比較', en: 'Ratio' },
        options: [
          { id: 'd9d1', label: { zh: '第 9 ÷ 第 1 十分位', en: '9th ÷ 1st decile' } },
          { id: 'd9d5', label: { zh: '第 9 ÷ 第 5 十分位（中位數）', en: '9th ÷ 5th decile (median)' } },
          { id: 'd5d1', label: { zh: '第 5（中位數）÷ 第 1 十分位', en: '5th decile (median) ÷ 1st' } },
        ],
        defaultOption: 'd9d1',
      },
      format: (v) => tr({ zh: `${fixed(v, 2)} 倍`, en: `${fixed(v, 2)}×` }),
      formatTick: (v) => fixed(v, 1),
      defaultYear: 2024,
    },
    {
      id: 'low-pay',
      label: { zh: '低薪比例', en: 'Incidence of low pay' },
      description: {
        zh: '全時受僱者裡，薪資低於中位數三分之二的比例（OECD，各國最近一次的調查）。阿根廷 27.6%、保加利亞 26.3%、以色列 25.4%、拉脫維亞 24.9%、英國 23.5%、美國 22.5% 最高；葡萄牙 1.4%、紐西蘭 5.0%、義大利 5.6%、挪威 6.7% 最低。這是相對標準：最低工資接近中位數的國家（葡萄牙）會趨近 0，不代表薪水高。台灣沒有開放的薪資分布資料。',
        en: 'Share of full-time employees earning less than two-thirds of the median (OECD, each country’s latest survey). Argentina is 27.6%, Bulgaria 26.3%, Israel 25.4%, Latvia 24.9%, the UK 23.5% and the US 22.5%, the highest; Portugal 1.4%, New Zealand 5.0%, Italy 5.6% and Norway 6.7% the lowest. It is a relative measure: where the minimum wage is close to the median (Portugal) it approaches zero, which does not mean pay is high. There are no open earnings distribution data for Taiwan.',
      },
      unit: '%',
      file: 'low-pay.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 11, 14, 17, 20, 23] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'minimum-to-wage',
      label: { zh: '最低工資占薪資中位數（Kaitz 指數）', en: 'Minimum wage relative to wages (Kaitz index)' },
      description: {
        zh: '法定最低工資是全時受僱者薪資中位數（或平均）的幾成（OECD，2025 年 33 國）。占中位數：哥倫比亞 90.5%、哥斯大黎加 84.7%、墨西哥 74.9%、紐西蘭 64.0%、法國 62.5%、英國 61.9% 最高，日本 46.4%、愛沙尼亞 42.7%，美國只有 24.1%（OECD 用聯邦最低工資，2009 年以後沒調過，多數州自己訂得更高）。哥倫比亞、墨西哥的高比例是薪資本身低、非正式就業不在分母裡。子項目「占平均薪資」有台灣：勞動部的基本工資除以主計總處工業及服務業每月總薪資，2025 年 45.1%（分母含部分工時與年終獎金，口徑跟 OECD 的全時受僱者不完全一樣）。比「最低工資多少美元」更能看出制度把底線訂得多高。',
        en: 'The statutory minimum wage as a share of the median (or mean) wage of full-time employees (OECD, 33 countries in 2025). Against the median, Colombia is 90.5%, Costa Rica 84.7%, Mexico 74.9%, New Zealand 64.0%, France 62.5% and the UK 61.9%, the highest; Japan 46.4%, Estonia 42.7% and the US only 24.1% (the OECD uses the federal minimum, unchanged since 2009, while most states set higher ones). Colombia’s and Mexico’s high ratios reflect low wages and informal jobs outside the denominator. The “share of mean wage” option includes Taiwan: the Ministry of Labor’s minimum wage over DGBAS average monthly total earnings in industry and services, 45.1% in 2025 (the denominator includes part-time workers and bonuses, so it is not quite the OECD’s full-time basis). This shows how high the floor is set better than the minimum wage in dollars.',
      },
      unit: '%',
      file: 'minimum-to-wage/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 45, 50, 55, 60, 70] } },
      dimension: {
        label: { zh: '對照', en: 'Relative to' },
        options: [
          { id: 'median', label: { zh: '占薪資中位數', en: 'Median wage' } },
          { id: 'mean', label: { zh: '占平均薪資（含台灣）', en: 'Mean wage (incl. Taiwan)' } },
        ],
        defaultOption: 'median',
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2025,
    },
    {
      id: 'annual-leave',
      label: { zh: '法定最低年假', en: 'Statutory minimum annual leave' },
      description: {
        zh: '法律規定一年至少要給幾天有薪年假（換算成一週工作 5 天；有年資級距的取剛滿資格的天數，滑過國家看範圍）。美國 0 天（聯邦與各州都沒有規定），中國、菲律賓、奈及利亞 5 天、台灣 7 天（勞基法第 38 條，滿一年）、日本 10 天、南韓 15 天、德國 20 天、法國 25 天、英國 28 天，安道爾 31 天最多。依英文維基百科的列表，主要引 ILO 2012 年的報告，有些國家已經修法。不含國定假日（看「國定假日」主題）。',
        en: 'The minimum paid annual leave required by law (converted to a five-day week; where it rises with seniority, the entry-level figure; hover for the range). The US has none (no federal or state minimum); China, the Philippines and Nigeria 5 days, Taiwan 7 (Labour Standards Act Art. 38, after one year), Japan 10, South Korea 15, Germany 20, France 25, the UK 28 and Andorra the most at 31. From the English Wikipedia list, which mostly cites a 2012 ILO report, so some countries have since changed their laws. Public holidays are not included (see the Public holidays topic).',
      },
      unit: { zh: '天', en: 'days' },
      file: 'annual-leave.json',
      defaultYear: 2026,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 天`, en: `${fixed(v, 0)} days` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'annual-leave-max',
      label: { zh: '年資最長的法定年假', en: 'Statutory annual leave at longest seniority' },
      description: {
        zh: '年假隨年資增加的國家，年資最長時一年的法定年假（沒有級距的國家跟上一個指標一樣）。台灣 30 天（年資十年以上每年加一天，加到 30 天）、日本 20 天、南韓 25 天、中國 15 天。',
        en: 'For countries where leave rises with seniority, the statutory leave at the longest seniority (otherwise the same as the previous indicator). Taiwan 30 days (one more day per year from ten years, up to 30), Japan 20, South Korea 25 and China 15.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'annual-leave-max.json',
      defaultYear: 2026,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 天`, en: `${fixed(v, 0)} days` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};

/**
 * 薪資與工時（2026-11-04 起不含法定年假：搬到「國定假日與年假」，舊網址的 ind=annual-leave 由 redirects.ts 轉過去）。
 * 法定年假的兩個資料來源（英文維基百科的表、勞動基準法）也跟著搬
 */
/** 法定年假（國定假日與年假主題的 withParts 接上；不匯出成主題，registry 的 topicOf 才不會拿錯） */
export const wagesLeavePart = topicPart(
  { ...wagesWithLeave, sources: wagesWithLeave.sources.slice(0, 2), note: undefined },
  { only: LEAVE_INDICATORS, name: { zh: '法定年假', en: 'Statutory annual leave' } },
);

export const wages: TopicDefinition = {
  ...wagesWithLeave,
  sources: wagesWithLeave.sources.slice(2),
  indicators: wagesWithLeave.indicators.filter((i) => !LEAVE_INDICATORS.includes(i.id)),
};
