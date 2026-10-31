/** 主題下拉選單的分欄（TopicNav.tsx）：純函式，單元測試在 menuColumns.test.ts */

/** 使用者指定的排法（registry.ts 的 columns，每一欄放幾段）換成每一欄的段索引；段數對不上時多的放最後一欄 */
export function fixedColumns(counts: number[], sections: number): number[][] {
  let next = 0;
  const cols = counts.map((count) => Array.from({ length: count }, () => next++).filter((i) => i < sections));
  while (next < sections) cols[cols.length - 1].push(next++);
  return cols.filter((col) => col.length > 0);
}

/**
 * 依小標題分段的主題排成幾欄（2026-10-30，使用者要左邊的欄排得最多）：段照順序、一段不拆開，由上往下排完一欄
 * 再排下一欄（↑↓ 的順序跟畫面一致）。試每一種切法（段最多十來個、最多 3 欄，幾十種），依序挑：
 * 1. 不超過 maxHeight（螢幕放得下）的；都放不下就全部一起比
 * 2. 欄高由左往右遞減（左邊最滿）的，其次是左邊那欄最高的
 * 3. 最高的那欄最矮的（選單最短），再來是最矮的那欄最高的（比較平均）
 * 回傳每一欄放哪幾段（段的索引）
 */
export function packColumns(heights: number[], columns: number, maxHeight = Infinity): number[][] {
  const n = heights.length;
  const options: { cols: number[][]; order: number; max: number; min: number }[] = [];
  const walk = (from: number, cuts: number[]) => {
    const bounds = [0, ...cuts, n];
    const cols = bounds.slice(0, -1).map((start, c) => Array.from({ length: bounds[c + 1] - start }, (_, k) => start + k));
    const sums = cols.map((col) => col.reduce((sum, i) => sum + heights[i], 0));
    // 差 2px 以內算一樣高
    const order = sums.every((h, c) => c === 0 || h <= sums[c - 1] + 2) ? 0 : sums.every((h) => h <= sums[0] + 2) ? 1 : 2;
    options.push({ cols, order, max: Math.max(...sums), min: Math.min(...sums) });
    if (cuts.length === columns - 1) return;
    for (let i = from; i < n; i++) walk(i + 1, [...cuts, i]);
  };
  walk(1, []);
  const fitting = options.filter((o) => o.max <= maxHeight);
  const pool = fitting.length ? fitting : options;
  pool.sort((a, b) => a.order - b.order || a.max - b.max || b.min - a.min);
  return pool[0].cols;
}
