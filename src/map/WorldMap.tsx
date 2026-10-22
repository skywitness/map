/**
 * 地圖引擎：MapLibre GL（WebGL 向量地圖），底圖用 OpenFreeMap 的 Liberty 樣式
 * （低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節），預設地球儀。
 *
 * 資料圖層都插在底圖的文字標籤下面，地名永遠看得到：
 * - 面量圖：國界多邊形，顏色放在 feature-state，換年份時不必重送幾何
 * - 比例圓、小國圓點、鐵路、機場、框選範圍
 * 國家用 ISO alpha-3 當 feature id（promoteId）。
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Map as MaplibreMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type MapTouchEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { geoArea, geoDistance } from 'd3-geo';
import type { AirportsData, IndicatorDef } from '../topics/types';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
import { boxFromCorners, boxPolygon, type Box } from './boxEstimate';
import type { CountryFeature } from './geometry';
import { BubbleLegend, ChoroplethLegend } from './Legend';
import { DEFAULT_LAYERS, LayerControls, type LayerVisibility } from './Overlays';
import { bubbleScale, choroplethScale } from './scales';
import { useElementSize } from './useElementSize';

interface WorldMapProps {
  countries: CountryFeature[];
  indicator: IndicatorDef;
  /** 圖例標題，例如「稻米產量」 */
  legendTitle: string;
  /** 目前年份的數值，只放有資料的國家 */
  values: Map<string, number>;
  /** 比例圓用：所有年份中的最大值 */
  bubbleMax: number;
  /** 介面的配色（圖例、tooltip）；地圖上的資料色固定用淺色版，因為底圖一直是明亮的 */
  tokens: Tokens;
  selected: string | null;
  onSelect: (iso3: string | null) => void;
  renderTooltip: (iso3: string) => ReactNode;
  ariaLabel: string;
  /** 新資料載入中，先調淡舊畫面 */
  dimmed?: boolean;
  /** 框選範圍（經緯度）；有傳 onBoxChange 才會出現框選工具 */
  box?: Box | null;
  onBoxChange?: (box: Box | null) => void;
  boxToolLabel?: string;
  /** 疊在地圖右上角的內容，例如框選結果 */
  overlay?: ReactNode;
  /** 疊加圖層：鐵路（經緯度 MultiLineString）與機場 */
  railways?: GeoJSON.MultiLineString | null;
  airports?: AirportsData | null;
  layers?: LayerVisibility;
  onLayersChange?: (layers: LayerVisibility) => void;
  renderAirportTooltip?: (index: number) => ReactNode;
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const INITIAL_CENTER: [number, number] = [105, 22];

/** 讓地球儀的直徑大約等於地圖高度（MapLibre 的地球半徑約為 512·2^z / 2π 的 0.85 倍） */
function fitGlobeZoom(height: number): number {
  return Math.log2((0.5 * height * 2 * Math.PI) / 512 / 0.85);
}
const MAX_ZOOM = 18;
/** 面積小於這個值（km²）的國家在低縮放時另外畫一個點，才看得到也點得到 */
const TINY_KM2 = 6000;
const EARTH_RADIUS_KM = 6371.0088;
const NO_DATA = '#c9c7c0';
/** 拖曳距離小於這個值（px）視為點一下，不建立框 */
const MIN_BOX_PX = 6;

/** 有些地名寫成「肯亞;肯尼亞」「巴布亞新幾內亞 / 巴布亞紐幾內亞」，只取第一個 */
function firstName(expr: ExpressionSpecification, separator: string): ExpressionSpecification {
  return ['case', ['in', separator, expr], ['slice', expr, 0, ['index-of', separator, expr]], expr];
}

// 底圖地名改成繁體中文，沒有中文名稱的才用原文
const ZH_HANT: ExpressionSpecification = ['to-string', ['get', 'name:zh-Hant']];
const ZH_NAME: ExpressionSpecification = [
  'case',
  ['has', 'name:zh-Hant'],
  firstName(firstName(firstName(ZH_HANT, ';'), ' / '), '/'),
  ['coalesce', ['get', 'name:zh'], ['get', 'name']],
];

/** 下載 Liberty 樣式，改成中文地名、地球儀投影、黑色太空背景 */
async function loadBaseStyle(): Promise<StyleSpecification> {
  const style = (await fetch(STYLE_URL).then((r) => r.json())) as StyleSpecification;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const field = layer.layout?.['text-field'];
    if (field && JSON.stringify(field).includes('name')) layer.layout = { ...layer.layout, 'text-field': ZH_NAME };
  }
  style.projection = { type: 'globe' };
  // 黑色太空背景，地球邊緣一圈淡藍色大氣層
  style.sky = {
    'sky-color': '#000000',
    'horizon-color': '#3a6ea5',
    'fog-color': '#3a6ea5',
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.8, 7, 0],
  };
  return style;
}

