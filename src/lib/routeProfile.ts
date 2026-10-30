import type { PersonalRoute } from './personalRoutes';

/**
 * 我的路線的高度剖面（2026-10-30 起，賽車主題；使用者：「像 OpenRunner 一樣，選取賽道後有圖呈現高度與距離關係」）：
 * 沿路線每隔一段距離取一點，算從起點的距離、海拔、坡度與累計爬升。海拔用原檔的（GPX 的 ele，OpenRunner、cyclingstage 都有），
 * 原檔沒有的（KML 寫 0、OpenStreetMap、F1 的賽道檔）從 AWS Terrain Tiles 的高程圖磚取（跟地形與 3D 同一個來源，terrarium 編碼），
 * 選取時才下載那幾張圖磚。
 */
export interface RouteProfile {
  /** 從起點的距離（m），每個取樣點一個 */
  dist: Float64Array;
  /** 海拔（m） */
  ele: Float64Array;
  lon: Float64Array;
  lat: Float64Array;
  /** 坡度（%），前後各約 grade 距離的平均 */
  grade: Float64Array;
  /** 到這一點為止的累計爬升（m） */
  climb: Float64Array;
  /** 總長（m）、總爬升、總下降、最低、最高（m） */
  length: number;
  gain: number;
  loss: number;
  min: number;
  max: number;
  /** 海拔來自原檔或地形圖磚 */
  source: 'file' | 'dem';
}

const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const R = 6_371_008.8;
/** 取樣點最多幾個（圖上的寬度差不多也是這個數量級） */
const MAX_SAMPLES = 1500;

function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 原本的點（好幾段接起來，段與段之間不算距離） */
function flatten(route: PersonalRoute) {
  const pts: { lon: number; lat: number; ele: number | null; d: number }[] = [];
  let d = 0;
  route.lines.forEach((line, i) => {
    line.forEach(([lon, lat], j) => {
      if (j > 0) d += haversine(line[j - 1][0], line[j - 1][1], lon, lat);
      pts.push({ lon, lat, ele: route.ele?.[i]?.[j] ?? null, d });
    });
  });
  return pts;
}

// ── 高程圖磚（terrarium：海拔 = R×256 + G + B/256 − 32768） ──
const tileCache = new Map<string, Promise<Float32Array | null>>();

function loadTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const key = `${z}/${x}/${y}`;
  let p = tileCache.get(key);
  if (!p) {
    p = fetch(`${DEM}/${key}.png`)
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => createImageBitmap(blob))
      .then((img) => {
        const canvas = new OffscreenCanvas(256, 256);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, 256, 256).data;
        const out = new Float32Array(256 * 256);
        for (let i = 0; i < out.length; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
        return out;
      })
      .catch(() => null);
    tileCache.set(key, p);
  }
  return p;
}

