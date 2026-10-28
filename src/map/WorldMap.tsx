/**
 * 地圖引擎：MapLibre GL（WebGL 向量地圖），底圖用 OpenFreeMap 的 Liberty 樣式
 * （低縮放是 Natural Earth II 彩色地形，放大後是 OpenStreetMap 細節），預設地球儀。
 *
 * 資料圖層插在底圖的道路、國界之上、文字標籤之下，地名永遠看得到：
 * - 面量圖、類別圖：國界多邊形，顏色放在 feature-state，換年份時不必重送幾何
 * - 比例圓、小國圓點、鐵路、機場、框選範圍
 * - 一般的點、線疊加圖層（overlayLayers.ts：地震、火山、板塊邊界、駐外館處…），樣式寫在主題裡
 * - 3D 模式（fill-extrusion）：面量圖把國家依色階分級拉高，比例圓改成高度與數值成正比的柱子
 * - 地形（海拔主題，terrain.ts）：高程圖磚的分層設色與陰影，3D 時改成真的立體地形
 * - 1 km 網格（densityGrid.ts）：點陣圖磚取代國家的顏色，國界、hover、點選照舊用國家的形狀
 * 國家用 ISO alpha-3 當 feature id（promoteId）。
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { bisectRight } from 'd3-array';
import {
  addProtocol,
  Map as MaplibreMap,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type MapSourceDataEvent,
  type MapTouchEvent,
  type RasterTileSource,
} from 'maplibre-gl';
import { geoArea, geoDistance } from 'd3-geo';
import { tr, useLang, useT } from '../i18n';
import type { AirportsData, Indicator } from '../topics/types';
import { MAP_TOKENS, SPACE_GRADIENT, TOKENS, type Tokens } from '../theme/tokens';
import { noteMapRequest } from '../lib/serviceWorker';
import { BASEMAP_COUNTRY_BORDER, type Basemap } from './basemaps';
import { useHotkeys } from '../controls/hotkeys';
import { boxFromCorners, boxPolygon, type Box } from './boxEstimate';
import { flowColors, flowText, flowWidth, greatCircle, type FlowSelection } from './flows';
import { focusBounds } from './focus';
import { unwrapAntimeridian, type CountryFeature } from './geometry';
import { canvasToPng, captureMap, composeMapImage, type ImageLegend, type MapImageContent } from './exportImage';
import {
  BubbleLegend,
  bubbleLegendModel,
  CategoricalLegend,
  categoricalLegendModel,
  ChoroplethLegend,
  choroplethLegendModel,
  ColumnLegend,
  columnLegendModel,
  FlowLegend,
  flowLegendModel,
  ReliefLegend,
} from './Legend';
import {
  DEFAULT_LAYERS,
  exportLayerKeys,
  LAYER_KEYS,
  LayerControls,
  layerKeyColor,
  type LayerVisibility,
  type OverlayLayer,
} from './Overlays';
import { applyTimeFilters, highlightLine, lineOverlayAt, OVERLAY_PREFIX, syncOverlays, type OverlayDataCache } from './overlayLayers';
import { syncNight } from './nightLayer';
import { categoryScale } from './categories';
import { BUBBLE_MIN_RADIUS, bubbleScale, choroplethScale, gridScale } from './scales';
import { isNameLayer, LABELS, loadBaseStyle, type Projection } from './style';
import { GRID_PROTOCOL, gridLabels, gridTiles, loadGridTile, type GridLayer } from './densityGrid';
import { FLAG_PROTOCOL, flagIcon, flagTileUrl, loadFlagTile, setFlagLayout, type FlagSpec } from './flagTiles';
import { demSource, RELIEF_COLOR, reliefLegendModel, RELIEF_TITLE, terrainExaggeration } from './terrain';
import { useElementSize } from './useElementSize';
import { BasemapMenu } from './BasemapMenu';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { NARROW_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import { useMapTokens } from './palettes';
import { ExitFullscreenIcon, FlatIcon, FullscreenIcon, GlobeIcon, MinusIcon, PlusIcon, ResetIcon } from './MapIcons';

// 1 km 網格的圖磚經過這個協定載入：沒有內容的圖磚（海洋、無人區）不發出請求
addProtocol(GRID_PROTOCOL, loadGridTile);
// 國旗地圖的圖磚在瀏覽器裡畫（flagTiles.ts）
addProtocol(FLAG_PROTOCOL, loadFlagTile);

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
  /** 一般的點、線疊加圖層（主題 overlays 裡 kind 為 points、lines 的），順序就是畫的順序（後面的在上面） */
  overlays?: OverlayLayer[];
  /** 目前的年份：有年份欄位的疊加點依它與指標的 overlayTime 篩選 */
  year?: number;
  /** 時刻主題的這一刻（UTC 毫秒）：晝夜圖層（kind 'night'）依它畫夜半邊與太陽直射點；其他主題是 null */
  time?: number | null;
  /** 滑到一般點圖層的點上時的 tooltip（overlay 的 id、資料的第幾筆） */
  renderPointTooltip?: (overlay: string, index: number) => ReactNode;
  /** 主題自訂的地點（TopicDefinition.places）：跟沒有形狀的國家一樣畫小圓點與比例圓 */
  places?: [string, [number, number]][];
  /** 底圖樣式（陸地、海洋的配色） */
  basemap: Basemap;
  /** 有傳才在右上角的按鈕列放「底圖」選單 */
  onBasemapChange?: (id: string) => void;
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
  /** 地形圖層（主題的 terrain）：kind 為 'terrain' 的指標畫分層設色，面量圖上疊地形陰影，3D 改成立體地形 */
  terrain?: boolean;
  /** 1 km 網格（指標有 grid、使用者切到網格時）：取代面量圖的國家顏色 */
  grid?: GridLayer | null;
  /** 切到網格但 meta.json 載入失敗：照常畫國家平均，上方提示 */
  gridFailed?: boolean;
  /** 國旗地圖（indicator.layer.kind 為 'flags'）：每個國家的國旗；載入前是 null */
  flags?: Map<string, FlagSpec> | null;
  /**
   * 地圖停下來（moveend）時回報縮放與畫面範圍 [西, 南, 東, 北]；線圖層的 detail 依它下載放大後的分區。
   * 有傳才監聽
   */
  onViewChange?: (view: MapView) => void;
  /** 地圖外面（主題的側欄）要標出的一組線，跟滑過時一樣；null 時取消 */
  lineHighlight?: { overlay: string; group: number } | null;
  /** key 改變時把地圖移到這個範圍 [西, 南, 東, 北]（主題的側欄點某條河） */
  focusBox?: { box: [number, number, number, number]; key: number } | null;
  ref?: Ref<WorldMapHandle>;
}

