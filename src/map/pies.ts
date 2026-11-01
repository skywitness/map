/**
 * 比例圓畫成圓餅（2026-11-01，MapLibre 範例「Display HTML clusters with custom properties」的想法；指標的
 * `layer.pie`）：位置與大小跟比例圓一樣（同一個 `bubbles` source、同一個半徑 r），每一國的圓餅是一張小圖
 * （`pie-<ISO3>-<解析度>`），用 symbol 圖層貼在圓的位置；圓本身變透明，只留白色外框與滑過時的深色外框，
 * 滑過、點選、tooltip 照舊。
 * - 解析度分三級（PIE_TIERS，依這一年的半徑選夠大的一級），大部分的國家是小圓，圖片佔的記憶體才不會太多。
 * - 各片從 12 點鐘方向順時針畫，順序與顏色照指標的 parts；片與片之間留 1px 的白縫，小於 0.5% 的片不畫。
 * - 這個檔不 import MapLibre（只用型別），畫圖片的部分可以單獨測試。
 */
import type { Map as MaplibreMap } from 'maplibre-gl';

/** 圖片的邊長（CSS px）；半徑 r 的圓用直徑 2r 以上最小的一級 */
export const PIE_TIERS = [24, 48, 96] as const;

export function pieTier(r: number): number {
  return PIE_TIERS.find((t) => t >= 2 * r) ?? PIE_TIERS[PIE_TIERS.length - 1];
}

export const pieImageId = (iso3: string, tier: number) => `pie-${iso3}-${tier}`;

/** 各片的起訖角度（弧度，0 是 12 點鐘、順時針）；總和是 0 時回傳空的 */
export function pieSlices(shares: readonly number[], min = 0.005): { index: number; start: number; end: number }[] {
  const total = shares.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (!(total > 0)) return [];
  const out: { index: number; start: number; end: number }[] = [];
  let at = 0;
  shares.forEach((v, index) => {
    if (!(v > 0)) return;
    const sweep = (v / total) * 2 * Math.PI;
    if (v / total >= min) out.push({ index, start: at, end: at + sweep });
    at += sweep;
  });
  return out;
}

/** 畫一個圓餅的點陣圖（邊長 tier × ratio） */
export function drawPie(shares: readonly number[], colors: readonly string[], tier: number, ratio: number): ImageData | null {
  const size = Math.round(tier * ratio);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const c = size / 2;
  const r = c - ratio * 0.5;
  const slices = pieSlices(shares);
  for (const s of slices) {
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, s.start - Math.PI / 2, s.end - Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = colors[s.index] ?? '#999999';
    ctx.fill();
  }
  // 片與片之間的白縫（只有一片時不畫）
  if (slices.length > 1) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, ratio * (tier >= 48 ? 1 : 0.75));
    for (const s of slices) {
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + r * Math.sin(s.start), c - r * Math.cos(s.start));
      ctx.stroke();
    }
  }
  return ctx.getImageData(0, 0, size, size);
}

/** 圓餅的資料：各國各片的值（跟 parts 同順序）與顏色 */
export interface PieData {
  colors: string[];
  labels: string[];
  shares: Map<string, number[]>;
}

/**
 * 把這一年各國的圓餅加到（或更新）地圖的圖片：tiers 是每一國要用的解析度（WorldMap 的比例圓依半徑算）。
 * 回傳畫了圓餅的國家（其他國家照舊畫實心的圓）
 */
export function syncPieImages(map: MaplibreMap, pies: PieData, tiers: Map<string, number>, drawn: Map<string, string>): Set<string> {
  const ratio = Math.min(2, Math.max(1, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  const out = new Set<string>();
  for (const [iso3, tier] of tiers) {
    const shares = pies.shares.get(iso3);
    if (!shares || pieSlices(shares).length === 0) continue;
    const id = pieImageId(iso3, tier);
    // 同一張圖的內容沒變就不重畫（播放時大部分國家的組成年年不同，但換底圖、只改大小時不必重畫）
    const signature = `${shares.join(',')}|${pies.colors.join(',')}`;
    if (drawn.get(id) !== signature || !map.hasImage(id)) {
      const image = drawPie(shares, pies.colors, tier, ratio);
      if (!image) continue;
      if (map.hasImage(id)) map.updateImage(id, image);
      else map.addImage(id, image, { pixelRatio: ratio });
      drawn.set(id, signature);
    }
    out.add(iso3);
  }
  return out;
}
