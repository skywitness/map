import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type {
  ColorClasses,
  IndicatorDef,
  ListPanelDef,
  ListRow,
  PointRecord,
  PointsOverlayDef,
  ScaleSpec,
  TopicDefinition,
} from './types';

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

// ── 2026-10-31 擴充（製作手冊第十批 165，pipeline/topics/power_plants_extra.py）：核電機組、儲能、各國最大的電廠 ──

const NUCLEAR_FIRST = 1951;
const NUCLEAR_LAST = 2026;
const NUCLEAR_YEARS = Array.from({ length: NUCLEAR_LAST - NUCLEAR_FIRST + 1 }, (_, i) => NUCLEAR_FIRST + i);
/** 核電的指標（點、機組清單只在這兩個指標） */
const NUCLEAR_INDICATORS = ['nuclear-units', 'nuclear-capacity'];
const NUCLEAR_COLOR = FUELS[2].color;

/** 核電廠的附註代碼（pipeline 的 NOTE_*）：狀態照 GEM（使用者決定），這裡寫實際的情況 */
const NUCLEAR_NOTES: Record<number, Text> = {
  1: {
    zh: 'GEM 列為運轉中；2022 年起被俄軍占領，6 部機組都停機。',
    en: 'Operating in GEM; occupied by Russian forces since 2022, with all six units shut down.',
  },
  2: {
    zh: '2011 年起停機，GEM 列為封存（等待重新運轉的審查）。',
    en: 'Offline since 2011; GEM lists it as mothballed (awaiting restart reviews).',
  },
  3: {
    zh: '2 號機 2025 年 5 月運轉執照到期停機，台灣從此沒有運轉中的核電機組；台電 2026 年 3 月申請重新運轉。',
    en: 'Unit 2 shut down when its licence expired in May 2025, leaving Taiwan with no operating reactors; Taipower applied to restart the plant in March 2026.',
  },
  4: {
    zh: 'GEM 的啟用年份是重新啟動的年份，這裡改回原本的商轉年份（英文維基）。',
    en: 'GEM gives the restart year as the start year; the original commercial operation year (English Wikipedia) is used here.',
  },
  5: {
    zh: '7 號機 GEM 列為興建中，其實 1997 年就商轉，2011 年起停機等待重新運轉。',
    en: 'GEM lists unit 7 as under construction, but it entered service in 1997 and has been offline since 2011, awaiting restart.',
  },
};
const nuclearNote = (p: PointRecord) => (typeof p.note === 'number' && NUCLEAR_NOTES[p.note] ? tr(NUCLEAR_NOTES[p.note]) : null);

/** 核電廠那一年的狀態：1 運轉中、2 封存（只在最新一年，GEM 的現況）、3 已退役 */
const NUCLEAR_STATE: ColorClasses = {
  field: 'state',
  title: { zh: '核電廠', en: 'Nuclear plants' },
  thresholds: [1.5, 2.5],
  classes: [
    { color: NUCLEAR_COLOR, label: { zh: '運轉中', en: 'Operating' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '停機（GEM 列為封存）', en: 'Idle (mothballed in GEM)' } },
    { color: MAP_TOKENS.inkMuted, label: { zh: '已退役', en: 'Retired' } },
  ],
};

interface UnitSpan {
  start: number;
  end: number;
  mw: number;
  st: number;
}
/** units 欄位「商轉年:退役年:MW:狀態;…」（退役年 0 是還沒退役；狀態 1 運轉中、2 封存、3 已退役） */
function unitSpans(p: PointRecord): UnitSpan[] {
  if (typeof p.units !== 'string') return [];
  return p.units.split(';').map((u) => {
    const [start, end, mw, st] = u.split(':').map(Number);
    return { start, end, mw, st };
  });
}
/** 那一年運轉中（已商轉、未退役）與已退役的機組 */
function unitsAt(p: PointRecord, year: number) {
  const units = unitSpans(p);
  return {
    op: units.filter((u) => u.start <= year && !(u.end && u.end <= year)),
    ret: units.filter((u) => u.end && u.end <= year),
  };
}

