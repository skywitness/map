import type { FlowFile, IndicatorData, LinesData, PointsData } from '../topics/types';
import { fetchJson } from './data';
import { LOCAL_FILES, LOCAL_SOURCES, openPersonalDb, request, txDone } from './personalDb';
import { importRouteFiles, type ImportResult } from './personalRoutes';
import {
  entryId,
  readLocalRegistry,
  writeLocalRegistry,
  type LocalAbout,
  type LocalColor,
  type LocalDerived,
  type LocalFlowSpec,
  type LocalPointSpec,
  type LocalShapeSpec,
  type LocalSourceMeta,
  type LocalTableSpec,
} from './localRegistry';
import { unzipAll } from './unzip';

/**
 * 本機匯入（製作手冊第十三批 209，DESIGN.md 第 11 節「本機匯入」）：讀通用格式的資料夾（about.json 加上表格、點、流向、
 * 線面的 CSV／GeoJSON），轉成網站本來的格式（指標檔、PointsData、LinesData、FlowFile），存進這個瀏覽器的 IndexedDB。
 * 網站讀 `local:` 開頭的路徑時（lib/data.ts 的 fetchJson）從這裡拿。資料不上傳。
 *
 * 只在本機匯入頁與讀匯入的資料時才載入（自己一個 chunk）。
 */

/** 地圖上有的國家（public/data/countries.json 的 key） */
type CountryTable = Record<string, unknown>;

export interface SourceReport {
  id: string;
  title: LocalAbout['title'] | null;
  ok: boolean;
  error?: string;
  warnings: string[];
  counts: string[];
}

export interface LocalImportResult {
  sources: SourceReport[];
  routes: ImportResult | null;
  skipped: string[];
}

// ---------------------------------------------------------------- CSV

/** RFC 4180 的 CSV（雙引號、引號裡的逗號與換行）；開頭的 BOM 拿掉 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

interface Table {
  header: string[];
  rows: string[][];
  col: (name: string) => number;
}

function readTable(text: string, file: string, required: string[]): Table {
  const [header = [], ...rows] = parseCsv(text);
  const names = header.map((h) => h.trim());
  for (const r of required) if (!names.includes(r)) throw new Error(`${file}: missing column "${r}"`);
  return { header: names, rows, col: (name) => names.indexOf(name) };
}

const toNumber = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------- 年份

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR = /^-?\d{1,4}$/;

/** 月資料的時間軸：年份欄位存「西元年 × 12 + 月 − 1」（2024-03 → 24290），刻度寫 2024/3（topics/localTopics.ts） */
export const monthIndex = (year: number, month: number): number => year * 12 + month - 1;

function parseYears(values: string[], file: string): { monthly: boolean; parse: (s: string) => number } {
  const monthly = values.some((v) => MONTH.test(v.trim()));
  for (const v of values) {
    const t = v.trim();
    if (monthly ? !MONTH.test(t) : !YEAR.test(t)) throw new Error(`${file}: bad year "${v}"${monthly ? ' (expected YYYY-MM for every row)' : ''}`);
  }
  return {
    monthly,
    parse: monthly
      ? (s) => {
          const m = MONTH.exec(s.trim())!;
          return monthIndex(Number(m[1]), Number(m[2]));
        }
      : (s) => Number(s.trim()),
  };
}

// ---------------------------------------------------------------- 分級

/** 2 位有效數字的好讀的數 */
function nice(v: number): number {
  if (v === 0) return 0;
  const exp = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / exp) * exp;
}

/** 依分位數挑門檻（scale 是 auto）：循序 6 個門檻 7 級；發散依 |值| 的第 90 百分位取對稱的 6 個 */
export function autoThresholds(values: number[], diverging = false): number[] {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [1];
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  if (diverging) {
    const abs = sorted.map(Math.abs).sort((a, b) => a - b);
    const m = nice(abs[Math.min(abs.length - 1, Math.floor(0.9 * abs.length))]) || 1;
    return [-m, -nice(m / 3), -nice(m / 10), nice(m / 10), nice(m / 3), m];
  }
  const out: number[] = [];
  for (let k = 1; k <= 6; k++) {
    const t = nice(q(k / 7));
    if (!out.length || t > out[out.length - 1]) out.push(t);
  }
  return out.length ? out : [sorted[0]];
}

