/**
 * 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的，例如地震、火山、板塊邊界、駐外館處）的 MapLibre 圖層。
 * 每個疊加圖層一個 GeoJSON source（`ov-<id>`）；圖層 id 也是 `ov-<id>`（虛線的線另外一層 `ov-<id>-dash`）。
 * 有 tooltip 的線另外兩層：看不見的寬線 `ov-<id>-hit` 給 hover 查詢（細線很難滑到），加粗的 `ov-<id>-hover` 標出滑到的那一條。
 * 標出的那一組放在另一個小 source `ov-<id>~h`，換一組只換它的資料：用 setFilter 的話 MapLibre 要把整個 source 的圖磚
 * 重做一次。
 * casing 的線在最下面多一層細邊 `ov-<id>-casing`。有 vertexTypes 的線（颱風）依每個頂點的代碼切成好幾段，各段分別上色。
 * 線寬可以依紀錄的欄位變化（河流依流量），hoverHalo 的線滑過時多一層光暈 `ov-<id>-hover-halo`，
 * minValue 依縮放篩選（縮小時只畫大河），fadeOut 放大後淡出。lineLabel 的線另外一層沿線的文字 `ov-<id>-label`（北回歸線）。
 * fill 的線（日食的路徑環）是多邊形：最下面多一層半透明的面 `ov-<id>-fill`，滑過的那一組加深 `ov-<id>-hover-fill`；
 * fill.hover 的面（山脈）本身也是查詢層。
 * 放大後下載的分區（detail）畫在另一個 source `ov-<id>~d`（圖層 `ov-<id>~d`、`ov-<id>~d-hit`…，在主檔的線下面）：
 * 移動地圖換分區時只重送分區，主檔不必重新切圖磚（河流原本每移動一次就要把三萬多段重送一次，畫面停 0.2 秒以上）。
 * 晝夜（kind 'night'）、月亮（kind 'moon'）、即時網格（kind 'liveGrid'）、類別網格（kind 'classGrid'）、風（kind 'wind'）不在這裡，見 nightLayer.ts、liveGridLayer.ts、classGridLayer.ts、windLayer.ts。
 * 切換底圖後新樣式沒有這些圖層，WorldMap 依 revision 重新呼叫 syncOverlays() 加回來。
 */
import type {
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MaplibreMap,
  SourceSpecification,
} from 'maplibre-gl';
import { overlayEpoch, type HatchAngle, type IndicatorDef, type LinesOverlay, type PointsOverlay } from '../topics/types';
import { MAP_TOKENS } from '../theme/tokens';
import { clusterKey, resetDonuts, syncDonuts, type DonutSpec } from './clusterDonuts';
import { setTrailYear, syncTrails, type TrailInput } from './trails';
import { heatRamp } from './heatRamps';
import type { DecodedLines, OverlayLayer } from './Overlays';
import { isNameLayer } from './style';

/** 點、線疊加圖層（晝夜是另外的自訂圖層，nightLayer.ts） */
type DataOverlay = Exclude<OverlayLayer, { kind: 'night' } | { kind: 'moon' } | { kind: 'liveGrid' } | { kind: 'classGrid' } | { kind: 'wind' } | { kind: 'tiles' }>;
const isData = (o: OverlayLayer): o is DataOverlay =>
  o.kind !== 'night' && o.kind !== 'moon' && o.kind !== 'liveGrid' && o.kind !== 'classGrid' && o.kind !== 'wind' && o.kind !== 'tiles';

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
/** 封閉的環畫成的面（LinesOverlayDef.fill）與滑過時加深的那一組 */
const FILL_SUFFIX = '-fill';
const HOVER_FILL_SUFFIX = '-hover-fill';
/** 斜線的面（fill.hatch）：畫在半透明的面上面的另一層 */
const HATCH_SUFFIX = '-hatch';
const IS_POLYGON: FilterSpecification = ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]];
const NOT_POLYGON: FilterSpecification = ['!', IS_POLYGON];
const LABEL_SUFFIX = '-label';
/** 沿線文字的字型：底圖地名的字型（每個底圖的字型名稱不同）；找不到時用 OpenFreeMap 的 Noto Sans */
const DEFAULT_FONT = ['Noto Sans Regular'];
/** 滑到線上時查詢的寬度（px），細線也滑得到 */
const HIT_WIDTH = 9;
/** 分區的 source 與圖層、標出的那一組的 source（見檔頭） */
const DETAIL_SUFFIX = '~d';
const HIGHLIGHT_SUFFIX = '~h';
/** 縮小時的熱度圖（PointsOverlayDef.heatmap）：同一個 source 的另一個圖層 */
export const HEAT_SUFFIX = '~heat';

function heatLayer(def: PointsOverlay): LayerSpecification {
  const heat = def.heatmap!;
  const id = OVERLAY_PREFIX + def.id;
  return {
    id: id + HEAT_SUFFIX,
    type: 'heatmap',
    source: id,
    maxzoom: heat.maxZoom + 1,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': heat.weight
        ? (['interpolate', ['linear'], ['coalesce', ['get', heat.weight.field], heat.weight.stops[0][0]], ...heat.weight.stops.flat()] as ExpressionSpecification)
        : 1,
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 5, 2, 9, 3, 12, 4, 16],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.25 * (heat.intensity ?? 1), 3, 0.5 * (heat.intensity ?? 1)],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...heatRamp(heat.ramp).flat()] as ExpressionSpecification,
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], heat.maxZoom, 0.85, heat.maxZoom + 1, 0],
    },
  };
}

/** 點多的時間模式（累積、幾年）才畫熱度圖；沒有時間篩選的點（店家、語言）一直都是全部的點 */
const manyPoints = (def: PointsOverlay, mode: IndicatorDef['overlayTime']) => !def.timeField || mode === 'cumulative' || typeof mode === 'number';

/** 聚成甜甜圈的點圖層（PointsOverlayDef.cluster）：開了 cluster 的 source 與沒聚在一起的點的圖層 */
/** 線的密度（LinesOverlayDef.heat，2026-11-02，新20 航海日誌的航線密度）：頂點做成點的 source 與熱度圖 */
const HEAT_POINTS = '~heatpts';

function lineHeatLayer(def: LinesOverlay): LayerSpecification {
  const heat = def.heat!;
  const id = OVERLAY_PREFIX + def.id;
  const k = heat.intensity ?? 1;
  return {
    id: id + HEAT_SUFFIX,
    type: 'heatmap',
    source: id + HEAT_POINTS,
    ...(heat.maxZoom !== undefined ? { maxzoom: heat.maxZoom + 1 } : {}),
    paint: {
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 2, 7, 4, 12, 6, 18],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.15 * k, 3, 0.35 * k, 6, 0.6 * k],
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], ...heatRamp(heat.ramp).flat()] as ExpressionSpecification,
      'heatmap-opacity': heat.opacity ?? 0.75,
    },
  };
}

/** 線的頂點（每 every 個取一個）送到熱度圖的 source；同一份線不重送 */
function sendLineHeat(map: MaplibreMap, o: Extract<DataOverlay, { kind: 'lines' }>, sent: OverlayDataCache) {
  if (!o.lines || !o.def.heat) return;
  const source = OVERLAY_PREFIX + o.def.id + HEAT_POINTS;
  if (sent.get(source)?.data === o.lines) return;
  const every = Math.max(1, o.def.heat.every ?? 1);
  const coordinates: [number, number][] = [];
  for (const line of o.lines.lines) {
    for (let i = 0; i < line.length; i += every) coordinates.push(line[i]);
  }
  (map.getSource(source) as GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates } });
  sent.set(source, { data: o.lines, epoch: null, def: o.def });
}

