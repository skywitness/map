/** 可切換的底圖（OpenFreeMap 的樣式，免費、不需金鑰；資料 © OpenMapTiles、© OpenStreetMap contributors） */
export interface Basemap {
  id: string;
  label: string;
  url: string;
  /** 深色底圖上，鐵路、選取外框等要改用淺色 */
  dark: boolean;
}

export const BASEMAPS: Basemap[] = [
  { id: 'terrain', label: '彩色地形', url: 'https://tiles.openfreemap.org/styles/liberty', dark: false },
  { id: 'bright', label: '亮色街道', url: 'https://tiles.openfreemap.org/styles/bright', dark: false },
  { id: 'positron', label: '淺灰', url: 'https://tiles.openfreemap.org/styles/positron', dark: false },
  { id: 'dark', label: '深色', url: 'https://tiles.openfreemap.org/styles/dark', dark: true },
  { id: 'fiord', label: '深藍', url: 'https://tiles.openfreemap.org/styles/fiord', dark: true },
];

export const DEFAULT_BASEMAP = 'terrain';

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
