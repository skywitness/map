import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../i18n';
import { MoreIcon } from './MapIcons';

export interface MoreMenuItem {
  id: string;
  label: string;
  /** 開關類（3D、框選）傳目前的狀態，項目是 menuitemcheckbox；動作類（全螢幕）不傳 */
  checked?: boolean;
  disabled?: boolean;
  /** 不能用時的原因（3D 時不能框選），寫在項目下面 */
  note?: string;
  onSelect: () => void;
}

/**
 * 手機上地圖右上角的「更多」：3D、全螢幕、框選收進這裡，按鈕列從 7–8 顆減到 4 顆
 * （原本占了地圖將近一半的高度）。外觀與鍵盤操作跟底圖選單（BasemapMenu.tsx）一樣。
 */
export function MoreMenu({ items }: { items: MoreMenuItem[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const anyOn = items.some((i) => i.checked);

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
    <div className="more-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={anyOn ? 'has-active' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t.moreMapTools}
        title={t.moreMapTools}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="map-menu-list" id={menuId} role="menu" aria-label={t.moreMapTools} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked}
              aria-disabled={item.disabled}
              tabIndex={-1}
              className="map-menu-item more-item"
              onClick={() => {
                if (item.disabled) return;
                close(true);
                item.onSelect();
              }}
            >
              <span className="more-check" aria-hidden="true">
                {item.checked ? '✓' : ''}
              </span>
              <span>
                {item.label}
                {item.disabled && item.note && <span className="more-note">{item.note}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