export const CLUSTER_SUFFIX = '~cl';

/** 點圖層的圖層 id → 疊加圖層的 id（聚合 source 上的複本圖層也算同一個） */
export function pointOverlayId(layerId: string): string {
  const id = layerId.slice(OVERLAY_PREFIX.length);
  return id.endsWith(CLUSTER_SUFFIX) ? id.slice(0, -CLUSTER_SUFFIX.length) : id;
}

/** 分類的點（ColorClasses）第 k 類的條件：欄位值在 thresholds[k − 1] 與 thresholds[k] 之間；缺值歸第一類（跟 stepExpression 一樣） */
function classTest(field: string, thresholds: number[], k: number): ExpressionSpecification {
  const v: ExpressionSpecification = ['coalesce', ['get', field], thresholds[0] - 1];
  const parts: ExpressionSpecification[] = [];
  if (k > 0) parts.push(['>=', v, thresholds[k - 1]]);
  if (k < thresholds.length) parts.push(['<', v, thresholds[k]]);
  return parts.length === 1 ? parts[0] : ['all', ...parts];
}

/** 聚合的 source：各類加總放在 c0、c1…（clusterDonuts.ts 的 clusterKey） */
function clusterSource(def: PointsOverlay): SourceSpecification {
  const cluster = def.cluster!;
  const color = typeof def.color === 'string' ? null : def.color;
  const weight: ExpressionSpecification | number = cluster.weight ? ['coalesce', ['get', cluster.weight], 0] : 1;
  const properties: Record<string, [string, ExpressionSpecification]> = {};
  (color?.classes ?? [null]).forEach((_, k) => {
    properties[clusterKey(k)] = ['+', color ? ['case', classTest(color.field, color.thresholds, k), weight, 0] : weight] as [string, ExpressionSpecification];
  });
  return {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterMaxZoom: cluster.maxZoom,
    clusterRadius: cluster.radius ?? 50,
    clusterProperties: properties,
  } as SourceSpecification;
}

const donutSpecs = new WeakMap<PointsOverlay, DonutSpec>();
function donutSpec(def: PointsOverlay): DonutSpec {
  let spec = donutSpecs.get(def);
  if (!spec) {
    const cluster = def.cluster!;
    const color = typeof def.color === 'string' ? null : def.color;
    spec = {
      maxZoom: cluster.maxZoom,
      colors: color ? color.classes.map((c) => c.color) : [def.color as string],
      labels: color ? color.classes.map((c) => c.label) : [def.label],
      size: cluster.size,
      format: cluster.format,
      title: cluster.title,
    };
    donutSpecs.set(def, spec);
  }
  return spec;
}

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

/** 斜線圖片（LinesOverlayDef.fill.hatch）的邊長（CSS px）、線寬 */
const HATCH_SIZE = 8;
const HATCH_WIDTH = 1.3;
export const hatchImageId = (color: string, angle: HatchAngle) => `hatch-${angle}-${color.replace('#', '')}`;

