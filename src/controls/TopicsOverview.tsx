import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { tr, useLang, useT } from '../i18n';
import { matchTopics, type TopicHit, type TopicTarget } from '../lib/topicSearch';
import { CloseIcon } from '../map/MapIcons';
import { prefetchTopic, TOPIC_GROUPS, type TopicSummary } from '../topics';
import { pureMap } from '../topics/map';

interface TopicsOverviewProps {
  open: boolean;
  current: { id: string };
  onSelect: (target: TopicTarget) => void;
  onClose: () => void;
}

/** 卡片下方列出的指標數（跟主題選單一樣） */
const SUMMARY_COUNT = 3;
/** 觸控裝置打開時不自動聚焦篩選框，免得鍵盤一跳出來蓋住半個畫面 */
const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * 全部主題的總覽：每個主題一張卡片（平面世界地圖的縮圖，scripts/topic-thumbs.mjs 產生，放在 public/thumbs），
 * 依分類排；上面的篩選框比對主題、指標與子項目（topicSearch.ts），比對到指標或子項目時卡片寫出是哪一個，點了直接開那個指標。
 * 用 <dialog> 的 showModal：焦點留在對話框裡、Esc 關閉、後面的頁面不能點，都是瀏覽器內建的。
 */
export function TopicsOverview({ open, current, onSelect, onClose }: TopicsOverviewProps) {
  const t = useT();
  const lang = useLang();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      dialog.showModal();
      if (!TOUCH) filterRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const matches = useMemo(() => {
    if (!query.trim()) return null;
    return new Map<string, TopicHit>(matchTopics(query).map((hit) => [hit.entry.target.topic, hit]));
  }, [query]);

  const summary = (topic: TopicSummary) =>
    t.topicSummary(
      topic.indicators.slice(0, SUMMARY_COUNT).map((ind) => tr(ind.label, lang)),
      topic.indicators.length > SUMMARY_COUNT,
    );

  const card = (topic: TopicSummary) => {
    const hit = matches?.get(topic.id);
    if (matches && !hit) return null;
    const target = hit?.entry.target ?? { topic: topic.id, indicator: null, item: null };
    const isCurrent = topic.id === current.id;
    return (
      <li key={topic.id}>
        <button
          type="button"
          className={`overview-card${isCurrent ? ' is-current' : ''}`}
          aria-current={isCurrent ? 'page' : undefined}
          onPointerEnter={() => prefetchTopic(topic.id)}
          onFocus={() => prefetchTopic(topic.id)}
          onClick={() => onSelect(target)}
        >
          <img src={`thumbs/${topic.id}.webp`} alt="" width={240} height={140} loading="lazy" decoding="async" />
          <span className="overview-card-title">{tr(topic.title, lang)}</span>
          <span className="overview-card-summary">
            {hit && hit.entry.kind !== 'topic' ? t.overviewMatch(tr(hit.entry.label, lang)) : summary(topic)}
          </span>
        </button>
      </li>
    );
  };

  const sections = [
    { id: 'map', label: tr(pureMap.shortTitle, lang), topics: [pureMap] },
    ...TOPIC_GROUPS.map((g) => ({ id: g.id, label: tr(g.label, lang), topics: g.topics })),
  ]
    .map((s) => ({ ...s, cards: s.topics.map(card).filter(Boolean) }))
    .filter((s) => s.cards.length);

  // 點對話框外面的暗色背景也關閉（點到的是 <dialog> 本身，不是裡面的東西）
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog ref={dialogRef} className="overview" aria-labelledby="overview-title" onClose={onClose} onClick={onDialogClick}>
      <div className="overview-inner">
        <header className="overview-header">
          <h2 id="overview-title">{t.allTopics}</h2>
          <input
            ref={filterRef}
            className="overview-filter"
            type="search"
            aria-label={t.overviewFilter}
            placeholder={t.overviewFilter}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="icon-button" onClick={onClose} aria-label={t.close} title={t.close}>
            <CloseIcon />
          </button>
        </header>
        <div className="overview-body">
          {sections.length ? (
            sections.map((s) => (
              <section key={s.id} aria-labelledby={`overview-${s.id}`}>
                <h3 id={`overview-${s.id}`}>{s.label}</h3>
                <ul className="overview-grid">{s.cards}</ul>
              </section>
            ))
          ) : (
            <p className="empty">{t.overviewNoMatch}</p>
          )}
          <p className="overview-credit">{t.overviewCredit}</p>
        </div>
      </div>
    </dialog>
  );
}
