import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { letters, TAIWAN_OFFSET, utcText, versusTaiwan } from '../travel';
import type { PanelExtraProps } from '../types';

/** details.json（pipeline/topics/travel.py）：每個國家的時區、行車方向、插頭、電壓與頻率 */
interface Detail {
  /** [標準時間, 夏令時間或 null, 全國最早的標準時間, 最晚的標準時間, IANA 時區名稱] */
  tz?: [number, number | null, number, number, string];
  drive?: 'L' | 'R';
  /** 插頭字母，例如 "AB" */
  plugs?: string;
  volts?: number[];
  hz?: number[];
  capital?: string;
  /** 生活格式（CLDR）：北賽普勒斯沒有 */
  fmt?: Formats;
}

/** details.json 的 fmt（pipeline/topics/travel.py 的 _formats()） */
interface Formats {
  /** [一週的第一天, 週末開始, 週末結束]：sun、mon… */
  week: [Day, Day, Day];
  /** CLDR 的 preferred：h 是 12 小時制、H 是 24 小時制 */
  clock: 'h' | 'H';
  /** [整體的制度, 溫度另外用的制度或 null] */
  measure: [Measure, Measure | null];
  paper: 'A4' | 'US-Letter';
  /** 依常用的程度排列的曆法（CLDR 的代碼） */
  calendar: string[];
  /** 以下依人口比例最高的官方語言：[短日期格式, 2026 年 3 月 28 日的寫法] */
  date?: [string, string];
  /** [小數點, 千分位, 1234567.89 的寫法] */
  number?: [string, string, string];
  /** 語言名稱 [中文, 英文] */
  lang?: [string, string];
}

type Day = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
type Measure = 'metric' | 'US' | 'UK';

const DAYS: Record<Day, { zh: string; en: string }> = {
  sun: { zh: '星期日', en: 'Sunday' },
  mon: { zh: '星期一', en: 'Monday' },
  tue: { zh: '星期二', en: 'Tuesday' },
  wed: { zh: '星期三', en: 'Wednesday' },
  thu: { zh: '星期四', en: 'Thursday' },
  fri: { zh: '星期五', en: 'Friday' },
  sat: { zh: '星期六', en: 'Saturday' },
};

const MEASURES: Record<Measure, { zh: string; en: string }> = {
  metric: { zh: '公制', en: 'metric' },
  US: { zh: '美制（英里、磅、加侖、華氏）', en: 'US customary (miles, pounds, gallons, Fahrenheit)' },
  UK: { zh: '英制與公制混用（道路標示用英里）', en: 'imperial mixed with metric (road signs in miles)' },
};

/** 曆法名稱；伊斯蘭曆的幾種算法（civil、tbla、rgsa）合併成一個 */
const CALENDARS: Record<string, { zh: string; en: string }> = {
  gregorian: { zh: '西曆', en: 'Gregorian' },
  roc: { zh: '民國紀年', en: 'Minguo (ROC)' },
  chinese: { zh: '農曆', en: 'Chinese lunisolar' },
  dangi: { zh: '韓國農曆（檀紀）', en: 'Korean lunisolar (Dangi)' },
  japanese: { zh: '日本年號', en: 'Japanese era' },
  buddhist: { zh: '佛曆', en: 'Buddhist' },
  islamic: { zh: '伊斯蘭曆', en: 'Islamic (Hijri)' },
  'islamic-umalqura': { zh: '伊斯蘭曆（烏姆庫拉曆）', en: 'Islamic (Umm al-Qura)' },
  persian: { zh: '波斯曆（太陽曆）', en: 'Persian (Solar Hijri)' },
  coptic: { zh: '科普特曆', en: 'Coptic' },
  ethiopic: { zh: '衣索比亞曆', en: 'Ethiopian' },
  hebrew: { zh: '希伯來曆', en: 'Hebrew' },
  indian: { zh: '印度國定曆', en: 'Indian national' },
};

