import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { accidentDate, accidentName, deathsText, inesLabel, kindLabel, what } from '../nuclear-accidents';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的核子與輻射事故（${n} 起）`,
    none: '來源沒有這個國家的事故。',
    deaths: (text: string) => `死亡：${text}`,
    note: '依英文維基百科三篇條目整理，依日期排列；死亡人數列各方估計的範圍與出處。',
  },
  en: {
    title: (country, n) => `Nuclear and radiation accidents in ${country} (${n})`,
    none: 'The sources list no accident in this country.',
    deaths: (text) => `Deaths: ${text}`,
    note: 'Compiled from three English Wikipedia articles, by date; death tolls show the range of estimates and their sources.',
  },
});

export default function NuclearAccidentsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<PointsData>(`topics/${topic.id}/points.json`);
  const rows = useMemo(() => (data ? decodePoints(data).filter((p) => p.iso3 === iso3) : null), [data, iso3]);
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p, i) => {
            const name = accidentName(p);
            return (
              <li key={i}>
                <span className="plain-title">{name}</span>
                {lang === 'zh' && typeof p.en === 'string' && (
                  <span className="plain-meta" translate="no">
                    {p.en}
                  </span>
                )}
                <span className="plain-meta">{[accidentDate(p), inesLabel(p), kindLabel(p.k)].join(' · ')}</span>
                <span className="plain-meta">{what(p)}</span>
                <span className="plain-meta">{text.deaths(deathsText(p))}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
