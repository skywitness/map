import { useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, tr, useLang, useT } from '../i18n';
import { useJson } from '../lib/data';
import { useMediaQuery } from '../lib/useMediaQuery';
import { decodeLines, decodePoints } from '../map/overlayData';
import type { LinesData, ListPanelDef, ListRow, PointRecord, PointsData, Text } from '../topics/types';

const TEXT = defineMessages({
  zh: {
    hide: (label: string) => `收起${label}`,
    show: (label: string) => `打開${label}`,
    count: (n: number) => `${n} 項`,
    search: '搜尋清單',
    noMatch: '沒有符合的項目',
    of: (country: string, label: string) => `${country}的${label}`,
    showAll: '看全部',
    sortBy: '排序',
  },
  en: {
    hide: (label) => `Hide ${label.toLowerCase()}`,
    show: (label) => `Show ${label.toLowerCase()}`,
    count: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
    search: 'Search the list',
    noMatch: 'No matching items',
    of: (country, label) => `${label}: ${country}`,
    showAll: 'Show all',
    sortBy: 'Sort by',
  },
});

/** 版面改成上下排（地圖 → 時間軸 → 側欄）的寬度，styles.css 的 900px；國家側欄改成底部抽屜是另一個門檻（768px） */
const NARROW_QUERY = '(max-width: 900px)';
/** 列數到這麼多才顯示搜尋框（L21） */
const SEARCH_MIN_ROWS = 15;

interface ListSideProps {
  def: ListPanelDef;
  topicId: string;
  item: string | null;
  year: number;
  /** 選取的國家（L23：有 countryField 的清單只列那一國的） */
  country: string | null;
  countryName: (iso3: string) => string;
  /** 選的排序（網址的 lsort=，L22）；null 或不在 def.sorts 裡時用第一個 */
  sort: string | null;
  onSortChange: (id: string | null) => void;
  /** 桌機的打開或收起（版面偏好） */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (row: ListRow) => void;
  /** 滑過一列（有 line 的標出那一組線）；離開清單時是 null */
  onHover?: (row: ListRow | null) => void;
  /** 主題的即時資料（ListPanelDef.fromLive 用；還沒讀到是 null） */
  live?: unknown;
  /** 同一個指標有幾個清單時的分頁（各清單的標題）、目前的分頁與切換（第十二批 201） */
  tabs?: Text[];
  tab?: number;
  onTabChange?: (tab: number) => void;
}

/**
 * 讀線（第十二批 188）：線檔的每一組線（groupField 相同）一筆紀錄，加上那一組的範圍 bw、bs、be、bn。
 * 紀錄是那一組第一條線的（併進了 groups 的共用欄位）；沒有 groupField 時另外加組別 _g（第十二批 200）
 */
function lineGroups(data: LinesData, groupField: string | undefined): PointRecord[] {
  const { lines, records } = decodeLines(data);
  if (!records) return [];
  const out = new Map<unknown, PointRecord>();
  lines.forEach((line, i) => {
    const r = records[i];
    // 沒有 groupField：跟地圖的 partFeatures 一樣，紀錄完全相同的是同一組，組別依第一次出現的順序（寫在 _g）
    const g = groupField ? r[groupField] : JSON.stringify(r);
    let rec = out.get(g);
    if (!rec) out.set(g, (rec = { ...r, _g: out.size, bw: Infinity, bs: Infinity, be: -Infinity, bn: -Infinity }));
    for (const [x, y] of line) {
      rec.bw = Math.min(rec.bw as number, x);
      rec.bs = Math.min(rec.bs as number, y);
      rec.be = Math.max(rec.be as number, x);
      rec.bn = Math.max(rec.bn as number, y);
    }
  });
  return [...out.values()];
}

/** 搜尋（L21）：標題、第二行起與原文名稱，不分大小寫 */
function matches(row: ListRow, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [row.title, row.properNoun ?? '', ...(row.lines ?? [])].some((s) => s.toLocaleLowerCase().includes(q));
}

/**
 * 清單側欄（TopicDefinition.listPanel，2026-10-30 起）：桌機在地圖左邊，收起來時剩一條窄邊與打開的按鈕；
 * 窄螢幕在地圖與時間軸下面，預設收起來（只有一顆按鈕，不擋地圖），點一列後把地圖捲回畫面。
 * 2026-10-31（第十二批 188）：讀線、搜尋框、切換排序、跟選取的國家連動。
 */
