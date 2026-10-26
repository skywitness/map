/**
 * 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的，例如地震、火山、板塊邊界、駐外館處）的 MapLibre 圖層。
 * 每個疊加圖層一個 GeoJSON source（`ov-<id>`）；圖層 id 也是 `ov-<id>`（虛線的線另外一層 `ov-<id>-dash`）。
 * 有 tooltip 的線另外兩層：看不見的寬線 `ov-<id>-hit` 給 hover 查詢（細線很難滑到），加粗的 `ov-<id>-hover` 標出滑到的那一條。
 * casing 的線在最下面多一層細邊 `ov-<id>-casing`。有 vertexTypes 的線（颱風）依每個頂點的代碼切成好幾段，各段分別上色。
 * 切換底圖後新樣式沒有這些圖層，WorldMap 依 revision 重新呼叫 syncOverlays() 加回來。
 */
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, LayerSpecification, Map as MaplibreMap } from 'maplibre-gl';
import { overlayEpoch, type IndicatorDef, type LinesOverlay, type PointsOverlay } from '../topics/types';
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

/** 有 tooltip 的線：hover 查詢用的寬線、標出滑到的線 */
const HIT_SUFFIX = '-hit';
const HOVER_SUFFIX = '-hover';
const CASING_SUFFIX = '-casing';
/** 滑到線上時查詢的寬度（px），細線也滑得到 */
const HIT_WIDTH = 9;
/** 線的組別（紀錄相同的線是同一組，例如同一條電纜的各段）；沒有滑到任何線時的篩選值 */
const NO_GROUP = -1;

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
      ...(def.minZoom ? { minzoom: def.minZoom } : {}),
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
    ...(def.minZoom ? { minzoom: def.minZoom } : {}),
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

/** 一個線圖層的 MapLibre 圖層，base 是它本身的篩選（實線／虛線的分類、hover 的組別），時間篩選要跟它合併 */
interface LineSublayer {
  layer: LayerSpecification;
  base: FilterSpecification | null;
  /** 依時間軸篩選（hover 那層只畫滑到的線，不必） */
  timed: boolean;
}

function lineLayers(def: LinesOverlay, dark: boolean): LineSublayer[] {
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
  // sortByType：代碼大的畫在上面（颱風強的那段疊在弱的上面）
  const layout = {
    'line-join': 'round' as const,
    'line-cap': 'round' as const,
    ...(def.sortByType ? { 'line-sort-key': ['coalesce', ['get', 'type'], 0] as ExpressionSpecification } : {}),
  };
  const out: LineSublayer[] = [];
  if (def.casing) {
    out.push({
      layer: {
        id: id + CASING_SUFFIX,
        type: 'line',
        source: id,
        layout,
        paint: {
          'line-color': dark ? '#ffffff' : MAP_TOKENS.ink,
          'line-opacity': dark ? 0.4 : 0.28,
          'line-width': zoomed(def.width + 1.4),
        },
      },
      base: null,
      timed: true,
    });
  }
  const solidBase = dashed.length ? (['!', isDashed] as FilterSpecification) : null;
  out.push({ layer: { id, type: 'line', source: id, layout, paint, ...(solidBase ? { filter: solidBase } : {}) }, base: solidBase, timed: true });
  // line-dasharray 不能依資料變化，虛線的類別另外一層
  if (dashed.length) {
    out.push({
      layer: { id: `${id}-dash`, type: 'line', source: id, layout, filter: isDashed, paint: { ...paint, 'line-dasharray': [2, 1.5] } },
      base: isDashed,
      timed: true,
    });
  }
  if (def.tooltip) {
    // 看不見的寬線：queryRenderedFeatures 依線寬判斷有沒有滑到，跟不透明度無關
    out.push({
      layer: { id: id + HIT_SUFFIX, type: 'line', source: id, layout, paint: { 'line-width': HIT_WIDTH, 'line-opacity': 0 } },
      base: null,
      timed: true,
    });
    const hoverBase: FilterSpecification = ['==', ['get', 'g'], NO_GROUP];
    out.push({
      layer: {
        id: id + HOVER_SUFFIX,
        type: 'line',
        source: id,
        layout,
        filter: hoverBase,
        paint: { 'line-color': color, 'line-width': zoomed(Math.max(2.4, def.width * 2.4)), 'line-opacity': 1 },
      },
      base: hoverBase,
      timed: false,
    });
  }
  return out;
}

