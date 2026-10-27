import type { ReactNode } from 'react';

/**
 * 地圖右上角按鈕的圖示：同一套 18 px、1.6 px 線條、圓角端點，跟框選、指北針的 SVG 一致。
 * 文字說明在按鈕的 aria-label 與 title（滑過時顯示）。頂列的深淺色切換、側欄與對話框的關閉也用這一套。
 */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 18 18" width={size} height={size} aria-hidden="true" {...STROKE}>
      {children}
    </svg>
  );
}

export const PlusIcon = () => (
  <Icon>
    <path d="M9 4v10M4 9h10" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M4 9h10" />
  </Icon>
);

/** 回到全球：準星 */
export const ResetIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="5" />
    <path d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3" />
  </Icon>
);

/** 現在是地球儀，按了換成平面：攤開的地圖 */
export const FlatIcon = () => (
  <Icon>
    <path d="M2.5 4.5 6.5 3l5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5Z" />
    <path d="M6.5 3v10.5M11.5 4.5V15" />
  </Icon>
);

/** 現在是平面，按了換成地球儀 */
export const GlobeIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="6.5" />
    <path d="M2.5 9h13M9 2.5c-2.2 2.4-2.2 10.6 0 13M9 2.5c2.2 2.4 2.2 10.6 0 13" />
  </Icon>
);

export const FullscreenIcon = () => (
  <Icon>
    <path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" />
  </Icon>
);

export const ExitFullscreenIcon = () => (
  <Icon>
    <path d="M7 3v4H3M15 7h-4V3M11 15v-4h4M3 11h4v4" />
  </Icon>
);

/** 底圖：疊起來的圖層 */
export const LayersIcon = () => (
  <Icon>
    <path d="m9 2.5 6.5 3.5L9 9.5 2.5 6Z" />
    <path d="m2.5 9.25 6.5 3.5 6.5-3.5M2.5 12.5 9 16l6.5-3.5" />
  </Icon>
);

/** 更多（手機上收起 3D、全螢幕、框選的選單） */
export const MoreIcon = () => (
  <Icon>
    <circle cx="4" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="14" cy="9" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

/** 換成淺色介面 */
export const SunIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="3.2" />
    <path d="M9 1.8v1.7M9 14.5v1.7M1.8 9h1.7M14.5 9h1.7M3.9 3.9l1.2 1.2M12.9 12.9l1.2 1.2M3.9 14.1l1.2-1.2M12.9 5.1l1.2-1.2" />
  </Icon>
);

/** 換成深色介面 */
export const MoonIcon = () => (
  <Icon>
    <path d="M15 11.2A6.5 6.5 0 0 1 6.8 3a6.5 6.5 0 1 0 8.2 8.2Z" />
  </Icon>
);

export const CloseIcon = ({ size = 18 }: { size?: number }) => (
  <Icon size={size}>
    <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" />
  </Icon>
);
