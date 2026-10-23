import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ScaleSpec, Text, TopicDefinition } from './types';

/** 獎項（子項目），代碼跟 pipeline/topics/nobel.py 的 CATEGORIES 一致 */
export type Category = 'physics' | 'chemistry' | 'medicine' | 'literature' | 'peace' | 'economics';

/** label 用在子項目選單與標題；short 用在側欄的清單（經濟學獎不寫括號） */
export const CATEGORIES: { id: Category; label: Text; short?: Text }[] = [
  { id: 'physics', label: { zh: '物理學獎', en: 'Physics' } },
  { id: 'chemistry', label: { zh: '化學獎', en: 'Chemistry' } },
  { id: 'medicine', label: { zh: '生理學或醫學獎', en: 'Physiology or Medicine' } },
  { id: 'literature', label: { zh: '文學獎', en: 'Literature' } },
  { id: 'peace', label: { zh: '和平獎', en: 'Peace' } },
  // 不是諾貝爾遺囑設立的獎：瑞典中央銀行 1968 年設立、1969 年起頒發，由瑞典皇家科學院評選
  {
    id: 'economics',
    label: { zh: '經濟學獎（瑞典央行紀念獎）', en: 'Economic Sciences (Riksbank Prize)' },
    short: { zh: '經濟學獎', en: 'Economic Sciences' },
  },
];

/** 各子項目的第一年（經濟學獎 1969 年起頒發；跟 pipeline 的 START 一致） */
export const FIRST_YEAR = 1901;
export const START: Partial<Record<string, number>> = { economics: 1969 };

const ALL = { id: 'all', label: { zh: '全部獎項', en: 'All' } };

export const laureates = (n: number) =>
  tr({ zh: `${fixed(n, 0)} 位`, en: `${fixed(n, 0)} ${Math.round(n) === 1 ? 'laureate' : 'laureates'}` });

/** 每千萬人：不到 1 的留兩位小數（中國 0.08、台灣 0.43），1 以上留一位 */
const perTenMillion = (v: number) => (v === 0 ? '0' : fixed(v, v < 1 ? 2 : 1));

/**
 * 每千萬人的分級：第一個門檻 0.01 把「沒有得主」（0）跟「有得主」分開（最少的印度、奈及利亞也有 0.04），
 * 圖例上寫成「> 0」。全部獎項最高是聖露西亞（2 位、18 萬人，約 111）、盧森堡、北歐與瑞士（20–30）；
 * 單一獎項的數字約小 5 倍，用另一組門檻。
 */
const ALL_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.01, 1, 3, 5, 10, 20] };
const CATEGORY_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.01, 0.5, 1, 2, 4, 8] };

