import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ColorClasses, PointRecord, TopicDefinition } from './types';

const KM = { zh: '公里', en: 'km' };
const KM_PER_1000 = { zh: '公里/千平方公里', en: 'km per 1,000 km²' };
// 航空旅客量的台灣：WDI 沒有，民航局的機場旅客寫在指標檔的附註
const AIR_NO_TWN = { TWN: { zh: '沒有（見附註）', en: 'None (see note)' } };
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

/** 最繁忙的機場（pipeline/topics/busiest_airports.py）：2020–2025 每年旅客量前 50 名，欄位 p<年>、r<年> 是那一年的旅客與名次 */
const BUSIEST_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const paxText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} passengers` });

function busiestTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string; year: number }) {
  const y = BUSIEST_YEARS.includes(ctx.year) ? ctx.year : BUSIEST_YEARS[BUSIEST_YEARS.length - 1];
  const pax = p[`p${y}`];
  const rank = p[`r${y}`];
  const history = BUSIEST_YEARS.filter((k) => typeof p[`r${k}`] === 'number')
    .map((k) => tr({ zh: `${k} 第 ${p[`r${k}`]}`, en: `${k}: No. ${p[`r${k}`]}` }))
    .join(tr({ zh: '、', en: ', ' }));
  return {
    title: `${String(p.en ?? '')} (${String(p.iata ?? '')})`,
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      typeof pax === 'number' ? tr({ zh: `${y} 年第 ${rank} 名，${paxText(pax)}`, en: `No. ${rank} in ${y}, ${paxText(pax)}` }) : null]
      .filter(Boolean)
      .join(' · '),
    extra: history ? [tr({ zh: `前 50 名：${history}`, en: `Top 50: ${history}` })] : undefined,
  };
}

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
    { name: 'OurAirports', url: 'https://ourairports.com/data/', license: { zh: '公有領域', en: 'public domain' } },
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
    {
      name: { zh: '世界銀行 WDI（航空旅客量，來源 ICAO）', en: 'World Bank WDI (air passengers carried, from ICAO)' },
      url: 'https://data.worldbank.org/indicator/IS.AIR.PSGR',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》（每人搭機次數的人口）', en: 'UN World Population Prospects 2024 (population for trips per person)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '英文維基百科「List of busiest airports by passenger traffic」（2026-10-20 的版本，數字引 ACI 的初步統計）',
        en: 'English Wikipedia, “List of busiest airports by passenger traffic” (revision of 20 October 2026, citing ACI preliminary figures)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381104599',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '交通部民用航空局（台灣各機場的旅客，附註用）', en: 'Taiwan Civil Aeronautics Administration (passengers at Taiwan’s airports, for the note)' },
      url: 'https://data.gov.tw/dataset/33238',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。機場只含大型機場與有定期航班的中型機場。港口與海運見「航運與港口」主題。' +
      '地鐵站取自 Wikidata：只收地鐵（Wikidata 標成地鐵站、或所屬路網是地鐵的車站），不收輕軌、電車、單軌、機場的旅客捷運與通勤鐵路；興建中、規劃中的不算。' +
      '開通年份用啟用日期，沒有的話用成立時間，但不早於所屬路網的通車年份（跟火車站同一個項目的車站寫的是火車站的年份；紐約 1868 年起的高架鐵路因此從紐約地鐵的 1904 年算起）。' +
      '開通日期不明的站畫在最後一年、標成灰色；每條路線各一個項目的轉乘站依名稱與距離（500 m 內）合併成一個站。Wikidata 的收錄各國不一，站數只是大概。' +
      '高鐵是 Wikidata 標成高速鐵路線、有啟用日期的路線，每一國最早的一條逐一核對過。' +
      '軌距取自 CIA 世界概況的各軌距公里數，資料年份各國不同（2008–2023 年）；2023 年起歐洲各國、俄羅斯、德國、義大利等只列鐵路總長，改用 2022 年 12 月的版本。' +
      '亞美尼亞、南蘇丹兩個版本都沒有，用英文維基百科的軌距、沒有長度。世界概況幾個明顯的筆誤（瑞士、南非、阿爾及利亞的軌距）已更正。' +
      '航空旅客量是世界銀行（來源 ICAO）各國註冊的航空公司一年載運的旅客（國內線加國際線），算在航空公司的註冊國，不是機場所在的國家或乘客的國籍：' +
      '瑞安航空註冊在愛爾蘭、威茲航空在匈牙利，所以這兩國特別高；一趟轉機算兩次，轉機樞紐的航空公司也偏高。多數國家到 2023 年。' +
      '台灣沒有這項資料，民航局統計的機場旅客寫在台灣的附註（口徑不同，地圖上留白）。' +
      '最繁忙的機場依英文維基百科 2026 年 10 月 20 日的版本，數字是國際機場協會（ACI）的初步統計，各機場自己公布的可能不同；每年只有前 50 名，2019 年以前在別的條目，沒有收。資料檔依維基百科的 CC BY-SA 4.0 分享。',
    en:
      'Railways come from simplified Natural Earth 1:10m map data and may miss branch lines; North America includes main lines only, so rail lengths for the US and Canada are clearly too low. Airports include only large airports and medium airports with scheduled flights. For ports and sea transport, see the Shipping and ports topic. ' +
      'Metro stations come from Wikidata: metro only (stations classed as metro stations or belonging to a metro system), not light rail, trams, monorails, airport people movers or commuter rail; stations under construction or planned are excluded. ' +
      'Opening years are Wikidata’s opening dates, or inception where there is none, but never earlier than the opening of the station’s metro system (items shared with a railway station carry the railway station’s date; New York’s elevated lines from 1868 therefore count from the subway’s 1904). ' +
      'Stations with unknown opening dates appear in the final year, in grey; interchange stations with one item per line are merged by name and distance (within 500 m). Wikidata’s coverage varies by country, so station counts are approximate. ' +
      'High-speed lines are those classed as high-speed railway lines in Wikidata with an opening date; each country’s earliest line was checked by hand. ' +
      'Track gauges come from the kilometres of each gauge in the CIA World Factbook, with data years varying by country (2008–2023); from 2023 the Factbook gives only total length for the European countries, Russia, Germany, Italy and others, so the December 2022 edition is used for them. ' +
      'Neither edition covers Armenia or South Sudan, whose gauges come from English Wikipedia, without lengths. A few obvious Factbook typos (the gauges of Switzerland, South Africa and Algeria) have been corrected. ' +
      'Air passengers are the World Bank’s (from ICAO) passengers carried in a year by airlines registered in each country (domestic plus international), counted in the airline’s country of registration, not where the airport is or where the passengers come from: ' +
      'Ryanair is registered in Ireland and Wizz Air in Hungary, so both countries stand out; a journey with a connection counts twice, which also lifts hub carriers. Most countries have data to 2023. ' +
      'There is no figure for Taiwan; passengers counted at Taiwan’s airports by its Civil Aeronautics Administration are given in Taiwan’s note (a different measure, so the map leaves Taiwan blank). ' +
      'The busiest airports follow English Wikipedia as of 20 October 2026, whose figures are Airports Council International (ACI) preliminary statistics and may differ from the airports’ own; only the top 50 of each year are listed, and years before 2020 are in other articles and not included. The data files are shared under Wikipedia’s CC BY-SA 4.0.',
  },
  overlays: [
    // 航空旅客量的兩個指標不畫鐵路
    { id: 'railways', file: 'railways.json', indicators: ['network', 'rail-length', 'rail-density', 'gauge', 'standard-share', 'airports-count', 'large-airports', 'metro-stations', 'hsr-first'] },
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
    {
      kind: 'points',
      id: 'busiest',
      file: 'busiest-airports.json',
      label: { zh: '旅客量前 50 名的機場', en: 'Top 50 airports by passengers' },
      radius: { field: 'pax', stops: [[2e7, 3], [5e7, 6], [8e7, 9], [1.1e8, 11.5]] },
      color: MAP_TOKENS.hues.violet,
      sortField: 'pax',
      epochs: { years: BUSIEST_YEARS, values: (p, y) => ({ pax: typeof p[`p${y}`] === 'number' ? (p[`p${y}`] as number) : null }) },
      minValue: { field: 'pax', stops: [[0, 1]] },
      sizeLegend: { title: { zh: '一年的旅客', en: 'Passengers a year' }, values: [3e7, 6e7, 1e8], format: formatLargeTick },
      indicators: ['busiest-passengers'],
      tooltip: busiestTooltip,
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
      id: 'air-passengers',
      label: { zh: '航空旅客量', en: 'Air passengers' },
      description: {
        zh: '各國註冊的航空公司一年載運的旅客（國內線加國際線），圓的面積與它成正比。2023 年美國 9.4 億、中國 6.2 億人次最多，愛爾蘭 1.9 億（瑞安航空註冊在愛爾蘭）、印度 1.8 億、土耳其 1.3 億、日本 1.2 億；全世界 42.7 億人次，疫情前的 2019 年 44.6 億，2020 年掉到 17.7 億。台灣沒有這項資料，機場旅客見台灣的附註。',
        en: 'Passengers carried in a year by airlines registered in each country (domestic plus international); circle area is proportional to it. In 2023 the US (940 million) and China (620 million) led, followed by Ireland (190 million, as Ryanair is registered there), India (180 million), Turkey (130 million) and Japan (120 million); 4.27 billion worldwide, against 4.46 billion before the pandemic in 2019 and 1.77 billion in 2020. There is no figure for Taiwan; see its note for airport passengers.',
      },
      unit: { zh: '人次', en: 'passengers' },
      file: 'air-passengers.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} passengers` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
      noValue: AIR_NO_TWN,
    },
    {
      id: 'air-trips',
      label: { zh: '每人搭機次數', en: 'Air trips per person' },
      description: {
        zh: '航空旅客量除以人口，大約是一年每人搭幾次飛機（算在航空公司的註冊國，不是乘客的國籍）。2023 年愛爾蘭 37 次（瑞安航空）、卡達 12.7、冰島 11.2、阿聯 8.6、新加坡 8.2、匈牙利 5.7（威茲航空）；美國 2.7、韓國 1.5、日本 1.0、中國 0.44、印度 0.13 次；全世界 0.53 次。',
        en: 'Air passengers divided by population, roughly how many flights per person a year (counted by the airline’s country of registration, not the passengers’ nationality). In 2023: Ireland 37 (Ryanair), Qatar 12.7, Iceland 11.2, the UAE 8.6, Singapore 8.2 and Hungary 5.7 (Wizz Air); the US 2.7, South Korea 1.5, Japan 1.0, China 0.44 and India 0.13; 0.53 worldwide.',
      },
      unit: { zh: '次/人', en: 'trips per person' },
      file: 'air-trips.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.2, 0.5, 1, 2, 5] } },
      format: (v) => tr({ zh: `${fixed(v, v < 1 ? 2 : 1)} 次`, en: `${fixed(v, v < 1 ? 2 : 1)} trips` }),
      formatTick: (v) => fixed(v, v < 1 ? 2 : 0),
      noValue: AIR_NO_TWN,
    },
    {
      id: 'busiest-passengers',
      label: { zh: '最繁忙的機場', en: 'Busiest airports' },
      description: {
        zh: '每年旅客量前 50 名的機場（ACI 的初步統計，依英文維基百科的整理），圓的面積與旅客量成正比，拖時間軸看 2020–2025 每一年。2025 年亞特蘭大 1.06 億人次第一，杜拜 9,519 萬、東京羽田 9,168 萬；台灣桃園 4,780 萬人次第 48 名。國家的值是它在前 50 名的機場旅客合計（排名表）。',
        en: 'The 50 busiest airports each year by passengers (ACI preliminary figures as compiled on English Wikipedia), with circle area proportional to passengers; drag the timeline for 2020–2025. In 2025 Atlanta led with 106 million, followed by Dubai (95.2 million) and Tokyo Haneda (91.7 million); Taiwan Taoyuan ranked 48th with 47.8 million. A country’s value is the total for its airports in the top 50 (see the ranking).',
      },
      unit: { zh: '人次', en: 'passengers' },
      file: 'busiest-passengers.json',
      layer: { kind: 'none' },
      format: paxText,
      formatTick: formatLargeTick,
      missing: { zh: '沒有機場在前 50 名', en: 'No airport in the top 50' },
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
