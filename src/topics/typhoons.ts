import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';

/**
 * 颱風與颶風（pipeline/topics/typhoons.py，資料是 NOAA IBTrACS v04r01）。
 * 地圖上是颱風路徑的線圖層（tracks.json）：一個颱風一條線，依每個時間點的強度分段上色，跟著時間軸篩選
 * （當年，或每十年的指標的那十年）。風速一律是美國機構（NHC、CPHC、JTWC）的 1 分鐘平均風速，
 * 強度用薩菲爾－辛普森颶風等級；國家的統計是颱風中心進入國界或離國界 100 公里以內、風速達熱帶風暴以上的次數。
 */

const n0 = (v: number) => fixed(v, 0);

/** 強度代碼：pipeline/topics/typhoons.py 的 UNKNOWN…C5（tracks.json 的 vertexTypes、cat，strongest-decade.json 的值） */
export const CLASS = { unknown: 0, other: 1, td: 2, ts: 3, c1: 4, c2: 5, c3: 6, c4: 7, c5: 8 } as const;

/** 等級的短名稱（tooltip、側欄、「最強的颱風」的類別名稱） */
const CLASS_NAMES: Record<number, Text> = {
  [CLASS.unknown]: { zh: '強度不明', en: 'Intensity unknown' },
  [CLASS.other]: { zh: '非熱帶氣旋', en: 'Non-tropical' },
  [CLASS.td]: { zh: '熱帶性低氣壓', en: 'Tropical depression' },
  [CLASS.ts]: { zh: '熱帶風暴', en: 'Tropical storm' },
  [CLASS.c1]: { zh: '1 級', en: 'Category 1' },
  [CLASS.c2]: { zh: '2 級', en: 'Category 2' },
  [CLASS.c3]: { zh: '3 級', en: 'Category 3' },
  [CLASS.c4]: { zh: '4 級', en: 'Category 4' },
  [CLASS.c5]: { zh: '5 級', en: 'Category 5' },
};

export function className(code: number | string | null): string {
  return typeof code === 'number' && CLASS_NAMES[code] ? tr(CLASS_NAMES[code]) : tr(CLASS_NAMES[CLASS.unknown]);
}

/** 薩菲爾－辛普森等級的下限（kt）：熱帶風暴、1–5 級 */
const SSHS_KT = [34, 64, 83, 96, 113, 137];

/** 風速（kt）→ 等級代碼 */
export function windClass(kt: number): number {
  return CLASS.td + SSHS_KT.filter((t) => kt >= t).length;
}

/** 風速：中文用公尺/秒（中央氣象署的寫法）附上節，英文用 kt。1 kt = 0.514444 m/s */
export function windText(kt: number): string {
  return tr({ zh: `${n0(kt * 0.514444)} 公尺/秒（${n0(kt)} 節）`, en: `${n0(kt)} kt` });
}

