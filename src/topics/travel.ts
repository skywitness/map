import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 旅行實用（pipeline/topics/travel.py）：跟台灣的時差、行車方向、插頭類型、電壓與頻率，
 * 以及生活格式（一週的第一天、週末、12／24 小時制、日期寫法、小數點、度量衡、紙張、曆法，Unicode CLDR）。
 * 資料不隨時間變化（timeless）。類別代碼跟 pipeline 的 LEFT/RIGHT、PLUG_*、POWER_*、WEEK_START… 一致。
 */

/** 台灣的標準時間（UTC+8） */
export const TAIWAN_OFFSET = 8;

/** 小時寫成「UTC+5:30」 */
export function utcText(hours: number): string {
  const sign = hours >= 0 ? '+' : '−';
  const abs = Math.abs(hours);
  const h = Math.floor(abs + 1e-9);
  const m = Math.round((abs - h) * 60);
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** 時差的小時數：整數不寫小數點，5.75 寫 5.75 */
const hoursText = (h: number) => {
  const abs = Math.abs(h);
  return fixed(abs, Number.isInteger(abs) ? 0 : Number.isInteger(abs * 2) ? 1 : 2);
};

/** 「比台灣快 1 小時」「跟台灣相同」 */
export function versusTaiwan(diff: number): string {
  if (Math.abs(diff) < 1e-9) return tr({ zh: '跟台灣相同', en: 'same as Taiwan' });
  const h = hoursText(diff);
  if (diff > 0) return tr({ zh: `比台灣快 ${h} 小時`, en: `${h} ${h === '1' ? 'hour' : 'hours'} ahead of Taiwan` });
  return tr({ zh: `比台灣慢 ${h} 小時`, en: `${h} ${h === '1' ? 'hour' : 'hours'} behind Taiwan` });
}

export const DRIVING: CategoryDef[] = [
  { value: 1, label: { zh: '靠左行駛', en: 'Drive on the left' } },
  { value: 2, label: { zh: '靠右行駛（跟台灣一樣）', en: 'Drive on the right (like Taiwan)' } },
];

/** 插頭的分類（pipeline 的 plug_group() 依序判斷）；字母是 IEC 的插頭類型 */
export const PLUG_GROUPS: CategoryDef[] = [
  { value: 1, label: { zh: 'A、B（跟台灣一樣）', en: 'A, B (like Taiwan)' } },
  { value: 2, label: { zh: 'A、B 與其他類型混用', en: 'A, B mixed with other types' } },
  { value: 3, label: { zh: 'C、E、F（歐洲圓腳）', en: 'C, E, F (European round pins)' } },
  { value: 4, label: { zh: 'G（英國三扁腳）', en: 'G (British three-pin)' } },
  { value: 5, label: { zh: 'I（澳洲、紐西蘭八字腳）', en: 'I (Australian angled pins)' } },
  { value: 6, label: { zh: 'D、M（南亞、南非的大圓腳）', en: 'D, M (large round pins, South Asia and South Africa)' } },
  {
    value: 7,
    label: { zh: 'C 加上國內規格（瑞士 J、丹麥 K、義大利 L、巴西 N、以色列 H）', en: 'C plus a national type (J, K, L, N, H)' },
  },
];

/** 電壓與頻率（依維基百科表格列出的第一個電壓，通常是一般家用插座） */
export const POWER_GROUPS: CategoryDef[] = [
  { value: 1, label: { zh: '100–127 V、60 Hz（跟台灣一樣）', en: '100–127 V, 60 Hz (like Taiwan)' } },
  { value: 2, label: { zh: '100–127 V、50 Hz 或 50／60 Hz（日本）', en: '100–127 V, 50 Hz or 50/60 Hz (Japan)' } },
  { value: 3, label: { zh: '220–240 V、60 Hz', en: '220–240 V, 60 Hz' } },
  { value: 4, label: { zh: '220–240 V、50 Hz', en: '220–240 V, 50 Hz' } },
];

/** 一週的第一天（pipeline 的 WEEK_START） */
export const WEEK_START: CategoryDef[] = [
  { value: 2, label: { zh: '星期日（跟台灣一樣）', en: 'Sunday (like Taiwan)' } },
  { value: 1, label: { zh: '星期一', en: 'Monday' } },
  { value: 3, label: { zh: '星期六', en: 'Saturday' } },
  { value: 4, label: { zh: '星期五', en: 'Friday' } },
];

/** 週末（pipeline 的 WEEKEND） */
export const WEEKEND: CategoryDef[] = [
  { value: 1, label: { zh: '星期六、日（跟台灣一樣）', en: 'Saturday–Sunday (like Taiwan)' } },
  { value: 2, label: { zh: '星期五、六', en: 'Friday–Saturday' } },
  { value: 3, label: { zh: '星期四、五', en: 'Thursday–Friday' } },
  { value: 4, label: { zh: '只有星期五', en: 'Friday only' } },
  { value: 5, label: { zh: '只有星期日', en: 'Sunday only' } },
];

export const CLOCK: CategoryDef[] = [
  { value: 1, label: { zh: '12 小時制（跟台灣一樣）', en: '12-hour clock (like Taiwan)' } },
  { value: 2, label: { zh: '24 小時制', en: '24-hour clock' } },
];

/** 短日期的順序（pipeline 的 date_order()） */
export const DATE_ORDER: CategoryDef[] = [
  { value: 1, label: { zh: '年月日（跟台灣一樣）', en: 'Year-month-day (like Taiwan)' } },
  { value: 2, label: { zh: '日月年', en: 'Day-month-year' } },
  { value: 3, label: { zh: '月日年', en: 'Month-day-year' } },
];

export const DECIMAL: CategoryDef[] = [
  { value: 1, label: { zh: '小數點「.」（跟台灣一樣）', en: 'Point “.” (like Taiwan)' } },
  { value: 2, label: { zh: '逗號「,」', en: 'Comma “,”' } },
  { value: 3, label: { zh: '阿拉伯小數點「٫」', en: 'Arabic decimal separator “٫”' } },
];

export const MEASUREMENT: CategoryDef[] = [
  { value: 1, label: { zh: '公制（跟台灣一樣）', en: 'Metric (like Taiwan)' } },
  { value: 2, label: { zh: '美制（英里、磅、華氏）', en: 'US customary (miles, pounds, Fahrenheit)' } },
  { value: 3, label: { zh: '英制與公制混用', en: 'Imperial mixed with metric' } },
];

export const PAPER: CategoryDef[] = [
  { value: 1, label: { zh: 'A4（跟台灣一樣）', en: 'A4 (like Taiwan)' } },
  { value: 2, label: { zh: 'US Letter（8.5 × 11 英寸）', en: 'US Letter (8.5 × 11 in)' } },
];

/** 曆法（pipeline 的 calendar_group()） */
export const CALENDAR: CategoryDef[] = [
  { value: 1, label: { zh: '只用西曆', en: 'Gregorian only' } },
  { value: 2, label: { zh: '西曆、民國紀年與農曆（台灣）', en: 'Gregorian, Minguo and lunisolar (Taiwan)' } },
  { value: 3, label: { zh: '西曆與農曆', en: 'Gregorian and lunisolar' } },
  { value: 4, label: { zh: '西曆與日本年號', en: 'Gregorian and Japanese era' } },
  { value: 5, label: { zh: '佛曆為主', en: 'Mainly Buddhist' } },
  { value: 6, label: { zh: '西曆與伊斯蘭曆', en: 'Gregorian and Islamic' } },
  { value: 7, label: { zh: '波斯曆為主', en: 'Mainly Persian (Solar Hijri)' } },
  { value: 8, label: { zh: '西曆與其他傳統曆法（希伯來、科普特、衣索比亞、印度）', en: 'Gregorian and another traditional calendar (Hebrew, Coptic, Ethiopian, Indian)' } },
];

export const categoryLabel = (list: CategoryDef[], v: number) => tr(list.find((c) => c.value === v)?.label ?? '');

/** 生活格式的指標都是類別圖、只差在檔名與類別 */
const formatIndicator = (id: string, label: Text, description: Text, categories: CategoryDef[]): IndicatorDef => ({
  id,
  label,
  description,
  unit: '',
  file: `${id}.json`,
  layer: { kind: 'categorical', categories },
  format: (v) => categoryLabel(categories, v),
  noValue: { _CYN: { zh: 'CLDR 沒有北賽普勒斯的資料', en: 'Not covered by CLDR' } },
});

const CLDR_SOURCE = { zh: '依 Unicode CLDR 49。', en: 'From Unicode CLDR 49.' };
const byLanguage = {
  zh: '依人口比例最高的官方語言（滑過國家看是哪一種語言與例子；CLDR 沒有那種語言的日期寫法時用次高的）',
  en: 'Based on the most widely spoken official language (hover over a country to see which language, with an example; if CLDR has no date format for it, the next one is used)',
};

const TIME_THRESHOLDS = [-10.5, -4.5, -0.5, 0.5, 2.5, 4.5];

export const travel: TopicDefinition = {
  id: 'travel',
  title: { zh: '旅行實用與生活格式（時差、插頭、日期寫法、度量衡）', en: 'Travel essentials and local formats' },
  shortTitle: { zh: '旅行實用', en: 'Travel' },
  defaultIndicator: 'time-difference',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'IANA 時區資料庫（tzdata 2026f）', en: 'IANA Time Zone Database (tzdata 2026f)' },
      url: 'https://www.iana.org/time-zones',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Natural Earth（首都的位置與時區）', en: 'Natural Earth (capitals and their time zones)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    { name: { zh: 'Wikidata（行車方向，P1622）', en: 'Wikidata (driving side, P1622)' }, url: 'https://www.wikidata.org/wiki/Property:P1622', license: 'CC0' },
    {
      name: { zh: 'Unicode CLDR 49（一週、時間、日期、數字、度量衡、紙張與曆法的慣例）', en: 'Unicode CLDR 49 (week, time, date, number, measurement, paper and calendar conventions)' },
      url: 'https://cldr.unicode.org/',
      license: 'Unicode License v3',
    },
    {
      name: { zh: '英文維基百科「Mains electricity by country」（插頭、電壓與頻率）', en: 'Wikipedia, “Mains electricity by country” (plugs, voltage and frequency)' },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380969207',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '時差是標準時間（不含夏令時間）跟台灣（UTC+8）差幾小時，用首都所在的時區；跨好幾個時區、或有夏令時間的國家，側欄與附註會寫出來。插頭與電壓依英文維基百科「Mains electricity by country」的表格（2026 年 10 月 19 日的版本，CC BY-SA 4.0），地圖用表格列出的第一個電壓；這個主題的插頭、電壓資料檔也依 CC BY-SA 4.0 分享。生活格式（一週的第一天、週末、12／24 小時制、日期寫法、小數點、度量衡、紙張、曆法）依 Unicode CLDR 49，是軟體顯示日期、數字時用的慣例；日期寫法與小數點依人口比例最高的官方語言，多語國家（瑞士、比利時、加拿大、印度…）只代表其中一種語言。出發前請再查最新的官方資訊。',
    en: 'Time difference is standard time (without daylight saving) relative to Taiwan (UTC+8), using the capital’s time zone; countries with several time zones or daylight saving time are noted in the side panel. Plugs and voltage follow the Wikipedia table “Mains electricity by country” (revision of 19 October 2026, CC BY-SA 4.0), and the map uses the first voltage listed; the plug and voltage data files of this topic are shared under CC BY-SA 4.0. Local formats (first day of the week, weekend, 12/24-hour clock, date format, decimal separator, measurement system, paper size and calendars) follow Unicode CLDR 49, the conventions software uses to display dates and numbers; date format and decimal separator follow the most widely spoken official language, so for multilingual countries (Switzerland, Belgium, Canada, India…) they reflect only one language. Check current official information before you travel.',
  },
  panelExtra: () => import('./panels/TravelPanel'),
  indicators: [
    {
      id: 'time-difference',
      label: { zh: '跟台灣的時差', en: 'Time difference from Taiwan' },
      description: {
        zh: '標準時間比台灣（UTC+8）快或慢幾小時：橘色比台灣慢（美洲最慢），青綠比台灣快（紐西蘭、太平洋島國），中間的灰色跟台灣同一時間。跨好幾個時區的國家用首都的時區。',
        en: 'How many hours standard time is ahead of or behind Taiwan (UTC+8): orange is behind (the Americas most of all), teal is ahead (New Zealand and the Pacific islands), grey is the same time as Taiwan. Countries with several time zones use the capital’s.',
      },
      unit: { zh: '小時', en: 'hours' },
      file: 'time-difference.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: TIME_THRESHOLDS } },
      unranked: true,
      format: (v) => `${utcText(v + TAIWAN_OFFSET)} · ${versusTaiwan(v)}`,
      formatTick: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), Number.isInteger(v) ? 0 : 1)}`,
    },
    {
      id: 'driving',
      label: { zh: '行車方向', en: 'Driving side' },
      description: {
        zh: '車輛靠道路的哪一邊行駛。台灣靠右；日本、英國、香港、澳門、東南亞與南亞的許多國家、澳洲、紐西蘭、南部非洲靠左。',
        en: 'Which side of the road traffic keeps to. Taiwan drives on the right; Japan, the UK, Hong Kong, Macau, much of South and Southeast Asia, Australia, New Zealand and southern Africa drive on the left.',
      },
      unit: '',
      file: 'driving.json',
      layer: { kind: 'categorical', categories: DRIVING },
      format: (v) => categoryLabel(DRIVING, v),
    },
    {
      id: 'plugs',
      label: { zh: '插頭類型', en: 'Plug types' },
      description: {
        zh: '插座用的插頭類型（IEC 的字母分類）。台灣是 A（兩扁腳）與 B（兩扁腳加圓形接地腳）；其他類型要帶轉接頭。側欄列出每個國家的全部類型。',
        en: 'Plug types used in sockets (IEC letter types). Taiwan uses A (two flat pins) and B (two flat pins plus a round earth pin); other types need an adapter. The side panel lists every type for each country.',
      },
      unit: '',
      file: 'plugs.json',
      layer: { kind: 'categorical', categories: PLUG_GROUPS },
      format: (v) => categoryLabel(PLUG_GROUPS, v),
    },
    {
      id: 'power',
      label: { zh: '電壓與頻率', en: 'Voltage and frequency' },
      description: {
        zh: '一般家用插座的電壓與頻率。台灣是 110 V、60 Hz；220–240 V 的國家，只標示 110 V 的電器要用變壓器（標示 100–240 V 的充電器可以直接用）。',
        en: 'Voltage and frequency of ordinary household sockets. Taiwan uses 110 V, 60 Hz; in 220–240 V countries, appliances rated only for 110 V need a transformer (chargers rated 100–240 V work as they are).',
      },
      unit: '',
      file: 'power.json',
      layer: { kind: 'categorical', categories: POWER_GROUPS },
      format: (v) => categoryLabel(POWER_GROUPS, v),
    },
    formatIndicator(
      'week-start',
      { zh: '一週從星期幾開始', en: 'First day of the week' },
      {
        zh: `月曆一週的第一天。台灣、美國、日本從星期日開始，歐洲、中國大陸從星期一，中東多數國家從星期六。${CLDR_SOURCE.zh}`,
        en: `The first day of the week on calendars. Taiwan, the US and Japan start on Sunday, Europe and China on Monday, most of the Middle East on Saturday. ${CLDR_SOURCE.en}`,
      },
      WEEK_START,
    ),
    formatIndicator(
      'weekend',
      { zh: '週末', en: 'Weekend' },
      {
        zh: `一般的週末是哪幾天。中東多數國家是星期五、六，伊朗只有星期五，阿富汗是星期四、五，印度、烏干達只有星期日。${CLDR_SOURCE.zh}`,
        en: `Which days are the usual weekend. Most of the Middle East rests on Friday and Saturday, Iran on Friday only, Afghanistan on Thursday and Friday, India and Uganda on Sunday only. ${CLDR_SOURCE.en}`,
      },
      WEEKEND,
    ),
    formatIndicator(
      'clock',
      { zh: '12 或 24 小時制', en: '12- or 24-hour clock' },
      {
        zh: `時間慣用 12 小時制（下午 3:00）還是 24 小時制（15:00）。兩種通常都看得懂，這裡是 CLDR 記錄的偏好。${CLDR_SOURCE.zh}`,
        en: `Whether time is usually written with the 12-hour clock (3:00 PM) or the 24-hour clock (15:00). Both are usually understood; this is the preference recorded in CLDR. ${CLDR_SOURCE.en}`,
      },
      CLOCK,
    ),
    formatIndicator(
      'date-format',
      { zh: '日期寫法', en: 'Date format' },
      {
        zh: `數字寫的短日期依什麼順序：台灣寫 2026/3/28（年月日），歐洲多數寫 28/03/2026（日月年），美國寫 3/28/26（月日年）。${byLanguage.zh}。${CLDR_SOURCE.zh}`,
        en: `The order of a short numeric date: Taiwan writes 2026/3/28 (year-month-day), most of Europe 28/03/2026 (day-month-year), the US 3/28/26 (month-day-year). ${byLanguage.en}. ${CLDR_SOURCE.en}`,
      },
      DATE_ORDER,
    ),
    formatIndicator(
      'decimal',
      { zh: '小數點符號', en: 'Decimal separator' },
      {
        zh: `小數點寫成「.」還是「,」：台灣寫 1,234.5，德國寫 1.234,5，法國寫 1 234,5。${byLanguage.zh}。${CLDR_SOURCE.zh}`,
        en: `Whether the decimal separator is a point or a comma: Taiwan writes 1,234.5, Germany 1.234,5, France 1 234,5. ${byLanguage.en}. ${CLDR_SOURCE.en}`,
      },
      DECIMAL,
    ),
    formatIndicator(
      'measurement',
      { zh: '度量衡', en: 'Measurement system' },
      {
        zh: `日常用的度量衡制度。美國、賴比瑞亞是美制（英里、磅、加侖），英國、緬甸是英制與公制混用（道路標示用英里）；巴哈馬、貝里斯等公制國家的溫度用華氏，附註會寫。${CLDR_SOURCE.zh}`,
        en: `The everyday system of measurement. The US and Liberia use US customary units (miles, pounds, gallons); the UK and Myanmar mix imperial and metric (road signs in miles); some metric countries such as the Bahamas and Belize give temperatures in Fahrenheit, as noted. ${CLDR_SOURCE.en}`,
      },
      MEASUREMENT,
    ),
    formatIndicator(
      'paper',
      { zh: '紙張大小', en: 'Paper size' },
      {
        zh: `一般影印紙的大小。美國、加拿大、墨西哥、菲律賓與中南美洲幾個國家用 US Letter（216 × 279 mm），其他用 A4（210 × 297 mm）。${CLDR_SOURCE.zh}`,
        en: `The standard size of printer paper. The US, Canada, Mexico, the Philippines and several Latin American countries use US Letter (216 × 279 mm); everywhere else uses A4 (210 × 297 mm). ${CLDR_SOURCE.en}`,
      },
      PAPER,
    ),
    formatIndicator(
      'calendar',
      { zh: '曆法', en: 'Calendars' },
      {
        zh: `除了西曆以外還常用的曆法，依常用的程度排列：台灣有民國紀年與農曆，日本有年號，伊斯蘭國家有伊斯蘭曆，伊朗、阿富汗以波斯曆為主，泰國以佛曆為主。滑過國家看完整的清單。${CLDR_SOURCE.zh}`,
        en: `Calendars in common use besides the Gregorian, in order of use: Taiwan has the Minguo era and the lunisolar calendar, Japan its era names, Muslim countries the Islamic calendar; Iran and Afghanistan mainly use the Persian calendar and Thailand the Buddhist one. Hover over a country for the full list. ${CLDR_SOURCE.en}`,
      },
      CALENDAR,
    ),
  ],
};

/** 側欄與 tooltip 共用：插頭字母寫成「A、B」或「A, B」 */
export function letters(s: string): string {
  return [...s].join(tr({ zh: '、', en: ', ' }));
}
