import type { ReactNode } from 'react';
import { useT } from '../i18n';
import type { LayoutPrefs } from '../lib/layoutPrefs';

type DockPartKey = 'time' | 'sources';

/** 圖例同款的箭頭（WorldMap.tsx 的 .map-legend-toggle）：打開時朝下（按了收起），收起時朝上（按了打開） */
function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path d={up ? 'M3 7.5 6 4.5 9 7.5' : 'M3 4.5 6 7.5 9 4.5'} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function useDockLabels(): Record<DockPartKey, { name: string; hide: string; show: string }> {
  const t = useT();
  return {
    time: { name: t.dockTime, hide: t.hideTime, show: t.showTime },
    sources: { name: t.dockSources, hide: t.hideSources, show: t.showSources },
  };
}

/**
 * 地圖下方卡片（App.tsx 的 .map-dock）裡的一段：時間軸或資料來源（2026-11-10，使用者要求「如同圖例一樣加按鈕可以按下來直接收起」）。
 * 右上角一顆跟圖例一樣的小圓鈕（一半在卡片或分隔線外），按了就收起這一段；收起後在卡片左上角（兩段都收起時在原位）
 * 變成一顆「時間軸 ˄」「資料來源 ˄」（MapDockPills）。跟 ⓘ 左邊的開關、頂列的「版面」選單是同一份偏好。
 * 收起時這一段只是 hidden，時間軸照樣掛著（← → 換年份、空白鍵播放照樣能用）。嵌入模式不放鈕（嵌入照樣都顯示）
 */
export function DockPart({
  part,
  open,
  collapsible,
  onHide,
  children,
}: {
  part: DockPartKey;
  open: boolean;
  collapsible: boolean;
  onHide: () => void;
  children: ReactNode;
}) {
  const label = useDockLabels()[part];
  return (
    <div className={`map-dock-part is-${part}`} hidden={!open}>
      {collapsible && (
        <button type="button" className="map-legend-toggle" aria-expanded={true} aria-label={label.hide} title={label.hide} onClick={onHide}>
          <Chevron up={false} />
        </button>
      )}
      {children}
    </div>
  );
}

/** 收起來的時間軸、資料來源：圖例收起時那樣的一顆「名稱 ˄」，按了打開（DockPart 的說明） */
export function MapDockPills({
  prefs,
  hasTime,
  onChange,
}: {
  prefs: LayoutPrefs;
  hasTime: boolean;
  onChange: (patch: Partial<LayoutPrefs>) => void;
}) {
  const t = useT();
  const labels = useDockLabels();
  const closed: DockPartKey[] = [...(hasTime && !prefs.time ? (['time'] as const) : []), ...(!prefs.sources ? (['sources'] as const) : [])];
  if (!closed.length) return null;
  return (
    <div className="map-dock-pills" role="group" aria-label={t.mapDockToggles}>
      {closed.map((part) => (
        <button
          key={part}
          type="button"
          className="map-legend-toggle"
          aria-expanded={false}
          aria-label={labels[part].show}
          title={labels[part].show}
          onClick={() => onChange({ [part]: true })}
        >
          <span>{labels[part].name}</span>
          <Chevron up />
        </button>
      ))}
    </div>
  );
}

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
