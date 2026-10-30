import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { f1Part } from './f1';
import type { ColorClasses, DimensionDef, IndicatorDef, LinesOverlayDef, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 賽車（2026-10-30，製作手冊第九批順序 160，pipeline/topics/racing.py）：各類賽事今年（2026）的地點與日期，
 * 加上歷年辦過的地點與次數。F1 的累計分站數、車手冠軍（f1.ts，Jolpica 只准非商業）從「運動」搬過來。
 * 舊網址 t/f1/ 與 t/sports/?ind=races|champions 轉到這裡（redirects.ts）。
 */

/** 賽事：代碼（資料檔的 s 欄位）、名稱；代碼依顏色分組排好（SERIES_COLORS 的門檻） */
export const SERIES: { id: string; code: number; label: Text; short: Text }[] = [
  { id: 'f1', code: 1, label: { zh: 'F1 一級方程式', en: 'Formula One' }, short: { zh: 'F1', en: 'F1' } },
  { id: 'fe', code: 2, label: { zh: 'Formula E 電動方程式', en: 'Formula E' }, short: { zh: 'Formula E', en: 'Formula E' } },
  { id: 'wec', code: 3, label: { zh: 'WEC 世界耐力錦標賽', en: 'FIA World Endurance Championship' }, short: { zh: 'WEC', en: 'WEC' } },
  { id: 'indycar', code: 4, label: { zh: 'IndyCar', en: 'IndyCar Series' }, short: { zh: 'IndyCar', en: 'IndyCar' } },
  { id: 'nascar', code: 5, label: { zh: 'NASCAR Cup', en: 'NASCAR Cup Series' }, short: { zh: 'NASCAR', en: 'NASCAR' } },
  { id: 'wrc', code: 6, label: { zh: 'WRC 世界拉力錦標賽', en: 'World Rally Championship' }, short: { zh: 'WRC', en: 'WRC' } },
  { id: 'motogp', code: 7, label: { zh: 'MotoGP（含 Moto2、Moto3）', en: 'MotoGP (with Moto2 and Moto3)' }, short: { zh: 'MotoGP', en: 'MotoGP' } },
  { id: 'xc', code: 8, label: { zh: '登山車世界盃：越野', en: 'MTB World Cup: cross-country' }, short: { zh: '登山車越野', en: 'MTB XC' } },
  { id: 'dh', code: 9, label: { zh: '登山車世界盃：速降', en: 'MTB World Cup: downhill' }, short: { zh: '登山車速降', en: 'MTB DH' } },
  { id: 'mega', code: 10, label: { zh: '超級雪崩（阿爾普迪埃、留尼旺）', en: 'Megavalanche (Alpe d’Huez, Réunion)' }, short: { zh: '超級雪崩', en: 'Megavalanche' } },
  { id: 'moh', code: 11, label: { zh: '地獄山（雙阿爾卑斯）', en: 'Mountain of Hell (Les 2 Alpes)' }, short: { zh: '地獄山', en: 'Mountain of Hell' } },
  { id: 'tdf', code: 12, label: { zh: '環法自由車賽', en: 'Tour de France' }, short: { zh: '環法', en: 'Tour de France' } },
  { id: 'giro', code: 13, label: { zh: '環義自由車賽', en: 'Giro d’Italia' }, short: { zh: '環義', en: 'Giro' } },
  { id: 'vuelta', code: 14, label: { zh: '環西自由車賽', en: 'Vuelta a España' }, short: { zh: '環西', en: 'Vuelta' } },
];
const BY_CODE = new Map(SERIES.map((s) => [s.code, s]));
export const seriesOf = (code: unknown) => BY_CODE.get(Number(code));
const TOUR_CODES = new Set([12, 13, 14]);

/** 顏色依類別分 7 組（點的 s 欄位）：同一組的賽事同一個顏色，子項目可以只看一種賽事 */
const SERIES_COLORS: ColorClasses = {
  field: 's',
  title: { zh: '賽事', en: 'Event' },
  thresholds: [1.5, 5.5, 6.5, 7.5, 9.5, 11.5],
  classes: [
    { color: MAP_TOKENS.hues.red, label: { zh: 'F1', en: 'Formula One' } },
    { color: MAP_TOKENS.hues.orange, label: { zh: '其他場地賽車（Formula E、WEC、IndyCar、NASCAR）', en: 'Other circuit racing (Formula E, WEC, IndyCar, NASCAR)' } },
    { color: MAP_TOKENS.hues.yellow, label: { zh: '拉力賽（WRC）', en: 'Rally (WRC)' } },
    { color: MAP_TOKENS.hues.blue, label: { zh: '機車（MotoGP）', en: 'Motorcycles (MotoGP)' } },
    { color: MAP_TOKENS.hues.green, label: { zh: '登山車世界盃', en: 'MTB World Cup' } },
    { color: MAP_TOKENS.hues.aqua, label: { zh: '大眾速降（超級雪崩、地獄山）', en: 'Mass-start downhill (Megavalanche, Mountain of Hell)' } },
    { color: MAP_TOKENS.hues.violet, label: { zh: '公路自行車三大環賽', en: 'Grand Tours (road cycling)' } },
  ],
};

const n0 = (v: number) => fixed(v, 0);
const eventsText = (v: number) => tr({ zh: `${n0(v)} 場`, en: `${n0(v)} ${Math.round(v) === 1 ? 'event' : 'events'}` });
const timesText = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'time' : 'times'}` });

// ── 月份（時間軸的「年份」是月份的編號：2000 年 1 月是 0，同「各國在讀什麼」） ──
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = (index: number) => ({ year: 2000 + Math.floor(index / 12), month: (index % 12) + 1 });
export const monthText = (index: number) => {
  const { year, month } = monthOf(index);
  return tr({ zh: `${year} 年 ${month} 月`, en: `${MONTHS_EN[month - 1]} ${year}` });
};
const monthShort = (index: number) => {
  const { year, month } = monthOf(index);
  return getLang() === 'en' ? `${MONTHS_EN[month - 1].slice(0, 3)} ${year}` : `${year}/${month}`;
};
/** 資料的最後一天（pipeline 的 AS_OF）：這一天以前結束的站算比完 */
export const AS_OF = { zh: '2026 年 10 月 30 日', en: '30 October 2026' };
const OCTOBER_2026 = (2026 - 2000) * 12 + 9;

/** YYYYMMDD 的整數 → 「7 月 4 日」「4 July」；兩個日期 → 「7 月 4–5 日」「4–5 July」 */
export function dateText(d0: number, d1?: number): string {
  const m0 = Math.floor(d0 / 100) % 100;
  const day0 = d0 % 100;
  if (!d1 || d1 === d0) return tr({ zh: `${m0} 月 ${day0} 日`, en: `${day0} ${MONTHS_EN[m0 - 1]}` });
  const m1 = Math.floor(d1 / 100) % 100;
  const day1 = d1 % 100;
  if (m0 === m1) return tr({ zh: `${m0} 月 ${day0}–${day1} 日`, en: `${day0}–${day1} ${MONTHS_EN[m0 - 1]}` });
  return tr({ zh: `${m0} 月 ${day0} 日–${m1} 月 ${day1} 日`, en: `${day0} ${MONTHS_EN[m0 - 1]} – ${day1} ${MONTHS_EN[m1 - 1]}` });
}
const yearOf = (d: number) => Math.floor(d / 10000);

/** 一站的名稱：「F1 第 3 站」「環法第 19 賽段」「登山車世界盃：越野 第 2 站（XCO、XCC）」 */
export function roundText(p: PointRecord): string {
  const s = seriesOf(p.s);
  const name = s ? tr(s.short) : '';
  const rnd = p.rnd ? String(p.rnd) : '';
  if (!rnd) return name;
  if (TOUR_CODES.has(Number(p.s))) return tr({ zh: `${name}第 ${rnd} 賽段`, en: `${name} stage ${rnd}` });
  const fmt = typeof p.fmt === 'string' && p.fmt !== 'x' ? ` (${p.fmt.replace('+', ', ')})` : '';
  return tr({ zh: `${name} 第 ${rnd} 站${fmt ? `（${String(p.fmt).replace('+', '、')}）` : ''}`, en: `${name} round ${rnd}${fmt}` });
}

/** 比完、還沒比、取消 */
export function statusText(p: PointRecord): string {
  if (p.fmt === 'x') return tr({ zh: '取消（天候）', en: 'cancelled (weather)' });
  return p.done ? tr({ zh: '已經比完', en: 'held' }) : tr({ zh: '還沒比', en: 'upcoming' });
}

function seasonTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const tour = TOUR_CODES.has(Number(p.s));
  const where = tour
    ? tr({ zh: `${String(p.from ?? '')} → ${String(p.venue ?? '')}`, en: `${String(p.from ?? '')} → ${String(p.venue ?? '')}` })
    : [String(p.venue ?? ''), p.place && !String(p.venue).includes(String(p.place)) ? String(p.place) : ''].filter(Boolean).join(', ');
  const year = yearOf(Number(p.d0));
  return {
    title: roundText(p),
    detail: `${dateText(Number(p.d0), Number(p.d1))}${year !== 2026 ? ` ${year}` : ''} · ${statusText(p)}`,
    extra: [[where, typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : ''].filter(Boolean).join(' · ')],
    properNoun: typeof p.name === 'string' && p.name ? p.name : undefined,
  };
}

function venueTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const span = p.first == null ? '' : p.first === p.last ? `${p.first}` : `${p.first}–${p.last}`;
  // 全部的賽事：同一個地方的各賽事併成一個點，mix 是「代碼:次數:名稱|…」
  const parts =
    typeof p.mix === 'string'
      ? p.mix.split('|').map((x) => {
          const [code, n, ...name] = x.split(':');
          const label = `${tr(seriesOf(code)?.short ?? { zh: '', en: '' })} ${timesText(Number(n))}`;
          return tr({ zh: `${label}（${name.join(':')}）`, en: `${label} (${name.join(':')})` });
        })
      : [];
  return {
    title: typeof p.mix === 'string' ? tr({ zh: '好幾種賽事', en: 'Several events' }) : tr(seriesOf(p.s)?.label ?? { zh: '', en: '' }),
    detail: [tr({ zh: `辦過 ${n0(Number(p.n))} 次`, en: `Held ${timesText(Number(p.n))}` }) + (span ? ` (${span})` : ''),
      typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : ''].filter(Boolean).join(' · '),
    extra: parts,
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

// ── 子項目：全部或一種賽事 ──
const GROUPS: Record<string, Text> = {
  car: { zh: '汽車', en: 'Cars' },
  moto: { zh: '機車', en: 'Motorcycles' },
  bike: { zh: '自行車', en: 'Bicycles' },
};
const groupOf = (code: number) => (code <= 6 ? GROUPS.car : code === 7 ? GROUPS.moto : GROUPS.bike);
const ALL = { id: 'all', label: { zh: '全部賽事', en: 'All events' } };
const SEASON_DIMENSION: DimensionDef = {
  label: { zh: '賽事', en: 'Event' },
  options: [ALL, ...SERIES.map((s) => ({ id: s.id, label: s.label, group: groupOf(s.code) }))],
  defaultOption: 'all',
};
/** 有歷年列表的賽事（pipeline 的 _history）；其他的只有今年 */
const HISTORY = ['f1', 'fe', 'wec', 'indycar', 'wrc', 'motogp', 'mega', 'moh', 'tdf', 'giro', 'vuelta'];
const VENUES_DIMENSION: DimensionDef = {
  label: { zh: '賽事', en: 'Event' },
  options: [ALL, ...SERIES.filter((s) => HISTORY.includes(s.id)).map((s) => ({ id: s.id, label: s.label, group: groupOf(s.code) }))],
  defaultOption: 'all',
};

// ── 疊加圖層：今年的點（比完的實心、還沒比的空心）、環賽的賽段連線、歷年的地點 ──
const DOT_RADIUS = 4.2;
const seasonLayer = (id: string, indicator: string, done: boolean, monthly: boolean): PointsOverlayDef => ({
  kind: 'points',
  id,
  file: 'season/{item}.json',
  label: done
    ? { zh: `已經比完（到 ${AS_OF.zh}）`, en: `Held (to ${AS_OF.en})` }
    : { zh: '還沒比（空心）', en: 'Upcoming (hollow)' },
  ...(done ? {} : { look: 'hollow' as const }),
  radius: DOT_RADIUS,
  color: SERIES_COLORS,
  sortField: 's',
  minValue: { field: done ? 'done' : 'todo', stops: [[0, 1]] },
  ...(monthly ? { timeField: 'm' } : {}),
  indicators: [indicator],
  tooltip: seasonTooltip,
});
const stagesLayer = (id: string, indicator: string, monthly: boolean): LinesOverlayDef => ({
  kind: 'lines',
  id,
  file: 'stages/{item}.json',
  label: { zh: '環賽的賽段（起點到終點的直線）', en: 'Grand Tour stages (straight start–finish lines)' },
  width: 1.4,
  color: {
    classes: SERIES.filter((s) => TOUR_CODES.has(s.code)).map((s) => ({ value: s.code, color: MAP_TOKENS.hues.violet, label: s.short })),
  },
  keyClasses: false,
  opacity: 0.7,
  ...(monthly ? { timeField: 'm' } : {}),
  indicators: [indicator],
  items: ['all', 'tdf', 'giro', 'vuelta'],
  tooltip: (p) => ({
    title: roundText(p),
    detail: `${dateText(Number(p.d0))} · ${p.done ? tr({ zh: '已經比完', en: 'held' }) : tr({ zh: '還沒比', en: 'upcoming' })}`,
    extra: [`${String(p.from ?? '')} → ${String(p.to ?? '')}`],
  }),
});

const VENUE_SIZES: [number, number][] = [[1, 2.4], [5, 3.6], [20, 5.5], [60, 8], [130, 10.5]];

const SEASON_NOTE: Text = {
  zh: '同一個週末同一個場地的比賽算一站（MotoGP 與 Moto2、Moto3，Formula E、IndyCar 的兩場，登山車的 XCO 與 XCC）；三大環賽的每一個賽段是一個點（畫在終點），國家的「場數」裡一個環賽經過這個國家算一場（起點或終點在這個國家的賽段）。',
  en: 'Races at the same venue on the same weekend count as one event (MotoGP with Moto2 and Moto3, Formula E and IndyCar double-headers, MTB XCO and XCC); each Grand Tour stage is a dot at its finish, and in the country counts a Grand Tour counts once for each country it visits (a stage starting or finishing there).',
};

const indicators: IndicatorDef[] = [
  {
    id: 'season',
    label: { zh: '今年的賽程', en: '2026 calendar' },
    description: {
      zh: `今年（2026）各種賽事的每一站：顏色是賽事的類別，實心是到 ${AS_OF.zh}已經比完的，空心是還沒比的；三大環賽的線是每個賽段起點到終點的直線（不是實際路線）。滑到國家上看今年辦幾場。${SEASON_NOTE.zh}可以用「賽事」只看一種。`,
      en: `Every round of each event in 2026: colour shows the kind of event; filled dots were held by ${AS_OF.en} and hollow ones are still to come. Grand Tour lines join each stage’s start and finish in a straight line (not the actual route). Hover over a country for its number of events this year. ${SEASON_NOTE.en} Use “Event” to show a single series.`,
    },
    unit: { zh: '場', en: 'events' },
    file: 'season-count/{item}.json',
    // 點是主角：國家不上色（面量圖的橘色會蓋過賽事的顏色），場數給 tooltip、排名表
    layer: { kind: 'none' },
    format: eventsText,
    formatTick: n0,
    integer: true,
    timeless: true,
    dimension: SEASON_DIMENSION,
    missing: { zh: '今年沒有這些賽事', en: 'No events this year' },
  },
  {
    id: 'month',
    label: { zh: '每月賽程', en: 'Calendar by month' },
    description: {
      zh: `拖時間軸看每個月在哪裡比賽（從 2025 年 12 月 Formula E 的開季站到 2026 年 12 月）；實心是到 ${AS_OF.zh}已經比完的，空心是還沒比的。滑到國家上看那個月開始的場數。${SEASON_NOTE.zh}`,
      en: `Drag the time slider to see where racing happens each month (from Formula E’s season opener in December 2025 to December 2026); filled dots were held by ${AS_OF.en}, hollow ones are still to come. Hover over a country for the events starting that month. ${SEASON_NOTE.en}`,
    },
    unit: { zh: '場', en: 'events' },
    file: 'month-count/{item}.json',
    layer: { kind: 'none' },
    format: eventsText,
    formatTick: n0,
    integer: true,
    timeAxis: { label: { zh: '月份', en: 'Month' }, year: monthText, tick: monthShort },
    defaultYear: OCTOBER_2026,
    dimension: SEASON_DIMENSION,
    missing: { zh: '這個月沒有比賽', en: 'No events this month' },
  },
  {
    id: 'venues',
    label: { zh: '歷年辦過的地點', en: 'Venues over the years' },
    description: {
      zh: '各賽事歷年辦過的地方，點的大小是辦過幾次，滑到國家上看合計的次數。次數照各列表的算法：F1 是分站（1950 年起，Jolpica）、MotoGP 是在這條賽道辦的大獎賽（1949 年起）、WRC 是拉力賽，畫在總部的城鎮（1973 年起）、Formula E 是比過的場數（2014 年起，畫在 ePrix 的地點）、WEC 是比過的賽季數（2012 年起）、IndyCar 是場數（1996 年 IRL 起，不含更早的 CART 等）、三大環賽只有開幕站（環法 1903 年起、環義 1909 年起、環西 1935 年起）、超級雪崩是兩站各自辦過的年份（阿爾普迪埃、留尼旺都是 1995 年起，取消的年份不算）、地獄山是辦過的屆數（2000 年起）。NASCAR（列表只有比賽名稱、沒有場數）、登山車世界盃（沒有歷年場地的列表）只有今年。',
      en: 'Places each event has been held, with dots sized by the number of times; hover over a country for its total. Counts follow each list: Formula One races (since 1950, Jolpica), MotoGP Grands Prix at each circuit (since 1949), WRC rallies placed at their headquarters town (since 1973), Formula E races (since 2014, at the ePrix location), WEC seasons (since 2012), IndyCar races (since the IRL in 1996, not earlier CART and other eras), Grand Tour openings only (Tour de France since 1903, Giro since 1909, Vuelta since 1935), Megavalanche editions at each of its two venues (Alpe d’Huez and Réunion, both since 1995, cancelled years not counted) and Mountain of Hell editions (since 2000). NASCAR (its list gives race names, not counts) and the MTB World Cup (no list of past venues) appear only in this year’s calendar.',
    },
    unit: { zh: '次', en: 'times' },
    file: 'venues-count/{item}.json',
    layer: { kind: 'none' },
    format: timesText,
    formatTick: n0,
    integer: true,
    shareOfWorld: true,
    timeless: true,
    dimension: VENUES_DIMENSION,
    missing: { zh: '沒有辦過這些賽事', en: 'Has not hosted these events' },
  },
  ...f1Part.indicators,
];

export const racing: TopicDefinition = {
  id: 'racing',
  title: { zh: '賽車', en: 'Racing' },
  shortTitle: { zh: '賽車', en: 'Racing' },
  defaultIndicator: 'season',
  defaultYear: 2026,
  // 賽事大多在歐洲與美國：打開時對著北大西洋兩岸（預設以台灣為中心的地球儀幾乎看不到）
  focus: [-125, -15, 45, 62],
  sources: [
    {
      name: {
        zh: '英文維基百科 2026 年各賽季條目（F1、MotoGP、WRC、WEC、Formula E 2025–26、IndyCar、NASCAR Cup、UCI 登山車世界盃、環法、環義、環西）與 Megavalanche 條目，固定版本',
        en: 'English Wikipedia 2026 season articles (Formula One, MotoGP, WRC, WEC, Formula E 2025–26, IndyCar, NASCAR Cup, UCI Mountain Bike World Cup, Tour de France, Giro d’Italia, Vuelta a España) and the Megavalanche article, fixed revisions',
      },
      url: 'https://en.wikipedia.org/wiki/2026_in_motorsport',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科歷年列表：List of Grand Prix motorcycle circuits、List of World Rally Championship rallies、List of Formula E ePrix、FIA World Endurance Championship、List of IndyCar Series racetracks、List of Tour de France Grands Départs、List of Giro d’Italia starts、List of Vuelta a España Gran Partidas，固定版本',
        en: 'English Wikipedia lists: List of Grand Prix motorcycle circuits, List of World Rally Championship rallies, List of Formula E ePrix, FIA World Endurance Championship, List of IndyCar Series racetracks, List of Tour de France Grands Départs, List of Giro d’Italia starts, List of Vuelta a España Gran Partidas (fixed revisions)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_Grand_Prix_motorcycle_circuits',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（賽道、城鎮的座標）', en: 'Wikidata (coordinates of circuits and towns)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    ...f1Part.sources,
  ],
  note: {
    zh: `今年的賽程到 ${AS_OF.zh}：取消的站不畫（F1 的沙烏地阿拉伯站；巴林站改在馬來西亞的雪邦辦），環西第 3 賽段因天候取消但照樣畫出來、寫「取消」。Formula E 的賽季跨年（2025–26 年，2025 年 12 月的聖保羅開季站也算）。地獄山、超級雪崩沒有賽季條目，日期與地點是自己核對主辦單位公布的整理（地獄山：雙阿爾卑斯觀光局的新聞稿，6 月 18–21 日；超級雪崩：主辦單位 UCC Sport Event 的賽事頁，阿爾普迪埃 7 月 10–12 日、留尼旺的聖保羅 11 月 22 日；只用事實，沒有轉載文字）。超級雪崩的歷年是 Megavalanche 條目兩站的成績表，取消的年份不算（兩站的 2020 年疫情、留尼旺 2018 年黃背心運動）；地獄山的歷年依觀光局 2025 年的新聞稿（2000 年起，2025 年是第 24 屆，2024 年沒有辦）加上 2026 年，共 25 屆（2026 年的新聞稿寫第 26 屆，跟前一年的算法差一屆）。各站名稱、場地照維基百科的英文原文。台灣沒有辦過這些賽事，也沒有為了台灣另外加賽事。F1：${f1Part.note.zh} 維基百科的資料檔依 CC BY-SA 4.0 分享。`,
    en: `This year’s calendar runs to ${AS_OF.en}. Cancelled rounds are not shown (Formula One’s Saudi Arabian Grand Prix; the Bahrain Grand Prix moved to Sepang, Malaysia); Vuelta stage 3, cancelled for weather, is shown and marked as cancelled. The Formula E season spans two years (2025–26, including the São Paulo opener in December 2025). Mountain of Hell and Megavalanche have no season articles; their dates and places were compiled from the organisers’ announcements (Mountain of Hell: Les 2 Alpes tourist office press release, 18–21 June; Megavalanche: organiser UCC Sport Event’s event pages, 10–12 July at Alpe d’Huez and 22 November at Saint-Paul, Réunion; facts only, no text reproduced). Megavalanche’s past editions come from the results tables of the Megavalanche article for both venues, excluding cancelled years (2020 at both for the pandemic, 2018 in Réunion for the yellow vests protests); Mountain of Hell’s follow the tourist office’s 2025 press release (held since 2000, 2025 was the 24th edition, none in 2024) plus 2026, 25 editions in all (the 2026 release calls it the 26th, one more than the previous year’s count). Event and venue names are as in English Wikipedia. Taiwan hosts none of these events, and none were added for Taiwan. Formula One: ${f1Part.note.en} Data files derived from Wikipedia are shared under CC BY-SA 4.0.`,
  },
  panelExtra: () => import('./panels/RacingPanel'),
  overlays: [
    seasonLayer('season-done', 'season', true, false),
    seasonLayer('season-todo', 'season', false, false),
    stagesLayer('season-stages', 'season', false),
    seasonLayer('month-done', 'month', true, true),
    seasonLayer('month-todo', 'month', false, true),
    stagesLayer('month-stages', 'month', true),
    {
      kind: 'points',
      id: 'venues',
      file: 'venues/{item}.json',
      label: { zh: '辦過的地點', en: 'Venues' },
      radius: { field: 'n', stops: VENUE_SIZES },
      color: SERIES_COLORS,
      indicators: ['venues'],
      sizeLegend: { title: { zh: '辦過的次數', en: 'Times held' }, values: [5, 30, 100], format: n0 },
      tooltip: venueTooltip,
    },
    ...f1Part.overlays,
  ],
  indicators,
};