export interface MapView {
  zoom: number;
  bounds: [number, number, number, number];
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
/**
 * 選取的國家比這小時多畫一個圓圈標記：全球視角下台灣（3.6 萬 km²）只有十來個像素，外框幾乎看不到。
 * 南韓（10 萬）、葡萄牙、匈牙利也算；放大到 5 級以後國家本身夠大，圓圈淡出
 */
const SELECTED_MARK_KM2 = 120_000;
/**
 * 1:50m 國界沒有形狀的國家（DESIGN.md 第 8 節第 8 點），用首府的位置畫小國圓點，也當比例圓、弧線的位置；
 * 否則吐瓦魯（台灣的邦交國）在地圖上完全看不到
 */
const SHAPELESS: [string, [number, number]][] = [
  ['TUV', [179.19, -8.52]],
  ['TKL', [-171.85, -9.2]],
  ['GIB', [-5.35, 36.14]],
];
const EARTH_RADIUS_KM = 6371.0088;
const NO_DATA = MAP_TOKENS.noData;
/**
 * 換年份、換指標時國家顏色的漸變時間（毫秒）。播放（一年 120 ms）、拖時間軸時變得比這快，
 * 這時不漸變，直接換，顏色才不會落後拉桿一兩年
 */
const FILL_FADE_MS = 280;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** 載入時暫時把陸地畫成海的顏色，最多這麼久（見 installDataLayers） */
const SEA_PLACEHOLDER_MAX_MS = 10_000;

/** '#rrggbb' 或 'rgb(r, g, b)' → [r, g, b] */
function parseColor(c: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** 兩個顏色之間 k（0–1）的位置；看不懂的顏色格式就直接跳過去 */
function mixColor(from: string, to: string, k: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return k < 0.5 ? from : to;
  const [r, g, bl] = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${r}, ${g}, ${bl})`;
}
/** 拖曳距離小於這個值（px）視為點一下，不建立框 */
const MIN_BOX_PX = 6;

/* ── 3D ─────────────────────────────── */
/** 進入 3D 時的傾角（度） */
const PITCH_3D = 50;

/**
 * 地球儀縮小時，底圖的地名只留離畫面中心 LIMB_DEGREES 以內的：靠近地球邊緣的地方被壓扁，
 * 中東、歐洲的國名擠成一團（沙烏地阿拉伯疊在阿拉伯聯合大公國上），還會超出地球畫到太空上。
 * 放大到 LIMB_MAX_ZOOM 以後看不到地球的邊緣，不篩選。
 */
const LIMB_DEGREES = 60;
const LIMB_MAX_ZOOM = 3.5;
/** 中心移動不到這麼多度就不重新篩選：每次篩選底圖的圖磚都要重新解析一次 */
const LIMB_MIN_SHIFT = 4;

/** 以 [經度, 緯度] 為中心、角半徑 degrees 的球冠，寫成經緯度的多邊形（給 MapLibre 的 within 用） */
function sphericalCap([lng0, lat0]: [number, number], degrees: number): GeoJSON.MultiPolygon {
  const rad = Math.PI / 180;
  const d = degrees * rad;
  const φ1 = lat0 * rad;
  const ring: [number, number][] = [];
  for (let i = 0; i <= 96; i++) {
    const bearing = (i / 96) * 2 * Math.PI;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(bearing));
    const λ2 = lng0 * rad + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    let lng = λ2 / rad;
    // 經度展開成連續的（跨過 180° 經線時不跳回 -180°）
    if (ring.length) {
      const prev = ring[ring.length - 1][0];
      while (lng - prev > 180) lng -= 360;
      while (lng - prev < -180) lng += 360;
    }
    // within 用麥卡托座標算，極點是無限遠，緯度夾在 ±85°
    ring.push([lng, Math.max(-85, Math.min(85, φ2 / rad))]);
  }
  // 包含極點時繞一圈經度差了 360°：沿著 85° 緯線接回起點，把極點那一側封起來
  if (Math.abs(ring[ring.length - 1][0] - ring[0][0]) > 180) {
    const pole = lat0 > 0 ? 85 : -85;
    ring.push([ring[ring.length - 1][0], pole], [ring[0][0], pole], ring[0]);
  }
  // 往東、往西各複製一份，跨過 180° 經線的部分也涵蓋得到
  return { type: 'MultiPolygon', coordinates: [-360, 0, 360].map((k) => [ring.map(([x, y]) => [x + k, y])]) };
}
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
/**
 * 深色底圖（深色、深藍）上 0.82 會透出深色的陸地，顏色比圖例暗一截；深色介面預設用深藍底圖之後
 * 改成幾乎不透明，跟圖例對得起來
 */
const DATA_FILL_OPACITY_DARK = 0.94;
const dataFillOpacity = (dark: boolean) => (dark ? DATA_FILL_OPACITY_DARK : DATA_FILL_OPACITY);
/** 流向圖夥伴國的淡底色 */
const FLOW_TINT_OPACITY = 0.6;
/** 類別圖強調某一類時，其他國家（feature-state 'dim'）的不透明度倍數 */
const DIMMED = 0.18;
/** 網格（人口密度、暖化）的 source 與圖層 id */
const GRID_LAYER = 'density-grid';
/** 網格的夜色底（夜間燈光，meta.json 的 backdrop）：插在網格圖層底下 */
const GRID_BACKDROP = 'grid-backdrop';
/** 國旗地圖的點陣圖層（flagTiles.ts 畫的圖磚）與小國的小國旗 */
const FLAG_LAYER = 'flag-raster';
const FLAG_TINY = 'flag-tiny';
/** 國旗放大後稍微透明，看得到底圖的道路與地名 */
const FLAG_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 0.96, 7, 0.78, 10, 0.45];
const FLAG_LEGEND_NOTE = {
  zh: '國旗依國土的形狀縮放、裁切，小國畫成小國旗；點國家看完整的國旗',
  en: 'Flags are scaled and cropped to fit each country; small countries get a small flag. Click a country for the full flag',
};

/** 夜色底的範圍：南北兩條緯線之間的帶子，切成東西兩半（地球儀上一個多邊形從 −180° 繞到 180° 會出問題） */
function backdropBand(south: number, north: number): GeoJSON.FeatureCollection {
  const half = (w: number, e: number): GeoJSON.Feature => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[w, south], [e, south], [e, north], [w, north], [w, south]]] },
  });
  return { type: 'FeatureCollection', features: [half(-180, 0), half(0, 180)] };
}
/** 來源標示是 HTML（MapLibre 的 attribution），meta.json 的文字要跳脫 */
const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 網格放大後稍微透明，看得到底圖的街道與地形，對照格子在哪裡；縮小時顏色要跟圖例一樣 */
const GRID_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 4, 0.92, 9, 0.8, 13, 0.62];

/**
 * 依縮放調整面量圖的不透明度：放大後讓底圖的道路、地形透出來。
 * tint 是流向圖夥伴國的淡底色（feature-state 'tint'），不上色的指標也會用到。
 */
function fillOpacity(on: number, tint = 0): ExpressionSpecification {
  const state: ExpressionSpecification = ['boolean', ['feature-state', 'on'], false];
  const tinted: ExpressionSpecification = ['boolean', ['feature-state', 'tint'], false];
  const dimmed: ExpressionSpecification = ['boolean', ['feature-state', 'dim'], false];
  const at = (k: number): ExpressionSpecification => [
    'case',
    state,
    ['case', dimmed, on * k * DIMMED, on * k],
    tinted,
    tint * k,
    0,
  ];
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
  const tinyOpacity: ExpressionSpecification = ['case', tinyOn, ['case', ['boolean', ['feature-state', 'dim'], false], DIMMED, 1], 0];
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
        'fill-opacity': fillOpacity(dataFillOpacity(dark), FLOW_TINT_OPACITY),
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
      // 選取的國家外框底下墊一圈淺色光暈，在深色的填色上也看得出外框
      id: 'data-halo',
      type: 'line',
      source: 'countries',
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': dark ? '#0b0b0b' : '#ffffff',
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 6.5, 0],
        'line-opacity': 0.9,
        'line-blur': 1,
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
        'circle-opacity': tinyOpacity,
        'circle-stroke-opacity': tinyOpacity,
      },
    },
    {
      // 國旗地圖：小國（跟小國圓點同一批）畫成小國旗；圖示在 flags 的 effect 裡加（addImage）
      id: FLAG_TINY,
      type: 'symbol',
      source: 'tiny',
      maxzoom: 5,
      filter: ['in', ['get', 'iso3'], ['literal', []]],
      layout: {
        visibility: 'none',
        'icon-image': ['concat', 'flag-', ['get', 'iso3']],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.85, 4, 1.15],
      },
      paint: { 'icon-opacity': ['case', ['boolean', ['feature-state', 'dim'], false], DIMMED, 1] },
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
    // 選取的小國家（SELECTED_MARK_KM2）：一個圓圈，白色襯底加深色線，放大後淡出
    {
      id: 'selected-mark-halo',
      type: 'circle',
      source: 'selected-mark',
      maxzoom: 5.5,
      paint: {
        'circle-radius': 11,
        'circle-opacity': 0,
        'circle-stroke-color': dark ? '#0b0b0b' : '#ffffff',
        'circle-stroke-width': 5,
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 5.5, 0],
      },
    },
    {
      id: 'selected-mark',
      type: 'circle',
      source: 'selected-mark',
      maxzoom: 5.5,
      paint: {
        'circle-radius': 11,
        'circle-opacity': 0,
        'circle-stroke-color': ink,
        'circle-stroke-width': 2,
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 4, 1, 5.5, 0],
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
const NO_OVERLAYS: OverlayLayer[] = [];
const NO_PLACES: [string, [number, number]][] = [];

const SPACE_BACKGROUND = `radial-gradient(circle at 50% 50%, ${SPACE_GRADIENT.map(([at, color]) => `${color} ${at * 100}%`).join(', ')})`;

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
  FLAG_TINY,
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
  const { overlays = NO_OVERLAYS, year = 0, renderPointTooltip, places = NO_PLACES, time = null } = props;
  const { basemap, fitOnSelect = false, flows = null, threeD = false, onThreeDChange, focus = null, ref, onFirstData } =
    props;
  const terrain = Boolean(props.terrain);
  const { grid = null, gridFailed = false, flags = null, onBasemapChange } = props;
  const { onViewChange, lineHighlight = null, focusBox = null } = props;
  const flagsOn = indicator.layer.kind === 'flags';
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
  // 最新的 revision：effect 的 cleanup 用來分辨是換了底圖還是其他依賴變了
  const revisionRef = useRef(revision);
  revisionRef.current = revision;
  const ready = revision > 0;
  /** 資料圖層目前是否在地圖上（切換底圖、等新樣式載入的期間是 false） */
  const installedRef = useRef(false);
  /** 分層設色、地形陰影插在這個圖層前面（底圖的水域，海面才會蓋住海底地形） */
  const reliefBeforeRef = useRef<string | undefined>(undefined);
  /**
   * 底圖本身的點陣圖層（彩色地形的 Natural Earth 陰影）：地形圖時被分層設色整個蓋住，面量圖時被國家顏色與
   * 我們的地形陰影蓋住，隱藏起來就不必下載（全球視角約 3 MB）
   */
  const baseRastersRef = useRef<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [globe, setGlobe] = useState(true);
  // MapLibre 5 在地球儀上查不到立體圖形（queryRenderedFeatures 對 fill-extrusion 用的是平面的矩陣），
  // hover、點國家都會失效，所以 3D 時固定用平面地圖；離開 3D 再回到使用者選的投影。
  // 地形圖層的 3D 是立體地形、沒有立體圖形，地球儀上照樣點得到（5.24 實測），維持使用者選的投影
  const flatIn3d = threeD && !terrain;
  const projection: Projection = globe && !flatIn3d ? 'globe' : 'mercator';
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  /** 剛進入 3D 時短暫顯示操作提示 */
  const [threeDHint, setThreeDHint] = useState(false);
  const [hover, setHover] = useState<{
    iso3: string | null;
    x: number;
    y: number;
    airport?: number;
    /** 一般點圖層的點（或有 tooltip 的線）：overlay 的 id 與資料的第幾筆 */
    point?: { overlay: string; index: number };
  } | null>(null);
  /** 一般點圖層與有 tooltip 的線的 MapLibre 圖層 id（上面的在前），hover 與點選時比國家先查 */
  const pointLayersRef = useRef<string[]>([]);
  /** 目前加粗標出的線（有 tooltip 的線圖層）：滑鼠滑到的，沒有時是側欄要標出的（lineHighlightRef） */
  const lineHoverRef = useRef<{ overlay: string; group: number } | null>(null);
  /** 主題側欄要標出的一組線（lineHighlight prop），滑鼠移開線之後回到它 */
  const lineHighlightRef = useRef<{ overlay: string; group: number } | null>(null);
  /** 線寬依欄位變化的線圖層：圖層 id → 欄位（滑過時取最寬的那條） */
  const lineWidthFieldsRef = useRef(new Map<string, string>());
  lineWidthFieldsRef.current = new Map(
    overlays.flatMap((o): [string, string][] =>
      o.kind === 'lines' && typeof o.def.width !== 'number' ? [[o.def.id, o.def.width.field]] : [],
    ),
  );
  const [boxMode, setBoxMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // iPhone 的 Safari 不能讓一般元素全螢幕（只有影片可以），不放全螢幕鈕
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;
  const narrow = useMediaQuery(NARROW_QUERY);
  const coarse = useMediaQuery('(pointer: coarse)');
  // 框選結果卡片放在框的另一側，才不會蓋住框
  const [overlayOnLeft, setOverlayOnLeft] = useState(false);

  // 地圖事件在建立時綁定一次，最新的 props 放在 ref 裡讀
  const latest = useRef({ onSelect, onBoxChange, boxMode });
  latest.current = { onSelect, onBoxChange, boxMode };

  // 分級色、正負色用使用者選的配色（圖例的「配色」，palettes.ts）
  const mapTokens = useMapTokens();
  const colorScale = useMemo(
    () => (indicator.layer.kind === 'choropleth' ? choroplethScale(indicator.layer.scale, mapTokens) : null),
    [indicator, mapTokens],
  );
  const categories = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, mapTokens) : null),
    [indicator, mapTokens],
  );
  // 類別圖的類別、面量圖的分級：圖例滑過（preview）或點選（pinned）的那一類（一級），地圖上其他國家淡化；換指標時清掉
  const [previewCategory, setPreviewCategory] = useState<number | null>(null);
  const [pinnedCategory, setPinnedCategory] = useState<number | null>(null);
  useEffect(() => {
    setPreviewCategory(null);
    setPinnedCategory(null);
  }, [categories, colorScale]);
  const highlightCategory = previewCategory ?? pinnedCategory;
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
  // 地圖上沒有形狀的國家（SHAPELESS）只有圓點；國界還沒載入時不加，第一個畫面不會只剩這幾個點
  const shapeless = useMemo(
    () => (countries.length ? [...SHAPELESS.filter(([iso3]) => !countries.some((c) => c.iso3 === iso3)), ...places] : []),
    [countries, places],
  );
  const anchors = useMemo(
    () => new Map([...shapeless, ...countries.map((c) => [c.iso3, c.anchor] as [string, [number, number]])]),
    [countries, shapeless],
  );
  // 選了要多畫圓圈標記的小國家（含地圖上沒有形狀、只有圓點的）
  const markedCountries = useMemo(
    () =>
      new Set([
        ...countries.filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < SELECTED_MARK_KM2).map((c) => c.iso3),
        ...shapeless.map(([iso3]) => iso3),
      ]),
    [countries, shapeless],
  );
  // 把地圖移到某國時要框住的範圍（主要國土加附近的島，不含遠方屬地）
  const countryBounds = useMemo(() => new Map(countries.map((c) => [c.iso3, focusBounds(c)])), [countries]);
  const tinyCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        ...countries.filter((c) => geoArea(c.feature) * EARTH_RADIUS_KM ** 2 < TINY_KM2).map((c) => [c.iso3, c.anchor] as const),
        ...shapeless,
      ].map(([iso3, anchor]) => ({ type: 'Feature', properties: { iso3 }, geometry: { type: 'Point', coordinates: anchor } })),
    }),
    [countries, shapeless],
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

  /** 每次載入樣式加一；載入時暫時換成海的顏色，用它認出是哪一次（見 installDataLayers） */
  const seaTokenRef = useRef(0);
  const seaTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** 加上資料用的 source 與圖層；建立地圖與切換底圖後都要做 */
  const installDataLayers = (m: MaplibreMap, dark: boolean) => {
    for (const id of ['countries', 'tiny', 'bubbles', 'columns', 'tiny-columns', 'flow-ends']) {
      m.addSource(id, { type: 'geojson', data: EMPTY, promoteId: 'iso3' });
    }
    // lineMetrics：弧線的漸層（line-gradient）要用到沿線的位置
    m.addSource('flows', { type: 'geojson', data: EMPTY, promoteId: 'iso3', lineMetrics: true });
    for (const id of ['railways', 'airports', 'box', 'selected-mark']) m.addSource(id, { type: 'geojson', data: EMPTY });
    // 插在底圖最後一個非文字圖層（道路、國界等）之後：資料蓋在道路上面、文字標籤下面。
    // 不能用「第一個文字圖層」，深色樣式的水域名稱排在很前面，資料會被道路線壓住。
    const styleLayers = m.getStyle().layers;
    const lastShape = styleLayers.reduce((found, l, i) => (l.type === 'symbol' ? found : i), -1);
    const beforeId = styleLayers[lastShape + 1]?.id;
    for (const layer of dataLayers(dark)) m.addLayer(layer, beforeId);
    baseRastersRef.current = styleLayers
      .filter((l) => l.type === 'raster' && l.layout?.visibility !== 'none')
      .map((l) => l.id);
    // 地形：分層設色與陰影插在底圖的水域下面（圖磚含海底地形，由海面蓋住）；3D 地形用另一個 source，
    // MapLibre 建議跟陰影分開，畫質比較好。沒有圖層用到時不會下載圖磚
    m.addSource('dem', demSource());
    m.addSource('dem-3d', demSource());
    const water = styleLayers.find((l) => 'source-layer' in l && l['source-layer'] === 'water')?.id ?? beforeId;
    reliefBeforeRef.current = water;
    m.addLayer(
      {
        id: 'relief-color',
        type: 'color-relief',
        source: 'dem',
        layout: { visibility: 'none' },
        paint: { 'color-relief-color': RELIEF_COLOR },
      },
      water,
    );
    m.addLayer(
      {
        id: 'relief-shade',
        type: 'hillshade',
        source: 'dem',
        layout: { visibility: 'none' },
        paint: { 'hillshade-shadow-color': '#3d3526', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#3d3526' },
      },
      water,
    );
    // 面量圖上的陰影疊在國家顏色上面，也會蓋過底圖的海面（看得到海底地形），所以再疊一份底圖的水域蓋回去
    const waterFill = styleLayers.find((l) => l.type === 'fill' && l['source-layer'] === 'water');
    if (waterFill?.type === 'fill') {
      m.addLayer({ ...waterFill, id: 'relief-water', layout: { ...waterFill.layout, visibility: 'none' } }, beforeId);
    }
    // 底圖圖磚還沒到時，MapLibre 用 background 圖層（陸地的顏色，彩色地形是米白）畫整顆地球：開頁時是一顆白球。
    // 先把它換成海的顏色，圖磚第一次全部到齊（idle）再換回來（樣式的 300 ms 過渡）。
    // 分頁在背景時不會畫、也就不會 idle，最多 10 秒也換回來，陸地不會一直是海的顏色
    const background = styleLayers.find((l) => l.type === 'background');
    const sea = waterFill?.type === 'fill' ? waterFill.paint?.['fill-color'] : undefined;
    if (background && typeof sea === 'string') {
      const land = m.getPaintProperty(background.id, 'background-color');
      const token = ++seaTokenRef.current;
      m.setPaintProperty(background.id, 'background-color', sea);
      const restore = () => {
        clearTimeout(seaTimerRef.current);
        m.off('idle', restore);
        // 圖磚到齊前又換了底圖：新的樣式自己會換回來，不要把舊樣式的陸地顏色套上去
        if (seaTokenRef.current === token && m.getLayer(background.id)) {
          m.setPaintProperty(background.id, 'background-color', land);
        }
      };
      // 地圖拿掉時（換到排名表）由建立地圖的 effect 清掉，不然 10 秒後會對已經拿掉的地圖動手
      clearTimeout(seaTimerRef.current);
      seaTimerRef.current = setTimeout(restore, SEA_PLACEHOLDER_MAX_MS);
      m.once('idle', restore);
    }
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
      clearTimeout(seaTimerRef.current);
      installedRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const hoverIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ start: [number, number]; startPoint: { x: number; y: number } } | null>(null);
  const suppressClickRef = useRef(false);

  function bindEvents(map: MaplibreMap) {
    // lines 為 false 時略過線的查詢層：點一下電纜經過的陸地要選到國家，不是取消選取
    const featureAt = (point: { x: number; y: number }, lines = true): MapGeoJSONFeature | null => {
      for (const id of [...pointLayersRef.current, ...HOVER_LAYERS]) {
        if (!lines && lineOverlayAt(id)) continue;
        if (!map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none') continue;
        const found = map.queryRenderedFeatures([point.x, point.y], { layers: [id] });
        // 線寬依欄位變化的線（河流）：游標附近好幾條時取最寬的那條（大河），不是剛好排在前面的小支流
        const line = lineOverlayAt(id);
        const field = line ? lineWidthFieldsRef.current.get(line) : undefined;
        if (field && found.length > 1) {
          return found.reduce((a, b) => (Number(b.properties?.[field] ?? 0) > Number(a.properties?.[field] ?? 0) ? b : a));
        }
        if (found[0]) return found[0];
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
      // 海上的地震沒有國家，照樣顯示 tooltip；線（海底電纜）也是
      const line = f ? lineOverlayAt(f.layer.id) : null;
      const point =
        f && f.layer.id.startsWith(OVERLAY_PREFIX)
          ? { overlay: line ?? f.layer.id.slice(OVERLAY_PREFIX.length), index: Number(f.properties.i) }
          : undefined;
      const lineHover = line && f ? { overlay: line, group: Number(f.properties.g) } : lineHighlightRef.current;
      highlightLine(map, lineHoverRef.current, lineHover);
      lineHoverRef.current = lineHover;
      setHoverId(iso3);
      map.getCanvas().style.cursor = iso3 || point ? 'pointer' : '';
      setHover(
        iso3 || point
          ? {
              iso3,
              x: e.point.x,
              y: e.point.y,
              airport: f?.layer.id.startsWith('airports') ? Number(f.properties.i) : undefined,
              point,
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
      highlightLine(map, lineHoverRef.current, lineHighlightRef.current);
      lineHoverRef.current = lineHighlightRef.current;
    });
    map.on('click', (e) => {
      if (suppressClickRef.current || latest.current.boxMode) {
        suppressClickRef.current = false;
        return;
      }
      const f = featureAt(e.point, false);
      let iso3 = (f?.properties?.iso3 as string | undefined) ?? null;
      // 點圖層的點沒有國家欄位時（便利商店與連鎖品牌的店家），選取點底下的國家，不要取消選取
      if (!iso3 && f?.layer.id.startsWith(OVERLAY_PREFIX)) {
        for (const id of HOVER_LAYERS) {
          if (!map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none') continue;
          const [c] = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [id] });
          iso3 = (c?.properties?.iso3 as string | undefined) ?? null;
          if (iso3) break;
        }
      }
      latest.current.onSelect(iso3);
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
      lineHoverRef.current = null;
      selectedRef.current = null;
      map.once('style.load', () => {
        if (cancelled) return;
        installDataLayers(map, basemap.dark);
        loadedBasemapRef.current = basemap.id;
        setRevision((r) => r + 1);
      });
      // 3D 地形開著時直接換樣式，MapLibre 會拿舊樣式的地形去畫新樣式而出錯（shaderPreludeCode）；
      // 先拿掉，新樣式載入後 revision 變了，地形的 effect 會重新加上
      if (map.getTerrain()) map.setTerrain(null);
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

  // 面量圖、類別圖開著時隱藏底圖的國界（改畫 data-border），其他時候用底圖的國界
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const own = indicator.layer.kind === 'choropleth' || indicator.layer.kind === 'categorical' || flagsOn;
    for (const layer of map.getStyle().layers) {
      if ('source-layer' in layer && layer['source-layer'] === 'boundary' && BASEMAP_COUNTRY_BORDER.test(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', own ? 'none' : 'visible');
      }
    }
  }, [revision, indicator.layer.kind, flagsOn]);

  /* ── 資料 → 地圖 ─────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    (map.getSource('countries') as GeoJSONSource).setData(countryCollection);
    (map.getSource('tiny') as GeoJSONSource).setData(tinyCollection);
    (map.getSource('tiny-columns') as GeoJSONSource).setData(tinyColumnCollection);
  }, [revision, countryCollection, tinyCollection, tinyColumnCollection]);

  // 面量圖、類別圖的顏色（與面量圖的 3D 高度）放在 feature-state，換年份時只改狀態，不重送幾何。
  // 顏色換年份、換指標時漸變（FILL_FADE_MS）：feature-state 的改變 MapLibre 不會自己做過渡，所以逐格算中間色
  const fillShownRef = useRef(new Map<string, string>());
  const fillFrameRef = useRef(0);
  const fillRevisionRef = useRef(-1);
  /** 上一次顏色改變的時間（performance.now()） */
  const fillChangedRef = useRef(-Infinity);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 國旗地圖：國家本身不上色（data-fill 透明，見 3D 的 effect），on 讓國界照常畫在國旗上
    const on = indicator.layer.kind === 'choropleth' || indicator.layer.kind === 'categorical' || flagsOn;
    const thresholds = colorScale?.domain() ?? [];
    const colorOf = (v: number | undefined) =>
      // 類別圖裡不屬於任何一類（也沒有「其他」）的代碼當成無資料
      v === undefined ? null : colorScale ? colorScale(v) : (categories?.color(v) ?? null);
    /** iso3 → 要畫的顏色；shapeless 的國家只有 tiny 的圓點 */
    const target = new Map<string, string>();
    for (const c of countries) {
      const v = values.get(c.iso3);
      const color = colorOf(v);
      // 類別沒有高低，3D 時不拉高（只傾斜地圖），高度只給面量圖
      const h = on && v !== undefined && colorScale ? classHeight(thresholds, v) : 0;
      map.setFeatureState({ source: 'countries', id: c.iso3 }, { on, h });
      map.setFeatureState({ source: 'tiny-columns', id: c.iso3 }, { on, h });
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { on: on && color !== null });
      target.set(c.iso3, on && color !== null ? color : NO_DATA);
    }
    const shapelessIds = new Set<string>();
    for (const [iso3] of shapeless) {
      const color = colorOf(values.get(iso3));
      map.setFeatureState({ source: 'tiny', id: iso3 }, { on: on && color !== null });
      target.set(iso3, color ?? NO_DATA);
      shapelessIds.add(iso3);
    }
    const paint = (iso3: string, fill: string) => {
      if (!shapelessIds.has(iso3)) {
        map.setFeatureState({ source: 'countries', id: iso3 }, { fill });
        map.setFeatureState({ source: 'tiny-columns', id: iso3 }, { fill });
      }
      map.setFeatureState({ source: 'tiny', id: iso3 }, { fill });
    };

    const shown = fillShownRef.current;
    const now = performance.now();
    // 換底圖後 feature-state 都清掉了，第一次畫、連續變化（播放、拖時間軸）、使用者要求減少動態效果時直接換
    const fade =
      revision === fillRevisionRef.current &&
      shown.size > 0 &&
      now - fillChangedRef.current >= FILL_FADE_MS &&
      !matchMedia(REDUCED_MOTION).matches;
    fillRevisionRef.current = revision;
    fillChangedRef.current = now;
    if (!fade) {
      for (const [iso3, fill] of target) {
        paint(iso3, fill);
        shown.set(iso3, fill);
      }
      return;
    }
    const changes = [...target].flatMap(([iso3, to]) => {
      const from = shown.get(iso3) ?? to;
      return from === to ? [] : [{ iso3, from, to }];
    });
    if (!changes.length) return;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / FILL_FADE_MS);
      const eased = 1 - (1 - k) ** 3;
      for (const { iso3, from, to } of changes) {
        const fill = k === 1 ? to : mixColor(from, to, eased);
        paint(iso3, fill);
        shown.set(iso3, fill);
      }
      if (k < 1) fillFrameRef.current = requestAnimationFrame(step);
    };
    fillFrameRef.current = requestAnimationFrame(step);
    // 漸變到一半又換年份：從畫面上現在的中間色接著變（shown 已經記下）
    return () => cancelAnimationFrame(fillFrameRef.current);
  }, [revision, countries, shapeless, values, colorScale, categories, indicator.layer.kind, flagsOn]);

  // 強調圖例上的某一類（類別圖）或某一級（面量圖，d3 的 scaleThreshold 也是用 bisectRight 分級），其他國家淡化
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const thresholds = colorScale?.domain();
    const classOf = (v: number) => (categories ? categories.index(v) : thresholds ? bisectRight(thresholds, v) : null);
    const dimOf = (v: number | undefined) =>
      highlightCategory !== null && (categories !== null || colorScale !== null) && (v === undefined || classOf(v) !== highlightCategory);
    for (const c of countries) {
      const dim = dimOf(values.get(c.iso3));
      map.setFeatureState({ source: 'countries', id: c.iso3 }, { dim });
      map.setFeatureState({ source: 'tiny', id: c.iso3 }, { dim });
    }
    for (const [iso3] of shapeless) {
      map.setFeatureState({ source: 'tiny', id: iso3 }, { dim: dimOf(values.get(iso3)) });
    }
  }, [revision, countries, shapeless, values, categories, colorScale, highlightCategory]);

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

  // 國界與選取外框的顏色：深色底圖或夜色底上用淺色，其他用深色（跟 dataLayers 一樣）
  const nightLook = basemap.dark || backdrop !== null;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    map.setPaintProperty('data-border', 'line-color', nightLook ? '#f0efec' : '#3d3d3a');
    map.setPaintProperty('data-highlight', 'line-color', nightLook ? '#ffffff' : MAP_TOKENS.ink);
    map.setPaintProperty('data-halo', 'line-color', nightLook ? '#0b0b0b' : '#ffffff');
    map.setPaintProperty('selected-mark', 'circle-stroke-color', nightLook ? '#ffffff' : MAP_TOKENS.ink);
    map.setPaintProperty('selected-mark-halo', 'circle-stroke-color', nightLook ? '#0b0b0b' : '#ffffff');
  }, [revision, nightLook]);

  // 地球儀縮小時，底圖的地名只留離畫面中心 LIMB_DEGREES 以內的（見 sphericalCap）；移動結束時更新
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 換底圖後是新的樣式：記下地名圖層原本的篩選條件
    const labels = map
      .getStyle()
      .layers.filter(
        (l): l is Extract<LayerSpecification, { type: 'symbol' }> =>
          l.type === 'symbol' && ['place', 'water_name'].includes((l as { 'source-layer'?: string })['source-layer'] ?? ''),
      )
      .map((l) => ({ id: l.id, filter: l.filter }));
    let applied: [number, number] | null = null;
    const restore = () => {
      if (!applied) return;
      for (const l of labels) if (map.getLayer(l.id)) map.setFilter(l.id, l.filter ?? null);
      applied = null;
    };
    const update = () => {
      if (projection !== 'globe' || map.getZoom() >= LIMB_MAX_ZOOM) return restore();
      const c = map.getCenter();
      const center: [number, number] = [c.lng, c.lat];
      if (applied && geoDistance(applied, center) < LIMB_MIN_SHIFT * (Math.PI / 180)) return;
      const within: ExpressionSpecification = ['within', sphericalCap(center, LIMB_DEGREES)];
      for (const l of labels) map.setFilter(l.id, l.filter ? ['all', l.filter as ExpressionSpecification, within] : within);
      applied = center;
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
      // 換了底圖（revision 變了）是新的樣式，本來就沒有篩選；只有切換平面、地球儀時要還原。
      // 元件卸載時地圖可能已經 remove()，那時不必還原
      if (revisionRef.current === revision && installedRef.current) restore();
    };
  }, [revision, projection]);

  // 網格第一次畫好：留下 performance mark「map-grid」給載入速度量測用（npm run measure:load -- <網址> --mark map-grid）
  const gridShownRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !gridUrl || gridShownRef.current) return;
    let tileLoaded = false;
    const onData = (e: MapSourceDataEvent) => {
      if (e.sourceId === GRID_LAYER && e.tile) tileLoaded = true;
    };
    const onRender = () => {
      if (!tileLoaded || !map.getSource(GRID_LAYER) || !map.isSourceLoaded(GRID_LAYER)) return;
      map.off('render', onRender);
      gridShownRef.current = true;
      performance.mark('map-grid');
    };
    map.on('sourcedata', onData);
    map.on('render', onRender);
    return () => {
      map.off('sourcedata', onData);
      map.off('render', onRender);
    };
  }, [revision, gridUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const entries =
      indicator.layer.kind === 'bubble' ? [...values].filter(([iso3, v]) => v > 0 && anchors.has(iso3)) : [];
    const features: GeoJSON.Feature[] = entries.map(([iso3, v]) => ({
      type: 'Feature',
      properties: { iso3, r: Math.max(BUBBLE_MIN_RADIUS, radius(v)) },
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

  /* ── 一般的點、線疊加圖層（overlayLayers.ts） ── */
  const overlaySentRef = useRef<{ revision: number; cache: OverlayDataCache }>({ revision: -1, cache: new Map() });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    // 換底圖後新樣式沒有這些 source，資料要重送
    if (overlaySentRef.current.revision !== revision) overlaySentRef.current = { revision, cache: new Map() };
    // 換年份時也要同步：有 epochs 的點圖層（城市每 5 年一期的人口）換到另一期要重送資料，其他圖層不會重送
    pointLayersRef.current = syncOverlays(map, overlays, overlaySentRef.current.cache, basemap.dark, year);
    applyTimeFilters(map, overlays, year, indicator.overlayTime);
    // 換底圖後新的圖層一開始沒有標出任何線：重新標出目前要標的那一組
    const shown = lineHoverRef.current ?? lineHighlightRef.current;
    if (shown) highlightLine(map, null, shown);
    lineHoverRef.current = shown;
  }, [revision, overlays, year, indicator.overlayTime]);

  /* ── 晝夜（時刻主題，nightLayer.ts）：換時刻只換太陽的方向與直射點，換底圖後重新加上 ── */
  const night = overlays.find((o) => o.kind === 'night');
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    syncNight(map, night?.def.id ?? null, Boolean(night?.visible), basemap.dark, time);
  }, [revision, night?.def.id, night?.visible, basemap.dark, time]);

  /* ── 主題側欄要標出的一組線（例如滑到某條河）：跟滑鼠滑過共用同一層 ── */
  useEffect(() => {
    const map = mapRef.current;
    lineHighlightRef.current = lineHighlight;
    if (!ready || !map || !installedRef.current) return;
    highlightLine(map, lineHoverRef.current, lineHighlight);
    lineHoverRef.current = lineHighlight;
  }, [revision, lineHighlight]);

  /* ── 主題側欄點某條河：把地圖移到它的範圍 ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusBox) return;
    const [w, s, e, n] = focusBox.box;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 48, maxZoom: 8, duration: 900, bearing: map.getBearing() },
    );
    // 只依 key：同一個範圍再點一次也要移過去
  }, [focusBox?.key]);

  /* ── 回報縮放與畫面範圍（線圖層的 detail 依它下載分區） ── */
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const wantsView = Boolean(onViewChange);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !wantsView) return;
    const report = () => {
      const b = map.getBounds();
      onViewChangeRef.current?.({ zoom: map.getZoom(), bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] });
    };
    report();
    map.on('moveend', report);
    return () => {
      map.off('moveend', report);
    };
  }, [ready, wantsView]);

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
    const mark = selected && markedCountries.has(selected) ? anchors.get(selected) : undefined;
    (map.getSource('selected-mark') as GeoJSONSource).setData(
      mark ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: mark } } : EMPTY,
    );
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
  }, [revision, selected, anchors, fitOnSelect, countryBounds, markedCountries]);

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
  // data-fill 留著（透明）當點選的備援。
  // 1 km 網格：國家不上色（data-fill 透明，hover、點選照舊），國界照畫；3D 時網格維持平面、國家不拉高，
  // 只是把地圖傾斜（點陣圖沒辦法依格子拉高，拉高國家平均又會跟網格的顏色對不起來）
  const gridOn = Boolean(gridUrl);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const kind = indicator.layer.kind;
    // 有地形圖層的主題，3D 是真的立體地形（另一個 effect），國家的顏色貼在地形上，不另外拉高
    const extrude = threeD && !terrain;
    const slabs = extrude && kind === 'choropleth' && !gridOn;
    const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    show('extrude-countries', slabs);
    show('extrude-tiny', slabs);
    show('extrude-columns', extrude && kind === 'bubble');
    show('bubbles', !extrude);
    show('data-tiny', !slabs && !gridOn && !flagsOn);
    show('data-border', !slabs);
    show('data-highlight', !slabs);
    show('data-halo', !slabs);
    // 要維持同一種運算式（依縮放與 feature-state）：改成常數 0 的話，舊圖磚在重新排版前遇到 hover
    // 更新 feature-state，MapLibre 會對常數呼叫 evaluate 而丟出 TypeError
    map.setPaintProperty(
      'data-fill',
      'fill-opacity',
      fillOpacity(slabs || gridOn || flagsOn ? 0 : dataFillOpacity(basemap.dark), FLOW_TINT_OPACITY),
    );
    // 平面時鐵路在比例圓下面；3D 時改畫在立體圖形上面，否則會被整片蓋住
    map.moveLayer('rail', extrude ? 'airports-medium' : 'data-tiny');
  }, [revision, threeD, indicator.layer.kind, gridOn, terrain, flagsOn, basemap.dark]);

  // 地形圖層：地形圖（kind 'terrain'）畫分層設色，陰影疊在上面；面量圖只疊陰影，而且移到國家顏色上面，
  // 看得出起伏。陰影可以在左下角關掉
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    const reliefMap = terrain && indicator.layer.kind === 'terrain';
    const shade = terrain && layers.hillshade;
    map.setLayoutProperty('relief-color', 'visibility', reliefMap ? 'visible' : 'none');
    map.setLayoutProperty('relief-shade', 'visibility', shade ? 'visible' : 'none');
    for (const id of baseRastersRef.current) {
      map.setLayoutProperty(id, 'visibility', reliefMap || shade ? 'none' : 'visible');
    }
    map.moveLayer('relief-shade', reliefMap ? reliefBeforeRef.current : 'data-border');
    if (map.getLayer('relief-water')) {
      map.setLayoutProperty('relief-water', 'visibility', shade && !reliefMap ? 'visible' : 'none');
      map.moveLayer('relief-water', 'data-border');
    }
    map.setPaintProperty('relief-shade', 'hillshade-exaggeration', reliefMap ? 0.55 : 0.4);
  }, [revision, terrain, indicator.layer.kind, layers.hillshade]);

  // 3D 立體地形（有地形圖層的主題）。全球視角時要放大很多倍才看得出起伏，縮放結束時依縮放級數換倍率；
  // 切換底圖後新樣式沒有地形，revision 變了會重新設定
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !installedRef.current) return;
    if (!terrain || !threeD) {
      if (map.getTerrain()) map.setTerrain(null);
      return;
    }
    let level = terrainExaggeration(map.getZoom());
    map.setTerrain({ source: 'dem-3d', exaggeration: level });
    const onZoomEnd = () => {
      const next = terrainExaggeration(map.getZoom());
      // 切換底圖、新樣式還沒載入時不能設定地形（新樣式載入後這個 effect 會重跑）
      if (next === level || !installedRef.current) return;
      level = next;
      map.setTerrain({ source: 'dem-3d', exaggeration: next });
    };
    map.on('zoomend', onZoomEnd);
    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [revision, terrain, threeD]);

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

  // 手機上 3D、全螢幕、框選收進「更多」（MoreMenu.tsx），按鈕列剩回到全球、平面／地球儀、底圖、更多。
  // 只有一項時照樣放在按鈕列，不必多點一下
  const moreItems: MoreMenuItem[] = [
    ...(onThreeDChange ? [{ id: '3d', label: t.threeD, checked: threeD, onSelect: toggleThreeD }] : []),
    ...(canFullscreen ? [{ id: 'fullscreen', label: fullscreen ? t.exitFullscreen : t.fullscreen, onSelect: toggleFullscreen }] : []),
    ...(onBoxChange
      ? [{ id: 'box', label: boxToolLabel, checked: boxMode, disabled: threeD, note: t.boxIn3d, onSelect: () => setBoxMode((m) => !m) }]
      : []),
  ];
  const collapseMore = narrow && moreItems.length > 1;

  // 網格的圖例：顏色、門檻用 meta.json 的（跟圖磚裡畫的一樣），寫出是哪一期
  const gridLegend = useMemo(() => {
    if (!grid) return null;
    const g = gridLabels(grid.spec, lang);
    const { meta, epoch } = grid;
    const projected = meta.projectionFrom !== undefined && epoch >= meta.projectionFrom;
    return {
      title: g.title(legendTitle),
      // 網格有自己的單位時（航運密度），圖例用它，不用指標的
      indicator: grid.spec.unit ? { ...indicator, unit: grid.spec.unit } : indicator,
      scale: gridScale(meta),
      notes: [g.note(epoch, projected), ...(threeD ? [g.flatIn3d] : [])],
      emptyKey: g.empty(meta),
    };
  }, [grid, lang, legendTitle, threeD, indicator]);

  const hasOverlays = Boolean(railways || airports || terrain || overlays.length);
  const reliefLegend = useMemo(
    () => (terrain && indicator.layer.kind === 'terrain' ? reliefLegendModel(indicator.formatTick ?? indicator.format) : null),
    [terrain, indicator, lang],
  );
  // 流向圖還沒選國家時，提示使用者點一下；選了但那一年沒有資料也要說
  const flowLayer = indicator.layer.kind === 'flow' ? indicator.layer : null;
  const flowHint =
    !flowLayer || boxMode
      ? null
      : !selected
        ? flowText(flowLayer, lang).pick(flowText(flowLayer, lang).pickPartners)
        : flows?.origin === selected && flows.links.length === 0
          ? flowText(flowLayer, lang).noData(flows.year, flowText(flowLayer, lang)[flows.direction].partners)
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
        const valueLegend: ImageLegend | null = colorScale
          ? { kind: 'choropleth', title, unit, model: choroplethLegendModel(indicator, colorScale), stepped: threeD && !terrain }
          : reliefLegend
            ? { kind: 'relief', title: tr(RELIEF_TITLE, lang), unit, model: reliefLegend }
            : categories
              ? { kind: 'categorical', title, model: categoricalLegendModel(categories, values) }
          : indicator.layer.kind !== 'bubble'
            ? flowLayer && flows && flowMax > 0
              ? { kind: 'flow', title, unit, model: flowLegendModel(indicator, flows.direction, flowMax) }
              : null
            : threeD
              ? { kind: 'column', title, unit, model: columnLegendModel(indicator, bubbleMax), color: MAP_TOKENS.accent }
              : { kind: 'bubble', title, unit, model: bubbleLegendModel(indicator, radius) };
        // 網格：網格的分級、哪一期、不上色的格子
        const legend: ImageLegend | null = gridLegend
          ? {
              kind: 'choropleth',
              title: gridLegend.title,
              unit: gridLegend.indicator.unit,
              model: choroplethLegendModel(gridLegend.indicator, gridLegend.scale),
              notes: gridLegend.notes,
              emptyKey: gridLegend.emptyKey,
            }
          : valueLegend;
        const layerKeys = onLayersChange
          ? exportLayerKeys(
              LAYER_KEYS.filter((k) => ({ railways, airports, terrain })[k.source] && layers[k.key]).map((key) => ({
                key,
                color: layerKeyColor(key, tokens),
              })),
              overlays,
              tokens,
              basemapRef.current.dark,
            )
          : [];
        const { canvas, ratio } = await captureMap(map);
        return canvasToPng(composeMapImage(canvas, ratio, { ...content, legend, layerKeys, tokens }));
      },
    }),
    [colorScale, categories, values, radius, indicator, legendTitle, onLayersChange, railways, airports, terrain, layers, overlays, tokens, threeD, bubbleMax, flowLayer, flows, flowMax, gridLegend, reliefLegend, lang],
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
        {/* 觸控裝置用兩指縮放，不放放大、縮小鈕（鍵盤的 +/− 照樣可以用） */}
        {!coarse && (
          <>
            <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={t.zoomIn} title={t.zoomIn}>
              <PlusIcon />
            </button>
            <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={t.zoomOut} title={t.zoomOut}>
              <MinusIcon />
            </button>
          </>
        )}
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
          <ResetIcon />
        </button>
        <button
          type="button"
          onClick={() => !flatIn3d && setGlobe((g) => !g)}
          aria-disabled={flatIn3d}
          aria-label={projection === 'globe' ? t.toFlat : t.toGlobe}
          title={flatIn3d ? t.globeIn3d : projection === 'globe' ? t.toFlat : t.toGlobe}
        >
          {projection === 'globe' ? <FlatIcon /> : <GlobeIcon />}
        </button>
        {!collapseMore && onThreeDChange && (
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
        {!collapseMore && canFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
            title={fullscreen ? t.exitFullscreen : t.fullscreen}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
        {onBasemapChange && <BasemapMenu basemap={basemap} onChange={onBasemapChange} />}
        {collapseMore && <MoreMenu items={moreItems} />}
        {!collapseMore && onBoxChange && (
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
      {gridFailed && !boxMode && !threeDHint && <div className="map-hint">{gridLabels(indicator.grid ?? { dir: '' }, lang).failed}</div>}
      {threeDHint && (
        <div className="map-hint is-wrap">
          {matchMedia('(pointer: coarse)').matches ? t.threeDHintTouch : t.threeDHintMouse}
          {globe && !terrain && t.threeDHintGlobe}
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
            hasTerrain={terrain}
            overlays={overlays}
            tokens={tokens}
            darkMap={basemap.dark}
          />
        )}
        {gridLegend ? (
          <ChoroplethLegend
            indicator={gridLegend.indicator}
            title={gridLegend.title}
            scale={gridLegend.scale}
            notes={gridLegend.notes}
            emptyKey={gridLegend.emptyKey}
          />
        ) : colorScale ? (
          <ChoroplethLegend
            indicator={indicator}
            title={legendTitle}
            scale={colorScale}
            stepped={threeD && !terrain}
            paletteKind={indicator.layer.kind === 'choropleth' ? indicator.layer.scale.type : undefined}
            // 3D 的立體圖形沒有淡化，不能點選分級
            classes={
              threeD
                ? undefined
                : { values, highlight: highlightCategory, onPreview: setPreviewCategory, pinned: pinnedCategory, onPin: setPinnedCategory }
            }
          />
        ) : reliefLegend ? (
          <ReliefLegend title={tr(RELIEF_TITLE, lang)} unit={indicator.unit} model={reliefLegend} />
        ) : categories ? (
          <CategoricalLegend
            title={legendTitle}
            scale={categories}
            values={values}
            highlight={highlightCategory}
            onPreview={setPreviewCategory}
            pinned={pinnedCategory}
            onPin={setPinnedCategory}
            paletteKind={
              indicator.layer.kind === 'categorical'
                ? indicator.layer.diverging
                  ? 'diverging'
                  : indicator.layer.ordinal
                    ? 'sequential'
                    : undefined
                : undefined
            }
          />
        ) : indicator.layer.kind === 'bubble' ? (
          threeD ? (
            <ColumnLegend indicator={indicator} title={legendTitle} max={bubbleMax} color={MAP_TOKENS.accent} tokens={tokens} />
          ) : (
            <BubbleLegend indicator={indicator} title={legendTitle} radius={radius} tokens={tokens} />
          )
        ) : flowLayer && flows && flowMax > 0 ? (
          <FlowLegend indicator={indicator} title={legendTitle} direction={flows.direction} max={flowMax} tokens={tokens} />
        ) : flagsOn ? (
          <div className="legend legend-flags">
            <div className="legend-title">{legendTitle}</div>
            <div className="legend-note">{tr(FLAG_LEGEND_NOTE, lang)}</div>
          </div>
        ) : null}
      </div>

      {hover && size && (
        <MapTooltip x={hover.x} y={hover.y} width={size.width} height={size.height}>
          {hover.point && renderPointTooltip
            ? renderPointTooltip(hover.point.overlay, hover.point.index)
            : hover.airport !== undefined && renderAirportTooltip
              ? renderAirportTooltip(hover.airport)
              : hover.iso3 && renderTooltip(hover.iso3)}
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
