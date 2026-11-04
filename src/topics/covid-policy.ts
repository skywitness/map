import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, IndicatorDef, TopicDefinition } from './types';

/**
 * 疫情期間的防疫管制（2026-11-04，製作手冊第二十批 313；pipeline/topics/covid_policy.py）：
 * 牛津 OxCGRT（CC BY 4.0）2020–2022 年每 7 天取一天。年份欄位是「2000-01-01 起的第幾天」，timeAxis 換回日期。
 * 分級的代碼：沒有措施 0；第 k 級全國 2k、只在部分地區 2k−1（同一級的顏色加白色斜線）；國際旅行沒有分地區，代碼就是分級。
 */

const EPOCH = Date.UTC(2000, 0, 1);
const DAY = 86_400_000;
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateOf(index: number): Date {
  return new Date(EPOCH + index * DAY);
}

/** 「2020 年 4 月 15 日」「15 Apr 2020」 */
export function dayText(index: number): string {
  const d = dateOf(index);
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  return tr({ zh: `${y} 年 ${m} 月 ${day} 日`, en: `${day} ${MONTHS_EN[m - 1]} ${y}` });
}

/** 時間軸刻度：「2020/4/15」「Apr 2020」 */
function dayShort(index: number): string {
  const d = dateOf(index);
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  return tr({ zh: `${y}/${m}/${day}`, en: `${MONTHS_EN[m - 1]} ${y}` });
}

const DAY_AXIS = { label: { zh: '日期', en: 'Date' }, year: dayText, tick: dayShort };

/** 2020-04-15（第 7410 天）：全球封鎖最多的時候 */
const DEFAULT_DAY = 7410;

/** 中英文都有的文字（Text 也可以只是字串） */
type Bilingual = { zh: string; en: string };

const NONE: Text = { zh: '沒有措施', en: 'No measures' };
const LOCAL: Bilingual = { zh: '部分地區', en: 'some areas' };
const NATIONAL: Bilingual = { zh: '全國', en: 'nationwide' };

/**
 * 分級 → 類別，最嚴的在前（ordinal 的第一類最深）。levels 是第 1 級起的名稱；flagged 時每一級分全國與部分地區
 * （部分地區是全國那一類的顏色加白色斜線，不占色階）
 */
function levels(names: Bilingual[], flagged = true): CategoryDef[] {
  const out: CategoryDef[] = [];
  for (let k = names.length; k >= 1; k--) {
    const name = names[k - 1];
    if (!flagged) {
      out.push({ value: k, label: name });
      continue;
    }
    out.push({ value: 2 * k, label: { zh: `${name.zh}（${NATIONAL.zh}）`, en: `${name.en} (${NATIONAL.en})` } });
    out.push({
      value: 2 * k - 1,
      label: { zh: `${name.zh}（${LOCAL.zh}）`, en: `${name.en} (${LOCAL.en})` },
      hatch: { base: 2 * k, stripes: '#ffffff' },
    });
  }
  out.push({ value: 0, label: NONE });
  return out;
}

function policy(id: string, label: Text, description: Text, names: Bilingual[], flagged = true): IndicatorDef {
  const categories = levels(names, flagged);
  const byValue = new Map(categories.map((c) => [c.value, c.label]));
  return {
    id,
    label,
    description,
    unit: { zh: '級', en: 'level' },
    file: `${id}.json`,
    layer: { kind: 'categorical', ordinal: true, categories },
    format: (v) => {
      const t = byValue.get(v);
      return t ? tr(t) : fixed(v, 0);
    },
    formatTick: (v) => fixed(v, 0),
    timeAxis: DAY_AXIS,
    unranked: true,
  };
}

