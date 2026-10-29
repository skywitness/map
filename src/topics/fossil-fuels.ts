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
const FUEL_INDICATORS = indicators.filter((i) => i.file.includes('{item}')).map((i) => i.id);

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
      name: { zh: '聯合國 World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '經濟部能源署 能源供給年資料、原油／液化天然氣／煤炭進口來源年資料（台灣的對照）',
        en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): energy supply and crude oil, LNG and coal import sources (for comparison)',
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
  ],
  indicators,
};
