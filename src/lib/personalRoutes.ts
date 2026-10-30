import { useEffect, useState } from 'react';
import { unzipAll } from './unzip';

/**
 * 我的路線（2026-10-30 起，賽車主題）：使用者自己下載的路線檔（GPX、KML、KMZ、GeoJSON，或裝這些的 zip），在瀏覽器裡解析，
 * 存在這個瀏覽器的 IndexedDB；不上傳、不進網站的資料檔，換瀏覽器要重新匯入。給沒有授權、只給自己看的路線用
 * （三大環賽的賽段、WRC 的特殊賽段、大眾速降的路線…），見 DESIGN.md 第 11 節「我的路線」。
 *
 * 同一個檔（檔名相同）再匯入一次會取代舊的；GeoJSON 的 properties 可以寫 name、series（賽事代號，例如 tdf）、place、topic。
 */
export interface PersonalRoute {
  id?: number;
  /** 屬於哪個主題（匯入時的主題，GeoJSON 的 properties.topic 優先） */
  topic: string;
  name: string;
  /** 主題自己的分類（賽車是賽事代號 f1、tdf…），決定顏色 */
  series?: string;
  place?: string;
  /** 匯入的檔名（zip 裡的檔是「zip 檔名/裡面的檔名」） */
  source: string;
  lines: [number, number][][];
  added: number;
}

export interface ImportResult {
  routes: number;
  files: number;
  skipped: string[];
}

const DB_NAME = 'world-map-personal';
const STORE = 'routes';
// 簡化：相距不到約 2 m 的點拿掉（手錶記錄的 GPX 一秒一點，一條賽段十幾萬點）
const TOLERANCE = 0.00002;

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('topic', 'topic');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadRoutes(topic: string): Promise<PersonalRoute[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).index('topic').getAll(topic);
    req.onsuccess = () => resolve(req.result as PersonalRoute[]);
    req.onerror = () => reject(req.error);
  });
}

async function saveRoutes(topic: string, routes: PersonalRoute[]): Promise<void> {
  const db = await openDb();
  const sources = new Set(routes.map((r) => r.source));
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  // 同一個檔再匯入：先刪掉這個主題裡同檔名的舊路線
  const cursor = store.index('topic').openCursor(topic);
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (c) {
      if (sources.has((c.value as PersonalRoute).source)) c.delete();
      c.continue();
    } else {
      for (const r of routes) store.add(r);
    }
  };
  await done(tx);
  notify();
}

export async function clearRoutes(topic: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const cursor = tx.objectStore(STORE).index('topic').openCursor(topic);
  cursor.onsuccess = () => {
    const c = cursor.result;
    if (!c) return;
    c.delete();
    c.continue();
  };
  await done(tx);
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

/** 這個主題的我的路線（topic 是 null 時不讀）；匯入、刪除後自動更新 */
export function usePersonalRoutes(topic: string | null): { routes: PersonalRoute[]; error: boolean } {
  const [state, setState] = useState<{ topic: string | null; routes: PersonalRoute[]; error: boolean }>({ topic: null, routes: [], error: false });
  useEffect(() => {
    if (!topic || typeof indexedDB === 'undefined') return;
    let cancelled = false;
    const load = () =>
      loadRoutes(topic).then(
        (routes) => !cancelled && setState({ topic, routes, error: false }),
        // 私密瀏覽、封鎖網站資料時 IndexedDB 打不開：當作沒有路線
        () => !cancelled && setState({ topic, routes: [], error: true }),
      );
    load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, [topic]);
  return state.topic === topic ? { routes: state.routes, error: state.error } : { routes: [], error: false };
}

// ── 解析 ──────────────────────────────────────────────────────────────
type Parsed = Omit<PersonalRoute, 'topic' | 'source' | 'added' | 'id'> & { topic?: string };

const ROUTE_FILE = /\.(gpx|kml|kmz|geojson|json|zip)$/i;

/** 匯入檔案（可以一次很多個，或一整個資料夾）：解析、簡化、存起來；不認得或沒有線的檔列在 skipped */
export async function importRouteFiles(files: File[], topic: string): Promise<ImportResult> {
  const routes: PersonalRoute[] = [];
  const skipped: string[] = [];
  let count = 0;
  const added = Date.now();
  for (const file of files) {
    const name = file.webkitRelativePath || file.name;
    if (!ROUTE_FILE.test(file.name)) {
      skipped.push(name);
      continue;
    }
    try {
      const entries = /\.(zip|kmz)$/i.test(file.name)
        ? (await unzipAll(await file.arrayBuffer())).filter((e) => ROUTE_FILE.test(e.name)).map((e) => ({ name: `${name}/${e.name}`, text: e.text }))
        : [{ name, text: await file.text() }];
      let found = 0;
      for (const entry of entries) {
        const parsed = parseRouteText(entry.text, entry.name);
        for (const p of parsed) {
          const lines = p.lines.map(simplify).filter((l) => l.length >= 2);
          if (!lines.length) continue;
          routes.push({ ...p, lines, topic: p.topic ?? topic, source: entry.name, added });
          found++;
        }
      }
      if (found) count++;
      else skipped.push(name);
    } catch {
      skipped.push(name);
    }
  }
  const byTopic = new Map<string, PersonalRoute[]>();
  for (const r of routes) byTopic.set(r.topic, [...(byTopic.get(r.topic) ?? []), r]);
  for (const [t, list] of byTopic) await saveRoutes(t, list);
  return { routes: routes.length, files: count, skipped };
}

function baseName(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '');
}

export function parseRouteText(text: string, fileName: string): Parsed[] {
  const head = text.trimStart().slice(0, 200);
  if (head.startsWith('{') || head.startsWith('[')) return parseGeoJson(JSON.parse(text) as unknown, baseName(fileName));
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const root = doc.documentElement.localName.toLowerCase();
  if (root === 'gpx') return parseGpx(doc, baseName(fileName));
  if (root === 'kml') return parseKml(doc, baseName(fileName));
  return [];
}

/** 用 localName 找子孫（GPX、KML 有命名空間，gx:Track 的 gx:coord 也照樣找得到） */
function all(el: Element | Document, name: string): Element[] {
  return Array.from(el.getElementsByTagName('*')).filter((e) => e.localName === name);
}
function childText(el: Element, name: string): string {
  const c = Array.from(el.children).find((e) => e.localName === name);
  return c?.textContent?.trim() ?? '';
}

function parseGpx(doc: Document, fallback: string): Parsed[] {
  const out: Parsed[] = [];
  const meta = all(doc, 'metadata')[0];
  const docName = (meta && childText(meta, 'name')) || fallback;
  const pt = (e: Element): [number, number] => [Number(e.getAttribute('lon')), Number(e.getAttribute('lat'))];
  for (const trk of all(doc, 'trk')) {
    const lines = all(trk, 'trkseg').map((seg) => all(seg, 'trkpt').map(pt));
    out.push({ name: childText(trk, 'name') || docName, lines });
  }
  for (const rte of all(doc, 'rte')) out.push({ name: childText(rte, 'name') || docName, lines: [all(rte, 'rtept').map(pt)] });
  return out;
}

function kmlCoords(text: string): [number, number][] {
  return text
    .trim()
    .split(/\s+/)
    .map((t) => t.split(',').map(Number))
    .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => [c[0], c[1]]);
}

