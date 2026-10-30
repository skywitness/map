import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { racesText } from '../f1';
import type { PanelExtraProps, PointsData } from '../types';

/** champions-list.json：[年, 車手, 國籍] */
type Champion = [number, string, string];

const TEXT = defineMessages({
  zh: {
    champions: (country: string, n: number) => `${country}籍的車手冠軍（${n} 次）`,
    circuits: (country: string, n: number) => `${country}的賽道（${n} 條）`,
    noChampion: '還沒有這個國籍的車手拿過世界冠軍。',
    noCircuit: '這個國家沒有辦過 F1 分站。',
    note: '依 Jolpica-F1 的資料（CC BY-NC-SA 4.0，只准非商業使用）。',
  },
  en: {
    champions: (country, n) => `Drivers’ champions from ${country} (${n})`,
    circuits: (country, n) => `Circuits in ${country} (${n})`,
    noChampion: 'No driver of this nationality has won the world title.',
    noCircuit: 'This country has never hosted a Formula One race.',
    note: 'From Jolpica-F1 (CC BY-NC-SA 4.0, non-commercial use only).',
  },
});

export default function F1Panel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const [list, circuitsFile] = useJsonMany<unknown>([`topics/${topic.id}/champions-list.json`, `topics/${topic.id}/circuits.json`]);
  const circuits = useMemo(
    () =>
      circuitsFile
        ? decodePoints(circuitsFile as PointsData)
            .filter((p) => p.iso3 === iso3)
            .sort((a, b) => Number(b.n) - Number(a.n))
        : null,
    [circuitsFile, iso3],
  );
  if (!list || !circuits) return <p className="empty">{t.loading}</p>;
  const champions = (list as Champion[]).filter((c) => c[2] === iso3);
  // 同一位車手的冠軍併成一行：「漢米爾頓 2008、2014…」
  const byDriver = new Map<string, number[]>();
  for (const [year, name] of champions) byDriver.set(name, [...(byDriver.get(name) ?? []), year]);
  return (
    <section className="panel-section">
      <h3>{text.champions(countryName, champions.length)}</h3>
      {champions.length === 0 ? (
        <p className="empty">{text.noChampion}</p>
      ) : (
        <ul className="plain-list">
          {[...byDriver].map(([name, years]) => (
            <li key={name}>
              <span className="plain-title" translate="no">
                {name}
              </span>
              <span className="plain-meta">{years.join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
      <h3>{text.circuits(countryName, circuits.length)}</h3>
      {circuits.length === 0 ? (
        <p className="empty">{text.noCircuit}</p>
      ) : (
        <ul className="plain-list">
          {circuits.map((c, i) => (
            <li key={i}>
              <span className="plain-title" translate="no">
                {String(c.name)}
              </span>
              <span className="plain-meta">
                {racesText(Number(c.n))} · {c.first === c.last ? String(c.first) : `${c.first}–${c.last}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
