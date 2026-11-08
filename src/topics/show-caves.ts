import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 地下觀光：觀光洞穴、觀光礦坑與地下景點（新主題，2026-11-07，製作手冊第二十四批 438；pipeline/topics/show_caves.py）。
 * 各國的數量用 showcaves.com 的統計表（CC0，七類，子項目），點用 Wikidata 的觀光洞穴與觀光礦坑、OpenStreetMap 標成景點的洞口。
 * 角度是「售票、有導覽、對外營業的觀光設施」，不是地景；OSM 的洞口反映洞穴探勘社團的測繪程度，只畫點、不算國家。
 */

const C = MAP_TOKENS.categorical;

/** 統計表的七類（pipeline 的 COLUMNS）與合計 */
const ITEMS: { id: string; label: Text }[] = [
  { id: 'showcaves', label: { zh: '觀光洞穴', en: 'Show caves' } },
  { id: 'mines', label: { zh: '觀光礦坑', en: 'Show mines' } },
  { id: 'subterranea', label: { zh: '地下設施（地下城、防空洞、下水道）', en: 'Subterranea (underground cities, shelters, sewers)' } },
  { id: 'caves', label: { zh: '非商業洞穴', en: 'Non-commercial caves' } },
  { id: 'karst', label: { zh: '岩溶地形', en: 'Karst features' } },
  { id: 'springs', label: { zh: '大型岩溶泉', en: 'Karst springs' } },
  { id: 'gorges', label: { zh: '觀光峽谷', en: 'Gorges' } },
  { id: 'total', label: { zh: '七類合計', en: 'All seven' } },
];

const placeName = (p: PointRecord) =>
  String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? p.name ?? '') || tr({ zh: '（沒有名稱）', en: '(unnamed)' });
const proper = (p: PointRecord, title: string) => {
  const other = getLang() === 'zh' ? p.en : p.zh;
  return typeof other === 'string' && other && other !== title ? other : undefined;
};
const kindLabel = (p: PointRecord) => tr(p.k === 2 ? { zh: '觀光礦坑', en: 'Show mine' } : { zh: '觀光洞穴', en: 'Show cave' });
const langs = (p: PointRecord) =>
  tr({ zh: `${fixed(Number(p.sl), 0)} 種語言的維基百科有條目`, en: `Wikipedia articles in ${fixed(Number(p.sl), 0)} languages` });

