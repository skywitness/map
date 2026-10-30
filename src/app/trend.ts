/**
 * 時間軸背後的走勢（TimeSlider 的 trend，2026-10-30）：一眼看出哪幾年變化大。
 */
import type { Indicator, IndicatorData } from '../topics/types';

/** 中位數要有這麼多國家（而且不少於國家最多那一年的一半）才算，涵蓋的國家變少時線不會亂跳 */
const MIN_COUNTRIES = 20;

/**
 * 世界的總量或平均（資料檔的 aggregates.WLD），沒有的話用各國的中位數；陣列跟 data.years 一一對應。
 * 只畫連續的量（面量圖、比例圓）；類別、年份這種數值（rankingBars: false）、不到 3 年的不畫
 */
export function worldTrend(indicator: Indicator, data: IndicatorData | null): (number | null)[] | null {
  if (!data || data.years.length < 3) return null;
  const kind = indicator.layer.kind;
  if ((kind !== 'choropleth' && kind !== 'bubble') || indicator.rankingBars === false) return null;
  const enough = (series: (number | null)[]) => series.filter((v) => v != null).length >= 3;
  const world = data.aggregates?.WLD;
  if (world && enough(world)) return world;
  const series = Object.values(data.values);
  const counts = data.years.map((_, i) => series.reduce((n, s) => n + (s[i] != null ? 1 : 0), 0));
  const floor = Math.max(MIN_COUNTRIES, Math.max(...counts) / 2);
  const medians = data.years.map((_, i) => {
    if (counts[i] < floor) return null;
    const values = series.flatMap((s) => (s[i] != null ? [s[i]!] : [])).sort((a, b) => a - b);
    const mid = values.length >> 1;
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  });
  return enough(medians) ? medians : null;
}
