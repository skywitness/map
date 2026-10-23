import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, PointsOverlayDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 武裝衝突（pipeline/topics/conflict.py）：UCDP（Uppsala Conflict Data Program）26.1 版。
 * - 死亡人數：UCDP GED 的事件依發生地點加總（1989–2025），三類組織性暴力各一個指標，加上合計與每十萬人。
 * - 衝突數與強度：UCDP/PRIO 武裝衝突資料集（1946–2025），依 UCDP 的「所在國」（被挑戰的國家）。
 * - 地圖上的點：GED 的事件（同一年、同一國、約 10 公里內合計 25 人以上的併成一點），依時間軸只顯示那一年，
 *   顏色是暴力類型（三類各一個圖層，可以分別開關）。
 * 用語照 UCDP 的定義：以國家為一方的武裝衝突（state-based）、非國家衝突（non-state）、單方面暴力（one-sided）。
 */

const n0 = (v: number) => fixed(v, 0);

const DEATHS_UNIT: Text = { zh: '人', en: 'deaths' };
const deaths = (v: number) => tr({ zh: `${n0(v)} 人死亡`, en: `${n0(v)} ${Math.round(v) === 1 ? 'death' : 'deaths'}` });

/** 三類組織性暴力（GED 的 type_of_violence）：名稱與地圖上點的顏色 */
export const VIOLENCE_TYPES: { id: 'state' | 'nonstate' | 'onesided'; label: Text; events: Text; color: string }[] = [
  {
    id: 'state',
    label: { zh: '以國家為一方的武裝衝突', en: 'State-based armed conflict' },
    events: { zh: '以國家為一方的衝突事件', en: 'State-based conflict events' },
    // 跟地震主題的震源深度同一組三色（紅、琥珀、紫），兩兩分得開（OKLab ΔE×100 一般／紅色盲／綠色盲 ≥ 21/21/15），跟海 ≥ 21
    color: MAP_TOKENS.hues.red,
  },
  {
    id: 'nonstate',
    label: { zh: '非國家衝突', en: 'Non-state conflict' },
    events: { zh: '非國家衝突事件', en: 'Non-state conflict events' },
    color: MAP_TOKENS.hues.yellow,
  },
  {
    id: 'onesided',
    label: { zh: '單方面暴力（攻擊平民）', en: 'One-sided violence (against civilians)' },
    events: { zh: '單方面暴力事件', en: 'One-sided violence events' },
    color: MAP_TOKENS.categorical[6],
  },
];

const ESTIMATE_NOTE: Text = {
  zh: '死亡人數是 UCDP 的最佳估計，只算有可靠來源記錄的死亡，數字偏保守。',
  en: 'Deaths are UCDP best estimates, counting only deaths documented by reliable sources, so the figures are conservative.',
};

// ── 每十萬人死亡率 ──
/** 第一個門檻把 0 跟「有死亡」分開，圖例寫「> 0」（最小的非 0 值是中國 2023 年 1 人，約十萬分之 0.00007） */
const ANY = 0.000001;
const RATE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [ANY, 1, 5, 20, 50, 100] };
const rate = (v: number) => (v === 0 ? '0' : v < 0.01 ? '< 0.01' : fixed(v, v < 10 ? 2 : 1));
const rateTick = (v: number) => (v === ANY ? '> 0' : n0(v));

// ── 衝突強度（類別圖） ──
const INTENSITY = [
  { value: 2, label: { zh: '戰爭（一年 1,000 人以上戰鬥死亡）', en: 'War (1,000+ battle-related deaths a year)' } },
  { value: 1, label: { zh: '小型衝突（25–999 人）', en: 'Minor conflict (25–999 deaths)' } },
  { value: 0, label: { zh: '沒有以國家為一方的武裝衝突', en: 'No state-based armed conflict' } },
];
export function intensityLabel(code: number): string {
  const c = INTENSITY.find((i) => i.value === code);
  return c ? tr(c.label) : String(code);
}

const conflicts = (v: number) =>
  tr({ zh: `${n0(v)} 個衝突`, en: `${n0(v)} ${Math.round(v) === 1 ? 'conflict' : 'conflicts'}` });

