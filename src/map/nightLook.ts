/**
 * 晝夜圖層（nightLayer.ts）的顏色，跟圖例（Overlays.tsx，在首頁的 bundle 裡）共用；
 * 分開放，WebGL 的圖層程式才不會跟著圖例進到首頁。
 */
import { MAP_TOKENS } from '../theme/tokens';

/**
 * 夜色：淺色底圖用深藍、深色底圖用近黑。四個值是過了每一道邊界（−0.833°、−6°、−12°、−18°）各加多少不透明度，
 * 加總是夜晚的不透明度。淺色底圖 0.45：國家的顏色還認得出來，又看得出是晚上；深色底圖本來就暗，要再多一點
 */
export const NIGHT_LOOK = {
  light: { color: '#0b1a3a', steps: [0.12, 0.1, 0.1, 0.13] },
  dark: { color: '#000000', steps: [0.15, 0.12, 0.12, 0.16] },
} as const;

/** 各段累加後的不透明度：民用、航海、天文曙暮光、夜晚（圖例用） */
export function nightAlphas(dark: boolean): number[] {
  const steps = (dark ? NIGHT_LOOK.dark : NIGHT_LOOK.light).steps;
  return steps.map((_, i) => steps.slice(0, i + 1).reduce((a, b) => a + b, 0));
}

/**
 * 夜半邊的燈光（NightOverlayDef.lights）：暖黃色，最亮的地方不透明度 strength；
 * 太陽在地平線下 fadeFrom° 開始出現、到 fadeTo° 全亮（民用曙暮光的後半）
 */
export const LIGHTS_LOOK = { color: '#ffd27a', strength: 0.95, fadeFrom: -3, fadeTo: -8 } as const;

/** 太陽直射點的顏色（琥珀色，MAP_TOKENS.categorical 的那一色），白色外框 */
export const SUN_COLOR = MAP_TOKENS.categorical[2];

/**
 * 月亮（MoonOverlayDef）：看得到月亮的半個地球蓋一層很淡的月光色（淺色底圖偏藍、深色底圖偏白），
 * 國家的顏色與夜色照樣看得出來；邊界（月出月落的那一圈）是一條比較清楚的細環（ring 是它的不透明度，
 * ringWidth 是寬度，度）。月下點是銀灰色的點，白色外框
 */
export const MOON_LOOK = {
  light: { color: '#3e5f8a', opacity: 0.08, ring: 0.5 },
  dark: { color: '#dfe7f5', opacity: 0.07, ring: 0.45 },
  ringWidth: 0.8,
} as const;
export const MOON_COLOR = '#9aa6b8';
