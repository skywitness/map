import { useEffect, useRef } from 'react';

/** 正在打字（文字框、下拉選單、拉桿、可編輯區域）時不觸發快捷鍵；拉桿本身就用方向鍵調整 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  if (target.tagName === 'INPUT') {
    return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes((target as HTMLInputElement).type);
  }
  return false;
}

const MAP_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']);

/** 焦點元素本身會處理這個鍵：按鈕上的空白鍵是「按下」；用鍵盤移到地圖上時，方向鍵與 +/− 交給地圖平移縮放 */
function handledByFocus(e: KeyboardEvent): boolean {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return false;
  if (e.key === ' ' && target.closest('button, a[href], summary, [role="button"], [role="option"], input')) return true;
  return MAP_KEYS.has(e.key) && target.closest('.maplibregl-canvas-container') !== null;
}

type Handler = (e: KeyboardEvent) => void;

/**
 * 全域快捷鍵，鍵名用 KeyboardEvent.key（'ArrowLeft'、' '、'/'、'+'）。
 * 打字中、按著 Ctrl/Alt/⌘、輸入法組字中，或已經被其他元件處理（defaultPrevented）時不觸發。
 * 觸發後會 preventDefault：空白鍵不捲動頁面、「/」不會打進搜尋框。
 * 搜尋框、說明視窗、框選模式自己處理 Esc 並 preventDefault，這裡的 Esc 就不會再取消選取。
 */
export function useHotkeys(bindings: Record<string, Handler>, enabled = true): void {
  const ref = useRef(bindings);
  ref.current = bindings;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const handler = ref.current[e.key];
      if (!handler || isTypingTarget(e.target) || handledByFocus(e)) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
