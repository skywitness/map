import { tr } from '../i18n/lang';
import type { CategoryDef, IndicatorDef, TopicDefinition } from './types';

/**
 * 旅遊警示：美國、加拿大與台灣各自怎麼看世界（2026-11-06，製作手冊第二十四批 420；pipeline/topics/travel_advisories.py）。
 * 三個政府的現況快照，一國一級。三家的級距定義不同，各自一套圖例；「幾家勸你別去」用各家「重新考慮或避免前往」以上。
 * 次區域的警示（泰國 7 府、緬甸各邦…）寫在 tooltip，不畫。
 * 類別由重到輕排（有序類別圖的第一類最深色）。
 */

const labelOf = (categories: CategoryDef[]) => (v: number) => tr(categories.find((c) => c.value === v)?.label ?? '');

const TAIWAN: CategoryDef[] = [
  { value: 4, label: { zh: '第四級：紅色儘速離境', en: 'Level 4: red (leave as soon as possible)' } },
  { value: 3, label: { zh: '第三級：橙色避免前往', en: 'Level 3: orange (avoid travel)' } },
  { value: 2, label: { zh: '第二級：黃色注意', en: 'Level 2: yellow (caution)' } },
  { value: 1, label: { zh: '第一級：灰色提醒', en: 'Level 1: grey (reminder)' } },
];
const US: CategoryDef[] = [
  { value: 4, label: { zh: '4 級：不要前往（Do Not Travel）', en: 'Level 4: Do Not Travel' } },
  { value: 3, label: { zh: '3 級：重新考慮行程（Reconsider Travel）', en: 'Level 3: Reconsider Travel' } },
  { value: 2, label: { zh: '2 級：提高警覺（Exercise Increased Caution）', en: 'Level 2: Exercise Increased Caution' } },
  { value: 1, label: { zh: '1 級：一般注意（Exercise Normal Precautions）', en: 'Level 1: Exercise Normal Precautions' } },
];
const CANADA: CategoryDef[] = [
  { value: 4, label: { zh: '避免所有旅行（avoid all travel）', en: 'Avoid all travel' } },
  { value: 3, label: { zh: '避免非必要的旅行（avoid non-essential travel）', en: 'Avoid non-essential travel' } },
  { value: 2, label: { zh: '高度警覺（high degree of caution）', en: 'Exercise a high degree of caution' } },
  { value: 1, label: { zh: '一般安全措施（normal security precautions）', en: 'Take normal security precautions' } },
];
const CONSENSUS: CategoryDef[] = [
  { value: 3, label: { zh: '三家都勸你別去', en: 'All three advise against' } },
  { value: 2, label: { zh: '兩家勸你別去', en: 'Two advise against' } },
  { value: 1, label: { zh: '一家勸你別去', en: 'One advises against' } },
  { value: 0, label: { zh: '都沒有勸你別去', en: 'None advise against' } },
];

/** 發布的政府不評自己的國家 */
const SELF = { taiwan: 'TWN', us: 'USA', canada: 'CAN' } as Record<string, string>;
const OWN = { zh: '發布警示的國家自己（不評等）', en: 'The issuing country itself (not rated)' };

const indicator = (id: string, label: IndicatorDef['label'], description: IndicatorDef['description'], categories: CategoryDef[], missing: IndicatorDef['missing']): IndicatorDef => ({
  id,
  label,
  description,
  unit: '',
  file: `${id}.json`,
  layer: { kind: 'categorical', categories, ordinal: true },
  format: labelOf(categories),
  missing,
  ...(SELF[id] && { noValue: { [SELF[id]]: OWN } }),
});

