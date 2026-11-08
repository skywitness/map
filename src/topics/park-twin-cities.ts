import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import type { CategoryDef, IndicatorDef, ListPanelDef, ListRow, PointRecord } from './types';

/**
 * 同一座城市的兩家樂園（2026-11-08，製作手冊第二十八批 686，候選 1538；pipeline/topics/park_twin_cities.py）：
 * 「樂園」主題（品牌據點，順序 632）的共用指標，「迪士尼」與「環球影城」各連過來（related.ts）。
 * 使用者的規則：標題不寫「vs.」「對決」，不做總分或排名，人次（迪士尼高）與恢復率（環球高）兩個都放，顏色用分類色、不用品牌色。
 */

const TWIN: CategoryDef[] = [
  { value: 1, label: { zh: '迪士尼與環球都有', en: 'Both Disney and Universal' } },
  { value: 2, label: { zh: '只有迪士尼', en: 'Disney only' } },
  { value: 3, label: { zh: '只有環球', en: 'Universal only' } },
];
/** 四組（pipeline 的 PAIRS 同樣的順序） */
const PAIRS: { title: Text; disney: Text; universal: Text }[] = [
  { title: { zh: '奧蘭多', en: 'Orlando' }, disney: { zh: '華特迪士尼世界', en: 'Walt Disney World' }, universal: { zh: '環球奧蘭多', en: 'Universal Orlando' } },
  { title: { zh: '洛杉磯', en: 'Los Angeles' }, disney: { zh: '加州迪士尼樂園度假區', en: 'Disneyland Resort' }, universal: { zh: '好萊塢環球影城', en: 'Universal Studios Hollywood' } },
  { title: { zh: '日本（東京與大阪）', en: 'Japan (Tokyo and Osaka)' }, disney: { zh: '東京迪士尼度假區', en: 'Tokyo Disney Resort' }, universal: { zh: '日本環球影城', en: 'Universal Studios Japan' } },
  { title: { zh: '中國（上海與北京）', en: 'China (Shanghai and Beijing)' }, disney: { zh: '上海迪士尼度假區', en: 'Shanghai Disney Resort' }, universal: { zh: '北京環球影城', en: 'Universal Studios Beijing' } },
];
const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);

function side(p: PointRecord, prefix: 'd' | 'u', name: Text): string {
  const n = num(p, `${prefix}n`) ?? 0;
  const years = String(p[`${prefix}y`] ?? '').split(',').filter(Boolean).join(tr({ zh: '、', en: ', ' }));
  const v24 = num(p, `${prefix}v24`);
  const v19 = num(p, `${prefix}v19`);
  const visits = v24
    ? tr({ zh: `2024 年 ${formatLargeNumber(v24)} 人次`, en: `${formatLargeNumber(v24)} visits in 2024` }) +
      (v19 ? tr({ zh: `（2019 年的 ${fixed((v24 / v19) * 100, 0)}%）`, en: ` (${fixed((v24 / v19) * 100, 0)}% of 2019)` }) : tr({ zh: '（2019 年還沒開）', en: ' (not open in 2019)' }))
    : '';
  return tr({ zh: `${tr(name)}：${n} 座主題樂園（${years} 年開）`, en: `${tr(name)}: ${n} theme park${n === 1 ? '' : 's'} (opened ${years})` }) + (visits ? tr({ zh: `，${visits}`, en: `, ${visits}` }) : '');
}

export const TWIN_LIST: ListPanelDef = {
  label: { zh: '同一座城市的兩家樂園', en: 'Two park brands in the same city' },
  tabLabel: { zh: '同城的兩家', en: 'Same city' },
  indicators: ['twin-brands'],
  file: 'twin-cities.json',
  rows: (points) =>
    points.map((p): ListRow => {
      const pair = PAIRS[(num(p, 'pair') ?? 1) - 1];
      return {
        key: String(p.pair),
        title: tr(pair.title),
        lines: [side(p, 'd', pair.disney), side(p, 'u', pair.universal)],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
      };
    }),
};

export const TWIN_INDICATOR: IndicatorDef = {
  id: 'twin-brands',
  label: { zh: '同一座城市的兩家樂園', en: 'Two park brands in the same city' },
  description: {
    zh: '迪士尼與環球影城在哪些國家都有營運中的主題樂園（類別圖；兩個品牌主題的白名單）。兩家都有的是美國、日本、中國，只有迪士尼的是法國與香港，只有環球的是新加坡；台灣兩家都沒有。左邊的清單是四組在同一座城市或同一個市場的樂園，只列事實、不比高下：奧蘭多（迪士尼 4 座、環球 3 座）、洛杉磯、日本（東京與大阪）、中國（上海與北京），每組寫兩邊的樂園數、開幕年、2024 年的人次與恢復率（只算主題樂園，人次是英文維基轉引的 TEA／AECOM 數字，史詩宇宙 2025 年才開、沒有 2024 年）。集團層級（同一篇維基的集團表，含水上樂園）：2024 年迪士尼 1.452 億人次、環球 5,898 萬（約四成）；但恢復率是環球高，2024 年是 2019 年的 115.1%，迪士尼 93.1%，環球的數字多了 2021 年開的北京。人次大不代表比較好，兩家的口徑也不同。',
    en: 'Countries where Disney and Universal have open theme parks (categorical; from the two brand topics’ hand-checked lists). Both are in the US, Japan and China; only Disney in France and Hong Kong; only Universal in Singapore; Taiwan has neither. The list shows four places where both are in the same city or market, as facts rather than a contest: Orlando (Disney 4 parks, Universal 3), Los Angeles, Japan (Tokyo and Osaka) and China (Shanghai and Beijing), each with park counts, opening years and 2024 attendance and recovery (theme parks only; attendance is TEA/AECOM figures as reproduced on English Wikipedia; Epic Universe opened in 2025 and has no 2024 figure). At group level (the group table in the same article, water parks included), Disney had 145.2 million visits in 2024 and Universal 58.98 million (about 40%), but Universal recovered more: 115.1% of 2019 against Disney’s 93.1%, partly because Universal added Beijing in 2021. Bigger attendance is not better, and the two groups are counted differently.',
  },
  unit: '',
  file: 'twin-brands.json',
  layer: { kind: 'categorical', categories: TWIN },
  format: (v) => tr(TWIN.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
  missing: { zh: '兩家都沒有', en: 'Neither' },
  unranked: true,
  defaultYear: 2026,
};
