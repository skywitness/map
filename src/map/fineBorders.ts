import type { FilterSpecification, LayerSpecification, Map as MaplibreMap, MapEventType } from 'maplibre-gl';
import { loadTilesIndex, pmtilesSource } from './pmtiles';

/**
 * 放大後的國界（製作手冊第十六批 264，2026-11-01）：縮放 FINE_ZOOM 以上，國家的上色、無資料斜線、滑過、外框、選取
 * 改用 Natural Earth 1:10m（pipeline/borders_10m.py 切成 PMTiles，`countries-10m`），全球視角的 1:110m、中間的 1:50m 照舊
 * （都在 `countries` 這個 GeoJSON source）。3D 的立體國界（extrude-countries）、框選估算、網格歸國照舊用 1:50m。
 *
 * - **雙胞胎圖層**：TWINS 的每一層複製一份 `<id>-fine`，source 換成 PMTiles、minzoom 是 FINE_ZOOM，排在原本那層的正後面。
 * - **跟著原本那層走**：地圖的 setFeatureState（`countries`）、setPaintProperty、setLayoutProperty 在 installFineBorders
 *   時包一層，同一個呼叫也套到 1:10m（雙胞胎還沒加上前的 feature-state 先記著，加上時補上）。所以 WorldMap、
 *   useCountryFills、mapEvents 照舊只對 `countries` 與原本的圖層下指令。
 * - **換手不閃、不重疊**：雙胞胎先用永遠不成立的 filter（圖磚照樣下載，只是不畫），1:50m 照舊畫在所有縮放；
 *   放大到 FINE_ZOOM 以上、看得到的 1:10m 圖磚都下載好了，同一格畫面裡把雙胞胎的 filter 拿掉、1:50m 設 maxzoom
 *   FINE_ZOOM。之後兩份各管一段縮放，不會同時畫。
 * - **沒有檔案、離線、圖磚出錯**：pmtiles/index.json 沒有 `countries-10m`、下載不到，或圖磚出錯時，不加雙胞胎（出錯時
 *   拿掉），國界照舊用 1:50m 畫到所有縮放，不必像其他 PMTiles 圖層那樣顯示 TilesOffline。
 */

/** 從這一級開始換成 1:10m（pipeline/borders_10m.py 的 MIN_ZOOM，比它低的圖磚沒有切） */
export const FINE_ZOOM = 5;
/** 放大到這一級才準備 1:10m（讀 index.json、加上雙胞胎），全球視角不必多下載 */
const PREPARE_ZOOM = 4;
export const FINE_SOURCE = 'countries-fine';
/** PMTiles 裡的圖層名稱（borders_10m.py 的 LAYER）與 index.json 的名稱 */
const FINE_SOURCE_LAYER = 'countries';
const TILES_NAME = 'countries-10m';
/** 有 1:10m 雙胞胎的圖層（worldMapLayers.ts 的 dataLayers）；data-nodata 的 source 是另一份（只有沒資料的國家） */
const TWINS = ['data-fill', 'data-nodata', 'data-hover', 'data-border', 'data-halo', 'data-highlight'] as const;
const NODATA = 'data-nodata';
const COUNTRIES = 'countries';
/** 永遠不成立的 filter：換手前雙胞胎不畫 */
const NOTHING: FilterSpecification = ['==', ['literal', 1], 0];

export const fineTwin = (id: string): string => `${id}-fine`;

type FeatureState = Record<string, unknown>;

interface FineState {
  /** 每次換底圖（installDataLayers）加一：舊的非同步工作看到不一樣就放棄 */
  install: number;
  /** `countries` 上設過的 feature-state（雙胞胎加上時補上） */
  states: Map<string | number, FeatureState>;
  /** 雙胞胎加上了 */
  added: boolean;
  /** 已經換手（1:50m 只畫到 FINE_ZOOM） */
  handedOver: boolean;
  /** 1:10m 出錯，這次的底圖都用 1:50m */
  failed: boolean;
  /** 沒有資料、要畫斜線的國家（useCountryFills） */
  noData: string[];
  detach: () => void;
}

const fine = new WeakMap<MaplibreMap, FineState>();

/** 地圖的方法包一層，同樣的呼叫也套到 1:10m（每張地圖只做一次） */
function patch(map: MaplibreMap, state: FineState): void {
  const setFeatureState = map.setFeatureState.bind(map);
  const setPaintProperty = map.setPaintProperty.bind(map);
  const setLayoutProperty = map.setLayoutProperty.bind(map);
  const twinOf = (id: string) => (state.added && (TWINS as readonly string[]).includes(id) && map.getLayer(fineTwin(id)) ? fineTwin(id) : null);
  map.setFeatureState = (feature, value) => {
    setFeatureState(feature, value);
    if (feature.source === COUNTRIES && feature.id !== undefined) {
      state.states.set(feature.id, { ...state.states.get(feature.id), ...value });
      if (state.added) setFeatureState({ source: FINE_SOURCE, sourceLayer: FINE_SOURCE_LAYER, id: feature.id }, value);
    }
    return map;
  };
  map.setPaintProperty = (layer, name, value, options) => {
    setPaintProperty(layer, name, value, options);
    const twin = twinOf(layer);
    if (twin) setPaintProperty(twin, name, value, options);
    return map;
  };
  map.setLayoutProperty = (layer, name, value, options) => {
    setLayoutProperty(layer, name, value, options);
    const twin = twinOf(layer);
    if (twin) setLayoutProperty(twin, name, value, options);
    return map;
  };
}

