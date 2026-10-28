import { getLang, tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, PointerInfo, ScaleSpec, TopicDefinition } from './types';

/**
 * 地球的另一邊（對蹠點）（pipeline/topics/antipodes.py，DESIGN.md 第 8 節第 89 點）：每個國家的陸地翻到地球的另一邊
 * （緯度變號、經度加減 180°），跟陸地重疊的部分是「陸地對陸地」。滑到地圖上任何一點（含海上）看它的對蹠點在哪一國或哪一片海。
 */

/** flipped.json 的線的分類（pipeline 的 SEA_PART…OUTLINE） */
export const FLIP = { sea: 1, land: 2, coast: 3, border: 4, outline: 5 } as const;

/**
 * 顏色（DESIGN.md 第 5 節「地球的另一邊的顏色」）：翻過去的陸地是中性的「影子」（淺色底圖近黑、深色底圖近白，半透明），
 * 陸地對陸地是琥珀（MAP_TOKENS.categorical[2]）；側欄標出的那一國是紫（深色底圖淡紫，[6]、[1]）。
 * dataviz 驗證工具（OKLab ΔE×100、Machado 2009），以實際疊在底圖上的顏色比：淺色底圖影子 0.3 疊在海上跟海 17.5（色盲 17.2），
 * 琥珀 0.85 疊在陸地上跟陸地 16.1（色盲 14.8），影子跟琥珀 25.9（色盲 23.7）；深色底圖影子 0.35 跟海 21.3、琥珀 0.8 跟陸地 32.1、
 * 兩者 19.2（色盲都 ≥ 15.7）。洋紅在深藍底圖的陸地上紅色盲只差 3.6，所以不用。
 */
const CAT = MAP_TOKENS.categorical;
export const LAND_COLOR = CAT[2];
const GHOST = MAP_TOKENS.ink;
export const PICK_COLOR = { color: CAT[6], dark: CAT[1] };
/** 側欄長條裡的「海」：淺色底圖上影子疊在海上的顏色（#9ebdff 上 0.3 的近黑） */
export const SEA_COLOR = '#7288b6';

const CLASSES = {
  land: { value: FLIP.land, color: LAND_COLOR, label: { zh: '陸地對陸地（兩邊都是陸地）', en: 'Land opposite land' }, area: 'land' as const },
  sea: { value: FLIP.sea, color: GHOST, label: { zh: '對面是海', en: 'Land opposite the sea' }, area: 'sea' as const },
  coast: { value: FLIP.coast, color: GHOST, label: { zh: '翻過來的海岸線', en: 'Coastlines from the other side' } },
  border: { value: FLIP.border, color: GHOST, label: { zh: '翻過來的國界', en: 'Borders from the other side' }, dash: true },
  outline: { value: FLIP.outline, ...PICK_COLOR, label: { zh: '選取國家的對蹠範圍', en: 'Selected country’s antipodes' } },
};

const FILL = {
  field: 'p',
  value: 1,
  opacity: 0.3,
  darkOpacity: 0.35,
  holeField: 'h',
  // 面是陸地切出來的，外框是另外畫的海岸線；只有側欄標出那一國的形狀要外框
  outline: [FLIP.outline],
  typeOpacity: { [FLIP.sea]: [0.3, 0.35], [FLIP.land]: [0.85, 0.8], [FLIP.outline]: [0.22, 0.25] } as Record<number, [number, number]>,
};

/** 對蹠地圖：翻過去的陸地（面、海岸線、國界）；側欄標出一國時畫它的形狀（第 5 類，平常不畫） */
export const FLIPPED: LinesOverlayDef = {
  kind: 'lines',
  id: 'flipped',
  file: 'flipped.json',
  label: { zh: '地球另一邊的陸地', en: 'Land on the other side' },
  // 線寬依分類：海岸線 0.9 px、國界 0.45 px（虛線）、選取國家的外框 1.2 px（標出時再加粗）
  width: {
    field: 'type',
    stops: [
      [FLIP.coast, 0.9],
      [FLIP.border, 0.45],
      [FLIP.outline, 1.2],
    ],
  },
  color: { title: { zh: '翻到對蹠點的陸地', en: 'Land moved to its antipode' }, classes: [CLASSES.land, CLASSES.sea, CLASSES.coast, CLASSES.border, CLASSES.outline] },
  onlyTypes: [FLIP.sea, FLIP.land, FLIP.coast, FLIP.border],
  fill: FILL,
  groupField: 'g',
  hoverHalo: true,
};

