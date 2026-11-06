import { getLang, tr, type Text } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed, formatLargeNumber } from '../lib/format';
import { decodeLines } from '../map/overlayData';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesData, LinesOverlayDef, PointerInfo, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 地震與火山主題的板塊（2026-11-06，參考 tectonicplatemap.org，使用者選「板1–板6」；pipeline/topics/plates_pb2002.py）：
 * - 板塊邊界（plates.json）：依相對速度變粗，加上地質圖的符號（隱沒帶的三角形畫在上覆的板塊那一側、張裂往兩側的箭頭、
 *   轉形斷層的半箭頭），滑過寫兩個板塊、類型與每年靠近／張開／錯動幾公分（板2、板3）
 * - 板塊的面與名稱（plate-areas.json、plate-labels.json）：「板塊」指標才畫（板1）
 * - 游標或觀察點（「定位我」）在哪一塊板塊、離最近的板塊邊界多遠（pointer、pin，板4）
 * - 「板塊」指標：各國有人住的部分跨幾塊板塊（plates-count.json），左側欄是各板塊的人口（plates-population.json，板5）
 * - USGS 最近 7 天規模 4.5 以上的地震（瀏覽器直接讀，PointsOverlayDef.liveFeed，板6）
 */

/** 板塊邊界用中性色，不跟地震的顏色搶；三類用實線、虛線與淺灰分開 */
const PLATE_DARK = MAP_TOKENS.inkSecondary;
const PLATE_LIGHT = MAP_TOKENS.inkMuted;

/** PB2002 的 STEPCLASS（pipeline 的 STEP_CLASS） */
const BOUNDARY_CLASSES: Record<number, Text> = {
  1: { zh: '隱沒帶', en: 'subduction zone' },
  2: { zh: '海洋聚合邊界', en: 'oceanic convergent boundary' },
  3: { zh: '大陸碰撞帶', en: 'continental collision zone' },
  4: { zh: '中洋脊', en: 'mid-ocean ridge' },
  5: { zh: '大陸裂谷', en: 'continental rift' },
  6: { zh: '海洋轉形斷層', en: 'oceanic transform fault' },
  7: { zh: '大陸轉形斷層', en: 'continental transform fault' },
};

const PLATE_CLASSES: Record<number, Text> = {
  1: { zh: '大板塊', en: 'major plate' },
  2: { zh: '小板塊', en: 'minor plate' },
  3: { zh: '微板塊', en: 'microplate' },
};

const cm = (mm: number) => fixed(Math.abs(mm) / 10, Math.abs(mm) < 100 ? 1 : 0);

const plateName = (p: PointRecord, side: 'a' | 'b') => String(getLang() === 'en' ? p[`${side}e`] : p[`${side}z`]);

/** 「每年靠近 7.1 公分」：依邊界的類型取靠近、張開或錯動的分量 */
function rateText(p: PointRecord): string {
  const c = Number(p.c);
  const di = Number(p.di);
  const rl = Number(p.rl);
  if (c <= 3 && di < 0) return tr({ zh: `每年靠近 ${cm(di)} 公分`, en: `closing ${cm(di)} cm a year` });
  if ((c === 4 || c === 5) && di > 0) return tr({ zh: `每年張開 ${cm(di)} 公分`, en: `opening ${cm(di)} cm a year` });
  if (c >= 6)
    return tr(
      rl >= 0
        ? { zh: `每年錯動 ${cm(rl)} 公分（右移）`, en: `slipping ${cm(rl)} cm a year (right-lateral)` }
        : { zh: `每年錯動 ${cm(rl)} 公分（左移）`, en: `slipping ${cm(rl)} cm a year (left-lateral)` },
    );
  return tr({ zh: `相對速度每年 ${cm(Number(p.v))} 公分`, en: `moving ${cm(Number(p.v))} cm a year relative to each other` });
}

/** 「隱沒帶：太平洋板塊隱沒到鄂霍次克板塊下面」 */
function kindText(p: PointRecord): string {
  const kind = tr(BOUNDARY_CLASSES[Number(p.c)] ?? BOUNDARY_CLASSES[2]);
  if (Number(p.c) !== 1 || typeof p.dn !== 'string') return kind;
  const [down, over] = p.dn === p.a ? [plateName(p, 'a'), plateName(p, 'b')] : [plateName(p, 'b'), plateName(p, 'a')];
  return tr({ zh: `${kind}：${down}隱沒到${over}下面`, en: `${kind}: the ${down} sinks beneath the ${over}` });
}

