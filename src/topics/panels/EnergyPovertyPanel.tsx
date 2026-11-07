import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { GROUPS } from '../energy-poverty';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 能源貧窮的側欄（2026-11-07，第二十五批 525）：目前指標的全部、貧窮線以下、以上三條線（地圖用的同一組檔），
 * 看得出窮人跟其他人差多少
 */
const TEXT = defineMessages({
  zh: { title: '貧窮線以下與以上（歷年）', aria: (c: string) => `${c}貧窮線以下與以上的比例，歷年` },
  en: { title: 'Below and above the poverty line over time', aria: (c: string) => `${c}: below and above the poverty line over time` },
});
const HUES = ['inkSecondary', 'red', 'blue'] as const;

export default function EnergyPovertyPanel({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useJsonMany<IndicatorData>(GROUPS.map((g) => `topics/${topic.id}/${indicator.id}/${g.id}.json`));
  const option = useMemo(() => {
    if (!files.every(Boolean)) return null;
    const years = files[0]!.years;
    const lines = GROUPS.map((g, i) => ({
      name: tr(g.label, lang),
      values: files[i]!.values[iso3] ?? years.map(() => null),
      color: HUES[i] === 'inkSecondary' ? tokens.inkSecondary : tokens.hues[HUES[i] as 'red' | 'blue'],
    }));
    if (lines.every((l) => l.values.every((v) => v === null))) return null;
    return timeSeriesOption({ years, lines, year, indicator, tokens });
  }, [files, iso3, year, indicator, tokens, lang]);
  if (!option) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={option} height={220} ariaLabel={text.aria(countryName)} />
    </section>
  );
}
