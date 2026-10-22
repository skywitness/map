/** 國名：用瀏覽器內建的 CLDR 資料（Intl.DisplayNames）取繁中或英文名稱，不必自己維護對照表。 */
import { getLang, type Lang } from '../i18n/lang';

export interface CountryRef {
  iso2?: string;
  name: string;
}

export type CountryTable = Record<string, CountryRef>;

const DISPLAY_LOCALES: Record<Lang, string> = { zh: 'zh-Hant-TW', en: 'en' };
const displayNames = new Map<Lang, Intl.DisplayNames>();

// 沒有 ISO alpha-2 代碼、CLDR 查不到的區域
const CUSTOM: Record<Lang, Record<string, string>> = {
  zh: {
    _SOL: '索馬利蘭',
    _CYN: '北賽普勒斯',
    _IOT: '澳屬印度洋領地',
    _SIA: '錫亞琴冰川',
  },
  en: {
    _SOL: 'Somaliland',
    _CYN: 'Northern Cyprus',
    _IOT: 'Australian Indian Ocean Territories',
    _SIA: 'Siachen Glacier',
    // CLDR 的英文短名稱裡比較拗口的，改成常見寫法
    COD: 'DR Congo',
    COG: 'Republic of the Congo',
    HKG: 'Hong Kong',
    MAC: 'Macao',
    MMR: 'Myanmar',
    PSE: 'Palestine',
    UMI: 'US Outlying Islands',
    VIR: 'US Virgin Islands',
  },
};

const caches: Record<Lang, Map<string, string>> = { zh: new Map(), en: new Map() };

function cldrName(iso2: string, lang: Lang): string {
  let names = displayNames.get(lang);
  if (!names) {
    names = new Intl.DisplayNames([DISPLAY_LOCALES[lang]], { type: 'region', fallback: 'none' });
    displayNames.set(lang, names);
  }
  try {
    const name = names.of(iso2) ?? '';
    // 英文的「Bosnia & Herzegovina」「St. Kitts & Nevis」改成 and
    return lang === 'en' ? name.replace(' & ', ' and ') : name;
  } catch {
    return '';
  }
}

/**
 * 國家或地區的名稱，預設用目前的介面語言。
 * 查不到時依序退回：自訂名稱 → CLDR → countries.json 的英文名（例如 XKX 科索沃）→ ISO 代碼。
 */
export function countryName(iso3: string, table: CountryTable | null, lang: Lang = getLang()): string {
  const cache = caches[lang];
  const cached = cache.get(iso3);
  if (cached) return cached;
  const ref = table?.[iso3];
  let name = CUSTOM[lang][iso3];
  if (!name && ref?.iso2) name = cldrName(ref.iso2, lang);
  name ||= ref?.name ?? iso3;
  if (table) cache.set(iso3, name);
  return name;
}

/** 繁中名稱（不管目前的介面語言） */
export function zhName(iso3: string, table: CountryTable | null): string {
  return countryName(iso3, table, 'zh');
}

/** 英文名稱（不管目前的介面語言） */
export function enName(iso3: string, table: CountryTable | null): string {
  return countryName(iso3, table, 'en');
}