const GED_YEARS: Text = { zh: '1989–2025 年', en: '1989–2025' };
const LOCATION_RULE: Text = {
  zh: '所在國依 UCDP 的定義是「被挑戰的國家」（國家間衝突是雙方政府的國家），不一定是戰鬥發生的地方；爭議領土在今天另成一國的（例如巴勒斯坦、西撒哈拉、科索沃）也算在那裡。',
  en: "The location follows UCDP's definition, the state being challenged (both governments' countries in an interstate conflict), which is not necessarily where the fighting took place; conflicts over territory that is a separate country today (such as Palestine, Western Sahara or Kosovo) also count there.",
};

/** 有事件點的指標：三類各自的指標畫自己那一類，合計畫三類 */
const POINT_INDICATORS: Record<string, string[]> = {
  state: ['battle-deaths', 'organized-violence-deaths'],
  nonstate: ['non-state-deaths', 'organized-violence-deaths'],
  onesided: ['one-sided-deaths', 'organized-violence-deaths'],
};

const indicators: IndicatorDef[] = [
  {
    id: 'battle-deaths',
    label: { zh: '戰鬥死亡（以國家為一方的衝突）', en: 'Battle deaths (state-based conflict)' },
    description: {
      zh: `以國家為一方的武裝衝突（政府與政府、或政府與反抗團體之間，為了政府或領土使用武力，一年至少 25 人戰鬥死亡）造成的戰鬥死亡，含交戰雙方與被波及的平民，依事件發生的國家加總（${GED_YEARS.zh}）。圓的面積與人數成正比；地圖上的紅點是當年的事件。${ESTIMATE_NOTE.zh}`,
      en: `Battle-related deaths in state-based armed conflict (armed force between two parties over government or territory, at least one of them a state government, with at least 25 battle-related deaths in a year), including combatants and civilians caught in the fighting, summed by the country where each event took place (${GED_YEARS.en}). Circle area is proportional to deaths; red dots are that year's events. ${ESTIMATE_NOTE.en}`,
    },
    unit: DEATHS_UNIT,
    file: 'battle-deaths.json',
    layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'non-state-deaths',
    label: { zh: '非國家衝突死亡', en: 'Non-state conflict deaths' },
    description: {
      zh: `非國家衝突（雙方都不是國家政府的有組織武裝團體之間使用武力，一年至少 25 人死亡，例如販毒集團、民兵或族群之間）造成的死亡，依事件發生的國家加總（${GED_YEARS.zh}）。地圖上的琥珀色點是當年的事件。${ESTIMATE_NOTE.zh}`,
      en: `Deaths in non-state conflict (armed force between two organized armed groups, neither of them a state government, with at least 25 deaths in a year, such as between cartels, militias or communal groups), summed by the country where each event took place (${GED_YEARS.en}). Amber dots are that year's events. ${ESTIMATE_NOTE.en}`,
    },
    unit: DEATHS_UNIT,
    file: 'non-state-deaths.json',
    layer: { kind: 'bubble', legendValues: [1000, 5000, 15000] },
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'one-sided-deaths',
    label: { zh: '單方面暴力死亡', en: 'One-sided violence deaths' },
    description: {
      zh: `單方面暴力（國家政府或有正式組織的團體刻意對平民使用武力，一年至少 25 人死亡；不含被拘押時的法外處決）造成的死亡，依事件發生的國家加總（${GED_YEARS.zh}）。1994 年盧安達種族滅絕的死亡人數遠高於其他年份。地圖上的紫色點是當年的事件。${ESTIMATE_NOTE.zh}`,
      en: `Deaths from one-sided violence (the deliberate use of armed force against civilians by a state government or a formally organized group, with at least 25 deaths in a year; extrajudicial killings in custody are excluded), summed by the country where each event took place (${GED_YEARS.en}). Deaths in the 1994 Rwandan genocide far exceed any other year. Purple dots are that year's events. ${ESTIMATE_NOTE.en}`,
    },
    unit: DEATHS_UNIT,
    file: 'one-sided-deaths.json',
    layer: { kind: 'bubble', legendValues: [10000, 100000, 500000] },
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'organized-violence-deaths',
    label: { zh: '組織性暴力死亡（三類合計）', en: 'Organized violence deaths (all three types)' },
    description: {
      zh: `以國家為一方的武裝衝突、非國家衝突與單方面暴力三類合計的死亡人數，依事件發生的國家加總（${GED_YEARS.zh}）。地圖上的點是當年的事件，顏色是暴力類型。${ESTIMATE_NOTE.zh}`,
      en: `Deaths from state-based armed conflict, non-state conflict and one-sided violence combined, summed by the country where each event took place (${GED_YEARS.en}). Dots are that year's events, coloured by type of violence. ${ESTIMATE_NOTE.en}`,
    },
    unit: DEATHS_UNIT,
    file: 'organized-violence-deaths.json',
    layer: { kind: 'bubble', legendValues: [10000, 100000, 500000] },
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'death-rate',
    label: { zh: '每十萬人死亡（組織性暴力）', en: 'Deaths per 100,000 (organized violence)' },
    description: {
      zh: `三類組織性暴力合計的死亡人數 ÷ 當年人口 × 10 萬（${GED_YEARS.zh}）。人口是聯合國 WPP 2024 的年中人口（2024 年起是推估）。${ESTIMATE_NOTE.zh}`,
      en: `Deaths from all three types of organized violence ÷ population that year × 100,000 (${GED_YEARS.en}). Population is the UN WPP 2024 mid-year estimate (projections from 2024). ${ESTIMATE_NOTE.en}`,
    },
    unit: { zh: '人／十萬人', en: 'per 100,000' },
    file: 'death-rate.json',
    layer: { kind: 'choropleth', scale: RATE_SCALE },
    format: (v) => tr({ zh: `每十萬人 ${rate(v)} 人死亡`, en: `${rate(v)} deaths per 100,000` }),
    formatTick: rateTick,
    compareWorld: true,
  },
  {
    id: 'active-conflicts',
    label: { zh: '以國家為一方的武裝衝突數', en: 'State-based armed conflicts' },
    description: {
      zh: `這一年所在國是這個國家的以國家為一方的武裝衝突數（UCDP/PRIO 武裝衝突資料集，1946–2025 年；一年至少 25 人戰鬥死亡才算）。${LOCATION_RULE.zh}`,
      en: `Number of state-based armed conflicts located in the country that year (UCDP/PRIO Armed Conflict Dataset, 1946–2025; a conflict counts in years with at least 25 battle-related deaths). ${LOCATION_RULE.en}`,
    },
    unit: { zh: '個', en: 'conflicts' },
    file: 'active-conflicts.json',
    // 一國一年最多 7 個（1990 年代的印度）
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5] } },
    format: conflicts,
    // 側欄折線圖的 y 軸刻度可能是 0.2、0.4…：衝突數只標整數，否則會出現「0、0、1、1」
    formatTick: (v) => (Number.isInteger(v) ? n0(v) : ''),
  },
  {
    id: 'conflict-intensity',
    label: { zh: '衝突強度', en: 'Conflict intensity' },
    description: {
      zh: `這一年所在國是這個國家的以國家為一方的武裝衝突裡，最高的強度：戰爭是一年 1,000 人以上戰鬥死亡，小型衝突是 25–999 人（UCDP/PRIO 武裝衝突資料集，1946–2025 年）。${LOCATION_RULE.zh}`,
      en: `The highest intensity among state-based armed conflicts located in the country that year: war means 1,000 or more battle-related deaths in a year, minor conflict 25–999 (UCDP/PRIO Armed Conflict Dataset, 1946–2025). ${LOCATION_RULE.en}`,
    },
    unit: '',
    file: 'conflict-intensity.json',
    layer: { kind: 'categorical', categories: INTENSITY, ordinal: true },
    format: intensityLabel,
  },
];

