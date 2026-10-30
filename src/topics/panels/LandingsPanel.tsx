import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { OUTCOMES } from '../landings';
import type { PanelExtraProps } from '../types';

/** list.json：[天體, 任務, 國家, 日期, 結果] */
type Landing = ['moon' | 'mars', string, string[], string, number];

const TEXT = defineMessages({
  zh: {
    moon: (country: string, n: number) => `${country}的登月任務（${n} 次）`,
    mars: (country: string, n: number) => `${country}的火星任務（${n} 次）`,
    none: '這個國家沒有抵達月球或火星表面的任務。',
    note: '依英文維基百科「List of landings on extraterrestrial bodies」2026-08-31 的版本。',
  },
  en: {
    moon: (country, n) => `${country}’s Moon missions (${n})`,
    mars: (country, n) => `${country}’s Mars missions (${n})`,
    none: 'No mission from this country has reached the surface of the Moon or Mars.',
    note: 'From the English Wikipedia article “List of landings on extraterrestrial bodies” (31 August 2026).',
  },
});

export default function LandingsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<Landing[]>(`topics/${topic.id}/landings.json`);
  if (!data) return <p className="empty">{t.loading}</p>;
  const mine = data.filter((l) => l[2].includes(iso3));
  const list = (body: 'moon' | 'mars') => mine.filter((l) => l[0] === body);
  const section = (body: 'moon' | 'mars') => {
    const rows = list(body);
    if (rows.length === 0) return null;
    return (
      <>
        <h3>{text[body](countryName, rows.length)}</h3>
        <ul className="plain-list">
          {rows.map((l, i) => (
            <li key={i}>
              <span className="plain-title" translate="no">
                {l[1]}
              </span>
              <span className="plain-meta">
                {l[3]} · {tr(OUTCOMES[l[4]], lang)}
              </span>
            </li>
          ))}
        </ul>
      </>
    );
  };
  return (
    <section className="panel-section">
      {mine.length === 0 ? <p className="empty">{text.none}</p> : <>{section('moon')}{section('mars')}</>}
      <p className="note">{text.note}</p>
    </section>
  );
}
