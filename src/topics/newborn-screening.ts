import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 新生兒篩檢（2026-11-03，製作手冊第十九批 288；pipeline/topics/newborn_screening.py）：
 * Therrell 等 2024《Int J Neonatal Screening》的七張表（各國篩哪些病、哪一年開始），CC BY 4.0。
 * 篩檢的疾病數是 30 種常見疾病裡「國家計畫、涵蓋過半」的；側欄列出 30 種的狀態。
 * 台灣另有國健署 1984–2024 年的歷年成果（側欄的 taiwan.json，政府資料開放授權條款第 1 版）。
 */

/** 蠶豆症（G6PD 缺乏）的篩檢：有強弱之分（試辦 → 部分 → 全面），沒有篩的用中性色 */
const G6PD: CategoryDef[] = [
  { value: 0, label: { zh: '沒有篩', en: 'Not screened' }, color: MAP_TOKENS.categoricalOther },
  { value: 1, label: { zh: '只有試辦或少數醫院', en: 'Pilot or a few hospitals only' } },
  { value: 2, label: { zh: '國家計畫，涵蓋不到一半', en: 'National programme, under half covered' } },
  { value: 3, label: { zh: '國家計畫，涵蓋過半', en: 'National programme, over half covered' } },
];

const SOURCE_NOTE = {
  zh: '依 Therrell 等 2024〈Current Status of Newborn Bloodspot Screening Worldwide 2024〉（International Journal of Neonatal Screening）的表，資料大約是 2023–2024 年；美國依各州、加拿大依各省的出生數加權（篩這種病的州、省出生數過半才算全國有篩）。',
  en: 'From the tables in Therrell et al. 2024, “Current Status of Newborn Bloodspot Screening Worldwide 2024” (International Journal of Neonatal Screening), roughly as of 2023–2024; the US and Canada are weighted by births in each state or province (a condition counts nationally when states or provinces with over half the births screen for it).',
};

