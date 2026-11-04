import { tr } from '../i18n/lang';
import { MONTHS, monthLabel } from './months';
import type { TopicDefinition } from './types';

/**
 * 國定假日（2026-11-04，製作手冊第二十一批 344，合併 888；pipeline/topics/holidays.py）：
 * Python 套件 holidays 0.108（MIT）離線算出 2017–2027 年各國的法定假日（只算 public 類），
 * 一年幾天（含補假、不含補假）與假日最多的月份。聯邦制國家只算全國層級，各地的範圍寫在 tooltip。
 */

const days = (v: number) => tr({ zh: `${v} 天`, en: `${v} days` });

export const holidays: TopicDefinition = {
  id: 'holidays',
  title: { zh: '國定假日：一年放幾天、哪個月最多', en: 'Public holidays: how many, and which month has the most' },
  shortTitle: { zh: '國定假日', en: 'Public holidays' },
  defaultIndicator: 'public-holidays',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'holidays 0.108（Open World Holidays Framework，vacanza）的 Python 套件，離線計算',
        en: 'holidays 0.108 (Open World Holidays Framework, vacanza), Python package, computed offline',
      },
      url: 'https://github.com/vacanza/holidays',
      license: { zh: 'MIT 授權（© vacanza 與貢獻者）', en: 'MIT License (© vacanza and contributors)' },
    },
  ],
  note: {
    zh: '依 Python 套件 holidays 0.108 寫在程式碼裡的各國假日規則計算（MIT 授權），只算法定的國定假日（public），不算公務員才放的、可選的、學校的或半天的假。同一天有兩個假日算一天；落在週末的也算，所以這是法律規定的假日天數，不是比平常多放幾天。「含補假」包括假日遇到週末的補假與中國、越南把週末挪過來的調休日；「不含補假」把它們拿掉（套件有英文名稱的國家才分得出調休日）。聯邦制國家只算全國的假日：德國 9 天、瑞士 4 天、加拿大 5 天、美國 12 天是聯邦假日，各州、省、邦另有地方假日，範圍寫在滑過國家的說明。伊斯蘭曆與農曆的假日每年在公曆上的日期不同，所以天數與最多的月份每年會變。2027 年以後各國還可能修法或臨時放假（例如選舉日），以政府公告為準。跟「節慶」主題不同：那裡畫的是各地的節慶活動。',
    en: 'Computed from the holiday rules coded in the Python package holidays 0.108 (MIT License), counting only statutory public holidays, not those for civil servants only, optional, school or half-day holidays. Two holidays on the same day count once, and holidays falling on weekends still count, so this is the number of holidays in law, not the number of extra days off. “Including substitute days” adds days off in lieu of holidays falling on weekends and the bridge days China and Vietnam create by moving weekends; “excluding substitute days” removes them (bridge days can only be identified for countries with English holiday names in the package). Federal countries count national holidays only: Germany 9, Switzerland 4, Canada 5 and the US 12 federal holidays, with more in each state or province (the range is in the hover text). Islamic and lunisolar holidays move around the Gregorian calendar, so totals and the busiest month change from year to year. Countries may still amend laws or add one-off days off (such as election days) for 2027 and beyond; official announcements prevail. Unlike the Festivals topic, which maps festival events, this is about days off in law.',
  },
  indicators: [
    {
      id: 'public-holidays',
      label: { zh: '一年幾天國定假日（含補假）', en: 'Public holidays a year (incl. substitute days)' },
      description: {
        zh: '一年有幾天法定的國定假日，含補假與調休日。2026 年尼泊爾、伊朗 32 天最多，梵蒂岡 29、緬甸 27、斯里蘭卡、亞塞拜然 25；台灣、南韓、中國都是 22 天（台灣含補假 6 天）；日本、印度、俄羅斯 18，美國 12、法國 11、德國 9，英國、墨西哥 7，加拿大、烏拉圭 5，瑞士只有 4 天全國假日。台灣 2025 年起多了孔子誕辰、光復節與行憲紀念日。',
        en: 'Statutory public holidays a year, including substitute days. In 2026 Nepal and Iran have the most at 32, followed by Vatican City 29, Myanmar 27, Sri Lanka and Azerbaijan 25; Taiwan, South Korea and China all have 22 (Taiwan including 6 substitute days); Japan, India and Russia 18, the US 12, France 11, Germany 9, the UK and Mexico 7, Canada and Uruguay 5, and Switzerland only 4 national holidays. Taiwan added Confucius’s Birthday, Retrocession Day and Constitution Day from 2025.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'public-holidays.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 11, 14, 17, 20, 24] } },
      format: days,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'public-holidays-base',
      label: { zh: '一年幾天國定假日（不含補假）', en: 'Public holidays a year (excl. substitute days)' },
      description: {
        zh: '同上，但不算假日遇到週末的補假，也不算中國、越南把週末挪過來的調休日。2026 年台灣 16 天（補假 6 天）、中國 13 天（調休與補假 9 天）、南韓 18 天、日本 16 天、美國 11 天。',
        en: 'As above, but without days off in lieu of holidays falling on weekends or the bridge days China and Vietnam create by moving weekends. In 2026 Taiwan has 16 (plus 6 substitute days), China 13 (plus 9 bridge and substitute days), South Korea 18, Japan 16 and the US 11.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'public-holidays-base.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 11, 14, 17, 20, 24] } },
      format: days,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'holiday-month',
      label: { zh: '國定假日最多的月份', en: 'Month with the most public holidays' },
      description: {
        zh: '一年裡國定假日（含補假）最多的月份，同樣多時取較早的月份（滑過國家看並列的月份）。2026 年 5 月最多（72 國：勞動節、歐洲的升天節與聖靈降臨節，伊斯蘭國家的宰牲節），其次是 4 月（63 國，復活節）；台灣、中國、越南是 2 月（春節），美國、加拿大、墨西哥、俄羅斯是 1 月，英國、阿根廷、菲律賓是 12 月。伊斯蘭國家的開齋節與宰牲節每年往前約 11 天，最多的月份也跟著移動，可以拉時間軸看。',
        en: 'The month with the most public holidays (including substitute days), taking the earlier month in a tie (hover to see tied months). In 2026 May leads (72 countries: Labour Day, Ascension and Whit Monday in Europe, Eid al-Adha in Muslim countries), followed by April (63, Easter); Taiwan, China and Vietnam peak in February (Lunar New Year), the US, Canada, Mexico and Russia in January, and the UK, Argentina and the Philippines in December. Eid al-Fitr and Eid al-Adha move about 11 days earlier each year, and so does the busiest month in Muslim countries; drag the timeline to see it.',
      },
      unit: '',
      file: 'holiday-month.json',
      layer: { kind: 'categorical', categories: MONTHS.map(({ value, label, color }) => ({ value, label, color })) },
      format: monthLabel,
      unranked: true,
    },
  ],
};