/** 一張可以無縫鋪開的斜線圖片（透明底、一條分類顏色的線） */
export function drawHatch(color: string, angle: HatchAngle, ratio: number): ImageData | null {
  const size = Math.round(HATCH_SIZE * ratio);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.strokeStyle = color;
  ctx.lineWidth = HATCH_WIDTH * ratio;
  ctx.lineCap = 'square';
  ctx.beginPath();
  if (angle === 0) {
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
  } else if (angle === 90) {
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
  } else {
    // 斜的：三段（中間一段加上左右兩段的延伸），鋪開時在邊上接起來
    for (const dx of [-size, 0, size]) {
      if (angle === 45) {
        ctx.moveTo(dx, size);
        ctx.lineTo(dx + size, 0);
      } else {
        ctx.moveTo(dx, 0);
        ctx.lineTo(dx + size, size);
      }
    }
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

/** 線圖層的斜線面要用的圖片（換底圖後樣式是新的，重新加） */
function addHatchImages(map: MaplibreMap, def: LinesOverlay, dark: boolean) {
  const hatch = def.fill?.hatch;
  if (!hatch || typeof def.color === 'string') return;
  const ratio = Math.min(2, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  for (const c of def.color.classes) {
    const angle = hatch[c.value];
    if (angle === undefined) continue;
    const color = dark && c.dark ? c.dark : c.color;
    const id = hatchImageId(color, angle);
    if (map.hasImage(id)) continue;
    const image = drawHatch(color, angle, ratio);
    if (image) map.addImage(id, image, { pixelRatio: ratio });
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
  const color: DataDrivenPropertyValueSpecification<string> =
    typeof def.color === 'string' ? def.color : stepExpression(def.color.field, def.color.thresholds, pointColors(def));
  return {
    id,
    type: 'circle',
    source: id,
    ...(def.minZoom ? { minzoom: def.minZoom } : {}),
    layout: sortKey ? { 'circle-sort-key': sortKey } : {},
    paint: def.look ? lookPaint(def.look, zoomed(r), color) : {
      'circle-radius': zoomed(r),
      'circle-color': color,
      'circle-opacity': 0.82,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 0.9],
      'circle-stroke-opacity': 0.9,
    },
  };
}

/**
 * 圓點的樣式（PointsOverlayDef.look，2026-10-30 起，發電廠的興建中、規劃中、退役）：
 * hollow 是分類色的粗框加很淡的底色，faint 是分類色的細框、沒有底色，muted 是灰色實心加白框。
 * 圖例的符號（Overlays.tsx 的 Swatch、exportImage.ts）照同一組數字畫
 */
function lookPaint(
  look: NonNullable<PointsOverlay['look']>,
  radius: ExpressionSpecification,
  color: DataDrivenPropertyValueSpecification<string>,
): NonNullable<CircleLayerSpecification['paint']> {
  if (look === 'muted') {
    return {
      'circle-radius': radius,
      'circle-color': MAP_TOKENS.inkMuted,
      'circle-opacity': 0.6,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 6, 0.9],
      'circle-stroke-opacity': 0.8,
    };
  }
  const hollow = look === 'hollow';
  return {
    'circle-radius': radius,
    'circle-color': color,
    'circle-opacity': hollow ? 0.12 : 0,
    'circle-stroke-color': color,
    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, hollow ? 1.1 : 0.7, 6, hollow ? 1.8 : 1.1],
    'circle-stroke-opacity': hollow ? 0.95 : 0.8,
  };
}

/**
 * 點旁邊的文字（PointsOverlayDef.pointLabel，2026-10-29 起，各國在讀什麼的條目名稱）：寫在點的右邊，
 * 彼此碰到時 MapLibre 只留一個（先畫 sortField 大的），放大後才看得到被擋住的；圖層在最上面，碰到底圖的地名時優先
 */
function pointLabelLayer(def: PointsOverlay, dark: boolean, font: DataDrivenPropertyValueSpecification<string[]>): LayerSpecification {
  const id = OVERLAY_PREFIX + def.id;
  return {
    id: id + LABEL_SUFFIX,
    type: 'symbol',
    source: id,
    filter: ['has', '_label'],
    layout: {
      'text-field': ['get', '_label'],
      'text-font': font,
      'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10.5, 5, 13],
      'text-anchor': 'left',
      'text-offset': [0.5, 0],
      'text-max-width': 9,
      'text-padding': 3,
      ...(def.sortField ? { 'symbol-sort-key': ['-', 0, ['coalesce', ['get', def.sortField], 0]] as ExpressionSpecification } : {}),
    },
    paint: {
      'text-color': dark ? '#f0efec' : MAP_TOKENS.ink,
      'text-halo-color': dark ? '#0b0b0b' : '#ffffff',
      'text-halo-width': 1.4,
    },
  };
}

/** 深色底圖上，中性的深灰線（板塊邊界）換成淺灰，跟鐵路一樣 */
const ON_DARK: Record<string, string> = {
  [MAP_TOKENS.ink]: '#f0efec',
  [MAP_TOKENS.inkSecondary]: '#d6d4cc',
  [MAP_TOKENS.inkMuted]: '#a8a69e',
};

/** 一個線圖層的 MapLibre 圖層，base 是它本身的篩選（實線／虛線的分類、只畫線或面），時間篩選要跟它合併 */
interface LineSublayer {
  layer: LayerSpecification;
  base: FilterSpecification | null;
  /** 標出一組的圖層（標出的那一組的 source）：只套依縮放的篩選，不套時間篩選 */
  hover: boolean;
}

/** 線寬的運算式（縮放 2 時的 px）：固定值，或依欄位在 stops 之間線性內插 */
function lineWidth(def: Pick<LinesOverlay, 'width'>): ExpressionSpecification | number {
  if (typeof def.width === 'number') return def.width;
  const { field, stops } = def.width;
  return ['interpolate', ['linear'], ['coalesce', ['get', field], stops[0][0]], ...stops.flat()] as ExpressionSpecification;
}

/** 滑過時標出的線寬：固定線寬的照舊（至少 2.4 px），依欄位變粗的線是原本的 1.25 倍再加 0.6 px（整個水系一起標出，不必再粗） */
function hoverWidth(def: Pick<LinesOverlay, 'width'>): ExpressionSpecification | number {
  return typeof def.width === 'number' ? Math.max(2.4, def.width * 2.4) : ['+', ['*', lineWidth(def), 1.25], 0.6];
}

/** 不透明度：fadeOut 時放大到那個範圍淡出 */
function lineOpacity(def: Pick<LinesOverlay, 'fadeOut'>, opacity: number): ExpressionSpecification | number {
  if (!def.fadeOut) return opacity;
  const [z0, z1] = def.fadeOut;
  return ['interpolate', ['linear'], ['zoom'], z0, opacity, z1, 0];
}

const HALO_SUFFIX = '-hover-halo';

/** 線寬隨縮放變化：有 widthZoom 時依它的倍數（[縮放, 倍數]），沒有用跟點一樣的 zoomed() */
function lineZoomed(def: Pick<LinesOverlay, 'widthZoom'>, w: ExpressionSpecification | number): ExpressionSpecification {
  if (!def.widthZoom) return zoomed(w);
  return ['interpolate', ['linear'], ['zoom'], ...def.widthZoom.flatMap(([z, k]) => [z, ['*', k, w]])] as ExpressionSpecification;
}

/**
 * 底圖地名圖層用的字型（沿線文字要用底圖有的字型，否則下載不到字形）。prefer 是優先找的圖層 id
 * （點旁邊的文字用國名、城市名的字型：有的底圖第一個地名圖層是水域的斜體）
 */
export function labelFont(map: MaplibreMap, prefer?: RegExp): DataDrivenPropertyValueSpecification<string[]> {
  const layers = map.getStyle().layers.filter((l) => isNameLayer(l) && l.type === 'symbol' && l.layout?.['text-font']);
  const layer = (prefer && layers.find((l) => prefer.test(l.id))) || layers[0];
  return (layer?.type === 'symbol' && layer.layout?.['text-font']) || DEFAULT_FONT;
}

/** 側欄或滑鼠可以標出一組線：有 tooltip 的滑得到；沒有 tooltip 但有 groupField 的（日食次數指標的累積中心線）只能由側欄標出 */
const canHighlight = (def: LinesOverlay) => Boolean(def.tooltip || def.groupField);

/**
 * 線圖層的 MapLibre 圖層，由下而上：面（fill）、標出的那一組的面、分區的線、主檔的線、標出的那一組的光暈與線。
 * 主檔與分區各一組畫線的圖層（id 以各自的 source 開頭）；標出的那一組畫在另一個 source（`~h`），資料只有那一組。
 */
function lineLayers(def: LinesOverlay, dark: boolean, font: DataDrivenPropertyValueSpecification<string[]> = DEFAULT_FONT): LineSublayer[] {
  const id = OVERLAY_PREFIX + def.id;
  const classes = typeof def.color === 'string' ? [] : def.color.classes;
  const tone = (c: string) => (dark ? (ON_DARK[c] ?? c) : c);
  // 分類可以寫深色底圖用的顏色（同色相比較亮的一階）
  const classColor = (c: (typeof classes)[number]) => (dark && c.dark ? c.dark : tone(c.color));
  const color: ExpressionSpecification | string =
    typeof def.color === 'string'
      ? tone(def.color)
      : (['match', ['coalesce', ['get', 'type'], -1], ...classes.flatMap((c) => [c.value, classColor(c)]), classColor(classes[0])] as unknown as ExpressionSpecification);
  const dashed = classes.filter((c) => c.dash).map((c) => c.value);
  const width = lineWidth(def);
  const paint = {
    'line-color': color,
    'line-width': lineZoomed(def, width),
    'line-opacity': lineOpacity(def, def.opacity ?? (dark ? 0.9 : 0.8)),
  };
  const isDashed: FilterSpecification = ['in', ['coalesce', ['get', 'type'], -1], ['literal', dashed]];
  // sortByType：代碼大的畫在上面（颱風強的那段疊在弱的上面）
  const layout = {
    'line-join': 'round' as const,
    'line-cap': 'round' as const,
    ...(def.sortByType ? { 'line-sort-key': ['coalesce', ['get', 'type'], 0] as ExpressionSpecification } : {}),
  };
  const highlight = id + HIGHLIGHT_SUFFIX;
  // 分區畫在主檔的下面（小河在大河下面）
  const sources = def.detail ? [id + DETAIL_SUFFIX, id] : [id];
  const out: LineSublayer[] = [];
  if (def.fill) {
    // 封閉的環畫成半透明的面（在所有線的下面）；外框由下面的線圖層畫
    const opacity = dark ? (def.fill.darkOpacity ?? def.fill.opacity) : def.fill.opacity;
    // 依分類的不透明度（地球的另一邊：陸地對陸地比對面是海的深）；滑過、標出的那一組是兩倍、最多 0.6
    const byType = Object.entries(def.fill.typeOpacity ?? {}).map(([code, [light, darkValue]]) => [Number(code), dark ? darkValue : light] as const);
    const fillOpacity = (k: (o: number) => number): ExpressionSpecification | number =>
      byType.length
        ? (['match', ['coalesce', ['get', 'type'], -1], ...byType.flatMap(([code, o]) => [code, k(o)]), k(opacity)] as unknown as ExpressionSpecification)
        : k(opacity);
    // 斜線（fill.hatch）：每一類一張斜線圖片（addHatchImages），方向不同，重疊的地方變成交叉線
    const hatch = def.fill.hatch;
    const hatched = hatch ? classes.filter((c) => hatch[c.value] !== undefined) : [];
    // 斜線的分類：底下的面（查詢、滑過用）不透明度 0，另一層畫斜線圖片（addHatchImages），方向不同，重疊的地方變成交叉線；
    // 其他分類照舊是半透明的面（專屬經濟海域：一般的 200 浬是淡色的面、重疊主張與共同管理區是斜線）
    const hatchedTypes = hatched.map((c) => c.value);
    const baseOpacity = fillOpacity((o) => o);
    const solidOpacity: ExpressionSpecification | number = hatchedTypes.length
      ? (['case', ['in', ['coalesce', ['get', 'type'], -1], ['literal', hatchedTypes]], 0, baseOpacity] as ExpressionSpecification)
      : baseOpacity;
    const isHatched: FilterSpecification = ['in', ['coalesce', ['get', 'type'], -1], ['literal', hatchedTypes]];
    for (const source of sources) {
      out.push({
        layer: {
          id: source + FILL_SUFFIX,
          type: 'fill',
          source,
          filter: IS_POLYGON,
          paint: { 'fill-color': color, 'fill-opacity': solidOpacity, 'fill-antialias': false },
        },
        base: IS_POLYGON,
        hover: false,
      });
      if (hatched.length) {
        const pattern = [
          'match',
          ['coalesce', ['get', 'type'], -1],
          ...hatched.flatMap((c) => [c.value, hatchImageId(classColor(c), hatch![c.value])]),
          hatchImageId(classColor(hatched[0]), hatch![hatched[0].value]),
        ] as unknown as ExpressionSpecification;
        const filter = ['all', IS_POLYGON, isHatched] as unknown as FilterSpecification;
        out.push({
          layer: {
            id: source + HATCH_SUFFIX,
            type: 'fill',
            source,
            filter,
            paint: { 'fill-pattern': pattern, 'fill-opacity': dark ? 0.85 : 0.75, 'fill-antialias': false },
          },
          base: filter,
          hover: false,
        });
      }
    }
    if (canHighlight(def)) {
      out.push({
        layer: {
          id: id + HOVER_FILL_SUFFIX,
          type: 'fill',
          source: highlight,
          filter: IS_POLYGON,
          paint: { 'fill-color': color, 'fill-opacity': fillOpacity((o) => Math.min(0.6, o * 2)), 'fill-antialias': false },
        },
        base: IS_POLYGON,
        hover: true,
      });
    }
  }
  const solidBase = dashed.length ? (['!', isDashed] as FilterSpecification) : null;
  for (const source of sources) {
    if (def.casing) {
      out.push({
        layer: {
          id: source + CASING_SUFFIX,
          type: 'line',
          source,
          layout,
          paint: {
            'line-color': dark ? '#ffffff' : MAP_TOKENS.ink,
            'line-opacity': lineOpacity(def, dark ? 0.4 : 0.28),
            'line-width': lineZoomed(def, typeof width === 'number' ? width + 1.4 : ['+', width, 1.4]),
          },
        },
        base: null,
        hover: false,
      });
    }
    out.push({
      layer: { id: source, type: 'line', source, layout, paint, ...(solidBase ? { filter: solidBase } : {}) },
      base: solidBase,
      hover: false,
    });
    // line-dasharray 不能依資料變化，虛線的類別另外一層
    if (dashed.length) {
      out.push({
        layer: { id: `${source}-dash`, type: 'line', source, layout, filter: isDashed, paint: { ...paint, 'line-dasharray': [2, 1.5] } },
        base: isDashed,
        hover: false,
      });
    }
    if (def.lineLabel) {
      // 沿著線寫的文字（北回歸線）：每隔一段重複一次，放大到哪裡都看得到；線的顏色加一圈底圖色的光暈
      out.push({
        layer: {
          id: source + LABEL_SUFFIX,
          type: 'symbol',
          source,
          filter: ['has', '_label'],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 260,
            'text-field': ['get', '_label'],
            'text-font': font,
            'text-size': 11.5,
            'text-letter-spacing': 0.04,
            'text-max-angle': 25,
            'text-offset': [0, -0.75],
          },
          paint: {
            'text-color': color,
            'text-halo-color': dark ? '#0b0b0b' : '#ffffff',
            'text-halo-width': 1.4,
            'text-opacity': lineOpacity(def, 1),
          },
        },
        base: null,
        hover: false,
      });
    }
    if (def.tooltip) {
      // 看不見的寬線：queryRenderedFeatures 依線寬判斷有沒有滑到，跟不透明度無關
      out.push({
        layer: { id: source + HIT_SUFFIX, type: 'line', source, layout, paint: { 'line-width': HIT_WIDTH, 'line-opacity': 0 } },
        base: null,
        hover: false,
      });
    }
  }
  if (canHighlight(def)) {
    const hover = hoverWidth(def);
    if (def.hoverHalo) {
      // 光暈：一整個河流系統跟旁邊同色的線分得開
      out.push({
        layer: {
          id: id + HALO_SUFFIX,
          type: 'line',
          source: highlight,
          layout,
          paint: {
            'line-color': dark ? '#ffffff' : MAP_TOKENS.ink,
            'line-width': lineZoomed(def, typeof hover === 'number' ? hover + 2.5 : ['+', hover, 2.5]),
            'line-opacity': dark ? 0.45 : 0.35,
            'line-blur': 1,
          },
        },
        base: null,
        hover: true,
      });
    }
    out.push({
      layer: {
        id: id + HOVER_SUFFIX,
        type: 'line',
        source: highlight,
        layout,
        paint: { 'line-color': color, 'line-width': lineZoomed(def, hover), 'line-opacity': 1 },
      },
      base: null,
      hover: true,
    });
  }
  // 有面的圖層：線的那幾層只畫線（環的外框另外做成 LineString，見 partFeatures()），不畫多邊形的外框
  if (def.fill) {
    for (const sub of out) {
      if (sub.layer.type !== 'line') continue;
      sub.base = allOf([sub.base, NOT_POLYGON]);
      (sub.layer as { filter?: FilterSpecification }).filter = sub.base!;
    }
  }
  // onlyTypes：只畫這幾類（滑過、側欄標出的那幾層不限，標的是使用者指定的那一組）
  if (def.onlyTypes) {
    const only: FilterSpecification = ['in', ['coalesce', ['get', 'type'], -1], ['literal', def.onlyTypes]];
    for (const sub of out) {
      if (sub.hover) continue;
      sub.base = allOf([sub.base, only]);
      (sub.layer as { filter?: FilterSpecification }).filter = sub.base!;
    }
  }
  return out;
}

