import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { monthLabel, MONTHS } from './months';
import type { CategoryDef, TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const YEARS = { zh: '年', en: 'years' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const perClass = (v: number) => tr({ zh: `${fixed(v, 1)} 人`, en: `${fixed(v, 1)} pupils` });
const perTeacher = (v: number) => tr({ zh: `${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per teacher` });
/** 台灣沒有這幾個指標可以比的數字（DESIGN.md 第 168 點） */
const TW_NO_OECD = { TWN: { zh: 'OECD 沒有台灣', en: 'Not in the OECD data' } };

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
    {
      name: {
        zh: 'OECD, Education at a Glance（教師的法定薪資、平均每班人數、上課天數）',
        en: 'OECD, Education at a Glance (teachers’ statutory salaries, average class size, instruction days)',
      },
      url: 'https://data-explorer.oecd.org/',
      license: OECD_TERMS,
    },
    {
      name: { zh: 'OECD Family Database（PF3.2 托育與學前教育）', en: 'OECD Family Database (PF3.2 enrolment in childcare and pre-school)' },
      url: 'https://www.oecd.org/en/data/datasets/oecd-family-database.html',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'UNESCO 統計研究所 API（小學學生數與教師數、高中職業類課程的比例、學前教育的在學人數與學齡人口）',
        en: 'UNESCO Institute for Statistics API (primary enrolment and teachers, share of upper secondary students in vocational programmes, pre-primary enrolment and school-age population)',
      },
      url: 'https://api.uis.unesco.org/api/public/documentation/',
      license: {
        zh: 'CC BY-SA 4.0（生師比、技職比例、學前教育毛入學率的資料檔同樣用 CC BY-SA 4.0 分享）',
        en: 'CC BY-SA 4.0 (the pupil–teacher, vocational and pre-primary enrolment data files are shared under CC BY-SA 4.0 too)',
      },
    },
    {
      name: {
        zh: '教育部統計處 教育統計查詢網（幼兒(稚)園 2–5 歲粗在學率）',
        en: 'Ministry of Education (Taiwan), education statistics query system (gross enrolment rate of kindergartens, ages 2–5)',
      },
      url: 'https://eds.moe.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '台灣不在聯合國與世界銀行的教育資料庫中，改用教育部與內政部的統計，定義見台灣側欄的附註。學年度以開始的那一年標示（2024 = 2024–25 學年度）。' +
      '開學月份是 UIS 的資料，美國、巴西、德國 UIS 寫的是統計用的學年起算月或明顯不對，改成實際開學的月份（出處在各國的附註）；台灣依法規。聯邦國家各州不同，取多數。' +
      '教師薪資、每班人數、上課天數只有 OECD 與夥伴國（約 40 國）；比利時用荷語區、英國用英格蘭的值（OECD 只有分區的值）。教師薪資是公立學校的法定薪資（薪級表），不含加給。生師比是學生數除以教師數，不是每班人數；台灣的生師比、每班人數與技職比例用教育部的統計。',
    en: "Taiwan is not in the UN and World Bank education databases, so statistics from the Ministry of Education and the Ministry of the Interior are used instead; see the notes in Taiwan's panel for definitions. School years are labelled by the year they start (2024 = 2024–25). " +
      'School start months come from UIS; for the US, Brazil and Germany UIS gives a statistical start of the school year or a clearly wrong month, so the actual month classes start is used instead (sources in each country’s note); Taiwan follows its regulations. In federal countries, where states differ, the most common month is used. ' +
      'Teacher salaries, class sizes and instruction days cover only OECD members and partners (about 40 countries); Belgium uses the Flemish Community and the UK uses England, as the OECD gives only regional figures. Teacher salaries are statutory salaries in public schools (salary scales), excluding allowances. The pupil–teacher ratio is pupils divided by teachers, not class size; Taiwan’s pupil–teacher ratio, class size and vocational share come from the Ministry of Education.',
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
      id: 'childcare',
      label: { zh: '0–2 歲上托育的比例', en: 'Childcare enrolment, ages 0–2' },
      description: {
        zh: '0–2 歲的幼兒在托嬰中心、幼兒園或登記的保母等托育服務的比例（OECD 約 45 國）。荷蘭、韓國、葡萄牙超過六成；各國收的服務範圍不同。',
        en: 'Share of children aged 0–2 in nurseries, pre-schools or registered childminders and other childcare services (about 45 OECD countries). It exceeds 60% in the Netherlands, South Korea and Portugal; the services counted vary by country.',
      },
      unit: '%',
      file: 'childcare.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] } },
      format: pct,
      formatTick: pctTick,
      noValue: TW_NO_OECD,
    },
    {
      id: 'preprimary',
      label: { zh: '學前教育毛入學率', en: 'Pre-primary enrolment' },
      description: {
        zh: '上幼兒園等學前教育的人數（不論年齡），除以學前教育應屆年齡的人口。用 UNESCO 統計研究所的在學人數與學齡人口自行計算（算法跟 UIS 以前發布的相同；UIS 已經不發布這個比率，世界銀行轉載的只到 2022 年）。各國的應屆年齡不同，又含超齡或提早入學的，可以超過 100%。台灣用教育部公布的「幼兒(稚)園 2–5 歲粗在學率」：分母是 2–5 歲的人口，多數國家是 3–5 歲，比較時要留意。',
        en: 'Pre-primary enrolment (of any age) divided by the population of official pre-primary age, calculated here from UNESCO Institute for Statistics enrolment and school-age population (the same method UIS used to publish; UIS no longer publishes the rate, and the World Bank copy ends in 2022). Official ages differ between countries and enrolment includes older and younger children, so it can exceed 100%. Taiwan uses the Ministry of Education’s gross enrolment rate for kindergartens, ages 2–5: its denominator is the population aged 2–5, while most countries use 3–5, so compare with care.',
      },
      unit: '%',
      file: 'preprimary.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 90, 100] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'teacher-salary',
      label: { zh: '國中教師的法定年薪', en: 'Lower secondary teacher salaries' },
      description: {
        zh: '公立國中教師年資 15 年、最普遍資格的法定年薪（薪級表，不含加給），換成購買力平價美元，2025 年。盧森堡最高，OECD 平均約 6.5 萬。',
        en: 'Statutory annual salary of lower secondary teachers in public schools with 15 years of experience and the most common qualification (salary scales, excluding allowances), in US dollars at purchasing power parity, 2025. Luxembourg pays the most; the OECD average is about $65,000.',
      },
      unit: { zh: '購買力平價美元', en: 'US$ (PPP)' },
      file: 'teacher-salary.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [35000, 45000, 55000, 65000, 75000, 90000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 美元（PPP）`, en: `$${fixed(v, 0)} (PPP)` }),
      formatTick: formatLargeTick,
      noValue: TW_NO_OECD,
    },
    {
      id: 'class-size',
      label: { zh: '小學每班人數', en: 'Primary class size' },
      description: {
        zh: '小學平均一班幾個學生（公私立全部學校，OECD 約 38 國）。智利、以色列、日本超過 26 人，OECD 平均約 21 人；台灣 2025 學年度 22.6 人。',
        en: 'Average number of pupils per primary school class (all schools, about 38 OECD countries). It exceeds 26 in Chile, Israel and Japan, against an OECD average of about 21; Taiwan had 22.6 in the 2025 school year.',
      },
      unit: { zh: '人', en: 'pupils' },
      file: 'class-size.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [16, 18, 20, 22, 24, 26] } },
      format: perClass,
      formatTick: (v) => fixed(v, 0),
      chartZoom: true,
    },
    {
      id: 'pupil-teacher',
      label: { zh: '小學生師比', en: 'Primary pupil–teacher ratio' },
      description: {
        zh: '小學學生數除以教師數（人頭數，兼任也算一人），不是每班人數。非洲中部、東部超過 50，歐美、日本、台灣多在 10–15。',
        en: 'Primary school pupils divided by teachers (headcount, part-time teachers count as one); this is not class size. It exceeds 50 in parts of Central and East Africa and is mostly 10–15 in Europe, North America, Japan and Taiwan.',
      },
      unit: { zh: '人', en: 'pupils per teacher' },
      file: 'pupil-teacher.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 35, 45] } },
      format: perTeacher,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'school-days',
      label: { zh: '小學一年上課天數', en: 'School days per year, primary' },
      description: {
        zh: '公立小學一年上課幾天（2025 年，OECD 與夥伴國）。以色列 214 天、日本約 202 天最多，保加利亞 162.5 天最少；各國對考試日、教師進修日算不算不同。台灣的法規只規定寒暑假，沒有規定上課日數。',
        en: 'Days of instruction per year in public primary schools (2025, OECD members and partners). Israel (214) and Japan (about 202) have the most and Bulgaria (162.5) the fewest; countries differ on whether exam and teacher-training days count. Taiwan’s regulations set only the length of the holidays, not the number of school days.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'school-days.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [170, 175, 180, 185, 190, 200] } },
      format: (v) => tr({ zh: `${fixed(v, v % 1 ? 1 : 0)} 天`, en: `${fixed(v, v % 1 ? 1 : 0)} days` }),
      formatTick: (v) => fixed(v, 0),
      noValue: { TWN: { zh: '法規沒有規定上課日數', en: 'No set number of school days' } },
    },
    {
      id: 'vocational',
      label: { zh: '高中讀職業類課程的比例', en: 'Upper secondary students in vocational programmes' },
      description: {
        zh: '高中階段的學生讀職業類（技職）課程的比例。中歐、東歐常超過六成，德國約五成（含雙軌制的學徒），日本約兩成；台灣 2025 學年度高職（專業群科加實用技能學程）41.3%。',
        en: 'Share of upper secondary students in vocational programmes. It often exceeds 60% in Central and Eastern Europe, is about half in Germany (including dual-system apprentices) and about a fifth in Japan; Taiwan had 41.3% in vocational and practical skills programmes in the 2025 school year.',
      },
      unit: '%',
      file: 'vocational.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] } },
      format: pct,
      formatTick: pctTick,
      noValue: { BOL: { zh: 'UNESCO 的值每年都是 100%，不收', en: 'Left out: UNESCO reports 100% every year' } },
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
