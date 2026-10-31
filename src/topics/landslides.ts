import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 地震與火山的擴充：山崩事件（2026-10-31，製作手冊第十四批 259；pipeline/topics/landslides.py）。
 * NASA 全球山崩目錄（GLC）2007–2025 年的 1.1 萬筆，點跟著時間軸，依成因分組上色、大小依死亡人數；
 * 國家依座標判斷（GLC 的 country_name 不可靠）。左側欄依死亡人數排（第〇節的左側欄規則）。
 */

/** 類別（pipeline 的 CATEGORIES 順序） */
const CATEGORIES: Text[] = [
  { zh: '山崩', en: 'Landslide' },
  { zh: '泥流', en: 'Mudslide' },
  { zh: '土石流', en: 'Debris flow' },
  { zh: '落石', en: 'Rock fall' },
  { zh: '複合型', en: 'Complex' },
  { zh: '河岸崩塌', en: 'Riverbank collapse' },
  { zh: '平移滑動', en: 'Translational slide' },
  { zh: '火山泥流', en: 'Lahar' },
  { zh: '雪崩', en: 'Snow avalanche' },
  { zh: '土流', en: 'Earth flow' },
  { zh: '潛移', en: 'Creep' },
  { zh: '傾倒', en: 'Topple' },
  { zh: '其他', en: 'Other' },
  { zh: '類型不明', en: 'Type unknown' },
];
/** 成因（pipeline 的 TRIGGERS 順序） */
const TRIGGERS: Text[] = [
  { zh: '豪雨', en: 'Downpour' },
  { zh: '降雨', en: 'Rain' },
  { zh: '連續降雨', en: 'Continuous rain' },
  { zh: '颱風', en: 'Tropical cyclone' },
  { zh: '季風', en: 'Monsoon' },
  { zh: '融雪', en: 'Snowfall or snowmelt' },
  { zh: '地震', en: 'Earthquake' },
  { zh: '工程', en: 'Construction' },
  { zh: '採礦', en: 'Mining' },
  { zh: '淹水', en: 'Flooding' },
  { zh: '凍融', en: 'Freeze–thaw' },
  { zh: '壩或堤防潰決', en: 'Dam or embankment collapse' },
  { zh: '火山', en: 'Volcano' },
  { zh: '管線漏水', en: 'Leaking pipe' },
  { zh: '沒有明顯成因', en: 'No apparent trigger' },
  { zh: '其他', en: 'Other' },
  { zh: '成因不明', en: 'Trigger unknown' },
];
const SIZES: Text[] = [
  { zh: '小', en: 'small' },
  { zh: '中', en: 'medium' },
  { zh: '大', en: 'large' },
  { zh: '很大', en: 'very large' },
  { zh: '災難級', en: 'catastrophic' },
  { zh: '規模不明', en: 'size unknown' },
];
const label = (list: Text[], v: unknown) => (typeof v === 'number' && list[v] ? tr(list[v]) : '');

/** 成因分組（pipeline 的 TRIGGER_GROUPS，點的 g） */
const GROUP_COLORS: ColorClasses = {
  field: 'g',
  title: { zh: '成因', en: 'Trigger' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: MAP_TOKENS.categorical[0], label: { zh: '降雨（豪雨、季風、淹水）', en: 'Rain (downpours, monsoon, flooding)' } },
    { color: MAP_TOKENS.categorical[1], label: { zh: '颱風', en: 'Tropical cyclone' } },
    { color: MAP_TOKENS.categorical[5], label: { zh: '地震與火山', en: 'Earthquake or volcano' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '人為（工程、採礦、潰壩）', en: 'Human (construction, mining, dam failure)' } },
    { color: MAP_TOKENS.context, label: { zh: '其他與不明', en: 'Other or unknown' } },
  ],
};

const deathsText = (v: number) => tr({ zh: `${fixed(v, 0)} 人死亡`, en: `${fixed(v, 0)} ${v === 1 ? 'death' : 'deaths'}` });

