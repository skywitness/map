import { tr } from '../i18n/lang';
import { classAt, loadClassGrid, type ClassGrid } from '../map/classGridData';
import { dataUrl } from '../lib/data';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 地表的岩石種類：GLiM（Hartmann & Moosdorf 2012）的 0.5° 網格（pipeline/topics/lithology.py）。
 * 地圖是類別網格（ClassGridOverlayDef，跟氣候分區同一種圖層），每格是那 0.5° 裡面積最多的岩類，代碼照 GLiM 的 Classnames.txt。
 */

type ZhEn = { zh: string; en: string };

/** 大類（group.json 的代碼 1–6），也是圖例的分組 */
export const GROUPS: { value: number; label: ZhEn }[] = [
  { value: 1, label: { zh: '未固結沉積物', en: 'Unconsolidated sediments' } },
  { value: 2, label: { zh: '沉積岩', en: 'Sedimentary rocks' } },
  { value: 3, label: { zh: '火山岩', en: 'Volcanic rocks' } },
  { value: 4, label: { zh: '深成岩', en: 'Plutonic rocks' } },
  { value: 5, label: { zh: '變質岩', en: 'Metamorphic rocks' } },
  { value: 6, label: { zh: '冰河', en: 'Ice and glaciers' } },
];

export interface RockClass {
  value: number;
  symbol: string;
  color: string;
  label: ZhEn;
  group: number;
}

/**
 * GLiM 的 14 類（代碼 11 水體、15 無資料不畫）。顏色自己定，照地質圖的慣例：沉積物與沉積岩是黃褐、
 * 碳酸鹽岩是藍、火山岩是紅橘、深成岩是洋紅與紫、變質岩是綠、冰河是淡藍灰
 */
export const CLASSES: RockClass[] = [
  { value: 1, symbol: 'su', color: '#f2e2a0', group: 1, label: { zh: '未固結沉積物', en: 'Unconsolidated sediments' } },
  { value: 3, symbol: 'ss', color: '#d9a55a', group: 2, label: { zh: '碎屑沉積岩', en: 'Siliciclastic sedimentary rocks' } },
  { value: 5, symbol: 'sm', color: '#b8946a', group: 2, label: { zh: '混合沉積岩', en: 'Mixed sedimentary rocks' } },
  { value: 6, symbol: 'sc', color: '#4f97c4', group: 2, label: { zh: '碳酸鹽沉積岩（石灰岩等）', en: 'Carbonate sedimentary rocks' } },
  { value: 14, symbol: 'ev', color: '#e48fc0', group: 2, label: { zh: '蒸發岩', en: 'Evaporites' } },
  { value: 12, symbol: 'py', color: '#f29a6b', group: 3, label: { zh: '火山碎屑岩', en: 'Pyroclastics' } },
  { value: 7, symbol: 'va', color: '#f4b2a6', group: 3, label: { zh: '酸性火山岩', en: 'Acid volcanic rocks' } },
  { value: 10, symbol: 'vi', color: '#e0654f', group: 3, label: { zh: '中性火山岩', en: 'Intermediate volcanic rocks' } },
  { value: 2, symbol: 'vb', color: '#a3322b', group: 3, label: { zh: '基性火山岩（玄武岩等）', en: 'Basic volcanic rocks' } },
  { value: 9, symbol: 'pa', color: '#d65a95', group: 4, label: { zh: '酸性深成岩（花崗岩等）', en: 'Acid plutonic rocks' } },
  { value: 13, symbol: 'pi', color: '#a35aa6', group: 4, label: { zh: '中性深成岩', en: 'Intermediate plutonic rocks' } },
  { value: 4, symbol: 'pb', color: '#6c3d8f', group: 4, label: { zh: '基性深成岩（輝長岩等）', en: 'Basic plutonic rocks' } },
  { value: 8, symbol: 'mt', color: '#5f9e6e', group: 5, label: { zh: '變質岩', en: 'Metamorphic rocks' } },
  { value: 16, symbol: 'ig', color: '#c5dbe6', group: 6, label: { zh: '冰河', en: 'Ice and glaciers' } },
];

const BY_CODE = new Map(CLASSES.map((c) => [c.value, c]));

export function rockOf(code: number | string | null): RockClass | null {
  return typeof code === 'number' ? (BY_CODE.get(code) ?? null) : null;
}

export function rockName(code: number | string | null): string {
  const c = rockOf(code);
  return c ? tr(c.label) : tr({ zh: '無資料', en: 'No data' });
}

