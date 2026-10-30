import { useId, useRef, useState, type FormEvent } from 'react';
import { langParam } from '../i18n/lang';
import { useT } from '../i18n';
import { addSavedView, openSavedView, removeSavedView, useSavedViews, viewHref } from '../lib/savedViews';
import { currentHref } from '../lib/url-state';
import { UI_ICONS } from '../topics/groupIcons.gen';
import { Glyph } from './TopicIcon';
import { useDismiss } from './useDismiss';

/** 分頁標題後面的網站名稱：收藏的預設名稱拿掉它 */
const SITE_SUFFIX = / · (世界資料地圖|World Data Map)$/;

/**
 * 控制列右邊的「收藏的畫面」（2026-10-30）：把目前的畫面取個名字存起來，列出收藏的畫面，點一下回去。
 * 只存在這台裝置的瀏覽器裡（lib/savedViews.ts）
 */
export function SavedViews() {
  const t = useT();
  const id = useId();
  const views = useSavedViews();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [buttonRef, popoverRef], buttonRef);
  // 目前的畫面已經收藏過：按鈕畫成實心
  const here = open ? viewHref(currentHref()) : null;
  const saved = views.some((v) => v.href === (here ?? viewHref(window.location.href)));

  const toggle = () => {
    if (!open) setName(document.title.replace(SITE_SUFFIX, ''));
    setOpen((o) => !o);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) addSavedView(trimmed, currentHref());
  };

  return (
    <div className="saved-views">
      <button
        ref={buttonRef}
        type="button"
        className={`icon-button saved-button${saved ? ' is-saved' : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={t.savedViews}
        title={t.savedViews}
        onClick={toggle}
      >
        <Glyph d={UI_ICONS.saved} size={17} />
      </button>
      {open && (
        <div ref={popoverRef} id={id} className="saved-popover" role="dialog" aria-label={t.savedViews}>
          <form className="saved-form" onSubmit={submit}>
            <label htmlFor={`${id}-name`}>{t.saveView}</label>
            <div className="saved-form-row">
              <input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              <button type="submit" className="saved-submit" disabled={!name.trim()}>
                {t.saveViewSubmit}
              </button>
            </div>
          </form>
          {views.length ? (
            <ul className="saved-list">
              {views.map((view) => (
                <li key={view.id} className={view.href === here ? 'is-current' : undefined}>
                  <a
                    href={view.href}
                    onClick={(e) => {
                      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      setOpen(false);
                      openSavedView(view, langParam());
                    }}
                  >
                    {view.name}
                  </a>
                  <button type="button" className="saved-remove" aria-label={t.removeSavedView(view.name)} onClick={() => removeSavedView(view.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="saved-empty">{t.savedViewsEmpty}</p>
          )}
          <p className="saved-note">{t.savedViewsNote}</p>
        </div>
      )}
    </div>
  );
}
