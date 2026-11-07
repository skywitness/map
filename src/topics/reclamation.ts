import { SINICA_SOURCE, sinicaLayer } from './sinica';
import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 填海造陸（pipeline/topics/reclamation.py）：Sengupta et al. 2023 人口百萬以上的 135 個沿海城市 2000–2020 年的填海面積。
 * 使用者 2026-10-30 決定：照候選清單畫城市的比例圓，台中、新加坡的國家欄修正（香港也一起）。
 */

const locale = () => (getLang() === 'zh' ? 'zh-TW' : 'en-US');
const n0 = (v: number) => Math.round(v).toLocaleString(locale());

/** 公頃：1 萬公頃以上加寫平方公里 */
export function hectares(v: number): string {
  const ha = v < 10 ? fixed(v, 1) : n0(v);
  const km2 = v >= 1000 ? tr({ zh: `（${n0(v / 100)} 平方公里）`, en: ` (${n0(v / 100)} km²)` }) : '';
  return tr({ zh: `${ha} 公頃${km2}`, en: `${ha} ha${km2}` });
}

export function cityName(p: PointRecord): string {
  if (getLang() === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.name ?? '');
}

/** 「34,978 公頃（±3.67）」；可忽略、沒有資料另外寫 */
export function cityArea(p: PointRecord): string {
  if (p.n === 1) return tr({ zh: '填海可忽略', en: 'Negligible reclamation' });
  if (typeof p.a !== 'number') return tr({ zh: '沒有資料', en: 'No data' });
  const err = typeof p.e === 'number' ? ` (±${fixed(p.e, p.e < 10 ? 2 : 1)})` : '';
  return `${hectares(p.a)}${err}`;
}

/**
 * 2026-11-07（製作手冊第二十七批 545，候選 1232）：Wikidata 有名字的人工島（pipeline/topics/artificial_islands.py）。
 * c：1 克蘭諾格、2 人工島機場，其他依建成年份 3 1900 年以前、4 1900–1999、5 2000 年以後、6 不知道
 */
const ISLAND_CLASSES = [
  { color: MAP_TOKENS.categorical[3], label: { zh: '克蘭諾格（史前到中世紀的湖上人工島）', en: 'Crannogs (prehistoric to medieval lake islands)' } },
  { color: MAP_TOKENS.categorical[1], label: { zh: '人工島機場', en: 'Airport islands' } },
  { color: MAP_TOKENS.categorical[2], label: { zh: '1900 年以前建成', en: 'Built before 1900' } },
  { color: MAP_TOKENS.categorical[5], label: { zh: '1900–1999 年建成', en: 'Built 1900–1999' } },
  { color: MAP_TOKENS.categorical[7], label: { zh: '2000 年以後建成', en: 'Built 2000 or later' } },
  { color: MAP_TOKENS.inkMuted, label: { zh: 'Wikidata 沒寫建成年份', en: 'Year not given in Wikidata' } },
];
const islandName = (p: PointRecord) => String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? '');
const ISLANDS: PointsOverlayDef = {
  kind: 'points',
  id: 'islands',
  file: 'islands.json',
  label: { zh: '有名字的人工島（Wikidata）', en: 'Named artificial islands (Wikidata)' },
  radius: { field: 'sl', stops: [[0, 3], [10, 4.5], [40, 7]] },
  color: { field: 'c', title: { zh: '人工島', en: 'Artificial island' }, thresholds: [2, 3, 4, 5, 6], classes: ISLAND_CLASSES },
  sortField: 'sl',
  indicators: ['islands-count'],
  tooltip: (p, ctx) => {
    const title = islandName(p);
    const kind = tr(ISLAND_CLASSES[Number(p.c) - 1]?.label ?? { zh: '', en: '' });
    const built = typeof p.y === 'number' ? tr({ zh: `${p.y} 年建成`, en: `built ${p.y}` }) : null;
    return {
      title,
      detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, Number(p.c) <= 2 ? kind : built].filter(Boolean).join(' · '),
      extra: Number(p.c) <= 2 && built ? [built] : undefined,
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== title ? p.en : undefined,
    };
  },
};

