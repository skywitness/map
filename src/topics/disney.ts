import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { DimensionDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 迪士尼（新主題，2026-11-08，製作手冊第二十八批 673，候選 1478、1484、1492；旅遊・樂園；pipeline/topics/disney.py）。
 * 據點是手工白名單（pipeline/data/disney/places.csv）的 QID，座標與面積從 Wikidata；人次沿用景點地圖的樂園人次。
 * 商標的硬規則（手冊第二十八批）：不放任何 logo 或品牌配色（顏色用網站的分類色盤），說明文字自己寫，不放購票或官網連結，
 * 不寫「官方」「合作」「授權」這類字。度假區與樂園是兩層，不混算。
 */

const C = MAP_TOKENS.categorical;

/** 度假區（pipeline 的 RESORTS 同樣的順序，代碼是索引 + 1） */
export const RESORTS: { id: string; label: Text }[] = [
  { id: 'wdw', label: { zh: '華特迪士尼世界（佛羅里達）', en: 'Walt Disney World (Florida)' } },
  { id: 'dlr', label: { zh: '加州迪士尼樂園度假區', en: 'Disneyland Resort (California)' } },
  { id: 'tdr', label: { zh: '東京迪士尼度假區', en: 'Tokyo Disney Resort' } },
  { id: 'dlp', label: { zh: '巴黎迪士尼樂園度假區', en: 'Disneyland Paris' } },
  { id: 'hkdr', label: { zh: '香港迪士尼樂園度假區', en: 'Hong Kong Disneyland Resort' } },
  { id: 'shdr', label: { zh: '上海迪士尼度假區', en: 'Shanghai Disney Resort' } },
  { id: 'adr', label: { zh: '阿布達比（已宣布）', en: 'Abu Dhabi (announced)' } },
];
const KINDS: { label: Text; color: string }[] = [
  { label: { zh: '主題樂園', en: 'Theme park' }, color: C[0] },
  { label: { zh: '水上樂園', en: 'Water park' }, color: C[1] },
  { label: { zh: '度假區', en: 'Resort' }, color: C[4] },
  { label: { zh: '其他（小島、室內遊樂館）', en: 'Other (island, indoor centre)' }, color: C[3] },
];
const STATUS: Text[] = [
  { zh: '營運中', en: 'Open' },
  { zh: '已關閉', en: 'Closed' },
  { zh: '已宣布', en: 'Announced' },
];

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);
const at = <T,>(list: T[], code: unknown) => list[(typeof code === 'number' ? code : 1) - 1] ?? list[0];

/** 中文介面用官方或常用的中文名，沒有就用英文（不自己翻譯） */
export function disneyName(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.en ?? '');
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

const visitorsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const areaText = (km2: number) =>
  km2 >= 1 ? tr({ zh: `${fixed(km2, 1)} 平方公里`, en: `${fixed(km2, 1)} km²` }) : tr({ zh: `${fixed(km2 * 100, 0)} 公頃`, en: `${fixed(km2 * 100, 0)} ha` });

function facts(p: PointRecord): string[] {
  const y = num(p, 'y');
  const yc = num(p, 'yc');
  const area = num(p, 'area');
  const v24 = num(p, 'v2024');
  const v19 = num(p, 'v2019');
  const out: string[] = [];
  if (y) out.push(yc ? tr({ zh: `${y}–${yc} 年`, en: `${y}–${yc}` }) : tr({ zh: `${y} 年開幕`, en: `Opened ${y}` }));
  else out.push(tr({ zh: '還沒有開幕年', en: 'No opening year yet' }));
  if (v24) out.push(tr({ zh: `2024 年 ${visitorsText(v24)}`, en: `${visitorsText(v24)} in 2024` }) + (v19 ? tr({ zh: `（2019 年 ${formatLargeNumber(v19)}）`, en: ` (2019: ${formatLargeNumber(v19)})` }) : ''));
  if (area) out.push(tr({ zh: `面積 ${areaText(area)}（Wikidata）`, en: `Area ${areaText(area)} (Wikidata)` }));
  if (getLang() === 'zh' && typeof p.note === 'string' && p.note) out.push(p.note);
  return out;
}

