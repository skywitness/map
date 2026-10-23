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

/**
 * 一個線圖層在地圖上的各層（id 都是 `ov-<id>` 加後綴），由下到上：
 * - `-casing`：有 tooltip 的線（颱風路徑）墊一條細邊：淺色底圖用深色、深色底圖用白色，淺的顏色在藍色的海上、
 *   深的顏色在深色底圖上才看得清楚
 * - ``（實線）與 `-dash`（虛線的類別；line-dasharray 不能依資料變化，另外一層）
 * - `-hl-casing`、`-hl`：滑過時標出的那一條（同一筆紀錄的所有段），平常篩選成什麼都沒有
 * - `-hit`：透明的粗線，讓細線比較好滑到（只有 tooltip 的線有）
 */
const LINE_SUFFIXES = ['-casing', '', '-dash', '-hl-casing', '-hl', '-hit'] as const;
type LineSuffix = (typeof LINE_SUFFIXES)[number];
/** 依時間軸篩選的層（標出的那一條只依紀錄篩選） */
const TIME_FILTERED: LineSuffix[] = ['-casing', '', '-dash', '-hit'];
const NOTHING: FilterSpecification = ['==', ['get', 'i'], -1];

function dashedValues(def: LinesOverlay): number[] {
  return typeof def.color === 'string' ? [] : def.color.classes.filter((c) => c.dash).map((c) => c.value);
}

/** 實線、虛線兩層各自的基本篩選（依類別）；其他層沒有 */
function lineBaseFilter(def: LinesOverlay, suffix: LineSuffix): FilterSpecification | null {
  const dashed = dashedValues(def);
  if (!dashed.length || (suffix !== '' && suffix !== '-dash')) return null;
  const isDashed: FilterSpecification = ['in', ['coalesce', ['get', 'type'], -1], ['literal', dashed]];
  return suffix === '-dash' ? isDashed : ['!', isDashed];
}

function lineLayers(def: LinesOverlay, dark: boolean): LayerSpecification[] {
  const id = OVERLAY_PREFIX + def.id;
  const classes = typeof def.color === 'string' ? [] : def.color.classes;
  const tone = (c: string) => (dark ? (ON_DARK[c] ?? c) : c);
  const color: ExpressionSpecification | string =
    typeof def.color === 'string'
      ? tone(def.color)
      : (['match', ['coalesce', ['get', 'type'], -1], ...classes.flatMap((c) => [c.value, tone(c.color)]), tone(classes[0].color)] as unknown as ExpressionSpecification);
  const dashed = dashedValues(def).length > 0;
  const width = zoomed(def.width);
  const paint = {
    'line-color': color,
    'line-width': width,
    'line-opacity': dark ? 0.9 : 0.8,
  };
  // 代碼大的畫在上面（颱風強的那段疊在弱的上面）
  const layout = {
    'line-join': 'round' as const,
    'line-cap': 'round' as const,
    ...(def.sortByType ? { 'line-sort-key': ['coalesce', ['get', 'type'], 0] as ExpressionSpecification } : {}),
  };
  const withFilter = (suffix: LineSuffix) => {
    const filter = lineBaseFilter(def, suffix);
    return filter ? { filter } : {};
  };
  const layers: LayerSpecification[] = [];
  const hoverable = Boolean(def.tooltip);
  if (hoverable) {
    layers.push({
      id: `${id}-casing`,
      type: 'line',
      source: id,
      layout,
      paint: {
        'line-color': dark ? '#ffffff' : MAP_TOKENS.ink,
        'line-opacity': dark ? 0.4 : 0.28,
        'line-width': zoomed(def.width + 1.4),
      },
    });
  }
  layers.push({ id, type: 'line', source: id, layout, paint, ...withFilter('') });
  if (dashed) {
    layers.push({ id: `${id}-dash`, type: 'line', source: id, layout, ...withFilter('-dash'), paint: { ...paint, 'line-dasharray': [2, 1.5] } });
  }
  if (hoverable) {
    layers.push(
      {
        id: `${id}-hl-casing`,
        type: 'line',
        source: id,
        layout,
        filter: NOTHING,
        paint: { 'line-color': dark ? '#ffffff' : MAP_TOKENS.ink, 'line-opacity': 0.9, 'line-width': zoomed(def.width * 2 + 2) },
      },
      { id: `${id}-hl`, type: 'line', source: id, layout, filter: NOTHING, paint: { ...paint, 'line-opacity': 1, 'line-width': zoomed(def.width * 2) } },
      // 透明的粗線：只用來 hover（line-opacity 0 的線 queryRenderedFeatures 照樣查得到）
      { id: `${id}-hit`, type: 'line', source: id, paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 10 } },
    );
  }
  return layers;
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

