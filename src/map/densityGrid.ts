/**
 * 1 km 網格圖層（人口主題「人口密度」切到「1 km 網格」）：pipeline/topics/population_density_tiles.py 產生的
 * Web Mercator 點陣圖磚，JRC GHS-POP R2023A，1975–2030 每 5 年一期，依固定的對數分級上色。
 *
 * - 圖磚不進版本控制，部署時才產生（.github/workflows/deploy.yml），放在 tiles/<資料夾>/<版本>/<年>/z/x/y.png。
 *   同一個資料夾的 meta.json 列出版本、有哪幾期、分級門檻與顏色、哪些圖磚有內容。
 * - 海洋、無人區的圖磚不存在：地圖用自訂協定（GRID_PROTOCOL）載入圖磚，先查 meta.json 的位元表，
 *   沒有內容的直接給一張透明圖，不發出請求（不會有一堆 404）。
 * - 這個檔不 import MapLibre：WorldMap.tsx 用 addProtocol 註冊 loadGridTile。
 */
import { useEffect, useState } from 'react';
import { defineMessages, getLang, type Lang } from '../i18n';

/** pipeline 輸出的 meta.json */
export interface GridMeta {
  version: string;
  epochs: number[];
  /** 從這一期開始是推估（GHS-POP R2023A 的 2025、2030） */
  projectionFrom?: number;
  tileSize: number;
  maxzoom: number;
  /** 分級門檻（人/km²），N 個門檻 → N+1 級，顏色由淺到深 */
  thresholds: number[];
  /** 每 km² 不到這麼多人的像素透明 */
  minDensity: number;
  colors: string[];
  /** 有內容的圖磚：每個縮放級數一串位元（第 y × 2^z + x 個位元，低位元在前），base64 */
  tiles: string[];
  source: string;
  sourceUrl: string;
  citation: string;
  generatedAt: string;
}

/** 目前畫在地圖上的網格 */
export interface GridLayer {
  /** tiles/ 底下的資料夾 */
  dir: string;
  meta: GridMeta;
  /** 這一期（時間軸的年份對應到的那一期） */
  epoch: number;
}

export const GRID_PROTOCOL = 'densitygrid';

function tilesUrl(path: string): string {
  // 建置後 BASE_URL 是相對路徑 './'，換成完整網址（以目前頁面為準）
  return new URL(`${import.meta.env.BASE_URL}tiles/${path}`, window.location.href).href;
}

const metaCache = new Map<string, Promise<GridMeta>>();

export function fetchGridMeta(dir: string): Promise<GridMeta> {
  let promise = metaCache.get(dir);
  if (!promise) {
    // 一律向伺服器確認（沒變只回 304）：GitHub Pages 的 max-age=600 會讓部署後 10 分鐘內還拿到舊版本號，
    // 舊版本的圖磚已經不在伺服器上
    promise = fetch(tilesUrl(`${dir}/meta.json`), { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`tiles/${dir}/meta.json (HTTP ${res.status})`);
      return res.json() as Promise<GridMeta>;
    });
    promise.catch(() => metaCache.delete(dir)); // 失敗不快取，下次重試
    metaCache.set(dir, promise);
  }
  return promise;
}

export function useGridMeta(dir: string | null): { data: GridMeta | null; error: Error | null } {
  const [state, setState] = useState<{ dir: string | null; data: GridMeta | null; error: Error | null }>({
    dir: null,
    data: null,
    error: null,
  });
  useEffect(() => {
    if (!dir) return;
    let cancelled = false;
    fetchGridMeta(dir).then(
      (data) => !cancelled && setState({ dir, data, error: null }),
      (error: Error) => !cancelled && setState({ dir, data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [dir]);
  return state.dir === dir ? state : { data: null, error: null };
}

/** 年份 → 那一年以前最近的一期（1975 年以前用 1975、2030 年以後用 2030） */
export function gridEpoch(epochs: number[], year: number): number {
  return epochs.reduce((best, e) => (e <= year ? e : best), epochs[0]);
}

export function gridTiles(layer: GridLayer): string {
  return `${GRID_PROTOCOL}://${layer.dir}/${layer.meta.version}/${layer.epoch}/{z}/{x}/{y}`;
}

const occupancyCache = new WeakMap<GridMeta, Uint8Array[]>();

function hasTile(meta: GridMeta, z: number, x: number, y: number): boolean {
  let bits = occupancyCache.get(meta);
  if (!bits) {
    bits = meta.tiles.map((b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    occupancyCache.set(meta, bits);
  }
  const i = y * 2 ** z + x;
  return Boolean(bits[z] && bits[z][i >> 3] & (1 << (i & 7)));
}

/** 1×1 的透明 PNG：沒有內容的圖磚 */
const EMPTY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);

/** MapLibre 的 addProtocol 載入函式：densitygrid://<資料夾>/<版本>/<期>/<z>/<x>/<y> */
export async function loadGridTile(
  params: { url: string },
  abort: AbortController,
): Promise<{ data: ArrayBuffer }> {
  const [dir, version, epoch, z, x, y] = params.url.slice(GRID_PROTOCOL.length + 3).split('/');
  const meta = await fetchGridMeta(dir);
  if (meta.version !== version || !hasTile(meta, Number(z), Number(x), Number(y))) {
    return { data: EMPTY_PNG.slice().buffer };
  }
  // 經過 service worker：看過的圖磚存在快取裡（src/sw.ts），離線也看得到
  const res = await fetch(tilesUrl(`${dir}/${version}/${epoch}/${z}/${x}/${y}.png`), { signal: abort.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { data: await res.arrayBuffer() };
}

const GRID_TEXT = defineMessages({
  zh: {
    /** 「國家平均 / 1 km 網格」切換 */
    mode: '呈現方式',
    countryAverage: '國家平均',
    grid: '1 km 網格',
    title: (label: string) => `${label}（1 km 網格）`,
    /** 匯出圖片的副標題；畫面上的說明再加一句 hover 的提示 */
    subtitle: '每個約 1 km 見方的格子裡，每平方公里住多少人（JRC GHS-POP，每 5 年一期）。',
    hoverHint: '滑鼠移到國家上會顯示國家平均。',
    /** 圖例：哪一期、縮小時是平均 */
    note: (epoch: number, projected: boolean) => `${epoch} 年網格${projected ? '（推估）' : ''} · 縮小時為範圍內平均`,
    flatIn3d: '3D 時網格不拉高，只傾斜地圖',
    empty: (min: string) => `每 km² 不到 ${min} 人（不上色）`,
    tooltip: '國家平均',
    failed: '1 km 網格載入失敗，先顯示國家平均',
  },
  en: {
    mode: 'Display',
    countryAverage: 'Country average',
    grid: '1 km grid',
    title: (label) => `${label} (1 km grid)`,
    subtitle: 'People per km² in each cell of a grid about 1 km across (JRC GHS-POP, every 5 years).',
    hoverHint: ' Hover over a country to see its average.',
    note: (epoch, projected) => `${epoch} grid${projected ? ' (projection)' : ''} · averaged when zoomed out`,
    flatIn3d: 'In 3D the grid stays flat; only the map tilts',
    empty: (min) => `Under ${min} per km² (not coloured)`,
    tooltip: 'country average',
    failed: 'The 1 km grid failed to load; showing country averages',
  },
});

export function gridText(lang: Lang = getLang()) {
  return GRID_TEXT[lang];
}
