import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** 單獨一次變化（點時間軸、換指標）滾動的時間 */
const TWEEN_MS = 420;
/** 連續變化（播放）時只用間隔的這一部分，下一個值來之前就滾完 */
const TWEEN_SHARE = 0.6;
/** 比這更短就直接換（拖時間軸） */
const TWEEN_MIN_MS = 60;

/**
 * 數值換了（換年份、換指標）時，畫面上的數字從舊的值滾到新的值（2026-10-30）。
 * 第一次出現、使用者要求減少動態效果、變化太密（拖時間軸）時直接換。回傳現在要顯示的數值
 */
export function useTweenedNumber(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const changedRef = useRef(-Infinity);
  useEffect(() => {
    const from = shownRef.current;
    const now = performance.now();
    const duration = Math.min(TWEEN_MS, (now - changedRef.current) * TWEEN_SHARE);
    changedRef.current = now;
    if (from === value || !Number.isFinite(from) || duration < TWEEN_MIN_MS || matchMedia(REDUCED_MOTION).matches) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const k = Math.min(1, Math.max(0, (time - start) / duration));
      const next = k === 1 ? value : from + (value - from) * (1 - (1 - k) ** 3);
      shownRef.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // 滾到一半又換：從畫面上現在的數字接著滾（shownRef 已經記下）
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/** 會滾動的數字；format 把中間的值也寫成跟最後一樣的格式（單位、位數） */
export function TweenNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const shown = useTweenedNumber(value);
  return <>{format(shown)}</>;
}
