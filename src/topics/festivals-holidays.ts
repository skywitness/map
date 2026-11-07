import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, SourceDef } from './types';

/**
 * 節慶的擴充：這個節日在哪些國家放假、假日跟著哪一本曆走（2026-11-07，製作手冊第二十七批 559，候選 1262、1263；
 * pipeline/topics/holiday_calendars.py）。資料是 Python 套件 holidays 0.108 的 2026 年公共假日（跟「國定假日」主題同一版）。
 */

/** 子項目（pipeline 的 FESTIVALS） */
export const HOLIDAY_FESTIVALS: { id: string; label: Text }[] = [
  { id: 'new-year', label: { zh: '元旦（1 月 1 日）', en: 'New Year’s Day (1 January)' } },
  { id: 'christmas', label: { zh: '聖誕節（含東正教的 1 月 7 日）', en: 'Christmas (incl. Orthodox 7 January)' } },
  { id: 'labour-day', label: { zh: '勞動節（5 月 1 日）', en: 'Labour Day (1 May)' } },
  { id: 'good-friday', label: { zh: '耶穌受難日', en: 'Good Friday' } },
  { id: 'easter-monday', label: { zh: '復活節星期一', en: 'Easter Monday' } },
  { id: 'eid-al-fitr', label: { zh: '開齋節', en: 'Eid al-Fitr' } },
  { id: 'eid-al-adha', label: { zh: '宰牲節', en: 'Eid al-Adha' } },
  { id: 'lunar-new-year', label: { zh: '農曆新年', en: 'Lunar New Year' } },
  { id: 'diwali', label: { zh: '排燈節', en: 'Diwali' } },
  { id: 'buddha', label: { zh: '佛誕（衛塞節）', en: 'Buddha’s Birthday (Vesak)' } },
];
export const holidayFestivalLabel = (id: string) => tr(HOLIDAY_FESTIVALS.find((f) => f.id === id)?.label ?? '');

const OFF: CategoryDef[] = [
  { value: 1, label: { zh: '放假', en: 'Public holiday' }, color: MAP_TOKENS.categorical[0] },
  { value: 2, label: { zh: '不放假', en: 'Not a public holiday' }, color: MAP_TOKENS.categoricalOther },
];

/** 曆法的類別（pipeline 的 CLASS_NAMES；8 是一次性的假日，只在側欄） */
export const HOLIDAY_CALENDARS: (CategoryDef & { short: Text })[] = [
  { value: 1, label: { zh: '復活節（基督宗教的移動節日）', en: 'Easter (Christian movable feasts)' }, short: { zh: '復活節', en: 'Easter' } },
  { value: 2, label: { zh: '伊斯蘭曆', en: 'Islamic calendar' }, short: { zh: '伊斯蘭曆', en: 'Islamic' } },
  { value: 3, label: { zh: '農曆', en: 'Chinese lunisolar calendar' }, short: { zh: '農曆', en: 'Chinese' } },
  { value: 4, label: { zh: '印度曆', en: 'Hindu calendar' }, short: { zh: '印度曆', en: 'Hindu' } },
  { value: 5, label: { zh: '其他陰曆（佛曆、希伯來曆等）', en: 'Other lunar calendars (Buddhist, Hebrew, etc.)' }, short: { zh: '其他陰曆', en: 'Other lunar' } },
  { value: 6, label: { zh: '某月第幾個星期幾', en: 'Nth weekday of a month' }, short: { zh: '某月第幾個星期幾', en: 'Nth weekday' } },
  { value: 7, label: { zh: '其他（波斯曆、春分秋分等）', en: 'Other (Persian calendar, equinoxes, etc.)' }, short: { zh: '其他', en: 'Other' } },
  { value: 0, label: { zh: '都是固定日期', en: 'All on fixed dates' }, short: { zh: '固定日期', en: 'Fixed date' }, color: MAP_TOKENS.categoricalOther },
];
export const ONE_OFF = 8;
export const calendarShort = (v: number) =>
  v === ONE_OFF ? tr({ zh: '一次性', en: 'One-off' }) : tr(HOLIDAY_CALENDARS.find((c) => c.value === v)?.short ?? '');

