import { useMemo } from 'react';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

const SECTORS: { id: 'agriculture' | 'industry' | 'services'; label: string; hue: Hue }[] = [
  { id: 'agriculture', label: '農業', hue: 'blue' },
  { id: 'industry', label: '工業', hue: 'orange' },
  { id: 'services', label: '服務業', hue: 'aqua' },
];

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function SectorsPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
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
      name: s.label,
      values: gdp[i]!.values[iso3] ?? [],
      color: tokens.hues[s.hue],
    }));
    const hasSeries = lines.some((l) => l.values.some((v) => v != null));
    const option = hasSeries
      ? timeSeriesOption({ years: gdp[0]!.years, lines, year, indicator, tokens })
      : null;
    return { gdp: pick(gdp), employment: pick(employment), option };
  }, [loaded, iso3, year, topic, tokens]);

  if (!view) return <p className="empty">載入中…</p>;
  if (!view.gdp && !view.employment && !view.option) return null;

  return (
    <section className="panel-section">
      <h3>GDP 結構與就業結構</h3>
      <div className="stack-bars">
        {view.gdp && <StackBar label={`GDP（${view.gdp.year}）`} values={view.gdp.values} tokens={tokens} remainderLabel="產品稅等" />}
        {view.employment && <StackBar label={`就業（${view.employment.year}）`} values={view.employment.values} tokens={tokens} />}
      </div>
      <table className="mini-table">
        <thead>
          <tr>
            <th scope="col">產業</th>
            <th scope="col" className="num">占 GDP</th>
            <th scope="col" className="num">占就業</th>
          </tr>
        </thead>
        <tbody>
          {SECTORS.map((s, i) => (
            <tr key={s.id}>
              <th scope="row">
                <span className="bar-key" style={{ background: tokens.hues[s.hue] }} />
                {s.label}
              </th>
              <td className="num">{view.gdp ? pct(view.gdp.values[i]) : '—'}</td>
              <td className="num">{view.employment ? pct(view.employment.values[i]) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        同一產業「占 GDP」低於「占就業」，代表這個產業每位工作者創造的產值低於平均（例如多數國家的農業）。
      </p>
      {view.option && (
        <>
          <h4>三業占 GDP 的變化</h4>
          <EChart option={view.option} height={200} ariaLabel={`${countryName}歷年三級產業占 GDP 比重`} />
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
  const total = values.reduce((a, b) => a + b, 0);
  const remainder = Math.max(0, 100 - total);
  const scale = Math.max(100, total);
  return (
    <div className="stack-bar-row">
      <span className="stack-bar-label">{label}</span>
      <div className="stack-bar" role="img" aria-label={`${label}：${SECTORS.map((s, i) => `${s.label} ${pct(values[i])}`).join('、')}`}>
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
