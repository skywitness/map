import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, DimensionDef, PointRecord, PointsOverlayDef } from './types';

/**
 * 港口的設施（2026-11-08，製作手冊第二十七批 580 補做，候選 1301；pipeline/topics/port_facilities.py）：
 * NGA World Port Index 的設施欄位：乾塢、修船能力、吊重；點的說明另寫修船滑道、起重機、水深與鐵路。
 * 國家指標是「WPI 標了有這項設施的港口數」，WPI 大部分欄位是「不明」，各國填寫的完整度差很多。
 */

const SEQ = MAP_TOKENS.sequential;
const UNKNOWN_COLOR = MAP_TOKENS.context;

const SIZE4: Record<number, Text> = {
  0: { zh: '不明', en: 'unknown' },
  1: { zh: '沒有', en: 'none' },
  2: { zh: '小型', en: 'small' },
  3: { zh: '中型', en: 'medium' },
  4: { zh: '大型', en: 'large' },
};
const REPAIRS: Record<number, Text> = {
  0: { zh: '不明', en: 'unknown' },
  1: { zh: '沒有', en: 'none' },
  2: { zh: '只能緊急修理', en: 'emergency only' },
  3: { zh: '小修', en: 'limited' },
  4: { zh: '中修', en: 'moderate' },
  5: { zh: '大修', en: 'major' },
};
const LIFTS: Record<number, Text> = {
  0: { zh: '沒有記錄', en: 'not recorded' },
  1: { zh: '24 噸以下', en: 'up to 24 t' },
  2: { zh: '25–49 噸', en: '25–49 t' },
  3: { zh: '50–100 噸', en: '50–100 t' },
  4: { zh: '100 噸以上', en: '100 t or more' },
};
const CRANES: [number, Text][] = [
  [1, { zh: '固定式', en: 'fixed' }],
  [2, { zh: '移動式', en: 'mobile' }],
  [4, { zh: '浮吊', en: 'floating' }],
  [8, { zh: '貨櫃起重機', en: 'container' }],
];

const ITEMS: DimensionDef = {
  label: { zh: '設施', en: 'Facility' },
  options: [
    { id: 'drydock', label: { zh: '有乾塢', en: 'With a dry dock' } },
    { id: 'repairs', label: { zh: '能大修船', en: 'With major ship repairs' } },
    { id: 'lift100', label: { zh: '吊得起 100 噸以上', en: 'With 100+ tonne lifts' } },
  ],
  defaultOption: 'drydock',
};

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : 0);
const label = (table: Record<number, Text>, v: number) => tr(table[v] ?? table[0]);

function portName(p: PointRecord): { title: string; proper?: string } {
  const own = getLang() === 'zh' ? p.zh : p.en;
  const title = typeof own === 'string' && own ? own : String(p.name ?? '');
  return { title, proper: title !== p.name ? String(p.name) : undefined };
}

function facts(p: PointRecord): string[] {
  const out = [
    tr({ zh: `乾塢：${label(SIZE4, num(p, 'dd'))}`, en: `Dry dock: ${label(SIZE4, num(p, 'dd'))}` }),
    tr({ zh: `修船能力：${label(REPAIRS, num(p, 'rp'))}`, en: `Repairs: ${label(REPAIRS, num(p, 'rp'))}` }),
    tr({ zh: `修船滑道：${label(SIZE4, num(p, 'mr'))}`, en: `Marine railway: ${label(SIZE4, num(p, 'mr'))}` }),
    tr({ zh: `最大吊重：${label(LIFTS, num(p, 'lf'))}`, en: `Largest lift: ${label(LIFTS, num(p, 'lf'))}` }),
  ];
  const cranes = CRANES.filter(([bit]) => num(p, 'cr') & bit).map(([, t]) => tr(t));
  if (cranes.length) out.push(tr({ zh: `起重機：${cranes.join('、')}`, en: `Cranes: ${cranes.join(', ')}` }));
  const depths = [
    typeof p.cd === 'number' ? tr({ zh: `航道 ${fixed(p.cd, 1)} 公尺`, en: `channel ${fixed(p.cd, 1)} m` }) : '',
    typeof p.pd === 'number' ? tr({ zh: `貨運碼頭 ${fixed(p.pd, 1)} 公尺`, en: `cargo pier ${fixed(p.pd, 1)} m` }) : '',
  ].filter(Boolean);
  if (depths.length) out.push(tr({ zh: `水深：${depths.join('、')}`, en: `Depth: ${depths.join(', ')}` }));
  if (p.rl === 1 || p.rl === 2) out.push(tr(p.rl === 1 ? { zh: '有鐵路接進港', en: 'Rail connection' } : { zh: '沒有鐵路接進港', en: 'No rail connection' }));
  return out;
}

function overlay(item: string, field: string, color: ColorClasses): PointsOverlayDef {
  return {
    kind: 'points',
    id: `port-facilities-${item}`,
    file: 'port-facilities.json',
    label: { zh: '港口的設施（World Port Index）', en: 'Port facilities (World Port Index)' },
    indicators: ['port-facilities'],
    items: [item],
    radius: { field: 'size', stops: [[0, 1.6], [1, 1.6], [2, 2.3], [3, 3.2], [4, 4.6]] },
    color,
    // 有這項設施（數字大）的畫在上面
    sortField: field,
    tooltip: (p, { countryName }) => {
      const { title, proper } = portName(p);
      return { title, detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined, extra: facts(p), properNoun: proper };
    },
  };
}

