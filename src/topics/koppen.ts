import { tr } from '../i18n/lang';
import { classAt, loadClassGrid, type ClassGrid } from '../map/classGridData';
import { dataUrl } from '../lib/data';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 氣候分區（柯本）：Beck 等人 2023 的柯本－蓋格氣候分類圖，0.1° 網格（pipeline/topics/koppen.py）。
 * 地圖是類別網格（ClassGridOverlayDef，src/map/classGridLayer.ts），30 種類型用 Beck 的顏色；
 * 時間軸是 6 個 30 年的時期（年份是時期的第一年），未來的兩個時期依子項目（SSP2-4.5、SSP5-8.5）。
 */

const FUTURE_FROM = 2041;
const PERIOD_END: Record<number, number> = { 1901: 1930, 1931: 1960, 1961: 1990, 1991: 2020, 2041: 2070, 2071: 2099 };
export const BASE_PERIOD = 1991;

export function periodText(year: number): string {
  return `${year}–${PERIOD_END[year] ?? year + 29}`;
}

/** 網格檔的名稱：歷史時期只有一份，未來的時期依情境 */
export function periodKey(year: number, item: string | null): string {
  return year < FUTURE_FROM ? String(year) : `${year}-${item ?? 'ssp245'}`;
}

/** 兩種語言都有的文字（組合名稱時要分別取） */
type ZhEn = { zh: string; en: string };

/** 氣候帶 A–E（group/{item}.json 的代碼 1–5） */
export const GROUPS: { value: number; letter: string; label: ZhEn }[] = [
  { value: 1, letter: 'A', label: { zh: '熱帶', en: 'Tropical' } },
  { value: 2, letter: 'B', label: { zh: '乾燥', en: 'Arid' } },
  { value: 3, letter: 'C', label: { zh: '溫帶', en: 'Temperate' } },
  { value: 4, letter: 'D', label: { zh: '冷溫帶', en: 'Cold' } },
  { value: 5, letter: 'E', label: { zh: '極地', en: 'Polar' } },
];

const SEASON: Record<string, ZhEn> = {
  s: { zh: '夏季乾燥', en: 'dry summer' },
  w: { zh: '冬季乾燥', en: 'dry winter' },
  f: { zh: '全年有雨', en: 'no dry season' },
};
const SUMMER: Record<string, ZhEn> = {
  a: { zh: '夏季炎熱', en: 'hot summer' },
  b: { zh: '夏季溫暖', en: 'warm summer' },
  c: { zh: '夏季涼爽', en: 'cold summer' },
  d: { zh: '冬季酷寒', en: 'very cold winter' },
};

/** C、D 類的名稱由第二、三個字母組成：「溫帶，冬季乾燥，夏季炎熱」 */
function composed(symbol: string, group: ZhEn): ZhEn {
  const s = SEASON[symbol[1]];
  const t = SUMMER[symbol[2]];
  return { zh: `${group.zh}，${s.zh}，${t.zh}`, en: `${group.en}, ${s.en}, ${t.en}` };
}

/**
 * 30 種類型（pipeline 的 CLASSES，代碼 1–30）：符號、名稱、Beck 2023 用的顏色。
 * 顏色照 Beck（柯本分類圖慣用的配色，藍是熱帶、紅橘黃是乾燥、綠是溫帶、紫與青是冷溫帶、灰是極地），
 * 不是網站的類別色：30 類分不完，照慣例比較好對照其他的柯本分類圖
 */
