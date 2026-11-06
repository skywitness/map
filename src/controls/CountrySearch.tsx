import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLang } from '../i18n';
import type { SearchEntry } from '../lib/countrySearch';
import { readRecentTopics } from '../lib/recentTopics';
import { useUI } from '../lib/strings';
import { useTopicSearchItems, type TopicTarget } from '../lib/topicSearch';
import { SearchIcon } from '../map/MapIcons';
import type { PaletteAction } from './CommandPalette';
import { useHotkeys } from './hotkeys';
import { searchGroups, type ComboTarget, type PlaceOption, type SearchOption } from './searchGroups';

interface CountrySearchProps {
  index: SearchEntry[];
  onSelect: (iso3: string) => void;
  /** 有傳才一起搜尋主題、指標與子項目（topicSearch.ts），選到時換過去 */
  onSelectTopic?: (target: TopicTarget) => void;
  /**
   * 跟指令面板一樣的功能（2026-11-05，searchGroups.ts）：目前的主題（組合搜尋、最近看過不列它）、指令、
   * 這個主題地圖上的地點、組合搜尋（「日本 2010 人口」）；沒傳的就不列
   */
  currentTopic?: string;
  actions?: PaletteAction[];
  places?: (query: string, limit: number) => PlaceOption[];
  onSelectCombo?: (combo: ComboTarget) => void;
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

type Option = SearchOption;

/**
 * 國家與主題搜尋（WAI-ARIA combobox）：打字即時列出結果，↑↓ 選擇、Enter 確定、Esc 關閉，按「/」從任何地方跳到這裡。
 * 結果跟指令面板一樣（searchGroups.ts）：組合搜尋、主題、國家（附目前的數值）、地圖上的地點、指令，比對分數高的那一組排前面
 * （打「日本」國家在前，打「房價」主題在前）；點進來還沒打字時列出最近看過的主題與指令。
 */
export function CountrySearch({
  index,
  onSelect,
  onSelectTopic,
  valueOf,
  compact = false,
  currentTopic = '',
  actions,
  places,
  onSelectCombo,
}: CountrySearchProps) {
  const id = useId();
  const UI = useUI();
  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // 最近看過的主題：每次點進搜尋框時讀（換主題時 recentTopics.ts 才記）
  const [recent, setRecent] = useState<string[]>([]);
  // compact 時輸入框是否展開
  const [unfolded, setUnfolded] = useState(false);
  const folded = compact && !unfolded;
  // 主題搜尋的子項目第一次搜尋時才下載，到了重算一次結果
  const itemsReady = useTopicSearchItems();
  const groups = useMemo(
    () =>
      open
        ? searchGroups(
            query,
            { index, currentTopic, actions, places, topics: Boolean(onSelectTopic), combo: Boolean(onSelectCombo), recent },
            lang,
            UI,
          )
        : [],
    [open, index, query, lang, onSelectTopic, onSelectCombo, currentTopic, actions, places, recent, UI, itemsReady],
  );
  const options = groups.flatMap((g) => g.options);
  // 沒打字時也打開（最近看過的主題與指令），什麼都沒有時才不開
  const expanded = open && (query.trim() !== '' || groups.length > 0);
  // 清單往哪邊展開：搜尋框在畫面左半邊時（指標的按鈕很長，搜尋框換到第二行的左邊）靠左對齊，否則靠右，
  // 不會長出畫面外（2026-11-05，列了指令以後清單比較寬）
  const [alignLeft, setAlignLeft] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const box = inputRef.current?.getBoundingClientRect();
    if (box) setAlignLeft(box.left + box.width / 2 < window.innerWidth / 2);
  }, [expanded]);
  const optionId = (i: number) => `${id}-option-${i}`;

  useHotkeys({ '/': () => (folded ? setUnfolded(true) : inputRef.current?.focus()) });

  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (option: Option) => {
    if (option.kind === 'country') onSelect(option.iso3);
    else if (option.kind === 'topic') onSelectTopic?.(option.target);
    else if (option.kind === 'combo') onSelectCombo?.(option.combo);
    else if (option.kind === 'place') option.run();
    else option.action.run();
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
        onFocus={() => {
          setRecent(readRecentTopics());
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          // 打到一半的字留著，再點放大鏡時還在
          setUnfolded(false);
        }}
      />
      {expanded && (
        <div className={`search-results${alignLeft ? ' is-left' : ''}`}>
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
                          <span className="result-name">{option.name}</span>
                          <span className="result-meta">{option.meta}</span>
                          {valueOf && (
                            <span className={`result-value${value == null ? ' is-empty' : ''}`}>
                              {value ?? UI.search.noData}
                            </span>
                          )}
                        </>
                      ) : option.kind === 'action' ? (
                        <>
                          <span className="result-name">{option.action.label}</span>
                          <span className="result-value result-kind">{UI.search.kinds.command}</span>
                        </>
                      ) : (
                        <>
                          <span className="result-name">{option.name}</span>
                          {option.meta && <span className="result-meta">{option.meta}</span>}
                          {option.kind === 'topic' && option.tag && <span className="result-value result-kind">{option.tag}</span>}
                          {option.kind === 'place' && <span className="result-value result-kind">{UI.search.kinds.place}</span>}
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