// ---------------------------------------------------------------- 表格

interface Converted {
  /** IndexedDB 的 key（`<來源>/<id>`、流向每年一個 `<來源>/<id>/<年>`）→ 內容 */
  payloads: [string, unknown][];
  derived: LocalDerived;
  counts: string;
}

function convertTable(source: string, spec: LocalTableSpec, text: string, countries: CountryTable, warn: (s: string) => void): Converted {
  const t = readTable(text, spec.file, ['iso3', 'year', 'value']);
  const ci = t.col('iso3');
  const yi = t.col('year');
  const vi = t.col('value');
  const li = t.col('label');
  const years = parseYears(
    t.rows.map((r) => r[yi] ?? ''),
    spec.file,
  );
  const textual = spec.map === 'categorical' || t.rows.some((r) => (r[vi] ?? '').trim() !== '' && toNumber(r[vi]) === null);
  // 類別：about 列的依序，資料裡多出來的接在後面
  const categories = textual ? [...(spec.categories ?? []).map((c) => c.value)] : undefined;
  if (categories) for (const r of t.rows) if (r[vi]?.trim() && !categories.includes(r[vi].trim())) categories.push(r[vi].trim());
  const yearSet = new Set<number>();
  const cells: [string, number, number, string | null][] = [];
  const unknown = new Map<string, number>();
  const seen = new Set<string>();
  for (const r of t.rows) {
    const iso = (r[ci] ?? '').trim().toUpperCase();
    const raw = (r[vi] ?? '').trim();
    if (!iso || raw === '') continue;
    if (!(iso in countries)) {
      unknown.set(iso, (unknown.get(iso) ?? 0) + 1);
      continue;
    }
    const year = years.parse(r[yi]);
    const key = `${iso}|${year}`;
    if (seen.has(key)) throw new Error(`${spec.file}: ${iso} ${r[yi]} appears twice`);
    seen.add(key);
    const value = categories ? categories.indexOf(raw) + 1 : toNumber(raw)!;
    yearSet.add(year);
    cells.push([iso, year, value, li >= 0 ? (r[li] ?? '').trim() || null : null]);
  }
  if (unknown.size) warn(`${spec.file}: ${[...unknown].map(([k, n]) => `${k} (${n})`).join(', ')}`);
  if (!cells.length) throw new Error(`${spec.file}: no rows`);
  const yearList = [...yearSet].sort((a, b) => a - b);
  const index = new Map(yearList.map((y, i) => [y, i]));
  const values: Record<string, (number | null)[]> = {};
  const labels: Record<string, (string | null)[]> = {};
  for (const [iso, year, value, label] of cells) {
    (values[iso] ??= new Array(yearList.length).fill(null))[index.get(year)!] = value;
    if (label) (labels[iso] ??= new Array(yearList.length).fill(null))[index.get(year)!] = label;
  }
  const data: IndicatorData & { labels?: typeof labels } = {
    indicator: entryId(spec),
    unit: '',
    years: yearList,
    values,
    ...(spec.latestWithin && { latestWithin: spec.latestWithin }),
    ...(Object.keys(labels).length && { labels }),
  };
  const id = entryId(spec);
  const numbers = categories ? [] : cells.map((c) => c[2]);
  const thresholds =
    !categories && (spec.map ?? 'choropleth') === 'choropleth'
      ? Array.isArray(spec.scale)
        ? spec.scale
        : autoThresholds(numbers, spec.diverging)
      : undefined;
  return {
    payloads: [[`${source}/${id}`, data]],
    derived: {
      kind: 'table',
      monthly: years.monthly,
      years: [yearList[0], yearList[yearList.length - 1]],
      taiwan: 'TWN' in values,
      countries: Object.keys(values).length,
      rows: cells.length,
      ...(thresholds && { thresholds }),
      ...(categories && { categories }),
      labels: Object.keys(labels).length > 0,
    },
    counts: `${spec.file}: ${cells.length} rows, ${Object.keys(values).length} countries`,
  };
}

