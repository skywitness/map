import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fieldName } from '../oldest-companies';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/oldest_companies.py 的 list.json：[成立年份, 英文名, 中文名, 產業, 國家] */
interface ListData {
  fields: string[];
  rows: [number, string, string | null, string, string][];
}

const TEXT = defineMessages({
  zh: {
    title: (country: string, year: number, n: number) => `${country}在 ${year} 年以前成立、還在營業的公司（${n} 家）`,
    none: '英文維基的表裡沒有這個國家 1700 年以前成立的公司。',
    founded: (y: number) => `${y} 年`,
    note: '依英文維基百科「List of oldest companies」，依成立年份排列。',
  },
  en: {
    title: (country, year, n) => `Companies in ${country} founded by ${year} and still in business (${n})`,
    none: 'The Wikipedia list has no company from this country founded before 1700.',
    founded: (y) => String(y),
    note: 'From English Wikipedia’s “List of oldest companies”, by founding year.',
  },
});

export default function OldestCompaniesPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<ListData>(`topics/${topic.id}/list.json`);
  const rows = useMemo(() => (data ? data.rows.filter((r) => r[4] === iso3 && r[0] <= year) : null), [data, iso3, year]);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <>
          <h3>{text.title(countryName, year, rows.length)}</h3>
          <ul className="plain-list">
            {rows.map(([founded, en, zh, field], i) => {
              const name = lang === 'zh' && zh ? zh : en;
              return (
                <li key={i}>
                  <span className="plain-title">{name}</span>
                  {name !== en && (
                    <span className="plain-meta" translate="no">
                      {en}
                    </span>
                  )}
                  <span className="plain-meta">{[text.founded(founded), fieldName(field)].filter(Boolean).join(' · ')}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
