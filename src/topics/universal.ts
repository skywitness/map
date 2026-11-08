import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { placeLayer, placeList, worksCount } from './film-places';
import { OWNERSHIP, OWNERSHIP_COLORS, ownershipText } from './park-ownership';
import type { CategoryDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 環球影城（新主題，2026-11-08，製作手冊第二十八批 680，候選 1521、1522、1525；旅遊・樂園；pipeline/topics/universal.py）。
 * 據點是手工白名單（pipeline/data/universal/places.csv）的 QID，座標從 Wikidata，開幕年從英文維基的固定版本。
 * 商標的硬規則跟「迪士尼」一樣（手冊第二十八批）：不放 logo 或品牌配色（顏色用網站的分類色盤），說明文字自己寫，不放購票或官網連結，
 * 不寫「官方」「合作」「授權」這類字，不做跟迪士尼的「對決」。樂園與度假區是兩層，不混算：「環球有幾座樂園」是 9。
 */

const C = MAP_TOKENS.categorical;

/** 所在地（pipeline 的 RESORTS 同樣的順序，代碼是索引 + 1） */
export const UNIVERSAL_SITES: Text[] = [
  { zh: '好萊塢', en: 'Hollywood' },
  { zh: '奧蘭多', en: 'Orlando' },
  { zh: '大阪', en: 'Osaka' },
  { zh: '新加坡', en: 'Singapore' },
  { zh: '北京', en: 'Beijing' },
  { zh: '德州 Frisco', en: 'Frisco, Texas' },
  { zh: '英國 Bedford', en: 'Bedford, England' },
];
const KINDS: { label: Text; color: string }[] = [
  { label: { zh: '主題樂園', en: 'Theme park' }, color: C[0] },
  { label: { zh: '水上樂園', en: 'Water park' }, color: C[1] },
  { label: { zh: '度假區', en: 'Resort' }, color: C[4] },
];
const STATUS: Text[] = [
  { zh: '營運中', en: 'Open' },
  { zh: '已關閉', en: 'Closed' },
  { zh: '在建', en: 'Under construction' },
];

const UNIVERSAL_PARENT: Text = { zh: 'NBCUniversal（Comcast）', en: 'NBCUniversal (Comcast)' };

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);
const at = <T,>(list: T[], code: unknown) => list[(typeof code === 'number' ? code : 1) - 1] ?? list[0];

/** 中文介面用常用的中文名，沒有就用英文（不自己翻譯） */
export function universalName(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.en ?? '');
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

const haText = (v: number) => tr({ zh: `${fixed(v, 1)} 公頃`, en: `${fixed(v, 1)} ha` });

/**
 * 面積與設施數（第二十八批 681，pipeline/topics/universal_area.py）：OSM 的多邊形面積與英文維基 infobox 的面積並列（口徑不同、
 * 不排名），OSM 算出來的雲霄飛車 0 座寫成「OSM 沒有標」
 */
function sizeFacts(p: PointRecord): string[] {
  const out: string[] = [];
  const osm = num(p, 'osm_ha');
  const wiki = num(p, 'wiki_ha');
  if (osm || wiki)
    out.push(
      [osm ? tr({ zh: `OSM 畫的邊界 ${haText(osm)}`, en: `OSM outline ${haText(osm)}` }) : '', wiki ? tr({ zh: `維基寫 ${haText(wiki)}`, en: `Wikipedia gives ${haText(wiki)}` }) : '']
        .filter(Boolean)
        .join(tr({ zh: '、', en: ', ' })),
    );
  const rc = num(p, 'rc');
  const wc = num(p, 'wc');
  if (p.kind === 1 && (rc !== null || wc !== null))
    out.push(
      tr({ zh: '雲霄飛車：', en: 'Roller coasters: ' }) +
        [
          rc === null ? '' : rc === 0 ? tr({ zh: 'OSM 沒有標', en: 'none tagged on OSM' }) : tr({ zh: `OSM ${rc} 座`, en: `${rc} on OSM` }),
          wc === null ? '' : tr({ zh: `維基 ${wc} 座`, en: `${wc} per Wikipedia` }),
        ]
          .filter(Boolean)
          .join(tr({ zh: '、', en: ', ' })),
    );
  const rides = num(p, 'rides');
  const wr = num(p, 'wr');
  if (rides) out.push(tr({ zh: `遊樂設施 ${rides} 項${wr ? `（水上 ${wr} 項）` : ''}（維基）`, en: `${rides} rides${wr ? ` (${wr} water rides)` : ''} (Wikipedia)` }));
  return out;
}

function facts(p: PointRecord): string[] {
  const y = num(p, 'y');
  const yc = num(p, 'yc');
  const out: string[] = [];
  if (y) out.push(yc ? tr({ zh: `環球經營 ${y}–${yc} 年`, en: `Run by Universal ${y}–${yc}` }) : tr({ zh: `${y} 年開幕`, en: `Opened ${y}` }));
  else out.push(tr({ zh: '在建，還沒有開幕年', en: 'Under construction, no opening year yet' }));
  const own = ownershipText(p, UNIVERSAL_PARENT);
  if (own) out.push(own);
  out.push(...sizeFacts(p));
  if (getLang() === 'zh' && typeof p.note === 'string' && p.note) out.push(p.note);
  return out;
}

function tooltip(p: PointRecord, { countryName }: { countryName: (iso3: string) => string }) {
  const { title, proper } = universalName(p);
  const detail = [tr(at(KINDS, p.kind).label), tr(at(UNIVERSAL_SITES, p.resort)), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
    .filter(Boolean)
    .join(' · ');
  return { title, detail, extra: facts(p), properNoun: proper };
}


const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-sites',
  file: 'sites.json',
  label: { zh: '環球的樂園（依開幕年出現，已關閉的在關閉之後消失；顏色是所有權）', en: 'Universal parks (appear in their opening year; closed ones disappear; colour shows ownership)' },
  indicators: ['parks'],
  // 主題樂園與水上樂園用點的大小分，顏色是四種所有權關係（第二十八批 684）
  radius: { field: 'kind', stops: [[1, 6], [2, 4]] },
  color: OWNERSHIP_COLORS,
  timeField: 'y',
  endField: 'yc',
  sortField: 'kind',
  tooltip,
};
const RESORT_RINGS: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-resorts',
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
  id: 'universal-planned',
  file: 'planned.json',
  label: { zh: '在建（沒有開幕年）', en: 'Under construction (no opening year)' },
  indicators: ['parks'],
  radius: 6,
  look: 'hollow',
  color: KINDS[0].color,
  tooltip,
};