/**
 * 點的 GeoJSON：只帶畫圖、篩選、hover 要用的欄位（i 是紀錄的索引，tooltip 用）。
 * 有 epochs 的圖層再加上那一期算出的欄位（例如城市那一期的人口）。
 */
function pointFeatures(o: Extract<OverlayLayer, { kind: 'points' }>, epoch: number | null): GeoJSON.FeatureCollection {
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
    if (def.epochs && epoch !== null) {
      for (const [f, v] of Object.entries(def.epochs.values(p, epoch))) {
        if (v === null) delete properties[f];
        else properties[f] = v;
      }
    }
    features.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });
  });
  return { type: 'FeatureCollection', features };
}

function lineFeatures(o: Extract<OverlayLayer, { kind: 'lines' }>): GeoJSON.FeatureCollection {
  if (!o.lines) return EMPTY;
  const { lines, types, records, vertexTypes } = o.lines;
  const { timeField } = o.def;
  // 紀錄完全相同的線是同一組（同一條電纜被切成好幾段），滑到其中一段時整組一起標出
  const groups = new Map<string, number>();
  const features: GeoJSON.Feature[] = [];
  lines.forEach((coordinates, i) => {
    const properties: Record<string, number | string> = { i };
    if (types) properties.type = types[i];
    const record = records?.[i];
    if (record) {
      const key = JSON.stringify(record);
      let g = groups.get(key);
      if (g === undefined) groups.set(key, (g = groups.size));
      properties.g = g;
      const t = timeField ? record[timeField] : null;
      if (timeField && t !== null && t !== undefined) properties[timeField] = t;
    } else {
      properties.g = i;
    }
    const codes = vertexTypes?.[i];
    if (!codes || codes.length !== coordinates.length) {
      features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
      return;
    }
    // 依每個頂點的代碼切段：每段的代碼是起點的代碼，相鄰兩段共用交界的頂點
    let start = 0;
    for (let j = 1; j < coordinates.length; j++) {
      if (j < coordinates.length - 1 && codes[j] === codes[start]) continue;
      features.push({
        type: 'Feature',
        properties: { ...properties, type: codes[start] },
        geometry: { type: 'LineString', coordinates: coordinates.slice(start, j + 1) },
      });
      start = j;
    }
  });
  return { type: 'FeatureCollection', features };
}

/** 依時間軸篩選的點：只有那一年、累積到那一年，或那一年起的 n 年（指標的 overlayTime） */
export function timeFilter(def: { timeField?: string }, year: number, mode: IndicatorDef['overlayTime']): FilterSpecification | null {
  if (!def.timeField) return null;
  const t: ExpressionSpecification = ['get', def.timeField];
  const has: FilterSpecification = ['has', def.timeField];
  if (mode === 'cumulative') return ['all', has, ['<=', t, year]];
  if (typeof mode === 'number') return ['all', has, ['>=', t, year], ['<', t, year + mode]];
  return ['all', has, ['==', t, year]];
}

/**
 * 依縮放篩選的點（PointsOverlayDef.minValue）：數值要大於等於這一級的門檻。filter 裡的 ['zoom'] 是圖磚的整數級數，
 * 所以門檻在整數級數換；沒有這個欄位的點（例如那一期還不是城市）不畫。
 */
function valueFilter(def: Pick<PointsOverlay, 'minValue'>): FilterSpecification | null {
  if (!def.minValue) return null;
  const { field, stops } = def.minValue;
  const threshold = ['step', ['zoom'], stops[0][1], ...stops.slice(1).flat()] as unknown as ExpressionSpecification;
  return ['all', ['has', field], ['>=', ['get', field], threshold]];
}

/** 點圖層的篩選：時間篩選與依縮放的篩選合併 */
function pointFilter(def: PointsOverlay, year: number, mode: IndicatorDef['overlayTime']): FilterSpecification | null {
  const parts = [timeFilter(def, year, mode), valueFilter(def)].filter((f): f is FilterSpecification => f !== null);
  return parts.length === 0 ? null : parts.length === 1 ? parts[0] : (['all', ...parts] as FilterSpecification);
}

