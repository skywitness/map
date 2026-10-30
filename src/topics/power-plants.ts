import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, PointRecord, PointsOverlayDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 發電廠地圖（pipeline/topics/power_plants.py）：Global Energy Monitor 的 Global Integrated Power Tracker，2026 年 9 月版。
 * 地圖上的點是一座電廠的同一種燃料（機組加總），只畫 20 MW 以上的；國家的統計含所有電廠。
 * 資料是那個時間點的狀態（運轉中、興建中…），所以只有一個年份，標成 2026 年（跟交通、語言主題一樣），
 * 不用 timeless：這不是不隨時間變的資料（海拔），標題、CSV 寫出年份才知道是哪一年的狀態，GEM 改版後也能再加一年。
 */

/**
 * 燃料：代碼跟 pipeline 的 FUELS 一致，順序跟發電量主題的發電結構一樣（化石燃料、核能、再生能源）。
 * 顏色取自 MAP_TOKENS.categorical：任兩色在一般視覺與紅、綠色盲下都分得開（第 5 節），跟藍色的海也分得開；
 * 地圖上任兩種電廠都可能挨在一起，所以用地圖的 8 色、不用圖表的類別色。
 * 依直覺配：燃煤深褐（鏽紅）、燃氣淡紫（發電結構的燃氣也是紫）、核能紫、水力薄荷綠（最接近水的顏色，
 * 藍色會跟海混在一起）、風力洋紅（同發電結構）、太陽能琥珀（就是發電結構淺色介面的太陽能色）、生質能綠（同發電結構）、
 * 地熱淡黃。太陽能的點最多，淡黃（#f0e442）在彩色地形底圖的淺色陸地上幾乎看不見（實測），所以給琥珀，淡黃給點很少的地熱。
 */
export const FUELS: { id: string; code: number; label: Text; color: string }[] = [
  { id: 'coal', code: 1, label: { zh: '燃煤', en: 'Coal' }, color: MAP_TOKENS.categorical[5] },
  { id: 'oil-gas', code: 2, label: { zh: '燃氣與燃油', en: 'Gas and oil' }, color: MAP_TOKENS.categorical[1] },
  { id: 'nuclear', code: 3, label: { zh: '核能', en: 'Nuclear' }, color: MAP_TOKENS.categorical[6] },
  { id: 'hydro', code: 4, label: { zh: '水力', en: 'Hydro' }, color: MAP_TOKENS.categorical[0] },
  { id: 'wind', code: 5, label: { zh: '風力', en: 'Wind' }, color: MAP_TOKENS.categorical[7] },
  { id: 'solar', code: 6, label: { zh: '太陽能', en: 'Solar' }, color: MAP_TOKENS.categorical[2] },
  { id: 'bioenergy', code: 7, label: { zh: '生質能', en: 'Bioenergy' }, color: MAP_TOKENS.categorical[3] },
  { id: 'geothermal', code: 8, label: { zh: '地熱', en: 'Geothermal' }, color: MAP_TOKENS.categorical[4] },
];
export const fuelByCode = (code: number | string | null) => FUELS.find((f) => f.code === code);

/** 狀態代碼（pipeline 的 STATUS）：規劃中的圖層含籌備中與已宣布，已退役的圖層含封存，點上有 st 欄位 */
export const STATUS: Record<number, Text> = {
  1: { zh: '運轉中', en: 'Operating' },
  2: { zh: '興建中', en: 'Under construction' },
  3: { zh: '籌備中', en: 'Pre-construction' },
  4: { zh: '已宣布', en: 'Announced' },
  5: { zh: '已退役', en: 'Retired' },
  6: { zh: '封存', en: 'Mothballed' },
};

