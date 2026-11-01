/**
 * 那一天的衛星照片（2026-11-01，MapLibre 範例「Add a WMS source」「Add a raster tile source」的做法；主題的 satellite）：
 * NASA GIBS 的 MODIS Terra 每日真彩影像（Web Mercator 的 GoogleMapsCompatible_Level9，JPEG，2000-02-24 起每天一張，
 * 不收費、不需金鑰、可以跨網域讀取），畫在資料圖層下面、底圖上面；換日期時換圖磚網址（setTiles）。
 */
import type { Map as MaplibreMap, RasterTileSource } from 'maplibre-gl';
import { GIBS_ATTRIBUTION } from './style';

export const SATELLITE_DAY = 'satellite-day';
const FIRST_DAY = '2000-02-24';

const tilesFor = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

/** GIBS 有影像的日子（2000-02-24 到今天；格式要是 YYYY-MM-DD） */
export function validDay(date: string | null, today = new Date().toISOString().slice(0, 10)): string | null {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= FIRST_DAY && date <= today ? date : null;
}

/** 依日期加上、換掉或藏起影像；before 是要插在哪個圖層前面（資料圖層的第一層） */
export function syncSatelliteDay(map: MaplibreMap, date: string | null, before?: string): void {
  const source = map.getSource(SATELLITE_DAY) as RasterTileSource | undefined;
  if (!date) {
    if (map.getLayer(SATELLITE_DAY)) map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'none');
    return;
  }
  if (!source) {
    map.addSource(SATELLITE_DAY, { type: 'raster', tiles: [tilesFor(date)], tileSize: 256, maxzoom: 9, attribution: GIBS_ATTRIBUTION });
    map.addLayer(
      { id: SATELLITE_DAY, type: 'raster', source: SATELLITE_DAY, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 200 } },
      before && map.getLayer(before) ? before : undefined,
    );
    return;
  }
  if (source.tiles?.[0] !== tilesFor(date)) source.setTiles([tilesFor(date)]);
  map.setLayoutProperty(SATELLITE_DAY, 'visibility', 'visible');
}
