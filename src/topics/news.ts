import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { unzipFirst } from '../lib/unzip';
import { MAP_TOKENS } from '../theme/tokens';
import type { ClockAt, ColorClasses, IndicatorData, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 此刻世界的新聞熱點（DESIGN.md 第 8 節第 148 點）：GDELT 2.0 的事件（機器從全世界的新聞抽出的「誰對誰做了什麼、在哪裡」），
 * 瀏覽器每 15 分鐘直接讀最新的檔（TopicDefinition.live 的 load：先讀 lastupdate.txt，再讀 export.CSV.zip、解壓、解析）。
 * 使用者 2026-10-29 決定：瀏覽器每 15 分鐘讀；事件類型的中文分類自己定；滑過事件顯示原始新聞的連結。
 * GDELT 的國家代碼是 FIPS 10-4，用 pipeline/topics/news.py 輸出的對照表（GeoNames）換成 ISO alpha-3。
 * 2026-10-31（第十二批 194）：左邊「此刻的新聞事件」清單，跟即時資料一起更新。
 */

const LAST_UPDATE = 'https://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const REFRESH_MINUTES = 15;

/** 事件的種類：CAMEO 的 20 個根代碼（EventRootCode）併成 6 類 */
export const KINDS: { value: number; label: Text; roots: number[] }[] = [
  { value: 1, label: { zh: '發言與會談', en: 'Statements and talks' }, roots: [1, 2, 4] },
  { value: 2, label: { zh: '合作與援助', en: 'Cooperation and aid' }, roots: [3, 5, 6, 7, 8] },
  { value: 3, label: { zh: '調查、要求與批評', en: 'Probes, demands and criticism' }, roots: [9, 10, 11, 12] },
  { value: 4, label: { zh: '威脅與施壓', en: 'Threats and coercion' }, roots: [13, 15, 16, 17] },
  { value: 5, label: { zh: '抗議', en: 'Protests' }, roots: [14] },
  { value: 6, label: { zh: '攻擊與戰鬥', en: 'Assaults and fighting' }, roots: [18, 19, 20] },
];
const KIND_OF_ROOT = new Map(KINDS.flatMap((k) => k.roots.map((r) => [r, k.value] as const)));
export const kindLabel = (k: number) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

/** 種類的顏色：發言與會談最多、最平常，用中性的灰；其他依序是青綠、琥珀、洋紅、紫、深橘（配色驗證工具檢查過） */
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '最多的事件種類', en: 'Most common event type' },
  thresholds: [1.5, 2.5, 3.5, 4.5, 5.5],
  classes: [
    { color: MAP_TOKENS.context, label: KINDS[0].label },
    { color: MAP_TOKENS.categorical[0], label: KINDS[1].label },
    { color: MAP_TOKENS.categorical[2], label: KINDS[2].label },
    { color: MAP_TOKENS.categorical[7], label: KINDS[3].label },
    { color: MAP_TOKENS.categorical[1], label: KINDS[4].label },
    { color: MAP_TOKENS.categorical[5], label: KINDS[5].label },
  ],
};

/* ── 讀 GDELT ──────────────────────────── */

/** 一個事件（GDELT export 的一列，只留用得到的欄位） */
export interface NewsEvent {
  /** 事件發生地的國家（ActionGeo_CountryCode，FIPS 10-4） */
  fips: string;
  lat: number | null;
  lon: number | null;
  /** 地名（ActionGeo_FullName，英文） */
  place: string;
  /** 地點只到國家（ActionGeo_Type 1）：點在國家的中心 */
  countryOnly: boolean;
  kind: number;
  /** 主動與被動的一方（Actor1Name、Actor2Name，英文，可能是空的） */
  actors: [string, string];
  url: string;
}

export interface NewsFile {
  /** 這 15 分鐘的檔的時刻（UTC 毫秒，檔名的 YYYYMMDDHHMMSS） */
  time: number;
  /** 檔的網址 */
  file: string;
  events: NewsEvent[];
}

const isNews = (v: unknown): v is NewsFile => typeof v === 'object' && v !== null && Array.isArray((v as NewsFile).events);