function calendarNames(list: string[]): { zh: string; en: string }[] {
  const out: { zh: string; en: string }[] = [];
  for (const c of list) {
    const key = c in CALENDARS ? c : c.startsWith('islamic') ? 'islamic' : c;
    if (key === 'islamic' && out.some((n) => n.en.startsWith('Islamic'))) continue;
    const name = CALENDARS[key] ?? { zh: c, en: c };
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** 短日期格式的順序（跟 pipeline 的 date_order() 一樣看 y、M、d 第一次出現的順序，略過引號裡的原文） */
function dateOrder(pattern: string): 'ymd' | 'dmy' | 'mdy' {
  const letters = pattern.replace(/'[^']*'/g, '').replace(/[^yMd]/g, '');
  const order = [...new Set(letters)].join('');
  return order === 'yMd' ? 'ymd' : order === 'Mdy' ? 'mdy' : 'dmy';
}

/** 好幾個電壓、頻率之間的分隔 */
const SLASH = { zh: '／', en: '/' };
/** 週末的兩天之間、曆法清單的分隔 */
const DAY_SEP = { zh: '、', en: '–' };
const LIST_SEP = { zh: '、', en: ', ' };

const TAIWAN: Required<Pick<Detail, 'plugs' | 'volts' | 'hz' | 'drive'>> = { plugs: 'AB', volts: [110], hz: [60], drive: 'R' };

/** 台灣的生活格式（CLDR 49；pipeline 檢查過台灣的值跟這裡一樣） */
const TAIWAN_FMT = {
  week: ['sun', 'sat', 'sun'] as Day[],
  clock: 'h',
  date: '2026/3/28',
  decimal: '.',
  measure: 'metric' as Measure,
  paper: 'A4',
  calendar: ['gregorian', 'roc', 'chinese'],
};

const TEXT = defineMessages({
  zh: {
    title: '旅行實用：跟台灣比',
    titleTaiwan: '旅行實用：台灣',
    time: '時間',
    drive: '行車方向',
    plugs: '插頭',
    power: '電壓與頻率',
    std: (utc: string, vs: string) => `標準時間 ${utc}，${vs}。`,
    taiwanTime: '標準時間 UTC+8，沒有夏令時間。',
    dst: (utc: string, vs: string) => `有夏令時間：${utc}，${vs}。`,
    noDst: '沒有夏令時間。',
    range: (from: string, to: string, zone: string) => `全國有好幾個時區（標準時間 ${from} 到 ${to}），上面是首都的時區（${zone}）。`,
    left: '靠左行駛，跟台灣相反：過馬路先看右邊，租車時駕駛座在右側。',
    right: '靠右行駛，跟台灣一樣。',
    taiwanDrive: '靠右行駛。',
    plugList: (list: string) => `${list} 型。`,
    plugSame: '跟台灣一樣，台灣的插頭可以直接插（三腳的 B 型插頭要找三孔插座）。',
    plugSome: '有些插座是 A 或 B 型，台灣的插頭可能可以直接插，但不一定每個插座都行，最好帶轉接頭。',
    plugNo: '台灣的 A、B 插頭不能直接插，要帶轉接頭。',
    taiwanPlugs: 'A、B 型（兩扁腳，B 型多一支圓形接地腳）。',
    powerList: (volts: string, hz: string) => `${volts}、${hz}。`,
    powerLow: '電壓跟台灣（110 V）差不多，台灣的電器一般可以直接用。',
    powerHigh: '電壓約是台灣的兩倍：先看電器或充電器上的標示，寫 100–240 V 的（多數手機、筆電充電器）可以直接用，只寫 110 V 的（例如吹風機、電熨斗）要用變壓器。',
    hzDiff: '頻率跟台灣（60 Hz）不同，有馬達或計時功能的電器可能受影響。',
    taiwanPower: '110 V、60 Hz（冷氣、烤箱等大型電器另有 220 V 的線路）。',
    unknown: '沒有資料。',
    week: '一週與週末',
    weekText: (first: string, weekend: string) => `一週從${first}開始，週末是${weekend}。`,
    weekSame: '跟台灣一樣。',
    weekDiff: '跟台灣不同（台灣從星期日開始，週末是星期六、日）。',
    clockDate: '時間與日期',
    clock12: '慣用 12 小時制（下午 3:00），跟台灣一樣。',
    clock24: '慣用 24 小時制（15:00），台灣多用 12 小時制（下午 3:00）。',
    dateSame: (lang: string, ex: string) => `依${lang}：日期寫 ${ex}，順序跟台灣一樣（年月日）。`,
    dateDmy: (lang: string, ex: string) => `日期寫法不同：依${lang}，2026 年 3 月 28 日寫成 ${ex}（日月年），台灣寫 2026/3/28。`,
    dateMdy: (lang: string, ex: string) => `日期寫法不同：依${lang}，2026 年 3 月 28 日寫成 ${ex}（月日年），台灣寫 2026/3/28；3/4 是 3 月 4 日，不是 4 月 3 日。`,
    numbers: '數字',
    numSame: (lang: string, ex: string) => `依${lang}：${ex}，小數點跟台灣一樣。`,
    numComma: (lang: string, ex: string) => `小數點不同：依${lang}，一百多萬寫成 ${ex}，逗號是小數點，跟台灣相反。`,
    numArabic: (lang: string, ex: string) => `依${lang}：${ex}，用阿拉伯－印度數字，小數點是「٫」。`,
    measure: '度量衡與紙張',
    measureText: (m: string) => `${m}。`,
    measureSame: '公制，跟台灣一樣。',
    temperature: (unit: string) => `溫度用${unit}。`,
    paperA4: '影印紙是 A4，跟台灣一樣。',
    paperLetter: '影印紙是 US Letter（216 × 279 mm），比台灣的 A4 寬一點、短一點。',
    calendar: '曆法',
    calendarText: (list: string) => `${list}。`,
    calendarOnly: '只用西曆。',
    taiwanWeek: '一週從星期日開始，週末是星期六、日。',
    taiwanClock: '慣用 12 小時制（下午 3:00），日期寫 2026/3/28（年月日）。',
    taiwanNumbers: '1,234,567.89（小數點「.」）。',
    taiwanMeasure: '公制；影印紙是 A4。',
    taiwanCalendar: '西曆、民國紀年、農曆。',
    celsius: '攝氏',
    fahrenheit: '華氏',
  },
  en: {
    title: 'Travel essentials compared with Taiwan',
    titleTaiwan: 'Travel essentials: Taiwan',
    time: 'Time',
    drive: 'Driving side',
    plugs: 'Plugs',
    power: 'Voltage and frequency',
    std: (utc, vs) => `Standard time ${utc}, ${vs}.`,
    taiwanTime: 'Standard time UTC+8, no daylight saving time.',
    dst: (utc, vs) => `Daylight saving time: ${utc}, ${vs}.`,
    noDst: 'No daylight saving time.',
    range: (from, to, zone) => `Several time zones (standard time ${from} to ${to}); the above is the capital’s (${zone}).`,
    left: 'Drives on the left, unlike Taiwan: look right first when crossing, and the driver sits on the right.',
    right: 'Drives on the right, like Taiwan.',
    taiwanDrive: 'Drives on the right.',
    plugList: (list) => `Type ${list}.`,
    plugSame: 'Same as Taiwan, so Taiwanese plugs fit (three-pin type B plugs need a three-hole socket).',
    plugSome: 'Some sockets take type A or B, so Taiwanese plugs may fit, but not every socket will; bring an adapter.',
    plugNo: 'Taiwanese type A and B plugs do not fit; bring an adapter.',
    taiwanPlugs: 'Types A and B (two flat pins; type B adds a round earth pin).',
    powerList: (volts, hz) => `${volts}, ${hz}.`,
    powerLow: 'Similar voltage to Taiwan (110 V), so Taiwanese appliances generally work.',
    powerHigh:
      'About twice Taiwan’s voltage: check the label on the appliance or charger. Those rated 100–240 V (most phone and laptop chargers) work as they are; those rated only for 110 V (hair dryers, irons) need a transformer.',
    hzDiff: 'The frequency differs from Taiwan’s 60 Hz, which may affect appliances with motors or timers.',
    taiwanPower: '110 V, 60 Hz (large appliances such as air conditioners and ovens use separate 220 V circuits).',
    unknown: 'No data.',
    week: 'Week and weekend',
    weekText: (first, weekend) => `The week starts on ${first}; the weekend is ${weekend}.`,
    weekSame: 'Same as Taiwan.',
    weekDiff: 'Different from Taiwan (week starts on Sunday, weekend is Saturday–Sunday).',
    clockDate: 'Time and date',
    clock12: 'Usually the 12-hour clock (3:00 PM), like Taiwan.',
    clock24: 'Usually the 24-hour clock (15:00); Taiwan mostly uses the 12-hour clock (3:00 PM).',
    dateSame: (lang, ex) => `Based on ${lang}: dates are written ${ex}, in the same order as Taiwan (year-month-day).`,
    dateDmy: (lang, ex) => `Different date order: in ${lang}, 28 March 2026 is ${ex} (day-month-year); Taiwan writes 2026/3/28.`,
    dateMdy: (lang, ex) => `Different date order: in ${lang}, 28 March 2026 is ${ex} (month-day-year); Taiwan writes 2026/3/28. 3/4 is 4 March, not 3 April.`,
    numbers: 'Numbers',
    numSame: (lang, ex) => `Based on ${lang}: ${ex}, the same decimal point as Taiwan.`,
    numComma: (lang, ex) => `Different decimal separator: in ${lang}, a little over a million is ${ex}; the comma is the decimal separator, the opposite of Taiwan.`,
    numArabic: (lang, ex) => `Based on ${lang}: ${ex}, with Arabic-Indic digits and “٫” as the decimal separator.`,
    measure: 'Measurement and paper',
    measureText: (m) => `${m[0].toUpperCase()}${m.slice(1)}.`,
    measureSame: 'Metric, like Taiwan.',
    temperature: (unit) => `Temperatures are in ${unit}.`,
    paperA4: 'Printer paper is A4, like Taiwan.',
    paperLetter: 'Printer paper is US Letter (216 × 279 mm), slightly wider and shorter than Taiwan’s A4.',
    calendar: 'Calendars',
    calendarText: (list) => `${list}.`,
    calendarOnly: 'Gregorian only.',
    taiwanWeek: 'The week starts on Sunday; the weekend is Saturday–Sunday.',
    taiwanClock: 'Usually the 12-hour clock (3:00 PM); dates are written 2026/3/28 (year-month-day).',
    taiwanNumbers: '1,234,567.89 (decimal point “.”).',
    taiwanMeasure: 'Metric; printer paper is A4.',
    taiwanCalendar: 'Gregorian, Minguo (ROC) era, Chinese lunisolar.',
    celsius: 'Celsius',
    fahrenheit: 'Fahrenheit',
  },
});

export default function TravelPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Record<string, Detail>>(`topics/${topic.id}/details.json`);
  const d = data?.[iso3];
  if (!data) return null;
  const taiwan = iso3 === 'TWN';

  const time = (() => {
    if (taiwan) return [text.taiwanTime];
    if (!d?.tz) return [text.unknown];
    const [std, dst, min, max, zone] = d.tz;
    const lines = [text.std(utcText(std), versusTaiwan(std - TAIWAN_OFFSET))];
    lines.push(dst === null ? text.noDst : text.dst(utcText(dst), versusTaiwan(dst - TAIWAN_OFFSET)));
    if (min !== max) lines.push(text.range(utcText(min), utcText(max), zone));
    return lines;
  })();

  const drive = taiwan ? text.taiwanDrive : !d?.drive ? text.unknown : d.drive === 'L' ? text.left : text.right;

  const plugs = (() => {
    if (taiwan) return [text.taiwanPlugs];
    if (!d?.plugs) return [text.unknown];
    const set = new Set(d.plugs);
    const ab = [...set].filter((p) => p === 'A' || p === 'B').length;
    const advice = ab === set.size ? text.plugSame : ab > 0 ? text.plugSome : text.plugNo;
    return [text.plugList(letters(d.plugs)), advice];
  })();

  const power = (() => {
    if (taiwan) return [text.taiwanPower];
    if (!d?.volts?.length || !d.hz?.length) return [text.unknown];
    const volts = [...new Set(d.volts)].map((v) => `${v} V`).join(tr(SLASH, lang));
    const hz = d.hz.map((h) => `${h} Hz`).join(tr(SLASH, lang));
    const lines = [text.powerList(volts, hz), d.volts[0] <= 130 ? text.powerLow : text.powerHigh];
    if (d.hz.some((h) => h !== TAIWAN.hz[0])) lines.push(text.hzDiff);
    return lines;
  })();

  const rows: [string, string[]][] = [
    [text.time, time],
    [text.drive, [drive]],
    [text.plugs, plugs],
    [text.power, power],
  ];

  // 生活格式（CLDR）：跟台灣比
  const f = d?.fmt;
  if (taiwan) {
    rows.push(
      [text.week, [text.taiwanWeek]],
      [text.clockDate, [text.taiwanClock]],
      [text.numbers, [text.taiwanNumbers]],
      [text.measure, [text.taiwanMeasure]],
      [text.calendar, [text.taiwanCalendar]],
    );
  } else if (f) {
    const day = (k: Day) => DAYS[k][lang];
    const [first, ws, we] = f.week;
    const weekend = ws === we ? day(ws) : `${day(ws)}${tr(DAY_SEP, lang)}${day(we)}`;
    const sameWeek = f.week.every((k, i) => k === TAIWAN_FMT.week[i]);
    rows.push([text.week, [text.weekText(day(first), weekend), sameWeek ? text.weekSame : text.weekDiff]]);

    const clockDate = [f.clock === TAIWAN_FMT.clock ? text.clock12 : text.clock24];
    const langName = f.lang?.[lang === 'zh' ? 0 : 1] ?? '';
    if (f.date) {
      const order = dateOrder(f.date[0]);
      clockDate.push((order === 'ymd' ? text.dateSame : order === 'mdy' ? text.dateMdy : text.dateDmy)(langName, f.date[1]));
    }
    rows.push([text.clockDate, clockDate]);
    if (f.number) {
      const [decimal, , ex] = f.number;
      rows.push([text.numbers, [(decimal === TAIWAN_FMT.decimal ? text.numSame : decimal === ',' ? text.numComma : text.numArabic)(langName, ex)]]);
    }

    const [system, temp] = f.measure;
    const measure = [system === TAIWAN_FMT.measure ? text.measureSame : text.measureText(MEASURES[system][lang])];
    if (temp && temp !== system) measure.push(text.temperature(temp === 'metric' ? text.celsius : text.fahrenheit));
    measure.push(f.paper === TAIWAN_FMT.paper ? text.paperA4 : text.paperLetter);
    rows.push([text.measure, measure]);

    const cals = calendarNames(f.calendar).map((n) => n[lang]);
    rows.push([text.calendar, [cals.length === 1 ? text.calendarOnly : text.calendarText(cals.join(tr(LIST_SEP, lang)))]]);
  }
  return (
    <section className="panel-section">
      <h3>{taiwan ? text.titleTaiwan : text.title}</h3>
      <dl className="travel-facts">
        {rows.map(([label, lines]) => (
          <div key={label}>
            <dt>{label}</dt>
            {lines.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}
