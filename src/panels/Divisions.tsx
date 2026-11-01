import { useMemo, useState } from 'react';
import { defineMessages, useLang } from '../i18n';
import { useJson } from '../lib/data';
import { useMediaQuery } from '../lib/useMediaQuery';
import {
  divisionCountry,
  divisionName,
  level1Of,
  toDivision,
  type Division,
  type DivisionsFile,
  type DivisionsModel,
} from '../map/divisions';
import { TilesOffline } from '../map/TilesOffline';
import { FloatResize } from './FloatResize';

/**
 * 世界地圖主題的行政區（製作手冊第十六批 265，2026-11-01）：地圖上方的路徑（世界 › 台灣 › 臺北市）、左側欄列出
 * 目前這一層的行政區（依名稱或面積排，點了跳過去）、滑過的 tooltip。資料是 data/divisions/<代碼>.json（map/divisions.ts）
 */

const TEXT = defineMessages({
  zh: {
    world: '世界',
    path: '行政區的路徑',
    divisionsOf: (name: string) => `${name}的行政區`,
    count: (n: number) => `${n} 個`,
    byName: '名稱',
    byArea: '面積',
    sortBy: '排序',
    search: '搜尋行政區',
    noMatch: '沒有符合的行政區',
    none: '這一國沒有行政區的資料',
    hide: '收起行政區',
    show: '打開行政區',
    sources: '行政區界',
    area: (km2: string) => `${km2} km²`,
    back: '按 Esc 回上一層',
    listLabel: '行政區',
    offlineWhat: '行政區的界線',
    colon: '：',
    sep: '、',
    license: (license: string) => `（${license}）`,
  },
  en: {
    world: 'World',
    path: 'Administrative divisions',
    divisionsOf: (name) => `Divisions of ${name}`,
    count: (n) => `${n}`,
    byName: 'Name',
    byArea: 'Area',
    sortBy: 'Sort by',
    search: 'Search divisions',
    noMatch: 'No matching divisions',
    none: 'No division data for this country',
    hide: 'Hide divisions',
    show: 'Show divisions',
    sources: 'Boundaries',
    area: (km2) => `${km2} km²`,
    back: 'Press Esc to go up a level',
    listLabel: 'Divisions',
    offlineWhat: 'the division boundaries',
    colon: ': ',
    sep: '; ',
    license: (license) => ` (${license})`,
  },
});

/** 另一種語言的名稱（跟介面語言的一樣時不寫） */
function otherName(d: Division, lang: 'zh' | 'en'): string | null {
  const other = lang === 'zh' ? d.en : d.zh;
  return other && other !== divisionName(d, lang) ? other : null;
}
function typeName(d: Division, lang: 'zh' | 'en'): string | null {
  return lang === 'zh' ? d.typeZh : d.typeEn;
}

/** div 那一國的行政區（點了那一國才下載）；沒有資料（404）時 missing 是 true */
export function useDivisionsData(div: string | null): { model: DivisionsModel | null; missing: boolean } {
  const iso3 = div ? divisionCountry(div) : null;
  const { data, error } = useJson<DivisionsFile>(iso3 ? `divisions/${iso3}.json` : null);
  const model = useMemo(() => {
    if (!data) return null;
    const level1 = data.u1.map(toDivision);
    const byId = new Map<string, Division>(level1.map((d) => [d.id, d]));
    const children = new Map<string, Division[]>();
    for (const row of data.u2) {
      const d = toDivision(row);
      byId.set(d.id, d);
      if (d.parent) children.set(d.parent, [...(children.get(d.parent) ?? []), d]);
    }
    return { file: data, byId, level1, children };
  }, [data]);
  return { model, missing: Boolean(error) };
}