// ---------------------------------------------------------------- 流向

function convertFlow(source: string, spec: LocalFlowSpec, text: string, countries: CountryTable, warn: (s: string) => void): Converted {
  const t = readTable(text, spec.file, ['from', 'to', 'year', 'value']);
  const [fi, ti, yi, vi, typeI] = ['from', 'to', 'year', 'value', 'type'].map(t.col);
  const years = parseYears(
    t.rows.map((r) => r[yi] ?? ''),
    spec.file,
  );
  const typeLabel = new Map((spec.types ?? []).map((x) => [x.value, x.label]));
  const byYear = new Map<number, { pairs: [string, string, number, string | null][] }>();
  const unknown = new Map<string, number>();
  let rows = 0;
  for (const r of t.rows) {
    const a = (r[fi] ?? '').trim().toUpperCase();
    const b = (r[ti] ?? '').trim().toUpperCase();
    if (!a || !b || a === b) continue;
    const bad = [a, b].filter((c) => !(c in countries));
    if (bad.length) {
      for (const c of bad) unknown.set(c, (unknown.get(c) ?? 0) + 1);
      continue;
    }
    const value = spec.presence ? 1 : toNumber(r[vi]);
    if (value === null) continue;
    const year = years.parse(r[yi]);
    let bucket = byYear.get(year);
    if (!bucket) byYear.set(year, (bucket = { pairs: [] }));
    bucket.pairs.push([a, b, value, typeI >= 0 ? (r[typeI] ?? '').trim() || null : null]);
    rows++;
  }
  if (unknown.size) warn(`${spec.file}: ${[...unknown].map(([k, n]) => `${k} (${n})`).join(', ')}`);
  if (!rows) throw new Error(`${spec.file}: no rows`);
  const id = entryId(spec);
  const yearList = [...byYear.keys()].sort((a, b) => a - b);
  const index = new Map(yearList.map((y, i) => [y, i]));
  const totals: Record<string, (number | null)[]> = {};
  const payloads: [string, unknown][] = [];
  const all = new Set<string>();
  const direction = spec.direction ?? 'export';
  for (const [year, { pairs }] of byYear) {
    const out: FlowFile['export'] = {};
    const inn: FlowFile['import'] = {};
    const notes: Record<string, [string, string]> = {};
    for (const [a, b, v, type] of pairs) {
      all.add(a);
      all.add(b);
      (out[a] ??= [0, []])[1].push([b, v]);
      out[a][0] += v;
      (inn[b] ??= [0, []])[1].push([a, v]);
      inn[b][0] += v;
      if (type) {
        const label = typeLabel.get(type) ?? type;
        notes[`${a}>${b}`] = typeof label === 'string' ? [label, label] : [label.zh, label.en];
      }
    }
    for (const side of [out, inn]) for (const entry of Object.values(side)) entry[1].sort((x, y) => y[1] - x[1]);
    const file: FlowFile = { item: id, year, unit: '', scale: 1, export: out, import: inn, ...(Object.keys(notes).length && { notes }) };
    payloads.push([`${source}/${id}/${year}`, file]);
    // 各國的指標：起點（或終點）的總額，presence 時是對方的國家數
    const i = index.get(year)!;
    const add = (iso: string, v: number) => {
      const arr = (totals[iso] ??= new Array(yearList.length).fill(null));
      arr[i] = Math.max(arr[i] ?? 0, v);
    };
    if (direction !== 'import') for (const [iso, [sum]] of Object.entries(out)) add(iso, sum);
    if (direction !== 'export') for (const [iso, [sum]] of Object.entries(inn)) add(iso, sum);
  }
  const data: IndicatorData = { indicator: id, unit: '', years: yearList, values: totals };
  payloads.push([`${source}/${id}#totals`, data]);
  return {
    payloads,
    derived: { kind: 'flow', years: [yearList[0], yearList[yearList.length - 1]], taiwan: all.has('TWN'), countries: all.size, rows },
    counts: `${spec.file}: ${rows} rows, ${yearList.length} years`,
  };
}

