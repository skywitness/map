import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
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
const SOURCES: Record<string, { label: Text; hue: Hue }> = {
  coal: { label: { zh: '燃煤', en: 'Coal' }, hue: 'red' },
  gas: { label: { zh: '天然氣', en: 'Gas' }, hue: 'violet' },
  oil: { label: { zh: '石油', en: 'Oil' }, hue: 'orange' },
  cement: { label: { zh: '水泥', en: 'Cement' }, hue: 'aqua' },
  flaring: { label: { zh: '燃除（油氣田燒掉的氣體）', en: 'Flaring (gas burned at oil and gas fields)' }, hue: 'yellow' },
  other: { label: { zh: '其他工業', en: 'Other industry' }, hue: 'green' },
};

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的排放來源資料。',
    title: '排放來源',
    chartAria: (country: string) => `${country}歷年各來源二氧化碳排放量堆疊面積圖`,
    bySource: (year: number) => `${year} 年各來源排放量`,
    listAria: (country: string, year: number) => `${country}${year} 年二氧化碳排放來源`,
  },
  en: {
    noCountry: 'No emissions-by-source data for this country.',
    title: 'Emissions by source',
    chartAria: (country) => `Stacked area chart of CO₂ emissions by source in ${country} over time`,
    bySource: (year) => `Emissions by source, ${year}`,
    listAria: (country, year) => `Sources of CO₂ emissions in ${country}, ${year}`,
  },
});

const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (mt: number) => `${formatLargeNumber(mt * 1e6)} ${tr(TONNES)}`;

export default function ClimatePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<SourcesFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const label = (source: string) => tr(SOURCES[source].label, lang);
    const series = data.sources.map((s) => ({ name: label(s), values: data.values[s], color: tokens.hues[SOURCES[s].hue] }));
    const index = latestIndexAtOrBefore(data.years, year, (i) => data.sources.some((s) => (data.values[s][i] ?? 0) > 0));
    const items = data.sources
      .map((s) => ({ key: s, label: label(s), value: data.values[s][index] ?? 0, color: tokens.hues[SOURCES[s].hue] }))
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
  }, [data, year, tokens, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <EChart option={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      {view.shownYear !== null && (
        <>
          <h4>
            {text.bySource(view.shownYear)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <BarList items={view.items} format={tonnes} total={total} ariaLabel={text.listAria(countryName, view.shownYear)} />
        </>
      )}
    </section>
  );
}