export const HOLIDAY_INDICATOR_IDS = new Set(['holiday-festival', 'holiday-variable', 'holiday-calendar']);

const NOTE: Text = {
  zh: '資料是 Python 套件 holidays 0.108 的 2026 年公共假日（不含補假，聯邦制國家只算全國層級），245 個國家與地區。節日依套件裡加假日的程式（例如「加聖誕節」），不是只比日期：台灣的 12 月 25 日是行憲紀念日，不算聖誕節。',
  en: 'Data are the 2026 public holidays in the Python package holidays 0.108 (without substitute days; federal countries at national level only), for 245 countries and territories. Holidays are identified by the code in the package that adds them (for example “add Christmas Day”), not just by date: in Taiwan 25 December is Constitution Day, not Christmas.',
};

export const HOLIDAY_SOURCE: SourceDef = {
  name: { zh: 'Python 套件 holidays 0.108（Open World Holidays Framework）', en: 'Python package holidays 0.108 (Open World Holidays Framework)' },
  url: 'https://github.com/vacanza/holidays',
  license: 'MIT',
};

export const HOLIDAY_INDICATORS: IndicatorDef[] = [
  {
    id: 'holiday-festival',
    // 卡片與圖例的標題是子項目接指標名稱：「農曆新年放不放假」
    label: { zh: '放不放假', en: 'as a public holiday' },
    description: {
      zh: `${tr(NOTE, 'zh')}2026 年：元旦 222 國、聖誕節 207（含東正教國家的 1 月 7 日）、5 月 1 日勞動節 165、耶穌受難日 135、復活節星期一 129、開齋節 77、宰牲節 76；農曆新年 16 國（台灣、中國、香港、澳門、南韓、北韓、越南、新加坡、馬來西亞、印尼、汶萊、菲律賓、緬甸、模里西斯、蘇利南、聖誕島），佛誕 11 國（南韓、香港、印度、尼泊爾、斯里蘭卡、泰國、柬埔寨、蒙古、馬來西亞、新加坡、印尼），排燈節 10 國（印度、尼泊爾、斯里蘭卡、緬甸、新加坡、模里西斯、斐濟、蓋亞那、蘇利南、千里達及托巴哥）。台灣放元旦、勞動節與農曆新年。滑過看那一天的假日名稱。`,
      en: `${tr(NOTE, 'en')} In 2026 New Year’s Day is a public holiday in 222 countries, Christmas in 207 (including 7 January in Orthodox countries), 1 May Labour Day in 165, Good Friday in 135, Easter Monday in 129, Eid al-Fitr in 77 and Eid al-Adha in 76; Lunar New Year in 16 (Taiwan, China, Hong Kong, Macao, South Korea, North Korea, Vietnam, Singapore, Malaysia, Indonesia, Brunei, the Philippines, Myanmar, Mauritius, Suriname and Christmas Island), Buddha’s Birthday in 11 (South Korea, Hong Kong, India, Nepal, Sri Lanka, Thailand, Cambodia, Mongolia, Malaysia, Singapore and Indonesia) and Diwali in 10 (India, Nepal, Sri Lanka, Myanmar, Singapore, Mauritius, Fiji, Guyana, Suriname and Trinidad and Tobago). Taiwan has New Year’s Day, Labour Day and Lunar New Year. Hover for the holiday’s name that day.`,
    },
    unit: '',
    file: 'holiday/{item}.json',
    dimension: { label: { zh: '節日', en: 'Festival' }, options: HOLIDAY_FESTIVALS, defaultOption: 'christmas' },
    layer: { kind: 'categorical', categories: OFF },
    format: (v) => tr(OFF.find((c) => c.value === v)?.label ?? ''),
    timeless: true,
  },
  {
    id: 'holiday-variable',
    label: { zh: '不在固定日期的公共假日有幾個', en: 'Public holidays not on a fixed date' },
    description: {
      zh: `${tr(NOTE, 'zh')}2026 年的公共假日名目（同名的連續幾天算一個）裡，有幾個不是每年在格里曆的同一天：跟著農曆、伊斯蘭曆、印度曆、復活節走，或是某月第幾個星期幾。尼泊爾 32 個最多，伊朗 25、斯里蘭卡 21、印度 13、印尼 12、緬甸 11；南韓 8、日本 6（4 個「快樂星期一」與春分、秋分）、美國 6（某月第幾個星期一、四）、台灣 5（農曆除夕、春節、民族掃墓節、端午、中秋）、中國 5、德國 4（復活節系），9 國全部是固定日期。一次性的假日（選舉日、臨時放假）不算。滑過看各曆法的名目數，點國家看假日清單。`,
      en: `${tr(NOTE, 'en')} Of each country’s 2026 public holidays (consecutive days with the same name count once), how many do not fall on the same Gregorian date every year: they follow the Chinese, Islamic or Hindu calendar or Easter, or are the nth weekday of a month. Nepal has the most at 32, followed by Iran 25, Sri Lanka 21, India 13, Indonesia 12 and Myanmar 11; South Korea 8, Japan 6 (four “Happy Mondays” and the two equinoxes), the US 6 (nth Mondays and Thursdays), Taiwan 5 (Lunar New Year’s Eve, Lunar New Year, Tomb Sweeping Day, Dragon Boat Festival and Mid-Autumn Festival), China 5 and Germany 4 (Easter-linked), while 9 countries have only fixed dates. One-off holidays (election days, ad hoc closures) are not counted. Hover for counts by calendar and click a country for its list.`,
    },
    unit: { zh: '個', en: 'holidays' },
    file: 'holiday-variable.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 5, 7, 10, 15] } },
    format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) }),
    formatTick: (v) => fixed(v, 0),
    integer: true,
    timeless: true,
  },
  {
    id: 'holiday-calendar',
    label: { zh: '假日最常跟著哪一本曆走', en: 'Calendar most public holidays follow' },
    description: {
      zh: `${tr(NOTE, 'zh')}不在固定日期的假日名目，最多是跟著哪一種曆法（同樣多時依圖例的順序）。2026 年：復活節 140 國（歐洲、美洲、非洲的基督宗教國家）、伊斯蘭曆 56、某月第幾個星期幾 21（美國、英國、愛爾蘭、日本、墨西哥等）、農曆 7（台灣、中國、香港、澳門、南韓、北韓、越南）、其他陰曆 7（以色列的希伯來曆，泰國、斯里蘭卡、緬甸、柬埔寨、不丹、蒙古的佛曆等）、印度曆 3（印度、尼泊爾、模里西斯）、其他 2，9 國都是固定日期。日常用格里曆的國家，假日不一定跟格里曆：台灣 13 個名目裡 5 個跟農曆。`,
      en: `${tr(NOTE, 'en')} Which calendar most of the movable public holidays follow (ties broken in legend order). In 2026: Easter in 140 countries (the Christian countries of Europe, the Americas and Africa), the Islamic calendar in 56, nth weekdays in 21 (the US, the UK, Ireland, Japan, Mexico and others), the Chinese calendar in 7 (Taiwan, China, Hong Kong, Macao, South Korea, North Korea and Vietnam), other lunar calendars in 7 (Israel’s Hebrew calendar and the Buddhist calendars of Thailand, Sri Lanka, Myanmar, Cambodia, Bhutan and Mongolia), the Hindu calendar in 3 (India, Nepal and Mauritius) and others in 2, while 9 countries use fixed dates only. Countries that use the Gregorian calendar day to day need not set their holidays by it: 5 of Taiwan’s 13 follow the Chinese calendar.`,
    },
    unit: '',
    file: 'holiday-calendar.json',
    layer: { kind: 'categorical', categories: HOLIDAY_CALENDARS },
    format: (v) => tr(HOLIDAY_CALENDARS.find((c) => c.value === v)?.label ?? ''),
    timeless: true,
  },
];