/** 其他指標（面量圖）只疊翻過來的海岸線，不蓋住國家的顏色；側欄標出一國照樣畫 */
export const FLIPPED_COAST: LinesOverlayDef = {
  ...FLIPPED,
  id: 'flipped-coast',
  label: { zh: '地球另一邊的海岸線', en: 'Coastlines from the other side' },
  color: { title: { zh: '翻到對蹠點的陸地', en: 'Land moved to its antipode' }, classes: [CLASSES.coast, CLASSES.outline] },
  onlyTypes: [FLIP.coast],
};

/** 側欄要標出哪一個疊加圖層：對蹠地圖用完整的，其他指標用只有海岸線的 */
export const flippedOverlayFor = (indicator: string) => (indicator === MAP_ID ? FLIPPED.id : FLIPPED_COAST.id);
const MAP_ID = 'map';

// ── 對蹠點與座標 ─────────────────────────────────────────────

/** 對蹠點：緯度變號、經度加減 180°（結果在 −180–180） */
export function antipode(lon: number, lat: number): [number, number] {
  return [lon > 0 ? lon - 180 : lon + 180, -lat];
}

/** 「北緯 25.04°、東經 121.56°」「25.04°N, 121.56°E」 */
export function formatLatLon(lon: number, lat: number): string {
  const y = fixed(Math.abs(lat), 2);
  const x = fixed(Math.abs(lon), 2);
  return tr({
    zh: `${lat >= 0 ? '北緯' : '南緯'} ${y}°、${lon >= 0 ? '東經' : '西經'} ${x}°`,
    en: `${y}°${lat >= 0 ? 'N' : 'S'}, ${x}°${lon >= 0 ? 'E' : 'W'}`,
  });
}

export const km = (v: number) => tr({ zh: `${formatLargeNumber(Math.round(v))} 公里`, en: `${formatLargeNumber(Math.round(v))} km` });
/** 比例：不到 0.1% 寫「<0.1%」，99–100% 之間留一位小數（不寫成看起來是全部的 100%） */
export const pct = (v: number) =>
  v > 0 && v < 0.1 ? '<0.1%' : `${fixed(v, (v > 0 && v < 1) || (v > 99 && v < 100) ? 1 : 0)}%`;

// ── 海名的網格（pipeline 的 seas.json）與側欄的資料（panel.json），第一次用到時才下載 ──────────

/** seas.json：0.25° 網格每一格的海（索引），逐列的 [值, 長度, …]；seas 是 [中文, 英文, 大洋的代碼] */
export interface SeasFile {
  res: number;
  seas: [string, string, number][];
  rows: number[][];
}

/** panel.json */
export interface AntipodesPanelData {
  countries: Record<string, CountryAntipodes>;
}

export interface CountryAntipodes {
  /** flipped.json 裡這一國的組別（側欄標出它的形狀） */
  g?: number;
  /** 對蹠的範圍 [西, 南, 東, 北]，經度連續（東可以超過 180°） */
  box?: [number, number, number, number];
  /** 對蹠點落在哪裡：[國家代碼或海的索引, 占國土的 %]，由大到小 */
  targets?: [string | number, number][];
  /** 其餘的加起來（%） */
  other?: number;
  /** 取樣算到的國土面積（km²） */
  km2?: number;
  capital?: CapitalAntipode;
}

export interface CapitalAntipode {
  zh: string;
  en: string;
  /** 1 首都、2 沒有首都的地區的主要城鎮 */
  kind: number;
  lat: number;
  lon: number;
  alat: number;
  alon: number;
  /** 對蹠點在哪一國（代碼）或哪一片海（索引） */
  at: string | number;
  /** 離最近的陸地（km）；在陸地上是 0 */
  km: number;
  /** 在陸地上時離另一國的國界多遠（km，粗估） */
  border?: number | null;
  /** 在海上時最近的陸地是哪一國 */
  near?: string;
  /** 離對蹠點最近的城鎮（Natural Earth populated places） */
  place: { zh: string; en: string; iso3: string | null; km: number };
}