export const nobel: TopicDefinition = {
  id: 'nobel',
  title: { zh: '諾貝爾獎', en: 'Nobel Prizes' },
  shortTitle: { zh: '諾貝爾獎', en: 'Nobel Prizes' },
  defaultIndicator: 'laureates',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Nobel Prize Outreach，Nobel Prize API 2.1', en: 'Nobel Prize Outreach, Nobel Prize API 2.1' },
      url: 'https://www.nobelprize.org/about/developer-zone-2/',
      license: 'CC0',
    },
    {
      name: { zh: 'Wikidata（得主的中文名稱）', en: 'Wikidata (Chinese names of laureates)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（每千萬人的人口）',
        en: 'United Nations, World Population Prospects 2024 (population for per-capita figures)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '得主依出生地、以今天的國界歸到國家（諾貝爾獎資料的 countryNow），不是國籍：出生在布雷斯勞（今波蘭弗羅茨瓦夫）的玻恩算波蘭，出生在美國的丁肇中算美國、出生在中國大陸的楊振寧算中國，所以德國的人數比依國籍計算的常見數字少，波蘭多；法羅群島、瓜地洛普算在丹麥、法國。28 個組織得主（紅十字國際委員會 3 次、聯合國難民署 2 次等）沒有出生地，不計入各國與世界合計。同一個人得過兩次（居禮夫人、鮑林、巴丁、桑格、夏普萊斯）在「全部獎項」只算一人。拒絕或被迫放棄領獎的沙特、黎德壽、巴斯特納克照樣算。經濟學獎的全名是「瑞典中央銀行紀念諾貝爾經濟科學獎」，1969 年起頒發，不是諾貝爾遺囑設立的獎。中文名稱來自 Wikidata，依序用台灣、繁體、香港的名稱，都沒有時用簡體轉成的繁體或英文原名。',
    en: "Laureates are assigned to countries by place of birth within today's borders (countryNow in the Nobel Prize data), not by nationality: Max Born, born in Breslau (now Wrocław, Poland), counts for Poland; Samuel C. C. Ting, born in the US, for the United States; Chen Ning Yang, born in mainland China, for China. Germany therefore has fewer laureates than the commonly cited figures by nationality, and Poland more; the Faroe Islands and Guadeloupe count for Denmark and France. The 28 organisations awarded (the International Committee of the Red Cross three times and UNHCR twice, among others) have no birthplace and are not counted for any country or in the world total. People who won twice (Marie Curie, Linus Pauling, John Bardeen, Frederick Sanger, K. Barry Sharpless) count once under All. Jean-Paul Sartre, Le Duc Tho and Boris Pasternak, who declined or were forced to decline, are included. The Prize in Economic Sciences is the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel, first awarded in 1969; it was not established by Nobel's will.",
  },
  dimension: {
    label: { zh: '獎項', en: 'Prize' },
    options: [ALL, ...CATEGORIES],
    defaultOption: 'all',
  },
  panelExtra: () => import('./panels/NobelPanel'),
  indicators: [
    {
      id: 'laureates',
      label: { zh: '累計得主人數', en: 'Laureates (cumulative)' },
      description: {
        zh: '在這個國家（以今天的國界）出生的諾貝爾獎得主，從 1901 年累計到這一年。同一個人得過兩次只算一人。圓的面積與人數成正比。',
        en: "Nobel laureates born in the country (within today's borders), cumulative from 1901 to the selected year. A person who won twice counts once. Circle area is proportional to the number of laureates.",
      },
      unit: { zh: '位', en: 'laureates' },
      file: 'laureates/{item}.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 25] },
      format: laureates,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'per-capita',
      label: { zh: '每千萬人得主數', en: 'Laureates per 10 million people' },
      description: {
        zh: '累計得主人數 ÷ 當年人口 × 1,000 萬。人口是聯合國 WPP 2024 的年中人口（2024 年起是推估），從 1950 年開始。人口很少的國家只要一兩位就很高，例如聖露西亞（2 位）、盧森堡（2 位）。',
        en: 'Cumulative laureates ÷ population that year × 10 million. Population is the UN WPP 2024 mid-year estimate (projections from 2024), available from 1950. Countries with small populations rank high with just one or two laureates, such as Saint Lucia (2) and Luxembourg (2).',
      },
      unit: { zh: '位／千萬人', en: 'laureates / 10M people' },
      file: 'per-capita/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: ALL_SCALE,
        itemScales: Object.fromEntries(CATEGORIES.map((c) => [c.id, CATEGORY_SCALE])),
      },
      format: (v) => tr({ zh: `每千萬人 ${perTenMillion(v)} 位`, en: `${perTenMillion(v)} per 10M people` }),
      formatTick: (v) => (v > 0 && v < 0.1 ? '> 0' : fixed(v, v < 1 ? 1 : 0)),
      compareWorld: true,
    },
    {
      id: 'annual',
      label: { zh: '當年得主人數', en: 'Laureates that year' },
      description: {
        zh: '這一年得獎、在這個國家出生的得主人數。拖動時間軸可以看每一年的得主出生在哪裡。',
        en: 'Laureates born in the country who won that year. Drag the time slider to see where each year’s laureates were born.',
      },
      unit: { zh: '位', en: 'laureates' },
      file: 'annual/{item}.json',
      layer: { kind: 'bubble', legendValues: [1, 2, 4] },
      format: laureates,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