// ── 事件點 ──
/** 半徑（px，縮放 2 時）：死亡人數每多 10 倍，半徑約加倍 */
const DEATH_STOPS: [number, number][] = [
  [25, 1.4],
  [100, 2.2],
  [1000, 4],
  [10000, 7.5],
  [100000, 13],
];

function eventTooltip(type: (typeof VIOLENCE_TYPES)[number]) {
  return (p: PointRecord, ctx: { countryName: (iso3: string) => string }) => {
    const parts: string[] = [];
    if (typeof p.deaths === 'number') parts.push(deaths(p.deaths));
    if (typeof p.n === 'number' && p.n > 1) parts.push(tr({ zh: `${n0(p.n)} 起事件`, en: `${n0(p.n)} events` }));
    if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
    const names = [p.place, p.name].filter((s): s is string => typeof s === 'string' && s !== '');
    return {
      title: `${tr(type.label)} · ${p.year}`,
      detail: parts.join(' · '),
      properNoun: names.length ? names.join(' · ') : undefined,
    };
  };
}

const overlays: PointsOverlayDef[] = VIOLENCE_TYPES.map((type) => ({
  kind: 'points',
  id: `events-${type.id}`,
  file: `events-${type.id}.json`,
  label: type.events,
  indicators: POINT_INDICATORS[type.id],
  radius: { field: 'deaths', stops: DEATH_STOPS },
  color: type.color,
  sortField: 'deaths',
  timeField: 'year',
  // 三個圖層同一組大小說明，圖例只列在第一個打開的圖層下面
  sizeLegend: { title: { zh: '死亡人數', en: 'Deaths' }, values: [100, 1000, 10000], format: formatLargeTick },
  tooltip: eventTooltip(type),
}));

