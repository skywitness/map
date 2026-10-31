import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, SourceDef } from './types';

/**
 * 航運與港口的擴充：渡輪航線（2026-10-31，製作手冊第十批 177；pipeline/topics/ferry_routes.py，DESIGN.md 第 8 節第 259 點）。
 * OpenStreetMap 的 route=ferry 只留定期客運（排除觀光船、河上的擺渡），台灣附上航港局國內固定航班的班次。
 */

/** 航線的種類（pipeline 的 TYPES） */
const TYPES: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '跨國航線', en: 'International' }, color: MAP_TOKENS.categorical[7] },
  { value: 2, label: { zh: '國內航線（海上）', en: 'Domestic (sea)' }, color: MAP_TOKENS.categorical[1] },
  { value: 3, label: { zh: '湖上航線', en: 'Lake' }, color: MAP_TOKENS.categorical[0] },
];
const typeLabel = (t: unknown) => tr(TYPES.find((x) => x.value === t)?.label ?? '');

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** 航線的名稱：中文介面優先用中文名，英文介面用英文名，其次 OSM 的名稱（原文） */
function ferryName(p: PointRecord): string {
  const name = getLang() === 'zh' ? (str(p.z) ?? str(p.n) ?? str(p.e)) : (str(p.e) ?? str(p.n) ?? str(p.z));
  return name ?? tr({ zh: '（沒有名稱的航線）', en: '(unnamed route)' });
}

/** 原文名稱：跟顯示的名稱不同（也不是互相包含，例如「基隆 - 石垣」與「基隆 - 石垣 石垣 - 基隆」）時另起一行 */
function properName(p: PointRecord, title: string): string | undefined {
  const n = str(p.n);
  return n && !n.includes(title) && !title.includes(n) ? n : undefined;
}

const kmText = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 公里`, en: `${fixed(v, v < 10 ? 1 : 0)} km` });

/** OSM 的航行時間（duration=1:30、01:30:00）→「1 小時 30 分」；其他寫法照原文 */
function durationText(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{1,3}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  if (!h && !min) return null;
  return tr({
    zh: [h ? `${h} 小時` : '', min ? `${min} 分` : ''].filter(Boolean).join(' '),
    en: [h ? `${h} h` : '', min ? `${min} min` : ''].filter(Boolean).join(' '),
  });
}

const sailings = (n: number) =>
  tr({ zh: `航港局 2026 年 7–8 月 ${fixed(n, 0)} 班`, en: `${fixed(n, 0)} sailings in Jul–Aug 2026 (Maritime and Port Bureau)` });

function facts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const countries = str(p.c)
    ?.split(',')
    .map((c) => countryName(c))
    .join(tr({ zh: '、', en: ', ' }));
  const duration = durationText(p.du);
  return [
    [typeLabel(p.t), typeof p.km === 'number' ? kmText(p.km) : null, duration ? tr({ zh: `約 ${duration}`, en: `about ${duration}` }) : null]
      .filter(Boolean)
      .join(' · '),
    [countries, str(p.op)].filter(Boolean).join(' · '),
    [p.car === 1 ? tr({ zh: '可載汽車', en: 'carries cars' }) : null, p.sn === 1 ? tr({ zh: '季節性', en: 'seasonal' }) : null]
      .filter(Boolean)
      .join(' · '),
    typeof p.m === 'number' ? sailings(p.m) : '',
  ].filter(Boolean);
}

const INDICATORS = ['ferries'];

const FERRIES: LinesOverlayDef = {
  kind: 'lines',
  id: 'ferries',
  file: 'ferries.json',
  label: { zh: '渡輪航線（OpenStreetMap）', en: 'Ferry routes (OpenStreetMap)' },
  indicators: INDICATORS,
  width: 1.3,
  color: { title: { zh: '航線', en: 'Route' }, classes: TYPES.map(({ value, label, color }) => ({ value, label, color })) },
  groupField: 'r',
  hoverHalo: true,
  // 世界全圖只畫 20 公里以上的，放大到 4 級加上 3 公里以上，6 級以上全部
  minValue: { field: 'km', stops: [[0, 20], [4, 3], [6, 0]] },
  tooltip: (p, { countryName }) => {
    const title = ferryName(p);
    return {
      title,
      extra: facts(p, countryName),
      properNoun: properName(p, title),
    };
  },
};

/** 左邊的清單：台灣的航線、有維基百科條目的航線，各依長度；點了框住整條航線 */
const LIST: ListPanelDef = {
  label: { zh: '渡輪航線', en: 'Ferry routes' },
  indicators: INDICATORS,
  file: 'ferries-list.json',
  // 選了國家時只列兩端有那一國的（L23）
  countryField: 'c',
  rows: (points, { countryName }) => {
    const rows: ListRow[] = [];
    for (const [g, badge] of [
      [1, { zh: '台灣', en: 'Taiwan' }],
      [2, { zh: '有維基百科條目', en: 'With a Wikipedia article' }],
    ] as [number, Text][]) {
      const list = points.filter((p) => p.g === g).sort((a, b) => Number(b.km) - Number(a.km));
      list.forEach((p, i) => {
        const title = ferryName(p);
        rows.push({
          key: `${g}-${p.r}`,
          title,
          titleProper: getLang() === 'en' && title !== p.e,
          lines: facts(p, countryName),
          properNoun: properName(p, title),
          badge: i === 0 ? `${tr(badge)} ${list.length}` : undefined,
          target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
          line: { overlay: 'ferries', group: Number(p.r) },
        });
      });
    }
    return rows;
  },
};

const routeCount = (v: number) => tr({ zh: `${fixed(v, 0)} 條`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'route' : 'routes'}` });