// ── 游標下的岩類：用地圖上同一張網格（loadClassGrid 同一個網址只讀一次） ──────────
let grid: ClassGrid | null = null;
let requested = false;

function remember(): string {
  if (!requested) {
    requested = true;
    loadClassGrid(dataUrl('topics/lithology/grid.png')).then(
      (g) => {
        grid = g;
      },
      () => {
        requested = false;
      },
    );
  }
  return 'grid.png';
}

const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;
const SHARE_SCALE = { kind: 'choropleth' as const, scale: { type: 'sequential' as const, thresholds: [1, 5, 10, 20, 35, 50] } };

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '岩石種類地圖', en: 'Rock type map' },
    description: {
      zh: '全球地表岩石種類的 0.5° 網格（約 50 公里）：每一格是那裡面積最多的岩類，GLiM 分成 16 類（這裡畫 14 類，大湖與無資料不畫）。黃褐是沉積物與沉積岩、藍是石灰岩這類碳酸鹽岩、紅橘是火山岩、洋紅與紫是花崗岩這類深成岩、綠是變質岩、淡藍灰是冰河。滑到任一點看那裡的岩類；國家不上色，滑到國家上看面積最大的岩類。',
      en: 'Rock types at the Earth’s surface on a 0.5° grid (about 50 km): each cell shows the lithology covering the most of it, from the 16 GLiM classes (14 drawn here; large lakes and no-data cells are left blank). Tans are sediments and sedimentary rocks, blue is carbonate rock such as limestone, reds and oranges are volcanic rocks, magentas and purples are plutonic rocks such as granite, green is metamorphic rock and pale blue-grey is ice. Hover anywhere for the local rock type; countries are not coloured, so hover over one for its most widespread type.',
    },
    unit: '',
    file: 'main.json',
    layer: { kind: 'none' },
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: (v) => tr({ zh: `面積最大：${rockName(v)}`, en: `Most widespread: ${rockName(v)}` }),
  },
  {
    id: 'group',
    label: { zh: '主要岩類', en: 'Main rock group' },
    description: {
      zh: '國土面積最大的岩石大類：未固結沉積物（沖積平原、沙漠的沙、冰磧）、沉積岩（砂岩、頁岩、石灰岩、蒸發岩）、火山岩、深成岩（在地下冷卻的岩漿，例如花崗岩）、變質岩、冰河。依 0.5° 網格的面積算。',
      en: 'The rock group covering the largest share of the country: unconsolidated sediments (alluvial plains, desert sand, glacial till), sedimentary rocks (sandstone, shale, limestone, evaporites), volcanic rocks, plutonic rocks (magma that cooled underground, such as granite), metamorphic rocks, or ice. By area on the 0.5° grid.',
    },
    unit: '',
    file: 'group.json',
    layer: { kind: 'categorical', categories: GROUPS.map((g) => ({ value: g.value, label: g.label })) },
    panelChart: false,
    format: (v) => (typeof v === 'number' ? tr(GROUPS[v - 1]?.label ?? { zh: '無資料', en: 'No data' }) : ''),
  },
  {
    id: 'carbonate',
    label: { zh: '碳酸鹽岩的比例', en: 'Carbonate rock share' },
    description: {
      zh: '國土裡碳酸鹽沉積岩（石灰岩、白雲岩）的面積比例：會被水溶蝕，形成喀斯特地形（溶洞、天坑、石林）與地下水豐富的含水層。依 0.5° 網格的面積算，每格只取面積最多的岩類，零星分布的會被吃掉。',
      en: 'Share of the country underlain by carbonate sedimentary rocks (limestone, dolomite), which dissolve in water to form karst landscapes (caves, sinkholes, stone forests) and rich aquifers. By area on the 0.5° grid; each cell takes only its dominant rock type, so scattered outcrops are missed.',
    },
    unit: '%',
    file: 'carbonate.json',
    layer: SHARE_SCALE,
    format: pct,
  },
  {
    id: 'volcanic',
    label: { zh: '火山岩的比例', en: 'Volcanic rock share' },
    description: {
      zh: '國土裡火山岩（玄武岩、安山岩、流紋岩與火山碎屑岩）的面積比例。依 0.5° 網格的面積算。',
      en: 'Share of the country covered by volcanic rocks (basalt, andesite, rhyolite and pyroclastics). By area on the 0.5° grid.',
    },
    unit: '%',
    file: 'volcanic.json',
    layer: SHARE_SCALE,
    format: pct,
  },
  {
    id: 'unconsolidated',
    label: { zh: '未固結沉積物的比例', en: 'Unconsolidated sediment share' },
    description: {
      zh: '國土裡未固結沉積物（河流沖積、沙漠的沙丘、冰河留下的冰磧、海岸的沙泥）的面積比例：大河的平原與沙漠最高。依 0.5° 網格的面積算。',
      en: 'Share of the country covered by unconsolidated sediments (river alluvium, desert dunes, glacial till, coastal sand and mud); highest in great river plains and deserts. By area on the 0.5° grid.',
    },
    unit: '%',
    file: 'unconsolidated.json',
    layer: SHARE_SCALE,
    format: pct,
  },
];

