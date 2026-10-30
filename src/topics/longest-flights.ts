import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { AIRLINES_ZH, AIRPORTS_ZH } from './longest-flights-names';
import type { LinesOverlayDef, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 最長的直飛航線（pipeline/topics/longest_flights.py）：英文維基「Longest flights」的現行前 30 名與停飛的前 30 名，
 * 畫成大圓弧（線寬依距離），起訖機場畫成點；國家的值是在這國起降的航線數、最長的一條。
 */

export const CURRENT = 1;
export const DISCONTINUED = 2;

export const km = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });
const routesText = (v: number) => tr({ zh: `${fixed(v, 0)} 條`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'route' : 'routes'}` });

export const airlineName = (en: unknown) => (getLang() === 'zh' ? AIRLINES_ZH[String(en)] ?? String(en ?? '') : String(en ?? ''));
const airportName = (code: unknown, en: unknown) =>
  getLang() === 'zh' ? AIRPORTS_ZH[String(code)] ?? String(en ?? '') : String(en ?? '');

/** 「SQ 23 · 紐約甘迺迪 → 新加坡」 */
export function routeTitle(p: PointRecord): string {
  return `${airportName(p.a, p.an)} – ${airportName(p.b, p.bn)}`;
}

/** 表定時間「18:55」→「18 小時 55 分」 */
export function durationText(s: unknown): string {
  const m = /^(\d+):(\d+)$/.exec(String(s ?? ''));
  if (!m) return String(s ?? '');
  return tr({ zh: `${Number(m[1])} 小時 ${Number(m[2])} 分`, en: `${Number(m[1])} h ${m[2]} min` });
}

/** 名次、距離、時間、機型、日期 */
export function routeFacts(p: PointRecord): string[] {
  const rank =
    p.t === CURRENT
      ? tr({ zh: `現行第 ${p.rank} 名`, en: `No. ${p.rank} today` })
      : tr({ zh: `停飛的第 ${p.rank} 名`, en: `No. ${p.rank} among discontinued routes` });
  const date = typeof p.date === 'string' ? p.date : null;
  const when = date
    ? p.t === CURRENT
      ? tr({ zh: `${date} 首航`, en: `first flown ${date}` })
      : tr({ zh: `最後一班 ${date}`, en: `last flown ${date}` })
    : null;
  return [
    [rank, typeof p.km === 'number' ? km(p.km) : null, durationText(p.dur)].filter(Boolean).join(' · '),
    [tr({ zh: `機型 ${p.ac}`, en: `Aircraft: ${p.ac}` }), when].filter(Boolean).join(' · '),
  ];
}

const routeTooltip = (p: PointRecord) => ({
  title: routeTitle(p),
  detail: `${airlineName(p.airline)} ${p.no}`,
  extra: routeFacts(p),
  properNoun: getLang() === 'zh' && AIRLINES_ZH[String(p.airline)] ? String(p.airline) : undefined,
});

function routes(id: string, type: number, label: Text, indicators: string[]): LinesOverlayDef {
  const color = type === CURRENT ? MAP_TOKENS.hues.red : MAP_TOKENS.inkSecondary;
  return {
    kind: 'lines',
    id,
    file: 'routes.json',
    label,
    indicators,
    onlyTypes: [type],
    width: { field: 'km', stops: [[12000, 0.8], [13000, 1.2], [14000, 2], [15000, 3], [15800, 3.6]] },
    color: { classes: [{ value: type, color, label, dash: type === DISCONTINUED }] },
    keyClasses: false,
    hoverHalo: true,
    sizeLegend: { title: { zh: '大圓距離', en: 'Great-circle distance' }, values: [13000, 14000, 15000], format: km },
    tooltip: routeTooltip,
  };
}

function airports(id: string, field: 'n' | 'd', indicators: string[]): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: 'route-airports.json',
    label: { zh: '起訖機場', en: 'Airports' },
    indicators,
    radius: { field, stops: [[1, 2.4], [4, 3.6], [10, 5.5]] },
    color: MAP_TOKENS.ink,
    sortField: field,
    minValue: { field, stops: [[0, 1]] },
    tooltip: (p, ctx) => ({
      title: `${getLang() === 'zh' ? p.zh : p.en} (${p.iata})`,
      detail: typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : undefined,
      extra: [
        field === 'n'
          ? tr({ zh: `現行前 30 名的航線 ${p.n} 條`, en: `${routesText(Number(p.n))} in today’s top 30` })
          : tr({ zh: `停飛前 30 名的航線 ${p.d} 條`, en: `${routesText(Number(p.d))} in the discontinued top 30` }),
      ],
      properNoun: getLang() === 'zh' ? String(p.en ?? '') : undefined,
    }),
  };
}

const CURRENT_INDICATORS = ['routes-count', 'longest'];

/** 航空主題（aviation.ts）的最長航線部分：2026-10-30 起跟航空公司、交通的航空指標合成一個主題 */
export const longestFlightsPart = {
  sources: [
    {
      name: {
        zh: '英文維基百科「Longest flights」（2026-10-15 的版本：現行與停飛的直飛航線前 30 名）',
        en: 'English Wikipedia, “Longest flights” (revision of 15 October 2026: current and discontinued non-stop top 30)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380354690',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'OurAirports（機場的 IATA 代碼與座標）', en: 'OurAirports (IATA codes and airport locations)' },
      url: 'https://ourairports.com/data/',
      license: { zh: '公有領域', en: 'Public domain' },
    },
  ],
  note: {
    zh:
      '航線依英文維基百科「Longest flights」2026 年 10 月 15 日的版本：直飛（不停靠）的定期客運航線，依起訖機場的大圓距離排名；實際飛的距離較長（避開逆風、繞過關閉的空域），回程班號通常比較短，條目只列較長的一個方向。同一對機場、不同航空公司分開算（名次相同），同一個城市的不同機場也分開算。' +
      '停飛的是曾經排進前 30 名、現在不飛的航線，日期是最後一班。機場的位置用 OurAirports；國家依機場所在地。現行前 30 名沒有台灣起降的航線，停飛的有長榮航空 BR 32 桃園–紐瓦克（12,552 公里，2011 年停飛）。' +
      '資料檔依維基百科的 CC BY-SA 4.0 分享。',
    en:
      'Routes follow the English Wikipedia article “Longest flights” as of 15 October 2026: scheduled non-stop passenger flights ranked by the great-circle distance between the airports. The distance actually flown is longer (avoiding headwinds or closed airspace); the article lists the longer direction only. Different airlines on the same airport pair count separately (sharing a rank), as do different airports in the same city. ' +
      'Discontinued routes are those that once made the top 30 and no longer fly; the date is the last flight. Airport locations come from OurAirports; countries follow the airport’s location. None of today’s top 30 serve Taiwan; the discontinued list includes EVA Air BR 32 Taoyuan–Newark (12,552 km, ended 2011). ' +
      'The derived data files are shared under Wikipedia’s CC BY-SA 4.0.',
  },
  overlays: [
    routes('routes', CURRENT, { zh: '現行前 30 名的航線', en: 'Current top 30 routes' }, CURRENT_INDICATORS),
    routes('discontinued-routes', DISCONTINUED, { zh: '停飛的前 30 名', en: 'Discontinued top 30' }, ['discontinued']),
    // 交通搬過來的機場圖層也叫 airports：這裡改名 route-airports（資料檔 route-airports.json）
    airports('route-airports', 'n', CURRENT_INDICATORS),
    airports('route-airports-discontinued', 'd', ['discontinued']),
  ],
  indicators: [
    {
      id: 'routes-count',
      label: { zh: '最長航線前 30 名的條數', en: 'Routes in the top 30' },
      description: {
        zh: '世界最長的 30 條直飛定期航線（同名次的兩家航空公司分開算，共 32 條）有幾條在這個國家起降。最長的是新加坡航空 SQ 23 紐約甘迺迪–新加坡 15,349 公里、表定 18 小時 55 分；美國的機場出現 25 次，其次是澳洲、新加坡。滑過航線看航空公司、時間與首航日。',
        en: 'How many of the world’s 30 longest scheduled non-stop routes (32 rows, as two ranks are shared by two airlines) start or end in the country. The longest is Singapore Airlines SQ 23 New York JFK–Singapore, 15,349 km and 18 h 55 min; US airports appear 25 times, followed by Australia and Singapore. Hover over a route for the airline, duration and first flight.',
      },
      unit: { zh: '條', en: 'routes' },
      file: 'routes-count.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      format: routesText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      timeless: true,
    },
    {
      id: 'longest',
      label: { zh: '在這國起降最長的一條', en: 'Longest route serving the country' },
      description: {
        zh: '這個國家起降的航線裡，排進現行前 30 名最長的一條有多遠（大圓距離）；沒有航線排進前 30 名的國家是灰色。第 30 名是 12,952 公里。',
        en: 'The great-circle distance of the longest top-30 route serving the country; countries with no route in today’s top 30 are grey. No. 30 is 12,952 km.',
      },
      unit: 'km',
      file: 'longest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [13300, 13700, 14100, 14500, 15000] } },
      format: km,
      formatTick: (v) => `${fixed(v / 1000, 1)}k`,
      panelChart: false,
      timeless: true,
      missing: { zh: '沒有排進前 30 名的航線', en: 'No route in the top 30' },
    },
    {
      id: 'discontinued',
      label: { zh: '停飛的前 30 名', en: 'Discontinued top 30' },
      description: {
        zh: '曾經是最長的直飛航線、現在已經不飛的前 30 名，有幾條在這個國家起降（虛線）。最長的是大溪地航空 TN 64 帕皮提–巴黎戴高樂 15,715 公里，2020 年 4 月停飛；台灣有長榮航空 BR 32 桃園–紐瓦克（12,552 公里）。',
        en: 'How many of the 30 longest non-stop routes that no longer fly started or ended in the country (dashed). The longest was Air Tahiti Nui TN 64 Papeete–Paris CDG, 15,715 km, which ended in April 2020; Taiwan had EVA Air BR 32 Taoyuan–Newark (12,552 km).',
      },
      unit: { zh: '條', en: 'routes' },
      file: 'discontinued.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 15] },
      format: routesText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      timeless: true,
    },
  ],
} satisfies Partial<TopicDefinition>;
