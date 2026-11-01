import type { ReactNode } from 'react';
import { useT } from '../i18n';
import type { LayoutPrefs } from '../lib/layoutPrefs';

/**
 * 地圖右下角、出處（ⓘ）左邊的小圓鈕（2026-11-01，使用者要求）：寬螢幕的地圖檢視裡，時間軸、資料來源（含說明、
 * 國界聲明與「關於這個網站」）放在地圖下方的卡片（App.tsx 的 .map-dock），這兩顆分別開關它們（預設都開；
 * 原本國界聲明另外一顆，使用者要合成一顆）。跟頂列的「版面」選單是同一份偏好（lib/layoutPrefs.ts），記在這台裝置。
 * 沒有時間軸的主題不放時間軸那一顆
 */
export function MapDockToggles({
  prefs,
  hasTime,
  onChange,
}: {
  prefs: LayoutPrefs;
  hasTime: boolean;
  onChange: (patch: Partial<LayoutPrefs>) => void;
}) {
  const t = useT();
  const items: { key: 'time' | 'sources'; label: string; on: string; off: string; icon: ReactNode }[] = [
    ...(hasTime
      ? [
          {
            key: 'time' as const,
            label: t.layoutTime,
            on: t.hideTime,
            off: t.showTime,
            // 拉桿：一條線上一顆圓
            icon: (
              <>
                <path d="M2 8h12" />
                <circle cx="10" cy="8" r="2.2" fill="currentColor" stroke="none" />
              </>
            ),
          },
        ]
      : []),
    {
      key: 'sources',
      label: t.layoutSources,
      on: t.hideSources,
      off: t.showSources,
      // 一頁文件
      icon: <path d="M4 2.5h5.5L12 5v8.5H4zM6 7.5h4M6 10h4" />,
    },
  ];
  return (
    <div className="map-dock-toggles" role="group" aria-label={t.mapDockToggles}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="map-dock-toggle"
          aria-pressed={prefs[item.key]}
          aria-label={item.label}
          title={prefs[item.key] ? item.on : item.off}
          onClick={() => onChange({ [item.key]: !prefs[item.key] })}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {item.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