/** GDELT export 的欄位位置（61 欄） */
const COL = { actor1: 6, actor2: 16, root: 28, geoType: 51, place: 52, country: 53, lat: 56, lon: 57, url: 60 } as const;

function parseExport(text: string): NewsEvent[] {
  const out: NewsEvent[] = [];
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 61) continue;
    const lat = f[COL.lat] === '' ? null : Number(f[COL.lat]);
    const lon = f[COL.lon] === '' ? null : Number(f[COL.lon]);
    out.push({
      fips: f[COL.country],
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lon: lon !== null && Number.isFinite(lon) ? lon : null,
      place: f[COL.place],
      countryOnly: f[COL.geoType] === '1',
      kind: KIND_OF_ROOT.get(Number(f[COL.root])) ?? 1,
      actors: [f[COL.actor1], f[COL.actor2]],
      url: f[COL.url],
    });
  }
  return out;
}

/** 讀最新的檔：lastupdate.txt 第一行是 export 的 zip（網址是 http，換成 https） */
async function loadLatest(url: string): Promise<NewsFile> {
  const index = await fetch(url, { cache: 'no-cache' });
  if (!index.ok) throw new Error(`${url} (HTTP ${index.status})`);
  const line = (await index.text()).split('\n').find((l) => l.includes('.export.CSV.zip'));
  const file = line?.trim().split(/\s+/)[2]?.replace(/^http:/, 'https:');
  const stamp = file && /(\d{14})\.export\.CSV\.zip$/.exec(file)?.[1];
  if (!file || !stamp) throw new Error(`${url}: no export file`);
  const zip = await fetch(file);
  if (!zip.ok) throw new Error(`${file} (HTTP ${zip.status})`);
  const { text } = await unzipFirst(await zip.arrayBuffer());
  const n = (a: number, b: number) => Number(stamp.slice(a, b));
  return { time: Date.UTC(n(0, 4), n(4, 6) - 1, n(6, 8), n(8, 10), n(10, 12), n(12, 14)), file, events: parseExport(text) };
}

/* ── FIPS → ISO（pipeline 的 fips.json） ──────── */

interface FipsFile {
  fips: Record<string, string>;
}

let fipsTable: Record<string, string> | null = null;
/** 最近一次讀到的事件：側欄、點的 tooltip 用 */
let latest: NewsFile | null = null;
export const latestNews = () => latest;
export const isoOf = (fips: string) => fipsTable?.[fips] ?? null;

/** 依國家算事件數（地點只到國家的也算） */
function counts(source: unknown, at: ClockAt, live: unknown): IndicatorData {
  const file = source as FipsFile;
  if (file?.fips) fipsTable = file.fips;
  if (isNews(live)) latest = live;
  const values: Record<string, (number | null)[]> = {};
  if (isNews(live) && file?.fips) {
    for (const e of live.events) {
      const iso3 = file.fips[e.fips];
      if (iso3) values[iso3] = [(values[iso3]?.[0] ?? 0) + 1];
    }
  }
  return { indicator: '', unit: '', years: [at.day], values };
}

/* ── 點：同一個地點的事件併成一個點 ──────── */

/** 地點的鍵：座標到小數 4 位加地名 */
const placeKey = (e: NewsEvent) => `${e.lat?.toFixed(4)},${e.lon?.toFixed(4)},${e.place}`;

/** 一個地點的事件（側欄也用） */
export interface NewsPlace {
  key: string;
  lat: number;
  lon: number;
  place: string;
  countryOnly: boolean;
  fips: string;
  events: NewsEvent[];
  /** 種類 → 事件數 */
  kinds: Map<number, number>;
  /** 最多的種類（一樣多時取比較嚴重的，代碼大的） */
  main: number;
  /** 不重複的新聞網址，依出現次數排 */
  urls: string[];
}

const placeCache = new WeakMap<NewsFile, NewsPlace[]>();

