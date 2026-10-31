import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { tr, useLang } from '../i18n';
import { makeKey, normalize, scoreKey, searchCountries, type SearchEntry } from '../lib/countrySearch';
import { readRecentTopics } from '../lib/recentTopics';
import { useUI } from '../lib/strings';
import { searchTopics, useTopicSearchItems, type TopicTarget } from '../lib/topicSearch';
import { SearchIcon } from '../map/MapIcons';
import { groupOfTopic, TOPIC_GROUPS } from '../topics';
import { CATALOG } from '../topics/catalog.gen';
import { UI_ICONS } from '../topics/groupIcons.gen';
import { categoryStyle, Glyph, topicGlyph, useTopicIcons } from './TopicIcon';

import type { PaletteAction } from './CommandPalette';
// 只有這個元件（與它載入的）用到的樣式，跟著程式延後下載（2026-10-31 從 styles.css 搬出來）
import './CommandPaletteDialog.css';

export interface CommandPaletteProps {
  /** 國家搜尋的範圍（跟搜尋框一樣，App.tsx 的 searchIndex） */
  index: SearchEntry[];
  currentTopic: string;
  onSelectCountry: (iso3: string) => void;
  onSelectTopic: (target: TopicTarget) => void;
  actions: PaletteAction[];
}

interface DialogProps extends CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

/** 空白時列出的最近看過的主題數 */
const RECENT_COUNT = 6;

type Option =
  | { kind: 'topic'; key: string; target: TopicTarget; name: string; meta: string; tag?: string }
  | { kind: 'country'; key: string; iso3: string; name: string; meta: string }
  | { kind: 'action'; key: string; action: PaletteAction };

interface Group {
  heading: string;
  options: Option[];
  best: number;
}

/**
 * 指令面板（2026-10-29）：Ctrl+K（Mac 是 ⌘K）從任何地方打開，一個輸入框找主題、指標、子項目、國家與指令，
 * 空白時列出最近看過的主題與所有指令。用 <dialog> 的 showModal（焦點留在裡面、Esc 關閉、關閉後焦點回到原處）；
 * 輸入框是 WAI-ARIA 的 combobox，↑↓ 選擇、Enter 執行。比對與計分跟搜尋框一樣（countrySearch.ts、topicSearch.ts）。
 * 觸控裝置沒有 Ctrl+K，用控制列的搜尋框。
 */
/** 指令面板的對話框（CommandPalette.tsx 第一次打開時才下載這個 chunk，2026-10-30） */
export default function CommandPaletteDialog({ open, setOpen, index, currentTopic, onSelectCountry, onSelectTopic, actions }: DialogProps) {
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
  const groups = useMemo<Group[]>(() => {
    if (!open) return [];
    const topicOption = (topicId: string): Option => {
      const topic = CATALOG.topics[topicId];
      const group = groupOfTopic(topicId);
      return {
        kind: 'topic',
        key: `recent/${topicId}`,
        target: { topic: topicId, indicator: null, item: null },
        name: tr(topic.title, lang),
        meta: group ? tr(TOPIC_GROUP_LABELS.get(group)!, lang) : '',
      };
    };
    const actionOption = (action: PaletteAction): Option => ({ kind: 'action', key: `action/${action.id}`, action });
    const q = normalize(query).replace(/ /g, '');
    if (!q) {
      const recentTopics = recent.filter((t) => t !== currentTopic).slice(0, RECENT_COUNT);
      return [
        { heading: P.recent, options: recentTopics.map(topicOption), best: 2 },
        { heading: P.commands, options: actions.map(actionOption), best: 1 },
      ].filter((g) => g.options.length);
    }
    const topics = searchTopics(query, 6);
    const countries = searchCountries(index, query, lang, 5);
    const matched = actions
      .map((action) => {
        const key = makeKey(action.label, 3);
        return { action, score: key ? scoreKey(q, key) : 0 };
      })
      .filter((a) => a.score >= 500)
      .sort((a, b) => b.score - a.score);
    const list: Group[] = [
      {
        heading: UI.search.topics,
        best: topics[0]?.score ?? 0,
        options: topics.map(({ entry }) => ({
          kind: 'topic',
          key: `${entry.target.topic}/${entry.target.indicator}/${entry.target.item}`,
          target: entry.target,
          name: tr(entry.label, lang),
          meta: entry.kind === 'topic' ? tr(entry.groupLabel, lang) : tr(entry.topicTitle, lang),
          tag: UI.search.kinds[entry.kind],
        })),
      },
      {
        heading: UI.search.countries,
        best: countries[0]?.score ?? 0,
        options: countries.map(({ entry }) => ({
          kind: 'country',
          key: entry.iso3,
          iso3: entry.iso3,
          name: lang === 'en' ? entry.en : entry.zh,
          meta: lang === 'en' ? entry.iso3 : `${entry.en} · ${entry.iso3}`,
        })),
      },
      { heading: P.commands, best: matched[0]?.score ?? 0, options: matched.map((a) => actionOption(a.action)) },
    ];
    return list.filter((g) => g.options.length).sort((a, b) => b.best - a.best);
  }, [open, query, recent, currentTopic, actions, index, lang, P, UI, itemsReady]);
  const options = groups.flatMap((g) => g.options);
  const optionId = (i: number) => `${id}-option-${i}`;

  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optionId(active))}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (option: Option) => {
    setOpen(false);
    if (option.kind === 'topic') onSelectTopic(option.target);
    else if (option.kind === 'country') onSelectCountry(option.iso3);
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
                  style={option.kind === 'topic' ? categoryStyle(groupOfTopic(option.target.topic)) : categoryStyle(null)}
                  onMouseMove={() => n !== active && setActive(n)}
                  onClick={() => choose(option)}
                >
                  <span className="topic-tile" aria-hidden="true">
                    <Glyph
                      size={16}
                      d={
                        option.kind === 'topic'
                          ? topicGlyph(icons, option.target.topic)
                          : UI_ICONS[option.kind === 'country' ? 'country' : 'command']
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

/** 分類的名稱（最近看過的主題寫在第二行） */
const TOPIC_GROUP_LABELS = new Map(TOPIC_GROUPS.map((g) => [g.id, g.label]));
