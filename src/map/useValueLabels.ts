/**
 * 地圖上標數值（2026-10-30）：開關在地圖右邊的工具列（手機在「更多」裡），網址 vals=1。
 * 只標上色或比例圓的指標；縮小時排不下的國家 MapLibre 自己略過（大國先排）
 */
import { useEffect, useMemo } from 'react';
import { geoArea } from 'd3-geo';
import type { GeoJSONSource } from 'maplibre-gl';
import type { Indicator } from '../topics/types';
import type { CountryFeature } from './geometry';
import type { MapContext } from './useCountryFills';
import { VALUE_SOURCE } from './worldMapLayers';

export function useValueLabels(
  { mapRef, installedRef, ready, revision }: MapContext,
  {
    on,
    countries,
    anchors,
    values,
    indicator,
    year,
    height = null,
  }: {
    /** 3D 時每個國家立起來的高度（比例與最高的公尺數），數字浮在上面；平面時 null */
    height?: ((iso3: string, v: number) => { f: number; max: number }) | null;
    on: boolean;
    countries: CountryFeature[];
    anchors: Map<string, [number, number]>;
    values: Map<string, number>;
    indicator: Indicator;
    year: number;
  },
): void {
  // 排的順序：面積大的先（沒有形狀的小國排最後）
  const order = useMemo(() => {
    const ranked = [...countries].sort((a, b) => geoArea(b.feature) - geoArea(a.feature));
    return new Map(ranked.map((c, i) => [c.iso3, i]));
  }, [countries]);
  const kind = indicator.layer.kind;
  const custom = indicator.mapLabels;
  const shown = (on || Boolean(custom?.always)) && (kind === 'choropleth' || kind === 'bubble' || kind === 'categorical');

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current || !map.getLayer(VALUE_SOURCE)) return;
    map.setLayoutProperty(VALUE_SOURCE, 'visibility', shown ? 'visible' : 'none');
    const short = indicator.formatTick ?? ((v: number) => indicator.format(v, year));
    const features: GeoJSON.Feature[] = shown
      ? [...values].flatMap(([iso3, v]) => {
          const at = anchors.get(iso3);
          const text = custom ? custom.text(v, iso3) : short(v);
          return at && text
            ? [
                {
                  type: 'Feature',
                  properties: { text, order: order.get(iso3) ?? 9999, ...(height ? { hf: height(iso3, v).f, hm: height(iso3, v).max } : {}) },
                  geometry: { type: 'Point', coordinates: at },
                },
              ]
            : [];
        })
      : [];
    (map.getSource(VALUE_SOURCE) as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [revision, ready, shown, values, anchors, order, indicator, year, height]);
}
