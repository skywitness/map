import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 產品市場管制的側欄（2026-11-07，第二十五批 469）：這一國 2023 年的九個主要分數跟 56 國的中位數（各檔的 aggregates.MED）並列，
 * 高於中位數的標出來。資料是 pipeline/topics/market_regulation.py 輸出的
 */
const ROWS: { file: string; label: { zh: string; en: string } }[] = [
  { file: 'pmr/total', label: { zh: '總分', en: 'Overall' } },
  { file: 'pmr/state', label: { zh: '國家介入造成的扭曲', en: 'State involvement' } },
  { file: 'pmr/entry', label: { zh: '進入市場的障礙', en: 'Barriers to entry' } },
  { file: 'state/scope', label: { zh: '公營事業的範圍', en: 'Scope of public ownership' } },
  { file: 'state/governance', label: { zh: '公營事業的治理', en: 'Governance of SOEs' } },
  { file: 'state/business', label: { zh: '政府介入企業經營', en: 'Involvement in business' } },
  { file: 'entry/startup', label: { zh: '開公司的行政負擔', en: 'Start-up burden' } },
  { file: 'entry/fdi', label: { zh: '外資限制', en: 'Barriers to FDI' } },
  { file: 'sector/retail', label: { zh: '零售業', en: 'Retail distribution' } },
];

const TEXT = defineMessages({
  zh: {
    title: '2023 年的分數與中位數',
    head: ['指標', '這一國', '中位數'],
    none: '這個國家不在 OECD 的產品市場管制指標裡。',
    note: '0–6 分，越高管制越多；粗體是高於 56 國中位數的。',
  },
  en: {
    title: '2023 scores against the median',
    head: ['Measure', 'Country', 'Median'],
    none: 'This country is not covered by the OECD product market regulation indicators.',
    note: 'Scores from 0 to 6; higher means more regulation. Bold marks scores above the median of the 56.',
  },
});

export default function MarketRegulationPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const paths = useMemo(() => ROWS.map((r) => `topics/${topic.id}/${r.file}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);

  const rows = useMemo(() => {
    if (!loaded.every(Boolean)) return undefined;
    return ROWS.map((r, i) => {
      const d = loaded[i]!;
      const at = d.years.indexOf(2023);
      return { label: tr(r.label, lang), value: d.values[iso3]?.[at] ?? null, median: d.aggregates?.MED?.[at] ?? null };
    }).filter((r) => r.median != null);
  }, [loaded, iso3, lang]);

  if (rows === undefined) return <p className="empty">{t.loading}</p>;
  const has = rows.some((r) => r.value != null);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {has ? (
        <>
          <table className="mini-table" aria-label={text.title}>
            <thead>
              <tr>
                {text.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td style={{ fontWeight: r.value != null && r.value > r.median! ? 700 : 400 }}>
                    {r.value == null ? '—' : fixed(r.value, 2)}
                  </td>
                  <td>{fixed(r.median!, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.note}</p>
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );
}
