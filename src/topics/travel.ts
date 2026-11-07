import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, ListPanelDef, ListRow, PointsOverlayDef, Text, TopicDefinition } from './types';
import { withParts } from './parts';
import { travelFeesPart } from './travel-fees';
import { travelHealthPart } from './travel-health';

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

/**
 * 緊急電話（pipeline/topics/travel_emergency.py 的 CATEGORIES，2026-11-04，製作手冊第二十批 304）：
 * 依每格的第一個號碼歸類，112、911、999 三大陣營加上各服務常見的號碼，其餘是「其他號碼」（值 9）。
 */
const SOS_OTHER: CategoryDef = { value: 9, label: { zh: '其他號碼（滑過看號碼）', en: 'Other numbers (hover to see)' }, color: MAP_TOKENS.categoricalOther };
const SOS_COMMON: CategoryDef[] = [
  { value: 1, label: { zh: '112（歐盟與許多國家）', en: '112 (EU and many others)' } },
  { value: 2, label: { zh: '911（美洲）', en: '911 (the Americas)' } },
  { value: 3, label: { zh: '999（英國與前英國屬地）', en: '999 (UK and former British territories)' } },
];
export const EMERGENCY_AMBULANCE: CategoryDef[] = [
  ...SOS_COMMON,
  { value: 4, label: { zh: '119（台灣、日本、南韓、柬埔寨）', en: '119 (Taiwan, Japan, South Korea, Cambodia)' } },
  SOS_OTHER,
];
export const EMERGENCY_POLICE: CategoryDef[] = [
  ...SOS_COMMON,
  { value: 4, label: { zh: '110（台灣、中國、日本、德國等）', en: '110 (Taiwan, China, Japan, Germany…)' } },
  { value: 5, label: { zh: '117（瑞士與西非、中非幾國）', en: '117 (Switzerland, parts of West and Central Africa)' } },
  { value: 6, label: { zh: '17（法國與西非法語國家）', en: '17 (France and francophone West Africa)' } },
  SOS_OTHER,
];
export const EMERGENCY_FIRE: CategoryDef[] = [
  ...SOS_COMMON,
  { value: 4, label: { zh: '119（台灣、中國、日本、南韓等）', en: '119 (Taiwan, China, Japan, South Korea…)' } },
  { value: 5, label: { zh: '118（瑞士與西非、中非幾國）', en: '118 (Switzerland, parts of West and Central Africa)' } },
  { value: 6, label: { zh: '18（法國與西非法語國家）', en: '18 (France and francophone West Africa)' } },
  SOS_OTHER,
];
const SOS_NOTE = {
  zh: '依英文維基百科「List of emergency telephone numbers」（2026 年 10 月 16 日的版本，CC BY-SA 4.0）的各國表格，取每格的第一個號碼歸類；滑過國家看警察、救護、消防三個號碼，一格有好幾個號碼的寫「999／112」。條目的出處很雜（各國官方、大使館、旅遊指南），部分號碼可能過時，樓層怎麼數依維基共享資源上一位使用者畫的世界地圖（CC BY-SA 4.0，2023 年 9 月的版本），是各國的大致習慣，同一國的建築常常不一致；香港照英文維基「Storey」改成歐式；資料檔依 CC BY-SA 4.0 分享。出發前請再查最新的官方資訊。',
  en: 'From the country tables in the Wikipedia article “List of emergency telephone numbers” (revision of 16 October 2026, CC BY-SA 4.0), grouped by the first number in each cell; hover over a country for the police, ambulance and fire numbers, with alternatives written “999 / 112”. The article cites a mix of sources (governments, embassies, travel guides) and some numbers may be out of date; check current official information before you travel.',
};

function sosIndicator(id: string, label: Text, lead: { zh: string; en: string }, categories: CategoryDef[]): IndicatorDef {
  return {
    id,
    label,
    description: { zh: `${lead.zh}${SOS_NOTE.zh}`, en: `${lead.en} ${SOS_NOTE.en}` },
    unit: '',
    file: `${id}.json`,
    layer: { kind: 'categorical', categories },
    format: (v) => categoryLabel(categories, v),
    unranked: true,
    missing: { zh: '表上沒有這一國的號碼，或沒有全國統一的號碼', en: 'No number in the table, or no single national number' },
  };
}

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

/**
 * 單位的偏好（2026-11-05，製作手冊第二十二批 391；pipeline/topics/travel_units.py）：CLDR units.xml 的 unitPreferenceData，
 * 類別 1 是世界通用值（001），其他是例外的地區。順序要跟 pipeline 的 UNIT_PREFS 一樣（details.json 的 fmt.units）
 */
