import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLang } from '../i18n';
import type { SearchEntry } from '../lib/countrySearch';
import { readRecentTopics } from '../lib/recentTopics';
import { useUI } from '../lib/strings';
import { useTopicSearchItems, type TopicTarget } from '../lib/topicSearch';
import { SearchIcon } from '../map/MapIcons';
import { groupOfTopic } from '../topics';
import { UI_ICONS } from '../topics/groupIcons.gen';
import { optionTopic, searchGroups, type ComboTarget, type PlaceOption, type SearchOption } from './searchGroups';
import { categoryStyle, Glyph, topicGlyph, useTopicIcons } from './TopicIcon';

import type { PaletteAction } from './CommandPalette';
// 只有這個元件（與它載入的）用到的樣式，跟著程式延後下載（2026-10-31 從 styles.css 搬出來）
import './CommandPaletteDialog.css';

export type { ComboTarget, PlaceOption } from './searchGroups';

export interface CommandPaletteProps {
  /** 國家搜尋的範圍（跟搜尋框一樣，App.tsx 的 searchIndex） */
  index: SearchEntry[];
  currentTopic: string;
  onSelectCountry: (iso3: string) => void;
  onSelectTopic: (target: TopicTarget) => void;
  actions: PaletteAction[];
  /** 搜尋目前主題地圖上的點（賽道、博物館…，App.tsx 的 searchPlaces）；沒有點圖層的主題回傳空的 */
  places?: (query: string, limit: number) => PlaceOption[];
  /** 組合搜尋（「日本 2010 人口」，lib/comboSearch.ts）：一次換主題（null 是目前的）、選國家、跳到那一年 */
  onSelectCombo?: (combo: ComboTarget) => void;
}

interface DialogProps extends CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

type Option = SearchOption;

/**
 * 指令面板（2026-10-29）：Ctrl+K（Mac 是 ⌘K）從任何地方打開，一個輸入框找主題、指標、子項目、國家與指令，
 * 空白時列出最近看過的主題與所有指令。用 <dialog> 的 showModal（焦點留在裡面、Esc 關閉、關閉後焦點回到原處）；
 * 輸入框是 WAI-ARIA 的 combobox，↑↓ 選擇、Enter 執行。比對與計分跟搜尋框一樣（countrySearch.ts、topicSearch.ts）。
 * 觸控裝置沒有 Ctrl+K，用控制列的搜尋框。
 */
/** 指令面板的對話框（CommandPalette.tsx 第一次打開時才下載這個 chunk，2026-10-30） */
export default function CommandPaletteDialog({ open, setOpen, index, currentTopic, onSelectCountry, onSelectTopic, actions, places, onSelectCombo }: DialogProps) {
  const id = useId();
  const UI = useUI();
  const P = UI.palette;
  const lang = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const icons = useTopicIcons(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      setActive(0);
      setRecent(readRecentTopics());
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const itemsReady = useTopicSearchItems();
  const groups = useMemo(
    () =>
      open
        ? searchGroups(query, { index, currentTopic, actions, places, topics: true, combo: Boolean(onSelectCombo), recent }, lang, UI)
        : [],
    // itemsReady：主題搜尋的子項目第一次搜尋時才下載，到了重算一次結果
    [open, query, recent, currentTopic, actions, index, lang, UI, itemsReady, places, onSelectCombo],
  );
  const options = groups.flatMap((g) => g.options);
  const optionId = (i: number) => `${id}-option-${i}`;

  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (option: Option) => {
    setOpen(false);
    if (option.kind === 'topic') onSelectTopic(option.target);
    else if (option.kind === 'country') onSelectCountry(option.iso3);
    else if (option.kind === 'place') option.run();
    else if (option.kind === 'combo') onSelectCombo?.(option.combo);
    else option.action.run();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 注音、拼音選字中的 Enter／方向鍵交給輸入法
    const move = (to: number) => {
      e.preventDefault();
      if (options.length) setActive((to + options.length) % options.length);
    };
    if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'PageDown') move(Math.min(options.length - 1, active + 5));
    else if (e.key === 'PageUp') move(Math.max(0, active - 5));
    else if (e.key === 'Enter' && options[active]) {
      e.preventDefault();
      choose(options[active]);
    }
  };

  // 點對話框外面的暗色背景也關閉
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) setOpen(false);
  };

  let i = -1;
  return (
    <dialog
      ref={dialogRef}
      className="cmdk"
      aria-label={P.title}
      onClose={() => setOpen(false)}
      onClick={onDialogClick}
    >
      <div className="cmdk-input">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={P.title}
          aria-autocomplete="list"
          aria-expanded={options.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={options[active] ? optionId(active) : undefined}
          placeholder={P.placeholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="cmdk-esc">Esc</kbd>
      </div>
      {options.length ? (
        <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={P.title} className="cmdk-list">
          {groups.map((group) => [
            <li key={group.heading} role="presentation" className="cmdk-heading">
              {group.heading}
            </li>,
            ...group.options.map((option) => {
              const n = ++i;
              return (
                <li
                  key={option.key}
                  id={optionId(n)}
                  role="option"
                  aria-selected={n === active}
                  className={`cmdk-option${n === active ? ' is-active' : ''}`}
                  style={categoryStyle(optionTopic(option, currentTopic) ? groupOfTopic(optionTopic(option, currentTopic)!) : null)}
                  onMouseMove={() => n !== active && setActive(n)}
                  onClick={() => choose(option)}
                >
                  <span className="topic-tile" aria-hidden="true">
                    <Glyph
                      size={16}
                      d={
                        optionTopic(option, currentTopic)
                          ? topicGlyph(icons, optionTopic(option, currentTopic)!)
                          : UI_ICONS[option.kind === 'country' ? 'country' : option.kind === 'place' ? 'place' : 'command']
                      }
                    />
                  </span>
                  <span className="cmdk-name">{option.kind === 'action' ? option.action.label : option.name}</span>
                  {option.kind !== 'action' && option.meta && <span className="cmdk-meta">{option.meta}</span>}
                  {option.kind === 'topic' && option.tag && <span className="cmdk-tag">{option.tag}</span>}
                </li>
              );
            }),
          ])}
        </ul>
      ) : (
        <p className="cmdk-empty">{P.noResults}</p>
      )}
      <p className="cmdk-hint" aria-hidden="true">
        {P.hint}
      </p>
      <span className="visually-hidden" role="status" aria-live="polite">
        {query.trim() ? UI.search.resultCount(options.length) : ''}
      </span>
    </dialog>
  );
}