function boundaryTooltip(p: PointRecord) {
  const vmin = Number(p.vmin);
  const vmax = Number(p.vmax);
  // 括號裡是兩個板塊的總相對速度（靠近、張開、錯動是其中垂直或平行於邊界的分量）
  const range =
    vmax - vmin >= 5
      ? tr({ zh: `（兩個板塊的相對速度每年 ${cm(vmin)}–${cm(vmax)} 公分）`, en: ` (relative plate speed ${cm(vmin)}–${cm(vmax)} cm a year)` })
      : tr({ zh: `（兩個板塊的相對速度每年 ${cm(Number(p.v))} 公分）`, en: ` (relative plate speed ${cm(Number(p.v))} cm a year)` });
  return {
    title: tr({ zh: `${plateName(p, 'a')}與${plateName(p, 'b')}`, en: `${plateName(p, 'a')} – ${plateName(p, 'b')}` }),
    detail: kindText(p),
    extra: [
      `${rateText(p)}${range}`,
      tr({ zh: `長 ${fixed(Number(p.len), 0)} 公里（PB2002 模型）`, en: `${fixed(Number(p.len), 0)} km long (PB2002 model)` }),
    ],
  };
}

/** 板塊邊界（板2、板3）：依相對速度變粗，加上地質圖的符號；三類用實線、虛線與淺灰分開 */
export const PLATE_BOUNDARIES: LinesOverlayDef = {
  kind: 'lines',
  id: 'plates',
  file: 'plates.json',
  label: { zh: '板塊邊界', en: 'Plate boundaries' },
  // 相對速度（mm/年）：每年 1 公分細、15 公分以上最粗
  width: { field: 'v', stops: [[0, 0.7], [20, 1], [60, 1.6], [150, 2.6]] },
  // 代碼跟 pipeline/sources/plates.py 的 CONVERGENT、DIVERGENT、TRANSFORM 一致
  color: {
    title: { zh: '邊界類型', en: 'Boundary type' },
    classes: [
      { value: 1, color: PLATE_DARK, label: { zh: '聚合（隱沒帶的三角形在上覆的板塊那一側）', en: 'Convergent (subduction teeth on the overriding plate)' } },
      { value: 2, color: PLATE_DARK, dash: true, label: { zh: '張裂（中洋脊、裂谷，箭頭往兩側）', en: 'Divergent (ridges, rifts; arrows point apart)' } },
      { value: 3, color: PLATE_LIGHT, label: { zh: '轉形斷層（半箭頭是錯動的方向）', en: 'Transform faults (half-arrows show the slip)' } },
    ],
  },
  marks: { field: 'm', icons: { 1: 'teeth', 2: 'diverge', 3: 'dextral', 4: 'sinistral' } },
  sizeLegend: {
    title: { zh: '兩個板塊的相對速度', en: 'Relative plate speed' },
    values: [10, 50, 150],
    format: (v) => tr({ zh: `每年 ${cm(v)} 公分`, en: `${cm(v)} cm/yr` }),
  },
  tooltip: boundaryTooltip,
};

/** 「板塊」指標才畫的面與名稱（板1） */
const PLATE_INDICATORS = ['plates'];

export const PLATE_AREAS: LinesOverlayDef = {
  kind: 'lines',
  id: 'plate-areas',
  file: 'plate-areas.json',
  label: { zh: '板塊（PB2002 的 52 塊）', en: 'Plates (the 52 of PB2002)' },
  indicators: PLATE_INDICATORS,
  width: 0,
  color: {
    title: { zh: '板塊的大小', en: 'Plate size' },
    classes: [
      { value: 1, color: MAP_TOKENS.categorical[0], label: { zh: '大板塊（2,000 萬 km² 以上，7 塊）', en: 'Major plates (over 20 million km²; 7)' }, area: 'land' },
      { value: 2, color: MAP_TOKENS.categorical[2], label: { zh: '小板塊（100 萬 km² 以上，13 塊）', en: 'Minor plates (over 1 million km²; 13)' }, area: 'land' },
      { value: 3, color: MAP_TOKENS.categorical[4], label: { zh: '微板塊（32 塊）', en: 'Microplates (32)' }, area: 'land' },
    ],
  },
  fill: { field: 'ring', value: 1, opacity: 0.16, darkOpacity: 0.22, outline: false },
};