export const conflict: TopicDefinition = {
  id: 'conflict',
  title: { zh: '武裝衝突', en: 'Armed conflict' },
  shortTitle: { zh: '武裝衝突', en: 'Conflict' },
  defaultIndicator: 'battle-deaths',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'UCDP Georeferenced Event Dataset (GED) Global 26.1（Davies, Pettersson & Öberg 2026；Sundberg & Melander 2013）',
        en: 'UCDP Georeferenced Event Dataset (GED) Global 26.1 (Davies, Pettersson & Öberg 2026; Sundberg & Melander 2013)',
      },
      url: 'https://ucdp.uu.se/downloads/#ged_global',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'UCDP/PRIO Armed Conflict Dataset 26.1（Davies, Pettersson & Öberg 2026；Gleditsch et al. 2002）',
        en: 'UCDP/PRIO Armed Conflict Dataset 26.1 (Davies, Pettersson & Öberg 2026; Gleditsch et al. 2002)',
      },
      url: 'https://ucdp.uu.se/downloads/#armedconflict',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Davies, Pettersson & Öberg (2026), Organized violence 1989–2025, and violent political protests, Journal of Peace Research',
        en: 'Davies, Pettersson & Öberg (2026), Organized violence 1989–2025, and violent political protests, Journal of Peace Research',
      },
      url: 'https://doi.org/10.1093/jopres/xjag046',
      license: { zh: 'UCDP 要求引用的文獻', en: 'citation required by UCDP' },
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人口）', en: 'United Nations, World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  // 頁尾要短（英文版在 1280×800 太長會把地圖擠扁）：改算國家的細節在各國的附註與 DESIGN.md，點的門檻在指標說明
  note: {
    zh: 'UCDP 只算有可靠來源記錄的死亡（最佳估計），數字偏保守。死亡人數依事件發生的地點加總，只算 UCDP 認定為活躍的衝突（一年至少 25 人死亡），世界合計跟 UCDP 公布的一致；加薩走廊、約旦河西岸與 1992 年以前蘇聯各地的事件，依經緯度算在今天地圖上的國家。衝突數與強度依 UCDP/PRIO 武裝衝突資料集的所在國（被挑戰的國家，不一定是戰鬥發生的地方）。',
    en: "UCDP counts only deaths documented by reliable sources (best estimates), so the figures are conservative. Deaths are summed by where events took place, counting only conflicts UCDP considers active (at least 25 deaths a year), so world totals match UCDP's figures; events in Gaza, the West Bank and the pre-1992 Soviet Union are assigned to today's countries by location. Conflict counts and intensity follow the UCDP/PRIO location (the state being challenged, not necessarily where the fighting took place).",
  },
  panelExtra: () => import('./panels/ConflictPanel'),
  overlays,
  indicators,
};
