import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { museumsOverlay } from './attractions';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 博物館與美術館（新主題，2026-11-08，製作手冊第二十七批 638；使用者 2026-11-07 核准從景點地圖拆出來；
 * pipeline/topics/museums.py）：OSM 的各國座數與密度（跟 Wikidata 的點是兩份獨立的來源，不混用）、Wikidata 的開館年份、
 * 年參觀人次（景點地圖的維基表 62 館優先）、館藏量、國立與地方博物館。點沿用景點地圖的 Wikidata 博物館圖層。
 * 照片（候選 1403）沒做：commons 的 API 在 robots.txt 禁止的 /w/ 底下。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);
function museumName(p: PointRecord): { title: string; proper?: string } {
  const zh = str(p.zh);
  const en = str(p.en) ?? '';
  return getLang() === 'zh' && zh ? { title: zh, proper: zh !== en ? en || undefined : undefined } : { title: en || zh || '' };
}
const visitorsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const country = (p: PointRecord, name: (iso3: string) => string) => (typeof p.iso3 === 'string' ? name(p.iso3) : null);

const OPENED: PointsOverlayDef = {
  kind: 'points',
  id: 'museums-opened',
  file: 'opened.json',
  label: { zh: '有開館年份的博物館（依年份出現）', en: 'Museums with a founding year (appearing by year)' },
  indicators: ['first'],
  radius: 2,
  color: C[0],
  timeField: 'yt',
  tooltip: (p, ctx) => {
    const n = museumName(p);
    return {
      title: n.title,
      detail: [num(p.y) ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null, country(p, ctx.countryName)].filter(Boolean).join(' · '),
      properNoun: n.proper,
    };
  },
};

