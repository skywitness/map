import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, PointRecord, Text, TopicDefinition } from './types';

/**
 * 海洋與漁業（pipeline/topics/oceans.py）：Marine Regions 第 12 版的專屬經濟海域（面積、跟陸地比、界線），
 * FAO FishStat 的捕撈與養殖產量（1950–2024 年）。
 * 重疊主張與共同管理區照 Marine Regions 的分類呈現（未解決的界線畫虛線），不替任何爭議下判斷。
 */

const KM2 = 'km²';
const TONNES = { zh: '公噸', en: 'tonnes' };

export const km2 = (v: number) => `${formatLargeNumber(v)} km²`;
export const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` });
const kg = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 公斤`, en: `${fixed(v, v < 10 ? 1 : 0)} kg` });
const times = (v: number) => {
  const digits = v === 0 ? 0 : v < 1 ? 2 : v < 10 ? 1 : 0;
  return tr({ zh: `${fixed(v, digits)} 倍`, en: `${fixed(v, digits)}×` });
};
const kilometres = (v: number) => tr({ zh: `約 ${fixed(v, 0)} 公里`, en: `About ${fixed(v, 0)} km` });

/**
 * 界線的分類（pipeline 的 LINE_TYPES，lines 的 types）。顏色取自 MAP_TOKENS，都跟藍色的海分得開：
 * 外緣是深灰（深色底圖換成淺灰）、條約或判決是紫、等距中線是琥珀、共同管理區是綠、未解決是洋紅虛線。
 */
export const LINE_CLASSES = {
  outer: 0,
  agreed: 1,
  median: 2,
  joint: 3,
  unsettled: 4,
} as const;

/** 每條界線的細分（紀錄的 k，pipeline 的 LINE_TYPES 第二個數字） */
const LINE_KINDS: Record<number, Text> = {
  0: { zh: '200 浬外緣', en: '200-nautical-mile outer limit' },
  1: { zh: '12 浬外緣', en: '12-nautical-mile limit' },
  2: { zh: '依條約劃定', en: 'Boundary set by treaty' },
  3: { zh: '依國際法院或仲裁判決劃定', en: 'Boundary set by a court or tribunal' },
  4: { zh: '單方主張，沒有爭議', en: 'Unilateral claim, undisputed' },
  5: { zh: '等距中線：沒有條約，Marine Regions 依等距原則畫的', en: 'Median line: no treaty; drawn by Marine Regions on the equidistance principle' },
  6: { zh: '共同管理區的界線', en: 'Boundary of a joint regime area' },
  7: { zh: '未解決：島嶼或領土的主權有爭議', en: 'Unsettled: disputed sovereignty over islands or territory' },
  8: { zh: '未解決的等距中線：島嶼或領土的主權有爭議', en: 'Unsettled median line: disputed sovereignty over islands or territory' },
  9: { zh: '未解決：海域劃界有爭議', en: 'Unsettled: disputed maritime delimitation' },
  10: { zh: '未解決的等距中線：海域劃界有爭議', en: 'Unsettled median line: disputed maritime delimitation' },
  11: { zh: '連接線（把兩段界線接起來的短線）', en: 'Connecting segment between boundary lines' },
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** 界線一邊的海域：國家（含夏威夷這類的部分）、重疊主張區或共同管理區 */
export function sideName(p: PointRecord, prefix: 'a' | 'b', countryName: (iso3: string) => string): string | null {
  const iso = str(p[prefix]);
  const place = str(p[`${prefix}n`]) && str(p[`${prefix}nEn`]) ? tr({ zh: String(p[`${prefix}n`]), en: String(p[`${prefix}nEn`]) }) : null;
  const parties = (str(p[`${prefix}p`]) ?? '').split(' ').filter(Boolean).map(countryName);
  const kind = p[`${prefix}k`];
  const list = parties.join(tr({ zh: '、', en: ', ' }));
  if (kind === 1) {
    if (!parties.length) return tr({ zh: `${place}的重疊主張區`, en: `${place} (overlapping claims)` });
    return place
      ? tr({ zh: `${place}（重疊主張：${list}）`, en: `${place} (overlapping claim: ${list})` })
      : tr({ zh: `重疊主張區（${list}）`, en: `Overlapping claim (${list})` });
  }
  if (kind === 2) {
    return place
      ? tr({ zh: `${place}共同管理區（${list}）`, en: `${place} joint regime (${list})` })
      : tr({ zh: `共同管理區（${list}）`, en: `Joint regime area (${list})` });
  }
  if (!iso) return null;
  return place ? tr({ zh: `${countryName(iso)}（${place}）`, en: `${countryName(iso)} (${place})` }) : countryName(iso);
}

function lineTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const a = sideName(p, 'a', ctx.countryName);
  const b = sideName(p, 'b', ctx.countryName);
  const kind = LINE_KINDS[Number(p.k)] ?? LINE_KINDS[11];
  const title = a && b ? `${a} — ${b}` : (a ?? b ?? tr({ zh: '專屬經濟海域的界線', en: 'EEZ boundary' }));
  return {
    title,
    detail: tr(kind),
    extra: typeof p.km === 'number' && p.km > 0 ? [kilometres(p.km)] : undefined,
  };
}

