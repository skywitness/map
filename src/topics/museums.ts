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
  ],
  note: {
    zh: '全世界沒有官方的「各國有幾座博物館」：各國的座數與密度用 OpenStreetMap 標成博物館（tourism=museum）的地方，地圖上的點則是 Wikidata 的博物館（景點地圖的同一份），兩份是各自獨立的來源，數字不能混著比。OSM 也有遊客中心、私人收藏室標成博物館，密度同時在量 OSM 畫得多完整，所以每十萬人只替 OSM 覆蓋良好的國家上色。開館年份、人次、館藏量、國立或地方都是 Wikidata 的欄位：成立時間常是建築落成的年份，不一定是開館；人次的年份各館不同；館藏量各館的算法不同（一片陶片算一件或一箱算一件），都不能直接排名。照片沒有放：照片的攝影者與授權要從 Wikimedia Commons 的程式介面讀，那個路徑在 robots.txt 不准程式抓。',
    en: 'There is no official count of museums by country. Country counts and densities use places tagged as museums (tourism=museum) in OpenStreetMap, while the dots on the map are Wikidata museums (the same data as Attractions); the two sources are independent and their numbers should not be compared. OSM also tags visitor centres and private collections as museums, and densities also reflect how completely OSM is mapped, so rates per 100,000 people are shown only for countries well covered by OSM. Founding years, visitors, collection sizes and the national or local class all come from Wikidata: the founding date is often when the building was completed rather than when the museum opened, visitor figures are for different years, and collection sizes are counted differently by each museum (one potsherd or one box as an item), so none of these can be ranked directly. Photos are not shown: photographers and licences would have to be read from the Wikimedia Commons API, whose path robots.txt does not allow programs to fetch.',
  },
  panelExtra: () => import('./panels/AttractionsPanel'),
  overlays: [museumsOverlay(['count', 'per-100k']), OPENED, VISITORS, COLLECTION, KINDS],
  listPanel: [VISITOR_LIST],
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
  ],
};
