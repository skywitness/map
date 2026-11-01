import type { DataDrivenPropertyValueSpecification, FilterSpecification, Map as MaplibreMap } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { fineTwin } from './fineBorders';
import { loadTilesIndex, pmtilesSource, type TilesEntry } from './pmtiles';

/**
 * 世界地圖主題的行政區（製作手冊第十六批 265，2026-11-01）：點國家顯示它的第一級，點第一級顯示它裡面的第二級，
 * 網址 `div=TWN`、`div=TWN-63000`、`div=TWN-63000-010`（lib/url-state.ts）。
 *
 * - 資料：`data/divisions/<代碼>.json`（名稱、種類、面積、範圍、寫名稱的位置、上一級，pipeline/divisions.py），
 *   界線是 PMTiles：第一級一份 `divisions1`（圖層 d1），第二級依洲分檔 `divisions2-<洲>`（圖層 d2）；圖磚只有
 *   `id`、`c`（國家）、`p`（上一級的 id），用 filter 只畫選到的那一國或那一區裡面的。
 * - 圖層：透明的面（滑過時微微加亮，hover 與點選用）、界線、選到的那一區的外框、名稱（GeoJSON 的點，名稱照介面語言）。
 * - 滑過、點選由 mapEvents 先問 `divisionAt`：游標底下有行政區就給它，不選國家（WorldMap 的 latest）。
 */

/** id 的層級：國家 0、第一級 1、第二級 2 */
export function divisionLevel(id: string): 0 | 1 | 2 {
  return Math.min(id.split('-').length - 1, 2) as 0 | 1 | 2;
}
export function divisionCountry(id: string): string {
  return id.split('-')[0];
}
/** 上一層的 id（第二級 → 第一級 → 國家）；國家的上一層是 null（世界） */
export function divisionParent(id: string): string | null {
  const parts = id.split('-');
  return parts.length > 1 ? parts.slice(0, -1).join('-') : null;
}

/** JSON 的一列：[id, 中文名稱, 英文名稱, 中文種類, 英文種類, 面積 km², [西, 南, 東, 北], [經度, 緯度]]，第二級多一欄上一級 */
export type DivisionRow = [
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  number,
  [number, number, number, number],
  [number, number],
  string?,
];

export interface DivisionSource {
  name: string;
  url: string;
  license: string;
  year?: string;
}

export interface DivisionsFile {
  sources: DivisionSource[];
  tiles2: string | null;
  u1: DivisionRow[];
  u2: DivisionRow[];
}

export interface Division {
  id: string;
  zh: string | null;
  en: string | null;
  typeZh: string | null;
  typeEn: string | null;
  km2: number;
  bbox: [number, number, number, number];
  point: [number, number];
  parent: string | null;
}

export function toDivision(row: DivisionRow): Division {
  const [id, zh, en, typeZh, typeEn, km2, bbox, point, parent] = row;
  return { id, zh, en, typeZh, typeEn, km2, bbox, point, parent: parent ?? null };
}

/** 介面語言的名稱；沒有的用另一種，都沒有用 id */
export function divisionName(d: Division, lang: 'zh' | 'en'): string {
  return (lang === 'zh' ? (d.zh ?? d.en) : (d.en ?? d.zh)) ?? d.id;
}

export interface DivisionsModel {
  file: DivisionsFile;
  byId: Map<string, Division>;
  level1: Division[];
  /** 第一級的 id → 它裡面的第二級 */
  children: Map<string, Division[]>;
}


/** 選到的第一級（第一級或第二級的 id 的前兩段） */
export function level1Of(div: string): string | null {
  return divisionLevel(div) >= 1 ? div.split('-').slice(0, 2).join('-') : null;
}

/** 地圖要畫的（map/divisions.ts 的 applyDivisions） */
export function divisionView(model: DivisionsModel, div: string, lang: 'zh' | 'en'): DivisionView {
  const level1 = level1Of(div);
  const units = (level1 && model.children.get(level1)) || model.level1;
  return {
    country: divisionCountry(div),
    level1,
    level2: divisionLevel(div) === 2 ? div : null,
    tiles2: model.file.tiles2,
    // 大的先放名稱（地圖放不下時小的先省略）
    labels: [...units].sort((a, b) => b.km2 - a.km2).map((d) => ({ id: d.id, name: divisionName(d, lang), point: d.point })),
  };
}

