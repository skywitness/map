import { tr, type Text } from '../i18n/lang';
import { fixed, formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type {
  ColorClasses,
  DimensionDef,
  FlowDirection,
  IndicatorDef,
  ItemFormat,
  PlaceDef,
  PointRecord,
  PointsOverlayDef,
  TopicDefinition,
} from './types';

/**
 * 石油、天然氣與煤（pipeline/topics/fossil_fuels.py）。子項目是燃料，每個燃料有產量、消費量、人均消費量、自給率、
 * 蘊藏量，單位各用各的（石油千桶/日、天然氣十億立方公尺、煤百萬公噸），所以指標用 itemFormats 依燃料換格式。
 * 流向圖用 BACI 的數量（公噸），商品是指標自己的子項目：原油、LNG、管道天然氣、煤（燃料是天然氣時預設 LNG）。
 * 地圖上疊 Global Energy Monitor 的管線、LNG 接收站、油氣田與煤礦，各自只在對應的燃料出現。
 */

const OIL = 'oil';
const GAS = 'gas';
const COAL = 'coal';
const PIPELINE = 'pipeline';

const FUELS: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: [
    { id: OIL, label: { zh: '石油', en: 'Oil' } },
    { id: GAS, label: { zh: '天然氣', en: 'Natural gas' } },
    { id: COAL, label: { zh: '煤', en: 'Coal' } },
  ],
  defaultOption: OIL,
};

/**
 * 燃料的指標也各自寫 dimension: FUELS：主題的子項目名稱跟著目前的指標，選了流向的「液化天然氣（LNG）」時，
 * 側欄的產量等卡片才會寫「天然氣產量」，不會寫成「液化天然氣（LNG）產量」
 */
/** 流向的商品：id 跟燃料共用（gas 是 LNG），從產量等指標換到流向時留在同一種燃料 */
const FLOW_ITEMS: DimensionDef = {
  label: { zh: '商品', en: 'Product' },
  options: [
    { id: OIL, label: { zh: '原油', en: 'Crude oil' } },
    { id: GAS, label: { zh: '液化天然氣（LNG）', en: 'Liquefied natural gas (LNG)' } },
    { id: PIPELINE, label: { zh: '管道天然氣', en: 'Pipeline gas' } },
    { id: COAL, label: { zh: '煤', en: 'Coal' } },
  ],
  defaultOption: OIL,
};

/** EIA 的進出口量只有天然氣與煤（石油的進出口看 BACI 的流向）；id 跟燃料共用 */
const GAS_COAL: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: FUELS.options.filter((o) => o.id !== OIL),
  defaultOption: GAS,
};

/** 一次能源的組成（2026-10-31，第十批 163）：EIA 的五類，id 跟燃料共用（石油、天然氣、煤） */
const MIX_ITEMS: DimensionDef = {
  label: { zh: '能源', en: 'Source' },
  options: [
    { id: OIL, label: { zh: '石油', en: 'Oil' } },
    { id: GAS, label: { zh: '天然氣', en: 'Natural gas' } },
    { id: COAL, label: { zh: '煤', en: 'Coal' } },
    { id: 'nuclear', label: { zh: '核能', en: 'Nuclear' } },
    { id: 'renewables', label: { zh: '再生能源及其他', en: 'Renewables and other' } },
  ],
  defaultOption: OIL,
};

/** 已經不存在的國家（pipeline 的 PLACES），畫在當時的首都 */
const PLACES: PlaceDef[] = [
  { id: '_SUN', name: { zh: '蘇聯（1980–1991）', en: 'Soviet Union (1980–1991)' }, lon: 37.62, lat: 55.75 },
  { id: '_YUG', name: { zh: '南斯拉夫（1980–1991）', en: 'Yugoslavia (1980–1991)' }, lon: 20.46, lat: 44.82 },
  { id: '_CSK', name: { zh: '捷克斯洛伐克（1980–1992）', en: 'Czechoslovakia (1980–1992)' }, lon: 14.42, lat: 50.09 },
  { id: '_SCG', name: { zh: '塞爾維亞與蒙特內哥羅（1992–2005）', en: 'Serbia and Montenegro (1992–2005)' }, lon: 20.46, lat: 44.82 },
];

// ── 數字格式 ──────────────────────────────────────

/** 依大小決定小數位：100 以上整數、10 以上 1 位、1 以上 2 位，更小的留 3 位有效數字 */
function num(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return fixed(v, 0);
  if (a >= 10) return fixed(v, 1);
  if (a >= 1) return fixed(v, 2);
  return fixed(v, Math.min(6, 2 - Math.floor(Math.log10(a))));
}
/** 圖例刻度：只寫需要的小數位 */
function tick(v: number): string {
  const d = [0, 1, 2, 3].find((n) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 1e-9) ?? 3;
  return fixed(v, d);
}

function unitFormat(unit: { zh: string; en: string }, short?: { zh: string; en: string }): ItemFormat {
  return {
    unit,
    format: (v) => tr({ zh: `${num(v)} ${unit.zh}`, en: `${num(v)} ${(short ?? unit).en}` }),
    formatTick: tick,
  };
}

const KBD = unitFormat({ zh: '千桶/日', en: 'thousand barrels per day' }, { zh: '千桶/日', en: 'kb/d' });
const BCM = unitFormat({ zh: '十億立方公尺', en: 'billion cubic metres' }, { zh: '十億立方公尺', en: 'bcm' });
const MT = unitFormat({ zh: '百萬公噸', en: 'million tonnes' }, { zh: '百萬公噸', en: 'Mt' });

