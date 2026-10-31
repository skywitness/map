import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 大型科學設施（2026-10-31，製作手冊第十批 168；pipeline/topics/science_facilities.py）：英文維基三個清單的核融合研究裝置、
 * 同步輻射光源、粒子加速器與對撞機（使用者決定另外加），依年份出現。放科技的「研發與太空」欄。
 */

const FIRST = 1928;
const LAST = 2026;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

/** 群組 g：顏色 */
const GROUPS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '核融合研究裝置', en: 'Fusion experiments' }, color: MAP_TOKENS.categorical[5] },
  { value: 2, label: { zh: '同步輻射光源', en: 'Synchrotron light sources' }, color: MAP_TOKENS.categorical[1] },
  { value: 3, label: { zh: '粒子加速器與對撞機', en: 'Particle accelerators and colliders' }, color: MAP_TOKENS.categorical[0] },
];
/** 細類 t（左邊清單的分組） */
const TYPES: Record<number, Text> = {
  1: { zh: '托卡馬克', en: 'Tokamaks' },
  2: { zh: '仿星器', en: 'Stellarators' },
  3: { zh: '雷射核融合', en: 'Laser fusion' },
  4: { zh: '同步輻射光源與自由電子雷射', en: 'Light sources and FELs' },
  5: { zh: '早期的加速器', en: 'Early accelerators' },
  6: { zh: '固定靶加速器', en: 'Fixed-target accelerators' },
  7: { zh: '對撞機', en: 'Colliders' },
};
/** 狀態 st（pipeline 的 OPERATING〔1〕、CLOSED、CLOSED_UNKNOWN、PLANNED） */
const CLOSED = 2;
const CLOSED_UNKNOWN = 3;
const PLANNED = 4;

const GROUP_COLORS: ColorClasses = {
  field: 'g',
  title: { zh: '設施', en: 'Facility' },
  thresholds: [1.5, 2.5],
  classes: GROUPS.map((g) => ({ color: g.color, label: g.label })),
};

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const startOf = (p: PointRecord) => num(p.s) ?? LAST;

/** 那一年的狀態：運作中、已關閉，或還沒啟用（null） */
function stateAt(p: PointRecord, year: number): 'on' | 'off' | null {
  const st = p.st;
  if (st === PLANNED) return null;
  if (startOf(p) > year) return null;
  if (st === CLOSED_UNKNOWN) return 'off';
  const end = num(p.e);
  if (st === CLOSED && end !== null && end < year) return 'off';
  return 'on';
}

const facilityName = (p: PointRecord) => (getLang() === 'zh' && str(p.zh)) || str(p.en) || '';

function yearsText(p: PointRecord): string {
  const s = num(p.s);
  const e = num(p.e);
  if (p.st === PLANNED) return s ? tr({ zh: `預定 ${s} 年`, en: `Planned for ${s}` }) : tr({ zh: '興建中或規劃中', en: 'Under construction or planned' });
  if (p.st === CLOSED_UNKNOWN)
    return s ? tr({ zh: `${s} 年啟用，停止年份不明`, en: `From ${s}; end date unknown` }) : tr({ zh: '年份不明，已關閉', en: 'Dates unknown; closed' });
  if (p.st === CLOSED) return s === e ? String(s) : `${s ?? '?'}–${e}`;
  return s ? tr({ zh: `${s} 年起`, en: `Since ${s}` }) : tr({ zh: '運作中（啟用年份不明）', en: 'Operating (start date unknown)' });
}

function lines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const where = [str(p.iso3) ? countryName(p.iso3 as string) : null, str(p.org)].filter(Boolean).join(' · ');
  return [
    [tr(TYPES[p.t as number] ?? { zh: '', en: '' }), yearsText(p)].filter(Boolean).join(' · '),
    where,
    str(p.gev) ? tr({ zh: `能量 ${p.gev} GeV`, en: `${p.gev} GeV` }) : '',
  ].filter(Boolean);
}

function tooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  return {
    title: facilityName(p),
    detail: tr(GROUPS.find((g) => g.value === p.g)?.label ?? { zh: '', en: '' }),
    extra: lines(p, ctx.countryName),
    properNoun: getLang() === 'zh' && str(p.zh) ? (str(p.en) ?? undefined) : undefined,
  };
}

const RUNNING: PointsOverlayDef = {
  kind: 'points',
  id: 'running',
  file: 'facilities.json',
  label: { zh: '運作中', en: 'Operating' },
  radius: 5,
  color: GROUP_COLORS,
  // 每一年算一次：已啟用、還沒關閉的才畫
  epochs: { years: YEARS, values: (p, year) => ({ on: stateAt(p, year) === 'on' ? 1 : null }) },
  minValue: { field: 'on', stops: [[0, 0]] },
  tooltip,
};

