import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedLarge, intlDollars, usd } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const CEREALS = { zh: '穀物', en: 'Cereals' };
const CASH_CROPS = { zh: '油料與經濟作物', en: 'Oil and cash crops' };
const PRODUCE = { zh: '蔬菜水果', en: 'Fruit and vegetables' };
const LIVESTOCK = { zh: '畜產品', en: 'Livestock products' };

/** 地圖上可選的農產品（與 pipeline/topics/agriculture.py 的 PRODUCTS 對應；貿易主題也共用） */
export const PRODUCTS: { id: string; label: Text; group: Text }[] = [
  { id: 'rice', label: { zh: '稻米', en: 'Rice' }, group: CEREALS },
  { id: 'wheat', label: { zh: '小麥', en: 'Wheat' }, group: CEREALS },
  { id: 'maize', label: { zh: '玉米', en: 'Maize' }, group: CEREALS },
  { id: 'barley', label: { zh: '大麥', en: 'Barley' }, group: CEREALS },
  { id: 'soybeans', label: { zh: '大豆', en: 'Soybeans' }, group: CASH_CROPS },
  { id: 'palm-oil', label: { zh: '棕櫚油', en: 'Palm oil' }, group: CASH_CROPS },
  { id: 'sugar', label: { zh: '糖（原糖）', en: 'Sugar (raw)' }, group: CASH_CROPS },
  { id: 'coffee', label: { zh: '咖啡豆', en: 'Coffee beans' }, group: CASH_CROPS },
  { id: 'cocoa', label: { zh: '可可豆', en: 'Cocoa beans' }, group: CASH_CROPS },
  { id: 'cotton', label: { zh: '棉花（皮棉）', en: 'Cotton (lint)' }, group: CASH_CROPS },
  { id: 'rubber', label: { zh: '天然橡膠', en: 'Natural rubber' }, group: CASH_CROPS },
  { id: 'potatoes', label: { zh: '馬鈴薯', en: 'Potatoes' }, group: PRODUCE },
  { id: 'tomatoes', label: { zh: '番茄', en: 'Tomatoes' }, group: PRODUCE },
  { id: 'bananas', label: { zh: '香蕉', en: 'Bananas' }, group: PRODUCE },
  { id: 'apples', label: { zh: '蘋果', en: 'Apples' }, group: PRODUCE },
  { id: 'oranges', label: { zh: '柳橙', en: 'Oranges' }, group: PRODUCE },
  { id: 'grapes', label: { zh: '葡萄', en: 'Grapes' }, group: PRODUCE },
  { id: 'beef', label: { zh: '牛肉（含水牛）', en: 'Beef (incl. buffalo)' }, group: LIVESTOCK },
  { id: 'pork', label: { zh: '豬肉', en: 'Pork' }, group: LIVESTOCK },
  { id: 'chicken', label: { zh: '雞肉', en: 'Chicken' }, group: LIVESTOCK },
  { id: 'milk', label: { zh: '乳品（生乳當量）', en: 'Dairy (raw milk equivalent)' }, group: LIVESTOCK },
  { id: 'eggs', label: { zh: '雞蛋', en: 'Eggs' }, group: LIVESTOCK },
];

/**
 * 每公頃產量的選項（2026-11-02，製作手冊第十七批 273，pipeline/topics/crop_yield.py）：只有作物，畜產品的單產是每頭
 * 不是每公頃；棕櫚油、糖、棉花是加工品，用原料作物的單產（id 跟農產品選單一樣，換指標時選的東西不變）
 */
const YIELD_LABELS: Record<string, Text> = {
  rice: { zh: '稻米（稻穀）', en: 'Rice (paddy)' },
  'palm-oil': { zh: '油棕果（棕櫚油的原料）', en: 'Oil palm fruit (for palm oil)' },
  sugar: { zh: '甘蔗（糖的原料）', en: 'Sugar cane (for sugar)' },
  cotton: { zh: '籽棉（棉花的原料）', en: 'Seed cotton (for cotton)' },
};
const YIELD_PRODUCTS = PRODUCTS.filter((p) => p.group !== LIVESTOCK).map((p) => ({ ...p, label: YIELD_LABELS[p.id] ?? p.label }));
const yieldScale = (thresholds: number[]) => ({ type: 'sequential' as const, thresholds });

const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (v: number) => `${formatLargeNumber(v)} ${tr(TONNES)}`;

function quantity(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: TONNES,
    file: `${id}/{item}.json`,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: tonnes,
    formatTick: (v) => `${formatLargeTick(v)}${tr({ zh: '噸', en: ' t' })}`,
    shareOfWorld: true,
  };
}