/** 國家的容量（GW）：1 GW 以上寫 GW，以下改寫 MW */
export function gw(v: number): string {
  if (Math.abs(v) >= 1) return `${fixed(v, v >= 100 ? 0 : v >= 10 ? 1 : 2)} GW`;
  const mw = v * 1000;
  return `${fixed(mw, mw === 0 || mw >= 10 ? 0 : 1)} MW`;
}
const gwTick = (v: number) => (v >= 1 ? `${fixed(v, v % 1 === 0 ? 0 : 1)} GW` : `${fixed(v * 1000, 0)} MW`);
/** 電廠的容量（MW） */
export const mw = (v: number) => `${fixed(v, v < 10 ? 1 : 0)} MW`;
const mwTick = (v: number) => (v >= 1000 ? `${fixed(v / 1000, 0)} GW` : `${fixed(v, 0)} MW`);
const pct = (v: number) => `${fixed(v, v > 0 && v < 1 ? 2 : 1)}%`;
const pctTick = (v: number) => `${v}%`;

const FUEL_CLASSES: ColorClasses = {
  field: 'fuel',
  title: { zh: '能源', en: 'Energy source' },
  thresholds: FUELS.slice(1).map((f) => f.code - 0.5),
  classes: FUELS.map((f) => ({ color: f.color, label: f.label })),
};

/**
 * 半徑（px，縮放 2 時）：100 MW 以上半徑 ≈ 0.1 × √MW，面積與容量成正比（三峽 22,500 MW 約 15 px，
 * 興建中的墨脫 60,000 MW 約 24 px）；20–100 MW 放大到 1–1.3 px，世界全圖時才看得見。
 */
const MW_STOPS: [number, number][] = [
  [20, 1],
  [100, 1.3],
  [300, 1.9],
  [1000, 3.2],
  [3000, 5.5],
  [10000, 10],
  [25000, 15.8],
  [60000, 24.5],
];
const SIZE_LEGEND = { title: { zh: '裝置容量', en: 'Capacity' }, values: [100, 1000, 5000, 20000], format: mwTick };

/** 啟用年份：多個機組時寫範圍；興建中、規劃中是預計的年份 */
function years(p: PointRecord, status: number): string | null {
  const start = typeof p.start === 'number' ? p.start : null;
  const last = typeof p.last === 'number' ? p.last : null;
  if (status === 5 || status === 6) {
    const ret = typeof p.ret === 'number' ? p.ret : null;
    if (status === 5 && ret) return tr({ zh: `${ret} 年退役`, en: `retired ${ret}` });
    return start ? tr({ zh: `${start} 年啟用`, en: `opened ${start}` }) : null;
  }
  if (!start) return null;
  const span = last ? `${start}–${last}` : String(start);
  if (status === 1) return tr({ zh: `${span} 年啟用`, en: `opened ${span}` });
  return tr({ zh: `預計 ${span} 年啟用`, en: `expected ${span}` });
}

