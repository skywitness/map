import { useMemo, useSyncExternalStore } from 'react';
import type { Text } from '../i18n/lang';
import { MAP_TOKENS, type MapTokens } from '../theme/tokens';

/**
 * 使用者可以換的地圖配色（圖例上的「配色」按鈕，PaletteMenu.tsx）：分級（循序）與正負變化（發散）各三組。
 * 選擇記在這個瀏覽器（localStorage），面量圖、有強弱的類別圖、圖例、側欄與排名表的色塊、匯出的圖片一起換。
 *
 * 怎麼選的（DESIGN.md 第 5 節）：照預設橘色每一階的 OKLCH 亮度與彩度，只換色相（紫 320°、綠 150°，彩度乘 0.85
 * 才都在 sRGB 裡），亮度單調、相鄰差 ≥ 0.06（dataviz 的驗證工具 --ordinal）。藍色系不提供：淺藍會跟海混在一起。
 * 發散色兩臂取 200、400、600 三階，中間是同一個淺灰。用 OKLab 色差（×100，Machado 2009 色盲模擬）算過：
 * - 跟海（#9ebdff）、無資料的灰色：一般視覺紫、綠都跟預設的橘差不多（7–8）；但紅綠色盲下紫的淺階像淺藍的海（2.3）、
 *   綠的淺階像無資料的灰（2.7），預設的橘是 5–6，所以預設維持橘色。
 * - 發散色兩臂同一階之間：預設的橘 ↔ 青綠在色盲下只有 4.5，紫 ↔ 綠 7.4，橘 ↔ 紫 10.2（色盲最好分辨）。
 * 網格圖層（人口密度、夜間燈光…）的顏色畫在圖磚裡，不跟著換。
 */
export type SequentialId = 'orange' | 'purple' | 'green';
export type DivergingId = 'orange-aqua' | 'purple-green' | 'orange-purple';

const PURPLE = ['#ecd8f0', '#d7b3df', '#c28ece', '#ad66bd', '#8d4d9c', '#6b3977', '#4b2653'];
const GREEN = ['#cfe7d3', '#a1d0aa', '#70b780', '#329f54', '#16803d', '#0b612c', '#05431c'];
const ORANGE = MAP_TOKENS.sequential;
const MID = MAP_TOKENS.diverging[3];

export const SEQUENTIAL: Record<SequentialId, { label: Text; colors: string[] }> = {
  orange: { label: { zh: '橘（預設）', en: 'Orange (default)' }, colors: ORANGE },
  purple: { label: { zh: '紫', en: 'Purple' }, colors: PURPLE },
  green: { label: { zh: '綠', en: 'Green' }, colors: GREEN },
};

export const DIVERGING: Record<DivergingId, { label: Text; colors: string[] }> = {
  'orange-aqua': { label: { zh: '橘 ↔ 青綠（預設）', en: 'Orange ↔ teal (default)' }, colors: MAP_TOKENS.diverging },
  'purple-green': { label: { zh: '紫 ↔ 綠', en: 'Purple ↔ green' }, colors: [PURPLE[5], PURPLE[3], PURPLE[1], MID, GREEN[1], GREEN[3], GREEN[5]] },
  'orange-purple': {
    label: { zh: '橘 ↔ 紫（色弱最好分辨）', en: 'Orange ↔ purple (easiest with colour blindness)' },
    colors: [ORANGE[5], ORANGE[3], ORANGE[1], MID, PURPLE[1], PURPLE[3], PURPLE[5]],
  },
};

export interface PaletteChoice {
  sequential: SequentialId;
  diverging: DivergingId;
}

const STORAGE_KEY = 'map-palette';
const DEFAULT: PaletteChoice = { sequential: 'orange', diverging: 'orange-aqua' };

function read(): PaletteChoice {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PaletteChoice>;
    return {
      sequential: saved.sequential && saved.sequential in SEQUENTIAL ? saved.sequential : DEFAULT.sequential,
      diverging: saved.diverging && saved.diverging in DIVERGING ? saved.diverging : DEFAULT.diverging,
    };
  } catch {
    return DEFAULT;
  }
}

let choice = read();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setPalette(next: Partial<PaletteChoice>): void {
  choice = { ...choice, ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // 無痕模式等情況存不了，只影響這次瀏覽
  }
  for (const listener of listeners) listener();
}

export function usePalette(): PaletteChoice {
  return useSyncExternalStore(subscribe, () => choice);
}

/**
 * 發散色兩臂的顏色名稱：前面是色階起點那一臂（預設的橘），後面是終點那一臂（預設的青綠）。
 * reverse 只是把數值對到另一臂，「橘色」指的還是同一臂的顏色。
 */
const ARM_NAMES: Record<DivergingId, [{ zh: string; en: string }, { zh: string; en: string }]> = {
  'orange-aqua': [
    { zh: '橘', en: 'orange' },
    { zh: '青綠', en: 'teal' },
  ],
  'purple-green': [
    { zh: '紫', en: 'purple' },
    { zh: '綠', en: 'green' },
  ],
  'orange-purple': [
    { zh: '橘', en: 'orange' },
    { zh: '紫', en: 'purple' },
  ],
};

/**
 * 正負變化的指標說明常寫出顏色（「橘色為經濟衰退、綠色為成長」「漲（orange）或跌（teal）」），換了配色就要跟著換。
 * 只用在發散色的指標說明（App.tsx）：國旗主題的「橘色」、地震的紫色點這些不是發散色，不經過這裡。
 * 說明裡的寫法：橘色／越橘、綠色／青綠（色）／越綠；英文 orange、green、teal（大小寫照原樣）。
 */
export function recolourText(text: string, lang: 'zh' | 'en', id: DivergingId): string {
  if (id === 'orange-aqua') return text;
  const [start, end] = ARM_NAMES[id];
  if (lang === 'zh') {
    return text.replace(/青綠(色?)|綠(色?)|橘(色?)/g, (match, a = '', b = '', c = '') =>
      match.startsWith('橘') ? start.zh + c : end.zh + (a || b), // i18n-ignore：比對中文說明用的字，不會顯示
    );
  }
  return text.replace(/\b(orange|green|teal)\b/gi, (match) => {
    const name = match.toLowerCase() === 'orange' ? start.en : end.en;
    return match[0] === match[0].toUpperCase() ? name[0].toUpperCase() + name.slice(1) : name;
  });
}

/** MAP_TOKENS 換上目前選的分級與正負色；有用到分級色、發散色的地方用它取代 MAP_TOKENS */
export function useMapTokens(): MapTokens {
  const { sequential, diverging } = usePalette();
  return useMemo(
    () => ({ ...MAP_TOKENS, sequential: SEQUENTIAL[sequential].colors, diverging: DIVERGING[diverging].colors }),
    [sequential, diverging],
  );
}
