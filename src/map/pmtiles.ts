import type { GetResourceResponse, RequestParameters, VectorSourceSpecification } from 'maplibre-gl';
import type { Protocol } from 'pmtiles';

/**
 * PMTiles（製作手冊第十六批 263，2026-11-01）：大的線與面圖層切成向量圖磚、包成一個 `.pmtiles` 檔
 * （pipeline/pmtiles.py 用 tippecanoe 產生，放在 public/pmtiles/；public/tiles/ 是網格圖磚的資料夾，部署時才產生），
 * 用 HTTP Range 只讀看得到的那一塊。
 *
 * - `pmtiles://` protocol 在 WorldMap.tsx 跟 grid、flag、relief 一起註冊（`loadPmtiles`），`pmtiles` 套件本身（含 fflate 的解壓，
 *   建置後自己一個 chunk，gzip 後約 7 KB）第一次讀圖磚時才下載，沒用到 PMTiles 的主題不必載入。
 * - 圖磚的檔名帶內容雜湊（`<名稱>-<雜湊>.pmtiles`），從 `pmtiles/index.json` 查；換檔就換網址。
 * - service worker（sw.ts）不預先快取、不存 `.pmtiles`，Range 請求直接走網路；離線時這些圖層看不到
 *   （用到的地方照 StatusCard 的樣子說明，`TilesOffline`）。
 * - hover、點選、`queryRenderedFeatures` 照常能用；要依國家或行政區上色、標出的，來源設 `promoteId`
 *   （例如 iso3），feature-state 才用得到同一個代碼。
 */

export const PMTILES_PROTOCOL = 'pmtiles';

let protocol: Promise<Protocol> | null = null;

function getProtocol(): Promise<Protocol> {
  // metadata: true：TileJSON 帶上檔案的 metadata（vector_layers），MapLibre 才知道圖層與縮放範圍
  return (protocol ??= import('pmtiles').then(({ Protocol }) => new Protocol({ metadata: true })));
}

/** `pmtiles://` 的讀取函式（WorldMap.tsx 用 addProtocol 註冊）：TileJSON 與圖磚都交給 pmtiles 套件，用 Range 讀 */
export async function loadPmtiles(params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<unknown>> {
  const p = await getProtocol();
  return p.tile(params, abort);
}

/** pmtiles/index.json 的一筆（pipeline/pmtiles.py 寫的） */
export interface TilesEntry {
  file: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
  bytes: number;
  generatedAt: string;
}

let index: Promise<Record<string, TilesEntry>> | null = null;

/** 所有 PMTiles 檔的索引（名稱 → 檔名、圖層、縮放範圍）；讀一次就留著 */
export function loadTilesIndex(): Promise<Record<string, TilesEntry>> {
  return (index ??= fetch(`${import.meta.env.BASE_URL}pmtiles/index.json`).then((r) => {
    if (!r.ok) throw new Error(`pmtiles/index.json: HTTP ${r.status}`);
    return r.json() as Promise<Record<string, TilesEntry>>;
  })).catch((error: unknown) => {
    index = null; // 離線或失敗時下次再試
    throw error;
  });
}

/** PMTiles 檔的完整網址（protocol 要絕對網址） */
export function tilesUrl(file: string): string {
  return new URL(`${import.meta.env.BASE_URL}pmtiles/${file}`, window.location.href).href;
}

/** MapLibre 的向量圖磚來源；promoteId 是要拿來當 feature id 的屬性（依國家或行政區上色、hover、點選用） */
export function pmtilesSource(entry: TilesEntry, promoteId?: string): VectorSourceSpecification {
  return {
    type: 'vector',
    url: `${PMTILES_PROTOCOL}://${tilesUrl(entry.file)}`,
    ...(promoteId ? { promoteId } : {}),
  };
}
