import { getLang, tr, type Lang } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { CategoryDef, Text, TopicDefinition } from './types';

/**
 * 語言代碼 ↔ 類別圖的數值：主要官方語言的指標檔存的是語言代碼的 36 進位數（en → 527），
 * pipeline/topics/language.py 用 int(code, 36) 換算，這裡用 toString(36) 換回來，兩邊不必共用對照表。
 */
const code36 = (code: string) => parseInt(code, 36);

/** CLDR 沒有，或台灣習慣的叫法不同的語言名稱（跟 pipeline 的 NAMES 一致） */
const NAMES: Record<string, Text> = {
  zh: { zh: '華語（中文）', en: 'Chinese (Mandarin)' },
  nan: { zh: '台語（閩南語）', en: 'Taiwanese Hokkien (Min Nan)' },
  hak: { zh: '客語', en: 'Hakka' },
  yue: { zh: '粵語', en: 'Cantonese' },
  ar: { zh: '阿拉伯語', en: 'Arabic' },
  ms: { zh: '馬來語／印尼語', en: 'Malay/Indonesian' },
  fox: { zh: '原住民族語（16 族合計）', en: 'Formosan languages (16 combined)' },
};

const displayNames = new Map<Lang, Intl.DisplayNames | null>();

/**
 * 語言名稱：先查上面的對照表，再用瀏覽器內建的 CLDR 名稱（Intl.DisplayNames）。
 * 繁中的 CLDR 名稱多是「英文」「阿拉伯文」這種書面語的叫法，這裡講的是會說的人，改成「英語」。
 * 瀏覽器查不到時回傳 null，由呼叫端退回 pipeline 輸出的名稱或代碼。
 */
export function languageName(code: string, lang: Lang = getLang()): string | null {
  const own = NAMES[code];
  if (own) return tr(own, lang);
  if (!displayNames.has(lang)) {
    try {
      displayNames.set(lang, new Intl.DisplayNames([lang === 'en' ? 'en' : 'zh-TW'], { type: 'language', fallback: 'none' }));
    } catch {
      displayNames.set(lang, null);
    }
  }
  let name: string | undefined;
  try {
    name = displayNames.get(lang)?.of(code.replace('_', '-'));
  } catch {
    return null; // 不合法的代碼
  }
  if (!name) return null;
  return lang === 'zh' && name !== '中文' ? name.replace(/文(?=$|（)/, '語') : name; // i18n-ignore（只在中文介面）
}

/** 比例：CLDR 多半是整數（95%），普查有一位小數（96.8%），照原本的精度顯示；digits 指定 1% 以上的小數位數 */
export const pct = (v: number, digits?: number) =>
  `${fixed(v, v < 1 ? 2 : (digits ?? (Number.isInteger(v) ? 0 : 1)))}%`;
const PEOPLE = { zh: '人', en: 'people' };

