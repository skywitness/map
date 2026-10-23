import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 旅行實用（pipeline/topics/travel.py）：跟台灣的時差、行車方向、插頭類型、電壓與頻率。
 * 資料不隨時間變化（timeless）。類別代碼跟 pipeline 的 LEFT/RIGHT、PLUG_*、POWER_* 一致。
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

const categoryLabel = (list: CategoryDef[], v: number) => tr(list.find((c) => c.value === v)?.label ?? '');

const TIME_THRESHOLDS = [-10.5, -4.5, -0.5, 0.5, 2.5, 4.5];

export const travel: TopicDefinition = {
  id: 'travel',
  title: { zh: '旅行實用（時差、行車方向、插頭與電壓）', en: 'Travel essentials' },
  shortTitle: { zh: '旅行實用', en: 'Travel' },
  defaultIndicator: 'time-difference',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'IANA 時區資料庫（tzdata 2026e）', en: 'IANA Time Zone Database (tzdata 2026e)' },
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
      name: { zh: '英文維基百科「Mains electricity by country」（插頭、電壓與頻率）', en: 'Wikipedia, “Mains electricity by country” (plugs, voltage and frequency)' },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380969207',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '時差是標準時間（不含夏令時間）跟台灣（UTC+8）差幾小時，用首都所在的時區；跨好幾個時區、或有夏令時間的國家，側欄與附註會寫出來。插頭與電壓依英文維基百科「Mains electricity by country」的表格（2026 年 10 月 19 日的版本，CC BY-SA 4.0），地圖用表格列出的第一個電壓；這個主題的插頭、電壓資料檔也依 CC BY-SA 4.0 分享。出發前請再查最新的官方資訊。',
    en: 'Time difference is standard time (without daylight saving) relative to Taiwan (UTC+8), using the capital’s time zone; countries with several time zones or daylight saving time are noted in the side panel. Plugs and voltage follow the Wikipedia table “Mains electricity by country” (revision of 19 October 2026, CC BY-SA 4.0), and the map uses the first voltage listed; the plug and voltage data files of this topic are shared under CC BY-SA 4.0. Check current official information before you travel.',
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
  ],
};

/** 側欄與 tooltip 共用：插頭字母寫成「A、B」或「A, B」 */
export function letters(s: string): string {
  return [...s].join(tr({ zh: '、', en: ', ' }));
}
