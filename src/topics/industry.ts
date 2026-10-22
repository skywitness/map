import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import { DGBAS_SOURCE } from './sectors';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;

function share(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: pct,
    formatTick: pctTick,
  };
}

/** 出口產業類別（與 pipeline/topics/industry.py 的 EXPORT_GROUPS 對應） */
export const EXPORT_GROUPS: { id: string; label: Text }[] = [
  { id: 'electronics', label: { zh: '電機與電子', en: 'Electrical and electronics' } },
  { id: 'machinery', label: { zh: '機械', en: 'Machinery' } },
  { id: 'vehicles', label: { zh: '運輸工具', en: 'Vehicles and transport equipment' } },
  { id: 'chemicals', label: { zh: '化學品與藥品', en: 'Chemicals and pharmaceuticals' } },
  { id: 'plastics', label: { zh: '塑膠與橡膠', en: 'Plastics and rubber' } },
  { id: 'metals', label: { zh: '鋼鐵與金屬製品', en: 'Iron, steel and metal products' } },
  { id: 'instruments', label: { zh: '光學與精密儀器', en: 'Optical and precision instruments' } },
  { id: 'textiles', label: { zh: '紡織與成衣', en: 'Textiles and clothing' } },
  { id: 'agrifood', label: { zh: '農產品與食品', en: 'Agricultural products and food' } },
  { id: 'minerals', label: { zh: '礦產與能源', en: 'Minerals and energy' } },
  { id: 'wood-paper', label: { zh: '皮革、木材與紙', en: 'Leather, wood and paper' } },
  { id: 'stone-glass', label: { zh: '石材、陶瓷與玻璃', en: 'Stone, ceramics and glass' } },
  { id: 'precious', label: { zh: '珠寶與貴金屬', en: 'Jewellery and precious metals' } },
  { id: 'other', label: { zh: '其他製品', en: 'Other manufactures' } },
  { id: 'unspecified', label: { zh: '未分類商品', en: 'Unspecified goods' } },
];

export const industry: TopicDefinition = {
  id: 'industry',
  title: { zh: '各國工業', en: 'Industry by country' },
  shortTitle: { zh: '工業', en: 'Industry' },
  defaultIndicator: 'share-machinery',
  defaultYear: 2021,
  sources: [
    {
      name: { zh: 'World Bank WDI（資料源自 UNIDO）', en: 'World Bank WDI (data from UNIDO)' },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    { name: 'Harvard Growth Lab, Atlas of Economic Complexity', url: 'https://atlas.hks.harvard.edu/', license: 'CC0' },
    DGBAS_SOURCE,
  ],
  note: {
    zh: '製造業組成依 UNIDO 的五大類（ISIC Rev.3），台灣由主計總處各業 GDP 依同樣分類換算。出口結構依 HS 商品分類歸類。',
    en: "Manufacturing composition follows UNIDO's five groups (ISIC Rev.3); Taiwan's is derived from DGBAS GDP by industry using the same grouping. Export structure is grouped by HS product codes.",
  },
  dimension: {
    label: { zh: '出口產業', en: 'Export sector' },
    options: EXPORT_GROUPS,
    defaultOption: 'electronics',
  },
  panelExtra: () => import('./panels/IndustryPanel'),
  indicators: [
    {
      id: 'mva',
      label: { zh: '製造業附加價值', en: 'Manufacturing value added' },
      description: {
        zh: '製造業一年創造的附加價值（美元），代表一國製造業的規模。圓的面積與規模成正比。',
        en: 'Value added by manufacturing in a year (US dollars), a measure of the size of the manufacturing sector. Circle area is proportional to size.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'mva.json',
      layer: { kind: 'bubble', legendValues: [1e10, 1e11, 1e12] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    share(
      'share-machinery',
      { zh: '機械、電子與運輸設備占製造業', en: 'Machinery, electronics and transport equipment, % of manufacturing' },
      {
        zh: '包含電子零組件、電腦、電機、機械、汽車、船舶等，占製造業附加價值的比例。',
        en: 'Electronic components, computers, electrical equipment, machinery, motor vehicles, ships and so on, as a share of manufacturing value added.',
      },
      [10, 20, 30, 40, 50, 60],
    ),
    share(
      'share-chemicals',
      { zh: '化學與製藥占製造業', en: 'Chemicals and pharmaceuticals, % of manufacturing' },
      {
        zh: '化學材料、化學製品與藥品占製造業附加價值的比例。',
        en: 'Chemical materials, chemical products and pharmaceuticals as a share of manufacturing value added.',
      },
      [5, 10, 15, 20, 30, 40],
    ),
    share(
      'share-food',
      { zh: '食品飲料菸草占製造業', en: 'Food, beverages and tobacco, % of manufacturing' },
      {
        zh: '食品、飲料與菸草製造占製造業附加價值的比例。',
        en: 'Food, beverage and tobacco manufacturing as a share of manufacturing value added.',
      },
      [10, 20, 30, 40, 50, 60],
    ),
    share(
      'share-textiles',
      { zh: '紡織成衣占製造業', en: 'Textiles and clothing, % of manufacturing' },
      {
        zh: '紡織、成衣與皮革製品占製造業附加價值的比例。',
        en: 'Textiles, clothing and leather products as a share of manufacturing value added.',
      },
      [2, 5, 10, 20, 30, 40],
    ),
    share(
      'share-other',
      { zh: '其他製造業占製造業', en: 'Other manufacturing, % of manufacturing' },
      {
        zh: '上面四類以外的製造業，例如金屬、塑膠、石化、紙業、木材與家具。',
        en: 'Manufacturing outside the four groups above, such as metals, plastics, petrochemicals, paper, wood and furniture.',
      },
      [20, 30, 40, 50, 60, 70],
    ),
    share(
      'tech-share',
      { zh: '中高科技製造業占比', en: 'Medium and high-tech share of manufacturing' },
      {
        zh: '中高科技產業（化學、製藥、電子、電機、機械、運輸工具）占製造業附加價值的比例。',
        en: 'Medium and high-tech industries (chemicals, pharmaceuticals, electronics, electrical equipment, machinery, transport equipment) as a share of manufacturing value added.',
      },
      [10, 20, 30, 40, 50, 60],
    ),
    {
      id: 'exports',
      label: { zh: '占商品出口比重', en: 'Share of goods exports' },
      description: {
        zh: '選定產業的出口額占該國全部商品出口的比例（不含服務）。可在左側切換產業。',
        en: "The selected sector's exports as a share of the country's total goods exports (excluding services). Switch sectors on the left.",
      },
      unit: '%',
      file: 'exports/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 20, 40] } },
      format: pct,
      formatTick: pctTick,
    },
  ],
};
