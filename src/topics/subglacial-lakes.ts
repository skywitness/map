import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 南極的冰下湖（pipeline/topics/subglacial_lakes.py）：Wilson 等 2025 用 CryoSat-2 測高找到的南極活動冰下湖，
 * 85 個新的加 19 個重新分析的既有活動湖，每個湖一個點加範圍。
 * 使用者 2026-10-30 決定：先做 Wilson 的 104 個（CC BY 4.0）；Livingstone 2022 的完整清單（773 個）等授權確認再加。
 * 2026-10-31（第十四批 257）：Livingstone 2022 的 ORDA 版確認是 CC BY 4.0，773 個（pipeline/topics/subglacial_lakes_all.py）
 * 畫在 Wilson 的點底下（兩份並列，重複的在點上註明）。
 */

const KINDS = [
  { value: 1, color: MAP_TOKENS.categorical[7], label: { zh: '新發現的活動湖（Wilson 2025）', en: 'Newly found active lake (Wilson 2025)' } },
  { value: 2, color: MAP_TOKENS.categorical[1], label: { zh: '已知的活動湖（重新分析）', en: 'Known active lake (re-analysed)' } },
];

const KIND_COLORS: ColorClasses = {
  field: 't',
  title: { zh: '冰下湖', en: 'Subglacial lake' },
  thresholds: [2],
  classes: KINDS.map((k) => ({ color: k.color, label: k.label })),
};

/** 小數年 → 「2013 年 12 月」（CryoSat-2 的時間解析度約一個月） */
function when(y: number): string {
  const year = Math.floor(y);
  const month = Math.min(12, Math.floor((y - year) * 12) + 1);
  return tr({ zh: `${year} 年 ${month} 月`, en: `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}` });
}

/** 灌滿或排空的紀錄（資料檔的 c：「開始:結束:冰面高度變化;…」） */
export function cycles(p: PointRecord): { start: number; end: number; dh: number }[] {
  return String(p.c ?? '')
    .split(';')
    .filter(Boolean)
    .map((s) => {
      const [start, end, dh] = s.split(':').map(Number);
      return { start, end, dh };
    });
}

function cycleText(c: { start: number; end: number; dh: number }): string {
  const range = `${when(c.start)}–${when(c.end)}`;
  return c.dh >= 0
    ? tr({ zh: `${range} 灌滿：冰面升高 ${fixed(c.dh, 1)} m`, en: `${range} filling: surface rose ${fixed(c.dh, 1)} m` })
    : tr({ zh: `${range} 排空：冰面下降 ${fixed(-c.dh, 1)} m`, en: `${range} draining: surface fell ${fixed(-c.dh, 1)} m` });
}

const SHEETS: Record<string, { zh: string; en: string }> = {
  EAIS: { zh: '東南極冰蓋', en: 'East Antarctic Ice Sheet' },
  WAIS: { zh: '西南極冰蓋', en: 'West Antarctic Ice Sheet' },
};

function lakeTooltip(p: PointRecord) {
  const kind = KINDS.find((k) => k.value === p.t);
  const facts = [
    typeof p.a === 'number' ? tr({ zh: `範圍約 ${fixed(p.a, 0)} km²`, en: `about ${fixed(p.a, 0)} km²` }) : null,
    typeof p.h === 'number' ? tr({ zh: `上面的冰 ${fixed(p.h, 0)} m`, en: `under ${fixed(p.h, 0)} m of ice` }) : null,
    typeof p.sheet === 'string' && SHEETS[p.sheet] ? tr(SHEETS[p.sheet]) : null,
  ].filter(Boolean);
  const list = cycles(p);
  const extra = [facts.join(' · '), ...list.slice(0, 6).map(cycleText)];
  if (list.length > 6) extra.push(tr({ zh: `…共 ${list.length} 次`, en: `…${list.length} in all` }));
  if (typeof p.v === 'number' && p.v > 0) {
    extra.push(tr({ zh: `一次最多約 ${fixed(p.v, 2)} km³ 的水`, en: `up to about ${fixed(p.v, 2)} km³ of water at a time` }));
  }
  return { title: String(p.name ?? ''), detail: kind ? tr(kind.label) : '', extra };
}

/** Livingstone 2022 的冰下湖（lakes-all.json 的 t）：1 穩定湖、2 活動湖 */
const ALL_KINDS = [
  { value: 1, color: MAP_TOKENS.categorical[0], label: { zh: '穩定的冰下湖（Livingstone 2022）', en: 'Stable lake (Livingstone 2022)' } },
  { value: 2, color: MAP_TOKENS.categorical[2], label: { zh: '活動的冰下湖（Livingstone 2022）', en: 'Active lake (Livingstone 2022)' } },
];