export const ferriesExtra: { sources: SourceDef[]; overlays: LinesOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: {
        zh: 'OpenStreetMap 的渡輪航線（route=ferry，2026-10-31），經 Overpass API',
        en: 'OpenStreetMap ferry routes (route=ferry, 2026-10-31), via the Overpass API',
      },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap 貢獻者；渡輪的資料檔也是）', en: 'ODbL 1.0 (© OpenStreetMap contributors; so are the ferry data files)' },
    },
    {
      name: { zh: '交通部航港局：國內固定航班資訊（2026 年 7–8 月）', en: 'Maritime and Port Bureau (Taiwan): domestic scheduled ferry timetable (July–August 2026)' },
      url: 'https://data.gov.tw/dataset/8236',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  overlays: [FERRIES],
  listPanel: LIST,
  indicators: [
    {
      id: 'ferries',
      label: { zh: '渡輪航線', en: 'Ferry routes' },
      description: {
        zh: 'OpenStreetMap 標成渡輪航線（route=ferry）的線，只留定期客運：排除觀光船、停駛的、纜索渡船與河上的（過河的擺渡、河上的客船），兩端港口相同的只算一條（去程與回程、不同公司的同一組港口）。共 7,941 條：國內 6,817 條、跨國 416 條、湖上 708 條，最長的跨國航線是開普敦–崔斯坦達庫尼亞（2,798 公里）。國家的值是有一端在這國的航線數（跨國航線兩國都算）：菲律賓 552、挪威 532、印尼 488、日本 422、希臘 410 最多，台灣 56。左邊的清單列出台灣的航線（附航港局 2026 年 7–8 月國內固定航班的班次，最多的是東港–小琉球）與有維基百科條目的航線，點了框住整條航線。OSM 是志願者畫的，各國完整程度不一，也沒有班次與運量；觀光、定期與否也是依標籤與名稱判斷，難免有漏網或誤刪的。這個主題的渡輪資料檔是 OpenStreetMap 的衍生資料庫，以 ODbL 提供。',
        en: 'Lines tagged as ferry routes (route=ferry) in OpenStreetMap, keeping only scheduled passenger services: sightseeing boats, disused routes, cable ferries and river ferries (crossings and river boats) are excluded, and routes between the same two ports count once (outbound and return, or several operators). That leaves 7,941 routes: 6,817 domestic, 416 international and 708 on lakes; the longest international route is Cape Town–Tristan da Cunha (2,798 km). A country’s value is the number of routes with an end in it (international routes count for both countries): the Philippines 552, Norway 532, Indonesia 488, Japan 422 and Greece 410 lead, and Taiwan has 56. The list on the left shows Taiwan’s routes (with sailings from the Maritime and Port Bureau’s domestic timetable for July–August 2026; Donggang–Xiaoliuqiu is the busiest) and routes with a Wikipedia article; click one to frame the whole route. OSM is mapped by volunteers, so coverage varies by country, and it has no timetables or passenger numbers; whether a route is scheduled or for sightseeing is judged from its tags and name, so some will be misclassified. The ferry data files are a derived database of OpenStreetMap, available under the ODbL.',
      },
      unit: { zh: '條', en: 'routes' },
      file: 'ferries-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 250] } },
      integer: true,
      timeless: true,
      defaultYear: 2026,
      format: routeCount,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: 'OSM 沒有符合的渡輪航線', en: 'No matching ferry routes in OSM' },
    },
  ],
};
