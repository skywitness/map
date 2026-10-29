import type { ReactNode } from 'react';
import { UI_ICONS } from '../topics/groupIcons.gen';
import { Glyph } from './TopicIcon';

interface StatusCardProps {
  /** 錯誤（紅）、離線、沒有資料（灰）：決定圖示與顏色 */
  kind: 'error' | 'offline' | 'empty';
  title: string;
  /** 第二行的說明（技術細節、怎麼辦） */
  detail?: ReactNode;
  /** 按鈕（重試、重新整理） */
  action?: { label: string; onClick: () => void };
  /** 蓋在地圖中間（有底色、陰影）；不給是側欄裡的一般區塊 */
  overlay?: boolean;
}

/**
 * 各種狀態的畫面（2026-10-29）：資料載入失敗、離線而這個主題還沒存到裝置、底圖失敗、側欄沒有資料，
 * 用同一個樣子：圓底的線條圖示（Lucide，groupIcons.gen.ts 的 UI_ICONS）、一句標題、一句說明、需要時一顆按鈕。
 * 錯誤用 role="alert"（螢幕閱讀器馬上唸），其他用 role="status"。
 */
export function StatusCard({ kind, title, detail, action, overlay }: StatusCardProps) {
  return (
    <div className={`status-card is-${kind}${overlay ? ' is-overlay' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="status-icon" aria-hidden="true">
        <Glyph d={UI_ICONS[kind]} size={overlay ? 22 : 18} />
      </span>
      <div className="status-text">
        <p className="status-title">{title}</p>
        {detail && <p className="status-detail">{detail}</p>}
        {action && (
          <button type="button" className="status-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