/**
 * 點的 GeoJSON：只帶畫圖、篩選、hover 要用的欄位（i 是紀錄的索引，tooltip 用）。
 * 有 epochs 的圖層再加上那一期算出的欄位（例如城市那一期的人口）。
 */
function pointFeatures(o: Extract<DataOverlay, { kind: 'points' }>, epoch: number | null): GeoJSON.FeatureCollection {
  const { def, points } = o;
  if (!points) return EMPTY;
  const fields = new Set<string>(['iso3']);
  if (typeof def.radius !== 'number') fields.add(def.radius.field);
  if (typeof def.color !== 'string') fields.add(def.color.field);
  if (def.timeField) fields.add(def.timeField);
  if (def.endField) fields.add(def.endField);
  if (def.sortField) fields.add(def.sortField);
  // 依縮放篩選的欄位（城市的人口來自 epochs，其他主題直接是紀錄的欄位：特殊地形的「有沒有維基條目」）
  if (def.minValue) fields.add(def.minValue.field);
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
    const label = def.pointLabel?.(p);
    if (label) properties._label = label;
    features.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lon, lat] } });
  });
  return { type: 'FeatureCollection', features };
}

/** 每一份線（主檔、一個分區）算好的 features：移動地圖換分區時，留著的那幾份不必重算 */
const featureCache = new WeakMap<DecodedLines, { key: unknown; offset: number; features: GeoJSON.Feature[] }>();

