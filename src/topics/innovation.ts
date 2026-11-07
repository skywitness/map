import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, intlDollars, usd } from '../lib/format';
import type { DimensionDef, Text, TopicDefinition } from './types';

const RESEARCHERS = { zh: '人/百萬人', en: 'per million people' };
const PATENTS_PER_MILLION = { zh: '件/百萬人', en: 'per million people' };
const APPLICATIONS = { zh: '件', en: 'applications' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const APPLICATIONS_STUDIES = { zh: '件', en: 'studies' };
/** ClinicalTrials.gov 的條款：要寫來源、處理日期與怎麼改動（pipeline/topics/clinical_trials.py 重跑時會檢查這個日期） */
const CT_CAVEAT = {
  zh: '資料取自 ClinicalTrials.gov（美國國家醫學圖書館），2026-11-02 處理；依試驗地點的國家數研究，多國試驗在每個國家各算一次，每百萬人用聯合國的人口自己算。只算 ClinicalTrials.gov 的登記：日本（jRCT、UMIN）、中國（ChiCTR）、印度（CTRI）多半登記在本國的平台，在這裡偏少，不代表試驗比較少。',
  en: 'Data from ClinicalTrials.gov (US National Library of Medicine), processed 2026-11-02; studies are counted by the countries of their sites, so a multinational trial counts once in each country, and per-million rates use UN population. Only ClinicalTrials.gov registrations are counted: Japan (jRCT, UMIN), China (ChiCTR) and India (CTRI) mostly register on national platforms, so they look low here without necessarily running fewer trials.',
};

// 中文的 formatLargeNumber 萬位取整數（台灣 19,586 件會變成「2 萬」），一百萬件以下直接寫出件數，跟英文介面一樣
/**
 * WIPO 的 35 個技術領域（pipeline/topics/innovation_fields.py 的 FIELDS），依 WIPO 的五大類分組；中文是自己寫的繁體
 * （WIPO 檔裡的 field_zh 是簡體）。2026-11-05，製作手冊第二十二批 383
 */
const ELECTRICAL = { zh: '電機工程', en: 'Electrical engineering' };
const INSTRUMENTS = { zh: '儀器', en: 'Instruments' };
const CHEMISTRY = { zh: '化學', en: 'Chemistry' };
const MECHANICAL = { zh: '機械工程', en: 'Mechanical engineering' };
const OTHER_FIELDS = { zh: '其他領域', en: 'Other fields' };
export const PATENT_FIELDS = [
  { id: 'electrical-machinery', label: { zh: '電機、電氣裝置與能源', en: 'Electrical machinery, apparatus, energy' }, group: ELECTRICAL },
  { id: 'audio-visual', label: { zh: '影音技術', en: 'Audio-visual technology' }, group: ELECTRICAL },
  { id: 'telecommunications', label: { zh: '電信', en: 'Telecommunications' }, group: ELECTRICAL },
  { id: 'digital-communication', label: { zh: '數位通訊', en: 'Digital communication' }, group: ELECTRICAL },
  { id: 'basic-communication', label: { zh: '基礎通訊程序', en: 'Basic communication processes' }, group: ELECTRICAL },
  { id: 'computer-technology', label: { zh: '電腦技術', en: 'Computer technology' }, group: ELECTRICAL },
  { id: 'it-management', label: { zh: '管理用的資訊技術方法', en: 'IT methods for management' }, group: ELECTRICAL },
  { id: 'semiconductors', label: { zh: '半導體', en: 'Semiconductors' }, group: ELECTRICAL },
  { id: 'optics', label: { zh: '光學', en: 'Optics' }, group: INSTRUMENTS },
  { id: 'measurement', label: { zh: '量測', en: 'Measurement' }, group: INSTRUMENTS },
  { id: 'biological-analysis', label: { zh: '生物材料分析', en: 'Analysis of biological materials' }, group: INSTRUMENTS },
  { id: 'control', label: { zh: '控制', en: 'Control' }, group: INSTRUMENTS },
  { id: 'medical-technology', label: { zh: '醫療技術', en: 'Medical technology' }, group: INSTRUMENTS },
  { id: 'organic-chemistry', label: { zh: '有機精細化學', en: 'Organic fine chemistry' }, group: CHEMISTRY },
  { id: 'biotechnology', label: { zh: '生物技術', en: 'Biotechnology' }, group: CHEMISTRY },
  { id: 'pharmaceuticals', label: { zh: '藥品', en: 'Pharmaceuticals' }, group: CHEMISTRY },
  { id: 'polymers', label: { zh: '高分子化學、聚合物', en: 'Macromolecular chemistry, polymers' }, group: CHEMISTRY },
  { id: 'food-chemistry', label: { zh: '食品化學', en: 'Food chemistry' }, group: CHEMISTRY },
  { id: 'basic-materials', label: { zh: '基礎材料化學', en: 'Basic materials chemistry' }, group: CHEMISTRY },
  { id: 'materials-metallurgy', label: { zh: '材料、冶金', en: 'Materials, metallurgy' }, group: CHEMISTRY },
  { id: 'surface-technology', label: { zh: '表面技術、塗層', en: 'Surface technology, coating' }, group: CHEMISTRY },
  { id: 'nanotechnology', label: { zh: '微結構與奈米技術', en: 'Micro-structural and nano-technology' }, group: CHEMISTRY },
  { id: 'chemical-engineering', label: { zh: '化學工程', en: 'Chemical engineering' }, group: CHEMISTRY },
  { id: 'environmental-technology', label: { zh: '環境技術', en: 'Environmental technology' }, group: CHEMISTRY },
  { id: 'handling', label: { zh: '搬運', en: 'Handling' }, group: MECHANICAL },
  { id: 'machine-tools', label: { zh: '工具機', en: 'Machine tools' }, group: MECHANICAL },
  { id: 'engines', label: { zh: '引擎、泵、渦輪機', en: 'Engines, pumps, turbines' }, group: MECHANICAL },
  { id: 'textile-paper-machines', label: { zh: '紡織與造紙機械', en: 'Textile and paper machines' }, group: MECHANICAL },
  { id: 'other-machines', label: { zh: '其他專用機械', en: 'Other special machines' }, group: MECHANICAL },
  { id: 'thermal', label: { zh: '熱處理程序與設備', en: 'Thermal processes and apparatus' }, group: MECHANICAL },
  { id: 'mechanical-elements', label: { zh: '機械元件', en: 'Mechanical elements' }, group: MECHANICAL },
  { id: 'transport', label: { zh: '運輸', en: 'Transport' }, group: MECHANICAL },
  { id: 'furniture-games', label: { zh: '家具、遊戲', en: 'Furniture, games' }, group: OTHER_FIELDS },
  { id: 'other-consumer-goods', label: { zh: '其他消費品', en: 'Other consumer goods' }, group: OTHER_FIELDS },
  { id: 'civil-engineering', label: { zh: '土木工程', en: 'Civil engineering' }, group: OTHER_FIELDS },
];
const PATENT_FIELD: DimensionDef = {
  label: { zh: '技術領域', en: 'Technology field' },
  options: PATENT_FIELDS,
  defaultOption: 'computer-technology',
};
const PUBLICATIONS = { zh: '件', en: 'publications' };
const publications = (v: number) => `${v < 1e6 ? fixed(v, 0) : formatLargeNumber(v)} ${tr(PUBLICATIONS)}`;

const applications = (v: number) => `${v < 1e6 ? fixed(v, 0) : formatLargeNumber(v)} ${tr(APPLICATIONS)}`;

const MISSING_MSTI: Text = { zh: '沒有資料（只有 OECD 的 MSTI 收錄的約 47 國，含台灣）', en: 'No data (only about 47 economies in the OECD MSTI, including Taiwan)' };

export const innovation: TopicDefinition = {
  id: 'innovation',
  title: { zh: '各國研發與創新', en: 'R&D and innovation by country' },
  shortTitle: { zh: '研發與創新', en: 'R&D' },
  defaultIndicator: 'rd-spending',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD Main Science and Technology Indicators（研發經費依部門與資金來源、研發人力，含台灣）', en: 'OECD Main Science and Technology Indicators (R&D by sector and source of funds, R&D personnel; includes Taiwan)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_MSTI%40DF_MSTI&df[ag]=OECD.STI.STP',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
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
      name: { zh: '經濟部智慧財產局 商標案件統計季報', en: 'Intellectual Property Office (Taiwan), quarterly trademark statistics' },
      url: 'https://data.gov.tw/dataset/35459',
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
        zh: 'ClinicalTrials.gov API v2（各國有試驗地點的研究數，2026-11-02 處理）',
        en: 'ClinicalTrials.gov API v2 (studies with sites in each country, processed 2026-11-02)',
      },
      url: 'https://clinicaltrials.gov/',
      license: { zh: 'ClinicalTrials.gov 條款（註明來源、處理日期與改動）', en: 'ClinicalTrials.gov terms (attribution, processing date and modifications)' },
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（換算每百萬人）',
        en: 'United Nations, World Population Prospects 2024 (for per-million rates)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: 'WIPO IP Statistics：依技術領域的專利公告（批次檔，2000–2022 年）', en: 'WIPO IP Statistics: patent publications by technology field (bulk files, 2000–2022)' },
      url: 'https://www.wipo.int/en/web/ip-statistics',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '智慧財產局 發明專利新申請案件數依國際專利分類排行（台灣的側欄）', en: 'Taiwan Intellectual Property Office, new invention patent applications by IPC subclass (Taiwan panel)' },
      url: 'https://data.gov.tw/dataset/94266',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'OECD Data Explorer：Venture capital investments（創業投資）', en: 'OECD Data Explorer: Venture capital investments' },
      url: 'https://data-explorer.oecd.org/',
      license: 'CC BY 4.0',
    },
  ],
  panelExtra: () => import('./panels/PatentFieldsPanel'),
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
    {
      // 2026-11-05（製作手冊第二十二批 383）：專利的技術領域（WIPO 的 35 個領域），側欄 PatentFieldsPanel
      id: 'patent-field',
      label: { zh: '占專利公告的比例', en: 'share of patent publications' },
      description: {
        zh: '這個國家的申請人在世界各國專利局公告的發明專利裡，屬於這個技術領域的比例（WIPO 的 35 個領域，選上方的「技術領域」切換；一年不到 100 件的國家不算）。2022 年瑞典 18,262 件裡數位通訊占 23.9%、芬蘭 24.6%（Ericsson 與 Nokia），以色列的醫療技術 22.7%，丹麥的引擎、泵、渦輪機 11.5%（風機），瑞士的醫療技術 12.2%、藥品 9.5%，德國的運輸 11.3%，南韓的半導體 7.2%，中國、美國、新加坡最多的都是電腦技術（15.6%、15.1%、16.7%）。是公告不是申請，跟上面的「專利申請件數」口徑不同，資料只到 2022 年。點國家看它前 10 大領域與相對專長（跟世界的比例相比）。台灣不在 WIPO 的資料裡，側欄列智慧局發明專利申請最多的國際專利分類。',
        en: 'Share of the invention patents published for applicants from this country, at patent offices worldwide, that fall in this technology field (WIPO’s 35 fields; switch with “Technology field” above; countries with fewer than 100 publications in a year are left out). In 2022 digital communication made up 23.9% of Sweden’s 18,262 publications and 24.6% of Finland’s (Ericsson and Nokia); medical technology 22.7% of Israel’s; engines, pumps and turbines 11.5% of Denmark’s (wind turbines); medical technology 12.2% and pharmaceuticals 9.5% of Switzerland’s; transport 11.3% of Germany’s; semiconductors 7.2% of South Korea’s; and computer technology led in China, the US and Singapore (15.6%, 15.1%, 16.7%). These are publications, not applications, unlike the patent applications indicator above, and the data end in 2022. Click a country for its top 10 fields and relative specialisation (compared with the world mix). Taiwan is not in the WIPO data; its panel lists the IPC classes with the most invention patent applications at the Intellectual Property Office.',
      },
      unit: '%',
      file: 'patent-field/{item}.json',
      dimension: PATENT_FIELD,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 6, 8, 12, 18] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'patent-office',
      label: { zh: '專利局一年公告的專利', en: 'Patents published by national offices' },
      description: {
        zh: '各國專利局一年公告的發明專利件數（不分申請人國籍）。2022 年中國國家知識產權局 167.0 萬件最多，美國 42.3 萬、日本 24.4 萬、南韓 20.3 萬；歐洲專利局（EPO）17.7 萬件不在地圖上（區域局）。WIPO 的資料只到 2022 年。',
        en: 'Invention patents published by each national patent office in a year (applicants of any nationality). In 2022 China’s office published the most, 1.67 million, followed by the US (423,000), Japan (244,000) and South Korea (203,000); the European Patent Office (177,000), a regional office, is not on the map. WIPO data end in 2022.',
      },
      unit: PUBLICATIONS,
      file: 'patent-office.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: publications,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'vc-gdp',
      label: { zh: '創業投資占 GDP', en: 'Venture capital, % of GDP' },
      description: {
        zh: '一年投入新創公司的創業投資（種子、早期與後期）占 GDP 的比例，OECD 依市場資料彙整，37 個經濟體。以色列 2024 年 1.81% 遠高於其他國家，美國 2025 年 0.62%、愛沙尼亞 0.34%、瑞典 0.21%；日本 2024 年 0.06%、南韓 2025 年 0.14%。台灣不在 OECD 的資料裡，也沒有可以比較的官方總量。',
        en: 'Venture capital invested in start-ups in a year (seed, early and later stage) as a share of GDP, compiled by the OECD from market data for 37 economies. Israel (1.81% in 2024) is far ahead, followed by the US (0.62% in 2025), Estonia (0.34%) and Sweden (0.21%); Japan 0.06% (2024), South Korea 0.14% (2025). Taiwan is not in the OECD data and has no comparable official total.',
      },
      unit: '%',
      file: 'vc-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.4, 1] } },
      format: (v) => `${fixed(v, v < 0.1 ? 3 : 2)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'vc-usd',
      label: { zh: '創業投資金額', en: 'Venture capital investment' },
      description: {
        zh: '一年投入新創公司的創業投資金額（美元，依當年匯率換算），OECD 的 37 個經濟體。美國 2025 年 1,921 億美元，遠多於以色列（2024 年 98 億）、英國（65 億）、加拿大（43 億）、德國（28 億）、南韓（26 億）。',
        en: 'Venture capital invested in start-ups in a year (US dollars at current exchange rates), for the OECD’s 37 economies. The US invested $192.1 billion in 2025, far more than Israel ($9.8 billion in 2024), the UK ($6.5 billion), Canada ($4.3 billion), Germany ($2.8 billion) and South Korea ($2.6 billion).',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'vc-usd.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
    },
    {
      id: 'trademarks-per-million',
      label: { zh: '每百萬人商標申請', en: 'Trademark applications per million people' },
      description: {
        zh: '本國居民的商標申請（WIPO 以類別數計：一件申請指定幾類就算幾個），除以人口。台灣用智慧局的件數（2025 年本國人 75,573 件，每百萬人約 3,200 件），件數會比類別數少約兩成。',
        en: 'Trademark applications by residents (counted by WIPO in classes: an application covering several classes counts several times), divided by population. Taiwan uses the Intellectual Property Office’s application counts (75,573 by Taiwanese applicants in 2025, about 3,200 per million people), which are about a fifth lower than class counts would be.',
      },
      unit: PATENTS_PER_MILLION,
      file: 'trademarks-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 100, 300, 1000, 3000, 10000] } },
      format: (v) => `${fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0)} ${tr(PATENTS_PER_MILLION)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'trademark-applications',
      label: { zh: '商標申請件數', en: 'Trademark applications' },
      description: {
        zh: '本國居民的商標申請（類別數）。2024 年中國 679 萬、俄羅斯 52 萬、印度 51 萬、美國 49 萬；台灣 2025 年 75,573 件（智慧局的件數）。圓的面積與件數成正比。',
        en: 'Trademark applications by residents (class counts). In 2024: China 6.79 million, Russia 520,000, India 510,000 and the US 490,000; Taiwan 75,573 in 2025 (the Intellectual Property Office’s application count). Circle area is proportional to the number.',
      },
      unit: APPLICATIONS,
      file: 'trademark-applications.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: applications,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'designs-per-million',
      label: { zh: '每百萬人工業設計申請', en: 'Industrial design applications per million people' },
      description: {
        zh: '本國居民的工業設計申請（WIPO 以設計數計），除以人口。台灣用智慧局的本國人設計專利新申請件數（2025 年 3,192 件）。',
        en: 'Industrial design applications by residents (counted by WIPO in designs), divided by population. Taiwan uses design patent applications by Taiwanese applicants from the Intellectual Property Office (3,192 in 2025).',
      },
      unit: PATENTS_PER_MILLION,
      file: 'designs-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 10, 30, 100, 300, 1000] } },
      format: (v) => `${fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0)} ${tr(PATENTS_PER_MILLION)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'design-applications',
      label: { zh: '工業設計申請件數', en: 'Industrial design applications' },
      description: {
        zh: '本國居民的工業設計申請（設計數）。2024 年中國 80 萬件，遠多於第二的南韓 5.2 萬、土耳其 4.2 萬、義大利 3.7 萬；台灣 2025 年 3,192 件。圓的面積與件數成正比。',
        en: 'Industrial design applications by residents (design counts). In 2024 China filed 800,000, far ahead of South Korea (52,000), Türkiye (42,000) and Italy (37,000); Taiwan 3,192 in 2025. Circle area is proportional to the number.',
      },
      unit: APPLICATIONS,
      file: 'design-applications.json',
      layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
      format: applications,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'clinical-trials-per-million',
      label: { zh: '臨床試驗（每百萬人）', en: 'Clinical trials per million people' },
      description: {
        zh: `在這個國家至少有一個試驗地點、登記在 ClinicalTrials.gov 的臨床研究數（歷年累計、不分狀態），除以現在的人口（人口不到 100 萬的國家不算）。丹麥 2,130、比利時 1,301、瑞士 1,193、以色列 1,113 最多；台灣 568、美國約 560，比南韓 346、英國 416 高。${CT_CAVEAT.zh}`,
        en: `Clinical studies registered on ClinicalTrials.gov with at least one site in the country (all years and statuses, cumulative), divided by today’s population (countries under 1 million people are left out). Denmark 2,130, Belgium 1,301, Switzerland 1,193 and Israel 1,113 lead; Taiwan (568) and the US (about 560) are above South Korea (346) and the UK (416). ${CT_CAVEAT.en}`,
      },
      unit: { zh: '件/百萬人', en: 'per million people' },
      file: 'clinical-trials-per-million.json',
      timeless: true,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 50, 100, 250, 500, 1000] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 0)} 件`, en: `${fixed(v, 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'clinical-trials',
      label: { zh: '臨床試驗件數', en: 'Clinical trials' },
      description: {
        zh: `登記在 ClinicalTrials.gov、在這個國家至少有一個試驗地點的臨床研究數（歷年累計）。美國 196,667 件最多，其次是中國 54,832、法國 43,237、加拿大 32,725、英國 29,098、德國 28,709；南韓 17,853、台灣 13,061、日本 9,407、印度 6,686。${CT_CAVEAT.zh}`,
        en: `Clinical studies registered on ClinicalTrials.gov with at least one site in the country (cumulative). The US has the most, 196,667, followed by China 54,832, France 43,237, Canada 32,725, the UK 29,098 and Germany 28,709; South Korea 17,853, Taiwan 13,061, Japan 9,407, India 6,686. ${CT_CAVEAT.en}`,
      },
      unit: APPLICATIONS_STUDIES,
      file: 'clinical-trials.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
      format: (v) => `${fixed(v, 0)} ${tr(APPLICATIONS_STUDIES)}`,
      formatTick: formatLargeTick,
    },
    // 2026-11-07（製作手冊第二十五批 510）OECD MSTI 的研發經費依執行部門、資金來源與研發人力（pipeline/topics/rd_structure.py）。MSTI 有台灣
    {
      id: 'rd-performer',
      label: { zh: '研發經費是誰花的（執行部門）', en: 'Who performs R&D' },
      description: {
        zh: '研發經費依執行部門的比例（OECD MSTI，2024 年為主，有台灣）。企業：以色列 93.8%、台灣 85.6%、愛爾蘭 85.0%、南韓 81.4%、日本 78.9%、中國 77.7%、美國 77.4%，OECD 73.3%。高等教育：哥斯大黎加 54.4%、拉脫維亞 46.5%、立陶宛 43.5%、丹麥與加拿大 34.5%、德國 17.6%、美國 10.9%、日本 10.6%、南韓與中國 8.4%，台灣只有 6.0%、以色列 4.7%。政府：阿根廷 36.7%（2023）、保加利亞 27.0%、羅馬尼亞 26.8%、盧森堡 25.4%、中國 13.9%、日本 9.3%、台灣 8.3%、南韓與美國 8.2%，以色列 0.8%。',
        en: 'Share of R&D spending by performing sector (OECD MSTI, mostly 2024, Taiwan included). Business: Israel 93.8%, Taiwan 85.6%, Ireland 85.0%, South Korea 81.4%, Japan 78.9%, China 77.7%, the US 77.4%, OECD 73.3%. Higher education: Costa Rica 54.4%, Latvia 46.5%, Lithuania 43.5%, Denmark and Canada 34.5%, Germany 17.6%, the US 10.9%, Japan 10.6%, South Korea and China 8.4%, Taiwan only 6.0%, Israel 4.7%. Government: Argentina 36.7% (2023), Bulgaria 27.0%, Romania 26.8%, Luxembourg 25.4%, China 13.9%, Japan 9.3%, Taiwan 8.3%, South Korea and the US 8.2%, Israel 0.8%.',
      },
      unit: '%',
      file: 'rd/performer/{item}.json',
      dimension: {
        label: { zh: '執行部門', en: 'Sector' },
        options: [
          { id: 'business', label: { zh: '企業', en: 'Business' } },
          { id: 'higher', label: { zh: '高等教育', en: 'Higher education' } },
          { id: 'government', label: { zh: '政府', en: 'Government' } },
          { id: 'nonprofit', label: { zh: '私人非營利', en: 'Private non-profit' } },
        ],
        defaultOption: 'business',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] },
        itemScales: {
          higher: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] },
          government: { type: 'sequential', thresholds: [2, 5, 10, 15, 20, 30] },
          nonprofit: { type: 'sequential', thresholds: [0.1, 0.5, 1, 2, 3, 5] },
        },
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: MISSING_MSTI,
    },
    {
      id: 'rd-funding',
      label: { zh: '研發經費是誰出的錢（資金來源）', en: 'Who funds R&D' },
      description: {
        zh: '研發經費依資金來源的比例（OECD MSTI，2023–2024 年）。企業出錢：台灣 85.1% 最高，中國 79.5%、南韓 78.5%、日本 77.5%、美國 68.7%，OECD 64.4%（2023）；阿根廷 22.9%、南非 27.7%、哥斯大黎加 28.5% 最低。政府出錢：阿根廷 54.9%、南非 50.3%、盧森堡 50.0%、哥斯大黎加 45.1%、挪威 42.9%；台灣 14.2%、愛爾蘭 11.8%、以色列 9.8%。國外出錢：以色列 44.8%、愛爾蘭 42.4%、保加利亞 41.9%、冰島 33.2%、捷克 32.7%（跨國企業在當地的研發中心）；台灣 0.1% 最低，中國與南韓 0.3%、日本 0.5%。',
        en: 'Share of R&D spending by source of funds (OECD MSTI, 2023–2024). Business-funded: Taiwan highest at 85.1%, China 79.5%, South Korea 78.5%, Japan 77.5%, the US 68.7%, OECD 64.4% (2023); lowest Argentina 22.9%, South Africa 27.7%, Costa Rica 28.5%. Government-funded: Argentina 54.9%, South Africa 50.3%, Luxembourg 50.0%, Costa Rica 45.1%, Norway 42.9%; Taiwan 14.2%, Ireland 11.8%, Israel 9.8%. Funded from abroad: Israel 44.8%, Ireland 42.4%, Bulgaria 41.9%, Iceland 33.2%, Czechia 32.7% (multinationals’ local R&D centres); Taiwan lowest at 0.1%, China and South Korea 0.3%, Japan 0.5%.',
      },
      unit: '%',
      file: 'rd/funding/{item}.json',
      dimension: {
        label: { zh: '資金來源', en: 'Source of funds' },
        options: [
          { id: 'business', label: { zh: '企業', en: 'Business' } },
          { id: 'government', label: { zh: '政府', en: 'Government' } },
          { id: 'abroad', label: { zh: '國外', en: 'Abroad' } },
        ],
        defaultOption: 'business',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 80] },
        itemScales: {
          government: { type: 'sequential', thresholds: [10, 20, 25, 30, 40, 50] },
          abroad: { type: 'sequential', thresholds: [1, 5, 10, 15, 25, 35] },
        },
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      missing: MISSING_MSTI,
    },
    {
      id: 'rd-personnel',
      label: { zh: '研發人力（每千名就業者）', en: 'R&D personnel per 1,000 employed' },
      description: {
        zh: '每千名就業者裡的研發人力與研究人員（全時約當數，OECD MSTI）。研發人力（研究人員加技術與支援人員）：台灣 26.8 最高，芬蘭 22.8、丹麥 22.3、南韓 21.9、比利時 21.3、奧地利 20.2、瑞典 19.4（2024）；智利 2.5（2022）、南非 2.7、羅馬尼亞 4.3 最低。研究人員：芬蘭 17.8、南韓 17.6、瑞典 17.2、丹麥 16.5、台灣 15.6；德國 11.2、美國 10.6（2023）、日本 10.2、中國 4.3；哥斯大黎加 1.0、智利 1.6、南非 1.7 最低。研究人員人數中國 318 萬最多。女性研究人員的比例在「性別平等」主題。',
        en: 'R&D personnel and researchers per 1,000 employed (full-time equivalent, OECD MSTI). R&D personnel (researchers plus technicians and support staff): Taiwan highest at 26.8, Finland 22.8, Denmark 22.3, South Korea 21.9, Belgium 21.3, Austria 20.2, Sweden 19.4 (2024); lowest Chile 2.5 (2022), South Africa 2.7, Romania 4.3. Researchers: Finland 17.8, South Korea 17.6, Sweden 17.2, Denmark 16.5, Taiwan 15.6; Germany 11.2, the US 10.6 (2023), Japan 10.2, China 4.3; lowest Costa Rica 1.0, Chile 1.6, South Africa 1.7. China has the most researchers, 3.18 million. The share of women researchers is in the gender equality topic.',
      },
      unit: { zh: '每千名就業者', en: 'per 1,000 employed' },
      file: 'rd/personnel/{item}.json',
      dimension: {
        label: { zh: '人力', en: 'Personnel' },
        options: [
          { id: 'total', label: { zh: '研發人力', en: 'All R&D personnel' } },
          { id: 'researchers', label: { zh: '研究人員', en: 'Researchers' } },
        ],
        defaultOption: 'total',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [5, 10, 13, 16, 20, 24] },
        itemScales: { researchers: { type: 'sequential', thresholds: [3, 6, 9, 12, 15, 17] } },
      },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      missing: MISSING_MSTI,
    },
  ],
};
