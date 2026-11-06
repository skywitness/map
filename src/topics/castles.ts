import { getLang, tr, type Text } from '../i18n/lang';
import { commonsPhoto, wikiLink } from '../lib/commons';
import { fixed, formatLargeNumber } from '../lib/format';
import { nearText } from '../lib/near';
import { MAP_TOKENS } from '../theme/tokens';
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
  overlays: [CASTLES_OVERLAY],
  listPanel: [FAMOUS_LIST, NEAR_LIST],
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
  ],
};
