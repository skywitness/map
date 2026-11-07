import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { HOLIDAY_INDICATORS, HOLIDAY_SOURCE } from './festivals-holidays';

/**
 * 節慶（pipeline/topics/festivals.py）：Wikidata 的節慶點依月份篩選，台灣用文化資產局的民俗補。
 * 使用者 2026-10-29 決定：主題叫「節慶」（「大型」排不出來），台灣用文資局的民俗。
 * 2026-10-31（第十二批 190）：左邊「這個月的節慶」清單，跟時間軸的月份連動。
 * 2026-11-07（第二十四批 436）：美食與飲酒節補上子類別、動漫展與電玩展、票房最高的巡迴演唱會。
 */

/** 種類（pipeline 的 KIND_WORDS 的代碼；2 是音樂節，2026-11-04 起） */
export const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '傳統、宗教與民俗節慶', en: 'Traditional, religious and folk' } },
  { value: 2, label: { zh: '音樂節', en: 'Music festival' } },
  { value: 3, label: { zh: '電影節', en: 'Film festival' } },
  { value: 4, label: { zh: '藝術節', en: 'Arts festival' } },
  { value: 5, label: { zh: '嘉年華', en: 'Carnival' } },
  { value: 6, label: { zh: '美食與飲酒節', en: 'Food and drink festival' } },
  { value: 7, label: { zh: '其他節慶', en: 'Other festival' } },
];
export const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
  classes: [
    { color: MAP_TOKENS.categorical[7], label: KINDS[0].label },
    { color: MAP_TOKENS.categorical[5], label: KINDS[1].label },
    { color: MAP_TOKENS.categorical[1], label: KINDS[2].label },
    { color: MAP_TOKENS.categorical[0], label: KINDS[3].label },
    { color: MAP_TOKENS.categorical[2], label: KINDS[4].label },
    { color: MAP_TOKENS.categorical[3], label: KINDS[5].label },
    { color: MAP_TOKENS.context, label: KINDS[6].label },
  ],
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number) => tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1] ?? String(m) });

export function festivalName(p: PointRecord): string {
  return String((getLang() === 'zh' ? p.zh : null) ?? p.en ?? p.zh ?? '');
}

/** 英文版裡只有中文名稱的（文資局登錄的台灣民俗）：名稱是不翻譯的原文 */
export function nameIsOriginal(p: PointRecord): boolean {
  return getLang() === 'en' && typeof p.en !== 'string';
}

/** 種類 · 月份（文資局的寫「文化資產」） */
export function festivalFacts(p: PointRecord): string {
  const parts = [kindLabel(p.k)];
  if (typeof p.m === 'number') parts.push(monthName(p.m));
  if (p.src === 2) parts.push(p.imp === 1 ? tr({ zh: '重要民俗', en: 'important folk custom' }) : tr({ zh: '登錄的民俗', en: 'registered folk custom' }));
  return parts.join(' · ');
}

