import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodeLines } from '../../map/overlayData';
import { CURRENT, airlineName, routeFacts, routeTitle } from '../longest-flights';
import type { LinesData, PanelExtraProps, PointRecord } from '../types';

const TEXT = defineMessages({
  zh: {
    current: (country: string, n: number) => `在${country}起降的最長航線（現行前 30 名，${n} 條）`,
    old: (country: string, n: number) => `停飛的前 30 名（${country}，${n} 條）`,
    none: '現行前 30 名沒有在這個國家起降的航線。',
    note: '依英文維基百科「Longest flights」2026-10-15 的版本，依大圓距離排列。',
  },
  en: {
    current: (country, n) => `Longest routes serving ${country} (today’s top 30: ${n})`,
    old: (country, n) => `Discontinued top 30 (${country}: ${n})`,
    none: 'No route in today’s top 30 serves this country.',
    note: 'From the English Wikipedia article “Longest flights” (15 October 2026), by great-circle distance.',
  },
});

export default function LongestFlightsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<LinesData>(`topics/${topic.id}/routes.json`);
  const rows = useMemo(() => {
    if (!data) return null;
    const records = decodeLines(data).records ?? [];
    return records.filter((r) => r.ai === iso3 || r.bi === iso3).sort((a, b) => Number(b.km) - Number(a.km));
  }, [data, iso3]);
  if (!rows) return <p className="empty">{t.loading}</p>;
  const current = rows.filter((r) => r.t === CURRENT);
  const old = rows.filter((r) => r.t !== CURRENT);
  const item = (p: PointRecord, i: number) => (
    <li key={i}>
      <span className="plain-title">{routeTitle(p)}</span>
      <span className="plain-meta">
        <span translate={lang === 'zh' ? undefined : 'no'}>{airlineName(p.airline)}</span> {p.no}
      </span>
      {routeFacts(p).map((line, j) => (
        <span key={j} className="plain-meta">
          {line}
        </span>
      ))}
    </li>
  );
  return (
    <section className="panel-section">
      <h3>{text.current(countryName, current.length)}</h3>
      {current.length === 0 ? <p className="empty">{text.none}</p> : <ul className="plain-list">{current.map(item)}</ul>}
      {old.length > 0 && (
        <>
          <h3>{text.old(countryName, old.length)}</h3>
          <ul className="plain-list">{old.map(item)}</ul>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
