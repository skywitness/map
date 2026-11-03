/**
 * 點陣圖磚的疊加圖層（2026-11-03，製作手冊第十七批 280；TopicDefinition.overlays 的 kind 'tiles'）：
 * 別人的圖磚伺服器（中研院臺灣百年歷史地圖的舊地圖、舊航照、日治行政區界），畫在國家的面上面、國界下面
 * （跟類別網格同一個位置，`data-border` 前面），地名、疊加圖層的點與線都在它上面。
 * 圖層開著、時間軸在 years 裡面才加上 source；關掉時拿掉，伺服器不會再收到請求。
 */
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { TilesOverlay } from '../topics/types';

const PREFIX = 'tiles-';
const BEFORE = 'data-border';

/** 依目前要畫的圖層加上、拿掉圖磚圖層（其他主題留下的一併拿掉） */
export function syncTilesOverlays(map: MaplibreMap, shown: TilesOverlay[]): void {
  const want = new Set(shown.map((d) => PREFIX + d.id));
  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith(PREFIX) && !want.has(layer.id)) {
      map.removeLayer(layer.id);
      if (map.getSource(layer.id)) map.removeSource(layer.id);
    }
  }
  for (const def of shown) {
    const id = PREFIX + def.id;
    if (map.getLayer(id)) continue;
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: 'raster',
        tiles: [def.url],
        tileSize: 256,
        minzoom: def.minzoom ?? 0,
        maxzoom: def.maxzoom,
        ...(def.bounds ? { bounds: def.bounds } : {}),
        attribution: def.attribution,
      });
    }
    map.addLayer(
      { id, type: 'raster', source: id, paint: { 'raster-opacity': def.opacity ?? 0.85, 'raster-fade-duration': 150 } },
      map.getLayer(BEFORE) ? BEFORE : undefined,
    );
  }
}