function tooltip(p: PointRecord, { countryName }: { countryName: (iso3: string) => string }) {
  const { title, proper } = disneyName(p);
  const detail = [tr(at(KINDS, p.kind).label), num(p, 'kind') === 3 ? null : tr(at(RESORTS, p.resort).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
    .filter(Boolean)
    .join(' · ');
  return { title, detail, extra: facts(p), properNoun: proper };
}

/** 樂園那一層的點沒有度假區（度假區另一層畫大圈），所以只分主題樂園、水上樂園、其他（代碼 4） */
const KIND_COLORS = {
  field: 'kind',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5, 2.5],
  classes: [KINDS[0], KINDS[1], KINDS[3]].map(({ label, color }) => ({ label, color })),
};

const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-sites',
  file: 'sites.json',
  label: { zh: '迪士尼的樂園（依開幕年出現，已關閉的在關閉那年消失）', en: 'Disney parks (appear in their opening year; closed ones disappear)' },
  indicators: ['parks'],
  radius: { field: 'kind', stops: [[1, 6], [2, 4], [4, 3]] },
  color: KIND_COLORS,
  timeField: 'y',
  endField: 'yc',
  sortField: 'kind',
  tooltip,
};
const RESORT_RINGS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-resorts',
  file: 'resorts.json',
  label: { zh: '度假區', en: 'Resorts' },
  indicators: ['parks'],
  radius: 11,
  look: 'faint',
  color: KINDS[2].color,
  timeField: 'y',
  tooltip,
};
const PLANNED: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-planned',
  file: 'planned.json',
  label: { zh: '已宣布、還沒開幕', en: 'Announced, not yet open' },
  indicators: ['parks'],
  radius: 6,
  look: 'hollow',
  color: KINDS[0].color,
  tooltip,
};

/** 清單的組：六個度假區、已關閉、已宣布 */
function groupOf(p: PointRecord): { order: number; label: string } {
  if (p.status === 2) return { order: 90, label: tr({ zh: '已關閉', en: 'Closed' }) };
  if (p.status === 3) return { order: 91, label: tr({ zh: '已宣布', en: 'Announced' }) };
  const i = (typeof p.resort === 'number' ? p.resort : 1) - 1;
  return { order: i, label: tr(RESORTS[i].label) };
}