export const agriculture: TopicDefinition = {
  id: 'agriculture',
  title: { zh: '各國農業', en: 'Agriculture by country' },
  shortTitle: { zh: '農業', en: 'Agriculture' },
  defaultIndicator: 'production',
  defaultYear: 2022,
  sources: [{ name: 'FAO, FAOSTAT', url: 'https://www.fao.org/faostat/', license: 'CC BY 4.0' }],
  note: {
    zh:
      '稻米產量為稻穀重量，貿易與自給率以白米當量計算。農業總產值為 2014–2016 年固定價格的國際元。' +
      '每公頃產量是 FAOSTAT 的單產（產量 ÷ 收穫面積），1961 年起；只有作物，畜產品的單產是每頭不是每公頃；棕櫚油、糖、棉花是加工品，用油棕果、甘蔗、籽棉的單產（甜菜糖的國家沒有甘蔗）。' +
      '有機農地是 FAOSTAT 土地利用資料的「有機農業的農地」，含正在轉型、還沒取得認證的；FAO 用瑞士有機農業研究所（FiBL）每年的全球調查補齊，2004 年起。放牧地也算，澳洲的有機農地多半是內陸的粗放牧場。',
    en:
      'Rice production is paddy weight; trade and self-sufficiency use milled-rice equivalent. Gross agricultural production value is in constant 2014–2016 international dollars. ' +
      'Yield per hectare is FAOSTAT’s yield (production ÷ area harvested), from 1961; crops only, as livestock yields are per animal rather than per hectare. Palm oil, sugar and cotton are processed products, so the yields of oil palm fruit, sugar cane and seed cotton are used (beet-sugar countries grow no cane). ' +
      'Organic farmland is FAOSTAT’s “agricultural area under organic agriculture” from its land use data, including land in conversion that is not yet certified; FAO fills it in with the annual global survey of the Research Institute of Organic Agriculture (FiBL), from 2004. Grazing land counts too, and most of Australia’s organic farmland is extensive outback pasture.',
  },
  dimension: {
    label: { zh: '農產品', en: 'Product' },
    options: PRODUCTS,
    defaultOption: 'rice',
  },
  panelExtra: () => import('./panels/AgriculturePanel'),
  indicators: [
    quantity(
      'production',
      { zh: '產量', en: 'Production' },
      { zh: '一年的產量。圓的面積與產量成正比。', en: 'Production in a year. Circle area is proportional to production.' },
    ),
    quantity(
      'export',
      { zh: '出口量', en: 'Exports' },
      { zh: '一年出口到其他國家的數量。', en: 'Quantity exported to other countries in a year.' },
    ),
    quantity(
      'import',
      { zh: '進口量', en: 'Imports' },
      { zh: '一年從其他國家進口的數量。', en: 'Quantity imported from other countries in a year.' },
    ),
    {
      id: 'self-sufficiency',
      label: { zh: '自給率', en: 'Self-sufficiency' },
      description: {
        zh: '產量 ÷（產量＋進口－出口）。低於 100% 表示要靠進口（橘色），高於 100% 表示有餘可以出口（綠色）。',
        en: 'Production ÷ (production + imports − exports). Below 100% means the country relies on imports (orange); above 100% means it has a surplus to export (green).',
      },
      unit: '%',
      file: 'self-sufficiency/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [25, 50, 90, 110, 200, 400] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'yield',
      label: { zh: '每公頃產量', en: 'Yield per hectare' },
      description: {
        zh: '每公頃收成幾公斤（單產），看種得多有效率：灌溉、品種、肥料與機械都會影響。2024 年稻米（稻穀）埃及 9,132 公斤、日本 6,956、台灣 6,572（1961 年 3,266），世界 4,757。只有作物；棕櫚油、糖、棉花用原料作物（油棕果、甘蔗、籽棉）。',
        en: 'Kilograms harvested per hectare, a measure of how productively a crop is grown, shaped by irrigation, varieties, fertiliser and machinery. Rice (paddy) in 2024: Egypt 9,132 kg, Japan 6,956, Taiwan 6,572 (3,266 in 1961), world 4,757. Crops only; palm oil, sugar and cotton use their raw crops (oil palm fruit, sugar cane, seed cotton).',
      },
      unit: { zh: '公斤／公頃', en: 'kg/ha' },
      file: 'yield/{item}.json',
      dimension: { label: { zh: '作物', en: 'Crop' }, options: YIELD_PRODUCTS, defaultOption: 'rice' },
      layer: {
        kind: 'choropleth',
        scale: yieldScale([2000, 3000, 4000, 5000, 6000, 8000]),
        // 各作物的單產差好幾個數量級（咖啡不到 1 公噸、甘蔗 70 公噸）
        itemScales: {
          wheat: yieldScale([1500, 2000, 3000, 4000, 5000, 7000]),
          maize: yieldScale([1500, 3000, 4500, 6000, 8000, 10000]),
          barley: yieldScale([1500, 2000, 3000, 4000, 5000, 6000]),
          soybeans: yieldScale([800, 1200, 1600, 2000, 2500, 3000]),
          'palm-oil': yieldScale([5000, 8000, 10000, 13000, 16000, 20000]),
          sugar: yieldScale([20000, 35000, 50000, 65000, 80000, 100000]),
          coffee: yieldScale([300, 500, 750, 1000, 1500, 2000]),
          cocoa: yieldScale([200, 300, 400, 500, 700, 1000]),
          cotton: yieldScale([500, 1000, 1500, 2000, 3000, 4000]),
          rubber: yieldScale([500, 800, 1100, 1400, 1700, 2000]),
          potatoes: yieldScale([8000, 12000, 18000, 25000, 32000, 40000]),
          tomatoes: yieldScale([10000, 20000, 30000, 50000, 80000, 120000]),
          bananas: yieldScale([5000, 10000, 15000, 25000, 35000, 50000]),
          apples: yieldScale([5000, 10000, 15000, 25000, 35000, 45000]),
          oranges: yieldScale([5000, 10000, 15000, 20000, 30000, 40000]),
          grapes: yieldScale([4000, 6000, 8000, 12000, 16000, 20000]),
        },
      },
      format: (v) => tr({ zh: `${fixed(v, 0)} 公斤`, en: `${fixed(v, 0)} kg` }),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'production-value',
      label: { zh: '農業總產值', en: 'Agricultural production value' },
      description: {
        zh: '所有農產品與畜產品的總產值（2014–2016 年固定價格的國際元），代表農業規模。',
        en: 'Gross production value of all crops and livestock products (constant 2014–2016 international dollars), a measure of the size of agriculture.',
      },
      unit: { zh: '國際元', en: 'international $' },
      file: 'production-value.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => intlDollars(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'trade-balance',
      label: { zh: '農產品貿易收支', en: 'Agricultural trade balance' },
      description: {
        zh: '農產品出口額減進口額（美元，不含水產品）。綠色為淨出口國，橘色為淨進口國。',
        en: 'Agricultural exports minus imports (US dollars, excluding fish). Green marks net exporters, orange net importers.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'trade-balance.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-1e10, -1e9, -1e8, 1e8, 1e9, 1e10] } },
      format: (v) => usd(formatSignedLarge(v)),
      formatTick: (v) => (v > 0 ? `+${formatLargeTick(v)}` : formatLargeTick(v)),
    },
    {
      id: 'organic-share',
      label: { zh: '有機農地的比例', en: 'Share of farmland that is organic' },
      description: {
        zh: '有機（含轉型期）的農地占全部農地的比例。2024 年列支敦斯登 30%、奧地利 27%、希臘與愛沙尼亞 23%、烏拉圭與葡萄牙 21%、義大利 19%；台灣 2.6%、韓國 2.4%、中國 0.9%、美國 0.8%、日本 0.5%；全世界 2.1%。薩摩亞的 86% 偏高，可能是有機面積與農地面積的統計口徑不同。',
        en: 'Organic farmland (including land in conversion) as a share of all agricultural land. In 2024: Liechtenstein 30%, Austria 27%, Greece and Estonia 23%, Uruguay and Portugal 21%, Italy 19%; Taiwan 2.6%, South Korea 2.4%, China 0.9%, the US 0.8%, Japan 0.5%; 2.1% worldwide. Samoa’s 86% looks too high, probably because its organic and agricultural areas are measured differently.',
      },
      unit: '%',
      file: 'organic-share.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'organic-area',
      label: { zh: '有機農地面積', en: 'Organic farmland' },
      description: {
        zh: '有機（含轉型期）的農地面積，圓的面積與它成正比。2024 年全世界 9,910 萬公頃，澳洲 5,302 萬公頃就占一半以上（多半是粗放的牧場），其次印度 397 萬、阿根廷 374 萬、中國 359 萬、烏拉圭 325 萬、美國 321 萬公頃；台灣 2.03 萬公頃，2010 年只有 3,000 公頃。',
        en: 'Area of organic farmland (including land in conversion); circle area is proportional to it. In 2024 the world had 99.1 million hectares, more than half of it in Australia (53.0 million, mostly extensive pasture), followed by India (4.0 million), Argentina (3.7 million), China (3.6 million), Uruguay (3.3 million) and the US (3.2 million); Taiwan had 20,300 hectares, up from 3,000 in 2010.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'organic-area.json',
      defaultYear: 2024,
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 公頃`, en: `${formatLargeNumber(v)} ha` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
