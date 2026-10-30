import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 企鵝在哪裡（pipeline/topics/penguins.py）：南極條約區（南緯 60 度以南）的企鵝繁殖地與歷次普查，MAPPPD v5.0。
 * 每個繁殖地一個點，依時間軸的繁殖季取那一季以前最近一次的普查（點的大小是數量、顏色是企鵝的種類或普查有多舊）。
 * 使用者 2026-10-30 決定：MAPPPD 的授權寫法矛盾（頁尾 CC BY 4.0、使用條款不准商業使用），照「只准非商業」處理，頁尾寫明。
 */

const C = MAP_TOKENS.categorical;

export interface Species {
  id: string;
  /** 資料檔的欄位 */
  field: string;
  /** 顏色分類的代碼（0 是那一季沒有企鵝繁殖） */
  code: number;
  label: Text;
  color: string;
}

/** 順序同 pipeline 的 SPECIES；顏色避開白色冰面上看不清楚的淺色（黃、淺青綠） */
export const SPECIES: Species[] = [
  { id: 'adelie', field: 'a', code: 1, label: { zh: '阿德利企鵝', en: 'Adélie penguin' }, color: C[1] },
  { id: 'chinstrap', field: 'c', code: 2, label: { zh: '頰帶企鵝', en: 'Chinstrap penguin' }, color: C[7] },
  { id: 'gentoo', field: 'g', code: 3, label: { zh: '巴布亞企鵝', en: 'Gentoo penguin' }, color: C[3] },
  { id: 'emperor', field: 'e', code: 4, label: { zh: '皇帝企鵝', en: 'Emperor penguin' }, color: C[5] },
  { id: 'macaroni', field: 'm', code: 5, label: { zh: '馬可羅尼企鵝', en: 'Macaroni penguin' }, color: C[2] },
  { id: 'king', field: 'k', code: 6, label: { zh: '國王企鵝', en: 'King penguin' }, color: C[6] },
];

const FIRST_SEASON = 1892;
const LAST_SEASON = 2025;

/** 繁殖季跨年：2023 是 2023/24 年（南半球的夏天） */
export const seasonText = (y: number) => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;

const UNITS: Record<string, (n: number) => string> = {
  n: (n) => tr({ zh: `${fixed(n, 0)} 個巢`, en: `${fixed(n, 0)} ${n === 1 ? 'nest' : 'nests'}` }),
  a: (n) => tr({ zh: `${fixed(n, 0)} 隻成鳥`, en: `${fixed(n, 0)} ${n === 1 ? 'adult' : 'adults'}` }),
  c: (n) => tr({ zh: `${fixed(n, 0)} 隻幼鳥`, en: `${fixed(n, 0)} ${n === 1 ? 'chick' : 'chicks'}` }),
};

export interface Census {
  season: number;
  /** -1：有繁殖、沒有計數；0：那一季沒有企鵝繁殖 */
  count: number;
  /** n 巢、a 成鳥、c 幼鳥 */
  type: string;
}

const parsed = new Map<string, Census[]>();

/** 一種企鵝的普查序列（字串「繁殖季:數量:單位;…」，依繁殖季排序） */
export function censuses(p: PointRecord, field: string): Census[] {
  const raw = p[field];
  if (typeof raw !== 'string') return [];
  let list = parsed.get(raw);
  if (!list) {
    list = raw.split(';').map((s) => {
      const [season, count, type] = s.split(':');
      return { season: Number(season), count: Number(count), type };
    });
    parsed.set(raw, list);
  }
  return list;
}

/** 這一季以前（含）最近一次的普查 */
export function latestCensus(list: Census[], season: number): Census | null {
  let found: Census | null = null;
  for (const c of list) if (c.season <= season) found = c;
  return found;
}

export function countText(c: Census): string {
  if (c.count < 0) return tr({ zh: '有繁殖（沒有計數）', en: 'breeding (not counted)' });
  if (c.count === 0) return tr({ zh: '沒有企鵝繁殖', en: 'no breeding penguins' });
  return UNITS[c.type]?.(c.count) ?? fixed(c.count, 0);
}

export const speciesOf = (code: unknown) => SPECIES.find((s) => s.code === code) ?? null;

/** 繁殖地的英文名稱（MAPPPD 只有英文） */
export const siteName = (p: PointRecord) => String(p.name ?? '');

/**
 * 這一季的值：s 是顏色的種類（全部時是數量最多的一種；計數單位不同直接比，只是決定顏色），n 是數量（決定大小），
 * age 是最近一次普查到這一季隔了幾年，seen 是這一季以前有沒有普查過（沒有的不畫）
 */