/** 公噸（流向）：中文「5,318 萬公噸」「1.20 億公噸」，英文「53.2 Mt」「850 kt」 */
export function tonnes(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e8) return tr({ zh: `${fixed(v / 1e8, 2)} 億公噸`, en: `${fixed(v / 1e6, 0)} Mt` });
  if (a >= 1e6) return tr({ zh: `${fixed(v / 1e4, 0)} 萬公噸`, en: `${fixed(v / 1e6, 1)} Mt` });
  if (a >= 1e4) return tr({ zh: `${fixed(v / 1e4, 1)} 萬公噸`, en: `${fixed(v / 1e3, 0)} kt` });
  if (a >= 1e3) return tr({ zh: `${fixed(v, 0)} 公噸`, en: `${fixed(v / 1e3, 1)} kt` });
  return tr({ zh: `${fixed(v, 0)} 公噸`, en: `${fixed(v, 0)} t` });
}
/** 圖例刻度：中文「1億」「500萬」，英文「100M」「500K」 */
function tonnesTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e8) return tr({ zh: `${tick(v / 1e8)}億`, en: `${tick(v / 1e6)}M` });
  if (a >= 1e6) return tr({ zh: `${tick(v / 1e4)}萬`, en: `${tick(v / 1e6)}M` });
  if (a >= 1e4) return tr({ zh: `${tick(v / 1e4)}萬`, en: `${tick(v / 1e3)}K` });
  if (a >= 1e3) return tr({ zh: tick(v), en: `${tick(v / 1e3)}K` });
  return tick(v);
}

/** 依燃料的單位（產量、消費量） */
const VOLUME_FORMATS: Record<string, ItemFormat> = { [OIL]: KBD, [GAS]: BCM, [COAL]: MT };

const PER_CAPITA_FORMATS: Record<string, ItemFormat> = {
  [OIL]: unitFormat({ zh: '桶/人', en: 'barrels per person' }),
  [GAS]: unitFormat({ zh: '立方公尺/人', en: 'cubic metres per person' }, { zh: '立方公尺/人', en: 'm³ per person' }),
  [COAL]: unitFormat({ zh: '公斤/人', en: 'kg per person' }),
};

const RESERVE_FORMATS: Record<string, ItemFormat> = {
  [OIL]: unitFormat({ zh: '十億桶', en: 'billion barrels' }),
  [GAS]: unitFormat({ zh: '兆立方公尺', en: 'trillion cubic metres' }, { zh: '兆立方公尺', en: 'tcm' }),
  [COAL]: MT,
};

const percent = (v: number) => formatPercent(v, v >= 100 || v === 0 ? 0 : 1);

// ── 指標 ────────────────────────────────────────

const TAIWAN_NOTE = {
  zh: '台灣的值有幾個是 EIA 的估計或沿用舊值，見台灣的附註。',
  en: "Some of Taiwan's values are EIA estimates or carried-over figures; see the note on Taiwan.",
};

function flow(direction: FlowDirection, label: Text, description: Text): IndicatorDef {
  return {
    id: direction,
    label,
    description,
    unit: { zh: '公噸', en: 'tonnes' },
    file: `${direction}/{item}.json`,
    dimension: FLOW_ITEMS,
    layer: { kind: 'flow', file: 'flows/{item}/{year}.json', direction },
    format: tonnes,
    formatTick: tonnesTick,
    shareOfWorld: true,
  };
}

