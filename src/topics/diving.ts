import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 潛水中心與潛點（2026-11-04，製作手冊第二十一批 343；pipeline/topics/diving.py）：
 * OpenStreetMap（經 QLever）的潛水中心（amenity=dive_centre）與潛水場域（sport=scuba_diving，含內陸訓練水域）。
 * 點圖是主角；各國個數的面量圖只替 OSM 覆蓋良好的國家上色（pipeline/sources/osm_coverage.py）。
 */

const KINDS = [
  { label: { zh: '潛水中心', en: 'Dive centre' }, color: MAP_TOKENS.categorical[0] },
  { label: { zh: '潛水場域（含內陸訓練水域）', en: 'Diving site (incl. inland training waters)' }, color: MAP_TOKENS.categorical[2] },
];

function names(p: PointRecord): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  const unnamed = tr({ zh: `（沒有名稱的${tr(KINDS[Number(p.k) - 1]?.label ?? KINDS[0].label)}）`, en: '(unnamed)' });
  // 只有原文名稱時就用它當標題（專有名詞），不再重複列一次
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || unnamed };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || unnamed };
}

const kindText = (p: PointRecord) => tr(KINDS[Number(p.k) - 1]?.label ?? KINDS[0].label);

const LIST: ListPanelDef = {
  label: { zh: '潛水中心與潛水場域（依國家）', en: 'Dive centres and sites by country' },
  file: 'places.json',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.n)
      .map((p) => ({ p, c: typeof p.iso3 === 'string' ? countryName(p.iso3) : '' }))
      .sort((a, b) => a.c.localeCompare(b.c, getLang() === 'zh' ? 'zh-Hant' : 'en') || Number(a.p.k) - Number(b.p.k))
      .map(({ p, c }, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${p.id}-${i}`,
          title,
          lines: [[c, kindText(p)].filter(Boolean).join(' · ')],
          properNoun: proper,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) });

export const diving: TopicDefinition = {
  id: 'diving',
  title: { zh: '潛水中心與潛點', en: 'Dive centres and diving sites' },
  shortTitle: { zh: '潛水', en: 'Diving' },
  defaultIndicator: 'dive-centres',
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
    zh: '點是 OpenStreetMap 上標成潛水中心（amenity=dive_centre）與潛水場域（sport=scuba_diving）的地方，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方名錄：有人畫才有，台灣只有潛水中心 11 個、潛水場域 12 個。潛水場域不只海洋潛點，德國、瑞士、荷蘭最多，多半是內陸的採石場湖、潛水池與訓練水域；想看潛水勝地看潛水中心的點，東南亞、紅海、加勒比海、地中海聚集得很清楚。畫成面或線的取中心當點。各國個數的面量圖只替 OSM 覆蓋良好的國家上色（判準跟「外食與喝一杯」相同：OSM 上的餐飲店對住宿及餐飲業就業人數），菲律賓、泰國、印尼、埃及這些潛水大國不在名單裡，看點就好。PADI 的各國發證數沒有公開，不用。',
    en: 'Dots are places tagged on OpenStreetMap as dive centres (amenity=dive_centre) or diving sites (sport=scuba_diving), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0), not an official directory: only what volunteers have mapped is shown, and Taiwan has just 11 dive centres and 12 diving sites. Diving sites are not only sea dives: Germany, Switzerland and the Netherlands have the most, mostly inland quarry lakes, dive pools and training waters; for diving destinations look at the dive centres, which cluster clearly in Southeast Asia, the Red Sea, the Caribbean and the Mediterranean. Areas and lines are drawn at their centre. The country choropleth only colours countries where OSM is reasonably complete (the same test as the Eating out topic: OSM food and drink places against food-service employment), so diving giants such as the Philippines, Thailand, Indonesia and Egypt are left out; use the dots for them. PADI’s certifications by country are not published, so they are not used.',
  },
  listPanel: LIST,
  overlays: [
    {
      kind: 'points',
      id: 'places',
      file: 'places.json',
      label: { zh: '潛水中心與潛水場域', en: 'Dive centres and diving sites' },
      radius: { field: 'k', stops: [[1, 3.5], [2, 2.5]] },
      color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [2], classes: KINDS },
      tooltip: (p, { countryName }) => {
        const { title, proper } = names(p);
        return { title, extra: [[typeof p.iso3 === 'string' ? countryName(p.iso3) : '', kindText(p)].filter(Boolean).join(' · ')], properNoun: proper };
      },
    },
  ],
  indicators: [
    {
      id: 'dive-centres',
      label: { zh: '潛水中心', en: 'Dive centres' },
      description: {
        zh: 'OpenStreetMap 上的潛水中心，全球 2,313 個、110 國：菲律賓 212 個最多，法國 187、泰國 145、印尼 135、西班牙 130、埃及 126、德國 111、義大利 101、美國 93、馬爾地夫 81；台灣 11 個（東北角、墾丁、小琉球、綠島、澎湖與台北）。面量圖只替 OSM 覆蓋良好的 64 國上色（菲律賓、泰國、印尼、埃及不在裡面），點全部畫。',
        en: 'Dive centres on OpenStreetMap: 2,313 in 110 countries worldwide. The Philippines has the most at 212, followed by France 187, Thailand 145, Indonesia 135, Spain 130, Egypt 126, Germany 111, Italy 101, the US 93 and the Maldives 81; Taiwan has 11 (the northeast coast, Kenting, Xiaoliuqiu, Green Island, Penghu and Taipei). The choropleth colours only the 64 countries where OSM is reasonably complete (not the Philippines, Thailand, Indonesia or Egypt); all dots are shown.',
      },
      unit: { zh: '個', en: 'count' },
      file: 'dive-centres.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100] } },
      format: count,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'dive-sites',
      label: { zh: '潛水場域（含內陸訓練水域）', en: 'Diving sites (incl. inland training waters)' },
      description: {
        zh: 'OpenStreetMap 上標成可以潛水（sport=scuba_diving）的地方，全球 4,662 個：德國 536 個最多、瑞士 374、荷蘭 298，多半是內陸的採石場湖、潛水池與訓練水域；海洋潛點多的是印尼 397、埃及 301、馬爾地夫 187、菲律賓 153。台灣 12 個（綠島的石朗、大白沙等）。',
        en: 'Places tagged on OpenStreetMap as suitable for scuba diving (sport=scuba_diving): 4,662 worldwide. Germany has the most at 536, Switzerland 374 and the Netherlands 298, mostly inland quarry lakes, dive pools and training waters; sea dives dominate in Indonesia 397, Egypt 301, the Maldives 187 and the Philippines 153. Taiwan has 12 (including Shilang and Dabaisha on Green Island).',
      },
      unit: { zh: '個', en: 'count' },
      file: 'dive-sites.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100] } },
      format: count,
      formatTick: (v) => `${v}`,
    },
  ],
};
