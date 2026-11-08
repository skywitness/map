import { getLang, tr, type Text } from '../i18n/lang';
import { commonsPhoto, wikiLink } from '../lib/commons';
import { fixed, formatLargeNumber } from '../lib/format';
import { nearText } from '../lib/near';
import { MAP_TOKENS } from '../theme/tokens';
import { osmGrid } from './osm-grid';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 城堡與要塞（新主題，2026-11-06，參考 thecastlemap.com，使用者選「城1–城7 都做」；pipeline/topics/castles.py）：
 * Castle Map 整理的 9,040 座城堡、要塞、宮殿與遺址（CC0），中文名稱、世界遺產、參觀人數與各國在 Wikidata 的總數另外從
 * Wikidata 補。每座一個點（依類型上色、依知名度決定大小，縮小時只畫知名的），時間軸是建造的年份（累積）；
 * tooltip 有 Commons 的照片（城2）；左側欄：最有名的（含「隨機看一座」，城7）、這一點 100 公里內（城4）、統計（城5）。
 */

/** 時間軸的最後一年：沒有建造年份的城堡在這一年才畫（pipeline 的 YEAR_END） */
export const YEAR_END = 2026;

/** 四類（資料的 c 欄位 1–4），顏色用 validate_palette 檢查過（淺色底圖全部通過，最接近的一對是遺址與宮殿，色盲時靠圖例與 tooltip 的文字） */
export const CASTLE_TYPES: { label: Text; short: Text; color: string }[] = [
  { label: { zh: '城堡（有人住、可以防守）', en: 'Castle (a fortified residence)' }, short: { zh: '城堡', en: 'Castle' }, color: MAP_TOKENS.hues.violet },
  { label: { zh: '要塞、堡壘、砲台（駐軍用）', en: 'Fortress or fort (built for a garrison)' }, short: { zh: '要塞', en: 'Fortress' }, color: MAP_TOKENS.hues.yellow },
  { label: { zh: '宮殿、城館（不是為了防守）', en: 'Palace or château (not built for defence)' }, short: { zh: '宮殿', en: 'Palace' }, color: MAP_TOKENS.hues.aqua },
  { label: { zh: '遺址（已毀或只剩遺跡）', en: 'Ruin (destroyed or only remains)' }, short: { zh: '遺址', en: 'Ruin' }, color: MAP_TOKENS.hues.magenta },
];

const TYPE_COLORS: ColorClasses = {
  field: 'c',
  title: { zh: '類型（按一下可以隱藏）', en: 'Type (click to hide)' },
  thresholds: [1.5, 2.5, 3.5],
  classes: CASTLE_TYPES.map(({ label, color }) => ({ label, color })),
};

/** 知名度的四級（f 欄位）：全世界前 100、400、1,100 名與其他（照 Castle Map 的分級） */
const TIERS: Record<number, Text> = {
  4: { zh: '世界知名（前 100 名）', en: 'World-famous (top 100)' },
  3: { zh: '很有名（前 400 名）', en: 'Renowned (top 400)' },
  2: { zh: '有名（前 1,100 名）', en: 'Notable (top 1,100)' },
  1: { zh: '其他', en: 'Others' },
};

export function castleName(p: PointRecord): string {
  return String((getLang() === 'zh' ? p.zh || p.en : p.en) ?? '');
}

const typeText = (p: PointRecord) => tr(CASTLE_TYPES[Number(p.c) - 1]?.short ?? { zh: '', en: '' });

/** 年份：「西元前 700 年」「1475 年」；英文「700 BCE」「1475」 */
export function eraYear(y: number): string {
  return y < 0 ? tr({ zh: `西元前 ${-y} 年`, en: `${-y} BCE` }) : tr({ zh: `${y} 年`, en: String(y) });
}

/** 時間軸的刻度：「前 3000」「1475」 */
function eraTick(y: number): string {
  return y < 0 ? tr({ zh: `前 ${-y}`, en: `${-y} BCE` }) : String(y);
}

