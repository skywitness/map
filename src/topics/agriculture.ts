import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedLarge, intlDollars, usd } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const CEREALS = { zh: '穀物', en: 'Cereals' };
const CASH_CROPS = { zh: '油料與經濟作物', en: 'Oil and cash crops' };
const PRODUCE = { zh: '蔬菜水果', en: 'Fruit and vegetables' };
const LIVESTOCK = { zh: '畜產品', en: 'Livestock products' };

/** 地圖上可選的農產品（與 pipeline/topics/agriculture.py 的 PRODUCTS 對應） */
const PRODUCTS: { id: string; label: Text; group: Text }[] = [
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
    zh: '稻米產量為稻穀重量，貿易與自給率以白米當量計算。農業總產值為 2014–2016 年固定價格的國際元。',
    en: 'Rice production is paddy weight; trade and self-sufficiency use milled-rice equivalent. Gross agricultural production value is in constant 2014–2016 international dollars.',
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
  ],
};
