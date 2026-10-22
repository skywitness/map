import { formatLargeNumber, formatLargeTick } from '../lib/format';
import { PRODUCTS } from './agriculture';
import type { FlowDirection, IndicatorDef, TopicDefinition } from './types';

/**
 * 貿易流向：出口、進口兩個指標就是地圖上的「出口／進口」切換，商品是子項目選單。
 * 獨立成一個主題而不是併進農業：農業已有 6 個指標（下拉選單），流向圖的操作方式
 * （先點國家、弧線、方向切換）跟其他指標完全不同；全部商品的貿易也不屬於農業。
 */

// 跟農業主題同一組農產品，但貿易是用金額加總，乳品是所有乳製品的合計（不是生乳當量）
const LABEL_OVERRIDES: Record<string, string> = { milk: '乳製品', pork: '豬肉（含加工品）' };

const ITEMS = [
  { id: 'all', label: '全部商品', group: '合計' },
  { id: 'agri', label: '農產品合計', group: '合計' },
  ...PRODUCTS.map((p) => ({ ...p, label: LABEL_OVERRIDES[p.id] ?? p.label })),
];

const usd = (v: number) => `${formatLargeNumber(v)} 美元`;

function flow(direction: FlowDirection, label: string, description: string): IndicatorDef {
  return {
    id: direction,
    label,
    description,
    unit: '美元',
    file: `${direction}/{item}.json`,
    layer: { kind: 'flow', file: 'flows/{item}/{year}.json', direction },
    format: usd,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  };
}

export const trade: TopicDefinition = {
  id: 'trade',
  title: '國際貿易流向',
  shortTitle: '貿易',
  defaultIndicator: 'export',
  defaultYear: 2023,
  sources: [
    {
      name: 'CEPII, BACI',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
    { name: 'FAO, FAOSTAT（詳細貿易矩陣）', url: 'https://www.fao.org/faostat/en/#data/TM', license: 'CC BY 4.0' },
  ],
  note:
    '全部商品為 CEPII BACI（2017–2024 年），已調和進出口雙方的申報，以離岸價（FOB）計；台灣在 UN Comtrade 與 BACI 列為「Other Asia, nes」。' +
    '農產品為 FAOSTAT 詳細貿易矩陣（2000 年起），出口以出口國、進口以進口國的申報為準，該年沒有申報的國家改用貿易夥伴的申報。' +
    '每個國家只列前 15 大夥伴，占比以對所有夥伴的總額計算。',
  dimension: { label: '商品', options: ITEMS, defaultOption: 'all' },
  panelExtra: () => import('./panels/TradePanel'),
  indicators: [
    flow('export', '出口', '點選國家，弧線連到它的前 15 大出口對象，線寬與出口金額成正比。'),
    flow('import', '進口', '點選國家，弧線連到它的前 15 大進口來源，線寬與進口金額成正比。'),
  ],
};
