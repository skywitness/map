import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 片庫的拍攝地與故事場景地的點與清單（2026-11-08，製作手冊第二十八批 678 先做給「迪士尼」，685 的「環球影城」共用；
 * pipeline/topics/disney_plus.py 的 places_layer()）。地點分六種：有座標的、大的地區、只寫到國家、跨國、虛構、沒有座標。
 */

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);

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
export const worksCount = (n: number) => tr({ zh: `${fixed(n, 0)} 部作品`, en: `${fixed(n, 0)} ${n === 1 ? 'title' : 'titles'}` });

export function placeLayer(id: string, file: string, label: Text, indicator: string, color: string, regions: boolean): PointsOverlayDef {
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

export function placeList(file: string, label: Text, tabLabel: Text, indicator: string): ListPanelDef {
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
