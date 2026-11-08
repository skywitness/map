import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { nearText } from '../lib/near';
import { MAP_TOKENS, TOKENS } from '../theme/tokens';
import { attractionsExtra } from './attractions-extra';
import { attractionsVisitors } from './attractions-visitors';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withMenuGroups, type MenuGroup } from './menu-groups';
import { osmGrid } from './osm-grid';

/**
 * 景點地圖（pipeline/topics/attractions.py）：世界的博物館、動物園與水族館、主題樂園與雲霄飛車，每一處一個點，三個圖層；
 * 2026-10-30 加上第四個圖層植物園（pipeline/topics/botanical_gardens.py，Wikidata）。
 * 使用者 2026-10-29 決定：三類合成一個主題、用圖層切換；只畫點，不做各國的數量（數量反映 Wikidata 的收錄程度）；
 * 台灣的博物館用文化部的開放資料補，台灣缺的動物園、水族館手工補；已拆除、停業的不畫。
 * 人次、摩天輪、購物中心、世界奇觀、創意城市、世界博覽會在 attractions-extra.ts（2026-10-31，第十批 182）。
 */

export interface LayerKinds {
  id: 'museums' | 'zoos' | 'parks' | 'gardens';
  label: Text;
  kinds: { value: number; label: Text; color: string }[];
}

const C = MAP_TOKENS.categorical;
/** 前三個圖層一起畫，8 類各用一個類別色（任兩色都分得開）；植物園另外用兩種綠 */
export const LAYERS: LayerKinds[] = [
  {
    id: 'museums',
    label: { zh: '博物館', en: 'Museums' },
    kinds: [
      { value: 1, label: { zh: '美術館', en: 'Art museum' }, color: C[7] },
      { value: 2, label: { zh: '自然與科學', en: 'Nature and science' }, color: C[0] },
      { value: 3, label: { zh: '歷史與文化', en: 'History and culture' }, color: C[2] },
      { value: 4, label: { zh: '其他博物館', en: 'Other museum' }, color: C[1] },
    ],
  },
  {
    id: 'zoos',
    label: { zh: '動物園與水族館', en: 'Zoos and aquariums' },
    kinds: [
      { value: 1, label: { zh: '動物園', en: 'Zoo' }, color: C[3] },
      { value: 2, label: { zh: '水族館', en: 'Aquarium' }, color: C[6] },
    ],
  },
  {
    id: 'parks',
    label: { zh: '主題樂園與雲霄飛車', en: 'Theme parks and roller coasters' },
    kinds: [
      { value: 1, label: { zh: '主題樂園、遊樂園', en: 'Theme or amusement park' }, color: C[5] },
      { value: 2, label: { zh: '雲霄飛車', en: 'Roller coaster' }, color: C[4] },
    ],
  },
  {
    id: 'gardens',
    label: { zh: '植物園', en: 'Botanical gardens' },
    // 8 個類別色都用掉了：植物園用介面的綠色，樹木園用深青綠（跟其他圖層的顏色分得開）
    kinds: [
      { value: 1, label: { zh: '植物園（含玫瑰園、藥用植物園）', en: 'Botanical garden (incl. rose and physic gardens)' }, color: TOKENS.light.hues.green },
      { value: 2, label: { zh: '樹木園', en: 'Arboretum' }, color: '#0b6e5f' },
    ],
  },
];

export const kindLabel = (layer: LayerKinds, t: unknown) => tr(layer.kinds.find((k) => k.value === t)?.label ?? '');

/** 名稱：中文介面用中文名稱（Wikidata 的台灣用字、文化部），沒有的用英文 */
export function placeName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return typeof p.en === 'string' ? p.en : typeof p.zh === 'string' ? p.zh : '';
}

export const articlesText = (n: number) =>
  tr({ zh: `${fixed(n, 0)} 種語言的維基百科有條目`, en: `Wikipedia articles in ${fixed(n, 0)} ${n === 1 ? 'language' : 'languages'}` });

/** museums.json 收的博物館：維基百科條目語言數這麼多以上（下面 museums 的 stops 在 7 級以下只畫這些） */
export const MUSEUM_MIN_SL = 8;