export const UNIT_INDICATORS: { id: string; short: Text; label: Text; categories: CategoryDef[]; description: { zh: string; en: string } }[] = [
  {
    id: 'unit-weight',
    short: { zh: '量體重', en: 'Body weight' },
    label: { zh: '量體重用什麼單位', en: 'Units for body weight' },
    categories: [
      { value: 1, label: { zh: '公斤（世界通用）', en: 'Kilograms (worldwide default)' } },
      { value: 2, label: { zh: '磅', en: 'Pounds' } },
      { value: 3, label: { zh: '英石加磅（11 st 4 lb）', en: 'Stones and pounds (11 st 4 lb)' } },
      { value: 4, label: { zh: '磅加英兩', en: 'Pounds and ounces' } },
    ],
    description: {
      zh: '說一個人多重時用的單位。只有美國用磅、英國用英石加磅（1 英石 = 14 磅，小嬰兒用磅加英兩）、香港用磅加英兩，其他 238 個國家與地區用公斤。',
      en: 'The unit for a person’s weight. Only the US uses pounds, the UK stones and pounds (1 stone = 14 lb; pounds and ounces for babies) and Hong Kong pounds and ounces; the other 238 countries and territories use kilograms.',
    },
  },
  {
    id: 'unit-height',
    short: { zh: '報身高', en: 'Height' },
    label: { zh: '報身高用什麼單位', en: 'Units for height' },
    categories: [
      { value: 1, label: { zh: '公分（世界通用）', en: 'Centimetres (worldwide default)' } },
      { value: 2, label: { zh: '英尺加英寸（5′9″）', en: 'Feet and inches (5′9″)' } },
      { value: 3, label: { zh: '公尺加公分（1 m 75）', en: 'Metres and centimetres (1 m 75)' } },
    ],
    description: {
      zh: '說一個人多高時用的單位。美國、加拿大、英國、印度用英尺加英寸（3 英尺以上），法國、西班牙、義大利、瑞典、土耳其、埃及、印尼、越南、香港等 16 個說「1 公尺 75」，其他用公分。',
      en: 'The unit for a person’s height. The US, Canada, the UK and India use feet and inches (from 3 feet); France, Spain, Italy, Sweden, Turkey, Egypt, Indonesia, Vietnam, Hong Kong and others (16 in all) say “1 m 75”; the rest use centimetres.',
    },
  },
  {
    id: 'unit-road',
    short: { zh: '路程', en: 'Road distance' },
    label: { zh: '路程用什麼單位', en: 'Units for road distance' },
    categories: [
      { value: 1, label: { zh: '公里（世界通用）', en: 'Kilometres (worldwide default)' } },
      { value: 2, label: { zh: '英里，短距離用英尺', en: 'Miles, feet for short distances' } },
      { value: 3, label: { zh: '英里，短距離用碼', en: 'Miles, yards for short distances' } },
      { value: 4, label: { zh: '北歐里（10 公里）與公里', en: 'Scandinavian miles (10 km) and kilometres' } },
    ],
    description: {
      zh: '開車、導航說還有多遠時用的單位。美國用英里（短距離用英尺），英國用英里（短距離用碼），瑞典另有北歐里（mil，10 公里），其他用公里與公尺。',
      en: 'The unit for distances on the road, as in navigation. The US uses miles (feet for short distances), the UK miles (yards for short distances), Sweden also has the Scandinavian mile (mil, 10 km); everywhere else uses kilometres and metres.',
    },
  },
  {
    id: 'unit-temperature',
    short: { zh: '氣溫', en: 'Air temperature' },
    label: { zh: '氣溫用攝氏還是華氏', en: 'Celsius or Fahrenheit for the weather' },
    categories: [
      { value: 1, label: { zh: '攝氏（世界通用）', en: 'Celsius (worldwide default)' } },
      { value: 2, label: { zh: '華氏', en: 'Fahrenheit' } },
    ],
    description: {
      zh: '天氣預報的氣溫。美國、巴哈馬、貝里斯、開曼群島、波多黎各、帛琉 6 個用華氏，其他用攝氏。',
      en: 'Temperatures in weather forecasts. The US, the Bahamas, Belize, the Cayman Islands, Puerto Rico and Palau use Fahrenheit; everywhere else uses Celsius.',
    },
  },
  {
    id: 'unit-wind',
    short: { zh: '風速', en: 'Wind speed' },
    label: { zh: '風速用什麼單位', en: 'Units for wind speed' },
    categories: [
      { value: 1, label: { zh: '公里／小時（世界通用）', en: 'km/h (worldwide default)' } },
      { value: 2, label: { zh: '公尺／秒', en: 'm/s' } },
      { value: 3, label: { zh: '英里／小時', en: 'mph' } },
    ],
    description: {
      zh: '天氣預報的風速。中國、日本、南韓、俄羅斯、波蘭與北歐的丹麥、芬蘭、挪威、瑞典 9 國用公尺／秒，英國、美國用英里／小時，其他用公里／小時。',
      en: 'Wind speed in weather forecasts. China, Japan, South Korea, Russia, Poland and the Nordic Denmark, Finland, Norway and Sweden (9 in all) use m/s, the UK and the US mph; everywhere else uses km/h.',
    },
  },
  {
    id: 'unit-pressure',
    short: { zh: '氣壓', en: 'Air pressure' },
    label: { zh: '氣壓用什麼單位', en: 'Units for air pressure' },
    categories: [
      { value: 1, label: { zh: '百帕（世界通用）', en: 'Hectopascals (worldwide default)' } },
      { value: 2, label: { zh: '毫巴', en: 'Millibars' } },
      { value: 3, label: { zh: '毫米汞柱', en: 'Millimetres of mercury' } },
      { value: 4, label: { zh: '英寸汞柱', en: 'Inches of mercury' } },
    ],
    description: {
      zh: '天氣預報的氣壓。美國用英寸汞柱，英國、巴西、埃及、以色列、泰國用毫巴（跟百帕一樣大，1 毫巴 = 1 百帕），墨西哥、俄羅斯用毫米汞柱，其他用百帕。',
      en: 'Air pressure in weather forecasts. The US uses inches of mercury; the UK, Brazil, Egypt, Israel and Thailand millibars (equal in size to hectopascals); Mexico and Russia millimetres of mercury; everywhere else hectopascals.',
    },
  },
  {
    id: 'unit-fuel',
    short: { zh: '油耗', en: 'Fuel economy' },
    label: { zh: '油耗用什麼單位', en: 'Units for fuel economy' },
    categories: [
      { value: 1, label: { zh: '公升／100 公里（世界通用）', en: 'L/100 km (worldwide default)' } },
      { value: 2, label: { zh: '公升／公里（CLDR 的寫法）', en: 'L/km (as recorded by CLDR)' } },
      { value: 3, label: { zh: '英里／美制加侖', en: 'Miles per US gallon' } },
      { value: 4, label: { zh: '英里／英制加侖', en: 'Miles per imperial gallon' } },
    ],
    description: {
      zh: '汽車油耗的單位。美國用英里／加侖，加拿大、英國用英里／英制加侖；日本、南韓、巴西、墨西哥、義大利、荷蘭、土耳其、馬來西亞、泰國 9 國 CLDR 記成「公升／公里」，實際上多半寫成倒數的「公里／公升」（每公升跑幾公里）；其他用公升／100 公里。',
      en: 'The unit for fuel economy. The US uses miles per gallon, Canada and the UK miles per imperial gallon; for Japan, South Korea, Brazil, Mexico, Italy, the Netherlands, Turkey, Malaysia and Thailand CLDR records litres per kilometre, though figures are mostly quoted the other way round, as kilometres per litre; everywhere else uses litres per 100 km.',
    },
  },
  {
    id: 'unit-floor',
    short: { zh: '室內面積', en: 'Floor area' },
    label: { zh: '室內面積用什麼單位', en: 'Units for floor area' },
    categories: [
      { value: 1, label: { zh: '平方公尺（世界通用）', en: 'Square metres (worldwide default)' } },
      { value: 2, label: { zh: '平方英尺', en: 'Square feet' } },
    ],
    description: {
      zh: '房屋、辦公室的室內面積。美國、加拿大、英國、緬甸用平方英尺，其他用平方公尺；台灣日常常用的「坪」（約 3.3058 平方公尺）不在 CLDR 裡。',
      en: 'Floor area of homes and offices. The US, Canada, the UK and Myanmar use square feet; everywhere else square metres. Taiwan’s everyday ping (about 3.3058 m²) is not in CLDR.',
    },
  },
];

