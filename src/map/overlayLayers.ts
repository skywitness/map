/**
 * 一般疊加圖層（主題 overlays 裡 kind 為 points、lines 的，例如地震、火山、板塊邊界、駐外館處）的 MapLibre 圖層。
 * 每個疊加圖層一個 GeoJSON source（`ov-<id>`）；圖層 id 也是 `ov-<id>`（虛線的線另外一層 `ov-<id>-dash`）。
 * 有 tooltip 的線另外兩層：看不見的寬線 `ov-<id>-hit` 給 hover 查詢（細線很難滑到），加粗的 `ov-<id>-hover` 標出滑到的那一條。
 * 標出的那一組放在另一個小 source `ov-<id>~h`，換一組只換它的資料：用 setFilter 的話 MapLibre 要把整個 source 的圖磚
 * 重做一次。
 * casing 的線在最下面多一層細邊 `ov-<id>-casing`。有 vertexTypes 的線（颱風）依每個頂點的代碼切成好幾段，各段分別上色。
 * 線寬可以依紀錄的欄位變化（河流依流量），hoverHalo 的線滑過時多一層光暈 `ov-<id>-hover-halo`，
 * minValue 依縮放篩選（縮小時只畫大河），fadeOut 放大後淡出。lineLabel 的線另外一層沿線的文字 `ov-<id>-label`（北回歸線）。
 * fill 的線（日食的路徑環）是多邊形：最下面多一層半透明的面 `ov-<id>-fill`，滑過的那一組加深 `ov-<id>-hover-fill`。
 * 放大後下載的分區（detail）畫在另一個 source `ov-<id>~d`（圖層 `ov-<id>~d`、`ov-<id>~d-hit`…，在主檔的線下面）：
 * 移動地圖換分區時只重送分區，主檔不必重新切圖磚（河流原本每移動一次就要把三萬多段重送一次，畫面停 0.2 秒以上）。
 * 晝夜（kind 'night'）、即時網格（kind 'liveGrid'）、類別網格（kind 'classGrid'）、風（kind 'wind'）不在這裡，見 nightLayer.ts、liveGridLayer.ts、classGridLayer.ts、windLayer.ts。
 * 切換底圖後新樣式沒有這些圖層，WorldMap 依 revision 重新呼叫 syncOverlays() 加回來。
 */
import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  LayerSpecification,
  Map as MaplibreMap,
} from 'maplibre-gl';
import { overlayEpoch, type IndicatorDef, type LinesOverlay, type PointsOverlay } from '../topics/types';
import { MAP_TOKENS } from '../theme/tokens';
import type { DecodedLines, OverlayLayer } from './Overlays';
import { isNameLayer } from './style';

/** 點、線疊加圖層（晝夜是另外的自訂圖層，nightLayer.ts） */
type DataOverlay = Exclude<OverlayLayer, { kind: 'night' } | { kind: 'liveGrid' } | { kind: 'classGrid' } | { kind: 'wind' }>;
const isData = (o: OverlayLayer): o is DataOverlay =>
  o.kind !== 'night' && o.kind !== 'liveGrid' && o.kind !== 'classGrid' && o.kind !== 'wind';

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
    for (const source of sources) {
      out.push({
        layer: {
          id: source + FILL_SUFFIX,
          type: 'fill',
          source,
          filter: IS_POLYGON,
          paint: { 'fill-color': color, 'fill-opacity': fillOpacity((o) => o), 'fill-antialias': false },
        },
        base: IS_POLYGON,
        hover: false,
      });
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
  year: number,
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
  if (typeof mode === 'number') return ['all', has, ['>=', t, year], ['<', t, year + mode]];
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
  year: number,
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
  const sourcesOf = (o: DataOverlay) => (o.kind === 'points' ? [OVERLAY_PREFIX + o.def.id] : lineSources(o.def));
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
      map.addSource(source, { type: 'geojson', data: EMPTY, ...fade });
      sent.delete(source);
    }
    if (!map.getLayer(id)) {
      if (o.kind === 'points') {
        if (o.def.shape === 'triangle') addTriangleIcons(map, pointColors(o.def));
        map.addLayer(pointLayer(o.def), before(POINTS_BEFORE));
        // 文字放在最上面：MapLibre 依圖層由上往下排字，放在底圖地名的下面時會被國名、城市名擋掉
        if (o.def.pointLabel) map.addLayer(pointLabelLayer(o.def, dark, labelFont(map, /place|country|city/)));
      } else {
        for (const { layer } of lineLayers(o.def, dark, font)) map.addLayer(layer, before(LINES_BEFORE));
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
      sendLines(map, o, sent);
    }
    const visibility = o.visible && (o.kind === 'points' ? o.points : o.lines) ? 'visible' : 'none';
    const layerIds = o.kind === 'points' ? [id, id + LABEL_SUFFIX] : lineLayers(o.def, dark).map((s) => s.layer.id);
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
  const reversed = [...(overlays as DataOverlay[])].reverse();
  const pointIds = reversed.filter((o) => o.kind === 'points').map((o) => OVERLAY_PREFIX + o.def.id);
  // 線的查詢層：主檔的在前（游標附近有大河時先選到大河），再來是分區的
  const lineIds = reversed.flatMap((o) => {
    if (o.kind !== 'lines' || !o.def.tooltip) return [];
    const id = OVERLAY_PREFIX + o.def.id;
    return [id + HIT_SUFFIX, ...(o.def.detail ? [id + DETAIL_SUFFIX + HIT_SUFFIX] : [])];
  });
  return [...pointIds, ...lineIds];
}

/** 換年份或指標時更新點與線的篩選；線的時間篩選要跟它本身的篩選（實線／虛線）合併，點的跟依縮放的篩選合併 */
export function applyTimeFilters(map: MaplibreMap, overlays: OverlayLayer[], year: number, mode: IndicatorDef['overlayTime']) {
  for (const o of overlays.filter(isData)) {
    const id = OVERLAY_PREFIX + o.def.id;
    if (o.kind === 'points') {
      if (!o.def.timeField && !o.def.minValue) continue;
      if (map.getLayer(id)) map.setFilter(id, pointFilter(o.def, year, mode));
      if (map.getLayer(id + LABEL_SUFFIX)) map.setFilter(id + LABEL_SUFFIX, allOf([['has', '_label'], pointFilter(o.def, year, mode) ?? null]));
      continue;
    }
    if (!o.def.timeField && !o.def.minValue) continue;
    // 時間篩選與依縮放的篩選要跟它本身的篩選（實線／虛線、只畫線或面）合併；標出一組的那幾層只合併依縮放的篩選
    // （放大前看不到的支流不會跟著亮起來）
    const value = valueFilter(o.def);
    const extra = allOf([timeFilter(o.def, year, mode), value]);
    for (const { layer, base, hover } of lineLayers(o.def, false)) {
      if (!map.getLayer(layer.id)) continue;
      map.setFilter(layer.id, allOf([base, hover ? value : extra]));
    }
  }
}

/** 滑到線圖層的查詢層（主檔或分區的）時，回傳那個疊加圖層的 id；不是線的查詢層回傳 null */
export function lineOverlayAt(layerId: string): string | null {
  if (!layerId.startsWith(OVERLAY_PREFIX) || !layerId.endsWith(HIT_SUFFIX)) return null;
  const name = layerId.slice(OVERLAY_PREFIX.length, -HIT_SUFFIX.length);
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
