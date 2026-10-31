import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { aviationExtra } from './aviation-extra';
import { AIRPORTS_ZH } from './longest-flights-names';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 機場與旅客（主題 id 照舊是 aviation）：第七批 117（2026-10-30）把交通的機場、航空旅客指標（連同機場的疊加圖層）、
 * 「各國的航空公司」、「最長的直飛航線」合成「航空」；第十一批 186（同一天）再拆成機場與旅客、航線與航空公司（air-routes.ts）。
 * 資料都在 public/data/topics/aviation/：pipeline 的 transport（機場、航空旅客）、busiest-airports、airlines、longest-flights
 * 四個步驟各自輸出到這裡，航線與航空公司用 dataTopic 讀同一個資料夾。
 * 舊網址：交通搬走的指標（t/transport/?ind=air-passengers 等）轉到這裡；t/airlines/、t/longest-flights/ 與這裡搬走的指標轉到航線與航空公司（redirects.ts）。
 */

// 航空旅客量的台灣：WDI 沒有，民航局的機場旅客寫在指標檔的附註
const AIR_NO_TWN = { TWN: { zh: '沒有（見附註）', en: 'None (see note)' } };
const airports = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'airport' : 'airports'}` });

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

/** 機場名稱：中文介面用 AIRPORTS_ZH 的中文（沒有的用英文），英文介面用英文全名 */
function airportTitle(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.en ?? '');
  const zh = getLang() === 'zh' ? AIRPORTS_ZH[String(p.iata)] : undefined;
  return zh ? { title: zh, proper: en } : { title: en };
}

/**
 * 最繁忙的 50 座機場（第十二批 196）：「最繁忙的機場」指標，時間軸那一年（2020–2025，其他年份用最近的 2025）的旅客量前 50 名，
 * 依名次；每列：名次與機場、國家與 IATA 代碼、旅客量。點了放大到 11 級並標出機場
 */
const PAX_LIST: ListPanelDef = {
  label: { zh: '最繁忙的 50 座機場', en: '50 busiest airports' },
  indicators: ['busiest-passengers'],
  file: 'busiest-airports.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) => {
    const y = BUSIEST_YEARS.includes(year) ? year : BUSIEST_YEARS[BUSIEST_YEARS.length - 1];
    return points
      .filter((p) => typeof p[`r${y}`] === 'number')
      .sort((a, b) => Number(a[`r${y}`]) - Number(b[`r${y}`]))
      .map((p): ListRow => {
        const { title, proper } = airportTitle(p);
        return {
          key: String(p.iata),
          title: `${p[`r${y}`]}. ${title}`,
          properNoun: proper,
          lines: [
            [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, String(p.iata ?? '')].filter(Boolean).join(' · '),
            tr({ zh: `${y} 年 ${paxText(p[`p${y}`] as number)}`, en: `${paxText(p[`p${y}`] as number)} in ${y}` }),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        };
      });
  },
};

/** 最繁忙的貨運機場（第十二批 196）：「最繁忙的貨運機場」指標的 2025 年前 10 名（只有 10 座、跟旅客的不是同一批機場，另一個清單） */
const CARGO_LIST: ListPanelDef = {
  label: { zh: '最繁忙的貨運機場（2025 年）', en: 'Busiest cargo airports (2025)' },
  indicators: ['busiest-cargo'],
  file: 'cargo-airports.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .map((p): ListRow => {
        const { title, proper } = airportTitle(p);
        return {
          key: String(p.iata),
          title: `${p.rank}. ${title}`,
          properNoun: proper,
          lines: [
            [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, String(p.iata ?? '')].filter(Boolean).join(' · '),
            tr({ zh: `${fixed(p.t as number, 0)} 公噸（含轉運）`, en: `${fixed(p.t as number, 0)} tonnes (incl. transit)` }),
          ],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        };
      }),
};

export const aviation: TopicDefinition = {
  id: 'aviation',
  title: { zh: '機場與旅客', en: 'Airports and passengers' },
  shortTitle: { zh: '機場與旅客', en: 'Airports' },
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
    ...aviationExtra.sources,
  ],
  note: {
    zh:
      '機場只含大型機場與有定期航班的中型機場（OurAirports）。' +
      '航空旅客量是世界銀行（來源 ICAO）各國註冊的航空公司一年載運的旅客（國內線加國際線），算在航空公司的註冊國，不是機場所在的國家或乘客的國籍：' +
      '瑞安航空註冊在愛爾蘭、威茲航空在匈牙利，所以這兩國特別高；一趟轉機算兩次，轉機樞紐的航空公司也偏高。多數國家到 2023 年。' +
      '台灣沒有這項資料，民航局統計的機場旅客寫在台灣的附註（口徑不同，地圖上留白）。' +
      '最繁忙的機場依英文維基百科 2026 年 10 月 20 日的版本，數字是國際機場協會（ACI）的初步統計，各機場自己公布的可能不同；每年只有前 50 名，2019 年以前在別的條目，沒有收。資料檔依維基百科的 CC BY-SA 4.0 分享。' +
      '航空公司、最長的直飛航線見「航線與航空公司」主題，鐵路見「鐵路」主題。',
    en:
      'Airports include only large airports and medium airports with scheduled flights (OurAirports). ' +
      'Air passengers are the World Bank’s (from ICAO) passengers carried in a year by airlines registered in each country (domestic plus international), counted in the airline’s country of registration, not where the airport is or where the passengers come from: ' +
      'Ryanair is registered in Ireland and Wizz Air in Hungary, so both countries stand out; a journey with a connection counts twice, which also lifts hub carriers. Most countries have data to 2023. ' +
      'There is no figure for Taiwan; passengers counted at Taiwan’s airports by its Civil Aeronautics Administration are given in Taiwan’s note (a different measure, so the map leaves Taiwan blank). ' +
      'The busiest airports follow English Wikipedia as of 20 October 2026, whose figures are Airports Council International (ACI) preliminary statistics and may differ from the airports’ own; only the top 50 of each year are listed, and years before 2020 are in other articles and not included. The data files are shared under Wikipedia’s CC BY-SA 4.0. ' +
      'For airlines and the longest flights see the Air routes and airlines topic; for railways, the Railways topic.',
  },
  panelExtra: () => import('./panels/AviationPanel'),
  listPanel: [PAX_LIST, CARGO_LIST],
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
    ...aviationExtra.overlays,
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
        zh: '每年旅客量前 50 名的機場（ACI 的初步統計，依英文維基百科的整理），圓的面積與旅客量成正比，拖時間軸看 2020–2025 每一年。2025 年亞特蘭大 1.06 億人次第一，杜拜 9,519 萬、東京羽田 9,168 萬；台灣桃園 4,780 萬人次第 48 名。國家的值是它在前 50 名的機場旅客合計（排名表）。左邊的清單依名次列出那一年的 50 座。',
        en: 'The 50 busiest airports each year by passengers (ACI preliminary figures as compiled on English Wikipedia), with circle area proportional to passengers; drag the timeline for 2020–2025. In 2025 Atlanta led with 106 million, followed by Dubai (95.2 million) and Tokyo Haneda (91.7 million); Taiwan Taoyuan ranked 48th with 47.8 million. A country’s value is the total for its airports in the top 50 (see the ranking). The list on the left shows that year’s 50 by rank.',
      },
      unit: { zh: '人次', en: 'passengers' },
      file: 'busiest-passengers.json',
      layer: { kind: 'none' },
      format: paxText,
      formatTick: formatLargeTick,
      missing: { zh: '沒有機場在前 50 名', en: 'No airport in the top 50' },
    },
    ...aviationExtra.indicators,
  ],
};