/** 各點的海拔（雙線性內插）；圖磚讀不到的點是 NaN */
async function demElevations(lons: Float64Array, lats: Float64Array, z: number): Promise<Float64Array> {
  const n = 2 ** z;
  const xs = new Float64Array(lons.length);
  const ys = new Float64Array(lons.length);
  const need = new Set<string>();
  for (let i = 0; i < lons.length; i++) {
    const x = ((lons[i] + 180) / 360) * n * 256;
    const s = Math.sin((lats[i] * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n * 256;
    xs[i] = x;
    ys[i] = y;
    for (const dx of [0, 1]) for (const dy of [0, 1]) need.add(`${Math.floor((x - 0.5 + dx) / 256)}/${Math.floor((y - 0.5 + dy) / 256)}`);
  }
  const tiles = new Map<string, Float32Array | null>();
  const keys = [...need];
  // 一次最多 8 張
  for (let i = 0; i < keys.length; i += 8) {
    const batch = keys.slice(i, i + 8);
    const got = await Promise.all(batch.map((k) => loadTile(z, ...(k.split('/').map(Number) as [number, number]))));
    batch.forEach((k, j) => tiles.set(k, got[j]));
  }
  const at = (px: number, py: number) => {
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    const t = tiles.get(`${((tx % n) + n) % n}/${ty}`) ?? tiles.get(`${tx}/${ty}`);
    if (!t) return NaN;
    return t[(Math.floor(py) - ty * 256) * 256 + (Math.floor(px) - tx * 256)];
  };
  const out = new Float64Array(lons.length);
  for (let i = 0; i < lons.length; i++) {
    const x = xs[i] - 0.5;
    const y = ys[i] - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    out[i] =
      at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  }
  return out;
}

/** 算一條路線的剖面；海拔都取不到時回傳 null */
export async function routeProfile(route: PersonalRoute): Promise<RouteProfile | null> {
  const pts = flatten(route);
  if (pts.length < 2) return null;
  const length = pts[pts.length - 1].d;
  // 取樣間距：至少 5 m，最多 MAX_SAMPLES 個點
  const step = Math.max(5, length / MAX_SAMPLES);
  const count = Math.max(2, Math.floor(length / step) + 1);
  const dist = new Float64Array(count);
  const lon = new Float64Array(count);
  const lat = new Float64Array(count);
  const fileEle = new Float64Array(count);
  let k = 0;
  let fileOk = true;
  for (let i = 0; i < count; i++) {
    const d = i === count - 1 ? length : i * step;
    while (k < pts.length - 2 && pts[k + 1].d < d) k++;
    const a = pts[k];
    const b = pts[k + 1];
    const f = b.d > a.d ? Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d))) : 0;
    dist[i] = d;
    lon[i] = a.lon + (b.lon - a.lon) * f;
    lat[i] = a.lat + (b.lat - a.lat) * f;
    if (a.ele === null || b.ele === null) fileOk = false;
    else fileEle[i] = a.ele + (b.ele - a.ele) * f;
  }
  let ele: Float64Array = fileEle;
  if (!fileOk) {
    // 圖磚的級數依長度：短的賽道、速降道用細的（14 級約 7–10 m 一格），長的賽段用 12 級（約 27–38 m），太長的 11 級
    const z = length < 8000 ? 14 : length < 300_000 ? 12 : 11;
    ele = await demElevations(lon, lat, z);
    // 讀不到的點用前後的值補
    let last = NaN;
    for (let i = 0; i < count; i++) if (Number.isNaN(ele[i])) ele[i] = last; else last = ele[i];
    last = NaN;
    for (let i = count - 1; i >= 0; i--) if (Number.isNaN(ele[i])) ele[i] = last; else last = ele[i];
    if (Number.isNaN(ele[0])) return null;
  }
  // 稍微平滑（約 3 個取樣點），坡度與爬升才不會被圖磚的雜訊放大
  const smooth = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(count - 1, i + 1); j++) {
      s += ele[j];
      n++;
    }
    smooth[i] = s / n;
  }
  // 坡度：前後各約 100 m（長的路線依取樣間距放寬；太短的窗口會被海拔的雜訊放大成一條一條）
  const half = Math.max(100, step * 3);
  const grade = new Float64Array(count);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < count; i++) {
    while (dist[i] - dist[lo] > half) lo++;
    while (hi < count - 1 && dist[hi + 1] - dist[i] <= half) hi++;
    const dd = dist[hi] - dist[lo];
    grade[i] = dd > 0 ? ((smooth[hi] - smooth[lo]) / dd) * 100 : 0;
  }
  // 累計爬升：海拔變化超過 2 m 才算（遲滯，平路上的雜訊不累加）
  const climb = new Float64Array(count);
  let gain = 0;
  let loss = 0;
  let ref = smooth[0];
  for (let i = 0; i < count; i++) {
    const diff = smooth[i] - ref;
    if (diff >= 2) {
      gain += diff;
      ref = smooth[i];
    } else if (diff <= -2) {
      loss -= diff;
      ref = smooth[i];
    }
    climb[i] = gain;
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    min = Math.min(min, smooth[i]);
    max = Math.max(max, smooth[i]);
  }
  return { dist, ele: smooth, lon, lat, grade, climb, length, gain, loss, min, max, source: fileOk ? 'file' : 'dem' };
}