/** 「建於約 1475 年」「建造年份不詳」 */
export function builtText(p: PointRecord): string {
  if (typeof p.y !== 'number') return tr({ zh: '建造年份不詳', en: 'Founding year unknown' });
  const approx = p.ya === 1;
  const year = eraYear(p.y);
  return tr({ zh: `建於${approx ? '約 ' : ' '}${year}`, en: `Founded ${approx ? 'c. ' : ''}${year}` });
}

function fameText(p: PointRecord, country: string): string {
  return tr({
    zh: `知名度：全世界第 ${fixed(Number(p.r), 0)} 名、${country}第 ${p.nr} 名`,
    en: `Fame: #${fixed(Number(p.r), 0)} in the world, #${p.nr} in ${country}`,
  });
}

function castleTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '';
  const extra = [builtText(p), fameText(p, country)];
  if (p.w === 1) extra.push(tr({ zh: '世界遺產', en: 'World Heritage Site' }));
  if (p.w === 2) extra.push(tr({ zh: '世界遺產的一部分', en: 'Part of a World Heritage Site' }));
  if (typeof p.v === 'number') {
    const n = formatLargeNumber(p.v);
    extra.push(
      tr({
        // 「153 萬人」「8,500 人」
        zh: `每年約 ${n}${/[萬億]$/.test(n) ? '' : ' '}人參觀${p.vy ? `（${p.vy} 年）` : ''}`,
        en: `About ${n} visitors a year${p.vy ? ` (${p.vy})` : ''}`,
      }),
    );
  }
  const name = castleName(p);
  return {
    title: name,
    detail: [typeText(p), country].filter(Boolean).join(' · '),
    extra,
    properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    photo: commonsPhoto(p.img, p.by, p.lic),
    link: wikiLink(p.wp),
  };
}

export const CASTLES_OVERLAY: PointsOverlayDef = {
  kind: 'points',
  id: 'castles',
  file: 'castles.json',
  label: { zh: '城堡、要塞、宮殿與遺址', en: 'Castles, fortresses, palaces and ruins' },
  radius: { field: 'f', stops: [[1, 2.3], [2, 3.2], [3, 4.2], [4, 5.4]] },
  color: TYPE_COLORS,
  sortField: 'f',
  timeField: 'yt',
  // 縮小時只畫知名的：2 級以下前 400 名、3–4 級前 1,100 名，5 級起全部（其餘的 7,940 座在 castles-more.json，放大才下載）
  minValue: { field: 'f', stops: [[0, 3], [3, 2], [5, 1]] },
  more: { minZoom: 5 },
  count: { unit: { zh: '座', en: 'landmarks' } },
  sizeLegend: {
    title: { zh: '知名度（維基百科的語言版數與瀏覽量）', en: 'Fame (Wikipedia editions and page views)' },
    values: [4, 3, 2, 1],
    format: (v) => tr(TIERS[v]),
  },
  tooltip: castleTooltip,
};

function famousRow(p: PointRecord, ctx: { countryName: (iso3: string) => string; year: number; country: string | null }): ListRow {
  const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '';
  const name = castleName(p);
  const notYet = Number(p.yt) > ctx.year;
  return {
    key: `r${p.r}`,
    title: name,
    properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    lines: [
      [typeText(p), country].filter(Boolean).join(' · '),
      [
        builtText(p),
        ctx.country ? tr({ zh: `${country}第 ${p.nr} 名`, en: `#${p.nr} in ${country}` }) : tr({ zh: `第 ${fixed(Number(p.r), 0)} 名`, en: `#${fixed(Number(p.r), 0)}` }),
      ].join(' · '),
    ],
    // 時間軸那一年還沒蓋的淡一點；點了換到最後一年，地圖上才看得到
    muted: notYet,
    year: notYet ? YEAR_END : undefined,
    target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
  };
}

const FAMOUS_LIST: ListPanelDef = {
  label: { zh: '城堡知名度排行', en: 'Most famous castles' },
  tabLabel: { zh: '最有名', en: 'Most famous' },
  file: 'castles.json',
  // 沒選國家時只列前 1,100 名（castles.json）；選了國家時兩個檔都讀，列那一國全部的
  layered: true,
  countryField: 'iso3',
  // 城7：依知名度加權（世界知名的機會是其他的 8 倍）
  random: { label: { zh: '隨機看一座', en: 'Surprise me' }, weight: (p) => 2 ** (Number(p.f) - 1) },
  rows: (points, ctx) => [...points].sort((a, b) => Number(a.r) - Number(b.r)).map((p) => famousRow(p, ctx)),
};

