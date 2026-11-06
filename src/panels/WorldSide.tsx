import { useState, type ReactNode } from 'react';
import { FloatResize } from './FloatResize';
import { defineMessages, tr, useLang } from '../i18n';
import type { Text } from '../topics/types';
import { useMediaQuery } from '../lib/useMediaQuery';

const TEXT = defineMessages({
  zh: {
    hide: (label: string) => `收起${label}`,
    show: (label: string) => `打開${label}`,
  },
  en: {
    hide: (label) => `Hide ${label.toLowerCase()}`,
    show: (label) => `Show ${label.toLowerCase()}`,
  },
});

/** 跟清單側欄（ListSide.tsx）同一個門檻：900px 以下改成上下排 */
const NARROW_QUERY = '(max-width: 900px)';

interface WorldSideProps {
  /** 側欄的標題（主題的 worldPanel.title，已依語言解析） */
  title: string;
  /** 桌機的打開或收起（版面偏好，跟清單側欄共用） */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** 主題也有清單側欄時（2026-11-06，城堡）：跟清單一起排成分頁，這是最後一頁 */
  tabs?: Text[];
  tab?: number;
  onTabChange?: (tab: number) => void;
}

/**
 * 不分國家的資料（TopicDefinition.worldPanel：藥物基因的各遺傳族群頻率、喝酒臉紅的基因、國際能源價格）放在左側欄
 * （2026-11-03 使用者要求；原本是沒選國家時的右側欄，選了國家就被國家側欄換掉）。外框跟清單側欄（ListSide）一樣：
 * 桌機在地圖左邊，收起來剩一條窄邊與打開的按鈕；窄螢幕在地圖與時間軸下面，預設收起來。選了國家時照樣留著，國家在右側欄。
 */
export function WorldSide({ title, open, onOpenChange, children, tabs, tab = 0, onTabChange }: WorldSideProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const narrow = useMediaQuery(NARROW_QUERY);
  // 窄螢幕預設收起來，不記在版面偏好（桌機的偏好不受影響）
  const [narrowOpen, setNarrowOpen] = useState(false);
  const shown = narrow ? narrowOpen : open;
  const setShown = (v: boolean) => (narrow ? setNarrowOpen(v) : onOpenChange(v));
  if (!shown) {
    return (
      <aside className={`list-side is-closed${narrow ? ' is-narrow' : ''}`} aria-label={title}>
        <button type="button" className="list-side-toggle" aria-expanded={false} onClick={() => setShown(true)} title={text.show(title)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{title}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`list-side world-side${narrow ? ' is-narrow' : ''}`} aria-label={title}>
      <div className="list-side-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button list-side-close"
          aria-expanded={true}
          onClick={() => setShown(false)}
          title={text.hide(title)}
          aria-label={text.hide(title)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d={narrow ? 'M4 10l4-4 4 4' : 'M10 3L5 8l5 5'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {tabs && tabs.length > 1 && (
        <div className="list-side-sorts list-side-tabs" role="tablist">
          {tabs.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              className={`list-side-sort${i === tab ? ' is-active' : ''}`}
              aria-selected={i === tab}
              onClick={() => onTabChange?.(i)}
            >
              {tr(label, lang)}
            </button>
          ))}
        </div>
      )}
      <div className="world-side-body">{children}</div>
      {/* 寬螢幕時浮在地圖上：下緣拖動改高度（窄螢幕不顯示） */}
      <FloatResize which="list" />
    </aside>
  );
}