export const PLATE_LABELS: PointsOverlayDef = {
  kind: 'points',
  id: 'plate-labels',
  file: 'plate-labels.json',
  label: { zh: '板塊的名稱', en: 'Plate names' },
  indicators: PLATE_INDICATORS,
  radius: 0,
  color: MAP_TOKENS.inkSecondary,
  count: false,
  pointLabel: (p) => String(getLang() === 'en' ? p.en : p.zh),
  pointLabelCenter: true,
  tooltip: (p) => ({ title: String(getLang() === 'en' ? p.en : p.zh) }),
  sortField: 'rank',
  // 縮小時只寫大板塊，放大才寫小板塊、微板塊
  minValue: { field: 'rank', stops: [[0, 3], [2.5, 2], [4, 1]] },
};

/* ── USGS 最近 7 天的地震（板6） ────────────── */

interface UsgsFeed {
  features: { properties: { mag: number | null; place: string | null; time: number }; geometry: { coordinates: [number, number, number] } }[];
}

const isFeed = (v: unknown): v is UsgsFeed => typeof v === 'object' && v !== null && Array.isArray((v as UsgsFeed).features);

function feedPoints(data: unknown): PointRecord[] | null {
  if (!isFeed(data)) return null;
  return data.features
    .filter((f) => typeof f.properties.mag === 'number')
    .map((f) => ({
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      depth: f.geometry.coordinates[2],
      mag: f.properties.mag,
      t: f.properties.time,
      place: f.properties.place ?? null,
    }))
    .sort((a, b) => Number(a.mag) - Number(b.mag));
}

/** 「3 小時前」「2 天前」 */
function ago(ms: number): string {
  const hours = (Date.now() - ms) / 3_600_000;
  if (hours < 1) return tr({ zh: `${fixed(Math.max(1, hours * 60), 0)} 分鐘前`, en: `${fixed(Math.max(1, hours * 60), 0)} min ago` });
  if (hours < 48) return tr({ zh: `${fixed(hours, 0)} 小時前`, en: `${fixed(hours, 0)} h ago` });
  return tr({ zh: `${fixed(hours / 24, 0)} 天前`, en: `${fixed(hours / 24, 0)} days ago` });
}

