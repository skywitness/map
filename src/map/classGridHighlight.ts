import { useSyncExternalStore } from 'react';

/**
 * 類別網格「只亮一類」（ClassGridLook.only）：滑到圖例的色塊或側欄的類型時設定，地圖（WorldMap）照著畫，
 * 其他類變淡（2026-10-30 起，氣候分區）。圖例與側欄不在同一棵元件裡，用一個模組層級的值，不經過 App 的狀態與網址
 */
let only: number | null = null;
const listeners = new Set<() => void>();

export function setClassGridOnly(value: number | null) {
  if (value === only) return;
  only = value;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useClassGridOnly(): number | null {
  return useSyncExternalStore(subscribe, () => only, () => null);
}