const NEAR_LIST: ListPanelDef = {
  label: { zh: '這一點 100 公里內的城堡', en: 'Castles within 100 km' },
  tabLabel: { zh: '附近', en: 'Nearby' },
  file: 'castles.json',
  layered: true,
  near: { km: 100 },
  empty: { zh: '這一點 100 公里內沒有名單上的城堡', en: 'No listed landmarks within 100 km of this spot' },
  rows: (points, ctx) =>
    points.map((p) => {
      const row = famousRow(p, { ...ctx, country: null });
      return { ...row, key: `n${p.r}`, lines: [[nearText(p), typeText(p)].join(' · '), builtText(p)] };
    }),
};

// ── 2026-11-08（製作手冊第二十七批 643）台灣的有形文化資產（文化資產局） ──
const TW_HERITAGE_KINDS: Text[] = [
  { zh: '國定古蹟', en: 'National monument' },
  { zh: '直轄市定古蹟', en: 'Special municipality monument' },
  { zh: '縣（市）定古蹟', en: 'County or city monument' },
  { zh: '歷史建築', en: 'Historic building' },
  { zh: '聚落建築群、紀念建築', en: 'Settlement or memorial building' },
  { zh: '考古遺址', en: 'Archaeological site' },
  { zh: '文化景觀', en: 'Cultural landscape' },
];
const TC = MAP_TOKENS.categorical;
const twKind = (p: PointRecord) => tr(TW_HERITAGE_KINDS[(Number(p.k) || 1) - 1]);
const TW_HERITAGE: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-heritage',
  file: 'taiwan-heritage.json',
  label: { zh: '台灣的有形文化資產（文化資產局）', en: 'Taiwan’s designated heritage (Bureau of Cultural Heritage)' },
  indicators: ['taiwan-heritage'],
  radius: { field: 'k', stops: [[1, 4.5], [3, 3], [4, 2.4], [7, 2.8]] },
  color: {
    field: 'k',
    title: { zh: '類別', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
    classes: TW_HERITAGE_KINDS.map((label, i) => ({ color: [TC[3], TC[1], TC[0], TC[2], TC[5], TC[4], TC[6]][i], label })),
  },
  sortField: 'k',
  timeField: 'y',
  tooltip: (p) => ({
    title: String(p.name ?? ''),
    detail: [twKind(p), typeof p.type === 'string' ? p.type : null, typeof p.county === 'string' ? p.county : null].filter(Boolean).join(' · '),
    extra: typeof p.y === 'number' ? [tr({ zh: `${p.y} 年公告`, en: `designated ${p.y}` })] : [],
  }),
};
const TW_HERITAGE_LIST: ListPanelDef = {
  label: { zh: '台灣的有形文化資產', en: 'Taiwan’s designated heritage' },
  tabLabel: { zh: '台灣', en: 'Taiwan' },
  indicators: ['taiwan-heritage'],
  file: 'taiwan-heritage.json',
  rows: (points) => {
    const by = new Map<string, PointRecord[]>();
    for (const p of points) by.set(String(p.county ?? ''), [...(by.get(String(p.county ?? '')) ?? []), p]);
    const rows: ListRow[] = [];
    for (const [county, list] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
      list
        .sort((a, b) => Number(a.k) - Number(b.k))
        .forEach((p, i) => {
          rows.push({
            key: `twh-${county}-${i}`,
            title: String(p.name ?? ''),
            lines: [[twKind(p), typeof p.type === 'string' ? p.type : null, typeof p.y === 'number' ? tr({ zh: `${p.y} 年公告`, en: `designated ${p.y}` }) : null].filter(Boolean).join(' · ')],
            group: tr({ zh: `${county || '縣市不詳'}（${list.length}）`, en: `${county || 'Unknown'} (${list.length})` }),
            target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
            link: typeof p.url === 'string' ? { href: p.url, label: tr({ zh: '國家文化資產網', en: 'National Cultural Heritage Database' }) } : undefined,
          });
        });
    }
    return rows;
  },
};

