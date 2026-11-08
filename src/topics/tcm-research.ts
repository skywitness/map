import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 中醫的研究（新主題，2026-11-08，製作手冊第二十九批 700、709 的論文部分，候選 1613–1618；pipeline/topics/tcm_research.py）：
 * OpenAlex 的群組查詢（本機 session 查好放在 map-plan 的 data/openalex-tcm/）。臨床試驗（690、701、709 的試驗部分）
 * 等 ClinicalTrials.gov 的下載檔。不談療效：只是「有幾篇論文以它為題」。
 */
const SYSTEMS = [
  { id: 'tcm', label: { zh: '中醫（traditional Chinese medicine）', en: 'Traditional Chinese medicine' } },
  { id: 'acupuncture', label: { zh: '針灸', en: 'Acupuncture' } },
  { id: 'ayurveda', label: { zh: '阿育吠陀', en: 'Ayurveda' } },
  { id: 'homeopathy', label: { zh: '順勢療法', en: 'Homeopathy' } },
  { id: 'kampo', label: { zh: '漢方', en: 'Kampo' } },
];
const papers = (v: number) => tr({ zh: `${fixed(v, 0)} 篇`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'paper' : 'papers'}` });

export const tcmResearch: TopicDefinition = {
  id: 'tcm-research',
  title: { zh: '中醫的研究：各國發表了多少中醫與針灸論文', en: 'Research on Chinese medicine: papers on Chinese medicine and acupuncture by country' },
  shortTitle: { zh: '中醫的研究', en: 'Chinese medicine research' },
  defaultIndicator: 'papers',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OpenAlex：題名與摘要含 traditional chinese medicine、acupuncture、ayurveda、homeopathy、kampo 的期刊論文、回顧與會議論文，依作者機構所在國與出版年的群組查詢（2026-11-08 查詢）',
        en: 'OpenAlex: journal articles, reviews and conference papers with traditional chinese medicine, acupuncture, ayurveda, homeopathy or kampo in the title or abstract, grouped by authors’ institution country and publication year (queried 8 November 2026)',
      },
      url: 'https://openalex.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: 'OpenAlex 的論文，作者機構所在國依論文計數：一篇有幾國作者就每國各算一篇，各國相加大於總數；沒有任何作者有國家資料的不算進各國（中醫論文有 23%、針灸 35%、阿育吠陀 55% 是這樣）。用英文關鍵詞找題名與摘要，韓醫、藏醫與漢方的其他寫法、只用中文發表的期刊都抓不到，所以是下限，各體系之間也不是公平的比較。這裡只算有幾篇論文以它為題，不涉及療效。全部學科的論文數見「學術論文」主題。',
    en: 'Papers in OpenAlex counted by the country of the authors’ institutions: a paper with authors in several countries counts once for each, so country totals exceed the overall total, and papers with no author country are left out (23% of Chinese medicine papers, 35% for acupuncture and 55% for Ayurveda). Titles and abstracts were searched with English keywords, so other names for Korean, Tibetan and Kampo medicine and journals published only in Chinese are missed: these are lower bounds and the systems are not compared on equal terms. This counts papers on a subject and says nothing about efficacy. Papers in all fields are in the Research papers topic.',
  },
  indicators: [
    {
      id: 'papers',
      label: { zh: '各國一年發表的論文', en: 'Papers published per year' },
      description: {
        zh: '一年裡題名或摘要寫到這個體系的論文有幾篇（依作者機構所在國）。中醫（traditional Chinese medicine）2000–2025 年 88,426 篇、137 國：2000 年 397 篇、2010 年 3,369、2024 年 7,653、2025 年 9,981（還在陸續收錄）；中國 59,542 篇最多，美國 3,076、台灣 2,005（第 3）、香港 1,657、英國 787、日本 766、澳門 754、南韓 687。針灸 62,657 篇、142 國：中國 20,045、美國 5,523、南韓 3,882、英國 1,642、日本 1,303，台灣 868 篇第 9。阿育吠陀 31,931 篇（印度 12,515）、順勢療法 13,600 篇（印度 2,035、巴西 874、美國 842）、漢方 3,368 篇（日本 2,233）。中醫與針灸合起來有 157 國，再加上阿育吠陀與順勢療法也只到 169 國。拖時間軸看每一年。',
        en: 'Papers per year with the system in the title or abstract, by authors’ institution country. Traditional Chinese medicine: 88,426 papers from 137 countries in 2000–2025, rising from 397 in 2000 to 3,369 in 2010, 7,653 in 2024 and 9,981 in 2025 (still being indexed); China has 59,542, followed by the US 3,076, Taiwan 2,005 (third), Hong Kong 1,657, the UK 787, Japan 766, Macao 754 and South Korea 687. Acupuncture: 62,657 papers from 142 countries, led by China 20,045, the US 5,523, South Korea 3,882, the UK 1,642 and Japan 1,303, with Taiwan ninth at 868. Ayurveda has 31,931 (India 12,515), homeopathy 13,600 (India 2,035, Brazil 874, the US 842) and Kampo 3,368 (Japan 2,233). Chinese medicine and acupuncture together cover 157 countries; adding Ayurveda and homeopathy brings it only to 169. Drag the timeline to see each year.',
      },
      unit: { zh: '篇', en: 'papers' },
      file: 'papers/{item}.json',
      dimension: { label: { zh: '體系', en: 'System' }, options: SYSTEMS, defaultOption: 'tcm' },
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: papers,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'share',
      label: { zh: '占全國論文的比例', en: 'Share of all national papers' },
      description: {
        zh: '2000–2025 年這個國家的論文裡，每一萬篇有幾篇以中醫或針灸為題（分母是 OpenAlex 全部學科的論文，同樣依作者機構所在國計數）。只算全部論文至少 10 萬篇的 70 國：小國一個團隊就能撐起比例（澳門的全部論文不到 10 萬篇，沒有上色）。中醫：中國每萬篇 43.2 篇最高，香港 31.2、台灣 22.1、新加坡 6.2、泰國 4.6、馬來西亞 4.5、菲律賓 4.5、南韓 3.6；另一端俄羅斯 0.34、阿爾及利亞 0.21、祕魯 0.18。針灸的第一名換成南韓 20.4，中國 14.5、香港 12.6、台灣 9.6、奧地利 5.5、挪威 5.0。滑過國家看篇數。',
        en: 'Of all papers from a country in 2000–2025, how many per 10,000 are on Chinese medicine or acupuncture (the denominator is all OpenAlex papers, counted the same way by authors’ institution country). Only the 70 countries with at least 100,000 papers are shaded, because one team can drive the share of a small country (Macao has fewer than 100,000 papers and is not shaded). Chinese medicine: China is highest at 43.2 per 10,000, followed by Hong Kong 31.2, Taiwan 22.1, Singapore 6.2, Thailand 4.6, Malaysia 4.5, the Philippines 4.5 and South Korea 3.6; at the other end are Russia 0.34, Algeria 0.21 and Peru 0.18. For acupuncture South Korea leads at 20.4, ahead of China 14.5, Hong Kong 12.6, Taiwan 9.6, Austria 5.5 and Norway 5.0. Hover for the counts.',
      },
      unit: { zh: '篇／萬篇', en: 'per 10,000 papers' },
      file: 'share/{item}.json',
      dimension: { label: { zh: '體系', en: 'System' }, options: SYSTEMS.slice(0, 2), defaultOption: 'tcm' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 10, 20] } },
      timeless: true,
      format: (v) => tr({ zh: `每萬篇 ${fixed(v, 1)} 篇`, en: `${fixed(v, 1)} per 10,000` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'oa',
      label: { zh: '中醫論文的開放取用比例', en: 'Open access share of Chinese medicine papers' },
      description: {
        zh: '2000–2025 年的中醫論文裡，OpenAlex 標成開放取用（任何人都能免費讀全文）的比例。全部是 41.5%（36,711／88,426 篇）。只替中醫論文至少 100 篇的 28 國上色：印尼 86.0% 最高，泰國 80.6、馬來西亞 78.4、波蘭 76.4、荷蘭 72.0；美國 57.2、日本 55.6、台灣 53.7、香港 53.3、中國 45.6、德國 43.1。比例高的常常是因為那個國家的論文集中在少數開放取用期刊；全部學科的開放取用比例見「學術論文」主題。',
        en: 'Share of Chinese medicine papers from 2000–2025 that OpenAlex marks as open access (full text free to read). Overall it is 41.5% (36,711 of 88,426). Only the 28 countries with at least 100 Chinese medicine papers are shaded: Indonesia is highest at 86.0%, followed by Thailand 80.6, Malaysia 78.4, Poland 76.4 and the Netherlands 72.0; the US has 57.2, Japan 55.6, Taiwan 53.7, Hong Kong 53.3, China 45.6 and Germany 43.1. A high share often means a country’s papers are concentrated in a few open access journals; the open access share across all fields is in the Research papers topic.',
      },
      unit: '%',
      file: 'oa.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [45, 50, 55, 60, 70, 80] } },
      timeless: true,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};