const DRYDOCK_COLORS: ColorClasses = {
  field: 'dd',
  title: { zh: '乾塢', en: 'Dry dock' },
  thresholds: [0.5, 1.5, 2.5, 3.5],
  classes: [
    { color: UNKNOWN_COLOR, label: SIZE4[0] },
    { color: SEQ[0], label: SIZE4[1] },
    { color: SEQ[2], label: SIZE4[2] },
    { color: SEQ[4], label: SIZE4[3] },
    { color: SEQ[6], label: SIZE4[4] },
  ],
};
const REPAIR_COLORS: ColorClasses = {
  field: 'rp',
  title: { zh: '修船能力', en: 'Repairs' },
  thresholds: [0.5, 1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: UNKNOWN_COLOR, label: REPAIRS[0] },
    { color: SEQ[0], label: REPAIRS[1] },
    { color: SEQ[1], label: REPAIRS[2] },
    { color: SEQ[3], label: REPAIRS[3] },
    { color: SEQ[4], label: REPAIRS[4] },
    { color: SEQ[6], label: REPAIRS[5] },
  ],
};
const LIFT_COLORS: ColorClasses = {
  field: 'lf',
  title: { zh: '最大吊重', en: 'Largest lift' },
  thresholds: [0.5, 1.5, 2.5, 3.5],
  classes: [
    { color: UNKNOWN_COLOR, label: LIFTS[0] },
    { color: SEQ[1], label: LIFTS[1] },
    { color: SEQ[2], label: LIFTS[2] },
    { color: SEQ[4], label: LIFTS[3] },
    { color: SEQ[6], label: LIFTS[4] },
  ],
};

export const portFacilitiesPart: TopicPart = {
  name: { zh: '港口的設施', en: 'Port facilities' },
  sources: [
    {
      name: { zh: 'NGA World Port Index（Pub. 150）的設施欄位', en: 'NGA World Port Index (Pub. 150), facility fields' },
      url: 'https://msi.nga.mil/Publications/WPI',
      license: { zh: '公有領域（No copyright claimed under Title 17 U.S.C.）', en: 'public domain (No copyright claimed under Title 17 U.S.C.)' },
    },
  ],
  note: {
    zh: 'World Port Index 的設施欄位多半是「不明」（例如乾塢 3,806 個港口裡 2,969 個不明），各國填寫的完整度差很多，美國的港口填得最完整；國家的數字是標了有這項設施的港口數，不是全部的設施。',
    en: 'Most World Port Index facility fields are “unknown” (dry docks are unknown for 2,969 of 3,806 ports) and completeness varies widely by country, with US ports the most complete; country figures count the ports recorded as having the facility, not all facilities.',
  },
  overlays: [overlay('drydock', 'dd', DRYDOCK_COLORS), overlay('repairs', 'rp', REPAIR_COLORS), overlay('lift100', 'lf', LIFT_COLORS)],
  indicators: [
    {
      id: 'port-facilities',
      // 卡片與圖例的標題是子項目接指標名稱：「有乾塢的港口數」
      label: { zh: '的港口數', en: 'ports' },
      description: {
        zh: 'NGA World Port Index 的 3,806 個港口裡，標了有這項設施的港口數（比例圓；地圖上每個港口依這項設施上色，滑過看乾塢、修船、修船滑道、吊重、起重機、水深與有沒有鐵路接進港）。有乾塢的 761 個港：美國 85、日本 60、英國 50、加拿大 33、法國 30；能大修船的 293 個：美國 66、英國與日本各 21；吊得起 100 噸以上的 424 個：美國 73、日本 29。台灣 8 個港裡 6 個有乾塢、基隆能大修、2 個吊得起 100 噸以上。WPI 的設施欄位多半是「不明」（乾塢 2,969 個不明、修船 1,039 個不明），各國填寫的完整度差很多，美國的港口填得最完整，所以這是 WPI 記錄到的設施，不是各國實際有多少。滑過國家看這國在 WPI 有幾個港、幾個不明。',
        en: 'Of the 3,806 ports in the NGA World Port Index, the number recorded as having this facility (proportional circles; each port is coloured by the facility; hover for dry dock, repairs, marine railway, lifts, cranes, depth and rail connection). 761 ports have a dry dock: the US 85, Japan 60, the UK 50, Canada 33, France 30; 293 can do major repairs: the US 66, the UK and Japan 21 each; 424 have lifts of 100 tonnes or more: the US 73, Japan 29. Of Taiwan’s 8 ports, 6 have a dry dock, Keelung can do major repairs and 2 have 100-tonne lifts. Most WPI facility fields are “unknown” (2,969 for dry docks, 1,039 for repairs) and completeness varies widely, with US ports the most complete, so this shows what WPI records rather than what each country actually has. Hover over a country for its number of WPI ports and how many are unknown.',
      },
      unit: { zh: '港', en: 'ports' },
      file: 'port-facilities/{item}.json',
      dimension: ITEMS,
      layer: { kind: 'bubble', legendValues: [5, 20, 80] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個港`, en: `${fixed(v, 0)} ${v === 1 ? 'port' : 'ports'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
  ],
};
