import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

const SEXES: { id: 'female' | 'male'; label: Text; hue: Hue }[] = [
  { id: 'female', label: { zh: '女性', en: 'Women' }, hue: 'orange' },
  { id: 'male', label: { zh: '男性', en: 'Men' }, hue: 'blue' },
];

const TEXT = defineMessages({
  zh: {
    title: '男女平均壽命',
    summary: (year: number, female: number, male: number) =>
      `${year} 年女性 ${fixed(female, 1)} 歲、男性 ${fixed(male, 1)} 歲，` +
      `${female >= male ? '女性' : '男性'}多 ${fixed(Math.abs(female - male), 1)} 歲。`,
    chartAria: (country: string) => `${country}歷年男女平均壽命`,
  },
  en: {
    title: 'Life expectancy of women and men',
    summary: (year, female, male) =>
      `In ${year}, ${fixed(female, 1)} years for women and ${fixed(male, 1)} for men: ` +
      `${female >= male ? 'women' : 'men'} live ${fixed(Math.abs(female - male), 1)} years longer.`,
    chartAria: (country) => `Life expectancy of women and men in ${country} over time`,
  },
});

export default function HealthPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useMemo(() => SEXES.map((s) => `topics/${topic.id}/life-expectancy-${s.id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const [female, male] = loaded as IndicatorData[];
    const own = SEXES.map((_s, i) => loaded[i]!.values[iso3]);
    if (!own.every(Boolean)) return null;
    const index = latestIndexAtOrBefore(female.years, year, (i) => own.every((v) => v![i] != null));
    const indicator = topic.indicators.find((i) => i.id === 'life-expectancy')!;
    const option = timeSeriesOption({
      years: female.years,
      lines: SEXES.map((s, i) => ({ name: tr(s.label, lang), values: own[i]!, color: tokens.hues[s.hue] })),
      year,
      indicator,
      tokens,
    });
    return {
      option,
      shownYear: index >= 0 ? female.years[index] : null,
      female: index >= 0 ? own[0]![index]! : null,
      male: index >= 0 ? male.values[iso3]![index]! : null,
    };
  }, [loaded, iso3, year, topic, tokens, lang]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.shownYear !== null && view.female !== null && view.male !== null && (
        <p className="note">{text.summary(view.shownYear, view.female, view.male)}</p>
      )}
      <Chart spec={view.option} height={200} ariaLabel={text.chartAria(countryName)} />
    </section>
  );
}