/** 框住 div 那一層的範圍：國家是所有第一級的範圍合起來 */
export function divisionBounds(model: DivisionsModel, div: string): [number, number, number, number] | null {
  const own = model.byId.get(div);
  if (own) return own.bbox;
  if (divisionLevel(div) !== 0 || model.level1.length === 0) return null;
  return model.level1.reduce<[number, number, number, number]>(
    (b, d) => [Math.min(b[0], d.bbox[0]), Math.min(b[1], d.bbox[1]), Math.max(b[2], d.bbox[2]), Math.max(b[3], d.bbox[3])],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}


/** 地圖要畫的：哪一國、選到的第一級與第二級、第二級在哪一份圖磚、要寫的名稱 */
export interface DivisionView {
  country: string;
  level1: string | null;
  level2: string | null;
  tiles2: string | null;
  /** 這一層的名稱（第一級，或選到的第一級裡面的第二級） */
  labels: { id: string; name: string; point: [number, number] }[];
}

const D1_SOURCE = 'div1';
const D2_SOURCE = 'div2';
const LABEL_SOURCE = 'div-labels';
const D1_FILL = 'div1-fill';
const D1_LINE = 'div1-line';
const D1_SEL = 'div1-sel';
const D2_FILL = 'div2-fill';
const D2_LINE = 'div2-line';
const D2_SEL = 'div2-sel';
const LABELS = 'div-labels';
/** hover、點選依序查的圖層（第二級在上面） */
export const DIVISION_HIT_LAYERS = [D2_FILL, D1_FILL];
const NOTHING: FilterSpecification = ['==', ['literal', 1], 0];

interface DivState {
  tiles: Record<string, TilesEntry> | null;
  /** 現在 div2 這個 source 是哪一份圖磚 */
  tiles2: string | null;
  hover: { source: string; layer: string; id: string } | null;
}
const states = new WeakMap<MaplibreMap, DivState>();

/** 插在國家外框（1:10m 的雙胞胎或 1:50m）上面、底圖的文字下面 */
function beforeLayer(map: MaplibreMap): string | undefined {
  const layers = map.getStyle().layers;
  const after = [fineTwin('data-highlight'), 'data-highlight'].find((id) => map.getLayer(id));
  if (!after) return undefined;
  const i = layers.findIndex((l) => l.id === after);
  return layers[i + 1]?.id;
}

function addLevelLayers(map: MaplibreMap, source: string, layer: string, ids: [string, string, string], dark: boolean, before?: string) {
  const [fill, line, sel] = ids;
  const ink = dark ? '#ffffff' : '#2b2b29';
  const level = layer === 'd1' ? 1 : 2;
  map.addLayer(
    {
      id: fill,
      type: 'fill',
      source,
      'source-layer': layer,
      filter: NOTHING,
      paint: {
        'fill-color': dark ? '#ffffff' : '#1f1f1d',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.12, 0],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: line,
      type: 'line',
      source,
      'source-layer': layer,
      filter: NOTHING,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ink,
        'line-opacity': level === 1 ? 0.55 : 0.45,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, level === 1 ? 0.6 : 0.4, 8, level === 1 ? 1.2 : 0.8, 12, level === 1 ? 1.8 : 1.2],
        ...(level === 2 ? { 'line-dasharray': [3, 2] } : {}),
      },
    },
    before,
  );
  map.addLayer(
    {
      id: sel,
      type: 'line',
      source,
      'source-layer': layer,
      filter: NOTHING,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.4, 8, 2.2, 12, 3],
      },
    },
    before,
  );
}

/**
 * installDataLayers（WorldMap.tsx）的最後呼叫：加上行政區的 source 與圖層（先不畫）。
 * PMTiles 的索引非同步讀；讀到前 applyDivisions 什麼都不畫
 */
export function installDivisions(map: MaplibreMap, dark: boolean, font: DataDrivenPropertyValueSpecification<string[]>): void {
  const state: DivState = { tiles: states.get(map)?.tiles ?? null, tiles2: null, hover: null };
  states.set(map, state);
  map.addSource(LABEL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: LABELS,
    type: 'symbol',
    source: LABEL_SOURCE,
    layout: {
      // 欄位不要叫 name：WorldMap 換語言時會改寫所有讀 name 的文字圖層
      'text-field': ['get', 'label'],
      'text-font': font,
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 11, 8, 13, 12, 15],
      'text-padding': 2,
      'text-max-width': 7,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: {
      'text-color': dark ? '#f0efec' : '#2b2b29',
      'text-halo-color': dark ? 'rgba(11, 11, 11, 0.85)' : 'rgba(255, 255, 255, 0.92)',
      'text-halo-width': 1.4,
    },
  });
}