const indicators: IndicatorDef[] = [
  {
    id: 'production',
    label: { zh: '產量', en: 'Production' },
    description: {
      zh: `每年的產量：石油是原油（含凝結油）、天然氣是乾天然氣、煤是各種煤合計。EIA 1985 年以前收錄的產油國很少，石油的時間軸從 1985 年開始。${TAIWAN_NOTE.zh}`,
      en: `Annual production: crude oil including lease condensate, dry natural gas, and all coal. EIA covers few oil producers before 1985, so the oil time slider starts in 1985. ${TAIWAN_NOTE.en}`,
    },
    unit: KBD.unit,
    file: 'production/{item}.json',
    dimension: FUELS,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: KBD.format,
    formatTick: KBD.formatTick,
    itemFormats: VOLUME_FORMATS,
    shareOfWorld: true,
  },
  {
    id: 'consumption',
    label: { zh: '消費量', en: 'Consumption' },
    description: {
      zh: '每年的消費量：石油是石油及其他液體（含煉油廠自用、石化原料與賣給國際航線的燃料，所以新加坡、荷蘭這類煉油與加油港的國家特別高）、天然氣是乾天然氣、煤是各種煤合計。',
      en: 'Annual consumption: oil is petroleum and other liquids (including refinery use, petrochemical feedstock and fuel sold to international shipping, so refining and bunkering hubs such as Singapore and the Netherlands stand out), gas is dry natural gas, and coal is all coal.',
    },
    unit: KBD.unit,
    file: 'consumption/{item}.json',
    dimension: FUELS,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: KBD.format,
    formatTick: KBD.formatTick,
    itemFormats: VOLUME_FORMATS,
    shareOfWorld: true,
  },
  {
    id: 'per-capita',
    label: { zh: '人均消費量', en: 'Consumption per person' },
    description: {
      zh: '每人每年的消費量（消費量 ÷ UN WPP 2024 的年中人口）。石油的單位是桶（約 159 公升）。',
      en: 'Annual consumption per person (consumption divided by mid-year population from UN WPP 2024). One barrel of oil is about 159 litres.',
    },
    unit: PER_CAPITA_FORMATS[OIL].unit,
    file: 'per-capita/{item}.json',
    dimension: FUELS,
    layer: {
      kind: 'choropleth',
      // 世界平均：石油約 4.6 桶、天然氣約 520 立方公尺、煤約 1,100 公斤
      scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] },
      itemScales: {
        [GAS]: { type: 'sequential', thresholds: [50, 200, 500, 1000, 2000, 5000] },
        [COAL]: { type: 'sequential', thresholds: [50, 200, 500, 1000, 2000, 4000] },
      },
    },
    format: PER_CAPITA_FORMATS[OIL].format,
    formatTick: PER_CAPITA_FORMATS[OIL].formatTick,
    itemFormats: PER_CAPITA_FORMATS,
    compareWorld: true,
  },
  {
    id: 'self-sufficiency',
    label: { zh: '自給率', en: 'Self-sufficiency' },
    description: {
      zh: '產量 ÷ 消費量。100% 以上表示產量比自己用的多（可以出口），越低越依賴進口。石油的產量含天然氣液與其他液體（不含煉油增量）。',
      en: 'Production divided by consumption. Above 100% a country produces more than it uses (and can export); the lower the figure, the more it relies on imports. Oil production here includes natural gas liquids and other liquids (excluding refinery processing gain).',
    },
    unit: '%',
    file: 'self-sufficiency/{item}.json',
    dimension: FUELS,
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [25, 50, 90, 110, 200, 400] } },
    format: percent,
    formatTick: (v) => `${v}%`,
  },
  {
    id: 'eia-import',
    label: { zh: '進口量（EIA）', en: 'Imports (EIA)' },
    description: {
      zh: `每年的進口量（EIA）：天然氣是管道天然氣與液化天然氣（LNG）合計，單位十億立方公尺；煤是各種煤合計，單位百萬公噸。跟下面 BACI 的流向不同：這裡是各國能源統計的數量，不分來源國。2024 年天然氣中國 179、美國 89、日本 88、德國 74；煤中國 543、印度 233、日本 171、韓國 116、台灣 57。${TAIWAN_NOTE.zh}`,
      en: `Annual imports (EIA): natural gas is pipeline gas and LNG combined, in billion cubic metres; coal is all coal, in million tonnes. Unlike the BACI flows below, these are quantities from national energy statistics, not broken down by partner. In 2024 gas: China 179, the US 89, Japan 88 and Germany 74; coal: China 543, India 233, Japan 171, South Korea 116 and Taiwan 57. ${TAIWAN_NOTE.en}`,
    },
    unit: BCM.unit,
    file: 'eia-import/{item}.json',
    dimension: GAS_COAL,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: BCM.format,
    formatTick: BCM.formatTick,
    itemFormats: VOLUME_FORMATS,
    shareOfWorld: true,
  },
  {
    id: 'eia-export',
    label: { zh: '出口量（EIA）', en: 'Exports (EIA)' },
    description: {
      zh: '每年的出口量（EIA）：天然氣是管道天然氣與液化天然氣（LNG）合計，單位十億立方公尺；煤是各種煤合計，單位百萬公噸。2024 年天然氣美國 218、俄羅斯 148、挪威 126、卡達 126、澳洲 106；煤印尼 558、澳洲 362、俄羅斯 182、美國 98、蒙古 75。管道天然氣的出口含轉口（例如過境比利時的天然氣）。',
      en: 'Annual exports (EIA): natural gas is pipeline gas and LNG combined, in billion cubic metres; coal is all coal, in million tonnes. In 2024 gas: the US 218, Russia 148, Norway 126, Qatar 126 and Australia 106; coal: Indonesia 558, Australia 362, Russia 182, the US 98 and Mongolia 75. Pipeline gas exports include re-exports of gas in transit (through Belgium, for example).',
    },
    unit: BCM.unit,
    file: 'eia-export/{item}.json',
    dimension: GAS_COAL,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: BCM.format,
    formatTick: BCM.formatTick,
    itemFormats: VOLUME_FORMATS,
    shareOfWorld: true,
  },
  {
    id: 'reserves',
    label: { zh: '蘊藏量', en: 'Reserves' },
    description: {
      zh: '探明蘊藏量。原油、天然氣只有 CIA World Factbook 的 2021 年估計（時間軸只有 2021 年），沒有列出的國家不等於沒有蘊藏；煤是 EIA 的 2008–2023 年。',
      en: 'Proved reserves. Crude oil and natural gas have only the CIA World Factbook estimates for 2021 (the time slider shows 2021 only), and a missing country does not mean no reserves; coal is from EIA for 2008–2023.',
    },
    unit: RESERVE_FORMATS[OIL].unit,
    file: 'reserves/{item}.json',
    dimension: FUELS,
    layer: { kind: 'bubble', legendValues: 'auto' },
    format: RESERVE_FORMATS[OIL].format,
    formatTick: RESERVE_FORMATS[OIL].formatTick,
    itemFormats: RESERVE_FORMATS,
    shareOfWorld: true,
  },
  // 全部能源（不分燃料，選燃料的下拉選單不影響）：EIA 的初級能源消費總量，人均用 WPP 人口
  {
    id: 'energy-per-capita',
    label: { zh: '人均能源消費（全部能源）', en: 'Energy use per person (all energy)' },
    description: {
      zh: '每人一年的初級能源消費：石油、天然氣、煤、核能與再生能源合計（EIA 的消費總量 ÷ UN WPP 2024 的人口），單位是十億焦耳（GJ），1 GJ 約是 29 公升汽油的能量。2024 年卡達 808、新加坡 685、巴林 547、阿聯 480 GJ；加拿大 337、美國 289、韓國 253、台灣 209、日本 134、中國 127、印度 27 GJ；世界 78 GJ。產油國與煉油、加油港偏高，直布羅陀、福克蘭群島這類人口很少、賣船用燃料的地方特別高。',
      en: 'Primary energy consumed per person in a year: oil, gas, coal, nuclear and renewables combined (EIA total consumption divided by UN WPP 2024 population), in gigajoules (GJ); 1 GJ is roughly the energy in 29 litres of petrol. In 2024: Qatar 808, Singapore 685, Bahrain 547 and the UAE 480 GJ; Canada 337, the US 289, South Korea 253, Taiwan 209, Japan 134, China 127 and India 27 GJ; 78 GJ worldwide. Oil producers and refining and bunkering hubs run high, and tiny places that sell ship fuel, such as Gibraltar and the Falkland Islands, are extreme.',
    },
    unit: { zh: 'GJ/人', en: 'GJ per person' },
    file: 'energy-per-capita.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 30, 60, 100, 150, 250] } },
    format: (v) => tr({ zh: `${num(v)} GJ`, en: `${num(v)} GJ` }),
    formatTick: tick,
    compareWorld: true,
  },
  {
    id: 'energy-consumption',
    label: { zh: '能源消費總量（全部能源）', en: 'Total energy use (all energy)' },
    description: {
      zh: '一年的初級能源消費總量（石油、天然氣、煤、核能與再生能源合計），單位是艾焦耳（EJ，10¹⁸ 焦耳），圓的面積與它成正比。2024 年全世界 639 EJ（1980 年 296 EJ），中國 180、美國 100、印度 40、俄羅斯 36、日本 17 EJ，台灣 4.8 EJ。',
      en: 'Total primary energy consumed in a year (oil, gas, coal, nuclear and renewables combined), in exajoules (EJ, 10¹⁸ joules); circle area is proportional to it. In 2024 the world used 639 EJ (296 EJ in 1980): China 180, the US 100, India 40, Russia 36 and Japan 17 EJ; Taiwan 4.8 EJ.',
    },
    unit: { zh: '艾焦耳', en: 'EJ' },
    file: 'energy-consumption.json',
    layer: { kind: 'bubble', legendValues: [1, 10, 100] },
    format: (v) => tr({ zh: `${num(v)} 艾焦耳`, en: `${num(v)} EJ` }),
    formatTick: tick,
    shareOfWorld: true,
  },
  // 第十批 163（2026-10-31）：一次能源的組成、能源強度、能源進口依存度（pipeline/topics/energy_mix.py）、煉油能力（refineries.py）
  {
    id: 'primary-mix',
    label: { zh: '一次能源的組成', en: 'Primary energy mix' },
    description: {
      zh: '各種能源占初級能源消費的比例（EIA），子項目選能源。2024 年世界石油 33.2%、煤 29.6%、天然氣 25.7%、再生能源及其他 7.0%、核能 4.7%。煤最高北韓 85.0%、寮國 79.1%、南非 69.9%，中國 61.7%、印度 58.2%；核能法國 43.7%、瑞典 33.2%；再生能源不丹 74.2%、冰島 58.2%、挪威 41.1%。台灣石油 38.4%、煤 31.3%、天然氣 24.6%、再生 3.0%、核能 2.7%（能源署的比例見附註）。',
      en: 'Each source’s share of primary energy consumption (EIA); choose the source in the menu. In 2024 the world used oil 33.2%, coal 29.6%, gas 25.7%, renewables and other 7.0% and nuclear 4.7%. Coal is highest in North Korea (85.0%), Laos (79.1%) and South Africa (69.9%), with China at 61.7% and India 58.2%; nuclear in France (43.7%) and Sweden (33.2%); renewables in Bhutan (74.2%), Iceland (58.2%) and Norway (41.1%). Taiwan: oil 38.4%, coal 31.3%, gas 24.6%, renewables 3.0%, nuclear 2.7% (see the note for the Energy Administration’s shares).',
    },
    unit: '%',
    file: 'primary-mix/{item}.json',
    dimension: MIX_ITEMS,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 70] } },
    format: percent,
    formatTick: (v) => `${v}%`,
    compareWorld: true,
  },
  {
    id: 'energy-intensity',
    label: { zh: '能源強度', en: 'Energy intensity' },
    description: {
      zh: '每 1 美元 GDP 用掉的初級能源（百萬焦耳，MJ）：EIA 的初級能源消費 ÷ 購買力平價 GDP（2015 年的美元）。2024 年世界 4.3 MJ；土庫曼 18.4、北韓 17.7、利比亞 12.4 最高，查德、索馬利亞、澳門 0.7 左右最低；台灣 3.4（1990 年 6.6，少了一半）、日本 3.1、美國 4.4、南韓 5.2、中國 6.2。寒冷、產油、重工業的國家本來就偏高，強度不等於效率。',
      en: 'Primary energy used per US dollar of GDP, in megajoules (MJ): EIA primary energy consumption ÷ GDP at purchasing power parity (2015 dollars). 4.3 MJ worldwide in 2024; Turkmenistan (18.4), North Korea (17.7) and Libya (12.4) are highest and Chad, Somalia and Macao lowest at about 0.7; Taiwan 3.4 (6.6 in 1990, half as much now), Japan 3.1, the US 4.4, South Korea 5.2, China 6.2. Cold, oil-producing and heavy-industry countries run high, so intensity is not the same as efficiency.',
    },
    unit: { zh: 'MJ/美元', en: 'MJ per dollar' },
    file: 'energy-intensity.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 6, 9, 12] } },
    format: (v) => tr({ zh: `每美元 ${num(v)} MJ`, en: `${num(v)} MJ per dollar` }),
    formatTick: tick,
    compareWorld: true,
  },
  {
    id: 'import-dependency',
    label: { zh: '能源進口依存度', en: 'Energy import dependence' },
    description: {
      zh: '整體能源有多少靠進口：1 −（初級能源產量 ÷ 消費），EIA。負的是淨出口（產量比消費多），挪威 −717%、澳洲 −198%、沙烏地阿拉伯 −127%、俄羅斯 −76%、美國 −9.5%。2024 年香港 99.8%、新加坡 99.0%、台灣 94.3%、日本 87.5%、南韓 82.9%、德國 71.1%、印度 40.4%、中國 23.3%。EIA 把核能算自產，能源署把核燃料算進口，所以台灣比能源署的數字低（見附註）。',
      en: 'How much of all energy is imported: 1 − (primary energy production ÷ consumption), EIA. Negative values are net exporters (producing more than they use): Norway −717%, Australia −198%, Saudi Arabia −127%, Russia −76%, the US −9.5%. In 2024 Hong Kong was at 99.8%, Singapore 99.0%, Taiwan 94.3%, Japan 87.5%, South Korea 82.9%, Germany 71.1%, India 40.4% and China 23.3%. The EIA counts nuclear as domestic while Taiwan’s Energy Administration counts nuclear fuel as imported, so Taiwan’s figure is lower than the official one (see the note).',
    },
    unit: '%',
    file: 'import-dependency.json',
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-200, -50, -10, 10, 50, 90], reverse: true } },
    format: (v) => (v < 0 ? tr({ zh: `淨出口（${num(v)}%）`, en: `Net exporter (${num(v)}%)` }) : `${num(v)}%`),
    formatTick: (v) => `${v}%`,
    compareWorld: true,
  },
  {
    id: 'refining-capacity',
    label: { zh: '煉油能力', en: 'Refining capacity' },
    description: {
      zh: '運轉中的煉油廠一天能處理的原油合計（萬桶），圓的面積與它成正比；地圖上的點是 Wikidata 有座標的煉油廠（不到三成），大小是能力，顏色是狀態。依英文維基百科「List of oil refineries」2026-10-18 的版本：美國 1,857 萬桶/日最多，俄羅斯 511、印度 467、中國 388、日本 381、沙烏地阿拉伯 319、南韓 308；最大的煉油廠是印度 Jamnagar 140 萬桶/日。台灣 74 萬（麥寮 54、桃園 20、大林 10）。清單不完整：中國的地方煉油廠多半沒有列、印度有的只寫年處理噸數，合計明顯偏低。',
      en: 'Total crude oil that operating refineries can process per day (10,000 barrels); circle area is proportional to it. Dots are the refineries that have coordinates in Wikidata (under 30%), sized by capacity and coloured by status. Based on English Wikipedia’s “List of oil refineries” as of 18 October 2026: the US leads with 18.6 million barrels a day, then Russia 5.1, India 4.7, China 3.9, Japan 3.8, Saudi Arabia 3.2 and South Korea 3.1 million; the largest refinery is India’s Jamnagar at 1.4 million. Taiwan 0.74 million (Mailiao 0.54, Taoyuan 0.20, Dalin 0.10). The list is incomplete: most of China’s independent refineries are missing and some Indian ones give only tonnes a year, so totals are clearly too low.',
    },
    unit: { zh: '萬桶/日', en: '10,000 b/d' },
    file: 'refining-capacity.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    format: (v) => tr({ zh: `${num(v)} 萬桶/日`, en: `${fixed(v * 10, 0)} thousand b/d` }),
    formatTick: tick,
    timeless: true,
    shareOfWorld: true,
  },
  flow(
    'export',
    { zh: '流向：出口對象', en: 'Flows: export destinations' },
    {
      zh: '點選國家，弧線連到它的前 15 大出口對象，線寬與數量（公噸）成正比。單價明顯不對的數量已改用金額估算，tooltip 會註明。伊朗 2023、2024 年沒有進口國申報，地圖上看不到伊朗的原油出口。管道天然氣約 0.7–0.75 百萬公噸是 10 億立方公尺。',
      en: 'Click a country to draw arcs to its top 15 export destinations; line width is proportional to quantity in tonnes. Quantities with implausible unit prices were re-estimated from value, as noted in the tooltip. No importer reported crude from Iran in 2023 or 2024, so Iranian crude exports do not appear. For pipeline gas, about 0.7–0.75 million tonnes is one billion cubic metres.',
    },
  ),
  flow(
    'import',
    { zh: '流向：進口來源', en: 'Flows: import sources' },
    {
      zh: '點選國家，弧線連到它的前 15 大進口來源，線寬與數量（公噸）成正比。台灣在 BACI 沒有自己的申報，數字來自出口國，能源署的進口來源見側欄。',
      en: "Click a country to draw arcs to its top 15 import sources; line width is proportional to quantity in tonnes. Taiwan has no reports of its own in BACI, so its figures come from exporters; the Energy Administration's import sources are in the side panel.",
    },
  ),
];
/** 分燃料的指標（檔名有 {item}）：GEM 的管線、油氣田與煤礦只在這些指標畫，全部能源的兩個指標不畫 */
const FUEL_INDICATORS = indicators.filter((i) => i.file.includes('{item}') && i.id !== 'primary-mix').map((i) => i.id);

