import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

/** 一致度：0–100%，寫到小數一位 */
const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${fixed(v, 0)}%`;
/** 理想點：帶正負號、小數兩位（用真正的減號）；圖例刻度不補零（−1.5、−0.75、+0.25） */
const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
const signed = (v: number) => `${sign(v)}${fixed(Math.abs(v), 2)}`;
const signedTick = (v: number) => {
  const abs = Math.abs(v);
  return `${sign(v)}${fixed(abs, Number.isInteger(abs) ? 0 : Number.isInteger(abs * 10) ? 1 : 2)}`;
};

/**
 * 一致度用單一色相的循序色：越深越常投相同的票。所有比較對象、所有年份共用同一組門檻，切換時顏色可以比較。
 * 不用發散色：50% 不是立場的分界，而且「與中國」「與美國」兩張圖的深色是不同的國家，用青綠／橘色會讓人以為有好壞之分。
 */
const AGREE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 80] };
/**
 * 理想點有正負，用發散色、中性灰跨過 0：負值（接近開發中國家的多數立場）橘、正值（接近美國與西方民主國家）青綠。
 * 近年大多數國家在 −1 到 +1.2 之間，冷戰初期的蘇聯集團低到 −3.6、美國與以色列高到 +2 以上，所以兩端的級距比較寬。
 */
const IDEAL_SCALE: ScaleSpec = { type: 'diverging', thresholds: [-1.5, -0.75, -0.25, 0.25, 0.75, 1.5] };

/** 一致度的算法（三個一致度指標共用） */
const AGREEMENT: Text = {
  zh: '兩國都參加的表決裡，都贊成、都反對或都棄權算一致，一國棄權、另一國贊成或反對算一半，缺席的不算（Lijphart 一致指數）。只看決議案的最後表決。',
  en: "Among votes in which both took part, both voting yes, both no or both abstaining counts as agreement and one abstaining while the other votes yes or no counts as half; absences are left out (Lijphart's index of agreement). Only final votes on resolutions count.",
};
const join = (a: Text, b: Text): Text =>
  typeof a === 'string' || typeof b === 'string' ? `${a} ${b}` : { zh: a.zh + b.zh, en: `${a.en} ${b.en}` };

/** 比較對象自己：跟自己的一致度沒有意義，tooltip 與側欄寫這句，不寫「無資料」 */
const SELF: Text = { zh: '比較的對象', en: 'The country compared with' };

function agreement(
  id: string,
  file: string,
  label: Text,
  lead: Text,
  tail?: Text,
  noValue?: Record<string, Text>,
): IndicatorDef {
  const description = join(lead, AGREEMENT);
  return {
    id,
    label,
    noValue,
    description: tail ? join(description, tail) : description,
    unit: '%',
    file,
    layer: { kind: 'choropleth', scale: AGREE_SCALE },
    format: percent,
    formatTick: percentTick,
    compareWorld: true,
  };
}

/**
 * 「與各國的投票一致度」的比較對象（ISO alpha-3），一國一個資料檔（agree/<ISO3>.json，pipeline/topics/un_votes.py 的 REFERENCES）。
 * 美國、中國是自己的指標，不在這裡。涵蓋安理會常任理事國、各區域的大國與台灣讀者常比較的鄰國。
 */
const REFERENCES: { id: string; label: Text }[] = [
  { id: 'RUS', label: { zh: '俄羅斯', en: 'Russia' } },
  { id: 'GBR', label: { zh: '英國', en: 'United Kingdom' } },
  { id: 'FRA', label: { zh: '法國', en: 'France' } },
  { id: 'DEU', label: { zh: '德國', en: 'Germany' } },
  { id: 'UKR', label: { zh: '烏克蘭', en: 'Ukraine' } },
  { id: 'JPN', label: { zh: '日本', en: 'Japan' } },
  { id: 'KOR', label: { zh: '南韓', en: 'South Korea' } },
  { id: 'IND', label: { zh: '印度', en: 'India' } },
  { id: 'IDN', label: { zh: '印尼', en: 'Indonesia' } },
  { id: 'AUS', label: { zh: '澳洲', en: 'Australia' } },
  { id: 'TUR', label: { zh: '土耳其', en: 'Türkiye' } },
  { id: 'IRN', label: { zh: '伊朗', en: 'Iran' } },
  { id: 'ISR', label: { zh: '以色列', en: 'Israel' } },
  { id: 'EGY', label: { zh: '埃及', en: 'Egypt' } },
  { id: 'ZAF', label: { zh: '南非', en: 'South Africa' } },
  { id: 'BRA', label: { zh: '巴西', en: 'Brazil' } },
];

/** 地圖上不是獨立會員國的屬地、特別行政區（由所屬國家在聯合國投票） */
const TERRITORIES = [
  'ABW', 'AIA', 'ALA', 'ASM', 'ATF', 'BES', 'BLM', 'BMU', 'BVT', 'CCK', 'CUW', 'CXR', 'CYM', 'FLK', 'FRO', 'GGY', 'GIB',
  'GLP', 'GRL', 'GUF', 'GUM', 'HKG', 'HMD', 'IMN', 'IOT', 'JEY', 'MAC', 'MAF', 'MNP', 'MSR', 'MTQ', 'MYT', 'NCL', 'NFK',
  'PCN', 'PRI', 'PYF', 'REU', 'SGS', 'SHN', 'SJM', 'SPM', 'SXM', 'TCA', 'TKL', 'UMI', 'VGB', 'VIR', 'WLF', '_IOT',
];
const NOT_MEMBER: Text = { zh: '不是聯合國會員國', en: 'Not a UN member' };
const SELF_DECLARED: Text = { zh: '自行宣布獨立，不是聯合國會員國', en: 'Self-declared state, not a UN member' };

export const unVotes: TopicDefinition = {
  id: 'un-votes',
  title: { zh: '聯合國大會投票', en: 'UN General Assembly votes' },
  shortTitle: { zh: '聯合國投票', en: 'UN votes' },
  defaultIndicator: 'agree-usa',
  // 一致度到 2024 年（作者 2025 年 7 月更新），理想點到 2025 年
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Erik Voeten, United Nations General Assembly Ideal Points（Harvard Dataverse 第 39 版，2026-07-30）；理想點的方法：Bailey, Strezhnev & Voeten (2017), Journal of Conflict Resolution 61(2)；原始表決：Fjelstul, Hug & Kilby (2025), UNGA-DM, The Review of International Organizations',
        en: 'Erik Voeten, United Nations General Assembly Ideal Points (Harvard Dataverse, version 39, 2026-07-30); method: Bailey, Strezhnev & Voeten (2017), Journal of Conflict Resolution 61(2); raw votes: Fjelstul, Hug & Kilby (2025), UNGA-DM, The Review of International Organizations',
      },
      url: 'https://doi.org/10.7910/DVN/LEJUQZ',
      license: 'CC0 1.0',
    },
  ],
  // 頁尾要短（英文版在 1280×800 太長會把地圖擠扁）：1964 年為什麼沒有表決、各國缺值的原因、捷克、德國、葉門的接續寫在 DESIGN.md
  note: {
    zh: '只看聯合國大會決議案的最後表決；年份是投票的日曆年，1964 年沒有記名表決。一致度會隨當年的議程變動，比較立場的變化用理想點比較好。歷史上的國家接到今天的國界（俄羅斯 1991 年以前是蘇聯、塞爾維亞 2006 年以前是南斯拉夫等）；1946–1971 年聯合國的中國席位由中華民國代表，放在台灣，中國（中華人民共和國）從 1971 年開始。世界值是各會員國的簡單平均。',
    en: "Final votes on General Assembly resolutions only; years are calendar years of the vote, and there were no recorded votes in 1964. Agreement moves with each year's agenda; ideal points are better for comparing changes in position. Historical states follow today's borders (Russia before 1992 is the Soviet Union, Serbia before 2006 is Yugoslavia, and so on); China's seat in 1946–1971 was held by the Republic of China, shown under Taiwan, and China (the People's Republic) starts in 1971. The world value is the simple average of member states.",
  },
  dimension: {
    label: { zh: '比較對象', en: 'Compared with' },
    options: REFERENCES,
    defaultOption: 'RUS',
    selfLabel: SELF,
  },
  /** 沒有值的原因（只在沒有值時取代「無資料」）：聯合國的觀察員、非會員與屬地 */
  noValue: {
    TWN: { zh: '1971 年起不是聯合國會員國', en: 'Not a UN member since 1971' },
    PSE: { zh: '聯合國的觀察員國，在大會沒有投票權', en: 'UN observer state, no vote in the General Assembly' },
    VAT: { zh: '教廷是聯合國的觀察員國，在大會沒有投票權', en: 'The Holy See is a UN observer state, no vote in the General Assembly' },
    XKX: NOT_MEMBER,
    COK: NOT_MEMBER,
    NIU: NOT_MEMBER,
    _SOL: SELF_DECLARED,
    _CYN: SELF_DECLARED,
    ESH: { zh: '非自治領土，不是聯合國會員國', en: 'Non-self-governing territory, not a UN member' },
    ...Object.fromEntries(TERRITORIES.map((c) => [c, { zh: '不是獨立的聯合國會員國', en: 'Not a separate UN member' }])),
  },
  panelExtra: () => import('./panels/UnVotesPanel'),
  indicators: [
    agreement(
      'agree-usa',
      'agree/USA.json',
      { zh: '與美國的一致度', en: 'US agreement' },
      {
        zh: '聯合國大會的記名表決中，跟美國投相同票的程度。',
        en: 'How often a country voted the same way as the United States in recorded votes of the UN General Assembly.',
      },
      {
        zh: '早年每年只有幾次到幾十次表決（1951 年只有 5 次），數字容易跳動。',
        en: 'Early years had only a handful to a few dozen votes (just 5 in 1951), so values jump around.',
      },
      { USA: SELF },
    ),
    agreement(
      'agree-chn',
      'agree/CHN.json',
      { zh: '與中國的一致度', en: 'China agreement' },
      {
        zh: '聯合國大會的記名表決中，跟中國（中華人民共和國）投相同票的程度，從 1971 年聯大第 2758 號決議之後開始；1946–1971 年中國席位上的投票是中華民國的，放在台灣。',
        en: "How often a country voted the same way as China (the People's Republic of China) in recorded General Assembly votes, from Resolution 2758 in 1971 onward; votes cast in China's seat in 1946–1971 were the Republic of China's and are shown under Taiwan.",
      },
      undefined,
      {
        CHN: SELF,
        // 1971 年以前中國席位是中華民國（放在台灣），兩者沒有共同參加的表決；主題的「1971 年起不是會員國」放在 1965 年會誤導
        TWN: {
          zh: '1971 年以前中國席位由中華民國代表，1971 年起台灣不是聯合國會員國',
          en: "China's seat was held by the Republic of China until 1971; Taiwan has not been a UN member since",
        },
      },
    ),
    {
      id: 'ideal-point',
      label: { zh: '理想點', en: 'Ideal point' },
      description: {
        zh: 'Bailey、Strezhnev 與 Voeten 用大會的記名表決估計的一維立場（動態的試題反應理論模型），可以跨國、跨年比較，沒有單位。依作者的說明，數值越高，投票立場越接近美國與西方民主國家；越低，越接近開發中國家的多數立場。這是估計值，側欄列出 90% 可信區間。作者提醒 2024 到 2025 年變化很大：有些是立場真的改變（例如美國、阿根廷），但投票也變得比較像兩個面向，一維的估計會讓中國、俄羅斯看起來比較接近美國，解讀要小心。',
        en: "A one-dimensional position estimated from recorded General Assembly votes by Bailey, Strezhnev and Voeten (a dynamic item response theory model), comparable across countries and years; it has no unit. In the authors' terms, higher values mean voting positions closer to the United States and Western democracies, lower values positions closer to the consensus of developing countries. These are estimates; the side panel shows the 90% credible interval. The author cautions that 2024–2025 saw very large shifts: some reflect real changes in position (for example the US and Argentina), but voting has also become more two-dimensional, so in one dimension China and Russia look closer to the US; interpret with care.",
      },
      unit: '',
      file: 'ideal-point.json',
      layer: { kind: 'choropleth', scale: IDEAL_SCALE },
      format: signed,
      formatTick: signedTick,
      compareWorld: true,
    },
    agreement(
      'agree-ref',
      'agree/{item}.json',
      { zh: '與各國的一致度', en: 'Agreement by country' },
      {
        zh: '選一個比較對象，看各國跟它在聯合國大會投相同票的程度。',
        en: 'Pick a country to compare with, and see how often each country voted the same way as it in the General Assembly.',
      },
    ),
  ],
};
