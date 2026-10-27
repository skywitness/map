import type { MouseEvent, ReactNode } from 'react';
import { getLang, URL_PARAM } from '../../i18n';

/**
 * 連到別的主題（同一個國家）：在網頁裡換主題（url-state 聽 popstate），上一頁回到原本的主題；
 * 按住 Ctrl、Cmd、Shift、Alt 或中鍵時照一般連結開新分頁。國家小檔案的「其他主題」、摩天大樓的城市都用它。
 */
export function topicHref(topic: string, ind: string | undefined, iso3: string): string {
  const p = new URLSearchParams({ topic });
  if (ind) p.set('ind', ind);
  p.set('country', iso3);
  if (getLang() === 'en') p.set(URL_PARAM, 'en');
  return `?${p}`;
}

/** 連結的 onClick：一般的點一下在網頁裡換主題；按住修飾鍵或中鍵時不攔，照一般連結開新分頁 */
export function openTopic(e: MouseEvent<HTMLAnchorElement>, topic: string, iso3: string, ind?: string): void {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  window.history.pushState(null, '', topicHref(topic, ind, iso3));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function TopicLink({ topic, ind, iso3, children }: { topic: string; ind?: string; iso3: string; children: ReactNode }) {
  return (
    <a className="profile-link" href={topicHref(topic, ind, iso3)} onClick={(e) => openTopic(e, topic, iso3, ind)}>
      {children} →
    </a>
  );
}