// ── 煉油廠（第十批 163，pipeline/topics/refineries.py）─────────────────

const REFINERY_STATUS: Record<number, Text> = {
  1: { zh: '運轉中', en: 'Operating' },
  2: { zh: '規劃或興建中', en: 'Planned or under construction' },
  3: { zh: '已關閉', en: 'Closed' },
};
const REFINERY_COLORS: ColorClasses = {
  field: 'st',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [2, 3],
  classes: [
    { color: MAP_TOKENS.categorical[0], label: REFINERY_STATUS[1] },
    { color: MAP_TOKENS.hues.yellow, label: REFINERY_STATUS[2] },
    { color: MAP_TOKENS.inkSecondary, label: REFINERY_STATUS[3] },
  ],
};
function refineryTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const zh = typeof p.zh === 'string' ? p.zh : null;
  const name = tr({ zh: zh ?? String(p.name ?? ''), en: String(p.name ?? '') });
  const cap =
    typeof p.cap === 'number'
      ? tr({ zh: `每日 ${num(p.cap)} 萬桶${p.est ? '（由年處理噸數換算）' : ''}`, en: `${fixed(p.cap * 10, 0)} thousand b/d${p.est ? ' (converted from tonnes a year)' : ''}` })
      : tr({ zh: '能力不詳', en: 'Capacity unknown' });
  return {
    title: name,
    detail: [typeof p.st === 'number' ? tr(REFINERY_STATUS[p.st]) : null, cap].filter(Boolean).join(' · '),
    extra: [
      typeof p.op === 'string' ? p.op : null,
      typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      tr({ zh: '能力依英文維基百科 2026-10-18 的版本（各廠的資料年份不一）', en: 'Capacity per English Wikipedia as of 18 Oct 2026 (data years vary)' }),
    ].filter((x): x is string => Boolean(x)),
    properNoun: zh ? String(p.name ?? '') : undefined,
  };
}

