import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useUI } from '../lib/strings';
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery';

type SheetState = 'peek' | 'half' | 'full';
const STATES: SheetState[] = ['peek', 'half', 'full'];
/** 放開時的速度超過這個值（px/ms）就順著方向切到下一段，不必拖過一半 */
const FLICK_SPEED = 0.4;
/** 從收合再往下拖超過這個距離（px）就關閉 */
const DISMISS_PX = 56;

interface PanelSheetProps {
  children: ReactNode;
  onClose: () => void;
}

/** 寬螢幕：側欄照原樣放在地圖右邊。窄螢幕：包成底部抽屜。 */
export function PanelSheet({ children, onClose }: PanelSheetProps) {
  const narrow = useMediaQuery(NARROW_QUERY);
  return narrow ? <BottomSheet onClose={onClose}>{children}</BottomSheet> : <>{children}</>;
}

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  /** 往上為正，px/ms */
  velocity: number;
  moved: boolean;
}

/**
 * 底部抽屜：收合（只看國名與前兩個數值）、半開、全開三段。
 * 拖曳把手或國名列切換高度，放開時吸附到最近的一段；從收合往下拖就關閉。
 * 抽屜以外的地方不擋，地圖照常能拖、能點。
 * 高度的 CSS（--sheet-peek、安全區域）在 styles.css；這裡讀算好的 min-height / max-height 當收合與全開的高度。
 */
function BottomSheet({ children, onClose }: PanelSheetProps) {
  const UI = useUI();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const draggedRef = useRef(false);
  const [state, setState] = useState<SheetState>('peek');
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [heights, setHeights] = useState<Record<SheetState, number> | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = sheetRef.current;
      if (!el) return;
      const css = getComputedStyle(el);
      const viewport = window.innerHeight;
      const peek = parseFloat(css.minHeight) || 180;
      const full = parseFloat(css.maxHeight) || viewport - 56;
      setHeights({ peek, half: Math.min(full, Math.max(peek, Math.round(viewport * 0.5))), full });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 收合時內容不能捲動，捲回頂端，展開時才從國名開始看
  useEffect(() => {
    if (state === 'peek') sheetRef.current?.querySelector('.panel')?.scrollTo({ top: 0 });
  }, [state]);

  const currentHeight = () => sheetRef.current?.getBoundingClientRect().height ?? 0;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || !target.closest('.sheet-handle, .panel-header')) return;
    if (target.closest('button') && !target.closest('.sheet-handle')) return; // 關閉鈕照常點
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: currentHeight(),
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      moved: false,
    };
    draggedRef.current = false;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId || !heights) return;
    const dy = drag.startY - e.clientY;
    if (!drag.moved) {
      if (Math.abs(dy) < 4) return;
      drag.moved = true;
      sheetRef.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - drag.lastTime;
    if (dt > 0) drag.velocity = (drag.lastY - e.clientY) / dt;
    drag.lastY = e.clientY;
    drag.lastTime = e.timeStamp;
    setDragHeight(Math.min(heights.full, Math.max(heights.peek - DISMISS_PX * 1.5, drag.startHeight + dy)));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!drag.moved || !heights) return;
    draggedRef.current = true; // 拖過把手後的 click 不算點一下
    setDragHeight(null);
    const height = drag.startHeight + (drag.startY - e.clientY);
    const v = e.type === 'pointercancel' ? 0 : drag.velocity;
    if (height < heights.peek - DISMISS_PX && v <= 0) {
      onClose();
      return;
    }
    const order = STATES.map((s) => [s, heights[s]] as const);
    let next: SheetState;
    if (v > FLICK_SPEED) next = (order.find(([, h]) => h > height + 8) ?? order[order.length - 1])[0];
    else if (v < -FLICK_SPEED) next = ([...order].reverse().find(([, h]) => h < height - 8) ?? order[0])[0];
    else next = order.reduce((a, b) => (Math.abs(b[1] - height) < Math.abs(a[1] - height) ? b : a))[0];
    setState(next);
  };

  const step = (delta: number) => {
    const i = STATES.indexOf(state) + delta;
    setState(STATES[(i + STATES.length) % STATES.length]);
  };

  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const i = STATES.indexOf(state) + (e.key === 'ArrowUp' ? 1 : -1);
      if (i >= 0 && i < STATES.length) setState(STATES[i]);
    }
  };

  const height = dragHeight ?? heights?.[state];
  return (
    <div
      ref={sheetRef}
      className={`sheet is-${state}${dragHeight !== null ? ' is-dragging' : ''}`}
      style={height !== undefined ? { height } : undefined}
      data-occludes-map=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-label={UI.sheet.handle(state)}
        onClick={() => {
          if (draggedRef.current) draggedRef.current = false;
          else step(1);
        }}
        onKeyDown={onHandleKey}
      >
        <span className="sheet-grabber" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}