/** 子項目選單的語言（跟 pipeline/topics/language.py 的 ITEMS 一致） */
const GLOBAL = { zh: '國際通用', en: 'Widely used' };
const ASIA = { zh: '亞洲', en: 'Asia' };
const AFRICA = { zh: '非洲', en: 'Africa' };
const EUROPE = { zh: '歐洲', en: 'Europe' };
const LANGUAGES: { id: string; label: Text; group: Text }[] = [
  { id: 'en', label: { zh: '英語', en: 'English' }, group: GLOBAL },
  { id: 'zh', label: NAMES.zh, group: GLOBAL },
  { id: 'es', label: { zh: '西班牙語', en: 'Spanish' }, group: GLOBAL },
  { id: 'fr', label: { zh: '法語', en: 'French' }, group: GLOBAL },
  { id: 'ar', label: { zh: '阿拉伯語（含各地口語）', en: 'Arabic (all varieties)' }, group: GLOBAL },
  { id: 'ru', label: { zh: '俄語', en: 'Russian' }, group: GLOBAL },
  { id: 'pt', label: { zh: '葡萄牙語', en: 'Portuguese' }, group: GLOBAL },
  { id: 'de', label: { zh: '德語', en: 'German' }, group: GLOBAL },
  { id: 'nan', label: NAMES.nan, group: ASIA },
  { id: 'hak', label: NAMES.hak, group: ASIA },
  { id: 'yue', label: NAMES.yue, group: ASIA },
  { id: 'ja', label: { zh: '日語', en: 'Japanese' }, group: ASIA },
  { id: 'ko', label: { zh: '韓語', en: 'Korean' }, group: ASIA },
  { id: 'vi', label: { zh: '越南語', en: 'Vietnamese' }, group: ASIA },
  { id: 'th', label: { zh: '泰語', en: 'Thai' }, group: ASIA },
  { id: 'ms', label: NAMES.ms, group: ASIA },
  { id: 'fil', label: { zh: '菲律賓語', en: 'Filipino' }, group: ASIA },
  { id: 'hi', label: { zh: '印地語', en: 'Hindi' }, group: ASIA },
  { id: 'bn', label: { zh: '孟加拉語', en: 'Bengali' }, group: ASIA },
  { id: 'ur', label: { zh: '烏爾都語', en: 'Urdu' }, group: ASIA },
  { id: 'ta', label: { zh: '坦米爾語', en: 'Tamil' }, group: ASIA },
  { id: 'fa', label: { zh: '波斯語', en: 'Persian' }, group: ASIA },
  { id: 'tr', label: { zh: '土耳其語', en: 'Turkish' }, group: ASIA },
  { id: 'sw', label: { zh: '斯瓦希里語', en: 'Swahili' }, group: AFRICA },
  { id: 'ha', label: { zh: '豪薩語', en: 'Hausa' }, group: AFRICA },
  { id: 'yo', label: { zh: '約魯巴語', en: 'Yoruba' }, group: AFRICA },
  { id: 'am', label: { zh: '阿姆哈拉語', en: 'Amharic' }, group: AFRICA },
  { id: 'it', label: { zh: '義大利語', en: 'Italian' }, group: EUROPE },
  { id: 'nl', label: { zh: '荷蘭語', en: 'Dutch' }, group: EUROPE },
  { id: 'pl', label: { zh: '波蘭語', en: 'Polish' }, group: EUROPE },
];

/** 主要官方語言的類別：當主要官方語言的國家最多、或涵蓋大片土地的 8 種，其餘併成「其他語言」 */
const MAIN: CategoryDef[] = ['en', 'fr', 'es', 'ar', 'pt', 'ru', 'zh', 'de'].map((id) => ({
  value: code36(id),
  label: id === 'ar' ? NAMES.ar : LANGUAGES.find((l) => l.id === id)!.label,
}));

/** 官方地位（跟 pipeline 的 STATUS_CODE 一致），由強到弱，地圖用循序色由深到淺 */
const STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '官方語言', en: 'Official' } },
  { value: 2, label: { zh: '事實上的官方語言', en: 'De facto official' } },
  { value: 3, label: { zh: '部分地區的官方語言', en: 'Official in some regions' } },
  { value: 4, label: { zh: '有人使用，但沒有官方地位', en: 'Spoken, no official status' } },
];
const statusLabel = (v: number) => tr(STATUS.find((s) => s.value === v)?.label ?? '');

