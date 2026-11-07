import { tr } from '../i18n/lang';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 各國氣候目標與政策的評等（新主題，2026-11-07，製作手冊第二十五批 480，候選 1139；環境的新小類「碳與氣候政策」）：
 * Climate Action Tracker 的整體評等與分項評等（pipeline/topics/climate_action.py），只准非商業使用、要署名。
 * 40 個經濟體（歐盟算一個，畫在德國以外的 26 個成員國），評等是 CAT 的判斷，不是官方數字
 */
/** 整體與三個分項的 5 級（代碼見 pipeline 的 RATING），最差的最深 */
export const RATINGS: CategoryDef[] = [
  { value: 1, label: { zh: '極度不足（4°C 以上）', en: 'Critically insufficient (>4°C)' } },
  { value: 2, label: { zh: '嚴重不足（3–4°C）', en: 'Highly insufficient (3–4°C)' } },
  { value: 3, label: { zh: '不足（2–3°C）', en: 'Insufficient (2–3°C)' } },
  { value: 4, label: { zh: '幾乎足夠（低於 2°C）', en: 'Almost sufficient (<2°C)' } },
  { value: 5, label: { zh: '跟 1.5°C 相容', en: '1.5°C compatible' } },
];
/** 淨零目標的完整性 */
export const NET_ZERO: CategoryDef[] = [
  { value: -1, label: { zh: '沒有淨零目標', en: 'No net zero target' } },
  { value: 0, label: { zh: '資訊不完整', en: 'Information incomplete' } },
  { value: 1, label: { zh: '差', en: 'Poor' } },
  { value: 2, label: { zh: '一般', en: 'Average' } },
  { value: 3, label: { zh: '可以接受', en: 'Acceptable' } },
];
const label = (list: CategoryDef[]) => (code: number) => {
  const c = list.find((x) => x.value === code);
  return c ? tr(c.label) : String(code);
};