/**
 * 一份線的 GeoJSON features。i 是紀錄的索引（tooltip 用），從 offset 起算：主檔與分區接起來的順序（concatLines）。
 * 紀錄完全相同的線是同一組（同一條電纜被切成好幾段），滑到其中一段時整組一起標出；有 groupField 時依那個欄位，
 * 沒有的話組別從 offset 起編，不同份的線不會撞號。
 */
function partFeatures(def: LinesOverlay, part: DecodedLines, offset: number): GeoJSON.Feature[] {
  // 沿線的文字依目前的語言，換語言時設定是另一個物件，要重算
  const key = def.lineLabel ? def : def.id;
  const hit = featureCache.get(part);
  if (hit && hit.key === key && hit.offset === offset) return hit.features;
  const { lines, types, records, vertexTypes } = part;
  const { timeField, groupField } = def;
  // 畫圖、篩選要用的紀錄欄位（時間、結束年份、線寬、依縮放的篩選）
  const fields = [timeField, def.endField, typeof def.width === 'number' ? undefined : def.width.field, def.minValue?.field].filter(
    (f): f is string => Boolean(f),
  );
  const groups = new Map<string, number>();
  const features: GeoJSON.Feature[] = [];
  let lastPolygon: GeoJSON.Polygon | null = null;
  lines.forEach((coordinates, k) => {
    const i = offset + k;
    const properties: Record<string, number | string> = { i };
    if (types) properties.type = types[k];
    const record = records?.[k];
    const label = record && def.lineLabel ? def.lineLabel(record) : '';
    if (label) properties._label = label;
    if (record) {
      const key = groupField ? String(record[groupField]) : JSON.stringify(record);
      let g = groups.get(key);
      if (g === undefined)
        groups.set(key, (g = groupField && typeof record[groupField] === 'number' ? (record[groupField] as number) : offset + groups.size));
      properties.g = g;
      for (const f of fields) {
        const v = record[f];
        if (v !== null && v !== undefined) properties[f] = v;
      }
    } else {
      properties.g = i;
    }
    // 封閉的環（LinesOverlayDef.fill）：多邊形給面那一層；外框另外做成 LineString 給線的圖層，
    // 只畫地圖畫得到的緯度（±85.05° 以內）：超出的部分 MapLibre 會壓到 85° 的緯線上，在極區畫出一整圈
    // （環繞極點的路徑補上的 ±90° 那段、從極點附近經過的界線）
    const fill = def.fill;
    if (fill && record && record[fill.field] === fill.value) {
      const [first, last] = [coordinates[0], coordinates[coordinates.length - 1]];
      const ring = first && (first[0] !== last[0] || first[1] !== last[1]) ? [...coordinates, first] : coordinates;
      // 洞（holeField）接在前一個外環的多邊形後面
      if (fill.holeField && record[fill.holeField] === 1 && lastPolygon) {
        lastPolygon.coordinates.push(ring);
      } else {
        lastPolygon = { type: 'Polygon', coordinates: [ring] };
        features.push({ type: 'Feature', properties, geometry: lastPolygon });
      }
      const outline = fill.outline === undefined || (fill.outline !== false && fill.outline.includes(types?.[k] ?? -1));
      if (outline) {
        for (const part of clipLatitude(ring)) features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: part } });
      }
      return;
    }
    const codes = vertexTypes?.[k];
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
  featureCache.set(part, { key, offset, features });
  return features;
}

/**
 * 每個線圖層目前在地圖上的 features（主檔與分區），標出一組時依組別找出那一組的線；byGroup 第一次用到時才建。
 * syncOverlays 重送資料時重設。
 */
const lineIndex = new Map<string, { parts: GeoJSON.Feature[][]; byGroup: Map<number, GeoJSON.Feature[]> | null }>();

function groupFeatures(overlay: string, group: number): GeoJSON.Feature[] {
  const entry = lineIndex.get(overlay);
  if (!entry) return [];
  if (!entry.byGroup) {
    const byGroup = new Map<number, GeoJSON.Feature[]>();
    for (const features of entry.parts) {
      for (const f of features) {
        const g = f.properties!.g as number;
        const list = byGroup.get(g);
        if (list) list.push(f);
        else byGroup.set(g, [f]);
      }
    }
    entry.byGroup = byGroup;
  }
  return entry.byGroup.get(group) ?? [];
}

/**
 * 一組線的第一條線（同一筆紀錄）從頭到尾的頂點與每個頂點的分類代碼（依代碼切開的各段接回來，交界的頂點只留一次）：
 * 沿路線移動的點用（routeAnimation.ts）。i 是那筆紀錄的索引
 */
export function groupPath(overlay: string, group: number): { coords: [number, number][]; codes: (number | null)[]; i: number } | null {
  const features = groupFeatures(overlay, group).filter((f) => f.geometry.type === 'LineString');
  if (!features.length) return null;
  const i = Number(features[0].properties!.i);
  const coords: [number, number][] = [];
  const codes: (number | null)[] = [];
  for (const f of features) {
    if (Number(f.properties!.i) !== i) continue;
    const line = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
    const code = typeof f.properties!.type === 'number' ? (f.properties!.type as number) : null;
    line.forEach((c, k) => {
      if (k === 0 && coords.length) return;
      coords.push(c);
      codes.push(code);
    });
  }
  return coords.length >= 2 ? { coords, codes, i } : null;
}

const sameParts = (a: unknown, b: DecodedLines[]) => Array.isArray(a) && a.length === b.length && a.every((p, k) => p === b[k]);

/**
 * 線圖層的資料送到地圖上：主檔一個 source，分區（有 detail 的）另一個 source，各自資料變了才重送。
 * 移動地圖換分區時主檔不動，MapLibre 只重切分區那個 source 的圖磚。
 */
function sendLines(map: MaplibreMap, o: Extract<DataOverlay, { kind: 'lines' }>, sent: OverlayDataCache) {
  if (!o.lines) return;
  const id = OVERLAY_PREFIX + o.def.id;
  const parts = o.lines.parts ?? [o.lines];
  const offsets: number[] = [];
  parts.reduce((n, p) => (offsets.push(n), n + p.lines.length), 0);
  const features = parts.map((p, k) => partFeatures(o.def, p, offsets[k]));
  // 沒有 detail 的線圖層全部畫在主檔的 source
  const split = o.def.detail ? 1 : parts.length;
  const targets: [string, number, number][] = [[id, 0, split]];
  if (o.def.detail) targets.push([id + DETAIL_SUFFIX, split, parts.length]);
  let changed = !lineIndex.has(o.def.id);
  for (const [source, from, to] of targets) {
    const own = parts.slice(from, to);
    const prev = sent.get(source);
    // 有沿線文字的線換語言時（設定是另一個物件）也要重送，文字才會換
    const relabel = Boolean(o.def.lineLabel) && prev?.def !== o.def;
    if (prev && sameParts(prev.data, own) && !relabel) continue;
    (map.getSource(source) as GeoJSONSource).setData({ type: 'FeatureCollection', features: features.slice(from, to).flat() });
    sent.set(source, { data: own, epoch: null, def: o.def });
    changed = true;
  }
  if (changed) lineIndex.set(o.def.id, { parts: features, byGroup: null });
}

