import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

interface MixFile {
  years: number[];
  fuels: string[];
  values: Record<string, (number | null)[]>;
}

// 堆疊由下而上的順序與配色。這個排列用配色驗證工具挑過，相鄰兩層在色盲模擬下也分得開。
const FUELS: Record<string, { label: string; hue: Hue }> = {
  coal: { label: '燃煤', hue: 'red' },
  gas: { label: '天然氣', hue: 'violet' },
  'other-fossil': { label: '其他化石燃料', hue: 'orange' },
  nuclear: { label: '核能', hue: 'aqua' },
  hydro: { label: '水力', hue: 'blue' },
  wind: { label: '風力', hue: 'magenta' },
  solar: { label: '太陽能', hue: 'yellow' },
  'bio-other': { label: '生質能及其他再生', hue: 'green' },
};

const twh = (v: number) => `${fixed(v, v < 10 ? 2 : 1)} TWh`;

export default function ElectricityPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const { data, error } = useJson<MixFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const series = data.fuels.map((f) => ({ name: FUELS[f].label, values: data.values[f], color: tokens.hues[FUELS[f].hue] }));
    const index = latestIndexAtOrBefore(data.years, year, (i) => data.fuels.some((f) => (data.values[f][i] ?? 0) > 0));
    const items = data.fuels
      .map((f) => ({ key: f, label: FUELS[f].label, value: data.values[f][index] ?? 0, color: tokens.hues[FUELS[f].hue] }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
    const option = stackedAreaOption({
      years: data.years,
      series,
      year,
      format: twh,
      formatTick: (v) => fixed(v, 0),
      tokens,
    });
    return { option, items, shownYear: index >= 0 ? data.years[index] : null };
  }, [data, year, tokens]);

  if (error) return <p className="empty">沒有這個國家的發電結構資料。</p>;
  if (!view) return <p className="empty">載入中…</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  return (
    <section className="panel-section">
      <h3>發電結構</h3>
      <EChart option={view.option} height={220} ariaLabel={`${countryName}歷年各能源發電量堆疊面積圖`} />
      {view.shownYear !== null && (
        <>
          <h4>
            {view.shownYear} 年各能源發電量
            {view.shownYear !== year && <span className="muted">（{year} 年無資料，顯示最近一年）</span>}
          </h4>
          <BarList items={view.items} format={twh} total={total} ariaLabel={`${countryName}${view.shownYear} 年發電結構`} />
        </>
      )}
    </section>
  );
}