export function placesOf(file: NewsFile): NewsPlace[] {
  const cached = placeCache.get(file);
  if (cached) return cached;
  const byKey = new Map<string, NewsPlace>();
  for (const e of file.events) {
    if (e.lat === null || e.lon === null) continue;
    const key = placeKey(e);
    let p = byKey.get(key);
    if (!p) {
      p = { key, lat: e.lat, lon: e.lon, place: e.place, countryOnly: e.countryOnly, fips: e.fips, events: [], kinds: new Map(), main: 1, urls: [] };
      byKey.set(key, p);
    }
    p.events.push(e);
    p.kinds.set(e.kind, (p.kinds.get(e.kind) ?? 0) + 1);
  }
  const places = [...byKey.values()];
  for (const p of places) {
    p.main = [...p.kinds.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    const urls = new Map<string, number>();
    for (const e of p.events) if (e.url) urls.set(e.url, (urls.get(e.url) ?? 0) + 1);
    p.urls = [...urls.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
  }
  places.sort((a, b) => b.events.length - a.events.length);
  placeCache.set(file, places);
  return places;
}

function livePoints(live: unknown): PointRecord[] | null {
  if (!isNews(live)) return null;
  latest = live;
  return placesOf(live).map((p) => ({
    lon: p.lon,
    lat: p.lat,
    n: p.events.length,
    k: p.main,
    key: p.key,
    iso3: isoOf(p.fips),
  }));
}

/** 新聞網址的網域：「www.reuters.com/world/…」→「reuters.com」 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 網址縮短成「網域/路徑」，太長的截斷（tooltip 用） */
export function shortUrl(url: string, max = 64): string {
  let s = url.replace(/^https?:\/\/(www\.)?/, '');
  if (s.length > max) s = `${s.slice(0, max - 1)}…`;
  return s;
}

/**
 * 側欄連結的文字：「網域 · 網址裡的標題字」（大多數新聞網址的最後一段是標題，例如 /corpus-christi-police-arrest-man），
 * 最後一段太短或只有數字的只寫網域
 */
export function linkText(url: string): string {
  const domain = domainOf(url);
  let slug = '';
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    slug = decodeURIComponent(parts[parts.length - 1] ?? '')
      .replace(/\.[a-z]{2,5}$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\b\d{4,}\b/g, '')
      .trim();
  } catch {
    slug = '';
  }
  if (slug.length < 12 || !/[a-z]{3}/i.test(slug)) return domain;
  return `${domain} · ${slug.length > 70 ? `${slug.slice(0, 69)}…` : slug}`;
}

/** 「會談與聲明 5、合作與援助 2」，依事件數排 */
export function kindsText(kinds: Map<number, number>): string {
  return [...kinds.entries()]
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([k, n]) => `${kindLabel(k)} ${n}`)
    .join(tr({ zh: '、', en: ', ' }));
}

export const eventsText = (n: number) => tr({ zh: `${fixed(n, 0)} 個事件`, en: `${fixed(n, 0)} ${n === 1 ? 'event' : 'events'}` });

const EVENTS: PointsOverlayDef = {
  kind: 'points',
  id: 'events',
  file: '',
  fromLive: livePoints,
  label: { zh: '新聞事件', en: 'News events' },
  radius: { field: 'n', stops: [[1, 3], [5, 5], [20, 8], [100, 13]] },
  color: KIND_COLORS,
  sortField: 'n',
  indicators: ['map'],
  tooltip: (p, ctx) => {
    const place = latest ? placesOf(latest).find((x) => x.key === p.key) : undefined;
    if (!place) return { title: eventsText(Number(p.n)) };
    const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
    // 原始新聞的連結（tooltip 點不到，側欄有可以點的連結）：最多 3 則
    const links = place.urls.slice(0, 3);
    const more = place.urls.length - links.length;
    return {
      title: `${eventsText(place.events.length)}${tr({ zh: '：', en: ': ' })}${kindsText(place.kinds)}`,
      detail: [country, place.countryOnly ? tr({ zh: '只寫到國家，點在國家中心', en: 'country only, placed at its centre' }) : null]
        .filter(Boolean)
        .join(' · '),
      extra: [
        ...links.map((u) => shortUrl(u)),
        ...(more > 0 ? [tr({ zh: `還有 ${more} 則新聞，點國家看側欄`, en: `${more} more articles: click the country for the side panel` })] : []),
      ],
      properNoun: place.place,
    };
  },
};