/** 電廠的 tooltip：「燃煤 · 5,500 MW」，第二行狀態、年份、國家，最後是 GEM 的英文原名 */
function plantTooltip(status: number) {
  return (p: PointRecord, ctx: { countryName: (iso3: string) => string }) => {
    const fuel = fuelByCode(p.fuel);
    const st = typeof p.st === 'number' ? p.st : status;
    const parts = [tr(STATUS[st] ?? STATUS[status]), years(p, st), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null];
    return {
      title: `${fuel ? tr(fuel.label) : ''}${typeof p.mw === 'number' ? ` · ${mw(p.mw)}` : ''}`,
      detail: parts.filter(Boolean).join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  };
}

/**
 * 四個狀態各一個點圖層，顏色、大小、圖例共用（同一組分級說明只列在第一個打開的圖層下面）。
 * 狀態用不同樣式（2026-10-30 起，PointsOverlayDef.look）：運轉中實心、興建中空心粗框、規劃中空心細框、退役灰色，
 * 同時打開時分得出來。
 * 不設 sortField：檔案依容量由大到小排，MapLibre 照資料順序畫，小電廠畫在大電廠上面，
 * 大電廠的圓才不會把範圍裡的小電廠整個蓋掉（比例符號地圖的慣例）。
 */
const plantLayer = (id: string, label: Text, status: number, hidden: boolean, look?: PointsOverlayDef['look']): PointsOverlayDef => ({
  kind: 'points',
  id: `plants-${id}`,
  file: `plants-${id}.json`,
  label,
  ...(hidden ? { hidden: true } : {}),
  ...(look ? { look } : {}),
  radius: { field: 'mw', stops: MW_STOPS },
  color: FUEL_CLASSES,
  sizeLegend: SIZE_LEGEND,
  tooltip: plantTooltip(status),
});

/**
 * 運轉中的電廠：發電量主題也拿來當預設關閉的疊加圖層（`{ ...OPERATING_PLANTS, topic: 'power-plants', hidden: true }`），
 * 所以這裡不寫 indicators。
 */
export const OPERATING_PLANTS: PointsOverlayDef = plantLayer(
  'operating',
  { zh: '運轉中的電廠（20 MW 以上）', en: 'Operating power plants (20 MW+)' },
  1,
  false,
);

/** 電廠的點只畫在「發電廠地圖」：比例圓、面量圖上再疊幾萬個彩色的點會看不清楚 */
const PLANT_INDICATORS = ['plants'];

const TOTALS = { zh: '合計', en: 'Totals' };
const FOSSIL_GROUP = { zh: '化石燃料', en: 'Fossil fuels' };
const LOW_CARBON = { zh: '核能與再生能源', en: 'Nuclear and renewables' };

/** 各燃料占總容量的分級門檻：各燃料的比例差很多（地熱最多 30%、燃氣可以到 100%） */
const seq = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });
const SHARE_SCALES: Record<string, ScaleSpec> = {
  coal: seq([5, 10, 20, 30, 50, 70]),
  'oil-gas': seq([10, 20, 40, 60, 80, 90]),
  nuclear: seq([1, 5, 10, 20, 30, 40]),
  hydro: seq([5, 10, 20, 40, 60, 80]),
  wind: seq([1, 2, 5, 10, 20, 30]),
  solar: seq([1, 2, 5, 10, 20, 40]),
  bioenergy: seq([0.5, 1, 2, 5, 10, 20]),
  geothermal: seq([0.1, 0.5, 1, 5, 10, 20]),
  renewables: seq([10, 20, 30, 50, 70, 90]),
  fossil: seq([10, 30, 50, 70, 80, 90]),
};

const GW_UNIT = 'GW';

