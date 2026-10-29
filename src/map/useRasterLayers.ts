/**
 * 點陣圖磚的圖層（WorldMap.tsx，2026-10-29 拆出來）：網格（人口密度、暖化…）與它的夜色底、國旗地圖與小國的小國旗。
 */
import { useEffect, useMemo, useRef } from 'react';
import type { GeoJSONSource, RasterTileSource } from 'maplibre-gl';
import type { CountryFeature } from './geometry';
import { gridTiles, type GridLayer } from './densityGrid';
import { flagIcon, flagTileUrl, setFlagLayout, type FlagSpec } from './flagTiles';
import {
  FLAG_LAYER,
  FLAG_OPACITY,
  FLAG_TINY,
  GRID_BACKDROP,
  GRID_LAYER,
  GRID_OPACITY,
  backdropBand,
  escapeHtml,
} from './worldMapLayers';
import type { MapContext } from './useCountryFills';

/** 回傳網格圖磚的網址（沒有網格時是 null，WorldMap 的 3D、量測也要用）與網格的夜色底（國界改用淺色） */
export function useRasterLayers(
  { mapRef, installedRef, ready, revision }: MapContext,
  {
    grid,
    flags,
    flagsOn,
    countries,
    tinyCollection,
  }: {
    grid: GridLayer | null | undefined;
    flags: Map<string, FlagSpec> | null | undefined;
    flagsOn: boolean;
    countries: CountryFeature[];
    tinyCollection: GeoJSON.FeatureCollection;
  },
): { gridUrl: string | null; backdrop: { south: number; north: number; color: string } | null } {
  // 網格：點陣圖磚插在國家的顏色（data-fill，網格模式時透明）下面，國界與選取外框畫在網格上面。
  // 換期時只換圖磚網址；換成另一個網格（圖磚大小、級數、來源不同）時整個重建；
  // 切換底圖後新樣式沒有這個圖層，revision 變了會重新加上
  const gridUrl = grid ? gridTiles(grid) : null;
  const gridMeta = grid?.meta ?? null;
  const gridSourceKey = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    let source = map.getSource<RasterTileSource>(GRID_LAYER);
    if (!gridUrl || !gridMeta) {
      if (source) map.setLayoutProperty(GRID_LAYER, 'visibility', 'none');
      return;
    }
    const attribution = gridMeta.attribution
      ? `<a href="${gridMeta.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(gridMeta.attribution)}</a>`
      : `<a href="${gridMeta.sourceUrl}" target="_blank" rel="noreferrer">GHS-POP</a> © European Commission JRC`;
    const key = `${attribution}|${gridMeta.tileSize}|${gridMeta.maxzoom}`;
    if (source && gridSourceKey.current !== key) {
      map.removeLayer(GRID_LAYER);
      map.removeSource(GRID_LAYER);
      source = undefined;
    }
    if (!source) {
      gridSourceKey.current = key;
      map.addSource(GRID_LAYER, {
        type: 'raster',
        tiles: [gridUrl],
        tileSize: gridMeta.tileSize,
        maxzoom: gridMeta.maxzoom,
        attribution,
      });
      map.addLayer(
        {
          id: GRID_LAYER,
          type: 'raster',
          source: GRID_LAYER,
          paint: {
            'raster-opacity': GRID_OPACITY,
            // 放大超過圖磚的級數時格子維持方塊；線性內插會把相鄰兩級混成圖例上沒有的顏色
            'raster-resampling': 'nearest',
            'raster-fade-duration': 0,
          },
        },
        'data-fill',
      );
    } else if (source.tiles[0] !== gridUrl) {
      source.setTiles([gridUrl]);
    }
    map.setLayoutProperty(GRID_LAYER, 'visibility', 'visible');
  }, [revision, gridUrl, gridMeta]);

  // 夜色底：網格有 backdrop 時（夜間燈光），在資料範圍鋪一層第一級的顏色，彩色地形底圖上也是夜景；
  // 不透明度跟網格一樣（圖例的色塊才對得上），放大後一起變淡，看得到底圖的街道
  const backdrop = gridUrl && gridMeta?.backdrop ? { ...gridMeta.backdrop, color: gridMeta.colors[0] } : null;
  const backdropKey = backdrop ? `${backdrop.south}|${backdrop.north}|${backdrop.color}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const layer = map.getLayer(GRID_BACKDROP);
    if (!backdrop) {
      if (layer) map.setLayoutProperty(GRID_BACKDROP, 'visibility', 'none');
      return;
    }
    const data = backdropBand(backdrop.south, backdrop.north);
    const source = map.getSource<GeoJSONSource>(GRID_BACKDROP);
    if (source) source.setData(data);
    else map.addSource(GRID_BACKDROP, { type: 'geojson', data });
    if (!layer) {
      map.addLayer(
        { id: GRID_BACKDROP, type: 'fill', source: GRID_BACKDROP, paint: { 'fill-color': backdrop.color, 'fill-opacity': GRID_OPACITY } },
        GRID_LAYER,
      );
    } else {
      map.setPaintProperty(GRID_BACKDROP, 'fill-color', backdrop.color);
    }
    map.setLayoutProperty(GRID_BACKDROP, 'visibility', 'visible');
    // 依賴寫 backdropKey（backdrop 的內容），每次 render 新建的物件不會觸發重跑
  }, [revision, backdropKey]);

  // 國旗地圖：國界或國旗換了就重算每面旗畫在哪裡（flagTiles.ts），版本號換了圖磚的網址也跟著換。
  // 點陣圖層插在 data-fill（透明，只給 hover、點選用）下面，國界與選取外框畫在國旗上面
  const flagVersion = useMemo(() => (flags && countries.length ? setFlagLayout(countries, flags) : 0), [flags, countries]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const source = map.getSource<RasterTileSource>(FLAG_LAYER);
    if (!flagsOn || !flagVersion) {
      if (map.getLayer(FLAG_LAYER)) map.setLayoutProperty(FLAG_LAYER, 'visibility', 'none');
      return;
    }
    const url = flagTileUrl(flagVersion);
    if (!source) {
      map.addSource(FLAG_LAYER, {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        // 再放大就把 9 級的圖磚放大來用：國旗放大後本來就變淡，不必每一級重畫
        maxzoom: 9,
        attribution: '<a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia Commons</a>',
      });
      map.addLayer(
        { id: FLAG_LAYER, type: 'raster', source: FLAG_LAYER, paint: { 'raster-opacity': FLAG_OPACITY, 'raster-fade-duration': 120 } },
        'data-fill',
      );
    } else if (source.tiles[0] !== url) {
      source.setTiles([url]);
    }
    map.setLayoutProperty(FLAG_LAYER, 'visibility', 'visible');
  }, [revision, flagsOn, flagVersion]);

  // 小國的小國旗：圖示畫好才加進篩選（還沒有圖示的不畫，MapLibre 才不會警告找不到圖）。
  // 換底圖後新樣式沒有這些圖示，revision 變了會重新加上
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setLayoutProperty(FLAG_TINY, 'visibility', flagsOn && flags ? 'visible' : 'none');
    if (!flagsOn || !flags) return;
    let cancelled = false;
    const ratio = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    const wanted = tinyCollection.features.map((f) => String(f.properties?.iso3)).filter((iso3) => flags.has(iso3));
    const added = wanted.map(async (iso3) => {
      const id = `flag-${iso3}`;
      if (!map.hasImage(id)) {
        const image = await flagIcon(flags.get(iso3)!, ratio);
        if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: ratio });
      }
      return iso3;
    });
    Promise.all(added.map((p) => p.catch(() => null))).then((done) => {
      if (cancelled || !map.getLayer(FLAG_TINY)) return;
      map.setFilter(FLAG_TINY, ['in', ['get', 'iso3'], ['literal', done.filter((x): x is string => x !== null)]]);
    });
    return () => {
      cancelled = true;
    };
  }, [revision, flagsOn, flags, tinyCollection]);
  return { gridUrl, backdrop };
}