export const reclamation: TopicDefinition = {
  id: 'reclamation',
  title: { zh: '填海造陸', en: 'Coastal land reclamation' },
  shortTitle: { zh: '填海造陸', en: 'Reclamation' },
  defaultIndicator: 'map',
  defaultYear: 2020,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Sengupta et al. 2023，Mapping 21st Century global coastal land reclamation（Earth’s Future 11(2)；Zenodo 資料）',
        en: 'Sengupta et al. 2023, Mapping 21st Century global coastal land reclamation (Earth’s Future 11(2); data on Zenodo)',
      },
      url: 'https://doi.org/10.5281/zenodo.7528236',
      license: 'CC BY 4.0',
    },
    SINICA_SOURCE,
    {
      name: { zh: 'Wikidata 的人工島（Q13691 與子類別），經 QLever', en: 'Wikidata artificial islands (Q13691 and subclasses), via QLever' },
      url: 'https://www.wikidata.org/wiki/Q13691',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '資料是 Sengupta 等人 2023 年發表在 Earth’s Future 的研究：用 Landsat 衛星影像比對 2000 與 2020 年，算出人口百萬以上的 135 個沿海城市在這 20 年間填海多出來的陸地（公頃，括號是誤差），合計 253,734 公頃（約 2,537 平方公里），其中 106 個城市有填海，前 10 名都在中國大陸。只算人口百萬以上的城市，小城市、港口與工業區（例如台灣的彰濱、雲林離島工業區）不在裡面；2000 年以前的填海（例如香港、新加坡、東京灣大部分的填海地）也不算。作者說之後會公布填海範圍的圖層，目前只有城市的點。原始檔有幾處修正：台中那一列的國家欄寫「China」（城市欄是「Taichung . Taiwan」）、新加坡的國家欄空白、香港寫「China SAR」，這裡分別改成台灣、新加坡、香港；Kochi、Thiruvananthapuram、Port-au-Prince 的經緯度寫反了，對調；填海可忽略的城市沒有座標，用 Natural Earth 的城市位置。另一個附檔（填海地上的土地用途）是從 OpenStreetMap 取的點，沒有用。「有名字的人工島」是 Wikidata 收錄、有座標的人工島與它的子類別（克蘭諾格、人工島機場、海堡、能源島等），回到幾百年前，跟上面 2000–2020 年的填海面積是不同的東西；Wikidata 志願者收得多不多跟各國有沒有人整理有關，有座標的 401 個裡只有 62 個寫了建成年份。',
    en:
      'The data come from Sengupta et al. (2023) in Earth’s Future, who compared Landsat images from 2000 and 2020 to measure the land reclaimed from the sea over those 20 years in 135 coastal cities of over a million people (hectares, with the error in brackets): 253,734 ha in all (about 2,537 km²), in 106 of the cities, with the top 10 all in mainland China. Only cities of a million or more are covered, so smaller cities, ports and industrial zones (such as Taiwan’s Changhua and Yunlin offshore industrial parks) are not included, nor is reclamation before 2000 (most of the reclaimed land in Hong Kong, Singapore and Tokyo Bay). The authors plan to publish the reclaimed areas as a map layer; for now there are only city points. A few fixes were made to the original file: the Taichung row lists “China” as its country (with “Taichung . Taiwan” as the city), Singapore has no country and Hong Kong is “China SAR”, changed here to Taiwan, Singapore and Hong Kong; the latitude and longitude of Kochi, Thiruvananthapuram and Port-au-Prince were swapped and are corrected; cities with negligible reclamation have no coordinates and are placed with Natural Earth city locations. A second file (land use on reclaimed land) consists of points taken from OpenStreetMap and is not used. “Named artificial islands” are the artificial islands with coordinates in Wikidata, including subclasses such as crannogs, airport islands, sea forts and energy islands, going back centuries; they are separate from the 2000–2020 reclamation above. Coverage depends on what Wikidata volunteers have catalogued, and only 62 of the 401 with coordinates give a construction year.',
  },
  panelExtra: () => import('./panels/ReclamationPanel'),
  // 2026-11-03（製作手冊第十七批 280）：放大到台灣時可以疊中研院的舊地圖、舊航照（預設關閉），看 2000 年以前的西海岸
  overlays: [
    ISLANDS,
    { ...ISLANDS, id: 'islands-map', hidden: true, indicators: ['map'], shareable: false },
    sinicaLayer('sinica-1904', 'JM20K_1904', 'jpg', { zh: '1904 年日治臺灣堡圖（1:20,000，中研院）', en: '1904 Taiwan Fort Maps (1:20,000, Academia Sinica)' }, {
      maxzoom: 17,
      note: { zh: '放大到台灣才看得到；跟今天的海岸線對照', en: 'Visible when zoomed in on Taiwan; compare with today’s coastline' },
    }),
    sinicaLayer('sinica-1944', 'AM25K_1944B', 'png', { zh: '1944 年美軍航照（1:25,000，中研院）', en: '1944 US Army aerial photos (1:25,000, Academia Sinica)' }, {
      maxzoom: 15,
      bounds: [119.38, 21.83, 122.01, 25.33],
      note: { zh: '放大到台灣才看得到', en: 'Visible when zoomed in on Taiwan' },
    }),
    sinicaLayer('sinica-1962', 'TM5K_1962', 'png', { zh: '1962 年西海岸海埔地地形圖（中研院）', en: '1962 west-coast tidal flat maps (Academia Sinica)' }, {
      maxzoom: 17,
      bounds: [119.98, 23.1, 120.19, 23.65],
      note: { zh: '只有嘉義、臺南沿海', en: 'Chiayi and Tainan coast only' },
    }),
    sinicaLayer('sinica-1966', 'Taiwan_Corona_1966', 'png', { zh: '1966 年 Corona 衛星影像（中研院）', en: '1966 Corona satellite images (Academia Sinica)' }, {
      maxzoom: 15,
      bounds: [119.25, 23.23, 122.32, 25.47],
      note: { zh: '中北部；放大到台灣才看得到', en: 'Central and northern Taiwan; visible when zoomed in' },
    }),
    {
      kind: 'points',
      id: 'cities',
      file: 'cities.json',
      label: { zh: '沿海城市（2000–2020 年的填海）', en: 'Coastal cities (reclamation 2000–2020)' },
      // 面積與填海面積成正比（半徑依平方根）；可忽略的是小點
      radius: { field: 'a', stops: [[0, 1.8], [100, 3], [1000, 6], [5000, 11], [35000, 26]] },
      color: {
        field: 'a',
        title: { zh: '填海面積', en: 'Area reclaimed' },
        thresholds: [1, 1000],
        classes: [
          { color: MAP_TOKENS.inkMuted, label: { zh: '可忽略', en: 'Negligible' } },
          { color: MAP_TOKENS.categorical[2], label: { zh: '1,000 公頃以下', en: 'Under 1,000 ha' } },
          { color: MAP_TOKENS.categorical[5], label: { zh: '1,000 公頃以上', en: '1,000 ha or more' } },
        ],
      },
      sortField: 'a',
      // 國家的比例圓（填海面積、城市數）跟城市的點重疊，只在城市地圖畫
      indicators: ['map'],
      sizeLegend: { title: { zh: '填海面積', en: 'Area reclaimed' }, values: [100, 1000, 10000], format: (v) => tr({ zh: `${n0(v)} 公頃`, en: `${n0(v)} ha` }) },
      tooltip: (p, ctx) => {
        const name = cityName(p);
        return {
          title: name,
          detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, cityArea(p)].filter(Boolean).join(' · '),
          properNoun: getLang() === 'zh' && typeof p.name === 'string' && p.name !== name ? p.name : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '填海的城市', en: 'Reclaiming cities' },
      description: {
        zh: '2000 到 2020 年，人口百萬以上的 135 個沿海城市填海多出來的陸地（Landsat 衛星影像）：圓的面積與填海面積成正比，灰色小點是填海可忽略的城市。上海、天津、寧波、唐山各填了將近 3 萬公頃（300 平方公里以上），前 10 名都在中國大陸；台灣的高雄 498、台北 343、台中 294 公頃。國家不上色，滑到國家上看它的城市合計。',
        en: 'Land reclaimed from the sea between 2000 and 2020 by 135 coastal cities of over a million people (from Landsat imagery): circle area is proportional to the land reclaimed, and small grey dots had negligible reclamation. Shanghai, Tianjin, Ningbo and Tangshan each added close to 30,000 ha (over 300 km²), and the top 10 are all in mainland China; in Taiwan, Kaohsiung added 498 ha, Taipei 343 and Taichung 294. Countries are not coloured; hover over one for its cities’ total.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'area.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `城市合計 ${hectares(v)}`, en: `Cities’ total: ${hectares(v)}` }),
      missing: { zh: '沒有百萬人口以上的沿海城市在研究裡', en: 'No coastal city of over a million people in the study' },
    },
    {
      id: 'area',
      label: { zh: '填海面積（2000–2020）', en: 'Land reclaimed (2000–2020)' },
      description: {
        zh: '2000 到 2020 年，這個國家人口百萬以上的沿海城市填海多出來的陸地合計（公頃，比例圓；100 公頃是 1 平方公里）。只算 135 個百萬人口以上的沿海城市，看各城市換到「填海的城市」。',
        en: 'Total land reclaimed from the sea between 2000 and 2020 by the country’s coastal cities of over a million people (hectares, proportional circles; 100 ha is 1 km²). Only 135 coastal cities of a million or more are covered; see “Reclaiming cities” for the individual cities.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'area.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: hectares,
      formatTick: n0,
      shareOfWorld: true,
    },
    {
      id: 'islands-count',
      label: { zh: '有名字的人工島', en: 'Named artificial islands' },
      description: {
        zh: 'Wikidata 收錄、有座標的人工島 401 個（比例圓是各國有幾個，點依種類與建成年代上色）：英國 66（62 個是克蘭諾格，史前到中世紀在湖裡堆出來住人的小島）、日本 63（關西、中部、神戶、長崎等 5 座機場島，長崎的出島 1636 年建成）、荷蘭 55、索羅門群島 49（馬萊塔島沿岸潟湖裡用珊瑚石堆成的傳統聚落，跟杜拜的棕櫚島是完全不同的東西）、美國 33、阿聯 12（杜拜的棕櫚島與世界群島）、中國大陸 12、法國 11、丹麥 10。最早寫了年份的是日本鎌倉的和賀江島（1232 年）。台灣沒有收錄。',
        en: 'The 401 artificial islands with coordinates in Wikidata (circles count them by country; dots are coloured by kind and construction date): the UK 66 (62 of them crannogs, small islands built in lakes for living on from prehistoric to medieval times), Japan 63 (including five airport islands such as Kansai, Chubu, Kobe and Nagasaki, and Dejima in Nagasaki, built in 1636), the Netherlands 55, the Solomon Islands 49 (traditional settlements built of coral stone in the lagoons off Malaita, nothing like Dubai’s Palm islands), the US 33, the UAE 12 (Dubai’s Palm and World islands), mainland China 12, France 11 and Denmark 10. The oldest with a recorded date is Wakae Island at Kamakura, Japan (1232). Taiwan has none in Wikidata.',
      },
      unit: { zh: '個', en: '' },
      file: 'islands-count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      integer: true,
      format: (v) => tr({ zh: `${n0(v)} 個`, en: n0(v) }),
      formatTick: n0,
      missing: { zh: 'Wikidata 沒有收錄這裡的人工島', en: 'No artificial islands recorded here in Wikidata' },
    },
    {
      id: 'cities-count',
      label: { zh: '有填海的城市數', en: 'Cities with reclamation' },
      description: {
        zh: '這個國家人口百萬以上的沿海城市裡，2000–2020 年有填海的城市數（研究涵蓋的 135 個城市）。',
        en: 'How many of the country’s coastal cities of over a million people reclaimed land in 2000–2020 (of the 135 cities studied).',
      },
      unit: { zh: '個', en: 'cities' },
      file: 'cities-count.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      integer: true,
      format: (v) => tr({ zh: `${n0(v)} 個城市`, en: `${n0(v)} ${Math.round(v) === 1 ? 'city' : 'cities'}` }),
      formatTick: n0,
    },
  ],
};