/**
 * OSM 的城堡、莊園與要塞，廢墟、紀念碑，考古遺址（2026-11-08，製作手冊第二十七批 644，候選 1410–1412；pipeline/topics/castles_osm.py）：
 * 分國計數與 0.1° 網格。Castle Map 的 9,040 座是「有名的」、OSM 是「全部」，兩者不相加；考古遺址國家不上色（單一專案匯入）。
 */
const FORTS_GRID = osmGrid(
  'forts-grid',
  'forts-grid.json',
  { zh: 'OSM 的城堡、莊園與要塞（約 10 公里的網格）', en: 'OSM castles, manors and forts (about 10 km grid)' },
  ['forts-osm-per', 'forts-osm'],
  { zh: '城堡、莊園與要塞', en: 'castles, manors and forts' },
);
const RUINS_GRID = osmGrid(
  'ruins-grid',
  'ruins-grid.json',
  { zh: 'OSM 的廢墟（約 10 公里的網格）', en: 'OSM ruins (about 10 km grid)' },
  ['ruins-osm-per'],
  { zh: '廢墟', en: 'ruins' },
);
const MONUMENTS_GRID = osmGrid(
  'monuments-grid',
  'monuments-grid.json',
  { zh: 'OSM 的紀念碑（約 10 公里的網格）', en: 'OSM monuments (about 10 km grid)' },
  ['monuments-osm-per'],
  { zh: '紀念碑', en: 'monuments' },
);
const ARCH_GRID = osmGrid(
  'archaeology-grid',
  'archaeology-grid.json',
  { zh: 'OSM 的考古遺址（約 10 公里的網格）', en: 'OSM archaeological sites (about 10 km grid)' },
  ['archaeology-osm'],
  { zh: '考古遺址', en: 'archaeological sites' },
);

const countText = (v: number) => tr({ zh: `名單上 ${fixed(v, 0)} 座`, en: `${fixed(v, 0)} listed` });

