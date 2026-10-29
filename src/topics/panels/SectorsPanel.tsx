import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

const SECTORS: { id: 'agriculture' | 'industry' | 'services'; label: Text; hue: Hue }[] = [
  { id: 'agriculture', label: { zh: '農業', en: 'Agriculture' }, hue: 'blue' },
  { id: 'industry', label: { zh: '工業', en: 'Industry' }, hue: 'orange' },
  { id: 'services', label: { zh: '服務業', en: 'Services' }, hue: 'aqua' },
];

const TEXT = defineMessages({
  zh: {
    title: 'GDP 結構與就業結構',
    gdp: (year: number) => `GDP（${year}）`,
    employment: (year: number) => `就業（${year}）`,
    taxes: '產品稅等',
    sector: '產業',
    shareGdp: '占 GDP',
    shareEmployment: '占就業',
    note: '同一產業「占 GDP」低於「占就業」，代表這個產業每位工作者創造的產值低於平均（例如多數國家的農業）。',
    trend: '三業占 GDP 的變化',
    trendAria: (country: string) => `${country}歷年三級產業占 GDP 比重`,
    barAria: (label: string, parts: string[]) => `${label}：${parts.join('、')}`,
  },
  en: {
    title: 'Structure of GDP and employment',
    gdp: (year) => `GDP (${year})`,
    employment: (year) => `Jobs (${year})`,
    taxes: 'Taxes on products, etc.',
    sector: 'Sector',
    shareGdp: '% of GDP',
    shareEmployment: '% of jobs',
    note: "When a sector's share of GDP is lower than its share of jobs, each worker in it produces less than average (as with agriculture in most countries).",
    trend: 'Sector shares of GDP over time',
    trendAria: (country) => `Shares of the three sectors in the GDP of ${country} over time`,
    barAria: (label, parts) => `${label}: ${parts.join(', ')}`,
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function SectorsPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(
    () => SECTORS.flatMap((s) => [`topics/${topic.id}/${s.id}.json`, `topics/${topic.id}/employment-${s.id}.json`]),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const gdp = SECTORS.map((_s, i) => loaded[i * 2]);
    const employment = SECTORS.map((_s, i) => loaded[i * 2 + 1]);
    const pick = (set: (IndicatorData | null)[]) => {
      const years = set[0]!.years;
      const index = latestIndexAtOrBefore(years, year, (i) => set.every((d) => d!.values[iso3]?.[i] != null));
      return index < 0 ? null : { year: years[index], values: set.map((d) => d!.values[iso3]![index]!) };
    };
    const indicator = topic.indicators.find((i) => i.id === 'services')!;
    const lines = SECTORS.map((s, i) => ({
      name: tr(s.label, lang),
      values: gdp[i]!.values[iso3] ?? [],
      color: tokens.hues[s.hue],
    }));
    const hasSeries = lines.some((l) => l.values.some((v) => v != null));
    const option = hasSeries
      ? timeSeriesOption({ years: gdp[0]!.years, lines, year, indicator, tokens })
      : null;
    return { gdp: pick(gdp), employment: pick(employment), option };
  }, [loaded, iso3, year, topic, tokens, lang]);

  if (!view) return <p className="empty">{t.loading}</p>;
  if (!view.gdp && !view.employment && !view.option) return null;

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <div className="stack-bars">
        {view.gdp && (
          <StackBar label={text.gdp(view.gdp.year)} values={view.gdp.values} tokens={tokens} remainderLabel={text.taxes} />
        )}
        {view.employment && <StackBar label={text.employment(view.employment.year)} values={view.employment.values} tokens={tokens} />}
      </div>
      <table className="mini-table">
        <thead>
          <tr>
            <th scope="col">{text.sector}</th>
            <th scope="col" className="num">{text.shareGdp}</th>
            <th scope="col" className="num">{text.shareEmployment}</th>
          </tr>
        </thead>
        <tbody>
          {SECTORS.map((s, i) => (
            <tr key={s.id}>
              <th scope="row">
                <span className="bar-key" style={{ background: tokens.hues[s.hue] }} />
                {tr(s.label, lang)}
              </th>
              <td className="num">{view.gdp ? pct(view.gdp.values[i]) : '—'}</td>
              <td className="num">{view.employment ? pct(view.employment.values[i]) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
      {view.option && (
        <>
          <h4>{text.trend}</h4>
          <Chart spec={view.option} height={200} ariaLabel={text.trendAria(countryName)} />
        </>
      )}
    </section>
  );
}

interface StackBarProps {
  label: string;
  values: number[];
  tokens: PanelExtraProps['tokens'];
  /** 三業加總不到 100% 時，剩下的部分用灰色標示 */
  remainderLabel?: string;
}

function StackBar({ label, values, tokens, remainderLabel }: StackBarProps) {
  const lang = useLang();
  const total = values.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, 100 - total);
  const scale = Math.max(100, total);
  return (
    <div className="stack-bar-row">
      <span className="stack-bar-label">{label}</span>
      <div
        className="stack-bar"
        role="img"
        aria-label={TEXT[lang].barAria(label, SECTORS.map((s, i) => `${tr(s.label, lang)} ${pct(values[i])}`))}
      >
        {SECTORS.map((s, i) => (
          <span key={s.id} style={{ width: `${(values[i] / scale) * 100}%`, background: tokens.hues[s.hue] }} />
        ))}
        {remainderLabel && remainder > 0.5 && (
          <span className="stack-bar-rest" title={`${remainderLabel} ${pct(remainder)}`} style={{ width: `${(remainder / scale) * 100}%` }} />
        )}
      </div>
    </div>
  );
}
