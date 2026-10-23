/**
 * 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的，例如地震、火山、板塊邊界、駐外館處）的 MapLibre 圖層。
 * 每個疊加圖層一個 GeoJSON source（`ov-<id>`）；圖層 id 也是 `ov-<id>`（虛線的線另外一層 `ov-<id>-dash`）。
 * 切換底圖後新樣式沒有這些圖層，WorldMap 依 revision 重新呼叫 syncOverlays() 加回來。
 */
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, LayerSpecification, Map as MaplibreMap } from 'maplibre-gl';
import type { IndicatorDef, LinesOverlay, PointsOverlay } from '../topics/types';
import { MAP_TOKENS } from '../theme/tokens';
import type { OverlayLayer } from './Overlays';

export const OVERLAY_PREFIX = 'ov-';
/** 點圖層插在框選範圍之前（疊在機場、比例圓、立體圖形上面），線圖層插在機場之前（在點的下面） */
const POINTS_BEFORE = 'box-fill';
const LINES_BEFORE = 'airports-medium';
/** 三角形圖示的外接圓半徑（css px，icon-size 1 時）；圖示用 2 倍像素畫 */
const TRIANGLE_R = 7;
const ICON_RATIO = 2;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** 半徑是縮放 2 時的大小，放大時跟著變大（但比地圖放大得慢，密集的地方才不會糊成一片） */
function zoomed(r: ExpressionSpecification | number): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 0, ['*', 0.7, r], 2, r, 6, ['*', 1.6, r], 10, ['*', 2.4, r]];
}

function radiusExpression(def: PointsOverlay): ExpressionSpecification | number {
  if (typeof def.radius === 'number') return def.radius;
  const { field, stops } = def.radius;
  return ['interpolate', ['linear'], ['coalesce', ['get', field], stops[0][0]], ...stops.flat()];
}

/** 依數值欄位分級的值（顏色或圖示名稱）；缺值歸到第一級 */
function stepExpression(field: string, thresholds: number[], outputs: string[]): ExpressionSpecification {
  const input: ExpressionSpecification = ['coalesce', ['get', field], thresholds[0] - 1];
  const steps = thresholds.flatMap((t, i) => [t, outputs[i + 1]]);
  return ['step', input, outputs[0], ...steps] as ExpressionSpecification;
}

function pointColors(def: PointsOverlay): string[] {
  return typeof def.color === 'string' ? [def.color] : def.color.classes.map((c) => c.color);
}

const triangleIcon = (color: string) => `${OVERLAY_PREFIX}triangle-${color}`;

/** 三角形圖示（火山）：每種顏色一張，白色外框直接畫在圖上 */
function addTriangleIcons(map: MaplibreMap, colors: string[]) {
  for (const color of colors) {
    const name = triangleIcon(color);
    if (map.hasImage(name)) continue;
    const r = TRIANGLE_R * ICON_RATIO;
    const size = Math.ceil(r * 2 + 4);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    const cx = size / 2;
    // 外接圓的圓心在畫布中間偏下一點，三角形的重心才在正中間
    const cy = size / 2 + r * 0.25;
    const half = r * Math.sqrt(3) * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + half, cy + r * 0.5);
    ctx.lineTo(cx - half, cy + r * 0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.6 * ICON_RATIO;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    map.addImage(name, ctx.getImageData(0, 0, size, size), { pixelRatio: ICON_RATIO });
  }
}

function pointLayer(def: PointsOverlay): LayerSpecification {
  const id = OVERLAY_PREFIX + def.id;
  const r = radiusExpression(def);
  const sortKey: ExpressionSpecification | undefined = def.sortField ? ['coalesce', ['get', def.sortField], 0] : undefined;
  if (def.shape === 'triangle') {
    const colors = pointColors(def);
    const icons = colors.map(triangleIcon);
    return {
      id,
      type: 'symbol',
      source: id,
      layout: {
        'icon-image': typeof def.color === 'string' ? icons[0] : stepExpression(def.color.field, def.color.thresholds, icons),
        'icon-size': zoomed(['/', r, TRIANGLE_R]),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        ...(sortKey ? { 'symbol-sort-key': sortKey } : {}),
      },
      paint: { 'icon-opacity': 0.95 },
    };
  }
  return {
    id,
    type: 'circle',
    source: id,
    layout: sortKey ? { 'circle-sort-key': sortKey } : {},
    paint: {
      'circle-radius': zoomed(r),
      'circle-color':
        typeof def.color === 'string' ? def.color : stepExpression(def.color.field, def.color.thresholds, pointColors(def)),
      'circle-opacity': 0.82,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 0.9],
      'circle-stroke-opacity': 0.9,
    },
  };
}

/** 深色底圖上，中性的深灰線（板塊邊界）換成淺灰，跟鐵路一樣 */
const ON_DARK: Record<string, string> = {
  [MAP_TOKENS.ink]: '#f0efec',
  [MAP_TOKENS.inkSecondary]: '#d6d4cc',
  [MAP_TOKENS.inkMuted]: '#a8a69e',
};