const RAW: [string, string, ZhEn | null][] = [
  ['Af', '#0000ff', { zh: '熱帶雨林', en: 'Tropical rainforest' }],
  ['Am', '#0078ff', { zh: '熱帶季風', en: 'Tropical monsoon' }],
  ['Aw', '#46aafa', { zh: '熱帶莽原', en: 'Tropical savanna' }],
  ['BWh', '#ff0000', { zh: '沙漠，炎熱', en: 'Hot desert' }],
  ['BWk', '#ff9696', { zh: '沙漠，寒冷', en: 'Cold desert' }],
  ['BSh', '#f5a500', { zh: '半乾燥草原，炎熱', en: 'Hot steppe' }],
  ['BSk', '#ffdc64', { zh: '半乾燥草原，寒冷', en: 'Cold steppe' }],
  ['Csa', '#ffff00', null],
  ['Csb', '#c8c800', null],
  ['Csc', '#969600', null],
  ['Cwa', '#96ff96', null],
  ['Cwb', '#64c864', null],
  ['Cwc', '#329632', null],
  ['Cfa', '#c8ff50', null],
  ['Cfb', '#64ff50', null],
  ['Cfc', '#32c800', null],
  ['Dsa', '#ff00ff', null],
  ['Dsb', '#c800c8', null],
  ['Dsc', '#963296', null],
  ['Dsd', '#966496', null],
  ['Dwa', '#aaafff', null],
  ['Dwb', '#5a78dc', null],
  ['Dwc', '#4b50b4', null],
  ['Dwd', '#320087', null],
  ['Dfa', '#00ffff', null],
  ['Dfb', '#37c8ff', null],
  ['Dfc', '#007d7d', null],
  ['Dfd', '#00465f', null],
  ['ET', '#b2b2b2', { zh: '苔原', en: 'Tundra' }],
  ['EF', '#666666', { zh: '冰原', en: 'Ice cap' }],
];

export interface KoppenClass {
  value: number;
  symbol: string;
  color: string;
  label: ZhEn;
  group: number;
}

export const CLASSES: KoppenClass[] = RAW.map(([symbol, color, label], i) => {
  const group = 'ABCDE'.indexOf(symbol[0]) + 1;
  return { value: i + 1, symbol, color, group, label: label ?? composed(symbol, GROUPS[group - 1].label) };
});

export function classOf(code: number | string | null): KoppenClass | null {
  return typeof code === 'number' ? (CLASSES[code - 1] ?? null) : null;
}

/** 「Cfa 溫帶，全年有雨，夏季炎熱」 */
export function className(code: number | string | null): string {
  const c = classOf(code);
  return c ? `${c.symbol} ${tr(c.label)}` : tr({ zh: '無資料', en: 'No data' });
}

export function groupName(code: number | string | null): string {
  const g = typeof code === 'number' ? GROUPS[code - 1] : undefined;
  return g ? `${g.letter} ${tr(g.label)}` : '';
}

// ── 游標下的類型：用地圖上同一張網格（loadClassGrid 同一個網址只讀一次） ──────────
let current: { key: string; grid: ClassGrid | null } = { key: '', grid: null };

function gridUrl(key: string): string {
  return dataUrl(`topics/koppen/grid/${key}.png`);
}

/** 地圖換時期時記下目前的網格（pointer 拿不到年份與子項目，跟著 overlay 的 file() 走） */
function remember(key: string): string {
  if (current.key !== key) {
    current = { key, grid: null };
    loadClassGrid(gridUrl(key)).then(
      (grid) => {
        if (current.key === key) current = { key, grid };
      },
      () => {},
    );
  }
  return `grid/${key}.png`;
}

/** 時間軸的年份是 30 年時期的第一年：時間軸上寫「時期起始年」，tooltip、側欄、排名表寫「1991–2020」 */
const PERIOD_AXIS = { label: { zh: '時期起始年', en: 'Period from' }, year: periodText };
/** 2041 年以後是推估；之前的時期是觀測，不標「估計值」 */
const PROJECTED = {
  tag: { zh: '推估', en: 'projection' },
  from: (year: number) => tr({ zh: `${year} 起為推估`, en: `Projections from ${year}` }),
};