const EEZ_LINES: LinesOverlayDef = {
  kind: 'lines',
  id: 'eez',
  file: 'eez-lines.json',
  label: { zh: '專屬經濟海域的界線（Marine Regions）', en: 'EEZ boundaries (Marine Regions)' },
  width: 1,
  color: {
    title: { zh: '界線的性質（照 Marine Regions 的分類）', en: 'Boundary type (as classified by Marine Regions)' },
    classes: [
      { value: LINE_CLASSES.outer, color: MAP_TOKENS.inkSecondary, label: { zh: '200 浬外緣', en: '200 NM outer limit' } },
      { value: LINE_CLASSES.agreed, color: MAP_TOKENS.categorical[6], label: { zh: '條約或判決劃定', en: 'Treaty or ruling' } },
      { value: LINE_CLASSES.median, color: MAP_TOKENS.hues.yellow, label: { zh: '等距中線（沒有條約）', en: 'Median line (no treaty)' } },
      { value: LINE_CLASSES.joint, color: MAP_TOKENS.categorical[3], label: { zh: '共同管理區', en: 'Joint regime' } },
      {
        value: LINE_CLASSES.unsettled,
        color: MAP_TOKENS.categorical[7],
        dash: true,
        label: { zh: '未解決（主權或劃界有爭議）', en: 'Unsettled (disputed)' },
      },
    ],
  },
  tooltip: lineTooltip,
};

/** 專屬經濟海域的兩個指標：沒有值的原因 */
const EEZ_NO_VALUE: Record<string, Text> = {
  IOT: {
    zh: 'Marine Regions 把查哥斯群島的海域列在模里西斯之下',
    en: 'Marine Regions lists the waters of the Chagos Archipelago under Mauritius',
  },
  GIB: {
    zh: 'Marine Regions 把直布羅陀周邊海域標為重疊主張（英國、西班牙），沒有算進任何一方',
    en: 'Marine Regions classifies the waters off Gibraltar as an overlapping claim (UK and Spain); not counted for either',
  },
  ATA: {
    zh: 'Marine Regions 沒有劃南極洲的專屬經濟海域（南極條約凍結了各國的主權主張）',
    en: 'Marine Regions draws no EEZ for Antarctica (the Antarctic Treaty freezes territorial claims)',
  },
  BVT: { zh: 'Marine Regions 第 12 版沒有布威島的專屬經濟海域', en: 'Marine Regions version 12 has no EEZ for Bouvet Island' },
  HKG: { zh: 'Marine Regions 沒有另外劃出香港的海域', en: 'Marine Regions does not delimit separate waters for Hong Kong' },
  MAC: { zh: 'Marine Regions 沒有另外劃出澳門的海域', en: 'Marine Regions does not delimit separate waters for Macao' },
  ALA: { zh: 'Marine Regions 沒有另外劃出奧蘭群島的海域', en: 'Marine Regions does not delimit separate waters for Åland' },
};

