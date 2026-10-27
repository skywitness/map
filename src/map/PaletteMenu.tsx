import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { tr, useLang, useT } from '../i18n';
import { DIVERGING, SEQUENTIAL, setPalette, usePalette, type DivergingId, type SequentialId } from './palettes';

interface PaletteMenuProps {
  /** 目前的圖例是分級（循序）還是正負變化（發散）：只列那一種的選項 */
  kind: 'sequential' | 'diverging';
}

/**
 * 面量圖圖例標題旁的「配色」按鈕：點開列出三組配色（色帶加名稱），選了整張地圖換色（palettes.ts）。
 * 鍵盤照 WAI-ARIA 的 menu button：↑↓ 移動、Esc 關閉並回到按鈕。
 */
export function PaletteMenu({ kind }: PaletteMenuProps) {
  const t = useT();
  const lang = useLang();
  const choice = usePalette();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const options = Object.entries(kind === 'sequential' ? SEQUENTIAL : DIVERGING);
  const current = choice[kind];

  useEffect(() => {
    if (!open) return;
    itemRefs.current[Math.max(0, options.findIndex(([id]) => id === current))]?.focus();
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
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowUp') move(index - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // 不要順便關掉側欄
      close(true);
    } else if (e.key === 'Tab') close(false);
  };

  const choose = (id: string) => {
    close(true);
    setPalette(kind === 'sequential' ? { sequential: id as SequentialId } : { diverging: id as DivergingId });
  };

  return (
    <div className="palette-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="palette-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={t.paletteTitle}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {t.palette}
      </button>
      {open && (
        <div className="palette-list" id={menuId} role="menu" aria-label={t.paletteTitle} onKeyDown={onMenuKeyDown}>
          {options.map(([id, p], i) => (
            <button
              key={id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={id === current}
              tabIndex={-1}
              className="palette-item"
              onClick={() => choose(id)}
            >
              <span className="palette-ramp" aria-hidden="true">
                {p.colors.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              {tr(p.label, lang)}
            </button>
          ))}
          <p className="palette-note">{t.paletteNote}</p>
        </div>
      )}
    </div>
  );
}