const indicators: IndicatorDef[] = [
  {
    id: 'plants',
    label: { zh: '發電廠地圖', en: 'Power plant map' },
    description: {
      zh: '全球 20 MW 以上的發電廠：顏色是能源，圓的面積與裝置容量成正比。預設只畫運轉中的，左下角可以打開興建中、規劃中與已退役的電廠（第一次打開才下載；它們的顏色跟運轉中的一樣，關掉運轉中的就只看得到它們）。滑鼠移到電廠上可看名稱與容量，移到國家上可看運轉中的總容量（含 20 MW 以下的電廠）。',
      en: 'Power plants of 20 MW or more worldwide: colour shows the energy source and circle area is proportional to capacity. Only operating plants are shown at first; use the layers at the bottom left to add plants under construction, planned or retired (downloaded the first time you turn them on; they use the same colours, so turn off operating plants to see them on their own). Hover over a plant for its name and capacity, or over a country for its total operating capacity (including plants under 20 MW).',
    },
    unit: GW_UNIT,
    file: 'capacity.json',
    layer: { kind: 'none' },
    format: (v) => tr({ zh: `運轉中 ${gw(v)}`, en: `${gw(v)} operating` }),
    formatTick: gwTick,
  },
  {
    id: 'capacity',
    label: { zh: '總裝置容量', en: 'Total capacity' },
    description: {
      zh: 'GEM 收錄的運轉中電廠的裝置容量合計（1 GW = 1,000 MW = 100 萬瓩）。圓的面積與容量成正比。不含屋頂型太陽能與低於收錄門檻的小型機組，所以比各國官方的統計少，太陽能多的國家差最多。',
      en: 'Combined capacity of the operating power plants in GEM’s tracker (1 GW = 1,000 MW). Circle area is proportional to capacity. Rooftop solar and small units below the tracker’s thresholds are not included, so totals are lower than official statistics, most of all in countries with a lot of solar.',
    },
    unit: GW_UNIT,
    file: 'capacity.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    format: gw,
    formatTick: gwTick,
    shareOfWorld: true,
  },
  {
    id: 'capacity-fuel',
    label: { zh: '裝置容量', en: 'Capacity' },
    description: {
      zh: '這種能源運轉中的電廠裝置容量合計，圓的面積與容量成正比。水力含抽蓄水力；再生能源合計不含純抽蓄（抽蓄是儲能）；太陽能只有 1 MW 以上的地面型案場。',
      en: 'Combined capacity of operating plants using this source; circle area is proportional to capacity. Hydro includes pumped storage; the renewables total excludes pure pumped storage, which is storage rather than generation; solar covers only ground-mounted farms of 1 MW or more.',
    },
    unit: GW_UNIT,
    file: 'capacity/{item}.json',
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: gw,
    formatTick: gwTick,
    shareOfWorld: true,
  },
  {
    id: 'share',
    label: { zh: '占總容量比例', en: 'Share of total capacity' },
    description: {
      zh: '這種能源占運轉中裝置容量的比例（容量不是發電量：太陽能、風力的容量因數低，占發電量的比例會低很多）。GEM 收錄的總容量不到 100 MW 的國家（多半是小島國，柴油機組低於收錄門檻）不計算。',
      en: 'This source’s share of operating capacity (capacity, not generation: solar and wind run at lower capacity factors, so their share of generation is much smaller). Countries where GEM tracks less than 100 MW in total (mostly small islands whose diesel units fall below the thresholds) are left out.',
    },
    unit: '%',
    file: 'share/{item}.json',
    layer: { kind: 'choropleth', scale: SHARE_SCALES.coal, itemScales: SHARE_SCALES },
    format: pct,
    formatTick: pctTick,
    compareWorld: true,
  },
  {
    id: 'construction',
    label: { zh: '興建中的容量', en: 'Capacity under construction' },
    description: {
      zh: '正在興建的電廠容量合計（所有能源），圓的面積與容量成正比。',
      en: 'Combined capacity of power plants under construction (all sources); circle area is proportional to capacity.',
    },
    unit: GW_UNIT,
    file: 'construction.json',
    layer: { kind: 'bubble', legendValues: [1, 10, 100] },
    format: gw,
    formatTick: gwTick,
    shareOfWorld: true,
  },
  {
    id: 'planned',
    label: { zh: '規劃中的容量', en: 'Planned capacity' },
    description: {
      zh: '還沒動工的計畫容量合計：籌備中（正在申請許可、土地或融資）加上已宣布的計畫，不含擱置與取消的。很多計畫最後不會蓋。',
      en: 'Combined capacity of projects not yet under construction: pre-construction (seeking permits, land or financing) plus announced projects, excluding shelved and cancelled ones. Many will never be built.',
    },
    unit: GW_UNIT,
    file: 'planned.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    format: gw,
    formatTick: gwTick,
    shareOfWorld: true,
  },
];

