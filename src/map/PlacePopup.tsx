import { useMemo, useRef, type ReactNode } from 'react';
import { useDismiss } from '../controls/useDismiss';
import { useT } from '../i18n';
import { googleMapsUrl } from './googleMaps';
import type { MapPlace } from './mapEvents';

/**
 * 右鍵（觸控長按）地圖跳出的小卡片（2026-10-30，mapEvents.ts 的 openPlace）：那個位置的地名（點圖層的點，
 * 或底下的國家）與經緯度，「在 Google 地圖開啟」開新分頁。點外面、按 Esc、移動地圖時關閉
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
  // 靠近右邊、下面時往左、往上開，不超出地圖
  const flipX = place.x > width - 260;
  const flipY = place.y > height - 150;
  return (
    <div
      ref={ref}
      className="map-place"
      role="dialog"
      aria-label={t.placeTitle}
      style={{
        left: place.x + (flipX ? -8 : 8),
        top: place.y + (flipY ? -8 : 8),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
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