function epochValues(p: PointRecord, epoch: number): Record<string, number | null> {
  let best: { s: Species; c: Census } | null = null;
  let last = -Infinity;
  for (const s of SPECIES) {
    const c = latestCensus(censuses(p, s.field), epoch);
    if (!c) continue;
    last = Math.max(last, c.season);
    if (!best || c.count > best.c.count) best = { s, c };
  }
  if (!best) return { seen: null, s: null, n: null, age: null };
  return { seen: 1, s: best.c.count === 0 ? 0 : best.s.code, n: Math.max(best.c.count, 0), age: epoch - last };
}

const SPECIES_COLORS: ColorClasses = {
  field: 's',
  title: { zh: '種類', en: 'Species' },
  thresholds: SPECIES.map((s) => s.code),
  classes: [
    { color: MAP_TOKENS.noData, label: { zh: '那一季沒有企鵝繁殖', en: 'No breeding that season' } },
    ...SPECIES.map((s) => ({ color: s.color, label: s.label })),
  ],
};

/** 最近一次普查隔了幾年：近的青綠、舊的橘到深紫（白色的冰面上淺色看不清楚，不用單一色相的深淺） */
const AGE_COLORS: ColorClasses = {
  field: 'age',
  title: { zh: '最近一次普查', en: 'Latest census' },
  thresholds: [5, 10, 20, 40],
  classes: [
    { color: MAP_TOKENS.diverging[6], label: { zh: '5 年內', en: 'Within 5 years' } },
    { color: MAP_TOKENS.diverging[5], label: { zh: '5–9 年前', en: '5–9 years before' } },
    { color: C[2], label: { zh: '10–19 年前', en: '10–19 years before' } },
    { color: MAP_TOKENS.diverging[0], label: { zh: '20–39 年前', en: '20–39 years before' } },
    { color: C[6], label: { zh: '40 年以上', en: '40 years or more' } },
  ],
};

function tooltip(p: PointRecord, ctx: { year: number; item: string | null }) {
  const lines: string[] = [];
  let total = 0;
  for (const s of SPECIES) {
    const list = censuses(p, s.field).filter((c) => c.season <= ctx.year);
    const c = list[list.length - 1];
    if (!c) continue;
    total += list.length;
    lines.push(
      tr({
        zh: `${tr(s.label)}：${seasonText(c.season)} 繁殖季 ${countText(c)}`,
        en: `${tr(s.label)}: ${countText(c)} in ${seasonText(c.season)}`,
      }),
    );
    const peak = list.reduce((a, b) => (b.count > a.count ? b : a));
    if (list.length > 1 && peak !== c && peak.count > 0) {
      lines.push(tr({ zh: `　最多：${seasonText(peak.season)} 繁殖季 ${countText(peak)}`, en: `  Most: ${countText(peak)} in ${seasonText(peak.season)}` }));
    }
  }
  return {
    title: siteName(p),
    detail: tr({
      zh: `到 ${seasonText(ctx.year)} 繁殖季普查 ${fixed(total, 0)} 次`,
      en: `${fixed(total, 0)} ${total === 1 ? 'census' : 'censuses'} up to ${seasonText(ctx.year)}`,
    }),
    extra: lines,
  };
}

function overlay(id: string, indicator: string, color: ColorClasses): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: 'sites/{item}.json',
    label: { zh: '企鵝繁殖地', en: 'Penguin colonies' },
    indicators: [indicator],
    radius: { field: 'n', stops: [[0, 2.4], [100, 3], [1000, 4], [10000, 6], [100000, 9], [500000, 13]] },
    color,
    sortField: 'n',
    epochs: { years: Array.from({ length: LAST_SEASON - FIRST_SEASON + 1 }, (_, i) => FIRST_SEASON + i), values: epochValues },
    minValue: { field: 'seen', stops: [[0, 1]] },
    sizeLegend: {
      title: { zh: '數量（巢、成鳥或幼鳥）', en: 'Count (nests, adults or chicks)' },
      values: [1000, 10000, 100000],
      format: (v) => fixed(v, 0),
    },
    tooltip,
  };
}

const TIME_AXIS = {
  label: { zh: '繁殖季', en: 'Breeding season' },
  year: (y: number) => tr({ zh: `${seasonText(y)} 繁殖季`, en: `the ${seasonText(y)} season` }),
  tick: seasonText,
};