/** 園區的邊界（OSM 的多邊形，畫成線；第二十八批 681） */
const OUTLINES: LinesOverlayDef = {
  kind: 'lines',
  id: 'universal-outlines',
  file: 'outlines.json',
  label: { zh: 'OpenStreetMap 畫的園區邊界（放大看）', en: 'Park outlines from OpenStreetMap (zoom in)' },
  indicators: ['parks'],
  width: 1.5,
  color: C[0],
  tooltip: () => ({
    title: tr({ zh: 'OpenStreetMap 畫的邊界', en: 'Outline drawn on OpenStreetMap' }),
    extra: [tr({ zh: '各園的畫法不一樣：有的含停車場與飯店，有的只有前場，所以面積不拿來排名', en: 'Outlines are drawn differently (some include car parks and hotels, some only the front area), so areas are not ranked' })],
  }),
};

function groupOf(p: PointRecord): { order: number; label: string } {
  if (p.status === 2) return { order: 90, label: tr(STATUS[1]) };
  if (p.status === 3) return { order: 91, label: tr(STATUS[2]) };
  const i = (typeof p.resort === 'number' ? p.resort : 1) - 1;
  return { order: i, label: tr(UNIVERSAL_SITES[i]) };
}

const PARK_LIST: ListPanelDef = {
  label: { zh: '環球的樂園', en: 'Universal parks' },
  tabLabel: { zh: '樂園', en: 'Parks' },
  indicators: ['parks'],
  file: 'places-area.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .map((p) => ({ p, g: groupOf(p) }))
      // 度假區排在同一地的樂園前面，同一地依開幕年
      .sort((a, b) => a.g.order - b.g.order || (b.p.kind === 3 ? 1 : 0) - (a.p.kind === 3 ? 1 : 0) || (num(a.p, 'y') ?? 9999) - (num(b.p, 'y') ?? 9999))
      .map(({ p, g }): ListRow => {
        const { title, proper } = universalName(p);
        return {
          key: String(p.qid),
          title,
          properNoun: proper,
          group: g.label,
          muted: p.status !== 1 || p.kind === 3,
          lines: [[tr(at(KINDS, p.kind).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '), facts(p).join(tr({ zh: '；', en: '; ' }))],
          link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};


// ── 人次與恢復率（2026-11-08，製作手冊第二十八批 682，候選 1524；pipeline/topics/universal_visits.py） ──
// 2009–2024 是維基的單園表（TEA／AECOM 的轉引），維基表沒有的與 2025 年用 Wikidata P1174；集團的數字只寫在說明。
const VISIT_YEARS = Array.from({ length: 17 }, (_, i) => 2009 + i);
const visitsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const clampYear = (y: number) => Math.min(2025, Math.max(2009, y));
function visitFacts(p: PointRecord): string[] {
  const v19 = num(p, 'v2019');
  const v24 = num(p, 'v2024');
  const v25 = num(p, 'v2025');
  const out: string[] = [];
  if (v25) out.push(tr({ zh: `2025 年 ${visitsText(v25)}`, en: `${visitsText(v25)} in 2025` }) + (p.qid === 'Q66085108' ? tr({ zh: '（5 月 22 日開幕，不是整年）', en: ' (opened 22 May, part year)' }) : ''));
  if (v24 && v19) out.push(tr({ zh: `2024 年是 2019 年的 ${fixed((v24 / v19) * 100, 0)}%`, en: `2024 was ${fixed((v24 / v19) * 100, 0)}% of 2019` }));
  out.push(p.src === 1 ? tr({ zh: '維基的單園表，2025 年是 Wikidata', en: 'Wikipedia’s park table; 2025 from Wikidata' }) : tr({ zh: '維基的單園表沒有，用 Wikidata', en: 'Not in Wikipedia’s park table; from Wikidata' }));
  return out;
}
const PARK_VISITS: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-park-visits',
  file: 'park-visits.json',
  label: { zh: '環球樂園的人次', en: 'Universal park attendance' },
  indicators: ['visitors', 'recovery'],
  epochs: { years: VISIT_YEARS, values: (p, y) => ({ vv: num(p, `v${y}`) }) },
  radius: { field: 'vv', stops: [[1e6, 3], [5e6, 6], [10e6, 9], [16e6, 12]] },
  color: C[0],
  sortField: 'vv',
  tooltip: (p, { countryName, year }) => {
    const { title, proper } = universalName(p);
    const y = clampYear(year ?? 2025);
    const v = num(p, `v${y}`);
    return {
      title,
      detail: [tr(at(UNIVERSAL_SITES, p.resort)), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: [v ? tr({ zh: `${y} 年 ${visitsText(v)}`, en: `${visitsText(v)} in ${y}` }) : tr({ zh: `${y} 年沒有人次`, en: `No figure for ${y}` }), ...visitFacts(p)],
      properNoun: proper,
    };
  },
};
const VISIT_LIST: ListPanelDef = {
  label: { zh: '環球樂園的人次', en: 'Universal park attendance' },
  tabLabel: { zh: '人次', en: 'Attendance' },
  indicators: ['visitors', 'recovery'],
  file: 'park-visits.json',
  countryField: 'iso3',
  sorts: [
    { id: 'visitors', label: { zh: '依 2025 年人次', en: 'By 2025 attendance' } },
    { id: 'recovery', label: { zh: '依恢復率', en: 'By recovery' } },
  ],
  rows: (points, { countryName, sort }) => {
    const rec = (p: PointRecord) => (num(p, 'v2019') && num(p, 'v2024') ? (num(p, 'v2024') as number) / (num(p, 'v2019') as number) : -1);
    return points
      .slice()
      .sort((a, b) => (sort === 'recovery' ? rec(b) - rec(a) : (num(b, 'v2025') ?? 0) - (num(a, 'v2025') ?? 0)))
      .map((p, i): ListRow => {
        const { title, proper } = universalName(p);
        // 長條只畫 2009–2025 每年都有人次的樂園（缺的年份畫成 0 會被看成關園）
        const full = VISIT_YEARS.every((y) => num(p, `v${y}`) !== null);
        return {
          key: String(p.qid),
          title: `${i + 1}. ${title}`,
          properNoun: proper,
          lines: [[tr(at(UNIVERSAL_SITES, p.resort)), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '), ...visitFacts(p)],
          ...(full && {
            bars: {
              values: VISIT_YEARS.map((y) => num(p, `v${y}`) ?? 0),
              highlight: [VISIT_YEARS.indexOf(2020)],
              labels: ['2009', '2025'],
              aria: tr({ zh: '2009–2025 年的人次', en: 'Attendance 2009–2025' }),
            },
          }),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      });
  },
};


// ── 樂園之外的環球（2026-11-08，製作手冊第二十八批 683，候選 1527、1528、1529、1530、1537；pipeline/topics/universal_other.py） ──
// CityWalk、奧蘭多的直營飯店、Horror Unleashed、曾經是環球的與取消的；IP 主題園區只進清單（座標大多沒有）。
// IP 名稱（哈利波特、超級任天堂）是別人的商標，只當事實指稱，不放圖、不寫劇情。
const OTHER_KINDS: { label: Text; color: string }[] = [
  { label: { zh: 'CityWalk（園外的餐廳與商店）', en: 'CityWalk (dining and shops outside the gates)' }, color: C[2] },
  { label: { zh: '直營飯店', en: 'Universal-run hotels' }, color: C[3] },
  { label: { zh: 'Horror Unleashed（樂園以外的體驗館）', en: 'Horror Unleashed (venue outside the parks)' }, color: C[5] },
  { label: { zh: '曾經是環球的', en: 'Formerly Universal' }, color: MAP_TOKENS.categoricalOther },
  { label: { zh: '取消的計畫', en: 'Cancelled project' }, color: MAP_TOKENS.categoricalOther },
  { label: { zh: 'IP 主題園區（在樂園裡）', en: 'IP-themed lands (inside parks)' }, color: C[0] },
];
function dateText(v: number | null): string {
  if (!v) return '';
  const s = String(v);
  if (s.length === 4) return tr({ zh: `${s} 年`, en: s });
  return tr({ zh: `${s.slice(0, 4)} 年 ${Number(s.slice(4, 6))} 月 ${Number(s.slice(6))} 日`, en: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` });
}
function otherFacts(p: PointRecord): string[] {
  const out: string[] = [];
  const d = num(p, 'd');
  if (p.status === 2) out.push(tr({ zh: '在建，沒有開幕日', en: 'Under construction, no opening date' }));
  else if (p.status === 4) out.push(tr({ zh: '取消的計畫', en: 'Cancelled project' }));
  else if (d) out.push(p.status === 3 ? tr({ zh: `環球 ${dateText(d)}買進`, en: `Universal bought in ${dateText(d)}` }) : tr({ zh: `${dateText(d)}開幕`, en: `Opened ${dateText(d)}` }));
  const rooms = num(p, 'rooms');
  if (rooms) out.push(tr({ zh: `${fixed(rooms, 0)} 間房`, en: `${fixed(rooms, 0)} rooms` }));
  if (getLang() === 'zh' && typeof p.note === 'string' && p.note) out.push(p.note);
  return out;
}
const otherTooltip = (p: PointRecord, { countryName }: { countryName: (iso3: string) => string }) => ({
  title: String(p.en ?? ''),
  properNoun: String(p.en ?? ''),
  detail: [tr(at(OTHER_KINDS, p.k).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
  extra: otherFacts(p),
});
const OTHER: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-other',
  file: 'other.json',
  label: { zh: '樂園之外：CityWalk、直營飯店、Horror Unleashed、曾經是環球的', en: 'Beyond the parks: CityWalk, hotels, Horror Unleashed, former sites' },
  indicators: ['parks'],
  radius: 4,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5],
    classes: OTHER_KINDS.slice(0, 4).map(({ label, color }) => ({ label, color })),
  },
  tooltip: otherTooltip,
};
const OTHER_PLANNED: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-other-planned',
  file: 'other-planned.json',
  label: { zh: '在建與取消的（空心）', en: 'Under construction and cancelled (hollow)' },
  indicators: ['parks'],
  radius: 4,
  look: 'hollow',
  color: MAP_TOKENS.categoricalOther,
  tooltip: otherTooltip,
};
const OTHER_LIST: ListPanelDef = {
  label: { zh: '樂園之外的環球', en: 'Universal beyond the parks' },
  tabLabel: { zh: '樂園之外', en: 'Beyond parks' },
  indicators: ['parks'],
  file: 'other-all.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .slice()
      .sort((a, b) => (num(a, 'k') ?? 9) - (num(b, 'k') ?? 9) || String(a.en).localeCompare(String(b.en)) || (num(a, 'd') ?? 0) - (num(b, 'd') ?? 0))
      .map(
        (p): ListRow => ({
          key: String(p.key),
          title: String(p.en ?? ''),
          titleProper: true,
          group: tr(at(OTHER_KINDS, p.k).label),
          muted: p.status !== 1,
          lines: [
            [p.resort ? tr(at(UNIVERSAL_SITES, p.resort)) : '', typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '),
            otherFacts(p).join(tr({ zh: '；', en: '; ' })),
          ],
          link: { href: String(p.src ?? ''), label: tr({ zh: '資料出處', en: 'Source' }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
        }),
      ),
};


// ── 誰擁有哪一座、母公司的影視據點（2026-11-08，製作手冊第二十八批 684，候選 1531、1532；pipeline/topics/universal_media.py） ──
// 四種所有權關係跟「迪士尼」共用（park-ownership.ts）。影視據點是手工白名單：有自己座標的建築畫點，總部只到城市的只進清單。
const MEDIA_ROLES: Text[] = [
  { zh: '總部', en: 'Headquarters' },
  { zh: '辦公大樓', en: 'Offices' },
  { zh: '片廠與電影', en: 'Studios and film' },
  { zh: '電視', en: 'Television' },
  { zh: '樂園部門', en: 'Parks division' },
  { zh: '串流', en: 'Streaming' },
];
const MEDIA: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-media',
  file: 'media.json',
  label: { zh: '母公司 NBCUniversal（Comcast）的總部、片廠與電視大樓', en: 'Parent NBCUniversal (Comcast): headquarters, studios and TV buildings' },
  indicators: ['parks'],
  radius: 4,
  look: 'faint',
  color: MAP_TOKENS.categoricalOther,
  tooltip: (p, { countryName }) => ({
    title: String(p.en ?? ''),
    properNoun: String(p.en ?? ''),
    detail: [tr(at(MEDIA_ROLES, p.role)), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: getLang() === 'zh' && typeof p.note === 'string' ? [p.note] : [],
  }),
};
const MEDIA_LIST: ListPanelDef = {
  label: { zh: '母公司的影視據點', en: 'Parent company sites' },
  tabLabel: { zh: '母公司', en: 'Parent' },
  indicators: ['parks'],
  file: 'media-all.json',
  rows: (points, { countryName }) =>
    points
      .slice()
      .sort((a, b) => (num(b, 'mapped') ?? 0) - (num(a, 'mapped') ?? 0) || (num(a, 'role') ?? 9) - (num(b, 'role') ?? 9))
      .map(
        (p): ListRow => ({
          key: String(p.qid),
          title: String(p.en ?? ''),
          titleProper: true,
          group: p.mapped === 1 ? tr({ zh: '有自己的座標（畫在地圖上）', en: 'With own coordinates (on the map)' }) : tr({ zh: '總部只寫到城市（不畫點）', en: 'Headquarters given only as a city (not mapped)' }),
          muted: p.mapped !== 1,
          lines: [
            [tr(at(MEDIA_ROLES, p.role)), typeof p.iso3 === 'string' ? countryName(p.iso3) : '', typeof p.city === 'string' ? p.city : ''].filter(Boolean).join(' · '),
            getLang() === 'zh' && typeof p.note === 'string' ? p.note : '',
          ].filter(Boolean),
          link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
          target: typeof p.lon === 'number' ? { lon: Number(p.lon), lat: Number(p.lat), zoom: p.mapped === 1 ? 15 : 9 } : { box: [-170, -55, 170, 72] },
        }),
      ),
};
const OWN_SOURCES: Record<number, string> = {
  2: 'https://en.wikipedia.org/wiki/Universal_Studios_Japan?oldid=1384197462',
  3: 'https://en.wikipedia.org/wiki/Universal_Beijing_Resort?oldid=1381734293',
  4: 'https://en.wikipedia.org/wiki/Universal_Destinations_%26_Experiences?oldid=1382726905',
};
const OWN_LIST: ListPanelDef = {
  label: { zh: '誰擁有哪一座', en: 'Who owns which park' },
  tabLabel: { zh: '所有權', en: 'Ownership' },
  indicators: ['parks'],
  file: 'places-area.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.kind !== 3)
      .slice()
      .sort((a, b) => (num(a, 'own') ?? 9) - (num(b, 'own') ?? 9) || (num(a, 'y') ?? 9999) - (num(b, 'y') ?? 9999))
      .map((p): ListRow => {
        const { title, proper } = universalName(p);
        const own = num(p, 'own') ?? 1;
        return {
          key: String(p.qid),
          title,
          properNoun: proper,
          group: tr(OWNERSHIP[own - 1].label),
          muted: p.status !== 1,
          lines: [[tr(at(UNIVERSAL_SITES, p.resort)), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '), ownershipText(p, UNIVERSAL_PARENT) ?? ''],
          link: { href: OWN_SOURCES[own] ?? `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: '資料出處', en: 'Source' }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};


// ── 環球的片、拍攝地、Peacock、台灣的票房（2026-11-08，製作手冊第二十八批 685，候選 1534、1535、1536、1540；
// pipeline/topics/universal_film.py；1539 新加坡的樂園業沒做） ──
const FILMING = placeLayer('universal-filming', 'filming.json', { zh: '環球影業的片的拍攝地', en: 'Filming locations of Universal Pictures titles' }, 'filming', C[0], false);
const FILMING_REGIONS = placeLayer('universal-filming-regions', 'filming-regions.json', { zh: '只寫到州、省的拍攝地（空心）', en: 'Filming locations given only as a state or province (hollow)' }, 'filming', C[0], true);
const FILMING_LIST = placeList('filming-all.json', { zh: '環球影業的片的拍攝地', en: 'Filming locations of Universal Pictures titles' }, { zh: '拍攝地', en: 'Filming' }, 'filming');

const PEACOCK_KINDS: CategoryDef[] = [
  { value: 1, label: { zh: 'Peacock 自己的訂閱服務', en: 'Peacock’s own subscription service' } },
  { value: 2, label: { zh: '環球的內容放在別家的平台', en: 'Universal content on another platform' } },
];
const ymd = (v: number) => {
  const s = String(v);
  return tr({ zh: `${s.slice(0, 4)} 年 ${Number(s.slice(4, 6))} 月 ${Number(s.slice(6))} 日`, en: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` });
};
const PEACOCK_LIST: ListPanelDef = {
  label: { zh: 'Peacock 與環球內容的上線時程', en: 'Peacock and Universal content launches' },
  tabLabel: { zh: 'Peacock', en: 'Peacock' },
  indicators: ['peacock'],
  file: 'peacock-list.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .slice()
      .sort((a, b) => (num(a, 'd') ?? 0) - (num(b, 'd') ?? 0))
      .map(
        (p): ListRow => ({
          key: String(p.iso3),
          title: countryName(String(p.iso3)),
          group: ymd(num(p, 'd') ?? 0),
          lines: [
            p.own === 1 ? tr(PEACOCK_KINDS[0].label) : tr({ zh: `放在 ${String(p.partners ?? '')}`, en: `On ${String(p.partners ?? '')}` }),
          ],
          link: { href: 'https://en.wikipedia.org/wiki/Peacock_(streaming_service)?oldid=1383883074', label: tr({ zh: '資料出處 英文維基百科', en: 'Source: English Wikipedia' }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 4 },
        }),
      ),
};

const TW_FILMS_LIST: ListPanelDef = {
  label: { zh: '環球台灣分公司發行的片（票房）', en: 'Films released in Taiwan by Universal’s Taiwan branch (box office)' },
  tabLabel: { zh: '台灣的票房', en: 'Taiwan box office' },
  indicators: ['tw-box-office'],
  file: 'tw-films.json',
  rows: (points) =>
    points.map(
      (p, i): ListRow => ({
        key: `${String(p.name)}-${i}`,
        title: `${i + 1}. ${String(p.name ?? '')}`,
        titleProper: true,
        lines: [
          tr({ zh: `${ymd(num(p, 'date') ?? 0)}上映`, en: `Released ${ymd(num(p, 'date') ?? 0)}` }),
          tr({ zh: `${formatLargeNumber(num(p, 'amount') ?? 0)} 元、${formatLargeNumber(num(p, 'tickets') ?? 0)} 張票`, en: `NT$${formatLargeNumber(num(p, 'amount') ?? 0)}, ${formatLargeNumber(num(p, 'tickets') ?? 0)} tickets` }),
        ],
        link: { href: 'https://data.gov.tw/dataset/94224', label: tr({ zh: '資料出處 全國電影票房統計數據', en: 'Source: Taiwan national box office data' }) },
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
      }),
    ),
};

const DECADE_LIST: ListPanelDef = {
  label: { zh: '跟環球影業有關的片，每十年幾部', en: 'Universal Pictures titles per decade' },
  tabLabel: { zh: '每十年的片數', en: 'Titles per decade' },
  indicators: ['filming'],
  file: 'films-decades.json',
  rows: (points) =>
    points.map((p): ListRow => {
      const d = num(p, 'd') ?? 0;
      const years = String(p.years ?? '').split(',').map(Number);
      return {
        key: String(d),
        title: tr({ zh: `${d} 年代`, en: `${d}s` }),
        lines: [worksCount(num(p, 'n') ?? 0)],
        bars: { values: years, labels: [String(d), String(d + 9)], aria: tr({ zh: `${d} 年代每年的片數`, en: `Titles per year in the ${d}s` }) },
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
      };
    }),
};

export const universal: TopicDefinition = {
  id: 'universal',
  title: { zh: '環球影城在哪裡：樂園與度假區', en: 'Where Universal is: parks and resorts' },
  shortTitle: { zh: '環球影城', en: 'Universal' },
  defaultIndicator: 'parks',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（據點的座標，經 QLever 查詢；據點是手工整理的白名單）', en: 'Wikidata (coordinates, via QLever; sites from a hand-checked list)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: 'OpenStreetMap（園區的邊界、面積與園內的雲霄飛車，經 QLever 查詢）', en: 'OpenStreetMap (park outlines, areas and roller coasters, via QLever)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    {
      name: {
        zh: '英文維基百科各園的條目（infobox 的面積、遊樂設施與雲霄飛車數；固定版本記在資料檔）',
        en: 'English Wikipedia articles on each park (infobox area, rides and coasters; revisions recorded in the data files)',
      },
      url: 'https://en.wikipedia.org/wiki/Universal_Epic_Universe?oldid=1384410524',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of amusement park rankings」（樂園與集團的人次，數字原本來自 TEA／AECOM）與 Wikidata 的年人次（P1174）',
        en: 'English Wikipedia, “List of amusement park rankings” (park and group attendance, originally from TEA/AECOM) and Wikidata annual attendance (P1174)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_amusement_park_rankings?oldid=1377863670',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Universal Orlando」（revid 1384195678，飯店的開幕日與房間數）、「Universal Horror Unleashed」（revid 1376754925）與 IP 主題園區的條目',
        en: 'English Wikipedia, “Universal Orlando” (revid 1384195678: hotel opening dates and rooms), “Universal Horror Unleashed” (revid 1376754925) and the articles on IP-themed lands',
      },
      url: 'https://en.wikipedia.org/wiki/Universal_Orlando?oldid=1384195678',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「Peacock (streaming service)」（revid 1383883074，上線表）', en: 'English Wikipedia, “Peacock (streaming service)” (revid 1383883074: launch table)' },
      url: 'https://en.wikipedia.org/wiki/Peacock_(streaming_service)?oldid=1383883074',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '國家電影及視聽文化中心「全國電影票房統計數據」（政府資料開放平臺 94224）', en: 'Taiwan Film and Audiovisual Institute, national box office data (data.gov.tw 94224)' },
      url: 'https://data.gov.tw/dataset/94224',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      // 新加坡統計局條款第 25 條：連到 SingStat 的網頁要先取得書面同意，所以只寫名稱與表號，連結放開放資料授權（製作手冊 685，候選 1539）
      name: {
        zh: '新加坡統計局 Table Builder 表 M601471「Key Indicators By Industry Group In All Services Industries, Annual」（2026-11-08 取得）。Contains information from Key Indicators By Industry Group In All Services Industries, Annual accessed on 8 November 2026 from the Singapore Department of Statistics, which is made available under the terms of the Singapore Open Data Licence version 1.0',
        en: 'Contains information from Key Indicators By Industry Group In All Services Industries, Annual (SingStat Table Builder table M601471) accessed on 8 November 2026 from the Singapore Department of Statistics, which is made available under the terms of the Singapore Open Data Licence version 1.0',
      },
      url: 'https://data.gov.sg/open-data-licence',
      license: 'Singapore Open Data Licence v1.0',
    },
    {
      name: {
        zh: '英文維基百科「Universal Destinations & Experiences」（revid 1382726905，開幕與關閉的日期）',
        en: 'English Wikipedia, “Universal Destinations & Experiences” (revid 1382726905: opening and closing dates)',
      },
      url: 'https://en.wikipedia.org/wiki/Universal_Destinations_%26_Experiences?oldid=1382726905',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '這個主題整理的是 Wikidata、OpenStreetMap 與維基百科上的公開資料，不是環球影城或它的母公司提供的。度假區（例如奧蘭多）與裡面的樂園是兩層，「幾座樂園」只算營運中的主題樂園與水上樂園。台灣沒有環球的樂園。跟迪士尼在同一座城市的樂園，對照在「樂園」主題的「同一座城市的兩家樂園」。',
    en: 'This topic compiles public data from Wikidata, OpenStreetMap and Wikipedia; it is not provided by Universal or its parent company. Resorts (such as Orlando) and the parks inside them are two levels, and park counts include open theme and water parks only. Taiwan has no Universal park. Where Universal and Disney share a city, see “Two park brands in the same city” in the Theme parks topic.',
  },
  overlays: [OUTLINES, RESORT_RINGS, SITES, PLANNED, OTHER, OTHER_PLANNED, MEDIA, PARK_VISITS, FILMING_REGIONS, FILMING],
  listPanel: [PARK_LIST, VISIT_LIST, OTHER_LIST, OWN_LIST, MEDIA_LIST, FILMING_LIST, DECADE_LIST, PEACOCK_LIST, TW_FILMS_LIST],
  indicators: [
    {
      id: 'parks',
      label: { zh: '環球的樂園', en: 'Universal parks' },
      description: {
        zh: '各國那一年有幾座環球經營的樂園（比例圓，含水上樂園；拖時間軸看 1964 年好萊塢開始怎麼擴張）。2026 年營運中的是 9 座：美國 6 座（好萊塢 1 座，奧蘭多的佛羅里達環球影城 1990、冒險島樂園 1999、水上樂園 Volcano Bay 2017、史詩宇宙 2025 共 4 座，德州 Frisco 2026 年 7 月開的兒童度假村 1 座），日本（大阪，2001）、新加坡（2011）、中國（北京，2021）各 1 座；度假區與在建的不算。最新的史詩宇宙 2025 年 5 月 22 日開幕，是奧蘭多的第三座主題樂園。奧蘭多的 Wet \'n Wild 是 1977 年別人開的水上樂園，環球 1998 年買下、2016 年底關閉。英國 Bedford 的樂園在建，宣布的目標是 2031 年，那是目標不是事實，所以不給開幕年、另外畫成空心的點。開幕日期依英文維基的固定版本；新加坡 2010 年 3 月試營運、2011 年 5 月正式開幕，這裡用 2011 年。放大看得到 OpenStreetMap 畫的園區邊界；面積把 OSM 的邊界與維基的數字並列、不排名，因為畫法差很多：好萊塢的 OSM 邊界只有 17.5 公頃，維基寫整個片廠約 168 公頃。園內的雲霄飛車是落在邊界裡、有名稱的 OSM 雲霄飛車，佛羅里達環球影城算出 0 座（維基寫 3 座），清單寫成「OSM 沒有標」。點的顏色是誰擁有：全資 6 座（好萊塢、奧蘭多 4 座、德州），日本由全資子公司 USJ 合同会社經營，北京是合資、NBCUniversal 只占 30%（首寰文化旅遊投資 70%），新加坡是雲頂擁有與經營、環球只授權不持股。地圖上另外畫了樂園之外的環球：4 處 CityWalk（好萊塢 1993、奧蘭多 1999、大阪 2001、北京），奧蘭多的 11 家直營飯店（1999 年的 Portofino Bay 到 2025 年的 Helios Grand，合計 11,000 間房，房間數依英文維基；其他度假區沒有直營飯店），2025 年在拉斯維加斯開的 Horror Unleashed（芝加哥的在建），1998–2004 年有持股、現在已經不是環球的 PortAventura 與取消的杜拜計畫，以及母公司 NBCUniversal（Comcast）的總部、片廠與電視大樓 8 處；左邊的清單另列 IP 主題園區（哈利波特 6 處、超級任天堂 3 處）。台灣沒有環球的樂園。',
        en: 'How many Universal-run parks each country had in each year (proportional circles, water parks included; drag the timeline to watch the expansion from Hollywood in 1964). In 2026 there are 9 open: 6 in the US (Hollywood; in Orlando, Universal Studios Florida 1990, Islands of Adventure 1999, the Volcano Bay water park 2017 and Epic Universe 2025; and Universal Kids Resort in Frisco, Texas, opened July 2026) and 1 each in Japan (Osaka, 2001), Singapore (2011) and China (Beijing, 2021); resorts and parks under construction are not counted. The newest, Epic Universe, opened on 22 May 2025 as Orlando’s third theme park. Wet ’n Wild in Orlando was a water park opened by others in 1977, bought by Universal in 1998 and closed at the end of 2016. A park in Bedford, England, is under construction with a target of 2031; that is a target rather than a fact, so it has no opening year and is drawn as a hollow dot. Opening dates follow a fixed revision of English Wikipedia; Singapore had a soft opening in March 2010 and a grand opening in May 2011, and 2011 is used here. Zoom in to see park outlines drawn on OpenStreetMap; areas from OSM and Wikipedia are shown side by side and not ranked, because outlines differ widely: Hollywood’s OSM outline is only 17.5 ha, while Wikipedia gives about 168 ha for the whole studio lot. Roller coasters are named OSM coasters inside each outline; Universal Studios Florida comes out at 0 (Wikipedia says 3), which the list shows as “none tagged on OSM”. Dot colours show ownership: 6 are wholly owned (Hollywood, the 4 in Orlando and Texas), Japan is run by a wholly owned subsidiary (USJ LLC), Beijing is a joint venture in which NBCUniversal holds only 30% (Beijing Shouhuan Cultural Tourism Investment holds 70%), and Singapore is owned and run by Genting under licence, with no Universal stake. The map also shows Universal beyond the parks: 4 CityWalks (Hollywood 1993, Orlando 1999, Osaka 2001 and Beijing), the 11 Universal-run hotels in Orlando (from Portofino Bay in 1999 to Helios Grand in 2025, 11,000 rooms in all according to English Wikipedia; the other resorts have no Universal-run hotels), Horror Unleashed in Las Vegas (opened 2025; Chicago under construction), and PortAventura, in which Universal held a stake in 1998–2004 and which is no longer Universal’s, the cancelled Dubai project, and 8 headquarters, studio and TV buildings of the parent NBCUniversal (Comcast); the list also shows the IP-themed lands (6 Wizarding Worlds of Harry Potter and 3 Super Nintendo Worlds). Taiwan has no Universal park.',
      },
      unit: { zh: '座', en: 'parks' },
      file: 'parks.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 6] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${v === 1 ? 'park' : 'parks'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      overlayTime: 'cumulative',
    },
    {
      id: 'visitors',
      label: { zh: '環球樂園的人次', en: 'Universal park attendance' },
      description: {
        zh: '各國環球樂園一年的人次合計（比例圓，2009–2025）。2009–2024 是英文維基「List of amusement park rankings」的單園表（數字原本來自 TEA／AECOM），維基表沒有的新加坡、史詩宇宙、水上樂園 Volcano Bay 與 2025 年用 Wikidata；只算那一年有值的樂園，所以新加坡 2024 年以前、Volcano Bay 2018–2022 年是空的。2025 年：日本 1,604 萬、北京 980 萬、佛羅里達 930 萬、冒險島 920 萬、好萊塢 800 萬、新加坡 419 萬、史詩宇宙 400 萬（5 月 22 日才開幕，不是整年）、Volcano Bay 160 萬。集團合計（同一篇維基的集團表，含水上樂園）2009 年 2,370 萬、2019 年 5,124 萬、2024 年 5,898 萬，表上沒有 2020、2021 年。',
        en: 'Total annual attendance at Universal parks in each country (proportional circles, 2009–2025). 2009–2024 comes from the single-park table in English Wikipedia’s “List of amusement park rankings” (figures originally from TEA/AECOM); Singapore, Epic Universe and the Volcano Bay water park, which are not in that table, and all of 2025 come from Wikidata. Only parks with a figure for the year are counted, so Singapore before 2024 and Volcano Bay in 2018–2022 are blank. In 2025: Japan 16.04 million, Beijing 9.80 million, Florida 9.3 million, Islands of Adventure 9.2 million, Hollywood 8.0 million, Singapore 4.19 million, Epic Universe 4.0 million (opened on 22 May, so part of the year) and Volcano Bay 1.6 million. The group as a whole (the group table in the same article, water parks included) had 23.7 million in 2009, 51.24 million in 2019 and 58.98 million in 2024; the table has no 2020 or 2021.',
      },
      unit: { zh: '人次', en: 'visits' },
      file: 'visitors.json',
      layer: { kind: 'bubble', legendValues: [5e6, 1.5e7, 3e7] },
      format: visitsText,
      formatTick: (v) => formatLargeNumber(v),
      integer: true,
      defaultYear: 2025,
    },
    {
      id: 'recovery',
      label: { zh: '環球樂園的疫情恢復率', en: 'Universal park recovery from the pandemic' },
      description: {
        zh: '2024 年的人次是 2019 年的幾 %（只算兩年都有人次的樂園）：日本 110.3%，美國 90.8%（好萊塢、佛羅里達、冒險島三座合計）；北京 2021 年才開、新加坡的數字 2024 年才有，沒有基期。集團合計 2024 年是 2019 年的 115.1%，比單園高，因為多了 2021 年開的北京，恢復率混著新開的樂園，不能說成觀光復甦。2020 年各園都關過一段時間（好萊塢只有 130 萬人次），不拿來當基期。',
        en: '2024 attendance as a percentage of 2019, for parks with both figures: Japan 110.3% and the US 90.8% (Hollywood, Florida and Islands of Adventure combined); Beijing opened in 2021 and Singapore’s figures start in 2024, so they have no baseline. The group as a whole reached 115.1%, higher than the single parks because it adds Beijing, opened in 2021; the rate mixes in new parks and should not be read as a tourism recovery. Every park closed for part of 2020 (Hollywood had only 1.3 million visits), so 2020 is not used as a baseline.',
      },
      unit: '%',
      file: 'recovery.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [70, 85, 95, 105, 115, 130] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'filming',
      label: { zh: '在這裡取景的環球影業的片', en: 'Universal Pictures titles filmed here' },
      description: {
        zh: '跟環球影業有關的片（Wikidata 上製作或發行是 Universal Pictures 的，共 3,522 部；只在某些地區發行的也算，所以是「跟環球有關」不是「環球拍的」）有幾部在這一國取景（比例圓；Wikidata 的拍攝地 P915，做法跟「迪士尼」的拍攝地一樣）。有拍攝地的 672 部、500 處地點、64 國：美國 428 部、英國 91、加拿大 71、法國 20、德國 16、西班牙 15、澳洲與義大利各 14、摩洛哥 10。最多的地點是洛杉磯 80 部、紐約 79、英國的松林製片廠 37、倫敦 33。台灣 1 部（2012 年的《十二生肖》，只寫到國家）。左邊的清單另有每十年的片數：有上映年的 3,476 部，1910 年代 548 部最多，1970 年代 152 部最少；Wikidata 偏英語片與近年，早年的數字會偏低。',
        en: 'How many titles linked to Universal Pictures (produced or distributed by it on Wikidata, 3,522 in all; titles it only distributed in some regions count too, so this is “linked to Universal”, not “made by Universal”) were filmed in each country (proportional circles; Wikidata filming location, P915, done the same way as for Disney). 672 titles have a filming location: 500 places in 64 countries, with 428 titles in the US, 91 in the UK, 71 in Canada, 20 in France, 16 in Germany, 15 in Spain, 14 each in Australia and Italy and 10 in Morocco. The top places are Los Angeles (80), New York (79), Pinewood Studios in England (37) and London (33). Taiwan has 1 (Chinese Zodiac, 2012, given at country level). The list also shows titles per decade: 3,476 have a release year, with the most in the 1910s (548) and the fewest in the 1970s (152); Wikidata favours English-language and recent films, so early decades are undercounted.',
      },
      unit: { zh: '部', en: 'titles' },
      file: 'filming-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 400] },
      format: (v) => worksCount(v),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2026,
    },
    {
      id: 'peacock',
      label: { zh: 'Peacock 與環球的串流內容', en: 'Peacock and Universal streaming content' },
      description: {
        zh: '只有美國是 Peacock 自己的訂閱服務（2020 年 7 月 15 日上線）；其他 58 個國家或地區看得到的是放在別家平台上的環球內容（英國、愛爾蘭、德語區與義大利的 Sky，北歐、荷蘭、東歐與伊比利的 SkyShowtime，拉丁美洲的 Universal+ 與 HBO Max，法國的 Universal+，印度的 JioHotstar，東南亞與台灣、香港的 HBO Max），不是能去訂 Peacock 的國家。台灣 2024 年 11 月 19 日起在 HBO Max 上看得到。資料是英文維基「Peacock (streaming service)」固定版本 1383883074 的上線表（59 個國家或地區）；表上的「撒哈拉以南非洲」（Showmax，2024 年 2 月）是區域，不上色。同一個條目的 infobox 跟表格寫的不一樣，這裡以表格為準。',
        en: 'Only the US has Peacock’s own subscription service (launched 15 July 2020); the other 58 countries and territories get Universal content on someone else’s platform (Sky in the UK, Ireland, German-speaking Europe and Italy; SkyShowtime in the Nordics, the Netherlands, Eastern Europe and Iberia; Universal+ and HBO Max in Latin America; Universal+ in France; JioHotstar in India; HBO Max in Southeast Asia, Taiwan and Hong Kong), so these are not countries where you can subscribe to Peacock. Taiwan has had it on HBO Max since 19 November 2024. Data: the launch table in English Wikipedia’s “Peacock (streaming service)”, revision 1383883074 (59 countries and territories); “Sub-Saharan Africa” (Showmax, February 2024) is a region and is not coloured. The article’s infobox disagrees with its table; the table is used here.',
      },
      unit: '',
      file: 'peacock.json',
      layer: { kind: 'categorical', categories: PEACOCK_KINDS },
      format: (v) => tr(PEACOCK_KINDS.find((c) => c.value === v)?.label ?? { zh: '', en: '' }),
      missing: { zh: '英文維基的上線表沒有這一國', en: 'Not in the English Wikipedia launch table' },
      unranked: true,
      defaultYear: 2026,
    },
    {
      id: 'tw-box-office',
      label: { zh: '環球台灣分公司發行的片的票房', en: 'Box office of films released by Universal’s Taiwan branch' },
      description: {
        zh: '只有台灣有開放授權的逐片票房（國家電影及視聽文化中心「全國電影票房統計數據」，2016 年 1 月 1 日到 2026 年 11 月 1 日上映、上映滿 7 天的片）。發行單位是「美商美國環球影片股份有限公司台灣分公司」（另有 2 部登記成「股份公司」，合併算）的片共 165 部、93.93 億元、3,714 萬張票，占同期全台票房 828.35 億元的 11.3%。這是發行商口徑：環球台灣分公司發行的片，不是「環球電影在台灣的票房」。最高的是 2017 年的《玩命關頭8》6.51 億元、2018 年的《侏羅紀世界:殞落國度》6.22 億元、2026 年的《奧德賽》4.57 億元。其他國家的逐片票房沒有可用的授權。',
        en: 'Only Taiwan has openly licensed film-by-film box office (Taiwan Film and Audiovisual Institute, national box office data: films released 1 January 2016 to 1 November 2026 and shown for at least 7 days). Films distributed by Universal’s Taiwan branch (two registered names, combined) number 165, taking NT$9.39 billion from 37.14 million tickets, 11.3% of Taiwan’s NT$82.84 billion box office over the period. This counts films released by the Taiwan branch, not Universal films in Taiwan as such. The top three are Fast & Furious 8 (2017, NT$651 million), Jurassic World: Fallen Kingdom (2018, NT$622 million) and The Odyssey (2026, NT$457 million). No other country’s film-by-film box office has a usable licence.',
      },
      unit: { zh: '元', en: 'NT$' },
      file: 'tw-box-office.json',
      layer: { kind: 'bubble', legendValues: [9.39e9] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 元`, en: `NT$${formatLargeNumber(v)}` }),
      formatTick: (v) => formatLargeNumber(v),
      missing: { zh: '只有台灣有開放授權的逐片票房', en: 'Only Taiwan has openly licensed film-by-film box office' },
      unranked: true,
      defaultYear: 2026,
    },
    {
      id: 'sg-amusement',
      label: { zh: '新加坡的運動、遊樂與休閒業營業收入', en: 'Singapore’s sports, amusement and recreation revenue' },
      description: {
        zh: '新加坡統計局的服務業統計（表 M601471）只分到 SSIC 93「運動、遊樂與休閒」這一行，沒有單獨的樂園業。2024 年營業收入 37.57 億新加坡元、3,708 家；2019 年 28.61 億，疫情時 2020 年掉到 16.30 億、2021 年 16.57 億，2023 年 34.16 億才超過疫情前。這一行除了遊樂園與主題樂園，還有運動場館、運動俱樂部與其他休閒活動；新加坡環球影城只是其中一家，它自己的營收沒有公開。博弈業（SSIC 92）另外算，不在這裡；自營作業者也不算。「樂園業」主題用的 Eurostat R9321 只有遊樂園與主題樂園，範圍小得多，兩者不能直接比。新加坡統計局註明 2009 年以前的資料跟之後的不一定能比，所以從 2009 年畫起；金額是當年的新加坡元，沒有扣物價。',
        en: 'Singapore’s services statistics (table M601471) only go down to SSIC 93, “sports, amusement and recreation activities”, with no separate amusement park industry. Operating revenue was S$3.76 billion in 2024 across 3,708 establishments; it was S$2.86 billion in 2019, fell to S$1.63 billion in 2020 and S$1.66 billion in 2021 during the pandemic, and only passed the pre-pandemic level in 2023 (S$3.42 billion). Besides amusement and theme parks the industry includes sports venues, sports clubs and other recreation; Universal Studios Singapore is just one business in it and does not publish its own revenue. Gambling (SSIC 92) is counted separately and is not included, nor are own-account workers. The Eurostat R9321 data in the Amusement park industry topic cover only amusement and theme parks, a much narrower scope, so the two are not directly comparable. The Singapore Department of Statistics notes that data before 2009 may not be comparable with later years, so the series starts in 2009; amounts are in current Singapore dollars, not adjusted for inflation.',
      },
      unit: { zh: '新加坡元', en: 'S$' },
      file: 'sg-amusement.json',
      layer: { kind: 'bubble', legendValues: [3.76e9] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 新加坡元`, en: `S$${formatLargeNumber(v)}` }),
      formatTick: (v) => formatLargeNumber(v),
      missing: { zh: '只有新加坡：其他國家的這一行沒有開放的統計，歐洲的樂園業在「樂園業」主題', en: 'Singapore only: other countries have no open statistics for this industry; European amusement parks are in the Amusement park industry topic' },
      unranked: true,
      defaultYear: 2024,
    },
  ],
};
