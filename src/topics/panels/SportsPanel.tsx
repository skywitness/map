import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import type { PanelExtraProps, PointsData } from '../types';
import OlympicsPanel from './OlympicsPanel';

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的奧運比賽場館（${n} 個）`,
    none: '這個國家沒有辦過這一季的奧運。',
    planned: '（預定）',
    note: '整理自英文維基百科各屆奧運的場館條目（CC BY-SA 4.0）；名稱照英文原文，國家依今天的國界。',
  },
  en: {
    title: (country, n) => `Olympic venues in ${country} (${n})`,
    none: 'This country has not hosted these Games.',
    planned: ' (planned)',
    note: 'From the English Wikipedia articles on each Games’ venues (CC BY-SA 4.0); countries follow today’s borders.',
  },
});

/** 運動的側欄：比賽場館列這國用過的場館，其他指標列這國歷屆的奧運獎牌 */
export default function SportsPanel(props: PanelExtraProps) {
  return props.indicator.id === 'venues' ? <VenuesList {...props} /> : <OlympicsPanel {...props} />;
}

function VenuesList({ topic, iso3, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/venues/${item === 'winter' ? 'winter' : 'summer'}.json`);
  const rows = useMemo(
    () => (data ? decodePoints(data).filter((p) => p.iso3 === iso3).sort((a, b) => Number(a.first) - Number(b.first)) : null),
    [data, iso3],
  );
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p, i) => (
            <li key={i}>
              <span className="plain-title" translate="no">
                {String(p.name)}
              </span>
              <span className="plain-meta">
                {String(p.ed ?? '')
                  .split(',')
                  .map((y) => (Number(y) >= 2027 ? `${y}${text.planned}` : y))
                  .join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