// ---------------------------------------------------------------- 點與線面的欄位

type Value = number | string | null;

/** 一般的點檔（PointsData）：數值欄位量化成整數（依小數位數，最多 6 位），其他是字串 */
export function encodeColumns(records: Record<string, Value>[], fixedDigits: Record<string, number> = {}): PointsData {
  const fields: string[] = [];
  for (const r of records) for (const k of Object.keys(r)) if (!fields.includes(k)) fields.push(k);
  const scale: Record<string, number> = {};
  const columns = fields.map((f) => {
    const col = records.map((r) => r[f] ?? null);
    const numeric = col.every((v) => v === null || typeof v === 'number');
    if (!numeric || col.every((v) => v === null)) return col.map((v) => (v === null ? null : String(v)));
    let digits = fixedDigits[f];
    if (digits === undefined) {
      digits = 0;
      for (const v of col) {
        if (v === null) continue;
        const s = String(v);
        const dot = s.indexOf('.');
        if (dot >= 0 && !s.includes('e')) digits = Math.max(digits, Math.min(6, s.length - dot - 1));
      }
    }
    scale[f] = 10 ** -digits;
    return col.map((v) => (v === null ? null : Math.round((v as number) * 10 ** digits)));
  });
  return { fields, scale, delta: [], columns };
}

/** CSV 的一格：數字就是數字（欄位裡全部是數字或空白時），其他是字串 */
function typedColumns(t: Table, skip: Set<string>): ((row: string[]) => Record<string, Value>) {
  const numeric = t.header.map((h, i) => !skip.has(h) && t.rows.every((r) => (r[i] ?? '').trim() === '' || toNumber(r[i]) !== null));
  return (row) => {
    const out: Record<string, Value> = {};
    t.header.forEach((h, i) => {
      if (skip.has(h)) return;
      const raw = (row[i] ?? '').trim();
      out[h] = raw === '' ? null : numeric[i] ? toNumber(raw) : raw;
    });
    return out;
  };
}

/** 顏色、時間、大小要的欄位與匯入時算的東西 */
function styleFields(
  spec: { color?: LocalColor; time?: { field: string; end?: string }; size?: { field: string } },
  records: Record<string, Value>[],
  file: string,
): Pick<Extract<LocalDerived, { kind: 'points' | 'shapes' }>, 'years' | 'thresholds' | 'categories' | 'sizeMax'> {
  const out: ReturnType<typeof styleFields> = {};
  const nums = (field: string) => records.map((r) => r[field]).filter((v): v is number => typeof v === 'number');
  if (spec.time) {
    const ys = nums(spec.time.field);
    if (!ys.length) throw new Error(`${file}: time field "${spec.time.field}" has no numbers`);
    out.years = [Math.min(...ys), Math.max(...ys)];
  }
  if (spec.size) {
    const s = nums(spec.size.field);
    out.sizeMax = s.length ? Math.max(...s) : 1;
  }
  const color = spec.color;
  if (color && 'categories' in color) {
    const cats = color.categories.map((c) => c.value);
    for (const r of records) {
      const v = r[color.field];
      if (v !== null && v !== undefined && !cats.includes(String(v))) cats.push(String(v));
    }
    out.categories = cats;
    for (const r of records) {
      const v = r[color.field];
      r._c = v === null || v === undefined ? null : cats.indexOf(String(v));
    }
  } else if (color) {
    out.thresholds = Array.isArray(color.scale) ? color.scale : autoThresholds(nums(color.field), color.diverging);
  }
  return out;
}

// ---------------------------------------------------------------- 點

