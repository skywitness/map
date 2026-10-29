/**
 * 主題的疊加圖層（鐵路、機場、點、線、晝夜、即時網格、類別網格、風）的資料：載入、解碼與快取（App.tsx，2026-10-29 拆出來）。
 */
import { useEffect, useMemo, useState } from 'react';
import { loadClassGrid, type ClassGrid } from '../map/classGridLayer';
import { decodeWindField, type WindField, type WindFieldFile } from '../map/windLayer';
import { dataUrl, fetchJson, useJsonMany } from '../lib/data';
import {
  concatLines,
  decodeLines,
  decodePoints,
  decodeRailways,
  overlayVisible,
  type DecodedLines,
  type LayerVisibility,
  type OverlayLayer,
} from '../map/Overlays';
import type { MapView } from '../map/WorldMap';
import type { AirportsData, Indicator, LinesData, PointRecord, PointsData, RailwaysData, Topic } from '../topics/types';

/**
 * 主題的疊加圖層，只在該主題載入：鐵路、機場，以及一般的點、線圖層（地震、火山、板塊邊界…）。
 * 一般圖層只載入目前指標用得到、而且打開的；預設關閉的圖層第一次打開時才下載。
 */
const NO_OVERLAY_DEFS: NonNullable<Topic['overlays']> = [];

export function useOverlays(
  topic: Topic,
  indicator: Indicator,
  item: string | null,
  /** 時間軸的年份：類別網格（kind 'classGrid'）、風（kind 'wind'）的資料檔依它換 */
  year: number,
  layers: LayerVisibility,
  pure: boolean,
  view: MapView | null,
  /** 主題的即時資料（TopicDefinition.live）：即時網格（kind 'liveGrid'）由它算 */
  live: unknown,
) {
  const overlays = topic.overlays ?? NO_OVERLAY_DEFS;
  const legacy = useMemo(() => overlays.filter((o) => o.kind === undefined), [overlays]);
  const files = useMemo(() => legacy.map((o) => `topics/${topic.id}/${o.file}`), [topic.id, legacy]);
  const loaded = useJsonMany<unknown>(files);
  const railIndex = legacy.findIndex((o) => o.id === 'railways');
  const airportIndex = legacy.findIndex((o) => o.id === 'airports');
  // 鐵路、機場的 indicators：只在這些指標畫（交通主題的地鐵指標不畫機場）
  const shown = (i: number) => i >= 0 && (!legacy[i].indicators || legacy[i].indicators!.includes(indicator.id));
  const railData = shown(railIndex) ? (loaded[railIndex] as RailwaysData | null) : null;
  const railways = useMemo(() => (railData ? decodeRailways(railData) : null), [railData]);
  const airports = shown(airportIndex) ? (loaded[airportIndex] as AirportsData | null) : null;

  const generic = useMemo(
    () =>
      pure
        ? []
        : overlays.flatMap((o) =>
            o.kind !== undefined &&
            (!o.indicators || o.indicators.includes(indicator.id)) &&
            (!o.items || o.items.includes(item ?? topic.dimension?.defaultOption ?? ''))
              ? [{ def: o, visible: overlayVisible(layers, o), path: genericPath(topic, o, item, year) }]
              : [],
          ),
    [overlays, topic.id, topic.dimension, indicator.id, item, year, layers, pure],
  );
  // 晝夜（kind 'night'）、月亮（kind 'moon'）沒有資料檔，依時刻畫；即時網格（kind 'liveGrid'）由即時資料算；類別網格（kind 'classGrid'）是 PNG
  const wanted = useMemo(
    () => generic.filter((g) => g.visible && g.path && g.def.kind !== 'classGrid').map((g) => g.path),
    [generic],
  );
  const gridPaths = useMemo(
    () => generic.filter((g) => g.visible && g.def.kind === 'classGrid').map((g) => g.path),
    [generic],
  );
  const grids = useClassGrids(gridPaths);
  const raw = useJsonEach(wanted);
  // 線圖層放大後的分區（LinesOverlayDef.detail）：放大到 minZoom 以上時下載跟畫面重疊的分區，下載過的留著
  const tilePaths = useMemo(
    () =>
      generic.flatMap(({ def, visible, path }) => {
        const minZoom = def.kind === 'lines' && visible ? def.detail?.minZoom : undefined;
        const index = minZoom === undefined ? undefined : (raw.get(path) as LinesData | undefined)?.detail;
        if (!index || !view || view.zoom < minZoom!) return [];
        return index.tiles.filter((tile) => tileInView(tile, view.bounds)).map(([id]) => detailPath(path, index.file, id));
      }),
    [generic, raw, view],
  );
  const tiles = useJsonEach(tilePaths);
  const result = useMemo<OverlayLayer[]>(() => {
    // 地圖上只畫跟畫面重疊的分區（下載過的檔留著，移回來時不必再下載）：看過的分區全部畫上去的話，
    // 每多一個分區 MapLibre 就要把越來越多的線重切一次圖磚
    const inView = new Set(tilePaths);
    return generic.map(({ def, visible, path }) => {
      if (def.kind === 'night') return { kind: 'night', def, visible };
      if (def.kind === 'moon') return { kind: 'moon', def, visible };
      if (def.kind === 'liveGrid') return { kind: 'liveGrid', def, visible, values: liveGridValues(def, live) };
      if (def.kind === 'classGrid') {
        const grid = grids.get(path) ?? grids.get(path.slice(0, path.lastIndexOf('/') + 1)) ?? null;
        return { kind: 'classGrid', def, visible, grid };
      }
      if (def.kind === 'wind') {
        // 換月份時新的風場還沒讀到前照畫舊的（粒子不重來）
        const fieldFile = raw.get(path);
        const field = fieldFile ? decodeWindField(fieldFile as WindFieldFile) : (lastWind.get(def.id) ?? null);
        if (field) lastWind.set(def.id, field);
        return { kind: 'wind', def, visible, field };
      }
      // 檔名依年份換的（file 裡有 {year}，板塊漂移）：新的還沒讀到前照畫上一個年份的，播放時不閃
      const key = `${topic.id}:${def.id}`;
      const yearly = def.file.includes('{year}');
      const data = raw.get(path) ?? (yearly ? (lastYearly.get(key) ?? null) : null);
      if (yearly && raw.get(path)) lastYearly.set(key, raw.get(path));
      if (def.kind === 'points') return { kind: 'points', def, visible, points: data ? decodedPoints(data as PointsData) : null };
      const index = (data as LinesData | null)?.detail;
      const loaded = index
        ? index.tiles.flatMap(([id]) => {
            const tilePath = detailPath(path, index.file, id);
            const tile = inView.has(tilePath) ? tiles.get(tilePath) : undefined;
            return tile ? [tile as LinesData] : [];
          })
        : [];
      return { kind: 'lines', def, visible, lines: data ? mergedLines(data as LinesData, loaded) : null };
    });
  }, [generic, raw, tiles, tilePaths, live, grids]);
  return { railways, airports, overlays: result };
}

