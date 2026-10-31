import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { metroExtra } from './rail-extra';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 地鐵與城市軌道（2026-10-30，製作手冊第十一批 186：從「交通」拆出來）：Wikidata 的地鐵站依開通年份累積出現
 * （pipeline/topics/metro.py）。資料沒有搬，還在 public/data/topics/transport/（dataTopic）。
 */
export const METRO_FIRST_YEAR = 1863;
const stationsText = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 個車站`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'station' : 'stations'}` });

/** 開通年份的分段（pipeline 的 ERAS 與 ERA_UNKNOWN，欄位 e）：深紫、洋紅、琥珀、青綠，開通日期不明是灰色 */
const ERA_COLORS: ColorClasses = {
  field: 'e',
  title: { zh: '開通年份', en: 'Opened' },
  thresholds: [1, 2, 3, 4],
  classes: [
    { color: MAP_TOKENS.categorical[6], label: { zh: '1950 年以前', en: 'Before 1950' } },
    { color: MAP_TOKENS.categorical[7], label: { zh: '1950–1999 年', en: '1950–1999' } },
    { color: MAP_TOKENS.hues.yellow, label: { zh: '2000–2019 年', en: '2000–2019' } },
    { color: MAP_TOKENS.categorical[0], label: { zh: '2020 年以後', en: '2020 or later' } },
    { color: MAP_TOKENS.noData, label: { zh: '開通日期不明', en: 'Opening date unknown' } },
  ],
};
const ERA_UNKNOWN = 4;

export function stationName(p: PointRecord, lang = getLang()): string {
  return lang === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.name ?? '');
}

function stationTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const parts = [
    p.e === ERA_UNKNOWN
      ? tr({ zh: '開通日期不明', en: 'Opening date unknown' })
      : tr({ zh: `${p.y} 年開通`, en: `Opened ${p.y}` }),
  ];
  const system = getLang() === 'zh' && typeof p.sysZh === 'string' ? p.sysZh : typeof p.sys === 'string' ? p.sys : null;
  if (system) parts.push(system);
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  const zh = getLang() === 'zh' && typeof p.zh === 'string';
  return {
    title: stationName(p),
    detail: parts.join(' · '),
    extra: typeof p.d === 'number' ? [tr({ zh: `${p.d} 年停止營運`, en: `Closed ${p.d}` })] : undefined,
    properNoun: zh ? String(p.name ?? '') : undefined,
  };
}

export const metro: TopicDefinition = {
  id: 'metro',
  dataTopic: 'transport',
  title: { zh: '地鐵與城市軌道', en: 'Metro and urban rail' },
  shortTitle: { zh: '地鐵與城市軌道', en: 'Urban rail' },
  defaultIndicator: 'metro-stations',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（地鐵站、地鐵路網與開通日期）', en: 'Wikidata (metro stations, metro systems and opening dates)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    ...metroExtra.sources,
  ],
  listPanel: metroExtra.listPanel,
  note: {
    zh:
      '地鐵站取自 Wikidata：只收地鐵（Wikidata 標成地鐵站、或所屬路網是地鐵的車站），不收輕軌、電車、單軌、機場的旅客捷運與通勤鐵路；興建中、規劃中的不算。' +
      '開通年份用啟用日期，沒有的話用成立時間，但不早於所屬路網的通車年份（跟火車站同一個項目的車站寫的是火車站的年份；紐約 1868 年起的高架鐵路因此從紐約地鐵的 1904 年算起）。' +
      '開通日期不明的站畫在最後一年、標成灰色；每條路線各一個項目的轉乘站依名稱與距離（500 m 內）合併成一個站。Wikidata 的收錄各國不一，站數只是大概。' +
      '鐵路見「鐵路」主題，高鐵見「高鐵」主題。',
    en:
      'Metro stations come from Wikidata: metro only (stations classed as metro stations or belonging to a metro system), not light rail, trams, monorails, airport people movers or commuter rail; stations under construction or planned are excluded. ' +
      'Opening years are Wikidata’s opening dates, or inception where there is none, but never earlier than the opening of the station’s metro system (items shared with a railway station carry the railway station’s date; New York’s elevated lines from 1868 therefore count from the subway’s 1904). ' +
      'Stations with unknown opening dates appear in the final year, in grey; interchange stations with one item per line are merged by name and distance (within 500 m). Wikidata’s coverage varies by country, so station counts are approximate. ' +
      'For railways see the Railways topic; for high-speed lines, the High-speed rail topic.',
  },
  overlays: [
    {
      kind: 'points',
      id: 'metro',
      file: 'metro.json',
      label: { zh: '地鐵站（依開通年份）', en: 'Metro stations (by opening year)' },
      radius: 1.8,
      color: ERA_COLORS,
      timeField: 'y',
      endField: 'd',
      indicators: ['metro-stations'],
      tooltip: stationTooltip,
    },
    ...metroExtra.overlays,
  ],
  panelExtra: () => import('./panels/MetroPanel'),
  indicators: [
    {
      id: 'metro-stations',
      label: { zh: '地鐵站數', en: 'Metro stations' },
      description: {
        zh: '這一年營運中的地鐵站（Wikidata；轉乘站算一個）。拖動時間軸，從 1863 年倫敦的大都會鐵路看起；地圖上的點依開通年份上色，開通日期不明的灰色點只在最後一年出現。',
        en: 'Metro stations in service in the year (Wikidata; an interchange counts once). Drag the slider from London’s Metropolitan Railway in 1863; dots are coloured by opening year, and grey dots with unknown opening dates appear only in the final year.',
      },
      unit: { zh: '站', en: 'stations' },
      file: 'metro-stations.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      overlayTime: 'cumulative',
      format: stationsText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
    ...metroExtra.indicators,
  ],
};