/** 位置（資料的英文原文）：常見的幾個寫中文 */
const LOCATIONS: Record<string, { zh: string; en: string }> = {
  Antarctica: { zh: '南極', en: 'Antarctica' },
  Greenland: { zh: '格陵蘭', en: 'Greenland' },
  Switzerland: { zh: '瑞士（山岳冰川）', en: 'Switzerland (valley glacier)' },
  Iceland: { zh: '冰島', en: 'Iceland' },
  Alaska: { zh: '阿拉斯加', en: 'Alaska' },
  USA: { zh: '美國', en: 'USA' },
  'Devon Ice Cap': { zh: '德文島冰帽（加拿大）', en: 'Devon Ice Cap (Canada)' },
  'French Alps': { zh: '法國阿爾卑斯山', en: 'French Alps' },
  France: { zh: '法國', en: 'France' },
};

function allLakeTooltip(p: PointRecord) {
  const kind = ALL_KINDS.find((k) => k.value === p.t);
  const loc = typeof p.loc === 'string' ? (LOCATIONS[p.loc] ? tr(LOCATIONS[p.loc]) : p.loc) : null;
  const facts = [
    typeof p.a === 'number' ? tr({ zh: `面積約 ${fixed(p.a, p.a < 10 ? 1 : 0)} km²`, en: `about ${fixed(p.a, p.a < 10 ? 1 : 0)} km²` }) : null,
    typeof p.l === 'number' ? tr({ zh: `長約 ${fixed(p.l / 1000, 1)} km`, en: `about ${fixed(p.l / 1000, 1)} km long` }) : null,
    typeof p.h === 'number' ? tr({ zh: `上面的冰 ${fixed(p.h, 0)} m`, en: `under ${fixed(p.h, 0)} m of ice` }) : null,
    typeof p.d === 'number' ? tr({ zh: `最深約 ${fixed(p.d, 0)} m`, en: `up to about ${fixed(p.d, 0)} m deep` }) : null,
    typeof p.v === 'number' ? tr({ zh: `約 ${fixed(p.v, p.v < 1 ? 2 : 0)} km³ 的水`, en: `about ${fixed(p.v, p.v < 1 ? 2 : 0)} km³ of water` }) : null,
  ].filter(Boolean);
  const extra = [facts.join(' · ')].filter(Boolean);
  if (typeof p.wl === 'string') extra.push(tr({ zh: `Wilson 2025 也有這個湖（${p.wl}）`, en: `Also in Wilson 2025 (${p.wl})` }));
  return {
    title: typeof p.name === 'string' ? p.name : tr({ zh: '沒有名稱的冰下湖', en: 'Unnamed subglacial lake' }),
    detail: [kind ? tr(kind.label) : null, loc].filter(Boolean).join(' · '),
    extra,
  };
}

