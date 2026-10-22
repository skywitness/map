import { useMemo } from 'react';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

const SEXES: { id: 'female' | 'male'; label: string; hue: Hue }[] = [
  { id: 'female', label: '女性', hue: 'orange' },
  { id: 'male', label: '男性', hue: 'blue' },
];

export default function HealthPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
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
      lines: SEXES.map((s, i) => ({ name: s.label, values: own[i]!, color: tokens.hues[s.hue] })),
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
  }, [loaded, iso3, year, topic, tokens]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>男女平均壽命</h3>
      {view.shownYear !== null && view.female !== null && view.male !== null && (
        <p className="note">
          {view.shownYear} 年女性 {fixed(view.female, 1)} 歲、男性 {fixed(view.male, 1)} 歲，
          {view.female >= view.male ? '女性' : '男性'}多 {fixed(Math.abs(view.female - view.male), 1)} 歲。
        </p>
      )}
      <EChart option={view.option} height={200} ariaLabel={`${countryName}歷年男女平均壽命`} />
    </section>
  );
}