export const lithology: TopicDefinition = {
  id: 'lithology',
  title: { zh: '地表的岩石種類', en: 'Surface rock types' },
  shortTitle: { zh: '岩石種類', en: 'Rock types' },
  defaultIndicator: 'map',
  defaultYear: 2012,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Hartmann & Moosdorf 2012，全球岩性圖資料庫 GLiM v1.0（0.5° 網格版，PANGAEA）',
        en: 'Hartmann & Moosdorf 2012, Global Lithological Map Database GLiM v1.0 (gridded to 0.5°, PANGAEA)',
      },
      url: 'https://doi.org/10.1594/PANGAEA.788537',
      license: 'CC BY 3.0',
    },
  ],
  note: {
    zh: '資料是 Hartmann 與 Moosdorf 2012 年發表的全球岩性圖 GLiM（Global Lithological Map），由 92 份各國與區域的地質圖整合成約 120 萬個多邊形（平均約 1:375 萬），這裡用作者在 PANGAEA 公開的 0.5° 網格版：每一格只取面積最多的岩類，小島與窄的山脈會被吃掉，台灣只有 13 格（碎屑沉積岩 7、未固結沉積物 4、混合沉積岩 1、變質岩 1），中央山脈的板岩、大屯火山群看不出來。完整版的多邊形沒有公開下載。分類是地表或接近地表的岩石（不是地底深處），沉積物包括冰河、河流與風留下的鬆散堆積；冰河類是格子最多的一類（南極洲、格陵蘭）。國家的值依格子的面積（依緯度加權），格子中心歸到國家（Natural Earth 1:10m；不在國界內的找最近的國家），新加坡等小國沒有格子。顏色是這個網站自己定的，照地質圖的慣例。',
    en: 'The data are GLiM (Global Lithological Map) by Hartmann and Moosdorf (2012), which merged 92 national and regional geological maps into about 1.2 million polygons (on average about 1:3.75 million). Shown here is the 0.5° grid the authors published on PANGAEA: each cell keeps only its dominant rock type, so small islands and narrow mountain ranges vanish. Taiwan has just 13 cells (7 siliciclastic sedimentary, 4 unconsolidated, 1 mixed sedimentary, 1 metamorphic), so the slates of the Central Range and the Tatun volcanoes do not show. The full polygon map is not publicly downloadable. Classes describe rocks at or near the surface, not deep below; sediments include loose deposits left by ice, rivers and wind, and ice is the class with the most cells (Antarctica, Greenland). Country values use cell area (weighted by latitude), each cell assigned to the country containing its centre (Natural Earth 1:10m, or the nearest one); small countries such as Singapore get no cells. Colours are this site’s own, following geological-map conventions.',
  },
  panelExtra: () => import('./panels/LithologyPanel'),
  pointer: ([lon, lat]) => {
    if (!grid) return null;
    const code = classAt(grid, lon, lat);
    if (!code || !BY_CODE.has(code)) return null;
    return { title: tr({ zh: '這裡的岩石', en: 'Rock here' }), lines: [tr({ zh: `這裡：${rockName(code)}`, en: `Here: ${rockName(code)}` })] };
  },
  overlays: [
    {
      kind: 'classGrid',
      id: 'lithology',
      label: { zh: '岩石種類（0.5° 網格）', en: 'Rock types (0.5° grid)' },
      file: () => remember(),
      classes: CLASSES.map((c) => ({ value: c.value, color: c.color, short: c.symbol, label: c.label, group: c.group - 1 })),
      groups: GROUPS.map((g) => g.label),
      opacity: 0.85,
      indicators: ['map'],
    },
  ],
  indicators,
};