const LOCAL_NOTE: Bilingual = {
  zh: '有斜線的是只在部分地區（某些城市、州）實施。',
  en: 'Hatched means only in some areas (certain cities or states).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'stringency',
    label: { zh: '管制的嚴格程度', en: 'Stringency index' },
    description: {
      zh: '牛津大學的「嚴格程度指數」（0–100）：把關校、關工作場所、取消活動、限制集會、關閉大眾運輸、居家令、限制境內移動、國際旅行管制與公共宣導九項的分級加起來換算，只在部分地區實施的打折扣。2020 年 4 月中八成的國家在 70 以上；台灣 2020 年都在 32 以下，最高是 2021 年 5 月中到 7 月的 76.8；中國 2022 年一直是 79，到 12 月才降到 50 左右。拉時間軸看管制一週一週的變化。這是政策有多嚴，不是民眾有沒有遵守，也不代表防疫的成效。',
      en: 'The University of Oxford Stringency Index (0–100), combining nine measures: school closures, workplace closures, cancelled events, limits on gatherings, public transport closures, stay-at-home orders, internal movement limits, international travel controls and public information campaigns, with measures in only some areas counting less. In mid-April 2020 four in five countries were above 70. Taiwan stayed below 32 throughout 2020 and peaked at 76.8 from mid-May to July 2021; China stayed at 79 through 2022, dropping to about 50 only in December. Drag the timeline to see the week-by-week changes. It measures how strict policies were, not compliance or effectiveness.',
    },
    unit: '0–100',
    file: 'stringency.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 60, 70, 80] } },
    format: (v) => fixed(v, 1),
    formatTick: (v) => fixed(v, 0),
    timeAxis: DAY_AXIS,
  },
  policy(
    'school',
    { zh: '關閉學校', en: 'School closures' },
    {
      zh: `學校與大學有沒有關閉：建議關閉（或照常上課但大幅改變方式）、規定部分學制關閉（例如只有高中）、規定全部關閉。${LOCAL_NOTE.zh}`,
      en: `Whether schools and universities were closed: recommended (or open with major changes), required for some levels (e.g. only high schools), or required for all levels. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議關閉', en: 'Recommended' },
      { zh: '部分學制關閉', en: 'Some levels closed' },
      { zh: '全部關閉', en: 'All levels closed' },
    ],
  ),
  policy(
    'workplace',
    { zh: '關閉工作場所', en: 'Workplace closures' },
    {
      zh: `工作場所有沒有關閉或改在家上班：建議、規定部分行業、規定民生必需以外全部。${LOCAL_NOTE.zh}`,
      en: `Whether workplaces were closed or moved to working from home: recommended, required for some sectors, or required for all but essential workplaces. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議', en: 'Recommended' },
      { zh: '部分行業', en: 'Some sectors' },
      { zh: '必需以外全部', en: 'All but essential' },
    ],
  ),
  policy(
    'events',
    { zh: '取消公共活動', en: 'Public events cancelled' },
    {
      zh: `公共活動（演唱會、比賽、展覽）有沒有取消：建議取消、規定取消。${LOCAL_NOTE.zh}`,
      en: `Whether public events (concerts, matches, exhibitions) were cancelled: recommended or required. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議取消', en: 'Recommended' },
      { zh: '規定取消', en: 'Required' },
    ],
  ),
  policy(
    'gatherings',
    { zh: '限制集會人數', en: 'Limits on gatherings' },
    {
      zh: `聚會的人數上限：1,000 人以上、101–1,000 人、11–100 人、10 人以下。${LOCAL_NOTE.zh}`,
      en: `The cap on gathering size: above 1,000, 101–1,000, 11–100, or 10 people or fewer. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '超過 1,000 人', en: 'Over 1,000' },
      { zh: '101–1,000 人', en: '101–1,000' },
      { zh: '11–100 人', en: '11–100' },
      { zh: '10 人以下', en: '10 or fewer' },
    ],
  ),
  policy(
    'transport',
    { zh: '關閉大眾運輸', en: 'Public transport closures' },
    {
      zh: `大眾運輸有沒有停駛：建議不搭（或大幅減班）、規定停駛（或禁止大部分人搭乘）。${LOCAL_NOTE.zh}`,
      en: `Whether public transport was shut: recommended against (or heavily reduced) or required closed (or barred to most people). ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '減班或建議不搭', en: 'Reduced or advised against' },
      { zh: '停駛', en: 'Closed' },
    ],
  ),
  policy(
    'stay-home',
    { zh: '居家令', en: 'Stay-at-home orders' },
    {
      zh: `有沒有要求待在家裡：建議不出門、規定不出門但可以運動、買菜與必要外出、規定不出門且幾乎沒有例外（例如一週只能出門一次）。${LOCAL_NOTE.zh}`,
      en: `Whether people were told to stay home: recommended, required with exceptions for exercise, groceries and essential trips, or required with minimal exceptions (e.g. out once a week). ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議不出門', en: 'Recommended' },
      { zh: '必要外出以外不出門', en: 'Essential trips only' },
      { zh: '幾乎不能出門', en: 'Minimal exceptions' },
    ],
  ),
  policy(
    'internal',
    { zh: '限制境內移動', en: 'Internal movement limits' },
    {
      zh: `城市、地區之間能不能移動：建議不要、規定限制。${LOCAL_NOTE.zh}`,
      en: `Whether travel between cities and regions was limited: recommended against or restricted. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議不要', en: 'Recommended against' },
      { zh: '規定限制', en: 'Restricted' },
    ],
  ),
  policy(
    'travel',
    { zh: '國際旅行管制', en: 'International travel controls' },
    {
      zh: '對入境外國旅客的管制：入境篩檢、部分或全部地區來的要隔離、禁止部分地區入境、全面禁止入境（封關）。2021 年起有的國家對接種疫苗的旅客放寬，這裡是對已接種的旅客的規定。台灣在 2020 年 3 月 19 日到 6 月 21 日、2021 年 5 月 19 日到 8 月 31 日是全面禁止入境，2022 年 10 月 13 日起只剩入境篩檢。',
      en: 'Controls on arriving foreign travellers: screening, quarantine for arrivals from some or all regions, bans on arrivals from some regions, or a total border closure. From 2021 some countries eased rules for vaccinated travellers; this shows the rules for vaccinated travellers. Taiwan had a total border closure from 19 March to 21 June 2020 and from 19 May to 31 August 2021, and only screened arrivals from 13 October 2022.',
    },
    [
      { zh: '入境篩檢', en: 'Screening' },
      { zh: '入境隔離', en: 'Quarantine' },
      { zh: '禁止部分地區入境', en: 'Ban on some regions' },
      { zh: '全面禁止入境', en: 'Total border closure' },
    ],
    false,
  ),
  policy(
    'masks',
    { zh: '口罩規定', en: 'Face mask rules' },
    {
      zh: `在家以外要不要戴口罩：建議、規定在某些公共場所（例如大眾運輸）、規定在所有公共場所、出門一律要戴。${LOCAL_NOTE.zh}`,
      en: `Whether masks were required outside the home: recommended, required in some public places (such as public transport), required in all shared public spaces, or required outside the home at all times. ${LOCAL_NOTE.en}`,
    },
    [
      { zh: '建議', en: 'Recommended' },
      { zh: '某些公共場所', en: 'Some public places' },
      { zh: '所有公共場所', en: 'All public places' },
      { zh: '出門一律', en: 'Always outside home' },
    ],
  ),
];

export const covidPolicy: TopicDefinition = {
  id: 'covid-policy',
  title: { zh: '疫情期間的防疫管制', en: 'COVID-19 government restrictions' },
  shortTitle: { zh: '防疫管制', en: 'COVID-19 rules' },
  defaultIndicator: 'stringency',
  defaultYear: DEFAULT_DAY,
  sources: [
    {
      name: {
        zh: 'Oxford COVID-19 Government Response Tracker（OxCGRT），牛津大學 Blavatnik 政府學院；Hale 等 2021，Nature Human Behaviour 5:529–538',
        en: 'Oxford COVID-19 Government Response Tracker (OxCGRT), Blavatnik School of Government, University of Oxford; Hale et al. 2021, Nature Human Behaviour 5:529–538',
      },
      url: 'https://github.com/OxCGRT/covid-policy-dataset',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '牛津大學 OxCGRT 從 2020 年 1 月 1 日到 2022 年 12 月 31 日，每天記錄 185 個國家與地區的防疫政策（已是最終版，之後不再更新），這裡每 7 天取一天、畫那一天的規定。每一項是分級，記的是國內最嚴的規定；只在部分地區（某些城市、州）實施的畫成斜線，不是全國都這樣。2021 年起有些國家對有沒有接種疫苗的人規定不同，這裡用適用多數人的規定（接種率過半後換成已接種者的規定，那一天的分級可能因此改變，政策本身沒有變）。記的是政府規定，不是民眾遵守的程度。',
    en: 'The University of Oxford’s OxCGRT recorded the COVID-19 policies of 185 countries and territories every day from 1 January 2020 to 31 December 2022 (the final release; it is no longer updated). This map samples every seventh day and shows the rules in force that day. Each measure is graded and records the strictest rule anywhere in the country; measures applying only in some areas (certain cities or states) are hatched. From 2021 some countries set different rules for vaccinated and unvaccinated people; this uses the rules for the majority of the population (switching to the vaccinated rules once over half were vaccinated, which can change a grade without any change in policy). It records government rules, not how well people complied.',
  },
  indicators,
};
