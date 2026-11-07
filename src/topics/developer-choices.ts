import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 開發者與開源的擴充：程式語言的版圖、開源授權的選擇、開發者在做什麼題目（2026-11-07，製作手冊第二十七批 592，
 * 候選 1313–1315；pipeline/topics/developer_choices.py）。GitHub Innovation Graph 的語言、授權、標籤，每年第 1 季。
 * 側欄沿用主題的 DevelopersPanel（已經列出最多人用的語言與授權）。
 */
const Q1 = {
  label: { zh: '每年第 1 季', en: 'Q1 of each year' },
  year: (y: number) => tr({ zh: `${y} 年第 1 季`, en: `Q1 ${y}` }),
};
const pct = (v: number) => `${fixed(v, 1)}%`;
const COUNTED = {
  zh: '人數是「有推送的帳號」，一個人會在好幾種語言、授權或標籤各算一次，所以是人次的比例；一季少於 100 人的類別不公布，人次太少的地方不算。',
  en: 'Counts are accounts that pushed code, so one person counts once in each language, licence or tag they used; these are shares of person-counts. Categories with fewer than 100 people in a quarter are not published, so places with too few are left out.',
};

export const developerChoicesPart: TopicPart = {
  name: { zh: '程式語言、開源授權與題目', en: 'Languages, licences and topics' },
  sources: [
    {
      name: { zh: 'GitHub Innovation Graph（languages、licenses、topics）', en: 'GitHub Innovation Graph (languages, licenses, topics)' },
      url: 'https://github.com/github/innovationgraph',
      license: 'CC0 1.0',
    },
  ],
  indicators: [
    {
      id: 'lang-share',
      label: { zh: '占程式語言的比例', en: 'share of programming languages' },
      description: {
        zh: `某一種程式語言占這一國所有程式語言人次的比例（GitHub，每年第 1 季，2020 年起；子項目選語言）。JavaScript 幾乎在每一國都是第一（2026 年 181 個經濟體有 179 個），所以不畫「第一名是誰」。2026 年 Python：烏茲別克 19.3%、伊朗 19.0%、印度 17.7% 最高，台灣 15.7%、南韓 14.4%、中國 14.0%、美國 13.7%、日本 12.8%、德國 12.3%；JavaScript：薩爾瓦多 32.6%、奈及利亞 29.0%、迦納 28.6%，台灣與日本 16.9%，德國 12.8% 最低；Rust：日本、香港 1.7% 最高，台灣 1.3%。${COUNTED.zh}`,
        en: `One programming language’s share of all programming-language person-counts in the economy (GitHub, Q1 each year, from 2020; choose the language as a sub-item). JavaScript leads almost everywhere (179 of 181 economies in 2026), so “who is first” is not mapped. In 2026 Python is highest in Uzbekistan 19.3%, Iran 19.0% and India 17.7%, with Taiwan 15.7%, South Korea 14.4%, China 14.0%, the US 13.7%, Japan 12.8% and Germany 12.3%; JavaScript peaks in El Salvador 32.6%, Nigeria 29.0% and Ghana 28.6%, with Taiwan and Japan at 16.9% and Germany lowest at 12.8%; Rust is highest in Japan and Hong Kong at 1.7%, Taiwan 1.3%. ${COUNTED.en}`,
      },
      unit: '%',
      file: 'lang-share/{item}.json',
      dimension: {
        label: { zh: '程式語言', en: 'Language' },
        options: [
          { id: 'python', label: 'Python' },
          { id: 'javascript', label: 'JavaScript' },
          { id: 'typescript', label: 'TypeScript' },
          { id: 'java', label: 'Java' },
          { id: 'csharp', label: 'C#' },
          { id: 'cpp', label: 'C++' },
          { id: 'php', label: 'PHP' },
          { id: 'go', label: 'Go' },
          { id: 'rust', label: 'Rust' },
          { id: 'kotlin', label: 'Kotlin' },
          { id: 'swift', label: 'Swift' },
          { id: 'dart', label: 'Dart' },
        ],
        defaultOption: 'python',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 12, 14, 16, 18] },
        itemScales: {
          python: { type: 'sequential', thresholds: [10, 12, 14, 16, 18] },
          javascript: { type: 'sequential', thresholds: [14, 17, 20, 24, 28] },
          typescript: { type: 'sequential', thresholds: [6, 8, 10, 12, 14] },
          java: { type: 'sequential', thresholds: [2, 3, 4, 5, 6] },
          csharp: { type: 'sequential', thresholds: [1, 2, 3, 4, 5] },
          cpp: { type: 'sequential', thresholds: [1, 2, 3, 4, 5] },
          php: { type: 'sequential', thresholds: [1, 2, 3, 5, 7] },
          go: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2, 2.5] },
          rust: { type: 'sequential', thresholds: [0.4, 0.8, 1.1, 1.4, 1.6] },
          kotlin: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2, 3] },
          swift: { type: 'sequential', thresholds: [0.3, 0.6, 0.9, 1.2, 1.5] },
          dart: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2, 3] },
        },
      },
      format: pct,
      timeAxis: Q1,
      unranked: true,
    },
    {
      id: 'permissive-share',
      label: { zh: '用寬鬆授權的比例', en: 'Permissive licences' },
      description: {
        zh: `開源專案用寬鬆授權（MIT、Apache、BSD、ISC 這類，別人改了可以不公開原始碼）占認得出的授權的比例；其餘是 copyleft（GPL、AGPL、LGPL、MPL 這類，改了要用同樣的授權公開）與公眾領域（CC0、Unlicense）。GitHub 認不出的（NOASSERTION）不算，不等於沒有授權。2026 年突尼西亞 92.6%、衣索比亞 91.5%、烏茲別克 90.5% 最高，南韓 87.1%、印度 85.4%、台灣 80.0%、日本 79.7%、美國 78.1%、中國 73.8%；歐洲最偏好 copyleft：德國 71.4%、義大利 69.8% 最低。${COUNTED.zh}`,
        en: `Share of identified licences that are permissive (MIT, Apache, BSD, ISC and the like, where modified code need not be published); the rest are copyleft (GPL, AGPL, LGPL, MPL and the like, where modifications must be released under the same terms) and public domain (CC0, Unlicense). Licences GitHub cannot identify (NOASSERTION) are excluded; they are not the same as no licence. In 2026 Tunisia 92.6%, Ethiopia 91.5% and Uzbekistan 90.5% are highest, South Korea 87.1%, India 85.4%, Taiwan 80.0%, Japan 79.7%, the US 78.1% and China 73.8%; Europe leans most to copyleft, with Germany 71.4% and Italy lowest at 69.8%. ${COUNTED.en}`,
      },
      unit: '%',
      file: 'permissive-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [72, 76, 80, 84, 88] } },
      format: pct,
      timeAxis: Q1,
      unranked: true,
    },
    {
      id: 'ai-topics',
      label: { zh: 'AI 題目的比例', en: 'AI topics' },
      description: {
        zh: `開源專案掛的題目標籤裡，AI 相關的占幾 %（ai、llm、machine-learning、ai-agents、mcp、claude-code、openai、rag、pytorch 等，同義詞合併；config、github-config 這兩個樣板標籤不算）。標籤是作者自己填的，一季要有 2,000 人次以上才算，只有 41 個經濟體。2026 年新加坡 34.4%、台灣 32.2%、以色列 27.7%、香港 25.6%、南韓 25.5%、中國 18.5%、越南 18.4%、日本 18.3%；美國 11.6%（2024 年 6.1%）、德國 8.7%、俄羅斯 4.4%。人次少一點的地方只公布熱門的標籤，冷門的都不到 100 人而不算，AI 的比例會偏高，跟美國這種什麼標籤都有的地方不完全能比。${COUNTED.zh}`,
        en: `Share of topic tags on open-source projects that are AI-related (ai, llm, machine-learning, ai-agents, mcp, claude-code, openai, rag, pytorch and others, with synonyms merged; the template tags config and github-config are excluded). Tags are chosen by authors, and a quarter needs at least 2,000 person-counts, so only 41 economies qualify. In 2026 Singapore 34.4%, Taiwan 32.2%, Israel 27.7%, Hong Kong 25.6%, South Korea 25.5%, China 18.5%, Vietnam 18.4% and Japan 18.3%; the US 11.6% (6.1% in 2024), Germany 8.7% and Russia 4.4%. Smaller places publish only popular tags, since niche ones fall under 100 people, so their AI share runs high and is not fully comparable with places like the US where every tag appears. ${COUNTED.en}`,
      },
      unit: '%',
      file: 'ai-topics.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30] } },
      format: pct,
      timeAxis: Q1,
    },
  ],
};