export const language: TopicDefinition = {
  id: 'language',
  title: { zh: '各國語言', en: 'Languages by country' },
  shortTitle: { zh: '語言', en: 'Languages' },
  defaultIndicator: 'main',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Unicode CLDR 49（各國語言使用人口）', en: 'Unicode CLDR 49 (territory language populations)' },
      url: 'https://cldr.unicode.org/',
      license: 'Unicode License v3',
    },
    { name: 'Glottolog 5.3', url: 'https://glottolog.org/', license: 'CC BY 4.0' },
    {
      name: { zh: '行政院主計總處，109 年人口及住宅普查', en: 'DGBAS (Taiwan), 2020 Population and Housing Census' },
      url: 'https://www.dgbas.gov.tw/News_Content.aspx?n=3602&s=230162',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: 'CLDR 的比例是「會說這種語言的人口比例」，包含當第二語言使用的人，所以一國各語言的比例加總常超過 100%；各國數字由 CLDR 從普查與文獻彙整，年份不一，只有單一時間點。CLDR 沒有列出的國家畫成灰色（使用者很少或沒有資料）。台灣改用 109 年人口及住宅普查（6 歲以上本國籍常住人口，主要或次要使用語言）。語言數是 Glottolog 收錄、分布在該國而且還沒消失的語言（含手語），通常不含近代移民帶來的語言。',
    en: "CLDR shares are the share of the population who speak the language, including as a second language, so a country's shares often add up to more than 100%. CLDR compiles them from censuses and other sources from different years, and there is only a single snapshot. Countries CLDR does not list are grey (few or no speakers, or no data). For Taiwan the 2020 Population and Housing Census is used instead (resident citizens aged 6 and over, main or second language). Language counts are the languages Glottolog records as spoken in the country and not extinct (sign languages included); they usually exclude languages brought by recent immigrants.",
  },
  dimension: {
    label: { zh: '語言', en: 'Language' },
    options: LANGUAGES,
    defaultOption: 'en',
  },
  panelExtra: () => import('./panels/LanguagePanel'),
  indicators: [
    {
      id: 'main',
      label: { zh: '主要官方語言', en: 'Main official language' },
      description: {
        zh: '各國的官方語言（含事實上的官方語言）中，會說的人最多的一種；沒有官方語言的取會說的人最多的語言。滑過或點選圖例可以只看某一種語言。',
        en: 'The official (or de facto official) language spoken by the most people in each country; where no language is official, the most widely spoken one. Hover over or click the legend to show a single language.',
      },
      unit: '',
      file: 'main.json',
      layer: { kind: 'categorical', categories: MAIN, other: { zh: '其他語言', en: 'Other languages' } },
      format: (v) => languageName(v.toString(36)) ?? v.toString(36),
    },
    {
      id: 'share',
      label: { zh: '使用人口比例', en: 'Share of speakers' },
      description: {
        zh: '會說這種語言的人占全國人口的比例，包含當第二語言使用的人。',
        en: 'Share of the population who speak the language, including as a second language.',
      },
      unit: '%',
      file: 'share/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 75] } },
      format: (v) => pct(v),
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'speakers',
      label: { zh: '使用人數', en: 'Speakers' },
      description: {
        zh: '會說這種語言的人數（人口 × 使用比例），包含當第二語言使用的人。',
        en: 'Number of people who speak the language (population × share of speakers), including second-language speakers.',
      },
      unit: PEOPLE,
      file: 'speakers/{item}.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'status',
      label: { zh: '官方地位', en: 'Official status' },
      description: {
        zh: '這種語言在各國的法律地位：全國的官方語言、事實上的官方語言（沒有明文規定但實際上通用），或只在部分地區是官方語言。',
        en: 'Legal status of the language in each country: official nationwide, de facto official (not written into law but used as such), or official only in some regions.',
      },
      unit: '',
      file: 'status/{item}.json',
      layer: { kind: 'categorical', categories: STATUS, ordinal: true },
      format: statusLabel,
    },
    {
      id: 'diversity',
      label: { zh: '語言數', en: 'Number of languages' },
      description: {
        zh: '在這個國家使用、還沒消失的語言有幾種（Glottolog，含手語）。巴布亞紐幾內亞、印尼、奈及利亞都有幾百種。',
        en: 'Number of languages spoken in the country that are not extinct (Glottolog, sign languages included). Papua New Guinea, Indonesia and Nigeria each have hundreds.',
      },
      unit: { zh: '種', en: 'languages' },
      file: 'diversity.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'language' : 'languages'}` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
