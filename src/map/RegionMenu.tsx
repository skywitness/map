import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../i18n';
import { GlobeTurnIcon } from './MapIcons';

type Region = 'AS' | 'EU' | 'AF' | 'NA' | 'SA' | 'OC';

/** 每一洲轉到地球儀中間時的中心（經度、緯度），洲別跟排名表的篩選一樣（regions.json） */
const CENTERS: [Region, [number, number]][] = [
  ['AS', [100, 30]],
  ['EU', [15, 50]],
  ['AF', [20, 2]],
  ['NA', [-100, 40]],
  ['SA', [-60, -18]],
  ['OC', [140, -22]],
];

interface RegionMenuProps {
  onGo: (center: [number, number]) => void;
}

/**
 * 地圖右上角按鈕列裡的「轉到某一洲」：地球儀一次只看得到半個世界，美洲、非洲在背面時不必用拖的。
 * 跟底圖選單一樣往左展開，鍵盤照 WAI-ARIA 的 menu button（↑↓、Home/End、Esc）。
 */
export function RegionMenu({ onGo }: RegionMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    const list = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const current = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (index: number) => {
      e.preventDefault();
      list[(index + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(current + 1);
    else if (e.key === 'ArrowUp') move(current - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // 不要順便關掉側欄或框選
      close(true);
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div className="region-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t.goToRegion}
        title={t.goToRegion}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <GlobeTurnIcon />
      </button>
      {open && (
        <div className="map-menu-list" id={menuId} role="menu" aria-label={t.goToRegion} onKeyDown={onMenuKeyDown}>
          <div className="basemap-list-title" aria-hidden="true">
            {t.goToRegion}
          </div>
          {CENTERS.map(([region, center], i) => (
            <button
              key={region}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="map-menu-item"
              onClick={() => {
                close(true);
                onGo(center);
              }}
            >
              {t.regions[region]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
