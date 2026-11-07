import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { DGBAS_SOURCE } from './sectors';
import type { CategoryDef, ColorClasses, DimensionDef, IndicatorDef, PointRecord, PointsOverlayDef, Text, TopicDefinition } from './types';
import { ictSectorPart } from './ict-sector';
import { withParts } from './parts';
import { hostOnly, topicPart } from './merge';
import { withMenuGroups, type MenuGroup } from './menu-groups';
import { sectors } from './sectors';

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

/**
 * 1962 年起的出口組成（2026-11-02，製作手冊第十七批 270，pipeline/topics/atlas_sitc.py）：Harvard Atlas 的 SITC Rev. 2
 * 一位碼十大類併成八類（食品與活動物、飲料與菸草、動植物油脂併成一類：地圖的類別色只有 8 個）。順序與 id 跟 pipeline 的
 * GROUPS 一致，「最大的出口類別」的代碼是順序 + 1；地圖與側欄的堆疊圖都依這個順序取 MAP_TOKENS.categorical
 */
export const SITC_GROUPS: { id: string; label: Text }[] = [
  { id: 'machinery', label: { zh: '機械與運輸設備', en: 'Machinery and transport equipment' } },
  { id: 'material', label: { zh: '依材料分的製品（紡織品、鋼鐵、紙…）', en: 'Goods by material (textiles, steel, paper…)' } },
  { id: 'misc', label: { zh: '雜項製品（成衣、鞋、玩具、儀器…）', en: 'Miscellaneous manufactures (clothing, footwear, toys, instruments…)' } },
  { id: 'chemicals', label: { zh: '化學品', en: 'Chemicals' } },
  { id: 'fuels', label: { zh: '礦物燃料', en: 'Mineral fuels' } },
  { id: 'food', label: { zh: '食品、飲料與油脂', en: 'Food, beverages and oils' } },
  { id: 'crude', label: { zh: '非食用原料（礦砂、木材、棉花…）', en: 'Crude materials (ores, timber, cotton…)' } },
  { id: 'other', label: { zh: '未分類商品', en: 'Not classified elsewhere' } },
];
const SITC_CATEGORIES: CategoryDef[] = SITC_GROUPS.map((g, i) => ({ value: i + 1, label: g.label }));
/** 這兩個指標的側欄多一張 1962 年起的堆疊面積圖（panels/IndustrySitc.tsx） */
export const SITC_INDICATORS = ['exports-sitc', 'top-export-sitc'];

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

/** 化肥的三種養分（pipeline/topics/industry_fertilizer.py 的 NUTRIENTS；2026-11-05，製作手冊第二十二批 384） */
export const NUTRIENTS: DimensionDef = {
  label: { zh: '養分', en: 'Nutrient' },
  options: [
    // 標題是「子項目＋指標」：氮化肥產量、Nitrogen fertilizer production
    { id: 'nitrogen', label: { zh: '氮', en: 'Nitrogen' } },
    { id: 'phosphate', label: { zh: '磷', en: 'Phosphate' } },
    { id: 'potash', label: { zh: '鉀', en: 'Potash' } },
  ],
  defaultOption: 'nitrogen',
};
/** 企業的機器人使用率（側欄列用機器人的理由；2026-11-05，製作手冊第二十二批 386） */
export const ROBOT_INDICATOR = 'robot-use';
/** 化肥的指標（側欄的化肥表只在這兩個指標顯示） */
export const FERTILIZER_INDICATORS = ['fertilizer-production', 'fertilizer-self-sufficiency'];

/**
 * 世界出口市占的商品（2026-11-07，第二十五批 446，pipeline/topics/industry_products.py 的 PRODUCTS）：手冊挑的台灣排得上名的品項，
 * 加兩個對照組。括號是 HS 1992 的四位碼
 */
