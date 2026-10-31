import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 景點地圖的擴充（2026-10-31，製作手冊第十批 182；pipeline/topics/attractions_extra.py，DESIGN.md 第 8 節第 264 點）：
 * 博物館與主題樂園的人次、摩天輪、購物中心、世界奇觀、UNESCO 創意城市、世界博覽會。
 */

const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function names(p: PointRecord): { title: string; proper?: string } {
  const zh = str(p.zh);
  const en = str(p.en);
  if (getLang() === 'zh') return { title: zh ?? en ?? '', proper: zh && en && zh !== en ? en : undefined };
  return { title: en ?? zh ?? '', proper: en ? undefined : zh ?? undefined };
}

const visitorsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const country = (p: PointRecord, countryName: (iso3: string) => string) => (typeof p.iso3 === 'string' ? countryName(p.iso3) : null);
const PARK_YEARS = Array.from({ length: 16 }, (_, i) => 2009 + i);

// ── 人次 ──

const MUSEUM_VISITORS: PointsOverlayDef = {
  kind: 'points',
  id: 'museum-visitors',
  file: 'museum-visitors.json',
  label: { zh: '最多人造訪的博物館（一年人次）', en: 'Most-visited museums (visitors a year)' },
  indicators: ['visitors'],
  radius: { field: 'v', stops: [[1.25e6, 3], [3e6, 5], [6e6, 8], [9e6, 10]] },
  color: C[7],
  sortField: 'v',
  sizeLegend: { title: { zh: '一年的人次', en: 'Visitors a year' }, values: [2e6, 5e6, 9e6], format: visitorsText },
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    const extra = [tr({ zh: `${p.vy} 年 ${visitorsText(Number(p.v))}`, en: `${visitorsText(Number(p.v))} in ${p.vy}` })];
    if (typeof p.tw === 'number' && p.src !== 2) extra.push(tr({ zh: `觀光署 2024 年 ${visitorsText(p.tw)}`, en: `Tourism Administration 2024: ${visitorsText(p.tw)}` }));
    if (p.src === 2) extra.push(tr({ zh: '觀光署的數字（英文維基的表沒有）', en: 'Tourism Administration figure (not in the Wikipedia list)' }));
    return { title, detail: [tr({ zh: '博物館', en: 'Museum' }), country(p, countryName)].filter(Boolean).join(' · '), extra, properNoun: proper };
  },
};

const PARK_VISITORS: PointsOverlayDef = {
  kind: 'points',
  id: 'park-visitors',
  file: 'park-visitors.json',
  label: { zh: '最多人造訪的主題樂園（一年人次）', en: 'Most-visited theme parks (visitors a year)' },
  indicators: ['visitors'],
  epochs: { years: PARK_YEARS, values: (p, y) => ({ vv: typeof p[`v${y}`] === 'number' ? (p[`v${y}`] as number) : null }) },
  radius: { field: 'vv', stops: [[1e6, 3], [4e6, 5.5], [10e6, 8.5], [18e6, 11]] },
  color: { field: 'src', title: { zh: '來源', en: 'Source' }, thresholds: [1.5], classes: [
    { color: C[5], label: { zh: '英文維基（TEA／AECOM 的數字）', en: 'English Wikipedia (TEA/AECOM figures)' } },
    { color: C[0], label: { zh: '台灣（觀光署）', en: 'Taiwan (Tourism Administration)' } },
  ] },
  minValue: { field: 'vv', stops: [[0, 0]] },
  sortField: 'vv',
  tooltip: (p, { countryName, year }) => {
    const { title, proper } = names(p);
    const y = Math.max(2009, Math.min(2024, year ?? 2024));
    const v = p[`v${y}`];
    const extra = [typeof v === 'number' ? tr({ zh: `${y} 年 ${visitorsText(v)}`, en: `${visitorsText(v)} in ${y}` }) : ''];
    if (p.src === 2) extra.push(tr({ zh: `觀光署的數字${str(p.note) ? `（${p.note}）` : ''}，跟 TEA 的估計不能直接比`, en: 'Tourism Administration figure; not directly comparable with TEA estimates' }));
    return { title, detail: [tr({ zh: '主題樂園', en: 'Theme park' }), country(p, countryName)].filter(Boolean).join(' · '), extra: extra.filter(Boolean), properNoun: proper };
  },
};

/**
 * 最多人造訪的博物館、主題樂園（第十二批 201）：「博物館與樂園的人次」指標的兩個清單（清單上面的分頁切換），依人次；
 * 每列：名次與名稱、國家、人次與資料年份（主題樂園跟時間軸的年份，2009–2024）。資料沒有城市欄，只寫國家
 */