export const powerPlants: TopicDefinition = {
  id: 'power-plants',
  title: { zh: '發電廠地圖', en: 'Power plants' },
  shortTitle: { zh: '發電廠', en: 'Power plants' },
  defaultIndicator: 'plants',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Global Energy Monitor：Global Integrated Power Tracker（2026 年 9 月版）',
        en: 'Global Energy Monitor, Global Integrated Power Tracker (September 2026 release)',
      },
      url: 'https://globalenergymonitor.org/projects/global-integrated-power-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '經濟部能源署：發電裝置容量（台灣對照）', en: 'Energy Administration, MOEA: installed capacity (Taiwan cross-check)' },
      url: 'https://data.gov.tw/dataset/16480',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '電廠資料是 Global Energy Monitor（GEM）追蹤的發電機組，依各能源的收錄門檻：燃煤 30 MW、燃氣與燃油 50 MW（歐盟、英國 20 MW）、水力 30 MW、風力 10 MW、生質能 20 MW 以上，太陽能是 1 MW 以上的地面型案場（不含屋頂型），核能與地熱幾乎全收；不含電池儲能。容量是銘牌容量（MW），一座電廠的機組加總。跨國的水力電廠（伊泰普、亞西雷塔等）在國家統計裡依份額拆給兩國。台灣的數字跟經濟部能源署的發電裝置容量對照，見側欄附註。',
    en: 'Plant data are the generating units tracked by Global Energy Monitor (GEM), subject to each tracker’s threshold: 30 MW for coal, 50 MW for gas and oil (20 MW in the EU and UK), 30 MW for hydro, 10 MW for wind and 20 MW for bioenergy; solar covers ground-mounted farms of 1 MW or more (no rooftop systems), and nuclear and geothermal are nearly complete; battery storage is not included. Capacity is nameplate capacity in MW, summed over a plant’s units. Cross-border hydro plants (Itaipu, Yacyretá and others) are split between the two countries in the country statistics. Taiwan’s figures are compared with the Energy Administration’s installed capacity in the country panel notes.',
  },
  dimension: {
    label: { zh: '能源', en: 'Source' },
    options: [
      { id: 'coal', label: { zh: '燃煤', en: 'Coal' }, group: FOSSIL_GROUP },
      { id: 'oil-gas', label: { zh: '燃氣與燃油', en: 'Gas and oil' }, group: FOSSIL_GROUP },
      { id: 'nuclear', label: { zh: '核能', en: 'Nuclear' }, group: LOW_CARBON },
      { id: 'hydro', label: { zh: '水力（含抽蓄）', en: 'Hydro (incl. pumped storage)' }, group: LOW_CARBON },
      { id: 'wind', label: { zh: '風力', en: 'Wind' }, group: LOW_CARBON },
      { id: 'solar', label: { zh: '太陽能', en: 'Solar' }, group: LOW_CARBON },
      { id: 'bioenergy', label: { zh: '生質能', en: 'Bioenergy' }, group: LOW_CARBON },
      { id: 'geothermal', label: { zh: '地熱', en: 'Geothermal' }, group: LOW_CARBON },
      { id: 'renewables', label: { zh: '再生能源', en: 'Renewables' }, group: TOTALS },
      { id: 'fossil', label: { zh: '化石燃料', en: 'Fossil fuels' }, group: TOTALS },
    ],
    defaultOption: 'coal',
  },
  panelExtra: () => import('./panels/PowerPlantsPanel'),
  overlays: [
    { ...OPERATING_PLANTS, indicators: PLANT_INDICATORS },
    {
      ...plantLayer('construction', { zh: '興建中（空心）', en: 'Under construction (hollow)' }, 2, true, 'hollow'),
      indicators: PLANT_INDICATORS,
    },
    {
      ...plantLayer('planned', { zh: '規劃中（籌備中、已宣布；細框）', en: 'Planned (pre-construction, announced; thin ring)' }, 3, true, 'faint'),
      indicators: PLANT_INDICATORS,
    },
    {
      ...plantLayer('retired', { zh: '已退役、封存（灰色）', en: 'Retired, mothballed (grey)' }, 5, true, 'muted'),
      indicators: PLANT_INDICATORS,
    },
  ],
  indicators,
};