const loaded = new Map<string, unknown>();
const loading = new Set<string>();
/** 主題的資料檔：第一次呼叫時開始下載，下載完之前回傳 null（tooltip 下一次滑動就有） */
function lazyJson<T>(path: string): T | null {
  if (loaded.has(path)) return loaded.get(path) as T;
  if (!loading.has(path)) {
    loading.add(path);
    fetchJson<T>(path)
      .then((d) => loaded.set(path, d))
      .catch(() => loading.delete(path));
  }
  return null;
}

interface SeaGrid {
  res: number;
  w: number;
  cells: Uint8Array;
  seas: SeasFile['seas'];
}
const seaGrids = new WeakMap<SeasFile, SeaGrid>();

/** 還原成每一格一個位元組（約 100 萬格） */
function seaGrid(file: SeasFile): SeaGrid {
  let grid = seaGrids.get(file);
  if (!grid) {
    const w = Math.round(360 / file.res);
    const cells = new Uint8Array(w * file.rows.length);
    file.rows.forEach((row, r) => {
      let k = r * w;
      for (let i = 0; i < row.length; i += 2) {
        cells.fill(row[i], k, k + row[i + 1]);
        k += row[i + 1];
      }
    });
    grid = { res: file.res, w, cells, seas: file.seas };
    seaGrids.set(file, grid);
  }
  return grid;
}

/** 海的名稱（目前的語言） */
export function seaName(file: SeasFile, index: number): string {
  const sea = file.seas[index];
  return sea ? (getLang() === 'en' ? sea[1] : sea[0]) : '';
}

/** 一個經緯度在哪一片海（陸地的格子是最近的海，南極洲的陸地是「南極洲」） */
export function seaAt(file: SeasFile, lon: number, lat: number): number {
  const g = seaGrid(file);
  const col = Math.min(g.w - 1, Math.max(0, Math.floor((lon + 180) / g.res)));
  const row = Math.min(g.cells.length / g.w - 1, Math.max(0, Math.floor((90 - lat) / g.res)));
  return g.cells[row * g.w + col];
}

const SEAS_PATH = 'topics/antipodes/seas.json';
const PANEL_PATH = 'topics/antipodes/panel.json';

/** 滑到地圖上任何一點：游標的對蹠點在哪一國（地圖的國界）或哪一片海，與它的經緯度；海上另外寫這裡是哪一片海 */
function pointer(
  [lon, lat]: [number, number],
  { iso3, countryAt, countryName }: { iso3: string | null; countryAt: (lon: number, lat: number) => string | null; countryName: (iso3: string) => string },
): PointerInfo {
  const seas = lazyJson<SeasFile>(SEAS_PATH);
  const [alon, alat] = antipode(lon, lat);
  const there = countryAt(alon, alat);
  const name = there ? countryName(there) : seas ? seaName(seas, seaAt(seas, alon, alat)) : '…';
  const lines = [tr({ zh: `地球另一邊：${name}`, en: `Other side: ${name}` }), formatLatLon(alon, alat)];
  if (iso3) return { lines, mark: [alon, alat] };
  return {
    title: seas ? seaName(seas, seaAt(seas, lon, lat)) : tr({ zh: '海上', en: 'At sea' }),
    lines: [formatLatLon(lon, lat), ...lines],
    mark: [alon, alat],
  };
}

/** 對蹠點落在哪裡的名稱：國家（目前語言的國名）或海 */
export function targetName(target: string | number, seas: SeasFile | null, countryName: (iso3: string) => string): string {
  return typeof target === 'string' ? countryName(target) : seas ? seaName(seas, target) : '…';
}

/** 首都的對蹠點一句話：「台北的對蹠點在阿根廷」「華盛頓的對蹠點在印度洋，離最近的陸地（澳洲）1,192 公里」 */
export function capitalLine(cap: CapitalAntipode, seas: SeasFile | null, countryName: (iso3: string) => string): string {
  const en = getLang() === 'en';
  const city = en ? cap.en : cap.zh;
  const where = targetName(cap.at, seas, countryName);
  if (cap.km === 0) return tr({ zh: `${city}的對蹠點在${where}的陸地上`, en: `${city}’s antipode is on land in ${where}` });
  const near = cap.near ? countryName(cap.near) : '';
  return tr({
    zh: `${city}的對蹠點在${where}，離最近的陸地（${near}）${km(cap.km)}`,
    en: `${city}’s antipode is in the ${where}, ${km(cap.km)} from the nearest land (${near})`,
  });
}

