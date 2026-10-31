import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent } from '../lib/format';
import { MAP_TOKENS, TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, LinesOverlayDef, PointRecord, PointsOverlayDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 河流與流域（pipeline/topics/rivers.py，DESIGN.md 第 8 節第 86 點）：HydroRIVERS v1.0 的河道依最後流進哪一個大洋上色，
 * 線寬依平均流量；各國的國土流向各大洋的比例。滑到河上標出整個河流系統（同一個出口的幹流與所有支流）。
 * 水壩與水庫（pipeline/topics/dams.py，第 96 點）：Global Dam Watch 的水壩依庫容畫點、依完工的年代上色，台灣用水利署的公告水庫。
 */

/** 類別代碼（pipeline 的 PACIFIC…ENDORHEIC） */
export const OCEAN = { pacific: 1, atlantic: 2, indian: 3, arctic: 4, endorheic: 5 } as const;

export const OCEAN_NAMES: Record<number, Text> = {
  [OCEAN.pacific]: { zh: '太平洋', en: 'Pacific Ocean' },
  [OCEAN.atlantic]: { zh: '大西洋', en: 'Atlantic Ocean' },
  [OCEAN.indian]: { zh: '印度洋', en: 'Indian Ocean' },
  [OCEAN.arctic]: { zh: '北冰洋', en: 'Arctic Ocean' },
  [OCEAN.endorheic]: { zh: '內流區', en: 'Inland basins' },
};

/**
 * 顏色（DESIGN.md 第 5 節「河流的顏色」）：MAP_TOKENS.categorical 的固定位置，同一個大洋在淺色底圖用深的那一階、
 * 深色底圖用同色相淺的那一階（細線在彩色地形上要深才看得到，在深藍底圖上要亮）：
 * 太平洋洋紅（兩種底圖都是）、大西洋紫 → 淡紫、印度洋鏽紅 → 琥珀、北冰洋綠 → 薄荷綠。
 * 內流區用中性色的虛線（淺色底圖近黑、深色底圖近白），一看就跟流進海的不同，虛線也比較安靜。
 * dataviz 驗證工具（任兩色、OKLab ΔE×100、Machado 2009）：淺色那組加近黑一般視覺 ≥ 20.3、紅綠色盲 ≥ 10.4，
 * 跟彩色地形的低地綠、乾燥地帶淺褐、山地褐、冰雪、海 ≥ 22.7；深色那組加近白 ≥ 20.8、≥ 10.7，跟深藍底圖的陸地與水 ≥ 25。
 * 國家的「主要流向」類別圖用淺色那組（內流區是類別圖的「其他」色），跟河流一致。
 */
const CAT = MAP_TOKENS.categorical;
export const OCEAN_COLORS: Record<number, { color: string; dark?: string }> = {
  [OCEAN.pacific]: { color: CAT[7] },
  [OCEAN.atlantic]: { color: CAT[6], dark: CAT[1] },
  [OCEAN.indian]: { color: CAT[5], dark: CAT[2] },
  [OCEAN.arctic]: { color: CAT[3], dark: CAT[0] },
  [OCEAN.endorheic]: { color: MAP_TOKENS.ink },
};
/** 國家的類別圖與側欄的色塊：內流區用類別圖的「其他」色（淺的中性色，跟無資料的灰分得開） */
export const OCEAN_FILLS: Record<number, string> = {
  [OCEAN.pacific]: CAT[7],
  [OCEAN.atlantic]: CAT[6],
  [OCEAN.indian]: CAT[5],
  [OCEAN.arctic]: CAT[3],
  [OCEAN.endorheic]: MAP_TOKENS.categoricalOther,
};

const ORDER = [OCEAN.pacific, OCEAN.atlantic, OCEAN.indian, OCEAN.arctic, OCEAN.endorheic];

export const oceanName = (code: number | null) => (code !== null && OCEAN_NAMES[code] ? tr(OCEAN_NAMES[code]) : '');

const n0 = (v: number) => fixed(v, 0);
export const km = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公里`, en: `${formatLargeNumber(v)} km` });
/** 面積：100 萬 km² 以下寫完整的數字（「34,897 km²」，不寫成「3 萬」），以上用萬、M */
export const km2 = (v: number) => `${v < 1e6 ? fixed(v, 0) : formatLargeNumber(v)} km²`;
/** 平均流量：10 以下留一位小數；乾燥地區的河 WaterGAP 推算幾乎是 0 */
export const discharge = (v: number) => (v < 0.05 ? '≈ 0 m³/s' : `${fixed(v, v < 10 ? 1 : 0)} m³/s`);
const share = (v: number) => formatPercent(v, v > 0 && v < 1 ? 1 : 0);

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** 「流入太平洋（南海）」「內流區（沒有流進海洋）」 */
function drainsTo(p: PointRecord): string {
  const o = num(p.o);
  const sea = getLang() === 'en' ? str(p.oe) : str(p.oz);
  if (o === OCEAN.endorheic) return tr({ zh: '內流區：沒有流進海洋', en: 'Inland basin: does not reach the sea' });
  const name = oceanName(o);
  return sea ? tr({ zh: `流入${name}・${sea}`, en: `Drains to the ${name} · ${sea}` }) : tr({ zh: `流入${name}`, en: `Drains to the ${name}` });
}

/**
 * 河的 tooltip：名稱（主流的名稱，沒有就是水系的名稱）、水系與流進的海、這一段的平均流量與集水面積、整個水系的長度。
 * 沒有名稱的水系不寫名稱，標題直接寫流進哪裡
 */
function riverTooltip(p: PointRecord) {
  const en = getLang() === 'en';
  const name = en ? (str(p.m) ?? str(p.n)) : (str(p.n) ?? str(p.m));
  const system = en ? (str(p.se) ?? str(p.sz)) : (str(p.sz) ?? str(p.se));
  const title = name ?? system;
  const lines: string[] = [];
  const d = num(p.d);
  const u = num(p.u);
  if (d !== null || u !== null) {
    lines.push(
      tr({
        zh: `這一段：平均流量 ${d !== null ? discharge(d) : '—'}、集水面積 ${u !== null ? km2(u) : '—'}`,
        en: `Here: mean flow ${d !== null ? discharge(d) : '—'}, upstream area ${u !== null ? km2(u) : '—'}`,
      }),
    );
  }
  const L = num(p.L);
  if (L !== null) lines.push(tr({ zh: `整個水系最長 ${km(L)}（最遠的源頭到河口）`, en: `System length ${km(L)} (farthest source to mouth)` }));
  const where = drainsTo(p);
  return {
    title: title ?? where,
    detail: title
      ? system && system !== title
        ? tr({ zh: `${system}水系・${where}`, en: `${system} system · ${where}` })
        : where
      : undefined,
    extra: lines,
  };
}

/** 線寬的流量分級（縮放 2 時的 px）：依流量的對數變粗 */
const WIDTH_STOPS: [number, number][] = [
  [1, 0.35],
  [10, 0.5],
  [100, 0.8],
  [1000, 1.25],
  [10000, 2],
  [100000, 3.3],
];

/**
 * 沒有 HydroRIVERS 河道的地方（小島、城邦，與 HydroSHEDS 沒有涵蓋的南極洲）：tooltip、側欄寫原因，不寫「無資料」。
 * pipeline 跑完後地圖上有形狀、指標檔沒有值的（加上地圖只畫圓點的直布羅陀、吐瓦魯、托克勞）
 */
const NO_RIVERS: Text = {
  zh: 'HydroRIVERS 在這裡沒有河道（只收集水面積 10 km² 或平均流量每秒 0.1 立方公尺以上的河，小島、城邦常沒有）',
  en: 'No HydroRIVERS reaches here (it covers rivers with a 10 km² catchment or 0.1 m³/s mean flow and above; small islands and city-states often have none)',
};
const NO_VALUE: Record<string, Text> = {
  ...Object.fromEntries(
    ['ASM', 'ATF', 'BLM', 'BMU', 'COK', 'CPV', 'GIB', 'HMD', 'IOT', 'MCO', 'MDV', 'MHL', 'MUS', 'NFK', 'NIU', 'PCN', 'PYF', 'SGS', 'SHN', 'SMR', 'TKL', 'TON', 'TUV', 'VAT', 'VGB', 'WLF', 'WSM'].map(
      (iso3) => [iso3, NO_RIVERS],
    ),
  ),
  ATA: { zh: 'HydroSHEDS 沒有涵蓋南極洲', en: 'HydroSHEDS does not cover Antarctica' },
};

export const RIVERS: LinesOverlayDef = {
  kind: 'lines',
  id: 'rivers',
  file: 'rivers.json',
  label: { zh: '河流（HydroRIVERS）', en: 'Rivers (HydroRIVERS)' },
  width: { field: 'd', stops: WIDTH_STOPS },
  // 放大到一個國家的大小（6–8 級）時比預設粗，才不會跟底圖的道路混在一起
  widthZoom: [
    [0, 0.75],
    [2, 1],
    [5, 1.8],
    [8, 3],
    [11, 4],
  ],
  color: {
    title: { zh: '最後流進', en: 'Drains to' },
    classes: ORDER.map((value) => ({
      value,
      ...OCEAN_COLORS[value],
      label: OCEAN_NAMES[value],
      dash: value === OCEAN.endorheic,
    })),
  },
  sizeLegend: {
    title: { zh: '線寬：平均流量', en: 'Width: mean flow' },
    values: [100, 1000, 10000, 100000],
    format: (v) => discharge(v),
  },
  groupField: 'g',
  // 縮小時只畫大河，放大後小河才出現：z 是 pipeline 算的級別（流量 m³/s 或集水面積 ÷ 1,000 取大的，
  // 過了 8、12、20、30、60、120 幾個門檻）；0 級 60 以上，1 級起 30 以上（主檔全部），6 級 8 以上（分區全部）
  minValue: {
    field: 'z',
    stops: [
      [0, 5],
      [1, 4],
      [4, 3],
      [5, 2],
      [6, 1],
    ],
  },
  // 放大到 10 級以後底圖本身有更精細的河道，簡化過的線淡出
  fadeOut: [10, 12],
  hoverHalo: true,
  detail: { minZoom: 4 },
  tooltip: riverTooltip,
};

// ── 水壩與水庫 ──────────────────────────────────────────────

/** 用途的位元（pipeline/sources/gdw.py 的 USES），依常見的程度排 */
const USES: [number, Text][] = [
  [2, { zh: '發電', en: 'hydropower' }],
  [1, { zh: '灌溉', en: 'irrigation' }],
  [4, { zh: '給水', en: 'water supply' }],
  [8, { zh: '防洪', en: 'flood control' }],
  [16, { zh: '觀光遊憩', en: 'recreation' }],
  [32, { zh: '航運', en: 'navigation' }],
  [64, { zh: '漁業', en: 'fisheries' }],
  [128, { zh: '污染防治', en: 'pollution control' }],
  [256, { zh: '牲畜用水', en: 'livestock' }],
  [512, { zh: '其他', en: 'other' }],
];

/** 庫容：資料是百萬立方公尺，畫面寫「3.78 億立方公尺」「378M m³」 */
export const storage = (v: number) => tr({ zh: `${formatLargeNumber(v * 1e6)} 立方公尺`, en: `${formatLargeNumber(v * 1e6)} m³` });
const storageTick = (v: number) => tr({ zh: `${formatLargeTick(v * 1e6)} 立方公尺`, en: `${formatLargeTick(v * 1e6)} m³` });

/** 「用途：給水（主要）、發電、防洪」：主要用途排第一 */
function usesText(p: PointRecord): string | null {
  const u = num(p.u) ?? 0;
  const main = num(p.m) ?? 0;
  if (!u) return null;
  const names = USES.filter(([bit]) => u & bit)
    .sort(([a], [b]) => Number(b === main) - Number(a === main))
    .map(([bit, label]) => (bit === main ? tr({ zh: `${tr(label)}（主要）`, en: `${tr(label)} (main)` }) : tr(label)));
  return tr({ zh: `用途：${names.join('、')}`, en: `Use: ${names.join(', ')}` });
}

/**
 * 水壩的 tooltip。GDW 的 n 是壩名（沒有就是水庫名）、r 是河名，都是英文；
 * 台灣的公告水庫 n 是「中文名｜河川」、r 是英文名（pipeline/topics/dams.py）。數值是 0 的是不明
 */
function damTooltip(p: PointRecord) {
  const en = getLang() === 'en';
  const n = str(p.n);
  const [zhName, twRiver] = n?.includes('｜') ? n.split('｜') : [null, null]; // i18n-ignore（pipeline 的分隔字元）
  const title = zhName ? (en ? (str(p.r) ?? zhName) : zhName) : (n ?? tr({ zh: '水壩（沒有名稱）', en: 'Dam (unnamed)' }));
  const yr = num(p.yr);
  const h = num(p.h);
  const c = num(p.c);
  const detail = [
    yr ? tr({ zh: `${yr} 年完工`, en: `Completed ${yr}` }) : tr({ zh: '完工年份不明', en: 'Year unknown' }),
    h ? tr({ zh: `壩高 ${n0(h)} 公尺`, en: `${n0(h)} m high` }) : null,
  ];
  const extra = [c ? tr({ zh: `庫容 ${storage(c)}`, en: `Storage ${storage(c)}` }) : tr({ zh: '庫容不明', en: 'Storage unknown' })];
  const uses = usesText(p);
  if (uses) extra.push(uses);
  if (twRiver && !en) extra.push(`河川：${twRiver}`); // i18n-ignore（只在中文介面：台灣的河川名稱只有中文）
  const river = zhName ? null : str(p.r);
  return {
    title,
    detail: detail.filter(Boolean).join('・'),
    extra,
    properNoun: river ? tr({ zh: `河：${river}`, en: `River: ${river}` }) : undefined,
  };
}

/** 完工的年代：舊的淺、新的深（藍色的循序色，跟面量圖的橘色分得開）；年份不明是中性的灰 */
const BLUES = TOKENS.light.sequential;
const ERA_CLASSES = {
  field: 'yr',
  title: { zh: '完工的年代', en: 'Completed' },
  // 年份不明的 yr 是 0，落在第一級
  thresholds: [1, 1900, 1950, 1970, 1990, 2010],
  classes: [
    { color: MAP_TOKENS.inkMuted, label: { zh: '年份不明', en: 'Year unknown' } },
    { color: BLUES[1], label: { zh: '1900 年以前', en: 'Before 1900' } },
    { color: BLUES[2], label: { zh: '1900–1949 年', en: '1900–1949' } },
    { color: BLUES[3], label: { zh: '1950–1969 年', en: '1950–1969' } },
    { color: BLUES[4], label: { zh: '1970–1989 年', en: '1970–1989' } },
    { color: BLUES[5], label: { zh: '1990–2009 年', en: '1990–2009' } },
    { color: BLUES[6], label: { zh: '2010 年以後', en: '2010 and later' } },
  ],
};

/**
 * 半徑（px，縮放 2 時）：面積大約跟庫容成正比（半徑 ≈ 0.04 × √百萬立方公尺），最小 1 px；
 * 歐文瀑布（維多利亞湖，2,048 億立方公尺）約 18 px，翡翠水庫（3.8 億）約 1.2 px
 */
const STORAGE_STOPS: [number, number][] = [
  [0, 1],
  [100, 1.2],
  [1000, 1.6],
  [10000, 4],
  [50000, 9],
  [200000, 18],
];

export const DAMS: PointsOverlayDef = {
  kind: 'points',
  id: 'dams',
  file: 'dams.json',
  label: { zh: '水壩（Global Dam Watch）', en: 'Dams (Global Dam Watch)' },
  radius: { field: 'c', stops: STORAGE_STOPS },
  color: ERA_CLASSES,
  sizeLegend: { title: { zh: '庫容', en: 'Storage' }, values: [1000, 10000, 100000], format: storageTick },
  // 縮小時只畫大水庫：世界全圖 10 億立方公尺以上（約 900 座），放大到 5 級（一個國家的大小）畫全部 4 萬座（含庫容不明的 0）
  minValue: {
    field: 'c',
    stops: [
      [0, 1000],
      [2, 100],
      [3, 10],
      [4, 1],
      [5, 0],
    ],
  },
  tooltip: damTooltip,
};

const DAM_HOW = {
  zh: '全世界用 Global Dam Watch v1.0（約 4 萬座水壩與攔河堰，不含船閘、已拆除與規劃中的），台灣用經濟部水利署的 40 座公告水庫加上 GDW 其他的壩；國家依水壩的位置判斷。',
  en: 'Worldwide from Global Dam Watch v1.0 (about 40,000 dams and weirs, excluding navigation locks and removed or planned dams); Taiwan uses the Water Resources Agency’s 40 official reservoirs plus GDW’s other dams. Countries are assigned by each dam’s location.',
};
const NO_DAMS: Text = { zh: 'Global Dam Watch 沒有收這裡的水壩', en: 'No dams recorded here in Global Dam Watch' };
/** 主題的 noValue 是沒有河流的原因，水壩的指標另外寫（指標的 noValue 優先） */
const DAM_NO_VALUE: Record<string, Text> = Object.fromEntries(Object.keys(NO_VALUE).map((iso3) => [iso3, NO_DAMS]));

const DAM_COUNT_SCALE: ScaleSpec = { type: 'sequential', thresholds: [10, 50, 100, 300, 1000, 3000] };
const DAM_STORAGE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [100, 1000, 10000, 50000, 100000, 300000] };

const OCEAN_ITEMS: { id: string; label: Text }[] = [
  { id: 'pacific', label: OCEAN_NAMES[OCEAN.pacific] },
  { id: 'atlantic', label: OCEAN_NAMES[OCEAN.atlantic] },
  { id: 'indian', label: OCEAN_NAMES[OCEAN.indian] },
  { id: 'arctic', label: OCEAN_NAMES[OCEAN.arctic] },
];

const SHARE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [1, 10, 30, 50, 70, 99] };

const HOW = {
  zh: '每一段河道自己的集水面積依它所在的國家加總（HydroRIVERS 收錄集水面積 10 km² 或平均流量每秒 0.1 立方公尺以上的河），分母是有河道經過的面積；流進海的河依河口落在哪一片海算大洋，地中海、黑海、波羅的海、墨西哥灣算大西洋，哈德遜灣算北冰洋，紅海、波斯灣算印度洋。',
  en: 'Each reach’s own catchment is added to the country it lies in (HydroRIVERS covers rivers with a 10 km² catchment or 0.1 m³/s mean flow and above), out of the area those reaches drain; rivers reaching the sea count for the ocean of the sea at their mouth, so the Mediterranean, Black Sea, Baltic and Gulf of Mexico count as the Atlantic, Hudson Bay as the Arctic, and the Red Sea and Persian Gulf as the Indian Ocean.',
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '河流地圖', en: 'River map' },
    description: {
      zh: '全世界的河流依最後流進哪一個大洋上色，線寬是平均流量，放大後小河才出現；虛線的是內流區（流進裏海、鹹海、查德湖這類內陸湖或沙漠，到不了海）。滑到河上看名稱、流量與流進的海，同一個河流系統的幹流與支流會一起標出；滑到國家上看國土流向各大洋的比例。',
      en: 'Rivers worldwide coloured by the ocean they finally reach, with width showing mean flow; smaller rivers appear as you zoom in. Dashed lines are inland basins (draining to the Caspian, the Aral Sea, Lake Chad or desert sinks, never reaching the sea). Hover over a river for its name, flow and sea, with its whole river system highlighted; hover over a country for the share of its land draining to each ocean.',
    },
    unit: { zh: '公里', en: 'km' },
    file: 'length.json',
    layer: { kind: 'none' },
    format: (v) => tr({ zh: `河道 ${km(v)}`, en: `${km(v)} of rivers` }),
    formatTick: n0,
  },
  {
    id: 'main-ocean',
    label: { zh: '主要流向', en: 'Main ocean' },
    description: {
      zh: `國土最大的一部分流向哪一個大洋（或是內流區）。${HOW.zh}`,
      en: `The ocean that drains the largest part of the country (or inland basins). ${HOW.en}`,
    },
    unit: '',
    file: 'main-ocean.json',
    layer: {
      kind: 'categorical',
      categories: ORDER.map((value): CategoryDef => ({ value, label: OCEAN_NAMES[value], color: OCEAN_FILLS[value] })),
    },
    format: (v) => oceanName(v),
  },
  {
    id: 'share',
    // 圖例標題是子項目接指標名稱：「太平洋流域比例」「Pacific Ocean basin share」
    label: { zh: '流域比例', en: 'Basin share' },
    description: {
      zh: `國土有多少比例的河流流進這個大洋。${HOW.zh}`,
      en: `Share of the country’s land whose rivers flow into this ocean. ${HOW.en}`,
    },
    unit: '%',
    file: 'share/{item}.json',
    dimension: { label: { zh: '大洋', en: 'Ocean' }, options: OCEAN_ITEMS, defaultOption: 'pacific' },
    layer: { kind: 'choropleth', scale: SHARE_SCALE },
    format: share,
    formatTick: (v) => `${n0(v)}%`,
    unranked: true,
  },
  {
    id: 'endorheic',
    label: { zh: '內流區比例', en: 'Inland share' },
    description: {
      zh: `國土有多少比例屬於內流區：河流流進內陸的湖泊（裏海、鹹海、查德湖）或消失在沙漠裡，到不了海。${HOW.zh}`,
      en: `Share of the country’s land in inland (endorheic) basins, whose rivers end in inland lakes such as the Caspian, the Aral Sea or Lake Chad, or vanish in deserts. ${HOW.en}`,
    },
    unit: '%',
    file: 'endorheic.json',
    layer: { kind: 'choropleth', scale: SHARE_SCALE },
    format: share,
    formatTick: (v) => `${n0(v)}%`,
    unranked: true,
  },
  {
    id: 'dam-count',
    label: { zh: '水壩數', en: 'Dams' },
    description: {
      zh: `國內有幾座水壩與攔河堰。點的大小是庫容、顏色是完工的年代（六成的壩不知道年份，畫成灰色）。${DAM_HOW.zh}`,
      en: `Number of dams and weirs in the country. Dots are sized by storage and coloured by the decade completed (six in ten dams have no known year and are grey). ${DAM_HOW.en}`,
    },
    unit: { zh: '座', en: 'dams' },
    file: 'dam-count.json',
    layer: { kind: 'choropleth', scale: DAM_COUNT_SCALE },
    format: (v) => tr({ zh: `${n0(v)} 座`, en: `${n0(v)} dams` }),
    formatTick: n0,
    integer: true,
    noValue: DAM_NO_VALUE,
    missing: NO_DAMS,
  },
  {
    id: 'dam-capacity',
    label: { zh: '水庫總庫容', en: 'Reservoir storage' },
    description: {
      zh: `國內所有水庫的總庫容（設計或最近一次測量的總容量），不知道庫容的壩沒有算進來。${DAM_HOW.zh}`,
      en: `Total storage capacity of the country’s reservoirs (design or latest surveyed gross capacity); dams with unknown capacity are left out. ${DAM_HOW.en}`,
    },
    unit: { zh: '百萬立方公尺', en: 'million m³' },
    file: 'dam-capacity.json',
    layer: { kind: 'choropleth', scale: DAM_STORAGE_SCALE },
    format: storage,
    formatTick: (v) => formatLargeTick(v * 1e6),
    noValue: DAM_NO_VALUE,
    missing: NO_DAMS,
  },
];

export const rivers: TopicDefinition = {
  id: 'rivers',
  title: { zh: '河流與流域', en: 'Rivers and drainage basins' },
  shortTitle: { zh: '河流與流域', en: 'Rivers' },
  defaultIndicator: 'map',
  defaultYear: 2019,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'HydroRIVERS v1.0（Lehner & Grill 2013，WWF HydroSHEDS）',
        en: 'HydroRIVERS v1.0 (Lehner & Grill 2013, WWF HydroSHEDS)',
      },
      url: 'https://www.hydrosheds.org/products/hydrorivers',
      license: { zh: 'HydroSHEDS 授權協議', en: 'HydroSHEDS License Agreement' },
    },
    {
      name: {
        zh: 'Marine Regions：IHO Sea Areas v3、Global Oceans and Seas v1（流進哪片海、哪個大洋）',
        en: 'Marine Regions: IHO Sea Areas v3 and Global Oceans and Seas v1 (seas and oceans)',
      },
      url: 'https://doi.org/10.14284/323',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Natural Earth 河流中心線、Wikidata（河名）', en: 'Natural Earth river centerlines and Wikidata (river names)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域、CC0', en: 'public domain, CC0' },
    },
    {
      name: { zh: 'Global Dam Watch database v1.0（Lehner 等人 2024，figshare）', en: 'Global Dam Watch database v1.0 (Lehner et al. 2024, figshare)' },
      url: 'https://doi.org/10.6084/m9.figshare.25988293.v1',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '經濟部水利署：水庫基本資料、主要水庫簡介（台灣的水庫與完工年份）；Wikidata（台灣水庫的座標）',
        en: 'Water Resources Agency, Taiwan: reservoir data and reservoir profiles; Wikidata (coordinates of Taiwan’s reservoirs)',
      },
      url: 'https://data.gov.tw/dataset/32726',
      license: { zh: '政府資料開放授權條款第 1 版、CC0', en: 'Open Government Data License v1.0, CC0' },
    },
  ],
  // 授權協議要求的聲明寫在最前面（頁尾先露兩行）；細節寫在指標說明、資料夾裡的 HYDROSHEDS-NOTICE.txt 與 DESIGN.md
  note: {
    zh: '本主題的河道是 HydroSHEDS 第 1 版資料庫（© World Wildlife Fund, Inc. 2006–2022）的衍生資料，依其授權協議使用；WWF 沒有評估過這裡簡化、改作後的資料，對正確性不做任何保證，HydroSHEDS 的部分資料另屬 USGS、NASA、ESRI、CIAT、UNEP-WCMC、WWF、澳洲聯邦政府與英國王室所有（完整聲明見資料夾裡的 HYDROSHEDS-NOTICE.txt）。這些衍生檔只作為本地圖的一部分提供，不得單獨再散布。流量是 WaterGAP 模型 1971–2000 年的長期平均推算，乾燥地區與冰河、大型溼地一帶誤差較大；北緯 60° 以北的河道品質較差。線依流量或集水面積挑選、簡化到約 0.65–1.7 公里。河名來自 Natural Earth 與 Wikidata，台灣的主要河川依水利署的中央管河川對到河口；沒有名稱的河只寫流進哪裡。大洋依 IHO 的海域與 2002 年草案的分章（Marine Regions）：挪威海、格陵蘭海、哈德遜灣、巴芬灣算北冰洋，帝汶海、阿拉弗拉海算印度洋；草案另列一章的南海與印尼群島的海依位置分，麻六甲海峽、莎瓦海算印度洋，其餘算太平洋。水壩來自 Global Dam Watch 資料庫 1.0 版（Lehner 等人 2024，figshare，CC BY 4.0），不收船閘、已拆除與規劃中的壩；六成的壩不知道完工年份，畫成灰色；庫容是各來源的設計或報告容量，約 4,700 座不明。台灣用經濟部水利署 113 年的 40 座公告水庫（目前總容量），座標取自 Wikidata，完工年份取自水利署網站「主要水庫簡介」的興建時間（22 座）與 Wikidata（2 座），其餘不明。',
    en: 'River data in this topic are derived from the HydroSHEDS version 1 database (© World Wildlife Fund, Inc. 2006–2022) and used under its license; WWF has not evaluated the data as simplified and altered here and gives no warranty regarding its accuracy, and portions of HydroSHEDS are the intellectual property of USGS, NASA, ESRI, CIAT, UNEP-WCMC, WWF, the Commonwealth of Australia and the British Crown (full statement in HYDROSHEDS-NOTICE.txt in the data folder). The derived files are provided only as part of this map and may not be redistributed on their own. Flows are long-term 1971–2000 averages downscaled from the WaterGAP model, less reliable in dry regions and around glaciers and large wetlands; reaches north of 60°N are of lower quality. Rivers are selected by flow or catchment area and simplified to about 0.65–1.7 km. Names come from Natural Earth and Wikidata, and Taiwan’s main rivers are matched to their mouths from the Water Resources Agency’s list of central rivers; unnamed rivers show only where they drain. Oceans follow the IHO sea areas and the chapters of its 2002 draft (Marine Regions): the Norwegian and Greenland seas, Hudson Bay and Baffin Bay count as Arctic, the Timor and Arafura seas as Indian; the South China Sea and Indonesian seas, a separate chapter in the draft, are split by location, with the Strait of Malacca and Savu Sea counted as Indian and the rest as Pacific. Dams are from the Global Dam Watch database version 1.0 (Lehner et al. 2024, figshare, CC BY 4.0), excluding navigation locks and removed or planned dams; six in ten have no known completion year and are drawn grey, and storage is the design or reported capacity from each source (unknown for about 4,700). Taiwan uses the Water Resources Agency’s 40 official reservoirs as of 2024 (latest surveyed storage), with coordinates from Wikidata and completion years from the agency’s reservoir profiles (22) and Wikidata (2); the rest are unknown.',
  },
  panelExtra: () => import('./panels/RiversPanel'),
  noValue: NO_VALUE,
  // 河流只畫在河流地圖：其他指標的國家已經依大洋上色，同色的河疊上去只會更亂。
  // 水壩在水壩的兩個指標預設打開；河流地圖上預設關閉（4 萬個點蓋在河上太亂），第一次打開才下載，兩個圖層讀同一個檔
  overlays: [
    { ...RIVERS, indicators: ['map'] },
    { ...DAMS, indicators: ['dam-count', 'dam-capacity'] },
    { ...DAMS, id: 'dams-map', hidden: true, indicators: ['map'], shareable: false },
  ],
  indicators,
};
