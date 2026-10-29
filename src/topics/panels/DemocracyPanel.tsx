import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 三項指數（id 跟 democracy.ts 的指標一致），線的顏色依圖表類別色的順序 */
const INDICES: { id: string; label: Text; hue: Hue }[] = [
  { id: 'electoral-democracy', label: { zh: '選舉民主', en: 'Electoral democracy' }, hue: 'blue' },
  { id: 'liberal-democracy', label: { zh: '自由民主', en: 'Liberal democracy' }, hue: 'orange' },
  { id: 'free-expression', label: { zh: '言論自由', en: 'Freedom of expression' }, hue: 'aqua' },
];

const TEXT = defineMessages({
  zh: {
    title: '三項指數對照',
    interval: (year: number, parts: string[]) =>
      `${year} 年的估計值與 68% 可信區間：${parts.join('、')}。區間重疊的國家，高低不一定有意義。`,
    part: (label: string, value: string, low: string, high: string) => `${label} ${value}（${low}–${high}）`,
    chartAria: (country: string) => `${country}歷年的選舉民主、自由民主與言論自由指數`,
  },
  en: {
    title: 'The three indices compared',
    interval: (year, parts) =>
      `Estimates for ${year} with 68% credible intervals: ${parts.join('; ')}. Where intervals overlap, countries may not really differ.`,
    part: (label, value, low, high) => `${label.toLowerCase()} ${value} (${low}–${high})`,
    chartAria: (country) => `Electoral democracy, liberal democracy and freedom of expression indices in ${country} over time`,
  },
});

const index = (v: number) => fixed(v, 2);

export default function DemocracyPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  // 每項指數三個檔：估計值、68% 可信區間的下限與上限（pipeline/topics/democracy.py 的 intervals/）
  const files = useMemo(
    () =>
      INDICES.flatMap((d) => [
        `topics/${topic.id}/${d.id}.json`,
        `topics/${topic.id}/intervals/${d.id}-low.json`,
        `topics/${topic.id}/intervals/${d.id}-high.json`,
      ]),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    const main = INDICES.map((_d, i) => loaded[i * 3]);
    if (!main.every(Boolean)) return null;
    const own = main.map((d) => d!.values[iso3]);
    if (!own.every(Boolean)) return null;
    const years = main[0]!.years;
    const indicator = topic.indicators.find((i) => i.id === 'electoral-democracy')!;
    const base = timeSeriesOption({
      years,
      lines: INDICES.map((d, i) => ({ name: tr(d.label, lang), values: own[i]!, color: tokens.hues[d.hue] })),
      year,
      indicator,
      tokens,
    });
    // 固定 0–1，各國的圖才能互相比較（圖例放不下一列時自己換行，Chart.tsx）
    const option: ChartSpec = { ...base, y: { ...base.y, min: 0, max: 1 } };

    // 可信區間：三項指數都有值的最近一年（不晚於時間軸的年份）
    let interval: string | null = null;
    const at = latestIndexAtOrBefore(years, year, (i) => own.every((s) => s![i] != null));
    const bounds = INDICES.map((_d, i) => [loaded[i * 3 + 1]?.values[iso3]?.[at], loaded[i * 3 + 2]?.values[iso3]?.[at]]);
    if (at >= 0 && bounds.every(([lo, hi]) => lo != null && hi != null)) {
      interval = text.interval(
        years[at],
        INDICES.map((d, i) => text.part(tr(d.label, lang), index(own[i]![at]!), index(bounds[i][0]!), index(bounds[i][1]!))),
      );
    }
    return { option, interval };
  }, [loaded, iso3, year, topic, tokens, lang, text]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      {view.interval && <p className="note">{view.interval}</p>}
    </section>
  );
}