export const climateAction: TopicDefinition = {
  id: 'climate-action',
  title: { zh: '各國的氣候目標夠不夠', en: 'Are climate targets enough?' },
  shortTitle: { zh: '氣候政策評等', en: 'Climate ratings' },
  defaultIndicator: 'overall',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Climate Action Tracker（Climate Analytics、NewClimate Institute）：Country ratings',
        en: 'Climate Action Tracker (Climate Analytics, NewClimate Institute): Country ratings',
      },
      url: 'https://climateactiontracker.org/cat-data-explorer/country-ratings/',
      license: {
        zh: '© Climate Analytics 與 NewClimate Institute，只准非商業使用',
        en: '© Climate Analytics and NewClimate Institute; non-commercial use only',
      },
    },
  ],
  note: {
    zh: 'Climate Action Tracker（CAT）是 Climate Analytics 與 NewClimate Institute 兩個研究機構的計畫，評 40 個排放大國與代表性國家（歐盟算一個，地圖上畫在德國以外的 26 個成員國，德國另外評）；評等是 CAT 依自己的方法學判斷，不是聯合國或各國政府的官方數字，各國的評等日期不同（滑過看日期）。整體評等綜合政策與行動、2030 年目標（NDC，對照國內減碳路徑與公平份額）與已開發國家的氣候資金；括號裡的溫度是「全世界都照這個力度」到 2100 年的升溫。只准非商業使用，必須標示 © Climate Analytics 與 NewClimate Institute。台灣不是聯合國氣候變化綱要公約的締約方，CAT 不評；《氣候變遷因應法》第 4 條訂 2050 年淨零排放。',
    en: 'The Climate Action Tracker (CAT) is a project of two research organisations, Climate Analytics and NewClimate Institute, rating 40 major emitters and representative countries (the EU counts as one and is shown on its 26 member states other than Germany, which is rated separately). Ratings are CAT’s own judgements under its methodology, not official UN or government figures, and were updated at different times (hover for the date). The overall rating combines policies and action, the 2030 target (NDC, against modelled domestic pathways and against a fair share) and, for developed countries, climate finance; the temperatures in brackets are the warming by 2100 if every country made a similar effort. Non-commercial use only, with the notice © Climate Analytics and NewClimate Institute. Taiwan is not a party to the UN climate convention and is not rated; its Climate Change Response Act (Article 4) sets net zero by 2050.',
  },
  panelExtra: () => import('./panels/ClimateActionPanel'),
  indicators: [
    {
      id: 'overall',
      label: { zh: '整體評等', en: 'Overall rating' },
      description: { zh: 'Climate Action Tracker 的整體評等：如果全世界都照這一國的政策與目標，2100 年會暖化幾度。2026 年 10 月的版本 40 個經濟體裡沒有一個「跟 1.5°C 相容」；幾乎足夠 11 個（挪威、肯亞、菲律賓、衣索比亞、智利、哥斯大黎加等）、不足 12 個（歐盟、德國、日本、南韓、英國、澳洲、瑞士等）、嚴重不足 9 個（中國、印度、巴西、加拿大、阿根廷、墨西哥等）、極度不足 8 個（美國、俄羅斯、印尼、沙烏地阿拉伯、土耳其、越南、伊朗、泰國）。地圖大半空白：CAT 只評這 40 個。', en: 'The Climate Action Tracker’s overall rating: how much the world would warm by 2100 if every country followed this one’s policies and targets. In the October 2026 version none of the 40 economies is “1.5°C compatible”; 11 are almost sufficient (Norway, Kenya, the Philippines, Ethiopia, Chile, Costa Rica and others), 12 insufficient (the EU, Germany, Japan, South Korea, the UK, Australia, Switzerland and others), 9 highly insufficient (China, India, Brazil, Canada, Argentina, Mexico and others) and 8 critically insufficient (the US, Russia, Indonesia, Saudi Arabia, Turkey, Viet Nam, Iran and Thailand). Most of the map is blank because CAT rates only these 40.' },
      unit: '',
      file: 'overall.json',
      layer: { kind: 'categorical', ordinal: true, categories: RATINGS },
      format: label(RATINGS),
      missing: { zh: 'CAT 沒有評', en: 'Not rated by CAT' },
    },
    {
      id: 'sub',
      label: { zh: '分項評等', en: 'Rating by component' },
      description: { zh: '整體評等底下的分項：政策與行動（現行政策會走到哪裡）、2030 年目標分別對照國內減碳路徑與「公平份額」（依責任與能力該分擔多少）、已開發國家給的氣候資金，以及淨零目標寫得完不完整（範圍、法律地位、檢討機制等）。例如德國的政策與國內路徑都是幾乎足夠，對照公平份額卻是不足；肯亞的政策與公平份額都跟 1.5°C 相容；美國除了政策是嚴重不足，其他都是極度不足、沒有淨零目標。氣候資金只評要出錢的已開發國家。', en: 'The components behind the overall rating: policies and action (where current policies lead), the 2030 target against modelled domestic pathways and against a “fair share” (based on responsibility and capability), climate finance from developed countries, and how complete the net zero target is (scope, legal status, review and so on). Germany, for example, is almost sufficient on policies and on its domestic pathway but insufficient against its fair share; Kenya’s policies and fair share are 1.5°C compatible; the US is critically insufficient on everything except policies (highly insufficient) and has no net zero target. Climate finance is rated only for developed countries expected to pay.' },
      unit: '',
      file: 'sub/{item}.json',
      dimension: {
        label: { zh: '分項', en: 'Component' },
        options: [
          { id: 'policies', label: { zh: '政策與行動', en: 'Policies and action' } },
          { id: 'domestic', label: { zh: '2030 年目標（對照國內減碳路徑）', en: 'NDC target vs domestic pathways' } },
          { id: 'fairshare', label: { zh: '2030 年目標（對照公平份額）', en: 'NDC target vs fair share' } },
          { id: 'finance', label: { zh: '氣候資金', en: 'Climate finance' } },
          { id: 'netzero', label: { zh: '淨零目標的完整性', en: 'Net zero target' } },
        ],
        defaultOption: 'policies',
      },
      layer: { kind: 'categorical', ordinal: true, categories: RATINGS, itemCategories: { netzero: NET_ZERO } },
      itemFormats: { netzero: { unit: '', format: label(NET_ZERO) } },
      format: label(RATINGS),
      missing: { zh: 'CAT 沒有評', en: 'Not rated by CAT' },
    },
  ],
};