const EEZ_TEXT = {
  zh: '依《聯合國海洋法公約》，沿海國在離岸 200 浬（約 370 km）內有開發漁業、能源等資源的權利，跟鄰國之間依條約、判決或等距中線劃分。面積是 Marine Regions 第 12 版（2023），含內水與領海；海外領地各自計算，重疊主張與共同管理的海域不算進任何一方（見附註與側欄）。',
  en: 'Under the UN Convention on the Law of the Sea, coastal states have rights over fisheries, energy and other resources up to 200 nautical miles (about 370 km) offshore, divided from neighbours by treaty, ruling or median line. Areas from Marine Regions v12 (2023), including internal and territorial waters; overseas territories count separately, and overlapping claims and joint regimes count for no party (see notes and side panel).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'eez',
    label: { zh: '專屬經濟海域面積', en: 'EEZ area' },
    description: {
      zh: `${EEZ_TEXT.zh}線是界線，滑過看兩邊與性質。`,
      en: `${EEZ_TEXT.en} Lines are boundaries: hover for details.`,
    },
    unit: KM2,
    file: 'eez.json',
    layer: { kind: 'bubble', legendValues: [1e5, 1e6, 5e6] },
    format: km2,
    formatTick: formatLargeTick,
    shareOfWorld: true,
    defaultYear: 2023,
    noValue: EEZ_NO_VALUE,
  },
  {
    id: 'eez-land',
    label: { zh: '海域是陸地的幾倍', en: 'EEZ to land area' },
    description: {
      zh: '專屬經濟海域面積除以陸地面積（FAOSTAT，不含湖泊、河流等內陸水域）。太平洋的小島國，海域是陸地的幾千倍；內陸國是 0。',
      en: 'EEZ area divided by land area (FAOSTAT, excluding lakes, rivers and other inland water). Small Pacific island states have zones thousands of times their land; landlocked countries are 0.',
    },
    unit: { zh: '倍', en: '×' },
    file: 'eez-land.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 3, 10, 100, 1000] } },
    format: times,
    formatTick: (v) => (v >= 1000 ? formatLargeTick(v) : fixed(v, v < 1 ? 1 : 0)),
    defaultYear: 2023,
    noValue: EEZ_NO_VALUE,
  },
  {
    id: 'capture',
    label: { zh: '捕撈漁業產量', en: 'Capture fisheries' },
    description: {
      zh: '一年捕撈的魚、甲殼類、軟體動物等水生動物（活體重量，不含海藻），海洋與內陸水域都算。算在漁船的船旗國，不論在哪裡捕到：台灣、中國、西班牙等國的遠洋漁船在別國周邊與公海捕的魚，都算在船旗國（側欄有在哪些海域捕的）。圓的面積與產量成正比。',
      en: 'Fish, crustaceans, molluscs and other aquatic animals caught in a year (live weight, excluding seaweed), in marine and inland waters. Catches count for the vessel’s flag state wherever they are made: fish caught by distant-water fleets from Taiwan, China, Spain and others off other coasts and on the high seas count for the flag state (the side panel shows the fishing areas). Circle area is proportional to the catch.',
    },
    unit: TONNES,
    file: 'capture.json',
    layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'aquaculture',
    label: { zh: '養殖漁業產量', en: 'Aquaculture' },
    description: {
      zh: '一年養殖的魚、蝦、貝類等水生動物（活體重量，貝類含殼；不含海藻），海水、半鹹水與淡水養殖都算。中國占全世界一半以上。圓的面積與產量成正比。',
      en: 'Fish, shrimp, shellfish and other aquatic animals farmed in a year (live weight, shells included; excluding seaweed), in marine, brackish and fresh water. China produces over half of the world total. Circle area is proportional to output.',
    },
    unit: TONNES,
    file: 'aquaculture.json',
    layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'aqua-share',
    label: { zh: '養殖占漁業產量', en: 'Aquaculture share' },
    description: {
      zh: '養殖占捕撈加養殖的比例（水生動物，活體重量）。全世界的養殖在 2021 年追上捕撈，2024 年占 53%。青綠色以養殖為主、橘色以捕撈為主；一年產量不到 100 公噸的國家不算。',
      en: 'Aquaculture as a share of capture plus aquaculture (aquatic animals, live weight). Worldwide, farming caught up with fishing in 2021 and made up 53% in 2024. Teal means mostly farmed, orange mostly caught; countries producing under 100 tonnes a year are left out.',
    },
    unit: '%',
    file: 'aqua-share.json',
    layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [10, 25, 45, 55, 75, 90] } },
    format: (v) => formatPercent(v, 1),
    formatTick: (v) => `${fixed(v, 0)}%`,
    compareWorld: true,
  },
  {
    id: 'per-capita',
    label: { zh: '人均漁業產量', en: 'Fish output per person' },
    description: {
      zh: '捕撈加養殖除以人口（公斤／人，活體重量）。是生產，不是吃了多少：每人吃的魚與海鮮見「各國飲食」主題的水產供給量。',
      en: 'Capture plus aquaculture divided by population (kg per person, live weight). This is production, not consumption: for fish and seafood eaten per person see Diet by country.',
    },
    unit: { zh: '公斤', en: 'kg' },
    file: 'per-capita.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50, 100] } },
    format: kg,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  },
];

