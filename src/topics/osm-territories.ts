import type { Text } from '../i18n/lang';

/**
 * OpenStreetMap 依國界分國時的口徑（製作手冊 1-f，使用者 2026-11-08；pipeline/sources/osm_qlever.py 的 SUB_TERRITORIES）：
 * 跟用座標判國的主題（geoindex.py、Natural Earth）一致，香港、澳門與 18 個海外屬地從母國分出來；法國的 5 個海外省照舊算進法國。
 */
export const OSM_TERRITORIES = {
  zh: 'OpenStreetMap 依國界計數時，香港、澳門、波多黎各、關島、奧蘭等 20 個特別行政區與海外屬地分開算，不算在母國；法國含 5 個海外省（留尼旺、瓜地洛普、馬提尼克、法屬圭亞那、馬約特）。',
  en: 'In OpenStreetMap counts by border, Hong Kong, Macao, Puerto Rico, Guam, Åland and 15 other special administrative regions and overseas territories are counted separately from their mother countries; France includes its five overseas departments (Réunion, Guadeloupe, Martinique, French Guiana and Mayotte).',
};

/** 主題或指標的附註後面接上 OSM_TERRITORIES */
export function withTerritories(note: Text): { zh: string; en: string } {
  const zh = typeof note === 'string' ? note : note.zh;
  const en = typeof note === 'string' ? note : note.en;
  return { zh: zh + OSM_TERRITORIES.zh, en: `${en} ${OSM_TERRITORIES.en}` };
}