const MUSEUM_LIST: ListPanelDef = {
  label: { zh: '最多人造訪的博物館', en: 'Most-visited museums' },
  tabLabel: { zh: '博物館', en: 'Museums' },
  indicators: ['visitors'],
  file: 'museum-visitors.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(b.v) - Number(a.v))
      .map((p, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${p.en ?? p.zh}-${i}`,
          title: `${i + 1}. ${title}`,
          properNoun: proper,
          lines: [
            country(p, countryName) ?? '',
            tr({ zh: `${p.vy} 年 ${visitorsText(Number(p.v))}`, en: `${visitorsText(Number(p.v))} in ${p.vy}` }) +
              (p.src === 2 ? tr({ zh: '（觀光署）', en: ' (Tourism Administration)' }) : ''),
          ].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      }),
};

const PARK_LIST: ListPanelDef = {
  label: { zh: '最多人造訪的主題樂園', en: 'Most-visited theme parks' },
  tabLabel: { zh: '主題樂園', en: 'Theme parks' },
  indicators: ['visitors'],
  file: 'park-visitors.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) => {
    const y = Math.max(PARK_YEARS[0], Math.min(PARK_YEARS[PARK_YEARS.length - 1], year));
    return points
      .filter((p) => typeof p[`v${y}`] === 'number')
      .sort((a, b) => Number(b[`v${y}`]) - Number(a[`v${y}`]))
      .map((p, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${p.en ?? p.zh}-${i}`,
          title: `${i + 1}. ${title}`,
          properNoun: proper,
          lines: [
            country(p, countryName) ?? '',
            tr({ zh: `${y} 年 ${visitorsText(Number(p[`v${y}`]))}`, en: `${visitorsText(Number(p[`v${y}`]))} in ${y}` }) +
              (p.src === 2 ? tr({ zh: '（觀光署，跟 TEA 的估計不能直接比）', en: ' (Tourism Administration; not comparable with TEA)' }) : ''),
          ].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        };
      });
  },
};

// ── 地標 ──

const FERRIS: PointsOverlayDef = {
  kind: 'points',
  id: 'ferris-wheels',
  file: 'ferris-wheels.json',
  label: { zh: '摩天輪（依啟用年份）', en: 'Ferris wheels (by opening year)' },
  indicators: ['landmarks'],
  radius: { field: 'h', stops: [[40, 2.5], [80, 4], [150, 7], [250, 10]] },
  color: C[6],
  sortField: 'h',
  timeField: 'y',
  sizeLegend: { title: { zh: '高度', en: 'Height' }, values: [50, 120, 250], format: (v) => tr({ zh: `${v} 公尺`, en: `${v} m` }) },
  tooltip: (p, { countryName }) => ({
    title: String(p.en ?? ''),
    detail: [tr({ zh: '摩天輪', en: 'Ferris wheel' }), country(p, countryName)].filter(Boolean).join(' · '),
    extra: [
      tr({ zh: `高 ${fixed(Number(p.h), Number(p.h) % 1 ? 1 : 0)} 公尺 · ${p.y} 年啟用`, en: `${fixed(Number(p.h), Number(p.h) % 1 ? 1 : 0)} m tall · opened ${p.y}` }),
      p.roof === 1 ? tr({ zh: '蓋在屋頂上（高度只算摩天輪）', en: 'Rooftop wheel (height of the wheel only)' }) : '',
    ].filter(Boolean),
  }),
};

const MALLS: PointsOverlayDef = {
  kind: 'points',
  id: 'malls',
  file: 'malls.json',
  label: { zh: '世界最大的購物中心（總樓地板面積）', en: 'Largest shopping malls (gross floor area)' },
  indicators: ['landmarks'],
  radius: { field: 'a', stops: [[250000, 3], [500000, 5], [1000000, 8], [1950000, 11]] },
  color: C[5],
  sortField: 'a',
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    return {
      title,
      detail: [tr({ zh: '購物中心', en: 'Shopping mall' }), country(p, countryName)].filter(Boolean).join(' · '),
      extra: [
        tr({ zh: `總樓地板 ${formatLargeNumber(Number(p.a))} 平方公尺`, en: `${formatLargeNumber(Number(p.a))} m² gross floor area` }) +
          (typeof p.y === 'number' ? tr({ zh: ` · ${p.y} 年開幕`, en: ` · opened ${p.y}` }) : ''),
      ],
      properNoun: proper,
    };
  },
};