export const oceans: TopicDefinition = {
  id: 'oceans',
  title: { zh: '海洋與漁業', en: 'Oceans and fisheries' },
  shortTitle: { zh: '海洋與漁業', en: 'Fisheries' },
  defaultIndicator: 'eez',
  defaultYear: 2024,
  sources: [
    {
      name: 'Flanders Marine Institute (2023). Maritime Boundaries Geodatabase v12, MarineRegions.org',
      url: 'https://doi.org/10.14284/632',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'FAO. 2026. FishStat: Global production by production source 1950–2024（2026-10-26 查閱）',
        en: 'FAO. 2026. FishStat: Global production by production source 1950–2024 (accessed 26 October 2026)',
      },
      url: 'https://www.fao.org/fishery/en/collection/global_production',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'FAOSTAT 土地利用（陸地面積）', en: 'FAOSTAT Land Use (land area)' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '聯合國 World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '農業部漁業署《漁業統計年報》（台灣的對照數字）', en: 'Fisheries Agency (Taiwan), Fisheries Statistical Yearbook (for comparison)' },
      url: 'https://www.fa.gov.tw/list.php?theme=FS_AR',
      license: { zh: '引用統計數字並註明出處', en: 'figures cited with source' },
    },
  ],
  // 頁尾要短：英文版太長會把地圖擠扁（細節寫在指標說明、附註、側欄與 DESIGN.md）
  note: {
    zh: 'Marine Regions 對任何國家、領土的法律地位與界線不表示意見；這裡照它的分類呈現重疊主張與共同管理區（未解決的界線畫虛線），不代表本站的立場。界線簡化到約 500 公尺。漁業只算水生動物（不含海藻），活體重量；FAO 的「Taiwan Province of China」照其他主題寫台灣。每人吃多少水產見「各國飲食」主題，港口與船隊見「航運與港口」主題，河川帶進海洋的塑膠見「塑膠污染」主題。',
    en: 'Marine Regions expresses no opinion on the legal status of any country or territory or on boundaries; overlapping claims and joint regimes are shown as it classifies them (unsettled boundaries dashed), implying no position of this site. Boundaries simplified to about 500 m. Fisheries cover aquatic animals only (no seaweed), live weight; FAO’s “Taiwan Province of China” is shown as Taiwan. For seafood eaten per person see Diet by country; for ports and fleets see Shipping and ports; for plastic carried to the sea by rivers see Plastic pollution.',
  },
  panelExtra: () => import('./panels/OceansPanel'),
  overlays: [EEZ_LINES],
  indicators,
};