export function ListSide({ def, topicId, item, year, country, countryName, sort, onSortChange, open, onOpenChange, onPick, onHover, live, tabs, tab = 0, onTabChange }: ListSideProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const narrow = useMediaQuery(NARROW_QUERY);
  // 窄螢幕預設收起來，不記在版面偏好（桌機的偏好不受影響）
  const [narrowOpen, setNarrowOpen] = useState(false);
  const shown = narrow ? narrowOpen : open;
  const setShown = (v: boolean) => (narrow ? setNarrowOpen(v) : onOpenChange(v));
  const path = `topics/${topicId}/${(item && def.itemFiles?.[item]) || def.file.replace('{item}', item ?? '')}`;
  const { data, error } = useJson<PointsData | LinesData>(shown && !def.fromLive ? path : null);
  const points = useMemo(() => {
    if (def.fromLive) return shown ? def.fromLive(live) : null;
    return data ? (def.lines ? lineGroups(data as LinesData, def.lines.groupField) : decodePoints(data as PointsData)) : null;
  }, [data, def, live, shown]);
  const sortId = def.sorts?.length ? (def.sorts.some((s) => s.id === sort) ? sort : def.sorts[0].id) : null;
  // 跟選取的國家連動：那一國有資料才篩（沒有的照樣列全部）；「看全部」只在這次選的國家有效
  const [allFor, setAllFor] = useState<string | null>(null);
  const field = def.countryField;
  const byCountry = useMemo(() => {
    if (!points || !field || !country || allFor === country) return null;
    const own = points.filter((p) => String(p[field] ?? '').split(',').includes(country));
    return own.length ? own : null;
  }, [points, field, country, allFor]);
  const rows = useMemo(
    () => (points ? def.rows(byCountry ?? points, { countryName, year, item, country, sort: sortId }) : null),
    // 依語言重算（rows 在呼叫當下讀語言）
    [points, byCountry, def, countryName, year, item, country, sortId, lang],
  );
  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [def, topicId]);
  const visible = useMemo(() => (rows && query ? rows.filter((r) => matches(r, query)) : rows), [rows, query]);
  const [picked, setPicked] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // 打開或換了清單時捲到有標籤的那一列（下一站）
  const firstBadge = def.scrollToBadge === false ? null : (rows?.find((r) => r.badge)?.key ?? null);
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
  const title = byCountry && country ? text.of(countryName(country), label) : label;
  return (
    <aside className={`list-side${narrow ? ' is-narrow' : ''}`} aria-label={label}>
      <div className="list-side-head">
        <h2>{title}</h2>
        {visible && <span className="list-side-count">{text.count(visible.length)}</span>}
        {byCountry && country && (
          <button type="button" className="list-side-all" onClick={() => setAllFor(country)}>
            {text.showAll}
          </button>
        )}
        <button type="button" className="icon-button list-side-close" aria-expanded={true} onClick={() => setShown(false)} title={text.hide(label)} aria-label={text.hide(label)}>
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
      {def.sorts && def.sorts.length > 1 && (
        <div className="list-side-sorts" role="group" aria-label={text.sortBy}>
          {def.sorts.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`list-side-sort${s.id === sortId ? ' is-active' : ''}`}
              aria-pressed={s.id === sortId}
              onClick={() => onSortChange(i === 0 ? null : s.id)}
            >
              {tr(s.label, lang)}
            </button>
          ))}
        </div>
      )}
      {rows && rows.length >= SEARCH_MIN_ROWS && (
        <input
          type="search"
          className="list-side-search"
          value={query}
          placeholder={text.search}
          aria-label={text.search}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {error ? (
        <p className="empty">{t.loadFailed(error.message)}</p>
      ) : !visible ? (
        <p className="empty">{t.loading}</p>
      ) : visible.length === 0 ? (
        <p className="empty">{query ? text.noMatch : def.empty ? tr(def.empty, lang) : t.noData}</p>
      ) : (
        <ol className="list-side-rows" ref={listRef} onMouseLeave={() => onHover?.(null)}>
          {visible.map((r, i) => [
            r.group && r.group !== visible[i - 1]?.group ? (
              <li key={`group-${r.group}-${i}`} className="list-side-group">
                {r.group}
              </li>
            ) : null,
            <li key={r.key} data-key={r.key}>
              <button
                type="button"
                className={`list-row${r.muted ? ' is-muted' : ''}${picked === r.key ? ' is-picked' : ''}`}
                aria-current={picked === r.key ? 'true' : undefined}
                onMouseEnter={() => r.line && onHover?.(r)}
                onFocus={() => r.line && onHover?.(r)}
                onClick={() => {
                  setPicked(r.key);
                  onPick(r);
                  // 窄螢幕：清單在地圖下面，點了把地圖捲回畫面
                  if (narrow) document.querySelector('.stage-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <span className="list-row-title">
                  {r.titleProper ? <span translate="no">{r.title}</span> : r.title}
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
              {r.link && (
                <a className="list-row-link" href={r.link.href} target="_blank" rel="noopener noreferrer" translate="no">
                  {r.link.label}
                </a>
              )}
            </li>,
          ])}
        </ol>
      )}
    </aside>
  );
}
