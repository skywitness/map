/**
 * 地圖引擎：MapLibre GL（WebGL 向量地圖），底圖用 OpenFreeMap 的 Liberty 樣式
 * （低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節），預設地球儀。
 *
 * 資料圖層插在底圖的道路、國界之上、文字標籤之下，地名永遠看得到：
 * - 面量圖：國界多邊形，顏色放在 feature-state，換年份時不必重送幾何
 * - 比例圓、小國圓點、鐵路、機場、框選範圍
 * - 3D 模式（fill-extrusion）：面量圖把國家依色階分級拉高，比例圓改成高度與數值成正比的柱子
 * 國家用 ISO alpha-3 當 feature id（promoteId）。
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { bisectRight } from 'd3-array';
import {
  Map as MaplibreMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type MapTouchEvent,
} from 'maplibre-gl';
import { geoArea, geoDistance } from 'd3-geo';
import { useLang, useT } from '../i18n';
import type { AirportsData, Indicator } from '../topics/types';
import { MAP_TOKENS, SPACE_GRADIENT, TOKENS, type Tokens } from '../theme/tokens';
import { noteMapRequest } from '../lib/serviceWorker';
import { BASEMAP_COUNTRY_BORDER, type Basemap } from './basemaps';
import { useHotkeys } from '../controls/hotkeys';
import { boxFromCorners, boxPolygon, type Box } from './boxEstimate';
import { flowColors, flowText, flowWidth, greatCircle, type FlowSelection } from './flows';
import { focusBounds } from './focus';
import type { CountryFeature } from './geometry';
import { canvasToPng, captureMap, composeMapImage, type ImageLegend, type MapImageContent } from './exportImage';
import {
  BubbleLegend,
  bubbleLegendModel,
  ChoroplethLegend,
  choroplethLegendModel,
  ColumnLegend,
  columnLegendModel,
  FlowLegend,
  flowLegendModel,
} from './Legend';
import { DEFAULT_LAYERS, LAYER_KEYS, LayerControls, layerKeyColor, type LayerVisibility } from './Overlays';
import { bubbleScale, choroplethScale } from './scales';
import { isNameLayer, LABELS, loadBaseStyle, type Projection } from './style';
import { useElementSize } from './useElementSize';

interface WorldMapProps {
  countries: CountryFeature[];
  indicator: Indicator;
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
  /** 底圖樣式（陸地、海洋的配色） */
  basemap: Basemap;
  /** 點選國家時把地圖縮放到整個國家（純地圖頁用） */
  fitOnSelect?: boolean;
  /** 資料第一次畫到地圖上（不上色的指標：國界第一次畫上）時呼叫一次 */
  onFirstData?: () => void;
  /** 流向圖（indicator.layer.kind 為 'flow'）：選取國家的主要夥伴，畫成大圓弧線 */
  flows?: FlowSelection | null;
  /** 3D 立體地圖；有傳 onThreeDChange 才會出現 3D 按鈕 */
  threeD?: boolean;
  onThreeDChange?: (on: boolean) => void;
  /** key 改變時把地圖移到這個國家（從搜尋選國家時用） */
  focus?: { iso3: string; key: number } | null;
  ref?: Ref<WorldMapHandle>;
}

export interface WorldMapHandle {
  /** 把目前的地圖畫面加上標題、圖例與來源，輸出成 PNG */
  exportImage: (content: MapImageContent) => Promise<Blob>;
}

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

/* ── 3D ─────────────────────────────── */
/** 進入 3D 時的傾角（度） */
const PITCH_3D = 50;
/**
 * 縮放 2 級時的最大高度（公尺）。面量圖最高一級的國家、比例圓最大值的柱子。
 * 平面地圖的 2 級約 20 km/px，所以柱子最高約 200 px、面量圖最高約 70 px。
 */
const MAX_COLUMN_M = 4_000_000;
const MAX_SLAB_M = 1_000_000;
/** 柱子的底面半徑（km）；固定大小，數值再小的國家也看得到一個圓盤 */
const COLUMN_RADIUS_KM = 90;
/** 小國在 3D 面量圖裡改用圓柱（多邊形太小，拉高後只剩一條線） */
const TINY_COLUMN_RADIUS_KM = 45;

/**
 * 3D 高度：fraction（0–1）× 最大高度。放大一級高度減半，柱子在畫面上的高度大致不變，
 * 放大到城市時才不會整個畫面都是柱子；同一個縮放下各國的高度仍然成比例。
 */
