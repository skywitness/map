import { useMemo, useState } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { WorldPanelProps } from '../types';

/** chokepoints-monthly.json（pipeline/topics/chokepoints_monthly.py）：28 個咽喉每個月通過的貨船（IMF PortWatch） */
interface MonthlyFile {
  months: string[];
  partial: string[];
  last: string;
  points: Record<string, { zh: string; en: string; total: number[] } & Record<string, unknown>>;
}

/** 事件（只標在相關的咽喉）：巴拿馬 2023 年乾旱減少預約艙位、紅海攻擊後繞道好望角 */
const EVENTS: { month: string; ids: string[]; label: { zh: string; en: string } }[] = [
  { month: '2023-12', ids: ['chokepoint2'], label: { zh: '乾旱減班', en: 'Drought limits' } },
  { month: '2024-01', ids: ['chokepoint1', 'chokepoint4', 'chokepoint7'], label: { zh: '紅海繞航', en: 'Red Sea diversions' } },
];

const TEXT = defineMessages({
  zh: {
    intro: (last: string) =>
      `IMF PortWatch 用 AIS 推算每個月通過的貨船與油輪（貨櫃、乾散貨、雜貨、滾裝、油輪，不含小船），資料到 ${last}，最後一個月不完整。跟運河管理局的會計年度與船種不同，數字對不上。`,
    pick: '咽喉',
    chartAria: (name: string) => `${name}每個月通過的貨船`,
    yearTitle: '每年通過的艘數',
    year: '年',
    ships: '艘',
    partial: '（不完整）',
    unit: (v: number) => `${fixed(v, 0)} 艘`,
  },
  en: {
    intro: (last: string) =>
      `IMF PortWatch estimates monthly transits of cargo ships and tankers from AIS (container, dry bulk, general cargo, ro-ro and tankers; small vessels excluded). Data run to ${last}, so the last month is incomplete. Fiscal years and vessel types differ from the canal authorities’ figures, so they do not match.`,
    pick: 'Chokepoint',
    chartAria: (name: string) => `Monthly cargo ship transits through ${name}`,
    yearTitle: 'Transits per year',
    year: 'Year',
    ships: 'Ships',
    partial: ' (incomplete)',
    unit: (v: number) => `${fixed(v, 0)} ships`,
  },
});

export default function ChokepointsPanel({ topic, tokens }: WorldPanelProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<MonthlyFile>(`topics/${topic.id}/chokepoints-monthly.json`);
  const [id, setId] = useState('chokepoint1');

  const view = useMemo(() => {
    if (!data) return null;
    const p = data.points[id];
    if (!p) return null;
    const name = lang === 'zh' ? p.zh : p.en;
    const spec: ChartSpec = {
      x: {
        type: 'category',
        labels: data.months,
        showLabel: (i) => data.months[i].endsWith('-01') && Number(data.months[i].slice(0, 4)) % 2 === 1,
      },
      y: { format: (v) => fixed(v, 0), integer: true },
      series: [{ type: 'line', name, color: tokens.hues.blue, values: p.total, legend: false }],
      events: EVENTS.filter((e) => e.ids.includes(id)).map((e) => ({ x: data.months.indexOf(e.month), label: lang === 'zh' ? e.label.zh : e.label.en })),
      tooltip: (i) => ({
        head: data.months[i] + (data.partial.includes(data.months[i]) ? text.partial : ''),
        rows: [{ color: tokens.hues.blue, value: text.unit(p.total[i]), name }],
      }),
    };
    const years = [...new Set(data.months.map((m) => m.slice(0, 4)))];
    const rows = years.map((y) => ({
      y,
      n: data.months.reduce((s, m, i) => (m.startsWith(y) ? s + p.total[i] : s), 0),
      partial: data.partial.some((m) => m.startsWith(y)),
    }));
    const options = Object.entries(data.points)
      .map(([k, v]) => ({ k, name: lang === 'zh' ? v.zh : v.en }))
      .sort((a, b) => Number(a.k.replace('chokepoint', '')) - Number(b.k.replace('chokepoint', '')));
    return { spec, name, rows, options };
  }, [data, id, lang, tokens, text]);

  if (!data || !view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <p className="note">{text.intro(data.last)}</p>
      <label className="inline-select">
        {text.pick}{' '}
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {view.options.map((o) => (
            <option key={o.k} value={o.k}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <Chart spec={view.spec} height={180} ariaLabel={text.chartAria(view.name)} />
      <h3>{text.yearTitle}</h3>
      <table className="mini-table" aria-label={text.yearTitle}>
        <thead>
          <tr>
            <th scope="col">{text.year}</th>
            <th scope="col" className="num">
              {text.ships}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.y}>
              <th scope="row">
                {r.y}
                {r.partial ? text.partial : ''}
              </th>
              <td className="num">{fixed(r.n, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
