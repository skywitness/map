import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { CategoryDef } from './types';

/**
 * 語言的擴充：學校裡學哪些外語（2026-11-06，製作手冊第二十四批 422；pipeline/topics/language_school.py）。
 * Eurostat 的國中（ISCED 2）學生學各種外語的比例與高中生平均學幾種外語，只有歐洲，台灣沒有。
 */

/** 英語以外最多人學的外語（pipeline 的 LANGS 代碼） */
const SCHOOL_LANGUAGES: CategoryDef[] = [
  { value: 1, label: { zh: '法語', en: 'French' } },
  { value: 2, label: { zh: '德語', en: 'German' } },
  { value: 3, label: { zh: '西班牙語', en: 'Spanish' } },
  { value: 4, label: { zh: '俄語', en: 'Russian' } },
  { value: 5, label: { zh: '義大利語', en: 'Italian' } },
  { value: 6, label: { zh: '瑞典語', en: 'Swedish' } },
  { value: 7, label: { zh: '丹麥語', en: 'Danish' } },
];
/** 其他語言（荷蘭語 8、其他 9；2012–2024 年都還沒出現過，類別色最多 8 類，歸「其他」） */
const OTHER_LANGUAGE = { zh: '其他語言', en: 'Other languages' };

export const languageSchoolPart: TopicPart = {
  name: { zh: '學校裡學哪些外語', en: 'Foreign languages at school' },
  sources: [
    {
      name: {
        zh: 'Eurostat 各教育階段學各種外語的學生（educ_uoe_lang01）、平均學幾種外語（educ_uoe_lang03）',
        en: 'Eurostat pupils by modern foreign language studied (educ_uoe_lang01) and average number of languages (educ_uoe_lang03)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/educ_uoe_lang01/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'Eurostat 的學校外語統計只有歐洲約 40 國（英國、科索沃依 Eurostat 的再利用規定不畫）。比例是各語言分開算，一個學生學兩種會各算一次，加起來會超過 100%。預設看國中（ISCED 2）：高中混了普通科與技職，技職學外語的比例低很多。芬蘭的瑞典語、比利時的法語與荷蘭語是本國語言，Eurostat 也算在「外語」裡，照資料畫。台灣沒有可比的開放資料。',
    en: 'Eurostat’s school language statistics cover about 40 European countries only (the UK and Kosovo are not shown under Eurostat’s reuse rules). Each language is counted separately, so a pupil learning two counts twice and shares add up to more than 100%. The default is lower secondary (ISCED 2): upper secondary mixes general and vocational tracks, and vocational pupils study far fewer languages. Swedish in Finland and French and Dutch in Belgium are national languages but counted as foreign by Eurostat; the map follows the data. Taiwan has no comparable open data.',
  },
  indicators: [
    {
      id: 'school-english',
      label: { zh: '國中生學英語的比例', en: 'Pupils learning English' },
      description: {
        zh: '國中（ISCED 2）學生裡學英語的比例（Eurostat，2012–2024）。2024 年 32 國裡幾乎都超過 95%：瑞典、斯洛維尼亞、北馬其頓、丹麥 100%，羅馬尼亞 99.8%；匈牙利 78.6%、烏克蘭 74.5%、比利時 69.7%、盧森堡 59.4% 較低。愛爾蘭的英語是本國語言，不畫。',
        en: 'Share of lower-secondary (ISCED 2) pupils learning English (Eurostat, 2012–2024). In 2024 nearly all 32 countries exceeded 95%: Sweden, Slovenia, North Macedonia and Denmark 100%, Romania 99.8%; Hungary 78.6%, Ukraine 74.5%, Belgium 69.7% and Luxembourg 59.4% were lower. English is a national language in Ireland, which is not shown.',
      },
      unit: '%',
      file: 'school-english.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [70, 80, 90, 95, 98, 99.5] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'school-top-language',
      label: { zh: '英語以外最多人學的外語', en: 'Most studied language after English' },
      description: {
        zh: '國中生學最多的外語，不算英語（Eurostat，2012–2024）。2024 年法語 13 國最多（義大利 57.6%、羅馬尼亞 79.9%、葡萄牙、西班牙；愛爾蘭英語是本國語言，最多人學的是法語 40.4%），德語 11 國（丹麥 74.9%、波蘭、捷克、匈牙利、巴爾幹），俄語 4 國（愛沙尼亞、拉脫維亞、立陶宛、保加利亞），西班牙語 3 國（法國 56.6%、瑞典、挪威），芬蘭是瑞典語，馬爾他是義大利語。滑過國家看前幾名的比例。',
        en: 'The foreign language most studied by lower-secondary pupils after English (Eurostat, 2012–2024). In 2024 French led in 13 countries (Italy 57.6%, Romania 79.9%, Portugal, Spain; in Ireland, where English is national, French is top at 40.4%), German in 11 (Denmark 74.9%, Poland, Czechia, Hungary, the Balkans), Russian in 4 (Estonia, Latvia, Lithuania, Bulgaria), Spanish in 3 (France 56.6%, Sweden, Norway), Swedish in Finland and Italian in Malta. Hover over a country for the top shares.',
      },
      unit: '',
      file: 'school-top-language.json',
      layer: { kind: 'categorical', categories: SCHOOL_LANGUAGES, other: OTHER_LANGUAGE },
      format: (v) => tr(SCHOOL_LANGUAGES.find((c) => c.value === v)?.label ?? OTHER_LANGUAGE),
      defaultYear: 2024,
    },
    {
      id: 'school-languages-per-pupil',
      label: { zh: '高中生平均學幾種外語', en: 'Languages per upper-secondary pupil' },
      description: {
        zh: '高中（ISCED 3，含技職）每個學生平均學幾種外語（Eurostat，2012–2025）。2024 年盧森堡 2.2 種最多，羅馬尼亞、芬蘭 2.0，波蘭、法國、賽普勒斯、比利時 1.8；德國、西班牙 1.0，葡萄牙、丹麥 0.8，挪威 0.6 最少。',
        en: 'Average number of foreign languages per upper-secondary (ISCED 3, incl. vocational) pupil (Eurostat, 2012–2025). In 2024 Luxembourg led with 2.2, then Romania and Finland 2.0, and Poland, France, Cyprus and Belgium 1.8; Germany and Spain 1.0, Portugal and Denmark 0.8, and Norway 0.6 were lowest.',
      },
      unit: { zh: '種', en: 'languages' },
      file: 'school-languages-per-pupil.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.8, 1, 1.2, 1.5, 1.8, 2] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 種`, en: `${fixed(v, 1)} languages` }),
      formatTick: (v) => fixed(v, 1),
      defaultYear: 2024,
    },
    {
      id: 'school-learners',
      label: { zh: '學中文、日語的高中生', en: 'Pupils learning Chinese or Japanese' },
      description: {
        zh: '高中（ISCED 3）學中文或日語的學生人數（Eurostat，比例圓；子項目切換語言）。比例都很低，多半不到 1%，所以畫人數。中文：2024 年法國 22,604 人（1.0%）、義大利 17,447 人最多，土耳其 1,285、丹麥 1,202（2025）；日語：法國 4,371 人最多，芬蘭 1,181（2025）、義大利 661。德國、西班牙這類大國的人數很少，各國把中文、日語排進正式課程的程度差很多。',
        en: 'Upper-secondary (ISCED 3) pupils learning Chinese or Japanese (Eurostat; bubbles, switch the language). Shares are tiny, mostly under 1%, so the map shows numbers. Chinese: France had the most with 22,604 in 2024 (1.0%), then Italy 17,447, Türkiye 1,285 and Denmark 1,202 (2025); Japanese: France 4,371, Finland 1,181 (2025) and Italy 661. Large countries such as Germany and Spain have very few, as schools differ widely in whether they offer these languages.',
      },
      unit: { zh: '人', en: 'pupils' },
      file: 'school-learners-{item}.json',
      dimension: {
        label: { zh: '語言', en: 'Language' },
        options: [
          { id: 'chinese', label: { zh: '中文', en: 'Chinese' } },
          { id: 'japanese', label: { zh: '日語', en: 'Japanese' } },
        ],
        defaultOption: 'chinese',
      },
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} pupils` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2024,
    },
  ],
};