/** 線圖層用到的 source：主檔、分區（有 detail 的）、標出的那一組（標得出來的） */
function lineSources(def: LinesOverlay): string[] {
  const id = OVERLAY_PREFIX + def.id;
  return [id, ...(def.detail ? [id + DETAIL_SUFFIX] : []), ...(canHighlight(def) ? [id + HIGHLIGHT_SUFFIX] : [])];
}

/** 麥卡托（與地球儀的圖磚）畫得到的最高緯度 */
const MAX_LAT = 85.0511;

/** 把線切成在 ±MAX_LAT 以內的幾段，跨過界線的地方內插出端點 */
function clipLatitude(line: [number, number][]): [number, number][][] {
  const parts: [number, number][][] = [];
  let run: [number, number][] = [];
  const inside = (p: [number, number]) => Math.abs(p[1]) <= MAX_LAT;
  const cross = (a: [number, number], b: [number, number]): [number, number] => {
    const lat = Math.sign(Math.abs(a[1]) > MAX_LAT ? a[1] : b[1]) * MAX_LAT;
    const t = (lat - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), lat];
  };
  line.forEach((p, k) => {
    const prev = line[k - 1];
    if (inside(p)) {
      if (prev && !inside(prev)) run.push(cross(prev, p));
      run.push(p);
    } else if (prev && inside(prev)) {
      run.push(cross(prev, p));
      if (run.length >= 2) parts.push(run);
      run = [];
    }
  });
  if (run.length >= 2) parts.push(run);
  return parts;
}

/** 依時間軸篩選的點：只有那一年、累積到那一年，或那一年起的 n 年（指標的 overlayTime） */
export function timeFilter(
  def: { timeField?: string; endField?: string },
  year: number | ExpressionSpecification,
  mode: IndicatorDef['overlayTime'],
): FilterSpecification | null {
  if (!def.timeField) return null;
  const t: ExpressionSpecification = ['get', def.timeField];
  const has: FilterSpecification = ['has', def.timeField];
  if (mode === 'cumulative') {
    if (!def.endField) return ['all', has, ['<=', t, year]];
    // 有結束年份的（例如拆除的大樓）那一年起不畫
    const end: ExpressionSpecification = ['get', def.endField];
    return ['all', has, ['<=', t, year], ['any', ['!', ['has', def.endField]], ['>', end, year]]];
  }
  if (typeof mode === 'number') return ['all', has, ['>=', t, year], ['<', t, typeof year === 'number' ? year + mode : ['+', year, mode]]];
  return ['all', has, ['==', t, year]];
}

/**
 * 依縮放篩選的點（PointsOverlayDef.minValue）：數值要大於等於這一級的門檻。filter 裡的 ['zoom'] 是圖磚的整數級數，
 * 所以門檻在整數級數換；沒有這個欄位的點（例如那一期還不是城市）不畫。
 */
function valueFilter(def: { minValue?: { field: string; stops: [number, number][] } }): FilterSpecification | null {
  if (!def.minValue) return null;
  const { field, stops } = def.minValue;
  // 只有一個門檻時是固定的篩選（step 至少要一個分段）：日食的「只留中心線」
  const threshold =
    stops.length === 1 ? stops[0][1] : (['step', ['zoom'], stops[0][1], ...stops.slice(1).flat()] as unknown as ExpressionSpecification);
  return ['all', ['has', field], ['>=', ['get', field], threshold]];
}

/** 點、線圖層的篩選：時間篩選與依縮放的篩選合併 */
function pointFilter(
  def: Pick<PointsOverlay, 'timeField' | 'endField' | 'minValue'>,
  year: number | ExpressionSpecification,
  mode: IndicatorDef['overlayTime'],
): FilterSpecification | null {
  return allOf([timeFilter(def, year, mode), valueFilter(def)]);
}

function allOf(parts: (FilterSpecification | null)[]): FilterSpecification | null {
  const used = parts.filter((f): f is FilterSpecification => f !== null);
  return used.length === 0 ? null : used.length === 1 ? used[0] : (['all', ...used] as FilterSpecification);
}