/** 依縮放調整面量圖的不透明度：放大後讓底圖的道路、地形透出來 */
function fillOpacity(on: number): ExpressionSpecification {
  const state: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false];
  return [
    'interpolate', ['linear'], ['zoom'],
    1, ['case', state, on, 0],
    5, ['case', state, on * 0.8, 0],
    9, ['case', state, on * 0.35, 0],
  ];
}

function dataLayers(): LayerSpecification[] {
  const t = MAP_TOKENS;
  const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
  const tinyOn: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false];
  return [
    {
      id: 'data-fill',
      type: 'fill',
      source: 'countries',
      paint: { 'fill-color': ['coalesce', ['feature-state', 'fill'], NO_DATA], 'fill-opacity': fillOpacity(0.82) },
    },
    {
      id: 'data-highlight',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': t.ink,
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.4, hovered, 1.4, 0],
      },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'railways',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#4a4a46',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 5, 1, 9, 1.6],
        // 放大到 9 級以後底圖本身就有更精細的鐵路，簡化過的線淡出
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.75, 10, 0],
      },
    },
    {
      id: 'data-tiny',
      type: 'circle',
      source: 'tiny',
      maxzoom: 5,
      paint: {
        'circle-radius': 3.5,
        'circle-color': ['coalesce', ['feature-state', 'fill'], NO_DATA],
        'circle-stroke-color': t.inkMuted,
        'circle-stroke-width': 0.75,
        'circle-opacity': ['case', tinyOn, 1, 0],
        'circle-stroke-opacity': ['case', tinyOn, 1, 0],
      },
    },
    {
      id: 'bubbles',
      type: 'circle',
      source: 'bubbles',
      layout: { 'circle-sort-key': ['-', 0, ['get', 'r']] },
      paint: {
        'circle-radius': ['get', 'r'],
        'circle-color': t.accent,
        'circle-opacity': 0.72,
        'circle-stroke-color': ['case', hovered, t.ink, '#ffffff'],
        'circle-stroke-width': ['case', hovered, 1.6, 1],
      },
    },
    {
      id: 'airports-medium',
      type: 'circle',
      source: 'airports',
      filter: ['==', ['get', 'type'], 2],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3, 10, 5],
        'circle-color': t.hues.orange,
        'circle-opacity': 0.85,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.6,
      },
    },
    {
      id: 'airports-large',
      type: 'circle',
      source: 'airports',
      filter: ['==', ['get', 'type'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.6, 6, 4.5, 10, 7],
        'circle-color': t.hues.orange,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.8,
      },
    },
    { id: 'box-fill', type: 'fill', source: 'box', paint: { 'fill-color': t.accent, 'fill-opacity': 0.12 } },
    { id: 'box-line', type: 'line', source: 'box', paint: { 'line-color': t.ink, 'line-width': 1.5 } },
  ];
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * world-atlas 的國界是給 D3 的球面幾何用的，跨 180° 經線的國家（斐濟、俄羅斯遠東）座標會從 179.9 跳到 −179.9。
 * MapLibre 把座標當平面處理，會畫出一條橫越整個地圖的邊，所以把每個 ring 的經度展開成連續的（可以超過 ±180）。
 */
function unwrapAntimeridian(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.MultiPolygon {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((polygon) =>
      polygon.map((ring) => {
        let offset = 0;
        return ring.map(([lon, lat], i) => {
          if (i > 0) {
            const prev = ring[i - 1][0];
            if (lon - prev > 180) offset -= 360;
            else if (prev - lon > 180) offset += 360;
          }
          return [lon + offset, lat];
        });
      }),
    ),
  };
}
/** hover 與點選時依序查詢的圖層（上面的優先） */
const HOVER_LAYERS = ['airports-large', 'airports-medium', 'bubbles', 'data-tiny', 'data-fill'];

