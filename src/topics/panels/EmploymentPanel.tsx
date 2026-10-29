import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

// 男女對照：每個指標另外有 <指標>-female.json、<指標>-male.json（pipeline/topics/employment.py）
const ROWS: { id: string; label: Text }[] = [
  { id: 'unemployment', label: { zh: '失業率', en: 'Unemployment' } },
  { id: 'youth-unemployment', label: { zh: '青年失業率', en: 'Youth unemployment' } },
  { id: 'informal', label: { zh: '非正式就業', en: 'Informal employment' } },
  { id: 'participation', label: { zh: '勞動力參與率', en: 'Labour force participation' } },
];
const SEXES: { id: 'female' | 'male'; label: Text; hue: Hue }[] = [
  { id: 'female', label: { zh: '女性', en: 'Women' }, hue: 'orange' },
  { id: 'male', label: { zh: '男性', en: 'Men' }, hue: 'blue' },
];

const TEXT = defineMessages({
  zh: {
    title: '男女對照',
    indicator: '指標',
    shownYear: (year: number) => `（${year} 年）`,
    note: '青年失業率是 15–24 歲；勞動力參與率是 15 歲以上有工作或正在找工作的比例。',
    trend: '男女失業率的變化',
    chartAria: (country: string) => `${country}歷年男女失業率`,
  },
  en: {
    title: 'Women and men',
    indicator: 'Indicator',
    shownYear: (year) => ` (${year})`,
    note: 'Youth unemployment covers ages 15–24; labour force participation is the share of people aged 15 and over who are working or looking for work.',
    trend: 'Unemployment rate of women and men over time',
    chartAria: (country) => `Unemployment rate of women and men in ${country} over time`,
  },
});

/** 這一年（或 latestWithin 年內最近一年）男女都有值的索引 */
function indexFor(data: IndicatorData[], iso3: string, year: number): number {
  const years = data[0].years;
  const within = data[0].latestWithin ?? 0;
  for (let i = years.length - 1; i >= 0; i--) {
    if (years[i] > year) continue;
    if (year - years[i] > within) break;
    if (data.every((d) => d.values[iso3]?.[i] != null)) return i;
  }
  return -1;
}

export default function EmploymentPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useMemo(
    () => ROWS.flatMap((r) => SEXES.map((s) => `topics/${topic.id}/${r.id}-${s.id}.json`)),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const rows = ROWS.map((row, r) => {
      const data = SEXES.map((_s, s) => loaded[r * SEXES.length + s]!);
      const indicator = topic.indicators.find((i) => i.id === row.id)!;
      const index = indexFor(data, iso3, year);
      return {
        row,
        indicator,
        data,
        values: index >= 0 ? data.map((d) => d.values[iso3]![index]!) : null,
        shownYear: index >= 0 && data[0].years[index] !== year ? data[0].years[index] : null,
      };
    });
    if (rows.every((r) => !r.values)) return null;
    const [unemployment] = rows;
    const own = unemployment.data.map((d) => d.values[iso3]);
    const option = own.every(Boolean)
      ? timeSeriesOption({
          years: unemployment.data[0].years,
          lines: SEXES.map((s, i) => ({ name: tr(s.label, lang), values: own[i]!, color: tokens.hues[s.hue] })),
          projectionFrom: unemployment.data[0].projectionFrom,
          year,
          indicator: unemployment.indicator,
          tokens,
        })
      : null;
    return { rows, option };
  }, [loaded, iso3, year, topic, tokens, lang]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th scope="col">{text.indicator}</th>
            {SEXES.map((s) => (
              <th key={s.id} scope="col" className="num">
                <span className="bar-key" style={{ background: tokens.hues[s.hue] }} />
                {tr(s.label, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map(({ row, indicator, values, shownYear }) => (
            <tr key={row.id}>
              <th scope="row">
                {tr(row.label, lang)}
                {shownYear !== null && values && text.shownYear(shownYear)}
              </th>
              {SEXES.map((s, i) => (
                <td key={s.id} className="num">
                  {values ? indicator.format(values[i]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
      {view.option && (
        <>
          <h4>{text.trend}</h4>
          <Chart spec={view.option} height={200} ariaLabel={text.chartAria(countryName)} />
        </>
      )}
    </section>
  );
}
