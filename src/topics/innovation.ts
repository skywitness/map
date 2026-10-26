import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, intlDollars } from '../lib/format';
import type { TopicDefinition } from './types';

const RESEARCHERS = { zh: '人/百萬人', en: 'per million people' };
const PATENTS_PER_MILLION = { zh: '件/百萬人', en: 'per million people' };
const APPLICATIONS = { zh: '件', en: 'applications' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

// 中文的 formatLargeNumber 萬位取整數（台灣 19,586 件會變成「2 萬」），一百萬件以下直接寫出件數，跟英文介面一樣
const applications = (v: number) => `${v < 1e6 ? fixed(v, 0) : formatLargeNumber(v)} ${tr(APPLICATIONS)}`;

export const innovation: TopicDefinition = {
  id: 'innovation',
  title: { zh: '各國研發與創新', en: 'R&D and innovation by country' },
  shortTitle: { zh: '研發與創新', en: 'R&D' },
  defaultIndicator: 'rd-spending',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（UNESCO 統計研究所、WIPO 資料）',
        en: 'World Bank, World Development Indicators (UNESCO Institute for Statistics and WIPO data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '國家科學及技術委員會 全國科技動態調查', en: 'National Science and Technology Council (Taiwan), national R&D survey' },
      url: 'https://data.gov.tw/dataset/7562',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '經濟部智慧財產局 本國人與外國人新申請專利件數',
        en: 'Intellectual Property Office (Taiwan), new patent applications by nationals and foreigners',
      },
      url: 'https://data.gov.tw/dataset/81180',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '行政院主計總處 總體統計資料庫（台灣的 GDP）', en: "DGBAS (Taiwan), National Statistics Database (Taiwan's GDP)" },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'IMF, World Economic Outlook (October 2026)（購買力平價 GDP，用來換算研發經費總額）',
        en: 'IMF, World Economic Outlook (October 2026) (GDP at PPP, used to calculate total R&D spending)',
      },
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明來源即可使用', en: 'free to use with attribution' },
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（換算每百萬人）',
        en: 'United Nations, World Population Prospects 2024 (for per-million rates)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '研發經費與研究人員來自 UNESCO 統計研究所，專利來自世界智慧財產權組織（WIPO），都是世界銀行轉載的版本（WIPO 國際局不對轉換後的資料負責）。台灣不在這些資料庫中，改用國科會「全國科技動態調查」與智慧局的本國人發明專利申請件數，細節見台灣側欄的附註。很多國家隔幾年才做一次研發調查。世界值是有資料國家的合計，研發經費占 GDP 依購買力平價的 GDP 加權。GitHub 上的開發者與開源活動見「開發者與開源」主題，各國的學術論文、國際合著與開放取用見「學術論文」主題。',
    en: "R&D spending and researchers come from the UNESCO Institute for Statistics and patents from the World Intellectual Property Organization (WIPO), both as republished by the World Bank (the International Bureau of WIPO assumes no responsibility for the transformed data). Taiwan is not in these databases, so the National Science and Technology Council's national R&D survey and the Intellectual Property Office's invention patent applications by Taiwanese applicants are used instead; see the notes in Taiwan's panel. Many countries survey R&D only every few years. World figures are totals for the countries with data, with R&D as a share of GDP weighted by GDP at purchasing power parity. For developers and open-source activity on GitHub, see the Developers topic; for scientific papers, international co-authorship and open access, the Papers topic.",
  },
  indicators: [
    {
      id: 'rd-spending',
      label: { zh: '研發經費占 GDP', en: 'R&D spending, % of GDP' },
      description: {
        zh: '企業、政府、大學與非營利機構一年花在研究與開發的經費，占國內生產毛額的比例。歐盟的目標是 3%。',
        en: 'Spending on research and development by businesses, government, universities and non-profits in a year, as a share of GDP. The EU target is 3%.',
      },
      unit: '%',
      file: 'rd-spending.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1, 2, 3] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'rd-spending-total',
      label: { zh: '研發經費總額（購買力平價）', en: 'R&D spending (PPP)' },
      description: {
        zh: '一年的研發經費，用購買力平價換算成國際元，扣掉各國物價的差異；由研發經費占 GDP 乘上 IMF 的購買力平價 GDP 算出。圓的面積與經費成正比。',
        en: 'R&D spending in a year in purchasing-power-parity international dollars, so that price differences between countries are taken out; calculated as R&D spending as a share of GDP times GDP at PPP from the IMF. Circle area is proportional to spending.',
      },
      unit: { zh: '國際元', en: 'international $' },
      file: 'rd-spending-total.json',
      layer: { kind: 'bubble', legendValues: [1e10, 1e11, 1e12] },
      format: (v) => intlDollars(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'researchers',
      label: { zh: '每百萬人研究人員', en: 'Researchers per million people' },
      description: {
        zh: '每一百萬人裡有幾位研究人員（從事新知識、新技術研發的專業人員，不含技術與支援人員），以全時約當數計算：只花一半時間做研究的人算 0.5 人。',
        en: 'Researchers (professionals creating new knowledge and technology, excluding technicians and support staff) per million people, in full-time equivalents: someone who spends half their time on research counts as 0.5.',
      },
      unit: RESEARCHERS,
      file: 'researchers.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [250, 500, 1000, 2000, 4000, 6000] } },
      format: (v) => `${fixed(v, 0)} ${tr(RESEARCHERS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'patents-per-million',
      label: { zh: '每百萬人專利申請', en: 'Patent applications per million people' },
      description: {
        zh: '本國居民向自己國家的專利局申請的發明專利件數，除以人口。歐洲很多申請直接送到歐洲專利局，不算在各國自己的專利局，所以歐洲國家會偏低。',
        en: "Invention patent applications filed by residents at their own country's patent office, divided by population. Many European applications go straight to the European Patent Office and are not counted at national offices, so European countries look lower than they are.",
      },
      unit: PATENTS_PER_MILLION,
      file: 'patents-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 10, 30, 100, 300] } },
      // 從 0.06（柬埔寨）到 3,786（南韓）：小的值多留幾位小數
      format: (v) => `${fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0)} ${tr(PATENTS_PER_MILLION)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'patent-applications',
      label: { zh: '專利申請件數', en: 'Patent applications' },
      description: {
        zh: '本國居民向自己國家的專利局申請的發明專利件數，不含新型與設計專利。各國的審查標準與申請成本不同，件數多不一定代表發明的品質高。圓的面積與件數成正比。',
        en: "Invention patent applications filed by residents at their own country's patent office, excluding utility models and designs. Examination standards and filing costs differ between countries, so more applications do not necessarily mean better inventions. Circle area is proportional to the number of applications.",
      },
      unit: APPLICATIONS,
      file: 'patent-applications.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: applications,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