/** 颱風的種類：西北太平洋是颱風，大西洋與東太平洋是颶風，印度洋與南太平洋是氣旋 */
export function stormWord(basin: string | number | null): string {
  if (basin === 'WP') return tr({ zh: '颱風', en: 'Typhoon' });
  if (basin === 'NA' || basin === 'EP') return tr({ zh: '颶風', en: 'Hurricane' });
  return tr({ zh: '氣旋', en: 'Cyclone' });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 月 × 100 + 日（UTC）→「7/24」或「Jul 24」 */
export function monthDay(md: number): string {
  const month = Math.floor(md / 100);
  const day = md % 100;
  return getLang() === 'en' ? `${MONTHS[month - 1]} ${day}` : `${month}/${day}`;
}

/** 起訖日期：「7/20–7/29」，同一天只寫一次 */
export function dateRange(md0: number, md1: number): string {
  return md0 === md1 ? monthDay(md0) : `${monthDay(md0)}–${monthDay(md1)}`;
}

/** 路徑的 tooltip：中文「凱米（2024 年）」，英文「Gaemi (2024)」；第二行巔峰強度、最低氣壓、起訖日期 */
function trackTooltip(p: PointRecord) {
  const year = p.year as number;
  const name = typeof p.name === 'string' ? p.name : null;
  const zh = typeof p.zh === 'string' ? p.zh : null;
  const parts: string[] = [];
  if (typeof p.wind === 'number') {
    parts.push(tr({ zh: `巔峰 ${className(p.cat)}，${windText(p.wind)}`, en: `Peak ${className(p.cat)}, ${windText(p.wind)}` }));
  } else {
    parts.push(className(CLASS.unknown));
  }
  if (typeof p.pres === 'number') parts.push(tr({ zh: `最低氣壓 ${n0(p.pres)} hPa`, en: `${n0(p.pres)} hPa` }));
  if (typeof p.md0 === 'number' && typeof p.md1 === 'number') parts.push(`${dateRange(p.md0, p.md1)} UTC`);
  if (p.prov) parts.push(tr({ zh: '即時資料，尚未重新分析', en: 'provisional data' }));
  return {
    title: tr({
      zh: `${zh ?? stormWord(p.basin)}（${year} 年）`,
      en: `${name ?? `Unnamed ${stormWord(p.basin).toLowerCase()}`} (${year})`,
    }),
    detail: parts.join(' · '),
    // 中文介面把英文原名另外寫一行（translate="no"）；英文介面的標題就是原名
    properNoun: getLang() === 'zh' ? (name ?? undefined) : undefined,
  };
}

/**
 * 路徑的顏色：熱帶性低氣壓到 5 級是 MAP_TOKENS 的 7 級橘色循序色（越強越深），跟「最強的颱風」的國家顏色一致；
 * 非熱帶的階段（溫帶、副熱帶氣旋、擾動）是灰色虛線，沒有風速的是灰色實線（深色底圖上換成淺灰）。
 * 圖例由強到弱排；代碼大的畫在上面（sortByType），強的那段不會被弱的蓋住。
 */
const SEQ = MAP_TOKENS.sequential;
const TRACK_CLASSES = [
  { value: CLASS.c5, color: SEQ[6], label: { zh: '5 級（70 公尺/秒以上）', en: 'Category 5 (137 kt or more)' } },
  { value: CLASS.c4, color: SEQ[5], label: { zh: '4 級（58–70 公尺/秒）', en: 'Category 4 (113–136 kt)' } },
  { value: CLASS.c3, color: SEQ[4], label: { zh: '3 級（50–58 公尺/秒）', en: 'Category 3 (96–112 kt)' } },
  { value: CLASS.c2, color: SEQ[3], label: { zh: '2 級（43–49 公尺/秒）', en: 'Category 2 (83–95 kt)' } },
  { value: CLASS.c1, color: SEQ[2], label: { zh: '1 級（33–42 公尺/秒）', en: 'Category 1 (64–82 kt)' } },
  { value: CLASS.ts, color: SEQ[1], label: { zh: '熱帶風暴（18–32 公尺/秒）', en: 'Tropical storm (34–63 kt)' } },
  { value: CLASS.td, color: SEQ[0], label: { zh: '熱帶性低氣壓（17 公尺/秒以下）', en: 'Tropical depression (under 34 kt)' } },
  {
    value: CLASS.other,
    color: MAP_TOKENS.inkMuted,
    dash: true,
    label: { zh: '溫帶、副熱帶氣旋或擾動', en: 'Extratropical, subtropical or disturbance' },
  },
  {
    value: CLASS.unknown,
    color: MAP_TOKENS.inkMuted,
    label: { zh: '強度不明（沒有美國機構的風速）', en: 'Intensity unknown (no US wind data)' },
  },
];

/** 等級的顏色（側欄的色塊跟地圖上的路徑一致） */
export function classColor(code: number): string {
  return TRACK_CLASSES.find((c) => c.value === code)?.color ?? MAP_TOKENS.inkMuted;
}

const STORMS_UNIT = { zh: '個', en: 'storms' };
const storms = (v: number) =>
  tr({ zh: `${n0(v)} 個颱風`, en: `${n0(v)} ${Math.round(v) === 1 ? 'storm' : 'storms'}` });

const RULE = {
  zh: '颱風中心進入國界或離國界 100 公里以內、當時風速達熱帶風暴（1 分鐘平均 34 kt）以上',
  en: 'the centre crossed the country or passed within 100 km of it at tropical-storm strength (1-minute winds of 34 kt) or above',
};
const PARTIAL = {
  zh: '北印度洋與南半球 1980 年以前沒有美國機構的風速，依賴這些海域的國家（印度、孟加拉、澳洲、馬達加斯加等）1980 年以前不統計。',
  en: 'US agencies have no wind data for the North Indian Ocean and the Southern Hemisphere before 1980, so countries that depend on those basins (India, Bangladesh, Australia, Madagascar and others) start in 1980.',
};

const indicators: IndicatorDef[] = [
  {
    id: 'storms-year',
    label: { zh: '當年的颱風', en: 'Storms by year' },
    description: {
      zh: `時間軸那一年（依颱風生成的日期）全球的颱風與颶風路徑，顏色是每個時間點的強度。滑鼠移到國家上可看那一年經過的颱風數（${RULE.zh}）；滑到路徑上看名稱與強度。`,
      en: `Tracks of the year's tropical cyclones worldwide (by formation date), coloured by intensity along the way. Hover over a country for the number of storms that year (${RULE.en}); hover over a track for its name and strength.`,
    },
    unit: STORMS_UNIT,
    file: 'storms-year.json',
    layer: { kind: 'none' },
    overlayTime: 'year',
    format: storms,
    formatTick: n0,
  },
  {
    id: 'storms-decade',
    label: { zh: '每十年的颱風次數', en: 'Storms per decade' },
    description: {
      zh: `每十年（1990 是 1990–1999 年）經過各國的颱風數：${RULE.zh}；同一個颱風可以算好幾國。地圖上同時畫出那十年的路徑；2020 年代只到今年。${PARTIAL.zh}`,
      en: `Storms affecting each country per decade (1990 means 1990–1999): ${RULE.en}; one storm can count for several countries. The map shows that decade's tracks; the 2020s run only to the current year. ${PARTIAL.en}`,
    },
    unit: STORMS_UNIT,
    file: 'storms-decade.json',
    layer: { kind: 'bubble', legendValues: [10, 40, 80] },
    overlayTime: 10,
    format: storms,
    formatTick: n0,
  },
  {
    id: 'strongest-decade',
    label: { zh: '最強的颱風（每十年）', en: 'Strongest storm per decade' },
    description: {
      zh: `那十年經過的颱風裡，在國界內或離國界 100 公里以內時最強的等級（美國機構的 1 分鐘平均風速，薩菲爾－辛普森颶風等級；颱風的熱帶性低氣壓階段也算）。沒有颱風經過的國家不上色。${PARTIAL.zh}`,
      en: `The highest intensity any storm reached while crossing the country or within 100 km of it in that decade (US 1-minute winds, Saffir–Simpson scale; tropical-depression stages count too). Countries with no storms are left blank. ${PARTIAL.en}`,
    },
    unit: '',
    file: 'strongest-decade.json',
    layer: {
      kind: 'categorical',
      ordinal: true,
      // 由強到弱：ordinal 的第一類最深，7 類剛好是 7 級循序色，跟路徑的顏色一樣
      categories: [CLASS.c5, CLASS.c4, CLASS.c3, CLASS.c2, CLASS.c1, CLASS.ts, CLASS.td].map((value) => ({
        value,
        label: CLASS_NAMES[value],
      })),
    },
    overlayTime: 10,
    format: (v) => className(v),
  },
];

export const typhoons: TopicDefinition = {
  id: 'typhoons',
  title: { zh: '颱風與颶風', en: 'Typhoons and hurricanes' },
  shortTitle: { zh: '颱風與颶風', en: 'Cyclones' },
  defaultIndicator: 'storms-year',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'NOAA NCEI IBTrACS v04r01（國際熱帶氣旋最佳路徑；Knapp et al. 2010）',
        en: 'NOAA NCEI IBTrACS v04r01 (International Best Track Archive for Climate Stewardship; Knapp et al. 2010)',
      },
      url: 'https://doi.org/10.25921/82ty-9e16',
      license: { zh: '公有領域（美國政府資料）', en: 'public domain (US government data)' },
    },
    {
      name: {
        zh: '中央氣象署颱風資料庫（中文名稱、侵台颱風對照）',
        en: 'Central Weather Administration, Taiwan: Typhoon Database (Chinese names, Taiwan comparison)',
      },
      url: 'https://rdc28.cwa.gov.tw/TDB/',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '路徑與強度來自 NOAA 的 IBTrACS（International Best Track Archive for Climate Stewardship v04r01），1950 年起，00、06、12、18 時（UTC）的位置。風速一律用美國機構（國家颶風中心、中太平洋颶風中心、聯合颱風警報中心）的 1 分鐘平均最大持續風速，依薩菲爾－辛普森颶風等級分級；中央氣象署、日本氣象廳用 10 分鐘平均，數字比較小，分級也不同（輕度、中度、強烈颱風），所以強度跟氣象署公布的不一樣。最近一兩年是還沒重新分析的即時資料。時間軸的年份是颱風生成的那一年（UTC）；南半球的颱風季從 7 月算到隔年 6 月，這裡拆在兩個年份。國家的次數是颱風中心進入國界或離國界 100 公里以內、當時風速達熱帶風暴（34 kt）以上的颱風，路徑每 10 公里內插一點來量距離；中央氣象署的「侵台颱風」是颱風中心登陸台灣，或沒有登陸但陸上有災情的颱風，規則不同，次數也不完全一樣（台灣的附註有對照）。北印度洋與南半球 1980 年以前沒有美國機構的風速，路徑畫成灰色，相關國家 1980 年以前不統計；1960 年代以前沒有衛星，海上的颱風可能有缺漏；早年的強度估計方法也不同（例如 1950–60 年代西北太平洋的風速一般認為偏高），不一定能跟近年直接比較。中文名稱來自中央氣象署颱風資料庫。',
    en: 'Tracks and intensities come from NOAA IBTrACS (International Best Track Archive for Climate Stewardship v04r01) since 1950, using positions at 00, 06, 12 and 18 UTC. Winds are always the 1-minute maximum sustained winds of the US agencies (National Hurricane Center, Central Pacific Hurricane Center, Joint Typhoon Warning Center) on the Saffir–Simpson scale; Taiwan\'s Central Weather Administration and the Japan Meteorological Agency use 10-minute winds, which are lower and graded differently, so intensities differ from theirs. The last year or two are provisional real-time data not yet reanalysed. The time slider uses the year a storm formed (UTC); Southern Hemisphere seasons run from July to June and are split across two years here. Country counts are storms whose centre crossed the country or passed within 100 km of it at tropical-storm strength (34 kt) or above, measured along tracks interpolated every 10 km; the CWA counts a typhoon as hitting Taiwan when its centre makes landfall or it causes damage on land, so its numbers differ (see the note for Taiwan). US agencies have no wind data for the North Indian Ocean and the Southern Hemisphere before 1980: those tracks are grey and the affected countries start in 1980. Before satellites (the 1960s), storms at sea may be missing, and early intensity estimates used different methods (western Pacific winds of the 1950s and 1960s are generally thought to be too high), so they are not directly comparable with recent ones. Chinese names are from the CWA Typhoon Database.',
  },
  panelExtra: () => import('./panels/TyphoonsPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'tracks',
      file: 'tracks.json',
      label: { zh: '颱風路徑', en: 'Storm tracks' },
      width: 1.6,
      color: { title: { zh: '強度（薩菲爾－辛普森等級）', en: 'Intensity (Saffir–Simpson)' }, classes: TRACK_CLASSES },
      timeField: 'year',
      sortByType: true,
      casing: true,
      tooltip: trackTooltip,
    },
  ],
  indicators,
};