function lineLayers(def: LinesOverlay, dark: boolean): LayerSpecification[] {
  const id = OVERLAY_PREFIX + def.id;
  const classes = typeof def.color === 'string' ? [] : def.color.classes;
  const tone = (c: string) => (dark ? (ON_DARK[c] ?? c) : c);
  const color: ExpressionSpecification | string =
    typeof def.color === 'string'
      ? tone(def.color)
      : (['match', ['coalesce', ['get', 'type'], -1], ...classes.flatMap((c) => [c.value, tone(c.color)]), tone(classes[0].color)] as unknown as ExpressionSpecification);
  const dashed = classes.filter((c) => c.dash).map((c) => c.value);
  const paint = {
    'line-color': color,
    'line-width': zoomed(def.width),
    'line-opacity': dark ? 0.9 : 0.8,
  };
  const isDashed: FilterSpecification = ['in', ['coalesce', ['get', 'type'], -1], ['literal', dashed]];
  const solid: LayerSpecification = {
    id,
    type: 'line',
    source: id,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint,
    ...(dashed.length ? { filter: ['!', isDashed] as FilterSpecification } : {}),
  };
  if (!dashed.length) return [solid];
  // line-dasharray 不能依資料變化，虛線的類別另外一層
  return [solid, { id: `${id}-dash`, type: 'line', source: id, filter: isDashed, paint: { ...paint, 'line-dasharray': [2, 1.5] } }];
}

/** 點的 GeoJSON：只帶畫圖、篩選、hover 要用的欄位（i 是紀錄的索引，tooltip 用） */
function pointFeatures(o: Extract<OverlayLayer, { kind: 'points' }>): GeoJSON.FeatureCollection {
  const { def, points } = o;
  if (!points) return EMPTY;
  const fields = new Set<string>(['iso3']);
  if (typeof def.radius !== 'number') fields.add(def.radius.field);
  if (typeof def.color !== 'string') fields.add(def.color.field);
  if (def.timeField) fields.add(def.timeField);
  if (def.sortField) fields.add(def.sortField);
  const features: GeoJSON.Feature[] = [];
  points.forEach((p, i) => {
    const { lon, lat } = p;
    if (typeof lon !== 'number' || typeof lat !== 'number') return;
    const properties: Record<string, number | string> = { i };
    // 缺值不放進 properties，篩選時用 has 排除
    for (const f of fields) if (p[f] !== null && p[f] !== undefined) properties[f] = p[f] as number | string;
    features.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });
  });
  return { type: 'FeatureCollection', features };
}

function lineFeatures(o: Extract<OverlayLayer, { kind: 'lines' }>): GeoJSON.FeatureCollection {
  if (!o.lines) return EMPTY;
  const { lines, types } = o.lines;
  return {
    type: 'FeatureCollection',
    features: lines.map((coordinates, i) => ({
      type: 'Feature',
      properties: types ? { type: types[i] } : {},
      geometry: { type: 'LineString', coordinates },
    })),
  };
}

/** 依時間軸篩選的點：只有那一年、累積到那一年，或那一年起的 n 年（指標的 overlayTime） */
export function timeFilter(def: PointsOverlay, year: number, mode: IndicatorDef['overlayTime']): FilterSpecification | null {
  if (!def.timeField) return null;
  const t: ExpressionSpecification = ['get', def.timeField];
  const has: FilterSpecification = ['has', def.timeField];
  if (mode === 'cumulative') return ['all', has, ['<=', t, year]];
  if (typeof mode === 'number') return ['all', has, ['>=', t, year], ['<', t, year + mode]];
  return ['all', has, ['==', t, year]];
}

/** 每個疊加圖層上次送到地圖上的資料（同一份就不必再送一次）；換底圖後要清掉 */
export type OverlayDataCache = Map<string, unknown>;

/**
 * 讓地圖上的疊加圖層跟 overlays 一致：加上缺的 source 與圖層、拿掉不要的、資料變了才重送、依開關顯示或隱藏。
 * 回傳點圖層的 id（上面的在前），hover 與點選時依序查詢。
 */
export function syncOverlays(map: MaplibreMap, overlays: OverlayLayer[], sent: OverlayDataCache, dark: boolean): string[] {
  const wanted = new Set(overlays.map((o) => OVERLAY_PREFIX + o.def.id));
  // 換主題後不要的疊加圖層
  for (const layer of map.getStyle().layers) {
    if (!layer.id.startsWith(OVERLAY_PREFIX)) continue;
    const source = 'source' in layer ? (layer.source as string) : '';
    if (!wanted.has(source)) map.removeLayer(layer.id);
  }
  for (const id of Object.keys(map.getStyle().sources)) {
    if (id.startsWith(OVERLAY_PREFIX) && !wanted.has(id)) {
      map.removeSource(id);
      sent.delete(id);
    }
  }
  const before = (id: string) => (map.getLayer(id) ? id : undefined);
  for (const o of overlays) {
    const id = OVERLAY_PREFIX + o.def.id;
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY });
      sent.delete(id);
    }
    if (!map.getLayer(id)) {
      if (o.kind === 'points') {
        if (o.def.shape === 'triangle') addTriangleIcons(map, pointColors(o.def));
        map.addLayer(pointLayer(o.def), before(POINTS_BEFORE));
      } else {
        for (const layer of lineLayers(o.def, dark)) map.addLayer(layer, before(LINES_BEFORE));
      }
    }
    const data = o.kind === 'points' ? o.points : o.lines;
    if (data && sent.get(id) !== data) {
      (map.getSource(id) as GeoJSONSource).setData(o.kind === 'points' ? pointFeatures(o) : lineFeatures(o));
      sent.set(id, data);
    }
    const visibility = o.visible && data ? 'visible' : 'none';
    for (const layerId of [id, `${id}-dash`]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
  return overlays
    .filter((o) => o.kind === 'points')
    .map((o) => OVERLAY_PREFIX + o.def.id)
    .reverse();
}

/** 換年份或指標時更新點的篩選 */
export function applyTimeFilters(map: MaplibreMap, overlays: OverlayLayer[], year: number, mode: IndicatorDef['overlayTime']) {
  for (const o of overlays) {
    if (o.kind !== 'points' || !o.def.timeField) continue;
    const id = OVERLAY_PREFIX + o.def.id;
    if (map.getLayer(id)) map.setFilter(id, timeFilter(o.def, year, mode));
  }
}