function dateText(p: PointRecord): string {
  const md = typeof p.md === 'number' ? p.md : 0;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${p.y}-${pad(Math.floor(md / 100))}-${pad(md % 100)}`;
}

function facts(p: PointRecord): string[] {
  const kind = [label(CATEGORIES, p.c), tr({ zh: `成因：${label(TRIGGERS, p.tr)}`, en: `trigger: ${label(TRIGGERS, p.tr).toLowerCase()}` })];
  const toll = [
    typeof p.d === 'number' && p.d > 0 ? deathsText(p.d) : null,
    typeof p.i === 'number' && p.i > 0 ? tr({ zh: `${fixed(p.i, 0)} 人受傷`, en: `${fixed(p.i, 0)} injured` }) : null,
  ].filter(Boolean);
  return [kind.join(' · '), [tr({ zh: `規模${label(SIZES, p.s)}`, en: label(SIZES, p.s) }), ...toll].join(' · ')];
}

const LANDSLIDES: PointsOverlayDef = {
  kind: 'points',
  id: 'landslides',
  file: 'landslides.json',
  label: { zh: '山崩事件（NASA 全球山崩目錄）', en: 'Landslides (NASA Global Landslide Catalog)' },
  indicators: ['landslides'],
  radius: { field: 'd', stops: [[0, 2], [1, 3], [10, 5], [100, 8], [1000, 12]] },
  color: GROUP_COLORS,
  sortField: 'd',
  timeField: 'y',
  sizeLegend: { title: { zh: '死亡人數', en: 'Deaths' }, values: [1, 10, 100, 1000], format: (v) => fixed(v, 0) },
  tooltip: (p, ctx) => ({
    title: `${label(CATEGORIES, p.c)} · ${dateText(p)}`,
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, ...facts(p).slice(0, 1)].filter(Boolean).join(' · '),
    extra: facts(p).slice(1),
    properNoun: typeof p.pl === 'string' ? p.pl : undefined,
  }),
};

/** 左側欄（第十二批的通用元件）：那一年的山崩依死亡人數排（同樣的依受傷人數、日期），前 100 筆 */
const TOP = 100;
const LIST: ListPanelDef = {
  label: { zh: '這一年死傷最多的山崩', en: 'Deadliest landslides this year' },
  indicators: ['landslides'],
  file: 'landslides.json',
  countryField: 'iso3',
  empty: { zh: '這一年沒有收錄的山崩', en: 'No landslides recorded this year' },
  rows: (points, { countryName, year }) =>
    points
      .filter((p) => p.y === year)
      .sort((a, b) => Number(b.d ?? 0) - Number(a.d ?? 0) || Number(b.i ?? 0) - Number(a.i ?? 0) || Number(a.md) - Number(b.md))
      .slice(0, TOP)
      .map((p, i): ListRow => {
        const country = typeof p.iso3 === 'string' ? countryName(p.iso3) : null;
        return {
          key: `${p.md}-${p.lon}-${p.lat}-${i}`,
          title: [typeof p.d === 'number' && p.d > 0 ? deathsText(p.d) : label(CATEGORIES, p.c), country].filter(Boolean).join(' · '),
          properNoun: typeof p.pl === 'string' ? p.pl : undefined,
          lines: [dateText(p), ...facts(p)],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

export const landslidesPart: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: {
        zh: 'NASA Goddard 太空飛行中心：全球山崩目錄（Global Landslide Catalog，COOLR；Kirschbaum 等 2010、2015）',
        en: 'NASA Goddard Space Flight Center, Global Landslide Catalog (COOLR; Kirschbaum et al. 2010, 2015)',
      },
      url: 'https://landslides.nasa.gov/',
      license: { zh: 'NASA Landslide Catalog 使用、重製與散布許可', en: 'NASA Landslide Catalog Permission to Use, Reproduce, and Distribute' },
    },
  ],
  overlays: [LANDSLIDES],
  indicators: [
    {
      id: 'landslides',
      label: { zh: '山崩事件', en: 'Landslides' },
      description: {
        zh: 'NASA 全球山崩目錄（GLC）2007–2025 年從新聞、災害資料庫與研究報告整理的山崩、土石流與落石，以降雨引發的為主：點的顏色是成因、大小是死亡人數，國家的值是那一年發生在國內的件數。美國、印度、菲律賓、尼泊爾最多（英語新聞多的國家收得比較完整）；台灣 73 件。左邊的清單依死亡人數列出那一年最嚴重的。',
        en: 'Landslides, debris flows and rock falls in NASA’s Global Landslide Catalog (GLC), compiled for 2007–2025 from news reports, disaster databases and research, mostly triggered by rain: dot colour is the trigger and size the number of deaths; a country’s value is the number in the selected year. The US, India, the Philippines and Nepal have the most (countries with more English-language news are covered more completely); Taiwan has 73. The list on the left ranks the year’s deadliest.',
      },
      unit: { zh: '件', en: 'landslides' },
      file: 'landslides-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 10, 30, 100, 300] } },
      overlayTime: 'year',
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${v === 1 ? 'landslide' : 'landslides'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
  listPanel: LIST,
};
