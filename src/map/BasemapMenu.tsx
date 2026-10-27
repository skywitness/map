import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { tr, useLang, useT } from '../i18n';
import { BASEMAPS, type Basemap } from './basemaps';
import { LayersIcon } from './MapIcons';

interface BasemapMenuProps {
  basemap: Basemap;
  onChange: (id: string) => void;
}

/**
 * 地圖右上角按鈕列裡的「底圖」：點開往左展開五種底圖（原本是控制列上的下拉選單，手機上多占一整行）。
 * 鍵盤操作照 WAI-ARIA 的 menu button：↑↓ 移動、Home/End、Esc 關閉並回到按鈕。
 */
export function BasemapMenu({ basemap, onChange }: BasemapMenuProps) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[Math.max(0, BASEMAPS.findIndex((b) => b.id === basemap.id))]?.focus();
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
    <div className="basemap-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t.basemapCurrent(tr(basemap.label, lang))}
        title={t.basemapStyle}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <LayersIcon />
      </button>
      {open && (
        <div className="map-menu-list" id={menuId} role="menu" aria-label={t.basemapStyle} onKeyDown={onMenuKeyDown}>
          <div className="basemap-list-title" aria-hidden="true">
            {t.basemapStyle}
          </div>
          {BASEMAPS.map((b, i) => (
            <button
              key={b.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={b.id === basemap.id}
              tabIndex={-1}
              className="map-menu-item basemap-item"
              onClick={() => {
                close(true);
                if (b.id !== basemap.id) onChange(b.id);
              }}
            >
              <span className={`basemap-swatch is-${b.id}`} aria-hidden="true" />
              {tr(b.label, lang)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