/**
 * 線的 GeoJSON：i 是第幾條線（也是 records 的第幾筆，tooltip 與標出整條線用），type 是分類代碼。
 * 有 vertexTypes 時依代碼切成好幾段（每段的代碼是起點的代碼，相鄰兩段共用交界的頂點）；
 * 有時間欄位時把紀錄的年份放進每一段，給時間篩選用。
 */
function lineFeatures(o: Extract<OverlayLayer, { kind: 'lines' }>): GeoJSON.FeatureCollection {
  if (!o.lines) return EMPTY;
  const { lines, types, vertexTypes, records } = o.lines;
  const timeField = o.def.timeField;
  const features: GeoJSON.Feature[] = [];
  lines.forEach((coordinates, i) => {
    const base: Record<string, number | string> = { i };
    if (types) base.type = types[i];
    const t = timeField && records ? records[i]?.[timeField] : null;
    if (timeField && t !== null && t !== undefined) base[timeField] = t;
    const codes = vertexTypes?.[i];
    if (!codes || codes.length !== coordinates.length) {
      features.push({ type: 'Feature', properties: base, geometry: { type: 'LineString', coordinates } });
      return;
    }
    let start = 0;
    for (let j = 1; j <= coordinates.length - 1; j++) {
      // 這一段到第 j 個頂點為止；下一段的代碼不同或已經是最後一個頂點時輸出
      if (j < coordinates.length - 1 && codes[j] === codes[start]) continue;
      features.push({
        type: 'Feature',
        properties: { ...base, type: codes[start] },
        geometry: { type: 'LineString', coordinates: coordinates.slice(start, j + 1) },
      });
      start = j;
    }
  });
  return { type: 'FeatureCollection', features };
}

/** 依時間軸篩選的點、線：只有那一年、累積到那一年，或那一年起的 n 年（指標的 overlayTime） */
export function timeFilter(def: { timeField?: string }, year: number, mode: IndicatorDef['overlayTime']): FilterSpecification | null {
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
    for (const layerId of o.kind === 'points' ? [id] : LINE_SUFFIXES.map((s) => id + s)) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
  // hover 時依序查詢：點在上面，所以先查點，再查有 tooltip 的線（透明的粗線）
  const points = overlays.filter((o) => o.kind === 'points').map((o) => OVERLAY_PREFIX + o.def.id);
  const lines = overlays.filter((o) => o.kind === 'lines' && o.def.tooltip).map((o) => `${OVERLAY_PREFIX}${o.def.id}-hit`);
  return [...points.reverse(), ...lines.reverse()];
}

/** 換年份或指標時更新點、線的篩選（線的實線、虛線兩層要跟依類別的篩選合併） */
export function applyTimeFilters(map: MaplibreMap, overlays: OverlayLayer[], year: number, mode: IndicatorDef['overlayTime']) {
  for (const o of overlays) {
    if (!o.def.timeField) continue;
    const id = OVERLAY_PREFIX + o.def.id;
    const time = timeFilter(o.def, year, mode);
    if (o.kind === 'points') {
      if (map.getLayer(id)) map.setFilter(id, time);
      continue;
    }
    for (const suffix of TIME_FILTERED) {
      if (!map.getLayer(id + suffix)) continue;
      const base = lineBaseFilter(o.def, suffix);
      map.setFilter(id + suffix, base && time ? (['all', base, time] as FilterSpecification) : (base ?? time));
    }
  }
}

/**
 * 滑過線圖層時標出整條線（同一筆紀錄 i 的所有段）；line 為 null 時取消。
 * overlay 是疊加圖層的 id（不含 `ov-`）。
 */
export function highlightLine(map: MaplibreMap, overlays: OverlayLayer[], line: { overlay: string; index: number } | null) {
  for (const o of overlays) {
    if (o.kind !== 'lines' || !o.def.tooltip) continue;
    const id = OVERLAY_PREFIX + o.def.id;
    const filter: FilterSpecification = line && line.overlay === o.def.id ? ['==', ['get', 'i'], line.index] : NOTHING;
    for (const layerId of [`${id}-hl-casing`, `${id}-hl`]) {
      if (map.getLayer(layerId)) map.setFilter(layerId, filter);
    }
  }
}
