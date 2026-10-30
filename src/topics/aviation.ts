import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { longestFlightsPart } from './longest-flights';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 航空（2026-10-30，製作手冊第七批 117）：交通主題的機場、航空旅客指標（連同機場的疊加圖層）、「各國的航空公司」、
 * 「最長的直飛航線」合成一個主題。資料都在 public/data/topics/aviation/：pipeline 的 transport（機場、航空旅客）、
 * busiest-airports、airlines、longest-flights 四個步驟各自輸出到這裡。
 * 舊網址 t/airlines/、t/longest-flights/ 與交通搬走的指標（t/transport/?ind=air-passengers 等）轉到這裡（redirects.ts）。
 * 航空公司：Wikidata 的航空公司，各國每年營運中的家數；使用者 2026-10-29 決定地圖預設只算營運中的（2026 年），
 * 停業的放時間軸（拖到以前的年份就算那一年營運中的）。
 */

// 航空旅客量的台灣：WDI 沒有，民航局的機場旅客寫在指標檔的附註
const AIR_NO_TWN = { TWN: { zh: '沒有（見附註）', en: 'None (see note)' } };
const airports = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'airport' : 'airports'}` });
const airlineCount = (v: number) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'airline' : 'airlines'}` });

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

export const aviation: TopicDefinition = {
  id: 'aviation',
  title: { zh: '航空', en: 'Aviation' },
  shortTitle: { zh: '航空', en: 'Aviation' },
  defaultIndicator: 'air-passengers',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'OurAirports（機場的位置與分類）', en: 'OurAirports (airport locations and types)' }, url: 'https://ourairports.com/data/', license: { zh: '公有領域', en: 'public domain' } },
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
    {
      name: { zh: 'Wikidata（航空公司的國家、成立與停業年份、IATA 與 ICAO 代碼、名稱）', en: 'Wikidata (countries, founding and closing years, IATA and ICAO codes, names)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    ...longestFlightsPart.sources.filter((s) => !s.url.startsWith('https://ourairports.com/')),
  ],
  note: {
    zh:
      '機場只含大型機場與有定期航班的中型機場（OurAirports）。' +
      '航空旅客量是世界銀行（來源 ICAO）各國註冊的航空公司一年載運的旅客（國內線加國際線），算在航空公司的註冊國，不是機場所在的國家或乘客的國籍：' +
      '瑞安航空註冊在愛爾蘭、威茲航空在匈牙利，所以這兩國特別高；一趟轉機算兩次，轉機樞紐的航空公司也偏高。多數國家到 2023 年。' +
      '台灣沒有這項資料，民航局統計的機場旅客寫在台灣的附註（口徑不同，地圖上留白）。' +
      '最繁忙的機場依英文維基百科 2026 年 10 月 20 日的版本，數字是國際機場協會（ACI）的初步統計，各機場自己公布的可能不同；每年只有前 50 名，2019 年以前在別的條目，沒有收。資料檔依維基百科的 CC BY-SA 4.0 分享。' +
      '航空公司：' +
      '航空公司是 Wikidata 標成航空公司（含低成本、國家、區域、包機航空公司）的，加上有 IATA 或 ICAO 航空公司代碼、標成一般公司的（例如台灣虎航）；只做貨運、直升機的不算。' +
      '營運中是沒有停業日期、也有 IATA 或 ICAO 代碼的；Wikidata 很多停業的航空公司沒寫停業日期，所以還是會多算一些，各國的收錄也不一樣多，家數只是大概。' +
      '停業的依成立到停業的年份算在時間軸上；成立年份不詳的營運中航空公司（約 240 家）只算在 2026 年，所以 2026 年比 2025 年多。國家照 Wikidata 的國家，北歐航空這類兩國以上的每國都算，沒有國家的用總部所在的國家。' +
      '威航在 Wikidata 沒有停業日期，照它 2016 年 10 月停止營運改成 2016 年。' +
      ' 最長的直飛航線：' +
      longestFlightsPart.note.zh,
    en:
      'Airports include only large airports and medium airports with scheduled flights (OurAirports). ' +
      'Air passengers are the World Bank’s (from ICAO) passengers carried in a year by airlines registered in each country (domestic plus international), counted in the airline’s country of registration, not where the airport is or where the passengers come from: ' +
      'Ryanair is registered in Ireland and Wizz Air in Hungary, so both countries stand out; a journey with a connection counts twice, which also lifts hub carriers. Most countries have data to 2023. ' +
      'There is no figure for Taiwan; passengers counted at Taiwan’s airports by its Civil Aeronautics Administration are given in Taiwan’s note (a different measure, so the map leaves Taiwan blank). ' +
      'The busiest airports follow English Wikipedia as of 20 October 2026, whose figures are Airports Council International (ACI) preliminary statistics and may differ from the airports’ own; only the top 50 of each year are listed, and years before 2020 are in other articles and not included. The data files are shared under Wikipedia’s CC BY-SA 4.0.' +
      ' Airlines: ' +
      'Airlines are Wikidata items classed as airlines (including low-cost, flag, regional and charter airlines), plus items with an IATA or ICAO airline code classed as ordinary companies (such as Tigerair Taiwan); cargo-only and helicopter operators are left out. ' +
      'An airline counts as operating if it has no closing date and has an IATA or ICAO code. Many defunct airlines in Wikidata have no closing date, so some are still overcounted, and coverage varies between countries; counts are approximate. ' +
      'Defunct airlines are counted in the timeline from founding to closing; operating airlines with an unknown founding year (about 240) count only in 2026, which is why 2026 is higher than 2025. Countries follow Wikidata, airlines of two or more countries, such as SAS, count in each, and those without a country use the country of their headquarters. ' +
      'V Air has no closing date in Wikidata; it stopped flying in October 2016 and is treated as closed that year.' +
      ' Longest flights: ' +
      longestFlightsPart.note.en,
  },
  panelExtra: () => import('./panels/AviationPanel'),
  overlays: [
    // 交通主題搬過來的機場（鐵路、機場是舊的寫法，app/overlays.ts 依 id 認得 airports）
    { id: 'airports', file: 'airports.json', indicators: ['airports-count', 'large-airports'] },
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
    ...longestFlightsPart.overlays,
  ],
  indicators: [
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
      id: 'airlines',
      label: { zh: '營運中的航空公司', en: 'Operating airlines' },
      description: {
        zh: '這一年營運中的航空公司家數，圓的面積與它成正比。2026 年全世界約 1,800 家，美國 173、俄羅斯 75、加拿大 68、中國 65、德國 54、英國 53 家；台灣 8 家（中華、長榮、華信、立榮、德安、台灣虎航、星宇，加上荷蘭航空在台灣登記的子公司）。拖動時間軸看以前：1909 年德國的飛船航空公司 DELAG 最早，1919 年有荷蘭皇家航空等 23 家，1950 年約 300 家；台灣 1990 年代開放天空後一度有 17 家。點國家列出它的航空公司。',
        en: 'Airlines operating in the year; circle area is proportional to the count. In 2026 there are about 1,800 worldwide: the US 173, Russia 75, Canada 68, China 65, Germany 54 and the UK 53; Taiwan 8 (China Airlines, EVA Air, Mandarin Airlines, UNI Air, Daily Air, Tigerair Taiwan and Starlux, plus KLM’s subsidiary registered in Taiwan). Drag the timeline back to Germany’s airship airline DELAG in 1909, the first; 23 airlines including KLM by 1919 and about 300 by 1950. Taiwan briefly had 17 after it opened its skies in the 1990s. Select a country for its airlines.',
      },
      unit: { zh: '家', en: 'airlines' },
      file: 'airlines.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: airlineCount,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
    ...longestFlightsPart.indicators,
  ],
};
