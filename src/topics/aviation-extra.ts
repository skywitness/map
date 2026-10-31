import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { AIRPORTS_ZH } from './longest-flights-names';
import type { CategoryDef, IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 航空的擴充（2026-10-31，製作手冊第十批 175；pipeline/topics/aviation_extra.py）：最繁忙的航線、航空貨運量、航空公司聯盟、
 * 廉價航空放「航線與航空公司」（air-routes.ts），最繁忙的貨運機場放「機場與旅客」（aviation.ts）。
 */

const airport = (code: unknown, en: unknown) => (getLang() === 'zh' ? AIRPORTS_ZH[String(code)] ?? String(en ?? '') : String(en ?? ''));
const seatsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 個座位`, en: `${formatLargeNumber(v)} seats` });
const routeName = (p: PointRecord) => `${airport(p.a, p.an)} – ${airport(p.b, p.bn)}`;
const DOMESTIC = 1;

function routeFacts(p: PointRecord): string[] {
  return [
    [
      tr({ zh: `第 ${p.rank} 名`, en: `No. ${p.rank}` }),
      p.t === DOMESTIC ? tr({ zh: '國內線', en: 'domestic' }) : tr({ zh: '國際線', en: 'international' }),
      typeof p.km === 'number' ? tr({ zh: `${fixed(p.km, 0)} 公里`, en: `${fixed(p.km, 0)} km` }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    tr({ zh: `2025 年 ${seatsText(p.seats as number)}（OAG）`, en: `${seatsText(p.seats as number)} in 2025 (OAG)` }),
  ];
}

const BUSY_INDICATORS = ['busy-routes'];

const BUSIEST_ROUTES: LinesOverlayDef = {
  kind: 'lines',
  id: 'busiest-routes',
  file: 'busiest-routes.json',
  label: { zh: '最繁忙的航線（2025 年座位數）', en: 'Busiest routes (2025 seats)' },
  indicators: BUSY_INDICATORS,
  width: { field: 'seats', stops: [[4e6, 1.2], [7e6, 2.4], [1e7, 3.6], [1.4e7, 5]] },
  color: {
    classes: [
      { value: DOMESTIC, color: MAP_TOKENS.hues.red, label: { zh: '國內線', en: 'Domestic' } },
      { value: 2, color: MAP_TOKENS.hues.blue, label: { zh: '國際線', en: 'International' } },
    ],
  },
  hoverHalo: true,
  sizeLegend: { title: { zh: '一年的座位數', en: 'Seats a year' }, values: [5e6, 1e7], format: seatsText },
  tooltip: (p) => ({ title: routeName(p), extra: routeFacts(p) }),
};

/** 左邊的清單（第十二批 L12 的最繁忙航線部分）：依座位數，點了框住整條航線 */
const BUSY_LIST: ListPanelDef = {
  label: { zh: '最繁忙的航線', en: 'Busiest routes' },
  indicators: BUSY_INDICATORS,
  file: 'busiest-routes-list.json',
  rows: (points) =>
    [...points]
      .sort((a, b) => (a.rank as number) - (b.rank as number))
      .map((p): ListRow => {
        const box = String(p.box).split(',').map(Number) as [number, number, number, number];
        return { key: `${p.a}-${p.b}`, title: routeName(p), lines: routeFacts(p), target: { box } };
      }),
};

/** 航空公司聯盟（pipeline 的 1 星空、2 天合、3 寰宇一家、4 兩個以上、0 沒有） */
const ALLIANCES: CategoryDef[] = [
  { value: 1, label: { zh: '星空聯盟', en: 'Star Alliance' } },
  { value: 2, label: { zh: '天合聯盟', en: 'SkyTeam' } },
  { value: 3, label: { zh: '寰宇一家', en: 'Oneworld' } },
  { value: 4, label: { zh: '兩個以上', en: 'Two or more' } },
  { value: 0, label: { zh: '沒有', en: 'None' }, color: MAP_TOKENS.categoricalOther },
];

const routeCount = (v: number) => tr({ zh: `${fixed(v, 0)} 條`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'route' : 'routes'}` });
const airlineCount = (v: number) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'airline' : 'airlines'}` });

export const airRoutesExtra: { sources: SourceDef[]; overlays: LinesOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: {
        zh: '英文維基百科「List of busiest passenger flight routes」（revid 1381576579；座位數原本來自 OAG 的年度報告）',
        en: 'English Wikipedia, “List of busiest passenger flight routes” (revision 1381576579; seat counts originally from OAG’s annual reports)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_busiest_passenger_flight_routes&oldid=1381576579',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '交通部民用航空局：國際及兩岸定期航線班機載客率（台灣的附註）', en: 'Civil Aeronautics Administration (Taiwan), scheduled route load factors (Taiwan note)' },
      url: 'https://data.gov.tw/dataset/44751',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'World Bank, World Development Indicators（ICAO 的航空貨運量）', en: 'World Bank, World Development Indicators (ICAO air freight)' },
      url: 'https://data.worldbank.org/indicator/IS.AIR.GOOD.MT.K1',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Star Alliance」「SkyTeam」「Oneworld」的成員表（revid 1381148336、1381760703、1382042466）',
        en: 'English Wikipedia, “Star Alliance”, “SkyTeam” and “Oneworld” member tables (revisions 1381148336, 1381760703, 1382042466)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Star_Alliance&oldid=1381148336',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of low-cost airlines」（revid 1377811665）', en: 'English Wikipedia, “List of low-cost airlines” (revision 1377811665)' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_low-cost_airlines&oldid=1377811665',
      license: 'CC BY-SA 4.0',
    },
  ],
  overlays: [BUSIEST_ROUTES],
  listPanel: BUSY_LIST,
  indicators: [
    {
      id: 'busy-routes',
      label: { zh: '最繁忙的航線', en: 'Busiest routes' },
      description: {
        zh: '2025 年座位數最多的航線（英文維基依 OAG 的年度報告：全世界前 10 名與國際線的表，共 25 條），畫成大圓弧，線越粗座位越多；國家的值是有幾條在這國起降。前 10 名全是國內線，第一是濟州–首爾金浦 1,438 萬個座位（449 公里）；國際線第一是香港–台灣桃園 683 萬（全部第 11），桃園–東京成田 402 萬也在國際線前 10 名。座位數是班表上的座位，不是實際的旅客；台灣的附註另附民航局的人次。',
        en: 'The routes with the most seats in 2025 (English Wikipedia’s tables of the world top 10 and international routes, based on OAG’s annual reports: 25 routes), drawn as great-circle arcs with width by seats; a country’s value is how many of them serve it. The top 10 are all domestic, led by Jeju–Seoul Gimpo with 14.38 million seats (449 km); the busiest international route is Hong Kong–Taipei Taoyuan with 6.83 million (11th overall), and Taoyuan–Tokyo Narita (4.02 million) is also in the international top 10. Seats are scheduled capacity, not passengers; Taiwan’s note adds the Civil Aeronautics Administration’s passenger counts.',
      },
      unit: { zh: '條', en: 'routes' },
      file: 'busy-routes.json',
      layer: { kind: 'none' },
      integer: true,
      timeless: true,
      format: routeCount,
    },
    {
      id: 'air-freight',
      label: { zh: '航空貨運量', en: 'Air freight' },
      description: {
        zh: '各國註冊的航空公司一年的貨運量（百萬延噸公里：貨物公噸數 × 飛行公里數），圓的面積與它成正比。2023 年美國 42,763、中國 26,170、卡達 13,927、阿聯 13,566、德國 12,767、南韓 12,294、香港 8,638。算在航空公司的註冊國，所以卡達、阿聯、盧森堡（Cargolux）、香港很高，不是貨物進出的國家。世界銀行（ICAO）沒有台灣。',
        en: 'Freight carried by airlines registered in each country (million tonne-kilometres: tonnes × kilometres flown); circle area is proportional to it. In 2023: the US 42,763, China 26,170, Qatar 13,927, the UAE 13,566, Germany 12,767, South Korea 12,294 and Hong Kong 8,638. It counts by the airline’s country of registration, which is why Qatar, the UAE, Luxembourg (Cargolux) and Hong Kong rank high, not where the cargo goes. The World Bank (ICAO) data has no figure for Taiwan.',
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'air-freight.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 百萬延噸公里`, en: `${fixed(v, v < 10 ? 1 : 0)} million tonne-km` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'alliances',
      label: { zh: '航空公司聯盟', en: 'Airline alliances' },
      description: {
        zh: '這一年各國有正式成員（不算附屬航空公司）在哪個聯盟；一國有好幾家分屬不同聯盟的歸「兩個以上」（美國、中國、日本、南韓、台灣等）。星空聯盟 1997 年成立、寰宇一家 1999、天合聯盟 2000，拖時間軸看加入與退出。2026 年星空 26 家、天合 18 家（俄羅斯航空 2022 年起停權，這裡算退出）、寰宇一家 15 家。台灣：華航 2011 年加入天合、長榮 2013 年加入星空。',
        en: 'Which alliances each country’s full member airlines (not affiliates) belonged to that year; countries with members in different alliances are shown as “two or more” (the US, China, Japan, South Korea, Taiwan and others). Star Alliance was founded in 1997, Oneworld in 1999 and SkyTeam in 2000; drag the timeline to see members join and leave. In 2026 Star Alliance has 26 members, SkyTeam 18 (Aeroflot, suspended since 2022, is counted as having left) and Oneworld 15. Taiwan: China Airlines joined SkyTeam in 2011 and EVA Air joined Star Alliance in 2013.',
      },
      unit: '',
      file: 'alliances.json',
      layer: { kind: 'categorical', categories: ALLIANCES },
      format: (v) => tr(ALLIANCES.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      defaultYear: 2026,
    },
    {
      id: 'low-cost',
      label: { zh: '廉價航空', en: 'Low-cost airlines' },
      description: {
        zh: '英文維基依國家列的營運中廉價航空家數（共 164 家、68 國）：中國 10、南韓 9、美國 7、菲律賓 7、泰國 6、西班牙 6、英國 6；台灣 1 家（台灣虎航）。誰算廉價航空沒有公認的定義，清單是維基編者收的；大型集團的子公司算在它登記的國家。滑過看航空公司。',
        en: 'Operating low-cost airlines by country as listed on English Wikipedia (164 airlines in 68 countries): China 10, South Korea 9, the US 7, the Philippines 7, Thailand 6, Spain 6 and the UK 6; Taiwan 1 (Tigerair Taiwan). There is no agreed definition of a low-cost airline, so the list reflects Wikipedia editors’ choices; subsidiaries of large groups count in their country of registration. Hover to see the airlines.',
      },
      unit: { zh: '家', en: 'airlines' },
      file: 'low-cost.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 10] },
      integer: true,
      timeless: true,
      format: airlineCount,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '清單裡沒有', en: 'None in the list' },
    },
  ],
};