const WONDER_GROUPS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '古代七大奇蹟', en: 'Seven Wonders of the Ancient World' }, color: C[2] },
  { value: 2, label: { zh: '新七大奇蹟（2007 年票選）', en: 'New 7 Wonders of the World (2007 vote)' }, color: C[7] },
  { value: 3, label: { zh: '新七大自然奇景（2011 年票選）', en: 'New 7 Wonders of Nature (2011 vote)' }, color: C[0] },
  { value: 4, label: { zh: 'CNN 七大自然奇景（1997 年）', en: 'Seven Natural Wonders (CNN, 1997)' }, color: C[1] },
];

const WONDERS: PointsOverlayDef = {
  kind: 'points',
  id: 'wonders',
  file: 'wonders.json',
  label: { zh: '世界奇觀', en: 'Wonders of the World' },
  indicators: ['landmarks'],
  radius: 5,
  color: { field: 'g', title: { zh: '名單', en: 'List' }, thresholds: [1.5, 2.5, 3.5], classes: WONDER_GROUPS.map(({ label, color }) => ({ label, color })) },
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    const note = getLang() === 'zh' ? str(p.note) : str(p.noteEn);
    return {
      title,
      detail: [tr(WONDER_GROUPS.find((g) => g.value === p.g)?.label ?? ''), country(p, countryName)].filter(Boolean).join(' · '),
      extra: [p.g === 1 && p.en !== 'Great Pyramid of Giza' ? tr({ zh: '已經不存在（位置是原址）', en: 'No longer standing (original site)' }) : '', note ?? ''].filter(Boolean),
      properNoun: proper,
    };
  },
};

// ── 創意城市 ──

const CREATIVE_FIELDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '文學', en: 'Literature' } },
  { value: 2, label: { zh: '電影', en: 'Film' } },
  { value: 3, label: { zh: '音樂', en: 'Music' } },
  { value: 4, label: { zh: '手工藝與民間藝術', en: 'Crafts and folk art' } },
  { value: 5, label: { zh: '設計', en: 'Design' } },
  { value: 6, label: { zh: '媒體藝術', en: 'Media arts' } },
  { value: 7, label: { zh: '美食', en: 'Gastronomy' } },
  { value: 8, label: { zh: '建築（2025 年起）', en: 'Architecture (from 2025)' } },
];

const CREATIVE: PointsOverlayDef = {
  kind: 'points',
  id: 'creative-cities',
  file: 'creative-cities.json',
  label: { zh: 'UNESCO 創意城市', en: 'UNESCO Creative Cities' },
  indicators: ['creative'],
  radius: 3.4,
  color: {
    field: 'f',
    title: { zh: '類型', en: 'Field' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
    classes: CREATIVE_FIELDS.map((f, i) => ({ label: f.label, color: C[i] })),
  },
  timeField: 'y',
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    const field = tr(CREATIVE_FIELDS.find((f) => f.value === p.f)?.label ?? '');
    return {
      title,
      detail: [tr({ zh: `創意城市：${field}`, en: `Creative City of ${field}` }), country(p, countryName)].filter(Boolean).join(' · '),
      extra: [tr({ zh: `${p.y} 年加入`, en: `joined ${p.y}` })],
      properNoun: proper,
    };
  },
};

// ── 世界博覽會 ──

const EXPO_TYPES: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '世界博覽會', en: 'World Expo' }, color: C[7] },
  { value: 2, label: { zh: '專業博覽會', en: 'Specialised Expo' }, color: C[0] },
  { value: 3, label: { zh: '園藝博覽會', en: 'Horticultural Expo' }, color: C[3] },
];

const EXPOS: PointsOverlayDef = {
  kind: 'points',
  id: 'expos',
  file: 'expos.json',
  label: { zh: '世界博覽會（國際展覽局的官方名單）', en: 'World’s fairs (BIE official list)' },
  indicators: ['expos'],
  radius: 4.5,
  color: { field: 't', title: { zh: '類型', en: 'Type' }, thresholds: [1.5, 2.5], classes: EXPO_TYPES.map(({ label, color }) => ({ label, color })) },
  timeField: 'y',
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    const years = typeof p.y2 === 'number' && p.y2 !== p.y ? `${p.y}–${p.y2}` : String(p.y);
    return {
      title,
      detail: [tr(EXPO_TYPES.find((t) => t.value === p.t)?.label ?? ''), str(p.city), country(p, countryName)].filter(Boolean).join(' · '),
      extra: [tr({ zh: `${years} 年`, en: years }), Number(p.y) > 2026 ? tr({ zh: '預定舉辦', en: 'Planned' }) : ''].filter(Boolean),
      properNoun: proper,
    };
  },
};