export const PRODUCT_DIMENSION: DimensionDef = {
  label: { zh: '商品', en: 'Product' },
  options: [
    { id: 'wrenches', label: { zh: '扳手（8204）', en: 'Wrenches (8204)' }, group: { zh: '工具與扣件', en: 'Tools and fasteners' } },
    { id: 'hand-tools', label: { zh: '手工具（8201–8207 合計）', en: 'Hand tools (8201–8207)' }, group: { zh: '工具與扣件', en: 'Tools and fasteners' } },
    { id: 'fasteners', label: { zh: '鋼鐵製螺絲、螺栓與扣件（7318）', en: 'Steel screws, bolts and fasteners (7318)' }, group: { zh: '工具與扣件', en: 'Tools and fasteners' } },
    { id: 'bicycles', label: { zh: '自行車（8712）', en: 'Bicycles (8712)' }, group: { zh: '自行車', en: 'Bicycles' } },
    { id: 'bicycle-parts', label: { zh: '自行車、機車與輪椅的零件（8714）', en: 'Bicycle, motorcycle and wheelchair parts (8714)' }, group: { zh: '自行車', en: 'Bicycles' } },
    { id: 'machining-centres', label: { zh: '綜合加工機（8457）', en: 'Machining centres (8457)' }, group: { zh: '工具機', en: 'Machine tools' } },
    { id: 'lathes', label: { zh: '金屬車床（8458）', en: 'Metal lathes (8458)' }, group: { zh: '工具機', en: 'Machine tools' } },
    { id: 'woodworking', label: { zh: '木工機械（8465）', en: 'Woodworking machines (8465)' }, group: { zh: '工具機', en: 'Machine tools' } },
    { id: 'machine-tools', label: { zh: '金屬加工工具機（8457–8463 合計）', en: 'Metalworking machine tools (8457–8463)' }, group: { zh: '工具機', en: 'Machine tools' } },
    { id: 'pcb', label: { zh: '印刷電路板（8534）', en: 'Printed circuits (8534)' }, group: { zh: '電子零組件', en: 'Electronic components' } },
    { id: 'lcd', label: { zh: '液晶裝置、雷射與光學器具（9013）', en: 'Liquid-crystal devices, lasers and optical appliances (9013)' }, group: { zh: '電子零組件', en: 'Electronic components' } },
    { id: 'capacitors', label: { zh: '電容器（8532）', en: 'Capacitors (8532)' }, group: { zh: '電子零組件', en: 'Electronic components' } },
    { id: 'synthetic-fabric', label: { zh: '合成纖維長絲梭織布（5407）', en: 'Woven synthetic filament fabrics (5407)' }, group: { zh: '紡織', en: 'Textiles' } },
    { id: 'auto-parts', label: { zh: '汽車零件（8708）', en: 'Car parts (8708)' }, group: { zh: '對照組', en: 'For comparison' } },
    { id: 'bearings', label: { zh: '滾珠與滾子軸承（8482）', en: 'Ball and roller bearings (8482)' }, group: { zh: '對照組', en: 'For comparison' } },
  ],
  defaultOption: 'wrenches',
};