/**
 * 此刻的新聞事件（第十二批 194）：最近 15 分鐘、目前讀到的那一批，依地點（同一個地點的事件併成一列，跟地圖上的點一樣），
 * 事件多的在前；每列：地名（GDELT 的英文原文）、事件的種類、國家與這一批的時刻、第一則原始新聞的連結。
 * 一批的事件都是同一個 15 分鐘加進來的，沒有更細的先後，所以不依時間排。跟選取的國家連動；點了移過去並標出那一點
 */
const LIST: ListPanelDef = {
  label: { zh: '此刻的新聞事件', en: 'Latest news events' },
  indicators: ['map', 'events'],
  file: '',
  fromLive: (live) => {
    if (!isNews(live)) return null;
    latest = live;
    return placesOf(live).map((p) => ({ lon: p.lon, lat: p.lat, key: p.key, iso3: isoOf(p.fips), t: live.time }));
  },
  countryField: 'iso3',
  empty: { zh: '這 15 分鐘的新聞裡沒有事件', en: 'No events in these 15 minutes of news' },
  rows: (points, { countryName }) => {
    const all = latest ? placesOf(latest) : [];
    const byKey = new Map(all.map((p) => [p.key, p]));
    return points.flatMap((r): ListRow[] => {
      const place = byKey.get(String(r.key));
      if (!place) return [];
      const time = new Date(Number(r.t));
      const hhmm = `${String(time.getUTCHours()).padStart(2, '0')}:${String(time.getUTCMinutes()).padStart(2, '0')} UTC`;
      const url = place.urls[0];
      return [
        {
          key: place.key,
          title: place.place,
          titleProper: true,
          lines: [
            `${eventsText(place.events.length)}${tr({ zh: '：', en: ': ' })}${kindsText(place.kinds)}`,
            [typeof r.iso3 === 'string' ? countryName(r.iso3) : null, place.countryOnly ? tr({ zh: '只寫到國家', en: 'country only' }) : null, hhmm]
              .filter(Boolean)
              .join(' · '),
          ],
          link: url ? { href: url, label: linkText(url) } : undefined,
          target: { lon: place.lon, lat: place.lat, zoom: place.countryOnly ? 4 : 8 },
        },
      ];
    });
  },
};

/* ── 指標 ──────────────────────────── */

const ABOUT = {
  zh: 'GDELT 是機器從全世界的線上新聞（多種語言）抽出的事件，每 15 分鐘一批，這一頁每 15 分鐘重讀；同一則新聞常抽出好幾個事件，也會誤判，英語媒體（美、英）的新聞最多。',
  en: 'GDELT events are extracted by machine from online news worldwide (in many languages), in batches every 15 minutes, and this page re-reads them every 15 minutes; one article often yields several events, mistakes happen, and English-language media (US, UK) dominate.',
};

