import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { tr, useLang } from '../i18n';
import { searchCountries, type SearchEntry } from '../lib/countrySearch';
import { useUI } from '../lib/strings';
import { searchTopics, type TopicTarget } from '../lib/topicSearch';
import { SearchIcon } from '../map/MapIcons';
import { useHotkeys } from './hotkeys';

interface CountrySearchProps {
  index: SearchEntry[];
  onSelect: (iso3: string) => void;
  /** 有傳才一起搜尋主題、指標與子項目（topicSearch.ts），選到時換過去 */
  onSelectTopic?: (target: TopicTarget) => void;
  /** 結果旁顯示的目前數值；純地圖頁沒有數值，不傳 */
  valueOf?: (iso3: string) => string | null;
  /**
   * 手機：平常只是一顆放大鏡按鈕，點了才展開成蓋住整行控制列的輸入框（離開時沒有輸入就收起來），
   * 指標、地圖／排名表、分享才排得進同一行，地圖往上移
   */
  compact?: boolean;
}

/** 手機、平板沒有實體鍵盤，提示文字不必寫快捷鍵 */
const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

type Option =
  | { kind: 'country'; key: string; iso3: string; zh: string; en: string }
  | { kind: 'topic'; key: string; target: TopicTarget; name: string; meta: string; tag: string };

/**
 * 國家與主題搜尋（WAI-ARIA combobox）：打字即時列出結果，↑↓ 選擇、Enter 確定、Esc 關閉，按「/」從任何地方跳到這裡。
 * 國家、主題分兩組，比對分數高的那一組排前面（打「日本」國家在前，打「房價」主題在前）。
 */
export function CountrySearch({ index, onSelect, onSelectTopic, valueOf, compact = false }: CountrySearchProps) {
  const id = useId();
  const UI = useUI();
  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // compact 時輸入框是否展開
  const [unfolded, setUnfolded] = useState(false);
  const folded = compact && !unfolded;
  const groups = useMemo(() => {
    const countries = searchCountries(index, query, lang);
    const topics = onSelectTopic ? searchTopics(query) : [];
    const countryOptions: Option[] = countries.map(({ entry }) => ({ kind: 'country', key: entry.iso3, ...entry }));
    const topicOptions: Option[] = topics.map(({ entry }) => ({
      kind: 'topic',
      key: `${entry.target.topic}/${entry.target.indicator}/${entry.target.item}`,
      target: entry.target,
      name: tr(entry.label, lang),
      meta: entry.kind === 'topic' ? tr(entry.groupLabel, lang) : tr(entry.topicTitle, lang),
      tag: UI.search.kinds[entry.kind],
    }));
    const list = [
      { heading: UI.search.countries, options: countryOptions, best: countries[0]?.score ?? 0 },
      { heading: UI.search.topics, options: topicOptions, best: topics[0]?.score ?? 0 },
    ].filter((g) => g.options.length);
    return list.sort((a, b) => b.best - a.best);
  }, [index, query, lang, onSelectTopic, UI]);
  const options = groups.flatMap((g) => g.options);
  const expanded = open && query.trim() !== '';
  const optionId = (i: number) => `${id}-option-${i}`;

  useHotkeys({ '/': () => (folded ? setUnfolded(true) : inputRef.current?.focus()) });

  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (option: Option) => {
    if (option.kind === 'country') onSelect(option.iso3);
    else onSelectTopic?.(option.target);
    setQuery('');
    setOpen(false);
    setUnfolded(false);
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
      if (!options.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + options.length) % options.length);
    } else if (e.key === 'Enter') {
      const option = expanded ? options[active] : undefined;
      if (option) {
        e.preventDefault();
        choose(option);
      }
    } else if (e.key === 'Escape') {
      // 先關結果清單，再清空文字，最後離開搜尋框；都不會取消已選的國家
      e.preventDefault();
      if (expanded) setOpen(false);
      else if (query) setQuery('');
      else inputRef.current?.blur();
    }
  };

  const label = onSelectTopic ? UI.search.labelWithTopics : UI.search.label;
  const placeholder = onSelectTopic
    ? TOUCH
      ? UI.search.touchPlaceholderWithTopics
      : UI.search.placeholderWithTopics
    : TOUCH
      ? UI.search.touchPlaceholder
      : UI.search.placeholder;
  let i = -1;

  if (folded) {
    return (
      <button type="button" className="icon-button search-unfold" aria-label={label} title={label} onClick={() => setUnfolded(true)}>
        <SearchIcon />
      </button>
    );
  }

  return (
    <div className={`search-box${compact ? ' is-overlay' : ''}`}>
      <input
        ref={inputRef}
        // compact：點了放大鏡才出現，直接讓鍵盤跳出來
        autoFocus={compact}
        className="search"
        type="search"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={expanded && options.length ? `${id}-list` : undefined}
        aria-activedescendant={expanded && options[active] ? optionId(active) : undefined}
        placeholder={placeholder}
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
        onBlur={() => {
          setOpen(false);
          // 打到一半的字留著，再點放大鏡時還在
          setUnfolded(false);
        }}
      />
      {expanded && (
        <div className="search-results">
          {options.length ? (
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={label}>
              {groups.map((group) => [
                // 只有一組時不寫組名（純國家的結果跟原本一樣）
                groups.length > 1 && (
                  <li key={group.heading} role="presentation" className="result-heading">
                    {group.heading}
                  </li>
                ),
                ...group.options.map((option) => {
                  const n = ++i;
                  const value = option.kind === 'country' ? valueOf?.(option.iso3) : undefined;
                  return (
                    <li
                      key={option.key}
                      id={optionId(n)}
                      role="option"
                      aria-selected={n === active}
                      className={n === active ? 'is-active' : undefined}
                      // 按下時不讓輸入框失焦，否則清單會在 click 之前就關掉
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => n !== active && setActive(n)}
                      onClick={() => choose(option)}
                    >
                      {option.kind === 'country' ? (
                        <>
                          {/* 中文介面附上英文名；英文介面只附 ISO 代碼（中文名稱一樣能搜尋） */}
                          <span className="result-name">{lang === 'en' ? option.en : option.zh}</span>
                          <span className="result-meta">{lang === 'en' ? option.iso3 : `${option.en} · ${option.iso3}`}</span>
                          {valueOf && (
                            <span className={`result-value${value == null ? ' is-empty' : ''}`}>
                              {value ?? UI.search.noData}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="result-name">{option.name}</span>
                          <span className="result-meta">{option.meta}</span>
                          <span className="result-value result-kind">{option.tag}</span>
                        </>
                      )}
                    </li>
                  );
                }),
              ])}
            </ul>
          ) : (
            <p className="search-empty">{onSelectTopic ? UI.search.noResultsWithTopics : UI.search.noResults}</p>
          )}
        </div>
      )}
      <span className="visually-hidden" role="status" aria-live="polite">
        {expanded ? UI.search.resultCount(options.length) : ''}
      </span>
    </div>
  );
}