/** 一般疊加圖層的資料檔路徑：晝夜、即時網格沒有檔；類別網格、風依年份與子項目 */
function genericPath(topic: Topic, o: Exclude<Topic['overlays'], undefined>[number], item: string | null, year: number): string {
  if (o.kind === 'night' || o.kind === 'moon' || o.kind === 'liveGrid' || o.kind === undefined) return '';
  if (o.kind === 'classGrid' || o.kind === 'wind') return `topics/${topic.id}/${o.file(year, item ?? topic.dimension?.defaultOption ?? null)}`;
  return overlayPath(topic, o, item, year);
}

/**
 * 類別網格的資料（loadClassGrid，同一個網址只讀一次）：依路徑記下，另外用圖層 id 記下最近讀到的一張，
 * 換時期時新的還沒讀到前先畫舊的（畫面不閃）
 */
function useClassGrids(paths: string[]): Map<string, ClassGrid> {
  const [grids, setGrids] = useState<Map<string, ClassGrid>>(() => new Map());
  const key = paths.join('|');
  useEffect(() => {
    let cancelled = false;
    for (const path of key ? key.split('|') : []) {
      loadClassGrid(dataUrl(path)).then(
        (grid) => {
          if (cancelled) return;
          // 圖層 id 取不到，用資料夾（topics/<主題>/<資料夾>/）當「最近一張」的鍵；只留現在要的，舊的放掉
          const folder = path.slice(0, path.lastIndexOf('/') + 1);
          setGrids((m) => (m.get(path) === grid ? m : new Map([[path, grid], [folder, grid]])));
        },
        () => {},
      );
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return grids;
}

/** 檔名依年份換的疊加圖層最近讀到的資料（主題:圖層 → 資料）：換年份時新的到之前照畫 */
const lastYearly = new Map<string, unknown>();

/** 每個風的圖層最近讀到的風場（useOverlays）：換月份時新的到之前照畫 */
const lastWind = new Map<string, WindField>();

const liveGridCache = new WeakMap<object, Map<string, Float32Array | null>>();
/** 即時網格的值：同一份即時資料、同一個圖層只算一次（6.5 萬個格點） */
function liveGridValues(def: { id: string; values: (live: unknown) => Float32Array | null }, live: unknown): Float32Array | null {
  if (!live || typeof live !== 'object') return null;
  let byId = liveGridCache.get(live);
  if (!byId) liveGridCache.set(live, (byId = new Map()));
  if (!byId.has(def.id)) byId.set(def.id, def.values(live));
  return byId.get(def.id) ?? null;
}

/** 分區檔的路徑：跟主檔同一個資料夾，file 裡的 `{tile}` 換成分區的 id */
function detailPath(mainPath: string, file: string, id: string): string {
  return `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}${file.replace('{tile}', id)}`;
}

/** 分區的範圍跟畫面重疊（外擴 2°，先載入旁邊的；經度可能超出 ±180°，左右平移 360° 再比一次） */
function tileInView([, w, s, e, n]: [string, number, number, number, number], [vw, vs, ve, vn]: MapView['bounds']): boolean {
  const pad = 2;
  if (n < vs - pad || s > vn + pad) return false;
  return [-360, 0, 360].some((shift) => w + shift <= ve + pad && e + shift >= vw - pad);
}

/** 線圖層的主檔加上已經下載的分區；同一組檔回傳同一個物件，地圖才不會重送資料 */
const mergedCache = new WeakMap<LinesData, { parts: LinesData[]; lines: DecodedLines }>();
function mergedLines(main: LinesData, parts: LinesData[]): DecodedLines {
  if (!parts.length) return decodedLines(main);
  const hit = mergedCache.get(main);
  if (hit && hit.parts.length === parts.length && hit.parts.every((p, i) => p === parts[i])) return hit.lines;
  const lines = concatLines([decodedLines(main), ...parts.map(decodedLines)]);
  mergedCache.set(main, { parts, lines });
  return lines;
}

/**
 * 疊加圖層的資料檔路徑。file 含 `{item}` 時換成目前的子項目（便利商店與連鎖品牌：一個品牌一個店家檔，
 * 只下載選到的品牌；換品牌時同一個圖層換資料，開關狀態不變）
 */
function overlayPath(topic: Topic, o: { file: string; topic?: string }, item: string | null, year: number): string {
  const file = o.file.replace('{item}', item ?? topic.dimension?.defaultOption ?? '').replace('{year}', String(year));
  return `topics/${o.topic ?? topic.id}/${file}`;
}

const decodedCache = new WeakMap<object, PointRecord[] | DecodedLines>();
function decodedPoints(data: PointsData): PointRecord[] {
  let out = decodedCache.get(data) as PointRecord[] | undefined;
  if (!out) decodedCache.set(data, (out = decodePoints(data)));
  return out;
}
function decodedLines(data: LinesData): DecodedLines {
  let out = decodedCache.get(data) as DecodedLines | undefined;
  if (!out) decodedCache.set(data, (out = decodeLines(data)));
  return out;
}

/**
 * 一次載入好幾個檔，已經載入的保留著：清單變了（打開另一個圖層）時，原本的資料不會先變回 null，地圖才不會閃一下。
 * 失敗的檔案當成沒有資料。
 */
function useJsonEach(paths: string[]): Map<string, unknown> {
  const [loaded, setLoaded] = useState<Map<string, unknown>>(() => new Map());
  const key = paths.join('|');
  useEffect(() => {
    for (const path of key ? key.split('|') : []) {
      if (loaded.has(path)) continue;
      fetchJson<unknown>(path)
        .then((data) => setLoaded((m) => (m.get(path) === data ? m : new Map(m).set(path, data))))
        .catch(() => {});
    }
  }, [key]);
  return loaded;
}
