import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { copyText } from '../lib/download';

interface ShareMenuProps {
  /** 只有地圖檢視才有：把目前的地圖畫成 PNG 下載 */
  onDownloadImage?: () => Promise<void>;
  /** 有指標資料才有：目前指標的 CSV（選定年份或所有年份） */
  csv?: { year: number; onDownloadYear: () => void; onDownloadAll: () => void };
  /** 手機分享面板上的標題 */
  shareTitle: string;
}

interface MenuItem {
  label: string;
  run: () => Promise<void> | void;
  disabled?: boolean;
}

/** 狀態訊息顯示多久（毫秒） */
const STATUS_MS = 2200;

/**
 * 「分享」選單：下載地圖圖片、下載 CSV、複製連結（畫面狀態都在網址裡）。
 * 鍵盤操作依 WAI-ARIA 的 menu button 模式：↑↓ 移動、Home/End、Esc 關閉並回到按鈕。
 */
export function ShareMenu({ onDownloadImage, csv, shareTitle }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** 開啟選單後要聚焦的項目（-1 是最後一項） */
  const focusOnOpen = useRef(0);
  const menuId = useId();

  // 手機（觸控為主）而且瀏覽器支援時，改用系統的分享面板
  const nativeShare = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const flash = (text: string, error = false) => setStatus({ text, error });
  useEffect(() => {
    if (!status || busy) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status, busy]);

  const shareLink = async () => {
    const url = window.location.href;
    if (nativeShare) {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // 使用者自己取消
      }
    }
    if (await copyText(url)) flash('已複製連結');
    else flash('無法複製，請直接複製網址列', true);
  };

  const items: MenuItem[] = [
    ...(onDownloadImage
      ? [
          {
            label: '下載地圖圖片（PNG）',
            disabled: busy,
            run: async () => {
              setBusy(true);
              setStatus({ text: '圖片產生中…' });
              try {
                await onDownloadImage();
                flash('已下載圖片');
              } catch {
                flash('圖片產生失敗，請稍後再試', true);
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      : []),
    ...(csv
      ? [
          {
            label: `下載 CSV（${csv.year} 年）`,
            run: () => {
              csv.onDownloadYear();
              flash('已下載 CSV');
            },
          },
          {
            label: '下載 CSV（所有年份）',
            run: () => {
              csv.onDownloadAll();
              flash('已下載 CSV');
            },
          },
        ]
      : []),
    { label: nativeShare ? '分享連結…' : '複製連結', run: shareLink },
  ];
  itemRefs.current.length = items.length;

  useEffect(() => {
    if (!open) return;
    const index = focusOnOpen.current < 0 ? itemRefs.current.length - 1 : focusOnOpen.current;
    itemRefs.current[index]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openMenu = (focus: number) => {
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onButtonKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? 0 : -1);
    }
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
      close(true);
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div className="share" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="share-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-busy={busy}
        onClick={() => (open ? close(false) : openMenu(0))}
        onKeyDown={onButtonKeyDown}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M8 10V2.5M5 5.2 8 2.2l3 3M3.5 8.5v4.2c0 .5.4.8.8.8h7.4c.4 0 .8-.3.8-.8V8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        分享
      </button>
      {open && (
        <div className="share-menu" id={menuId} role="menu" aria-label="分享" onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="share-item"
              disabled={item.disabled}
              onClick={() => {
                close(true);
                void item.run();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <div className={`share-status${status?.error ? ' is-error' : ''}`} role="status" aria-live="polite">
        {status?.text}
      </div>
    </div>
  );
}
