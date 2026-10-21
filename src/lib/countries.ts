/** 國名：用瀏覽器內建的 CLDR 資料取繁中名稱，不必自己維護對照表。 */

export interface CountryRef {
  iso2?: string;
  name: string;
}

export type CountryTable = Record<string, CountryRef>;

const displayNames = new Intl.DisplayNames(['zh-Hant-TW'], { type: 'region', fallback: 'none' });

// 沒有 ISO alpha-2 代碼、CLDR 查不到的區域
const CUSTOM_ZH: Record<string, string> = {
  _SOL: '索馬利蘭',
  _CYN: '北賽普勒斯',
  _IOT: '澳屬印度洋領地',
  _SIA: '錫亞琴冰川',
};

const zhCache = new Map<string, string>();

export function zhName(iso3: string, table: CountryTable | null): string {
  const cached = zhCache.get(iso3);
  if (cached) return cached;
  const ref = table?.[iso3];
  let name = CUSTOM_ZH[iso3];
  if (!name && ref?.iso2) {
    try {
      name = displayNames.of(ref.iso2) ?? '';
    } catch {
      name = '';
    }
  }
  name ||= ref?.name ?? iso3;
  if (table) zhCache.set(iso3, name);
  return name;
}

export function enName(iso3: string, table: CountryTable | null): string {
  return table?.[iso3]?.name ?? iso3;
}
