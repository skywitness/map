/**
 * 圓餅的資料（指標的 `layer.pie`，2026-11-01）：讀各片的指標檔，取地圖這一年的值（各片的指標檔有 latestWithin 時，
 * 沒有當年資料的國家用最近一年的，跟地圖、tooltip 一樣）。地圖檢視、而且指標有 pie 時才下載。
 */
import { useMemo } from 'react';
import { useJsonMany } from '../lib/data';
import type { PieData } from '../map/pies';
import { latestAt } from '../panels/stats';
import { indicatorPath, topicFile, type Indicator, type IndicatorData, type Topic } from '../topics/types';

const NONE: string[] = [];

export function usePies(topic: Topic, indicator: Indicator, item: string | null, year: number, enabled: boolean): PieData | null {
  const spec = enabled && indicator.layer.kind === 'bubble' ? indicator.layer.pie : undefined;
  // items：只有這幾個子項目畫圓餅（諾貝爾獎的「全部獎項」）
  const pie = spec && (!spec.items || (item !== null && spec.items.includes(item))) ? spec : undefined;
  const parts = useMemo(
    () => (pie ? pie.parts.map((p) => ({ ...p, def: topic.indicators.find((i) => i.id === p.indicator) })) : []),
    [pie, topic],
  );
  const paths = useMemo(
    () =>
      parts.length
        ? parts.flatMap((p) =>
            p.file ? [topicFile(topic, p.file)] : p.def ? [indicatorPath(topic, p.def, p.item ?? item)] : [],
          )
        : NONE,
    [parts, topic, item],
  );
  const files = useJsonMany<IndicatorData>(paths);
  return useMemo(() => {
    if (!parts.length || files.length !== parts.length || files.some((f) => !f)) return null;
    const shares = new Map<string, number[]>();
    files.forEach((data, k) => {
      const index = data!.years.indexOf(year);
      if (index < 0) return;
      for (const [iso3, v] of latestAt(data!, index).values) {
        let row = shares.get(iso3);
        if (!row) shares.set(iso3, (row = parts.map(() => 0)));
        row[k] = v;
      }
    });
    return {
      colors: parts.map((p) => p.color),
      labels: parts.map((p) => p.label ?? p.def?.label ?? p.indicator),
      shares,
      donut: Boolean(pie?.donut),
      only: Boolean(pie?.only),
    };
  }, [files, parts, year, pie]);
}
