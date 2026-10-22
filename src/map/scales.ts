import { scaleSqrt, scaleThreshold, type ScaleThreshold } from 'd3-scale';
import type { ScaleSpec } from '../topics/types';
import type { Tokens } from '../theme/tokens';

/** 分級色：門檻固定，所有年份共用 */
export function choroplethScale(spec: ScaleSpec, tokens: Tokens): ScaleThreshold<number, string> {
  const classes = spec.thresholds.length + 1;
  let range: string[];
  if (spec.type === 'diverging') {
    if (classes !== tokens.diverging.length) {
      // 主題設定寫錯時給開發者看的訊息，不會出現在介面上，所以不翻譯
      throw new Error(`發散色需要 ${tokens.diverging.length - 1} 個對稱門檻，目前是 ${spec.thresholds.length} 個`); // i18n-ignore
    }
    range = tokens.diverging;
  } else {
    const ramp = tokens.sequential;
    if (classes > ramp.length) throw new Error(`循序色最多 ${ramp.length} 級`); // i18n-ignore
    // 級數少於 7 時，從色階中平均取樣，頭尾保留
    range = Array.from({ length: classes }, (_, i) =>
      ramp[classes === 1 ? ramp.length - 1 : Math.round((i * (ramp.length - 1)) / (classes - 1))],
    );
  }
  return scaleThreshold<number, string>().domain(spec.thresholds).range(range);
}

/** 比例圓的最大半徑隨地圖寬度調整 */
export function bubbleMaxRadius(mapWidth: number): number {
  return Math.max(14, Math.min(48, mapWidth * 0.032));
}

/** 圓面積與數值成正比（半徑取平方根）；domain 用所有年份的最大值，時間軸拖動時大小可以互相比較 */
export function bubbleScale(max: number, mapWidth: number) {
  return scaleSqrt().domain([0, max]).range([0, bubbleMaxRadius(mapWidth)]);
}