/**
 * 樓層怎麼數（2026-11-05，製作手冊第二十二批 396；pipeline/topics/travel_floors.py）：維基共享資源的各國樓層數法地圖
 * （CC BY-SA 4.0）的填色，香港照英文維基「Storey」改成歐式；跳 4 樓、13 樓的忌諱只有幾國有敘述，寫在附註
 */
export const FLOOR_NUMBERING: CategoryDef[] = [
  { value: 1, label: { zh: '地面層就是 1 樓（美式，跟台灣一樣）', en: 'Ground floor is the 1st floor (American scheme, as in Taiwan)' } },
  { value: 2, label: { zh: '地面層是 G 或 0 樓，上一層才是 1 樓（歐式）', en: 'Ground floor is G or 0; the 1st floor is one up (European scheme)' } },
  { value: 3, label: { zh: '兩種都用', en: 'Both schemes' } },
];

/**
 * 地址怎麼寫、電話怎麼打（2026-11-05，使用者把已排除的候選 679、680 改成要做；pipeline/topics/travel_address_phone.py）：
 * Google libaddressinput 的地址資料（CC BY 4.0）與 libphonenumber 的號碼資料（Apache 2.0）
 */
export const ADDRESS_ORDER: CategoryDef[] = [
  { value: 1, label: { zh: '從大寫到小（郵遞區號、縣市在前，跟台灣一樣）', en: 'Largest to smallest (postcode and region first, like Taiwan)' } },
  { value: 2, label: { zh: '從小寫到大（姓名、街道在前）', en: 'Smallest to largest (name and street first)' } },
];
export const POSTCODE: CategoryDef[] = [
  { value: 1, label: { zh: '沒有郵遞區號', en: 'No postcodes' } },
  { value: 2, label: { zh: '3 位數', en: '3 digits' } },
  { value: 3, label: { zh: '4 位數', en: '4 digits' } },
  { value: 4, label: { zh: '5 位數', en: '5 digits' } },
  { value: 5, label: { zh: '6 位數', en: '6 digits' } },
  { value: 6, label: { zh: '7 位數以上', en: '7 or more digits' } },
  { value: 7, label: { zh: '含英文字母（SW1A 1AA）', en: 'Includes letters (SW1A 1AA)' } },
];
export const PHONE_INTL: CategoryDef[] = [
  { value: 1, label: { zh: '00', en: '00' } },
  { value: 2, label: { zh: '011（北美）', en: '011 (North America)' } },
  { value: 3, label: { zh: '8~10（先撥 8 再撥 10）', en: '8~10 (dial 8, wait, then 10)' } },
  { value: 4, label: { zh: '其他單一冠碼', en: 'Another single prefix' } },
  { value: 5, label: { zh: '好幾家業者各有冠碼（跟台灣一樣）', en: 'Several carrier prefixes (like Taiwan)' } },
];
export const PHONE_NATIONAL: CategoryDef[] = [
  { value: 1, label: { zh: '0（跟台灣一樣）', en: '0 (like Taiwan)' } },
  { value: 2, label: { zh: '1', en: '1' } },
  { value: 3, label: { zh: '8', en: '8' } },
  { value: 4, label: { zh: '沒有冠碼（直接撥完整號碼）', en: 'None (dial the full number)' } },
  { value: 5, label: { zh: '其他', en: 'Other' } },
];
export const PHONE_MOBILE: CategoryDef[] = [
  { value: 5, label: { zh: '5 碼', en: '5 digits' } },
  { value: 6, label: { zh: '6 碼', en: '6 digits' } },
  { value: 7, label: { zh: '7 碼', en: '7 digits' } },
  { value: 8, label: { zh: '8 碼', en: '8 digits' } },
  { value: 9, label: { zh: '9 碼（跟台灣一樣）', en: '9 digits (like Taiwan)' } },
  { value: 10, label: { zh: '10 碼', en: '10 digits' } },
  { value: 11, label: { zh: '11 碼', en: '11 digits' } },
  { value: 99, label: { zh: '不只一種長度', en: 'More than one length' } },
];