const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '氣候分區地圖', en: 'Climate zone map' },
    description: {
      zh: '柯本－蓋格氣候分類的 0.1° 網格（約 10 公里）：依氣溫與降雨的季節變化分成 30 種類型，顏色照 Beck 等人 2023 的配色（藍是熱帶、紅橘黃是乾燥、綠是溫帶、紫與青是冷溫帶、灰是極地）。滑到任一點看那裡的類型；國家不上色，滑到國家上看面積最大的類型。時間軸是 30 年的時期，2041 年以後是推估（在上面選排放情境）。',
      en: 'The Köppen–Geiger climate classification on a 0.1° grid (about 10 km): 30 types based on the seasonal pattern of temperature and precipitation, in the colours used by Beck et al. (2023) (blues tropical, reds, oranges and yellows arid, greens temperate, purples and cyans cold, greys polar). Hover anywhere for the local type; countries are not coloured, so hover over one for its most widespread type. The time slider steps through 30-year periods; from 2041 on they are projections (choose an emissions scenario above).',
    },
    unit: '',
    file: 'main/{item}.json',
    layer: { kind: 'none' },
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: (v) => tr({ zh: `面積最大：${className(v)}`, en: `Most widespread: ${className(v)}` }),
    timeAxis: PERIOD_AXIS,
    projectionLabel: PROJECTED,
  },
  {
    id: 'group',
    label: { zh: '主要氣候帶', en: 'Main climate group' },
    description: {
      zh: '國土面積最大的氣候帶：A 熱帶（最冷月 18°C 以上）、B 乾燥（降雨少於蒸發）、C 溫帶、D 冷溫帶（最冷月 0°C 以下、最暖月 10°C 以上）、E 極地（最暖月 10°C 以下）。依 0.1° 網格的面積算。',
      en: 'The climate group covering the largest share of the country: A tropical (coldest month 18°C or warmer), B arid (precipitation below evaporation), C temperate, D cold (coldest month below 0°C, warmest above 10°C), E polar (warmest month below 10°C). By area on the 0.1° grid.',
    },
    unit: '',
    file: 'group/{item}.json',
    layer: {
      kind: 'categorical',
      categories: GROUPS.map((g) => ({ value: g.value, label: { zh: `${g.letter} ${g.label.zh}`, en: `${g.letter} ${g.label.en}` } })),
    },
    panelChart: false,
    format: (v) => groupName(v),
    timeAxis: PERIOD_AXIS,
    projectionLabel: PROJECTED,
  },
  {
    id: 'changed',
    label: { zh: '跟 1991–2020 年不同', en: 'Changed since 1991–2020' },
    description: {
      zh: '國土裡氣候類型跟 1991–2020 年不同的面積比例：2041 年以後是暖化後會換成另一種類型的範圍（例如溫帶變熱帶、冷溫帶變溫帶），1990 年以前是當時跟現在不同的範圍。依 0.1° 網格的面積算。',
      en: 'Share of the country whose climate type differs from 1991–2020: from 2041 on, the area that warming would shift to another type (temperate to tropical, cold to temperate and so on); before 1990, the area where the type then differed from today. By area on the 0.1° grid.',
    },
    unit: '%',
    file: 'changed/{item}.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 40, 60] } },
    format: pct,
    timeAxis: PERIOD_AXIS,
    projectionLabel: PROJECTED,
  },
];