const empty = { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' };

export const attractionsExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef[] } = {
  sources: [
    {
      name: {
        zh: '英文維基百科：最多人造訪的博物館、主題樂園排名、摩天輪、購物中心、世界奇觀、創意城市、世界博覽會的列表（revid 見資料檔的 manifest）',
        en: 'English Wikipedia: lists of most-visited museums, amusement park rankings, Ferris wheels, shopping malls, wonders, Creative Cities and world’s fairs (revisions in the manifest)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_most-visited_museums&oldid=1381343174',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    {
      name: { zh: '交通部觀光署：歷年國內主要觀光遊憩據點遊客人數（台灣的博物館與樂園）', en: 'Tourism Administration (Taiwan): visitors to major attractions (Taiwan’s museums and parks)' },
      url: 'https://data.gov.tw/dataset/8116',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  overlays: [MUSEUM_VISITORS, PARK_VISITORS, FERRIS, MALLS, WONDERS, CREATIVE, EXPOS],
  listPanel: [MUSEUM_LIST, PARK_LIST],
  indicators: [
    {
      id: 'visitors',
      label: { zh: '博物館與樂園的人次', en: 'Museum and park visitors' },
      description: {
        zh: '最多人造訪的博物館與主題樂園，點的大小是一年的人次。博物館是英文維基「最多人造訪的博物館」表上一年 125 萬人次以上的（各館自己公布的數字，年份不一），羅浮宮 2025 年 900 萬第一，中國國家博物館 703 萬、梵蒂岡博物館 693 萬；台灣的 4 館另附觀光署 2024 年的數字，並補上表上沒有的海科館、科教館。主題樂園是英文維基轉載 TEA／AECOM 的全世界前 25 與各區前 20（2009–2024 年，拖時間軸看 2020 年疫情的斷崖），2024 年魔法王國 1,784 萬人次第一；台灣的樂園沒有進亞太前 20，綠色的點是觀光署的人次（麗寶、義大含購物中心與飯店，跟 TEA 的估計不能直接比）。左邊的清單依人次列出博物館與主題樂園（上面的分頁切換）。',
        en: 'The most-visited museums and theme parks, sized by visitors a year. Museums are those in English Wikipedia’s list of most-visited museums with over 1.25 million visitors (each museum’s own figures, for varying years): the Louvre led with 9.0 million in 2025, ahead of the National Museum of China (7.03 million) and the Vatican Museums (6.93 million); Taiwan’s four also show the Tourism Administration’s 2024 figure, and two missing from the list (the National Museum of Marine Science and Technology and the National Taiwan Science Education Center) are added from it. Theme parks are the worldwide top 25 and regional top 20 from TEA/AECOM as reproduced on English Wikipedia (2009–2024; drag the time slider to see the 2020 pandemic drop), led by Magic Kingdom with 17.8 million in 2024; no Taiwanese park makes the Asia-Pacific top 20, so green dots show Tourism Administration counts (Lihpao and E-DA include their malls and hotels and are not directly comparable). The list on the left ranks the museums and the theme parks by visitors (switch with the tabs above it).',
      },
      unit: '',
      file: 'visitors.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2024,
      missing: empty,
    },
    {
      id: 'landmarks',
      label: { zh: '摩天輪、購物中心、世界奇觀', en: 'Ferris wheels, malls and wonders' },
      description: {
        zh: '摩天輪（英文維基「List of Ferris wheels」的固定式摩天輪，已拆除、停業的不算，大小是高度，依啟用年份出現）：杜拜之眼 250 公尺最高，台灣有麗寶天空之夢 126 公尺、劍湖山 88 公尺、義大 80 公尺（在屋頂上）、美麗華 70 公尺、高雄之眼 50 公尺。世界最大的購物中心（英文維基「Shopping mall」的表，總樓地板 25 萬平方公尺以上，出處多半是排行網站、面積的算法不一）：伊朗的 Iran Mall 195 萬平方公尺第一，台灣有高雄夢時代、新竹巨城、台南南紡購物中心。世界奇觀：古代七大奇蹟（只剩吉薩大金字塔）、2007 年與 2011 年 New7Wonders 基金會的商業票選、CNN 1997 年的七大自然奇景；亞馬遜雨林與極光是代表點。',
        en: 'Ferris wheels (fixed wheels in English Wikipedia’s List of Ferris wheels, excluding demolished or closed ones; sized by height and shown from their opening year): Ain Dubai is the tallest at 250 m; Taiwan has Lihpao’s Sky Dream (126 m), Janfusun (88 m), E-DA (80 m, on a rooftop), Miramar (70 m) and the Kaohsiung Eye (50 m). The largest shopping malls (the table in English Wikipedia’s Shopping mall article, over 250,000 m² gross floor area; sources are mostly ranking websites and area definitions vary): Iran Mall leads with 1.95 million m², and Taiwan has Dream Mall, Big City and T.S. Mall. Wonders of the World: the Seven Wonders of the Ancient World (only the Great Pyramid survives), the New7Wonders Foundation’s commercial votes of 2007 and 2011, and CNN’s 1997 Seven Natural Wonders; the Amazon rainforest and the aurora are shown at representative points.',
      },
      unit: '',
      file: 'landmarks.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2026,
      missing: empty,
    },
    {
      id: 'creative',
      label: { zh: 'UNESCO 創意城市', en: 'UNESCO Creative Cities' },
      description: {
        zh: 'UNESCO 創意城市網絡的城市數（2004 年起，依加入年份累計；一個城市兩個類型算一個）。類型：文學、電影、音樂、手工藝與民間藝術、設計、媒體藝術、美食，2025 年起加上建築（比斯特里察、卡尚、盧賽爾、基多、羅瓦涅米）。UNESCO 的網站條款不准大量擷取，名單照英文維基各類型的條目合併：394 筆（UNESCO 寫 408 城，媒體藝術的條目沒有更新到 2025 年），中國 19 城最多，其次巴西、義大利 15。台灣不是 UNESCO 會員國，沒有。',
        en: 'Cities in the UNESCO Creative Cities Network (since 2004, cumulative by year joined; a city in two fields counts once). Fields: literature, film, music, crafts and folk art, design, media arts and gastronomy, plus architecture from 2025 (Bistrița, Kashan, Lusail, Quito and Rovaniemi). UNESCO’s website terms forbid bulk extraction, so the lists combine English Wikipedia’s article for each field: 394 entries (UNESCO lists 408 cities; the media arts article has not been updated for 2025). China has the most with 19, followed by Brazil and Italy with 15. Taiwan, not a UNESCO member, has none.',
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'creative.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      overlayTime: 'cumulative',
      format: (v) => tr({ zh: `${fixed(v, 0)} 個城市`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'city' : 'cities'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'expos',
      label: { zh: '世界博覽會', en: 'World’s fairs' },
      description: {
        zh: '國際展覽局（BIE）的官方名單（英文維基「World\'s fair」轉載）：世界博覽會 37 屆、專業博覽會 35 屆、園藝博覽會 26 屆，依舉辦年份出現（含已決定的 2027 年貝爾格勒、橫濱，2030 年利雅德等），國家的值是辦過幾屆（累計）：到 2026 年美國 11 屆最多（另有預定 2031 年的明尼蘇達），其次法國 10、德國 8。1851 年倫敦的萬國工業博覽會（水晶宮）是第一屆；1964 年紐約世界博覽會沒有 BIE 認可，不在名單上。台灣沒有辦過：1935 年的「始政四十周年記念臺灣博覽會」是日治時期的博覽會，2010 年臺北國際花卉博覽會是國際園藝生產者協會（AIPH）認可的園藝博覽會，都不是 BIE 的世界博覽會。',
        en: 'The official list of the Bureau International des Expositions (BIE), as reproduced in English Wikipedia’s World’s fair article: 37 World Expos, 35 Specialised Expos and 26 Horticultural Expos, shown from the year held (including those already awarded, such as Belgrade and Yokohama 2027 and Riyadh 2030); a country’s value is how many it has hosted (cumulative): by 2026 the US leads with 11 (plus Minnesota, planned for 2031), followed by France 10 and Germany 8. The first was the Great Exhibition in London in 1851 (the Crystal Palace); the 1964 New York World’s Fair was not BIE-approved and is not listed. Taiwan has hosted none: the 1935 Taiwan Exposition was held under Japanese rule, and the 2010 Taipei International Flora Exposition was a horticultural expo approved by the AIPH, not a BIE expo.',
      },
      unit: { zh: '屆', en: 'expos' },
      file: 'expos-count.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 8] },
      overlayTime: 'cumulative',
      format: (v) => tr({ zh: `${fixed(v, 0)} 屆`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'expo' : 'expos'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