export const travelAdvisories: TopicDefinition = {
  id: 'travel-advisories',
  title: { zh: '旅遊警示：美國、加拿大與台灣怎麼看世界', en: 'Travel advisories: how the US, Canada and Taiwan see the world' },
  shortTitle: { zh: '旅遊警示', en: 'Travel advisories' },
  defaultIndicator: 'taiwan',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: '外交部領事事務局 國外旅遊警示分級表', en: 'Bureau of Consular Affairs (Taiwan), travel warnings' },
      url: 'https://data.gov.tw/dataset/116026',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '大陸委員會 中國大陸及香港、澳門旅遊警示', en: 'Mainland Affairs Council, travel warnings for mainland China, Hong Kong and Macao' },
      url: 'https://data.gov.tw/dataset/42627',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '美國國務院領事事務局 Travel Advisories', en: 'US Department of State, Bureau of Consular Affairs, Travel Advisories' },
      url: 'https://cadataapi.state.gov/api/TravelAdvisories',
      license: { zh: '公有領域（國務院網站的著作權說明）', en: 'Public domain (State Department copyright notice)' },
    },
    {
      name: { zh: '加拿大全球事務部 Country Travel Advice and Advisories', en: 'Global Affairs Canada, Country Travel Advice and Advisories' },
      url: 'https://open.canada.ca/data/en/dataset/bef2ebb3-ca9a-485f-aaff-5dc36eb89426',
      license: { zh: 'Open Government Licence – Canada（含依此授權的資訊）', en: 'Contains information licensed under the Open Government Licence – Canada' },
    },
  ],
  note: {
    zh: '三個政府對各國發布的旅遊警示，2026 年 11 月 6 日下載的現況（每一國滑過去看發布日期；警示隨時會改）。三家的級距定義不同，不能當同一把尺：台灣的第四級「儘速離境」是叫已經在當地的人離開，比美國的 Level 4「Do Not Travel」語氣更強。台灣的外交部名單不含中國大陸、香港、澳門，這三地用陸委會的燈號（2024 年 6 月 27 日起橙色）。外交部對次區域另有警示（泰國東部 7 府第三級、緬甸各邦第四級、美國夏威夷州第二級…），寫在滑過國家的說明，地圖只畫全國那一級；美國對自己、加拿大對自己、台灣對自己都沒有評等。「幾家勸你別去」：美國 Level 3–4、加拿大避免非必要旅行以上、台灣第三級以上算勸你別去，至少兩家有評等的地方才算。美國國務院的資訊是公有領域；加拿大的資料含依 Open Government Licence – Canada 授權的資訊。',
    en: 'Travel advisories issued by three governments, as downloaded on 6 November 2026 (hover over a country for the issue date; advisories change at any time). The three use different scales and cannot be compared like for like: Taiwan’s level 4, “leave as soon as possible”, tells people already there to go, which is stronger than the US Level 4 “Do Not Travel”. Taiwan’s foreign ministry list excludes mainland China, Hong Kong and Macao, which use the Mainland Affairs Council’s alert (orange since 27 June 2024). The ministry also issues regional warnings (eastern Thailand’s seven provinces at level 3, Myanmar’s states at level 4, Hawaii at level 2…), listed in the country tooltip; the map shows only the national level. None of the three rates its own country. “How many advise against travel” counts US Levels 3–4, Canada’s “avoid non-essential travel” and above, and Taiwan’s level 3 and above, for places rated by at least two. US State Department information is in the public domain; the Canadian data contains information licensed under the Open Government Licence – Canada.',
  },
  indicators: [
    indicator(
      'taiwan',
      { zh: '台灣外交部的旅遊警示', en: 'Taiwan’s travel warnings' },
      {
        zh: '外交部領事事務局對各國的旅遊警示（灰、黃、橙、紅四色），2026 年 11 月：第一級 76 個國家與地區、第二級 52、第三級 49、第四級 37；中國大陸、香港、澳門是陸委會的橙色。滑過國家看發布日期與次區域的警示。',
        en: 'Taiwan’s Bureau of Consular Affairs travel warnings (grey, yellow, orange, red), November 2026: 76 countries and territories at level 1, 52 at level 2, 49 at level 3 and 37 at level 4; mainland China, Hong Kong and Macao are orange under the Mainland Affairs Council. Hover over a country for the issue date and regional warnings.',
      },
      TAIWAN,
      { zh: '外交部沒有發布', en: 'No warning issued' },
    ),
    indicator(
      'us',
      { zh: '美國國務院的旅遊警示', en: 'US travel advisories' },
      {
        zh: '美國國務院對各國的旅遊警示（Level 1–4），2026 年 11 月：1 級 83 個、2 級 82、3 級 27、4 級 24；台灣 1 級、日本 1 級、中國 2 級。',
        en: 'US State Department travel advisories (Levels 1–4), November 2026: 83 at Level 1, 82 at Level 2, 27 at Level 3 and 24 at Level 4; Taiwan and Japan are Level 1, China Level 2.',
      },
      US,
      { zh: '美國沒有評等', en: 'Not rated by the US' },
    ),
    indicator(
      'canada',
      { zh: '加拿大的旅遊警示', en: 'Canada’s travel advisories' },
      {
        zh: '加拿大全球事務部對各國的旅遊警示（四級），2026 年 11 月：一般安全措施 102 個、高度警覺 90、避免非必要的旅行 14、避免所有旅行 22；台灣、日本、美國是一般安全措施，中國是高度警覺。',
        en: 'Global Affairs Canada travel advisories (four levels), November 2026: normal precautions for 102, a high degree of caution for 90, avoid non-essential travel for 14 and avoid all travel for 22; Taiwan, Japan and the US are at normal precautions, China at a high degree of caution.',
      },
      CANADA,
      { zh: '加拿大沒有評等', en: 'Not rated by Canada' },
    ),
    indicator(
      'consensus',
      { zh: '幾家勸你別去', en: 'How many advise against travel' },
      {
        zh: '美國、加拿大、台灣三家裡，有幾家把這個地方列為重新考慮或避免前往以上（至少兩家有評等）。三家都勸你別去的有 32 個，包括俄羅斯、烏克蘭、伊朗、伊拉克、敘利亞、北韓、緬甸、委內瑞拉、沙烏地阿拉伯、科威特、阿曼、巴林；都沒有勸的 131 個。各家的級距不同，這裡只看「勸不勸你去」。',
        en: 'How many of the US, Canada and Taiwan rate a place at “reconsider” or “avoid travel” or above (places rated by at least two). All three advise against 32, including Russia, Ukraine, Iran, Iraq, Syria, North Korea, Myanmar, Venezuela, Saudi Arabia, Kuwait, Oman and Bahrain; none advise against 131. The scales differ, so this only counts whether each advises against travel.',
      },
      CONSENSUS,
      { zh: '不到兩家有評等', en: 'Rated by fewer than two' },
    ),
  ],
};