/** 每個疊加圖層上次送到地圖上的資料與那一期（同一份就不必再送一次）；換底圖後要清掉 */
export type OverlayDataCache = Map<string, { data: unknown; epoch: number | null; def: unknown }>;

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
  overlays = overlays.filter(isData);
  const sourcesOf = (o: DataOverlay) =>
    o.kind === 'points'
      ? [OVERLAY_PREFIX + o.def.id, ...(o.def.cluster ? [OVERLAY_PREFIX + o.def.id + CLUSTER_SUFFIX] : [])]
      : [...(o.def.heat?.only ? [] : lineSources(o.def)), ...(o.def.heat ? [OVERLAY_PREFIX + o.def.id + HEAT_POINTS] : [])];
  const wanted = new Set((overlays as DataOverlay[]).flatMap(sourcesOf));
  const font = labelFont(map);
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
  for (const o of overlays as DataOverlay[]) {
    const id = OVERLAY_PREFIX + o.def.id;
    // 放大後淡出的線（fadeOut）不必切到預設的 18 級圖磚，切到看不見的那一級就好
    const fade = o.kind === 'lines' && o.def.fadeOut ? { maxzoom: Math.ceil(o.def.fadeOut[1]) } : {};
    for (const source of sourcesOf(o)) {
      if (map.getSource(source)) continue;
      const clustered = o.kind === 'points' && source.endsWith(CLUSTER_SUFFIX);
      map.addSource(source, clustered ? clusterSource(o.def) : { type: 'geojson', data: EMPTY, ...fade });
      sent.delete(source);
    }
    const heatOnly = o.kind === 'lines' && Boolean(o.def.heat?.only);
    if (!map.getLayer(heatOnly ? id + HEAT_SUFFIX : id)) {
      if (o.kind === 'lines' && o.def.heat) {
        // 線的密度（heat）：頂點做成點的熱度圖，畫在線的下面
        map.addLayer(lineHeatLayer(o.def), before(LINES_BEFORE));
      }
      if (heatOnly) {
        // 只有熱度圖，不畫線
      } else if (o.kind === 'points' && o.def.trail) {
        // 連成線的點（trails.ts）畫在疊在地圖上的 canvas，不加圓點的圖層
      } else if (o.kind === 'points') {
        if (o.def.shape === 'triangle') addTriangleIcons(map, pointColors(o.def));
        const layer = pointLayer(o.def);
        map.addLayer(layer, before(POINTS_BEFORE));
        // 聚成甜甜圈的（cluster）：maxZoom 以下畫聚合 source 上沒聚在一起的點（原本的點圖層的複本），原本的從 maxZoom + 1 起畫
        if (o.def.cluster) {
          const from = o.def.cluster.maxZoom + 1;
          const notClustered: FilterSpecification = ['!', ['has', 'point_count']];
          map.addLayer(
            {
              ...layer,
              id: id + CLUSTER_SUFFIX,
              source: id + CLUSTER_SUFFIX,
              maxzoom: from,
              filter: 'filter' in layer && layer.filter ? ['all', notClustered, layer.filter] : notClustered,
            } as LayerSpecification,
            before(POINTS_BEFORE),
          );
          map.setLayerZoomRange(id, Math.max(from, o.def.minZoom ?? 0), 24);
        }
        // 文字放在最上面：MapLibre 依圖層由上往下排字，放在底圖地名的下面時會被國名、城市名擋掉
        if (o.def.pointLabel) map.addLayer(pointLabelLayer(o.def, dark, labelFont(map, /place|country|city/)));
        // 熱度圖畫在點的下面（applyTimeFilters 依時間模式打開）
        if (o.def.heatmap) map.addLayer(heatLayer(o.def), id);
      } else {
        addHatchImages(map, o.def, dark);
        // under：面畫在國家的面下面（專屬經濟海域：海岸那一側很粗略，由陸地蓋住）
        const at = o.def.under ? before('data-fill') : before(LINES_BEFORE);
        for (const { layer } of lineLayers(o.def, dark, font)) map.addLayer(layer, at);
      }
    }
    if (o.kind === 'points') {
      const epoch = overlayEpoch(o.def, year);
      const prev = sent.get(id);
      // 點旁邊的文字依語言寫（換語言時 def 是另一個物件），要重送
      if (o.points && (prev?.data !== o.points || prev.epoch !== epoch || (o.def.pointLabel && prev.def !== o.def))) {
        (map.getSource(id) as GeoJSONSource).setData(pointFeatures(o, epoch));
        sent.set(id, { data: o.points, epoch, def: o.def });
      }
    } else {
      if (!heatOnly) sendLines(map, o, sent);
      if (o.def.heat) sendLineHeat(map, o, sent);
    }
    const visibility = o.visible && (o.kind === 'points' ? o.points : o.lines) ? 'visible' : 'none';
    const layerIds =
      o.kind === 'points'
        ? [id, id + LABEL_SUFFIX, id + CLUSTER_SUFFIX]
        : [...(heatOnly ? [] : lineLayers(o.def, dark).map((s) => s.layer.id)), id + HEAT_SUFFIX];
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
  // 甜甜圈（clusterDonuts.ts）：開著、資料到了的才畫
  const donuts = new Map<string, { spec: DonutSpec; visible: boolean }>();
  for (const o of overlays as DataOverlay[]) {
    if (o.kind !== 'points' || !o.def.cluster) continue;
    donuts.set(OVERLAY_PREFIX + o.def.id + CLUSTER_SUFFIX, { spec: donutSpec(o.def), visible: Boolean(o.visible && o.points) });
  }
  syncDonuts(map, donuts);
  // 連成線的點（trails.ts）
  const trails: TrailInput[] = [];
  for (const o of overlays as DataOverlay[]) {
    if (o.kind !== 'points' || !o.def.trail || !o.def.timeField || typeof o.def.color === 'string') continue;
    trails.push({
      layerId: OVERLAY_PREFIX + o.def.id,
      points: o.points ?? null,
      timeField: o.def.timeField,
      colors: o.def.color,
      visible: Boolean(o.visible && o.points),
      head: o.def.trail.head,
      dark,
    });
  }
  syncTrails(map, trails);
  const reversed = [...(overlays as DataOverlay[])].reverse();
  const pointIds = reversed
    .filter((o) => o.kind === 'points')
    .flatMap((o) => [OVERLAY_PREFIX + o.def.id, ...(o.def.cluster ? [OVERLAY_PREFIX + o.def.id + CLUSTER_SUFFIX] : [])]);
  // 線的查詢層：主檔的在前（游標附近有大河時先選到大河），再來是分區的
  const lineIds = reversed.flatMap((o) => {
    if (o.kind !== 'lines' || !o.def.tooltip) return [];
    const id = OVERLAY_PREFIX + o.def.id;
    return [id + HIT_SUFFIX, ...(o.def.detail ? [id + DETAIL_SUFFIX + HIT_SUFFIX] : [])];
  });
  // 面也給查詢的（fill.hover）排在所有線的後面：游標在外框附近時先選到線
  const fillIds = reversed.flatMap((o) => {
    if (o.kind !== 'lines' || !o.def.tooltip || !o.def.fill?.hover) return [];
    const id = OVERLAY_PREFIX + o.def.id;
    return [id + FILL_SUFFIX, ...(o.def.detail ? [id + DETAIL_SUFFIX + FILL_SUFFIX] : [])];
  });
  return [...pointIds, ...lineIds, ...fillIds];
}

/** 換年份或指標時更新點與線的篩選；線的時間篩選要跟它本身的篩選（實線／虛線）合併，點的跟依縮放的篩選合併 */
/** 疊加圖層的時間篩選讀這個全域狀態（每個疊加圖層一個，timeRange 會夾到各自的資料範圍） */
const yearKey = (id: string) => `year:${id}`;
/** 每個圖層上次設的篩選（JSON），結構沒變就不再 setFilter */
const filterSent = new WeakMap<MaplibreMap, Map<string, string>>();

function setFilterOnce(map: MaplibreMap, layerId: string, filter: FilterSpecification | null) {
  if (!map.getLayer(layerId)) return;
  let sent = filterSent.get(map);
  if (!sent) filterSent.set(map, (sent = new Map()));
  const key = JSON.stringify(filter);
  // 換底圖後圖層是新的（篩選是加上時的）：用圖層物件的篩選比對，不只看記錄
  if (sent.get(layerId) === key && JSON.stringify(map.getFilter(layerId) ?? null) === key) return;
  map.setFilter(layerId, filter);
  sent.set(layerId, key);
}

/**
 * 換年份或指標時更新點與線的篩選；線的時間篩選要跟它本身的篩選（實線／虛線）合併，點的跟依縮放的篩選合併。
 * 2026-11-01 起篩選裡的年份是全域狀態（MapLibre 的 global-state，使用者選的範例「Filter layer symbols using global state」）：
 * 篩選的結構只在換指標（時間模式）時設一次，換年份時只改 `year:<疊加圖層>` 的值（setGlobalStateProperty），
 * 不必每一年把每個圖層的篩選重設一次（播放時每一格十幾個 setFilter）
 */
