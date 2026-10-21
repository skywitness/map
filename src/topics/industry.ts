import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;

function share(id: string, label: string, description: string, thresholds: number[]): IndicatorDef {
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
export const EXPORT_GROUPS = [
  { id: 'electronics', label: '電機與電子' },
  { id: 'machinery', label: '機械' },
  { id: 'vehicles', label: '運輸工具' },
  { id: 'chemicals', label: '化學品與藥品' },
  { id: 'plastics', label: '塑膠與橡膠' },
  { id: 'metals', label: '鋼鐵與金屬製品' },
  { id: 'instruments', label: '光學與精密儀器' },
  { id: 'textiles', label: '紡織與成衣' },
  { id: 'agrifood', label: '農產品與食品' },
  { id: 'minerals', label: '礦產與能源' },
  { id: 'wood-paper', label: '皮革、木材與紙' },
  { id: 'stone-glass', label: '石材、陶瓷與玻璃' },
  { id: 'precious', label: '珠寶與貴金屬' },
  { id: 'other', label: '其他製品' },
  { id: 'unspecified', label: '未分類商品' },
];

export const industry: TopicDefinition = {
  id: 'industry',
  title: '各國工業',
  shortTitle: '工業',
  defaultIndicator: 'share-machinery',
  defaultYear: 2021,
  sources: [
    { name: 'World Bank WDI（資料源自 UNIDO）', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    { name: 'Harvard Growth Lab, Atlas of Economic Complexity', url: 'https://atlas.hks.harvard.edu/', license: 'CC0' },
    { name: '行政院主計總處 總體統計資料庫', url: 'https://nstatdb.dgbas.gov.tw/', license: '政府資料開放授權條款' },
  ],
  note: '製造業組成依 UNIDO 的五大類（ISIC Rev.3），台灣由主計總處各業 GDP 依同樣分類換算。出口結構依 HS 商品分類歸類。',
  dimension: {
    label: '出口產業',
    options: EXPORT_GROUPS,
    defaultOption: 'electronics',
  },
  panelExtra: () => import('./panels/IndustryPanel'),
  indicators: [
    {
      id: 'mva',
      label: '製造業附加價值',
      description: '製造業一年創造的附加價值（美元），代表一國製造業的規模。圓的面積與規模成正比。',
      unit: '美元',
      file: 'mva.json',
      layer: { kind: 'bubble', legendValues: [1e10, 1e11, 1e12] },
      format: (v) => `${formatLargeNumber(v)} 美元`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    share('share-machinery', '機械、電子與運輸設備占製造業', '包含電子零組件、電腦、電機、機械、汽車、船舶等，占製造業附加價值的比例。', [10, 20, 30, 40, 50, 60]),
    share('share-chemicals', '化學與製藥占製造業', '化學材料、化學製品與藥品占製造業附加價值的比例。', [5, 10, 15, 20, 30, 40]),
    share('share-food', '食品飲料菸草占製造業', '食品、飲料與菸草製造占製造業附加價值的比例。', [10, 20, 30, 40, 50, 60]),
    share('share-textiles', '紡織成衣占製造業', '紡織、成衣與皮革製品占製造業附加價值的比例。', [2, 5, 10, 20, 30, 40]),
    share('share-other', '其他製造業占製造業', '上面四類以外的製造業，例如金屬、塑膠、石化、紙業、木材與家具。', [20, 30, 40, 50, 60, 70]),
    share('tech-share', '中高科技製造業占比', '中高科技產業（化學、製藥、電子、電機、機械、運輸工具）占製造業附加價值的比例。', [10, 20, 30, 40, 50, 60]),
    {
      id: 'exports',
      label: '占商品出口比重',
      description: '選定產業的出口額占該國全部商品出口的比例（不含服務）。可在左側切換產業。',
      unit: '%',
      file: 'exports/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 20, 40] } },
      format: pct,
      formatTick: pctTick,
    },
  ],
};
