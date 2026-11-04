import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 攀岩場（2026-11-04，製作手冊第二十一批 363；pipeline/topics/climbing.py）：
 * OpenStreetMap（經 QLever）的岩場（climbing=crag）。台灣沒有標成岩場的地方，另外畫台灣標成攀岩（sport=climbing）的點，口徑不同。
 * 各國岩場數的面量圖只替 OSM 覆蓋良好的國家上色（pipeline/sources/osm_coverage.py）。
 */

const KINDS = [
  { label: { zh: '岩場（climbing=crag）', en: 'Crag (climbing=crag)' }, color: MAP_TOKENS.categorical[1] },
  { label: { zh: '台灣標成攀岩的地點（個別路線、攀岩館）', en: 'Taiwan: climbing features (routes, gyms)' }, color: MAP_TOKENS.categorical[4] },
];

function names(p: PointRecord): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const unnamed = tr({ zh: '（沒有名稱的岩場）', en: '(unnamed crag)' });
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || unnamed };
}

const kindText = (p: PointRecord) => tr(KINDS[Number(p.k) - 1]?.label ?? KINDS[0].label);

const LIST: ListPanelDef = {
  label: { zh: '岩場（依國家）', en: 'Crags by country' },
  file: 'crags.json',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.n)
      .map((p) => ({ p, c: typeof p.iso3 === 'string' ? countryName(p.iso3) : '' }))
      .sort((a, b) => a.c.localeCompare(b.c, getLang() === 'zh' ? 'zh-Hant' : 'en') || String(a.p.n).localeCompare(String(b.p.n)))
      .map(({ p, c }, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${i}`,
          title,
          lines: [[c, Number(p.k) === 2 ? kindText(p) : null].filter(Boolean).join(' · ')],
          properNoun: proper,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) });

export const climbing: TopicDefinition = {
  id: 'climbing',
  title: { zh: '攀岩場', en: 'Climbing crags' },
  shortTitle: { zh: '攀岩', en: 'Climbing' },
  defaultIndicator: 'crag-count',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
  ],
  note: {
    zh: '點是 OpenStreetMap 上標成岩場（climbing=crag，一片可以攀登的岩壁或岩區）的地方，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄：有人畫才有。不用更寬的「攀岩」標籤（sport=climbing）畫主圖，因為它同時標在每一條攀岩路線與室內攀岩館上，各國的畫法差太多（捷克把每條路線都畫進去，有 21,897 個，是美國的近 4 倍）；各國的個數寫在 tooltip。台灣沒有任何標成岩場的地方，另外畫台灣標成攀岩的 52 個點（龍洞的各個岩區、山上的個別路線與各地的攀岩館混在一起），口徑不同。畫成面或線的取中心當點。各國岩場數的面量圖只替 OSM 覆蓋良好的國家上色（判準跟「外食與喝一杯」相同），岩場地圖同時在量德語區與捷克的繪圖社群多活躍，只能看大概。這是攀岩的場地，跟「海拔」「山脈」的地形不同。',
    en: 'Dots are places tagged on OpenStreetMap as crags (climbing=crag, a rock face or area that can be climbed), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0), not an official directory: only what volunteers have mapped is shown. The broader climbing tag (sport=climbing) is not used for the main map because it is also put on every single route and on indoor gyms, and mapping practice varies too much (Czechia maps every route, with 21,897 features, nearly four times the US); the counts are in the tooltip. Taiwan has no features tagged as crags, so its 52 climbing features (Longdong’s climbing areas, individual mountain routes and gyms mixed together) are drawn as a separate layer, on a different basis. Areas and lines are drawn at their centre. The country choropleth only colours countries where OSM is reasonably complete (the same test as the Eating out topic); the crag map also reflects how active the German-speaking and Czech mapping communities are, so treat comparisons as approximate. These are places people climb, unlike the terrain shown in the Elevation and Mountain ranges topics.',
  },
  listPanel: LIST,
  overlays: [
    {
      kind: 'points',
      id: 'crags',
      file: 'crags.json',
      label: { zh: '岩場', en: 'Crags' },
      radius: { field: 'k', stops: [[1, 2.5], [2, 3.5]] },
      color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [2], classes: KINDS },
      tooltip: (p, { countryName }) => {
        const { title, proper } = names(p);
        return { title, extra: [[typeof p.iso3 === 'string' ? countryName(p.iso3) : '', kindText(p)].filter(Boolean).join(' · ')], properNoun: proper };
      },
    },
  ],
  indicators: [
    {
      id: 'crag-count',
      label: { zh: '岩場', en: 'Crags' },
      description: {
        zh: 'OpenStreetMap 上的岩場，全球 11,610 個、70 國：捷克 2,364 個最多（北波希米亞的砂岩塔），美國 1,334、法國 1,317、德國 1,205、奧地利 1,202、加拿大 752、義大利 732、挪威 452、西班牙 321、英國 233、瑞士 213、希臘 204；比利時 73、日本 3、南韓 0。台灣沒有標成岩場的地方（地圖上另外畫台灣標成攀岩的 52 個點）。面量圖只替 OSM 覆蓋良好的國家上色，點全部畫。',
        en: 'Crags on OpenStreetMap: 11,610 in 70 countries worldwide. Czechia has the most at 2,364 (the sandstone towers of northern Bohemia), followed by the US 1,334, France 1,317, Germany 1,205, Austria 1,202, Canada 752, Italy 732, Norway 452, Spain 321, the UK 233, Switzerland 213 and Greece 204; Belgium 73, Japan 3 and South Korea 0. Taiwan has none tagged as crags (its 52 climbing features are drawn as a separate layer). The choropleth colours only countries where OSM is reasonably complete; all dots are shown.',
      },
      unit: { zh: '個', en: 'count' },
      file: 'crag-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 50, 200, 1000] } },
      format: count,
      formatTick: (v) => `${v}`,
    },
  ],
};