/** 地圖上方的路徑：世界 › 國家 › 第一級 › 第二級；點了回到那一層 */
export function DivisionPath({
  div,
  model,
  countryName,
  onGo,
}: {
  div: string;
  model: DivisionsModel | null;
  countryName: (iso3: string) => string;
  onGo: (id: string | null) => void;
}) {
  const lang = useLang();
  const text = TEXT[lang];
  const parts = div.split('-');
  const crumbs: { id: string | null; label: string }[] = [{ id: null, label: text.world }];
  for (let i = 1; i <= parts.length; i++) {
    const id = parts.slice(0, i).join('-');
    const d = model?.byId.get(id);
    crumbs.push({ id, label: i === 1 ? countryName(id) : d ? divisionName(d, lang) : id });
  }
  return (
    <nav className="div-path" aria-label={text.path} title={text.back}>
      <ol>
        {crumbs.map((c, i) => (
          <li key={c.id ?? 'world'}>
            {i < crumbs.length - 1 ? (
              <button type="button" onClick={() => onGo(c.id)}>
                {c.label}
              </button>
            ) : (
              <span aria-current="location">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const SEARCH_MIN_ROWS = 15;
const NARROW_QUERY = '(max-width: 900px)';

/** 左側欄：目前這一層的行政區，依名稱或面積排，點了跳過去 */
export function DivisionList({
  div,
  model,
  missing,
  countryName,
  onPick,
  onHover,
  open,
  onOpenChange,
}: {
  div: string;
  model: DivisionsModel | null;
  missing: boolean;
  countryName: (iso3: string) => string;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lang = useLang();
  const text = TEXT[lang];
  const narrow = useMediaQuery(NARROW_QUERY);
  const [sort, setSort] = useState<'name' | 'area'>('name');
  const [query, setQuery] = useState('');
  const level1 = level1Of(div);
  const kids = level1 ? model?.children.get(level1) : undefined;
  const units = kids?.length ? kids : (model?.level1 ?? []);
  const parent = kids?.length && level1 ? model?.byId.get(level1) : null;
  const title = text.divisionsOf(parent ? divisionName(parent, lang) : countryName(divisionCountry(div)));
  const collator = useMemo(() => new Intl.Collator(lang === 'zh' ? 'zh-Hant-TW-u-co-stroke' : 'en'), [lang]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = q ? units.filter((d) => [d.zh, d.en].some((n) => n?.toLowerCase().includes(q))) : units;
    return [...shown].sort((a, b) => (sort === 'area' ? b.km2 - a.km2 : collator.compare(divisionName(a, lang), divisionName(b, lang))));
  }, [units, query, sort, collator, lang]);
  const fmt = useMemo(() => new Intl.NumberFormat(lang === 'zh' ? 'zh-TW' : 'en'), [lang]);

  if (!open && !narrow) {
    return (
      <aside className="list-side is-closed" aria-label={title}>
        <button type="button" className="list-side-toggle" aria-expanded={false} onClick={() => onOpenChange(true)} title={text.show}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{text.listLabel}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className={`list-side div-list${narrow ? ' is-narrow' : ''}`} aria-label={title}>
      <div className="list-side-head">
        <h2>{title}</h2>
        {model && <span className="list-side-count">{text.count(units.length)}</span>}
        {!narrow && (
          <button type="button" className="icon-button list-side-close" aria-expanded={true} onClick={() => onOpenChange(false)} title={text.hide} aria-label={text.hide}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      {/* 界線是 PMTiles，離線時看不到（清單是 JSON，看過的國家 service worker 有存） */}
      <TilesOffline what={text.offlineWhat} />
      {missing ? (
        <p className="empty">{text.none}</p>
      ) : !model ? null : (
        <>
          <div className="list-side-sorts" role="group" aria-label={text.sortBy}>
            {(['name', 'area'] as const).map((s) => (
              <button key={s} type="button" className={`list-side-sort${s === sort ? ' is-active' : ''}`} aria-pressed={s === sort} onClick={() => setSort(s)}>
                {s === 'name' ? text.byName : text.byArea}
              </button>
            ))}
          </div>
          {units.length >= SEARCH_MIN_ROWS && (
            <input
              type="search"
              className="list-side-search"
              value={query}
              placeholder={text.search}
              aria-label={text.search}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {rows.length === 0 ? (
            <p className="empty">{text.noMatch}</p>
          ) : (
            <ol className="list-side-rows" onMouseLeave={() => onHover(null)}>
              {rows.map((d) => {
                const other = otherName(d, lang);
                const kind = typeName(d, lang);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`list-row${d.id === div ? ' is-picked' : ''}`}
                      aria-current={d.id === div ? 'true' : undefined}
                      onMouseEnter={() => onHover(d.id)}
                      onFocus={() => onHover(d.id)}
                      onClick={() => {
                        onPick(d.id);
                        if (narrow) document.querySelector('.stage-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <span className="list-row-title">{divisionName(d, lang)}</span>
                      <span className="list-row-line">{[other, kind, text.area(fmt.format(d.km2))].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="div-sources">
            {text.sources}
            {text.colon}
            {model.file.sources.map((s, i) => (
              <span key={s.url + i}>
                {i > 0 && text.sep}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
                {text.license(s.license)}
              </span>
            ))}
          </p>
        </>
      )}
      <FloatResize which="list" />
    </aside>
  );
}

/** 滑過行政區的 tooltip：名稱、另一種語言的名稱、種類、面積 */
export function DivisionTooltip({ d }: { d: Division }) {
  const lang = useLang();
  const text = TEXT[lang];
  const other = otherName(d, lang);
  const kind = typeName(d, lang);
  const fmt = new Intl.NumberFormat(lang === 'zh' ? 'zh-TW' : 'en');
  return (
    <>
      <div className="tt-value">{divisionName(d, lang)}</div>
      {other && <div className="tt-label">{other}</div>}
      <div className="tt-label">{[kind, text.area(fmt.format(d.km2))].filter(Boolean).join(' · ')}</div>
    </>
  );
}
