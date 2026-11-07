import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 重分配與貧窮的側欄（2026-11-07，第二十五批 449）：這一國市場所得與可支配所得兩條吉尼線，中間的差距就是重分配。
 * 資料檔是 gini/market.json、gini/disposable.json（pipeline/topics/redistribution.py）
 */
const TEXT = defineMessages({
  zh: {
    title: '稅前與稅後的吉尼係數',
    market: '市場所得',
    disposable: '可支配所得',
    summary: (year: number, m: string, d: string) => `${year} 年：市場所得 ${m}，稅與移轉之後 ${d}，降了 ${fixed(Number(m) - Number(d), 3)}。`,
    none: '這個國家沒有 OECD 的所得分配資料。',
  },
  en: {
    title: 'Gini before and after taxes and transfers',
    market: 'Market income',
    disposable: 'Disposable income',
    summary: (year: number, m: string, d: string) => `${year}: market income ${m}, after taxes and transfers ${d}, a fall of ${fixed(Number(m) - Number(d), 3)}.`,
    none: 'No OECD income distribution data for this country.',
  },
});

const FILES = ['gini/market', 'gini/disposable'];

export default function RedistributionPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const paths = useMemo(() => FILES.map((f) => `topics/${topic.id}/${f}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);
  const indicator = topic.indicators.find((i) => i.id === 'gini')!;

  const chart = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const years = loaded[0]!.years;
    const own = loaded.map((d) => d!.values[iso3]);
    const has = (i: number) => own.some((v) => v?.[i] != null);
    const first = years.findIndex((_, i) => has(i));
    if (first < 0) return { option: null, summary: '' };
    const last = years.length - 1 - [...years].reverse().findIndex((_, i) => has(years.length - 1 - i));
    const option = timeSeriesOption({
      years: years.slice(first, last + 1),
      lines: [
        { name: text.market, values: (own[0] ?? []).slice(first, last + 1), color: tokens.hues.orange },
        { name: text.disposable, values: (own[1] ?? []).slice(first, last + 1), color: tokens.hues.blue },
      ],
      year,
      indicator,
      tokens,
      sparse: true,
    });
    let shown = -1;
    for (let i = first; i <= last && years[i] <= year; i++) if (own.every((v) => v?.[i] != null)) shown = i;
    const summary = shown < 0 ? '' : text.summary(years[shown], fixed(own[0]![shown]!, 3), fixed(own[1]![shown]!, 3));
    return { option: { ...option, y: { ...option.y, zero: false } }, summary };
  }, [loaded, iso3, year, indicator, tokens, text]);

  if (!chart) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {chart.option ? (
        <>
          {chart.summary && <p className="note">{chart.summary}</p>}
          <Chart spec={chart.option} height={180} ariaLabel={text.title} />
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );
}
