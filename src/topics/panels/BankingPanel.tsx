import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 銀行與信貸的側欄（2026-11-07，第二十五批 463）：這一國歷年的兩張折線——
 * 規模（私部門信貸、廣義貨幣占 GDP，看得出金融危機前的擴張與之後的緊縮），與體質（不良貸款、銀行資本占資產）。
 * 資料是 pipeline/topics/banking.py 輸出的 4 個指標檔
 */
const TEXT = defineMessages({
  zh: {
    size: '金融體系的規模（占 GDP）',
    credit: '私部門信貸',
    money: '廣義貨幣',
    health: '銀行的體質',
    npl: '不良貸款占總貸款',
    capital: '資本占資產',
    none: '這個國家沒有資料。',
  },
  en: {
    size: 'Size of the financial system (% of GDP)',
    credit: 'Private credit',
    money: 'Broad money',
    health: 'Bank soundness',
    npl: 'Non-performing loans',
    capital: 'Capital to assets',
    none: 'No data for this country.',
  },
});

const FILES = ['private-credit', 'broad-money', 'npl', 'capital'];

export default function BankingPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const paths = useMemo(() => FILES.map((f) => `topics/${topic.id}/${f}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);

  const charts = useMemo(() => {
    if (!loaded.every(Boolean)) return undefined;
    const build = (pair: [number, number], names: [string, string], sparse: boolean) => {
      const [a, b] = pair.map((i) => loaded[i]!);
      const years = a.years.filter((y) => b.years.includes(y)).concat(b.years.filter((y) => !a.years.includes(y))).sort((x, y) => x - y);
      const pick = (d: IndicatorData) => years.map((y) => {
        const i = d.years.indexOf(y);
        return i < 0 ? null : (d.values[iso3]?.[i] ?? null);
      });
      const lines = [pick(a), pick(b)];
      const has = (i: number) => lines.some((v) => v[i] != null);
      const first = years.findIndex((_, i) => has(i));
      if (first < 0) return null;
      let last = years.length - 1;
      while (!has(last)) last--;
      return timeSeriesOption({
        years: years.slice(first, last + 1),
        lines: [
          { name: names[0], values: lines[0].slice(first, last + 1), color: tokens.hues.blue },
          { name: names[1], values: lines[1].slice(first, last + 1), color: tokens.hues.orange },
        ],
        year,
        indicator: topic.indicators.find((i) => i.id === FILES[pair[0]])!,
        tokens,
        sparse,
      });
    };
    return {
      size: build([0, 1], [text.credit, text.money], false),
      health: build([2, 3], [text.npl, text.capital], true),
    };
  }, [loaded, iso3, year, tokens, text, topic.indicators]);

  if (charts === undefined) return <p className="empty">{t.loading}</p>;
  return (
    <>
      <section className="panel-section">
        <h3>{text.size}</h3>
        {charts.size ? <Chart spec={charts.size} height={180} ariaLabel={text.size} /> : <p className="empty">{text.none}</p>}
      </section>
      <section className="panel-section">
        <h3>{text.health}</h3>
        {charts.health ? <Chart spec={charts.health} height={180} ariaLabel={text.health} /> : <p className="empty">{text.none}</p>}
      </section>
    </>
  );
}