/** 每個疊加圖層上次送到地圖上的資料與那一期（同一份就不必再送一次）；換底圖後要清掉 */
export type OverlayDataCache = Map<string, { data: unknown; epoch: number | null }>;

/**
 * 讓地圖上的疊加圖層跟 overlays 一致：加上缺的 source 與圖層、拿掉不要的、資料變了才重送、依開關顯示或隱藏。
 * 有 epochs 的點圖層（城市的人口）換到另一期時也重送。
 * 回傳 hover 與點選時依序查詢的圖層 id：點圖層（上面的在前），再來是有 tooltip 的線的查詢層。
 */
export function syncOverlays(
  map: MaplibreMap,
  overlays: OverlayLayer[],
  sent: OverlayDataCache,
  dark: boolean,
  year: number,
): string[] {
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
        for (const { layer } of lineLayers(o.def, dark)) map.addLayer(layer, before(LINES_BEFORE));
      }
    }
    const data = o.kind === 'points' ? o.points : o.lines;
    const epoch = o.kind === 'points' ? overlayEpoch(o.def, year) : null;
    const prev = sent.get(id);
    if (data && (prev?.data !== data || prev.epoch !== epoch)) {
      (map.getSource(id) as GeoJSONSource).setData(o.kind === 'points' ? pointFeatures(o, epoch) : lineFeatures(o));
      sent.set(id, { data, epoch });
    }
    const visibility = o.visible && data ? 'visible' : 'none';
    for (const layerId of [id + CASING_SUFFIX, id, `${id}-dash`, id + HIT_SUFFIX, id + HOVER_SUFFIX]) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
  const visibleIds = (kind: OverlayLayer['kind'], suffix = '') =>
    overlays
      .filter((o) => o.kind === kind && (kind === 'points' || o.def.tooltip))
      .map((o) => OVERLAY_PREFIX + o.def.id + suffix)
      .reverse();
  return [...visibleIds('points'), ...visibleIds('lines', HIT_SUFFIX)];
}

/** 換年份或指標時更新點與線的篩選；線的時間篩選要跟它本身的篩選（實線／虛線）合併，點的跟依縮放的篩選合併 */
export function applyTimeFilters(map: MaplibreMap, overlays: OverlayLayer[], year: number, mode: IndicatorDef['overlayTime']) {
  for (const o of overlays) {
    const id = OVERLAY_PREFIX + o.def.id;
    if (o.kind === 'points') {
      if (!o.def.timeField && !o.def.minValue) continue;
      if (map.getLayer(id)) map.setFilter(id, pointFilter(o.def, year, mode));
      continue;
    }
    if (!o.def.timeField) continue;
    const time = timeFilter(o.def, year, mode);
    for (const { layer, base, timed } of lineLayers(o.def, false)) {
      if (!timed || !map.getLayer(layer.id)) continue;
      map.setFilter(layer.id, base && time ? (['all', base, time] as FilterSpecification) : (base ?? time));
    }
  }
}

/** 滑到線圖層的查詢層時，回傳那個疊加圖層的 id；不是線的查詢層回傳 null */
export function lineOverlayAt(layerId: string): string | null {
  return layerId.startsWith(OVERLAY_PREFIX) && layerId.endsWith(HIT_SUFFIX)
    ? layerId.slice(OVERLAY_PREFIX.length, -HIT_SUFFIX.length)
    : null;
}

/** 標出滑到的線（同一組的各段一起加粗）；overlay 是 null 時取消。prev 是上一次標出的，換線時先取消它 */
export function highlightLine(
  map: MaplibreMap,
  prev: { overlay: string; group: number } | null,
  next: { overlay: string; group: number } | null,
) {
  if (prev && (!next || prev.overlay !== next.overlay)) {
    const id = OVERLAY_PREFIX + prev.overlay + HOVER_SUFFIX;
    if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'g'], NO_GROUP]);
  }
  if (next && (prev?.overlay !== next.overlay || prev.group !== next.group)) {
    const id = OVERLAY_PREFIX + next.overlay + HOVER_SUFFIX;
    if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'g'], next.group]);
  }
}