const CLOSED_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'closed',
  file: 'facilities.json',
  label: { zh: '已關閉（灰色；停止年份不明的從啟用那年起畫在這裡）', en: 'Closed (grey; those with an unknown end date are shown here from their start year)' },
  look: 'muted',
  radius: 4,
  color: GROUP_COLORS,
  epochs: { years: YEARS, values: (p, year) => ({ off: stateAt(p, year) === 'off' ? 1 : null }) },
  minValue: { field: 'off', stops: [[0, 0]] },
  tooltip,
};

/** 興建中與規劃中：只在最新一年（yr 欄位都是 2026） */
const PLANNED_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'planned',
  file: 'planned.json',
  label: { zh: '興建中、規劃中（空心，只在 2026 年）', en: 'Under construction or planned (hollow, 2026 only)' },
  look: 'hollow',
  radius: 5,
  color: GROUP_COLORS,
  timeField: 'yr',
  tooltip,
};

/**
 * 左邊的清單（第十二批 L18，使用者 2026-10-30 決定依類型分組）：時間軸那一年已經啟用的設施（2026 年加上興建中、規劃中），
 * 依細類分組、組內依啟用年份；每組第一列的標籤寫類型與數量。已關閉的淡一點
 */
const LIST: ListPanelDef = {
  label: { zh: '設施', en: 'Facilities' },
  file: 'list.json',
  rows: (points, { countryName, year }) => {
    const shown = points.filter((p) => (p.st === PLANNED ? year >= LAST : stateAt(p, year) !== null));
    const sorted = [...shown].sort(
      (a, b) => (a.t as number) - (b.t as number) || startOf(a) - startOf(b) || String(a.en).localeCompare(String(b.en)),
    );
    const size = (t: unknown) => shown.filter((p) => p.t === t).length;
    return sorted.map((p, i): ListRow => {
      const first = i === 0 || sorted[i - 1].t !== p.t;
      const zhName = getLang() === 'zh' && str(p.zh);
      return {
        key: `${p.t}-${p.en}-${i}`,
        title: facilityName(p),
        titleProper: !zhName,
        lines: lines(p, countryName),
        muted: p.st !== PLANNED && stateAt(p, year) === 'off',
        badge: first ? tr({ zh: `${tr(TYPES[p.t as number])} ${size(p.t)}`, en: `${tr(TYPES[p.t as number])} (${size(p.t)})` }) : undefined,
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 10 },
      };
    });
  },
  empty: { zh: '這一年還沒有清單裡的設施', en: 'No facilities in the lists yet in this year' },
};

const count = (v: number) => tr({ zh: `${v} 個`, en: v === 1 ? '1 facility' : `${v} facilities` });