export const castles: TopicDefinition = {
  id: 'castles',
  title: { zh: '城堡與要塞', en: 'Castles and fortresses' },
  shortTitle: { zh: '城堡與要塞', en: 'Castles' },
  defaultIndicator: 'castles',
  defaultYear: YEAR_END,
  sources: [
    {
      name: { zh: 'Castle Map：9,040 座城堡、要塞、宮殿與遺址的資料集（2026-11-06 下載）', en: 'Castle Map: dataset of 9,040 castles, fortresses, palaces and ruins (downloaded 2026-11-06)' },
      url: 'https://thecastlemap.com/data/',
      license: 'CC0 1.0',
    },
    {
      name: { zh: 'Wikidata（中文名稱、世界遺產、每年的參觀人數、各國在 Wikidata 的總數）', en: 'Wikidata (Chinese names, World Heritage status, yearly visitors, totals per country)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: 'Wikimedia Commons（照片，滑過時從 Commons 讀；攝影者與授權寫在照片下面）', en: 'Wikimedia Commons (photos, loaded from Commons on hover; photographer and licence under each photo)' },
      url: 'https://commons.wikimedia.org/',
      license: { zh: '各張照片自己的授權（多半是 CC BY-SA）', en: 'Each photo’s own licence (mostly CC BY-SA)' },
    },
    {
      name: { zh: 'OpenStreetMap（historic=castle、manor、fort、ruins、monument、archaeological_site，經 QLever 查詢）', en: 'OpenStreetMap (historic=castle, manor, fort, ruins, monument and archaeological_site, via QLever)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    {
      name: { zh: '陸地面積：FAOSTAT 土地利用', en: 'Land area: FAOSTAT land use' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》（每百萬人的數量）', en: 'UN World Population Prospects 2024 (per million people)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh:
      '城堡、要塞、宮殿與遺址來自 Castle Map 的資料集（CC0）：它從 Wikidata 挑出有真的照片、精確座標、維基百科條目，而且有夠多語言版維基百科的，所以是挑過的名單，不是全部（法國在 Wikidata 就有兩萬多項城堡、要塞、城館與宮殿，名單收 782 座）；日本的「日本 100 名城」「續日本 100 名城」不看語言版數全部收。' +
      '類型照它的規則：維基百科的首段寫只剩遺跡的是遺址，其次看名稱（「某某要塞」就是要塞），再看 Wikidata 的類別與英文說明；有人住又可以防守的是城堡，駐軍用的是要塞（含砲台），不是為了防守的大宅是宮殿。知名度依維基百科的語言版數與近 60 天的瀏覽量排名。' +
      '時間軸是建造的年份（有些是約略的，寫「約」）；1,629 座沒有建造年份，時間軸到 2026 年才畫。中文名稱來自 Wikidata（有繁體的照用，只有簡體的轉成繁體），約三分之一有；沒有的寫英文。是不是世界遺產、每年的參觀人數照 Wikidata 的記載，沒寫的不代表不是。' +
      '國家依座標判斷（英國的英格蘭、蘇格蘭、威爾斯、北愛爾蘭合併）。國家不上色：名單是挑過的，各國的數量反映維基百科寫得多不多（西歐最多），左邊的「統計」把名單的數量跟 Wikidata 全部的數量並列。照片滑過時才從 Wikimedia Commons 讀（不存在這個網站），攝影者與授權寫在照片下面；點一下（觸控長按）有維基百科條目的連結。台灣有 20 座，都是要塞、砲台與遺址。',
    en:
      'Castles, fortresses, palaces and ruins come from Castle Map’s dataset (CC0). It selects Wikidata items with a real photo, exact coordinates, a Wikipedia article and enough language editions of Wikipedia, so it is a curated list rather than everything (Wikidata has over twenty thousand castles, forts, châteaux and palaces in France alone; the list has 782). Japan’s “100 Fine Castles” and “Continued 100 Fine Castles” are all included regardless of language editions. ' +
      'Types follow its rules: a Wikipedia lead that describes only remains makes a ruin; otherwise an unambiguous word in the name wins (“X Fortress” is a fortress), then the Wikidata class and English description. A fortified residence is a castle, a garrison work (including batteries) is a fortress, and a grand residence not built for defence is a palace. Fame ranks blend the number of Wikipedia language editions with page views over the last 60 days. ' +
      'The time slider shows founding years (some approximate, marked “c.”); 1,629 have no founding year and appear only at 2026. Chinese names come from Wikidata (about a third have one); others show the English name. World Heritage status and yearly visitors follow Wikidata; a missing statement does not mean no. ' +
      'Countries are assigned by location (England, Scotland, Wales and Northern Ireland count as the UK). Countries are not coloured: the list is curated, so counts reflect how much Wikipedia covers a country (Western Europe most); the “Statistics” tab on the left puts each country’s count next to its Wikidata total. Photos load from Wikimedia Commons on hover (they are not stored on this site), with the photographer and licence under each one; click (or long-press) a dot for a link to its Wikipedia article. Taiwan has 20, all fortresses, batteries and ruins.',
  },
  overlays: [CASTLES_OVERLAY, TW_HERITAGE, FORTS_GRID, RUINS_GRID, MONUMENTS_GRID, ARCH_GRID],
  listPanel: [FAMOUS_LIST, NEAR_LIST, TW_HERITAGE_LIST],
  worldPanel: { title: { zh: '統計', en: 'Statistics' }, load: () => import('./panels/CastlesWorld') },
  indicators: [
    {
      id: 'castles',
      label: { zh: '城堡、要塞、宮殿與遺址', en: 'Castles, fortresses, palaces and ruins' },
      description: {
        zh: '世界 9,040 座有名的城堡、要塞、宮殿與遺址，每座一個點，顏色是類型、大小是知名度；縮小時只畫最有名的，放大才畫全部。拖動時間軸看它們依建造的年份出現：12、13 世紀的歐洲城堡最多，16 世紀起要塞與宮殿變多。滑過看照片與介紹，左邊可以看最有名的、隨機看一座、看地圖上藍點 100 公里內的，與各國的統計。',
        en: '9,040 notable castles, fortresses, palaces and ruins worldwide, one dot each, coloured by type and sized by fame; zoomed out, only the most famous are drawn. Drag the time slider to watch them appear by founding year: European castles peak in the 12th and 13th centuries, and fortresses and palaces take over from the 16th. Hover for a photo and details; on the left, browse the most famous, pick one at random, list those within 100 km of the blue dot on the map, or see statistics by country.',
      },
      unit: { zh: '座', en: 'landmarks' },
      file: 'castles-count.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      integer: true,
      format: countText,
      formatTick: (v) => fixed(v, 0),
      timeAxis: { label: { zh: '建造的年份', en: 'Founding year' }, year: eraYear, tick: eraTick },
      missing: { zh: '名單上沒有這一國的', en: 'None listed in this country' },
    },
    // 2026-11-08（製作手冊第二十七批 643）台灣的有形文化資產、Wikidata 各國的法定文化資產筆數
    {
      id: 'taiwan-heritage',
      label: { zh: '台灣的有形文化資產', en: 'Taiwan’s designated heritage' },
      description: { zh: '文化部文化資產局公告的有形文化資產 3,037 處裡有座標的 3,006 處：國定古蹟 110、直轄市定古蹟 522、縣（市）定古蹟 427、歷史建築 1,768、聚落建築群與紀念建築 45、考古遺址 55、文化景觀 79。拖時間軸看依公告年份累積：1980 年代 213 處、1990 年代 164、2000 年代 1,195、2010 年代 1,006、2020 年起 428。臺北市 576 處最多，金門縣 251、臺南市 244、臺中市 194；類別以宅第 828、其他設施 705、寺廟 255 最多。左邊的清單依縣市列出，連到國家文化資產網。', en: 'The 3,006 of 3,037 tangible heritage sites designated by Taiwan’s Bureau of Cultural Heritage that have coordinates: 110 national monuments, 522 special municipality monuments, 427 county or city monuments, 1,768 historic buildings, 45 settlements and memorial buildings, 55 archaeological sites and 79 cultural landscapes. Drag the time slider to see them accumulate by year of designation: 213 in the 1980s, 164 in the 1990s, 1,195 in the 2000s, 1,006 in the 2010s and 428 since 2020. Taipei has the most (576), followed by Kinmen (251), Tainan (244) and Taichung (194); the most common types are residences (828), other facilities (705) and temples (255). The list on the left groups them by county and links to the National Cultural Heritage Database.' },
      unit: '',
      file: 'heritage-years.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      defaultYear: 2026,
      focus: [119.3, 21.8, 122.1, 25.4],
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    {
      id: 'heritage-wikidata',
      label: { zh: 'Wikidata 上的法定文化資產筆數', en: 'Designated heritage entries in Wikidata' },
      description: { zh: 'Wikidata 上有法定文化資產登錄（P1435）、座標與國家的項目，依國家數：210 國合計 2,057,290 筆。英國 544,648 筆最多，德國 480,027、瑞典 152,756、美國 93,191、波蘭 89,569、俄羅斯 88,449、西班牙 73,558、法國 73,338、義大利 61,953；台灣 858 筆（文化資產局公告的有 3,037 處）。數字是各國把官方清冊匯進 Wikidata 的程度（英國、德國把每一棟登錄建築都匯進去），不能跨國比較，所以國家不上色，滑過國家看筆數。', en: 'Wikidata items with a heritage designation (P1435), coordinates and a country, counted by country: 2,057,290 entries in 210 countries. The UK has the most (544,648), followed by Germany (480,027), Sweden (152,756), the US (93,191), Poland (89,569), Russia (88,449), Spain (73,558), France (73,338) and Italy (61,953); Taiwan has 858 (its Bureau of Cultural Heritage lists 3,037). The numbers reflect how far each country’s official register has been imported into Wikidata (the UK and Germany imported every listed building), so they cannot be compared across countries; countries are not coloured; hover over one to see its count.' },
      unit: { zh: '筆', en: 'entries' },
      file: 'heritage-wikidata.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `Wikidata 上 ${fixed(v, 0)} 筆`, en: `${fixed(v, 0)} entries in Wikidata` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: 'Wikidata 上沒有這國的法定文化資產', en: 'No designated heritage from here in Wikidata' },
    },
    // 2026-11-08（製作手冊第二十七批 644）OSM 的城堡、莊園與要塞，廢墟、紀念碑，考古遺址
    {
      id: 'forts-osm-per',
      label: { zh: '每萬平方公里有幾座城堡、莊園與要塞（OSM）', en: 'Castles, manors and forts per 10,000 km² (OSM)' },
      description: { zh: 'OpenStreetMap 上標成城堡（historic=castle）、莊園（manor）與要塞（fort）的處數合計 ÷ 陸地面積（FAOSTAT），只替 OSM 覆蓋良好、陸地 1,000 平方公里以上的 87 國上色。比利時每萬平方公里 778 處最多，盧森堡 388、法國 369、荷蘭 265、義大利 253、瑞士 248；德國 209、西班牙 126、英國 113、日本 33、南韓 26、台灣 20、美國 2.9。OSM 的城堡含遺跡、水城與城跡，地圖上約 10 公里的網格是全部；第一個指標的 9,040 座是 Castle Map 挑過的有名的，兩者不相加。', en: 'Places tagged as castles (historic=castle), manors (manor) and forts (fort) in OpenStreetMap divided by land area (FAOSTAT), shown only for the 87 countries well covered by OSM with at least 1,000 km² of land. Belgium has the most per 10,000 km² (778), followed by Luxembourg (388), France (369), the Netherlands (265), Italy (253) and Switzerland (248); Germany has 209, Spain 126, the UK 113, Japan 33, South Korea 26, Taiwan 20 and the US 2.9. OSM castles include ruins, moated castles and castle sites, and the grid of about 10 km on the map shows all of them; the 9,040 in the first indicator are Castle Map’s curated notable ones, and the two are not added together.' },
      unit: { zh: '處／萬平方公里', en: 'per 10,000 km²' },
      file: 'forts-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 50, 100, 200, 400] } },
      timeless: true,
      format: (v) => tr({ zh: `每萬平方公里 ${fixed(v, v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 10 ? 1 : 0)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'forts-osm',
      label: { zh: '各國有幾座城堡、莊園與要塞（OSM）', en: 'Castles, manors and forts by country (OSM)' },
      description: { zh: 'OpenStreetMap 上的城堡 54,334 處（177 國）、莊園 20,501 處（130 國）、要塞 9,374 處（157 國），合計 84,209 處、199 國。法國 19,911 處最多（其中城堡 15,896），義大利 7,470、德國 7,318、西班牙 6,318、波蘭 3,999、英國 2,723、美國 2,693（其中要塞 1,836）；台灣 70 處（城堡 32、莊園 13、要塞 25）。', en: 'OpenStreetMap has 54,334 castles (177 countries), 20,501 manors (130) and 9,374 forts (157), 84,209 in all across 199 countries. France has the most (19,911, including 15,896 castles), followed by Italy (7,470), Germany (7,318), Spain (6,318), Poland (3,999), the UK (2,723) and the US (2,693, including 1,836 forts); Taiwan has 70 (32 castles, 13 manors and 25 forts).' },
      unit: { zh: '處', en: 'sites' },
      file: 'forts-osm.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'ruins-osm-per',
      label: { zh: '每萬平方公里有幾處廢墟（OSM）', en: 'Ruins per 10,000 km² (OSM)' },
      description: { zh: 'OpenStreetMap 上標成廢墟（historic=ruins）的處數 ÷ 陸地面積，只替 OSM 覆蓋良好的 87 國上色。全世界 186,694 處：英國 26,764 處最多，每萬平方公里 1,106 處；盧森堡 610、瑞士 588、以色列 472、義大利 421；台灣 852 處、每萬平方公里 241，跟法國（243）差不多。歐洲的廢墟含大量農舍與小屋的遺跡；賴索托的 9,877 處是單一專案匯入（賴索托不在上色的國家裡）。地圖上是約 10 公里的網格。', en: 'Places tagged as ruins (historic=ruins) in OpenStreetMap divided by land area, shown only for the 87 countries well covered by OSM. There are 186,694 worldwide: the UK has the most (26,764), or 1,106 per 10,000 km², followed by Luxembourg (610), Switzerland (588), Israel (472) and Italy (421); Taiwan has 852, or 241 per 10,000 km², about the same as France (243). European ruins include many remains of farmhouses and huts, and Lesotho’s 9,877 come from a single import project (Lesotho is not among the coloured countries). The map shows a grid of about 10 km.' },
      unit: { zh: '處／萬平方公里', en: 'per 10,000 km²' },
      file: 'ruins-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 250, 500] } },
      timeless: true,
      format: (v) => tr({ zh: `每萬平方公里 ${fixed(v, v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 10 ? 1 : 0)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'monuments-osm-per',
      label: { zh: '每萬平方公里有幾座紀念碑（OSM）', en: 'Monuments per 10,000 km² (OSM)' },
      description: { zh: 'OpenStreetMap 上標成紀念碑（historic=monument）的處數 ÷ 陸地面積，只替覆蓋良好的 87 國上色。全世界 71,775 處，美國 8,430 處最多，義大利 6,952、巴西 3,793；每萬平方公里義大利 235 最多，比利時 216、斯洛維尼亞 185、賽普勒斯 166、英國 125，台灣 108（382 處）、南韓 100、日本 52、美國 9.2。多半是戰爭紀念碑與名牌的 historic=memorial（約 52 萬個）照手冊不收。地圖上是約 10 公里的網格。', en: 'Places tagged as monuments (historic=monument) in OpenStreetMap divided by land area, shown only for the 87 well-covered countries. There are 71,775 worldwide; the US has the most (8,430), followed by Italy (6,952) and Brazil (3,793). Per 10,000 km², Italy leads (235), followed by Belgium (216), Slovenia (185), Cyprus (166) and the UK (125); Taiwan has 108 (382 in all), South Korea 100, Japan 52 and the US 9.2. Memorials (historic=memorial, about 520,000, mostly war memorials and plaques) are deliberately left out. The map shows a grid of about 10 km.' },
      unit: { zh: '處／萬平方公里', en: 'per 10,000 km²' },
      file: 'monuments-osm-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 200] } },
      timeless: true,
      format: (v) => tr({ zh: `每萬平方公里 ${fixed(v, v < 10 ? 1 : 0)} 處`, en: `${fixed(v, v < 10 ? 1 : 0)} per 10,000 km²` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'archaeology-osm',
      label: { zh: 'OSM 的考古遺址', en: 'Archaeological sites in OSM' },
      description: { zh: 'OpenStreetMap 上標成考古遺址（historic=archaeological_site）的地方：229,563 處、185 國，地圖上是約 10 公里的網格。阿爾及利亞 45,253 處最多，丹麥 26,468、愛爾蘭 25,154、英國 15,655、德國 12,969、西班牙 11,713、法國 9,779；台灣 41 處（文化資產局公告的考古遺址 58 處）。阿爾及利亞與查德（6,284）多是岩畫點的單一專案匯入，丹麥、愛爾蘭是國家遺址資料庫整批匯入，數字反映匯入而不是遺址真的最多，所以國家不上色，滑過國家看處數。', en: 'Places tagged as archaeological sites (historic=archaeological_site) in OpenStreetMap: 229,563 in 185 countries, shown as a grid of about 10 km. Algeria has the most (45,253), followed by Denmark (26,468), Ireland (25,154), the UK (15,655), Germany (12,969), Spain (11,713) and France (9,779); Taiwan has 41 (its Bureau of Cultural Heritage designates 58). Most of Algeria’s and Chad’s (6,284) are rock-art sites from single import projects, and Denmark’s and Ireland’s come from bulk imports of national site registers, so the numbers reflect imports rather than where most sites are; countries are not coloured, so hover over one to see its count.' },
      unit: '',
      file: 'archaeology-osm.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      timeless: true,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的網格', en: 'Countries are not coloured; see the grid on the map' },
    },
  ],
};