export function applyTimeFilters(
  map: MaplibreMap,
  overlays: OverlayLayer[],
  shownYear: number,
  indicatorMode: IndicatorDef['overlayTime'],
  indicatorId?: string,
) {
  for (const o of overlays.filter(isData)) {
    const id = OVERLAY_PREFIX + o.def.id;
    // 共用疊加圖層（shared-layers.ts）有自己跟時間軸的方式，時間軸超出它的資料範圍時用最接近的一年
    const mode = o.def.overlayTime ?? indicatorMode;
    const range = o.def.timeRange === 'data' ? dataYears(o) : o.def.timeRange;
    const year = range ? Math.min(Math.max(shownYear, range[0]), range[1]) : shownYear;
    const y: ExpressionSpecification = ['global-state', yearKey(o.def.id)];
    if (o.def.timeField) map.setGlobalStateProperty(yearKey(o.def.id), year);
    if (o.kind === 'points') {
      if (o.def.trail) {
        setTrailYear(map, id, year, mode);
        continue;
      }
      if (o.def.cluster) sendClustered(map, o, year, mode);
      if (o.def.heatmap && map.getLayer(id + HEAT_SUFFIX)) {
        // 點多的時候縮小畫熱度、maxZoom 起換成點；點少（只有一年）時照舊都是點
        // heatmap.indicators：只有這幾個指標畫熱度（語言的「語言多樣性」；「語系」照舊畫依語系上色的點）
        const forIndicator = !o.def.heatmap.indicators || (indicatorId !== undefined && o.def.heatmap.indicators.includes(indicatorId));
        // allYears：熱度是全部年份累計（武裝衝突 1989 年起），不跟時間軸篩選，點照舊畫那一年的（keepPoints）
        const all = Boolean(o.def.heatmap.allYears);
        const heat = Boolean(o.visible && o.points) && (all || manyPoints(o.def, mode)) && forIndicator;
        setFilterOnce(map, id + HEAT_SUFFIX, all ? valueFilter(o.def) : pointFilter(o.def, y, mode));
        map.setLayoutProperty(id + HEAT_SUFFIX, 'visibility', heat ? 'visible' : 'none');
        const minZoom = o.def.minZoom ?? 0;
        if (!o.def.heatmap.keepPoints) map.setLayerZoomRange(id, heat ? Math.max(o.def.heatmap.maxZoom, minZoom) : minZoom, 24);
      }
      if (!o.def.timeField && !o.def.minValue) continue;
      setFilterOnce(map, id, pointFilter(o.def, y, mode));
      setFilterOnce(map, id + LABEL_SUFFIX, allOf([['has', '_label'], pointFilter(o.def, y, mode) ?? null]));
      continue;
    }
    if (!o.def.timeField && !o.def.minValue) continue;
    if (o.def.heat?.only) continue;
    // 時間篩選與依縮放的篩選要跟它本身的篩選（實線／虛線、只畫線或面）合併；標出一組的那幾層只合併依縮放的篩選
    // （放大前看不到的支流不會跟著亮起來）
    const value = valueFilter(o.def);
    const extra = allOf([timeFilter(o.def, y, mode), value]);
    for (const { layer, base, hover } of lineLayers(o.def, false)) setFilterOnce(map, layer.id, allOf([base, hover ? value : extra]));
  }
}

/** 一筆紀錄在不在時間軸這一年（跟 timeFilter 一樣的規則，聚合的 source 在瀏覽器裡先篩好再送） */
function inTime(p: Record<string, unknown>, def: { timeField?: string; endField?: string }, year: number, mode: IndicatorDef['overlayTime']): boolean {
  if (!def.timeField) return true;
  const t = p[def.timeField];
  if (typeof t !== 'number') return false;
  if (mode === 'cumulative') {
    const end = def.endField ? p[def.endField] : undefined;
    return t <= year && !(typeof end === 'number' && end <= year);
  }
  if (typeof mode === 'number') return t >= year && t < year + mode;
  return t === year;
}

/**
 * 圖層開關旁的件數（2026-11-05，參3）：時間軸這一年畫出來的點數（或 count.field 的合計），年份與篩選方式跟
 * applyTimeFilters 一樣；不是點圖層、還沒讀到資料、軌跡、依期變的點與 count: false 是 null
 */
export function overlayCount(o: OverlayLayer, shownYear: number, indicatorMode: IndicatorDef['overlayTime']): number | null {
  if (o.kind !== 'points' || !o.points || o.def.count === false || o.def.trail || o.def.epochs) return null;
  const mode = o.def.overlayTime ?? indicatorMode;
  const range = o.def.timeRange === 'data' ? dataYears(o) : o.def.timeRange;
  const year = range ? Math.min(Math.max(shownYear, range[0]), range[1]) : shownYear;
  const field = o.def.count?.field;
  let total = 0;
  for (const p of o.points) {
    if (!inTime(p, o.def, year, mode)) continue;
    const v = field ? p[field] : 1;
    if (typeof v === 'number') total += v;
  }
  return total;
}

/** 聚合 source 上次送的資料（同一份點、同一年、同一個 source 就不必再送） */
const clusterSent = new WeakMap<MaplibreMap, Map<string, { source: unknown; points: unknown; year: number; mode: unknown }>>();

/** 聚合的 source：時間軸這一年的點（聚合是 source 層級的，不能用圖層的 filter 篩） */
function sendClustered(map: MaplibreMap, o: Extract<DataOverlay, { kind: 'points' }>, year: number, mode: IndicatorDef['overlayTime']) {
  const id = OVERLAY_PREFIX + o.def.id + CLUSTER_SUFFIX;
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (!source || !o.points) return;
  let sent = clusterSent.get(map);
  if (!sent) clusterSent.set(map, (sent = new Map()));
  const timeYear = o.def.timeField ? year : 0;
  const prev = sent.get(id);
  if (prev && prev.source === source && prev.points === o.points && prev.year === timeYear && prev.mode === mode) return;
  const all = pointFeatures(o, overlayEpoch(o.def, year));
  const features = o.def.timeField ? all.features.filter((f) => inTime(f.properties ?? {}, o.def, year, mode)) : all.features;
  source.setData({ type: 'FeatureCollection', features });
  sent.set(id, { source, points: o.points, year: timeYear, mode });
  resetDonuts(map, id);
}

/**
 * 資料的年份範圍（timeRange 是 'data' 的疊加圖層，別的主題的圖層 topics/foreign-layers.ts）：timeField 的最小、最大值，
 * 依資料（同一份點、同一組線）快取；還沒讀到或沒有年份是 undefined（不夾）
 */
const yearsCache = new WeakMap<object, [number, number] | undefined>();
function dataYears(o: OverlayLayer): [number, number] | undefined {
  const records = o.kind === 'points' ? o.points : o.kind === 'lines' ? o.lines?.records : null;
  const field = o.kind === 'points' || o.kind === 'lines' ? o.def.timeField : undefined;
  if (!records || !field) return undefined;
  if (yearsCache.has(records)) return yearsCache.get(records);
  let min = Infinity;
  let max = -Infinity;
  for (const r of records) {
    const v = r[field];
    if (typeof v !== 'number') continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range: [number, number] | undefined = min <= max ? [min, max] : undefined;
  yearsCache.set(records, range);
  return range;
}

/** 滑到線圖層的查詢層（主檔或分區的線，或 fill.hover 的面）時，回傳那個疊加圖層的 id；不是線的查詢層回傳 null */
export function lineOverlayAt(layerId: string): string | null {
  if (!layerId.startsWith(OVERLAY_PREFIX)) return null;
  const suffix = layerId.endsWith(HIT_SUFFIX)
    ? HIT_SUFFIX
    : layerId.endsWith(FILL_SUFFIX) && !layerId.endsWith(HOVER_FILL_SUFFIX)
      ? FILL_SUFFIX
      : null;
  if (!suffix) return null;
  const name = layerId.slice(OVERLAY_PREFIX.length, -suffix.length);
  return name.endsWith(DETAIL_SUFFIX) ? name.slice(0, -DETAIL_SUFFIX.length) : name;
}

/**
 * 標出一組線（滑到的，或側欄指定的；同一組的各段一起加粗）：標出的那一組的 source 換成那一組的線與面，
 * overlay 是 null 時清空。prev 是上一次標出的，換一組時先清掉它
 */
export function highlightLine(
  map: MaplibreMap,
  prev: { overlay: string; group: number } | null,
  next: { overlay: string; group: number } | null,
) {
  const set = (overlay: string, group: number | null) => {
    const source = map.getSource(OVERLAY_PREFIX + overlay + HIGHLIGHT_SUFFIX) as GeoJSONSource | undefined;
    source?.setData(group === null ? EMPTY : { type: 'FeatureCollection', features: groupFeatures(overlay, group) });
  };
  if (prev && (!next || prev.overlay !== next.overlay)) set(prev.overlay, null);
  if (next && (prev?.overlay !== next.overlay || prev.group !== next.group)) set(next.overlay, next.group);
}