const NUCLEAR_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'nuclear-plants',
  file: 'nuclear-plants.json',
  label: { zh: '核電廠（依年份）', en: 'Nuclear plants (by year)' },
  indicators: NUCLEAR_INDICATORS,
  radius: { field: 'cap', stops: MW_STOPS },
  color: NUCLEAR_STATE,
  // 每一年算一次：已商轉的機組才畫，全部退役的變灰；封存是 GEM 的現況，只在最新一年標
  epochs: {
    years: NUCLEAR_YEARS,
    values: (p, year) => {
      const { op, ret } = unitsAt(p, year);
      if (op.length) {
        const idle = year === NUCLEAR_LAST && op.every((u) => u.st === 2);
        return { state: idle ? 2 : 1, cap: op.reduce((s, u) => s + u.mw, 0) };
      }
      if (ret.length) return { state: 3, cap: ret.reduce((s, u) => s + u.mw, 0) };
      return { state: null, cap: null };
    },
  },
  minValue: { field: 'cap', stops: [[0, 0]] },
  sizeLegend: SIZE_LEGEND,
  tooltip: (p, ctx) => {
    const { op, ret } = unitsAt(p, ctx.year);
    const mwOf = (us: UnitSpan[]) => us.reduce((s, u) => s + u.mw, 0);
    const title = op.length
      ? tr({ zh: `核電 · ${mw(mwOf(op))}（${op.length} 部機組）`, en: `Nuclear · ${mw(mwOf(op))} (${op.length} units)` })
      : tr({ zh: `已退役 · ${mw(mwOf(ret))}（${ret.length} 部機組）`, en: `Retired · ${mw(mwOf(ret))} (${ret.length} units)` });
    const spans = unitSpans(p)
      .filter((u) => u.start <= ctx.year)
      .map((u) => (u.end && u.end <= ctx.year ? `${u.start}–${u.end}` : `${u.start}–`))
      .join(tr({ zh: '、', en: ', ' }));
    return {
      title,
      detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, spans ? tr({ zh: `機組 ${spans}`, en: `units ${spans}` }) : null]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: [nuclearNote(p)].filter((x): x is string => Boolean(x)),
    };
  },
};

