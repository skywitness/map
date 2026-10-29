import type { CSSProperties } from 'react';
import { useT } from '../i18n';

/** 載入中的灰色色塊（styles.css 的 .skeleton，淡淡地閃；減少動態效果時不閃），形狀跟之後出現的東西一樣 */
export function Skeleton({ width = '100%', height, style }: { width?: number | string; height: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

/**
 * 國家側欄的程式還在下載時的樣子：國名、年份、四張數值卡片、一張折線圖。
 * 原本只寫「載入中…」，側欄打開時先是一行字，再整個跳出來
 */
export function PanelSkeleton() {
  const t = useT();
  return (
    <>
      <span className="visually-hidden">{t.loading}</span>
      <div className="skeleton-panel">
        <Skeleton width="45%" height={24} />
        <Skeleton width="30%" height={13} />
        <Skeleton width="18%" height={13} style={{ marginTop: 12 }} />
        <div className="stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="stat">
              <Skeleton width="70%" height={11} />
              <Skeleton width="55%" height={22} />
              <Skeleton width="40%" height={10} />
            </div>
          ))}
        </div>
        <Skeleton width="50%" height={15} style={{ marginTop: 16 }} />
        <Skeleton height={220} />
      </div>
    </>
  );
}

/** 主題自己的側欄區塊（panelExtra）還在下載時：一個小標題加一塊內容 */
export function SectionSkeleton() {
  const t = useT();
  return (
    <div className="panel-section skeleton-panel" aria-busy="true">
      <span className="visually-hidden">{t.loading}</span>
      <Skeleton width="40%" height={15} />
      <Skeleton height={120} />
    </div>
  );
}