export function WorldMap(props: WorldMapProps) {
  const { countries, indicator, values, bubbleMax, tokens, selected, onSelect, renderTooltip, ariaLabel, dimmed } =
    props;
  const { box, onBoxChange, boxToolLabel = '框選', overlay, legendTitle } = props;
  const { railways = null, airports = null, layers = DEFAULT_LAYERS, onLayersChange, renderAirportTooltip } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const size = useElementSize(containerRef);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [globe, setGlobe] = useState(true);
  const [hover, setHover] = useState<{ iso3: string; x: number; y: number; airport?: number } | null>(null);
  const [boxMode, setBoxMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // 框選結果卡片放在框的另一側，才不會蓋住框
  const [overlayOnLeft, setOverlayOnLeft] = useState(false);

  // 地圖事件在建立時綁定一次，最新的 props 放在 ref 裡讀
  const latest = useRef({ onSelect, onBoxChange, boxMode });
  latest.current = { onSelect, onBoxChange, boxMode };

  const colorScale = useMemo(
    () => (indicator.layer.kind === 'choropleth' ? choroplethScale(indicator.layer.scale, MAP_TOKENS) : null),
    [indicator],
  );
  const radius = useMemo(() => bubbleScale(bubbleMax, size?.width ?? 1000), [bubbleMax, size]);

  const countryCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: countries.map((c) => ({
        type: 'Feature',
        properties: { iso3: c.iso3 },
        geometry: unwrapAntimeridian(c.feature.geometry),
      })),
    }),
    [countries],
  );
  const anchors = useMemo(() => new Map(countries.map((c) => [c.iso3, c.anchor])), [countries]);
  const tinyCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: countries
        .filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < TINY_KM2)
        .map((c) => ({ type: 'Feature', properties: { iso3: c.iso3 }, geometry: { type: 'Point', coordinates: c.anchor } })),
    }),
    [countries],
  );

  /* ── 建立地圖（只做一次） ─────────────── */
  useEffect(() => {
    let cancelled = false;
    let map: MaplibreMap | null = null;
    loadBaseStyle()
      .then((style) => {
        if (cancelled || !mapNodeRef.current) return;
        map = new MaplibreMap({
          container: mapNodeRef.current,
          style,
          center: INITIAL_CENTER,
          zoom: fitGlobeZoom(mapNodeRef.current.clientHeight || 500),
          maxZoom: MAX_ZOOM,
          // 預設的版權標示會依寬度自動收合（地圖窄於 640px 時只顯示 ⓘ）
          localIdeographFontFamily: "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif",
          dragRotate: false,
          pitchWithRotate: false,
        });
        mapRef.current = map;
        const m = map;
        // 開發時方便在瀏覽器主控台檢查地圖狀態
        if (import.meta.env.DEV) (window as unknown as { __map?: MaplibreMap }).__map = m;
        m.on('load', () => {
          for (const id of ['countries', 'tiny', 'bubbles']) {
            m.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'iso3' });
          }
          for (const id of ['railways', 'airports', 'box']) m.addSource(id, { type: 'geojson', data: EMPTY });
          const firstLabel = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
          for (const layer of dataLayers()) m.addLayer(layer, firstLabel);
          // 窄螢幕時版權標示預設是展開的，會蓋住地圖下緣；先收合成 ⓘ 按鈕
          m.getContainer().querySelector('.maplibregl-compact')?.classList.remove('maplibregl-compact-show');
          setReady(true);
        });
        bindEvents(m);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const hoverIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ start: [number, number]; startPoint: { x: number; y: number } } | null>(null);
  const suppressClickRef = useRef(false);

  function bindEvents(map: MaplibreMap) {
    const featureAt = (point: { x: number; y: number }): MapGeoJSONFeature | null => {
      for (const id of HOVER_LAYERS) {
        if (!map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none') continue;
        const [f] = map.queryRenderedFeatures([point.x, point.y], { layers: [id] });
        if (f) return f;
      }
      return null;
    };

    const setHoverId = (iso3: string | null) => {
      const prev = hoverIdRef.current;
      if (prev === iso3) return;
      for (const source of ['countries', 'bubbles']) {
        if (prev) map.setFeatureState({ source, id: prev }, { hover: false });
        if (iso3) map.setFeatureState({ source, id: iso3 }, { hover: true });
      }
      hoverIdRef.current = iso3;
    };

    const onMove = (e: MapMouseEvent | MapTouchEvent) => {
      const drag = dragRef.current;
      if (drag) {
        const moved = Math.hypot(e.point.x - drag.startPoint.x, e.point.y - drag.startPoint.y);
        if (moved >= MIN_BOX_PX && Number.isFinite(e.lngLat.lng)) {
          latest.current.onBoxChange?.(boxFromCorners(drag.start, [e.lngLat.lng, e.lngLat.lat]));
        }
        return;
      }
      if (latest.current.boxMode) return;
      const f = featureAt(e.point);
      const iso3 = (f?.properties?.iso3 as string | undefined) ?? null;
      setHoverId(iso3);
      map.getCanvas().style.cursor = iso3 ? 'pointer' : '';
      setHover(
        iso3
          ? {
              iso3,
              x: e.point.x,
              y: e.point.y,
              airport: f?.layer.id.startsWith('airports') ? Number(f.properties.i) : undefined,
            }
          : null,
      );
    };

    const onDown = (e: MapMouseEvent | MapTouchEvent) => {
      if (!latest.current.boxMode || !latest.current.onBoxChange) return;
      e.preventDefault();
      dragRef.current = { start: [e.lngLat.lng, e.lngLat.lat], startPoint: { x: e.point.x, y: e.point.y } };
      setHover(null);
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      // 只擋掉放開滑鼠當下的那一個 click；拖曳過的話 MapLibre 不一定會送 click，所以下一輪就解除
      suppressClickRef.current = true;
      setTimeout(() => (suppressClickRef.current = false), 0);
      setBoxMode(false);
    };

    map.on('mousemove', onMove);
    map.on('touchmove', onMove);
    map.on('mousedown', onDown);
    map.on('touchstart', onDown);
    map.on('mouseup', onUp);
    map.on('touchend', onUp);
    map.on('mouseout', () => {
      setHoverId(null);
      setHover(null);
    });
    map.on('click', (e) => {
      if (suppressClickRef.current || latest.current.boxMode) {
        suppressClickRef.current = false;
        return;
      }
      latest.current.onSelect((featureAt(e.point)?.properties?.iso3 as string | undefined) ?? null);
    });
  }

  /* ── 資料 → 地圖 ─────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('countries') as GeoJSONSource).setData(countryCollection);
    (map.getSource('tiny') as GeoJSONSource).setData(tinyCollection);
  }, [ready, countryCollection, tinyCollection]);

  // 面量圖顏色放在 feature-state，換年份時只改狀態，不重送幾何
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const on = indicator.layer.kind === 'choropleth';
    for (const c of countries) {
      const v = values.get(c.iso3);
      const fill = on && v !== undefined && colorScale ? colorScale(v) : NO_DATA;
      map.setFeatureState({ source: 'countries', id: c.iso3 }, { fill, on });
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { fill, on: on && v !== undefined });
    }
  }, [ready, countries, values, colorScale, indicator.layer.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const features: GeoJSON.Feature[] =
      indicator.layer.kind === 'bubble'
        ? [...values]
            .filter(([iso3, v]) => v > 0 && anchors.has(iso3))
            .map(([iso3, v]) => ({
              type: 'Feature',
              properties: { iso3, r: radius(v) },
              geometry: { type: 'Point', coordinates: anchors.get(iso3)! },
            }))
        : [];
    (map.getSource('bubbles') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [ready, values, radius, anchors, indicator.layer.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('railways') as GeoJSONSource).setData(
      railways ? { type: 'Feature', properties: {}, geometry: railways } : EMPTY,
    );
  }, [ready, railways]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const features: GeoJSON.Feature[] = (airports?.rows ?? []).map((row, i) => ({
      type: 'Feature',
      properties: { i, type: row[2], iso3: row[6] },
      geometry: { type: 'Point', coordinates: [row[0], row[1]] },
    }));
    (map.getSource('airports') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [ready, airports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('rail', Boolean(railways) && layers.railways);
    show('airports-large', Boolean(airports) && layers.largeAirports);
    show('airports-medium', Boolean(airports) && layers.mediumAirports);
  }, [ready, railways, airports, layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource('box') as GeoJSONSource).setData(
      box ? { type: 'Feature', properties: {}, geometry: boxPolygon(box) } : EMPTY,
    );
    if (!box) return;
    const place = () => {
      const [w, s, e, n] = box;
      const center = map.project([w <= e ? (w + e) / 2 : (w + e + 360) / 2, (s + n) / 2]);
      setOverlayOnLeft(center.x > map.getCanvas().clientWidth / 2);
    };
    place();
    map.on('moveend', place);
    return () => {
      map.off('moveend', place);
    };
  }, [ready, box]);

  // 選取的國家加粗外框；不在畫面上時（例如從搜尋或排名表選）把地圖轉過去
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (selectedRef.current) map.setFeatureState({ source: 'countries', id: selectedRef.current }, { selected: false });
    if (selected) map.setFeatureState({ source: 'countries', id: selected }, { selected: true });
    selectedRef.current = selected;
    const anchor = selected ? anchors.get(selected) : undefined;
    if (!anchor) return;
    const center = map.getCenter();
    const p = map.project(anchor);
    const canvas = map.getCanvas();
    const offScreen = p.x < 0 || p.y < 0 || p.x > canvas.clientWidth || p.y > canvas.clientHeight;
    const behindGlobe = globe && geoDistance([center.lng, center.lat], anchor) > Math.PI / 2.4;
    if (offScreen || behindGlobe) map.easeTo({ center: anchor, zoom: Math.max(map.getZoom(), 2.5), duration: 800 });
  }, [ready, selected, anchors, globe]);

  // 框選模式：拖曳用來畫框，不平移地圖
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (boxMode) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.getCanvas().style.cursor = 'crosshair';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          dragRef.current = null;
          setBoxMode(false);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    map.getCanvas().style.cursor = '';
  }, [ready, boxMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.setProjection({ type: globe ? 'globe' : 'mercator' });
  }, [ready, globe]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  const hasOverlays = Boolean(railways || airports);

  return (
    <div
      ref={containerRef}
      className={`map${dimmed ? ' is-dimmed' : ''}${boxMode ? ' is-box-mode' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
    >
      <div ref={mapNodeRef} className="map-canvas" role="img" aria-label={ariaLabel} />
      {failed && <p className="error map-error">底圖載入失敗，請檢查網路連線後重新整理。</p>}

      <div className="map-zoom" role="group" aria-label="地圖控制">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="放大" title="放大">
          +
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="縮小" title="縮小">
          −
        </button>
        <button
          type="button"
          onClick={() =>
            mapRef.current?.easeTo({
              center: INITIAL_CENTER,
              zoom: fitGlobeZoom(mapRef.current.getContainer().clientHeight),
              duration: 800,
            })
          }
          aria-label="回到全球"
          title="回到全球"
        >
          ⟲
        </button>
        <button
          type="button"
          className="map-text-button"
          onClick={() => setGlobe((g) => !g)}
          aria-label={globe ? '切換成平面地圖' : '切換成地球儀'}
          title={globe ? '切換成平面地圖' : '切換成地球儀'}
        >
          {globe ? '平面' : '球'}
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? '離開全螢幕' : '全螢幕'}
          title={fullscreen ? '離開全螢幕' : '全螢幕'}
        >
          {fullscreen ? '⤡' : '⤢'}
        </button>
        {onBoxChange && (
          <button
            type="button"
            className={`box-tool${boxMode ? ' is-active' : ''}`}
            onClick={() => setBoxMode((m) => !m)}
            aria-pressed={boxMode}
            aria-label={boxToolLabel}
            title={boxMode ? '在地圖上拖曳畫框（Esc 取消）' : boxToolLabel}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
            </svg>
          </button>
        )}
      </div>

      {boxMode && <div className="map-hint">在地圖上拖曳畫出範圍（Esc 取消）</div>}
      {overlay && <div className={`map-overlay${overlayOnLeft ? '' : ' is-right'}`}>{overlay}</div>}

      <div className="map-legend">
        {hasOverlays && onLayersChange && (
          <LayerControls
            layers={layers}
            onChange={onLayersChange}
            hasRailways={Boolean(railways)}
            hasAirports={Boolean(airports)}
            tokens={MAP_TOKENS}
          />
        )}
        {colorScale ? (
          <ChoroplethLegend indicator={indicator} title={legendTitle} scale={colorScale} />
        ) : indicator.layer.kind === 'bubble' ? (
          <BubbleLegend indicator={indicator} title={legendTitle} radius={radius} tokens={tokens} />
        ) : null}
      </div>

      {hover && size && (
        <MapTooltip x={hover.x} y={hover.y} width={size.width} height={size.height}>
          {hover.airport !== undefined && renderAirportTooltip
            ? renderAirportTooltip(hover.airport)
            : renderTooltip(hover.iso3)}
        </MapTooltip>
      )}
    </div>
  );
}

interface MapTooltipProps {
  x: number;
  y: number;
  width: number;
  height: number;
  children: ReactNode;
}

function MapTooltip({ x, y, width, height, children }: MapTooltipProps) {
  const flipX = x > width - 260;
  const flipY = y > height - 140;
  return (
    <div
      className="map-tooltip"
      role="status"
      style={{
        left: x + (flipX ? -14 : 14),
        top: y + (flipY ? -14 : 14),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
      }}
    >
      {children}
    </div>
  );
}
