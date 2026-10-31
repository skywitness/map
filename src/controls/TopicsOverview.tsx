import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { tr, useLang, useT } from '../i18n';
import { readRecentTopics } from '../lib/recentTopics';
import { matchTopics, useTopicSearchItems, type TopicHit, type TopicTarget } from '../lib/topicSearch';
import { CloseIcon } from '../map/MapIcons';
import { groupOfTopic, prefetchTopic, TOPIC_GROUPS, type TopicSummary } from '../topics';
import { CATALOG } from '../topics/catalog.gen';
import { pureMap } from '../topics/map';
import { categoryStyle, Glyph, GroupGlyph, topicGlyph, useTopicIcons } from './TopicIcon';
// 只有這個元件（與它載入的）用到的樣式，跟著程式延後下載（2026-10-31 從 styles.css 搬出來）
import './TopicsOverview.css';

interface TopicsOverviewProps {
  open: boolean;
  current: { id: string };
  onSelect: (target: TopicTarget) => void;
  onClose: () => void;
}

/** 卡片下方列出的指標數（跟主題選單一樣） */
const SUMMARY_COUNT = 3;
/** 縮圖的位置（建置後是絕對路徑 /map/thumbs/，主題的網址 t/<主題>/ 底下也抓得到） */
const THUMBS = `${import.meta.env.BASE_URL}thumbs/`;
/** 「最近看過」最多列幾個 */
const RECENT_COUNT = 8;
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
  const icons = useTopicIcons(open);
  // 最近看過的主題（不含目前的），打開時讀一次
  const recent = useMemo(
    () => (open ? readRecentTopics().filter((id) => id !== current.id).slice(0, RECENT_COUNT) : []),
    [open, current.id],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      dialog.showModal();
      if (!TOUCH) filterRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const itemsReady = useTopicSearchItems();
  const matches = useMemo(() => {
    if (!query.trim()) return null;
    return new Map<string, TopicHit>(matchTopics(query).map((hit) => [hit.entry.target.topic, hit]));
  }, [query, itemsReady]);

  const summary = (topic: TopicSummary) =>
    t.topicSummary(
      topic.firstIndicators.slice(0, SUMMARY_COUNT).map((ind) => tr(ind.label, lang)),
      topic.firstIndicators.length > SUMMARY_COUNT || Boolean(topic.more),
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
          style={categoryStyle(groupOfTopic(topic.id))}
          aria-current={isCurrent ? 'page' : undefined}
          onPointerEnter={() => prefetchTopic(topic.id)}
          onFocus={() => prefetchTopic(topic.id)}
          onClick={() => onSelect(target)}
        >
          <span className="overview-thumb">
            {/* 一般解析度的螢幕用 240×140 的小縮圖（public/thumbs/s，每張約 4 KB），高解析度用 480×280 */}
            <img
              src={`${THUMBS}${topic.id}.webp`}
              srcSet={`${THUMBS}s/${topic.id}.webp 240w, ${THUMBS}${topic.id}.webp 480w`}
              sizes="(max-width: 768px) 46vw, 220px"
              alt=""
              width={240}
              height={140}
              loading="lazy"
              decoding="async"
            />
            {/* 縮圖幾乎都是同一個顏色的世界地圖，左上角放主題的圖示（分類代表色）才認得出來 */}
            <span className="overview-badge" aria-hidden="true">
              <Glyph d={topicGlyph(icons, topic.id)} size={15} />
            </span>
          </span>
          <span className="overview-card-title">{tr(topic.title, lang)}</span>
          <span className="overview-card-summary">
            {hit && hit.entry.kind !== 'topic' ? t.overviewMatch(tr(hit.entry.label, lang)) : summary(topic)}
          </span>
        </button>
      </li>
    );
  };

  // 分類裡再依小標題分段（2026-10-30 起；篩選時沒有符合的段落不列）
  const sections = [
    { id: 'map', group: null, label: tr(pureMap.shortTitle, lang), parts: [{ label: null, topics: [CATALOG.topics[pureMap.id]] }] },
    ...TOPIC_GROUPS.map((g) => ({ id: g.id, group: g.id, label: tr(g.label, lang), parts: g.sections })),
  ]
    .map((s) => ({
      ...s,
      parts: s.parts
        .map((p) => ({ label: p.label ? tr(p.label, lang) : null, cards: p.topics.map(card).filter(Boolean) }))
        .filter((p) => p.cards.length),
    }))
    .filter((s) => s.parts.length);

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
          {/* 最近看過（lib/recentTopics.ts）：篩選時不列 */}
          {!matches && recent.length > 0 && (
            <section aria-labelledby="overview-recent">
              <h3 id="overview-recent">{t.overviewRecent}</h3>
              <ul className="overview-recent">
                {recent.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      style={categoryStyle(groupOfTopic(id))}
                      onPointerEnter={() => prefetchTopic(id)}
                      onFocus={() => prefetchTopic(id)}
                      onClick={() => onSelect({ topic: id, indicator: null, item: null })}
                    >
                      <span className="topic-tile" aria-hidden="true">
                        <Glyph d={topicGlyph(icons, id)} size={16} />
                      </span>
                      {tr(CATALOG.topics[id].shortTitle, lang)}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {sections.length ? (
            sections.map((s) => (
              <section key={s.id} aria-labelledby={`overview-${s.id}`}>
                <h3 id={`overview-${s.id}`} style={categoryStyle(s.group)}>
                  <span className="topic-tile" aria-hidden="true">
                    <GroupGlyph group={s.id} size={16} />
                  </span>
                  {s.label}
                </h3>
                {s.parts.map((p, i) =>
                  p.label ? (
                    <div key={i} className="overview-part">
                      <h4>{p.label}</h4>
                      <ul className="overview-grid">{p.cards}</ul>
                    </div>
                  ) : (
                    <ul key={i} className="overview-grid">
                      {p.cards}
                    </ul>
                  ),
                )}
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
