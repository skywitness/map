import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 纜車與索道（pipeline/topics/cable_cars.py）：Wikidata 的空中纜車、吊廂纜車與登山纜索鐵道的點，依開通年份累積出現，
 * 停用的畫到那一年為止。使用者 2026-10-29 決定：不畫滑雪場的吊椅。
 */

export const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '往復式空中纜車', en: 'Aerial tramway' } },
  { value: 2, label: { zh: '吊廂纜車', en: 'Gondola lift' } },
  { value: 3, label: { zh: '纜索鐵道', en: 'Funicular' } },
];
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [2, 3],
  classes: [
    { color: MAP_TOKENS.categorical[1], label: KINDS[0].label },
    { color: MAP_TOKENS.categorical[0], label: KINDS[1].label },
    { color: MAP_TOKENS.categorical[2], label: KINDS[2].label },
  ],
};

export const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

export function lineName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

/** 開通、停用年份與長度 */
export function lineFacts(p: PointRecord): string {
  const parts: string[] = [];
  parts.push(typeof p.y === 'number' ? tr({ zh: `${p.y} 年開通`, en: `opened ${p.y}` }) : tr({ zh: '開通年份不詳', en: 'year unknown' }));
  if (typeof p.e === 'number') parts.push(tr({ zh: `${p.e} 年停用`, en: `closed ${p.e}` }));
  if (typeof p.l === 'number') parts.push(p.l >= 1000 ? `${fixed(p.l / 1000, 1)} km` : `${fixed(p.l, 0)} m`);
  return parts.join(' · ');
}

function layer(id: string, file: string, label: Text, dated: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    // 年份不詳的不隨時間軸出現，預設關閉（跟國家公園一樣）
    hidden: !dated,
    radius: { field: 'sl', stops: [[0, 2.4], [5, 3], [15, 4], [40, 5.5]] },
    color: KIND_COLORS,
    sortField: 'sl',
    ...(dated ? { timeField: 'y', endField: 'e' } : {}),
    tooltip: (p, ctx) => {
      const name = lineName(p);
      return {
        title: name,
        detail: [kindLabel(p.k), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
        extra: [lineFacts(p)],
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

export const cableCars: TopicDefinition = {
  id: 'cable-cars',
  title: { zh: '纜車與索道', en: 'Cable cars and funiculars' },
  shortTitle: { zh: '纜車', en: 'Cable cars' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Wikidata（纜車的種類、位置、開通與停用年份、長度、名稱）', en: 'Wikidata (types, locations, opening and closing years, lengths, names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標的往復式空中纜車、吊廂纜車（含單線、雙線、三線式與都市的纜車路線）與纜索鐵道；滑雪場的吊椅、滑索、貨運索道不算。開通年份依序用正式啟用日期、啟用日期、成立時間，停用的畫到那一年為止；沒有年份的放在「開通年份不詳」的圖層（約 390 條，預設關閉）。' +
      'Wikidata 只收比較有名的，各國的數量不能直接比（例如阿爾卑斯山區收得多）。國家依座標判斷。台灣有貓空纜車（Wikidata 寫成立 2006 年，改成通車的 2007 年）與烏來空中纜車；日月潭纜車在 Wikidata 沒有座標，沒有畫。',
    en:
      'Dots are aerial tramways, gondola lifts (mono-, bi- and tricable lifts and urban cable car lines) and funiculars in Wikidata with coordinates; ski chairlifts, zip lines and material ropeways are left out. The opening year comes from the official opening date, service entry or inception, in that order, and closed lines are drawn up to their closing year; lines without a year are in the “year unknown” layer (about 390, off by default). ' +
      'Wikidata covers mainly well-known lines, so counts are not comparable between countries (the Alps are well covered). Countries are assigned by location. Taiwan has the Maokong Gondola (Wikidata gives 2006 as its inception; the 2007 opening is used) and the Wulai Aerial Tramway; the Sun Moon Lake Ropeway has no coordinates in Wikidata and is not shown.',
  },
  panelExtra: () => import('./panels/CableCarsPanel'),
  overlays: [
    layer('lines', 'lines.json', { zh: '纜車與纜索鐵道（依開通年份）', en: 'Cable cars and funiculars (by opening year)' }, true),
    layer('lines-undated', 'lines-undated.json', { zh: '開通年份不詳（預設關閉）', en: 'Year unknown (off by default)' }, false),
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '纜車地圖', en: 'Cable car map' },
      description: {
        zh: '空中纜車、吊廂纜車與登山的纜索鐵道，依開通的年份一條一條出現：19 世紀從美國匹茲堡、布達佩斯的纜索鐵道開始，20 世紀阿爾卑斯山區的空中纜車，21 世紀拉丁美洲、亞洲的都市纜車。拖動時間軸或按播放；滑過看開通年份與長度，點國家列出它的纜車。',
        en: 'Aerial tramways, gondola lifts and mountain funiculars, appearing in the year each opened: funiculars in Pittsburgh and Budapest in the 19th century, aerial tramways across the Alps in the 20th, and urban cable cars in Latin America and Asia in the 21st. Drag the timeline or press play; hover for the opening year and length, and select a country for its list.',
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
  ],
};
