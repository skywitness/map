import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (rawWidth: number, rawHeight: number) => {
      const width = Math.round(rawWidth);
      const height = Math.round(rawHeight);
      if (width === 0 || height === 0) return;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    // 先同步量一次：ResizeObserver 要等下一次繪製才回報，背景分頁裡可能一直等不到
    update(el.clientWidth, el.clientHeight);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