const industryOwn: TopicDefinition = {
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
    {
      name: {
        zh: 'Harvard Growth Lab, Atlas of Economic Complexity：International Trade Data (HS92)（四位碼品項的世界出口市占與世界第一的品項數）',
        en: 'Harvard Growth Lab, Atlas of Economic Complexity: International Trade Data (HS92) (world export shares by four-digit heading; products led)',
      },
      url: 'https://doi.org/10.7910/DVN/T4CHWJ',
      license: 'CC0 1.0',
    },
    {
      name: {
        zh: 'Harvard Growth Lab, Atlas of Economic Complexity：International Trade Data (SITC, Rev. 2)（1962 年起的出口組成）',
        en: 'Harvard Growth Lab, Atlas of Economic Complexity: International Trade Data (SITC, Rev. 2) (export mix from 1962)',
      },
      url: 'https://doi.org/10.7910/DVN/H8SFD2',
      license: 'CC0 1.0',
    },
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
    {
      name: { zh: 'Eurostat：3D printing and robotics by size class of enterprise（isoc_eb_p3d，企業的機器人使用率）', en: 'Eurostat: 3D printing and robotics by size class of enterprise (isoc_eb_p3d, robot use by enterprises)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/isoc_eb_p3d/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'World Bank WDI：每位就業者的附加價值（NV.IND.EMPL.KD、NV.SRV.EMPL.KD）', en: 'World Bank WDI: value added per worker (NV.IND.EMPL.KD, NV.SRV.EMPL.KD)' },
      url: 'https://data.worldbank.org/indicator/NV.IND.EMPL.KD',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：企業調查的產能利用率（ei_bsin_q_r2，歐盟執委會 DG ECFIN）', en: 'Eurostat: capacity utilisation from the business survey (ei_bsin_q_r2, European Commission DG ECFIN)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/ei_bsin_q_r2/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：各產業的附加價值（nama_10_a10，NACE A*10）', en: 'Eurostat: gross value added by industry (nama_10_a10, NACE A*10)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nama_10_a10/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'FAOSTAT：Fertilizers by Nutrient（化肥的產量、施用量與進出口）', en: 'FAOSTAT: Fertilizers by Nutrient (fertilizer production, use and trade)' },
      url: 'https://www.fao.org/faostat/en/#data/RFN',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '製造業組成依 UNIDO 的五大類（ISIC Rev.3），台灣由主計總處各業 GDP 依同樣分類換算。出口結構依 HS 商品分類歸類（1995 年起）；1962 年起的出口組成是 Harvard Atlas 的 SITC Rev. 2 一位碼（食品、飲料與菸草、動植物油脂併成一類），台灣的值來自貿易夥伴的申報，1991 年以前的蘇聯算在俄羅斯，捷克斯洛伐克、南斯拉夫、東德沒有資料。粗鋼與水泥產量是 USGS 年鑑的世界產量表（最新是 2023 年，有些國家是估計值）；鋼鐵廠、水泥廠的點是 Global Energy Monitor 2026 年的追蹤資料（不含已取消的計畫），鋼鐵廠的產能是煉鐵與煉鋼各製程的加總。',
    en: "Manufacturing composition follows UNIDO's five groups (ISIC Rev.3); Taiwan's is derived from DGBAS GDP by industry using the same grouping. Export structure is grouped by HS product codes (from 1995); the export mix from 1962 uses Harvard Atlas SITC Rev. 2 sections (food, beverages and tobacco, and animal and vegetable oils merged), with Taiwan's figures taken from its partners' reports, the Soviet Union counted as Russia before 1992, and no data for Czechoslovakia, Yugoslavia or East Germany. Crude steel and cement output come from the USGS Minerals Yearbook world production tables (latest year 2023; some countries are estimates). Steel and cement plants are from Global Energy Monitor's 2026 trackers (cancelled projects excluded); steel plant capacity sums all ironmaking and steelmaking processes.",
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
      id: 'fertilizer-production',
      label: { zh: '化肥產量', en: 'Fertilizer production' },
      description: {
        zh: '一年生產的化學肥料，公噸「養分量」（氮肥算氮、磷肥算 P₂O₅、鉀肥算 K₂O，不是尿素、磷酸二銨的實物重量，差 2 到 5 倍），選上方的「養分」切換。2024 年氮肥中國 3,016 萬公噸、印度 1,700 萬、美國 1,382 萬、俄羅斯 1,240 萬；磷肥中國 1,322 萬、摩洛哥 620 萬；鉀肥很集中，加拿大 1,355 萬、俄羅斯 1,145 萬、白俄羅斯 756 萬，三國超過世界的一半。台灣氮肥 6.6 萬、磷肥 2.8 萬，不產鉀肥。FAO 標成「外部機構提供」的數字沒有用（第三方資料要原提供者同意才能再散布）。',
        en: 'Chemical fertilizer produced in a year, in tonnes of nutrient (N for nitrogen, P₂O₅ for phosphate, K₂O for potash; not the weight of products such as urea or DAP, which is 2–5 times more); switch with “Nutrient” above. In 2024 China produced 30.2 million tonnes of nitrogen, India 17.0 million, the US 13.8 million and Russia 12.4 million; for phosphate China 13.2 million and Morocco 6.2 million; potash is highly concentrated, with Canada 13.6 million, Russia 11.5 million and Belarus 7.6 million together more than half the world. Taiwan produced 66,000 tonnes of nitrogen and 28,000 of phosphate and no potash. Figures FAO marks as supplied by external organisations are not used (third-party data need the original provider’s consent to be redistributed).',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'fertilizer/production/{item}.json',
      dimension: NUTRIENTS,
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'fertilizer-self-sufficiency',
      label: { zh: '化肥自給率', en: 'Fertilizer self-sufficiency' },
      description: {
        zh: '化肥產量除以國內農業施用量：100% 以上是做得比用得多（出口），以下是要進口。2024 年台灣氮肥 54.9%、磷肥 28.3%、鉀肥 0%；加拿大的鉀肥 1,623%、氮肥 111%。化肥有庫存與轉口，自給率不能當糧食安全的指標；施用量是 0 的國家不算。',
        en: 'Fertilizer production divided by domestic agricultural use: above 100% means a country makes more than it uses (and exports); below means it imports. In 2024 Taiwan was 54.9% for nitrogen, 28.3% for phosphate and 0% for potash; Canada 1,623% for potash and 111% for nitrogen. Fertilizer is stockpiled and re-exported, so self-sufficiency is not a food-security measure; countries with no recorded use are left out.',
      },
      unit: '%',
      file: 'fertilizer/self-sufficiency/{item}.json',
      dimension: NUTRIENTS,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [25, 50, 80, 125, 200, 400] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'robot-use',
      label: { zh: '用機器人的企業', en: 'Enterprises using robots' },
      description: {
        zh: '10 人以上的企業（不含金融業）有用工業機器人或服務型機器人的比例，Eurostat 的企業 ICT 調查，2018、2020、2022 年，只有歐洲 33 國。2022 年丹麥 11.6%、比利時 10.2%、芬蘭 8.9%、義大利 8.7%、西班牙 8.6% 最高，賽普勒斯 1.7%、希臘 1.9% 最低。「機器人」含清掃、倉儲搬運這類服務型，不是純粹的製造業自動化；產業結構不同的國家不能直接比。點國家看企業用機器人的理由。國際機器人協會（IFR）的機器人密度不准轉載，沒有用；工業機器人的進出口見「貿易」主題的商品流向。',
        en: 'Share of enterprises with 10 or more employees (excluding finance) that use industrial or service robots, from Eurostat’s survey of ICT use in enterprises (2018, 2020, 2022; 33 European countries only). In 2022 Denmark (11.6%), Belgium (10.2%), Finland (8.9%), Italy (8.7%) and Spain (8.6%) were highest, Cyprus (1.7%) and Greece (1.9%) lowest. “Robots” include service robots for cleaning and warehouse handling, so this is not purely manufacturing automation, and countries with different industry mixes are not directly comparable. Click a country for the reasons enterprises give. The International Federation of Robotics’ robot density cannot be republished; for trade in industrial robots, see the Trade topic’s product flows.',
      },
      unit: '%',
      file: 'robot-use.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 6, 8, 10] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2022,
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
    {
      id: 'exports-sitc',
      label: { zh: '出口組成（1962 年起）', en: 'Export mix (from 1962)' },
      description: {
        zh: '選定類別占全部商品出口的比例，1962–2024 年（Harvard Atlas，SITC 分類）。選上方的「出口類別」切換；點國家看它的出口從什麼變成什麼。跟上面 1995 年起依 HS 分類的「占商品出口比重」類別不同。台灣 1962 年食品占 46.9%，1980 年雜項製品（成衣、鞋、玩具）37.3%，2024 年機械與運輸設備 65.1%。',
        en: 'The selected category as a share of all goods exports, 1962–2024 (Harvard Atlas, SITC classification). Switch with "Export category" above; click a country to see how its exports changed. Categories differ from the HS-based Share of goods exports (from 1995) above. Taiwan: food 46.9% in 1962, miscellaneous manufactures (clothing, footwear, toys) 37.3% in 1980, machinery and transport equipment 65.1% in 2024.',
      },
      unit: '%',
      file: 'exports-sitc/{item}.json',
      dimension: {
        label: { zh: '出口類別', en: 'Export category' },
        options: SITC_GROUPS,
        defaultOption: 'machinery',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 70] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'top-export-sitc',
      label: { zh: '最大的出口類別（1962 年起）', en: 'Largest export category (from 1962)' },
      description: {
        zh: '各國出口最多的商品類別，1962–2024 年（Harvard Atlas，SITC 分類），播放時間軸看各國從賣原料、農產品變成賣製品與機械。出口總額不到 100 萬美元的不算。',
        en: 'Each country’s largest export category, 1962–2024 (Harvard Atlas, SITC classification); play the timeline to watch countries move from raw materials and farm goods to manufactures and machinery. Countries exporting under US$1 million are left out.',
      },
      unit: '',
      file: 'top-export-sitc.json',
      layer: { kind: 'categorical', categories: SITC_CATEGORIES },
      format: (v) => tr(SITC_CATEGORIES.find((c) => c.value === v)?.label ?? ''),
      defaultYear: 'latest',
    },
    {
      id: 'product-share',
      label: { zh: '商品的世界出口市占', en: 'World export share of a product' },
      description: {
        zh: '這一國這項商品的出口占全世界出口的比例（Harvard Atlas 的 HS 1992 四位碼，1995–2024 年）。2024 年台灣的扳手 18.2%、自行車 12.3%、自行車與機車零件 11.0%、印刷電路板 10.4%，都是世界第 2（第 1 都是中國大陸）；液晶裝置 13.5% 第 3、螺絲與扣件 9.1% 第 4、綜合加工機 7.7% 第 5、金屬加工工具機（8457–8463 合計）5.6% 第 7；對照組的汽車零件 1.0% 第 23、軸承 0.7% 第 22。工具機不含 8456（雷射等加工機）：HS 1992 把半導體曝光機也歸在那裡。台灣沒有向聯合國申報，數字來自貿易夥伴的申報，金額比財政部的統計低、名次大致可信；電動輔助自行車在 HS 1992 歸機車（8711），不在自行車裡。',
        en: 'A country’s exports of the product as a share of world exports (Harvard Atlas, HS 1992 four-digit headings, 1995–2024). In 2024 Taiwan had 18.2% of world wrench exports, 12.3% of bicycles, 11.0% of bicycle and motorcycle parts and 10.4% of printed circuits, second each time to mainland China; 13.5% of liquid-crystal devices (3rd), 9.1% of screws and fasteners (4th), 7.7% of machining centres (5th) and 5.6% of metalworking machine tools (8457–8463 combined, 7th), against 1.0% of car parts (23rd) and 0.7% of bearings (22nd). Machine tools exclude 8456 (laser and similar machines), where HS 1992 also puts semiconductor lithography equipment. Taiwan does not report to the UN, so its figures come from partners’ reports: values are lower than Taiwan’s own statistics, but ranks are broadly reliable. E-bikes fall under motorcycles (8711) in HS 1992, not bicycles.',
      },
      unit: '%',
      file: 'product-share/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 3, 10, 25] } },
      dimension: PRODUCT_DIMENSION,
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: pctTick,
      defaultYear: 2024,
    },
    {
      id: 'product-leads',
      label: { zh: '世界出口第一的品項數', en: 'Products where a country leads world exports' },
      description: {
        zh: '在 HS 1992 的 1,240 個四位碼品項裡，這一國是世界最大出口國的項數；子項目可換成市占 10% 或 5% 以上的項數（Harvard Atlas，1995–2024 年）。2024 年中國大陸 544 項、德國 121 項、美國 119 項、義大利 35 項、印度 32 項、日本 27 項，南韓 15 項，台灣 6 項（市占 10% 以上 27 項、5% 以上 82 項）。不算 Atlas 的「貿易資料差異」與「未依種類分的商品」兩個殘差項（台灣 2024 年有 991 億美元在差異項裡）。項數受分類粗細影響：農產品分得細、電子產品分得粗。',
        en: 'Of the 1,240 four-digit headings in HS 1992, the number in which the country is the world’s largest exporter; switch to the number with a world share of 10% or 5% or more (Harvard Atlas, 1995–2024). In 2024 mainland China led in 544, Germany 121, the US 119, Italy 35, India 32, Japan 27, South Korea 15 and Taiwan 6 (27 with 10% or more, 82 with 5% or more). Atlas’s two residual codes, “trade data discrepancies” and “commodities not specified according to kind”, are excluded (Taiwan had US$99.1 billion under discrepancies in 2024). Counts depend on how finely goods are classified: farm products are split finely, electronics coarsely.',
      },
      unit: { zh: '項', en: 'products' },
      file: 'product-leads/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [1, 3, 10, 25, 50, 150] },
        itemScales: {
          share10: { type: 'sequential', thresholds: [1, 10, 25, 50, 100, 300] },
          share5: { type: 'sequential', thresholds: [1, 10, 50, 100, 200, 500] },
        },
      },
      dimension: {
        label: { zh: '門檻', en: 'Threshold' },
        options: [
          { id: 'first', label: { zh: '世界第一', en: 'World’s largest exporter' } },
          { id: 'share10', label: { zh: '市占 10% 以上', en: 'World share 10% or more' } },
          { id: 'share5', label: { zh: '市占 5% 以上', en: 'World share 5% or more' } },
        ],
        defaultOption: 'first',
      },
      format: (v) => tr({ zh: `${fixed(v, 0)} 項`, en: `${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
    },
    {
      id: 'gva-share',
      label: { zh: 'GDP 的十大產業', en: 'GDP by industry (ten sectors)' },
      description: {
        zh: '各產業的附加價值占全部附加價值的比例，把「服務業」拆開看（Eurostat 的 NACE A*10，歐洲約 40 國，1995 年起；台灣用主計總處的各業 GDP）。「礦業與公用事業」是採礦、電力燃氣、用水與廢棄物，不含製造業。2024 年台灣的製造業 36.8% 是這張圖最高，德國 19.9%、法國 11.4%；愛爾蘭的資通訊 21.1%（跨國科技公司）、盧森堡的金融保險 25.9%、挪威的礦業與公用事業 28.0%（石油天然氣）。多數國家製造業以外最大的是批發零售、運輸與住宿餐飲，其次是公共行政、教育與醫療。',
        en: 'Each industry’s share of total gross value added, breaking “services” apart (Eurostat NACE A*10, about 40 European countries from 1995; Taiwan from DGBAS GDP by industry). “Mining and utilities” covers mining, electricity and gas, water and waste, excluding manufacturing. In 2024 Taiwan’s manufacturing share of 36.8% was the highest on the map, against 19.9% in Germany and 11.4% in France; ICT was 21.1% in Ireland (multinational tech firms), finance 25.9% in Luxembourg and mining and utilities 28.0% in Norway (oil and gas). Outside manufacturing, the largest sector in most countries is trade, transport and hospitality, followed by public administration, education and health.',
      },
      unit: '%',
      file: 'gva-share/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] },
        itemScales: {
          agriculture: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 5, 8] },
          'mining-utilities': { type: 'sequential', thresholds: [2, 3, 4, 5, 8, 15] },
          manufacturing: { type: 'sequential', thresholds: [8, 12, 15, 18, 22, 30] },
          construction: { type: 'sequential', thresholds: [4, 5, 5.5, 6, 7, 9] },
          trade: { type: 'sequential', thresholds: [15, 18, 20, 22, 25, 28] },
          ict: { type: 'sequential', thresholds: [3.5, 4.5, 5, 6, 8, 12] },
          finance: { type: 'sequential', thresholds: [3, 4, 5, 6, 8, 15] },
          'real-estate': { type: 'sequential', thresholds: [6, 8, 9, 10, 12, 14] },
          business: { type: 'sequential', thresholds: [5, 7, 9, 10, 12, 15] },
          public: { type: 'sequential', thresholds: [12, 15, 17, 19, 21, 25] },
          other: { type: 'sequential', thresholds: [1.5, 2, 2.5, 3, 3.5, 5] },
        },
      },
      dimension: {
        label: { zh: '產業', en: 'Industry' },
        options: [
          { id: 'agriculture', label: { zh: '農林漁牧業（A）', en: 'Agriculture, forestry and fishing (A)' } },
          { id: 'mining-utilities', label: { zh: '礦業與公用事業（B、D、E）', en: 'Mining and utilities (B, D, E)' } },
          { id: 'manufacturing', label: { zh: '製造業（C）', en: 'Manufacturing (C)' } },
          { id: 'construction', label: { zh: '營造業（F）', en: 'Construction (F)' } },
          { id: 'trade', label: { zh: '批發零售、運輸倉儲、住宿餐飲（G–I）', en: 'Trade, transport and hospitality (G–I)' } },
          { id: 'ict', label: { zh: '資訊與通訊（J）', en: 'Information and communication (J)' } },
          { id: 'finance', label: { zh: '金融保險（K）', en: 'Finance and insurance (K)' } },
          { id: 'real-estate', label: { zh: '不動產（L）', en: 'Real estate (L)' } },
          { id: 'business', label: { zh: '專業、科學、技術與支援服務（M–N）', en: 'Professional, scientific and support services (M–N)' } },
          { id: 'public', label: { zh: '公共行政、教育、醫療與社福（O–Q）', en: 'Public administration, education and health (O–Q)' } },
          { id: 'other', label: { zh: '藝術娛樂與其他服務（R–U）', en: 'Arts, recreation and other services (R–U)' } },
        ],
        defaultOption: 'manufacturing',
      },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
    },
    {
      id: 'capacity-utilization',
      label: { zh: '製造業的產能利用率', en: 'Manufacturing capacity utilisation' },
      description: {
        zh: '工廠的產能用了幾成：歐盟執委會每季問製造業者「目前的產能利用率」，季節調整後取當年各季的平均（Eurostat，32 個歐洲國家，多數 1990 年代起）。2026 年奧地利 83.9%、瑞典 83.2%、德國 78.2%、義大利 75.2%，歐盟 78.1%；2009 年（71.8%）與 2020 年（74.8%）的大跌在時間軸上看得到。這是業者的自評，跨國比較水準要小心（馬爾他、丹麥偏低可能是樣本或產業結構），看變化比較有意義。側欄是逐季的線。台灣：經濟部沒有開放產能利用率的資料。',
        en: 'How much of their capacity factories are using: each quarter the European Commission asks manufacturers for their current capacity utilisation; the map shows the annual average of the seasonally adjusted quarters (Eurostat, 32 European countries, mostly from the 1990s). In 2026 Austria averaged 83.9%, Sweden 83.2%, Germany 78.2% and Italy 75.2%, with the EU at 78.1%; the slumps of 2009 (71.8%) and 2020 (74.8%) show on the timeline. These are self-assessments, so compare levels across countries with care (Malta’s and Denmark’s low figures may reflect small samples or industry mix); changes are more telling. The side panel plots each quarter. Taiwan: the Ministry of Economic Affairs publishes no open data on capacity utilisation.',
      },
      unit: '%',
      file: 'capacity-utilization.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [65, 70, 74, 77, 80, 83] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 'latest',
      noValue: { TWN: { zh: '經濟部沒有開放這項資料', en: 'No open data from the Ministry of Economic Affairs' } },
    },
    {
      id: 'labour-productivity',
      label: { zh: '每位就業者創造的附加價值', en: 'Value added per worker' },
      description: {
        zh: '工業（含營造）或服務業一年的附加價值除以就業人數（2015 年固定價美元，世界銀行 WDI，1991 年起）。2025 年工業：愛爾蘭 47.5 萬、盧森堡 26.3 萬、瑞士 24.2 萬、南韓 9.7 萬、德國 7.8 萬、中國大陸 3.1 萬、印度 6,670，世界 2.6 萬；服務業：盧森堡 18.7 萬、瑞士 15.4 萬、德國 7.9 萬、南韓 5.4 萬、印度 9,536。愛爾蘭、盧森堡這類高得不合理的數字是跨國企業的利潤移轉造成的；蓋亞那是石油。美國只到 2015 年（工業 11.2 萬），地圖用 10 年內最近一年的值並標年份。就業者含自營作業者。台灣不在世界銀行的資料裡。',
        en: 'A year’s value added in industry (including construction) or services divided by the number employed (constant 2015 US$, World Bank WDI, from 1991). In 2025 industry was US$475,000 in Ireland, 263,000 in Luxembourg, 242,000 in Switzerland, 97,000 in South Korea, 78,000 in Germany, 31,000 in mainland China and 6,670 in India, against a world 26,000; services were 187,000 in Luxembourg, 154,000 in Switzerland, 79,000 in Germany, 54,000 in South Korea and 9,536 in India. Implausibly high figures in Ireland and Luxembourg come from multinational profit shifting; Guyana’s from oil. US data end in 2015 (industry 112,000), so the map uses each country’s latest value within 10 years and labels the year. Workers include the self-employed. Taiwan is not in World Bank data.',
      },
      unit: { zh: '2015 年美元', en: '2015 US$' },
      file: 'labour-productivity/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5000, 10000, 20000, 40000, 80000, 150000] } },
      dimension: {
        label: { zh: '產業', en: 'Sector' },
        options: [
          { id: 'industry', label: { zh: '工業（含營造）', en: 'Industry (incl. construction)' } },
          { id: 'services', label: { zh: '服務業', en: 'Services' } },
        ],
        defaultOption: 'industry',
      },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      compareWorld: true,
      defaultYear: 2025,
    },
  ],
};

/** 指標選單的分組（2026-11-07，第二十五批 446）：依這個順序排，同一組的排在一起（menu-groups.ts） */
const MENU_GROUPS: MenuGroup[] = [
  [
    { zh: '產業結構', en: 'Economic structure' },
    ['agriculture', 'industry', 'manufacturing', 'services', 'employment-agriculture', 'employment-industry', 'employment-services', 'gva-share', 'ict-gva', 'ict-employment'],
  ],
  [
    { zh: '製造業', en: 'Manufacturing' },
    [
      'mva',
      'share-machinery',
      'share-chemicals',
      'share-food',
      'share-textiles',
      'share-other',
      'tech-share',
      'steel',
      'cement',
      'fertilizer-production',
      'fertilizer-self-sufficiency',
      'robot-use',
    ],
  ],
  [
    { zh: '出口競爭力', en: 'Export competitiveness' },
    ['exports', 'exports-sitc', 'top-export-sitc', 'product-share', 'product-leads'],
  ],
  [{ zh: '生產力', en: 'Productivity' }, ['labour-productivity', 'capacity-utilization']],
];


/**
 * 產業結構與工業（2026-11-04，主題整併 併13）：「各國產業結構」（農工服務業占 GDP 與就業）併進來，資料照舊在 sectors/
 * （topics/merge.ts），產業結構的指標用原本的側欄區塊。舊網址 t/sectors/ 轉到這裡（redirects.ts）
 */
export const industry: TopicDefinition = withMenuGroups(
  withParts(
    {
      ...hostOnly(industryOwn),
      title: { zh: '產業結構與工業', en: 'Economic structure and industry' },
      shortTitle: { zh: '產業與工業', en: 'Industry' },
    },
    topicPart(sectors),
    ictSectorPart,
  ),
  MENU_GROUPS,
);
