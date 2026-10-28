/**
 * 類別圖（LayerSpec 的 kind: 'categorical'）的比例尺：代碼 → 第幾類、顏色。
 * 不依賴 d3：排名表在首頁的 chunk 裡也用到它，import scales.ts 會把 d3-scale 一起帶進首頁。
 */
import type { MapTokens } from '../theme/tokens';

/** 類別圖（kind: 'categorical'，已解析成目前語言）的設定 */
export interface CategoricalLayer {
  /** color：這一類自己的顏色（類別本身就是顏色時，例如國旗的主要顏色），有寫的優先 */
  categories: { value: number; label: string; color?: string; max?: number }[];
  other?: string;
  ordinal?: boolean;
  diverging?: boolean;
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
 * 發散色的類別（例如專制 ↔ 民主）：前一半取發散色階的橘色端、後一半取青綠端，越靠兩端越深；
 * 奇數類的正中間是中性色。每一邊只有 3 階，最多 7 類。
 */
function divergingColors(n: number, ramp: string[]): string[] {
  const side = Math.floor(n / 2);
  const mid = Math.floor(ramp.length / 2);
  if (side > mid) throw new Error(`發散色的類別最多 ${ramp.length} 類`); // i18n-ignore
  // 一邊 1 類用中間那一階，2 類用最深與次深，3 類全用
  const steps = side === 1 ? [1] : side === 2 ? [0, 1] : [0, 1, 2];
  const left = steps.map((s) => ramp[s]);
  const right = steps.map((s) => ramp[ramp.length - 1 - s]).reverse();
  return [...left, ...(n % 2 ? [ramp[mid]] : []), ...right];
}

/**
 * 一般類別依序取 MAP_TOKENS.categorical（不循環，超過就報錯）；ordinal 的類別用循序色，第一類最深，
 * 跟面量圖一樣從色階平均取樣；diverging 用發散色（見 divergingColors）。「其他」用淺的中性色。
 */
export function categoryScale(layer: CategoricalLayer, tokens: MapTokens): CategoryScale {
  const n = layer.categories.length;
  let colors: string[];
  if (layer.diverging) {
    colors = divergingColors(n, tokens.diverging);
  } else if (layer.ordinal) {
    // 有自己顏色的類別（例如法定年齡的「禁止」「沒有規定」）不占色階
    const ramp = tokens.sequential;
    const m = layer.categories.filter((c) => !c.color).length;
    let k = 0;
    colors = layer.categories.map((c) => {
      if (c.color) return c.color;
      const i = k++;
      return ramp[m === 1 ? ramp.length - 1 : Math.round(((m - 1 - i) * (ramp.length - 1)) / (m - 1))];
    });
  } else if (layer.categories.every((c) => c.color)) {
    colors = [];
  } else {
    if (n > tokens.categorical.length) throw new Error(`類別色最多 ${tokens.categorical.length} 類，其餘請併到「其他」`); // i18n-ignore
    colors = tokens.categorical.slice(0, n);
  }
  const items: CategoryItem[] = layer.categories.map((c, i) => ({ label: c.label, color: c.color ?? colors[i] }));
  if (layer.other) items.push({ label: layer.other, color: tokens.categoricalOther, other: true });
  const byValue = new Map(layer.categories.map((c, i) => [c.value, i]));
  // 有 max 的類別涵蓋 value–max 的代碼
  const ranges = layer.categories.flatMap((c, i) => (c.max === undefined ? [] : [{ min: c.value, max: c.max, i }]));
  const index = (value: number) =>
    byValue.get(value) ?? ranges.find((r) => value >= r.min && value <= r.max)?.i ?? (layer.other ? n : null);
  return {
    items,
    index,
    color: (value) => {
      const i = index(value);
      return i === null ? null : items[i].color;
    },
  };
}

/**
 * 面量圖每一級的顏色（門檻 n 個 → n+1 級）。choroplethScale（scales.ts，d3 的 scaleThreshold）與排名表的長條共用；
 * 放在這裡是因為排名表在首頁的 chunk 裡，不能 import scales.ts。
 */
export function choroplethColors(
  spec: { type: 'sequential' | 'diverging'; thresholds: number[]; reverse?: boolean },
  tokens: Pick<MapTokens, 'sequential' | 'diverging'>,
): string[] {
  const classes = spec.thresholds.length + 1;
  if (spec.type === 'diverging') {
    if (classes !== tokens.diverging.length) {
      // 主題設定寫錯時給開發者看的訊息，不會出現在介面上，所以不翻譯
      throw new Error(`發散色需要 ${tokens.diverging.length - 1} 個對稱門檻，目前是 ${spec.thresholds.length} 個`); // i18n-ignore
    }
    return spec.reverse ? [...tokens.diverging].reverse() : tokens.diverging;
  }
  const ramp = tokens.sequential;
  if (classes > ramp.length) throw new Error(`循序色最多 ${ramp.length} 級`); // i18n-ignore
  // 級數少於 7 時，從色階中平均取樣，頭尾保留
  return Array.from({ length: classes }, (_, i) =>
    ramp[classes === 1 ? ramp.length - 1 : Math.round((i * (ramp.length - 1)) / (classes - 1))],
  );
}

/** 數值在第幾級：跟 d3 的 scaleThreshold 一樣（bisectRight，剛好等於門檻的算上面那一級） */
export function classIndex(thresholds: number[], value: number): number {
  let i = 0;
  while (i < thresholds.length && value >= thresholds[i]) i++;
  return i;
}
