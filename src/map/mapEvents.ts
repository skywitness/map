/**
 * 地圖的滑鼠、觸控事件（WorldMap.tsx，2026-10-29 拆出來）：滑過（hover、tooltip、線的強調）、框選的拖曳、點選國家與側欄的標記、
 * 右鍵（觸控長按）那個位置的小卡片（PlacePopup.tsx）。
 * 地圖建立時綁定一次，最新的 props 從 latest 讀。
 */
import { LngLat, type Map as MaplibreMap, type MapGeoJSONFeature, type MapMouseEvent, type MapTouchEvent } from 'maplibre-gl';
import type { RefObject } from 'react';
import type { MapMark } from '../topics/types';
import { boxFromCorners, type Box } from './boxEstimate';
import { highlightLine, lineOverlayAt, OVERLAY_PREFIX } from './overlayLayers';
import { HOVER_LAYERS, HOVER_SOURCES, MARK_LABEL_LAYER, MARK_LAYER, MIN_BOX_PX } from './worldMapLayers';

/** 游標下的東西（tooltip 用） */
export interface MapHover {
  iso3: string | null;
  x: number;
  y: number;
  airport?: number;
  /** 一般點圖層的點（或有 tooltip 的線）：overlay 的 id 與資料的第幾筆 */
  point?: { overlay: string; index: number };
  /** 主題有 pointer 時游標的經緯度（-180–180） */
  lngLat?: [number, number];
  /** 滑到側欄放的標記（marks 的第幾個） */
  mark?: number;
}

/** 右鍵（觸控長按）點的位置：小卡片寫地名與經緯度，連到 Google 地圖（PlacePopup.tsx） */
export interface MapPlace {
  /** 小卡片在地圖上的位置（px） */
  x: number;
  y: number;
  /** 點圖層的點用那一點的經緯度，其他用點下去的位置（-180–180） */
  lng: number;
  lat: number;
  /** 底下的國家 */
  iso3: string | null;
  /** 點在點圖層的點（或有 tooltip 的線）上：overlay 的 id 與資料的第幾筆 */
  point?: { overlay: string; index: number };
}

/** 觸控按住多久算長按（ms） */
const LONG_PRESS_MS = 550;
/** 長按、右鍵時手指或滑鼠移動超過這個距離（px）就是拖曳（3D 時右鍵拖曳是旋轉），不跳卡片 */
const PRESS_SLOP_PX = 8;

/** 事件裡要讀的最新 props（WorldMap 每次 render 更新） */
export interface LatestProps {
  onSelect: (iso3: string | null) => void;
  onBoxChange?: (box: Box | null) => void;
  boxMode: boolean;
  pointer: boolean;
  marks?: MapMark[] | null;
}

export interface MapEventRefs {
  /** 一般點圖層與有 tooltip 的線的 MapLibre 圖層 id（上面的在前），hover 與點選時比國家先查 */
  pointLayersRef: RefObject<string[]>;
  lineWidthFieldsRef: RefObject<Map<string, string>>;
  lineHoverRef: RefObject<{ overlay: string; group: number } | null>;
  lineHighlightRef: RefObject<{ overlay: string; group: number } | null>;
  hoverIdRef: RefObject<string | null>;
  dragRef: RefObject<{ start: [number, number]; startPoint: { x: number; y: number } } | null>;
  suppressClickRef: RefObject<boolean>;
  /** 在地圖上點選國家時點的位置：WorldMap 把地圖移過去時以它為準，不是國家的中心（點 F1 賽道不會跳到國家中間） */
  clickedRef: RefObject<{ iso3: string; at: [number, number] } | null>;
  latest: RefObject<LatestProps>;
  setHover: (hover: MapHover | null) => void;
  setBoxMode: (on: boolean) => void;
  setPlace: (place: MapPlace | null) => void;
}