const SRC = {
  1: { zh: '英文維基「最多人造訪的博物館」', en: 'English Wikipedia’s most-visited list' },
  2: { zh: 'Wikidata', en: 'Wikidata' },
  3: { zh: '交通部觀光署', en: 'Taiwan Tourism Administration' },
} as const;
const VISITORS: PointsOverlayDef = {
  kind: 'points',
  id: 'museum-visitors-all',
  file: 'visitors.json',
  label: { zh: '有年參觀人次的博物館', en: 'Museums with annual visitor figures' },
  indicators: ['visitors'],
  radius: { field: 'v', stops: [[1e4, 1.6], [1e5, 2.6], [1.25e6, 5.5], [9e6, 11]] },
  color: {
    field: 'v',
    title: { zh: '一年的人次', en: 'Visitors a year' },
    thresholds: [1e5, 1.25e6],
    classes: [
      { color: C[0], label: { zh: '不到 10 萬', en: 'Under 100,000' } },
      { color: C[1], label: { zh: '10 萬–125 萬', en: '100,000–1.25 million' } },
      { color: C[3], label: { zh: '125 萬以上', en: '1.25 million or more' } },
    ],
  },
  sortField: 'v',
  tooltip: (p, ctx) => {
    const n = museumName(p);
    const v = num(p.v);
    const src = SRC[(num(p.src) ?? 2) as 1 | 2 | 3];
    return {
      title: n.title,
      detail: country(p, ctx.countryName) ?? '',
      extra: [
        v ? (num(p.vy) ? tr({ zh: `${p.vy} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${p.vy}` }) : visitorsText(v)) : null,
        tr({ zh: `資料：${tr(src)}`, en: `Source: ${tr(src)}` }),
      ].filter((x): x is string => Boolean(x)),
      properNoun: n.proper,
    };
  },
};
const VISITOR_LIST: ListPanelDef = {
  label: { zh: '有年參觀人次的博物館', en: 'Museums by visitors' },
  tabLabel: { zh: '人次', en: 'Visitors' },
  indicators: ['visitors'],
  file: 'visitors.json',
  countryField: 'iso3',
  empty: { zh: '這裡沒有博物館有人次的資料', en: 'No visitor figures here' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (num(b.v) ?? 0) - (num(a.v) ?? 0))
      .slice(0, 500)
      .map((p, i): ListRow => {
        const n = museumName(p);
        return {
          key: `mv-${i}-${p.en}`,
          title: `${i + 1}. ${n.title}`,
          properNoun: n.proper,
          lines: [
            country(p, countryName) ?? '',
            num(p.vy) ? tr({ zh: `${p.vy} 年 ${visitorsText(Number(p.v))}`, en: `${visitorsText(Number(p.v))} in ${p.vy}` }) : visitorsText(Number(p.v)),
          ].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      }),
};

const COLLECTION: PointsOverlayDef = {
  kind: 'points',
  id: 'museum-collection',
  file: 'collection.json',
  label: { zh: '有館藏量的博物館', en: 'Museums with a collection size' },
  indicators: ['collection'],
  radius: { field: 'c', stops: [[100, 1.8], [1e4, 3], [1e6, 6], [1e8, 10]] },
  color: C[2],
  sortField: 'c',
  tooltip: (p, ctx) => {
    const n = museumName(p);
    const c = num(p.c);
    return {
      title: n.title,
      detail: country(p, ctx.countryName) ?? '',
      extra: c ? [tr({ zh: `館藏 ${formatLargeNumber(c)} 件`, en: `${formatLargeNumber(c)} items` })] : [],
      properNoun: n.proper,
    };
  },
};

const KINDS: PointsOverlayDef = {
  kind: 'points',
  id: 'museum-kinds',
  file: 'kinds.json',
  label: { zh: '國立與地方博物館（Wikidata 的類別）', en: 'National and local museums (Wikidata classes)' },
  indicators: ['kinds'],
  radius: 3,
  color: {
    field: 'k',
    title: { zh: '類別', en: 'Class' },
    thresholds: [1.5],
    classes: [
      { color: C[3], label: { zh: '國立博物館', en: 'National museum' } },
      { color: C[0], label: { zh: '地方博物館', en: 'Local museum' } },
    ],
  },
  tooltip: (p, ctx) => {
    const n = museumName(p);
    return {
      title: n.title,
      detail: [p.k === 1 ? tr({ zh: '國立博物館', en: 'National museum' }) : tr({ zh: '地方博物館', en: 'Local museum' }), country(p, ctx.countryName)]
        .filter(Boolean)
        .join(' · '),
      properNoun: n.proper,
    };
  },
};

// ── 第二十七批 639：最大的美術館、歐洲城市的博物館人次 ──
const LARGEST: PointsOverlayDef = {
  kind: 'points',
  id: 'largest-art-museums',
  file: 'largest.json',
  label: { zh: '最大的美術館（展覽面積）', en: 'Largest art museums (gallery space)' },
  indicators: ['largest'],
  radius: { field: 'a', stops: [[5000, 3], [15000, 5], [40000, 8], [73000, 11]] },
  color: C[1],
  sortField: 'a',
  tooltip: (p, ctx) => {
    const n = museumName(p);
    return {
      title: n.title,
      detail: [str(p.city), country(p, ctx.countryName)].filter(Boolean).join(', '),
      extra: [
        tr({ zh: `第 ${p.r} 名，展覽面積 ${fixed(Number(p.a), 0)} 平方公尺`, en: `#${p.r}, ${fixed(Number(p.a), 0)} m² of gallery space` }),
        num(p.y) ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null,
        p.ct === 1 ? tr({ zh: '位置是城市', en: 'city location' }) : null,
      ].filter((x): x is string => Boolean(x)),
      properNoun: n.proper,
    };
  },
};
const LARGEST_LIST: ListPanelDef = {
  label: { zh: '最大的美術館', en: 'Largest art museums' },
  tabLabel: { zh: '面積', en: 'Size' },
  indicators: ['largest'],
  file: 'largest.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (num(a.r) ?? 999) - (num(b.r) ?? 999))
      .map((p): ListRow => {
        const n = museumName(p);
        return {
          key: `la-${p.r}-${p.en}`,
          title: `${p.r}. ${n.title}`,
          properNoun: n.proper,
          lines: [[str(p.city), country(p, countryName)].filter(Boolean).join(', '), tr({ zh: `${fixed(Number(p.a), 0)} 平方公尺`, en: `${fixed(Number(p.a), 0)} m²` })],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      }),
};
const CITY_YEARS = Array.from({ length: 36 }, (_, i) => 1990 + i);
const CITY_VISITORS: PointsOverlayDef = {
  kind: 'points',
  id: 'city-museum-visitors',
  file: 'city-visitors.json',
  label: { zh: '歐洲城市一年的博物館參觀人次', en: 'Museum visits a year in European cities' },
  indicators: ['city-visitors'],
  epochs: { years: CITY_YEARS, values: (p, y) => ({ vv: typeof p[`v${y}`] === 'number' ? (p[`v${y}`] as number) : null }) },
  radius: { field: 'vv', stops: [[1e4, 2], [5e5, 4], [5e6, 9], [4e7, 16]] },
  color: C[4],
  minValue: { field: 'vv', stops: [[0, 0]] },
  sortField: 'vv',
  tooltip: (p, { countryName, year }) => {
    const y = Math.max(CITY_YEARS[0], Math.min(CITY_YEARS[CITY_YEARS.length - 1], year ?? 2024));
    const v = p[`v${y}`];
    return {
      title: String(p.name ?? ''),
      detail: country(p, countryName) ?? '',
      extra: typeof v === 'number' ? [tr({ zh: `${y} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${y}` })] : [tr({ zh: `${y} 年沒有資料`, en: `No data for ${y}` })],
      properNoun: String(p.name ?? ''),
    };
  },
};

// ── 第二十七批 640：台灣的古蹟、文化景觀、博物館、工藝之家（文化部） ──
const TW_KINDS = [
  { zh: '國定古蹟', en: 'National monument' },
  { zh: '直轄市定古蹟', en: 'Special municipality monument' },
  { zh: '縣（市）定古蹟', en: 'County or city monument' },
  { zh: '文化景觀', en: 'Cultural landscape' },
  { zh: '博物館（文化部名錄）', en: 'Museum (Ministry of Culture list)' },
  { zh: '工藝之家', en: 'Craft house' },
];
const TW_CULTURE: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-culture',
  file: 'taiwan-culture.json',
  label: { zh: '台灣的古蹟、文化景觀、博物館與工藝之家', en: 'Taiwan’s monuments, cultural landscapes, museums and craft houses' },
  indicators: ['taiwan-culture'],
  radius: { field: 'k', stops: [[1, 4], [3, 2.6], [6, 2.6]] },
  color: {
    field: 'k',
    title: { zh: '類別', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5],
    classes: TW_KINDS.map((label, i) => ({ color: [C[3], C[1], C[0], C[2], C[5], C[4]][i], label })),
  },
  tooltip: (p) => {
    const kind = tr(TW_KINDS[(num(p.k) ?? 1) - 1]);
    return {
      title: str(p.name) ?? kind,
      detail: [kind, str(p.sub), str(p.county)].filter(Boolean).join(' · '),
    };
  },
};
const TW_LIST: ListPanelDef = {
  label: { zh: '台灣的古蹟、文化景觀、博物館與工藝之家', en: 'Taiwan’s monuments, landscapes, museums and craft houses' },
  tabLabel: { zh: '台灣', en: 'Taiwan' },
  indicators: ['taiwan-culture'],
  file: 'taiwan-culture.json',
  rows: (points) => {
    const by = new Map<string, PointRecord[]>();
    for (const p of points) by.set(String(p.county ?? ''), [...(by.get(String(p.county ?? '')) ?? []), p]);
    const rows: ListRow[] = [];
    for (const [county, list] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      list
        .sort((a, b) => (num(a.k) ?? 9) - (num(b.k) ?? 9))
        .forEach((p, i) => {
          const kind = tr(TW_KINDS[(num(p.k) ?? 1) - 1]);
          rows.push({
            key: `tw-${county}-${i}`,
            title: str(p.name) ?? kind,
            lines: [[kind, str(p.sub)].filter(Boolean).join(' · ')],
            group: tr({ zh: `${county || '縣市不詳'}（${list.length}）`, en: `${county || 'Unknown'} (${list.length})` }),
            target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
          });
        });
    }
    return rows;
  },
};

const empty = { zh: '這個指標只有點，國家不上色', en: 'This indicator shows points only' };
const pointsOnly = { unit: '', layer: { kind: 'none' as const }, unranked: true, rankingBars: false as const, panelChart: false as const, format: () => '', timeless: true, missing: empty };

export const museums: TopicDefinition = {
  id: 'museums',
  title: { zh: '博物館與美術館', en: 'Museums and galleries' },
  shortTitle: { zh: '博物館', en: 'Museums' },
  defaultIndicator: 'count',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'OpenStreetMap（tourism=museum，經 QLever 查詢）', en: 'OpenStreetMap (tourism=museum, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    { name: { zh: 'Wikidata（博物館的位置、類別、成立時間、年參觀人次、館藏量）', en: 'Wikidata (museum locations, classes, founding dates, visitors and collection sizes)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '英文維基百科「List of most-visited museums」（人次最多的 62 館）', en: 'English Wikipedia, “List of most-visited museums” (62 museums)' },
      url: 'https://en.wikipedia.org/wiki/List_of_most-visited_museums',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '文化部「博物館」開放資料、交通部觀光署 主要觀光遊憩據點遊客人數（台灣）', en: 'Taiwan Ministry of Culture museum open data and Tourism Administration visitor counts' },
      url: 'https://data.gov.tw/dataset/6242',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    { name: { zh: '聯合國《世界人口展望 2024》（人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
    {
      name: { zh: '英文維基百科「List of largest art museums」（展覽面積）', en: 'English Wikipedia, “List of largest art museums” (gallery space)' },
      url: 'https://en.wikipedia.org/wiki/List_of_largest_art_museums?oldid=1381300801',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Eurostat：城市統計 urb_ctour（博物館參觀人次）', en: 'Eurostat: city statistics urb_ctour (museum visits)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/urb_ctour/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '文化部：查詢單一類別文化設施資料（data.gov.tw 10046）、地方文化館（6244）', en: 'Taiwan Ministry of Culture: cultural facilities (data.gov.tw 10046) and local culture halls (6244)' },
      url: 'https://data.gov.tw/dataset/10046',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '全世界沒有官方的「各國有幾座博物館」：各國的座數與密度用 OpenStreetMap 標成博物館（tourism=museum）的地方，地圖上的點則是 Wikidata 的博物館（景點地圖的同一份），兩份是各自獨立的來源，數字不能混著比。OSM 也有遊客中心、私人收藏室標成博物館，密度同時在量 OSM 畫得多完整，所以每十萬人只替 OSM 覆蓋良好的國家上色。開館年份、人次、館藏量、國立或地方都是 Wikidata 的欄位：成立時間常是建築落成的年份，不一定是開館；人次的年份各館不同；館藏量各館的算法不同（一片陶片算一件或一箱算一件），都不能直接排名。照片沒有放：照片的攝影者與授權要從 Wikimedia Commons 的程式介面讀，那個路徑在 robots.txt 不准程式抓。',
    en: 'There is no official count of museums by country. Country counts and densities use places tagged as museums (tourism=museum) in OpenStreetMap, while the dots on the map are Wikidata museums (the same data as Attractions); the two sources are independent and their numbers should not be compared. OSM also tags visitor centres and private collections as museums, and densities also reflect how completely OSM is mapped, so rates per 100,000 people are shown only for countries well covered by OSM. Founding years, visitors, collection sizes and the national or local class all come from Wikidata: the founding date is often when the building was completed rather than when the museum opened, visitor figures are for different years, and collection sizes are counted differently by each museum (one potsherd or one box as an item), so none of these can be ranked directly. Photos are not shown: photographers and licences would have to be read from the Wikimedia Commons API, whose path robots.txt does not allow programs to fetch.',
  },
  panelExtra: () => import('./panels/AttractionsPanel'),
  overlays: [museumsOverlay(['count', 'per-100k']), OPENED, VISITORS, COLLECTION, KINDS, LARGEST, CITY_VISITORS, TW_CULTURE],
  listPanel: [VISITOR_LIST, LARGEST_LIST, TW_LIST],
  indicators: [
    {
      id: 'count',
      label: { zh: '各國有幾座博物館（OSM）', en: 'Museums by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成博物館的地方：全世界 111,345 座、213 國。美國 14,945 座最多，德國 9,529、日本 6,757、義大利 6,552、俄羅斯 5,921、法國 5,219、中國 5,111；台灣 724 座。點是 Wikidata 的博物館（顏色是類型，縮小時只畫有名的），跟 OSM 的座數是不同來源。', en: 'Places tagged as museums in OpenStreetMap: 111,345 in 213 countries. The US has the most (14,945), followed by Germany (9,529), Japan (6,757), Italy (6,552), Russia (5,921), France (5,219) and China (5,111); Taiwan has 724. The dots are Wikidata museums (coloured by type; only well-known ones when zoomed out), a different source from the OSM counts.' },
      unit: { zh: '座', en: 'museums' },
      file: 'count.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} museums` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'per-100k',
      label: { zh: '每十萬人有幾座博物館（OSM）', en: 'Museums per 100,000 people (OSM)' },
      description: { zh: 'OSM 的博物館座數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。冰島每十萬人 43.2 座最多，愛沙尼亞 25.7、挪威 22.3、芬蘭 22.1；德國 11.3、法國 7.8、日本 5.5、英國 4.5、美國 4.3、台灣 3.1、南韓 3.1。', en: 'OSM museums divided by 2024 population, shown only for the 93 countries well covered by OSM. Iceland has the most per 100,000 people (43.2), followed by Estonia (25.7), Norway (22.3) and Finland (22.1); Germany has 11.3, France 7.8, Japan 5.5, the UK 4.5, the US 4.3, Taiwan 3.1 and South Korea 3.1.' },
      unit: { zh: '座/十萬人', en: 'per 100,000 people' },
      file: 'per-100k.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      timeless: true,
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, v < 1 ? 2 : 1)} 座`, en: `${fixed(v, v < 1 ? 2 : 1)} per 100,000` }),
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
    },
    {
      id: 'first',
      label: { zh: '博物館的開館年份', en: 'When museums were founded' },
      description: { zh: 'Wikidata 上有成立時間的 29,673 座博物館，拉時間軸看它們一座一座出現（1700 年以前的 851 座在 1700 年就畫）。1900 年代成立的 17,225 座最多，2000 年以後 8,676 座，1800 年代 2,396 座。成立時間常是建築落成的年份：古堡、教堂、故居改成的博物館會早得不合理，台灣最早的是 1835 年的金廣福公館。', en: 'The 29,673 museums with a founding date in Wikidata; move the time slider to watch them appear (the 851 founded before 1700 are drawn from 1700). Most were founded in the 1900s (17,225), followed by 2000 or later (8,676) and the 1800s (2,396). The founding date is often when the building was completed, so museums in castles, churches and historic houses look implausibly old; Taiwan’s earliest is the Jinguangfu Residence of 1835.' },
      unit: { zh: '年', en: '' },
      file: 'first.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `${v} 年`, en: String(v) }),
      formatTick: (v) => String(v),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      overlayTime: 'cumulative',
      defaultYear: 2026,
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    { id: 'visitors', label: { zh: '博物館的年參觀人次', en: 'Museum visitors a year' }, description: { zh: '有一年參觀人次的 7,084 座博物館：英文維基「最多人造訪的博物館」表上的 59 館與台灣的 5 館優先，其餘 7,020 座是 Wikidata 的年參觀人次（取最新的一年；相距 1 公里內跟維基表重複的不畫）。點的大小與顏色是人次：125 萬以上 105 座、10 萬到 125 萬 756 座。最多的是曼谷大皇宮 2,206 萬（2023）、北京故宮 1,930 萬（2019）、羅浮宮 900 萬（2025）；台灣的海科館 326 萬、科教館 298 萬、科博館 285 萬、故宮 187 萬（2024）。各館的年份不同，Wikidata 的皇家安大略博物館寫 2.8 億人次明顯打錯，沒有畫。左邊的清單依人次排。', en: 'The 7,084 museums with annual visitor figures: the 59 in English Wikipedia’s list of most-visited museums and 5 in Taiwan take priority, and the other 7,020 come from Wikidata (the latest year; those within 1 km of a museum in the list are not drawn twice). Dot size and colour show visitors: 105 have 1.25 million or more and 756 between 100,000 and 1.25 million. The most visited are the Grand Palace in Bangkok (22.1 million, 2023), the Forbidden City in Beijing (19.3 million, 2019) and the Louvre (9.0 million, 2025); in Taiwan the National Museum of Marine Science and Technology had 3.26 million, the National Taiwan Science Education Center 2.98 million, the National Museum of Natural Science 2.85 million and the National Palace Museum 1.87 million (2024). Years differ by museum; Wikidata’s 281 million for the Royal Ontario Museum is clearly an error and is not drawn. The list on the left ranks them by visitors.' }, file: 'count.json', ...pointsOnly },
    { id: 'collection', label: { zh: '博物館的館藏量', en: 'Museum collection sizes' }, description: { zh: 'Wikidata 上有館藏量（P1436）的 4,851 座博物館，點的大小是件數。倫敦自然史博物館 8,000 萬件最多，維也納自然史博物館 3,000 萬、巴西國家博物館 2,000 萬、日內瓦自然史博物館 1,500 萬；自然史博物館的標本動輒上千萬。各館的算法不同（一片陶片算一件或一箱算一件），不排名。台灣只有鹿港民俗文物館（6,000 件）有這個欄位。', en: 'The 4,851 museums with a collection size (P1436) in Wikidata, sized by number of items. The Natural History Museum in London has the most (80 million), followed by the Natural History Museum in Vienna (30 million), Brazil’s National Museum (20 million) and Geneva’s Natural History Museum (15 million); natural history collections often run to tens of millions of specimens. Museums count items differently (one potsherd or one box as an item), so they are not ranked. In Taiwan only the Lukang Folk Arts Museum (6,000 items) has this field.' }, file: 'count.json', ...pointsOnly },
    { id: 'kinds', label: { zh: '國立與地方博物館', en: 'National and local museums' }, description: { zh: 'Wikidata 把博物館分成國立博物館（含子類別）1,048 座、地方博物館 2,645 座，合起來只占畫出來的博物館的一小部分，所以只畫點、不算各國的比例。國立博物館最多的是義大利 443 座，英國 61、法國 44、泰國 27；台灣 15 座，包括故宮、科博館、史前館等，沒有標成地方博物館的。很多國家的「國家××博物館」只是名字，不一定是國家辦的。', en: 'Wikidata classes 1,048 museums as national museums (including subclasses) and 2,645 as local museums, only a small share of all the museums drawn, so these are shown as dots rather than national shares. Italy has the most national museums (443), followed by the UK (61), France (44) and Thailand (27); Taiwan has 15, including the National Palace Museum, the National Museum of Natural Science and the National Museum of Prehistory, and none classed as local. In many countries a “national museum” is just a name and not necessarily run by the state.' }, file: 'count.json', ...pointsOnly },
    // 2026-11-08（製作手冊第二十七批 639）最大的美術館、歐洲城市的博物館人次、畫廊
    { id: 'largest', label: { zh: '最大的美術館', en: 'Largest art museums' }, description: { zh: '英文維基「最大的美術館」表上的 131 館（34 國），點的大小是展覽面積（gallery space，不是總樓地板，各館的出處不一）。羅浮宮 72,735 平方公尺第一，大英博物館 70,000、艾米塔吉 66,842、中國國家博物館 65,000、大都會 58,800、梵蒂岡博物館 43,000。依國家是美國 32 館、德國 14、義大利 12、法國與中國各 9、西班牙 5。台灣 3 館：國立臺灣美術館 13,600 平方公尺（第 55）、臺北市立美術館 11,700（第 79）、故宮 9,613（第 104）。4 館在 Wikidata 沒有座標，沒有畫。大不等於人多；左邊的清單依面積排。', en: 'The 131 museums (in 34 countries) in English Wikipedia’s list of largest art museums, sized by gallery space (not total floor area; sources vary by museum). The Louvre is largest at 72,735 m², followed by the British Museum (70,000), the Hermitage (66,842), the National Museum of China (65,000), the Met (58,800) and the Vatican Museums (43,000). By country the US has 32, Germany 14, Italy 12, France and China 9 each and Spain 5. Taiwan has 3: the National Taiwan Museum of Fine Arts (13,600 m², #55), Taipei Fine Arts Museum (11,700, #79) and the National Palace Museum (9,613, #104). Four have no coordinates in Wikidata and are not drawn. Bigger does not mean busier; the list on the left ranks them by size.' }, file: 'count.json', ...pointsOnly },
    {
      id: 'city-visitors',
      label: { zh: '歐洲城市的博物館參觀人次', en: 'Museum visits in European cities' },
      description: { zh: 'Eurostat 城市統計（Urban Audit）的「一年的博物館參觀人次」，歐洲 664 個城市與都會區（有 greater city 的城市只留都會區，不重複）、1990–2025 年，拖時間軸看各年；點的大小是人次。2024 年 214 個地區有值：巴黎都會區 4,110 萬最多，華沙 1,354 萬、克拉科夫 673 萬、布魯塞爾都會區 502 萬、布達佩斯都會區 461 萬、里斯本都會區 453 萬；2022 年羅馬 2,331 萬、佛羅倫斯 957 萬、拿坡里都會區 895 萬。各國、各年回報的城市不同，2020、2021 年是疫情。55 個地區找不到位置沒有畫；英國的城市照網站的 Eurostat 規則不收。', en: 'Eurostat’s city statistics (Urban Audit) on annual museum visits: 664 European cities and metropolitan areas (where a greater city exists, only it is kept, to avoid double counting), 1990–2025; drag the time slider for each year, with dots sized by visits. In 2024, 214 areas reported: greater Paris had the most (41.1 million), followed by Warsaw (13.5 million), Kraków (6.7 million), greater Brussels (5.0 million), greater Budapest (4.6 million) and greater Lisbon (4.5 million); in 2022 Rome had 23.3 million, Florence 9.6 million and greater Naples 8.9 million. Different cities report in different countries and years, and 2020–2021 were pandemic years. 55 areas could not be located and are not drawn; UK cities are excluded under this site’s Eurostat rule.' },
      unit: '',
      file: 'city-visitors-years.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2024,
      focus: [-25, 34, 45, 71],
      missing: { zh: '國家不上色，看地圖上的城市', en: 'Countries are not coloured; see the cities on the map' },
    },
    {
      id: 'galleries',
      label: { zh: '畫廊（OSM）', en: 'Art galleries (OSM)' },
      description: { zh: 'OpenStreetMap 上標成畫廊（tourism=gallery）的地方：22,426 家、176 國。美國 4,498 家最多，法國 2,377、德國 2,342、英國 1,270、澳洲 713、加拿大 638、日本 621；台灣 102 家。多半是商業畫廊，跟博物館圖層裡 Wikidata 的美術館不是同一種。', en: 'Places tagged as art galleries (tourism=gallery) in OpenStreetMap: 22,426 in 176 countries. The US has the most (4,498), followed by France (2,377), Germany (2,342), the UK (1,270), Australia (713), Canada (638) and Japan (621); Taiwan has 102. Most are commercial galleries, unlike the Wikidata art museums in the museum layer.' },
      unit: { zh: '家', en: 'galleries' },
      file: 'galleries.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} galleries` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'galleries-per-million',
      label: { zh: '每百萬人有幾家畫廊（OSM）', en: 'Art galleries per million people (OSM)' },
      description: { zh: 'OSM 的畫廊家數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。冰島每百萬人 76.3 家最多，挪威 49.0、愛沙尼亞 44.8、丹麥 42.5；法國 35.7、德國 27.7、英國 18.4、美國 13.0、南韓 9.2、日本 5.0、台灣 4.4。', en: 'OSM art galleries divided by 2024 population, shown only for the 93 countries well covered by OSM. Iceland has the most per million people (76.3), followed by Norway (49.0), Estonia (44.8) and Denmark (42.5); France has 35.7, Germany 27.7, the UK 18.4, the US 13.0, South Korea 9.2, Japan 5.0 and Taiwan 4.4.' },
      unit: { zh: '家/百萬人', en: 'per million people' },
      file: 'galleries-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 80] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => fixed(v, 0),
    },
    // 2026-11-08（製作手冊第二十七批 640）台灣的文化設施
    {
      id: 'taiwan-culture',
      label: { zh: '台灣的古蹟、文化景觀、博物館與工藝之家', en: 'Taiwan’s monuments, landscapes, museums and craft houses' },
      description: { zh: '文化部的文化設施資料（使用者用瀏覽器存檔）裡有座標的 1,440 處：古蹟 1,062 處（國定 112、直轄市定 522、縣（市）定 428）、文化景觀 85 處、文化部博物館名錄 131 館、工藝之家 162 處。古蹟最多的是臺北市 206 處、臺南市 142、金門縣 96。這份資料的文化資產幾乎只有古蹟，歷史建築、聚落等不在裡面；地方文化館 260 館與展演空間 44 筆沒有座標，不畫（地方文化館最多的是高雄市 24 館、屏東縣 22、桃園市 21）。工藝之家多半用工藝家本人的名字命名，地圖上只寫「工藝之家」。左邊的清單依縣市列出。', en: 'The 1,440 places with coordinates in Taiwan’s Ministry of Culture facility data (saved by the user with a browser): 1,062 monuments (112 national, 522 special municipality and 428 county or city), 85 cultural landscapes, 131 museums on the ministry’s list and 162 craft houses. Taipei has the most monuments (206), followed by Tainan (142) and Kinmen (96). The cultural heritage in this data is almost all monuments, without historic buildings or settlements; the 260 local culture halls and 44 performance spaces have no coordinates and are not drawn (Kaohsiung has the most local culture halls, 24, followed by Pingtung 22 and Taoyuan 21). Craft houses are mostly named after the craftsperson, so the map only labels them “craft house”. The list on the left groups them by county.' },
      file: 'count.json',
      ...pointsOnly,
      focus: [119.3, 21.8, 122.1, 25.4],
    },
  ],
};