/** tooltip 另外的幾行：對蹠點落在哪些國家與海（前三名），首都的對蹠點 */
function tooltipLines(iso3: string, { indicator, countryName }: { indicator: string; countryName: (iso3: string) => string }): string[] {
  const panel = lazyJson<AntipodesPanelData>(PANEL_PATH);
  const seas = lazyJson<SeasFile>(SEAS_PATH);
  const c = panel?.countries[iso3];
  if (!c) return [];
  const out: string[] = [];
  if (c.targets?.length && indicator !== 'capital') {
    const top = c.targets.slice(0, 3).map(([t, share]) => `${targetName(t, seas, countryName)} ${pct(share)}`);
    out.push(tr({ zh: `對蹠點落在：${top.join('、')}`, en: `Antipodes fall in: ${top.join(', ')}` }));
  }
  if (c.capital) out.push(capitalLine(c.capital, seas, countryName));
  return out;
}

// ── 指標 ───────────────────────────────────────────────────────

const LAND_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.01, 5, 25, 50, 75, 99.95] };
const CAPITAL_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.5, 100, 300, 600, 1000, 1500] };

const HOW = {
  zh: '每 3 公里一點的等面積取樣網格，判斷每一點與它的對蹠點各在哪一國（Natural Earth 1:10m 的國界）或哪一片海（IHO 的海域）。',
  en: 'An equal-area sample grid with a point every 3 km; each point and its antipode are placed in a country (Natural Earth 1:10m borders) or a sea (IHO sea areas).',
};

/** 對蹠地圖的 tooltip 寫一句話；面量圖、排名表、側欄的卡片只寫比例 */
const landSentence = (v: number) =>
  v === 0 ? tr({ zh: '對蹠點全在海上', en: 'All of its antipodes are at sea' }) : tr({ zh: `${pct(v)} 的對蹠點是陸地`, en: `${pct(v)} of its land is opposite land` });

const indicators: IndicatorDef[] = [
  {
    id: MAP_ID,
    label: { zh: '對蹠地圖', en: 'Antipode map' },
    description: {
      zh: '每個國家的陸地翻到地球的另一邊（緯度變號、經度加減 180°）：半透明的影子是對面是海的部分，琥珀色是兩邊都是陸地的地方（西班牙 ↔ 紐西蘭、阿根廷 ↔ 中國、台灣 ↔ 巴拉圭）。滑到地圖上任何一點（海上也可以）看它的對蹠點在哪裡；點國家看它的對蹠點落在哪些國家與海。',
      en: 'Every country’s land moved to the other side of the Earth (latitude reversed, longitude shifted 180°): the translucent shadow is where it lands on sea, amber where land is opposite land (Spain ↔ New Zealand, Argentina ↔ China, Taiwan ↔ Paraguay). Hover anywhere, even at sea, to see where its antipode is; click a country to see which countries and seas its antipodes fall in.',
    },
    unit: '%',
    file: 'land.json',
    layer: { kind: 'none' },
    format: landSentence,
    formatTick: (v) => `${fixed(v, 0)}%`,
  },
  {
    id: 'land',
    label: { zh: '陸地對陸地的比例', en: 'Land opposite land' },
    description: {
      zh: `國土有多少比例的對蹠點也是陸地（其他國家的國土，或南極洲）。全世界的陸地（含南極洲）只有 13% 對面也是陸地，三分之二的國家完全對著海。${HOW.zh}`,
      en: `Share of the country’s land whose antipodes are also land (another country, or Antarctica). Only 13% of the world’s land (Antarctica included) is opposite land; two-thirds of countries face only sea. ${HOW.en}`,
    },
    unit: '%',
    file: 'land.json',
    layer: { kind: 'choropleth', scale: LAND_SCALE },
    format: pct,
    // 第一個門檻是「不是 0」、最後一個是「全部」
    formatTick: (v) => (v < 0.1 ? '0%' : v > 99.9 ? '100%' : `${fixed(v, 0)}%`),
  },
  {
    id: 'capital',
    label: { zh: '首都的對蹠點離陸地', en: 'Capital antipode to land' },
    description: {
      zh: '首都（沒有首都的地區用主要的城鎮）的對蹠點離最近的陸地多遠；0 是對蹠點本身就在陸地上（台北、北京、馬德里、聖地牙哥、雅加達…）。距離量到 Natural Earth 1:10m 的海岸線上最近的點，含小島。',
      en: 'How far the antipode of the capital (or the main town where there is none) is from the nearest land; 0 means the antipode itself is on land (Taipei, Beijing, Madrid, Santiago, Jakarta…). Measured to the nearest point on Natural Earth 1:10m coastlines, small islands included.',
    },
    unit: 'km',
    file: 'capital.json',
    layer: { kind: 'choropleth', scale: CAPITAL_SCALE },
    format: (v) => (v === 0 ? tr({ zh: '對蹠點在陸地上', en: 'Antipode on land' }) : tr({ zh: `離陸地 ${km(v)}`, en: `${km(v)} from land` })),
    // 第一個門檻 0.5 是「在陸地上」與「在海上」的分界
    formatTick: (v) => (v < 1 ? '0' : fixed(v, 0)),
    // 遠近沒有好壞：依數值排列，不寫名次
    unranked: true,
    // 沒有首都的地區（無人島、錫亞琴冰川這類爭議地區）：寫原因，不寫「無資料」
    missing: {
      zh: '沒有首都或主要城鎮的資料（無人島、爭議地區）',
      en: 'No capital or main town on record (uninhabited or disputed)',
    },
  },
];