/** 南極主題（antarctica.ts）的冰下湖部分：2026-10-30 起跟研究站、企鵝合成一個主題 */
export const lakesPart = {
  sources: [
    {
      name: {
        zh: 'Wilson 等 2025，Detection of 85 new active subglacial lakes in Antarctica from a decade of CryoSat-2 data（Nature Communications）的資料',
        en: 'Wilson et al. 2025, Detection of 85 new active subglacial lakes in Antarctica from a decade of CryoSat-2 data (Nature Communications), data',
      },
      url: 'https://doi.org/10.5281/zenodo.16330565',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Livingstone 等，Compiled global database of subglacial lakes（雪菲爾大學 ORDA，2025；Livingstone 等 2022，Nature Reviews Earth & Environment）',
        en: 'Livingstone et al., Compiled global database of subglacial lakes (University of Sheffield ORDA, 2025; Livingstone et al. 2022, Nature Reviews Earth & Environment)',
      },
      url: 'https://doi.org/10.15131/shef.data.18094037.v1',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '冰下湖是南極冰蓋底下、被兩三公里厚的冰壓著的液態水。「活動」的冰下湖會灌滿又排空，上面的冰面跟著升降幾公尺，衛星測高量得到；穩定的湖（例如最大的沃斯托克湖）冰面不動，要用冰層雷達找。' +
      'Wilson 等 2025 用 CryoSat-2 衛星 2010–2020 年的測高找到 85 個新的活動湖，也重新分析了 19 個已知的活動湖（Smith 等 2009、2017 的名單）；點是湖的中心，外框是用冰面升降畫出的範圍（每個湖取面積最大的一期）。湖名是所在的冰川流域加上離接地線的距離（公里）。' +
      '範圍與體積是從冰面的高度變化推算的，論文的資料註明可能高估。全世界已知的冰下湖用 Livingstone 等 2022 的資料庫（雪菲爾大學 ORDA 的版本，CC BY 4.0）：773 個，南極 675、格陵蘭 64，穩定湖 594、活動湖 179，點是湖的位置、大小依面積；Wilson 的 104 個裡有 21 個在 15 公里內對到這份的活動湖，兩份都畫、Wilson 的在上面，重複的在點上註明。台灣沒有冰下湖。',
    en:
      'Subglacial lakes are liquid water beneath the Antarctic ice sheet, under two or three kilometres of ice. “Active” lakes fill and drain, raising and lowering the ice surface above by a few metres, which satellite altimetry can detect; stable lakes (such as Lake Vostok, the largest) leave the surface still and are found with ice-penetrating radar. ' +
      'Wilson et al. 2025 used CryoSat-2 altimetry from 2010–2020 to find 85 new active lakes and re-analysed 19 known active lakes (from the lists of Smith et al. 2009 and 2017). Dots mark each lake’s centre and outlines show its extent mapped from the surface movement (the largest of its periods). Lake names give the glacier basin and the distance from the grounding line in kilometres. ' +
      'Extents and volumes are inferred from surface elevation change and, as the data note, may be overestimates. The 773 known subglacial lakes worldwide come from the Livingstone et al. 2022 database (the University of Sheffield’s ORDA release, CC BY 4.0): 675 in Antarctica and 64 in Greenland, 594 stable and 179 active, sized by area. Twenty-one of Wilson’s 104 lakes lie within 15 km of an active lake in that database; both are drawn, Wilson’s on top, and the matches are noted. Taiwan has no subglacial lakes.',
  },
  overlays: [
    {
      kind: 'points',
      id: 'lakes-all',
      file: 'lakes-all.json',
      label: { zh: '已知的冰下湖（Livingstone 2022，773 個）', en: 'Known subglacial lakes (Livingstone 2022, 773)' },
      indicators: ['lakes'],
      radius: { field: 'a', stops: [[0, 1.8], [10, 2.4], [100, 3.2], [1000, 4.6], [14000, 7]] },
      color: {
        field: 't',
        title: { zh: '冰下湖（Livingstone 2022）', en: 'Subglacial lakes (Livingstone 2022)' },
        thresholds: [2],
        classes: ALL_KINDS.map((k) => ({ color: k.color, label: k.label })),
      },
      sortField: 'a',
      tooltip: allLakeTooltip,
    },
    {
      kind: 'lines',
      id: 'outlines',
      file: 'outlines.json',
      label: { zh: '冰下湖的範圍', en: 'Lake outlines' },
      indicators: ['lakes'],
      width: 1.2,
      color: { classes: KINDS.map((k) => ({ value: k.value, color: k.color, label: k.label })) },
      fill: { field: 'ring', value: 1, opacity: 0.35, darkOpacity: 0.5 },
    },
    {
      kind: 'points',
      id: 'lakes',
      file: 'lakes.json',
      label: { zh: '活動的冰下湖（Wilson 2025）', en: 'Active subglacial lakes (Wilson 2025)' },
      indicators: ['lakes'],
      radius: { field: 'a', stops: [[0, 2.6], [50, 3.4], [150, 4.6], [400, 6.2]] },
      color: KIND_COLORS,
      sortField: 'a',
      sizeLegend: { title: { zh: '範圍（km²）', en: 'Extent (km²)' }, values: [50, 150, 400], format: (v) => fixed(v, 0) },
      tooltip: lakeTooltip,
    },
  ],
  indicators: [
    {
      id: 'lakes',
      label: { zh: '冰下湖', en: 'Subglacial lakes' },
      description: {
        zh: '南極冰蓋底下會灌滿又排空的冰下湖：粉紅是 Wilson 等 2025 用 CryoSat-2 新找到的 85 個，紫色是重新分析的 19 個已知湖。多半在冰流快的冰川底下，例如羅斯冰棚上游的冰流、思韋茨冰川；滑到點上看每一次灌滿或排空的時間與冰面升降幾公尺。底下的小點是 Livingstone 等 2022 整理的全世界已知的 773 個冰下湖：南極 675 個（最大的沃斯托克湖 1.4 萬 km²）、格陵蘭 64 個，綠色是冰面不動的穩定湖（用冰層雷達找到）、琥珀色是活動湖。',
        en: 'Lakes beneath the Antarctic ice sheet that fill and drain: pink dots are the 85 found by Wilson et al. 2025 with CryoSat-2, purple ones the 19 known lakes they re-analysed. Most lie beneath fast-flowing glaciers, such as the ice streams feeding the Ross Ice Shelf and Thwaites Glacier; hover over a dot for each filling or draining and how far the surface moved. The small dots beneath are the 773 known subglacial lakes worldwide compiled by Livingstone et al. 2022: 675 in Antarctica (the largest, Lake Vostok, covers 14,000 km²) and 64 in Greenland; green ones are stable lakes found with ice-penetrating radar, amber ones active lakes.',
      },
      unit: '',
      file: 'lakes-count.json',
      // 湖的資料不分年份（CryoSat-2 2010–2020 年的整理）：這個指標沒有時間軸
      timeless: true,
      defaultYear: 2020,
      noValue: { TWN: { zh: '台灣沒有冰下湖', en: 'Taiwan has no subglacial lakes' } },
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '冰下湖不屬於任何國家，看地圖上的點', en: 'Subglacial lakes belong to no country; see the dots on the map' },
    },
  ],
} satisfies Partial<TopicDefinition>;
