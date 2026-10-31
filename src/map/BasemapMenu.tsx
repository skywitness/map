import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ImportResult } from '../lib/personalRoutes';
import { defineMessages, tr, useLang, useT } from '../i18n';
import { BASEMAPS, type Basemap } from './basemaps';
import { LayersIcon } from './MapIcons';

// 「更多主題的圖層…」的對話框與可以選的圖層清單（foreignLayers.gen.ts）第一次打開才下載
const LayerPicker = lazy(() => import('./LayerPicker'));

/** 「其他主題的圖層」的一項（topics/shared-layers.ts，App 依目前主題給，名稱已經是目前的語言） */
export interface SharedLayerChoice {
  id: string;
  label: string;
  checked: boolean;
}

/**
 * 我的路線（TopicDefinition.personalRoutes，lib/personalRoutes.ts）：匯入使用者自己下載的路線檔，只存在這個瀏覽器。
 * count 是這個主題已經匯入的路線數；unavailable 是瀏覽器不能存（私密瀏覽、封鎖網站資料）
 */
export interface PersonalMenu {
  count: number;
  unavailable: boolean;
  onImport: (files: File[]) => Promise<ImportResult>;
  onExport: () => void;
  onClear: () => Promise<void>;
}

interface BasemapMenuProps {
  basemap: Basemap;
  onChange: (id: string) => void;
  /** 其他主題的圖層（2026-10-30，第七批 126）：勾選了就疊在這個主題上，第一次打開才下載 */
  shared?: SharedLayerChoice[];
  onSharedToggle?: (id: string) => void;
  /**
   * 「更多主題的圖層…」（2026-10-31，第四輪 一、4，LayerPicker.tsx）：任何主題的點、線圖層。selected 是目前打開的
   * （`<主題>/<圖層 id>`，勾選狀態），topic 是目前的主題（它自己的圖層不列）；勾選也走 onSharedToggle
   */
  more?: { selected: string[]; topic: string };
  personal?: PersonalMenu;
}

const TEXT = defineMessages({
  zh: {
    shared: '其他主題的圖層',
    more: '更多主題的圖層…',
    personal: '我的路線',
    personalHint: '匯入自己下載的路線檔（GPX、KML、KMZ、GeoJSON、zip），只存在這個瀏覽器，不會上傳。',
    personalCount: (n: number) => (n ? `已經匯入 ${n} 條路線` : '還沒有匯入路線'),
    importFiles: '匯入檔案…',
    importFolder: '匯入整個資料夾…',
    exportRoutes: '匯出備份（GeoJSON）',
    clearRoutes: '刪除全部路線',
    confirmClear: '刪除這個主題匯入的所有路線？（只刪這個瀏覽器裡的，原本的檔案不受影響）',
    importing: '匯入中…',
    imported: (r: ImportResult) => `匯入 ${r.files} 個檔、${r.routes} 條路線${r.skipped.length ? `；略過 ${r.skipped.length} 個檔（不是路線檔或沒有線）` : ''}`,
    failed: '匯入失敗：這個瀏覽器不能存資料（私密瀏覽或封鎖了網站資料）',
  },
  en: {
    shared: 'Layers from other topics',
    more: 'More topics’ layers…',
    personal: 'My routes',
    personalHint: 'Import route files you downloaded yourself (GPX, KML, KMZ, GeoJSON, zip). They stay in this browser and are never uploaded.',
    personalCount: (n: number) => (n ? `${n} ${n === 1 ? 'route' : 'routes'} imported` : 'No routes imported yet'),
    importFiles: 'Import files…',
    importFolder: 'Import a whole folder…',
    exportRoutes: 'Export a backup (GeoJSON)',
    clearRoutes: 'Delete all routes',
    confirmClear: 'Delete all routes imported for this topic? (Only from this browser; your original files are not affected.)',
    importing: 'Importing…',
    imported: (r: ImportResult) =>
      `Imported ${r.routes} ${r.routes === 1 ? 'route' : 'routes'} from ${r.files} ${r.files === 1 ? 'file' : 'files'}${r.skipped.length ? `; skipped ${r.skipped.length} (not route files or no lines)` : ''}`,
    failed: 'Import failed: this browser cannot store data (private browsing or site data blocked)',
  },
});

/**
 * 地圖右上角按鈕列裡的「底圖」：點開往左展開五種底圖（原本是控制列上的下拉選單，手機上多占一整行）。
 * 鍵盤操作照 WAI-ARIA 的 menu button：↑↓ 移動、Home/End、Esc 關閉並回到按鈕。
 */
