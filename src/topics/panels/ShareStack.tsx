import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { stackedAreaOption } from '../../charts/stackedArea';
import { tr, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import type { IndicatorData, Text } from '../types';

/**
 * 一國各類別占比的堆疊面積圖（2026-11-02 從工業主題的 IndustrySitc 抽出來，貿易主題的服務出口組成也用）：
 * files 是各類別的指標檔（地圖用的同一組，順序跟 groups 一樣），顏色依類別的順序取 MAP_TOKENS.categorical，
 * 跟地圖的類別色、圓餅一樣。比例的合計是 100%，y 軸固定 0–100%
 */
export function ShareStack({
  files: paths,
  groups,
  iso3,
  year,
  title,
  none,
  note,
}: {
  files: string[];
  groups: { id: string; label: Text }[];
  iso3: string;
  year: number;
  title: string;
  none: string;
  note: string;
}) {
  const lang = useLang();
  const t = useT();
  const files = useJsonMany<IndicatorData>(paths);
  const ready = files.every(Boolean);
  const option = useMemo(() => {
    if (!ready) return null;
    const years = files[0]!.years;
    const series = groups.map((g, i) => ({
      name: tr(g.label, lang),
      values: files[i]!.values[iso3] ?? years.map(() => null),
      color: MAP_TOKENS.categorical[i],
    }));
    if (series.every((s) => s.values.every((v) => v === null))) return null;
    const spec = stackedAreaOption({ years, series, year, format: (v) => `${fixed(v, 1)}%`, formatTick: (v) => `${v}%` });
    return { ...spec, y: { ...spec.y, min: 0, max: 100, ticks: [0, 25, 50, 75, 100] } };
  }, [ready, files, groups, iso3, year, lang]);
  if (!ready) return <p className="empty">{t.loading}</p>;
  return (
    <>
      <h3>{title}</h3>
      {option ? <Chart spec={option} height={220} ariaLabel={title} /> : <p className="empty">{none}</p>}
      <p className="note">{note}</p>
    </>
  );
}