function overlay(layer: LayerKinds, minValue: [number, number][]): PointsOverlayDef {
  const color: ColorClasses = {
    field: 't',
    title: { zh: '類型', en: 'Type' },
    thresholds: layer.kinds.slice(1).map((k) => k.value),
    classes: layer.kinds.map((k) => ({ color: k.color, label: k.label })),
  };
  return {
    kind: 'points',
    id: layer.id,
    file: `${layer.id}.json`,
    label: layer.label,
    // 人次、地標、創意城市、世界博覽會的指標不畫這四層（點太多，跟那些圖層混在一起）
    indicators: ['attractions'],
    radius: { field: 'sl', stops: [[0, 1.8], [10, 2.6], [40, 3.8], [100, 5.2]] },
    color,
    sortField: 'sl',
    minValue: { field: 'sl', stops: minValue },
    // 博物館 6 萬多座：museums.json 只有 7 級以下會畫的（條目語言數 MUSEUM_MIN_SL 以上），其餘的在 museums-more.json，
    // 放大到 6.5 級才下載（pipeline/topics/attractions.py 的 MUSEUM_IMPORTANT_SL，2026-10-31）
    ...(layer.id === 'museums' ? { more: { minZoom: 6.5 } } : {}),
    tooltip: (p, ctx) => {
      const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
      const sl = Number(p.sl);
      const extra = [
        typeof p.y === 'number' ? tr({ zh: `${p.y} 年設立`, en: `founded ${p.y}` }) : null,
        sl > 0 ? articlesText(sl) : p.moc === 1 ? tr({ zh: '文化部的博物館名錄', en: 'From Taiwan’s Ministry of Culture museum list' }) : null,
      ];
      const name = placeName(p);
      return {
        title: name,
        detail: [kindLabel(layer, p.t), country].filter(Boolean).join(' · '),
        extra: extra.filter((x): x is string => Boolean(x)),
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

/** 樂園的點給「樂園」主題用（2026-11-08，製作手冊第二十七批 630）：同一個檔，景點地圖的總覽照樣畫 */
export const parksOverlay = (indicators: string[]): PointsOverlayDef => ({
  ...overlay(LAYERS[2], [[0, 15], [3, 5], [5, 0]]),
  id: 'theme-park-points',
  file: '../attractions/parks.json',
  indicators,
});

/** 博物館的點給「博物館與美術館」主題用（2026-11-08，製作手冊第二十七批 638）：同一個檔，景點地圖的總覽照樣畫 */
export const museumsOverlay = (indicators: string[]): PointsOverlayDef => ({
  ...overlay(LAYERS[0], [[0, 40], [3, 20], [5, MUSEUM_MIN_SL], [7, 0]]),
  id: 'museum-points',
  file: '../attractions/museums.json',
  indicators,
});

/**
 * 動物園的面積、物種數、人次（2026-11-08，製作手冊第二十七批 642，候選 1407）：Wikidata 有其中一項的動物園不多，
 * 手冊說只做清單、不上色
 */
const VP_T = [1, 5, 10, 25, 50, 100];
const AR_T = [10, 25, 50, 100, 250, 500];
const AT_T = [1, 5, 10, 20, 40, 80];
const ML_T = [5, 10, 20, 40, 80, 160];
const DS_T = [2, 5, 10, 20, 40, 80];
const PK_T = [10, 20, 40, 60, 100, 150];

const ZOO_FACTS: ListPanelDef = {
  label: { zh: '動物園的面積、物種數與人次（Wikidata）', en: 'Zoo areas, species and visitors (Wikidata)' },
  tabLabel: { zh: '動物園', en: 'Zoos' },
  indicators: ['zoos-osm', 'zoos-osm-per'],
  file: 'zoo-facts.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡的動物園沒有這些資料', en: 'No zoo data here in Wikidata' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (Number(b.v) || 0) - (Number(a.v) || 0) || (Number(b.sp) || 0) - (Number(a.sp) || 0))
      .map((p, i): ListRow => ({
        key: `zoo-${i}-${p.en}`,
        title: placeName(p),
        lines: [
          [
            typeof p.ha === 'number' ? tr({ zh: `${fixed(p.ha, p.ha < 10 ? 1 : 0)} 公頃`, en: `${fixed(p.ha, p.ha < 10 ? 1 : 0)} ha` }) : null,
            typeof p.sp === 'number' ? tr({ zh: `Wikidata 列了 ${fixed(p.sp, 0)} 種動物`, en: `${fixed(p.sp, 0)} species listed in Wikidata` }) : null,
            typeof p.v === 'number' ? tr({ zh: `一年 ${fixed(p.v, 0)} 人次`, en: `${fixed(p.v, 0)} visitors a year` }) : null,
          ]
            .filter(Boolean)
            .join(' · '),
          typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
        ],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
      })),
};

/**
 * 觀景點與公共藝術（2026-11-08，製作手冊第二十七批 645，候選 1413、1414；pipeline/topics/viewpoints_art.py）：
 * OSM 的 tourism=viewpoint、tourism=artwork 分國計數與 0.1° 網格；台灣另有文化部的公共藝術清冊（點，依設置年份累積）。
 * 兩份是不同的清單，台灣的數字不相加。
 */
const VIEW_GRID = osmGrid(
  'viewpoints-grid',
  'viewpoints-grid.json',
  { zh: '觀景點（約 10 公里的網格）', en: 'Viewpoints (about 10 km grid)' },
  ['viewpoints-per', 'viewpoints'],
  { zh: '觀景點', en: 'viewpoints' },
);
const ART_GRID = osmGrid(
  'artworks-grid',
  'artworks-grid.json',
  { zh: '公共藝術（約 10 公里的網格）', en: 'Public art (about 10 km grid)' },
  ['artworks-osm-per', 'artworks-osm'],
  { zh: '公共藝術', en: 'artworks' },
);
const TW_ART: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-public-art',
  file: 'taiwan-public-art.json',
  label: { zh: '台灣的公共藝術（文化部）', en: 'Taiwan’s public art (Ministry of Culture)' },
  indicators: ['taiwan-public-art'],
  radius: 2.6,
  color: C[4],
  timeField: 'y',
  tooltip: (p) => ({
    title: String(p.name ?? '') || tr({ zh: '公共藝術', en: 'Public artwork' }),
    detail: [tr({ zh: '公共藝術（文化部）', en: 'Public art (Ministry of Culture)' }), typeof p.county === 'string' ? p.county : null].filter(Boolean).join(' · '),
    extra: [
      typeof p.y === 'number' ? tr({ zh: `${p.y} 年設置`, en: `installed ${p.y}` }) : null,
      typeof p.mat === 'string' ? tr({ zh: `材質：${p.mat}`, en: `Material: ${p.mat}` }) : null,
    ].filter((x): x is string => Boolean(x)),
  }),
};
const TW_ART_LIST: ListPanelDef = {
  label: { zh: '台灣的公共藝術（文化部）', en: 'Taiwan’s public art (Ministry of Culture)' },
  tabLabel: { zh: '台灣', en: 'Taiwan' },
  indicators: ['taiwan-public-art'],
  file: 'taiwan-public-art.json',
  rows: (points) => {
    const by = new Map<string, PointRecord[]>();
    for (const p of points) by.set(String(p.county ?? ''), [...(by.get(String(p.county ?? '')) ?? []), p]);
    const rows: ListRow[] = [];
    for (const [county, list] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      list
        .sort((a, b) => (Number(b.y) || 0) - (Number(a.y) || 0))
        .forEach((p, i) => {
          rows.push({
            key: `twart-${county}-${i}`,
            title: String(p.name ?? '') || tr({ zh: '公共藝術', en: 'Public artwork' }),
            lines: [[typeof p.y === 'number' ? tr({ zh: `${p.y} 年設置`, en: `installed ${p.y}` }) : null, typeof p.mat === 'string' ? p.mat : null].filter(Boolean).join(' · ')],
            group: tr({ zh: `${county || '縣市不詳'}（${list.length}）`, en: `${county || 'Unknown'} (${list.length})` }),
            target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 16 },
          });
        });
    }
    return rows;
  },
};

/**
 * 天文館、觀光景點的總量、購物中心與百貨公司（2026-11-08，製作手冊第二十七批 646，候選 1415–1417）、
 * 都市公園（647，候選 1418；pipeline/topics/attractions_more.py）：都是 OSM 經 QLever。
 */
const ATTR_GRID = osmGrid(
  'osm-attractions-grid',
  'osm-attractions-grid.json',
  { zh: '觀光景點（約 10 公里的網格）', en: 'Attractions (about 10 km grid)' },
  ['osm-attractions-per', 'osm-attractions'],
  { zh: '觀光景點', en: 'attractions' },
);
const planetName = (p: PointRecord) => String((getLang() === 'zh' ? p.nz || p.n : p.ne || p.n) ?? '') || tr({ zh: '天文館', en: 'Planetarium' });
const PLANETARIUMS: PointsOverlayDef = {
  kind: 'points',
  id: 'planetariums',
  file: 'planetariums.json',
  label: { zh: '天文館與星象館（OSM）', en: 'Planetariums (OSM)' },
  indicators: ['planetariums'],
  radius: 3.4,
  color: C[2],
  tooltip: (p, { countryName }) => {
    const title = planetName(p);
    return {
      title,
      detail: [tr({ zh: '天文館（OpenStreetMap）', en: 'Planetarium (OpenStreetMap)' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      properNoun: typeof p.n === 'string' && p.n !== title ? p.n : undefined,
    };
  },
};
const PLANET_LIST: ListPanelDef = {
  label: { zh: '天文館與星象館', en: 'Planetariums' },
  tabLabel: { zh: '天文館', en: 'Planetariums' },
  indicators: ['planetariums'],
  file: 'planetariums.json',
  countryField: 'iso3',
  empty: { zh: 'OSM 上這裡沒有有名稱的天文館', en: 'No named planetariums here in OSM' },
  rows: (points, { countryName }) =>
    points
      .filter((p) => typeof p.n === 'string')
      .map((p, i): ListRow => {
        const title = planetName(p);
        return {
          key: `pl-${i}`,
          title,
          properNoun: typeof p.n === 'string' && p.n !== title ? p.n : undefined,
          lines: [typeof p.iso3 === 'string' ? countryName(p.iso3) : ''],
          group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
        };
      }),
};

/**
 * 歐洲文化之都、歐洲遺產標章（2026-11-08，製作手冊第二十七批 648，候選 1419、1421；pipeline/topics/euro_culture.py）：
 * 英文維基的名單（固定版本），座標與中文名稱用 Wikidata；台灣的觀光工廠（650，候選 1423；pipeline/topics/tw_factories.py）。
 */
const euroName = (p: PointRecord) => String((getLang() === 'zh' ? p.zh || p.en : p.en) ?? '');
const euroProper = (p: PointRecord) => (getLang() === 'zh' && typeof p.zh === 'string' && typeof p.en === 'string' ? p.en : undefined);
const CAPITALS: PointsOverlayDef = {
  kind: 'points',
  id: 'capitals-of-culture',
  file: 'capitals-of-culture.json',
  label: { zh: '歐洲文化之都', en: 'European Capitals of Culture' },
  indicators: ['capitals-of-culture'],
  radius: 4,
  color: C[6],
  timeField: 'y',
  tooltip: (p, { countryName }) => ({
    title: euroName(p),
    detail: [tr({ zh: `${p.y} 年歐洲文化之都`, en: `European Capital of Culture ${p.y}` }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: Number(p.y) > 2026 ? [tr({ zh: '已決定、還沒舉辦', en: 'Designated, not yet held' })] : [],
    properNoun: euroProper(p),
  }),
};
const CAPITALS_LIST: ListPanelDef = {
  label: { zh: '歐洲文化之都（依年份）', en: 'European Capitals of Culture (by year)' },
  tabLabel: { zh: '文化之都', en: 'Capitals of Culture' },
  indicators: ['capitals-of-culture'],
  file: 'capitals-of-culture.json',
  countryField: 'iso3',
  empty: { zh: '這一國沒有當過歐洲文化之都', en: 'No European Capitals of Culture here' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.y) - Number(b.y))
      .map((p, i): ListRow => ({
        key: `ecoc-${i}`,
        title: euroName(p),
        properNoun: euroProper(p),
        lines: [[String(p.y), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · ')],
        muted: Number(p.y) > 2026,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
      })),
};
const LABEL_SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'heritage-label',
  file: 'heritage-label.json',
  label: { zh: '歐洲遺產標章', en: 'European Heritage Label' },
  indicators: ['heritage-label'],
  radius: 4,
  color: C[3],
  tooltip: (p, { countryName }) => ({
    title: euroName(p),
    detail: [tr({ zh: '歐洲遺產標章', en: 'European Heritage Label' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: euroProper(p),
  }),
};
const LABEL_LIST: ListPanelDef = {
  label: { zh: '歐洲遺產標章', en: 'European Heritage Label' },
  tabLabel: { zh: '遺產標章', en: 'Heritage Label' },
  indicators: ['heritage-label'],
  file: 'heritage-label.json',
  countryField: 'iso3',
  empty: { zh: '這一國沒有畫在地圖上的歐洲遺產標章', en: 'No European Heritage Label sites drawn here' },
  rows: (points, { countryName }) =>
    points.map(
      (p, i): ListRow => ({
        key: `ehl-${i}`,
        title: euroName(p),
        properNoun: euroProper(p),
        lines: [typeof p.iso3 === 'string' ? countryName(p.iso3) : ''],
        group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      }),
    ),
};
const FACTORIES: PointsOverlayDef = {
  kind: 'points',
  id: 'tw-factories',
  file: 'tw-factories.json',
  label: { zh: '台灣的觀光工廠（經濟部產業發展署）', en: 'Taiwan’s tourism factories (Industrial Development Administration)' },
  indicators: ['tw-factories'],
  radius: 3.4,
  color: {
    field: 'a',
    title: { zh: '位置', en: 'Location' },
    thresholds: [0.5],
    classes: [
      { color: C[2], label: { zh: '對到 OpenStreetMap 的地點', en: 'Matched to OpenStreetMap' } },
      { color: MAP_TOKENS.categoricalOther, label: { zh: '只知道鄉鎮市區（畫在中心）', en: 'Township only (drawn at its centre)' } },
    ],
  },
  tooltip: (p) => ({
    title: String(p.name ?? ''),
    detail: [tr({ zh: '觀光工廠', en: 'Tourism factory' }), [p.county, p.town].filter((x) => typeof x === 'string').join('')].filter(Boolean).join(' · '),
    extra: p.a === 1 ? [tr({ zh: '位置是鄉鎮市區的中心，不是工廠本身', en: 'Location is the township centre, not the factory itself' })] : [],
  }),
};
const FACTORY_LIST: ListPanelDef = {
  label: { zh: '台灣的觀光工廠', en: 'Taiwan’s tourism factories' },
  tabLabel: { zh: '觀光工廠', en: 'Factories' },
  indicators: ['tw-factories'],
  file: 'tw-factories.json',
  rows: (points) => {
    const count = new Map<string, number>();
    for (const p of points) count.set(String(p.county ?? ''), (count.get(String(p.county ?? '')) ?? 0) + 1);
    return [...points]
      .sort((a, b) => (count.get(String(b.county ?? '')) ?? 0) - (count.get(String(a.county ?? '')) ?? 0) || String(a.county).localeCompare(String(b.county)))
      .map((p, i): ListRow => ({
        key: `twf-${i}`,
        title: String(p.name ?? ''),
        lines: [[p.county, p.town].filter((x) => typeof x === 'string').join('')],
        group: tr({ zh: `${p.county ?? ''}（${count.get(String(p.county ?? '')) ?? 0}）`, en: `${p.county ?? ''} (${count.get(String(p.county ?? '')) ?? 0})` }),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: p.a === 1 ? 12 : 16 },
        link: typeof p.url === 'string' ? { href: p.url, label: tr({ zh: '官方網站', en: 'Website' }) } : undefined,
      }));
  },
};

/** 附近最多列幾處（歐洲的城市 30 公里內博物館上千座） */
const NEAR_MAX = 300;

/**
 * 這一點 30 公里內的景點（2026-11-06，城4，參考 thecastlemap.com 的「100 公里內的城堡」）：博物館、動物園、樂園、植物園
 * 四個檔一起讀（extraFiles），由近到遠最多 300 處；景點比城堡密很多，範圍縮小。博物館只讀 museums.json（條目語言數 8 以上，
 * 地圖本來就讀的）：其餘的 6 萬座在 museums-more.json（gzip 後約 930 KB），清單是預設打開的，不為它多下載
 */
const NEAR_LIST: ListPanelDef = {
  label: { zh: '這一點 30 公里內的景點（博物館只列有名的）', en: 'Attractions within 30 km (best-known museums only)' },
  tabLabel: { zh: '附近', en: 'Nearby' },
  indicators: ['attractions'],
  file: 'museums.json',
  extraFiles: ['zoos.json', 'parks.json', 'gardens.json'],
  near: { km: 30 },
  empty: { zh: '這一點 30 公里內沒有地圖上的景點', en: 'No attractions on the map within 30 km of this spot' },
  rows: (points, { countryName }) =>
    points.slice(0, NEAR_MAX).map((p, i): ListRow => {
      const layer = LAYERS[Number(p._f) || 0];
      const name = placeName(p);
      return {
        key: `${p._f}-${i}-${p.lon},${p.lat}`,
        title: name,
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
        lines: [
          [nearText(p), kindLabel(layer, p.t)].filter(Boolean).join(' · '),
          typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
        ].filter(Boolean),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      };
    }),
};

/**
 * 指標選單的分組（2026-11-07，製作手冊第二十七批 537）：景點地圖改定位成「其他景點與世界的紀錄」的總覽，
 * 十件不相干的事分組。博物館的指標在順序 638 搬到「博物館與美術館」、樂園的在順序 630–636 搬到樂園的主題；
 * 順序 642–650 的觀景點、公共藝術、都市公園再開「看風景與公共空間」一組（645 開始）
 */
const MENU_GROUPS: MenuGroup[] = [
  [{ zh: '其他景點', en: 'Other attractions' }, ['attractions', 'taiwan-sites', 'tw-factories', 'osm-attractions-per', 'osm-attractions', 'planetariums']],
  // 2026-11-08（製作手冊第二十七批 642）OSM 的動物園與水族館
  [{ zh: '動物園與水族館', en: 'Zoos and aquariums' }, ['zoos-osm', 'zoos-osm-per', 'aquariums-osm', 'aquariums-osm-per']],
  // 2026-11-08（製作手冊第二十七批 645）觀景點與公共藝術
  [{ zh: '看風景與公共空間', en: 'Views and public spaces' }, ['viewpoints-per', 'viewpoints', 'artworks-osm-per', 'artworks-osm', 'taiwan-public-art', 'urban-parks-per', 'urban-parks']],
  // 2026-11-08（製作手冊第二十七批 646）OSM 的購物中心與百貨公司
  [{ zh: '購物中心與百貨公司', en: 'Malls and department stores' }, ['malls-osm-per', 'malls-osm', 'department-stores-per', 'department-stores']],
  [{ zh: '人造的地標', en: 'Built landmarks' }, ['landmarks']],
  [{ zh: '世界的紀錄與榮銜', en: 'World lists and titles' }, ['world-wonders', 'creative', 'expos', 'capitals-of-culture', 'heritage-label']],
];

const attractionsBase: TopicDefinition = {
  id: 'attractions',
  title: { zh: '景點地圖', en: 'Attractions' },
  shortTitle: { zh: '景點地圖', en: 'Attractions' },
  defaultIndicator: 'attractions',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Wikidata（博物館、動物園、水族館、樂園、雲霄飛車的類別、位置、名稱與維基百科條目數）', en: 'Wikidata (types, locations, names and Wikipedia article counts)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'Wikidata（植物園、樹木園的位置、設立年份、名稱）', en: 'Wikidata (botanical gardens and arboreta: locations, founding years, names)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: '文化部「博物館」開放資料（台灣）', en: 'Taiwan Ministry of Culture museum open data' },
      url: 'https://data.gov.tw/dataset/6242',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    ...attractionsExtra.sources,
    ...attractionsVisitors.sources,
    // 2026-11-08（製作手冊第二十七批 645–647）
    {
      name: {
        zh: 'OpenStreetMap（tourism=viewpoint、artwork、attraction，amenity=planetarium，shop=mall、department_store，leisure=park，經 QLever 查詢）',
        en: 'OpenStreetMap (tourism=viewpoint, artwork and attraction, amenity=planetarium, shop=mall and department_store, leisure=park, via QLever)',
      },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    { name: { zh: '陸地面積：FAOSTAT 土地利用', en: 'Land area: FAOSTAT land use' }, url: 'https://www.fao.org/faostat/en/#data/RL', license: 'CC BY 4.0' },
    {
      name: { zh: '英文維基百科「European Capital of Culture」（revid 1381273561）、「European Heritage Label」（revid 1350786905）；座標與中文名稱用 Wikidata（CC0，經 QLever）', en: 'English Wikipedia: European Capital of Culture (revid 1381273561) and European Heritage Label (revid 1350786905); coordinates and Chinese names from Wikidata (CC0, via QLever)' },
      url: 'https://en.wikipedia.org/w/index.php?title=European_Capital_of_Culture&oldid=1381273561',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    {
      name: { zh: '經濟部產業發展署「觀光工廠名錄」（data.gov.tw 6848）；鄉鎮市區界：國土測繪中心', en: 'Industrial Development Administration (Taiwan): tourism factory register (data.gov.tw 6848); township boundaries: National Land Surveying and Mapping Center' },
      url: 'https://data.gov.tw/dataset/6848',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '文化部「查詢單一類別文化設施資料」：公共藝術（mainType=8）', en: 'Taiwan Ministry of Culture cultural facilities data: public art (mainType=8)' },
      url: 'https://data.gov.tw/dataset/10046',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh:
      '點是 Wikidata 收錄、有座標、沒有標關閉或拆除日期的博物館（含美術館、科學館、故居、紀念館等子類別）、動物園、水族館、主題樂園與遊樂園、雲霄飛車；同時是水族館與博物館的（例如海生館）算水族館，遊客中心、遺產鐵道不算博物館。Wikidata 上另有 11,690 座博物館、281 座動物園與水族館、668 座樂園與雲霄飛車沒有座標，沒畫在地圖上（2026-11-05 查）。' +
      '國家依座標判斷。縮小時只畫有名的：依有幾種語言的維基百科有條目，放大才畫全部；顏色依類型，一處屬於好幾型的依美術館、自然與科學、歷史與文化的順序取第一個。' +
      'Wikidata 的收錄各國差很多（德國、巴西、義大利大量匯入），所以不算各國的數量，只畫點。台灣用文化部的博物館開放資料補上 Wikidata 沒有的；台灣缺的動物園、水族館手工補（資料檔寫出處）。' +
      '植物園是 Wikidata 標成植物園（含樹木園、玫瑰園、藥用植物園等子類別）、有座標、沒有關閉的約 3,200 處，美國、法國、日本收錄最多；分類很雜（有些公園、單一溫室也標成植物園）。植物園保育國際（BGCI）的 GardenSearch 收錄較完整，但不准轉載，沒有用。台灣有 7 處（臺北、嘉義、福山、高峰、大坪頂、科博館植物園與原生植物展示區），Wikidata 上沒有座標的 482 處（例如仁山植物園）不畫（2026-11-05 查）。',
    en:
      'Dots are museums (including art galleries, science centres, house museums and memorials), zoos, aquariums, theme and amusement parks and roller coasters in Wikidata with coordinates and no closing or demolition date; places that are both an aquarium and a museum count as aquariums, and visitor centres and heritage railways are not counted as museums. Another 11,690 museums, 281 zoos and aquariums and 668 parks and roller coasters in Wikidata have no coordinates and are not on the map (checked 2026-11-05). ' +
      'Countries are assigned by location. Zoomed out, only well-known places are drawn, by the number of Wikipedia language editions with an article; zoom in to see all. Colours show the type; a place of several types takes the first of art, nature and science, and history and culture. ' +
      'Wikidata’s coverage differs a lot between countries (Germany, Brazil and Italy were imported in bulk), so countries are not counted, only drawn. Taiwan’s museums are supplemented from the Ministry of Culture’s open data, and missing Taiwanese zoos and aquariums were added by hand (sources in the data file). ' +
      'Botanical gardens are the roughly 3,200 places Wikidata classes as botanical gardens (including arboreta, rose gardens, physic gardens and other subclasses) with coordinates and not closed; the United States, France and Japan have the most entries. The classification is messy (some parks and single glasshouses are tagged as botanical gardens). Botanic Gardens Conservation International’s GardenSearch is more complete but may not be redistributed, so it is not used. Taiwan has 7 (Taipei, Chiayi, Fushan, Kaofeng, Dapingding, the National Museum of Natural Science garden and a native-plant display area); the 482 entries without coordinates in Wikidata (such as Renshan Botanical Garden) are not drawn (checked 2026-11-05).',
  },
  panelExtra: () => import('./panels/AttractionsPanel'),
  overlays: [
    overlay(LAYERS[0], [[0, 40], [3, 20], [5, MUSEUM_MIN_SL], [7, 0]]),
    overlay(LAYERS[1], [[0, 15], [3, 5], [5, 0]]),
    overlay(LAYERS[2], [[0, 15], [3, 5], [5, 0]]),
    overlay(LAYERS[3], [[0, 10], [3, 3], [5, 0]]),
    ...attractionsExtra.overlays,
    ...attractionsVisitors.overlays,
    VIEW_GRID,
    ART_GRID,
    TW_ART,
    ATTR_GRID,
    PLANETARIUMS,
    CAPITALS,
    LABEL_SITES,
    FACTORIES,
  ],
  listPanel: [NEAR_LIST, ...[attractionsExtra.listPanel ?? []].flat(), ...attractionsVisitors.listPanel, ZOO_FACTS, TW_ART_LIST, PLANET_LIST, CAPITALS_LIST, LABEL_LIST, FACTORY_LIST],
  indicators: [
    {
      id: 'attractions',
      label: { zh: '博物館、動物園、樂園、植物園', en: 'Museums, zoos, parks and gardens' },
      description: {
        zh: '世界的博物館、動物園與水族館、主題樂園與雲霄飛車、植物園，每一處一個點，左下角的圖層可以分開開關。縮小時只畫有名的（有幾種語言的維基百科有條目），放大才畫全部；滑過看名稱與類型，點國家看那國最有名的幾處。',
        en: 'Museums, zoos and aquariums, theme parks and roller coasters, and botanical gardens around the world, one dot each, with a layer switch for each group at bottom left. Zoomed out, only well-known places are drawn (by the number of Wikipedia language editions with an article); zoom in to see all. Hover for names and types; select a country for its best-known places.',
      },
      unit: '',
      file: 'attractions.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    ...attractionsExtra.indicators,
    ...attractionsVisitors.indicators,
    // 2026-11-08（製作手冊第二十七批 642）OSM 的動物園與水族館
    {
      id: 'zoos-osm',
      label: { zh: '各國有幾座動物園（OSM）', en: 'Zoos by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成動物園（tourism=zoo）的地方：9,330 處、163 國。德國 1,226 處最多，美國 707、荷蘭 687、俄羅斯 528、法國 430、中國 383、日本 369；台灣 53 處。包括野生動物園、小型的動物角與鳥園，跟地圖上 Wikidata 的動物園（點）是不同的來源。左邊的清單是 Wikidata 上有面積、物種數或人次的動物園（資料很少，只列不比較）。', en: 'Places tagged as zoos (tourism=zoo) in OpenStreetMap: 9,330 in 163 countries. Germany has the most (1,226), followed by the US (707), the Netherlands (687), Russia (528), France (430), China (383) and Japan (369); Taiwan has 53. They include safari parks, petting zoos and bird parks, and are a different source from the Wikidata zoos drawn as dots. The list on the left shows zoos with an area, species count or visitor figure in Wikidata (few have any, so they are listed, not compared).' },
      unit: { zh: '座', en: 'zoos' },
      file: 'zoos-osm.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} zoos` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'zoos-osm-per',
      label: { zh: '每千萬人有幾座動物園（OSM）', en: 'Zoos per 10 million people (OSM)' },
      description: { zh: 'OSM 的動物園處數 ÷ 2024 年人口，數量少所以用每千萬人，只替 OSM 覆蓋良好的 93 國上色。荷蘭每千萬人 377 處最多，拉脫維亞 224、奧地利 183；德國 145、法國 65、英國 41、日本 30、台灣 23、南韓 22、美國 20。', en: 'OSM zoos divided by 2024 population, per 10 million people because numbers are small, shown only for the 93 countries well covered by OSM. The Netherlands has the most (377), followed by Latvia (224) and Austria (183); Germany has 145, France 65, the UK 41, Japan 30, Taiwan 23, South Korea 22 and the US 20.' },
      unit: { zh: '座/千萬人', en: 'per 10 million people' },
      file: 'zoos-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 80, 160] } },
      timeless: true,
      format: (v) => tr({ zh: `每千萬人 ${fixed(v, 1)} 座`, en: `${fixed(v, 1)} per 10 million` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'aquariums-osm',
      label: { zh: '各國有幾座水族館（OSM）', en: 'Aquariums by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成水族館（tourism=aquarium）的地方：1,698 處、108 國。美國 200 處最多，印度 193、日本 160、中國 88、巴西 59；台灣 15 處。', en: 'Places tagged as aquariums (tourism=aquarium) in OpenStreetMap: 1,698 in 108 countries. The US has the most (200), followed by India (193), Japan (160), China (88) and Brazil (59); Taiwan has 15.' },
      unit: { zh: '座', en: 'aquariums' },
      file: 'aquariums-osm.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 200] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} aquariums` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'aquariums-osm-per',
      label: { zh: '每千萬人有幾座水族館（OSM）', en: 'Aquariums per 10 million people (OSM)' },
      description: { zh: 'OSM 的水族館處數 ÷ 2024 年人口（每千萬人），只替 OSM 覆蓋良好的 93 國上色。克羅埃西亞每千萬人 147 處最多，馬爾地夫 76；日本 12.9、法國 7.8、英國 7.1、台灣 6.5、南韓 6.4、德國 5.8、美國 5.8。', en: 'OSM aquariums divided by 2024 population (per 10 million people), shown only for the 93 countries well covered by OSM. Croatia has the most (147), followed by the Maldives (76); Japan has 12.9, France 7.8, the UK 7.1, Taiwan 6.5, South Korea 6.4, Germany 5.8 and the US 5.8.' },
      unit: { zh: '座/千萬人', en: 'per 10 million people' },
      file: 'aquariums-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] } },
      timeless: true,
      format: (v) => tr({ zh: `每千萬人 ${fixed(v, 1)} 座`, en: `${fixed(v, 1)} per 10 million` }),
      formatTick: (v) => fixed(v, 0),
    },
    // 2026-11-08（製作手冊第二十七批 645）觀景點與公共藝術
    {
      id: 'viewpoints-per',
      label: { zh: '每千平方公里有幾處觀景點（OSM）', en: 'Viewpoints per 1,000 km² (OSM)' },
      description: { zh: 'OpenStreetMap 上標成觀景點（tourism=viewpoint）的處數 ÷ 陸地面積（FAOSTAT），只替 OSM 覆蓋良好、陸地 1,000 平方公里以上的 87 國上色。盧森堡每千平方公里 160 處最多，瑞士 113、德國 90、斯洛伐克 83、捷克 69，台灣 66 排第六；義大利 52、法國 37、南韓 25、英國 21、日本 20、美國 2.4。各國標觀景點的門檻不同（德國連林間空地都標），密度也在量 OSM 畫得多完整。地圖上的點是約 10 公里的網格，一格一個點。', en: 'Places tagged as viewpoints (tourism=viewpoint) in OpenStreetMap divided by land area (FAOSTAT), shown only for the 87 countries well covered by OSM with at least 1,000 km² of land. Luxembourg has the most per 1,000 km² (160), followed by Switzerland (113), Germany (90), Slovakia (83) and Czechia (69), with Taiwan sixth (66); Italy has 52, France 37, South Korea 25, the UK 21, Japan 20 and the US 2.4. The threshold for tagging a viewpoint differs by country (in Germany even forest clearings are tagged), so densities also reflect how completely OSM is mapped. Dots on the map are a grid of about 10 km, one dot per cell.' },
      unit: { zh: '處／千平方公里', en: 'per 1,000 km²' },
      file: 'viewpoints-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: VP_T } },
      timeless: true,
      format: (v) => tr({ zh: `每千平方公里 ${fixed(v, v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 10 ? 1 : 0)} per 1,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'viewpoints',
      label: { zh: '各國有幾處觀景點（OSM）', en: 'Viewpoints by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成觀景點的地方：263,972 處、212 國。德國 31,386 處最多，美國 22,265、法國 19,898、義大利 15,396、西班牙 13,333、俄羅斯 9,762；台灣 2,338 處。地圖上的點是約 10 公里的網格。', en: 'Places tagged as viewpoints in OpenStreetMap: 263,972 in 212 countries. Germany has the most (31,386), followed by the US (22,265), France (19,898), Italy (15,396), Spain (13,333) and Russia (9,762); Taiwan has 2,338. Dots on the map are a grid of about 10 km.' },
      unit: { zh: '處', en: 'viewpoints' },
      file: 'viewpoints.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'artworks-osm-per',
      label: { zh: '每百萬人有幾件公共藝術（OSM）', en: 'Public artworks per million people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成公共藝術（tourism=artwork）的件數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。捷克每百萬人 1,114 件最多，冰島 1,091、挪威 905、拉脫維亞 831、丹麥 745；德國 560、法國 398、英國 232、日本 117、美國 110、台灣 94、南韓 29。OSM 的公共藝術定義很寬，含雕像、壁畫、塗鴉、裝置與噴泉；密度也在量 OSM 畫得多完整。地圖上的點是約 10 公里的網格。', en: 'Public artworks (tourism=artwork) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Czechia has the most per million people (1,114), followed by Iceland (1,091), Norway (905), Latvia (831) and Denmark (745); Germany has 560, France 398, the UK 232, Japan 117, the US 110, Taiwan 94 and South Korea 29. OSM defines public art broadly, including statues, murals, graffiti, installations and fountains, and densities also reflect how completely OSM is mapped. Dots on the map are a grid of about 10 km.' },
      unit: { zh: '件／百萬人', en: 'per million people' },
      file: 'artworks-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: AR_T } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 0)} 件`, en: `${fixed(v, 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'artworks-osm',
      label: { zh: '各國有幾件公共藝術（OSM）', en: 'Public artworks by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成公共藝術的件數：367,192 件、202 國。德國 47,327 件最多，美國 38,032、法國 26,479、義大利 17,720、英國 16,044、波蘭 15,147、日本 14,441；台灣 2,178 件（文化部的清冊另有 6,337 件，兩份是不同的清單，不相加）。', en: 'Public artworks tagged in OpenStreetMap: 367,192 in 202 countries. Germany has the most (47,327), followed by the US (38,032), France (26,479), Italy (17,720), the UK (16,044), Poland (15,147) and Japan (14,441); Taiwan has 2,178 (the Ministry of Culture’s register lists 6,337; they are separate lists and are not added together).' },
      unit: { zh: '件', en: 'artworks' },
      file: 'artworks-osm.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'taiwan-public-art',
      label: { zh: '台灣的公共藝術（文化部）', en: 'Taiwan’s public art (Ministry of Culture)' },
      description: { zh: '文化部「文化設施」開放資料裡的公共藝術 6,337 件，有座標而且在台灣範圍的 6,171 件畫成點，拖時間軸看依設置年份累積：1990 年代 92 件、2000 年代 1,687、2010 年代 3,359、2020 年起 1,033。臺北市 992 件最多，高雄市 750、臺中市 716、新北市 668、臺南市 456。同一棟建築的作品常共用一個座標，地圖上排成一小圈。作者是個人姓名，不列出；這份跟 OSM 的公共藝術是不同的清單，不相加。', en: 'The 6,337 public artworks in Taiwan’s Ministry of Culture open data on cultural facilities; the 6,171 with coordinates within Taiwan are drawn as dots. Drag the time slider to see them accumulate by year of installation: 92 in the 1990s, 1,687 in the 2000s, 3,359 in the 2010s and 1,033 since 2020. Taipei has the most (992), followed by Kaohsiung (750), Taichung (716), New Taipei (668) and Tainan (456). Works at the same building often share one coordinate and are arranged in a small ring on the map. Artists are individuals and are not listed; this is a separate list from OSM’s public art and the two are not added together.' },
      unit: '',
      file: 'public-art-years.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false as const,
      panelChart: false as const,
      format: () => '',
      defaultYear: 2026,
      focus: [119.2, 21.8, 122.2, 25.4],
      missing: { zh: '國家不上色，只有台灣的公共藝術', en: 'Countries are not coloured; Taiwan’s public art only' },
    },
    // 2026-11-08（製作手冊第二十七批 646）天文館、OSM 的觀光景點、購物中心與百貨公司
    {
      id: 'planetariums',
      label: { zh: '各國有幾座天文館（OSM）', en: 'Planetariums by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成天文館（amenity=planetarium）的地方：948 處、78 國。美國 201 處最多，德國 61、日本 55、俄羅斯 54、義大利 51、巴西 48、法國 43、印度 40、中國 31；台灣 8 處（臺北市立天文科學教育館、科博館墾丁天文台，也有幾所學校的天文臺）。這是給一般人看星星的天文館與星象館，不是「大型科學設施」裡研究用的天文台；數量少，只畫點與處數，左邊列出有名稱的。', en: 'Places tagged as planetariums (amenity=planetarium) in OpenStreetMap: 948 in 78 countries. The US has the most (201), followed by Germany (61), Japan (55), Russia (54), Italy (51), Brazil (48), France (43), India (40) and China (31); Taiwan has 8 (the Taipei Astronomical Museum, the National Museum of Natural Science’s Kenting observatory and a few school observatories). These are planetariums and public observatories for stargazing, not the research observatories in the science facilities topic; numbers are small, so only dots and counts are shown, and named ones are listed on the left.' },
      unit: { zh: '座', en: 'planetariums' },
      file: 'planetarium-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 200] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'osm-attractions-per',
      label: { zh: '每千平方公里有幾處觀光景點（OSM）', en: 'Attractions per 1,000 km² (OSM)' },
      description: { zh: 'OpenStreetMap 上標成觀光景點（tourism=attraction）的處數 ÷ 陸地面積（FAOSTAT），只替覆蓋良好、陸地 1,000 平方公里以上的 87 國上色。台灣每千平方公里 84 處最多，荷蘭 76、德國 69、模里西斯 65、盧森堡 51；義大利 30、英國 25、日本 23、法國 22、南韓 17、美國 2.0。這個標籤是 OSM 社群自己認定「值得一看」的地方，定義很寬，不是官方認定的景點；密度也在量各地畫得多勤。地圖上是約 10 公里的網格。', en: 'Places tagged as tourist attractions (tourism=attraction) in OpenStreetMap divided by land area (FAOSTAT), shown only for the 87 countries well covered by OSM with at least 1,000 km² of land. Taiwan has the most per 1,000 km² (84), followed by the Netherlands (76), Germany (69), Mauritius (65) and Luxembourg (51); Italy has 30, the UK 25, Japan 23, France 22, South Korea 17 and the US 2.0. The tag marks what OSM mappers consider worth seeing, is broadly defined and is not an official designation, so densities also reflect how actively places are mapped. The map shows a grid of about 10 km.' },
      unit: { zh: '處／千平方公里', en: 'per 1,000 km²' },
      file: 'osm-attractions-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: AT_T } },
      timeless: true,
      format: (v) => tr({ zh: `每千平方公里 ${fixed(v, v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 10 ? 1 : 0)} per 1,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'osm-attractions',
      label: { zh: '各國有幾處觀光景點（OSM）', en: 'Attractions by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成觀光景點的地方：254,964 處、215 國。德國 24,034 處最多，美國 18,606、俄羅斯 18,238、中國 15,637、法國 11,727、波蘭 10,545；台灣 2,966 處。地圖上是約 10 公里的網格。', en: 'Places tagged as tourist attractions in OpenStreetMap: 254,964 in 215 countries. Germany has the most (24,034), followed by the US (18,606), Russia (18,238), China (15,637), France (11,727) and Poland (10,545); Taiwan has 2,966. The map shows a grid of about 10 km.' },
      unit: { zh: '處', en: 'attractions' },
      file: 'osm-attractions.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'malls-osm-per',
      label: { zh: '每百萬人有幾家購物中心（OSM）', en: 'Malls per million people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成購物中心（shop=mall）的家數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。巴貝多每百萬人 198 家最多，哥斯大黎加 125、聖露西亞 111、挪威 83、愛沙尼亞 76、俄羅斯 73；義大利 31、法國 23、德國 21、日本 21、美國 15、英國 12、台灣 9.7、南韓 5.8。各國把什麼標成購物中心的門檻不一。「人造的地標」裡的購物中心點是世界最大的幾座，跟這裡不同。', en: 'Places tagged as shopping malls (shop=mall) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Barbados has the most per million people (198), followed by Costa Rica (125), Saint Lucia (111), Norway (83), Estonia (76) and Russia (73); Italy has 31, France 23, Germany 21, Japan 21, the US 15, the UK 12, Taiwan 9.7 and South Korea 5.8. What counts as a mall varies by country. The mall dots under Built landmarks are the world’s largest few, a different list.' },
      unit: { zh: '家／百萬人', en: 'per million people' },
      file: 'malls-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: ML_T } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, v < 10 ? 1 : 0)} 家`, en: `${fixed(v, v < 10 ? 1 : 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'malls-osm',
      label: { zh: '各國有幾家購物中心（OSM）', en: 'Malls by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成購物中心的地方：78,703 處、198 國。俄羅斯 10,505 處最多，中國 6,965、美國 5,204、巴西 4,232、日本 2,541、印度 2,418；台灣 225 處。', en: 'Places tagged as shopping malls in OpenStreetMap: 78,703 in 198 countries. Russia has the most (10,505), followed by China (6,965), the US (5,204), Brazil (4,232), Japan (2,541) and India (2,418); Taiwan has 225.' },
      unit: { zh: '家', en: 'malls' },
      file: 'malls-osm.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'department-stores-per',
      label: { zh: '每百萬人有幾家百貨公司（OSM）', en: 'Department stores per million people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成百貨公司（shop=department_store）的家數 ÷ 2024 年人口，只替覆蓋良好的 93 國上色。蓋亞那每百萬人 91 家最多，汶萊 76、聖露西亞 67、蘇利南 50、紐西蘭 50；美國 35、德國 21、英國 16、義大利 12、南韓 6.3、台灣 5.9、日本 4.7、法國 4.5。', en: 'Places tagged as department stores (shop=department_store) in OpenStreetMap divided by 2024 population, shown only for the 93 well-covered countries. Guyana has the most per million people (91), followed by Brunei (76), Saint Lucia (67), Suriname (50) and New Zealand (50); the US has 35, Germany 21, the UK 16, Italy 12, South Korea 6.3, Taiwan 5.9, Japan 4.7 and France 4.5.' },
      unit: { zh: '家／百萬人', en: 'per million people' },
      file: 'department-stores-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: DS_T } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, v < 10 ? 1 : 0)} 家`, en: `${fixed(v, v < 10 ? 1 : 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'department-stores',
      label: { zh: '各國有幾家百貨公司（OSM）', en: 'Department stores by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成百貨公司的地方：52,492 處、199 國。美國 12,240 處最多，俄羅斯 3,333、巴西 2,448、墨西哥 2,057、德國 1,766、加拿大 1,605；台灣 136 處。', en: 'Places tagged as department stores in OpenStreetMap: 52,492 in 199 countries. The US has the most (12,240), followed by Russia (3,333), Brazil (2,448), Mexico (2,057), Germany (1,766) and Canada (1,605); Taiwan has 136.' },
      unit: { zh: '家', en: 'department stores' },
      file: 'department-stores.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    // 2026-11-08（製作手冊第二十七批 647）都市公園
    {
      id: 'urban-parks-per',
      label: { zh: '每十萬人有幾座公園（OSM）', en: 'Parks per 100,000 people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成公園（leisure=park）的處數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。芬蘭每十萬人 206 座最多，澳洲 190、紐西蘭 190、以色列 179、西班牙 116、加拿大 111；日本 79、法國 58、德國 56、美國 55、英國 52、台灣 37、南韓 35。leisure=park 從國家公園的一部分、城市公園到社區的小綠地都有，大小差好幾個量級，只算座數會誤導。', en: 'Places tagged as parks (leisure=park) in OpenStreetMap divided by 2024 population, shown only for the 93 countries well covered by OSM. Finland has the most per 100,000 people (206), followed by Australia (190), New Zealand (190), Israel (179), Spain (116) and Canada (111); Japan has 79, France 58, Germany 56, the US 55, the UK 52, Taiwan 37 and South Korea 35. The tag covers everything from parts of national parks and city parks to small neighbourhood greens, differing in size by orders of magnitude, so counts alone can mislead.' },
      unit: { zh: '座／十萬人', en: 'per 100,000 people' },
      file: 'urban-parks-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: PK_T } },
      timeless: true,
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, v < 10 ? 1 : 0)} 座`, en: `${fixed(v, v < 10 ? 1 : 0)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'urban-parks',
      label: { zh: '各國有幾座公園（OSM）', en: 'Parks by country (OSM)' },
      description: { zh: 'OpenStreetMap 上標成公園的地方：1,299,675 處、214 國。美國 189,680 處最多，日本 98,253、巴西 93,031、中國 58,143、西班牙 55,793、澳洲 50,791；台灣 8,568 處。點太多，不畫。', en: 'Places tagged as parks in OpenStreetMap: 1,299,675 in 214 countries. The US has the most (189,680), followed by Japan (98,253), Brazil (93,031), China (58,143), Spain (55,793) and Australia (50,791); Taiwan has 8,568. There are too many to draw as dots.' },
      unit: { zh: '座', en: 'parks' },
      file: 'urban-parks.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    // 2026-11-08（製作手冊第二十七批 648）歐洲文化之都、歐洲遺產標章
    {
      id: 'capitals-of-culture',
      label: { zh: '歐洲文化之都', en: 'European Capitals of Culture' },
      description: {
        zh: '英文維基「European Capital of Culture」的名單（固定版本）：1985 年雅典是第一個（當時叫「歐洲文化城市」），到 2026 年共 76 個城市、32 國，連已決定的到 2031 年共 87 個。國家的值是當過幾次（累計）：到 2026 年義大利 5 次最多，希臘、德國、法國、西班牙、比利時各 4 次。2000 年有 9 個城市同時當選；1988 年的西柏林算德國；2025 年新戈里察與哥里加是斯洛維尼亞與義大利跨國合辦。拖時間軸看依年份出現。台灣與歐洲以外沒有。',
        en: 'English Wikipedia’s list of European Capitals of Culture (a fixed revision): Athens was the first in 1985 (then called European City of Culture); by 2026 there have been 76 cities in 32 countries, and 87 including those designated up to 2031. A country’s value is how many times it has held the title (cumulative): by 2026 Italy leads with 5, followed by Greece, Germany, France, Spain and Belgium with 4 each. Nine cities shared the title in 2000; West Berlin (1988) counts as Germany; in 2025 Nova Gorica and Gorizia shared it across Slovenia and Italy. Drag the time slider to see them appear by year. Taiwan and countries outside Europe have none.',
      },
      unit: { zh: '次', en: 'times' },
      file: 'capitals-of-culture-count.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 5] },
      overlayTime: 'cumulative',
      format: (v) => tr({ zh: `${fixed(v, 0)} 次`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'time' : 'times'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: false,
      missing: { zh: '只有歐洲的城市', en: 'European cities only' },
    },
    {
      id: 'heritage-label',
      label: { zh: '歐洲遺產標章', en: 'European Heritage Label' },
      description: {
        zh: '歐盟的歐洲遺產標章：英文維基條目（固定版本）依國家列出 60 處、21 國，44 處對得到座標畫成點（其餘是條約、文獻、跨國站點，或條目沒有座標）。波蘭 6 處最多，比利時、法國、荷蘭各 5 處。名單沒有獲得年份，跨國站點（例如 Colonies of Benevolence、Werkbund Estates）在每一國各算一處，所以國家不上色，滑過國家看處數。',
        en: 'The EU’s European Heritage Label: English Wikipedia’s article (a fixed revision) lists 60 sites in 21 countries by country, and the 44 that can be located are drawn (the rest are treaties, documents, transnational sites or articles without coordinates). Poland has the most (6), followed by Belgium, France and the Netherlands with 5 each. The list has no award years, and transnational sites (such as the Colonies of Benevolence and the Werkbund Estates) count once in each country, so countries are not coloured; hover over one to see its count.',
      },
      unit: '',
      file: 'heritage-label-count.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false as const,
      panelChart: false as const,
      timeless: true,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    // 2026-11-08（製作手冊第二十七批 650）台灣的觀光工廠
    {
      id: 'tw-factories',
      label: { zh: '台灣的觀光工廠', en: 'Taiwan’s tourism factories' },
      description: {
        zh: '經濟部產業發展署「觀光工廠名錄」158 家：中部 55、南部 44、北部 39、東部 20；桃園市、臺南市各 22 家最多，宜蘭縣 16、彰化縣 15、新北市與南投縣各 13。名錄沒有經緯度：46 家用名稱對到 OpenStreetMap 的地點，其餘 112 家畫在地址所在鄉鎮市區的中心（另一個顏色），只看得出大概在哪一區。左邊依縣市列出，連到工廠的網站。',
        en: 'The 158 tourism factories in the Industrial Development Administration’s register: 55 in central Taiwan, 44 in the south, 39 in the north and 20 in the east; Taoyuan and Tainan have the most (22 each), followed by Yilan (16), Changhua (15), and New Taipei and Nantou (13 each). The register has no coordinates: 46 were matched by name to OpenStreetMap, and the other 112 are drawn at the centre of their township (in another colour), so only the district is reliable. The list on the left groups them by county and links to each factory’s website.',
      },
      unit: '',
      file: 'tw-factories-map.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false as const,
      panelChart: false as const,
      timeless: true,
      format: () => '',
      focus: [119.3, 21.8, 122.1, 25.4],
      missing: { zh: '國家不上色，只有台灣的觀光工廠', en: 'Countries are not coloured; Taiwan’s tourism factories only' },
    },
  ],
};

export const attractions: TopicDefinition = withMenuGroups(attractionsBase, MENU_GROUPS);
