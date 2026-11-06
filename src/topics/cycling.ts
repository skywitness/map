import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { LinesOverlayDef, ListPanelDef, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 自行車路線與騎車通勤（2026-11-04，製作手冊第二十一批 364、365；pipeline/topics/cycling.py）：
 * OpenStreetMap（經 QLever）的國際級、國家級自行車路線（route=bicycle，network=icn、ncn），台灣另畫觀光署的自行車道；
 * 歐洲城市騎自行車上班的比例（Eurostat Urban Audit，城市位置用 Wikidata）。
 */

const LEVELS: { value: number; label: Text; short: Text; color: string }[] = [
  { value: 1, label: { zh: '國際級（EuroVelo 等）', en: 'International (EuroVelo and others)' }, short: { zh: '國際級', en: 'International' }, color: MAP_TOKENS.categorical[7] },
  { value: 2, label: { zh: '國家級', en: 'National' }, short: { zh: '國家級', en: 'National' }, color: MAP_TOKENS.categorical[1] },
  {
    value: 3,
    label: { zh: '台灣觀光署的自行車道（國家風景區）', en: 'Taiwan Tourism Administration cycle paths (national scenic areas)' },
    short: { zh: '觀光署自行車道', en: 'Tourism Administration path' },
    color: MAP_TOKENS.categorical[2],
  },
];
const levelLabel = (t: unknown) => tr(LEVELS.find((l) => l.value === t)?.short ?? '');

function routeName(p: { n?: unknown; e?: unknown; z?: unknown; ref?: unknown }): string {
  const pick = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const name = getLang() === 'zh' ? (pick(p.z) ?? pick(p.n) ?? pick(p.e)) : (pick(p.e) ?? pick(p.n) ?? pick(p.z));
  return name ?? String(p.ref ?? '');
}

const kmText = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });

const countryList = (c: unknown, countryName: (iso3: string) => string) =>
  typeof c === 'string' && c ? c.split(',').map((x) => countryName(x)).join(tr({ zh: '、', en: ', ' })) : null;

const ROUTES: LinesOverlayDef = {
  kind: 'lines',
  id: 'routes',
  file: 'routes.json',
  label: { zh: '自行車路線', en: 'Cycle routes' },
  width: 1.3,
  color: { title: { zh: '等級', en: 'Level' }, classes: LEVELS.map(({ value, label, color }) => ({ value, label, color })) },
  groupField: 'g',
  hoverHalo: true,
  indicators: ['map', 'ncn-km', 'icn-km'],
  tooltip: (p, { countryName }) => {
    const name = routeName(p);
    return {
      title: name,
      detail: [levelLabel(p.t), typeof p.km === 'number' && p.km > 0 ? kmText(p.km) : null, typeof p.ref === 'string' && p.ref !== name ? p.ref : null]
        .filter(Boolean)
        .join(' · '),
      extra: [countryList(p.c, countryName)].filter((x): x is string => Boolean(x)),
      properNoun: typeof p.n === 'string' && p.n && p.n !== name ? p.n : undefined,
    };
  },
};

const SHARE_CLASSES = [
  { label: { zh: '不到 5%', en: 'Under 5%' }, color: '#e9e4d8' },
  { label: '5–10%', color: '#b6dcc9' },
  { label: '10–20%', color: '#6cc0a0' },
  { label: '20–30%', color: '#2a9d78' },
  { label: { zh: '30% 以上', en: '30% or more' }, color: '#0b6b4f' },
];

function cityFacts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  return [
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, p.g === 1 ? tr({ zh: '大城市範圍', en: 'greater city' }) : null].filter(Boolean).join(' · '),
    tr({ zh: `騎自行車上班 ${fixed(Number(p.v), 1)}%（${p.y} 年）`, en: `${fixed(Number(p.v), 1)}% cycle to work (${p.y})` }),
  ];
}

const CITIES: PointsOverlayDef = {
  kind: 'points',
  id: 'cities',
  file: 'cities.json',
  indicators: ['commute'],
  label: { zh: '騎自行車上班的比例（城市）', en: 'Share cycling to work (cities)' },
  radius: { field: 'v', stops: [[0, 3], [40, 7]] },
  color: { field: 'v', title: { zh: '騎自行車上班的比例', en: 'Share cycling to work' }, thresholds: [5, 10, 20, 30], classes: SHARE_CLASSES },
  sortField: 'v',
  tooltip: (p, { countryName }) => ({ title: String(p.n ?? ''), extra: cityFacts(p, countryName), properNoun: String(p.n ?? '') }),
};

const ROUTE_LIST: ListPanelDef = {
  label: { zh: '最長的自行車路線', en: 'Longest cycle routes' },
  indicators: ['map', 'ncn-km', 'icn-km'],
  file: 'list.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(b.km) - Number(a.km))
      .map((p) => {
        const name = routeName(p);
        return {
          key: String(p.g),
          title: name,
          lines: [[levelLabel(p.t), kmText(Number(p.km))].join(' · '), countryList(p.c, countryName) ?? ''].filter(Boolean),
          properNoun: typeof p.n === 'string' && p.n && p.n !== name ? p.n : undefined,
          target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] as [number, number, number, number] },
          line: { overlay: 'routes', group: Number(p.g) },
        };
      }),
};

