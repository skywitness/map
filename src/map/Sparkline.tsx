/**
 * 地圖 tooltip 裡的歷年小折線：不必點開側欄就看得到這個國家的趨勢。沒有座標軸，兩端寫年份，
 * 目前的年份畫一個點；推估的年份（projectionFrom 起）畫虛線，跟側欄的折線圖一樣。
 */
const W = 132;
const H = 30;
const PAD = 3;

interface SparklineProps {
  years: number[];
  series: (number | null)[];
  year: number;
  projectionFrom?: number;
}

/** 至少要有幾個點才畫（太少看不出趨勢） */
export const SPARKLINE_MIN_POINTS = 3;

export function Sparkline({ years, series, year, projectionFrom }: SparklineProps) {
  const points = years.flatMap((y, i) => (series[i] != null ? [[y, series[i]!] as const] : []));
  if (points.length < SPARKLINE_MIN_POINTS) return null;
  const first = points[0][0];
  const last = points[points.length - 1][0];
  let min = Infinity;
  let max = -Infinity;
  for (const [, v] of points) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const x = (y: number) => PAD + ((y - first) / (last - first || 1)) * (W - PAD * 2);
  const yOf = (v: number) => (max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2));
  // 中間缺資料的年份斷開（年份零散的指標本來就是隔幾年一個點，連起來）
  const sparse = points.length < years.filter((y) => y >= first && y <= last).length / 2;
  const segments: (readonly [number, number])[][] = [];
  years.forEach((y, i) => {
    const v = series[i];
    if (v == null) {
      if (!sparse && segments.length && segments[segments.length - 1].length) segments.push([]);
      return;
    }
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push([y, v]);
  });
  const path = (pts: (readonly [number, number])[]) =>
    pts.map(([y, v], i) => `${i ? 'L' : 'M'}${x(y).toFixed(1)},${yOf(v).toFixed(1)}`).join('');
  const split = (pts: (readonly [number, number])[]) => {
    if (projectionFrom === undefined) return { solid: pts, dashed: [] };
    // 虛線從最後一個實際值接過去
    const cut = pts.findIndex(([y]) => y >= projectionFrom);
    if (cut < 0) return { solid: pts, dashed: [] };
    return { solid: pts.slice(0, cut), dashed: pts.slice(Math.max(0, cut - 1)) };
  };
  const current = points.find(([y]) => y === year);
  return (
    <div className="tt-spark">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        {segments.map((pts, i) => {
          const { solid, dashed } = split(pts);
          return (
            <g key={i}>
              {solid.length > 1 && <path d={path(solid)} className="tt-spark-line" />}
              {dashed.length > 1 && <path d={path(dashed)} className="tt-spark-line is-projected" />}
            </g>
          );
        })}
        {current && <circle cx={x(current[0])} cy={yOf(current[1])} r={2.8} className="tt-spark-dot" />}
      </svg>
      <div className="tt-spark-years">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
