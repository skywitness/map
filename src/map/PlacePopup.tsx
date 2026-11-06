import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDismiss } from '../controls/useDismiss';
import { useT } from '../i18n';
import { googleMapsUrl } from './googleMaps';
import { placeBox } from './MapTooltip';
import type { MapPlace } from './mapEvents';

/**
 * 右鍵（觸控長按）地圖跳出的小卡片（2026-10-30，mapEvents.ts 的 openPlace）：那個位置的地名（點圖層的點，
 * 或底下的國家）與經緯度，「在 Google 地圖開啟」開新分頁。點外面、按 Esc、右上角的 ×、移動地圖時關閉。
 * 2026-11-06 起點一下點圖層的點也開這張（滑過的卡片固定下來，文字可以選取、照片可以點開）
 */
export function PlacePopup({
  place,
  name,
  width,
  height,
  onClose,
}: {
  place: MapPlace;
  /** 點的 tooltip 內容或國家名稱；海上沒有 */
  name: ReactNode;
  width: number;
  height: number;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const inside = useMemo(() => [ref], []);
  useDismiss(true, onClose, inside);
  // 靠近右邊、下面時往左、往上開，不超出地圖；依實際的大小判斷（有照片的卡片高約 330 px），量到之前用預估的
  const [size, setSize] = useState<[number, number]>([260, 150]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next: [number, number] = [el.offsetWidth, el.offsetHeight];
    if (next[0] !== size[0] || next[1] !== size[1]) setSize(next);
  });
  const { left, top } = placeBox(place.x, place.y, size, width, height, 8);
  return (
    <div
      ref={ref}
      className="map-place"
      role="dialog"
      aria-label={t.placeTitle}
      style={{ left, top }}
    >
      <button type="button" className="icon-button map-place-close" onClick={onClose} aria-label={t.close} title={t.close}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {name}
      <div className="map-place-coords">{t.coordinates(place.lat, place.lng)}</div>
      <a
        className="map-place-link"
        href={googleMapsUrl(place.lat, place.lng)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
      >
        {t.openInGoogleMaps}
        <span aria-hidden="true"> ↗</span>
      </a>
    </div>
  );
}
