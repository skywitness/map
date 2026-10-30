/**
 * 一群點的範圍 [西, 南, 東, 北]，只框離中位數 core 度以內的那一群（2026-10-30，奧運場館換屆時用）：
 * 主辦城市的場館擠在一起，足球、帆船常在別的城市，全部框起來會變成整個國家。那一群不到一半時框全部。
 * 經度不處理跨 180° 的情況（奧運場館沒有）。沒有點時回傳 null
 */
export function coreBox(points: [number, number][], core: number): [number, number, number, number] | null {
  if (!points.length) return null;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const mx = median(points.map((p) => p[0]));
  const my = median(points.map((p) => p[1]));
  const near = points.filter(([x, y]) => Math.abs(x - mx) <= core && Math.abs(y - my) <= core);
  const use = near.length * 2 >= points.length ? near : points;
  const xs = use.map((p) => p[0]);
  const ys = use.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
