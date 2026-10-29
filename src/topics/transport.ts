import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

const KM = { zh: '公里', en: 'km' };
const KM_PER_1000 = { zh: '公里/千平方公里', en: 'km per 1,000 km²' };
const km = (v: number) => `${fixed(v, 0)} ${tr(KM)}`;
const airports = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'airport' : 'airports'}` });

/**
 * 地鐵站與高鐵（pipeline/topics/metro.py，Wikidata）：地鐵站依開通年份累積出現（overlayTime: 'cumulative'），
 * 只在「地鐵站數」「第一條高鐵」兩個逐年的指標顯示；原本的路網、鐵路、機場指標是不分年份的快照（只有今年）。
 */
export const METRO_FIRST_YEAR = 1863;
const stationsText = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 個車站`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'station' : 'stations'}` });
const yearText = (v: number) => tr({ zh: `${Math.round(v)} 年`, en: String(Math.round(v)) });

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

export const transport: TopicDefinition = {
  id: 'transport',
  title: { zh: '各國交通', en: 'Transport by country' },
  shortTitle: { zh: '交通', en: 'Transport' },
  defaultIndicator: 'network',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Natural Earth（1:10m 鐵路）', en: 'Natural Earth (1:10m railways)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    { name: 'OurAirports', url: 'https://ourairports.com/data/', license: { zh: '公有領域', en: 'public domain' } },
    {
      name: { zh: 'Wikidata（地鐵站、地鐵路網、高速鐵路線與開通日期）', en: 'Wikidata (metro stations, metro systems, high-speed lines and opening dates)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。機場只含大型機場與有定期航班的中型機場。港口與海運見「航運與港口」主題。' +
      '地鐵站取自 Wikidata：只收地鐵（Wikidata 標成地鐵站、或所屬路網是地鐵的車站），不收輕軌、電車、單軌、機場的旅客捷運與通勤鐵路；興建中、規劃中的不算。' +
      '開通年份用啟用日期，沒有的話用成立時間，但不早於所屬路網的通車年份（跟火車站同一個項目的車站寫的是火車站的年份；紐約 1868 年起的高架鐵路因此從紐約地鐵的 1904 年算起）。' +
      '開通日期不明的站畫在最後一年、標成灰色；每條路線各一個項目的轉乘站依名稱與距離（500 m 內）合併成一個站。Wikidata 的收錄各國不一，站數只是大概。' +
      '高鐵是 Wikidata 標成高速鐵路線、有啟用日期的路線，每一國最早的一條逐一核對過。',
    en:
      'Railways come from simplified Natural Earth 1:10m map data and may miss branch lines; North America includes main lines only, so rail lengths for the US and Canada are clearly too low. Airports include only large airports and medium airports with scheduled flights. For ports and sea transport, see the Shipping and ports topic. ' +
      'Metro stations come from Wikidata: metro only (stations classed as metro stations or belonging to a metro system), not light rail, trams, monorails, airport people movers or commuter rail; stations under construction or planned are excluded. ' +
      'Opening years are Wikidata’s opening dates, or inception where there is none, but never earlier than the opening of the station’s metro system (items shared with a railway station carry the railway station’s date; New York’s elevated lines from 1868 therefore count from the subway’s 1904). ' +
      'Stations with unknown opening dates appear in the final year, in grey; interchange stations with one item per line are merged by name and distance (within 500 m). Wikidata’s coverage varies by country, so station counts are approximate. ' +
      'High-speed lines are those classed as high-speed railway lines in Wikidata with an opening date; each country’s earliest line was checked by hand.',
  },
  overlays: [
    { id: 'railways', file: 'railways.json' },
    // 地鐵的兩個指標不畫機場（橘色的點會蓋住地鐵站）
    { id: 'airports', file: 'airports.json', indicators: ['network', 'rail-length', 'rail-density', 'airports-count', 'large-airports'] },
    {
      kind: 'points',
      id: 'metro',
      file: 'metro.json',
      label: { zh: '地鐵站（依開通年份）', en: 'Metro stations (by opening year)' },
      radius: 1.8,
      color: ERA_COLORS,
      timeField: 'y',
      endField: 'd',
      indicators: ['metro-stations', 'hsr-first'],
      tooltip: stationTooltip,
    },
  ],
  panelExtra: () => import('./panels/TransportPanel'),
  indicators: [
    {
      id: 'network',
      label: { zh: '路網地圖', en: 'Network map' },
      description: {
        zh: '全球鐵路路線與機場位置，可在左下角開關圖層；滑鼠移到機場上可看名稱，移到國家上可看鐵路長度。',
        en: 'Railway lines and airports around the world; toggle the layers at the bottom left. Hover over an airport to see its name, or over a country to see its rail length.',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `鐵路 ${km(v)}`, en: `Railways: ${km(v)}` }),
    },
    {
      id: 'rail-length',
      label: { zh: '鐵路長度', en: 'Rail length' },
      description: {
        zh: '依地圖上的鐵路路線計算的總長度（近似值，複線可能重複計算、支線可能缺漏）。',
        en: 'Total length of the railway lines on the map (approximate: multi-track lines may be counted twice and branch lines may be missing).',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: km,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'rail-density',
      label: { zh: '鐵路密度', en: 'Rail density' },
      description: {
        zh: '每 1,000 平方公里國土上的鐵路長度，比總長度更能比較大小不同的國家。',
        en: 'Kilometres of railway per 1,000 km² of land, which compares countries of different sizes better than total length.',
      },
      unit: KM_PER_1000,
      file: 'rail-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 70] } },
      format: (v) => `${fixed(v, 1)} ${tr(KM_PER_1000)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'airports-count',
      label: { zh: '機場數', en: 'Airports' },
      description: {
        zh: '大型機場加上有定期航班的中型機場。',
        en: 'Large airports plus medium airports with scheduled flights.',
      },
      unit: { zh: '座', en: 'airports' },
      file: 'airports-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 500] },
      format: airports,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'large-airports',
      label: { zh: '大型機場數', en: 'Large airports' },
      description: {
        zh: 'OurAirports 分類為大型機場的數量（通常是國際機場或主要樞紐）。',
        en: 'Airports classified as large by OurAirports (usually international airports or major hubs).',
      },
      unit: { zh: '座', en: 'airports' },
      file: 'large-airports.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: airports,
      formatTick: (v) => fixed(v, 0),
    },
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
    {
      id: 'hsr-first',
      label: { zh: '第一條高鐵', en: 'First high-speed line' },
      description: {
        zh: '這個國家第一條高速鐵路通車的年份（Wikidata 標成高速鐵路線的路線）：1964 年日本的東海道新幹線最早，台灣高鐵是 2007 年。沒有標成高速鐵路線的不算，所以奧地利、瑞士、俄羅斯、美國等沒有值。',
        en: 'The year a country’s first high-speed line opened (lines classed as high-speed railway lines in Wikidata): Japan’s Tōkaidō Shinkansen was first, in 1964; Taiwan High Speed Rail opened in 2007. Lines not classed as high-speed are not counted, so Austria, Switzerland, Russia and the United States, among others, have no value.',
      },
      unit: { zh: '年', en: '' },
      file: 'hsr-first.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1980, 1995, 2005, 2015] } },
      overlayTime: 'cumulative',
      format: yearText,
      formatTick: (v) => String(Math.round(v)),
      missing: { zh: '這一年還沒有高鐵（或 Wikidata 沒有收錄）', en: 'No high-speed line yet (or none in Wikidata)' },
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
      panelChart: false,
    },
  ],
};
