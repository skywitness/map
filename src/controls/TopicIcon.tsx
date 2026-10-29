import { useEffect, useState, type CSSProperties } from 'react';
import { TOKENS } from '../theme/tokens';
import { GROUP_ICONS } from '../topics/groupIcons.gen';

/**
 * 主題與分類的圖示（scripts/topic-icons.mjs 從 Lucide 產生的線條圖示）與分類代表色（tokens.ts 的 CATEGORY_COLORS）。
 * 分類的圖示很小，跟首頁一起載入；96 個主題的圖示（gzip 後約 8 KB）另外一個 chunk，第一次打開選單、
 * 總覽時才下載（頂列閒置時先抓，loadTopicIcons），下載前只畫分類色的底。
 */
let topicIcons: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

export function loadTopicIcons(): Promise<Record<string, string>> {
  loading ??= import('../topics/icons.gen').then(
    (m) => (topicIcons = m.TOPIC_ICONS),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** 主題的圖示；還沒下載時是 null，下載完重畫 */
export function useTopicIcons(wanted: boolean): Record<string, string> | null {
  const [icons, setIcons] = useState(topicIcons);
  useEffect(() => {
    if (!wanted || icons) return;
    let alive = true;
    loadTopicIcons().then(
      (loaded) => alive && setIcons(loaded),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [wanted, icons]);
  return icons;
}

/** 分類色的 CSS 變數（--cat 線條、--cat-solid 白色圖示的底）；沒有分類（純地圖）用灰色，白色圖示的底深淺色都用深灰 */
export function categoryStyle(group: string | null): CSSProperties {
  return (group
    ? { '--cat': `var(--cat-${group})`, '--cat-solid': `var(--cat-solid-${group})` }
    : { '--cat': 'var(--ink-secondary)', '--cat-solid': TOKENS.light.inkSecondary }) as CSSProperties;
}

/** 24×24 的線條圖示，顏色跟著 currentColor */
export function Glyph({ d, size = 16, className }: { d: string | undefined; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d && <path d={d} />}
    </svg>
  );
}

/** 主題的圖示：純地圖用分類那組的地圖圖示；主題的圖示還沒下載時是 undefined（只畫底色） */
export function topicGlyph(icons: Record<string, string> | null, topic: string): string | undefined {
  return topic === 'map' ? GROUP_ICONS.map : icons?.[topic];
}

/** 分類（或純地圖 'map'）的圖示 */
export function GroupGlyph({ group, size, className }: { group: string; size?: number; className?: string }) {
  return <Glyph d={GROUP_ICONS[group]} size={size} className={className} />;
}
