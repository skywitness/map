import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { FlowLabels, IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

/**
 * 學術論文（pipeline/topics/publications.py）：OpenAlex（CC0 1.0）的各國論文數、國際合著、開放取用、高被引論文，
 * 2000–2025 年，只算 CWTS 核心來源（國際性的學術期刊與會議論文集），整數計數。人均用 UN WPP 2024。
 * 子項目是 OpenAlex 的 4 個領域；合著沿用流向圖（src/map/flows.ts），選了國家才畫它的合著國家。
 * 決定與資料陷阱見 DESIGN.md 第 8 節第 81 點。
 */

/** 比例要那一年（那個領域）有這麼多篇論文才算（pipeline 的 MIN_PAPERS，會檢查） */
export const MIN_PAPERS = 100;
/** 高被引論文只到這一年（pipeline 的 TOP10_LAST，會檢查）：最新一年的論文被引用的時間太短 */
export const TOP10_LAST = 2024;
const MIN_TEXT = String(MIN_PAPERS);

/** 2025 年人口不到 10 萬、不算人均的地方（pipeline 的 MIN_POPULATION 算出來的，會檢查） */
const SMALL = ['AIA', 'AND', 'ASM', 'ATG', 'BES', 'BMU', 'COK', 'CYM', 'DMA', 'FLK', 'FRO', 'GGY', 'GIB', 'GRL', 'IMN', 'KNA', 'LIE', 'MAF', 'MCO', 'MNP', 'MSR', 'PLW', 'SMR', 'SXM', 'TCA', 'TUV', 'VAT', 'VCT', 'VGB', 'VIR'];
const SMALL_REASON: Text = {
  zh: '人口不到 10 萬，幾個研究機構就讓人均很高，不算人均',
  en: 'Population under 100,000, where a few research institutes make the per-person figure very high, so none is given',
};

const PAPERS: Text = { zh: '篇', en: 'papers' };
/** 篇數：100 萬以下寫完整的數字（中文的「萬」取整數，台灣的 41,120 篇會變成「4 萬」，看不出差別） */
export const paperCount = (v: number) => (Math.abs(v) < 1e6 ? fixed(v, 0) : formatLargeNumber(v));
const papers = (v: number) => tr({ zh: `${paperCount(v)} 篇`, en: `${paperCount(v)} papers` });
const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${fixed(v, 0)}%`;

/** 算哪些論文，每個指標的說明都要寫 */
const COUNTING: Text = {
  zh: '只算核心期刊與會議論文集的期刊論文、回顧論文、會議論文；一篇論文有幾個國家的作者，每個國家各算一篇。',
  en: 'Articles, reviews and conference papers in core journals and proceedings only; a paper with authors in several countries counts once for each.',
};

const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });

const COAUTHOR_LABELS: FlowLabels = {
  partners: { zh: '合著國家', en: 'co-author countries' },
  main: { zh: '主要合著國家', en: 'Main co-author countries' },
  verb: (origin, partner) =>
    tr({ zh: `${origin}與${partner}的作者合著的論文`, en: `Papers co-authored by ${origin} and ${partner}` }),
};

const indicators: IndicatorDef[] = [
  {
    id: 'per-million',
    label: { zh: '每百萬人論文數', en: 'Papers per million people' },
    description: {
      zh: `一年的論文數 ÷ 人口 × 100 萬。${COUNTING.zh}人口不到 10 萬的地方不算。`,
      en: `Papers in a year per million people. ${COUNTING.en} Places with fewer than 100,000 people are left out.`,
    },
    unit: { zh: '篇／百萬人', en: 'papers per million' },
    file: 'per-million/{item}.json',
    layer: {
      kind: 'choropleth',
      scale: sequential([25, 100, 300, 1000, 2000, 4000]),
      itemScales: {
        physical: sequential([10, 40, 120, 400, 800, 1600]),
        life: sequential([5, 15, 50, 150, 300, 600]),
        health: sequential([10, 30, 100, 300, 600, 1200]),
        social: sequential([5, 15, 50, 150, 300, 600]),
      },
    },
    format: (v) => tr({ zh: `每百萬人 ${fixed(v, v < 10 ? 1 : 0)} 篇`, en: `${fixed(v, v < 10 ? 1 : 0)} per million` }),
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
    noValue: Object.fromEntries(SMALL.map((c) => [c, SMALL_REASON])),
  },
  {
    id: 'papers',
    label: { zh: '論文數', en: 'Papers' },
    description: {
      zh: `一年的論文數，圓的面積與篇數成正比。${COUNTING.zh}所以各國加總比全世界多，「占全世界」也是這樣算的。`,
      en: `Papers in a year; circle area is proportional to the number. ${COUNTING.en} Country totals therefore add up to more than the world, and so do shares of the world.`,
    },
    unit: PAPERS,
    file: 'papers/{item}.json',
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: papers,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'international',
    label: { zh: '國際合著比例', en: 'International co-authorship' },
    description: {
      zh: `論文裡有其他國家作者的比例。論文不到 ${MIN_TEXT} 篇的國家不算；小國的研究多半跟外國合作，比例自然高，大國低。`,
      en: `Share of papers with authors from another country. Countries with fewer than ${MIN_TEXT} papers are left out; small countries mostly research with partners abroad, so their shares are naturally high and large countries’ low.`,
    },
    unit: '%',
    file: 'international/{item}.json',
    layer: { kind: 'choropleth', scale: sequential([20, 30, 40, 50, 65, 80]) },
    format: percent,
    formatTick: percentTick,
    compareWorld: true,
  },
  {
    id: 'open-access',
    label: { zh: '開放取用比例', en: 'Open access share' },
    description: {
      zh: `論文有合法的免費全文、不必付費或登入就能讀的比例（開放期刊、付費開放，或放在典藏庫的版本，依 OpenAlex 的判斷），是現在看得到的，不是出版當時；最近一兩年偏低，有些論文要過了出版社的禁止期才放上典藏庫。論文不到 ${MIN_TEXT} 篇的國家不算。`,
      en: `Share of papers with a legal free full text that can be read without paying or logging in (open journals, paid open access or a copy in a repository, as OpenAlex determines), as available now rather than at publication; the last year or two are low because some papers reach repositories only after a publisher’s embargo. Countries with fewer than ${MIN_TEXT} papers are left out.`,
    },
    unit: '%',
    file: 'open-access/{item}.json',
    layer: { kind: 'choropleth', scale: sequential([20, 35, 50, 60, 70, 80]) },
    format: percent,
    formatTick: percentTick,
    compareWorld: true,
  },
  {
    id: 'top10',
    label: { zh: '高被引論文比例', en: 'Highly cited share' },
    description: {
      zh: `被引次數在同一年、同一子學科、同一類型的論文裡排前 10% 的比例（OpenAlex 的 citation_normalized_percentile）。比較的是 OpenAlex 的所有論文，核心期刊的論文平均被引較多，所以全世界約兩成。2017 年起各國一起下降約 4 個百分點，是 OpenAlex 的基準不同，前後不要直接比。只到 ${TOP10_LAST} 年；論文不到 ${MIN_TEXT} 篇的國家不算。`,
      en: `Share of papers among the top 10% most cited of the same year, subfield and type (OpenAlex’s citation_normalized_percentile). The comparison is with all OpenAlex works, and core-journal papers are cited more, so the world share is about a fifth. Every country drops by about 4 points from 2017, a change in OpenAlex’s baseline, so do not compare across it. Up to ${TOP10_LAST}; countries with fewer than ${MIN_TEXT} papers are left out.`,
    },
    unit: '%',
    file: 'top10/{item}.json',
    layer: { kind: 'choropleth', scale: sequential([10, 15, 20, 25, 30, 35]) },
    format: percent,
    formatTick: percentTick,
    compareWorld: true,
    defaultYear: TOP10_LAST,
  },
  {
    id: 'coauthors',
    label: { zh: '流向：合著國家', en: 'Flows: co-authors' },
    description: {
      zh: '點選國家，弧線連到跟它合著最多的 15 個國家，線寬與合著的論文數成正比；占比是占這國國際合著論文的比例（一篇可以有好幾國，加起來超過 100%）。排名表是國際合著的論文數，各領域合計。',
      en: 'Click a country to draw arcs to the 15 countries it co-authors with most; line width is proportional to co-authored papers. Shares are of its internationally co-authored papers (a paper can involve several countries, so they add up to more than 100%). The ranking shows internationally co-authored papers, all fields.',
    },
    unit: PAPERS,
    file: 'coauthors.json',
    layer: {
      kind: 'flow',
      file: 'flows/{year}.json',
      direction: 'export',
      labels: { export: COAUTHOR_LABELS, import: COAUTHOR_LABELS },
      legendKey: { zh: '由選取的國家（淺）到合著國家（深）', en: 'From the selected country (light) to co-authors (dark)' },
    },
    format: papers,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
];

export const publications: TopicDefinition = {
  id: 'publications',
  title: { zh: '學術論文', en: 'Scientific publications' },
  shortTitle: { zh: '學術論文', en: 'Papers' },
  defaultIndicator: 'per-million',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'OpenAlex（Priem, Piwowar & Orr 2022）', en: 'OpenAlex (Priem, Piwowar & Orr 2022)' },
      url: 'https://openalex.org/',
      license: 'CC0 1.0',
    },
    {
      name: { zh: 'CWTS 核心來源（Van Eck & Waltman 2024）', en: 'CWTS core sources (Van Eck & Waltman 2024)' },
      url: 'https://doi.org/10.5281/zenodo.13879947',
      license: { zh: 'CC0 1.0（清單）、CC BY 4.0（方法報告）', en: 'CC0 1.0 (list); CC BY 4.0 (method report)' },
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人口）', en: 'United Nations, World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '科技部《科學技術統計要覽》2019 年版（教育部統計處轉載；台灣的 SCI 論文對照）',
        en: 'Ministry of Science and Technology, Indicators of Science and Technology 2019 (via the Ministry of Education; Taiwan’s SCI papers for comparison)',
      },
      url: 'https://stats.moe.gov.tw/files/important/OVERVIEW_N09.pdf',
      license: { zh: '引用統計數字並註明出處', en: 'figures cited with source' },
    },
  ],
  note: {
    zh: '論文依作者所屬機構的國家歸類，用整數計數：一篇論文有台灣與美國的作者，台灣、美國各算一篇（不是各算半篇），所以各國加總比全世界多。只算 OpenAlex 裡 CWTS 核心來源（Leiden Ranking 用的國際性學術期刊與會議論文集，約 3.6 萬個）的期刊論文、回顧論文與會議論文，不含撤回的論文；很多以本國語言出版的期刊不在裡面，印尼、俄羅斯、巴西、中國大陸等地的論文數比 OpenAlex 的全部來源少很多，側欄有兩者的對照。OpenAlex 的作者機構資料越早越不完整：核心來源裡沒有作者國家的論文 2000 年約 26%、2010 年 18%、2020 年代 8–10%，早年的論文數偏低、成長看起來比實際快。領域依每篇論文的主要主題（OpenAlex 依標題與摘要自動分類）。OpenAlex 會持續修正，同一個查詢不同時間的結果會有些差異。研發經費、研究人員與專利見「研發與創新」主題，GitHub 上的開發者見「開發者」主題，各國出生的得主見「諾貝爾獎」主題。',
    en: 'Papers are assigned to countries by the institutions of their authors, with full counting: a paper with authors in Taiwan and the US counts once for each (not half each), so country totals add up to more than the world. Only articles, reviews and conference papers in OpenAlex’s CWTS core sources (about 36,000 international scientific journals and proceedings, as used in the Leiden Ranking) are counted, excluding retracted papers; many journals published in national languages are not core, so Indonesia, Russia, Brazil, mainland China and others have far fewer papers here than in all of OpenAlex, as the side panel shows. Author affiliations in OpenAlex are less complete the further back you go: core papers with no author country were about 26% in 2000, 18% in 2010 and 8–10% in the 2020s, so early counts are too low and growth looks faster than it was. Fields follow each paper’s primary topic (classified automatically by OpenAlex from its title and abstract). OpenAlex keeps revising its data, so the same query can give slightly different results over time. For R&D spending, researchers and patents see the R&D topic; for developers on GitHub, Developers; for laureates by birthplace, Nobel Prizes.',
  },
  dimension: {
    label: { zh: '領域', en: 'Field' },
    // 標題是「子項目＋指標」：「理工每百萬人論文數」「Physical sciences papers per million people」
    options: [
      { id: 'all', label: { zh: '全部領域', en: 'All fields' } },
      { id: 'physical', label: { zh: '理工', en: 'Physical sciences' } },
      { id: 'life', label: { zh: '生命科學', en: 'Life sciences' } },
      { id: 'health', label: { zh: '醫學與健康', en: 'Health sciences' } },
      { id: 'social', label: { zh: '人文社會', en: 'Social sciences' } },
    ],
    defaultOption: 'all',
  },
  panelExtra: () => import('./panels/PublicationsPanel'),
  indicators,
};
