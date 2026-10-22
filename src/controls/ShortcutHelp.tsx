import { useEffect, useId, useRef, useState } from 'react';
import { useUI } from '../lib/strings';
import { useHotkeys } from './hotkeys';

/** 頂列的「?」按鈕：列出鍵盤快捷鍵。按「?」也能開關；Esc 或點外面關閉。 */
export function ShortcutHelp() {
  const id = useId();
  const UI = useUI();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useHotkeys({ '?': () => setOpen((o) => !o) });

  useEffect(() => {
    if (!open) return;
    popoverRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    // capture：比其他快捷鍵先處理，Esc 只關說明，不會順便取消選取的國家
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (popoverRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="help">
      <button
        ref={buttonRef}
        type="button"
        className="icon-button help-button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={UI.shortcuts.button}
        title={UI.shortcuts.buttonTitle}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div ref={popoverRef} id={id} className="help-popover" role="dialog" aria-label={UI.shortcuts.title} tabIndex={-1}>
          <h2>{UI.shortcuts.title}</h2>
          <dl>
            {UI.shortcuts.items.map((item) => (
              <div key={item.label}>
                <dt>
                  {item.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
          <p className="help-note">{UI.shortcuts.note}</p>
        </div>
      )}
    </div>
  );
}
