import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
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
const FUELS: Record<string, { label: Text; hue: Hue }> = {
  coal: { label: { zh: '燃煤', en: 'Coal' }, hue: 'red' },
  gas: { label: { zh: '天然氣', en: 'Gas' }, hue: 'violet' },
  'other-fossil': { label: { zh: '其他化石燃料', en: 'Other fossil' }, hue: 'orange' },
  nuclear: { label: { zh: '核能', en: 'Nuclear' }, hue: 'aqua' },
  hydro: { label: { zh: '水力', en: 'Hydro' }, hue: 'blue' },
  wind: { label: { zh: '風力', en: 'Wind' }, hue: 'magenta' },
  solar: { label: { zh: '太陽能', en: 'Solar' }, hue: 'yellow' },
  'bio-other': { label: { zh: '生質能及其他再生', en: 'Bioenergy and other renewables' }, hue: 'green' },
};

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的發電結構資料。',
    title: '發電結構',
    chartAria: (country: string) => `${country}歷年各能源發電量堆疊面積圖`,
    byFuel: (year: number) => `${year} 年各能源發電量`,
    listAria: (country: string, year: number) => `${country}${year} 年發電結構`,
  },
  en: {
    noCountry: 'No electricity mix data for this country.',
    title: 'Electricity mix',
    chartAria: (country) => `Stacked area chart of electricity generation by source in ${country} over time`,
    byFuel: (year) => `Generation by source, ${year}`,
    listAria: (country, year) => `Electricity mix of ${country}, ${year}`,
  },
});

const twh = (v: number) => `${fixed(v, v < 10 ? 2 : 1)} TWh`;

export default function ElectricityPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<MixFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const label = (fuel: string) => tr(FUELS[fuel].label, lang);
    const series = data.fuels.map((f) => ({ name: label(f), values: data.values[f], color: tokens.hues[FUELS[f].hue] }));
    const index = latestIndexAtOrBefore(data.years, year, (i) => data.fuels.some((f) => (data.values[f][i] ?? 0) > 0));
    const items = data.fuels
      .map((f) => ({ key: f, label: label(f), value: data.values[f][index] ?? 0, color: tokens.hues[FUELS[f].hue] }))
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
  }, [data, year, tokens, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      {view.shownYear !== null && (
        <>
          <h4>
            {text.byFuel(view.shownYear)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <BarList items={view.items} format={twh} total={total} ariaLabel={text.listAria(countryName, view.shownYear)} />
        </>
      )}
    </section>
  );
}