const CITY_LIST: ListPanelDef = {
  label: { zh: '騎自行車上班的比例（依比例）', en: 'Cities by share cycling to work' },
  indicators: ['commute'],
  file: 'cities.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(b.v) - Number(a.v))
      .map((p, i) => ({
        key: `${p.n}-${i}`,
        title: String(p.n ?? ''),
        titleProper: true,
        lines: cityFacts(p, countryName),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
      })),
};

const OSM_NOTE: Text = {
  zh: 'OSM 的「國際級」「國家級」由各國的繪圖者標記，用法不一，美國的國家級路線多半是美國自行車路線系統（USBR），日本是太平洋岸自行車道等；總長依每一段經過的國家分，同一級網路裡重疊的路段只算一次。只替 OSM 覆蓋良好的國家上色。',
  en: 'OSM’s “international” and “national” levels are tagged by each country’s mappers and used differently: most US national routes are U.S. Bicycle Routes, and Japan’s include the Pacific Coast Cycling Road. Lengths are split by the countries each section passes through, with overlapping sections in the same network counted once. Only countries where OSM is reasonably complete are coloured.',
};

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個城市`, en: `${fixed(v, 0)} cities` });

export const cycling: TopicDefinition = {
  id: 'cycling',
  title: { zh: '自行車路線與騎車通勤', en: 'Cycle routes and cycling to work' },
  shortTitle: { zh: '自行車', en: 'Cycling' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 的自行車路線（route=bicycle，國際級、國家級），經 QLever 查詢（2026 年 11 月）', en: 'OpenStreetMap cycle routes (route=bicycle, international and national), queried via QLever (November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap 貢獻者；資料檔也是）', en: 'ODbL 1.0 (© OpenStreetMap contributors; so are the data files)' },
    },
    {
      name: { zh: '交通部觀光署：自行車道（政府資料開放平臺 41652）', en: 'Tourism Administration (Taiwan): cycle paths (data.gov.tw 41652)' },
      url: 'https://data.gov.tw/dataset/41652',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: 'Eurostat：Urban Audit 城市統計（urb_ctran，TT1007V 騎自行車上班的比例）', en: 'Eurostat: Urban Audit (urb_ctran, TT1007V share of journeys to work by bicycle)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/urb_ctran/default/table',
      license: 'CC BY 4.0',
    },
    { name: { zh: 'Wikidata（城市的位置）', en: 'Wikidata (city locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '路線是 OpenStreetMap 上標成國際級（network=icn，例如 EuroVelo）與國家級（ncn）的自行車路線，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享）：EuroVelo 這類跨國路線在 OSM 裡是各國分段，畫的是各段；有人畫才有，歐洲、北美畫得多。台灣的環島 1 號線與各條環線在 OSM 是國家級；另外畫觀光署開放資料的 59 條自行車道（只有國家風景區轄內，不算進總長）。OSM 上台灣唯一的國際級是「台灣自行車登山王挑戰」的東進武嶺路線。區域級（rcn）在德國、荷蘭是兩萬多條節點路網，跟其他國家不是同一回事，沒有畫。騎車上班的比例是 Eurostat 城市統計（只有歐洲），每個城市用最近一次有資料的年份，2003 到 2024 年都有（點上寫年份），近年回報的城市很少；城市的位置依名稱對 Wikidata。Eurostat 的自行車道長度各國混用公里與公尺（柏林寫 1,073,473 公里），對不出單位，沒有用。',
    en: 'Routes are cycle routes tagged in OpenStreetMap as international (network=icn, such as EuroVelo) or national (ncn), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0). Cross-border routes such as EuroVelo are split into national sections in OSM, and the sections are drawn; only mapped routes appear, and Europe and North America are mapped most. Taiwan’s Cycling Route No. 1 round the island and its loops are national routes in OSM; the Tourism Administration’s 59 cycle paths (only in national scenic areas, not counted in the totals) are drawn as well. Taiwan’s only “international” route in OSM is the course of the Taiwan KOM Challenge up to Wuling. Regional routes (rcn), tens of thousands of node-network links in Germany and the Netherlands, are not comparable with other countries and are not drawn. The share cycling to work comes from Eurostat’s city statistics (Europe only), using each city’s most recent year with data, anywhere from 2003 to 2024 (the year is on each dot); few cities have reported recently. City locations come from matching names to Wikidata. Eurostat’s cycle-network lengths mix kilometres and metres between countries (Berlin is given as 1,073,473 km), so they are not used.',
  },
  listPanel: [ROUTE_LIST, CITY_LIST],
  overlays: [ROUTES, CITIES],
  indicators: [
    {
      id: 'map',
      label: { zh: '自行車路線地圖', en: 'Cycle route map' },
      description: {
        zh: 'OpenStreetMap 標成國際級（洋紅）、國家級（紫色）的自行車路線，黃色是台灣觀光署的自行車道。最長的國家級路線有加拿大魁北克的 Route Verte 1（2,077 公里）、日本的太平洋岸自行車道（1,526 公里）；EuroVelo 各國分段最長的是芬蘭與義大利的段（約 1,600 公里）。滑到線上看路線名稱與長度；左邊的清單列出最長的 150 條，點了地圖移過去。',
        en: 'Cycle routes tagged in OpenStreetMap as international (magenta) or national (purple); Taiwan Tourism Administration cycle paths are yellow. The longest national routes include Quebec’s Route Verte 1 (2,077 km) and Japan’s Pacific Coast Cycling Road (1,526 km); the longest EuroVelo sections are in Finland and Italy (about 1,600 km). Hover over a line for its name and length; the list on the left shows the 150 longest, and clicking one moves the map there.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'ncn-km.json',
      layer: { kind: 'none' },
      shade: 'land',
      format: kmText,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
    {
      id: 'ncn-km',
      label: { zh: '國家級自行車路線總長', en: 'National cycle routes, total length' },
      description: {
        zh: `國土裡國家級自行車路線的總長。美國 54,831 公里最多，法國 20,233、英國 19,941、加拿大 17,562、德國 13,147、瑞典 10,810；比利時 6,149、丹麥 4,928、荷蘭 3,677（荷蘭主要是區域級的節點路網，沒有算）、日本 3,043、南韓 2,535。台灣 3,845 公里（環島 1 號線順、逆時針兩條只算一次，加上各條環線與支線）。${OSM_NOTE.zh}`,
        en: `Total length of national cycle routes within each country. The US has the most at 54,831 km, followed by France 20,233, the UK 19,941, Canada 17,562, Germany 13,147 and Sweden 10,810; Belgium 6,149, Denmark 4,928, the Netherlands 3,677 (mostly regional node networks, not counted), Japan 3,043 and South Korea 2,535. Taiwan has 3,845 km (Cycling Route No. 1, mapped once in each direction, counted once, plus its loops and branches). ${OSM_NOTE.en}`,
      },
      unit: { zh: '公里', en: 'km' },
      file: 'ncn-km.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 1000, 3000, 10000, 30000] } },
      format: kmText,
      formatTick: (v) => formatLargeNumber(v),
      integer: true,
    },
    {
      id: 'icn-km',
      label: { zh: '國際級自行車路線總長', en: 'International cycle routes, total length' },
      description: {
        zh: `國土裡國際級自行車路線（多半是 EuroVelo）的總長。德國 10,691 公里最多，法國 8,270、義大利 5,222、英國 5,064；荷蘭 1,333、丹麥 376、美國 260。台灣 98 公里是 OSM 把「台灣自行車登山王挑戰」的路線標成國際級。${OSM_NOTE.zh}`,
        en: `Total length of international cycle routes (mostly EuroVelo) within each country. Germany has the most at 10,691 km, followed by France 8,270, Italy 5,222 and the UK 5,064; the Netherlands 1,333, Denmark 376 and the US 260. Taiwan’s 98 km is the Taiwan KOM Challenge course, tagged as international in OSM. ${OSM_NOTE.en}`,
      },
      unit: { zh: '公里', en: 'km' },
      file: 'icn-km.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 500, 1000, 3000, 10000] } },
      format: kmText,
      formatTick: (v) => formatLargeNumber(v),
      integer: true,
    },
    {
      id: 'commute',
      label: { zh: '騎自行車上班的比例（歐洲城市）', en: 'Share cycling to work (European cities)' },
      description: {
        zh: '歐洲 447 個城市騎自行車上班的比例（Eurostat，每個城市最近一次有資料的年份）。德國的格來斯瓦德 38.1%（2016 年）最高，荷蘭的格羅寧根 37.0%（2003 年）、德國的明斯特 36.6%（2016 年）、芬蘭的庫奧皮奧 35.6%（2011 年）；柏林 12.8%（2016 年）、巴黎 3.4%（2020 年）。年份差很多（2011 年 137 個城市、2016 年 127 個、2020 年 76 個，2024 年只有 10 個），點上寫年份。台灣沒有可以比的城市統計。',
        en: 'Share of commuters cycling to work in 447 European cities (Eurostat, each city’s most recent year with data). Greifswald in Germany is highest at 38.1% (2016), followed by Groningen in the Netherlands 37.0% (2003), Münster in Germany 36.6% (2016) and Kuopio in Finland 35.6% (2011); Berlin 12.8% (2016) and Paris 3.4% (2020). Years vary a lot (137 cities in 2011, 127 in 2016, 76 in 2020 and only 10 in 2024); each dot shows its year. Taiwan has no comparable city statistics.',
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'cities-count.json',
      layer: { kind: 'none' },
      format: count,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
  ],
};