/** 機場與旅客（aviation.ts）：2025 年最繁忙的貨運機場 */
const CARGO_AIRPORTS: PointsOverlayDef = {
  kind: 'points',
  id: 'cargo-airports',
  file: 'cargo-airports.json',
  label: { zh: '貨運量前 10 名的機場（2025 年）', en: 'Top 10 cargo airports (2025)' },
  indicators: ['busiest-cargo'],
  radius: { field: 't', stops: [[2e6, 6], [3e6, 8], [5e6, 11]] },
  color: MAP_TOKENS.hues.orange,
  sortField: 't',
  sizeLegend: { title: { zh: '一年的貨運量', en: 'Cargo a year' }, values: [2.5e6, 5e6], format: (v) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` }) },
  tooltip: (p, ctx) => ({
    title: `${airport(p.iata, p.en)} (${p.iata})`,
    detail: typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : undefined,
    extra: [tr({ zh: `第 ${p.rank} 名 · ${fixed(p.t as number, 0)} 公噸（含轉運，ACI）`, en: `No. ${p.rank} · ${fixed(p.t as number, 0)} tonnes (incl. transit, ACI)` })],
    properNoun: getLang() === 'zh' ? String(p.en ?? '') : undefined,
  }),
};

export const aviationExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: '英文維基百科「List of busiest airports by cargo traffic」（revid 1381593454，ACI 的 2025 年初步統計）',
        en: 'English Wikipedia, “List of busiest airports by cargo traffic” (revision 1381593454; ACI preliminary 2025 figures)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_busiest_airports_by_cargo_traffic&oldid=1381593454',
      license: 'CC BY-SA 4.0',
    },
  ],
  overlays: [CARGO_AIRPORTS],
  indicators: [
    {
      id: 'busiest-cargo',
      label: { zh: '最繁忙的貨運機場', en: 'Busiest cargo airports' },
      description: {
        zh: '2025 年貨運量前 10 名的機場（ACI 的初步統計，依英文維基；公噸，含轉運），圓的面積與貨運量成正比：香港 507 萬公噸第一，上海浦東 410 萬、安克拉治 385 萬、路易維爾、邁阿密、曼非斯、首爾仁川、杜哈；台灣桃園 250 萬公噸第 9（民航局的數字一樣）。國家的值是它在前 10 名的機場合計。',
        en: 'The 10 busiest cargo airports in 2025 (ACI preliminary figures via English Wikipedia; tonnes including transit), with circle area proportional to cargo: Hong Kong led with 5.07 million tonnes, followed by Shanghai Pudong (4.10 million), Anchorage (3.85 million), Louisville, Miami, Memphis, Seoul Incheon and Doha; Taiwan Taoyuan was 9th with 2.5 million (matching the Civil Aeronautics Administration). A country’s value is the total for its airports in the top 10.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'busiest-cargo.json',
      layer: { kind: 'none' },
      timeless: true,
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} tonnes` }),
      formatTick: formatLargeTick,
      missing: { zh: '沒有機場在前 10 名', en: 'No airport in the top 10' },
    },
  ],
};