const NOT_COLOURED = { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' };

const base = {
  unit: '',
  file: 'colonies-{item}.json',
  layer: { kind: 'none' } as const,
  unranked: true,
  rankingBars: false,
  panelChart: false,
  format: () => '',
  missing: NOT_COLOURED,
  timeAxis: TIME_AXIS,
} satisfies Partial<IndicatorDef>;

export const penguins: TopicDefinition = {
  id: 'penguins',
  title: { zh: '企鵝在哪裡', en: 'Where penguins breed' },
  shortTitle: { zh: '企鵝', en: 'Penguins' },
  defaultIndicator: 'species',
  defaultYear: LAST_SEASON,
  dimension: {
    label: { zh: '企鵝', en: 'Penguin' },
    options: [{ id: 'all', label: { zh: '全部', en: 'All species' } }, ...SPECIES.map((s) => ({ id: s.id, label: s.label }))],
    defaultOption: 'all',
  },
  sources: [
    {
      name: {
        zh: 'Oceanites, Inc. (2026). MAPPPD: census counts of Antarctic and sub-Antarctic breeding penguins. MAPPPD version 5.0',
        en: 'Oceanites, Inc. (2026). MAPPPD: census counts of Antarctic and sub-Antarctic breeding penguins. MAPPPD version 5.0',
      },
      url: 'https://www.penguinmap.com/',
      license: { zh: 'CC BY 4.0；使用條款不准商業使用，這裡是非商業使用', en: 'CC BY 4.0; its terms of use forbid commercial use – used here non-commercially' },
    },
  ],
  note: {
    zh:
      'MAPPPD（南極企鵝族群資料庫）收錄南極條約區（南緯 60 度以南）729 個企鵝繁殖地、1892 到 2025/26 繁殖季的 5,487 次普查，來自發表的文獻、實地與空拍、衛星影像的計數。' +
      '南極洲以外（南喬治亞、福克蘭群島、南美、南非、澳洲、紐西蘭、加拉巴哥）的企鵝不在這份資料裡。' +
      '點是每個繁殖地在時間軸那一季以前最近一次的普查：計數的單位有巢（繁殖對）、成鳥、幼鳥三種，彼此不能相加或直接比較；同一季有好幾筆時依巢、成鳥、幼鳥的順序取，同一種單位取準確度最好的。' +
      '很多繁殖地最近一次普查是幾十年前，現在的數量可能差很多（換到「普查有多舊」看）。' +
      'MAPPPD 的網頁寫 CC BY 4.0，但它的使用條款（第 3.0 版）不准商業使用；這個網站是非商業使用。台灣沒有企鵝。',
    en:
      'MAPPPD (Mapping Application for Penguin Populations and Projected Dynamics) covers 729 penguin breeding sites in the Antarctic Treaty area (south of 60°S) with 5,487 censuses from 1892 to the 2025/26 season, drawn from published studies, ground and aerial counts and satellite imagery. ' +
      'Penguins outside Antarctica (South Georgia, the Falklands, South America, South Africa, Australia, New Zealand, Galápagos) are not in this dataset. ' +
      'Each dot shows a site’s latest census up to the selected season. Counts come in three units – nests (breeding pairs), adults and chicks – which cannot be added or compared directly; when a season has several counts, nests are preferred over adults and chicks, and the most accurate count of the same unit is used. ' +
      'Many sites were last counted decades ago and may differ a lot today (see “How old is the census”). ' +
      'MAPPPD’s pages say CC BY 4.0, but its terms of use (version 3.0) forbid commercial use; this site uses it non-commercially. Taiwan has no penguins.',
  },
  noValue: { TWN: { zh: '台灣沒有企鵝', en: 'Taiwan has no penguins' } },
  focus: [-180, -88, 180, -62],
  overlays: [overlay('colonies', 'species', SPECIES_COLORS), overlay('census-age', 'census-age', AGE_COLORS)],
  indicators: [
    {
      ...base,
      id: 'species',
      label: { zh: '企鵝的種類與數量', en: 'Species and counts' },
      description: {
        zh: '南極的企鵝繁殖地，點的大小是時間軸那一季以前最近一次普查的數量（巢、成鳥或幼鳥），顏色是企鵝的種類（全部時是數量最多的一種）。阿德利企鵝沿著整個南極大陸海岸，頰帶與巴布亞企鵝集中在南極半島，皇帝企鵝在海冰上繁殖。拖動時間軸看 1892 年起每個繁殖地的普查；滑過看歷次的數量。',
        en: 'Penguin breeding sites in Antarctica. Dot size is the latest count up to the selected season (nests, adults or chicks) and colour is the species (the most numerous one when showing all). Adélie penguins ring the whole continent, chinstraps and gentoos crowd the Antarctic Peninsula, and emperors breed on sea ice. Drag the time slider to step through censuses since 1892; hover for each site’s counts.',
      },
    },
    {
      ...base,
      id: 'census-age',
      label: { zh: '普查有多舊', en: 'How old is the census' },
      description: {
        zh: '每個繁殖地最近一次普查到時間軸那一季隔了幾年：青綠是 10 年內數過的，橘到深紫是越久沒有人去數。南極半島的觀光路線上幾乎每年都有人數，東南極很多繁殖地最近一次是幾十年前。',
        en: 'Years between each site’s latest census and the selected season: aqua sites were counted within 10 years, while orange to dark purple ones have gone uncounted for longer. Sites along the Antarctic Peninsula tourist routes are counted almost every year; many in East Antarctica were last counted decades ago.',
      },
    },
  ],
};
