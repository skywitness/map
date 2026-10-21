import { fixed, formatLargeNumber, formatLargeTick, formatSignedLarge } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/** 地圖上可選的農產品（與 pipeline/topics/agriculture.py 的 PRODUCTS 對應） */
const PRODUCTS = [
  { id: 'rice', label: '稻米', group: '穀物' },
  { id: 'wheat', label: '小麥', group: '穀物' },
  { id: 'maize', label: '玉米', group: '穀物' },
  { id: 'barley', label: '大麥', group: '穀物' },
  { id: 'soybeans', label: '大豆', group: '油料與經濟作物' },
  { id: 'palm-oil', label: '棕櫚油', group: '油料與經濟作物' },
  { id: 'sugar', label: '糖（原糖）', group: '油料與經濟作物' },
  { id: 'coffee', label: '咖啡豆', group: '油料與經濟作物' },
  { id: 'cocoa', label: '可可豆', group: '油料與經濟作物' },
  { id: 'cotton', label: '棉花（皮棉）', group: '油料與經濟作物' },
  { id: 'rubber', label: '天然橡膠', group: '油料與經濟作物' },
  { id: 'potatoes', label: '馬鈴薯', group: '蔬菜水果' },
  { id: 'tomatoes', label: '番茄', group: '蔬菜水果' },
  { id: 'bananas', label: '香蕉', group: '蔬菜水果' },
  { id: 'apples', label: '蘋果', group: '蔬菜水果' },
  { id: 'oranges', label: '柳橙', group: '蔬菜水果' },
  { id: 'grapes', label: '葡萄', group: '蔬菜水果' },
  { id: 'beef', label: '牛肉（含水牛）', group: '畜產品' },
  { id: 'pork', label: '豬肉', group: '畜產品' },
  { id: 'chicken', label: '雞肉', group: '畜產品' },
  { id: 'milk', label: '乳品（生乳當量）', group: '畜產品' },
  { id: 'eggs', label: '雞蛋', group: '畜產品' },
];

const tonnes = (v: number) => `${formatLargeNumber(v)} 公噸`;

function quantity(id: string, label: string, description: string): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '公噸',
    file: `${id}/{item}.json`,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: tonnes,
    formatTick: (v) => `${formatLargeTick(v)}噸`,
    shareOfWorld: true,
  };
}

export const agriculture: TopicDefinition = {
  id: 'agriculture',
  title: '各國農業',
  shortTitle: '農業',
  defaultIndicator: 'production',
  defaultYear: 2022,
  sources: [{ name: 'FAO, FAOSTAT', url: 'https://www.fao.org/faostat/', license: 'CC BY 4.0' }],
  note: '稻米產量為稻穀重量，貿易與自給率以白米當量計算。農業總產值為 2014–2016 年固定價格的國際元。',
  dimension: {
    label: '農產品',
    options: PRODUCTS,
    defaultOption: 'rice',
  },
  panelExtra: () => import('./panels/AgriculturePanel'),
  indicators: [
    quantity('production', '產量', '一年的產量。圓的面積與產量成正比。'),
    quantity('export', '出口量', '一年出口到其他國家的數量。'),
    quantity('import', '進口量', '一年從其他國家進口的數量。'),
    {
      id: 'self-sufficiency',
      label: '自給率',
      description: '產量 ÷（產量＋進口－出口）。低於 100% 表示要靠進口（紅色），高於 100% 表示有餘可以出口（藍色）。',
      unit: '%',
      file: 'self-sufficiency/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [25, 50, 90, 110, 200, 400] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'production-value',
      label: '農業總產值',
      description: '所有農產品與畜產品的總產值（2014–2016 年固定價格的國際元），代表農業規模。',
      unit: '國際元',
      file: 'production-value.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: (v) => `${formatLargeNumber(v)} 國際元`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'trade-balance',
      label: '農產品貿易收支',
      description: '農產品出口額減進口額（美元，不含水產品）。藍色為淨出口國，紅色為淨進口國。',
      unit: '美元',
      file: 'trade-balance.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-1e10, -1e9, -1e8, 1e8, 1e9, 1e10] } },
      format: (v) => `${formatSignedLarge(v)} 美元`,
      formatTick: (v) => (v > 0 ? `+${formatLargeTick(v)}` : formatLargeTick(v)),
    },
  ],
};
