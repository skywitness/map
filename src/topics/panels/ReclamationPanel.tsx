import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { cityArea, cityName } from '../reclamation';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}研究涵蓋的沿海城市（${n} 個）`,
    none: '這個國家沒有人口百萬以上的沿海城市在研究裡。',
    note: '2000–2020 年的填海面積（公頃，括號是誤差），依面積排列。只算人口百萬以上的沿海城市。',
  },
  en: {
    title: (country, n) => `Coastal cities studied in ${country} (${n})`,
    none: 'None of this country’s coastal cities of over a million people are in the study.',
    note: 'Land reclaimed 2000–2020 (hectares, error in brackets), largest first. Only coastal cities of over a million people are covered.',
  },
});

export default function ReclamationPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<PointsData>(`topics/${topic.id}/cities.json`);
  const rows = useMemo(
    () => (data ? decodePoints(data).filter((p) => p.iso3 === iso3).sort((a, b) => (Number(b.a) || 0) - (Number(a.a) || 0)) : null),
    [data, iso3],
  );
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p, i) => {
            const name = cityName(p);
            return (
              <li key={i}>
                <span className="plain-title">{name}</span>
                {lang === 'zh' && typeof p.name === 'string' && p.name !== name && (
                  <span className="plain-meta" translate="no">
                    {p.name}
                  </span>
                )}
                <span className="plain-meta">{cityArea(p)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