const UNIT_NOTE = {
  zh: '依 Unicode CLDR 49 的單位偏好：軟體顯示數字時選的單位，不是法定單位；CLDR 只列例外的地區，台灣跟大多數國家一樣是世界通用值，不一定是台灣實際的習慣。',
  en: 'From Unicode CLDR 49 unit preferences: the units software picks when displaying values, not legal units. CLDR lists only the exceptions; Taiwan, like most countries, gets the worldwide default, which may not match everyday local habits.',
};

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

/**
 * 服務區與休息區（2026-11-05，製作手冊第二十三批 406；pipeline/topics/travel_rest_areas.py）：OpenStreetMap 的
 * highway=services 與 highway=rest_area（ODbL），只在「行車方向」畫；左側欄列高速公路局的台灣國道服務區
 */
const DRIVING_INDICATORS = ['driving'];
const REST_AREAS: PointsOverlayDef = {
  kind: 'points',
  id: 'rest-areas',
  file: 'rest-areas.json',
  label: { zh: '服務區與休息區（OpenStreetMap）', en: 'Service and rest areas (OpenStreetMap)' },
  indicators: DRIVING_INDICATORS,
  radius: 2.4,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5],
    classes: [
      { label: { zh: '服務區（加油、餐廳、廁所）', en: 'Service areas (fuel, food, toilets)' }, color: MAP_TOKENS.hues.orange },
      { label: { zh: '休息區（停車、廁所）', en: 'Rest areas (parking, toilets)' }, color: MAP_TOKENS.hues.blue },
    ],
  },
  // 休息區放大到 6 級才畫
  more: { minZoom: 6 },
  tooltip: (p, { countryName }) => {
    const name = typeof p.n === 'string' && p.n ? p.n : '';
    return {
      title: name || (p.k === 1 ? tr({ zh: '（沒有名稱的服務區）', en: '(unnamed service area)' }) : tr({ zh: '（沒有名稱的休息區）', en: '(unnamed rest area)' })),
      properNoun: name || undefined,
      detail: [p.k === 1 ? tr({ zh: '服務區', en: 'Service area' }) : tr({ zh: '休息區', en: 'Rest area' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
        .filter(Boolean)
        .join(' · '),
    };
  },
};

const TW_SERVICE_AREAS: ListPanelDef = {
  label: { zh: '台灣的國道服務區（高速公路局）', en: 'Taiwan’s freeway service areas (Freeway Bureau)' },
  indicators: DRIVING_INDICATORS,
  file: 'service-areas-tw.json',
  rows: (points) =>
    points.map((p): ListRow => {
      const parking = [
        typeof p.car === 'number' ? tr({ zh: `小型車 ${p.car} 格`, en: `${p.car} car spaces` }) : null,
        typeof p.big === 'number' ? tr({ zh: `大型車 ${p.big} 格`, en: `${p.big} large-vehicle spaces` }) : null,
        typeof p.acc === 'number' ? tr({ zh: `無障礙 ${p.acc} 格`, en: `${p.acc} accessible` }) : null,
      ].filter(Boolean);
      return {
        key: `${p.n}-${p.dir}`,
        title: tr({ zh: `${p.n}服務區（${p.dir}）`, en: `${p.n} service area (${p.dir})` }),
        lines: [`${p.pos} · ${p.op}`, parking.join(tr({ zh: '、', en: ', ' })), String(p.theme ?? '')].filter(Boolean),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
      };
    }),
};

const travelOwn: TopicDefinition = {
  id: 'travel',
  title: { zh: '旅行實用與生活格式（時差、插頭、緊急電話、日期寫法、度量衡）', en: 'Travel essentials and local formats' },
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
      name: { zh: 'Unicode CLDR 49（一週、時間、日期、數字、度量衡、紙張、曆法與單位的慣例）', en: 'Unicode CLDR 49 (week, time, date, number, measurement, paper, calendar and unit conventions)' },
      url: 'https://cldr.unicode.org/',
      license: 'Unicode License v3',
    },
    {
      name: { zh: 'Google libaddressinput 地址資料（地址順序、郵遞區號）', en: 'Google libaddressinput address data (address order, postcodes)' },
      url: 'https://github.com/google/libaddressinput',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Google libphonenumber 9.0.43（國際冠碼、國內冠碼、手機號碼長度）', en: 'Google libphonenumber 9.0.43 (international and trunk prefixes, mobile number lengths)' },
      url: 'https://github.com/google/libphonenumber',
      license: 'Apache 2.0',
    },
    {
      name: {
        zh: '維基共享資源「Countries numbering floors.svg」（Michael Peter Fustumum，2023-09-12 的版本；樓層怎麼數）',
        en: 'Wikimedia Commons, “Countries numbering floors.svg” (Michael Peter Fustumum, version of 12 September 2023; floor numbering)',
      },
      url: 'https://commons.wikimedia.org/wiki/File:Countries_numbering_floors.svg',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「Storey」與「Tetraphobia」（樓層的叫法、跳過的樓層）', en: 'Wikipedia, “Storey” and “Tetraphobia” (floor names and skipped floors)' },
      url: 'https://en.wikipedia.org/w/index.php?title=Storey&oldid=1376363313',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'OpenStreetMap 的服務區與休息區（highway=services、rest_area，經 QLever）', en: 'OpenStreetMap service and rest areas (highway=services, rest_area, via QLever)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    {
      name: { zh: '交通部高速公路局：國道服務區簡介一覽表、停車位設施數量', en: 'Freeway Bureau, MOTC (Taiwan): freeway service areas and parking spaces' },
      url: 'https://data.gov.tw/dataset/8161',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: '英文維基百科「Mains electricity by country」（插頭、電壓與頻率）', en: 'Wikipedia, “Mains electricity by country” (plugs, voltage and frequency)' },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380969207',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of emergency telephone numbers」（緊急電話）', en: 'Wikipedia, “List of emergency telephone numbers” (emergency numbers)' },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_emergency_telephone_numbers&oldid=1380606668',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '時差是標準時間（不含夏令時間）跟台灣（UTC+8）差幾小時，用首都所在的時區；跨好幾個時區、或有夏令時間的國家，側欄與附註會寫出來。插頭與電壓依英文維基百科「Mains electricity by country」的表格（2026 年 10 月 19 日的版本，CC BY-SA 4.0），地圖用表格列出的第一個電壓；這個主題的插頭、電壓資料檔也依 CC BY-SA 4.0 分享。緊急電話依英文維基百科「List of emergency telephone numbers」（2026 年 10 月 16 日的版本，CC BY-SA 4.0），資料檔同樣依 CC BY-SA 4.0 分享。生活格式（一週的第一天、週末、12／24 小時制、日期寫法、小數點、度量衡、紙張、曆法，以及量體重、報身高、路程、氣溫、風速、氣壓、油耗、室內面積用什麼單位）依 Unicode CLDR 49，是軟體顯示日期、數字時用的慣例；日期寫法與小數點依人口比例最高的官方語言，多語國家（瑞士、比利時、加拿大、印度…）只代表其中一種語言。出發前請再查最新的官方資訊。',
    en: 'Time difference is standard time (without daylight saving) relative to Taiwan (UTC+8), using the capital’s time zone; countries with several time zones or daylight saving time are noted in the side panel. Plugs and voltage follow the Wikipedia table “Mains electricity by country” (revision of 19 October 2026, CC BY-SA 4.0), and the map uses the first voltage listed; the plug and voltage data files of this topic are shared under CC BY-SA 4.0. Emergency numbers follow the Wikipedia article “List of emergency telephone numbers” (revision of 16 October 2026, CC BY-SA 4.0), and those data files are shared under CC BY-SA 4.0 as well. Local formats (first day of the week, weekend, 12/24-hour clock, date format, decimal separator, measurement system, paper size, calendars, and the units used for body weight, height, road distance, air temperature, wind speed, air pressure, fuel economy and floor area) follow Unicode CLDR 49, the conventions software uses to display dates and numbers; date format and decimal separator follow the most widely spoken official language, so for multilingual countries (Switzerland, Belgium, Canada, India…) they reflect only one language. Floor numbering follows a world map drawn by a Wikimedia Commons user (CC BY-SA 4.0, September 2023 version) and shows each country’s general practice; buildings within a country often differ, and Hong Kong is changed to the European scheme following Wikipedia’s “Storey”. That data file is shared under CC BY-SA 4.0. Check current official information before you travel.',
  },
  panelExtra: () => import('./panels/TravelPanel'),
  overlays: [REST_AREAS],
  listPanel: TW_SERVICE_AREAS,
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
        zh: '車輛靠道路的哪一邊行駛。台灣靠右；日本、英國、香港、澳門、東南亞與南亞的許多國家、澳洲、紐西蘭、南部非洲靠左。地圖上的點是 OpenStreetMap 的服務區（橘，3.3 萬個：中國 7,565、美國 3,113、義大利 3,085；台灣 37）與休息區（藍，放大才畫，4.2 萬個：德國 2,931、澳洲 2,669；台灣 45）。各國標法不同、同一個服務區兩個方向常畫成兩個點，點的多寡也在量各國畫得多完整，不要拿來排名；左邊的清單是高速公路局的台灣國道服務區。',
        en: 'Which side of the road traffic keeps to. Taiwan drives on the right; Japan, the UK, Hong Kong, Macau, much of South and Southeast Asia, Australia, New Zealand and southern Africa drive on the left. The dots are OpenStreetMap service areas (orange, 33,000: China 7,565, the US 3,113, Italy 3,085; Taiwan 37) and rest areas (blue, drawn when zoomed in; 42,000: Germany 2,931, Australia 2,669; Taiwan 45). Countries tag them differently and the two directions of one service area are often mapped as two points, so the counts also reflect how completely each country is mapped and should not be ranked; the list on the left shows Taiwan’s freeway service areas from the Freeway Bureau.',
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
    sosIndicator(
      'emergency-ambulance',
      { zh: '叫救護車打幾號', en: 'Ambulance number' },
      {
        zh: '叫救護車撥的號碼。歐盟與許多國家是 112，美洲 911，英國與前英國屬地（香港、新加坡…）999；台灣、日本、南韓救護與消防同一個號碼 119，警察是另一個號碼（台灣、日本 110，南韓 112）。',
        en: 'The number to call for an ambulance. The EU and many other countries use 112, the Americas 911, the UK and former British territories (Hong Kong, Singapore…) 999; Taiwan, Japan and South Korea share 119 for ambulance and fire, with a separate police number (110 in Taiwan and Japan, 112 in South Korea).',
      },
      EMERGENCY_AMBULANCE,
    ),
    sosIndicator(
      'emergency-police',
      { zh: '報警打幾號', en: 'Police number' },
      {
        zh: '報警撥的號碼。台灣、中國、日本、德國是 110，法國與西非法語國家 17，瑞士 117，其他多數是 112、911 或 999。',
        en: 'The number to call the police. Taiwan, China, Japan and Germany use 110, France and francophone West Africa 17, Switzerland 117; most others use 112, 911 or 999.',
      },
      EMERGENCY_POLICE,
    ),
    sosIndicator(
      'emergency-fire',
      { zh: '火警打幾號', en: 'Fire number' },
      {
        zh: '報火警撥的號碼。台灣、中國、日本、南韓是 119，法國與西非法語國家 18，瑞士 118，其他多數是 112、911 或 999。',
        en: 'The number to call the fire brigade. Taiwan, China, Japan and South Korea use 119, France and francophone West Africa 18, Switzerland 118; most others use 112, 911 or 999.',
      },
      EMERGENCY_FIRE,
    ),
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
    // 地址與電話（2026-11-05，候選 679、680）
    formatIndicator(
      'address-order',
      { zh: '地址從大寫到小還是從小寫到大', en: 'Address order' },
      {
        zh: '寫信封、填表的地址先寫什麼。台灣、中國、香港、日本、南韓、北韓、匈牙利、伊朗、哈薩克 9 個從大寫到小（郵遞區號、縣市在前，姓名最後），其他 232 個從姓名、街道寫起、城市與郵遞區號在後。依 Google libaddressinput 的當地語言格式，同一國用英文寫時常常反過來。',
        en: 'Which comes first on an envelope or form. Taiwan, China, Hong Kong, Japan, South Korea, North Korea, Hungary, Iran and Kazakhstan (9) go from largest to smallest (postcode and region first, name last); the other 232 start with the name and street, with the city and postcode last. Based on Google libaddressinput’s local-language formats; addresses written in English often reverse the order.',
      },
      ADDRESS_ORDER,
    ),
    formatIndicator(
      'postcode',
      { zh: '郵遞區號幾位數', en: 'Postcode format' },
      {
        zh: '郵遞區號的寫法（Google libaddressinput 的第一個範例；滑過國家看例子）。5 位數 69 個（美國、德國、法國…）、4 位數 39、含英文字母 28（英國、加拿大、荷蘭、愛爾蘭…）、6 位數 20（中國、印度、俄羅斯、台灣…）、7 位數以上 9（日本、巴西、葡萄牙…）、3 位數 8，68 個沒有郵遞區號。有郵遞區號不等於大家都會寫。台灣照中華郵政 2020 年起的 3+3 六碼。',
        en: 'How postcodes are written (the first example in Google libaddressinput; hover for one). 69 use 5 digits (the US, Germany, France…), 39 use 4, 28 include letters (the UK, Canada, the Netherlands, Ireland…), 20 use 6 digits (China, India, Russia, Taiwan…), 9 use 7 or more (Japan, Brazil, Portugal…) and 8 use 3; 68 have none. Having postcodes does not mean everyone uses them. Taiwan follows Chunghwa Post’s 3+3 six-digit codes introduced in 2020.',
      },
      POSTCODE,
    ),
    formatIndicator(
      'phone-intl',
      { zh: '打國際電話先撥什麼', en: 'International call prefix' },
      {
        zh: '從這個國家打到國外要先撥的國際冠碼（Google libphonenumber）。177 個是 00，美國、加拿大等北美 26 個是 011，俄羅斯、白俄羅斯、哈薩克等 5 個是先撥 8 再撥 10，日本 010、澳洲 0011 等 12 個用其他冠碼；台灣、南韓、巴西等 16 個好幾家業者各有冠碼（台灣 002、005、006、007、009、019）。滑過國家看國碼。',
        en: 'The prefix for dialling abroad from the country (Google libphonenumber). 177 use 00, 26 in North America including the US and Canada use 011, Russia, Belarus, Kazakhstan and two others dial 8 then 10, 12 use another prefix (Japan 010, Australia 0011…), and 16 including Taiwan, South Korea and Brazil have several carrier prefixes (Taiwan 002, 005, 006, 007, 009, 019). Hover for the country code.',
      },
      PHONE_INTL,
    ),
    formatIndicator(
      'phone-national',
      { zh: '國內長途先撥什麼', en: 'Trunk prefix' },
      {
        zh: '在國內打長途或手機要先加的冠碼（Google libphonenumber）。台灣、日本、英國、德國等 108 個是 0，美國、加拿大等北美 26 個是 1，俄羅斯、白俄羅斯、哈薩克、土庫曼 4 個是 8，匈牙利是 06；97 個沒有冠碼，直接撥完整號碼（義大利、西班牙、丹麥、新加坡…）。從國外打進來時都不撥這個冠碼。',
        en: 'The prefix dialled before a long-distance or mobile number within the country (Google libphonenumber). 108 use 0 (Taiwan, Japan, the UK, Germany…), 26 in North America use 1, Russia, Belarus, Kazakhstan and Turkmenistan use 8, and Hungary 06; 97 have none and dial the full number (Italy, Spain, Denmark, Singapore…). It is dropped when calling from abroad.',
      },
      PHONE_NATIONAL,
    ),
    formatIndicator(
      'phone-mobile',
      { zh: '手機號碼幾碼', en: 'Mobile number length' },
      {
        zh: '手機號碼不含國碼與國內冠碼有幾碼（Google libphonenumber）。9 碼 66 個（台灣、法國、西班牙…，台灣加上 0 就是 09 開頭的 10 碼）、8 碼 52、10 碼 49（美國、日本、英國、印度…）、7 碼 19，中國 11 碼最長；德國、奧地利等 41 個不只一種長度（奧地利 7–13 碼），滑過國家看範圍。',
        en: 'Digits in a mobile number, without the country code or trunk prefix (Google libphonenumber). 66 use 9 (Taiwan, France, Spain…; Taiwan’s become 10 digits starting 09 with the trunk 0), 52 use 8, 49 use 10 (the US, Japan, the UK, India…), 19 use 7, and China is longest at 11; 41 including Germany and Austria have more than one length (Austria 7–13), shown on hover.',
      },
      PHONE_MOBILE,
    ),
    // 樓層怎麼數（第二十二批 396）
    {
      id: 'floor-numbering',
      label: { zh: '樓層怎麼數', en: 'Floor numbering' },
      description: {
        zh: '走進大門的那一層叫幾樓。台灣、中國、日本、南韓、美國、加拿大、俄羅斯與前蘇聯各國，加上歐洲的芬蘭、挪威、冰島，以及智利、哥倫比亞、厄瓜多、祕魯，地面層就是 1 樓（41 國）；英國、歐洲大部分、香港、墨西哥、阿根廷、巴西，與非洲、南亞、中東多數國家，地面層叫 ground floor（G）或 0 樓，上一層才是 1 樓，所以英國的 1 樓是台灣的 2 樓（167 國）；新加坡、越南、印尼、菲律賓兩種都用。電梯跳過 4 樓（香港、南韓的醫院、馬來西亞、印尼…）或 13 樓（美國、加拿大 12 層以上的建築大多沒有 13 樓）是建商的習慣，不是規定，寫在這幾國的附註。依維基共享資源的使用者繪製的地圖，同一國的建築常常不一致。',
        en: 'What the floor you enter from the street is called. In Taiwan, China, Japan, South Korea, the US, Canada, Russia and the former Soviet states, plus Finland, Norway and Iceland in Europe and Chile, Colombia, Ecuador and Peru, the ground floor is the 1st floor (41 countries). In the UK, most of Europe, Hong Kong, Mexico, Argentina, Brazil and most of Africa, South Asia and the Middle East it is the ground floor (G) or floor 0 and the 1st floor is one up, so a British 1st floor is a Taiwanese 2nd (167 countries). Singapore, Vietnam, Indonesia and the Philippines use both. Skipping the 4th floor (Hong Kong, hospitals in South Korea, Malaysia, Indonesia…) or the 13th (most US and Canadian buildings over 12 floors have none) is a builders’ custom, not a rule, and is noted for those countries. Based on a map drawn by a Wikimedia Commons user; buildings within one country often differ.',
      },
      unit: '',
      file: 'floor-numbering.json',
      layer: { kind: 'categorical', categories: FLOOR_NUMBERING },
      format: (v) => categoryLabel(FLOOR_NUMBERING, v),
      missing: { zh: '地圖上沒有資料', en: 'No data on the map' },
    },
    // 單位的偏好（第二十二批 391）
    ...UNIT_INDICATORS.map((u) =>
      formatIndicator(u.id, u.label, { zh: `${u.description.zh}${UNIT_NOTE.zh}`, en: `${u.description.en} ${UNIT_NOTE.en}` }, u.categories),
    ),
  ],
};

/** 側欄與 tooltip 共用：插頭字母寫成「A、B」或「A, B」 */
export function letters(s: string): string {
  return [...s].join(tr({ zh: '、', en: ', ' }));
}

/** 2026-11-07（製作手冊第二十四批 433）：接上出境要繳的錢（travel-fees.ts） */
export const travel: TopicDefinition = withParts(travelOwn, travelFeesPart, travelHealthPart);
