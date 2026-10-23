import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

const MEAT_FISH = { zh: '肉類與水產', en: 'Meat and seafood' };
const DAIRY_EGGS = { zh: '乳品與蛋', en: 'Dairy and eggs' };
const STAPLES = { zh: '穀物、薯類與豆類', en: 'Cereals, roots and pulses' };
const PRODUCE = { zh: '蔬菜水果', en: 'Fruit and vegetables' };
const OTHER = { zh: '糖、油與酒', en: 'Sugar, oils and alcohol' };

/**
 * 地圖上可選的食物（與 pipeline/topics/diet.py 的 FOODS 對應）。
 * 各類食物的人均供給量差好幾倍（蛋最多 25 公斤、乳品超過 500 公斤），所以分級門檻各自訂（thresholds），所有年份共用。
 */
const FOODS: { id: string; label: Text; group: Text; thresholds: number[] }[] = [
  { id: 'meat', label: { zh: '肉類（合計）', en: 'Meat (total)' }, group: MEAT_FISH, thresholds: [10, 20, 40, 60, 80, 100] },
  { id: 'beef', label: { zh: '牛肉（含水牛）', en: 'Beef (incl. buffalo)' }, group: MEAT_FISH, thresholds: [2, 5, 10, 15, 20, 30] },
  { id: 'pork', label: { zh: '豬肉', en: 'Pork' }, group: MEAT_FISH, thresholds: [1, 5, 10, 20, 30, 40] },
  { id: 'poultry', label: { zh: '禽肉', en: 'Poultry' }, group: MEAT_FISH, thresholds: [5, 10, 20, 30, 40, 50] },
  { id: 'fish', label: { zh: '魚類與海鮮', en: 'Fish and seafood' }, group: MEAT_FISH, thresholds: [5, 10, 15, 20, 30, 50] },
  { id: 'milk', label: { zh: '乳品（生乳當量）', en: 'Dairy (milk equivalent)' }, group: DAIRY_EGGS, thresholds: [25, 50, 100, 150, 200, 300] },
  { id: 'eggs', label: { zh: '蛋類', en: 'Eggs' }, group: DAIRY_EGGS, thresholds: [2, 4, 7, 10, 13, 16] },
  { id: 'cereals', label: { zh: '穀物（合計）', en: 'Cereals (total)' }, group: STAPLES, thresholds: [80, 100, 120, 140, 160, 180] },
  { id: 'rice', label: { zh: '稻米（白米當量）', en: 'Rice (milled equivalent)' }, group: STAPLES, thresholds: [5, 10, 25, 50, 75, 100] },
  { id: 'wheat', label: { zh: '小麥', en: 'Wheat' }, group: STAPLES, thresholds: [20, 40, 60, 80, 100, 130] },
  { id: 'maize', label: { zh: '玉米', en: 'Maize' }, group: STAPLES, thresholds: [2, 5, 10, 25, 50, 100] },
  { id: 'roots', label: { zh: '薯類', en: 'Starchy roots' }, group: STAPLES, thresholds: [25, 50, 75, 100, 150, 250] },
  { id: 'pulses', label: { zh: '乾豆類', en: 'Pulses' }, group: STAPLES, thresholds: [2, 4, 6, 8, 12, 20] },
  { id: 'vegetables', label: { zh: '蔬菜', en: 'Vegetables' }, group: PRODUCE, thresholds: [25, 50, 75, 100, 150, 200] },
  { id: 'fruit', label: { zh: '水果', en: 'Fruit' }, group: PRODUCE, thresholds: [25, 50, 75, 100, 125, 150] },
  { id: 'sugar', label: { zh: '糖與甜味劑', en: 'Sugar and sweeteners' }, group: OTHER, thresholds: [10, 20, 30, 40, 50, 60] },
  { id: 'vegetable-oils', label: { zh: '植物油', en: 'Vegetable oils' }, group: OTHER, thresholds: [5, 8, 11, 14, 17, 20] },
  { id: 'alcohol', label: { zh: '酒類', en: 'Alcoholic beverages' }, group: OTHER, thresholds: [5, 15, 30, 50, 75, 100] },
];

const KCAL = { zh: '大卡/人/日', en: 'kcal/person/day' };
const GRAMS = { zh: '公克/人/日', en: 'g/person/day' };
const KG = { zh: '公斤/人/年', en: 'kg/person/year' };
const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });

function grams(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: GRAMS,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: sequential(thresholds) },
    format: (v) => `${fixed(v, 1)} ${tr(GRAMS)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const diet: TopicDefinition = {
  id: 'diet',
  title: { zh: '各國飲食', en: 'Diet by country' },
  shortTitle: { zh: '飲食', en: 'Diet' },
  defaultIndicator: 'energy',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'FAO, FAOSTAT（糧食平衡表、糧食安全指標）',
        en: 'FAO, FAOSTAT (Food Balance Sheets, Suite of Food Security Indicators)',
      },
      url: 'https://www.fao.org/faostat/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '農業部《糧食供需年報》（台灣的對照數字）', en: 'Ministry of Agriculture (Taiwan), food balance sheet (for comparison)' },
      url: 'https://www.moa.gov.tw/ws.php?id=7256',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '糧食平衡表算的是「供給」：國內生產加進口、減出口與飼料、種子、加工、損耗等用途後，平均每人可以吃到的量，比實際吃下去的多（不含家戶與餐廳的浪費）。FAO 在 2010 年改用新方法，2009 年以前是舊版，個別國家與食物在 2010 年可能跳一下（側欄的垂直虛線）。新版沒有日本等少數國家。台灣的資料是 FAO 的，側欄附上農業部糧食供需年報的數字對照。',
    en: "Food balance sheets measure supply: domestic production plus imports, minus exports and non-food uses such as feed, seed, processing and losses, averaged per person. This is more than people actually eat, as household and restaurant waste is not subtracted. FAO switched to a new method in 2010; earlier years come from the old series, so some countries and foods jump in 2010 (the vertical dashed line in the side panel). A few countries, including Japan, are missing from the new series. Taiwan's figures are FAO's; the side panel adds the Ministry of Agriculture's own food balance sheet for comparison.",
  },
  dimension: {
    label: { zh: '食物', en: 'Food' },
    options: FOODS.map(({ id, label, group }) => ({ id, label, group })),
    defaultOption: 'meat',
  },
  panelExtra: () => import('./panels/DietPanel'),
  indicators: [
    {
      id: 'energy',
      label: { zh: '熱量供給', en: 'Dietary energy supply' },
      description: {
        zh: '平均每人每天可以從食物得到的熱量（大卡），含酒類。一般成人每天大約需要 2,000–2,500 大卡。',
        en: 'Food calories available per person per day (kcal), including alcoholic beverages. An adult typically needs about 2,000–2,500 kcal a day.',
      },
      unit: KCAL,
      file: 'energy.json',
      layer: { kind: 'choropleth', scale: sequential([2000, 2300, 2600, 2900, 3200, 3500]) },
      format: (v) => `${fixed(v, 0)} ${tr(KCAL)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    grams(
      'protein',
      { zh: '蛋白質供給', en: 'Protein supply' },
      {
        zh: '平均每人每天可以從食物得到的蛋白質（公克），含植物性與動物性。',
        en: 'Protein available per person per day (grams), from plant and animal foods.',
      },
      [50, 60, 75, 90, 105, 120],
    ),
    grams(
      'fat',
      { zh: '脂肪供給', en: 'Fat supply' },
      {
        zh: '平均每人每天可以從食物得到的脂肪（公克），含食用油、肉類與乳品裡的脂肪。',
        en: 'Fat available per person per day (grams), including cooking oils and the fat in meat and dairy.',
      },
      [30, 50, 70, 90, 110, 130],
    ),
    {
      id: 'animal-share',
      label: { zh: '動物性食物占熱量', en: 'Calories from animal products' },
      description: {
        zh: '熱量裡來自肉類、水產、蛋、乳品與動物油脂的比例。',
        en: 'Share of calories that comes from meat, seafood, eggs, dairy and animal fats.',
      },
      unit: '%',
      file: 'animal-share.json',
      layer: { kind: 'choropleth', scale: sequential([5, 10, 15, 20, 25, 30]) },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'supply',
      label: { zh: '人均供給量', en: 'Supply per person' },
      description: {
        zh: '平均每人每年可以吃到的量（公斤）。肉類是屠體重量（含骨），乳品換算成生乳。2010 年 FAO 改方法，乳品、蔬菜、植物油等在部分國家前後差很多。',
        en: 'Quantity available per person per year (kg). Meat is carcass weight (bone-in) and dairy is converted to milk equivalent. FAO changed its method in 2010, and dairy, vegetables, vegetable oils and some other foods jump noticeably in some countries.',
      },
      unit: KG,
      file: 'supply/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: sequential(FOODS[0].thresholds),
        itemScales: Object.fromEntries(FOODS.map((f) => [f.id, sequential(f.thresholds)])),
      },
      format: (v) => `${fixed(v, v < 100 ? 1 : 0)} ${tr(KG)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'undernourishment',
      label: { zh: '營養不足人口比例', en: 'Prevalence of undernourishment' },
      description: {
        zh: '平時吃不到足夠熱量、無法維持正常活動的人口比例。FAO 依熱量供給與分配推估，三年平均，標在中間那一年；低於 2.5% 只公布「< 2.5%」。',
        en: 'Share of the population whose usual food intake does not provide enough energy for a normal, active life. FAO models it from food supply and its distribution, as a three-year average shown at the middle year; values below 2.5% are only reported as “< 2.5%”.',
      },
      unit: '%',
      file: 'undernourishment.json',
      layer: { kind: 'choropleth', scale: sequential([2.5, 5, 10, 15, 25, 35]) },
      // FAO 只公布「<2.5」的國家在資料裡記成 0
      format: (v) => (v < 2.5 ? '< 2.5%' : `${fixed(v, 1)}%`),
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
  ],
};
