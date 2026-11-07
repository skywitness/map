import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 製造業的產能利用率（2026-11-07，第二十五批 447）：側欄畫這一國逐季的線，跟 EU27 對照
 * （capacity-quarterly.json，pipeline/topics/industry_productivity.py）
 */
interface QuarterlyFile {
  quarters: string[];
  values: Record<string, (number | null)[]>;
  eu: (number | null)[];
}

const TEXT = defineMessages({
  zh: {
    title: '逐季的產能利用率',
    eu: '歐盟 27 國',
    aria: (name: string) => `${name}與歐盟逐季的產能利用率`,
    note: '季節調整後的值。2009 年第 2 季歐盟掉到 69.9%，2020 年第 2 季 67.3%。',
    none: '這個國家沒有參加歐盟執委會的企業調查。',
  },
  en: {
    title: 'Capacity utilisation by quarter',
    eu: 'EU27',
    aria: (name: string) => `Quarterly capacity utilisation, ${name} and the EU`,
    note: 'Seasonally adjusted. The EU fell to 69.9% in Q2 2009 and 67.3% in Q2 2020.',
    none: 'This country is not covered by the European Commission’s business survey.',
  },
});

export function CapacityQuarterly({ topic, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<QuarterlyFile>(`topics/${topic.id}/capacity-quarterly.json`);
  const spec = useMemo<ChartSpec | null>(() => {
    const own = data?.values[iso3];
    if (!data || !own) return null;
    const first = own.findIndex((v) => v != null);
    const labels = data.quarters.slice(first);
    const lines = [
      { name: countryName, color: tokens.hues.blue, values: own.slice(first) },
      { name: text.eu, color: tokens.inkMuted, values: data.eu.slice(first), dashed: true },
    ];
    return {
      x: { type: 'category', labels, showLabel: (i) => labels[i].endsWith('Q1') && Number(labels[i].slice(0, 4)) % 5 === 0 },
      y: { format: (v) => `${fixed(v, 0)}%`, zero: false },
      series: lines.map((l) => ({ type: 'line' as const, ...l })),
      endLabels: true,
      tooltip: (i) => ({
        head: labels[i].replace('-', ' '),
        rows: lines.flatMap((l) => (l.values[i] == null ? [] : [{ color: l.color, name: l.name, value: `${fixed(l.values[i]!, 1)}%` }])),
      }),
    };
  }, [data, iso3, countryName, tokens, text.eu]);
  if (!data) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {spec ? <Chart spec={spec} height={200} ariaLabel={text.aria(countryName)} /> : <p className="empty">{text.none}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
