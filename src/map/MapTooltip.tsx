/** 地圖的 tooltip（WorldMap.tsx，2026-10-29 拆出來） */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';
import type { MapMark, PointerInfo } from '../topics/types';

/** 主題的 pointer 給的幾行：海上（standalone）時 title 是第一行，在國家上時接在國家的 tooltip 下面 */
export function PointerLines({ info, standalone }: { info: PointerInfo; standalone: boolean }) {
  return (
    <>
      {standalone && info.title && <div className="tt-value">{info.title}</div>}
      {info.lines.map((line, i) => (
        <div key={i} className={`tt-label${standalone && i === 0 ? '' : ' tt-hint'}${!standalone && i > 0 ? ' is-next' : ''}`}>
          {line}
        </div>
      ))}
    </>
  );
}

/** 側欄的標記：名稱，有連到另一個標記時寫「按一下移到…」 */
export function MarkTooltip({ marks, index }: { marks: MapMark[]; index: number }) {
  const t = useT();
  const mark = marks[index];
  const target = mark.link !== undefined ? marks[mark.link] : undefined;
  return (
    <>
      <div className="tt-value">{mark.label}</div>
      {target && <div className="tt-label">{t.markLink(target.label)}</div>}
    </>
  );
}

export interface MapTooltipProps {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
}

export function MapTooltip({ x, y, width, height, children }: MapTooltipProps) {
  // 往右下開，放不下時往左、往上；依實際的大小判斷（2026-11-06 起有照片的 tooltip 高約 260 px），量到之前用預估的
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<[number, number]>([260, 140]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next: [number, number] = [el.offsetWidth, el.offsetHeight];
    if (next[0] !== size[0] || next[1] !== size[1]) setSize(next);
  });
  const flipX = x > width - Math.max(size[0], 120) - 20;
  const flipY = y > height - Math.max(size[1], 60) - 20 && y > size[1] + 20;
  return (
    <div
      ref={ref}
      className="map-tooltip"
      role="status"
      style={{
        left: x + (flipX ? -14 : 14),
        top: y + (flipY ? -14 : 14),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
      {children}
    </div>
  );
}
