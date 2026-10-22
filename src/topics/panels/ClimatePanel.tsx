import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatLargeTick } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

interface SourcesFile {
  years: number[];
  sources: string[];
  /** 百萬公噸 */
  values: Record<string, (number | null)[]>;
}

// 堆疊由下而上的順序與配色，沿用發電結構驗證過的相鄰配色（燃煤紅、天然氣紫、石油橘…）
const SOURCES: Record<string, { label: string; hue: Hue }> = {
  coal: { label: '燃煤', hue: 'red' },
  gas: { label: '天然氣', hue: 'violet' },
  oil: { label: '石油', hue: 'orange' },
  cement: { label: '水泥', hue: 'aqua' },
  flaring: { label: '燃除（油氣田燒掉的氣體）', hue: 'yellow' },
  other: { label: '其他工業', hue: 'green' },
};

const tonnes = (mt: number) => `${formatLargeNumber(mt * 1e6)} 公噸`;

export default function ClimatePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const { data, error } = useJson<SourcesFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const series = data.sources.map((s) => ({ name: SOURCES[s].label, values: data.values[s], color: tokens.hues[SOURCES[s].hue] }));
    const index = latestIndexAtOrBefore(data.years, year, (i) => data.sources.some((s) => (data.values[s][i] ?? 0) > 0));
    const items = data.sources
      .map((s) => ({ key: s, label: SOURCES[s].label, value: data.values[s][index] ?? 0, color: tokens.hues[SOURCES[s].hue] }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const option = stackedAreaOption({
      years: data.years,
      series,
      year,
      format: tonnes,
      formatTick: (mt) => formatLargeTick(mt * 1e6),
      tokens,
    });
    return { option, items, shownYear: index >= 0 ? data.years[index] : null };
  }, [data, year, tokens]);

  if (error) return <p className="empty">沒有這個國家的排放來源資料。</p>;
  if (!view) return <p className="empty">載入中…</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  return (
    <section className="panel-section">
      <h3>排放來源</h3>
      <EChart option={view.option} height={220} ariaLabel={`${countryName}歷年各來源二氧化碳排放量堆疊面積圖`} />
      {view.shownYear !== null && (
        <>
          <h4>
            {view.shownYear} 年各來源排放量
            {view.shownYear !== year && <span className="muted">（{year} 年無資料，顯示最近一年）</span>}
          </h4>
          <BarList items={view.items} format={tonnes} total={total} ariaLabel={`${countryName}${view.shownYear} 年二氧化碳排放來源`} />
        </>
      )}
    </section>
  );
}