export const scienceFacilities: TopicDefinition = {
  id: 'science-facilities',
  title: { zh: '大型科學設施（核融合、同步輻射、粒子加速器）', en: 'Big science facilities: fusion, light sources and accelerators' },
  shortTitle: { zh: '大型科學設施', en: 'Big science' },
  defaultIndicator: 'map',
  defaultYear: LAST,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of fusion experiments」（revid 1379837384）、「List of synchrotron radiation facilities」（revid 1352120251）、「List of accelerators in particle physics」（revid 1369387346）',
        en: 'English Wikipedia, “List of fusion experiments” (revision 1379837384), “List of synchrotron radiation facilities” (revision 1352120251) and “List of accelerators in particle physics” (revision 1369387346)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_fusion_experiments&oldid=1379837384',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（位置）', en: 'Wikidata (locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '收英文維基三個清單的 381 個設施：核融合的托卡馬克、仿星器、雷射三個表（其他類型是條列、沒有年份，不收），同步輻射光源與自由電子雷射，粒子物理的加速器與對撞機（清單只收「輸出直接用在實驗」的加速器）。取消的與沒有地點的構想（DEMO、EFPP 等）不收。位置用表裡連結的條目在 Wikidata 的座標（裝置本身沒有座標的用所屬機構或城市）。同步輻射表的除役欄空白的當作還在運作；已關閉但停止年份不明的，從啟用那年起就畫成灰色。同一個機構的設施疊在同一點，看左邊的清單。',
    en: 'The 381 facilities in three English Wikipedia lists: the tokamak, stellarator and laser tables of fusion experiments (other types are bullet lists without dates and are left out), synchrotron light sources and free-electron lasers, and particle physics accelerators and colliders (the list covers only accelerators whose output was used directly in experiments). Cancelled projects and unsited concepts (DEMO, EFPP and others) are left out. Locations are Wikidata coordinates of the articles linked in the tables (the host institution or city where the device itself has none). Light sources with a blank decommissioning column are treated as still operating; closed facilities with an unknown end date are drawn in grey from their start year. Facilities at the same institution share one point; see the list on the left.',
  },
  listPanel: LIST,
  overlays: [RUNNING, CLOSED_LAYER, PLANNED_LAYER],
  indicators: [
    {
      id: 'map',
      label: { zh: '設施地圖', en: 'Facility map' },
      description: {
        zh: '世界的核融合研究裝置、同步輻射光源與粒子加速器，依啟用年份出現，顏色是種類，已關閉的變灰。2026 年運作中的約 175 個，美國 44、日本 22、德國與俄羅斯各 17、中國與瑞士（CERN）各 12。最早的是 1928 年亞琛的直線加速器與 1931 年柏克萊的 9 吋迴旋加速器；第一台托卡馬克是 1958 年莫斯科的 T-1。興建中的有 ITER（法國，預定 2034 年）、SPARC 等。台灣有新竹的台灣光源（1993）與台灣光子源（2015）。',
        en: 'Fusion experiments, synchrotron light sources and particle accelerators around the world, appearing in the year they started, coloured by type and turning grey once closed. About 175 were operating in 2026: 44 in the US, 22 in Japan, 17 each in Germany and Russia, and 12 each in China and Switzerland (CERN). The earliest are the 1928 linear accelerator in Aachen and Berkeley’s 9-inch cyclotron of 1931; the first tokamak was T-1 in Moscow in 1958. ITER (France, planned for 2034) and SPARC are among those under construction. Taiwan has the Taiwan Light Source (1993) and Taiwan Photon Source (2015) in Hsinchu.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'operating.json',
      layer: { kind: 'none' },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的設施', en: 'No operating facility in the lists' },
    },
    {
      id: 'operating',
      label: { zh: '運作中的設施數', en: 'Operating facilities' },
      description: {
        zh: '每個國家那一年運作中的核融合研究裝置、同步輻射光源、粒子加速器與對撞機（英文維基三個清單）。停止年份不明的不算。',
        en: 'Fusion experiments, synchrotron light sources and particle accelerators operating in each country that year (three English Wikipedia lists). Those with an unknown end date are not counted.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'operating.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的設施', en: 'No operating facility in the lists' },
    },
    {
      id: 'fusion',
      label: { zh: '核融合研究裝置', en: 'Fusion experiments' },
      description: {
        zh: '那一年運作中的托卡馬克、仿星器與雷射核融合裝置。2026 年美國最多（17 個），其次是俄羅斯、中國、日本；歐洲的 JET 2023 年關閉，日本的 JT-60SA 2023 年啟用。',
        en: 'Tokamaks, stellarators and laser fusion facilities operating that year. The US has the most in 2026 (17), followed by Russia, China and Japan; Europe’s JET closed in 2023 and Japan’s JT-60SA started in 2023.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'fusion.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的核融合裝置', en: 'No operating fusion experiment in the list' },
    },
    {
      id: 'light',
      label: { zh: '同步輻射光源', en: 'Light sources' },
      description: {
        zh: '那一年運作中的同步輻射光源與自由電子雷射（除役欄空白的當作還在運作）。美國、日本最多，其次是德國；台灣 2 座。',
        en: 'Synchrotron light sources and free-electron lasers operating that year (those with a blank decommissioning column are treated as operating). The US and Japan have the most, followed by Germany; Taiwan has two.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'light.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的光源', en: 'No operating light source in the list' },
    },
    {
      id: 'accelerators',
      label: { zh: '粒子加速器與對撞機', en: 'Accelerators and colliders' },
      description: {
        zh: '那一年運作中的粒子物理加速器與對撞機（英文維基「List of accelerators in particle physics」，只收輸出直接用在實驗的）。CERN 在瑞士與法國的邊界上，座標在瑞士這一側，算在瑞士。',
        en: 'Particle physics accelerators and colliders operating that year (English Wikipedia’s “List of accelerators in particle physics”, which lists only those whose output is used directly in experiments). CERN straddles the Swiss–French border; its coordinates are on the Swiss side, so it counts for Switzerland.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'accelerators.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的加速器', en: 'No operating accelerator in the list' },
    },
  ],
};
