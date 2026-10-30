import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ColorClasses, PointRecord, TopicDefinition } from './types';

const KM = { zh: '公里', en: 'km' };
const KM_PER_1000 = { zh: '公里/千平方公里', en: 'km per 1,000 km²' };
const km = (v: number) => `${fixed(v, 0)} ${tr(KM)}`;

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

type Bilingual = { zh: string; en: string };

/** 「標準軌（1,435 mm）」；name 為 null 是不在分類裡的軌距，只寫毫米數 */
export function gaugeText(name: Bilingual | null, mm: number): Bilingual {
  const n = fixed(mm, 0);
  return name ? { zh: `${name.zh}（${n} mm）`, en: `${name.en} (${n} mm)` } : { zh: `${n} mm`, en: `${n} mm` };
}

/**
 * 軌距的分類（pipeline/topics/rail_gauge.py 的 CLASSES，代碼要一致）。代碼 8（1,000 mm 以下的窄軌、1,372 mm 等）
 * 不列在 categories 裡，歸到類別圖的「其他軌距」；mm 是側欄判斷某個軌距屬於哪一類用的。
 */
export const GAUGES: (CategoryDef & { name: Bilingual; mm: number[] })[] = [
  { value: 1, mm: [1435], name: { zh: '標準軌', en: 'Standard' } },
  { value: 2, mm: [1520, 1524], name: { zh: '俄規寬軌', en: 'Russian broad' } },
  { value: 3, mm: [1676], name: { zh: '印度寬軌', en: 'Indian broad' } },
  { value: 4, mm: [1668], name: { zh: '伊比利寬軌', en: 'Iberian broad' } },
  { value: 5, mm: [1600], name: { zh: '愛爾蘭寬軌', en: 'Irish broad' } },
  { value: 6, mm: [1067], name: { zh: '開普軌', en: 'Cape gauge' } },
  { value: 7, mm: [1000], name: { zh: '米軌', en: 'Metre gauge' } },
].map((g) => ({ ...g, label: gaugeText(g.name, g.mm[0]) }));
export const OTHER_GAUGE = { zh: '其他軌距', en: 'Other gauges' };
const gaugeLabel = (v: number) => tr(GAUGES.find((g) => g.value === v)?.label ?? OTHER_GAUGE);

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
    { name: { zh: 'OurAirports（側欄的機場清單）', en: 'OurAirports (airport lists in the side panel)' }, url: 'https://ourairports.com/data/', license: { zh: '公有領域', en: 'public domain' } },
    {
      name: { zh: 'CIA 世界概況（各國的軌距與長度，factbook.json 的鏡像）', en: 'CIA World Factbook (track gauges and lengths, via the factbook.json mirror)' },
      url: 'https://github.com/factbook/factbook.json',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: '英文維基百科（亞美尼亞、南蘇丹的軌距）', en: 'English Wikipedia (track gauges of Armenia and South Sudan)' },
      url: 'https://en.wikipedia.org/',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Wikidata（地鐵站、地鐵路網、高速鐵路線與開通日期）', en: 'Wikidata (metro stations, metro systems, high-speed lines and opening dates)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。機場、航空旅客見「航空」主題，港口與海運見「航運與港口」主題。' +
      '地鐵站取自 Wikidata：只收地鐵（Wikidata 標成地鐵站、或所屬路網是地鐵的車站），不收輕軌、電車、單軌、機場的旅客捷運與通勤鐵路；興建中、規劃中的不算。' +
      '開通年份用啟用日期，沒有的話用成立時間，但不早於所屬路網的通車年份（跟火車站同一個項目的車站寫的是火車站的年份；紐約 1868 年起的高架鐵路因此從紐約地鐵的 1904 年算起）。' +
      '開通日期不明的站畫在最後一年、標成灰色；每條路線各一個項目的轉乘站依名稱與距離（500 m 內）合併成一個站。Wikidata 的收錄各國不一，站數只是大概。' +
      '高鐵是 Wikidata 標成高速鐵路線、有啟用日期的路線，每一國最早的一條逐一核對過。' +
      '軌距取自 CIA 世界概況的各軌距公里數，資料年份各國不同（2008–2023 年）；2023 年起歐洲各國、俄羅斯、德國、義大利等只列鐵路總長，改用 2022 年 12 月的版本。' +
      '亞美尼亞、南蘇丹兩個版本都沒有，用英文維基百科的軌距、沒有長度。世界概況幾個明顯的筆誤（瑞士、南非、阿爾及利亞的軌距）已更正。',
    en:
      'Railways come from simplified Natural Earth 1:10m map data and may miss branch lines; North America includes main lines only, so rail lengths for the US and Canada are clearly too low. For airports and air passengers, see the Aviation topic; for ports and sea transport, see the Shipping and ports topic. ' +
      'Metro stations come from Wikidata: metro only (stations classed as metro stations or belonging to a metro system), not light rail, trams, monorails, airport people movers or commuter rail; stations under construction or planned are excluded. ' +
      'Opening years are Wikidata’s opening dates, or inception where there is none, but never earlier than the opening of the station’s metro system (items shared with a railway station carry the railway station’s date; New York’s elevated lines from 1868 therefore count from the subway’s 1904). ' +
      'Stations with unknown opening dates appear in the final year, in grey; interchange stations with one item per line are merged by name and distance (within 500 m). Wikidata’s coverage varies by country, so station counts are approximate. ' +
      'High-speed lines are those classed as high-speed railway lines in Wikidata with an opening date; each country’s earliest line was checked by hand. ' +
      'Track gauges come from the kilometres of each gauge in the CIA World Factbook, with data years varying by country (2008–2023); from 2023 the Factbook gives only total length for the European countries, Russia, Germany, Italy and others, so the December 2022 edition is used for them. ' +
      'Neither edition covers Armenia or South Sudan, whose gauges come from English Wikipedia, without lengths. A few obvious Factbook typos (the gauges of Switzerland, South Africa and Algeria) have been corrected. ',
  },
  overlays: [
    // 機場的圖層與航空的指標 2026-10-30 搬到航空主題（aviation.ts）
    { id: 'railways', file: 'railways.json', indicators: ['network', 'rail-length', 'rail-density', 'gauge', 'standard-share', 'metro-stations', 'hsr-first'] },
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
        zh: '全球鐵路路線，可在左下角開關圖層；滑鼠移到國家上可看鐵路長度。機場在「航空」主題。',
        en: 'Railway lines around the world; toggle the layer at the bottom left. Hover over a country to see its rail length. Airports are in the Aviation topic.',
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
      id: 'gauge',
      label: { zh: '主要軌距', en: 'Main track gauge' },
      description: {
        zh: '鐵路長度最多的那一種軌距（兩條鐵軌內側的距離）。1,435 mm 的標準軌最普遍（60 國）；前蘇聯各國與芬蘭是俄規寬軌，日本、台灣、南非、印尼是開普軌，東南亞、東非與南美有不少米軌。軌距不同的車不能直接開過去，國界上要換轉向架或換車。點國家看各種軌距的長度。',
        en: 'The track gauge (the distance between the inner faces of the rails) with the most track. The 1,435 mm standard gauge is the most common (60 countries); the former Soviet states and Finland use Russian broad gauge, Japan, Taiwan, South Africa and Indonesia use Cape gauge, and much of Southeast Asia, East Africa and South America uses metre gauge. Trains cannot run straight onto track of another gauge, so bogies or trains are changed at the border. Click a country for the length of each gauge.',
      },
      unit: '',
      file: 'gauge.json',
      layer: { kind: 'categorical', categories: GAUGES.map(({ value, label }) => ({ value, label })), other: OTHER_GAUGE },
      format: gaugeLabel,
      unranked: true,
      panelChart: false,
    },
    {
      id: 'standard-share',
      label: { zh: '標準軌的比例', en: 'Share of standard gauge' },
      description: {
        zh: '1,435 mm 的標準軌占鐵路總長的比例（雙軌距的路段不算）。台灣 21%（高鐵是標準軌，台鐵是 1,067 mm），日本 18%（新幹線），西班牙 17%（高鐵是標準軌，傳統線是 1,668 mm 的伊比利寬軌）。',
        en: 'Share of all track that is 1,435 mm standard gauge (dual-gauge sections are not counted). Taiwan 21% (the high-speed line is standard gauge, the conventional network 1,067 mm), Japan 18% (the Shinkansen), Spain 17% (high-speed lines are standard gauge, conventional lines 1,668 mm Iberian gauge).',
      },
      unit: '%',
      file: 'standard-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 25, 50, 75, 99] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      unranked: true,
      panelChart: false,
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