async function ensureSources(map: MaplibreMap, state: DivState, tiles2: string | null, dark: boolean): Promise<boolean> {
  state.tiles ??= await loadTilesIndex().catch(() => null);
  const index = state.tiles;
  if (!index?.divisions1) return false;
  if (!map.getSource(D1_SOURCE)) {
    map.addSource(D1_SOURCE, pmtilesSource(index.divisions1, 'id'));
    addLevelLayers(map, D1_SOURCE, 'd1', [D1_FILL, D1_LINE, D1_SEL], dark, beforeLayer(map));
  }
  if (tiles2 && state.tiles2 !== tiles2 && index[tiles2]) {
    for (const id of [D2_FILL, D2_LINE, D2_SEL]) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(D2_SOURCE)) map.removeSource(D2_SOURCE);
    map.addSource(D2_SOURCE, pmtilesSource(index[tiles2], 'id'));
    addLevelLayers(map, D2_SOURCE, 'd2', [D2_FILL, D2_LINE, D2_SEL], dark, map.getLayer(D1_FILL) ? D1_FILL : beforeLayer(map));
    state.tiles2 = tiles2;
  }
  return true;
}

/** 照目前的 div 設定 filter 與名稱；view 是 null（世界、或不是世界地圖主題）時都不畫 */
export async function applyDivisions(map: MaplibreMap, view: DivisionView | null, dark: boolean): Promise<void> {
  const state = states.get(map);
  if (!state) return;
  const labels = map.getSource(LABEL_SOURCE) as { setData?: (d: FeatureCollection<Point>) => void } | undefined;
  const fc: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: (view?.labels ?? []).map((l, i) => ({
      type: 'Feature',
      properties: { label: l.name, rank: i },
      geometry: { type: 'Point', coordinates: l.point },
    })),
  };
  labels?.setData?.(fc);
  if (!view) {
    for (const id of [D1_FILL, D1_LINE, D1_SEL, D2_FILL, D2_LINE, D2_SEL]) if (map.getLayer(id)) map.setFilter(id, NOTHING);
    return;
  }
  if (!(await ensureSources(map, state, view.tiles2, dark))) return;
  if (states.get(map) !== state) return;
  const inCountry: FilterSpecification = ['==', ['get', 'c'], view.country];
  map.setFilter(D1_FILL, inCountry);
  map.setFilter(D1_LINE, inCountry);
  map.setFilter(D1_SEL, view.level1 ? ['==', ['get', 'id'], view.level1] : NOTHING);
  if (map.getLayer(D2_FILL)) {
    const inParent: FilterSpecification = view.level1 && state.tiles2 === view.tiles2 ? ['==', ['get', 'p'], view.level1] : NOTHING;
    map.setFilter(D2_FILL, inParent);
    map.setFilter(D2_LINE, inParent);
    map.setFilter(D2_SEL, view.level2 ? ['==', ['get', 'id'], view.level2] : NOTHING);
  }
}

/** 游標底下的行政區 id（第二級優先）；沒有畫行政區時是 null */
export function divisionAt(map: MaplibreMap, point: { x: number; y: number }): string | null {
  for (const layer of DIVISION_HIT_LAYERS) {
    if (!map.getLayer(layer)) continue;
    const [f] = map.queryRenderedFeatures([point.x, point.y], { layers: [layer] });
    const id = f?.properties?.id as string | undefined;
    if (id) return id;
  }
  return null;
}

/** 滑過的行政區微微加亮（feature-state hover） */
export function hoverDivision(map: MaplibreMap, id: string | null): void {
  const state = states.get(map);
  if (!state) return;
  if (state.hover?.id === id) return;
  if (state.hover && map.getSource(state.hover.source)) {
    map.setFeatureState({ source: state.hover.source, sourceLayer: state.hover.layer, id: state.hover.id }, { hover: false });
  }
  state.hover = null;
  if (!id) return;
  const level = divisionLevel(id);
  const source = level === 2 ? D2_SOURCE : D1_SOURCE;
  if (!map.getSource(source)) return;
  const layer = level === 2 ? 'd2' : 'd1';
  map.setFeatureState({ source, sourceLayer: layer, id }, { hover: true });
  state.hover = { source, layer, id };
}