// ── GEM 的疊加圖層 ─────────────────────────────────

/** 狀態代碼（pipeline 的 LINE_STATUS、FIELD_STATUS、MINE_STATUS） */
const LINE_STATUS: Record<number, Text> = {
  1: { zh: '運轉中', en: 'Operating' },
  2: { zh: '興建中', en: 'Under construction' },
  3: { zh: '規劃中', en: 'Proposed' },
};
const FIELD_STATUS: Record<number, Text> = {
  1: { zh: '生產中', en: 'Producing' },
  2: { zh: '開發中', en: 'In development' },
  3: { zh: '已發現、尚未開發', en: 'Discovered, not yet developed' },
};
const MINE_STATUS: Record<number, Text> = {
  1: { zh: '運轉中', en: 'Operating' },
  2: { zh: '規劃中', en: 'Proposed' },
  3: { zh: '已關閉', en: 'Closed' },
  4: { zh: '封存', en: 'Mothballed' },
};

const countries = (p: PointRecord, countryName: (iso3: string) => string) =>
  typeof p.c === 'string' && p.c ? p.c.split(' ').map(countryName).join(tr({ zh: '、', en: ', ' })) : null;

function pipelineTooltip(kind: 'gas' | 'oil') {
  return (p: PointRecord, ctx: { countryName: (iso3: string) => string }) => {
    const st = typeof p.st === 'number' ? p.st : 1;
    const start = typeof p.start === 'number' ? p.start : null;
    const parts = [
      tr(LINE_STATUS[st]),
      start ? tr(st === 1 ? { zh: `${start} 年啟用`, en: `since ${start}` } : { zh: `預計 ${start} 年啟用`, en: `expected ${start}` }) : null,
      typeof p.cap === 'number' && p.cap > 0 ? tr({ zh: `每年 ${num(p.cap)} 十億立方公尺`, en: `${num(p.cap)} bcm/y` }) : null,
      countries(p, ctx.countryName),
    ];
    return {
      title: tr(kind === 'gas' ? { zh: '天然氣管線', en: 'Gas pipeline' } : { zh: '油管', en: 'Oil pipeline' }),
      detail: parts.filter(Boolean).join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  };
}

/** LNG 接收站：容量（百萬公噸/年），各分期列在下面 */
const mtpa = (v: number) => tr({ zh: `每年 ${num(v)} 百萬公噸`, en: `${num(v)} Mt/y` });
function lngTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const op = typeof p.op === 'number' ? p.op : 0;
  const plan = typeof p.plan === 'number' ? p.plan : 0;
  const kind = p.kind === 2 ? { zh: 'LNG 出口（液化廠）', en: 'LNG export (liquefaction)' } : { zh: 'LNG 進口接收站', en: 'LNG import terminal' };
  const parts = [
    op > 0 ? tr({ zh: `運轉中 ${mtpa(op)}`, en: `operating ${mtpa(op)}` }) : null,
    plan > 0 ? tr({ zh: `興建中與規劃中 ${mtpa(plan)}`, en: `under construction or proposed ${mtpa(plan)}` }) : null,
    typeof p.start === 'number' ? tr({ zh: `${p.start} 年啟用`, en: `since ${p.start}` }) : null,
    typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
  ];
  const extra =
    typeof p.ph === 'string' && p.ph
      ? p.ph.split(';').map((row) => {
          const [name, st, cap, year] = row.split('|');
          const status = tr(LINE_STATUS[Number(st)] ?? LINE_STATUS[1]);
          return [name || tr({ zh: '（未命名）', en: '(unnamed)' }), status, mtpa(Number(cap)), year].filter(Boolean).join(' · ');
        })
      : undefined;
  return {
    title: tr(kind),
    detail: parts.filter(Boolean).join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
    extra,
  };
}

function fieldTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const st = typeof p.st === 'number' ? p.st : 1;
  const parts = [
    tr(FIELD_STATUS[st] ?? FIELD_STATUS[1]),
    typeof p.prod === 'number'
      ? tr({
          zh: `每年 ${num(p.prod)} 百萬桶油當量${typeof p.py === 'number' ? `（${p.py} 年）` : ''}`,
          en: `${num(p.prod)} million boe/y${typeof p.py === 'number' ? ` (${p.py})` : ''}`,
        })
      : null,
    typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
  ];
  return {
    title: tr({ zh: '油氣田', en: 'Oil and gas field' }),
    detail: parts.filter(Boolean).join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

function mineTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const st = typeof p.st === 'number' ? p.st : 1;
  const type = p.type === 1 ? { zh: '露天', en: 'surface' } : p.type === 2 ? { zh: '地下', en: 'underground' } : null;
  const parts = [
    tr(MINE_STATUS[st] ?? MINE_STATUS[1]),
    type ? tr(type) : null,
    typeof p.cap === 'number' ? tr({ zh: `產能每年 ${num(p.cap)} 百萬公噸`, en: `capacity ${num(p.cap)} Mt/y` }) : null,
    typeof p.prod === 'number'
      ? tr({
          zh: `產量 ${num(p.prod)} 百萬公噸${typeof p.py === 'number' ? `（${p.py} 年）` : ''}`,
          en: `output ${num(p.prod)} Mt${typeof p.py === 'number' ? ` (${p.py})` : ''}`,
        })
      : null,
    typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
  ];
  return {
    title: tr({ zh: '煤礦', en: 'Coal mine' }),
    detail: parts.filter(Boolean).join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

/**
 * 顏色（MAP_TOKENS）：天然氣用淡紫（發電廠地圖的燃氣也是），興建中紫、規劃中琥珀虛線（跟海底電纜的規劃中一樣）；
 * 原油鏽紅、天然氣液洋紅；LNG 進口薄荷綠、出口紫；油氣田生產中綠、開發中琥珀；煤礦鏽紅（發電廠地圖的燃煤）。
 */
const C = MAP_TOKENS.categorical;
const GAS_COLOR = C[1];
const PLANNED_COLOR = MAP_TOKENS.hues.yellow;

const LNG_COLORS: ColorClasses = {
  field: 'kind',
  title: { zh: '種類', en: 'Type' },
  thresholds: [1.5],
  classes: [
    { color: C[0], label: { zh: '進口（再氣化）', en: 'Import (regasification)' } },
    { color: C[6], label: { zh: '出口（液化）', en: 'Export (liquefaction)' } },
  ],
};
const LNG_RADIUS: [number, number][] = [
  [0.5, 1.6],
  [5, 3.4],
  [20, 6.5],
  [80, 13],
];
const LNG_SIZES = { title: { zh: '容量（百萬公噸/年）', en: 'Capacity (Mt/y)' }, values: [5, 20, 80], format: tick };

const FIELD_COLORS: ColorClasses = {
  field: 'st',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [1.5],
  classes: [
    { color: C[3], label: FIELD_STATUS[1] },
    { color: C[2], label: { zh: '開發中與已發現', en: 'In development or discovered' } },
  ],
};
const MINE_SIZES = { title: { zh: '產能（百萬公噸/年）', en: 'Capacity (Mt/y)' }, values: [1, 10, 50], format: tick };

const mineLayer = (id: string, file: string, label: Text, color: string, hidden: boolean): PointsOverlayDef => ({
  kind: 'points',
  id,
  file,
  label,
  indicators: FUEL_INDICATORS,
  items: [COAL],
  ...(hidden ? { hidden: true } : {}),
  radius: {
    field: 'cap',
    stops: [
      [0.1, 1],
      [1, 1.6],
      [10, 4],
      [50, 8.5],
      [150, 14],
    ],
  },
  color,
  sizeLegend: MINE_SIZES,
  tooltip: mineTooltip,
});

export const fossilFuels: TopicDefinition = {
  id: 'fossil-fuels',
  title: { zh: '石油、天然氣與煤', en: 'Oil, gas and coal' },
  shortTitle: { zh: '化石燃料', en: 'Fossil fuels' },
  defaultIndicator: 'production',
  defaultYear: 2024,
  dimension: FUELS,
  places: PLACES,
  sources: [
    {
      name: {
        zh: 'U.S. Energy Information Administration, International Energy Statistics（2026 年 10 月）',
        en: 'U.S. Energy Information Administration, International Energy Statistics (October 2026)',
      },
      url: 'https://www.eia.gov/international/data/world',
      license: { zh: '公有領域', en: 'Public domain' },
    },
    {
      name: {
        zh: 'CIA World Factbook（2021 年估計；factbook/factbook.json 鏡像）',
        en: 'CIA World Factbook (2021 estimates; factbook/factbook.json mirror)',
      },
      url: 'https://github.com/factbook/factbook.json',
      license: { zh: '公有領域', en: 'Public domain' },
    },
    {
      name: 'CEPII, BACI (HS 1992, V202601)',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
    {
      name: 'Global Gas Infrastructure Tracker, Global Energy Monitor, November 2025 (pipelines) and October 2026 (LNG terminals)',
      url: 'https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: 'Global Oil Infrastructure Tracker, Global Energy Monitor, June 2026 release',
      url: 'https://globalenergymonitor.org/projects/global-oil-infrastructure-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: 'Global Oil and Gas Extraction Tracker, Global Energy Monitor, March 2026 release',
      url: 'https://globalenergymonitor.org/projects/global-oil-gas-extraction-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: 'Global Energy Monitor, Global Coal Mine Tracker, August 2026 release',
      url: 'https://globalenergymonitor.org/projects/global-coal-mine-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of oil refineries」（2026-10-18 的版本，煉油廠與能力）',
        en: 'English Wikipedia, “List of oil refineries” (revision of 18 October 2026, refineries and capacities)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380836230',
      license: { zh: 'CC BY-SA 4.0（煉油能力與煉油廠的資料檔也是）', en: 'CC BY-SA 4.0 (so are the refining data files)' },
    },
    { name: { zh: 'Wikidata（煉油廠的座標）', en: 'Wikidata (refinery coordinates)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '聯合國 World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '經濟部能源署 能源供給年資料、能源指標年資料、原油／液化天然氣／煤炭進口來源年資料（台灣的對照）',
        en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): energy supply, energy indicators and crude oil, LNG and coal import sources (for comparison)',
      },
      url: 'https://data.gov.tw/dataset/163714',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '產量、消費量與自給率是 EIA 的估計，各國同一套方法；全部能源的消費是 EIA 的初級能源消費（核能與再生能源依 EIA 的方法換算，跟 IEA 的數字不同）；1992 年以前的蘇聯、南斯拉夫等畫在當時的首都，1990 年以前的德國是東西德合計。流向是 CEPII BACI 的貿易數量，台灣在 BACI 列為「Other Asia, nes」，數字來自貿易夥伴。管線、接收站、油氣田與煤礦是 GEM 的 2026 年資料，不跟時間軸變；管線簡化到約 1 公里。',
    en: 'Production, consumption and self-sufficiency are EIA estimates made the same way for every country; energy use across all sources is EIA primary energy consumption (nuclear and renewables are converted by EIA’s method, so figures differ from the IEA’s); before 1992 the Soviet Union, Yugoslavia and others are drawn at their former capitals, and Germany before 1991 is East and West combined. Flows are trade quantities from CEPII BACI, where Taiwan appears as "Other Asia, nes" and its figures come from trading partners. Pipelines, terminals, fields and mines are 2026 data from GEM and do not change with the time slider; pipelines are simplified to about 1 km.',
  },
  panelExtra: () => import('./panels/FossilFuelsPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'gas-pipelines',
      file: 'gas-pipelines.json',
      label: { zh: '天然氣管線', en: 'Gas pipelines' },
      indicators: FUEL_INDICATORS,
      items: [GAS, PIPELINE],
      width: 1,
      color: {
        title: { zh: '狀態', en: 'Status' },
        classes: [
          { value: 1, color: GAS_COLOR, label: LINE_STATUS[1] },
          { value: 2, color: C[6], dash: true, label: LINE_STATUS[2] },
          { value: 3, color: PLANNED_COLOR, dash: true, label: LINE_STATUS[3] },
        ],
      },
      tooltip: pipelineTooltip('gas'),
    },
    {
      kind: 'points',
      id: 'lng',
      file: 'lng-operating.json',
      label: { zh: 'LNG 接收站（運轉中）', en: 'LNG terminals (operating)' },
      indicators: FUEL_INDICATORS,
      items: [GAS, PIPELINE],
      radius: { field: 'op', stops: LNG_RADIUS },
      color: LNG_COLORS,
      sizeLegend: LNG_SIZES,
      tooltip: lngTooltip,
    },
    {
      kind: 'points',
      id: 'lng-planned',
      file: 'lng-planned.json',
      label: { zh: 'LNG 接收站（只有興建中或規劃中）', en: 'LNG terminals (under construction or proposed only)' },
      indicators: FUEL_INDICATORS,
      items: [GAS, PIPELINE],
      hidden: true,
      radius: { field: 'plan', stops: LNG_RADIUS },
      color: LNG_COLORS,
      sizeLegend: LNG_SIZES,
      tooltip: lngTooltip,
    },
    {
      kind: 'lines',
      id: 'oil-pipelines',
      file: 'oil-pipelines.json',
      label: { zh: '油管', en: 'Oil pipelines' },
      indicators: FUEL_INDICATORS,
      items: [OIL],
      width: 1,
      color: {
        title: { zh: '種類與狀態', en: 'Type and status' },
        classes: [
          { value: 1, color: C[5], label: { zh: '原油（運轉中）', en: 'Crude oil (operating)' } },
          { value: 2, color: C[5], dash: true, label: { zh: '原油（興建中、規劃中）', en: 'Crude oil (under construction, proposed)' } },
          { value: 3, color: C[7], label: { zh: '天然氣液（運轉中）', en: 'Natural gas liquids (operating)' } },
          { value: 4, color: C[7], dash: true, label: { zh: '天然氣液（興建中、規劃中）', en: 'Natural gas liquids (under construction, proposed)' } },
        ],
      },
      tooltip: pipelineTooltip('oil'),
    },
    {
      kind: 'points',
      id: 'fields',
      file: 'fields.json',
      label: { zh: '油氣田', en: 'Oil and gas fields' },
      indicators: FUEL_INDICATORS,
      items: [OIL, GAS],
      radius: {
        field: 'prod',
        stops: [
          [0, 1.2],
          [10, 2],
          [100, 4.5],
          [500, 9],
          [1500, 15],
        ],
      },
      color: FIELD_COLORS,
      sizeLegend: { title: { zh: '產量（百萬桶油當量/年）', en: 'Output (million boe/y)' }, values: [10, 100, 500], format: tick },
      tooltip: fieldTooltip,
    },
    mineLayer('mines', 'mines-operating.json', { zh: '煤礦（運轉中）', en: 'Coal mines (operating)' }, C[5], false),
    mineLayer('mines-proposed', 'mines-proposed.json', { zh: '煤礦（規劃中）', en: 'Coal mines (proposed)' }, PLANNED_COLOR, true),
    mineLayer(
      'mines-closed',
      'mines-closed.json',
      { zh: '煤礦（已關閉或封存）', en: 'Coal mines (closed or mothballed)' },
      MAP_TOKENS.inkSecondary,
      true,
    ),
    {
      kind: 'points',
      id: 'refineries',
      file: 'refineries.json',
      label: { zh: '煉油廠（Wikidata 有座標的）', en: 'Refineries (with coordinates in Wikidata)' },
      indicators: ['refining-capacity'],
      radius: {
        field: 'cap',
        stops: [
          [0, 2],
          [10, 4],
          [50, 9],
          [140, 15],
        ],
      },
      color: REFINERY_COLORS,
      sortField: 'cap',
      sizeLegend: { title: { zh: '能力（萬桶/日）', en: 'Capacity (10,000 b/d)' }, values: [10, 50, 140], format: tick },
      tooltip: refineryTooltip,
    },
  ],
  indicators,
};
