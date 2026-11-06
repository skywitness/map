import { useEffect, useMemo, useRef, useState } from 'react';
import { FloatResize } from './FloatResize';
import { defineMessages, tr, useLang, useT } from '../i18n';
import { useJson, useJsonMany } from '../lib/data';
import { nearPoints, weightedPick } from '../lib/near';
import { useAllPoints } from '../lib/points';
import { useMediaQuery } from '../lib/useMediaQuery';
import { decodeLines, decodePoints } from '../map/overlayData';
import { topicFile, type LinesData, type ListPanelDef, type ListRow, type PointRecord, type PointsData, type Text } from '../topics/types';

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
    nearHint: '拖動地圖上的藍點，或按右上角的「定位我」，看那一點附近的',
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
    nearHint: 'Drag the blue dot on the map, or use “Locate me” at top right, to list what is near that spot',
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
  /** 觀察點（附近的清單 ListPanelDef.near 用；城4） */
  center?: [number, number] | null;
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
export function ListSide({ def, topicId, item, year, country, countryName, sort, onSortChange, open, onOpenChange, onPick, onHover, live, tabs, tab = 0, onTabChange, center = null }: ListSideProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const narrow = useMediaQuery(NARROW_QUERY);
  // 窄螢幕預設收起來，不記在版面偏好（桌機的偏好不受影響）
  const [narrowOpen, setNarrowOpen] = useState(false);
  const shown = narrow ? narrowOpen : open;
  const setShown = (v: boolean) => (narrow ? setNarrowOpen(v) : onOpenChange(v));
  // 檔名的 {year} 換成時間軸的年份（2026-11-03，移民路上的死亡與失蹤：一年一個點檔）
  // 檔名是 ../<主題>/… 時讀另一個主題的資料夾（整併進來的清單，topics/merge.ts）
  const path = topicFile({ id: topicId }, (item && def.itemFiles?.[item]) || def.file.replace('{item}', item ?? '').replace('{year}', String(year)));
  const file = useJson<PointsData | LinesData>(shown && !def.fromLive && !def.layered ? path : null);
  const fileError = file.error;
  // 新的檔還沒到時 useJson 給的是上一個檔：同一個清單換年份（{year}）照舊先畫上一份，播放時不閃；換了清單（換主題、換指標）時
  // 不用（2026-11-06：清單開著從航運〔點的清單〕換到航海日誌〔線的清單〕，舊的點檔被當成線檔解析，整個畫面出錯）
  const dataDef = useRef<ListPanelDef | null>(null);
  if (file.data && !file.loading) dataDef.current = def;
  const stale = file.loading && dataDef.current !== def;
  const data = stale ? null : file.data;
  // 分層的點檔（城市）：選了國家時兩個檔都讀（那一國的小城市在其餘的裡）；沒選國家時全世界的前幾名都在 file 裡
  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [def, topicId]);
  // 附近的清單（城4）、有輸入搜尋字時（2026-11-06，城堡只有前 1,100 名在第一個檔）要全部的點
  const layered = useAllPoints(
    shown && !def.fromLive && def.layered ? path : null,
    Boolean(def.near || (country && def.countryField) || query.trim()),
  );
  const error = fileError ?? layered.error;
  // 另外一起讀的點檔（ListPanelDef.extraFiles，景點地圖的附近清單）
  const extraPaths = useMemo(() => (shown && def.extraFiles ? def.extraFiles.map((f) => topicFile({ id: topicId }, f)) : []), [shown, def, topicId]);
  const extras = useJsonMany<PointsData>(extraPaths);
  const all = useMemo(() => {
    if (def.fromLive) return shown ? def.fromLive(live) : null;
    // 檔的格式跟清單的設定對不上（線檔、點檔）時當成還沒讀到
    const shapeOk = data && (def.lines ? Array.isArray((data as LinesData).lines) : Array.isArray((data as PointsData).columns));
    const main = def.layered
      ? layered.points
      : data && shapeOk
        ? def.lines
          ? lineGroups(data as LinesData, def.lines.groupField)
          : decodePoints(data as PointsData)
        : null;
    if (!main || !def.extraFiles) return main;
    if (extras.some((x) => !x)) return null;
    return [...main.map((p) => ({ ...p, _f: 0 })), ...extras.flatMap((x, i) => decodePoints(x!).map((p) => ({ ...p, _f: i + 1 })))];
  }, [data, def, live, shown, layered.points, extras]);
  // 附近的清單（城4）：離觀察點 near.km 以內的，由近到遠
  const nearKm = def.near?.km;
  const points = useMemo(() => (all && nearKm && center ? nearPoints(all, center, nearKm) : all), [all, nearKm, center]);
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
  const visible = useMemo(() => (rows && query ? rows.filter((r) => matches(r, query)) : rows), [rows, query]);
  const [picked, setPicked] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // 「隨機看一個」（城7）：從清單的點（選了國家時是那一國的）加權挑一個，跟點那一列一樣，清單捲到那一列
  const pickRandom = () => {
    const pool = byCountry ?? points;
    const p = pool && def.random ? weightedPick(pool, def.random.weight) : null;
    const row = p ? def.rows([p], { countryName, year, item, country, sort: sortId })[0] : null;
    if (!row) return;
    setQuery('');
    setPicked(row.key);
    onPick(row);
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(row.key)}"]`);
      if (el && listRef.current) listRef.current.scrollTop = el.offsetTop - listRef.current.offsetTop - 8;
    });
    if (narrow) document.querySelector('.stage-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
      {def.near && <p className="list-side-hint">{text.nearHint}</p>}
      {def.random && (
        <button type="button" className="list-side-random" onClick={pickRandom} disabled={!points?.length}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="5.5" cy="5.5" r="1.1" fill="currentColor" />
            <circle cx="10.5" cy="10.5" r="1.1" fill="currentColor" />
            <circle cx="8" cy="8" r="1.1" fill="currentColor" />
          </svg>
          {tr(def.random.label, lang)}
        </button>
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
                {r.bars && <MiniBars {...r.bars} />}
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
      {/* 寬螢幕時浮在地圖上：下緣拖動改高度（窄螢幕不顯示） */}
      <FloatResize which="list" />
    </aside>
  );
}

/** 列裡的小長條圖（ListRow.bars）：每根 7 px 寬、間隔 2 px，高 22 px，從 0 起依最大值縮放 */
function MiniBars({ values, highlight, labels, aria }: NonNullable<ListRow['bars']>) {
  const max = Math.max(...values, 0) || 1;
  const w = 7;
  const gap = 2;
  const h = 22;
  const width = values.length * (w + gap) - gap;
  return (
    <span className="list-row-bars">
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={aria}>
        {values.map((v, i) => {
          const bh = Math.max(1, (v / max) * h);
          return (
            <rect
              key={i}
              x={i * (w + gap)}
              y={h - bh}
              width={w}
              height={bh}
              rx={1.5}
              className={highlight?.includes(i) ? 'is-high' : undefined}
            />
          );
        })}
      </svg>
      {labels && (
        <span className="list-row-bars-labels" style={{ width }} aria-hidden="true">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </span>
      )}
    </span>
  );
}
