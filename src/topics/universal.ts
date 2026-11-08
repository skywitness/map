import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

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

const KIND_COLORS = {
  field: 'kind',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5],
  classes: [KINDS[0], KINDS[1]].map(({ label, color }) => ({ label, color })),
};

const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'universal-sites',
  file: 'sites.json',
  label: { zh: '環球的樂園（依開幕年出現，已關閉的在關閉之後消失）', en: 'Universal parks (appear in their opening year; closed ones disappear)' },
  indicators: ['parks'],
  radius: { field: 'kind', stops: [[1, 6], [2, 4]] },
  color: KIND_COLORS,
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
        zh: '英文維基百科「Universal Destinations & Experiences」（revid 1382726905，開幕與關閉的日期）',
        en: 'English Wikipedia, “Universal Destinations & Experiences” (revid 1382726905: opening and closing dates)',
      },
      url: 'https://en.wikipedia.org/wiki/Universal_Destinations_%26_Experiences?oldid=1382726905',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '這個主題整理的是 Wikidata、OpenStreetMap 與維基百科上的公開資料，不是環球影城或它的母公司提供的。度假區（例如奧蘭多）與裡面的樂園是兩層，「幾座樂園」只算營運中的主題樂園與水上樂園。台灣沒有環球的樂園。',
    en: 'This topic compiles public data from Wikidata, OpenStreetMap and Wikipedia; it is not provided by Universal or its parent company. Resorts (such as Orlando) and the parks inside them are two levels, and park counts include open theme and water parks only. Taiwan has no Universal park.',
  },
  overlays: [OUTLINES, RESORT_RINGS, SITES, PLANNED],
  listPanel: [PARK_LIST],
  indicators: [
    {
      id: 'parks',
      label: { zh: '環球的樂園', en: 'Universal parks' },
      description: {
        zh: '各國那一年有幾座環球經營的樂園（比例圓，含水上樂園；拖時間軸看 1964 年好萊塢開始怎麼擴張）。2026 年營運中的是 9 座：美國 6 座（好萊塢 1 座，奧蘭多的佛羅里達環球影城 1990、冒險島樂園 1999、水上樂園 Volcano Bay 2017、史詩宇宙 2025 共 4 座，德州 Frisco 2026 年 7 月開的兒童度假村 1 座），日本（大阪，2001）、新加坡（2011）、中國（北京，2021）各 1 座；度假區與在建的不算。最新的史詩宇宙 2025 年 5 月 22 日開幕，是奧蘭多的第三座主題樂園。奧蘭多的 Wet \'n Wild 是 1977 年別人開的水上樂園，環球 1998 年買下、2016 年底關閉。英國 Bedford 的樂園在建，宣布的目標是 2031 年，那是目標不是事實，所以不給開幕年、另外畫成空心的點。開幕日期依英文維基的固定版本；新加坡 2010 年 3 月試營運、2011 年 5 月正式開幕，這裡用 2011 年。放大看得到 OpenStreetMap 畫的園區邊界；面積把 OSM 的邊界與維基的數字並列、不排名，因為畫法差很多：好萊塢的 OSM 邊界只有 17.5 公頃，維基寫整個片廠約 168 公頃。園內的雲霄飛車是落在邊界裡、有名稱的 OSM 雲霄飛車，佛羅里達環球影城算出 0 座（維基寫 3 座），清單寫成「OSM 沒有標」。台灣沒有環球的樂園。',
        en: 'How many Universal-run parks each country had in each year (proportional circles, water parks included; drag the timeline to watch the expansion from Hollywood in 1964). In 2026 there are 9 open: 6 in the US (Hollywood; in Orlando, Universal Studios Florida 1990, Islands of Adventure 1999, the Volcano Bay water park 2017 and Epic Universe 2025; and Universal Kids Resort in Frisco, Texas, opened July 2026) and 1 each in Japan (Osaka, 2001), Singapore (2011) and China (Beijing, 2021); resorts and parks under construction are not counted. The newest, Epic Universe, opened on 22 May 2025 as Orlando’s third theme park. Wet ’n Wild in Orlando was a water park opened by others in 1977, bought by Universal in 1998 and closed at the end of 2016. A park in Bedford, England, is under construction with a target of 2031; that is a target rather than a fact, so it has no opening year and is drawn as a hollow dot. Opening dates follow a fixed revision of English Wikipedia; Singapore had a soft opening in March 2010 and a grand opening in May 2011, and 2011 is used here. Zoom in to see park outlines drawn on OpenStreetMap; areas from OSM and Wikipedia are shown side by side and not ranked, because outlines differ widely: Hollywood’s OSM outline is only 17.5 ha, while Wikipedia gives about 168 ha for the whole studio lot. Roller coasters are named OSM coasters inside each outline; Universal Studios Florida comes out at 0 (Wikipedia says 3), which the list shows as “none tagged on OSM”. Taiwan has no Universal park.',
      },
      unit: { zh: '座', en: 'parks' },
      file: 'parks.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 6] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${v === 1 ? 'park' : 'parks'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      overlayTime: 'cumulative',
    },
  ],
};
