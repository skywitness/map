/**
 * 地圖（WorldMap.tsx）的常數、輔助函式與資料圖層的定義（2026-10-29 從 WorldMap.tsx 拆出來，元件本身只留狀態與 effect）。
 */
import { bisectRight } from 'd3-array';
import type { DataDrivenPropertyValueSpecification, ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { MAP_TOKENS, SPACE_GRADIENT, SPACE_GRADIENT_LIGHT, TOKENS } from '../theme/tokens';
import { flowColors } from './flows';
import type { OverlayLayer } from './Overlays';
import { WORLD_SUFFIX } from './style';

export const INITIAL_CENTER: [number, number] = [105, 22];

/** 讓地球儀的直徑大約等於地圖高度（MapLibre 的地球半徑約為 512·2^z / 2π 的 0.85 倍） */
export function fitGlobeZoom(height: number): number {
  return Math.log2((0.5 * height * 2 * Math.PI) / 512 / 0.85);
}
export const MAX_ZOOM = 18;
/** 放大到這一級（或比預設的全球視角大 0.5 級）就要 1:50m 的國界（onDetailNeeded） */
export const DETAIL_ZOOM = 3;
/** 面積小於這個值（km²）的國家在低縮放時另外畫一個點，才看得到也點得到 */
export const TINY_KM2 = 6000;
/**
 * 選取的國家比這小時多畫一個圓圈標記：全球視角下台灣（3.6 萬 km²）只有十來個像素，外框幾乎看不到。
 * 南韓（10 萬）、葡萄牙、匈牙利也算；放大到 5 級以後國家本身夠大，圓圈淡出
 */
export const SELECTED_MARK_KM2 = 120_000;

/**
 * 選取小國家的圓圈半徑（px）：圈住國名。底圖的國名差不多在同一個位置，原本固定 11px 的圓圈壓在字上
 * （「台灣」約 26px 寬）。中日文的字約 13px、拉丁字母約 7px 寬，最少 11、最多 22px（英文的長國名不讓圓圈太大，
 * 小國在全球視角多半沒有國名，太大的圓圈會壓到旁邊國家的國名）
 */
export function markRadius(name: string): number {
  let width = 0;
  for (const ch of name) width += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 13 : 7;
  return Math.max(11, Math.min(22, width / 2 + 6));
}
/**
 * 1:50m 國界沒有形狀的國家（DESIGN.md 第 8 節第 8 點），用首府的位置畫小國圓點，也當比例圓、弧線的位置；
 * 否則吐瓦魯（台灣的邦交國）在地圖上完全看不到
 */
export const SHAPELESS: [string, [number, number]][] = [
  ['TUV', [179.19, -8.52]],
  ['TKL', [-171.85, -9.2]],
  ['GIB', [-5.35, 36.14]],
];
export const EARTH_RADIUS_KM = 6371.0088;
export const NO_DATA = MAP_TOKENS.noData;
/**
 * 換年份、換指標時國家顏色的漸變時間（毫秒）。播放（一年 120 ms）時用間隔的一部分（FILL_FADE_SHARE），
 * 拖時間軸時間隔太短（FILL_FADE_MIN_MS），直接換，顏色才不會落後拉桿一兩年
 */
export const FILL_FADE_MS = 280;
/** 播放、連續換年份時的漸變最多佔間隔的幾成（2026-10-29）：一年 120 ms 時漸變約 70 ms，不會落後；拖拉桿時間隔太短，直接換 */
export const FILL_FADE_SHARE = 0.6;
/** 間隔短於這個（拖時間軸）就不漸變 */
export const FILL_FADE_MIN_MS = 60;
/** 換指標、主題時的漸變（比換年份慢，看得出整張地圖換了；新的資料到了才開始，見 App.tsx 的 mapShot） */
export const FILL_SWITCH_MS = 450;
/** 選取的國家外框底下光暈的寬度（px）；新選到時從更寬收到這個寬度（SELECT_PULSE_MS） */
export const HALO_WIDTH = 6.5;
export const SELECT_PULSE_MS = 450;
/** 滑過的國家蓋一層白色（加亮）的不透明度 */
export const HOVER_LIGHTEN = 0.16;
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** 載入時暫時把陸地畫成海的顏色，最多這麼久（見 installDataLayers） */
export const SEA_PLACEHOLDER_MAX_MS = 10_000;

/** '#rrggbb' 或 'rgb(r, g, b)' → [r, g, b] */
export function parseColor(c: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(c);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** 兩個顏色之間 k（0–1）的位置；看不懂的顏色格式就直接跳過去 */
export function mixColor(from: string, to: string, k: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return k < 0.5 ? from : to;
  const [r, g, bl] = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${r}, ${g}, ${bl})`;
}
/** 地圖至少這麼寬才列出數值最高、最低的國家（Extremes）：地球儀兩旁才有空位 */
export const EXTREMES_MIN_WIDTH = 1000;
/** 世界視角蓋住地形陰影海面的水域（installDataLayers） */
export const RELIEF_WATER_WORLD = 'relief-water' + WORLD_SUFFIX;
/** 拖曳距離小於這個值（px）視為點一下，不建立框 */
export const MIN_BOX_PX = 6;

/* ── 3D ─────────────────────────────── */
/** 進入 3D 時的傾角（度） */
export const PITCH_3D = 50;

/**
 * 地球儀縮小時，底圖的地名只留離畫面中心 LIMB_DEGREES 以內的：靠近地球邊緣的地方被壓扁，
 * 中東、歐洲的國名擠成一團（沙烏地阿拉伯疊在阿拉伯聯合大公國上），還會超出地球畫到太空上。
 * 放大到 LIMB_MAX_ZOOM 以後看不到地球的邊緣，不篩選。
 */
export const LIMB_DEGREES = 60;
export const LIMB_MAX_ZOOM = 3.5;
/** 中心移動不到這麼多度就不重新篩選：每次篩選底圖的圖磚都要重新解析一次 */
export const LIMB_MIN_SHIFT = 4;

/** 以 [經度, 緯度] 為中心、角半徑 degrees 的球冠，寫成經緯度的多邊形（給 MapLibre 的 within 用） */
export function sphericalCap([lng0, lat0]: [number, number], degrees: number): GeoJSON.MultiPolygon {
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
export const MAX_COLUMN_M = 4_000_000;
export const MAX_SLAB_M = 1_000_000;
/** 柱子的底面半徑（km）；固定大小，數值再小的國家也看得到一個圓盤 */
export const COLUMN_RADIUS_KM = 90;
/** 小國在 3D 面量圖裡改用圓柱（多邊形太小，拉高後只剩一條線） */
export const TINY_COLUMN_RADIUS_KM = 45;

/**
 * 3D 高度：fraction（0–1）× 最大高度。放大一級高度減半，柱子在畫面上的高度大致不變，
 * 放大到城市時才不會整個畫面都是柱子；同一個縮放下各國的高度仍然成比例。
 */
export function extrusionHeight(fraction: ExpressionSpecification, maxMeters: number): ExpressionSpecification {
  const stops: (number | ExpressionSpecification)[] = [];
  for (let z = 2; z <= 16; z++) stops.push(z, ['*', fraction, maxMeters / 2 ** (z - 2)]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;
}

/** 經緯度上的近似圓（柱子的底面），逆時針 */
export function circlePolygon([lon, lat]: [number, number], radiusKm: number, steps = 24): GeoJSON.Polygon {
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
export const SELECTED_3D = TOKENS.light.hues.blue;
export const HOVER_3D = TOKENS.light.sequential[2];

/**
 * 面量圖的 3D 高度（0–1）：每個色階等高（第 i 級佔 i/N 到 (i+1)/N），級內再依數值線性內插。
 * 跟顏色用同一套固定門檻，年份之間可以比較，也適用有正負的發散色（最低一級最矮）；
 * 比率類的數值偏態很大，直接用數值當高度的話大部分國家會是平的。
 * 頭尾兩級沒有邊界，用相鄰一級的寬度往外推。
 */
export function classHeight(thresholds: number[], v: number): number {
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

export const DATA_FILL_OPACITY = 0.82;
/**
 * 深色底圖（深色、深藍）上 0.82 會透出深色的陸地，顏色比圖例暗一截；深色介面預設用深藍底圖之後
 * 改成幾乎不透明，跟圖例對得起來
 */
export const DATA_FILL_OPACITY_DARK = 0.94;
export const dataFillOpacity = (dark: boolean) => (dark ? DATA_FILL_OPACITY_DARK : DATA_FILL_OPACITY);
/** 流向圖夥伴國的淡底色 */
export const FLOW_TINT_OPACITY = 0.6;
/** 類別圖強調某一類時，其他國家（feature-state 'dim'）的不透明度倍數 */
export const DIMMED = 0.18;
/** 網格（人口密度、暖化）的 source 與圖層 id */
export const GRID_LAYER = 'density-grid';
/** 網格的夜色底（夜間燈光，meta.json 的 backdrop）：插在網格圖層底下 */
export const GRID_BACKDROP = 'grid-backdrop';
/** 國旗地圖的點陣圖層（flagTiles.ts 畫的圖磚）與小國的小國旗 */
export const FLAG_LAYER = 'flag-raster';
export const FLAG_TINY = 'flag-tiny';
/** 國旗放大後稍微透明，看得到底圖的道路與地名 */
export const FLAG_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 0.96, 7, 0.78, 10, 0.45];
export const FLAG_LEGEND_NOTE = {
  zh: '國旗依國土的形狀縮放、裁切，小國畫成小國旗；點國家看完整的國旗',
  en: 'Flags are scaled and cropped to fit each country; small countries get a small flag. Click a country for the full flag',
};

/** 夜色底的範圍：南北兩條緯線之間的帶子，切成東西兩半（地球儀上一個多邊形從 −180° 繞到 180° 會出問題） */
export function backdropBand(south: number, north: number): GeoJSON.FeatureCollection {
  const half = (w: number, e: number): GeoJSON.Feature => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [[[w, south], [e, south], [e, north], [w, north], [w, south]]] },
  });
  return { type: 'FeatureCollection', features: [half(-180, 0), half(0, 180)] };
}
/** 來源標示是 HTML（MapLibre 的 attribution），meta.json 的文字要跳脫 */
export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** 網格放大後稍微透明，看得到底圖的街道與地形，對照格子在哪裡；縮小時顏色要跟圖例一樣 */
export const GRID_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 4, 0.92, 9, 0.8, 13, 0.62];

/**
 * 依縮放調整面量圖的不透明度：放大後讓底圖的道路、地形透出來。
 * tint 是流向圖夥伴國的淡底色（feature-state 'tint'），不上色的指標也會用到。
 */
export function fillOpacity(on: number, tint = 0): ExpressionSpecification {
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

/**
 * 沒有資料的國家：灰底上再蓋一層斜線（2026-10-30），色盲、列印、灰階時也分得出「沒資料」跟「數值低」（淺色的那一級）。
 * 圖案是 NO_DATA_HATCH（addImage），斜線的間距 6px、寬 1px；圖例與匯出圖片的「無資料」色塊畫同樣的斜線
 */
export const NO_DATA_HATCH = 'no-data-hatch';
/** 斜線的顏色（淺灰底上的深一點的灰） */
export const NO_DATA_HATCH_INK = 'rgba(70, 68, 62, 0.42)';
const HATCH_RATIO = 2;
const HATCH_SIZE = 6 * HATCH_RATIO;

/** 斜線的圖案（右上到左下，左右、上下接得起來） */
export function noDataHatchImage(): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(HATCH_SIZE * HATCH_SIZE * 4);
  const [r, g, b, a] = NO_DATA_HATCH_INK.match(/[\d.]+/g)!.map(Number);
  for (let y = 0; y < HATCH_SIZE; y++) {
    for (let x = 0; x < HATCH_SIZE; x++) {
      // (x + y) 對間距取餘數：0、1（寬 2 個實際像素 = 1px）是線，接縫剛好連起來
      const d = (x + y) % HATCH_SIZE;
      const coverage = d < HATCH_RATIO ? 1 : 0;
      const i = (y * HATCH_SIZE + x) * 4;
      data.set([r, g, b, Math.round(a * 255 * coverage)], i);
    }
  }
  return { width: HATCH_SIZE, height: HATCH_SIZE, data };
}
export const NO_DATA_HATCH_RATIO = HATCH_RATIO;
/** 圖例的「無資料」色塊（CSS）：跟地圖上一樣的灰底與斜線（地圖上斜線的水平間距 6px，垂直於線是 6 ÷ √2 ≈ 4.24px） */
export const NO_DATA_SWATCH = `repeating-linear-gradient(135deg, ${NO_DATA_HATCH_INK} 0 1px, transparent 1px 4.24px), ${NO_DATA}`;

/** 斜線的 source：有上色、沒資料的國家（useCountryFills 換資料，沒變時不換） */
export const NO_DATA_SOURCE = 'nodata';
/** 斜線跟填色一樣放大後變淡；強調圖例的某一級時（沒資料的國家一定不在那一級）跟其他國家一起淡化 */
export const hatchOpacity = (dim: boolean): ExpressionSpecification => {
  const k = dim ? DIMMED : 1;
  return ['interpolate', ['linear'], ['zoom'], 1, k, 5, 0.8 * k, 9, 0.35 * k];
};

/** 選取的國家外框底下光暈的寬度（只有選取的國家有） */
export function haloWidth(width: number): ExpressionSpecification {
  return ['case', ['boolean', ['feature-state', 'selected'], false], width, 0];
}

/** 弧線沿線漸層（line-progress 0 是起點）：淺的一端是出口國，深的一端是進口國 */
export function flowGradient(colors: { start: string; end: string }): ExpressionSpecification {
  return ['interpolate', ['linear'], ['line-progress'], 0, colors.start, 1, colors.end];
}

export function dataLayers(dark: boolean): LayerSpecification[] {
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
      // 沒有資料的國家加斜線（NO_DATA_HATCH，圖案在 installDataLayers 加）。另一個 source（只有沒資料的國家，
      // useCountryFills 換）：圖案填色的圖層放在 countries 上的話，選了國家之後整份國界都不畫（MapLibre 5，2026-10-30 實測）
      id: 'data-nodata',
      type: 'fill',
      source: NO_DATA_SOURCE,
      paint: { 'fill-pattern': NO_DATA_HATCH, 'fill-opacity': hatchOpacity(false) },
    },
    {
      // 滑過的國家微微加亮（2026-10-29）：外框之外再蓋一層淡白色，深色的填色上也看得出游標在哪一國
      id: 'data-hover',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': ['case', ['all', hovered, ['!', ['boolean', ['feature-state', 'selected'], false]]], HOVER_LIGHTEN, 0],
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
        'line-width': haloWidth(HALO_WIDTH),
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
        'circle-radius': ['get', 'r'],
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
        'circle-radius': ['get', 'r'],
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

export const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
export const NO_OVERLAYS: OverlayLayer[] = [];
export const NO_PLACES: [string, [number, number]][] = [];

export const spaceBackground = (stops: [number, string][]) =>
  `radial-gradient(circle at 50% 50%, ${stops.map(([at, color]) => `${color} ${at * 100}%`).join(', ')})`;
export const SPACE_BACKGROUND = spaceBackground(SPACE_GRADIENT);
export const SPACE_BACKGROUND_LIGHT = spaceBackground(SPACE_GRADIENT_LIGHT);
/** 3D 傾斜時地平線以上的天空：深藍夜空（style.ts 的 sky），淺色介面時跟著 SPACE_GRADIENT_LIGHT */
export const LIGHT_SKY = { 'sky-color': '#dfe6ef', 'fog-color': '#dfe6ef' };
export const DARK_SKY = { 'sky-color': '#0c1830', 'fog-color': '#6fa3e0' };
/**
 * 彩色地形上有資料圖層的主題，海改成低彩度的藍（原本 #9ebdff 比資料的顏色還搶眼）；純地圖、地形圖維持原本的海。
 * OKLab 色差（×100）跟無資料的灰 10.2、類別圖的淡紫 12.9、最淺的分級色 18.1，紅綠色盲模擬下都 ≥ 9
 */
export const CALM_SEA = '#98b1d6';

/** 側欄放的標記（PanelExtraProps.setMarks）與游標的對蹠點（主題的 pointer 的 mark） */
export const MARKS_SOURCE = 'map-marks';
export const MARK_LAYER = 'map-marks';
export const MARK_LABEL_LAYER = 'map-marks-label';
export const POINTER_SOURCE = 'pointer-mark';
/** 標記的顏色：紫（深色底圖淡紫），跟側欄標出的那一國同色（MAP_TOKENS.categorical 的 [6]、[1]） */
export const MARK_COLOR = { light: MAP_TOKENS.categorical[6], dark: MAP_TOKENS.categorical[1] };

export function markLayers(dark: boolean, font: DataDrivenPropertyValueSpecification<string[]>): LayerSpecification[] {
  const color = dark ? MARK_COLOR.dark : MARK_COLOR.light;
  const ink = dark ? '#ffffff' : MAP_TOKENS.ink;
  const paper = dark ? '#0b0b0b' : '#ffffff';
  const there: ExpressionSpecification = ['==', ['get', 'kind'], 'there'];
  return [
    // 游標的對蹠點：空心的圈（白色襯底），在地球儀上通常在背面，平面地圖上看得到
    {
      id: 'pointer-mark-halo',
      type: 'circle',
      source: POINTER_SOURCE,
      paint: { 'circle-radius': 7, 'circle-opacity': 0, 'circle-stroke-color': paper, 'circle-stroke-width': 4.5, 'circle-stroke-opacity': 0.85 },
    },
    {
      id: 'pointer-mark',
      type: 'circle',
      source: POINTER_SOURCE,
      paint: { 'circle-radius': 7, 'circle-opacity': 0, 'circle-stroke-color': ink, 'circle-stroke-width': 2 },
    },
    // 側欄的標記：這裡實心、對蹠點空心（白底加色框），旁邊寫名稱
    {
      id: MARK_LAYER,
      type: 'circle',
      source: MARKS_SOURCE,
      paint: {
        'circle-radius': 7,
        'circle-color': ['case', there, paper, color],
        'circle-stroke-color': ['case', there, color, paper],
        'circle-stroke-width': ['case', there, 3, 2],
      },
    },
    {
      id: MARK_LABEL_LAYER,
      type: 'symbol',
      source: MARKS_SOURCE,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': font,
        'text-size': 12.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.9],
        'text-max-width': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': ink, 'text-halo-color': paper, 'text-halo-width': 1.6 },
    },
  ];
}

/**
 * 地圖上標數值（2026-10-30，useValueLabels.ts）：每個國家的位置寫一個短的數值（指標的 formatTick），
 * 插在底圖的地名下面：地名先排，數值放得下才放（四個方向找空位），大國先排（symbol-sort-key）
 */
export const VALUE_SOURCE = 'value-labels';
export function valueLabelLayer(dark: boolean, font: DataDrivenPropertyValueSpecification<string[]>): LayerSpecification {
  return {
    id: VALUE_SOURCE,
    type: 'symbol',
    source: VALUE_SOURCE,
    layout: {
      visibility: 'none',
      'text-field': ['get', 'text'],
      'text-font': font,
      'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10.5, 4, 12.5, 7, 14],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.6,
      'text-justify': 'auto',
      'text-padding': 1,
      'symbol-sort-key': ['get', 'order'],
    },
    paint: {
      'text-color': dark ? '#f0efec' : '#1f1f1d',
      'text-halo-color': dark ? 'rgba(11, 11, 11, 0.85)' : 'rgba(255, 255, 255, 0.9)',
      'text-halo-width': 1.4,
    },
  };
}

/** 只留海的底圖（bareMap）蓋住今天陸地的那一層 */
export const BARE_SEA = 'bare-sea';

/** hover 與點選時依序查詢的圖層（上面的優先）；隱藏的圖層會跳過 */
export const HOVER_LAYERS = [
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
export const HOVER_SOURCES = ['countries', 'bubbles', 'columns', 'tiny-columns', 'flows', 'flow-ends'];
export const SELECT_SOURCES = ['countries', 'columns', 'tiny-columns'];