function extrusionHeight(fraction: ExpressionSpecification, maxMeters: number): ExpressionSpecification {
  const stops: (number | ExpressionSpecification)[] = [];
  for (let z = 2; z <= 16; z++) stops.push(z, ['*', fraction, maxMeters / 2 ** (z - 2)]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

/** 經緯度上的近似圓（柱子的底面），逆時針 */
function circlePolygon([lon, lat]: [number, number], radiusKm: number, steps = 24): GeoJSON.Polygon {
  const dLat = radiusKm / 111.32;
  const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((i % steps) / steps) * 2 * Math.PI;
    return [lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Polygon', coordinates: [ring] };
}

/**
 * 3D 的選取、hover 色：立體圖形沒辦法加外框，改用介面的藍色（選取深、hover 淺）。
 * 不用「同色變淺」，否則在橘色色階上會被看成低一級。
 */
const SELECTED_3D = TOKENS.light.hues.blue;
const HOVER_3D = TOKENS.light.sequential[2];

/**
 * 面量圖的 3D 高度（0–1）：每個色階等高（第 i 級佔 i/N 到 (i+1)/N），級內再依數值線性內插。
 * 跟顏色用同一套固定門檻，年份之間可以比較，也適用有正負的發散色（最低一級最矮）；
 * 比率類的數值偏態很大，直接用數值當高度的話大部分國家會是平的。
 * 頭尾兩級沒有邊界，用相鄰一級的寬度往外推。
 */
function classHeight(thresholds: number[], v: number): number {
  const n = thresholds.length;
  if (n === 0) return 1;
  const i = bisectRight(thresholds, v);
  const first = n > 1 ? thresholds[1] - thresholds[0] : 1;
  const last = n > 1 ? thresholds[n - 1] - thresholds[n - 2] : 1;
  const lo = i === 0 ? thresholds[0] - first : thresholds[i - 1];
  const hi = i === n ? thresholds[n - 1] + last : thresholds[i];
  const frac = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return (i + frac) / (n + 1);
}

const DATA_FILL_OPACITY = 0.82;
/** 流向圖夥伴國的淡底色 */
const FLOW_TINT_OPACITY = 0.6;

/**
 * 依縮放調整面量圖的不透明度：放大後讓底圖的道路、地形透出來。
 * tint 是流向圖夥伴國的淡底色（feature-state 'tint'），不上色的指標也會用到。
 */
function fillOpacity(on: number, tint = 0): ExpressionSpecification {
  const state: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false];
  const tinted: ExpressionSpecification = ['boolean', ['feature-state', 'tint'], false];
  const at = (k: number): ExpressionSpecification => ['case', state, on * k, tinted, tint * k, 0];
  return ['interpolate', ['linear'], ['zoom'], 1, at(1), 5, at(0.8), 9, at(0.35)];
}

/** 弧線沿線漸層（line-progress 0 是起點）：淺的一端是出口國，深的一端是進口國 */
function flowGradient(colors: { start: string; end: string }): ExpressionSpecification {
  return ['interpolate', ['linear'], ['line-progress'], 0, colors.start, 1, colors.end];
}

function dataLayers(dark: boolean): LayerSpecification[] {
  const t = MAP_TOKENS;
  const ink = dark ? '#ffffff' : t.ink;
  const hovered: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
  const tinyOn: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false];
  const isOrigin: ExpressionSpecification = ['boolean', ['get', 'origin'], false];
  const highlight3d = (color: ExpressionSpecification | string): ExpressionSpecification => [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    SELECTED_3D,
    hovered,
    HOVER_3D,
    color,
  ];
  // 3D 面量圖：顏色、分級高度都放在 feature-state（跟平面的 data-fill 同一份）
  const slabPaint = {
    'fill-extrusion-color': highlight3d(['coalesce', ['feature-state', 'fill'], NO_DATA]),
    'fill-extrusion-height': extrusionHeight(['number', ['feature-state', 'h'], 0], MAX_SLAB_M),
    'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.94, 10, 0.6],
  } satisfies Extract<LayerSpecification, { type: 'fill-extrusion' }>['paint'];
  return [
    {
      id: 'data-fill',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'tint'], false],
          ['coalesce', ['feature-state', 'tintColor'], NO_DATA],
          ['coalesce', ['feature-state', 'fill'], NO_DATA],
        ],
        'fill-opacity': fillOpacity(DATA_FILL_OPACITY, FLOW_TINT_OPACITY),
      },
    },
    {
      // 面量圖開著時，國界改用跟上色同一份幾何畫，並隱藏底圖的國界，才不會出現兩條錯開的線
      id: 'data-border',
      type: 'line',
      source: 'countries',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': dark ? '#f0efec' : '#3d3d3a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 0.9, 10, 1.4],
        'line-opacity': fillOpacity(0.55),
      },
    },
    {
      id: 'data-highlight',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': ink,
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.4, hovered, 1.4, 0],
      },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'railways',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': dark ? '#d6d4cc' : '#4a4a46',
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
        'circle-stroke-color': ['case', hovered, ink, '#ffffff'],
        'circle-stroke-width': ['case', hovered, 1.6, 1],
      },
    },
    // 3D 圖層在疊加圖層（鐵路、機場、框選範圍）之下：疊加圖層畫在立體圖形上面，才不會被整片蓋掉
    { id: 'extrude-countries', type: 'fill-extrusion', source: 'countries', layout: { visibility: 'none' }, paint: slabPaint },
    {
      id: 'extrude-tiny',
      type: 'fill-extrusion',
      source: 'tiny-columns',
      maxzoom: 5,
      layout: { visibility: 'none' },
      paint: slabPaint,
    },
    {
      // 比例圓的 3D 版：底面固定大小，高度與數值成正比
      id: 'extrude-columns',
      type: 'fill-extrusion',
      source: 'columns',
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': highlight3d(t.accent),
        'fill-extrusion-height': extrusionHeight(['number', ['get', 'h'], 0], MAX_COLUMN_M),
        'fill-extrusion-opacity': 0.94,
      },
    },
    // 流向圖：白色襯底讓弧線在任何底圖上都看得清楚；細線排在上面，才點得到小夥伴
    {
      id: 'flow-casing',
      type: 'line',
      source: 'flows',
      layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['-', 0, ['get', 'w']] },
      paint: {
        'line-color': dark ? '#0b0b0b' : '#ffffff',
        'line-width': ['+', ['get', 'w'], 2],
        'line-opacity': 0.55,
      },
    },
    {
      id: 'flow-lines',
      type: 'line',
      source: 'flows',
      layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['-', 0, ['get', 'w']] },
      paint: {
        'line-gradient': flowGradient(flowColors('export')),
        'line-width': ['case', hovered, ['+', ['get', 'w'], 1.5], ['get', 'w']],
        'line-opacity': ['case', hovered, 1, 0.88],
      },
    },
    {
      id: 'flow-ends',
      type: 'circle',
      source: 'flow-ends',
      paint: {
        'circle-radius': ['case', isOrigin, 5, hovered, 5, 3.5],
        'circle-color': ['case', isOrigin, ink, ['to-color', ['get', 'color'], NO_DATA]],
        'circle-stroke-color': dark ? '#0b0b0b' : '#ffffff',
        'circle-stroke-width': 1.2,
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
    { id: 'box-line', type: 'line', source: 'box', paint: { 'line-color': ink, 'line-width': 1.5 } },
  ];
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const SPACE_BACKGROUND = `radial-gradient(circle at 50% 50%, ${SPACE_GRADIENT.map(([at, color]) => `${color} ${at * 100}%`).join(', ')})`;

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
/** hover 與點選時依序查詢的圖層（上面的優先）；隱藏的圖層會跳過 */
const HOVER_LAYERS = [
  'flow-ends',
  'flow-lines',
  'airports-large',
  'airports-medium',
  'extrude-columns',
  'extrude-tiny',
  'extrude-countries',
  'bubbles',
  'data-tiny',
  'data-fill',
];
/** 這些 source 的 feature-state 要跟著 hover、選取更新 */
const HOVER_SOURCES = ['countries', 'bubbles', 'columns', 'tiny-columns', 'flows', 'flow-ends'];
const SELECT_SOURCES = ['countries', 'columns', 'tiny-columns'];

export function WorldMap(props: WorldMapProps) {
  const { countries, indicator, values, bubbleMax, tokens, selected, onSelect, renderTooltip, ariaLabel, dimmed } =
    props;
  const t = useT();
  const lang = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const { box, onBoxChange, boxToolLabel = t.boxTool, overlay, legendTitle } = props;
  const { railways = null, airports = null, layers = DEFAULT_LAYERS, onLayersChange, renderAirportTooltip } = props;
  const { basemap, fitOnSelect = false, flows = null, threeD = false, onThreeDChange, focus = null, ref, onFirstData } =
    props;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const threeDRef = useRef(threeD);
  threeDRef.current = threeD;
  /** 目前地圖上實際載入的底圖（切換時比對用） */
  const loadedBasemapRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const size = useElementSize(containerRef);
  // 每次加上資料圖層（建立地圖、切換底圖）就加一；資料相關的 effect 都依它重跑，把資料重新套上
  const [revision, setRevision] = useState(0);
  const ready = revision > 0;
  /** 資料圖層目前是否在地圖上（切換底圖、等新樣式載入的期間是 false） */
  const installedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [globe, setGlobe] = useState(true);
  // MapLibre 5 在地球儀上查不到立體圖形（queryRenderedFeatures 對 fill-extrusion 用的是平面的矩陣），
  // hover、點國家都會失效，所以 3D 時固定用平面地圖；離開 3D 再回到使用者選的投影
  const projection: Projection = globe && !threeD ? 'globe' : 'mercator';
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  /** 剛進入 3D 時短暫顯示操作提示 */
  const [threeDHint, setThreeDHint] = useState(false);
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
  // 把地圖移到某國時要框住的範圍（主要國土加附近的島，不含遠方屬地）
  const countryBounds = useMemo(() => new Map(countries.map((c) => [c.iso3, focusBounds(c)])), [countries]);
  const tinyCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: countries
        .filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < TINY_KM2)
        .map((c) => ({ type: 'Feature', properties: { iso3: c.iso3 }, geometry: { type: 'Point', coordinates: c.anchor } })),
    }),
    [countries],
  );
  const tinyColumnCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: tinyCollection.features.map((f) => ({
        ...f,
        geometry: circlePolygon((f.geometry as GeoJSON.Point).coordinates as [number, number], TINY_COLUMN_RADIUS_KM),
      })),
    }),
    [tinyCollection],
  );

  /** 加上資料用的 source 與圖層；建立地圖與切換底圖後都要做 */
  const installDataLayers = (m: MaplibreMap, dark: boolean) => {
    for (const id of ['countries', 'tiny', 'bubbles', 'columns', 'tiny-columns', 'flow-ends']) {
      m.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'iso3' });
    }
    // lineMetrics：弧線的漸層（line-gradient）要用到沿線的位置
    m.addSource('flows', { type: 'geojson', data: EMPTY, promoteId: 'iso3', lineMetrics: true });
    for (const id of ['railways', 'airports', 'box']) m.addSource(id, { type: 'geojson', data: EMPTY });
    // 插在底圖最後一個非文字圖層（道路、國界等）之後：資料蓋在道路上面、文字標籤下面。
    // 不能用「第一個文字圖層」，深色樣式的水域名稱排在很前面，資料會被道路線壓住。
    const styleLayers = m.getStyle().layers;
    const lastShape = styleLayers.reduce((found, l, i) => (l.type === 'symbol' ? found : i), -1);
    const beforeId = styleLayers[lastShape + 1]?.id;
    for (const layer of dataLayers(dark)) m.addLayer(layer, beforeId);
    installedRef.current = true;
  };

  /* ── 建立地圖（只做一次） ─────────────── */
  useEffect(() => {
    let cancelled = false;
    let map: MaplibreMap | null = null;
    const initial = basemapRef.current;
    loadBaseStyle(initial.url, projectionRef.current, langRef.current)
      .then((style) => {
        if (cancelled || !mapNodeRef.current) return;
        map = new MaplibreMap({
          container: mapNodeRef.current,
          style,
          center: INITIAL_CENTER,
          zoom: fitGlobeZoom(mapNodeRef.current.clientHeight || 500),
          // 網址帶 3d=1 時直接以傾斜視角開啟，不播放動畫
          pitch: threeDRef.current ? PITCH_3D : 0,
          maxZoom: MAX_ZOOM,
          // 預設的版權標示會依寬度自動收合（地圖窄於 640px 時只顯示 ⓘ）
          localIdeographFontFamily: "'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif",
          // 旋轉、傾斜只在 3D 模式開啟（右鍵或 Ctrl＋拖曳；見下面的操作 effect）
          dragRotate: false,
          // 第一次造訪時記下底圖的請求，service worker 接手後補存進快取（離線也能看到底圖）
          transformRequest: (url) => {
            noteMapRequest(url);
            return { url };
          },
        });
        mapRef.current = map;
        const m = map;
        // 開發時方便在瀏覽器主控台檢查地圖狀態
        if (import.meta.env.DEV) (window as unknown as { __map?: MaplibreMap }).__map = m;
        // 樣式一解析完就加上資料圖層，不等 'load'（要等第一個畫面的底圖圖磚全部下載完，手機上要好幾秒）
        m.once('style.load', () => {
          installDataLayers(m, initial.dark);
          loadedBasemapRef.current = initial.id;
          setRevision((r) => r + 1);
        });
        m.once('load', () => {
          // 窄螢幕時版權標示預設是展開的，會蓋住地圖下緣；先收合成 ⓘ 按鈕
          m.getContainer().querySelector('.maplibregl-compact')?.classList.remove('maplibregl-compact-show');
        });
        bindEvents(m);
        // 用滑鼠點地圖時不把焦點留在地圖上，←/→ 才會繼續換年份；用 Tab 移進地圖時方向鍵、+/− 照常平移縮放
        const canvas = m.getCanvas();
        canvas.addEventListener('focus', () => {
          if (!canvas.matches(':focus-visible')) canvas.blur();
        });
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
      for (const source of HOVER_SOURCES) {
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

  /* ── 切換底圖：換樣式後重新加上資料圖層，revision 加一後下面的 effect 會把資料重新套上 ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedBasemapRef.current === null || loadedBasemapRef.current === basemap.id) return;
    let cancelled = false;
    loadBaseStyle(basemap.url, projectionRef.current, langRef.current).then((style) => {
      if (cancelled) return;
      installedRef.current = false;
      hoverIdRef.current = null;
      selectedRef.current = null;
      map.once('style.load', () => {
        if (cancelled) return;
        installDataLayers(map, basemap.dark);
        loadedBasemapRef.current = basemap.id;
        setRevision((r) => r + 1);
      });
      map.setStyle(style, { diff: false });
    });
    return () => {
      cancelled = true;
    };
  }, [basemap]);

  // 切換語言：底圖地名換成另一種語言，不必重新載入樣式
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    for (const layer of map.getStyle().layers) {
      if (isNameLayer(layer)) map.setLayoutProperty(layer.id, 'text-field', LABELS[lang]);
    }
  }, [revision, lang]);

  // 面量圖開著時隱藏底圖的國界（改畫 data-border），其他時候用底圖的國界
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const own = indicator.layer.kind === 'choropleth';
    for (const layer of map.getStyle().layers) {
      if ('source-layer' in layer && layer['source-layer'] === 'boundary' && BASEMAP_COUNTRY_BORDER.test(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', own ? 'none' : 'visible');
      }
    }
  }, [revision, indicator.layer.kind]);

  /* ── 資料 → 地圖 ─────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('countries') as GeoJSONSource).setData(countryCollection);
    (map.getSource('tiny') as GeoJSONSource).setData(tinyCollection);
    (map.getSource('tiny-columns') as GeoJSONSource).setData(tinyColumnCollection);
  }, [revision, countryCollection, tinyCollection, tinyColumnCollection]);

  // 面量圖顏色（與 3D 高度）放在 feature-state，換年份時只改狀態，不重送幾何
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const on = indicator.layer.kind === 'choropleth';
    const thresholds = colorScale?.domain() ?? [];
    for (const c of countries) {
      const v = values.get(c.iso3);
      const has = on && v !== undefined && colorScale !== null;
      const fill = has ? colorScale(v) : NO_DATA;
      const state = { fill, on, h: has ? classHeight(thresholds, v) : 0 };
      map.setFeatureState({ source: 'countries', id: c.iso3 }, state);
      map.setFeatureState({ source: 'tiny-columns', id: c.iso3 }, state);
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { fill, on: on && v !== undefined });
    }
  }, [revision, countries, values, colorScale, indicator.layer.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const entries =
      indicator.layer.kind === 'bubble' ? [...values].filter(([iso3, v]) => v > 0 && anchors.has(iso3)) : [];
    const features: GeoJSON.Feature[] = entries.map(([iso3, v]) => ({
      type: 'Feature',
      properties: { iso3, r: radius(v) },
      geometry: { type: 'Point', coordinates: anchors.get(iso3)! },
    }));
    (map.getSource('bubbles') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
    // 3D 柱子：底面固定，高度與數值成正比（線性，總量才能直接比較）；最高的柱子是所有年份的最大值
    const columns: GeoJSON.Feature[] = entries.map(([iso3, v]) => ({
      type: 'Feature',
      properties: { iso3, h: v / bubbleMax },
      geometry: circlePolygon(anchors.get(iso3)!, COLUMN_RADIUS_KM),
    }));
    (map.getSource('columns') as GeoJSONSource).setData({ type: 'FeatureCollection', features: columns });
  }, [revision, values, radius, anchors, bubbleMax, indicator.layer.kind]);

  // 資料第一次畫到地圖上：通知 App（之後才載入精細國界、預先下載），並留下 performance mark「map-data」
  // 給載入速度量測用（DESIGN.md 第 13 節）。不上色的指標（純地圖、路網）以國界畫上為準
  const shownRef = useRef(false);
  const onFirstDataRef = useRef(onFirstData);
  onFirstDataRef.current = onFirstData;
  useEffect(() => {
    const map = mapRef.current;
    const kind = indicator.layer.kind;
    if (!ready || !map || !installedRef.current || shownRef.current) return;
    if (countries.length === 0 || (values.size === 0 && kind !== 'none')) return;
    const source = kind === 'bubble' ? 'bubbles' : 'countries';
    const onRender = () => {
      if (!map.isSourceLoaded(source)) return;
      map.off('render', onRender);
      shownRef.current = true;
      performance.mark('map-data');
      onFirstDataRef.current?.();
    };
    map.on('render', onRender);
    map.triggerRepaint();
    return () => {
      map.off('render', onRender);
    };
  }, [revision, countries, values, indicator.layer.kind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('railways') as GeoJSONSource).setData(
      railways ? { type: 'Feature', properties: {}, geometry: railways } : EMPTY,
    );
  }, [revision, railways]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const features: GeoJSON.Feature[] = (airports?.rows ?? []).map((row, i) => ({
      type: 'Feature',
      properties: { i, type: row[2], iso3: row[6] },
      geometry: { type: 'Point', coordinates: [row[0], row[1]] },
    }));
    (map.getSource('airports') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  }, [revision, airports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('rail', Boolean(railways) && layers.railways);
    show('airports-large', Boolean(airports) && layers.largeAirports);
    show('airports-medium', Boolean(airports) && layers.mediumAirports);
  }, [revision, railways, airports, layers]);

  /* ── 流向圖：選取國家 ↔ 各夥伴的大圓弧線 ── */
  const flowMax = useMemo(() => (flows ? Math.max(0, ...flows.links.map((l) => l.value)) : 0), [flows]);
  const flowData = useMemo(() => {
    const lines: GeoJSON.Feature[] = [];
    const ends: GeoJSON.Feature[] = [];
    const origin = flows ? anchors.get(flows.origin) : undefined;
    if (flows && origin) {
      const color = flowColors(flows.direction).end;
      ends.push({ type: 'Feature', properties: { iso3: flows.origin, origin: true }, geometry: { type: 'Point', coordinates: origin } });
      for (const link of flows.links) {
        const partner = anchors.get(link.iso3);
        if (!partner || link.iso3 === flows.origin) continue; // 地圖上沒有形狀的夥伴（例如吐瓦魯）只列在側欄
        // 弧線一律從出口國畫到進口國，漸層的淺色端才會是出口國
        const [from, to] = flows.direction === 'export' ? [origin, partner] : [partner, origin];
        lines.push({
          type: 'Feature',
          properties: { iso3: link.iso3, w: flowWidth(link.value, flowMax) },
          geometry: { type: 'LineString', coordinates: greatCircle(from, to) },
        });
        ends.push({ type: 'Feature', properties: { iso3: link.iso3, color }, geometry: { type: 'Point', coordinates: partner } });
      }
    }
    const collection = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
    return { lines: collection(lines), ends: collection(ends) };
  }, [flows, anchors, flowMax]);

  // 夥伴國塗上淡底色；換國家、換方向時先清掉上一次的
  const tintedRef = useRef<string[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('flows') as GeoJSONSource).setData(flowData.lines);
    (map.getSource('flow-ends') as GeoJSONSource).setData(flowData.ends);
    for (const id of tintedRef.current) map.setFeatureState({ source: 'countries', id }, { tint: false });
    const colors = flowColors(flows?.direction ?? 'export');
    const tinted = (flows?.links ?? []).map((l) => l.iso3).filter((iso3) => iso3 !== flows?.origin);
    for (const id of tinted) map.setFeatureState({ source: 'countries', id }, { tint: true, tintColor: colors.tint });
    tintedRef.current = tinted;
    // line-gradient 不能依 feature 變化，換方向時整個換掉
    map.setPaintProperty('flow-lines', 'line-gradient', flowGradient(colors));
  }, [revision, flowData, flows]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
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
  }, [revision, box]);

  // 選取的國家加粗外框；不在畫面上時（例如從搜尋或排名表選）把地圖轉過去
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    for (const source of SELECT_SOURCES) {
      if (selectedRef.current) map.setFeatureState({ source, id: selectedRef.current }, { selected: false });
      if (selected) map.setFeatureState({ source, id: selected }, { selected: true });
    }
    selectedRef.current = selected;
    if (fitOnSelect && selected) {
      const bounds = countryBounds.get(selected);
      // 3D 時保留目前的方位（fitBounds 預設會轉回正北）
      if (bounds) map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 900, bearing: map.getBearing() });
      return;
    }
    const anchor = selected ? anchors.get(selected) : undefined;
    if (!anchor) return;
    const center = map.getCenter();
    const p = map.project(anchor);
    const canvas = map.getCanvas();
    const offScreen = p.x < 0 || p.y < 0 || p.x > canvas.clientWidth || p.y > canvas.clientHeight;
    const behindGlobe = projection === 'globe' && geoDistance([center.lng, center.lat], anchor) > Math.PI / 2.4;
    if (offScreen || behindGlobe) map.easeTo({ center: anchor, zoom: Math.max(map.getZoom(), 2.5), duration: 800 });
    // 投影不放進依賴：切換投影、進出 3D 時不要重跑，否則這裡的 easeTo 會打斷傾斜的動畫
  }, [revision, selected, anchors, fitOnSelect, countryBounds]);

  // 從搜尋選到國家：一定飛過去並框住整個國家，扣掉手機抽屜蓋住的部分
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const bounds = countryBounds.get(focus.iso3);
    if (!bounds) return;
    const rect = map.getContainer().getBoundingClientRect();
    let covered = 0;
    for (const el of document.querySelectorAll('[data-occludes-map]')) {
      covered = Math.max(covered, rect.bottom - el.getBoundingClientRect().top);
    }
    const pad = Math.min(48, rect.width / 8, rect.height / 8);
    const bottom = Math.min(Math.max(pad, covered + pad / 2), rect.height * 0.6);
    map.fitBounds(bounds, {
      padding: { top: pad, left: pad, right: pad + 40, bottom }, // 右邊留給縮放按鈕
      maxZoom: fitOnSelect ? 8 : 5,
      duration: 1200,
      bearing: map.getBearing(), // 3D 時保留目前的方位（fitBounds 預設會轉回正北）
    });
  }, [ready, focus]); // 只在有新的搜尋結果時移動，換底圖、換年份都不動

  useHotkeys(
    {
      '+': () => mapRef.current?.zoomIn(),
      '=': () => mapRef.current?.zoomIn(),
      '-': () => mapRef.current?.zoomOut(),
      _: () => mapRef.current?.zoomOut(),
    },
    ready,
  );

  // 框選模式：拖曳用來畫框，不平移地圖。旋轉、傾斜只在 3D 模式開放
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    if (boxMode) {
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.getCanvas().style.cursor = 'crosshair';
      // capture + preventDefault：Esc 只取消框選，不會順便取消選取的國家
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          dragRef.current = null;
          setBoxMode(false);
        }
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    map.getCanvas().style.cursor = '';
    if (threeD) {
      // 右鍵或 Ctrl＋拖曳：左右旋轉、上下傾斜；觸控：雙指轉動旋轉、雙指上下滑傾斜；鍵盤：Shift＋方向鍵
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.keyboard.enableRotation();
    } else {
      // 平面上色時沒有回正按鈕，不讓地圖被轉歪或傾斜
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.keyboard.disableRotation();
    }
  }, [revision, boxMode, threeD]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setProjection({ type: projection });
  }, [revision, projection]);

  // 進出 3D 時傾斜／轉回。只在切換時播放（換底圖不重播）；網址直接帶 3d=1 時，建立地圖時就是傾斜的
  const cameraThreeDRef = useRef(threeD);
  useEffect(() => {
    if (cameraThreeDRef.current === threeD) return;
    cameraThreeDRef.current = threeD;
    mapRef.current?.easeTo(threeD ? { pitch: PITCH_3D, duration: 1000 } : { pitch: 0, bearing: 0, duration: 800 });
  }, [threeD]);

  // 3D：依指標的圖層類型換成立體圖層。面量圖的平面上色、國界、選取外框改由立體圖形的顏色表現；
  // data-fill 留著（透明）當點選的備援
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const kind = indicator.layer.kind;
    const slabs = threeD && kind === 'choropleth';
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('extrude-countries', slabs);
    show('extrude-tiny', slabs);
    show('extrude-columns', threeD && kind === 'bubble');
    show('bubbles', !threeD);
    show('data-tiny', !slabs);
    show('data-border', !slabs);
    show('data-highlight', !slabs);
    // 要維持同一種運算式（依縮放與 feature-state）：改成常數 0 的話，舊圖磚在重新排版前遇到 hover
    // 更新 feature-state，MapLibre 會對常數呼叫 evaluate 而丟出 TypeError
    map.setPaintProperty('data-fill', 'fill-opacity', fillOpacity(slabs ? 0 : DATA_FILL_OPACITY, FLOW_TINT_OPACITY));
    // 平面時鐵路在比例圓下面；3D 時改畫在立體圖形上面，否則會被整片蓋住
    map.moveLayer('rail', threeD ? 'airports-medium' : 'data-tiny');
  }, [revision, threeD, indicator.layer.kind]);

  // 回正按鈕上的指北針跟著地圖旋轉
  const compassRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !threeD) return;
    const update = () => {
      if (compassRef.current) compassRef.current.style.transform = `rotate(${-map.getBearing()}deg)`;
    };
    update();
    map.on('rotate', update);
    return () => {
      map.off('rotate', update);
    };
  }, [ready, threeD]);

  useEffect(() => {
    if (!threeDHint) return;
    const id = setTimeout(() => setThreeDHint(false), 6000);
    return () => clearTimeout(id);
  }, [threeDHint]);

  const toggleThreeD = () => {
    if (!onThreeDChange) return;
    const on = !threeD;
    onThreeDChange(on);
    setThreeDHint(on);
    // 3D 下的框選：地圖可以旋轉、傾斜，拖出來的範圍跟畫面上的矩形對不起來，所以不開放
    if (on) {
      dragRef.current = null;
      setBoxMode(false);
    }
  };

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
  // 流向圖還沒選國家時，提示使用者點一下；選了但那一年沒有資料也要說
  const flowLayer = indicator.layer.kind === 'flow' ? indicator.layer : null;
  const flowHint =
    !flowLayer || boxMode
      ? null
      : !selected
        ? flowText(lang).pick(flowText(lang)[flowLayer.direction].partners)
        : flows?.origin === selected && flows.links.length === 0
          ? flowText(lang).noData(flows.year, flowText(lang)[flowLayer.direction].partners)
          : null;

  useImperativeHandle(
    ref,
    () => ({
      exportImage: async (content) => {
        const map = mapRef.current;
        if (!map || !installedRef.current) throw new Error('The map has not finished loading');
        // 圖例跟畫面上的一樣：數值圖例（3D 時是階梯色塊或柱子），加上目前開著的疊加圖層
        const title = legendTitle;
        const unit = indicator.unit;
        const legend: ImageLegend | null = colorScale
          ? { kind: 'choropleth', title, unit, model: choroplethLegendModel(indicator, colorScale), stepped: threeD }
          : indicator.layer.kind !== 'bubble'
            ? flowLayer && flows && flowMax > 0
              ? { kind: 'flow', title, unit, model: flowLegendModel(indicator, flows.direction, flowMax) }
              : null
            : threeD
              ? { kind: 'column', title, unit, model: columnLegendModel(indicator, bubbleMax), color: MAP_TOKENS.accent }
              : { kind: 'bubble', title, unit, model: bubbleLegendModel(indicator, radius) };
        const layerKeys = onLayersChange
          ? LAYER_KEYS.filter((k) => (k.source === 'railways' ? railways : airports) && layers[k.key]).map((key) => ({
              key,
              color: layerKeyColor(key, tokens),
            }))
          : [];
        const { canvas, ratio } = await captureMap(map);
        return canvasToPng(composeMapImage(canvas, ratio, { ...content, legend, layerKeys, tokens }));
      },
    }),
    [colorScale, radius, indicator, legendTitle, onLayersChange, railways, airports, layers, tokens, threeD, bubbleMax, flowLayer, flows, flowMax],
  );

  return (
    <div
      ref={containerRef}
      className={`map${dimmed ? ' is-dimmed' : ''}${boxMode ? ' is-box-mode' : ''}${fullscreen ? ' is-fullscreen' : ''}`}
    >
      <div
        ref={mapNodeRef}
        className="map-canvas"
        style={{ background: SPACE_BACKGROUND }}
        role="img"
        aria-label={ariaLabel}
      />
      {failed && <p className="error map-error">{t.basemapFailed}</p>}

      <div className="map-zoom" role="group" aria-label={t.mapControls}>
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t.zoomIn} title={t.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t.zoomOut} title={t.zoomOut}>
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
          aria-label={t.resetView}
          title={t.resetView}
        >
          ⟲
        </button>
        <button
          type="button"
          className="map-text-button"
          onClick={() => !threeD && setGlobe((g) => !g)}
          aria-disabled={threeD}
          aria-label={projection === 'globe' ? t.toFlat : t.toGlobe}
          title={threeD ? t.globeIn3d : projection === 'globe' ? t.toFlat : t.toGlobe}
        >
          {projection === 'globe' ? t.flatShort : t.globeShort}
        </button>
        {onThreeDChange && (
          <button
            type="button"
            className={`map-text-button map-toggle${threeD ? ' is-active' : ''}`}
            onClick={toggleThreeD}
            aria-pressed={threeD}
            aria-label={t.threeD}
            title={threeD ? t.threeDLeave : t.threeDEnter}
          >
            3D
          </button>
        )}
        {threeD && (
          <button
            type="button"
            className="map-compass"
            onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: PITCH_3D, duration: 600 })}
            aria-label={t.compass}
            title={t.compassTitle}
          >
            <svg ref={compassRef} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path d="M8 1.5 11 8H5Z" fill="#e24a48" />
              <path d="M8 14.5 5 8h6Z" fill="currentColor" opacity="0.5" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
          title={fullscreen ? t.exitFullscreen : t.fullscreen}
        >
          {fullscreen ? '⤡' : '⤢'}
        </button>
        {onBoxChange && (
          <button
            type="button"
            className={`box-tool${boxMode ? ' is-active' : ''}`}
            onClick={() => !threeD && setBoxMode((m) => !m)}
            aria-pressed={boxMode}
            aria-disabled={threeD}
            aria-label={boxToolLabel}
            title={threeD ? t.boxIn3d : boxMode ? t.boxToolActive : boxToolLabel}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
            </svg>
          </button>
        )}
      </div>

      {boxMode && <div className="map-hint">{t.boxHint}</div>}
      {flowHint && !threeDHint && <div className="map-hint">{flowHint}</div>}
      {threeDHint && (
        <div className="map-hint is-wrap">
          {matchMedia('(pointer: coarse)').matches ? t.threeDHintTouch : t.threeDHintMouse}
          {globe && t.threeDHintGlobe}
        </div>
      )}
      {overlay && <div className={`map-overlay${overlayOnLeft ? '' : ' is-right'}`}>{overlay}</div>}

      <div className="map-legend">
        {hasOverlays && onLayersChange && (
          <LayerControls
            layers={layers}
            onChange={onLayersChange}
            hasRailways={Boolean(railways)}
            hasAirports={Boolean(airports)}
            tokens={tokens}
          />
        )}
        {colorScale ? (
          <ChoroplethLegend indicator={indicator} title={legendTitle} scale={colorScale} stepped={threeD} />
        ) : indicator.layer.kind === 'bubble' ? (
          threeD ? (
            <ColumnLegend indicator={indicator} title={legendTitle} max={bubbleMax} color={MAP_TOKENS.accent} tokens={tokens} />
          ) : (
            <BubbleLegend indicator={indicator} title={legendTitle} radius={radius} tokens={tokens} />
          )
        ) : flowLayer && flows && flowMax > 0 ? (
          <FlowLegend indicator={indicator} title={legendTitle} direction={flows.direction} max={flowMax} tokens={tokens} />
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