function noDataFilter(ids: string[]): FilterSpecification {
  return ['in', ['get', 'iso3'], ['literal', ids]];
}

/** 加上 1:10m 的 source 與雙胞胎圖層（照原本那層現在的樣子複製），補上之前設的 feature-state */
function addTwins(map: MaplibreMap, state: FineState, source: ReturnType<typeof pmtilesSource>): void {
  map.addSource(FINE_SOURCE, source);
  for (const id of TWINS) {
    const layers = map.getStyle().layers;
    const index = layers.findIndex((l) => l.id === id);
    if (index < 0) continue;
    const original = layers[index] as Extract<LayerSpecification, { type: 'fill' | 'line' }>;
    const twin = {
      ...original,
      id: fineTwin(id),
      source: FINE_SOURCE,
      'source-layer': FINE_SOURCE_LAYER,
      minzoom: FINE_ZOOM,
      filter: NOTHING,
    } as LayerSpecification;
    map.addLayer(twin, layers[index + 1]?.id);
  }
  state.added = true;
  for (const [id, value] of state.states) map.setFeatureState({ source: COUNTRIES, id }, value);
}

/** 看得到的 1:10m 圖磚都到了：同一格畫面裡雙胞胎開始畫、1:50m 只畫到 FINE_ZOOM */
function handOver(map: MaplibreMap, state: FineState): void {
  for (const id of TWINS) {
    if (!map.getLayer(fineTwin(id))) continue;
    map.setFilter(fineTwin(id), id === NODATA ? noDataFilter(state.noData) : null);
    if (map.getLayer(id)) map.setLayerZoomRange(id, 0, FINE_ZOOM);
  }
  state.handedOver = true;
}

/** 1:10m 出錯：拿掉雙胞胎，換回 1:50m 畫到所有縮放，這次的底圖不再用 1:10m */
function fallBack(map: MaplibreMap, state: FineState): void {
  state.failed = true;
  state.added = false;
  state.detach();
  for (const id of TWINS) {
    if (map.getLayer(fineTwin(id))) map.removeLayer(fineTwin(id));
    if (map.getLayer(id)) map.setLayerZoomRange(id, 0, 24);
  }
  if (map.getSource(FINE_SOURCE)) map.removeSource(FINE_SOURCE);
}

/**
 * installDataLayers（WorldMap.tsx）的最後呼叫：每次換底圖，`countries` 跟著重建，feature-state 也重來。
 * 放大到 PREPARE_ZOOM 以上才讀 pmtiles/index.json、加上雙胞胎（pmtiles 套件約 7 KB 與檔頭、目錄約 16 KB 這時才下載，
 * 全球視角的第一個畫面不必等）；讀到 `countries-10m` 才加上，在這之前地圖照舊用 1:50m 畫
 */
export function installFineBorders(map: MaplibreMap): void {
  let state = fine.get(map);
  if (!state) {
    state = { install: 0, states: new Map(), added: false, handedOver: false, failed: false, noData: [], detach: () => {} };
    fine.set(map, state);
    patch(map, state);
  }
  const s = state;
  s.detach();
  s.install += 1;
  s.states = new Map();
  s.added = false;
  s.handedOver = false;
  s.failed = false;
  s.noData = [];
  const install = s.install;

  const check = () => {
    if (!s.added || s.handedOver || s.failed || map.getZoom() < FINE_ZOOM || !map.isSourceLoaded(FINE_SOURCE)) return;
    handOver(map, s);
  };
  // 平移、縮放時取消的請求（AbortError）不算出錯。地圖有 error 監聽時 MapLibre 不再自己把錯誤印到主控台，
  // 別的 source 的錯誤照舊印出來
  const onError = (e: MapEventType['error']) => {
    // MapLibre 把出錯的 source 放在事件上（ErrorEvent 的 data），型別沒有寫
    const { sourceId } = e as MapEventType['error'] & { sourceId?: string };
    if (sourceId !== FINE_SOURCE) console.error(e.error);
    else if ((e.error as { name?: string }).name !== 'AbortError') fallBack(map, s);
  };
  const add = (index: Record<string, Parameters<typeof pmtilesSource>[0]>) => {
    const entry = index[TILES_NAME];
    if (!entry || install !== s.install || !map.getSource(COUNTRIES) || map.getSource(FINE_SOURCE)) return;
    addTwins(map, s, pmtilesSource(entry, 'iso3'));
    map.on('sourcedata', check);
    map.on('error', onError);
    check();
  };
  let started = false;
  const start = () => {
    if (started || map.getZoom() < PREPARE_ZOOM) return;
    started = true;
    loadTilesIndex().then(add, () => {
      // 沒有 index.json、離線：照舊用 1:50m（下次換底圖再試）
    });
  };
  const onMoveEnd = () => {
    start();
    check();
  };
  map.on('moveend', onMoveEnd);
  s.detach = () => {
    map.off('moveend', onMoveEnd);
    map.off('sourcedata', check);
    map.off('error', onError);
  };
  start();
}

/** 沒有資料、要畫斜線的國家（useCountryFills 換 data-nodata 的資料時一起呼叫）：1:10m 用 filter 選出同一批 */
export function setFineNoData(map: MaplibreMap, ids: string[]): void {
  const state = fine.get(map);
  if (!state) return;
  state.noData = ids;
  if (state.handedOver && !state.failed && map.getLayer(fineTwin(NODATA))) map.setFilter(fineTwin(NODATA), noDataFilter(ids));
}
