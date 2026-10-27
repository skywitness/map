import { scaleSqrt, scaleThreshold, type ScaleThreshold } from 'd3-scale';
import type { ScaleSpec } from '../topics/types';
import type { Tokens } from '../theme/tokens';
import type { GridMeta } from './densityGrid';
import { choroplethColors } from './categories';

/** 分級色：門檻固定，所有年份共用 */
export function choroplethScale(spec: ScaleSpec, tokens: Tokens): ScaleThreshold<number, string> {
  return scaleThreshold<number, string>().domain(spec.thresholds).range(choroplethColors(spec, tokens));
}

/** 1 km 網格圖例的分級色：門檻與顏色用 meta.json 的，跟圖磚裡畫的一定一樣 */
export function gridScale(meta: GridMeta): ScaleThreshold<number, string> {
  return scaleThreshold<number, string>().domain(meta.thresholds).range(meta.colors);
}

/** 比例圓的最大半徑隨地圖寬度調整 */
export function bubbleMaxRadius(mapWidth: number): number {
  return Math.max(14, Math.min(48, mapWidth * 0.032));
}

/**
 * 地圖上的比例圓至少這麼大：台灣 1 位諾貝爾獎得主跟美國幾百位放在一起時，照比例只有不到 1 px，看不到也點不到。
 * 只放大最小的那幾個（手機上約最大值的 5% 以下），圖例照原本的比例畫
 */
export const BUBBLE_MIN_RADIUS = 3;

/** 圓面積與數值成正比（半徑取平方根）；domain 用所有年份的最大值，時間軸拖動時大小可以互相比較 */
export function bubbleScale(max: number, mapWidth: number) {
  return scaleSqrt().domain([0, max]).range([0, bubbleMaxRadius(mapWidth)]);
}