export function BasemapMenu({ basemap, onChange, shared = [], onSharedToggle, more, personal }: BasemapMenuProps) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const hasShared = shared.length > 0 && Boolean(onSharedToggle);
  const hasMore = hasShared && Boolean(more);
  // 「更多主題的圖層…」的對話框：第一次打開才載入，之後留著（關掉再開不必再等）
  const [picker, setPicker] = useState<'closed' | 'open' | 'never'>('never');
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const runImport = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length || !personal) return;
    setStatus(TEXT[lang].importing);
    personal.onImport(files).then(
      (r) => setStatus(TEXT[lang].imported(r)),
      () => setStatus(TEXT[lang].failed),
    );
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[Math.max(0, BASEMAPS.findIndex((b) => b.id === basemap.id))]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // 選單超出地圖下緣時（按鈕列在地圖下半部、加了好幾個別的主題的圖層）往上移，還是太長就限制高度、在選單裡捲動，
  // 不會被地圖的外框切掉（2026-10-31）
  useLayoutEffect(() => {
    const list = listRef.current;
    const frame = list?.closest('.map');
    if (!open || !list || !frame) return;
    list.style.top = '';
    list.style.maxHeight = '';
    const pad = 8;
    const box = frame.getBoundingClientRect();
    const rect = list.getBoundingClientRect();
    const overflow = rect.bottom - (box.bottom - pad);
    if (overflow <= 0) return;
    const shift = Math.max(0, Math.min(overflow, rect.top - (box.top + pad)));
    if (shift) list.style.top = `${parseFloat(getComputedStyle(list).top) - shift}px`;
    if (overflow > shift) list.style.maxHeight = `${box.bottom - pad - (rect.top - shift)}px`;
  }, [open, shared.length, hasMore, Boolean(personal)]);

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
          ref={listRef}
          className={`map-menu-list${hasShared || personal ? ' has-shared' : ''}`}
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
                  className={`map-menu-item shared-layer-item${s.id.includes('/') ? ' is-foreign' : ''}`}
                  // 可以連續勾好幾個，選單不關
                  onClick={() => onSharedToggle!(s.id)}
                >
                  <span className="shared-layer-check" aria-hidden="true">
                    {s.checked ? '✓' : ''}
                  </span>
                  {s.label}
                </button>
              ))}
              {hasMore && (
                <button
                  ref={(el) => {
                    itemRefs.current[BASEMAPS.length + shared.length] = el;
                  }}
                  type="button"
                  role="menuitem"
                  aria-haspopup="dialog"
                  tabIndex={-1}
                  className="map-menu-item shared-layer-item shared-layer-more"
                  onClick={() => {
                    setOpen(false);
                    setPicker('open');
                  }}
                >
                  <span className="shared-layer-check" aria-hidden="true">
                    +
                  </span>
                  {TEXT[lang].more}
                </button>
              )}
            </div>
          )}
          {personal && (
            <div className="map-menu-col personal-routes" role="group" aria-label={TEXT[lang].personal}>
              <div className="basemap-list-title is-shared" aria-hidden="true">
                {TEXT[lang].personal}
              </div>
              <p className="personal-routes-hint">{TEXT[lang].personalHint}</p>
              <p className="personal-routes-count" aria-live="polite">
                {status ?? TEXT[lang].personalCount(personal.count)}
              </p>
              {/* 選單項目的鍵盤移動照舊（itemRefs 接在底圖與其他主題的圖層後面） */}
              {[
                { key: 'files', label: TEXT[lang].importFiles, run: () => fileRef.current?.click(), off: personal.unavailable },
                { key: 'folder', label: TEXT[lang].importFolder, run: () => folderRef.current?.click(), off: personal.unavailable },
                { key: 'export', label: TEXT[lang].exportRoutes, run: personal.onExport, off: !personal.count },
                {
                  key: 'clear',
                  label: TEXT[lang].clearRoutes,
                  run: () => {
                    if (window.confirm(TEXT[lang].confirmClear)) personal.onClear().then(() => setStatus(null), () => {});
                  },
                  off: !personal.count,
                },
              ].map((b, i) => (
                <button
                  key={b.key}
                  ref={(el) => {
                    itemRefs.current[BASEMAPS.length + shared.length + (hasMore ? 1 : 0) + i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={b.off}
                  className="map-menu-item personal-routes-item"
                  onClick={b.run}
                >
                  {b.label}
                </button>
              ))}
              <input ref={fileRef} type="file" multiple hidden accept=".gpx,.kml,.kmz,.geojson,.json,.zip" onChange={(e) => {
                runImport(e.currentTarget.files);
                e.currentTarget.value = '';
              }} />
              {/* webkitdirectory：選一個資料夾，匯入裡面所有的路線檔（含子資料夾） */}
              <input
                ref={(el) => {
                  folderRef.current = el;
                  el?.setAttribute('webkitdirectory', '');
                }}
                type="file"
                hidden
                onChange={(e) => {
                  runImport(e.currentTarget.files);
                  e.currentTarget.value = '';
                }}
              />
            </div>
          )}
        </div>
      )}
      {more && onSharedToggle && picker !== 'never' && (
        <Suspense fallback={null}>
          <LayerPicker
            open={picker === 'open'}
            onClose={() => {
              setPicker('closed');
              buttonRef.current?.focus();
            }}
            selected={more.selected}
            topic={more.topic}
            onToggle={onSharedToggle}
          />
        </Suspense>
      )}
    </div>
  );
}
