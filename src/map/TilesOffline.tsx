import { StatusCard } from '../controls/StatusCard';
import { useT } from '../i18n';
import { useOnline } from '../lib/useOnline';

/**
 * 離線時用 PMTiles 的圖層看不到（map/pmtiles.ts：service worker 不存 .pmtiles）：照 StatusCard 的樣子說明。
 * what 是圖層的名稱，例如「放大後的精細國界」；在線上時不顯示
 */
export function TilesOffline({ what }: { what: string }) {
  const online = useOnline();
  const t = useT();
  if (online) return null;
  return <StatusCard kind="offline" title={t.tilesOfflineTitle(what)} detail={t.tilesOfflineHint} />;
}
