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

/** 太陽直射點的顏色（琥珀色，MAP_TOKENS.categorical 的那一色），白色外框 */
export const SUN_COLOR = MAP_TOKENS.categorical[2];