/** 萬人場館（2026-11-04，製作手冊第二十一批 373）：Wikidata 的 arena 類別、容納 1 萬人以上，台灣補台北小巨蛋與臺北大巨蛋 */
const ARENAS: PointsOverlayDef = {
  kind: 'points',
  id: 'arenas',
  file: 'arenas.json',
  label: { zh: '萬人場館（多半同時是體育館）', en: 'Arenas for 10,000+ (mostly also sports venues)' },
  indicators: ['map', 'concert-tours'],
  hidden: true,
  radius: { field: 'cap', stops: [[10000, 3], [20000, 4.5], [60000, 7]] },
  color: MAP_TOKENS.categorical[6],
  sortField: 'cap',
  tooltip: (p, ctx) => {
    const name = String((getLang() === 'zh' ? p.zh : null) ?? p.en ?? p.zh ?? '');
    return {
      title: name,
      detail: [
        tr({ zh: `容納 ${fixed(Number(p.cap), 0)} 人（Wikidata）`, en: `Capacity ${fixed(Number(p.cap), 0)} (Wikidata)` }),
        typeof p.iso3 === 'string' && p.iso3 ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      extra:
        p.x === 1
          ? [tr({ zh: '補充：Wikidata 沒有歸在場館（arena）類別', en: 'Added: not classed as an arena on Wikidata' })]
          : undefined,
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    };
  },
};

function layer(id: string, file: string, label: Text, dated: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    indicators: ['map'],
    radius: dated ? { field: 'sl', stops: [[0, 4], [20, 5], [60, 7]] } : { field: 'sl', stops: [[0, 2], [20, 2.8], [60, 4]] },
    color: KIND_COLORS,
    sortField: 'sl',
    // 疊到別的主題上（時間軸是年份，不是月份）時全部畫
    ...(dated ? { timeField: 'm', shareable: 'untimed' as const } : {}),
    tooltip: (p, ctx) => {
      const name = festivalName(p);
      const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
      // 英文版裡只有中文名稱的：第一行寫種類，中文名稱放在不翻譯的原文那一行
      if (nameIsOriginal(p)) return { title: festivalFacts(p), detail: country ?? undefined, properNoun: name };
      return {
        title: name,
        detail: [festivalFacts(p), country].filter(Boolean).join(' · '),
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

/**
 * 這個月的節慶（第十二批 190）：時間軸那個月、有月份的節慶；有固定日子的依日子（文資局農曆的用農曆的日，
 * 跟月份一樣當成大約的國曆），其他依名稱。每列：名稱、國家與城市、日期
 */
const MONTH_LIST: ListPanelDef = {
  label: { zh: '這個月的節慶', en: 'Festivals this month' },
  indicators: ['map'],
  file: 'festivals.json',
  empty: { zh: '這個月沒有標了月份的節慶', en: 'No festivals with a known date this month' },
  rows: (points, { countryName, year }) => {
    const name = festivalName;
    return points
      .filter((p) => p.m === year)
      .sort((a, b) => {
        const da = typeof a.d === 'number' ? a.d : Infinity;
        const db = typeof b.d === 'number' ? b.d : Infinity;
        return da - db || name(a).localeCompare(name(b), getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
      })
      .map((p, i): ListRow => {
        const zh = getLang() === 'zh';
        const place = zh ? (p.pz ?? p.pe) : p.pe;
        const country = typeof p.iso3 === 'string' ? countryName(p.iso3) : null;
        const date = zh ? p.dz : p.de;
        const original = nameIsOriginal(p);
        return {
          key: `${i}-${name(p)}`,
          title: name(p),
          titleProper: original,
          lines: [[country, typeof place === 'string' && place !== country ? place : null].filter(Boolean).join(' · '), typeof date === 'string' ? date : monthName(year)].filter(Boolean),
          properNoun: !original && zh && typeof p.en === 'string' && p.en !== name(p) ? p.en : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      });
  },
};


/**
 * 動漫展、同人誌販售會、漫畫展與電玩展（2026-11-07，製作手冊第二十四批 436 的候選 1032；pipeline/topics/festival_conventions.py）：
 * Wikidata 的這幾類活動，時間軸是創辦年（依創辦年累計，創辦年不詳的一直畫），點的大小是維基百科的語言數。
 * 舉辦月份（m，英文維基的動漫展清單）與人次（att、ay；as 1 = 英文維基 infobox、2 = Wikidata）寫在說明與清單。
 */
const CON_KINDS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '動漫展', en: 'Anime convention' }, color: MAP_TOKENS.categorical[5] },
  { value: 2, label: { zh: '同人誌販售會', en: 'Dōjinshi fair' }, color: MAP_TOKENS.categorical[6] },
  { value: 3, label: { zh: '漫畫展與 Comic Con', en: 'Comic convention' }, color: MAP_TOKENS.categorical[1] },
  { value: 4, label: { zh: '電玩展與桌遊展', en: 'Game convention' }, color: MAP_TOKENS.categorical[3] },
  { value: 5, label: { zh: '其他同好大會（科幻、奇幻、furry…）', en: 'Other fan conventions (sci-fi, fantasy, furry…)' }, color: MAP_TOKENS.context },
];
const conKind = (p: PointRecord) => tr(CON_KINDS.find((k) => k.value === p.k)?.label ?? CON_KINDS[4].label);
const CON_FIRST = 1960;
const CON_LAST = 2026;
const conFacts = (p: PointRecord, countryName: (iso3: string) => string) =>
  [
    conKind(p),
    typeof p.iso3 === 'string' ? countryName(p.iso3) : null,
    typeof p.y === 'number' ? tr({ zh: `${p.y} 年創辦`, en: `since ${p.y}` }) : null,
    typeof p.m === 'number' ? tr({ zh: `每年 ${p.m} 月`, en: `held in ${MONTHS_EN[p.m - 1]}` }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
/** 人次：英文維基 infobox 的（多半有年份）或 Wikidata 的 */
const conAttendance = (p: PointRecord): string | null => {
  if (typeof p.att !== 'number') return null;
  const n = fixed(p.att, 0);
  const src = p.as === 1 ? tr({ zh: '英文維基', en: 'English Wikipedia' }) : 'Wikidata';
  return typeof p.ay === 'number'
    ? tr({ zh: `${p.ay} 年參觀 ${n} 人次（${src}）`, en: `${n} visitors in ${p.ay} (${src})` })
    : tr({ zh: `參觀 ${n} 人次（${src}，沒寫年份）`, en: `${n} visitors (${src}, year not given)` });
};

const CONVENTIONS: PointsOverlayDef = {
  kind: 'points',
  id: 'conventions',
  file: 'conventions.json',
  label: { zh: '動漫展與電玩展', en: 'Anime, comic and game conventions' },
  indicators: ['conventions'],
  epochs: {
    years: Array.from({ length: CON_LAST - CON_FIRST + 1 }, (_, i) => CON_FIRST + i),
    values: (p, y) => ({ on: typeof p.y !== 'number' || p.y <= y ? 1 : null }),
  },
  minValue: { field: 'on', stops: [[0, 1]] },
  radius: { field: 'sl', stops: [[0, 3], [10, 4.5], [30, 6.5], [50, 8]] },
  color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [2, 3, 4, 5], classes: CON_KINDS },
  sortField: 'sl',
  tooltip: (p, ctx) => {
    const name = festivalName(p);
    const extra = [
      conAttendance(p),
      p.x === 1 ? tr({ zh: 'Wikidata 沒有地點，畫在台北市', en: 'No venue on Wikidata; placed at Taipei' }) : null,
    ].filter((x): x is string => !!x);
    return {
      title: name,
      detail: conFacts(p, ctx.countryName),
      extra: extra.length ? extra : undefined,
      properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
    };
  },
};

const CON_LIST: ListPanelDef = {
  label: { zh: '動漫展與電玩展', en: 'Anime, comic and game conventions' },
  tabLabel: { zh: '依維基語言數', en: 'By Wikipedia editions' },
  indicators: ['conventions'],
  file: 'conventions.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) =>
    points
      .filter((p) => typeof p.y !== 'number' || p.y <= year)
      .sort((a, b) => Number(b.sl) - Number(a.sl))
      .slice(0, 150)
      .map((p, i): ListRow => {
        const name = festivalName(p);
        return {
          key: `c${i}-${name}`,
          title: name,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
          lines: [conFacts(p, countryName)],
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

const CON_ATT_LIST: ListPanelDef = {
  label: { zh: '動漫展與電玩展的人次', en: 'Convention attendance' },
  tabLabel: { zh: '依人次', en: 'By attendance' },
  indicators: ['conventions'],
  file: 'conventions.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .filter((p) => typeof p.att === 'number')
      .sort((a, b) => Number(b.att) - Number(a.att))
      .map((p, i): ListRow => {
        const name = festivalName(p);
        return {
          key: `ca${i}-${name}`,
          title: `${i + 1}. ${name}`,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
          lines: [conFacts(p, countryName), conAttendance(p)].filter((x): x is string => !!x),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

/**
 * 票房最高的巡迴演唱會（2026-11-07，製作手冊第二十四批 436 的候選 1038；pipeline/topics/concert_tours.py）：
 * 英文維基「List of highest-grossing concert tours」的全時期前 20 名（The Quittin’ Time Tour 沒有場次表，不畫），
 * 子項目選一個巡迴，畫出依日期連起來的路線、每一站，國家的比例圓是那個巡迴在這國的場次。
 */
const TOURS: { id: string; label: Text }[] = [
  { id: 't1', label: { zh: 'Taylor Swift《The Eras Tour》（2023–2024）', en: 'Taylor Swift: The Eras Tour (2023–2024)' } },
  { id: 't2', label: { zh: 'Coldplay《Music of the Spheres World Tour》（2022–2025）', en: 'Coldplay: Music of the Spheres World Tour (2022–2025)' } },
  { id: 't3', label: { zh: 'The Weeknd《After Hours til Dawn Tour》（2022–2026）', en: 'The Weeknd: After Hours til Dawn Tour (2022–2026)' } },
  { id: 't4', label: { zh: 'Elton John《Farewell Yellow Brick Road》（2018–2023）', en: 'Elton John: Farewell Yellow Brick Road (2018–2023)' } },
  { id: 't5', label: { zh: 'Ed Sheeran《+−=÷× Tour》（2022–2025）', en: 'Ed Sheeran: +−=÷× Tour (2022–2025)' } },
  { id: 't6', label: { zh: 'Ed Sheeran《÷ Tour》（2017–2019）', en: 'Ed Sheeran: ÷ Tour (2017–2019)' } },
  { id: 't7', label: { zh: 'U2《360° Tour》（2009–2011）', en: 'U2: 360° Tour (2009–2011)' } },
  { id: 't8', label: { zh: 'Bruce Springsteen · E Street Band《2023–2025 Tour》（2023–2025）', en: 'Bruce Springsteen · E Street Band: 2023–2025 Tour (2023–2025)' } },
  { id: 't9', label: { zh: 'Metallica《M72 World Tour》（2023–2027）', en: 'Metallica: M72 World Tour (2023–2027)' } },
  { id: 't10', label: { zh: 'Harry Styles《Love On Tour》（2021–2023）', en: 'Harry Styles: Love On Tour (2021–2023)' } },
  { id: 't11', label: { zh: 'Pink《Summer Carnival》（2023–2024）', en: 'Pink: Summer Carnival (2023–2024)' } },
  { id: 't12', label: { zh: 'Guns N’ Roses《Not in This Lifetime... Tour》（2016–2019）', en: 'Guns N’ Roses: Not in This Lifetime... Tour (2016–2019)' } },
  { id: 't13', label: { zh: 'Beyoncé《Renaissance World Tour》（2023）', en: 'Beyoncé: Renaissance World Tour (2023)' } },
  { id: 't14', label: { zh: 'BTS《Arirang World Tour》（2026）', en: 'BTS: Arirang World Tour (2026)' } },
  { id: 't15', label: { zh: 'Shakira《Las Mujeres Ya No Lloran World Tour》（2025–2026）', en: 'Shakira: Las Mujeres Ya No Lloran World Tour (2025–2026)' } },
  { id: 't16', label: { zh: 'Rammstein《Stadium Tour》（2019–2024）', en: 'Rammstein: Stadium Tour (2019–2024)' } },
  { id: 't17', label: { zh: 'The Rolling Stones《A Bigger Bang Tour》（2005–2007）', en: 'The Rolling Stones: A Bigger Bang Tour (2005–2007)' } },
  { id: 't18', label: { zh: 'The Rolling Stones《No Filter Tour》（2017–2021）', en: 'The Rolling Stones: No Filter Tour (2017–2021)' } },
  { id: 't19', label: { zh: 'Coldplay《A Head Full of Dreams Tour》（2016–2017）', en: 'Coldplay: A Head Full of Dreams Tour (2016–2017)' } },
];
const tourDates = (p: PointRecord) => (typeof p.d2 === 'string' && p.d2 ? `${String(p.d)}–${p.d2}` : String(p.d ?? ''));
const showsText = (n: number) => tr({ zh: `${fixed(n, 0)} 場`, en: `${fixed(n, 0)} ${n === 1 ? 'show' : 'shows'}` });

const TOUR_ROUTE: LinesOverlayDef = {
  kind: 'lines',
  id: 'tour-route',
  file: 'tours/{item}.json',
  label: { zh: '巡迴路線（依日期）', en: 'Tour route (by date)' },
  indicators: ['concert-tours'],
  width: 1.4,
  color: MAP_TOKENS.categorical[5],
};

const TOUR_STOPS: PointsOverlayDef = {
  kind: 'points',
  id: 'tour-stops',
  file: 'tours/{item}-stops.json',
  label: { zh: '巡迴的每一站', en: 'Tour stops' },
  indicators: ['concert-tours'],
  radius: { field: 'n', stops: [[1, 3.5], [3, 5], [8, 7]] },
  color: MAP_TOKENS.categorical[1],
  sortField: 'n',
  tooltip: (p, ctx) => ({
    title: String(p.c ?? ''),
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : String(p.co ?? ''), String(p.v ?? '')].filter(Boolean).join(' · '),
    extra: [tr({ zh: `第 ${p.o} 站：${tourDates(p)}，${showsText(Number(p.n))}`, en: `Stop ${p.o}: ${tourDates(p)}, ${showsText(Number(p.n))}` })],
    properNoun: getLang() === 'zh' ? String(p.c ?? '') : undefined,
  }),
};

const TOUR_LIST: ListPanelDef = {
  label: { zh: '巡迴的每一站', en: 'Tour stops' },
  indicators: ['concert-tours'],
  file: 'tours/{item}-stops.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.o) - Number(b.o))
      .map((p): ListRow => ({
        key: `s${p.o}`,
        title: `${p.o}. ${String(p.c ?? '')}`,
        titleProper: true,
        lines: [
          [typeof p.iso3 === 'string' ? countryName(p.iso3) : String(p.co ?? ''), String(p.v ?? '')].filter(Boolean).join(' · '),
          `${tourDates(p)} · ${showsText(Number(p.n))}`,
        ],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
      })),
};

const MONTH_AXIS = {
  label: { zh: '月份', en: 'Month' } as Text,
  year: monthName,
  tick: (m: number) => tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1]?.slice(0, 3) ?? String(m) }),
};

export const festivals: TopicDefinition = {
  id: 'festivals',
  title: { zh: '節慶', en: 'Festivals' },
  shortTitle: { zh: '節慶', en: 'Festivals' },
  defaultIndicator: 'map',
  defaultYear: 2,
  sources: [
    { name: { zh: 'Wikidata（節慶的種類、位置、舉辦的日子、名稱）', en: 'Wikidata (types, locations, dates and names of festivals)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '文化部文化資產局「文資局民俗」（台灣登錄的民俗）', en: 'Bureau of Cultural Heritage (Taiwan): registered folk customs' },
      url: 'https://data.gov.tw/dataset/114143',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: {
        zh: '英文維基百科「List of highest-grossing concert tours」（revid 1383993933）與各巡迴條目的場次表',
        en: 'English Wikipedia, “List of highest-grossing concert tours” (revision 1383993933) and each tour’s date table',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_highest-grossing_concert_tours?oldid=1383993933',
      license: { zh: 'CC BY-SA 4.0（引用事實；票房原始數字來自 Pollstar、Billboard）', en: 'CC BY-SA 4.0 (facts cited; grosses originally from Pollstar and Billboard)' },
    },
    {
      name: {
        zh: '英文維基百科「List of anime and manga conventions」（revid 1381313355，舉辦月份）與各動漫展、電玩展條目資訊框的人次',
        en: 'English Wikipedia, “List of anime and manga conventions” (revision 1381313355, months held) and attendance from each convention article’s infobox',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_anime_and_manga_conventions?oldid=1381313355',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    HOLIDAY_SOURCE,
  ],
  note: {
    zh:
      '節慶是 Wikidata 直接標成節慶或它的子類別（電影節、藝術節、嘉年華、美食節、民俗節慶…）、有位置的約 1,730 個，2026-11-04 加上標成音樂節或它的子類別（搖滾、爵士音樂節…）的 1,092 個，再加上文化資產局登錄的台灣民俗裡「儀式、祭典、節慶」類的 226 項。Wikidata 的節慶以歐美為主，音樂節九成在歐洲與北美（台灣只有春天吶喊），反映的是維基的編輯社群，不是真實的分布。Wikidata 上另有 30,110 個節慶（一半以上是電影節）與 2 個萬人場館沒有座標，沒畫在地圖上（2026-11-05 查）。' +
      '圖層選單裡有「萬人場館」（預設關閉）：Wikidata 的場館（arena）類別、容納 1 萬人以上的 431 個，多半同時是體育館；容納人數照 Wikidata，演唱會與球賽的配置可能不同。台灣的台北小巨蛋、臺北大巨蛋在 Wikidata 不屬於場館類別，另外補上。' +
      '月份用 Wikidata 的「每年發生的日子」，只有約 40 個有，多數畫在「月份不詳」的圖層（不隨時間軸變）；文資局的民俗有舉辦月份的照月份出現，農曆的月份加一個月當成大約的國曆月份。' +
      '文資局的地址只到鄉鎮市區，點在鄉鎮市區的位置（Wikidata 的座標；只寫縣市的在縣市的中間）。' +
      '左邊的清單列出那個月有月份的節慶：有固定日子的依日子排（文資局農曆的照農曆寫，依農曆的日排），其他依名稱；城市用 Wikidata 的所在行政區與文資局的地址。' +
      '2026-11-07 加：美食節的子類別（啤酒節、葡萄酒節…）原本查不到，補上並分出「美食與飲酒節」的顏色（93 個；慕尼黑啤酒節在 Wikidata 不屬於啤酒節類別，台灣沒有）；動漫展與電玩展（Wikidata，只收整個活動、不收單一屆，嚴重偏美國與歐洲，日本只有 8 個，數量跟活動的規模無關）；票房最高的巡迴演唱會（英文維基的列表與各巡迴的場次表，城市用 Wikidata 的座標，連結是重新導向的用城市名加國家名找；場次加總跟列表不同的是附加場、還沒演的場次或表格寫法不同，例如 Metallica、BTS 的巡迴還在進行，表上有已公布、還沒演的場次）。',
    en:
      'Festivals are about 1,730 Wikidata items classed as festivals or a subclass (film, arts, carnival, food, folk festivals and so on) with a location, plus, from 4 November 2026, 1,092 classed as music festivals or a subclass (rock, jazz and so on), and the 226 registered folk customs in the “rituals, ceremonies and festivals” class of Taiwan’s Bureau of Cultural Heritage. Wikidata’s festivals are mostly in Europe and the Americas, and nine in ten music festivals are in Europe and North America (Taiwan has only Spring Scream), reflecting Wikipedia’s editors rather than where festivals really happen. Another 30,110 festivals in Wikidata (over half of them film festivals) and 2 arenas have no coordinates and are not on the map (checked 2026-11-05). ' +
      'The layer menu has “Arenas for 10,000+” (off by default): 431 Wikidata arenas with a capacity of at least 10,000, mostly also sports venues; capacities follow Wikidata and may differ between concert and sports layouts. Taipei Arena and the Taipei Dome are not classed as arenas on Wikidata and are added separately. ' +
      'Months come from Wikidata’s “day in year for periodic occurrence”, which only about 40 have, so most are in the “month unknown” layer (which does not change with the slider); Taiwan’s folk customs appear in their month where it is given, with lunar months shifted by one as an approximate calendar month. ' +
      'The bureau gives only the township, so Taiwanese customs are placed at the township (Wikidata coordinates; those giving only a county at its centre). ' +
      'The list on the left shows the festivals with a known month: those with a fixed day come first in date order (Taiwanese lunar dates are written as lunar dates and ordered by the lunar day), the rest by name; places come from Wikidata’s administrative location and the bureau’s addresses. ' +
      'Added on 7 November 2026: subclasses of food festival (beer and wine festivals and so on), previously missed, now coloured as “food and drink festivals” (93; Munich’s Oktoberfest is not classed as a beer festival on Wikidata, and Taiwan has none); anime, comic and game conventions (Wikidata, whole events only rather than single editions; heavily skewed to the US and Europe – Japan has only 8 – and unrelated to the size of the events); and the highest-grossing concert tours (English Wikipedia’s list and each tour’s date table, with city coordinates from Wikidata, using the city and country names where the link is a redirect; show totals differ from the list where there are extra shows, shows not yet played or different table layouts – Metallica’s and BTS’s tours are still running and list announced future dates).',
  },
  panelExtra: () => import('./panels/FestivalsPanel'),
  listPanel: [MONTH_LIST, CON_LIST, CON_ATT_LIST, TOUR_LIST],
  overlays: [
    layer('festivals', 'festivals.json', { zh: '有月份的節慶（依月份）', en: 'Festivals with a month (by month)' }, true),
    layer('festivals-undated', 'festivals-undated.json', { zh: '月份不詳的節慶', en: 'Festivals, month unknown' }, false),
    ARENAS,
    CONVENTIONS,
    TOUR_ROUTE,
    TOUR_STOPS,
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '節慶地圖', en: 'Festival map' },
      description: {
        zh: '世界的節慶，依種類上色：傳統與民俗節慶、音樂節、電影節、藝術節、嘉年華、美食與飲酒節（含啤酒節、葡萄酒節）。拖動月份看那個月舉辦的（只有有月份的會跟著變，台灣的民俗大多有）；小點是月份不詳的。台灣有大甲媽祖遶境進香、鷄籠中元祭、東港迎王平安祭典、鄒族戰祭等文化資產局登錄的民俗。滑過看名稱，點國家列出它的節慶；左邊的清單列出那個月的節慶與日期。',
        en: 'Festivals around the world, coloured by type: traditional and folk festivals, music, film and arts festivals, carnivals, and food and drink festivals (including beer and wine festivals). Move the month slider to see what happens in each month (only festivals with a known month change, which includes most of Taiwan’s folk customs); small dots have no known month. Taiwan’s registered folk customs include the Dajia Mazu pilgrimage, the Keelung Ghost Festival, the Donggang King Boat Festival and the Tsou Mayasvi. Hover for names; select a country for its list. The list on the left shows that month’s festivals and their dates.',
      },
      unit: { zh: '個', en: 'festivals' },
      file: 'count.json',
      layer: { kind: 'none' },
      timeAxis: MONTH_AXIS,
      format: (v) => tr({ zh: `${fixed(v, 0)} 個節慶`, en: `${fixed(v, 0)} festivals` }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'conventions',
      label: { zh: '動漫展與電玩展', en: 'Anime, comic and game conventions' },
      description: {
        zh: 'Wikidata 收錄、找得到地點的 233 個動漫展、同人誌販售會、漫畫展、電玩展與其他同好大會，依種類上色，拖時間軸看它們依創辦年一個一個出現：盧卡國際漫畫節 1965 年、Gen Con 1968 年、聖地牙哥國際動漫展 1969 年最早。美國 77 個最多，德國 18、義大利 17、法國 17、西班牙 15；維基百科條目最多的是聖地牙哥國際動漫展、東京電玩展、安古蘭國際漫畫節、Comic Market、Gamescom。台灣有台北國際電玩展（2003 年起）、開拓動漫祭、台灣同人誌販售會、台北國際動漫節（Wikidata 沒有地點，畫在台北市）。左邊的清單依維基百科的語言數，另一頁依人次：78 個有人次（多半是英文維基各條目資訊框寫的，年份不一），羅馬的 Romics 寫 40 萬（沒寫年份），台北國際電玩展 2025 年 37 萬、Gamescom 2025 年 35.7 萬、東京電玩展 2025 年 26.3 萬；Comic Market 條目寫的是疫情期間 2021 年 12 月的 11 萬。舉辦月份只有英文維基的動漫展清單有寫，40 個對得到，寫在說明。',
        en: 'The 233 anime conventions, dōjinshi fairs, comic conventions, game conventions and other fan conventions in Wikidata with a known location, coloured by type; drag the time slider to watch them appear by founding year – Lucca Comics & Games in 1965, Gen Con in 1968 and San Diego Comic-Con in 1969 are the oldest. The US has the most with 77, then Germany 18, Italy 17, France 17 and Spain 15; those with the most Wikipedia editions are San Diego Comic-Con, Tokyo Game Show, the Angoulême International Comics Festival, Comic Market and Gamescom. Taiwan has the Taipei Game Show (since 2003), Fancy Frontier, Comic World Taiwan and the Taipei International Comics & Animation Festival (no venue on Wikidata, so placed at Taipei). The list on the left ranks them by Wikipedia editions, and a second tab by attendance: 78 have a figure (mostly from the infoboxes of English Wikipedia articles, for varying years). Rome’s Romics gives 400,000 (no year), the Taipei Game Show 370,000 in 2025, Gamescom 357,000 in 2025 and the Tokyo Game Show 263,000 in 2025; the Comic Market article gives 110,000 for the pandemic-era December 2021 edition. Months held are only given in English Wikipedia’s list of anime conventions; 40 are matched and shown in the tooltip.',
      },
      unit: { zh: '個', en: '' },
      file: 'conventions-count.json',
      layer: { kind: 'none' },
      timeAxis: { label: { zh: '創辦年', en: 'Founded' }, year: (y: number) => tr({ zh: `${y} 年`, en: String(y) }), tick: (y: number) => String(y) },
      defaultYear: 2026,
      format: (v) => tr({ zh: `到這一年創辦了 ${fixed(v, 0)} 個`, en: `${fixed(v, 0)} founded by this year` }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'concert-tours',
      label: { zh: '票房最高的巡迴演唱會', en: 'Highest-grossing concert tours' },
      description: {
        zh: '英文維基「票房最高的巡迴演唱會」全時期前 20 名（依實際票房），子項目選一個巡迴，看它依日期走過的路線與每一站，國家的比例圓是那個巡迴在這國演了幾場。第一名 Taylor Swift《The Eras Tour》2023–2024 年 149 場、20.8 億美元，51 站、19 國；Coldplay《Music of the Spheres》2022–2025 年 223 場、41 國，2023 年 11 月在高雄國家體育場 2 場。台灣有 Coldplay 的高雄、桃園場，Ed Sheeran 的高雄、桃園場，Guns N’ Roses 的桃園場，BTS《Arirang》2026 年 11 月的高雄場。左邊依順序列出每一站。',
        en: 'The top 20 concert tours of all time by actual gross, from English Wikipedia’s “List of highest-grossing concert tours”. Choose a tour to see its route by date and each stop; country bubbles are the number of shows the tour played there. The top tour, Taylor Swift’s Eras Tour, played 149 shows in 2023–2024 and grossed US$2.08 billion across 51 stops in 19 countries; Coldplay’s Music of the Spheres played 223 shows in 41 countries in 2022–2025, including two at Kaohsiung National Stadium in November 2023. Taiwan hosted Coldplay in Kaohsiung and Taoyuan, Ed Sheeran in Kaohsiung and Taoyuan, Guns N’ Roses in Taoyuan, and BTS’s Arirang tour in Kaohsiung in November 2026. The list on the left shows every stop in order.',
      },
      unit: { zh: '場', en: 'shows' },
      file: 'tours/{item}-count.json',
      dimension: { label: { zh: '巡迴', en: 'Tour' }, options: TOURS, defaultOption: 't1' },
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => showsText(v),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      missing: { zh: '這個巡迴沒有來', en: 'The tour did not play here' },
    },
    // 2026-11-07（製作手冊第二十七批 559）：節日在哪些國家放假、假日跟著哪一本曆走（festivals-holidays.ts）
    ...HOLIDAY_INDICATORS,
  ],
};