export const newbornScreening: TopicDefinition = {
  id: 'newborn-screening',
  title: { zh: '各國的新生兒篩檢', en: 'Newborn screening by country' },
  shortTitle: { zh: '新生兒篩檢', en: 'Newborn screening' },
  defaultIndicator: 'diseases',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Therrell 等 2024〈Current Status of Newborn Bloodspot Screening Worldwide 2024〉，International Journal of Neonatal Screening 10(2):38',
        en: 'Therrell et al. 2024, “Current Status of Newborn Bloodspot Screening Worldwide 2024”, International Journal of Neonatal Screening 10(2):38',
      },
      url: 'https://doi.org/10.3390/ijns10020038',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '衛生福利部國民健康署「新生兒先天性代謝異常疾病篩檢歷年成果表」（台灣，1984–2024 年）',
        en: 'Health Promotion Administration, Ministry of Health and Welfare, newborn screening results (Taiwan, 1984–2024)',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4083&pid=401',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: `${SOURCE_NOTE.zh}論文的表依地區用 ●（國家計畫或法規、涵蓋一半以上）、🞇（涵蓋不到一半）、§ 或 †（試辦、只有部分醫院）標示，這裡歸成四級；「篩檢的疾病數」只數 30 種常見疾病裡涵蓋過半的，表上「其他」欄的疾病不算（側欄有原文）。撒哈拉以南非洲的表只列了 5 種病，也沒有開始年份；歐洲以外有些國家表上寫「沒有資料」，畫成無資料。開始年份是表上第一次開始篩檢的年份（有的是試辦），時間軸播放時看得到各國陸續開辦。點台灣，側欄另有國健署 1984 年以來的歷年成果：篩檢率、每千名的異常個案與 21 種疾病的個案數。`,
    en: `${SOURCE_NOTE.en} The paper’s regional tables mark each condition ● (national plan or law, over half covered), 🞇 (under half covered) or § / † (pilot or a few hospitals only), grouped here into four levels; “conditions screened” counts only the 30 common conditions covered for over half of newborns, not the “other” column (shown in the original wording in the side panel). The sub-Saharan Africa table lists only five conditions and no start years; countries marked “no information” are shown as no data. The start year is the first year screening began (sometimes as a pilot); play the time slider to watch countries start one by one. Select Taiwan for the Health Promotion Administration’s results since 1984: coverage, abnormal cases per 1,000 and case counts for 21 conditions.`,
  },
  panelExtra: () => import('./panels/NewbornScreeningPanel'),
  indicators: [
    {
      id: 'diseases',
      label: { zh: '篩檢的疾病數', en: 'Conditions screened' },
      description: {
        zh: '新生兒腳跟採血篩檢的 30 種常見疾病裡，國家計畫篩、涵蓋一半以上新生兒的有幾種。台灣 28 種（1981 年開始，3 個篩檢實驗室）、新加坡 28、美國 29、菲律賓 26、德國 21、日本 19（不篩蠶豆症）、英國 9；中國全國都篩的只有 4 種，其餘 20 多種只在部分省市。點國家看篩哪些病。',
        en: 'How many of 30 common conditions are screened by a national programme covering over half of newborns, from a heel-prick blood spot. Taiwan 28 (since 1981, three screening laboratories), Singapore 28, the US 29, the Philippines 26, Germany 21, Japan 19 (not G6PD deficiency), the UK 9; China screens only 4 nationwide, with more than 20 others in some provinces and cities. Select a country to see which conditions.',
      },
      unit: { zh: '種', en: 'conditions' },
      file: 'diseases.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 25] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} conditions` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
    {
      id: 'start',
      label: { zh: '開始篩檢的年份', en: 'Year screening began' },
      description: {
        zh: '第一次開始新生兒篩檢（有的是試辦）的年份；拉時間軸或播放，看各國陸續開辦。美國 1962 年（德拉瓦、佛蒙特兩州開始規定全面篩檢；美國的表寫的是各州規定全面篩檢的年份），歐洲多在 1960、70 年代，台灣、中國 1981 年，菲律賓 1996 年。',
        en: 'The year newborn screening first began (sometimes as a pilot); drag or play the time slider to watch countries start one by one. The US in 1962 (Delaware and Vermont first required universal screening; the US table gives the year each state required it), most of Europe in the 1960s and 70s, Taiwan and China in 1981, the Philippines in 1996.',
      },
      unit: { zh: '年', en: '' },
      file: 'start.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1970, 1980, 1990, 2000, 2010] } },
      format: (v) => tr({ zh: `${v} 年開始`, en: `Since ${v}` }),
      formatTick: (v) => String(v),
      integer: true,
      unranked: true,
      missing: { zh: '還沒開始，或表上沒有年份', en: 'Not yet started, or no year in the table' },
    },
    {
      id: 'g6pd',
      label: { zh: '有沒有篩蠶豆症', en: 'G6PD deficiency screening' },
      description: {
        zh: '蠶豆症（G6PD 缺乏症）的新生兒篩檢。台灣、中國、香港、澳門、新加坡、菲律賓、馬來西亞全面篩；日本、韓國、歐洲多半不篩（帶因率低）。蠶豆症是台灣新生兒篩檢最常見的異常：國健署的成果表 2024 年 2,958 例，每千名篩檢 22.0 例。各國的帶因率見「紅血球的遺傳性狀」主題。',
        en: 'Newborn screening for G6PD deficiency. Taiwan, China, Hong Kong, Macau, Singapore, the Philippines and Malaysia screen all newborns; Japan, South Korea and most of Europe do not (the deficiency is rare there). It is the most common abnormal finding in Taiwan’s newborn screening: 2,958 cases in 2024, 22.0 per 1,000 screened, according to the Health Promotion Administration; see the “Inherited red blood cell traits” topic for how common it is.',
      },
      unit: '',
      file: 'g6pd.json',
      layer: { kind: 'categorical', categories: G6PD, ordinal: true },
      format: (v) => tr(G6PD.find((c) => c.value === v)?.label ?? G6PD[0].label),
      unranked: true,
    },
  ],
};
