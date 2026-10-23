import { useMemo } from 'react';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

// 平均與中位數（市場匯率、2025 年價格的美元）放在同一張圖：差距越大，財富越集中
const LINES: { id: 'mean-wealth' | 'median-wealth'; label: Text; hue: Hue }[] = [
  { id: 'mean-wealth', label: { zh: '平均', en: 'Average' }, hue: 'blue' },
  { id: 'median-wealth', label: { zh: '中位數', en: 'Median' }, hue: 'orange' },
];

const TEXT = defineMessages({
  zh: {
    title: '財富的平均與中位數',
    summary: (year: number, mean: string, median: string, ratio: number) =>
      `${year} 年每位成年人平均 ${mean}，中位數 ${median}，平均是中位數的 ${fixed(ratio, 1)} 倍。` +
      '平均會被少數富豪拉高，中位數是排在正中間的人；兩者差越多，財富越集中在少數人手上。',
    chartAria: (country: string) => `${country}歷年每位成年人財富的平均與中位數`,
  },
  en: {
    title: 'Average and median wealth',
    summary: (year, mean, median, ratio) =>
      `In ${year} the average adult wealth was ${mean} and the median ${median}, so the average was ${fixed(ratio, 1)} times the median. ` +
      'The average is pulled up by the richest few while the median is the person in the middle; the bigger the gap, the more concentrated wealth is.',
    chartAria: (country) => `Average and median wealth per adult in ${country} over time`,
  },
});

export default function WealthPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useMemo(() => LINES.map((l) => `topics/${topic.id}/${l.id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const [meanData] = loaded as IndicatorData[];
    const own = LINES.map((_l, i) => loaded[i]!.values[iso3]);
    if (!own.every(Boolean)) return null;
    const indicator = topic.indicators.find((i) => i.id === 'mean-wealth')!;
    const option = timeSeriesOption({
      years: meanData.years,
      lines: LINES.map((l, i) => ({ name: tr(l.label, lang), values: own[i]!, color: tokens.hues[l.hue] })),
      year,
      indicator,
      tokens,
    });
    const index = latestIndexAtOrBefore(meanData.years, year, (i) => own.every((v) => v![i] != null && v![i]! > 0));
    const [mean, median] = index >= 0 ? own.map((v) => v![index]!) : [null, null];
    return {
      option,
      summary:
        mean !== null && median !== null
          ? text.summary(meanData.years[index], indicator.format(mean), indicator.format(median), mean / median)
          : null,
    };
  }, [loaded, iso3, year, topic, tokens, lang, text]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.summary && <p className="note">{view.summary}</p>}
      <EChart option={view.option} height={200} ariaLabel={text.chartAria(countryName)} />
    </section>
  );
}
