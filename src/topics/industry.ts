import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { DGBAS_SOURCE } from './sectors';
import type { ColorClasses, IndicatorDef, PointRecord, PointsOverlayDef, Text, TopicDefinition } from './types';

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

/** 公噸：中文「10.19 億 公噸」、英文「1.02B t」 */
const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` });

/**
 * 鋼鐵廠、水泥廠的狀態（pipeline/topics/steel_cement.py 的 STATUS）：
 * 運轉中用深鏽紅（地圖上最多的點，要壓得過紫色的比例圓），興建中琥珀、已宣布薄荷綠，封存與已退役灰色
 */
const PLANT_STATUS: ColorClasses = {
  field: 'st',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [1.5, 2.5, 3.5],
  classes: [
    { color: MAP_TOKENS.categorical[5], label: { zh: '運轉中', en: 'Operating' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '興建中', en: 'Under construction' } },
    { color: MAP_TOKENS.categorical[0], label: { zh: '已宣布', en: 'Announced' } },
    { color: MAP_TOKENS.noData, label: { zh: '封存或已退役', en: 'Mothballed or retired' } },
  ],
};
const STATUS_TEXT: Record<number, Text> = {
  1: { zh: '運轉中', en: 'Operating' },
  2: { zh: '興建中', en: 'Under construction' },
  3: { zh: '已宣布', en: 'Announced' },
  4: { zh: '封存', en: 'Mothballed' },
  5: { zh: '已退役', en: 'Retired' },
};

/** GEM 的廠的類型（鋼鐵廠的 prod-type、水泥廠的 plant-type，資料檔存原文） */
const PLANT_TYPES: Record<string, Text> = {
  Electric: { zh: '電弧爐', en: 'Electric arc furnace' },
  'Integrated (BF)': { zh: '一貫作業（高爐）', en: 'Integrated (blast furnace)' },
  'Integrated (DRI)': { zh: '一貫作業（直接還原鐵）', en: 'Integrated (direct reduced iron)' },
  'Integrated (BF & DRI)': { zh: '一貫作業（高爐與直接還原鐵）', en: 'Integrated (blast furnace and DRI)' },
  'Integrated (unknown)': { zh: '一貫作業', en: 'Integrated' },
  'Ironmaking (BF)': { zh: '只煉鐵（高爐）', en: 'Ironmaking only (blast furnace)' },
  'Ironmaking (DRI)': { zh: '只煉鐵（直接還原鐵）', en: 'Ironmaking only (DRI)' },
  'Iron other/unspecified': { zh: '煉鐵（其他製程）', en: 'Ironmaking (other process)' },
  'Steel other/unspecified': { zh: '煉鋼（其他製程）', en: 'Steelmaking (other process)' },
  Induction: { zh: '感應爐', en: 'Induction furnace' },
  Oxygen: { zh: '轉爐', en: 'Basic oxygen furnace' },
  'Electric, oxygen': { zh: '電弧爐與轉爐', en: 'Electric arc and basic oxygen furnaces' },
  integrated: { zh: '一貫作業（熟料與水泥）', en: 'Integrated (clinker and cement)' },
  grinding: { zh: '研磨廠（只磨水泥）', en: 'Grinding plant' },
  'clinker only': { zh: '只產熟料', en: 'Clinker only' },
};

/** 鋼鐵廠、水泥廠的點：鋼鐵廠的容量是千公噸/年，水泥廠是百萬公噸/年，畫面上都換成公噸 */
function plantLayer(kind: 'steel' | 'cement'): PointsOverlayDef {
  const steel = kind === 'steel';
  const toT = steel ? 1e3 : 1e6;
  // 面積與產能成正比：最大的鋼鐵廠（印度 Hazira 5,317 萬公噸）約 14 px；水泥廠多很多（中國一千多座）、
  // 換算係數小一點，最大的（2,150 萬公噸）約 7 px，比例圓才不會整個被蓋住；太小的至少 1.2 px
  const k = steel ? 0.0019 : 0.0015;
  const stops: [number, number][] = [0, 0.5e6, 1e6, 3e6, 10e6, 30e6, 60e6].map((t) => [
    t / toT,
    Math.max(1.2, k * Math.sqrt(t)),
  ]);
  return {
    kind: 'points',
    id: `${kind}-plants`,
    file: `${kind}-plants.json`,
    label: steel
      ? { zh: '鋼鐵廠（Global Energy Monitor）', en: 'Iron and steel plants (Global Energy Monitor)' }
      : { zh: '水泥廠（Global Energy Monitor）', en: 'Cement plants (Global Energy Monitor)' },
    indicators: [kind],
    radius: { field: 'cap', stops },
    color: PLANT_STATUS,
    sizeLegend: {
      title: { zh: '年產能', en: 'Annual capacity' },
      values: steel ? [1000, 10000, 40000] : [1, 5, 20],
      format: (v) => tonnes(v * toT),
    },
    tooltip: (p: PointRecord, ctx) => {
      const st = typeof p.st === 'number' ? STATUS_TEXT[p.st] : null;
      const cap =
        typeof p.cap === 'number' && p.cap > 0
          ? tr({ zh: `年產能 ${tonnes(p.cap * toT)}`, en: `capacity ${tonnes(p.cap * toT)}/yr` })
          : null;
      const start = typeof p.start === 'number' ? tr({ zh: `${p.start} 年啟用`, en: `opened ${p.start}` }) : null;
      const parts = [st ? tr(st) : null, cap, start, typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null];
      const type = typeof p.type === 'string' ? PLANT_TYPES[p.type] : undefined;
      const extra = [type ? tr(type) : null, typeof p.owner === 'string' ? p.owner : null].filter(
        (x): x is string => !!x,
      );
      return {
        title: steel ? tr({ zh: '鋼鐵廠', en: 'Iron and steel plant' }) : tr({ zh: '水泥廠', en: 'Cement plant' }),
        detail: parts.filter(Boolean).join(' · '),
        ...(extra.length ? { extra: [extra.join(' · ')] } : {}),
        properNoun: typeof p.name === 'string' ? p.name : undefined,
      };
    },
  };
}

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
    {
      name: {
        zh: 'USGS Minerals Yearbook 2023（鋼鐵表 10、水泥表 22）',
        en: 'USGS Minerals Yearbook 2023 (Iron and Steel table 10, Cement table 22)',
      },
      url: 'https://www.usgs.gov/centers/national-minerals-information-center/iron-and-steel-statistics-and-information',
      license: { zh: '公有領域（美國政府著作）', en: 'Public domain (U.S. Government work)' },
    },
    {
      name: {
        zh: 'Global Energy Monitor：Global Iron and Steel Tracker（2026 年 9 月版）、Global Cement and Concrete Tracker（2026 年 7 月版）',
        en: 'Global Energy Monitor: Global Iron and Steel Tracker (September 2026), Global Cement and Concrete Tracker (July 2026)',
      },
      url: 'https://globalenergymonitor.org/projects/global-iron-steel-tracker/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '製造業組成依 UNIDO 的五大類（ISIC Rev.3），台灣由主計總處各業 GDP 依同樣分類換算。出口結構依 HS 商品分類歸類。粗鋼與水泥產量是 USGS 年鑑的世界產量表（最新是 2023 年，有些國家是估計值）；鋼鐵廠、水泥廠的點是 Global Energy Monitor 2026 年的追蹤資料（不含已取消的計畫），鋼鐵廠的產能是煉鐵與煉鋼各製程的加總。',
    en: "Manufacturing composition follows UNIDO's five groups (ISIC Rev.3); Taiwan's is derived from DGBAS GDP by industry using the same grouping. Export structure is grouped by HS product codes. Crude steel and cement output come from the USGS Minerals Yearbook world production tables (latest year 2023; some countries are estimates). Steel and cement plants are from Global Energy Monitor's 2026 trackers (cancelled projects excluded); steel plant capacity sums all ironmaking and steelmaking processes.",
  },
  overlays: [plantLayer('steel'), plantLayer('cement')],
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
      id: 'steel',
      label: { zh: '粗鋼產量', en: 'Crude steel output' },
      description: {
        zh: '一年生產的粗鋼（煉好、還沒軋成鋼材的鋼），圓的面積與產量成正比；地圖上的點是鋼鐵廠，大小是年產能。',
        en: 'Crude steel produced in a year (steel as cast, before rolling). Circle area is proportional to output; the dots are iron and steel plants, sized by annual capacity.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'steel.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2023,
    },
    {
      id: 'cement',
      label: { zh: '水泥產量', en: 'Cement output' },
      description: {
        zh: '一年生產的水泥（水硬性水泥），圓的面積與產量成正比；地圖上的點是水泥廠，大小是年產能。',
        en: 'Hydraulic cement produced in a year. Circle area is proportional to output; the dots are cement plants, sized by annual capacity.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'cement.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2023,
    },
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
