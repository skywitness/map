import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchCountries, type SearchEntry } from '../lib/countrySearch';
import { UI } from '../lib/strings';
import { useHotkeys } from './hotkeys';

interface CountrySearchProps {
  index: SearchEntry[];
  onSelect: (iso3: string) => void;
  /** 結果旁顯示的目前數值；純地圖頁沒有數值，不傳 */
  valueOf?: (iso3: string) => string | null;
}

/** 手機、平板沒有實體鍵盤，提示文字不必寫快捷鍵 */
const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * 國家搜尋（WAI-ARIA combobox）：打字即時列出結果，↑↓ 選擇、Enter 確定、Esc 關閉，按「/」從任何地方跳到這裡。
 */
export function CountrySearch({ index, onSelect, valueOf }: CountrySearchProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchCountries(index, query), [index, query]);
  const expanded = open && query.trim() !== '';
  const optionId = (i: number) => `${id}-option-${i}`;

  useHotkeys({ '/': () => inputRef.current?.focus() });

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (iso3: string) => {
    onSelect(iso3);
    setQuery('');
    setOpen(false);
    // 交還焦點：手機收起鍵盤，桌機可以接著用方向鍵換年份
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 注音、拼音選字中的 Enter／方向鍵交給輸入法
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!expanded) {
        setOpen(true);
        return;
      }
      if (!hits.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      const hit = expanded ? hits[active] : undefined;
      if (hit) {
        e.preventDefault();
        choose(hit.entry.iso3);
      }
    } else if (e.key === 'Escape') {
      // 先關結果清單，再清空文字，最後離開搜尋框；都不會取消已選的國家
      e.preventDefault();
      if (expanded) setOpen(false);
      else if (query) setQuery('');
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="search-box">
      <input
        ref={inputRef}
        className="search"
        type="search"
        role="combobox"
        aria-label={UI.search.label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded && hits.length ? `${id}-list` : undefined}
        aria-activedescendant={expanded && hits[active] ? optionId(active) : undefined}
        placeholder={TOUCH ? UI.search.label : UI.search.placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {expanded && (
        <div className="search-results">
          {hits.length ? (
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={UI.search.label}>
              {hits.map(({ entry }, i) => {
                const value = valueOf?.(entry.iso3);
                return (
                  <li
                    key={entry.iso3}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'is-active' : undefined}
                    // 按下時不讓輸入框失焦，否則清單會在 click 之前就關掉
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => choose(entry.iso3)}
                  >
                    <span className="result-name">{entry.zh}</span>
                    <span className="result-meta">
                      {entry.en} · {entry.iso3}
                    </span>
                    {valueOf && (
                      <span className={`result-value${value == null ? ' is-empty' : ''}`}>
                        {value ?? UI.search.noData}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="search-empty">{UI.search.noResults}</p>
          )}
        </div>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">
        {expanded ? UI.search.resultCount(hits.length) : ''}
      </span>
    </div>
  );
}
