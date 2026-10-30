/**
 * 類別網格的資料（2026-10-30 從 classGridLayer.ts 拆出來）：讀 pipeline 寫的灰階 PNG、查某一點的代碼。
 * 首頁的程式（app/overlays.ts）與氣候分區等主題只要這些，WebGL 圖層（classGridLayer.ts）留在地圖的 chunk
 */
/** 解開的網格：寬 × 高個代碼，第一列是北緯 90°、第一行是西經 180° */
export interface ClassGrid {
  width: number;
  height: number;
  codes: Uint8Array;
}

// ── 讀取：pipeline 自己編碼的 8 位元灰階 PNG（不濾波），在瀏覽器裡解開，拿到原本的代碼 ──────────

const grids = new Map<string, Promise<ClassGrid>>();

/**
 * 讀一張類別網格（同一個網址只讀一次）。PNG 是 pipeline（例如 topics/koppen.py 的 png_gray）寫的：
 * 灰階 8 位元、每列濾波方式 0；用 DecompressionStream 解 zlib，不經過 canvas（canvas 可能做色彩轉換，代碼會變）
 */
export function loadClassGrid(url: string): Promise<ClassGrid> {
  let p = grids.get(url);
  if (!p) {
    p = fetchGrid(url);
    grids.set(url, p);
    p.catch(() => grids.delete(url));
  }
  return p;
}

async function fetchGrid(url: string): Promise<ClassGrid> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      if (body[8] !== 8 || body[9] !== 0) throw new Error(`${url} (not an 8-bit greyscale PNG)`);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    pos += 12 + len;
  }
  const stream = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  const codes = new Uint8Array(width * height);
  for (let r = 0; r < height; r++) {
    const start = r * (width + 1);
    if (raw[start] !== 0) throw new Error(`${url} (row ${r} uses a PNG filter)`);
    codes.set(raw.subarray(start + 1, start + 1 + width), r * width);
  }
  return { width, height, codes };
}

/** 網格在這個經緯度的代碼（0 是沒有資料，例如海） */
export function classAt(grid: ClassGrid, lon: number, lat: number): number {
  const x = Math.floor((((((lon + 180) % 360) + 360) % 360) / 360) * grid.width);
  const y = Math.floor(((90 - lat) / 180) * grid.height);
  if (y < 0 || y >= grid.height) return 0;
  return grid.codes[y * grid.width + Math.min(grid.width - 1, x)];
}