const EVENTS_UNIT: Text = { zh: '個', en: 'events' };
const NONE: Text = { zh: '這 15 分鐘的新聞裡沒有這裡的事件', en: 'No events here in these 15 minutes of news' };

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '新聞熱點地圖', en: 'News hotspots' },
    description: {
      zh: `最近 15 分鐘的新聞裡，事件發生在哪裡：同一個地點的事件併成一個點，越大事件越多，顏色是最多的那一種（發言與會談、合作與援助、調查要求與批評、威脅與施壓、抗議、攻擊與戰鬥）。只寫到國家的新聞點在國家中心。滑到點上看事件的種類與原始新聞的網址，點國家看側欄的新聞連結；左邊的清單依地點列出這一批的事件與新聞連結。${ABOUT.zh}`,
      en: `Where events in the last 15 minutes of news took place: events at the same place are merged into one dot, bigger for more events and coloured by the most common type (statements and talks; cooperation and aid; probes, demands and criticism; threats and coercion; protests; assaults and fighting). News naming only a country is placed at its centre. Hover over a dot for the types of event and the original article addresses; click a country for links in the side panel. The list on the left shows this batch’s events by place, with article links. ${ABOUT.en}`,
    },
    unit: EVENTS_UNIT,
    file: 'fips.json',
    layer: { kind: 'none' },
    format: eventsText,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    unranked: true,
    rankingBars: false,
    missing: NONE,
    derive: { per: 'minute', values: counts },
  },
  {
    id: 'events',
    label: { zh: '事件數', en: 'Events' },
    description: {
      zh: `最近 15 分鐘的新聞裡發生在這個國家的事件數（含只寫到國家的）。美國通常最多，台灣常常只有幾個。${ABOUT.zh}`,
      en: `The number of events in the last 15 minutes of news that took place in each country (including news naming only the country). The United States usually has the most; Taiwan often has only a few. ${ABOUT.en}`,
    },
    unit: EVENTS_UNIT,
    file: 'fips.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50, 100] } },
    format: eventsText,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    missing: NONE,
    derive: { per: 'minute', values: counts },
  },
];

export const news: TopicDefinition = {
  id: 'news',
  title: { zh: '此刻世界的新聞熱點', en: 'World news right now' },
  shortTitle: { zh: '新聞熱點', en: 'News hotspots' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  live: { url: LAST_UPDATE, minutes: REFRESH_MINUTES, time: (d) => (isNews(d) ? d.time : null), load: loadLatest },
  sources: [
    {
      name: { zh: 'GDELT 2.0 事件資料庫（每 15 分鐘）', en: 'GDELT 2.0 Event Database (every 15 minutes)' },
      url: 'https://www.gdeltproject.org/',
      license: { zh: '可自由使用、轉載，需註明 GDELT Project 並連結', en: 'free to use and redistribute with a citation and link to the GDELT Project' },
    },
    {
      name: { zh: 'FIPS 10-4 與 ISO 國家代碼對照：GeoNames', en: 'FIPS 10-4 to ISO country codes: GeoNames' },
      url: 'https://www.geonames.org/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '事件由你的瀏覽器直接向 GDELT 讀取（data.gdeltproject.org 的 lastupdate.txt 指向最新一批的 export.CSV.zip，在瀏覽器裡解壓），每 15 分鐘重讀；讀不到時這個主題沒有資料。GDELT 不經過這個網站的伺服器，只有最新的一批，不能選別的時刻。事件的種類依 CAMEO 的 20 個根代碼併成 6 類（發言與會談：公開聲明、呼籲、會談；合作與援助：表達合作意願、外交合作、實質合作、援助、讓步；調查、要求與批評：調查、要求、不認同、拒絕；威脅與施壓：威脅、展示武力、降低關係、強制〔含逮捕、制裁〕；抗議；攻擊與戰鬥：攻擊、戰鬥、大規模暴力）。國家是事件發生地（ActionGeo），GDELT 的 FIPS 10-4 代碼用 GeoNames 的對照表換成 ISO。新聞的網址是各媒體的，這裡只列出連結。',
    en: 'Events are read by your browser directly from GDELT (lastupdate.txt on data.gdeltproject.org points to the latest export.CSV.zip, which is unzipped in the browser), re-read every 15 minutes; if GDELT cannot be reached, this topic has no data. GDELT data does not pass through this site’s server, and only the latest batch is available, with no other times to choose. Event types merge CAMEO’s 20 root codes into 6 (statements and talks: public statements, appeals, consultations; cooperation and aid: intent to cooperate, diplomatic and material cooperation, aid, yielding; probes, demands and criticism: investigations, demands, disapproval, rejection; threats and coercion: threats, shows of force, reduced relations, coercion including arrests and sanctions; protests; assaults and fighting: assaults, fighting, mass violence). The country is where the event took place (ActionGeo); GDELT’s FIPS 10-4 codes are converted to ISO with GeoNames. Article addresses belong to their publishers and are only linked here.',
  },
  panelExtra: () => import('./panels/NewsPanel'),
  listPanel: LIST,
  overlays: [EVENTS],
  indicators,
};
