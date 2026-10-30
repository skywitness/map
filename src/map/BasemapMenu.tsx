import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { defineMessages, tr, useLang, useT } from '../i18n';
import { BASEMAPS, type Basemap } from './basemaps';
import { LayersIcon } from './MapIcons';

/** 「其他主題的圖層」的一項（topics/shared-layers.ts，App 依目前主題給，名稱已經是目前的語言） */
export interface SharedLayerChoice {
  id: string;
  label: string;
  checked: boolean;
}

interface BasemapMenuProps {
  basemap: Basemap;
  onChange: (id: string) => void;
  /** 其他主題的圖層（2026-10-30，第七批 126）：勾選了就疊在這個主題上，第一次打開才下載 */
  shared?: SharedLayerChoice[];
  onSharedToggle?: (id: string) => void;
}

const TEXT = defineMessages({
  zh: { shared: '其他主題的圖層' },
  en: { shared: 'Layers from other topics' },
});

/**
 * 地圖右上角按鈕列裡的「底圖」：點開往左展開五種底圖（原本是控制列上的下拉選單，手機上多占一整行）。
 * 鍵盤操作照 WAI-ARIA 的 menu button：↑↓ 移動、Home/End、Esc 關閉並回到按鈕。
 */
export function BasemapMenu({ basemap, onChange, shared = [], onSharedToggle }: BasemapMenuProps) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const hasShared = shared.length > 0 && Boolean(onSharedToggle);

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
        <div
          className={`map-menu-list${hasShared ? ' has-shared' : ''}`}
          id={menuId}
          role="menu"
          aria-label={t.basemapStyle}
          onKeyDown={onMenuKeyDown}
        >
          {/* 有「其他主題的圖層」時底圖與圖層並排兩欄（一欄太長，按鈕列在地圖下半部時會超出地圖） */}
          <div className="map-menu-col" role="none">
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
          {hasShared && (
            <div className="map-menu-col" role="group" aria-label={TEXT[lang].shared}>
              <div className="basemap-list-title is-shared" aria-hidden="true">
                {TEXT[lang].shared}
              </div>
              {shared.map((s, i) => (
                <button
                  key={s.id}
                  ref={(el) => {
                    itemRefs.current[BASEMAPS.length + i] = el;
                  }}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={s.checked}
                  tabIndex={-1}
                  className="map-menu-item shared-layer-item"
                  // 可以連續勾好幾個，選單不關
                  onClick={() => onSharedToggle!(s.id)}
                >
                  <span className="shared-layer-check" aria-hidden="true">
                    {s.checked ? '✓' : ''}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
