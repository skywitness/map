import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, DimensionDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

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

// ── 人次與恢復率、園內設施（2026-11-08，製作手冊第二十八批 677，候選 1485、1486；pipeline/topics/disney_visits.py） ──
// 候選 1497（樂園交通）照手冊的建議不做。

const VISIT_YEARS = Array.from({ length: 16 }, (_, i) => 2009 + i);
const RIDE_KINDS: { label: Text; color: string }[] = [
  { label: { zh: '遊樂設施', en: 'Rides' }, color: C[0] },
  { label: { zh: '主題園區', en: 'Themed areas' }, color: C[2] },
  { label: { zh: '餐廳與商店', en: 'Restaurants and shops' }, color: C[1] },
  { label: { zh: '表演與活動', en: 'Shows and events' }, color: C[3] },
];
const clampYear = (y: number) => Math.min(2024, Math.max(2009, y));

function visitFacts(p: PointRecord): string[] {
  const v19 = num(p, 'v2019');
  const v20 = num(p, 'v2020');
  const v24 = num(p, 'v2024');
  const out: string[] = [];
  if (v24 && v19) out.push(tr({ zh: `2024 年 ${visitorsText(v24)}，是 2019 年的 ${fixed((v24 / v19) * 100, 0)}%`, en: `${visitorsText(v24)} in 2024, ${fixed((v24 / v19) * 100, 0)}% of 2019` }));
  if (v20) out.push(tr({ zh: `2020 年谷底 ${visitorsText(v20)}`, en: `2020 low: ${visitorsText(v20)}` }));
  const parts = [
    num(p, 'n1') ? tr({ zh: `遊樂設施 ${num(p, 'n1')}`, en: `${num(p, 'n1')} rides` }) : '',
    num(p, 'n2') ? tr({ zh: `主題園區 ${num(p, 'n2')}`, en: `${num(p, 'n2')} themed areas` }) : '',
  ].filter(Boolean);
  if (parts.length) out.push(tr({ zh: `Wikidata 上隸屬這座樂園的：${parts.join('、')}`, en: `On Wikidata as part of this park: ${parts.join(', ')}` }));
  return out;
}

const PARK_VISITS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-park-visits',
  file: 'park-visits.json',
  label: { zh: '迪士尼樂園的人次', en: 'Disney park attendance' },
  indicators: ['visitors', 'recovery'],
  epochs: { years: VISIT_YEARS, values: (p, y) => ({ vv: num(p, `v${y}`) }) },
  radius: { field: 'vv', stops: [[1e6, 3], [5e6, 6], [10e6, 9], [20e6, 13]] },
  color: C[0],
  sortField: 'vv',
  tooltip: (p, { countryName, year }) => {
    const { title, proper } = disneyName(p);
    const y = clampYear(year ?? 2024);
    const v = num(p, `v${y}`);
    return {
      title,
      detail: [tr(at(RESORTS, p.resort).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: [v ? tr({ zh: `${y} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${y}` }) : '', ...visitFacts(p)].filter(Boolean),
      properNoun: proper,
    };
  },
};

const PARK_RIDES: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-park-rides',
  file: 'park-rides.json',
  label: { zh: '園內的設施與主題園區（Wikidata，放大才畫）', en: 'Rides and themed areas (Wikidata; shown when zoomed in)' },
  indicators: ['parks', 'visitors'],
  minZoom: 12,
  radius: 3,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5],
    classes: RIDE_KINDS.map(({ label, color }) => ({ label, color })),
  },
  tooltip: (p) => ({ title: String(p.en ?? ''), properNoun: String(p.en ?? ''), detail: tr(at(RIDE_KINDS, p.k).label) }),
};

