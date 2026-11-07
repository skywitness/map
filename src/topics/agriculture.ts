import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedLarge, intlDollars, usd } from '../lib/format';
import type { CategoryDef, IndicatorDef, Text, TopicDefinition } from './types';

const CEREALS = { zh: '穀物', en: 'Cereals' };
const CASH_CROPS = { zh: '油料與經濟作物', en: 'Oil and cash crops' };
const PRODUCE = { zh: '蔬菜水果', en: 'Fruit and vegetables' };
const LIVESTOCK = { zh: '畜產品', en: 'Livestock products' };

/** 收穫面積最大的作物併成八組（2026-11-07，製作手冊第二十五批 440；pipeline/topics/agriculture_land.py 的 GROUPS） */
const TOP_CROP_GROUPS: CategoryDef[] = [
  { value: 1, label: { zh: '小麥', en: 'Wheat' } },
  { value: 2, label: { zh: '玉米', en: 'Maize' } },
  { value: 3, label: { zh: '稻米', en: 'Rice' } },
  { value: 4, label: { zh: '其他穀物（大麥、小米、高粱…）', en: 'Other cereals (barley, millet, sorghum…)' } },
  { value: 5, label: { zh: '豆類與油料（大豆、乾豆、油菜籽、葵花籽…）', en: 'Pulses and oil crops (soybeans, beans, rapeseed, sunflower…)' } },
  { value: 6, label: { zh: '根莖類與糖料（樹薯、馬鈴薯、甘蔗…）', en: 'Roots and sugar crops (cassava, potatoes, sugar cane…)' } },
  { value: 7, label: { zh: '樹木作物（椰子、油棕、橄欖、椰棗、可可…）', en: 'Tree crops (coconuts, oil palm, olives, dates, cocoa…)' } },
  { value: 8, label: { zh: '蔬菜、水果與其他', en: 'Vegetables, fruit and other' } },
];

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
  sources: [
    { name: 'FAO, FAOSTAT', url: 'https://www.fao.org/faostat/', license: 'CC BY 4.0' },
    {
      name: { zh: 'OECD 農業政策監測：生產者支持估計（%PSE）', en: 'OECD, Agricultural Policy Monitoring: Producer Support Estimate (%PSE)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_AGR_POLIND%40DF_PSE&df[ag]=OECD.TAD.ARP',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '世界銀行 WDI：農林漁業每位就業者的附加價值（NV.AGR.EMPL.KD，就業人數來自 ILOSTAT）',
        en: 'World Bank WDI: agriculture, forestry and fishing value added per worker (NV.AGR.EMPL.KD, employment from ILOSTAT)',
      },
      url: 'https://data.worldbank.org/indicator/NV.AGR.EMPL.KD',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '農業部：糧食自給率_熱量（台灣的官方值）', en: 'Ministry of Agriculture (Taiwan): calorie-based food self-sufficiency (official figures)' },
      url: 'https://data.gov.tw/dataset/87929',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
  ],
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
    {
      id: 'top-crop',
      label: { zh: '收穫面積最大的作物', en: 'Crop with the largest harvested area' },
      description: {
        zh: '這一國收穫面積最大的作物（FAOSTAT），併成八組上色，滑過看實際的作物與前五名的面積，拖時間軸看 1961 年起的變化。2024 年 179 國裡小麥 39 國、玉米 26、稻米 22、樹木作物 40（椰子是太平洋島國、椰棗是中東、橄欖是西班牙 264.6 萬公頃、油棕是馬來西亞 506.7 萬公頃、可可是象牙海岸 381.5 萬公頃）；美國、巴西、阿根廷是大豆，奈及利亞是樹薯 1,072 萬公頃，荷蘭是馬鈴薯 15.3 萬公頃。台灣 2024 年的稻米是外部機構提供的數字，所以預設看 2023 年：稻穀 22.2 萬公頃，其次蔬菜 6.5 萬、玉米 3.7 萬、檳榔 3.7 萬公頃。多年生作物（椰子、油棕、橄欖）的收穫面積跟一年生作物口徑不同；FAOSTAT 標成外部機構提供的數字不用，比最大的作物還大的那一年不畫（台灣、印尼 2024 年就是）。',
        en: 'The crop with the largest harvested area in each country (FAOSTAT), grouped into eight colours; hover for the actual crop and the top five, and drag the time slider back to 1961. In 2024, of 179 countries, wheat led in 39, maize in 26 and rice in 22, and tree crops in 40 (coconuts in the Pacific islands, dates in the Middle East, olives in Spain with 2.65 million ha, oil palm in Malaysia with 5.07 million ha, cocoa in Côte d’Ivoire with 3.82 million ha); soybeans lead in the US, Brazil and Argentina, cassava in Nigeria (10.7 million ha) and potatoes in the Netherlands (153,000 ha). Taiwan’s 2024 rice figure was supplied by an outside organisation, so the map opens on 2023: rice, 222,000 ha, ahead of vegetables (65,000), maize (37,000) and areca nuts (37,000). Harvested areas of perennial crops (coconuts, oil palm, olives) are not measured like those of annual crops. Figures FAOSTAT marks as supplied by outside organisations are not used, and a year is left blank when such a figure is larger than the top crop (as for Taiwan and Indonesia in 2024).',
      },
      unit: '',
      file: 'top-crop.json',
      defaultYear: 2023,
      layer: { kind: 'categorical', categories: TOP_CROP_GROUPS },
      format: (v) => tr(TOP_CROP_GROUPS.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'farmland-share',
      label: { zh: '農地占國土的比例', en: 'Farmland as a share of land area' },
      description: {
        zh: '農地（耕地、永久作物與永久草地）占陸地面積的比例，可以切換只看耕地或永久草地。2024 年烏拉圭 87.4%、沙烏地阿拉伯 81.7%、孟加拉 72.2%、蒙古 68.8%、印度 59.9%、荷蘭 53.4%、法國 52.8%、美國 46.1%、中國 41.7%、巴西 28.4%；台灣 21.9%（耕地 16.8%）、韓國 16.0%、日本 12.6%、埃及 4.2%；全世界 36.0%。永久草地各國報法差很多：蒙古幾乎都是天然草原、沙烏地是沙漠的粗放牧地，都不是可以耕種的地；耕地比例最高的是孟加拉 60.5%、丹麥 58.9%、烏克蘭 56.8%。',
        en: 'Agricultural land (arable land, permanent crops and permanent meadows and pastures) as a share of land area; switch to arable land or permanent pasture alone. In 2024: Uruguay 87.4%, Saudi Arabia 81.7%, Bangladesh 72.2%, Mongolia 68.8%, India 59.9%, the Netherlands 53.4%, France 52.8%, the US 46.1%, China 41.7%, Brazil 28.4%; Taiwan 21.9% (16.8% arable), South Korea 16.0%, Japan 12.6%, Egypt 4.2%; 36.0% worldwide. Countries report permanent pasture very differently: Mongolia’s is almost all natural grassland and Saudi Arabia’s is extensive desert grazing, neither of it farmable. The highest arable shares are Bangladesh (60.5%), Denmark (58.9%) and Ukraine (56.8%).',
      },
      unit: '%',
      file: 'farmland-share/{item}.json',
      dimension: {
        label: { zh: '土地', en: 'Land' },
        options: [
          { id: 'agricultural', label: { zh: '全部農地', en: 'All farmland' } },
          { id: 'arable', label: { zh: '耕地', en: 'Arable land' } },
          { id: 'pasture', label: { zh: '永久草地與牧場', en: 'Permanent meadows and pastures' } },
        ],
        defaultOption: 'agricultural',
      },
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 70] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'livestock-density',
      label: { zh: '牲畜密度', en: 'Livestock density' },
      description: {
        zh: '每公頃農地有幾個家畜單位（FAO 依各畜種與地區的換算係數，把牛、豬、雞等換成同一個單位），看這塊地上擠了多少牲畜；滑過看各畜種的比例。2023 年千里達 8.28、卡達 7.45、科威特 4.88、韓國 4.63、荷蘭 3.92，台灣 3.11 在 176 國裡第 6（豬占 53%、雞 42%）；比利時 2.88、孟加拉 2.07、日本 1.96、丹麥 1.68（豬占 65%）、紐西蘭 1.17（牛 76%、綿羊 21%）、德國 1.03、中國 0.68、美國 0.31、蒙古 0.12、澳洲 0.10；全世界 0.43。農地不到 2 萬公頃的地方（新加坡、香港、汶萊等 32 個）分母太小，不比；換算係數依地區不同，跨區比較要小心。',
        en: 'Livestock units per hectare of agricultural land (FAO converts cattle, pigs, chickens and other species into one unit with factors that vary by region), showing how crowded the land is with animals; hover for each species’ share. In 2023: Trinidad and Tobago 8.28, Qatar 7.45, Kuwait 4.88, South Korea 4.63, the Netherlands 3.92, and Taiwan 3.11, 6th of 176 (53% pigs, 42% chickens); Belgium 2.88, Bangladesh 2.07, Japan 1.96, Denmark 1.68 (65% pigs), New Zealand 1.17 (76% cattle, 21% sheep), Germany 1.03, China 0.68, the US 0.31, Mongolia 0.12, Australia 0.10; 0.43 worldwide. Places with less than 20,000 ha of farmland (32, including Singapore, Hong Kong and Brunei) are not compared because the denominator is too small; conversion factors differ by region, so compare across regions with care.',
      },
      unit: { zh: '家畜單位／公頃', en: 'LSU/ha' },
      file: 'livestock-density.json',
      defaultYear: 2023,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1, 2, 4] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 單位／公頃`, en: `${fixed(v, 2)} LSU/ha` }),
      formatTick: (v) => String(v),
    },
    {
      id: 'value-per-ha',
      label: { zh: '每公頃農地的農業產值', en: 'Farm output per hectare' },
      description: {
        zh: '農業總產值（2014–2016 年固定價的國際元）÷ 農地面積，看一塊地產出多少；跟「農業總產值」同一個分子，那個看規模、這個看密集程度。2024 年韓國 9,980、埃及 9,789、荷蘭 9,559，台灣 9,017 在 177 國裡第 4，以色列 8,780、比利時 6,694、日本 5,856、孟加拉 5,394；越南 4,519、印度 3,006、德國 2,946、中國 2,591、法國 1,855、巴西 1,139；世界 921、美國 894、澳洲 144、蒙古 20、納米比亞 14 最低，相差七百倍。農地不到 1 萬公頃的 18 個地方（新加坡、香港、巴林、馬爾他…）分母太小，不比；放牧地多的國家（澳洲、蒙古）每公頃自然低。',
        en: 'Gross agricultural production value (constant 2014–2016 international dollars) divided by agricultural land: how much a hectare produces. It shares a numerator with “Gross agricultural production value”, which shows size while this shows intensity. In 2024: South Korea 9,980, Egypt 9,789, the Netherlands 9,559, and Taiwan 9,017, 4th of 177; Israel 8,780, Belgium 6,694, Japan 5,856, Bangladesh 5,394; Vietnam 4,519, India 3,006, Germany 2,946, China 2,591, France 1,855, Brazil 1,139; the world 921, the US 894, Australia 144, Mongolia 20 and Namibia 14, the lowest – a 700-fold gap. The 18 places with less than 10,000 ha of farmland (Singapore, Hong Kong, Bahrain, Malta…) are not compared because the denominator is too small; countries with much grazing land (Australia, Mongolia) are naturally low per hectare.',
      },
      unit: { zh: '國際元／公頃', en: 'Int$/ha' },
      file: 'value-per-ha.json',
      defaultYear: 2024,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 300, 1000, 2500, 5000, 8000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 國際元／公頃`, en: `Int$${fixed(v, 0)}/ha` }),
      formatTick: (v) => formatLargeTick(v),
    },
    // 2026-11-07（製作手冊第二十五批 441 的候選 1072，使用者決定改用世界銀行 WDI）每位農業就業者的附加價值
    {
      id: 'value-per-worker',
      label: { zh: '每位農民創造多少附加價值', en: 'Farm value added per worker' },
      description: {
        zh: '農林漁業的附加價值 ÷ 在農林漁業工作的人數（2015 年固定價美元；世界銀行 WDI，就業人數用國際勞工組織的估計），看一個人的勞動產出多少；跟「每公頃農地的農業產值」是土地與勞力兩個分母。2025 年加拿大 15.1 萬美元、澳洲 12.7 萬、冰島 11.8 萬、荷蘭 8.9 萬、挪威 7.6 萬、德國 6.0 萬；以色列 2024 年 11.8 萬、日本 2.0 萬；韓國 1.9 萬、巴西 1.4 萬、中國 8,631 美元、越南 3,418、印度 2,159；剛果民主共和國 286、蒲隆地 211 最低；世界 4,264。美國在 WDI 只有 2015 年的值，台灣不在 WDI；農業就業占總就業的比例見「產業結構與工業」主題。',
        en: 'Value added in agriculture, forestry and fishing divided by the number of people working in them (constant 2015 US dollars; World Bank WDI, with ILO employment estimates): output per worker, the labour counterpart to “Farm output per hectare”. In 2025: Canada US$150,630, Australia 126,570, Iceland 118,430, the Netherlands 89,045, Norway 75,590, Germany 59,656; Israel 118,490 and Japan 20,324 in 2024; South Korea 18,552, Brazil 14,203, China 8,631, Vietnam 3,418, India 2,159; the DR Congo (286) and Burundi (211) are lowest; the world 4,264. The US has only a 2015 value in WDI and Taiwan is not in WDI; the share of employment in agriculture is in the Economic structure and industry topic.',
      },
      unit: { zh: '美元（2015 年價格）', en: 'US$ (2015 prices)' },
      file: 'value-per-worker.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 3000, 8000, 20000, 40000, 70000] } },
      format: (v) => tr({ zh: v >= 10000 ? `${fixed(v / 10000, 1)} 萬美元` : `${fixed(v, 0)} 美元`, en: `US$${fixed(v, 0)}` }),
      formatTick: (v) => formatLargeTick(v),
      compareWorld: true,
      noValue: { TWN: { zh: '世界銀行的資料沒有台灣', en: 'Taiwan is not in the World Bank data' } },
    },
    // 2026-11-07（製作手冊第二十五批 443 的候選 1077，使用者決定做並附註台灣官方值）熱量自給率（pipeline/topics/calorie_self_sufficiency.py）
    {
      id: 'calorie-self-sufficiency',
      label: { zh: '熱量自給率', en: 'Calorie self-sufficiency' },
      description: {
        zh: '吃的熱量有幾成是自己種、自己養的：用 FAO 糧食平衡表自算，每個品項的熱量供給乘上「生產量 ÷ 國內供給量」，肉、蛋、奶再乘飼料自給率，加起來除以總熱量（2010–2023 年；FAO 沒有直接公布這個數字）。出口國會超過 100%。2023 年：烏克蘭 285.9%、巴拉圭 208.0%、澳洲 184.7%、巴西 164.6%、加拿大 155.4%、法國 117.7%、印度 105.4%、美國 98.7%、中國 87.0%、德國 86.9%、英國 60.1%、韓國 38.3%；香港 3.1%、巴林 1.9%、澳門 0.4% 最低。台灣用同樣方法算是 44.8%，農業部公布的是 30.31%（2023 年；2025 年 30.36%），農業部另外算可食部分、飼料換算等，口徑不同。日本與新加坡不在 FAO 這份資料裡。跟「自給率」不同：那是 22 種農產品各自的數量，這是全部熱量加起來一個數字。',
        en: 'How much of the calories people eat is grown or raised at home: computed from FAO food balance sheets by multiplying each item’s calorie supply by production ÷ domestic supply, further multiplying meat, eggs and milk by feed self-sufficiency, and dividing the sum by total calories (2010–2023; the FAO does not publish this figure itself). Exporters exceed 100%. In 2023: Ukraine 285.9%, Paraguay 208.0%, Australia 184.7%, Brazil 164.6%, Canada 155.4%, France 117.7%, India 105.4%, the US 98.7%, China 87.0%, Germany 86.9%, the UK 60.1%, South Korea 38.3%; Hong Kong 3.1%, Bahrain 1.9% and Macao 0.4% are lowest. Taiwan comes out at 44.8% this way, while the Ministry of Agriculture reports 30.31% (2023; 30.36% in 2025) using its own method (edible portions, feed conversion and so on). Japan and Singapore are not in this FAO dataset. Unlike “Self-sufficiency”, which covers 22 products one by one in quantities, this is a single figure for all calories.',
      },
      unit: '%',
      file: 'calorie-self-sufficiency.json',
      defaultYear: 2023,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 75, 100, 125, 150] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'pse',
      label: { zh: '農業補貼（%PSE）', en: 'Farm support (%PSE)' },
      description: {
        zh: 'OECD 的生產者支持估計：農民的收入裡有多少來自政策（價格支持、直接給付等，含關稅與價格管制造成的隱含移轉），1986 年起，29 國加歐盟。2025 年冰島 51.0%、挪威 49.7%、瑞士 49.2%、日本 45.0%（2024 年 31.2%）、韓國 42.7%、菲律賓 24.5%、歐盟 18.2%、埃及 16.7%、中國 14.3%、英國 12.6%、美國 9.7%、加拿大 6.6%、巴西 1.2%、澳洲 1.2%、紐西蘭 0.5%；OECD 平均 15.4%。負值是出口限制與價格管制在向農民抽稅：印度 −7.1%、越南 −10.7%、阿根廷 −15.0%。歐盟只有一個合計，成員國都畫歐盟的值（加入以後的年份）；台灣不在 OECD 的監測裡。',
        en: 'The OECD’s Producer Support Estimate: the share of farm receipts that comes from policy (price support, direct payments and so on, including the implicit transfers from tariffs and price controls), from 1986, for 29 countries and the EU. In 2025: Iceland 51.0%, Norway 49.7%, Switzerland 49.2%, Japan 45.0% (31.2% in 2024), South Korea 42.7%, the Philippines 24.5%, the EU 18.2%, Egypt 16.7%, China 14.3%, the UK 12.6%, the US 9.7%, Canada 6.6%, Brazil 1.2%, Australia 1.2%, New Zealand 0.5%; OECD average 15.4%. Negative values mean export restrictions and price controls tax farmers: India −7.1%, Vietnam −10.7%, Argentina −15.0%. The EU is reported only as a whole, so member states show the EU value (from the year they joined); Taiwan is not covered by OECD monitoring.',
      },
      unit: '%',
      file: 'pse.json',
      defaultYear: 2025,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-30, -15, -1, 1, 15, 30] } },
      format: (v) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'aoi',
      label: { zh: '政府對農業的偏重（農業導向指數）', en: 'Government spending bias to farming (AOI)' },
      description: {
        zh: 'SDG 2.a.1 的農業導向指數：農林漁業支出占政府支出的比例 ÷ 農業占 GDP 的比例，大於 1 是政府花在農業的錢比農業在經濟裡的份量還多。2023 年瑞士 3.08、韓國 2.28、日本 2.04、英國 0.97、中國 0.87、泰國 0.68、挪威 0.59、德國 0.50、印度 0.42、越南 0.40、美國 0.36、澳洲 0.34、法國 0.23、荷蘭 0.21、印尼 0.20、巴西 0.15；世界 0.44；迦納、獅子山 0.02 最低。只看預算支出，不含 %PSE 裡關稅與價格支持的隱含移轉。新加坡 5.74、香港 3.67、盧森堡 3.35 這類農業不到 GDP 0.5% 的地方分母很小、指數容易放大（馬爾他 2023 年是 25.3），滑過有寫；台灣不在 FAOSTAT 的這份資料裡。',
        en: 'The SDG 2.a.1 Agriculture Orientation Index: agriculture, forestry and fishing’s share of government spending divided by agriculture’s share of GDP; above 1 means governments spend more on farming than its weight in the economy. In 2023: Switzerland 3.08, South Korea 2.28, Japan 2.04, the UK 0.97, China 0.87, Thailand 0.68, Norway 0.59, Germany 0.50, India 0.42, Vietnam 0.40, the US 0.36, Australia 0.34, France 0.23, the Netherlands 0.21, Indonesia 0.20, Brazil 0.15; the world 0.44; Ghana and Sierra Leone are lowest at 0.02. It counts budget spending only, not the implicit transfers from tariffs and price support in %PSE. Places where farming is under 0.5% of GDP, such as Singapore (5.74), Hong Kong (3.67) and Luxembourg (3.35), have tiny denominators that inflate the index (Malta was 25.3 in 2023), as noted on hover; Taiwan is not in this FAOSTAT dataset.',
      },
      unit: '',
      file: 'aoi.json',
      defaultYear: 2023,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.2, 0.4, 0.7, 1, 2] } },
      format: (v) => fixed(v, 2),
      formatTick: (v) => String(v),
    },
    {
      id: 'producer-price',
      label: { zh: '產地價格', en: 'Producer price' },
      description: {
        zh: '農民賣出去拿到的價格（FAOSTAT，美元／公噸，1991 年起），選上面的農產品；棕櫚油、糖、棉花用原料（油棕果、甘蔗、籽棉）的價格，肉類是帶骨鮮肉、乳品是生乳。2023 年的稻穀：亞塞拜然 1,894、韓國 1,808、吉爾吉斯 1,574、不丹 1,521、日本 1,434 美元，埃及 613、中國 402、印尼 389、美國 381、菲律賓 357、泰國 331、越南 327，斯里蘭卡 286、塞內加爾 267 最低；日韓的農民拿到的價格是東南亞的四到五倍，跟農業補貼（%PSE）的高低對得起來。各國只報自己重要的品項，很多國家空白（稻穀 54 國）；有的是政府收購價、有的是市場均價；美元價跟著匯率變，跨年比較要小心。台灣不在 FAOSTAT 的產地價格裡。',
        en: 'The price farmers receive (FAOSTAT, US$ per tonne, from 1991); choose a product above. Palm oil, sugar and cotton use their raw materials (oil palm fruit, sugar cane, seed cotton); meat is fresh with the bone and dairy is raw milk. Paddy rice in 2023: Azerbaijan 1,894, South Korea 1,808, Kyrgyzstan 1,574, Bhutan 1,521 and Japan 1,434, against Egypt 613, China 402, Indonesia 389, the US 381, the Philippines 357, Thailand 331, Vietnam 327, and Sri Lanka 286 and Senegal 267 at the bottom; Japanese and Korean farmers get four to five times what Southeast Asian ones do, which matches their high farm support (%PSE). Countries report only their main products, so many are blank (54 for rice); some report government purchase prices and others market averages; dollar prices move with exchange rates, so compare years with care. Taiwan is not in FAOSTAT’s producer prices.',
      },
      unit: { zh: '美元／公噸', en: 'US$/t' },
      file: 'producer-price/{item}.json',
      defaultYear: 2023,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [300, 350, 400, 500, 700, 1000] },
        itemScales: Object.fromEntries(
          (
            [
              ['rice', [300, 350, 400, 500, 700, 1000]],
              ['wheat', [200, 230, 260, 300, 370, 500]],
              ['maize', [180, 220, 260, 300, 400, 600]],
              ['barley', [170, 200, 230, 260, 300, 400]],
              ['soybeans', [420, 460, 500, 560, 650, 800]],
              ['palm-oil', [125, 135, 145, 155, 170, 200]],
              ['sugar', [30, 35, 40, 50, 70, 120]],
              ['coffee', [1200, 1700, 2100, 2600, 3200, 4500]],
              ['cocoa', [1400, 1800, 2100, 2300, 2600, 3000]],
              ['cotton', [450, 500, 550, 650, 800, 1000]],
              ['rubber', [480, 550, 600, 700, 950, 1200]],
              ['potatoes', [250, 350, 420, 500, 650, 900]],
              ['tomatoes', [400, 600, 800, 1000, 1400, 2000]],
              ['bananas', [300, 450, 550, 650, 800, 1100]],
              ['apples', [350, 500, 600, 700, 850, 1100]],
              ['oranges', [250, 400, 550, 650, 800, 1100]],
              ['grapes', [450, 650, 850, 1000, 1400, 2200]],
              ['beef', [3200, 3800, 4300, 5000, 6500, 9000]],
              ['pork', [2100, 2400, 2600, 2900, 3500, 4200]],
              ['chicken', [1800, 2100, 2500, 2900, 3500, 4200]],
              ['milk', [420, 460, 500, 540, 600, 750]],
              ['eggs', [1500, 1900, 2200, 2500, 3000, 4000]],
            ] as [string, number[]][]
          ).map(([id, thresholds]) => [id, { type: 'sequential' as const, thresholds }]),
        ),
      },
      format: (v) => tr({ zh: `${fixed(v, 0)} 美元／公噸`, en: `US$${fixed(v, 0)}/t` }),
      formatTick: (v) => formatLargeTick(v),
    },
  ],
};
