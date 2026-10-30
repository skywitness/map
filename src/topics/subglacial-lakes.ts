import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 南極的冰下湖（pipeline/topics/subglacial_lakes.py）：Wilson 等 2025 用 CryoSat-2 測高找到的南極活動冰下湖，
 * 85 個新的加 19 個重新分析的既有活動湖，每個湖一個點加範圍。
 * 使用者 2026-10-30 決定：先做 Wilson 的 104 個（CC BY 4.0）；Livingstone 2022 的完整清單（773 個）等授權確認再加。
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

export const subglacialLakes: TopicDefinition = {
  id: 'subglacial-lakes',
  title: { zh: '南極的冰下湖', en: 'Antarctic subglacial lakes' },
  shortTitle: { zh: '冰下湖', en: 'Subglacial lakes' },
  defaultIndicator: 'lakes',
  defaultYear: 2020,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Wilson 等 2025，Detection of 85 new active subglacial lakes in Antarctica from a decade of CryoSat-2 data（Nature Communications）的資料',
        en: 'Wilson et al. 2025, Detection of 85 new active subglacial lakes in Antarctica from a decade of CryoSat-2 data (Nature Communications), data',
      },
      url: 'https://doi.org/10.5281/zenodo.16330565',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '冰下湖是南極冰蓋底下、被兩三公里厚的冰壓著的液態水。「活動」的冰下湖會灌滿又排空，上面的冰面跟著升降幾公尺，衛星測高量得到；穩定的湖（例如最大的沃斯托克湖）冰面不動，要用冰層雷達找。' +
      'Wilson 等 2025 用 CryoSat-2 衛星 2010–2020 年的測高找到 85 個新的活動湖，也重新分析了 19 個已知的活動湖（Smith 等 2009、2017 的名單）；點是湖的中心，外框是用冰面升降畫出的範圍（每個湖取面積最大的一期）。湖名是所在的冰川流域加上離接地線的距離（公里）。' +
      '範圍與體積是從冰面的高度變化推算的，論文的資料註明可能高估。全世界已知的冰下湖約 773 個（Livingstone 等 2022 的清單，南極 675 個，活動的 179 個），那份清單的授權還沒確認，這裡先不畫。台灣沒有冰下湖。',
    en:
      'Subglacial lakes are liquid water beneath the Antarctic ice sheet, under two or three kilometres of ice. “Active” lakes fill and drain, raising and lowering the ice surface above by a few metres, which satellite altimetry can detect; stable lakes (such as Lake Vostok, the largest) leave the surface still and are found with ice-penetrating radar. ' +
      'Wilson et al. 2025 used CryoSat-2 altimetry from 2010–2020 to find 85 new active lakes and re-analysed 19 known active lakes (from the lists of Smith et al. 2009 and 2017). Dots mark each lake’s centre and outlines show its extent mapped from the surface movement (the largest of its periods). Lake names give the glacier basin and the distance from the grounding line in kilometres. ' +
      'Extents and volumes are inferred from surface elevation change and, as the data note, may be overestimates. Some 773 subglacial lakes are known worldwide (Livingstone et al. 2022: 675 in Antarctica, 179 of them active), but that list’s licence has not been confirmed, so it is not shown yet. Taiwan has no subglacial lakes.',
  },
  noValue: { TWN: { zh: '台灣沒有冰下湖', en: 'Taiwan has no subglacial lakes' } },
  focus: [-180, -88, 180, -62],
  overlays: [
    {
      kind: 'lines',
      id: 'outlines',
      file: 'outlines.json',
      label: { zh: '冰下湖的範圍', en: 'Lake outlines' },
      width: 1.2,
      color: { classes: KINDS.map((k) => ({ value: k.value, color: k.color, label: k.label })) },
      fill: { field: 'ring', value: 1, opacity: 0.35, darkOpacity: 0.5 },
    },
    {
      kind: 'points',
      id: 'lakes',
      file: 'lakes.json',
      label: { zh: '活動的冰下湖', en: 'Active subglacial lakes' },
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
      label: { zh: '活動的冰下湖', en: 'Active subglacial lakes' },
      description: {
        zh: '南極冰蓋底下會灌滿又排空的冰下湖：粉紅是 Wilson 等 2025 用 CryoSat-2 新找到的 85 個，紫色是重新分析的 19 個已知湖。多半在冰流快的冰川底下，例如羅斯冰棚上游的冰流、思韋茨冰川；滑到點上看每一次灌滿或排空的時間與冰面升降幾公尺。',
        en: 'Lakes beneath the Antarctic ice sheet that fill and drain: pink dots are the 85 found by Wilson et al. 2025 with CryoSat-2, purple ones the 19 known lakes they re-analysed. Most lie beneath fast-flowing glaciers, such as the ice streams feeding the Ross Ice Shelf and Thwaites Glacier; hover over a dot for each filling or draining and how far the surface moved.',
      },
      unit: '',
      file: 'lakes-count.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '冰下湖不屬於任何國家，看地圖上的點', en: 'Subglacial lakes belong to no country; see the dots on the map' },
    },
  ],
};