export function bindMapEvents(
  map: MaplibreMap,
  {
    pointLayersRef,
    lineWidthFieldsRef,
    lineHoverRef,
    lineHighlightRef,
    hoverIdRef,
    dragRef,
    suppressClickRef,
    clickedRef,
    latest,
    setHover,
    setBoxMode,
    setPlace,
  }: MapEventRefs,
): void {
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

  /** 點底下的國家（略過點圖層、線） */
  const countryAt = (point: { x: number; y: number }): string | null => {
    for (const id of HOVER_LAYERS) {
      if (!map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none') continue;
      const [c] = map.queryRenderedFeatures([point.x, point.y], { layers: [id] });
      const iso3 = (c?.properties?.iso3 as string | undefined) ?? null;
      if (iso3) return iso3;
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
    const mark = markAt(e.point);
    const f = mark === null ? featureAt(e.point) : null;
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
    map.getCanvas().style.cursor = iso3 || point || mark !== null ? 'pointer' : '';
    const airport = f?.layer.id.startsWith('airports') ? Number(f.properties.i) : undefined;
    // 主題有 pointer（地球的另一邊）：海上也有 tooltip；滑到點、機場、標記時照舊。
    // 地球儀外面（太空）MapLibre 也會給一個經緯度（地球邊緣上的點），投影回畫面跟游標差很遠，那裡不算
    const back = map.project(e.lngLat);
    const onEarth = Math.hypot(back.x - e.point.x, back.y - e.point.y) < 4;
    const anywhere = latest.current.pointer && onEarth && !point && airport === undefined && mark === null;
    const { lng, lat } = e.lngLat.wrap();
    setHover(
      mark !== null
        ? { iso3: null, x: e.point.x, y: e.point.y, mark }
        : iso3 || point || anywhere
          ? { iso3, x: e.point.x, y: e.point.y, airport, point, lngLat: anywhere ? [lng, lat] : undefined }
          : null,
    );
  };

  /** 游標底下的側欄標記（marks 的索引） */
  const markAt = (point: { x: number; y: number }): number | null => {
    if (!map.getLayer(MARK_LAYER)) return null;
    const [hit] = map.queryRenderedFeatures([point.x, point.y], { layers: [MARK_LAYER, MARK_LABEL_LAYER] });
    return hit ? Number(hit.properties.i) : null;
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
    // 點側欄放的標記：移到它連到的那一個（首都 ↔ 對蹠點），選取的國家不變
    const mark = markAt(e.point);
    if (mark !== null) {
      const marksNow = latest.current.marks;
      const link = marksNow?.[mark]?.link;
      const target = link !== undefined ? marksNow?.[link] : undefined;
      if (target) map.flyTo({ center: [target.lon, target.lat], zoom: Math.max(map.getZoom(), 3), duration: 1600 });
      return;
    }
    const f = featureAt(e.point, false);
    let iso3 = (f?.properties?.iso3 as string | undefined) ?? null;
    // 點圖層的點沒有國家欄位時（便利商店與連鎖品牌的店家），選取點底下的國家，不要取消選取
    if (!iso3 && f?.layer.id.startsWith(OVERLAY_PREFIX)) iso3 = countryAt(e.point);
    // 點的是點圖層的點（賽道、景點…）就用那一點的位置，否則用點下去的位置
    const exact = f?.layer.id.startsWith(OVERLAY_PREFIX) && f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null;
    const { lng, lat } = exact ? new LngLat(exact[0], exact[1]).wrap() : e.lngLat.wrap();
    clickedRef.current = iso3 ? { iso3, at: [lng, lat] } : null;
    latest.current.onSelect(iso3);
  });

  /* ── 右鍵（觸控長按）：那個位置的小卡片，可以在 Google 地圖開啟（2026-10-30） ── */
  const openPlace = (at: { x: number; y: number }) => {
    if (latest.current.boxMode || dragRef.current) return;
    const here = map.unproject([at.x, at.y]);
    // 地球儀外面（太空）：MapLibre 給的是地球邊緣上的點，投影回畫面跟點的位置差很遠
    const back = map.project(here);
    if (Math.hypot(back.x - at.x, back.y - at.y) >= 4) return;
    const f = featureAt(at);
    const line = f ? lineOverlayAt(f.layer.id) : null;
    const point =
      f && f.layer.id.startsWith(OVERLAY_PREFIX)
        ? { overlay: line ?? f.layer.id.slice(OVERLAY_PREFIX.length), index: Number(f.properties.i) }
        : undefined;
    // 點圖層的點（賽道、景點…）用那一點的經緯度，比點下去的位置準
    const exact = point && f?.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : null;
    const { lng, lat } = (exact ? new LngLat(exact[0], exact[1]) : here).wrap();
    const iso3 = (f?.properties?.iso3 as string | undefined) ?? countryAt(at);
    setHover(null);
    setPlace({ x: at.x, y: at.y, lng, lat, iso3, point });
  };

  // 右鍵：按下與放開的位置差太多是拖曳（3D 的旋轉），不跳卡片。Mac 的 Ctrl＋點一下也會送 contextmenu
  let rightDown: { x: number; y: number } | null = null;
  map.on('mousedown', (e) => {
    rightDown = e.originalEvent.button === 2 ? { x: e.point.x, y: e.point.y } : null;
  });
  map.on('contextmenu', (e) => {
    // 不出現瀏覽器的右鍵選單
    e.originalEvent.preventDefault();
    const start = rightDown;
    rightDown = null;
    if (start && Math.hypot(e.point.x - start.x, e.point.y - start.y) > PRESS_SLOP_PX) return;
    openPlace(e.point);
  });

  // 觸控長按：一根手指按住不動 LONG_PRESS_MS；放開時不要再當成點一下（選國家）
  let pressTimer = 0;
  let pressAt: { x: number; y: number } | null = null;
  const cancelPress = () => {
    window.clearTimeout(pressTimer);
    pressTimer = 0;
    pressAt = null;
  };
  map.on('touchstart', (e) => {
    cancelPress();
    if (e.originalEvent.touches.length !== 1) return;
    const at = { x: e.point.x, y: e.point.y };
    pressAt = at;
    pressTimer = window.setTimeout(() => {
      cancelPress();
      openPlace(at);
      suppressClickRef.current = true;
      setTimeout(() => (suppressClickRef.current = false), 800);
    }, LONG_PRESS_MS);
  });
  map.on('touchmove', (e) => {
    if (pressAt && Math.hypot(e.point.x - pressAt.x, e.point.y - pressAt.y) > PRESS_SLOP_PX) cancelPress();
  });
  map.on('touchend', cancelPress);
  map.on('touchcancel', cancelPress);
  // 地圖移動（拖曳、縮放、飛到別處）時卡片的位置就不對了：關掉
  map.on('movestart', () => setPlace(null));
}
