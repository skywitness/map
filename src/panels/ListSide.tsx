import { useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, tr, useLang, useT } from '../i18n';
import { useJson } from '../lib/data';
import { useMediaQuery } from '../lib/useMediaQuery';
import { decodePoints } from '../map/overlayData';
import type { ListPanelDef, ListRow, PointsData } from '../topics/types';

const TEXT = defineMessages({
  zh: {
    hide: (label: string) => `收起${label}`,
    show: (label: string) => `打開${label}`,
    count: (n: number) => `${n} 項`,
  },
  en: {
    hide: (label) => `Hide ${label.toLowerCase()}`,
    show: (label) => `Show ${label.toLowerCase()}`,
    count: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },
});

/** 版面改成上下排（地圖 → 時間軸 → 側欄）的寬度，styles.css 的 900px；國家側欄改成底部抽屜是另一個門檻（768px） */
const NARROW_QUERY = '(max-width: 900px)';

interface ListSideProps {
  def: ListPanelDef;
  topicId: string;
  item: string | null;
  year: number;
  countryName: (iso3: string) => string;
  /** 桌機的打開或收起（版面偏好） */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (row: ListRow) => void;
}

/**
 * 清單側欄（TopicDefinition.listPanel，2026-10-30 起）：桌機在地圖左邊，收起來時剩一條窄邊與打開的按鈕；
 * 窄螢幕在地圖與時間軸下面，預設收起來（只有一顆按鈕，不擋地圖），點一列後把地圖捲回畫面。
 */
export function ListSide({ def, topicId, item, year, countryName, open, onOpenChange, onPick }: ListSideProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const narrow = useMediaQuery(NARROW_QUERY);
  // 窄螢幕預設收起來，不記在版面偏好（桌機的偏好不受影響）
  const [narrowOpen, setNarrowOpen] = useState(false);
  const shown = narrow ? narrowOpen : open;
  const setShown = (v: boolean) => (narrow ? setNarrowOpen(v) : onOpenChange(v));
  const path = `topics/${topicId}/${def.file.replace('{item}', item ?? '')}`;
  const { data, error } = useJson<PointsData>(shown ? path : null);
  const rows = useMemo(
    () => (data ? def.rows(decodePoints(data), { countryName, year, item }) : null),
    // 依語言重算（rows 在呼叫當下讀語言）
    [data, def, countryName, year, item, lang],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // 打開或換了清單時捲到有標籤的那一列（下一站）
  const firstBadge = rows?.find((r) => r.badge)?.key ?? null;
  useEffect(() => {
    if (!shown || !firstBadge) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(firstBadge)}"]`);
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop - listRef.current.offsetTop - 8;
  }, [shown, firstBadge]);

  const label = tr(def.label, lang);
  if (!shown) {
    return (
      <aside className={`list-side is-closed${narrow ? ' is-narrow' : ''}`} aria-label={label}>
        <button type="button" className="list-side-toggle" aria-expanded={false} onClick={() => setShown(true)} title={text.show(label)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{label}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`list-side${narrow ? ' is-narrow' : ''}`} aria-label={label}>
      <div className="list-side-head">
        <h2>{label}</h2>
        {rows && <span className="list-side-count">{text.count(rows.length)}</span>}
        <button type="button" className="icon-button list-side-close" aria-expanded={true} onClick={() => setShown(false)} title={text.hide(label)} aria-label={text.hide(label)}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d={narrow ? 'M4 10l4-4 4 4' : 'M10 3L5 8l5 5'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {error ? (
        <p className="empty">{t.loadFailed(error.message)}</p>
      ) : !rows ? (
        <p className="empty">{t.loading}</p>
      ) : rows.length === 0 ? (
        <p className="empty">{def.empty ? tr(def.empty, lang) : t.noData}</p>
      ) : (
        <ol className="list-side-rows" ref={listRef}>
          {rows.map((r) => (
            <li key={r.key} data-key={r.key}>
              <button
                type="button"
                className={`list-row${r.muted ? ' is-muted' : ''}${picked === r.key ? ' is-picked' : ''}`}
                aria-current={picked === r.key ? 'true' : undefined}
                onClick={() => {
                  setPicked(r.key);
                  onPick(r);
                  // 窄螢幕：清單在地圖下面，點了把地圖捲回畫面
                  if (narrow) document.querySelector('.stage-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span className="list-row-title">
                  {r.title}
                  {r.badge && <span className="list-row-badge">{r.badge}</span>}
                </span>
                {r.properNoun && (
                  <span className="list-row-line" translate="no">
                    {r.properNoun}
                  </span>
                )}
                {r.lines?.map((line, i) => (
                  <span key={i} className="list-row-line">
                    {line}
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
