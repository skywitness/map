import { useId, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { LayoutPrefs } from '../lib/layoutPrefs';
import { useDismiss } from './useDismiss';

/**
 * 頂列的「版面」按鈕（2026-10-30）：時間軸、資料來源與說明分別打勾顯示或關掉，關掉的高度讓給地圖。
 * 有關掉的時候按鈕是藍色的，提醒還有東西收起來
 */
export function LayoutMenu({ prefs, onChange }: { prefs: LayoutPrefs; onChange: (patch: Partial<LayoutPrefs>) => void }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [buttonRef, popoverRef], buttonRef);
  const changed = !prefs.time || !prefs.sources;
  return (
    <div className="layout-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`icon-button layout-button${changed ? ' is-set' : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t.layout}
        title={t.layout}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <rect x="2" y="2.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 10.5h12" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <div ref={popoverRef} id={id} className="layout-popover" role="dialog" aria-label={t.layoutTitle}>
          <h2>{t.layoutTitle}</h2>
          <label className="layout-check">
            <input type="checkbox" checked={prefs.time} onChange={(e) => onChange({ time: e.target.checked })} />
            {t.layoutTime}
          </label>
          <label className="layout-check">
            <input type="checkbox" checked={prefs.sources} onChange={(e) => onChange({ sources: e.target.checked })} />
            {t.layoutSources}
          </label>
          <p className="layout-note">{t.layoutNote}</p>
        </div>
      )}
    </div>
  );
}