const VISIT_LIST: ListPanelDef = {
  label: { zh: '迪士尼樂園的人次', en: 'Disney park attendance' },
  tabLabel: { zh: '人次', en: 'Attendance' },
  indicators: ['visitors', 'recovery'],
  file: 'park-visits.json',
  countryField: 'iso3',
  sorts: [
    { id: 'visitors', label: { zh: '依 2024 年人次', en: 'By 2024 attendance' } },
    { id: 'recovery', label: { zh: '依恢復率', en: 'By recovery' } },
  ],
  rows: (points, { countryName, sort }) => {
    const rec = (p: PointRecord) => (num(p, 'v2024') ?? 0) / (num(p, 'v2019') ?? 1);
    return points
      .slice()
      .sort((a, b) => (sort === 'recovery' ? rec(b) - rec(a) : (num(b, 'v2024') ?? 0) - (num(a, 'v2024') ?? 0)))
      .map((p, i): ListRow => {
        const { title, proper } = disneyName(p);
        return {
          key: String(p.qid),
          title: `${i + 1}. ${title}`,
          properNoun: proper,
          lines: [[tr(at(RESORTS, p.resort).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '), ...visitFacts(p)],
          bars: {
            values: VISIT_YEARS.map((y) => num(p, `v${y}`) ?? 0),
            highlight: [VISIT_YEARS.indexOf(2020)],
            labels: ['2009', '2024'],
            aria: tr({ zh: '2009–2024 年的人次', en: 'Attendance 2009–2024' }),
          },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      });
  },
};

// ── Disney+、拍攝地與故事場景地（2026-11-08，製作手冊第二十八批 678，候選 1482、1487、1488；pipeline/topics/disney_plus.py） ──
// Disney+ 的上線表是英文維基「Disney+」固定版本 1383663039（解析器 pipeline/sources/rollout.py 跟順序 685 共用），表上沒有的
// 國家＝看不到 Disney+（missing）。印度與東南亞是另外的品牌，分開畫。拍攝地與故事場景地是 Wikidata 的 P915、P840：製作、發行或
// 製片掛在迪士尼系十家片廠的作品（現在的片庫，不是「迪士尼拍的」）；虛構的地點只進清單，不塞到現實的國家。

const PLUS_REV = 'https://en.wikipedia.org/wiki/Disney%2B?oldid=1383663039';
const PLUS_INDICATORS = ['disneyplus', 'disneyplus-launch'];
const PLUS_BRANDS: CategoryDef[] = [
  { value: 1, label: { zh: 'Disney+', en: 'Disney+' } },
  { value: 2, label: { zh: 'Disney+ Hotstar（印度與東南亞的另一個品牌）', en: 'Disney+ Hotstar (a separate brand in India and Southeast Asia)' } },
  { value: 3, label: { zh: 'JioHotstar（印度，2025 年起迪士尼不是控股方）', en: 'JioHotstar (India; not controlled by Disney since 2025)' } },
];
const PLUS_LAUNCH: CategoryDef[] = [2019, 2020, 2021, 2022].map((y) => ({ value: y, label: { zh: `${y} 年`, en: String(y) } }));
const PLUS_MISSING: Text = { zh: '看不到 Disney+（英文維基的上線表沒有這一國）', en: 'No Disney+ (not in the English Wikipedia launch table)' };
const categoryText = (cats: CategoryDef[]) => (v: number) => tr(cats.find((c) => c.value === v)?.label ?? { zh: '', en: '' });
/** 20211112 → 「2021 年 11 月 12 日」 */
function ymdText(v: number): string {
  const s = String(v);
  return tr({ zh: `${s.slice(0, 4)} 年 ${Number(s.slice(4, 6))} 月 ${Number(s.slice(6))} 日`, en: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` });
}

function plusFacts(p: PointRecord): string[] {
  const d = num(p, 'd') ?? 0;
  const first = num(p, 'first');
  const out: string[] = [];
  if (p.iso3 === 'IND')
    out.push(tr({ zh: '2020 年 4 月 3 日起是 Disney+ Hotstar；2025 年 2 月 14 日跟 JioCinema 合併成 JioHotstar，迪士尼不再是控股方', en: 'Disney+ Hotstar from 2020-04-03; merged with JioCinema into JioHotstar on 2025-02-14, no longer controlled by Disney' }));
  else if (first) out.push(tr({ zh: `${ymdText(first)}先以 Disney+ Hotstar 上線，${ymdText(d)}改名 Disney+`, en: `Launched as Disney+ Hotstar on ${ymdText(first)}; renamed Disney+ on ${ymdText(d)}` }));
  else out.push(tr({ zh: `${ymdText(d)}上線`, en: `Launched ${ymdText(d)}` }));
  if (typeof p.partners === 'string' && p.partners) out.push(tr({ zh: `上線時搭配的電信或平台：${p.partners}`, en: `Launch partners: ${p.partners}` }));
  const has = (f: string) => (p[f] === 1 ? true : p[f] === 0 ? false : null);
  const hulu = has('hulu');
  const espn = has('espn');
  if (hulu !== null && espn !== null)
    out.push(
      tr({
        zh: `現在（這個維基版本）${hulu ? '有' : '沒有'} Hulu 的內容、${espn ? '有' : '沒有'} ESPN`,
        en: `Now (this Wikipedia revision): ${hulu ? 'with' : 'without'} Hulu content, ${espn ? 'with' : 'without'} ESPN`,
      }),
    );
  return out;
}

const PLUS_LIST: ListPanelDef = {
  label: { zh: 'Disney+ 的上線時程', en: 'Disney+ launch timeline' },
  tabLabel: { zh: '上線時程', en: 'Launches' },
  indicators: PLUS_INDICATORS,
  file: 'plus.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const wave = (p: PointRecord) => num(p, 'first') ?? num(p, 'd') ?? 0;
    const size = new Map<number, number>();
    for (const p of points) size.set(wave(p), (size.get(wave(p)) ?? 0) + String(p.iso3 ?? '').split(',').length);
    return points
      .slice()
      .sort((a, b) => wave(a) - wave(b) || String(a.name).localeCompare(String(b.name)))
      .map((p): ListRow => {
        const isos = String(p.iso3 ?? '').split(',');
        const title = isos.length > 1 ? (getLang() === 'zh' && typeof p.zh === 'string' && p.zh ? p.zh : String(p.name)) : countryName(isos[0]);
        const n = size.get(wave(p)) ?? 1;
        return {
          key: String(p.name),
          title,
          group: country ? ymdText(wave(p)) : tr({ zh: `${ymdText(wave(p))}（${n} 個國家或地區）`, en: `${ymdText(wave(p))} (${n} ${n === 1 ? 'country or territory' : 'countries or territories'})` }),
          muted: p.b === 3,
          lines: [tr(PLUS_BRANDS[(num(p, 'b') ?? 1) - 1].label), ...plusFacts(p)],
          link: { href: PLUS_REV, label: tr({ zh: '資料出處 英文維基百科', en: 'Source: English Wikipedia' }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 4 },
        };
      });
  },
};

/** 地點的種類（pipeline 的 PLACE_KIND，代碼是索引 + 1） */
const PLACE_KINDS: Text[] = [
  { zh: '有座標的地點', en: 'Places with coordinates' },
  { zh: '只寫到國家', en: 'Country only' },
  { zh: '跨國的地區（洲、海洋、山脈……；不算進任何一國）', en: 'Areas spanning countries (continents, oceans, mountain ranges…; not counted for any country)' },
  { zh: '虛構的地點', en: 'Fictional places' },
  { zh: '沒有座標（太空、行星、神話裡的地方……）', en: 'No coordinates (space, planets, mythical places…)' },
  { zh: '大的地區（州、省；點是地區的中心）', en: 'Large areas (states, provinces; the dot is the centre of the area)' },
];
const PLACE_ORDER = [1, 6, 2, 3, 4, 5];

function placeName(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.en ?? '');
  return getLang() === 'zh' && typeof p.zh === 'string' && p.zh ? { title: p.zh, proper: en } : { title: en };
}
/** 作品名單（pipeline 用「|」接起來、依年份排好），最多列 limit 部 */
function worksText(p: PointRecord, limit: number): string {
  const all = String((getLang() === 'zh' ? p.wz : p.we) ?? '')
    .split('|')
    .filter(Boolean);
  const shown = all.slice(0, limit).join(tr({ zh: '、', en: '; ' }));
  // 共幾部用 n（沒有英文標籤的作品不列名字，但照樣算）
  const n = num(p, 'n') ?? all.length;
  return n > Math.min(limit, all.length) ? shown + tr({ zh: `……共 ${n} 部`, en: `… ${n} in all` }) : shown;
}
const worksCount = (n: number) => tr({ zh: `${fixed(n, 0)} 部作品`, en: `${fixed(n, 0)} ${n === 1 ? 'title' : 'titles'}` });

function placeLayer(id: string, file: string, label: Text, indicator: string, color: string, regions: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    indicators: [indicator],
    radius: { field: 'n', stops: regions ? [[1, 6], [20, 11], [100, 18]] : [[1, 2.5], [10, 5], [50, 9], [200, 14]] },
    ...(regions && { look: 'hollow' as const }),
    color,
    sortField: 'n',
    tooltip: (p, { countryName }) => {
      const { title, proper } = placeName(p);
      return {
        title,
        properNoun: proper,
        detail: [worksCount(num(p, 'n') ?? 0), typeof p.iso3 === 'string' ? countryName(p.iso3) : null, regions ? tr(PLACE_KINDS[5]) : null].filter(Boolean).join(' · '),
        extra: [worksText(p, 8)],
      };
    },
  };
}
const FILMING = placeLayer('disney-filming', 'filming.json', { zh: '迪士尼片庫的拍攝地', en: 'Filming locations of the Disney library' }, 'filming', C[0], false);
const FILMING_REGIONS = placeLayer('disney-filming-regions', 'filming-regions.json', { zh: '只寫到州、省的拍攝地（空心）', en: 'Filming locations given only as a state or province (hollow)' }, 'filming', C[0], true);
const SETTINGS = placeLayer('disney-settings', 'settings.json', { zh: '迪士尼片庫的故事場景地', en: 'Story settings of the Disney library' }, 'settings', C[1], false);
const SETTINGS_REGIONS = placeLayer('disney-settings-regions', 'settings-regions.json', { zh: '只寫到州、省的場景地（空心）', en: 'Settings given only as a state or province (hollow)' }, 'settings', C[1], true);

function placeList(file: string, label: Text, tabLabel: Text, indicator: string): ListPanelDef {
  return {
    label,
    tabLabel,
    indicators: [indicator],
    file,
    countryField: 'iso3',
    rows: (points, { countryName }) =>
      points
        .slice()
        .sort((a, b) => PLACE_ORDER.indexOf(num(a, 'k') ?? 1) - PLACE_ORDER.indexOf(num(b, 'k') ?? 1) || (num(b, 'n') ?? 0) - (num(a, 'n') ?? 0))
        .map((p): ListRow => {
          // 只寫到國家的用網站的國名（Wikidata 台灣的 zh-tw 標籤是「中華民國」）
          const { title, proper } = p.k === 2 && typeof p.iso3 === 'string' ? { title: countryName(p.iso3), proper: undefined } : placeName(p);
          const hasPlace = typeof p.lon === 'number' && typeof p.lat === 'number';
          return {
            key: String(p.qid),
            title,
            properNoun: proper,
            group: tr(PLACE_KINDS[(num(p, 'k') ?? 1) - 1]),
            muted: p.k === 3 || p.k === 4 || p.k === 5,
            lines: [[worksCount(num(p, 'n') ?? 0), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '), worksText(p, 6)],
            link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
            // 沒有座標的（跨國、虛構、太空）點了看全世界
            target: hasPlace ? { lon: Number(p.lon), lat: Number(p.lat), zoom: p.k === 2 ? 4 : p.k === 6 ? 6 : 10 } : { box: [-170, -55, 170, 72] },
          };
        }),
  };
}
const FILMING_LIST = placeList('filming-all.json', { zh: '迪士尼片庫的拍攝地', en: 'Filming locations of the Disney library' }, { zh: '拍攝地', en: 'Filming' }, 'filming');
const SETTINGS_LIST = placeList('settings-all.json', { zh: '迪士尼片庫的故事場景地', en: 'Story settings of the Disney library' }, { zh: '場景地', en: 'Settings' }, 'settings');

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
      name: { zh: '英文維基百科「Disney+」（revid 1383663039，上線時程表）', en: 'English Wikipedia, “Disney+” (revid 1383663039: launch table)' },
      url: 'https://en.wikipedia.org/wiki/Disney%2B?oldid=1383663039',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Wikidata（迪士尼系片廠作品的拍攝地 P915 與故事場景地 P840，經 QLever 查詢）', en: 'Wikidata (filming locations P915 and narrative locations P840 of Disney studio titles, via QLever)' },
      url: 'https://www.wikidata.org/wiki/Property:P840',
      license: 'CC0',
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
  overlays: [RESORT_RINGS, SITES, PLANNED, PARK_VISITS, PARK_RIDES, CRUISE_LINES, CRUISE_PORTS, HOTELS, UNITS, FILMING_REGIONS, FILMING, SETTINGS_REGIONS, SETTINGS],
  listPanel: [PARK_LIST, VISIT_LIST, SHIP_LIST, HOTEL_LIST, UNIT_LIST, PLUS_LIST, FILMING_LIST, SETTINGS_LIST],
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
    {
      id: 'visitors',
      label: { zh: '迪士尼樂園的人次', en: 'Disney park attendance' },
      description: {
        zh: '各國迪士尼主題樂園一年的人次合計（比例圓，2009–2024 年；英文維基「List of amusement park rankings」，數字原本來自 TEA／AECOM）。12 座樂園都在全世界前 25 名的表上：2019 年合計 1.518 億人次，2020 年疫情掉到 4,321 萬，2024 年回到 1.425 億（2019 年的 93.9%）。2024 年最多的是佛羅里達的神奇王國 1,784 萬、加州的迪士尼樂園 1,734 萬、東京迪士尼樂園 1,510 萬。拖時間軸看每座樂園一年一年的變化；左邊的清單有每座的 16 年長條（強調的那一根是 2020 年）。放大到樂園看 Wikidata 上隸屬這座樂園的遊樂設施、主題園區、餐廳與表演（有座標的 173 個）。台灣沒有迪士尼的樂園。',
        en: 'Total annual attendance at Disney theme parks in each country (proportional circles, 2009–2024; English Wikipedia “List of amusement park rankings”, figures originally from TEA/AECOM). All 12 parks are in the global top 25: together they had 151.8 million visits in 2019, fell to 43.2 million in 2020 and were back to 142.5 million in 2024 (93.9% of 2019). The busiest in 2024 were Magic Kingdom in Florida (17.84 million), Disneyland in California (17.34 million) and Tokyo Disneyland (15.10 million). Drag the timeline to follow each park year by year; the list on the left shows a 16-year bar chart for each (2020 highlighted). Zoom into a park to see the rides, themed areas, restaurants and shows that Wikidata records as part of it (173 with coordinates). Taiwan has no Disney park.',
      },
      unit: { zh: '人次', en: 'visits' },
      file: 'visitors.json',
      layer: { kind: 'bubble', legendValues: [1e7, 3e7, 8e7] },
      format: visitorsText,
      formatTick: (v) => formatLargeNumber(v),
      integer: true,
      defaultYear: 2024,
    },
    {
      id: 'recovery',
      label: { zh: '迪士尼樂園的疫情恢復率', en: 'Disney park recovery from the pandemic' },
      description: {
        zh: '各國迪士尼樂園 2024 年的人次是 2019 年的幾 %（同一張維基表）。12 座合計 93.9%；香港 139%、上海 131% 比疫情前還多，法國 106%，美國 88%、日本 85% 還沒回來；單座最低是動物王國 63%。迪士尼樂園事業整體（含水上樂園）2024 年 1.452 億人次、2019 年 1.560 億，約 93%（樂園的「樂園集團的年人次」有集團的數字）。',
        en: 'Disney park attendance in 2024 as a percentage of 2019 (same Wikipedia table). The 12 parks together reached 93.9%; Hong Kong (139%) and Shanghai (131%) are above pre-pandemic levels, France is at 106%, while the US (88%) and Japan (85%) have not recovered; the lowest single park is Animal Kingdom at 63%. Disney’s parks business as a whole (including water parks) had 145.2 million visits in 2024 against 156.0 million in 2019, about 93% (see the theme park groups indicator in Theme parks).',
      },
      unit: '%',
      file: 'recovery.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [70, 85, 95, 105, 115, 130] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'disneyplus',
      label: { zh: '看得到 Disney+ 的國家', en: 'Where Disney+ is available' },
      description: {
        zh: '每年年底在哪些國家看得到 Disney+（類別圖，2019–2026；英文維基「Disney+」固定版本 1383663039 的上線時程表，137 列）。2019 年 11 月 12 日美國、加拿大、荷蘭首發，2020 年 3 月 24 日歐洲 7 國，2020 年 11 月 17 日拉丁美洲與加勒比海一次 41 個，2022 年 6 月中東北非 16 個、中東歐與英法屬地等 35 個兩波，到 2026 年共 141 個國家或地區（含英、法、荷的海外屬地）。印度與東南亞是另外的品牌：印度 2020 年起是 Disney+ Hotstar，2025 年 2 月 14 日跟 JioCinema 合併成 JioHotstar，迪士尼不再是控股方；印尼、馬來西亞、泰國先以 Disney+ Hotstar 上線，2025 年 10 月 8 日改名 Disney+。台灣 2021 年 11 月 12 日跟南韓同一天上線。沒有顏色的是表上沒有的國家，就是看不到 Disney+：中國、俄羅斯、越南，非洲 54 個國家只有 7 個看得到（南非、埃及、摩洛哥、阿爾及利亞、突尼西亞、利比亞、模里西斯）。滑過國家看上線日期與上線時搭配的電信或平台。官網的國家清單受使用條款限制不能抓，所以只用維基；各國的訂閱價格不做。',
        en: 'Where Disney+ was available at the end of each year (categorical, 2019–2026; the launch table of the English Wikipedia article “Disney+”, revision 1383663039, 137 rows). It launched in the US, Canada and the Netherlands on 12 November 2019, in seven European countries on 24 March 2020, in 41 Latin American and Caribbean countries and territories at once on 17 November 2020, and in two waves in June 2022 (16 in the Middle East and North Africa, 35 in Central and Eastern Europe, Turkey and British and French territories), reaching 141 countries and territories by 2026 (including British, French and Dutch overseas territories). India and Southeast Asia had a separate brand: India has had Disney+ Hotstar since 2020, which merged with JioCinema into JioHotstar on 14 February 2025, no longer controlled by Disney; Indonesia, Malaysia and Thailand launched as Disney+ Hotstar and were renamed Disney+ on 8 October 2025. Taiwan launched on 12 November 2021, the same day as South Korea. Uncoloured countries are not in the table, meaning no Disney+: China, Russia, Vietnam, and 47 of Africa’s 54 countries (only South Africa, Egypt, Morocco, Algeria, Tunisia, Libya and Mauritius have it). Hover for the launch date and the telecoms or platforms that partnered at launch. Disney’s own country list cannot be scraped under its terms of use, so only Wikipedia is used; prices are not shown.',
      },
      unit: '',
      file: 'disneyplus.json',
      layer: { kind: 'categorical', categories: PLUS_BRANDS },
      format: categoryText(PLUS_BRANDS),
      missing: PLUS_MISSING,
      unranked: true,
      defaultYear: 2026,
    },
    {
      id: 'disneyplus-launch',
      label: { zh: 'Disney+ 哪一年上線', en: 'Year Disney+ launched' },
      description: {
        zh: '第一次看得到迪士尼經營的串流（Disney+ 或 Disney+ Hotstar）是哪一年（類別圖，越早越深；同一張維基表）：2019 年 6 個（美國、加拿大、荷蘭、澳洲、紐西蘭、波多黎各）、2020 年 75 個、2021 年 6 個（新加坡、南韓、台灣、香港、馬來西亞、泰國）、2022 年 54 個。印度算 2020 年（Disney+ Hotstar），印尼 2020 年、馬來西亞與泰國 2021 年也是 Disney+ Hotstar 上線的年份。2023 年以後沒有新的國家：條目寫原本預計 2023 年底超過 160 國，結果那一年一個都沒有增加；2025 年 10 月東南亞那一次只是改名。',
        en: 'The year a Disney-run streaming service (Disney+ or Disney+ Hotstar) first became available (categorical, darker is earlier; same Wikipedia table): 6 in 2019 (US, Canada, Netherlands, Australia, New Zealand, Puerto Rico), 75 in 2020, 6 in 2021 (Singapore, South Korea, Taiwan, Hong Kong, Malaysia, Thailand) and 54 in 2022. India counts as 2020 (Disney+ Hotstar), and 2020 for Indonesia and 2021 for Malaysia and Thailand are also Disney+ Hotstar launches. No country has been added since: the article notes that the service was expected in more than 160 countries by the end of 2023, but none were added that year, and the October 2025 change in Southeast Asia was only a rename.',
      },
      unit: '',
      file: 'disneyplus-launch.json',
      layer: { kind: 'categorical', categories: PLUS_LAUNCH, ordinal: true },
      format: categoryText(PLUS_LAUNCH),
      missing: PLUS_MISSING,
      unranked: true,
      defaultYear: 2026,
    },
    {
      id: 'filming',
      label: { zh: '在這裡取景的迪士尼片庫作品', en: 'Disney library titles filmed here' },
      description: {
        zh: '迪士尼片庫的作品有幾部在這一國取景（比例圓；Wikidata 的拍攝地 P915）。片庫是製作、發行或製片掛在迪士尼系十家片廠（Walt Disney Pictures、Marvel Studios、Lucasfilm、Walt Disney Animation Studios、Pixar、20th Century Studios、Searchlight、Touchstone、Walt Disney Studios、Walt Disney Studios Motion Pictures）的作品，包括 20 世紀福斯併進迪士尼以前的舊片與只是發行的片，所以這是「迪士尼現在擁有的片庫」，不是「迪士尼拍的」。有拍攝地的 1,247 部、770 處地點、79 國：美國 783 部、加拿大 157、英國 109、法國 43、西班牙 38、墨西哥 31、義大利 29、德國 27、澳洲 25、紐西蘭 20。最多的地點是洛杉磯 162 部、紐約 138、溫哥華 71、英國的松林製片廠 55。台灣 3 部：1966 年的 The Sand Pebbles 與 2012 年的《少年Pi的奇幻漂流》（20 世紀福斯製作）、2013 年的《天台》（發行）。只寫到州或省的（加州 141 部最多）畫成空心的大圈，因為那一點只是州的中心。Wikidata 偏向有名的大片與歐美的外景，沒寫拍攝地的作品不在裡面。',
        en: 'How many titles in the Disney library were filmed in each country (proportional circles; Wikidata filming location, P915). The library is every title produced, distributed or co-produced by ten Disney studios (Walt Disney Pictures, Marvel Studios, Lucasfilm, Walt Disney Animation Studios, Pixar, 20th Century Studios, Searchlight, Touchstone, Walt Disney Studios and Walt Disney Studios Motion Pictures), including older 20th Century Fox films and titles Disney only distributed, so it is what Disney owns now, not what Disney made. 1,247 titles have a filming location: 770 places in 79 countries; the US has 783 titles, Canada 157, the UK 109, France 43, Spain 38, Mexico 31, Italy 29, Germany 27, Australia 25 and New Zealand 20. The top places are Los Angeles (162), New York (138), Vancouver (71) and Pinewood Studios in England (55). Taiwan has 3: The Sand Pebbles (1966) and Life of Pi (2012), both made by 20th Century Fox, and The Rooftop (2013, distributed). Places given only as a state or province (California has the most, 141) are drawn as hollow circles, because the dot is just the centre of the state. Wikidata favours well-known films and Western locations; titles without a filming location are not counted.',
      },
      unit: { zh: '部', en: 'titles' },
      file: 'filming-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 500] },
      format: (v) => worksCount(v),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
    {
      id: 'settings',
      label: { zh: '故事設定在這裡的迪士尼片庫作品', en: 'Disney library titles set here' },
      description: {
        zh: '迪士尼片庫的作品有幾部的故事設定在這一國（比例圓；Wikidata 的故事場景地 P840，同一個片庫）。有場景地的 2,162 部、633 處地點、99 國：美國 1,212 部、英國 240、法國 112、義大利 57、加拿大 47、德國 45、印度 37、墨西哥 36、俄羅斯 34、日本 26。城市是紐約 296 部最多，倫敦與洛杉磯各 148、巴黎 67。台灣 3 部，都是 20 世紀福斯在台灣發行的國片：《天邊一朵雲》（2005）、《那些年，我們一起追的女孩》（2011）、《天台》（2013）。這裡量的是「設定在哪裡」，不是「取材自哪裡」。虛構的地點 134 處不畫在地圖上、只進清單（《辛普森家庭》的 Springfield 36 部最多，還有《星際大戰》的 Tatooine、漫威的 Wakanda、《冰雪奇緣》的 Arendelle、2019 年《獅子王》的 Pride Lands）；寫成洲、海洋或「中國」這種文化地區的 28 處不算進任何一國，1998 年的《花木蘭》寫的就是「中國」這個文化地區、不是中華人民共和國，所以不算進中國。',
        en: 'How many titles in the Disney library are set in each country (proportional circles; Wikidata narrative location, P840, same library). 2,162 titles have a setting: 633 places in 99 countries; the US has 1,212, the UK 240, France 112, Italy 57, Canada 47, Germany 45, India 37, Mexico 36, Russia 34 and Japan 26. New York is the top city (296), then London and Los Angeles (148 each) and Paris (67). Taiwan has 3, all Taiwanese films distributed in Taiwan by 20th Century Fox: The Wayward Cloud (2005), You Are the Apple of My Eye (2011) and The Rooftop (2013). This measures where a story is set, not where it was drawn from. The 134 fictional places are listed but not mapped (The Simpsons’ Springfield has the most, 36, followed by Star Wars’ Tatooine, Marvel’s Wakanda, Frozen’s Arendelle and the Pride Lands of the 2019 Lion King); 28 places given as a continent, an ocean or a cultural region such as “China” are not counted for any country: Mulan (1998) is set in “China” the cultural region, not the People’s Republic, so it does not count for China.',
      },
      unit: { zh: '部', en: 'titles' },
      file: 'settings-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 500] },
      format: (v) => worksCount(v),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
  ],
};
