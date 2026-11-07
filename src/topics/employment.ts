import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';
import { COVID, FINANCIAL_CRISIS } from './events';
import { withParts } from './parts';
import { hostOnly, topicPart } from './merge';
import { retirement } from './retirement';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
// 失業率、勞參率跟主計總處公布的一樣留兩位小數（台灣 2024 年 3.38%）；非正式就業是調查的調和值，一位就好
const pct2 = (v: number) => `${fixed(v, 2)}%`;
const pct1 = (v: number) => `${fixed(v, 1)}%`;
const tick = (v: number) => `${fixed(v, Number.isInteger(v) ? 0 : 1)}%`;

const employmentOwn: TopicDefinition = {
  id: 'employment',
  title: { zh: '就業與失業', en: 'Employment and unemployment' },
  shortTitle: { zh: '就業與失業', en: 'Jobs' },
  defaultIndicator: 'unemployment',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: '國際勞工組織 ILOSTAT（ILO 模型估計 2025 年 11 月版、非正式就業比例）',
        en: 'International Labour Organization, ILOSTAT (ILO modelled estimates, November 2025; informal employment rate)',
      },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '主計總處 人力資源調查、人力運用調查',
        en: 'DGBAS (Taiwan), Manpower Survey and Manpower Utilization Survey',
      },
      url: 'https://www.stat.gov.tw/cl.aspx?n=2700',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'OECD Pensions at a Glance：年金淨所得替代率（DF_PRR）', en: 'OECD Pensions at a Glance: net pension replacement rates (DF_PRR)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PAG%40DF_PRR&df[ag]=OECD.ELS.SPD',
      license: 'CC BY 4.0',
    },
  ],
  panelExtra: () => import('./panels/EmploymentPanel'),
  note: {
    zh:
      '失業率、青年失業率與勞動力參與率是國際勞工組織的模型估計：有申報勞動力調查的國家用各國的數字，沒有的國家與年份（例如中國、北韓）由模型推算，所以每個國家每年都有值；' +
      '2025 年是 2025 年 11 月時的推估，那時還沒有任何國家的全年資料。' +
      '非正式就業是沒有勞動保障的工作（雇主沒有登記、沒有社會保險或帶薪假，包括多數的自營作業者與無酬家屬工作者），由國際勞工組織用各國勞動力調查的原始資料依同一套定義重新計算，只有約 130 國，美國、日本、中國等都沒有；很多國家隔幾年才調查一次，地圖用每個國家 5 年內最近一年的資料。' +
      '台灣不是國際勞工組織會員，模型估計裡的台灣近幾年是推算的，改用主計總處人力資源調查的數字（不含現役軍人與監管人口）；台灣沒有非正式就業的統計，側欄的附註列出主計總處「非典型就業」的數字對照。',
    en:
      'Unemployment, youth unemployment and labour force participation are ILO modelled estimates: countries that report labour force surveys keep their own figures, and the model fills in the countries and years without data (China and North Korea, for example), so every country has a value every year. ' +
      'The 2025 figures are projections made in November 2025, before any country had full-year data. ' +
      'Informal employment means jobs without labour protection (unregistered employers, no social insurance or paid leave, including most own-account and contributing family workers). The ILO recomputes it from the microdata of national labour force surveys with a common definition; only about 130 countries are covered, not including the United States, Japan or China. Many countries run these surveys only every few years, so the map shows the latest year within five years. ' +
      "Taiwan is not an ILO member and its recent figures in the model are estimates, so Taiwan's figures come from DGBAS's Manpower Survey (which excludes the armed forces and institutionalised people). Taiwan has no statistics on informal employment; the note in the side panel gives DGBAS's figures on atypical employment for comparison.",
  },
  indicators: [
    {
      id: 'unemployment',
      label: { zh: '失業率', en: 'Unemployment rate' },
      description: {
        zh: '15 歲以上的勞動力中，沒有工作、可以馬上工作而且正在找工作的人所占的比例。很多低所得國家沒有失業保險，大多數人必須做點零工維生，失業率反而很低。',
        en: 'Share of the labour force aged 15 and over who have no job, are available to start and are looking for work. Many low-income countries have no unemployment benefits, so most people must take whatever odd jobs they can and measured unemployment is low.',
      },
      unit: '%',
      file: 'unemployment.json',
      events: [FINANCIAL_CRISIS, COVID],
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 7.5, 10, 15, 20] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'youth-unemployment',
      label: { zh: '青年失業率（15–24 歲）', en: 'Youth unemployment (ages 15–24)' },
      description: {
        zh: '15–24 歲的勞動力中失業者的比例。分母只有已經在工作或找工作的年輕人，還在上學、沒有找工作的不算在內。',
        en: 'Share of the labour force aged 15–24 who are unemployed. Only young people who are working or looking for work count; students who are not looking for a job are left out.',
      },
      unit: '%',
      file: 'youth-unemployment.json',
      events: [FINANCIAL_CRISIS, COVID],
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'informal',
      label: { zh: '非正式就業比例', en: 'Informal employment' },
      description: {
        zh: '非正式就業占所有就業者的比例：雇主沒有登記、沒有社會保險或帶薪假的工作，包括多數的自營作業者與無酬家屬工作者（SDG 8.3.1）。約 130 國，台灣沒有這項統計。',
        en: 'Informal jobs as a share of all employment: work for unregistered employers or without social insurance or paid leave, including most own-account and contributing family workers (SDG 8.3.1). About 130 countries; Taiwan has no such statistics.',
      },
      unit: '%',
      file: 'informal.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 75, 90] } },
      format: pct1,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'participation',
      label: { zh: '勞動力參與率', en: 'Labour force participation' },
      description: {
        zh: '15 歲以上人口中，有工作或正在找工作的人的比例。高齡化、年輕人讀書讀得久、女性較少外出工作的國家比較低。',
        en: 'Share of the population aged 15 and over who are working or looking for work. It is lower where the population is older, young people study longer or fewer women work outside the home.',
      },
      unit: '%',
      file: 'participation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [45, 50, 55, 60, 65, 70] } },
      format: pct2,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'neet',
      label: { zh: '尼特族（15–24 歲沒工作也沒上學）', en: 'Youth not in employment, education or training (NEET)' },
      description: {
        zh: '15–24 歲的人裡，既沒有工作、也沒有在受教育或職業訓練的比例（SDG 8.6.1，國際勞工組織的模型估計，2025 年以後是推估）。2025 年阿富汗 55.7%、聖多美普林西比 50.4%、吉布地 50.0%、葉門 46.0% 最高；日本 3.1%、亞塞拜然 3.3%、荷蘭 3.6% 最低；台灣 9.0%、南韓 11.0%、美國 11.7%，世界 20.0%。跟青年失業率不同：失業率的分母是在找工作的人，尼特族的分母是所有年輕人，唸書的人多會壓低失業率、但不影響尼特族。子項目可以切男女：印度女性 39.6%、男性 10.4%，巴基斯坦女性 56.6%、男性 13.2%，很多是結婚與家務。',
        en: 'Share of people aged 15–24 who are neither employed nor in education or training (SDG 8.6.1, ILO modelled estimates; projections from 2025). In 2025 Afghanistan (55.7%), São Tomé and Príncipe (50.4%), Djibouti (50.0%) and Yemen (46.0%) were highest; Japan (3.1%), Azerbaijan (3.3%) and the Netherlands (3.6%) lowest; Taiwan 9.0%, South Korea 11.0% and the US 11.7%, against a world 20.0%. Unlike youth unemployment, whose denominator is young people looking for work, the NEET rate counts all young people, so many students lower unemployment but not NEET. Split by sex: in India 39.6% of young women and 10.4% of young men, in Pakistan 56.6% and 13.2%, much of it marriage and housework.',
      },
      unit: '%',
      file: 'neet/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6, 9, 12, 16, 22, 30] } },
      dimension: {
        label: { zh: '性別', en: 'Sex' },
        options: [
          { id: 'total', label: { zh: '男女合計', en: 'Total' } },
          { id: 'female', label: { zh: '女性', en: 'Women' } },
          { id: 'male', label: { zh: '男性', en: 'Men' } },
        ],
        defaultOption: 'total',
      },
      format: pct1,
      formatTick: tick,
      compareWorld: true,
      defaultYear: 2025,
    },
    {
      id: 'working-poverty',
      label: { zh: '有工作還是極端貧窮', en: 'Working poverty' },
      description: {
        zh: '就業者裡，家庭所得低於國際極端貧窮線（每人每天 2.15 美元，2017 年購買力平價）的比例（SDG 1.1.1，國際勞工組織的模型估計）。2025 年馬達加斯加 86.0%、剛果民主共和國 80.3%、莫三比克 79.6%、索馬利亞 78.2% 最高；南非 14.5%、印尼 5.6%、印度 3.6%、墨西哥 1.6%、越南 1.4%，世界 7.9%；中高所得國家接近 0。跟「貧富差距」的極端貧窮不同，分母是有工作的人：有工作也不保證脫貧。台灣不在資料裡。',
        en: 'Share of employed people living in households below the international extreme poverty line (US$2.15 a day per person, 2017 PPP) (SDG 1.1.1, ILO modelled estimates). In 2025 Madagascar (86.0%), the DR Congo (80.3%), Mozambique (79.6%) and Somalia (78.2%) were highest; South Africa 14.5%, Indonesia 5.6%, India 3.6%, Mexico 1.6% and Vietnam 1.4%, against a world 7.9%; upper-middle and high-income countries are near zero. Unlike the extreme poverty rate under Inequality, the denominator here is people in work: having a job is no guarantee of escaping poverty. Taiwan is not covered.',
      },
      unit: '%',
      file: 'working-poverty.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 70] } },
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: tick,
      compareWorld: true,
      defaultYear: 2025,
    },
    {
      id: 'replacement-rate',
      label: { zh: '退休後年金是退休前薪資的幾成', en: 'Pension replacement rate' },
      description: {
        zh: '一個現在開始工作、一輩子領平均薪資、做到法定退休年齡的人，退休後的年金是退休前薪資的幾 %（淨替代率，只算強制性制度；OECD《Pensions at a Glance》的制度模擬，只有 2024 年）。中國大陸 103.6%、巴西 97.5%、土耳其 96.4%、荷蘭 96.0%、葡萄牙 92.7% 最高；美國 51.3%、德國 53.3%、日本 42.4%、南韓 38.9%、愛爾蘭 33.7%、南非 8.9%。子項目可以看領半薪、領兩倍薪的人：替代率差越多，制度越像均一給付（低薪的人領得相對多）。這是對未來新進勞工的模擬，不是現在退休的人實際領的；中國大陸的高比例是城鎮職工制度，實際覆蓋與給付差很多；只算強制性，職業年金普遍但非強制的國家（荷蘭以外）會被低估。台灣不在 OECD 的資料裡。',
        en: 'For someone starting work now on the average wage all their career and retiring at the statutory age, the pension as a percentage of pre-retirement earnings (net replacement rate, mandatory schemes only; OECD Pensions at a Glance model, 2024 only). Mainland China (103.6%), Brazil (97.5%), Turkey (96.4%), the Netherlands (96.0%) and Portugal (92.7%) are highest; the US 51.3%, Germany 53.3%, Japan 42.4%, South Korea 38.9%, Ireland 33.7% and South Africa 8.9%. Options show workers on half and double the average wage: the bigger the gap, the more flat-rate the system (low earners get relatively more). This is a projection for new entrants, not what today’s retirees receive; China’s high rate is for the urban employee scheme, whose coverage and benefits are far patchier in practice; counting only mandatory schemes understates countries where occupational pensions are widespread but voluntary. Taiwan is not in the OECD data.',
      },
      unit: '%',
      file: 'replacement-rate/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] } },
      dimension: {
        label: { zh: '薪資', en: 'Earnings' },
        options: [
          { id: 'average', label: { zh: '領平均薪資', en: 'Average earner' } },
          { id: 'half', label: { zh: '領平均薪資的一半', en: 'Half the average' } },
          { id: 'double', label: { zh: '領平均薪資的兩倍', en: 'Double the average' } },
        ],
        defaultOption: 'average',
      },
      format: pct1,
      formatTick: tick,
      defaultYear: 2024,
    },
  ],
};

/**
 * 就業、失業與退休（2026-11-04，主題整併 併16）：「退休年齡與退休後的日子」併進來，資料照舊在 retirement/
 * （topics/merge.ts），舊網址 t/retirement/ 轉到這裡（redirects.ts）。退休的指標各自有「性別」的子項目
 */
export const employment: TopicDefinition = withParts(
  {
    ...hostOnly(employmentOwn),
    title: { zh: '就業、失業與退休', en: 'Employment, unemployment and retirement' },
    shortTitle: { zh: '就業與退休', en: 'Jobs & retirement' },
  },
  topicPart(retirement),
);