const WIKIDATA: PointsOverlayDef = {
  kind: 'points',
  id: 'show-caves-wikidata',
  file: 'wikidata.json',
  label: { zh: '觀光洞穴與觀光礦坑（Wikidata）', en: 'Show caves and mines (Wikidata)' },
  indicators: ['show-caves'],
  radius: { field: 'sl', stops: [[0, 3], [10, 4], [30, 6], [60, 8]] },
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [2],
    classes: [
      { color: C[1], label: { zh: '觀光洞穴', en: 'Show cave' } },
      { color: C[5], label: { zh: '觀光礦坑', en: 'Show mine' } },
    ],
  },
  sortField: 'sl',
  tooltip: (p, { countryName }) => {
    const title = placeName(p);
    return {
      title,
      detail: [kindLabel(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: [langs(p)],
      properNoun: proper(p, title),
    };
  },
};

const OSM: PointsOverlayDef = {
  kind: 'points',
  id: 'show-caves-osm',
  file: 'osm.json',
  label: { zh: '標成景點的洞口（OpenStreetMap）', en: 'Cave entrances tagged as attractions (OpenStreetMap)' },
  indicators: ['show-caves'],
  radius: 2.6,
  color: MAP_TOKENS.diverging[0],
  tooltip: (p, { countryName }) => {
    const title = placeName(p);
    return {
      title,
      detail: [tr({ zh: '洞口（OpenStreetMap 標成景點）', en: 'Cave entrance (attraction on OpenStreetMap)' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
        .filter(Boolean)
        .join(' · '),
      properNoun: proper(p, title),
    };
  },
};

const LIST: ListPanelDef = {
  label: { zh: '最有名的觀光洞穴與觀光礦坑', en: 'Best-known show caves and mines' },
  indicators: ['show-caves'],
  file: 'wikidata.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) =>
    [...points]
      .sort((a, b) => Number(b.sl) - Number(a.sl))
      .slice(0, country ? undefined : 100)
      .map((p, i): ListRow => {
        const title = placeName(p);
        return {
          key: `sc-${i}-${p.q}`,
          title: `${i + 1}. ${title}`,
          properNoun: proper(p, title),
          lines: [[kindLabel(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '), langs(p)],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        };
      }),
};

export const showCaves: TopicDefinition = {
  id: 'show-caves',
  title: { zh: '地下觀光：觀光洞穴、觀光礦坑與地下景點', en: 'Going underground: show caves, show mines and subterranea' },
  shortTitle: { zh: '地下觀光', en: 'Show caves' },
  defaultIndicator: 'show-caves',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'showcaves.com（Jochen Duckeck）的統計表，2026-11-07', en: 'showcaves.com (Jochen Duckeck), statistics table, 7 November 2026' },
      url: 'https://www.showcaves.com/english/explain/Index/Statistics.php',
      license: { zh: 'CC0（站長自己做的內容是公有領域或 CC0）', en: 'CC0 (the site author’s own content is public domain or CC0)' },
    },
    {
      name: { zh: 'Wikidata 的觀光洞穴（Q2232001）與觀光礦坑（Q1506469），經 QLever', en: 'Wikidata show caves (Q2232001) and show mines (Q1506469), via QLever' },
      url: 'https://www.wikidata.org/wiki/Q2232001',
      license: { zh: 'CC0', en: 'CC0' },
    },
    {
      name: { zh: 'OpenStreetMap 同時標 natural=cave_entrance 與 tourism=attraction 的洞口，經 QLever', en: 'OpenStreetMap cave entrances also tagged tourism=attraction, via QLever' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap contributors；點的資料檔同樣用 ODbL 分享）', en: 'ODbL 1.0 (© OpenStreetMap contributors; the point file is shared under the ODbL)' },
    },
  ],
  note: withTerritories({
    zh: '各國的數量取自 showcaves.com：德國的 Jochen Duckeck 從 1990 年代起整理的觀光洞穴與地下景點目錄，分七類（觀光洞穴是對外開放、有導覽的；非商業洞穴、岩溶地形、岩溶泉、峽谷是地景）。目錄偏重站長走過與讀者回報的地方，各國收錄的完整程度不同，數字只能看大概；站方寫約 75 處已關閉但仍列入。玩笑條目（Matrix、Middle-Earth、Molvanîa）不算。地圖上的點是 Wikidata 收錄、有座標的觀光洞穴與觀光礦坑（大小是有幾種語言的維基百科條目），加上 OpenStreetMap 同時標成洞口與景點的地方（灰橘色的小點；OSM 的洞口多半是洞穴探勘社團畫的，國家之間差很多，所以只畫點、不比國家）。台灣不在 showcaves.com 與 Wikidata 的觀光洞穴裡；OSM 上台灣標成景點的 15 個洞口（例如澎湖的小門鯨魚洞、獅頭山的靈霞洞與覺王洞）多半是免費參觀的海蝕洞與洞窟廟，不是售票導覽的觀光洞穴。',
    en: 'Country counts come from showcaves.com, the directory of show caves and underground sights that Jochen Duckeck of Germany has kept since the 1990s, in seven categories (show caves are open to the public with guided tours; non-commercial caves, karst features, karst springs and gorges are natural sights). It favours places the author has visited or readers have reported, so coverage varies by country and the numbers are only indicative; the site notes that about 75 listed places have closed. Joke entries (Matrix, Middle-Earth, Molvanîa) are excluded. Dots on the map are the show caves and show mines in Wikidata with coordinates (sized by the number of Wikipedia language editions), plus places OpenStreetMap tags as both a cave entrance and an attraction (small grey-orange dots; OSM cave entrances are mostly mapped by caving clubs and vary greatly between countries, so they are only drawn, not counted). Taiwan is not in showcaves.com or among Wikidata’s show caves; its 15 OSM cave entrances tagged as attractions (such as the Whale Cave at Xiaomen, Penghu, and the Lingxia and Juewang cave temples on Shitoushan) are mostly free sea caves and cave temples rather than ticketed show caves.',
  }),
  overlays: [WIKIDATA, OSM],
  listPanel: LIST,
  indicators: [
    {
      id: 'show-caves',
      label: { zh: '觀光洞穴與地下景點', en: 'Show caves and underground sights' },
      description: {
        zh: 'showcaves.com 收錄的各國數量（比例圓），子項目切換七類：觀光洞穴 155 國合計 1,572 處、106 國至少有一處，中國 163、美國 158、法國 112、西班牙 86、日本 85、義大利 68、澳洲 57、德國 54、越南 47、泰國 40；觀光礦坑 1,152 處，德國 237 最多、美國 147、法國 99、英國 75；地下設施（地下城、防空洞、地下教堂、下水道導覽）1,697 處，法國、義大利各 187。地圖上的點是 Wikidata 的觀光洞穴與礦坑 612 處（維基百科條目最多的是越南的山水洞與天堂洞、美國的猛獁洞）與 OpenStreetMap 標成景點的 1,738 個洞口；左邊的清單依維基百科的語言數列出前 100 處。',
        en: 'Counts per country listed by showcaves.com (bubbles); switch between its seven categories. Show caves: 1,572 across 155 countries, with at least one in 106 – China 163, the US 158, France 112, Spain 86, Japan 85, Italy 68, Australia 57, Germany 54, Vietnam 47 and Thailand 40. Show mines: 1,152, led by Germany with 237, the US 147, France 99 and the UK 75. Subterranea (underground cities, shelters, crypts and sewer tours): 1,697, with France and Italy at 187 each. Dots mark the 612 show caves and mines in Wikidata (those with the most Wikipedia editions are Son Doong and Paradise Cave in Vietnam and Mammoth Cave in the US) and 1,738 cave entrances tagged as attractions on OpenStreetMap; the list on the left shows the top 100 by number of Wikipedia languages.',
      },
      unit: { zh: '處', en: '' },
      file: 'counts/{item}.json',
      dimension: { label: { zh: '種類', en: 'Category' }, options: ITEMS, defaultOption: 'showcaves' },
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      shareOfWorld: true,
      missing: { zh: 'showcaves.com 沒有收錄', en: 'Nothing listed by showcaves.com' },
    },
  ],
};
