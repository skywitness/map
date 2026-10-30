import { useEffect, type RefObject } from 'react';

/**
 * 彈出的小視窗（播放設定、收藏的畫面）：點外面或按 Esc 關閉；Esc 時焦點回到打開它的按鈕。
 * capture：比其他快捷鍵先處理，Esc 只關這個視窗，不會順便取消選取的國家
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  inside: RefObject<HTMLElement | null>[],
  returnFocus?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!inside.some((ref) => ref.current?.contains(target))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      returnFocus?.current?.focus();
      close();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, close, inside, returnFocus]);
}