/** 興建中的核電機組：只在最新一年畫（yr 欄位都是 2026，指標的 overlayTime 是 cumulative） */
const NUCLEAR_CONSTRUCTION: PointsOverlayDef = {
  kind: 'points',
  id: 'nuclear-construction',
  file: 'nuclear-construction.json',
  label: { zh: '興建中的核電機組（空心，只在 2026 年）', en: 'Reactors under construction (hollow, 2026 only)' },
  indicators: NUCLEAR_INDICATORS,
  look: 'hollow',
  radius: { field: 'mw', stops: MW_STOPS },
  color: NUCLEAR_COLOR,
  timeField: 'yr',
  tooltip: (p, ctx) => ({
    title: tr({
      zh: `興建中 · ${typeof p.mw === 'number' ? mw(p.mw) : ''}（${p.n} 部機組）`,
      en: `Under construction · ${typeof p.mw === 'number' ? mw(p.mw) : ''} (${p.n} units)`,
    }),
    detail: [
      typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      typeof p.start === 'number' ? tr({ zh: `預計 ${p.start} 年起商轉`, en: `expected from ${p.start}` }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
    extra: [nuclearNote(p)].filter((x): x is string => Boolean(x)),
  }),
};

/**
 * 左邊的核電機組清單（使用者 2026-10-30 決定）：時間軸那一年以前商轉的機組依商轉年份排（新的在上面，
 * 跟著時間軸看得到那幾年新商轉的），已退役的淡一點，那一年商轉的標「商轉」；興建中的不列。
 * 那一年退役的不加標籤：清單打開時捲到第一個有標籤的列，退役的機組多半在很下面
 */
const NUCLEAR_LIST: ListPanelDef = {
  label: { zh: '核電機組', en: 'Nuclear reactors' },
  indicators: NUCLEAR_INDICATORS,
  file: 'nuclear-list.json',
  empty: { zh: '這一年還沒有商轉的核電機組。', en: 'No reactors in commercial operation by this year.' },
  rows: (points, { countryName, year }) =>
    points
      .filter((p) => typeof p.start === 'number' && p.start <= year && p.st !== 4)
      .reverse()
      .map((p, i): ListRow => {
        const start = p.start as number;
        const end = typeof p.end === 'number' ? p.end : null;
        const retired = end !== null && end <= year;
        const note = nuclearNote(p);
        return {
          key: `${p.name}-${p.unit}-${i}`,
          title: `${p.name}${p.unit ? ` ${p.unit}` : ''}`,
          titleProper: true,
          lines: [
            [
              typeof p.iso3 === 'string' ? countryName(p.iso3) : null,
              retired ? `${start}–${end}` : tr({ zh: `${start} 年起`, en: `since ${start}` }),
              typeof p.mw === 'number' ? mw(p.mw) : null,
            ]
              .filter(Boolean)
              .join(' · '),
            ...(note ? [note] : []),
          ],
          muted: retired,
          badge: start === year ? tr({ zh: '商轉', en: 'New' }) : undefined,
          target: { lon: p.lon as number, lat: p.lat as number, zoom: 9 },
        };
      }),
};

/** 抽蓄水力電廠（GEM）：狀態 1 運轉中、2 興建中、3 規劃中 */
const PUMPED_STATUS: ColorClasses = {
  field: 'st',
  title: { zh: '抽蓄水力電廠', en: 'Pumped-storage plants' },
  thresholds: [1.5, 2.5],
  classes: [
    { color: FUELS[3].color, label: { zh: '運轉中', en: 'Operating' } },
    // 興建中不用紫色：國家容量的比例圓是紫色，疊在一起分不出來
    { color: MAP_TOKENS.categorical[5], label: { zh: '興建中', en: 'Under construction' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '規劃中', en: 'Planned' } },
  ],
};
const PUMPED_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'pumped-plants',
  file: 'pumped-plants.json',
  label: { zh: '抽蓄水力電廠', en: 'Pumped-storage hydro plants' },
  indicators: ['storage'],
  radius: { field: 'mw', stops: MW_STOPS },
  color: PUMPED_STATUS,
  sizeLegend: SIZE_LEGEND,
  tooltip: (p, ctx) => {
    const st = typeof p.st === 'number' ? p.st : 1;
    const start = typeof p.start === 'number' ? p.start : null;
    return {
      title: tr({
        zh: `${p.mixed ? '抽蓄（含慣常水力）' : '抽蓄水力'} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
        en: `${p.mixed ? 'Pumped storage (with conventional hydro)' : 'Pumped storage'} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
      }),
      detail: [
        tr(PUMPED_STATUS.classes[st - 1].label),
        start ? (st === 1 ? tr({ zh: `${start} 年啟用`, en: `opened ${start}` }) : tr({ zh: `預計 ${start} 年`, en: `expected ${start}` })) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  },
};

/** 電池儲能電站（英文維基的清單加 Wikidata，CC BY-SA 4.0，不完整） */
const BATTERIES: PointsOverlayDef = {
  kind: 'points',
  id: 'batteries',
  file: 'batteries.json',
  label: { zh: '電池儲能電站（不完整）', en: 'Battery storage plants (incomplete)' },
  indicators: ['storage'],
  radius: { field: 'size', stops: MW_STOPS },
  color: MAP_TOKENS.categorical[7],
  tooltip: (p, ctx) => {
    const parts = [
      typeof p.mw === 'number' ? mw(p.mw) : null,
      typeof p.mwh === 'number' ? `${fixed(p.mwh, p.mwh < 10 ? 1 : 0)} MWh` : null,
    ].filter(Boolean);
    return {
      title: tr({ zh: `電池儲能${parts.length ? ` · ${parts.join(' / ')}` : ''}`, en: `Battery storage${parts.length ? ` · ${parts.join(' / ')}` : ''}` }),
      detail: [
        typeof p.year === 'number' ? tr({ zh: `${p.year} 年`, en: String(p.year) }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
        p.src === 1 ? tr({ zh: '英文維基', en: 'English Wikipedia' }) : 'Wikidata',
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: p.approx
        ? [tr({ zh: '位置是清單寫的所在地（縣、城市），不是電站本身', en: 'Location is the county or city given in the list, not the site itself' })]
        : [],
    };
  },
};

/** 各國最大的電廠（GEM 運轉中的電廠，依 project-id 加總）：of 是它是哪幾國最大的（跨國電廠兩國都算） */
const LARGEST_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'largest-plants',
  file: 'largest-plants.json',
  label: { zh: '各國最大的電廠', en: 'Largest plant in each country' },
  indicators: ['largest'],
  radius: { field: 'mw', stops: MW_STOPS },
  color: FUEL_CLASSES,
  sizeLegend: SIZE_LEGEND,
  tooltip: (p, ctx) => {
    const fuel = fuelByCode(p.fuel);
    const of = typeof p.of === 'string' ? p.of.split(',').map(ctx.countryName).join(tr({ zh: '、', en: ' and ' })) : '';
    return {
      title: `${fuel ? tr(fuel.label) : ''}${typeof p.mw === 'number' ? ` · ${mw(p.mw)}` : ''}`,
      detail: tr({ zh: `${of}最大的電廠`, en: `Largest plant in ${of}` }),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  },
};

/**
 * 世界前 50 大電廠（第十二批 199）：發電廠地圖、裝置容量、各燃料的容量與占比四個指標，GEM 運轉中的電廠（依 project 加總）
 * 依容量前 50 座；「各燃料」兩個指標選了一種燃料時只列那一種的前 50 座。每列：名次與名稱（GEM 的英文原名）、國家與能源、
 * 容量與第一部機組商轉的年份。跟選取的國家連動（那一國前 50 座）
 */
const TOP_PLANTS = 50;
const TOP_LIST: ListPanelDef = {
  label: { zh: '最大的 50 座電廠', en: '50 largest power plants' },
  indicators: ['plants', 'capacity', 'capacity-fuel', 'share'],
  file: 'plants-operating.json',
  countryField: 'iso3',
  rows: (points, { countryName, item }) => {
    const fuel = FUELS.find((f) => f.id === item);
    return points
      .filter((p) => typeof p.mw === 'number' && (!fuel || p.fuel === fuel.code))
      .sort((a, b) => Number(b.mw) - Number(a.mw))
      .slice(0, TOP_PLANTS)
      .map((p, i): ListRow => {
        const f = fuelByCode(p.fuel);
        return {
          key: `${p.name}-${p.lon}-${p.lat}`,
          title: `${i + 1}. ${String(p.name ?? '')}`,
          titleProper: true,
          lines: [
            [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, f ? tr(f.label) : null].filter(Boolean).join(' · '),
            [mw(p.mw as number), typeof p.start === 'number' ? tr({ zh: `${p.start} 年起`, en: `since ${p.start}` }) : null].filter(Boolean).join(' · '),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        };
      });
  },
};

/** 各國最大的電廠（第十二批 199，第十批 165 的指標）：依容量；每列：名稱、它是哪幾國最大的、能源、容量 */
const LARGEST_LIST: ListPanelDef = {
  label: { zh: '各國最大的電廠', en: 'Largest plant in each country' },
  indicators: ['largest'],
  file: 'largest-plants.json',
  countryField: 'of',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(b.mw) - Number(a.mw))
      .map((p, i): ListRow => {
        const f = fuelByCode(p.fuel);
        const of = typeof p.of === 'string' ? p.of.split(',').map(countryName).join(tr({ zh: '、', en: ' and ' })) : '';
        return {
          key: `${p.name}-${i}`,
          title: String(p.name ?? ''),
          titleProper: true,
          lines: [
            tr({ zh: `${of}最大`, en: `Largest in ${of}` }),
            [f ? tr(f.label) : null, typeof p.mw === 'number' ? mw(p.mw) : null].filter(Boolean).join(' · '),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        };
      }),
};

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
  {
    id: 'nuclear-units',
    label: { zh: '核電機組數', en: 'Nuclear reactors' },
    description: {
      zh: '已經商轉、還沒退役的核電機組數，1951 年起每年（GEM 的機組資料，含停機待審的）。2026 年世界 443 部：美國 94、中國 61、法國 57、俄羅斯 34、日本 30（其中 16 部 2011 年起停機）、南韓 26；最多是 2002 年的 448 部。台灣 1985 年 6 部，核一、核二、核三陸續退役，2025 年起是 0。地圖上的核電廠跟著時間軸出現，全部退役後變灰；左邊列出每部機組。',
      en: 'Nuclear reactors in commercial operation and not yet retired, each year since 1951 (GEM unit data, including idle units). 443 worldwide in 2026: the US 94, China 61, France 57, Russia 34, Japan 30 (16 of them offline since 2011) and South Korea 26; the peak was 448 in 2002. Taiwan had six in 1985; Jinshan, Kuosheng and Maanshan were retired one after another, leaving none from 2025. Nuclear plants on the map appear with the timeline and turn grey once fully retired; every reactor is listed on the left.',
    },
    unit: { zh: '部', en: 'reactors' },
    file: 'nuclear-units.json',
    layer: { kind: 'choropleth', scale: seq([1, 3, 6, 10, 20, 40]) },
    format: (v) => tr({ zh: `${fixed(v, 0)} 部`, en: `${fixed(v, 0)} reactor${v === 1 ? '' : 's'}` }),
    formatTick: (v) => fixed(v, 0),
    defaultYear: NUCLEAR_LAST,
    overlayTime: 'cumulative',
    missing: { zh: '從來沒有核電機組', en: 'Never had a nuclear reactor' },
  },
  {
    id: 'nuclear-capacity',
    label: { zh: '核電裝置容量', en: 'Nuclear capacity' },
    description: {
      zh: '已經商轉、還沒退役的核電機組的裝置容量合計，圓的面積與容量成正比。2026 年世界 423 GW。',
      en: 'Combined capacity of nuclear reactors in commercial operation and not yet retired; circle area is proportional to capacity. 423 GW worldwide in 2026.',
    },
    unit: GW_UNIT,
    file: 'nuclear-capacity.json',
    layer: { kind: 'bubble', legendValues: [1, 10, 100] },
    format: gw,
    formatTick: gwTick,
    defaultYear: NUCLEAR_LAST,
    overlayTime: 'cumulative',
    shareOfWorld: true,
  },
  {
    id: 'storage',
    label: { zh: '儲能（抽蓄水力）', en: 'Storage (pumped hydro)' },
    description: {
      zh: '抽蓄水力的裝置容量（EIA，1980 年起）：用電少時把水抽到上池，用電多時放水發電，是目前最主要的大型儲能。2024 年世界 200.6 GW，43 國有：中國 58.7、日本 27.3、美國 23.2、瑞士 12.3、德國 9.4 GW；台灣 2.6 GW（明潭、大觀二廠）。地圖上有 GEM 的抽蓄電廠（運轉中、興建中、規劃中），以及英文維基與 Wikidata 的電池儲能電站：電池的清單很不完整，多半是美國、英國、澳洲，電池儲能最多的中國幾乎沒有。',
      en: 'Installed pumped-storage hydro capacity (EIA, since 1980): water is pumped uphill when demand is low and released through turbines when it is high, still the main form of large-scale storage. 200.6 GW worldwide in 2024 across 43 countries: China 58.7, Japan 27.3, the US 23.2, Switzerland 12.3 and Germany 9.4 GW; Taiwan 2.6 GW (Mingtan and Taikuan II). The map shows GEM’s pumped-storage plants (operating, under construction and planned) and battery storage plants from English Wikipedia and Wikidata; the battery list is far from complete, mostly the US, the UK and Australia, with almost nothing for China, which has the most battery storage.',
    },
    unit: GW_UNIT,
    file: 'storage.json',
    layer: { kind: 'bubble', legendValues: [1, 10, 50] },
    format: gw,
    formatTick: gwTick,
    defaultYear: 2024,
    shareOfWorld: true,
  },
  {
    id: 'largest',
    label: { zh: '各國最大的電廠', en: 'Largest power plant' },
    description: {
      zh: '每個國家裝置容量最大的運轉中電廠是哪種能源（GEM 的一座電廠，機組加總），滑過看名稱與容量。217 國裡燃氣 93 國、水力 46、燃煤 28、太陽能 18、核能 17、風力 11、生質能 4。最大的是中國三峽 22,500 MW；台灣是大潭（燃氣）7,539 MW，日本是富津（燃氣），南韓是韓光（核能）。跨國電廠依份額算兩國各一次：伊泰普在巴拉圭算 7,000 MW 是最大的，在巴西則是貝盧蒙蒂（Belo Monte）水電廠較大。',
      en: 'The energy source of each country’s largest operating power plant by capacity (a GEM plant, summed over its units); hover for the name and capacity. Of 217 countries, gas leads in 93, hydro in 46, coal in 28, solar in 18, nuclear in 17, wind in 11 and bioenergy in 4. The largest is China’s Three Gorges at 22,500 MW; Taiwan’s is Datan (gas) at 7,539 MW, Japan’s Futtsu (gas) and South Korea’s Hanbit (nuclear). Cross-border plants count once in each country by share: Itaipu at 7,000 MW is Paraguay’s largest, while in Brazil Belo Monte is larger.',
    },
    unit: '',
    file: 'largest.json',
    layer: { kind: 'categorical', categories: FUELS.map((f) => ({ value: f.code, label: f.label, color: f.color })) },
    format: (v) => (fuelByCode(v) ? tr(fuelByCode(v)!.label) : ''),
    timeless: true,
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
    {
      name: {
        zh: 'EIA International Energy Statistics：抽蓄水力裝置容量（2026 年 10 月）',
        en: 'EIA International Energy Statistics: pumped-storage capacity (October 2026)',
      },
      url: 'https://www.eia.gov/international/data/world',
      license: { zh: '公有領域（美國政府著作）', en: 'Public domain (US government work)' },
    },
    {
      name: {
        zh: '英文維基百科「List of energy storage power plants」（電池儲能，revid 1372757055）與核電廠條目（重啟機組的商轉年份）',
        en: 'English Wikipedia, “List of energy storage power plants” (battery storage, revision 1372757055) and nuclear plant articles (commissioning years of restarted units)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_energy_storage_power_plants',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata：電池儲能系統', en: 'Wikidata: battery energy storage systems' }, url: 'https://www.wikidata.org/wiki/Q810924', license: 'CC0' },
  ],
  note: {
    zh: '電廠資料是 Global Energy Monitor（GEM）追蹤的發電機組，依各能源的收錄門檻：燃煤 30 MW、燃氣與燃油 50 MW（歐盟、英國 20 MW）、水力 30 MW、風力 10 MW、生質能 20 MW 以上，太陽能是 1 MW 以上的地面型案場（不含屋頂型），核能與地熱幾乎全收；不含電池儲能。容量是銘牌容量（MW），一座電廠的機組加總。跨國的水力電廠（伊泰普、亞西雷塔等）在國家統計裡依份額拆給兩國。台灣的數字跟經濟部能源署的發電裝置容量對照，見側欄附註。核電機組依 GEM 的商轉與退役年份畫出每一年的狀態（狀態照 GEM，滑過有實際情況的說明）；抽蓄水力的國家容量用 EIA；電池儲能電站來自英文維基的清單與 Wikidata，很不完整。',
    en: 'Plant data are the generating units tracked by Global Energy Monitor (GEM), subject to each tracker’s threshold: 30 MW for coal, 50 MW for gas and oil (20 MW in the EU and UK), 30 MW for hydro, 10 MW for wind and 20 MW for bioenergy; solar covers ground-mounted farms of 1 MW or more (no rooftop systems), and nuclear and geothermal are nearly complete; battery storage is not included. Capacity is nameplate capacity in MW, summed over a plant’s units. Cross-border hydro plants (Itaipu, Yacyretá and others) are split between the two countries in the country statistics. Taiwan’s figures are compared with the Energy Administration’s installed capacity in the country panel notes. Nuclear reactors are drawn year by year from GEM’s start and retirement years (statuses follow GEM, with notes on hover where reality differs); national pumped-storage capacity comes from the EIA; battery storage plants come from an English Wikipedia list and Wikidata and are far from complete.',
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
  listPanel: [NUCLEAR_LIST, TOP_LIST, LARGEST_LIST],
  overlays: [
    { ...NUCLEAR_PLANTS },
    { ...NUCLEAR_CONSTRUCTION },
    { ...PUMPED_PLANTS },
    { ...BATTERIES },
    { ...LARGEST_PLANTS },
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
