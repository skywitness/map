import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { defineMessages, useLang } from '../i18n';

/**
 * 浮在地圖上的側欄的高度把手（2026-11-01）：寬螢幕時左邊的清單、右邊的國家側欄浮在地圖上（styles.css 的 .stage.is-map），
 * 下緣這條拖動改高度（側欄的 --float-h），記在這台裝置（localStorage `floatHeights`）；按兩下回到預設（依內容，最多約地圖的 65%）。
 * 方向鍵也可以調。窄螢幕、排名表不顯示，--float-h 也沒有作用
 */
export type FloatPanel = 'list' | 'panel';

const KEY = 'floatHeights';
/** 最矮（標題加兩三列） */
const MIN = 120;
/** 方向鍵一次調多少 */
const STEP = 40;

function readHeights(): Partial<Record<FloatPanel, number>> {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return value && typeof value === 'object' ? (value as Partial<Record<FloatPanel, number>>) : {};
  } catch {
    return {};
  }
}

function writeHeight(which: FloatPanel, height: number | null): void {
  try {
    const all = readHeights();
    if (height === null) delete all[which];
    else all[which] = Math.round(height);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 私密瀏覽、封鎖網站資料：這次照樣能調，只是不記
  }
}

const TEXT = defineMessages({
  zh: { label: '調整高度', hint: '上下拖曳調整高度，按兩下回到預設' },
  en: { label: 'Resize', hint: 'Drag up or down to resize; double-click to reset' },
});

export function FloatResize({ which }: { which: FloatPanel }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  /** 把手所在的側欄 */
  const card = () => ref.current?.closest<HTMLElement>('.list-side, .panel') ?? null;
  /** 最高：清單停在左下角的圖例上面 12px，國家側欄停在右下角的出處（ⓘ）上面 8px（跟 styles.css 的 .stage.is-map 一樣） */
  const maxOf = (el: HTMLElement) => {
    const stage = el.offsetParent as HTMLElement | null;
    if (!stage) return window.innerHeight;
    // .stage 的內距 12、地圖的框 1、離地圖下緣 12；國家側欄再讓出右下角的出處（ⓘ，離邊 10、高 24，上面留 8）
    let limit = stage.getBoundingClientRect().bottom - (which === 'panel' ? 55 : 25);
    // 清單：停在左下角的圖例上面，也停在清單底下的地圖下方卡片（時間軸、資料來源；在圖例右邊，圖例窄時伸到清單底下）上面
    if (which === 'list') {
      const right = el.getBoundingClientRect().right;
      for (const sel of ['.map-legend', ':scope > .map-dock']) {
        const box = stage.querySelector(sel)?.getBoundingClientRect();
        if (box && box.height > 0 && box.left < right) limit = Math.min(limit, box.top - 12);
      }
    }
    return Math.max(MIN, limit - el.getBoundingClientRect().top);
  };
  const apply = (el: HTMLElement, height: number) => {
    const h = Math.round(Math.min(Math.max(height, MIN), maxOf(el)));
    el.style.setProperty('--float-h', `${h}px`);
    ref.current?.setAttribute('aria-valuenow', String(h));
    return h;
  };

  // 記下的高度：側欄出現時套上
  useLayoutEffect(() => {
    const el = card();
    const stored = readHeights()[which];
    if (el && stored) el.style.setProperty('--float-h', `${stored}px`);
  }, [which]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = card();
    const handle = ref.current;
    if (e.button !== 0 || !el || !handle) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startHeight = el.getBoundingClientRect().height;
    let last = startHeight;
    const move = (ev: globalThis.PointerEvent) => {
      last = apply(el, startHeight + ev.clientY - startY);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (last !== startHeight) writeHeight(which, last);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const reset = () => {
    const el = card();
    el?.style.removeProperty('--float-h');
    ref.current?.removeAttribute('aria-valuenow');
    writeHeight(which, null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = card();
    if (!el) return;
    const delta = e.key === 'ArrowUp' ? -STEP : e.key === 'ArrowDown' ? STEP : 0;
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation(); // 方向鍵不要順便換年份
    writeHeight(which, apply(el, el.getBoundingClientRect().height + delta));
  };

  return (
    <div
      ref={ref}
      className="float-resize"
      role="separator"
      aria-orientation="horizontal"
      aria-label={TEXT[lang].label}
      aria-valuemin={MIN}
      title={TEXT[lang].hint}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
    />
  );
}
