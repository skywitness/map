import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 各國的特色食物（pipeline/topics/foods.py）：Wikidata 依原產國的乳酪、麵包、甜點。
 * 使用者 2026-10-29 決定：三個子項目，不做國家排名，重點放在側欄的清單。
 */

export const FOOD_KINDS: { id: string; label: Text }[] = [
  { id: 'cheese', label: { zh: '乳酪', en: 'Cheese' } },
  { id: 'bread', label: { zh: '麵包', en: 'Bread' } },
  { id: 'dessert', label: { zh: '甜點', en: 'Desserts' } },
];

const KINDS: DimensionDef = {
  label: { zh: '食物', en: 'Food' },
  options: FOOD_KINDS,
  defaultOption: 'dessert',
};

export const foods: TopicDefinition = {
  id: 'foods',
  title: { zh: '各國的特色食物', en: 'Signature foods by country' },
  shortTitle: { zh: '特色食物', en: 'Signature foods' },
  defaultIndicator: 'count',
  defaultYear: 2026,
  timeless: true,
  dimension: KINDS,
  sources: [
    {
      name: { zh: 'Wikidata（乳酪、麵包、甜點的原產國與名稱）', en: 'Wikidata (countries of origin and names of cheeses, breads and desserts)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '乳酪、麵包、甜點是 Wikidata 裡標成這三類（或它們的子類別）、有原產國的項目；同一樣可以同時是麵包與甜點（例如台灣的兩相好）。' +
      '數量反映的是 Wikidata 編者收錄的多寡，不是各國真的有多少種（法國的乳酪、義大利的甜點收得特別多，德國的麵包只收了 20 多種），所以地圖不排名，點國家看它的清單。' +
      '原產國是已經不存在的國家（蘇聯、奧匈帝國等）的沒有畫；台灣的筒仔米糕在 Wikidata 被標成甜點，這裡拿掉。',
    en:
      'Cheeses, breads and desserts are Wikidata items classed as one of these (or a subclass) with a country of origin; an item can be both a bread and a dessert. ' +
      'Counts reflect how much Wikidata’s editors have recorded, not how many kinds a country really has (French cheeses and Italian desserts are especially well covered, while only some 20 German breads are), so the map has no ranking; select a country for its list. ' +
      'Items whose country of origin no longer exists (the Soviet Union, Austria-Hungary and others) are not shown, and a Taiwanese savoury rice dish wrongly classed as a dessert in Wikidata is left out.',
  },
  panelExtra: () => import('./panels/FoodsPanel'),
  indicators: [
    {
      id: 'count',
      label: { zh: '原產的種類', en: 'Kinds originating here' },
      description: {
        zh: 'Wikidata 收錄、原產於這個國家的乳酪、麵包或甜點有幾種，圓的面積與它成正比；用上面的選單換食物。乳酪法國 424、義大利 265、西班牙 78、英國 74、瑞士 44 種；麵包義大利 78、美國與西班牙各 45、法國 30、日本 28 種，台灣有太陽餅、兩相好；甜點義大利 301、西班牙 140、美國 81、印尼 55 種，台灣有芋圓、芋泥、芒果冰、澎湖鹹餅、牛搵水、兩相好。點國家列出它的清單。',
        en: 'How many cheeses, breads or desserts in Wikidata originate in each country; circle area is proportional to the count. Use the menu above to switch food. Cheese: France 424, Italy 265, Spain 78, the UK 74, Switzerland 44. Bread: Italy 78, the US and Spain 45 each, France 30, Japan 28; Taiwan has sun cakes and liang xiang hao. Desserts: Italy 301, Spain 140, the US 81, Indonesia 55; Taiwan has taro balls, taro paste, mango shaved ice, Penghu salty cakes, niu wen shui and liang xiang hao. Select a country for its list.',
      },
      unit: { zh: '種', en: 'kinds' },
      file: 'count/{item}.json',
      dimension: KINDS,
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} ${v === 1 ? 'kind' : 'kinds'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
  ],
};