function parseKml(doc: Document, fallback: string): Parsed[] {
  const out: Parsed[] = [];
  for (const pm of all(doc, 'Placemark')) {
    const lines: [number, number][][] = [];
    for (const ls of [...all(pm, 'LineString'), ...all(pm, 'LinearRing')]) {
      const c = all(ls, 'coordinates')[0];
      if (c?.textContent) lines.push(kmlCoords(c.textContent));
    }
    for (const track of all(pm, 'Track')) {
      lines.push(
        all(track, 'coord')
          .map((c) => (c.textContent ?? '').trim().split(/\s+/).map(Number))
          .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map((c) => [c[0], c[1]] as [number, number]),
      );
    }
    if (lines.length) out.push({ name: childText(pm, 'name') || fallback, lines });
  }
  return out;
}

type Geo = { type?: string; coordinates?: unknown; geometries?: Geo[]; geometry?: Geo | null; features?: Geo[]; properties?: Record<string, unknown> | null };

function geoLines(g: Geo | null | undefined): [number, number][][] {
  if (!g) return [];
  const c = g.coordinates as number[][] & number[][][] & number[][][][];
  const ring = (r: number[][]) => r.filter((p) => p.length >= 2).map((p) => [p[0], p[1]] as [number, number]);
  switch (g.type) {
    case 'LineString':
      return [ring(c)];
    case 'MultiLineString':
    case 'Polygon':
      return (c as number[][][]).map(ring);
    case 'MultiPolygon':
      return (c as number[][][][]).flatMap((poly) => poly.map(ring));
    case 'GeometryCollection':
      return (g.geometries ?? []).flatMap(geoLines);
    default:
      return [];
  }
}

function parseGeoJson(json: unknown, fallback: string): Parsed[] {
  const g = json as Geo;
  const features: Geo[] = g.type === 'FeatureCollection' ? (g.features ?? []) : g.type === 'Feature' ? [g] : [{ type: 'Feature', geometry: g }];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return features.flatMap((f) => {
    const lines = geoLines(f.geometry);
    if (!lines.length) return [];
    const p = f.properties ?? {};
    return [{ name: str(p.name) ?? str(p.title) ?? fallback, series: str(p.series), place: str(p.place), topic: str(p.topic), lines }];
  });
}

/** Douglas–Peucker（經緯度直接算，經度乘上 cos(緯度)），先去掉座標不合理的點 */
function simplify(line: [number, number][]): [number, number][] {
  const pts = line.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90);
  if (pts.length < 3) return pts;
  const k = Math.cos((pts[0][1] * Math.PI) / 180);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a][0] * k;
    const ay = pts[a][1];
    const dx = pts[b][0] * k - ax;
    const dy = pts[b][1] - ay;
    const norm = Math.hypot(dx, dy);
    let best = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const x = pts[i][0] * k - ax;
      const y = pts[i][1] - ay;
      const d = norm ? Math.abs(dy * x - dx * y) / norm : Math.hypot(x, y);
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    if (best > TOLERANCE) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** 匯出成一個 GeoJSON（備份、搬到別的瀏覽器再匯入） */
export function routesToGeoJson(routes: PersonalRoute[]): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: routes.map((r) => ({
      type: 'Feature',
      properties: { name: r.name, series: r.series, place: r.place, topic: r.topic, source: r.source },
      geometry: { type: 'MultiLineString', coordinates: r.lines.map((l) => l.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6])) },
    })),
  });
}
