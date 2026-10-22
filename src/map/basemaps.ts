import type { Text } from '../i18n/lang';

/** 可切換的底圖（OpenFreeMap 的樣式，免費、不需金鑰；資料 © OpenMapTiles、© OpenStreetMap contributors） */
export interface Basemap {
  id: string;
  label: Text;
  url: string;
  /** 深色底圖上，鐵路、選取外框等要改用淺色 */
  dark: boolean;
}

export const BASEMAPS: Basemap[] = [
  { id: 'terrain', label: { zh: '彩色地形', en: 'Terrain' }, url: 'https://tiles.openfreemap.org/styles/liberty', dark: false },
  { id: 'bright', label: { zh: '亮色街道', en: 'Bright streets' }, url: 'https://tiles.openfreemap.org/styles/bright', dark: false },
  { id: 'positron', label: { zh: '淺灰', en: 'Light grey' }, url: 'https://tiles.openfreemap.org/styles/positron', dark: false },
  { id: 'dark', label: { zh: '深色', en: 'Dark' }, url: 'https://tiles.openfreemap.org/styles/dark', dark: true },
  { id: 'fiord', label: { zh: '深藍', en: 'Dark blue' }, url: 'https://tiles.openfreemap.org/styles/fiord', dark: true },
];

export const DEFAULT_BASEMAP = 'terrain';

/** 底圖的版權標示：匯出圖片時要寫上（畫面上由 MapLibre 的版權控制項顯示） */
export const BASEMAP_ATTRIBUTION = 'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors';

export function getBasemap(id: string | null): Basemap {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

/** 底圖本身的國界線（不含省界、州界）；面量圖開著時改畫我們自己的國界，避免出現兩條線 */
export const BASEMAP_COUNTRY_BORDER = /boundary_2|boundary_disputed|boundary_country/;

const STORAGE_KEY = 'basemap';

export function readStoredBasemap(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BASEMAP;
  } catch {
    return DEFAULT_BASEMAP;
  }
}

export function storeBasemap(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // 無痕模式等情況存不了，只影響這次瀏覽
  }
}