export const koppen: TopicDefinition = {
  id: 'koppen',
  title: { zh: '氣候分區（柯本）', en: 'Köppen climate zones' },
  shortTitle: { zh: '氣候分區', en: 'Climate zones' },
  defaultIndicator: 'map',
  defaultYear: BASE_PERIOD,
  dimension: {
    label: { zh: '排放情境（2041 年以後）', en: 'Scenario (from 2041)' },
    options: [
      { id: 'ssp245', label: { zh: '中度排放（SSP2-4.5）', en: 'Intermediate (SSP2-4.5)' } },
      { id: 'ssp585', label: { zh: '高排放（SSP5-8.5）', en: 'Very high (SSP5-8.5)' } },
    ],
    defaultOption: 'ssp245',
  },
  sources: [
    {
      name: {
        zh: 'Beck 等人 2023，1901–2099 年的高解析度柯本－蓋格分類圖（Scientific Data 10, 724；figshare v2）',
        en: 'Beck et al. 2023, High-resolution Köppen-Geiger maps for 1901–2099 (Scientific Data 10, 724; figshare v2)',
      },
      url: 'https://doi.org/10.6084/m9.figshare.21789074',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '資料是 Beck 等人 2023 年發表、2026 年 1 月更正一個小計算錯誤後更新（figshare 第 2 版）的柯本－蓋格氣候分類圖，這裡用 0.1° 網格（約 10 公里；原始有 1 公里的版本）。歷史時期用以觀測為基礎的高解析度氣候資料（月均溫與月降雨），未來時期用降尺度、校正偏差後的 CMIP6 氣候模式推估（評估 67 個模式，留下二氧化碳造成的暖化速率最合理的 42 個），這裡取 SSP2-4.5（中度排放）與 SSP5-8.5（高排放）兩個情境。Beck 等人估計，1901–1930 到 1991–2020 年全球約 5% 的陸地（不含南極洲）換到另一個主要氣候帶；1991–2020 到 2071–2099 年 SSP2-4.5 約 8%、SSP5-8.5 約 13%。分類用柯本－蓋格的標準規則（熱帶最冷月 18°C 以上；溫帶與冷溫帶以最冷月 0°C 為界；乾燥依年降雨與氣溫算的門檻）。1901–1930 年的觀測少，誤差比近年大。國家的值依 0.1° 格子的面積（依緯度加權），格子中心歸到國家（Natural Earth 1:10m；不在國界內的找 0.3° 內最近的國家），太小的島國只有一兩格。顏色照 Beck 等人的配色，有幾組顏色相近（例如 Cfb 與 Cwa），滑過看名稱。',
    en: 'The data are the Köppen–Geiger maps of Beck et al. (2023), updated in January 2026 to correct a small calculation error (figshare version 2), used here on the 0.1° grid (about 10 km; a 1 km version also exists). Historical periods use high-resolution, observation-based climatologies of monthly temperature and precipitation; future periods use downscaled, bias-corrected CMIP6 climate projections (67 models evaluated, keeping the 42 with the most plausible CO2-induced warming rates), shown here under SSP2-4.5 (intermediate emissions) and SSP5-8.5 (very high). Beck et al. estimate that about 5% of the global land surface (excluding Antarctica) moved to a different major climate group from 1901–1930 to 1991–2020, and that from 1991–2020 to 2071–2099 about 8% will under SSP2-4.5 and 13% under SSP5-8.5. The classification follows the standard Köppen–Geiger rules (tropical: coldest month 18°C or warmer; temperate and cold split at a coldest month of 0°C; arid from thresholds based on annual precipitation and temperature). Observations before 1930 are sparse, so early maps are less certain. Country values use the area of 0.1° cells (weighted by latitude), each assigned to the country containing its centre (Natural Earth 1:10m, or the nearest within 0.3°); very small island nations cover only a cell or two. Colours follow Beck et al.; a few pairs look alike (Cfb and Cwa, for example), so hover for the name.',
  },
  panelExtra: () => import('./panels/KoppenPanel'),
  pointer: ([lon, lat]) => {
    const grid = current.grid;
    if (!grid) return null;
    const code = classAt(grid, lon, lat);
    if (!code) return null;
    return { title: tr({ zh: '這裡的氣候', en: 'Climate here' }), lines: [tr({ zh: `這裡：${className(code)}`, en: `Here: ${className(code)}` })] };
  },
  overlays: [
    {
      kind: 'classGrid',
      id: 'koppen',
      label: { zh: '氣候分區（0.1° 網格）', en: 'Climate zones (0.1° grid)' },
      file: (year, item) => remember(periodKey(year, item)),
      classes: CLASSES.map((c) => ({ value: c.value, color: c.color, short: c.symbol, label: c.label, group: c.group - 1 })),
      groups: GROUPS.map((g) => ({ zh: `${g.letter} ${g.label.zh}`, en: `${g.letter} ${g.label.en}` })),
      opacity: 0.9,
      indicators: ['map'],
    },
  ],
  indicators,
};
