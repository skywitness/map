import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, ScaleSpec, TopicDefinition } from './types';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const LITRES = { zh: '公升純酒精', en: 'litres of pure alcohol' };
const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
// 全部、男性、女性的吸菸率共用同一組門檻，才能互相比較
const SMOKING_SCALE: ScaleSpec = { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] };

/**
 * 主要酒類的代碼（pipeline/topics/tobacco_alcohol.py 的 BEVERAGES）。
 * 類別圖依這個順序取 MAP_TOKENS.categorical：烈酒薄荷綠、葡萄酒淡紫、啤酒琥珀、其他綠
 */
export const BEVERAGE_CATEGORIES: CategoryDef[] = [
  { value: 3, label: { zh: '烈酒', en: 'Spirits' } },
  { value: 2, label: { zh: '葡萄酒', en: 'Wine' } },
  { value: 1, label: { zh: '啤酒', en: 'Beer' } },
  { value: 4, label: { zh: '其他酒類', en: 'Other' } },
];
const beverageLabel = new Map(BEVERAGE_CATEGORIES.map((c) => [c.value, c.label]));

export const tobaccoAlcohol: TopicDefinition = {
  id: 'tobacco-alcohol',
  title: { zh: '各國菸酒', en: 'Tobacco and alcohol by country' },
  shortTitle: { zh: '菸酒', en: 'Tobacco' },
  defaultIndicator: 'smoking',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'WHO, Global Health Observatory（菸草使用趨勢估計、全球酒精與健康資訊系統 GISAH）',
        en: 'WHO, Global Health Observatory (tobacco use trend estimates; Global Information System on Alcohol and Health)',
      },
      url: 'https://www.who.int/data/gho',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部國民健康署，國人吸菸行為調查（台灣的吸菸率）', en: 'Health Promotion Administration (Taiwan), Adult Smoking Behavior Survey' },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=1718&pid=9913',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '吸菸率是 WHO 依各國調查做的模型估計（15 歲以上、年齡標準化），2025、2030 年是推估。飲酒量是平均每個 15 歲以上的人一年喝下的純酒精公升數，含沒有登記的自釀、走私酒；主要酒類與酒類組成只算有登記的銷售量。台灣不在 WHO 的資料中：吸菸率改用國健署的調查（18 歲以上，跟 WHO 不完全可比），飲酒量沒有換算成純酒精的官方統計，所以留空。',
    en: "Smoking rates are WHO model estimates based on national surveys (ages 15+, age-standardised); 2025 and 2030 are projections. Alcohol consumption is litres of pure alcohol per person aged 15+ per year, including unrecorded home-made and smuggled drinks; the main beverage and the beverage breakdown count recorded sales only. Taiwan is not in the WHO data: its smoking rates come from the Health Promotion Administration's survey (ages 18+, not fully comparable with WHO's), and there are no official figures for its alcohol consumption in pure alcohol, so it is left blank.",
  },
  panelExtra: () => import('./panels/TobaccoAlcoholPanel'),
  indicators: [
    {
      id: 'smoking',
      label: { zh: '吸菸率', en: 'Smoking rate' },
      description: {
        zh: '15 歲以上的人裡，目前有吸菸（紙菸、雪茄、菸斗等燃燒式菸品，每天或偶爾）的比例，依年齡標準化，不含電子煙與嚼菸。',
        en: 'Share of people aged 15+ who currently smoke tobacco (cigarettes, cigars, pipes and other smoked tobacco, daily or occasionally), age-standardised; e-cigarettes and smokeless tobacco are not included.',
      },
      unit: '%',
      file: 'smoking.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'smoking-male',
      label: { zh: '男性吸菸率', en: 'Smoking rate, men' },
      description: {
        zh: '15 歲以上男性目前吸菸的比例（年齡標準化）。跟女性同一組分級門檻，可以直接比較。',
        en: 'Share of men aged 15+ who currently smoke tobacco (age-standardised), on the same classes as the rate for women.',
      },
      unit: '%',
      file: 'smoking-male.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'smoking-female',
      label: { zh: '女性吸菸率', en: 'Smoking rate, women' },
      description: {
        zh: '15 歲以上女性目前吸菸的比例（年齡標準化）。跟男性同一組分級門檻：東亞、非洲多數國家的女性吸菸率很低，歐洲有些國家男女差不多。',
        en: 'Share of women aged 15+ who currently smoke tobacco (age-standardised), on the same classes as the rate for men: very few women smoke in most of East Asia and Africa, while in parts of Europe the rates for men and women are close.',
      },
      unit: '%',
      file: 'smoking-female.json',
      layer: { kind: 'choropleth', scale: SMOKING_SCALE },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'alcohol',
      label: { zh: '人均飲酒量', en: 'Alcohol consumption' },
      description: {
        zh: '平均每個 15 歲以上的人一年喝下多少公升的純酒精（10 公升約等於每天 1.7 罐 330 毫升、酒精 5% 的啤酒），含沒有登記的自釀、走私酒，扣掉觀光客喝的（SDG 3.5.2）。',
        en: 'Litres of pure alcohol drunk per person aged 15+ in a year (10 litres is about 1.7 cans of 330 ml, 5% beer a day), including unrecorded home-made and smuggled drinks and excluding what tourists drink (SDG 3.5.2).',
      },
      unit: LITRES,
      file: 'alcohol.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 7.5, 10, 12.5] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 公升`, en: `${fixed(v, 1)} litres` }),
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
    {
      id: 'main-beverage',
      label: { zh: '主要酒類', en: 'Main type of drink' },
      description: {
        zh: '有登記的酒類銷售裡，換算成純酒精後最多的一類；「其他酒類」是各地的傳統釀造酒、米酒、蘋果酒等。點國家可以看到各類酒的消費量。',
        en: "The type of drink that accounts for the most pure alcohol in recorded sales; 'other' covers traditional brews, rice wine, cider and so on. Select a country for the breakdown.",
      },
      unit: '',
      file: 'main-beverage.json',
      layer: { kind: 'categorical', categories: BEVERAGE_CATEGORIES },
      format: (v) => tr(beverageLabel.get(v) ?? { zh: '其他', en: 'Other' }),
    },
  ],
};