export const antipodes: TopicDefinition = {
  id: 'antipodes',
  title: { zh: '地球的另一邊（對蹠點）', en: 'The other side of the Earth (antipodes)' },
  shortTitle: { zh: '地球的另一邊', en: 'Antipodes' },
  defaultIndicator: MAP_ID,
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Natural Earth 國界（1:50m、1:10m）與城鎮（populated places）', en: 'Natural Earth borders (1:50m, 1:10m) and populated places' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Marine Regions：IHO Sea Areas v3、Global Oceans and Seas v1（海的名稱與所屬大洋）', en: 'Marine Regions: IHO Sea Areas v3 and Global Oceans and Seas v1 (sea names and oceans)' },
      url: 'https://doi.org/10.14284/323',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Wikidata（首都）', en: 'Wikidata (capitals)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: '對蹠點是穿過地心到地球另一邊的點：緯度變號、經度加減 180°（台北 北緯 25.04°、東經 121.56° 的對蹠點是南緯 25.04°、西經 58.44°，在阿根廷福爾摩沙省、巴拉圭首都亞松森西南約 85 公里）。地圖上翻過去的形狀用地圖本身的 Natural Earth 1:50m 國界（簡化到約 1.3 公里）；各國的比例用 1:10m 的國界，每 3 公里一點的等面積網格取樣，面積小的國家另外細取樣；海的名稱是 IHO 的海域（S-23 第 3 版，台灣海峽依河流主題的規則另外標出），南冰洋是 IHO 劃的範圍。首都是國家小檔案的 Wikidata 首都。',
    en: 'The antipode is the point on the opposite side of the Earth through its centre: latitude reversed and longitude shifted by 180° (Taipei at 25.04°N, 121.56°E has its antipode at 25.04°S, 58.44°W, in Formosa province, Argentina, about 85 km south-west of Asunción, Paraguay). The flipped shapes use the map’s own Natural Earth 1:50m borders (simplified to about 1.3 km); country shares use the 1:10m borders sampled on an equal-area grid with a point every 3 km, with finer sampling for small countries. Sea names are IHO sea areas (S-23, 3rd edition; the Taiwan Strait is labelled as in the rivers topic), and the Southern Ocean is the IHO area. Capitals are the Wikidata capitals from the country profiles.',
  },
  panelExtra: () => import('./panels/AntipodesPanel'),
  overlays: [
    { ...FLIPPED, indicators: [MAP_ID] },
    { ...FLIPPED_COAST, indicators: ['land', 'capital'] },
  ],
  indicators,
  pointer,
  tooltipLines,
};
