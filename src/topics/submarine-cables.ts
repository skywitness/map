import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';

/**
 * 海底電纜（pipeline/topics/submarine_cables.py，資料是 TeleGeography Submarine Cable Map）。
 * 地圖上畫電纜路線（線疊加圖層，營運中實線、規劃中虛線）與登陸點（點疊加圖層，有 iso3），
 * 兩者都依 RFS（ready for service）年份跟著時間軸累積；國家的統計是每年年底的累計值。
 */

const n0 = (v: number) => fixed(v, 0);

export const cableCount = (v: number) =>
  tr({ zh: `${n0(v)} 條電纜`, en: `${n0(v)} ${Math.round(v) === 1 ? 'cable' : 'cables'}` });
export const kilometres = (v: number) => tr({ zh: `${n0(v)} 公里`, en: `${n0(v)} km` });
const placeCount = (v: number) =>
  tr({ zh: `${n0(v)} 個國家或地區`, en: `${n0(v)} ${Math.round(v) === 1 ? 'country or territory' : 'countries and territories'}` });
const landingCount = (v: number) =>
  tr({ zh: `${n0(v)} 個登陸點`, en: `${n0(v)} ${Math.round(v) === 1 ? 'landing point' : 'landing points'}` });

/**
 * 顏色（MAP_TOKENS；OKLab ΔE×100，一般／紅色盲／綠色盲）：
 * - 營運中：洋紅 categorical[7] #e7298a，跟藍色的海（#a0c8f0 等）33/32/20、淺色陸地 39/42/30、深色底圖的水 44/28/39。
 * - 規劃中：琥珀 hues.yellow #eda100（虛線），跟海 24/24/23、深色底圖 55/50/56，跟營運中的洋紅 29/30/21。
 * - 登陸點：深灰 inkSecondary 加白色外框，跟海 39/41/38、跟兩種線色都分得開；深色底圖上靠白框。
 * 比例圓是紫色 #6250d6，跟洋紅只有 27/13/23，但比例圓是半透明的大圓、電纜是細線，形狀分得開。
 */
const IN_SERVICE_COLOR = MAP_TOKENS.categorical[7];
const PLANNED_COLOR = MAP_TOKENS.hues.yellow;
const LANDING_COLOR = MAP_TOKENS.inkSecondary;
/** 線的分類代碼，跟 pipeline 的 IN_SERVICE、PLANNED 一致 */
const IN_SERVICE = 1;
const PLANNED = 2;

/** 電纜的 tooltip：名稱，第二行啟用年份與長度，第三行擁有者（原文，tooltip 只帶前 4 家） */
function cableTooltip(p: PointRecord) {
  const rfs = typeof p.rfs === 'number' ? p.rfs : null;
  const parts = [
    p.plan
      ? rfs
        ? tr({ zh: `規劃中，預計 ${rfs} 年啟用`, en: `Planned, expected ${rfs}` })
        : tr({ zh: '規劃中，啟用年份未定', en: 'Planned, date to be determined' })
      : rfs
        ? tr({ zh: `${rfs} 年啟用`, en: `In service since ${rfs}` })
        : tr({ zh: '營運中（啟用年份不明）', en: 'In service (year unknown)' }),
  ];
  if (typeof p.len === 'number') parts.push(kilometres(p.len));
  const total = typeof p.nown === 'number' ? p.nown : 0;
  const shown = typeof p.own === 'string' ? p.own : '';
  const more = total > 4 ? tr({ zh: ` 等 ${total} 家`, en: ` and ${total - 4} more` }) : '';
  return {
    title: typeof p.name === 'string' ? p.name : tr({ zh: '海底電纜', en: 'Submarine cable' }),
    detail: parts.join(' · '),
    properNoun: shown ? `${tr({ zh: '擁有者：', en: 'Owners: ' })}${shown}${more}` : undefined,
  };
}