export function liveQuakesOverlay(indicators: string[], color: PointsOverlayDef['color'], stops: [number, number][]): PointsOverlayDef {
  return {
    kind: 'points',
    id: 'quakes-live',
    file: '',
    label: { zh: '最近 7 天的地震（USGS 即時，規模 4.5 以上）', en: 'Last 7 days (USGS live, M4.5+)' },
    hidden: true,
    indicators,
    liveFeed: { url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson', minutes: 5, points: feedPoints },
    radius: { field: 'mag', stops },
    color,
    look: 'hollow',
    sortField: 'mag',
    count: { unit: { zh: '次', en: 'quakes' } },
    tooltip: (p) => {
      const time = new Date(Number(p.t));
      const stamp = `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
      return {
        title: `M${fixed(Number(p.mag), 1)} · ${ago(Number(p.t))}`,
        detail: [stamp, tr({ zh: `深度 ${fixed(Number(p.depth), 0)} 公里`, en: `Depth ${fixed(Number(p.depth), 0)} km` })].join(' · '),
        properNoun: typeof p.place === 'string' ? p.place : undefined,
      };
    },
  };
}

/* ── 游標在哪一塊板塊、離最近的板塊邊界多遠（板4） ────────────── */

interface PlateIndex {
  rings: [number, number][][];
  records: PointRecord[];
  boxes: [number, number, number, number][];
  lines: [number, number][][];
  bounds: PointRecord[];
}

let index: PlateIndex | null = null;
let loading = false;

/** 先讀好（「板塊」指標的左側欄打開時），游標第一次滑過就有資料 */
export function preloadPlates(): void {
  plateIndex();
}

/** 第一次用到時讀兩個檔（板塊的面、邊界）；讀到之前回傳 null */
function plateIndex(): PlateIndex | null {
  if (index || loading) return index;
  loading = true;
  Promise.all([fetchJson<LinesData>('topics/earthquakes/plate-areas.json'), fetchJson<LinesData>('topics/earthquakes/plates.json')]).then(
    ([areas, bounds]) => {
      const a = decodeLines(areas);
      const b = decodeLines(bounds);
      const boxes = a.lines.map((ring) => {
        const xs = ring.map((p) => p[0]);
        const ys = ring.map((p) => p[1]);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number];
      });
      index = { rings: a.lines, records: a.records ?? [], boxes, lines: b.lines, bounds: b.records ?? [] };
    },
    () => {
      loading = false;
    },
  );
  return null;
}

function inside(ring: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function plateAt(ix: PlateIndex, lon: number, lat: number): PointRecord | null {
  const x = ((((lon + 180) % 360) + 360) % 360) - 180;
  for (let k = 0; k < ix.rings.length; k++) {
    const [w, s, e, n] = ix.boxes[k];
    if (lat < s || lat > n || x < w || x > e) continue;
    if (inside(ix.rings[k], x, lat)) return ix.records[k];
  }
  return null;
}

const DIRECTIONS: Text[] = [
  { zh: '北', en: 'north' },
  { zh: '東北', en: 'northeast' },
  { zh: '東', en: 'east' },
  { zh: '東南', en: 'southeast' },
  { zh: '南', en: 'south' },
  { zh: '西南', en: 'southwest' },
  { zh: '西', en: 'west' },
  { zh: '西北', en: 'northwest' },
];

/** 最近的板塊邊界：距離（公里，在游標附近展開成平面算，幾百公里內誤差很小）、方向與那一條邊界的紀錄 */
function nearestBoundary(ix: PlateIndex, lon: number, lat: number): { km: number; dir: Text; record: PointRecord } | null {
  const k = 111.2;
  const cos = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  let bx = 0;
  let by = 0;
  let rec: PointRecord | null = null;
  ix.lines.forEach((line, i) => {
    let px = 0;
    let py = 0;
    line.forEach(([x, y], j) => {
      // 經度換到游標附近（線的經度展開過，可以超過 ±180）
      const qx = ((((x - lon + 540) % 360) + 360) % 360) - 180;
      const X = qx * cos * k;
      const Y = (y - lat) * k;
      if (j > 0) {
        const dx = X - px;
        const dy = Y - py;
        const len2 = dx * dx + dy * dy;
        const t = len2 > 0 && Math.abs(dx) < 20000 ? Math.max(0, Math.min(1, -(px * dx + py * dy) / len2)) : 0;
        const cx = px + t * dx;
        const cy = py + t * dy;
        const d = Math.hypot(cx, cy);
        if (d < best) {
          best = d;
          bx = cx;
          by = cy;
          rec = ix.bounds[i];
        }
      }
      px = X;
      py = Y;
    });
  });
  if (!rec) return null;
  const angle = (Math.atan2(bx, by) * 180) / Math.PI;
  return { km: best, dir: DIRECTIONS[Math.round(((angle + 360) % 360) / 45) % 8], record: rec };
}

/** 「太平洋板塊（大板塊）」與「最近的板塊邊界在東方 12 公里：…」；資料還沒讀到時回傳 null */
export function plateLines(lngLat: [number, number], iso3: string | null): { name: string; lines: string[] } | null {
  const ix = plateIndex();
  if (!ix) return null;
  const [lon, lat] = lngLat;
  const plate = plateAt(ix, lon, lat);
  const near = nearestBoundary(ix, lon, lat);
  if (!plate && !near) return null;
  const en = getLang() === 'en';
  const name = plate ? String(en ? plate.en : plate.zh) : tr({ zh: '板塊', en: 'Plate' });
  const lines: string[] = [];
  if (plate) {
    const cls = tr(PLATE_CLASSES[Number(plate.cls)] ?? PLATE_CLASSES[3]);
    lines.push(tr({ zh: `位在${name}（${cls}）`, en: `On the ${name} (${cls})` }));
  }
  if (near) {
    const r = near.record;
    const pair = tr({ zh: `${plateName(r, 'a')}與${plateName(r, 'b')}的${tr(BOUNDARY_CLASSES[Number(r.c)])}`, en: `the ${tr(BOUNDARY_CLASSES[Number(r.c)])} between the ${plateName(r, 'a')} and the ${plateName(r, 'b')}` });
    const km = near.km < 10 ? fixed(near.km, 1) : fixed(near.km, 0);
    lines.push(
      near.km < 1
        ? tr({ zh: `就在板塊邊界上：${pair}，${rateText(r)}`, en: `On a plate boundary: ${pair}, ${rateText(r)}` })
        : tr({ zh: `最近的板塊邊界在${tr(near.dir)}方 ${km} 公里：${pair}，${rateText(r)}`, en: `Nearest plate boundary ${km} km to the ${tr(near.dir)}: ${pair}, ${rateText(r)}` }),
    );
    if (near.km < 50) lines.push(tr({ zh: '板塊邊界的位置是模型的近似，誤差可達數十公里', en: 'Boundary positions are model approximations, off by up to tens of kilometres' }));
  }
  if (iso3 === 'TWN') lines.push(tr({ zh: 'PB2002 在台灣的界線很粗略（台中也算在菲律賓海板塊上）', en: 'PB2002 draws Taiwan’s plate boundary only roughly (it puts Taichung on the Philippine Sea Plate)' }));
  return { name, lines };
}

/** 主題的 pointer：只有「板塊」指標寫（其他指標的 tooltip 不多加幾行） */
export const platePointer: NonNullable<TopicDefinition['pointer']> = (lngLat, ctx): PointerInfo | null => {
  if (!PLATE_INDICATORS.includes(ctx.indicator)) return null;
  const info = plateLines(lngLat, ctx.iso3);
  if (!info) return null;
  return ctx.iso3 ? { lines: info.lines } : { title: info.name, lines: info.lines.slice(1) };
};

/** 觀察點（「定位我」）：任何指標都寫在哪一塊板塊、離邊界多遠 */
export const platePin: NonNullable<TopicDefinition['pin']> = {
  draggable: true,
  label: (lngLat, ctx) => plateLines(lngLat, ctx.iso3)?.lines ?? [],
};

/* ── 「板塊」指標（板1、板5） ────────────── */

export const PLATES_INDICATOR: IndicatorDef = {
  id: 'plates',
  label: { zh: '板塊（跨幾塊板塊）', en: 'Tectonic plates' },
  description: {
    zh: 'Peter Bird 的 PB2002 模型把地表分成 52 塊板塊（7 塊大板塊、13 塊小板塊、32 塊微板塊，依面積分）；邊界依兩個板塊的相對速度變粗，隱沒帶的三角形畫在上覆的板塊那一側。國家的數值是有人住的部分跨幾塊板塊：印尼 7 塊最多，台灣跨揚子、菲律賓海與沖繩 3 塊。滑到地圖上任何一點看它在哪一塊板塊、離最近的邊界多遠；左邊是各板塊的人口。',
    en: 'Peter Bird’s PB2002 model divides the surface into 52 plates (7 major, 13 minor and 32 microplates, by area); boundaries thicken with the plates’ relative speed, and subduction teeth sit on the overriding plate. A country’s value is how many plates its inhabited land spans: Indonesia has the most (7), and Taiwan spans 3 (Yangtze, Philippine Sea and Okinawa). Hover anywhere on the map to see which plate it is on and how far the nearest boundary is; the panel on the left ranks plates by population.',
  },
  unit: { zh: '塊', en: 'plates' },
  file: 'plates-count.json',
  timeless: true,
  layer: { kind: 'none' },
  shade: 'land-sea',
  format: (v) => tr({ zh: `跨 ${fixed(v, 0)} 塊板塊`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'plate' : 'plates'}` }),
  formatTick: (v) => fixed(v, 0),
};

/** 左側欄：各板塊的人口（panels/PlatesWorld.tsx） */
export const PLATES_WORLD_PANEL: NonNullable<TopicDefinition['worldPanel']> = {
  title: { zh: '各板塊的人口', en: 'Population by plate' },
  load: () => import('./panels/PlatesWorld'),
  indicators: PLATE_INDICATORS,
};

/** 人口的寫法（左側欄也用） */
export const people = (n: number) => tr({ zh: `${formatLargeNumber(n)} 人`, en: formatLargeNumber(n) });