function convertPoints(
  source: string,
  spec: LocalPointSpec,
  text: string,
  seriesText: string | null,
  file: string,
): Converted {
  let records: Record<string, Value>[] = [];
  if (/\.(geo)?json$/i.test(file)) {
    const json = JSON.parse(text) as { features?: { geometry?: { type: string; coordinates: number[] } | null; properties?: Record<string, unknown> }[] };
    for (const f of json.features ?? []) {
      if (f.geometry?.type !== 'Point') continue;
      const [lon, lat] = f.geometry.coordinates;
      const props: Record<string, Value> = {};
      for (const [k, v] of Object.entries(f.properties ?? {})) props[k] = typeof v === 'number' || typeof v === 'string' ? v : v === null || v === undefined ? null : String(v);
      records.push({ ...props, lon, lat });
    }
  } else {
    const t = readTable(text, file, ['lat', 'lon']);
    const row = typedColumns(t, new Set());
    records = t.rows.map(row);
  }
  const nameField = spec.name ?? 'name';
  records = records.filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number' && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180);
  if (!records.length) throw new Error(`${file}: no points with lat/lon`);
  for (const r of records) {
    if (nameField !== 'name') r.name = r[nameField] ?? null;
    if (spec.country && spec.country !== 'iso3') r.iso3 = r[spec.country] ?? null;
  }
  // 序列：每個點好幾年的值，存成「年:值;年:值」的字串欄位 _s（清單畫小長條圖）
  if (spec.series && seriesText !== null) {
    const t = readTable(seriesText, spec.series.file, ['id', 'year', 'value']);
    const by = new Map<string, [number, number][]>();
    for (const r of t.rows) {
      const y = toNumber(r[1]);
      const v = toNumber(r[2]);
      if (y === null || v === null) continue;
      const k = (r[0] ?? '').trim();
      (by.get(k) ?? by.set(k, []).get(k)!).push([y, v]);
    }
    for (const r of records) {
      const list = by.get(String(r[spec.series.key] ?? ''));
      if (list) r._s = list.sort((a, b) => a[0] - b[0]).map(([y, v]) => `${y}:${v}`).join(';');
    }
  }
  const style = styleFields(spec, records, file);
  const id = entryId(spec);
  return {
    payloads: [[`${source}/${id}`, encodeColumns(records, { lat: 5, lon: 5 })]],
    derived: { kind: 'points', count: records.length, ...style },
    counts: `${file}: ${records.length} points`,
  };
}

// ---------------------------------------------------------------- 線面

type Position = number[];
interface Geometry {
  type: string;
  coordinates: Position[] | Position[][] | Position[][][];
}

const QUANTUM = 1e-5;

