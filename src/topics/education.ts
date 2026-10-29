import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { monthLabel, MONTHS } from './months';
import type { CategoryDef, TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const YEARS = { zh: '年', en: 'years' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 小學入學年齡（pipeline/topics/school_calendar.py，世界銀行 SE.PRM.AGES）：只有 5、6、7 歲 */
const AGES: CategoryDef[] = [5, 6, 7].map((age) => ({ value: age, label: { zh: `${age} 歲`, en: `Age ${age}` } }));
const ageLabel = (v: number) => tr({ zh: `${v} 歲`, en: `Age ${v}` });

export const education: TopicDefinition = {
  id: 'education',
  title: { zh: '各國教育程度', en: 'Education by country' },
  shortTitle: { zh: '教育', en: 'Education' },
  defaultIndicator: 'mean-years-schooling',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'UNDP, Human Development Report 2025（平均受教育年數）',
        en: 'UNDP, Human Development Report 2025 (mean years of schooling)',
      },
      url: 'https://hdr.undp.org/data-center',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（UNESCO 統計研究所資料）',
        en: 'World Bank, World Development Indicators (UNESCO Institute for Statistics data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'UNESCO 統計研究所（開學月份，指標 403）', en: 'UNESCO Institute for Statistics (school year start month, indicator 403)' },
      url: 'https://databrowser.uis.unesco.org/',
      license: { zh: 'CC BY-SA 4.0（開學月份的資料檔同樣用 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (the start-month data file is shared under CC BY-SA 4.0 too)' },
    },
    {
      name: { zh: '全國法規資料庫（台灣的學年與國民教育法）', en: 'Laws & Regulations Database of Taiwan (school year and National Education Act)' },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=H0020018',
      license: { zh: '法律條文不受著作權保護', en: 'statutes are not subject to copyright' },
    },
    {
      name: { zh: '教育部統計處 教育統計', en: 'Ministry of Education (Taiwan), education statistics' },
      url: 'https://stats.moe.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部 15 歲以上人口識字率', en: 'Ministry of the Interior (Taiwan), literacy rate of people aged 15 and over' },
      url: 'https://data.gov.tw/dataset/14246',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '台灣不在聯合國與世界銀行的教育資料庫中，改用教育部與內政部的統計，定義見台灣側欄的附註。學年度以開始的那一年標示（2024 = 2024–25 學年度）。' +
      '開學月份是 UIS 的資料，美國、巴西、德國 UIS 寫的是統計用的學年起算月或明顯不對，改成實際開學的月份（出處在各國的附註）；台灣依法規。聯邦國家各州不同，取多數。',
    en: "Taiwan is not in the UN and World Bank education databases, so statistics from the Ministry of Education and the Ministry of the Interior are used instead; see the notes in Taiwan's panel for definitions. School years are labelled by the year they start (2024 = 2024–25). " +
      'School start months come from UIS; for the US, Brazil and Germany UIS gives a statistical start of the school year or a clearly wrong month, so the actual month classes start is used instead (sources in each country’s note); Taiwan follows its regulations. In federal countries, where states differ, the most common month is used.',
  },
  indicators: [
    {
      id: 'mean-years-schooling',
      label: { zh: '平均受教育年數', en: 'Mean years of schooling' },
      description: {
        zh: '25 歲以上的人平均讀了幾年書，用最高學歷換算。',
        en: 'Average number of years of education of people aged 25 and over, based on their highest level completed.',
      },
      unit: YEARS,
      file: 'mean-years-schooling.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 13] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'tertiary-enrollment',
      label: { zh: '高等教育粗在學率', en: 'Tertiary enrolment (gross)' },
      description: {
        zh: '大專院校（含研究所）的在學人數，除以 18–22 歲的人口。有很多成年學生或留學生的國家會超過 100%。',
        en: 'Students in tertiary education (including graduate school) divided by the population aged 18–22. Countries with many adult or international students can exceed 100%.',
      },
      unit: '%',
      file: 'tertiary-enrollment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 35, 50, 70, 90] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'education-spending',
      label: { zh: '政府教育支出占 GDP', en: 'Government education spending, % of GDP' },
      description: {
        zh: '各級政府花在教育上的經費占國內生產毛額的比例，不含家庭與私校自己出的錢。',
        en: 'Spending on education by all levels of government as a share of GDP, excluding money paid by households and private schools.',
      },
      unit: '%',
      file: 'education-spending.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6, 7] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'literacy',
      label: { zh: '成人識字率', en: 'Adult literacy' },
      description: {
        zh: '15 歲以上能讀寫簡單句子的人所占的比例。很多國家十幾年才調查一次，多數高所得國家已經不統計，所以每年只有幾十個國家有資料。',
        en: 'Share of people aged 15 and over who can read and write a simple sentence. Many countries survey it only every decade or so and most high-income countries no longer measure it, so each year has data for only a few dozen countries.',
      },
      unit: '%',
      file: 'literacy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 70, 80, 90, 95, 99] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'school-start',
      label: { zh: '開學月份', en: 'School year start' },
      description: {
        zh: '新學年從幾月開始上課（小學）。9 月最多（116 國：歐洲、中國、俄羅斯、北非與西非等）；南半球多半 1–2 月（澳洲、南非、阿根廷），南韓 3 月，日本、印度 4 月，台灣 8 月（學年 8 月 1 日開始，8 月底或 9 月初上課）。',
        en: 'The month the new school year starts (primary school). September is most common (116 countries: Europe, China, Russia, North and West Africa and others); the southern hemisphere mostly starts in January or February (Australia, South Africa, Argentina), South Korea in March, Japan and India in April, and Taiwan in August (the school year starts on 1 August, with classes in late August or early September).',
      },
      unit: '',
      file: 'school-start.json',
      layer: { kind: 'categorical', categories: MONTHS.map(({ value, label, color }) => ({ value, label, color })) },
      format: monthLabel,
      unranked: true,
      panelChart: false,
    },
    {
      id: 'compulsory-years',
      label: { zh: '義務教育年數', en: 'Compulsory education' },
      description: {
        zh: '法律規定一定要上學的年數。9 年最多（42 國，台灣也是：國小 6 年、國中 3 年，十二年國教的後 3 年不是強迫入學），歐美多半 10–13 年。',
        en: 'Years of schooling required by law. Nine years is most common (42 countries, including Taiwan: six years of primary and three of junior high, as the last three years of 12-year basic education are not compulsory); Europe and the Americas mostly require 10 to 13.',
      },
      unit: YEARS,
      file: 'compulsory-years.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6, 8, 10, 12, 14] } },
      format: (v) => (v === 0 ? tr({ zh: '沒有義務教育', en: 'None' }) : tr({ zh: `${fixed(v, 0)} 年`, en: `${fixed(v, 0)} years` })),
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
    {
      id: 'entrance-age',
      label: { zh: '小學入學年齡', en: 'Primary school entrance age' },
      description: {
        zh: '小學一年級的法定入學年齡。6 歲最多（154 國，台灣也是）；英國、愛爾蘭、澳洲、紐西蘭與加勒比海的大英國協國家等 25 國 5 歲，芬蘭、瑞典、波羅的海三國、俄羅斯、波蘭、印尼、南非等 32 國 7 歲。',
        en: 'The official age for entering the first year of primary school. Six is most common (154 countries, including Taiwan); 25 countries, including the UK, Ireland, Australia, New Zealand and Commonwealth countries in the Caribbean, start at five, and 32, including Finland, Sweden, the Baltic states, Russia, Poland, Indonesia and South Africa, at seven.',
      },
      unit: '',
      file: 'entrance-age.json',
      layer: { kind: 'categorical', categories: AGES, ordinal: true },
      format: ageLabel,
      unranked: true,
      panelChart: false,
    },
  ],
};