const PARK_LIST: ListPanelDef = {
  label: { zh: '迪士尼的樂園', en: 'Disney parks' },
  tabLabel: { zh: '樂園', en: 'Parks' },
  indicators: ['parks'],
  file: 'places.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.kind !== 3)
      .map((p) => ({ p, g: groupOf(p) }))
      .sort((a, b) => a.g.order - b.g.order || (num(b.p, 'v2024') ?? -1) - (num(a.p, 'v2024') ?? -1) || (num(a.p, 'y') ?? 9999) - (num(b.p, 'y') ?? 9999))
      .map(({ p, g }): ListRow => {
        const { title, proper } = disneyName(p);
        const v24 = num(p, 'v2024');
        const y = num(p, 'y');
        const yc = num(p, 'yc');
        return {
          key: String(p.qid),
          title,
          properNoun: proper,
          group: g.label,
          muted: p.status !== 1,
          lines: [
            [tr(at(KINDS, p.kind).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '),
            [
              y ? (yc ? tr({ zh: `${y}–${yc} 年`, en: `${y}–${yc}` }) : tr({ zh: `${y} 年開幕`, en: `opened ${y}` })) : tr(STATUS[2]),
              v24 ? tr({ zh: `2024 年 ${visitorsText(v24)}`, en: `${visitorsText(v24)} in 2024` }) : '',
            ]
              .filter(Boolean)
              .join(tr({ zh: '，', en: ', ' })),
          ],
          link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
        };
      }),
};

// ── 郵輪（2026-11-08，製作手冊第二十八批 674，候選 1479、1495、1490；pipeline/topics/disney_cruise.py） ──
// 「航程」畫不出來（手冊：迪士尼官網的條款禁止編成資料庫、OSM 與 PortWatch 都沒有郵輪的航線），改成母港點＋船籍線，
// 加上船隊從 1998 到 2029 年的噸位與載客量（清單）。

const CRUISE_INDICATORS = ['cruise'];
/** 港口的代碼（pipeline 的 PORTS 同樣的順序） */
const PORT_NAMES: Text[] = [
  { zh: '卡納維拉爾港', en: 'Port Canaveral' },
  { zh: '大沼澤港', en: 'Port Everglades' },
  { zh: '新加坡', en: 'Singapore' },
  { zh: '東京', en: 'Tokyo' },
  { zh: 'Castaway Cay', en: 'Castaway Cay' },
  { zh: '拿索', en: 'Nassau' },
];
const PORT_KINDS: { label: Text; color: string }[] = [
  { label: { zh: '母港', en: 'Home port' }, color: C[0] },
  { label: { zh: '將來的母港', en: 'Future home port' }, color: C[2] },
  { label: { zh: '私人島', en: 'Private island' }, color: C[1] },
  { label: { zh: '船籍登記港', en: 'Port of registry' }, color: C[5] },
];
const SHIP_CLASSES = ['Magic', 'Dream', 'Wish', 'Global'];
const gtText = (v: number) => tr({ zh: `${fixed(v, 0)} 總噸`, en: `${fixed(v, 0)} GT` });

const CRUISE_ITEMS: DimensionDef = {
  label: { zh: '看什麼', en: 'Show' },
  options: [
    { id: 'homeport', label: { zh: '以這國為母港', en: 'Based here:' } },
    { id: 'flag', label: { zh: '掛這國旗（船籍）', en: 'Flagged here:' } },
  ],
  defaultOption: 'homeport',
};

const CRUISE_PORTS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-cruise-ports',
  file: 'cruise-ports.json',
  label: { zh: '母港、私人島與船籍登記港', en: 'Home ports, private island and port of registry' },
  indicators: CRUISE_INDICATORS,
  radius: { field: 'kind', stops: [[1, 7], [2, 6], [3, 5], [4, 4]] },
  color: {
    field: 'kind',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5],
    classes: PORT_KINDS.map(({ label, color }) => ({ label, color })),
  },
  tooltip: (p, { countryName }) => {
    const extra: string[] = [];
    if (typeof p.ships === 'number') {
      // names 是 pipeline 用「, 」接起來的船名（英文專有名詞）
      extra.push(tr({ zh: `現役 ${p.ships} 艘：${String(p.names ?? '')}`, en: `${p.ships} ships in service: ${String(p.names ?? '')}` }));
      if (typeof p.gt === 'number') extra.push(tr({ zh: `合計 ${gtText(p.gt)}、最多 ${fixed(Number(p.cap), 0)} 名乘客`, en: `${gtText(p.gt)} in all, up to ${fixed(Number(p.cap), 0)} passengers` }));
    }
    if (p.kind === 2) extra.push(tr({ zh: 'Disney Imagination 預定 2029 年以這裡為母港（東方樂園公司擁有與營運）', en: 'Disney Imagination is due to be based here from 2029 (owned and operated by Oriental Land)' }));
    if (p.kind === 3) extra.push(tr({ zh: '1997 年向巴哈馬政府租下（租約到 2096 年），全島約 1,000 英畝、約 55 英畝在使用', en: 'Leased from the Bahamas in 1997 (until 2096); about 55 of roughly 1,000 acres are in use' }));
    if (p.kind === 4) extra.push(tr({ zh: '現役 8 艘全部登記在這裡', en: 'All 8 ships in service are registered here' }));
    return {
      title: tr({ zh: String(p.zh ?? ''), en: String(p.en ?? '') }),
      detail: [tr(at(PORT_KINDS, p.kind).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra,
    };
  },
};

const CRUISE_LINES: LinesOverlayDef = {
  kind: 'lines',
  id: 'disney-cruise-flag-lines',
  file: 'cruise-lines.json',
  label: { zh: '船籍線：母港到船籍登記港（拿索）', en: 'Flag lines: home port to port of registry (Nassau)' },
  indicators: CRUISE_INDICATORS,
  width: { field: 'ships', stops: [[1, 1.2], [4, 3]] },
  color: C[5],
  tooltip: (p) => ({
    title: tr({ zh: `${tr(at(PORT_NAMES, p.from))} → 拿索`, en: `${tr(at(PORT_NAMES, p.from))} → Nassau` }),
    extra: [tr({ zh: `在這裡上船的 ${fixed(Number(p.ships), 0)} 艘船都登記在巴哈馬拿索（母港跟船籍是兩件事）`, en: `The ${fixed(Number(p.ships), 0)} ships based here are all registered in Nassau, Bahamas (home port and flag are different things)` })],
  }),
};

function shipGroup(p: PointRecord): { order: number; label: string } {
  if (p.fut === 1) return { order: 9, label: tr({ zh: '將交船（預定，沒有確定的日期）', en: 'On order (planned, no firm dates)' }) };
  const home = num(p, 'home');
  if (!home) return { order: 8, label: tr({ zh: '條目沒有寫固定母港（依季節部署）', en: 'No fixed home port given (seasonal deployments)' }) };
  return { order: home, label: tr(at(PORT_NAMES, home)) };
}

const SHIP_LIST: ListPanelDef = {
  label: { zh: '迪士尼的郵輪', en: 'Disney cruise ships' },
  tabLabel: { zh: '郵輪', en: 'Ships' },
  indicators: CRUISE_INDICATORS,
  file: 'cruise-ships.json',
  rows: (points) =>
    points
      .map((p) => ({ p, g: shipGroup(p) }))
      .sort((a, b) => a.g.order - b.g.order || (num(b.p, 'y') ?? 0) - (num(a.p, 'y') ?? 0))
      .map(({ p, g }, i): ListRow => {
        const name = typeof p.name === 'string' && p.name ? p.name : tr({ zh: '還沒命名', en: 'Unnamed' });
        const cls = num(p, 'cls');
        const y = num(p, 'y');
        const facts = [
          cls ? tr({ zh: `${SHIP_CLASSES[cls - 1]} 級`, en: `${SHIP_CLASSES[cls - 1]} class` }) : '',
          num(p, 'gt') ? gtText(num(p, 'gt') as number) + (p.fut === 1 ? tr({ zh: '（計畫值）', en: ' (planned)' }) : '') : '',
          num(p, 'cap') ? tr({ zh: `最多 ${fixed(num(p, 'cap') as number, 0)} 名乘客`, en: `up to ${fixed(num(p, 'cap') as number, 0)} passengers` }) : '',
          num(p, 'cabins') ? tr({ zh: `${fixed(num(p, 'cabins') as number, 0)} 間客房`, en: `${fixed(num(p, 'cabins') as number, 0)} cabins` }) : '',
        ].filter(Boolean);
        return {
          key: `${name}-${i}`,
          title: name,
          titleProper: typeof p.name === 'string',
          group: g.label,
          muted: p.fut === 1,
          lines: [
            facts.join(tr({ zh: '、', en: ', ' })),
            [
              y ? (p.fut === 1 ? tr({ zh: `預定 ${y} 年`, en: `planned for ${y}` }) : tr({ zh: `${y} 年入役`, en: `in service ${y}` })) : '',
              typeof p.yard === 'string' ? tr({ zh: `船廠 ${p.yard}`, en: `built by ${p.yard}` }) : '',
              p.flag === 'BHS' ? tr({ zh: '船籍巴哈馬', en: 'Bahamas flag' }) : p.flag === 'JPN' ? tr({ zh: '船籍日本（東方樂園公司擁有與營運）', en: 'Japanese flag (owned and operated by Oriental Land)' }) : '',
            ]
              .filter(Boolean)
              .join(tr({ zh: '，', en: ', ' })),
          ],
          link: { href: 'https://en.wikipedia.org/wiki/Disney_Cruise_Line?oldid=1384145065', label: tr({ zh: '資料出處 英文維基百科', en: 'Source: English Wikipedia' }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

// ── 飯店（2026-11-08，製作手冊第二十八批 675，候選 1480；pipeline/topics/disney_hotels.py） ──
// 白名單的 QID（不用名稱比對）；房間數只有 4 家有（Wikidata P8733），只寫在說明，不做指標。迪士尼自己的分級只在官網上，
// 類型改寫 Wikidata 的 P31。

const HOTEL_INDICATORS = ['hotels'];
/** 飯店的度假區：RESORTS 加「度假區以外」（pipeline 的 HOTEL_RESORTS） */
const HOTEL_RESORTS: Text[] = [...RESORTS.map((r) => r.label), { zh: '度假區以外', en: 'Outside the resorts' }];
const HOTEL_TYPES: [number, Text][] = [
  [1, { zh: '飯店', en: 'hotel' }],
  [2, { zh: '度假村', en: 'resort' }],
  [4, { zh: '山林風格的飯店（lodge）', en: 'lodge' }],
  [8, { zh: '會議中心', en: 'convention centre' }],
];
const typesText = (bits: number) =>
  HOTEL_TYPES.filter(([b]) => bits & b)
    .map(([, t]) => tr(t))
    .join(tr({ zh: '、', en: ', ' }));

function hotelFacts(p: PointRecord): string[] {
  const out: string[] = [];
  const y = num(p, 'y');
  out.push(y ? tr({ zh: `${y} 年開幕`, en: `Opened ${y}` }) : tr({ zh: 'Wikidata 沒有開幕年', en: 'No opening year on Wikidata' }));
  const types = num(p, 'types');
  if (types) out.push(tr({ zh: `Wikidata 的類型：${typesText(types)}`, en: `Wikidata type: ${typesText(types)}` }));
  const rooms = num(p, 'rooms');
  if (rooms) out.push(tr({ zh: `${fixed(rooms, 0)} 間客房`, en: `${fixed(rooms, 0)} rooms` }));
  if (p.op === 1) out.push(tr({ zh: '在華特迪士尼世界裡面，但由萬豪經營，不是迪士尼直營', en: 'Inside Walt Disney World but operated by Marriott, not by Disney' }));
  return out;
}

const HOTEL_COLORS = {
  field: 'resort',
  title: { zh: '度假區', en: 'Resort' },
  thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
  classes: HOTEL_RESORTS.map((label, i) => ({ label, color: i === 7 ? MAP_TOKENS.categoricalOther : C[i] })),
};

const HOTELS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-hotels',
  file: 'hotels.json',
  label: { zh: '迪士尼的飯店', en: 'Disney hotels' },
  indicators: HOTEL_INDICATORS,
  radius: 4,
  color: HOTEL_COLORS,
  tooltip: (p, { countryName }) => {
    const { title, proper } = disneyName(p);
    return {
      title,
      detail: [tr(at(HOTEL_RESORTS, p.resort)), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: hotelFacts(p),
      properNoun: proper,
    };
  },
};

const HOTEL_LIST: ListPanelDef = {
  label: { zh: '迪士尼的飯店', en: 'Disney hotels' },
  tabLabel: { zh: '飯店', en: 'Hotels' },
  indicators: HOTEL_INDICATORS,
  file: 'hotels-all.json',
  countryField: 'iso3',
  rows: (points, { countryName }) => {
    const nameOf = new Map(points.map((p) => [String(p.qid), disneyName(p).title]));
    const order = (p: PointRecord) => (p.role === 3 ? 99 : num(p, 'resort') ?? 50);
    return points
      .slice()
      .sort((a, b) => order(a) - order(b) || (num(a, 'y') ?? 9999) - (num(b, 'y') ?? 9999) || String(a.en).localeCompare(String(b.en)))
      .map((p): ListRow => {
        const { title, proper } = disneyName(p);
        const facts = hotelFacts(p);
        if (p.role === 2) facts.push(tr({ zh: `迪士尼度假俱樂部（DVC）的別墅，跟 ${nameOf.get(String(p.base)) ?? ''} 同址`, en: `Disney Vacation Club villas, at the same site as ${nameOf.get(String(p.base)) ?? ''}` }));
        if (p.role === 3) facts.push(tr({ zh: '沒有蓋成的計畫（Wikidata 標成未完工或放棄的計畫）', en: 'Never built (Wikidata marks it as unfinished or abandoned)' }));
        return {
          key: String(p.qid),
          title,
          properNoun: proper,
          group: p.role === 3 ? tr({ zh: '沒有蓋成', en: 'Never built' }) : tr(at(HOTEL_RESORTS, p.resort)),
          muted: p.role !== 1 || p.op === 1,
          lines: [typeof p.iso3 === 'string' ? countryName(p.iso3) : '', facts.join(tr({ zh: '；', en: '; ' }))].filter(Boolean),
          link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      });
  },
};

// ── 影視部門、電視頻道與各國分公司（2026-11-08，製作手冊第二十八批 676，候選 1481、1493、1494；pipeline/topics/disney_units.py） ──
// Wikidata 所有權鏈（一到兩跳連到華特迪士尼公司）固定成白名單的 579 個單位，排掉美國專利、作品與節目時段。
// 座標有一大半是總部或所在城市的（prec 2），同一城市的排成小圓；沒有位置的只進清單（prec 3）。

const UNIT_INDICATORS = ['units'];
export const UNIT_GROUPS: { id: string; label: Text; color: string }[] = [
  { id: 'studio', label: { zh: '影視（片廠、動畫、製作、發行）', en: 'Film and TV (studios, animation, production, distribution)' }, color: C[0] },
  { id: 'broadcast', label: { zh: '電視與廣播（頻道、電視網、電台）', en: 'Broadcasting (channels, networks, radio)' }, color: C[1] },
  { id: 'streaming', label: { zh: '串流與網站', en: 'Streaming and websites' }, color: C[2] },
  { id: 'publishing', label: { zh: '遊戲、唱片與出版', en: 'Games, music and publishing' }, color: C[3] },
  { id: 'company', label: { zh: '公司與各國分公司', en: 'Companies and national subsidiaries' }, color: C[4] },
];
const UNIT_ITEMS: DimensionDef = {
  label: { zh: '單位', en: 'Unit' },
  options: [{ id: 'all', label: { zh: '全部', en: 'All' } }, ...UNIT_GROUPS.map((g) => ({ id: g.id, label: g.label }))],
  defaultOption: 'all',
};
const PRECISION: Text[] = [
  { zh: '座標是這個單位自己的', en: 'Own coordinates' },
  { zh: '座標是總部或所在城市的', en: 'Coordinates of its headquarters or city' },
  { zh: 'Wikidata 沒有位置，只知道國家', en: 'No location on Wikidata, country only' },
];

function unitFacts(p: PointRecord): string[] {
  const out: string[] = [];
  const y = num(p, 'y');
  if (y) out.push(tr({ zh: `${y} 年成立`, en: `Founded ${y}` }));
  const city = typeof p.city === 'string' && p.city ? p.city : '';
  out.push(tr(at(PRECISION, p.prec)) + (city ? tr({ zh: `（${city}）`, en: ` (${city})` }) : ''));
  return out;
}

const UNITS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-units',
  file: 'units.json',
  label: { zh: '影視部門、頻道與分公司（Wikidata 的所有權鏈）', en: 'Studios, channels and subsidiaries (Wikidata ownership chain)' },
  indicators: UNIT_INDICATORS,
  radius: 3,
  color: {
    field: 'g',
    title: { zh: '類型', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5],
    classes: UNIT_GROUPS.map(({ label, color }) => ({ label, color })),
  },
  tooltip: (p, { countryName }) => ({
    title: String(p.en ?? ''),
    properNoun: String(p.en ?? ''),
    detail: [tr(at(UNIT_GROUPS, p.g).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: unitFacts(p),
  }),
};

const UNIT_LIST: ListPanelDef = {
  label: { zh: '迪士尼的影視部門、頻道與分公司', en: 'Disney studios, channels and subsidiaries' },
  tabLabel: { zh: '單位', en: 'Units' },
  indicators: UNIT_INDICATORS,
  file: 'units-all.json',
  countryField: 'iso3',
  rows: (points, { countryName, item }) =>
    points
      .filter((p) => !item || item === 'all' || UNIT_GROUPS[(num(p, 'g') ?? 1) - 1]?.id === item)
      .slice()
      .sort((a, b) => (num(a, 'g') ?? 9) - (num(b, 'g') ?? 9) || (num(a, 'y') ?? 9999) - (num(b, 'y') ?? 9999) || String(a.en).localeCompare(String(b.en)))
      .map((p): ListRow => ({
        key: String(p.qid),
        title: String(p.en ?? ''),
        titleProper: true,
        group: tr(at(UNIT_GROUPS, p.g).label),
        muted: p.prec === 3,
        lines: [typeof p.iso3 === 'string' ? countryName(p.iso3) : '', unitFacts(p).join(tr({ zh: '；', en: '; ' }))].filter(Boolean),
        link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: p.prec === 3 ? 4 : 11 },
      })),
};

export const disney: TopicDefinition = {
  id: 'disney',
  title: { zh: '迪士尼在哪裡：樂園、郵輪、飯店與影視部門', en: 'Where Disney is: parks, cruise ships, hotels and studios' },
  shortTitle: { zh: '迪士尼', en: 'Disney' },
  defaultIndicator: 'parks',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（據點的座標與面積，經 QLever 查詢；據點是手工整理的白名單）', en: 'Wikidata (coordinates and areas, via QLever; sites from a hand-checked list)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: {
        zh: '英文維基百科「Disney Experiences」（revid 1382282208，開幕年）與各已關閉據點的條目（關閉年）',
        en: 'English Wikipedia, “Disney Experiences” (revid 1382282208, opening years) and the articles on closed sites (closing years)',
      },
      url: 'https://en.wikipedia.org/wiki/Disney_Experiences?oldid=1382282208',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of amusement park rankings」（樂園人次，數字原本來自 TEA／AECOM）',
        en: 'English Wikipedia, “List of amusement park rankings” (park attendance, originally from TEA/AECOM)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_amusement_park_rankings?oldid=1377863670',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「Disney Cruise Line」（revid 1384145065，船隊、母港與船籍）', en: 'English Wikipedia, “Disney Cruise Line” (revid 1384145065: fleet, home ports and flag)' },
      url: 'https://en.wikipedia.org/wiki/Disney_Cruise_Line?oldid=1384145065',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'IMF PortWatch 港口資料庫（新加坡、東京、拿索的座標）', en: 'IMF PortWatch ports database (coordinates of Singapore, Tokyo and Nassau)' },
      url: 'https://portwatch.imf.org/',
      license: { zh: 'IMF 的資料條款（註明出處）', en: 'IMF data terms (with attribution)' },
    },
  ],
  note: {
    zh: '這個主題整理的是 Wikidata、OpenStreetMap 與維基百科上的公開資料，不是迪士尼公司提供的。度假區（例如華特迪士尼世界）與裡面的主題樂園是兩層，「幾座樂園」只算主題樂園。台灣沒有迪士尼的樂園、飯店或郵輪靠港。',
    en: 'This topic compiles public data from Wikidata, OpenStreetMap and Wikipedia; it is not provided by The Walt Disney Company. Resorts (such as Walt Disney World) and the theme parks inside them are two levels, and park counts include theme parks only. Taiwan has no Disney park, hotel or cruise call.',
  },
  overlays: [RESORT_RINGS, SITES, PLANNED, CRUISE_LINES, CRUISE_PORTS, HOTELS, UNITS],
  listPanel: [PARK_LIST, SHIP_LIST, HOTEL_LIST, UNIT_LIST],
  indicators: [
    {
      id: 'parks',
      label: { zh: '迪士尼的主題樂園', en: 'Disney theme parks' },
      description: {
        zh: '各國營運中的迪士尼主題樂園數（比例圓），拖時間軸看 1955 年加州的迪士尼樂園到 2016 年上海怎麼一座座開起來。2026 年共 12 座、在 6 個度假區：美國 6 座（佛羅里達的華特迪士尼世界 4 座：神奇王國 1971、艾波卡特 1982、好萊塢夢工場 1989、動物王國 1998；加州 2 座：迪士尼樂園 1955、加州冒險 2001）、日本 2 座（東京迪士尼樂園 1983、東京迪士尼海洋 2001）、法國 2 座（1992、2002）、香港 1 座（2005）、上海 1 座（2016）；第七個度假區阿布達比已宣布，還沒有開幕年（空心的點）。地圖上的大圈是度假區，小點是樂園、水上樂園與已關閉的地方（River Country 1976–2001、Discovery Island 1974–1999、DisneyQuest 1998–2017）。台灣沒有迪士尼的樂園，最近的是香港與上海。',
        en: 'Number of Disney theme parks open in each country (proportional circles); drag the timeline to watch them open one by one, from Disneyland in California in 1955 to Shanghai in 2016. In 2026 there are 12 parks at 6 resorts: the US has 6 (4 at Walt Disney World in Florida: Magic Kingdom 1971, Epcot 1982, Hollywood Studios 1989, Animal Kingdom 1998; 2 in California: Disneyland 1955, California Adventure 2001), Japan 2 (Tokyo Disneyland 1983, Tokyo DisneySea 2001), France 2 (1992, 2002), Hong Kong 1 (2005) and Shanghai 1 (2016); a seventh resort in Abu Dhabi has been announced with no opening year (hollow point). Large rings are resorts; small points are parks, water parks and closed sites (River Country 1976–2001, Discovery Island 1974–1999, DisneyQuest 1998–2017). Taiwan has no Disney park; the nearest are Hong Kong and Shanghai.',
      },
      unit: { zh: '座', en: 'parks' },
      file: 'parks.json',
      layer: { kind: 'bubble', legendValues: [1, 2, 6] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${v === 1 ? 'park' : 'parks'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      overlayTime: 'cumulative',
    },
    {
      id: 'cruise',
      // 卡片與圖例的標題是子項目接指標名稱：「以這國為母港的迪士尼郵輪」
      label: { zh: '的迪士尼郵輪', en: 'Disney cruise ships' },
      description: {
        zh: '迪士尼郵輪的現役 8 艘船以哪一國為母港、掛哪一國的旗（英文維基「Disney Cruise Line」固定版本 1384145065）。母港：美國 5 艘（卡納維拉爾港的 Magic、Fantasy、Wish、Treasure，大沼澤港的 Destiny）、新加坡 1 艘（2026 年 3 月入役的 Adventure，20.8 萬總噸、最多 6,700 名乘客，是船隊裡最大的，也是第一艘常駐亞洲的）；Wonder 與 Dream 條目沒有寫固定母港（依季節部署）。船籍：8 艘全部登記在巴哈馬的拿索，跟母港是兩件事；2029 年的 Disney Imagination 例外，由東方樂園公司擁有與營運、以東京為母港並登記在東京。船從 1998 年 Magic 的 8.4 萬總噸、2011 年 Dream 的 13.0 萬、2022 年 Wish 的 14.4 萬長到 2026 年 Adventure 的 20.8 萬（左邊的清單依母港分組，看噸位、載客與入役年）；另外 5 艘將交船的噸位是計畫值。地圖上的點是母港、私人島 Castaway Cay 與船籍港拿索，線從母港連到拿索。航程畫不出來：迪士尼官網的條款不准把內容編成資料庫，OpenStreetMap 與 IMF PortWatch 也沒有郵輪的航線。另一座私人島 Lookout Cay 在 Wikidata 上沒有自己的項目，不畫。台灣沒有迪士尼郵輪的母港，條目裡也沒有停靠台灣。',
        en: 'Where the 8 Disney Cruise Line ships in service are based and which flag they fly (English Wikipedia, “Disney Cruise Line”, revision 1384145065). Home ports: the US has 5 (Magic, Fantasy, Wish and Treasure at Port Canaveral; Destiny at Port Everglades) and Singapore 1 (Adventure, in service since March 2026: 208,000 GT and up to 6,700 passengers, the largest in the fleet and the first based in Asia); the article gives no fixed home port for Wonder and Dream (seasonal deployments). Flag: all 8 are registered in Nassau, Bahamas, which is not the same as their home port; the exception will be Disney Imagination (2029), owned and operated by Oriental Land, based in and registered in Tokyo. The ships grew from 84,000 GT (Magic, 1998) to 130,000 (Dream, 2011), 144,000 (Wish, 2022) and 208,000 (Adventure, 2026); the list on the left groups them by home port with tonnage, capacity and year, and the 5 ships on order show planned figures. Points are home ports, the private island Castaway Cay and the port of registry, Nassau; lines link home ports to Nassau. Itineraries cannot be mapped: Disney’s terms forbid compiling its content into a database, and neither OpenStreetMap nor IMF PortWatch has cruise routes. The other private island, Lookout Cay, has no Wikidata item of its own and is not shown. Taiwan has no Disney home port, and the article lists no Taiwanese calls.',
      },
      unit: { zh: '艘', en: 'ships' },
      file: 'cruise/{item}.json',
      dimension: CRUISE_ITEMS,
      layer: { kind: 'bubble', legendValues: [1, 5, 8] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 艘`, en: `${fixed(v, 0)} ${v === 1 ? 'ship' : 'ships'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
    {
      id: 'hotels',
      label: { zh: '迪士尼的飯店', en: 'Disney hotels' },
      description: {
        zh: '各國迪士尼直營的飯店數（比例圓；名單是 Wikidata 上逐一確認的 QID，不用名稱比對，因為會混進樂園旁邊的 Hilton、Four Seasons 這類別家的旅館）。共 43 家：美國 26 家（華特迪士尼世界 20 家、加州 3 家，加上度假區以外的夏威夷 Aulani 與佛州 Vero Beach、南卡 Hilton Head 的度假俱樂部）、法國 7 家（巴黎度假區，1991–1992 年一起開）、日本 5 家、香港 3 家、上海 2 家。華特迪士尼世界裡的 Swan 與 Dolphin 由萬豪經營，地圖上有畫但不算直營；迪士尼度假俱樂部（DVC）的別墅跟本體同址，併在清單裡、不另外算。左邊的清單依度假區分組、依開幕年排（1955 年加州的 Disneyland Hotel 最早，2017 年香港的迪士尼探索家度假酒店最新的有年份），另有 4 個沒蓋成的計畫。房間數只有 4 家在 Wikidata 上有（香港 3 家、上海的玩具總動員酒店），所以不做成指標；迪士尼自己分的等級只在官網上，類型照寫 Wikidata 的分類。台灣沒有迪士尼的飯店。',
        en: 'Number of Disney-run hotels in each country (proportional circles; the list is a set of individually checked Wikidata items rather than a name search, which would sweep in other brands near the parks such as Hilton and Four Seasons). 43 in all: the US 26 (20 at Walt Disney World and 3 in California, plus Aulani in Hawaii and the Vacation Club resorts at Vero Beach, Florida, and Hilton Head, South Carolina), France 7 (the Paris resort, all opened in 1991–1992), Japan 5, Hong Kong 3 and Shanghai 2. The Swan and Dolphin at Walt Disney World are operated by Marriott: they are mapped but not counted. Disney Vacation Club villas sharing a site with a hotel are listed under it, not counted separately. The list on the left groups hotels by resort and opening year (Disneyland Hotel in California, 1955, is the earliest; Disney Explorers Lodge in Hong Kong, 2017, is the latest with a year on record), plus 4 projects that were never built. Only 4 hotels have a room count on Wikidata (3 in Hong Kong and the Toy Story Hotel in Shanghai), so rooms are not mapped; Disney’s own tiers are published only on its website, so types follow Wikidata’s classification. Taiwan has no Disney hotel.',
      },
      unit: { zh: '家', en: 'hotels' },
      file: 'hotels-count.json',
      layer: { kind: 'bubble', legendValues: [2, 7, 26] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'hotel' : 'hotels'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
    {
      id: 'units',
      // 卡片與圖例的標題是子項目接指標名稱：「影視（片廠、動畫、製作、發行）的迪士尼單位」
      label: { zh: '的迪士尼單位', en: 'Disney units' },
      description: {
        zh: '迪士尼的影視部門、電視頻道與各國分公司在哪一國（比例圓）。名單是 Wikidata 上所有權（擁有者、母公司、隸屬、營運者）一到兩層連到華特迪士尼公司的項目，2026 年 11 月固定下來：1,096 個項目排掉 225 筆美國專利、作品與虛構角色、節目時段，以及樂園、飯店、郵輪這些已經畫在別的指標的據點，留下 579 個單位，分成五類：電視與廣播 240、公司與分公司 151、影視 87、遊戲唱片與出版 67、串流與網站 34。有位置的 493 個在 43 國：美國 257 個最多（Pixar 在 Emeryville、Lucasfilm 在舊金山、Walt Disney Imagineering 在 Glendale、ESPN 在 Bristol），其次英國 41、印度 30、法國 19、西班牙 14、香港 12。Wikidata 上自己有座標的只有 17 個，大多數畫在總部或所在城市（同一城市的排成小圓），只知道國家的 142 個只列在清單、不畫點，另有 86 個連國家都沒有。這是 Wikidata 的所有權鏈，不等於迪士尼百分之百持股（有合資、也有已經賣掉的）。台灣在這條鏈裡 0 個；Disney Channel (Taiwan) 在 Wikidata 上不連到迪士尼、也沒有位置。',
        en: 'Which countries host Disney’s studios, TV channels and national subsidiaries (proportional circles). The list is the set of Wikidata items linked to The Walt Disney Company within one or two steps of ownership (owner, parent, part of, operator), fixed in November 2026: of 1,096 items, 225 US patents, works and fictional characters, programme blocks, and the parks, hotels and ships shown under other indicators were removed, leaving 579 units in five groups: broadcasting 240, companies and subsidiaries 151, film and TV 87, games, music and publishing 67, streaming and websites 34. The 493 with a location are in 43 countries: the US has the most at 257 (Pixar in Emeryville, Lucasfilm in San Francisco, Walt Disney Imagineering in Glendale, ESPN in Bristol), followed by the UK 41, India 30, France 19, Spain 14 and Hong Kong 12. Only 17 have their own coordinates on Wikidata; most are placed at their headquarters or city (several in one city are spread in a small circle), the 142 known only by country are listed but not mapped, and 86 have no country at all. This is Wikidata’s ownership chain, not a statement of 100% ownership (it includes joint ventures and past holdings). Taiwan has none in the chain; Disney Channel (Taiwan) is not linked to Disney on Wikidata and has no location.',
      },
      unit: { zh: '個', en: 'units' },
      file: 'units/{item}.json',
      dimension: UNIT_ITEMS,
      layer: { kind: 'bubble', legendValues: [5, 40, 250] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${v === 1 ? 'unit' : 'units'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
  ],
};