function convertShapes(source: string, spec: LocalShapeSpec, text: string, file: string): Converted {
  const json = JSON.parse(text) as { features?: { geometry?: Geometry | null; properties?: Record<string, unknown> }[] };
  const lines: number[][] = [];
  const records: Record<string, Value>[] = [];
  let polygons = false;
  let features = 0;
  const push = (ring: Position[], props: Record<string, Value>, extra: Record<string, Value>) => {
    if (ring.length < 2) return;
    const flat: number[] = [];
    let px = 0;
    let py = 0;
    for (const [lon, lat] of ring) {
      const x = Math.round(lon / QUANTUM);
      const y = Math.round(lat / QUANTUM);
      flat.push(x - px, y - py);
      px = x;
      py = y;
    }
    lines.push(flat);
    records.push({ ...props, ...extra });
  };
  for (const f of json.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    const props: Record<string, Value> = {};
    for (const [k, v] of Object.entries(f.properties ?? {})) props[k] = typeof v === 'number' || typeof v === 'string' ? v : v === null || v === undefined ? null : String(v);
    const fi = features;
    if (g.type === 'LineString') push(g.coordinates as Position[], props, { _f: fi });
    else if (g.type === 'MultiLineString') for (const l of g.coordinates as Position[][]) push(l, props, { _f: fi });
    else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
      polygons = true;
      const polys = g.type === 'Polygon' ? [g.coordinates as Position[][]] : (g.coordinates as Position[][][]);
      for (const poly of polys) poly.forEach((ring, i) => push(ring, props, { _f: fi, _poly: 1, _hole: i > 0 ? 1 : 0 }));
    } else continue;
    features++;
  }
  if (!lines.length) throw new Error(`${file}: no lines or polygons`);
  if (spec.name && spec.name !== 'name') for (const r of records) r.name = r[spec.name] ?? null;
  const style = styleFields(spec, records, file);
  // 線的顏色依 LinesData.types（一條線一個代碼）：類別是第幾類（超過 8 類的都是「其他」第 8 類），數值是第幾級
  const color = spec.color;
  const types = !color
    ? undefined
    : 'categories' in color
      ? records.map((r) => Math.min(typeof r._c === 'number' ? r._c : 8, 8))
      : records.map((r) => {
          const v = r[color.field];
          return typeof v === 'number' ? style.thresholds!.filter((t) => v >= t).length : 0;
        });
  const data: LinesData = { quantum: QUANTUM, lines, records: encodeColumns(records), ...(types && { types }) };
  const id = entryId(spec);
  return {
    payloads: [[`${source}/${id}`, data]],
    derived: { kind: 'shapes', count: features, polygons, ...style },
    counts: `${file}: ${features} features, ${lines.length} lines`,
  };
}

// ---------------------------------------------------------------- about.json

const isText = (v: unknown): boolean =>
  typeof v === 'string' || (typeof v === 'object' && v !== null && typeof (v as { zh?: unknown }).zh === 'string');

export function validateAbout(json: unknown): LocalAbout {
  const a = json as LocalAbout;
  if (!a || typeof a !== 'object') throw new Error('about.json: not an object');
  if (a.format !== 1) throw new Error('about.json: "format" must be 1');
  if (!isText(a.title)) throw new Error('about.json: missing "title"');
  if (!a.source || typeof a.source.name !== 'string') throw new Error('about.json: missing "source.name"');
  if (Boolean(a.topic) === Boolean(a.newTopic)) throw new Error('about.json: give exactly one of "topic" and "newTopic"');
  if (a.newTopic && (!/^[a-z0-9-]+$/.test(a.newTopic.id ?? '') || !isText(a.newTopic.title)))
    throw new Error('about.json: "newTopic" needs "id" (a-z, 0-9, -) and "title"');
  if (a.newTopic && !a.tables?.length && !a.flows?.length) throw new Error('about.json: a new topic needs at least one table or flow');
  const ids = new Set<string>();
  for (const kind of ['tables', 'points', 'flows', 'shapes'] as const) {
    const list = a[kind];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new Error(`about.json: "${kind}" must be a list`);
    for (const e of list as { file?: unknown; id?: string; label?: unknown }[]) {
      if (typeof e.file !== 'string' || !e.file) throw new Error(`about.json: an entry in "${kind}" has no "file"`);
      if (!isText(e.label)) throw new Error(`about.json: ${e.file} has no "label"`);
      const id = entryId(e as { file: string; id?: string });
      if (ids.has(id)) throw new Error(`about.json: id "${id}" is used twice`);
      ids.add(id);
    }
  }
  if (!ids.size) throw new Error('about.json: no tables, points, flows or shapes');
  return a;
}

// ---------------------------------------------------------------- 匯入

interface InFile {
  /** 來源資料夾裡的相對路徑 */
  path: string;
  read: () => Promise<string>;
  bytes: number;
}

