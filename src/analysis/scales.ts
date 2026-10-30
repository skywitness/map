/**
 * 分析檢視的上色（2026-10-30）：指標自己的色階（並排、拉簾）、變化的發散色（變化）
 */
import type { MapTokens } from '../theme/tokens';
import type { Indicator } from '../topics/types';
import { categoryScale } from '../map/categories';
import { choroplethScale } from '../map/scales';

/** 指標的顏色：面量圖、類別圖照主地圖；比例圓的指標回傳 null（畫圓） */
export function indicatorColor(indicator: Indicator, tokens: MapTokens): ((v: number) => string | null) | null {
  const layer = indicator.layer;
  if (layer.kind === 'choropleth') {
    const scale = choroplethScale(layer.scale, tokens);
    return (v) => scale(v);
  }
  if (layer.kind === 'categorical') {
    const scale = categoryScale(layer, tokens);
    return (v) => scale.color(v);
  }
  return null;
}

/** 比例圓的半徑（viewBox 的單位）：面積跟數值成正比，max 是最大的圓 */
export const bubbleRadius = (v: number, max: number, largest = 26) => (max > 0 && v > 0 ? largest * Math.sqrt(v / max) : 0);

/** 1、2、2.5、5 × 10ⁿ 裡最接近的「好看的」數 */
function nice(x: number): number {
  if (!(x > 0)) return 0;
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * p;
}

/**
 * 變化的分級門檻（對稱）：|變化| 的 30%、65%、90% 分位數，各取成好看的數，回傳 [−c, −b, −a, a, b, c]。
 * 中間那一級（−a 到 a）是「變化不大」；變化都一樣時退回 [−3, −2, −1, 1, 2, 3] 倍
 */
export function changeThresholds(changes: number[]): number[] {
  const sizes = changes.map(Math.abs).filter(Number.isFinite).sort((x, y) => x - y);
  const q = (k: number) => sizes[Math.min(sizes.length - 1, Math.floor(k * sizes.length))] ?? 0;
  let a = nice(q(0.3));
  let b = nice(q(0.65));
  let c = nice(q(0.9));
  if (!(a > 0)) a = nice(c / 4) || 1;
  // 相鄰的門檻至少差一倍：圖例的刻度才不會擠在一起（20%、25% 這種），每一級也比較有區別
  if (b < a * 2) b = nice(a * 2.2);
  if (c < b * 2) c = nice(b * 2.2);
  return [-c, -b, -a, a, b, c];
}

/** 數值在第幾級（跟 d3 的 scaleThreshold 一樣） */
export function classOf(thresholds: number[], v: number): number {
  let i = 0;
  while (i < thresholds.length && v >= thresholds[i]) i++;
  return i;
}
