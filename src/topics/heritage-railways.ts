import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 觀光鐵道與登山鐵路（pipeline/topics/heritage_railways.py）：Wikidata 的保存鐵路、齒軌鐵路、登山鐵路、森林鐵路的點，
 * 依開通年份累積出現；年份不詳的另一個圖層預設關閉。
 */

/** 點的種類（pipeline 的 k：同時屬於好幾類時依齒軌 > 登山 > 森林 > 保存取一類） */
export const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '保存鐵路、觀光鐵道', en: 'Heritage railway' } },
  { value: 2, label: { zh: '齒軌鐵路', en: 'Rack railway' } },
  { value: 3, label: { zh: '登山鐵路', en: 'Mountain railway' } },
  { value: 4, label: { zh: '森林鐵路', en: 'Forest railway' } },
];
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [2, 3, 4],
  classes: [
    { color: MAP_TOKENS.categorical[1], label: KINDS[0].label },
    { color: MAP_TOKENS.categorical[5], label: KINDS[1].label },
    { color: MAP_TOKENS.categorical[2], label: KINDS[2].label },
    { color: MAP_TOKENS.categorical[3], label: KINDS[3].label },
  ],
};

/** 屬於哪幾類（pipeline 的 all：1 保存、2 齒軌、4 登山、8 森林） */
export function kindsText(p: PointRecord): string {
  const bits = typeof p.all === 'number' ? p.all : 0;
  return KINDS.filter((k) => bits & (1 << (k.value - 1)))
    .map((k) => tr(k.label))
    .join(tr({ zh: '、', en: ', ' }));
}

export function railwayName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

export const yearText = (p: PointRecord) =>
  typeof p.y === 'number' ? tr({ zh: `${p.y} 年開通`, en: `opened ${p.y}` }) : tr({ zh: '開通年份不詳', en: 'year unknown' });

function layer(id: string, file: string, label: Text, dated: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    hidden: !dated,
    radius: { field: 'sl', stops: [[0, 2.4], [5, 3], [15, 4], [40, 5.5]] },
    color: KIND_COLORS,
    sortField: 'sl',
    ...(dated ? { timeField: 'y' } : {}),
    indicators: ['map'],
    tooltip: (p, ctx) => {
      const name = railwayName(p);
      return {
        title: name,
        detail: [kindsText(p), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
        extra: [yearText(p)],
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

const lines = (v: number) => tr({ zh: `${fixed(v, 0)} 條`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'railway' : 'railways'}` });

export const heritageRailways: TopicDefinition = {
  id: 'heritage-railways',
  title: { zh: '觀光鐵道與登山鐵路', en: 'Heritage and mountain railways' },
  shortTitle: { zh: '觀光鐵道', en: 'Heritage rail' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（鐵路的種類、位置、開通年份、名稱；用 QLever 查詢）', en: 'Wikidata (types, locations, opening years and names; queried via QLever)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標的保存鐵路（含觀光鐵道、蒸汽火車保存線）、齒軌鐵路、登山鐵路與森林鐵路，含各類的子類別；纜索鐵道在「纜車與索道」主題。同一條鐵路常同時屬於好幾類，點的顏色依齒軌、登山、森林、保存的順序取一類，滑過列出全部。' +
      '年份依序用正式啟用日期、啟用日期、成立時間；保存鐵路的年份常是原本那條鐵路的通車年份，不是開始觀光營運的年份。停用日期也常是原本那條線停駛的年份（之後才改成保存鐵路），所以不依它拿掉。沒有年份的放在「開通年份不詳」的圖層（預設關閉）。' +
      'Wikidata 的 691 條裡只有 466 條有座標（森林鐵路 95 條只有 25 條），各國的數量反映 Wikidata 的收錄，英國收得特別多。台灣有阿里山林業鐵路（Wikidata 沒有年份，依林業及自然保育署寫 1912 年通車）、羅東森林鐵道與太平山森林鐵路。',
    en:
      'Dots are heritage railways (including tourist and preserved steam lines), rack railways, mountain railways and forest railways in Wikidata with coordinates, including their subclasses; funiculars are in the Cable cars topic. A railway often belongs to several types; dots take one colour in the order rack, mountain, forest, heritage, and the tooltip lists all of them. ' +
      'Years come from the official opening date, service entry or inception, in that order; for heritage railways this is often when the original line opened, not when tourist service began. Closing dates often refer to the original line before it was preserved, so they are not used to remove dots. Railways without a year are in the “year unknown” layer (off by default). ' +
      'Only 466 of Wikidata’s 691 entries have coordinates (25 of 95 forest railways), and counts reflect Wikidata’s coverage, which is especially thorough for the UK. Taiwan has the Alishan Forest Railway (no year in Wikidata; opened in 1912 according to Taiwan’s Forestry and Nature Conservation Agency), the Luodong Forest Railway and the Taiping Mountain Forest Railway.',
  },
  panelExtra: () => import('./panels/HeritageRailwaysPanel'),
  overlays: [
    layer('lines', 'lines.json', { zh: '觀光鐵道與登山鐵路（依開通年份）', en: 'Heritage and mountain railways (by opening year)' }, true),
    layer('lines-undated', 'lines-undated.json', { zh: '開通年份不詳（預設關閉）', en: 'Year unknown (off by default)' }, false),
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '觀光鐵道地圖', en: 'Railway map' },
      description: {
        zh: '保存鐵路、觀光鐵道、齒軌與登山鐵路、森林鐵路，依開通年份一條一條出現：19 世紀英國威爾斯的費斯汀尼奧格鐵路、瑞士的齒軌登山鐵路，20 世紀初台灣的阿里山林業鐵路。拖動時間軸或按播放；滑過看種類與年份，點國家列出它的鐵路。',
        en: 'Heritage and tourist railways, rack and mountain railways and forest railways, appearing in the year each opened: the Ffestiniog Railway in Wales and Swiss rack railways in the 19th century, Taiwan’s Alishan Forest Railway in the early 20th. Drag the timeline or press play; hover for the type and year, and select a country for its list.',
      },
      unit: '',
      file: 'map.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    {
      id: 'count',
      label: { zh: '各國的條數', en: 'Railways by country' },
      description: {
        zh: 'Wikidata 收錄、有座標的觀光鐵道與登山鐵路有幾條在這個國家（依座標，含年份不詳的）。英國 117 條最多，其次是美國、澳洲、德國；數量反映 Wikidata 的收錄，不是正式的統計。',
        en: 'How many heritage and mountain railways with coordinates in Wikidata lie in the country (by location, including those with unknown years). The UK leads with 117, followed by the US, Australia and Germany; counts reflect Wikidata’s coverage, not an official tally.',
      },
      unit: { zh: '條', en: 'railways' },
      file: 'count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: lines,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
    },
  ],
};
