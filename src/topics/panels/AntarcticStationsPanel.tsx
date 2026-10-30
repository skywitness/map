import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { stationFacts, stationName, statusLabel } from '../antarctic-stations';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `${country}的南極研究站`,
    none: 'Wikidata 沒有這個國家經營的南極研究站。',
    note: '依 Wikidata 的經營者；運作中的跟 COMNAP 2024 年的名單核對過位置。',
  },
  en: {
    title: (country) => `Antarctic stations run by ${country}`,
    none: 'Wikidata lists no Antarctic station run by this country.',
    note: 'By Wikidata’s operator; operating stations were checked by position against COMNAP’s 2024 list.',
  },
});

export default function AntarcticStationsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/stations.json`);
  const rows = useMemo(
    () =>
      data
        ? decodePoints(data)
            .filter((p) => p.iso3 === iso3 || p.iso3b === iso3)
            .sort((a, b) => Number(a.s) - Number(b.s) || Number(b.sl) - Number(a.sl))
        : null,
    [data, iso3],
  );
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p, i) => {
            const name = stationName(p, lang);
            return (
              <li key={i}>
                <span className="plain-title">{name}</span>
                {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
                  <span className="plain-meta" translate="no">
                    {p.en}
                  </span>
                )}
                <span className="plain-meta">{[statusLabel(p.s), stationFacts(p)].filter(Boolean).join(' · ')}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
