import { monthLabel, MONTHS } from './months';
import type { TopicDefinition } from './types';

/**
 * 出生的季節（pipeline/topics/birth_season.py）：每日平均出生數最多的月份。UNdata 表 55 的逐月出生數，
 * 台灣用內政部按登記的月份。各國最近的年份不同，指標檔設 latestWithin（10 年內最近一年）。
 */

export const birthSeason: TopicDefinition = {
  id: 'birth-season',
  title: { zh: '各國出生的季節', en: 'Birth seasonality by country' },
  shortTitle: { zh: '出生的季節', en: 'Birth season' },
  defaultIndicator: 'peak-month',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'UNdata 人口統計資料庫（表 55：依出生月份的活產數）', en: 'UNdata Demographic Statistics (table 55: live births by month of birth)' },
      url: 'https://data.un.org/Data.aspx?d=POP&f=tableCode%3a55',
      license: { zh: '註明 UNdata 即可轉載', en: 'free to reuse, citing UNdata' },
    },
    {
      name: { zh: '內政部統計處（出生人數，按登記月份）', en: 'Ministry of the Interior, Taiwan (births by month of registration)' },
      url: 'https://data.gov.tw/dataset/14233',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '每個月的出生數除以那個月的天數，比每日平均，大小月與 2 月不影響。優先用依出生日期統計的數字；只有依登記日期的國家（台灣、紐西蘭、愛爾蘭、泰國等）在側欄標出。' +
      '同一年的 12 個月要來自同一次發布；暫定數有月份明顯還沒登記完的（最少的月份不到中位數的六成）不用。各國最近的年份不同，地圖用 10 年內最近一年，tooltip 寫實際年份。' +
      '台灣是內政部按登記的月份（出生後 60 天內登記），會跟著春節與年底的登記時間移動：2025 年 2 月最多，是 2024 龍年年底出生的寶寶 2025 年初才登記。' +
      '生肖年（龍年）、新冠疫情的封城都會改變某一年的分布。',
    en:
      'Each month’s births are divided by its number of days, so the comparison is of daily averages and month length does not matter. Figures by date of birth are preferred; countries with figures by date of registration only (Taiwan, New Zealand, Ireland, Thailand and others) are flagged in the side panel. ' +
      'All 12 months of a year must come from the same release, and provisional years with months clearly not yet fully registered (the lowest month below 60% of the median) are skipped. Countries’ latest years differ; the map uses the latest year within 10 years and the tooltip gives the actual year. ' +
      'Taiwan uses the Ministry of the Interior’s figures by month of registration (within 60 days of birth), which shift with Lunar New Year and year-end registration: February 2025 is highest because babies born late in the 2024 Year of the Dragon were registered early in 2025. ' +
      'Zodiac years (the Dragon) and COVID-19 lockdowns can change a single year’s pattern.',
  },
  panelExtra: () => import('./panels/BirthSeasonPanel'),
  indicators: [
    {
      id: 'peak-month',
      label: { zh: '出生最多的月份', en: 'Peak birth month' },
      description: {
        zh: '每日平均出生數最多的月份。北半球的溫帶國家多在夏末秋初：9 月最多（英國、西班牙、墨西哥等 29 國），7 月是德國、日本、加拿大等 18 國，美國 8 月；南半球的巴西、南非是 4 月，澳洲 5 月。點國家看 12 個月的長條。',
        en: 'The month with the highest average births per day. Temperate countries in the northern hemisphere mostly peak in late summer and early autumn: September in 29 countries (the UK, Spain, Mexico and others), July in 18 (Germany, Japan, Canada and others) and August in the US; in the southern hemisphere Brazil and South Africa peak in April and Australia in May. Click a country for all 12 months.',
      },
      unit: '',
      file: 'peak-month.json',
      layer: { kind: 'categorical', categories: MONTHS.map(({ value, label, color }) => ({ value, label, color })) },
      format: monthLabel,
      unranked: true,
    },
  ],
};