/** 依 about.json 的位置分成來源：key 是資料夾名稱（代號） */
async function groupSources(files: File[]): Promise<{ sources: Map<string, Map<string, InFile>>; loose: File[]; skipped: string[] }> {
  const sources = new Map<string, Map<string, InFile>>();
  const loose: File[] = [];
  const skipped: string[] = [];
  const add = (id: string, path: string, f: InFile) => {
    (sources.get(id) ?? sources.set(id, new Map()).get(id)!).set(path, f);
  };
  // 資料夾：webkitRelativePath 是「選的資料夾/來源/檔」或「來源/檔」
  const withPath = files.filter((f) => f.webkitRelativePath);
  const dirs = withPath.filter((f) => /(^|\/)about\.json$/.test(f.webkitRelativePath)).map((f) => f.webkitRelativePath.slice(0, -'about.json'.length));
  for (const f of files) {
    const rel = f.webkitRelativePath;
    const dir = rel ? dirs.find((d) => rel.startsWith(d)) : undefined;
    if (dir !== undefined) {
      const id = dir.replace(/\/$/, '').split('/').pop() || 'local';
      add(id, rel.slice(dir.length), { path: rel.slice(dir.length), read: () => f.text(), bytes: f.size });
    } else if (/\.zip$/i.test(f.name)) {
      // zip：裡面有 about.json 的資料夾各是一個來源；zip 最上層就是 about.json 時，來源是 zip 的檔名
      const entries = await unzipAll(await f.arrayBuffer());
      const zdirs = entries.filter((e) => /(^|\/)about\.json$/.test(e.name)).map((e) => e.name.slice(0, -'about.json'.length));
      if (!zdirs.length) skipped.push(f.name);
      for (const e of entries) {
        const d = zdirs.find((x) => e.name.startsWith(x));
        if (d === undefined) continue;
        const id = d ? d.replace(/\/$/, '').split('/').pop()! : f.name.replace(/\.zip$/i, '');
        add(id, e.name.slice(d.length), { path: e.name.slice(d.length), read: async () => e.text, bytes: e.text.length });
      }
    } else if (/\.(geojson|json|gpx|kml|kmz)$/i.test(f.name)) loose.push(f);
    else skipped.push(rel || f.name);
  }
  return { sources, loose, skipped };
}

const CODE = /^[a-z0-9][a-z0-9-]*$/;

