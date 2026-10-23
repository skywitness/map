/**
 * 類別圖（LayerSpec 的 kind: 'categorical'）的比例尺：代碼 → 第幾類、顏色。
 * 不依賴 d3：排名表在首頁的 chunk 裡也用到它，import scales.ts 會把 d3-scale 一起帶進首頁。
 */
import type { MapTokens } from '../theme/tokens';

/** 類別圖（kind: 'categorical'，已解析成目前語言）的設定 */
export interface CategoricalLayer {
  categories: { value: number; label: string }[];
  other?: string;
  ordinal?: boolean;
}

/** 類別圖的一類：圖例的一列 */
export interface CategoryItem {
  label: string;
  color: string;
  /** 「其他」：不在設定裡的代碼都歸到這一類 */
  other?: boolean;
}

/** 類別圖的比例尺：代碼 → 圖例的第幾類（null 表示無資料） */
export interface CategoryScale {
  items: CategoryItem[];
  index: (value: number) => number | null;
  color: (value: number) => string | null;
}

/**
 * 一般類別依序取 MAP_TOKENS.categorical（不循環，超過就報錯）；ordinal 的類別用循序色，第一類最深，
 * 跟面量圖一樣從色階平均取樣。「其他」用淺的中性色。
 */
export function categoryScale(layer: CategoricalLayer, tokens: MapTokens): CategoryScale {
  const n = layer.categories.length;
  let colors: string[];
  if (layer.ordinal) {
    const ramp = tokens.sequential;
    colors = layer.categories.map((_, i) => ramp[n === 1 ? ramp.length - 1 : Math.round(((n - 1 - i) * (ramp.length - 1)) / (n - 1))]);
  } else {
    if (n > tokens.categorical.length) throw new Error(`類別色最多 ${tokens.categorical.length} 類，其餘請併到「其他」`); // i18n-ignore
    colors = tokens.categorical.slice(0, n);
  }
  const items: CategoryItem[] = layer.categories.map((c, i) => ({ label: c.label, color: colors[i] }));
  if (layer.other) items.push({ label: layer.other, color: tokens.categoricalOther, other: true });
  const byValue = new Map(layer.categories.map((c, i) => [c.value, i]));
  const index = (value: number) => byValue.get(value) ?? (layer.other ? n : null);
  return {
    items,
    index,
    color: (value) => {
      const i = index(value);
      return i === null ? null : items[i].color;
    },
  };
}