/** 登陸點的 tooltip：國家與電纜數，地名（TeleGeography 的英文原名）放在不翻譯的那一行 */
function landingTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const n = typeof p.n === 'number' ? p.n : 0;
  const planned = typeof p.np === 'number' ? p.np : 0;
  const parts: string[] = [];
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  parts.push(
    planned
      ? tr({ zh: `${cableCount(n)}（${n0(planned)} 條規劃中）`, en: `${cableCount(n)} (${n0(planned)} planned)` })
      : cableCount(n),
  );
  if (p.tbd) parts.push(tr({ zh: '確切位置未定', en: 'exact site to be determined' }));
  return {
    title: tr({ zh: '海底電纜登陸點', en: 'Cable landing point' }),
    detail: parts.join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

const COUNTED = {
  zh: '有登陸點在這個國家的不同電纜數（每年年底累計；明年起加上規劃中的電纜，是推估）',
  en: 'Distinct cables with a landing point in the country (cumulative at year end; from next year on, planned cables are included as projections)',
};

/** 時間軸：今年以前是已啟用的電纜（實際數字，不標「估計值」），明年起加上規劃中的電纜 */
const PLANNED_YEARS: IndicatorDef['projectionLabel'] = {
  tag: { zh: '含規劃中', en: 'Incl. planned' },
  from: (year) => tr({ zh: `${year} 起含規劃中`, en: `Planned from ${year}` }),
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '海底電纜地圖', en: 'Cable map' },
    description: {
      zh: '全球約 700 條營運中與規劃中的海底電纜（TeleGeography 的資料）：洋紅色實線是營運中、琥珀色虛線是規劃中，點是登陸點。拖動時間軸看電纜依啟用年份一條條鋪設，拖到明年以後會加上規劃中的電纜；滑鼠移到電纜上看名稱、啟用年份與擁有者，移到國家上看登陸的電纜數。',
      en: 'Some 700 submarine cables in service or planned, from TeleGeography: solid magenta lines are in service, dashed amber lines are planned, and dots are landing points. Drag the time slider to watch cables appear by ready-for-service year; years after this one add planned cables. Hover over a cable for its name, year and owners, or over a country for the number of cables landing there.',
    },
    unit: { zh: '條', en: 'cables' },
    file: 'cables.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    projectionLabel: PLANNED_YEARS,
    format: (v) => tr({ zh: `${cableCount(v)}登陸`, en: `${cableCount(v)} landing` }),
    formatTick: n0,
  },
  {
    id: 'cables',
    label: { zh: '登陸的電纜數', en: 'Cables landing' },
    description: {
      zh: `${COUNTED.zh}。一條電纜在同一國有好幾個登陸點也只算一條；國內電纜（例如島嶼之間）也算。`,
      en: `${COUNTED.en}. A cable with several landing points in one country counts once; domestic cables (between islands, for example) count too.`,
    },
    unit: { zh: '條', en: 'cables' },
    file: 'cables.json',
    layer: { kind: 'bubble', legendValues: [10, 40, 100] },
    overlayTime: 'cumulative',
    projectionLabel: PLANNED_YEARS,
    format: cableCount,
    formatTick: n0,
  },
  {
    id: 'partners',
    label: { zh: '國際連線數', en: 'Countries linked' },
    description: {
      zh: '經由海底電纜直接連到的其他國家或地區數：同一條電纜登陸的其他國家都算（TeleGeography 沒有分段的資料，主幹與支線分不開）。每年年底累計，明年起加上規劃中的電纜；沒有電纜登陸的國家（包括內陸國）是 0。',
      en: 'Number of other countries and territories directly linked by submarine cable: every other country a cable lands in counts (TeleGeography does not split cables into segments, so trunks and branches are not distinguished). Cumulative at year end; from next year on, planned cables are included. Countries with no cable landing (including landlocked ones) show 0.',
    },
    unit: { zh: '國', en: 'countries' },
    file: 'partners.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 30, 45] } },
    overlayTime: 'cumulative',
    projectionLabel: PLANNED_YEARS,
    format: placeCount,
    formatTick: n0,
  },
  {
    id: 'landings',
    label: { zh: '登陸點數', en: 'Landing points' },
    description: {
      zh: '有海底電纜登陸的地點數（登陸站所在的城鎮；同一個地點有好幾條電纜也只算一個），每年年底累計，明年起加上規劃中的電纜。',
      en: 'Number of places where submarine cables come ashore (the town of the landing station; several cables at one place count once). Cumulative at year end; from next year on, planned cables are included.',
    },
    unit: { zh: '處', en: 'landing points' },
    file: 'landings.json',
    layer: { kind: 'bubble', legendValues: [10, 50, 150] },
    overlayTime: 'cumulative',
    projectionLabel: PLANNED_YEARS,
    format: landingCount,
    formatTick: n0,
  },
];

export const submarineCables: TopicDefinition = {
  id: 'submarine-cables',
  title: { zh: '海底電纜', en: 'Submarine cables' },
  shortTitle: { zh: '海底電纜', en: 'Cables' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'TeleGeography：Submarine Cable Map', en: 'TeleGeography, Submarine Cable Map' },
      url: 'https://www.submarinecablemap.com/',
      license: 'CC BY-NC-SA 3.0',
    },
  ],
  // 頁尾要短：英文版太長會把地圖擠扁（細節寫在指標說明、側欄與 DESIGN.md）
  note: {
    zh: 'TeleGeography 只收營運中與規劃中的電纜，已經退役的（例如 1988 年第一條跨大西洋光纖電纜 TAT-8）不在裡面，所以早年的數字偏少。年份是 RFS（開始營運）年份，明年起加上規劃中的電纜，是推估。國內的離島電纜大多沒有收，台灣的見附註。TeleGeography 的資料是 CC BY-NC-SA 3.0 授權（姓名標示—非商業性—相同方式分享），這個主題的衍生資料檔、匯出的地圖圖片與 CSV 也依 CC BY-NC-SA 3.0 分享。',
    en: 'TeleGeography lists only cables in service or planned; retired ones (such as TAT-8, the first transatlantic fibre-optic cable, 1988) are missing, so early years are undercounted. Years are ready-for-service years; from next year on, planned cables are added as projections. Most domestic island cables are not listed; see the note for Taiwan. TeleGeography data are licensed under CC BY-NC-SA 3.0 (attribution, non-commercial, share-alike), and the derived data files, map images and CSV files of this topic are shared under CC BY-NC-SA 3.0 too.',
  },
  panelExtra: () => import('./panels/SubmarineCablesPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'cables',
      file: 'cables-lines.json',
      label: { zh: '海底電纜', en: 'Submarine cables' },
      width: 1.1,
      timeField: 'year',
      color: {
        title: { zh: '狀態', en: 'Status' },
        classes: [
          { value: IN_SERVICE, color: IN_SERVICE_COLOR, label: { zh: '營運中', en: 'In service' } },
          { value: PLANNED, color: PLANNED_COLOR, dash: true, label: { zh: '規劃中（尚未啟用）', en: 'Planned (not yet in service)' } },
        ],
      },
      tooltip: cableTooltip,
    },
    {
      kind: 'points',
      id: 'landings',
      file: 'landing-points.json',
      label: { zh: '登陸點', en: 'Landing points' },
      radius: 2.2,
      color: LANDING_COLOR,
      timeField: 'year',
      tooltip: landingTooltip,
    },
  ],
  indicators,
};