/** 匯入檔案或整個資料夾：每個有 about.json 的資料夾是一個來源（同一個來源再匯入一次就取代）；最上層的路線檔交給我的路線 */
export async function importLocalFiles(files: File[]): Promise<LocalImportResult> {
  const countries = await fetchJson<CountryTable>('countries.json');
  const { sources, loose, skipped } = await groupSources(files);
  const reports: SourceReport[] = [];
  for (const [id, entries] of sources) {
    const report: SourceReport = { id, title: null, ok: false, warnings: [], counts: [] };
    reports.push(report);
    try {
      if (!CODE.test(id)) throw new Error(`folder name "${id}": use a-z, 0-9 and - only`);
      const aboutFile = entries.get('about.json');
      if (!aboutFile) throw new Error('about.json not found');
      const about = validateAbout(JSON.parse(await aboutFile.read()));
      report.title = about.title;
      const read = async (path: string) => {
        const f = entries.get(path);
        if (!f) throw new Error(`${path}: file not found`);
        return f.read();
      };
      const warn = (s: string) => report.warnings.push(s);
      const converted: [string, Converted][] = [];
      for (const spec of about.tables ?? []) converted.push([entryId(spec), convertTable(id, spec, await read(spec.file), countries, warn)]);
      for (const spec of about.flows ?? []) converted.push([entryId(spec), convertFlow(id, spec, await read(spec.file), countries, warn)]);
      for (const spec of about.points ?? [])
        converted.push([entryId(spec), convertPoints(id, spec, await read(spec.file), spec.series ? await read(spec.series.file) : null, spec.file)]);
      for (const spec of about.shapes ?? []) converted.push([entryId(spec), convertShapes(id, spec, await read(spec.file), spec.file)]);
      const meta: LocalSourceMeta = {
        id,
        importedAt: Date.now(),
        about,
        derived: Object.fromEntries(converted.map(([k, c]) => [k, c.derived])),
        files: [...entries.values()].map((f) => ({ name: f.path, bytes: f.bytes })),
        warnings: report.warnings,
      };
      await saveSource(meta, converted.flatMap(([, c]) => c.payloads));
      report.counts = converted.map(([, c]) => c.counts);
      report.ok = true;
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
  }
  const routes = loose.length ? await importRouteFiles(loose, 'racing') : null;
  await syncLocalRegistry();
  return { sources: reports, routes, skipped };
}

async function deleteKeys(store: IDBObjectStore, prefix: string): Promise<void> {
  const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
  store.delete(range);
}

async function saveSource(meta: LocalSourceMeta, payloads: [string, unknown][]): Promise<void> {
  const db = await openPersonalDb();
  const tx = db.transaction([LOCAL_SOURCES, LOCAL_FILES], 'readwrite');
  const files = tx.objectStore(LOCAL_FILES);
  await deleteKeys(files, `${meta.id}/`);
  for (const [key, value] of payloads) files.put(value, key);
  tx.objectStore(LOCAL_SOURCES).put(meta);
  await txDone(tx);
  memory.clear();
}

export async function listLocalSources(): Promise<LocalSourceMeta[]> {
  const db = await openPersonalDb();
  const list = await request(db.transaction(LOCAL_SOURCES).objectStore(LOCAL_SOURCES).getAll() as IDBRequest<LocalSourceMeta[]>);
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

/** localStorage 的清單照 IndexedDB 重寫（網站一打開就讀它）；回傳是否寫得進去 */
export async function syncLocalRegistry(): Promise<boolean> {
  return writeLocalRegistry(await listLocalSources());
}

export async function deleteLocalSource(id: string | null): Promise<void> {
  const db = await openPersonalDb();
  const tx = db.transaction([LOCAL_SOURCES, LOCAL_FILES], 'readwrite');
  if (id === null) {
    tx.objectStore(LOCAL_SOURCES).clear();
    tx.objectStore(LOCAL_FILES).clear();
  } else {
    tx.objectStore(LOCAL_SOURCES).delete(id);
    await deleteKeys(tx.objectStore(LOCAL_FILES), `${id}/`);
  }
  await txDone(tx);
  memory.clear();
  await syncLocalRegistry();
}

// ---------------------------------------------------------------- 網站讀資料

const memory = new Map<string, Promise<unknown>>();

async function getPayload(key: string): Promise<unknown> {
  const db = await openPersonalDb();
  return request(db.transaction(LOCAL_FILES).objectStore(LOCAL_FILES).get(key));
}

/**
 * fetchJson 遇到 `local:` 的路徑時讀這裡（lib/data.ts）：`<來源>/<id>` 是指標檔、點檔或線檔，`<來源>/<id>/<年>` 是那一年的流向，
 * `<來源>/<id>#totals` 是流向算出的各國指標。沒有的年份給空的流向，不當成錯誤
 */
export function localJson(path: string): Promise<unknown> {
  let promise = memory.get(path);
  if (!promise) {
    promise = getPayload(path).then((value) => {
      if (value !== undefined) return value;
      const flowYear = /^([^/]+\/[^/#]+)\/(-?\d+)$/.exec(path);
      if (flowYear) return { item: '', year: Number(flowYear[2]), unit: '', scale: 1, export: {}, import: {} } satisfies FlowFile;
      throw new Error(`local:${path} (not imported in this browser)`);
    });
    promise.catch(() => memory.delete(path));
    memory.set(path, promise);
  }
  return promise;
}

/** 本機匯入頁的「重新整理清單」：localStorage 被清掉、IndexedDB 還在時補回 */
export function registryOutOfSync(list: LocalSourceMeta[]): boolean {
  const cached = readLocalRegistry();
  return cached.length !== list.length || cached.some((m, i) => m.id !== list[i]?.id || m.importedAt !== list[i]?.importedAt);
}

/** 測試用（localData.test.ts）：各種檔的轉換 */
export const _convert = { table: convertTable, flow: convertFlow, points: convertPoints, shapes: convertShapes };
