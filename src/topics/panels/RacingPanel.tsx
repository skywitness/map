import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { AS_OF, dateText, roundText, seriesOf, statusText } from '../racing';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';
import F1Panel from './F1Panel';

/** F1 的 2 個指標（f1.ts）：側欄照舊列冠軍與賽道 */
const F1_INDICATORS = new Set(['races', 'champions']);

const TEXT = defineMessages({
  zh: {
    season: (country: string, n: number) => `${country}今年的賽程（${n} 場）`,
    venues: (country: string, n: number) => `${country}辦過的地點（${n} 個）`,
    noSeason: '今年沒有這些賽事在這個國家比。',
    noVenue: '沒有辦過這些賽事。',
    stages: (a: string, b: string) => `第 ${a}${a === b ? '' : `–${b}`} 賽段`,
    times: (n: number) => `${n} 次`,
    note: `今年的賽程到 ${AS_OF.zh}，整理自英文維基百科的賽季條目（CC BY-SA 4.0）；名稱照英文原文。`,
  },
  en: {
    season: (country, n) => `2026 calendar in ${country} (${n})`,
    venues: (country, n) => `Venues in ${country} (${n})`,
    noSeason: 'None of these events is held here this year.',
    noVenue: 'Has not hosted these events.',
    stages: (a, b) => (a === b ? `stage ${a}` : `stages ${a}–${b}`),
    times: (n) => `${n} ${n === 1 ? 'time' : 'times'}`,
    note: `Calendar to ${AS_OF.en}, compiled from English Wikipedia season articles (CC BY-SA 4.0).`,
  },
});

/** 一個國家的一場：一般賽事是一站，環賽是經過這個國家的賽段併成一行 */
interface Row {
  key: string;
  d0: number;
  d1: number;
  title: string;
  meta: string;
  name: string;
  done: boolean;
}

function seasonRows(points: PointRecord[], iso3: string, text: (typeof TEXT)['zh']): Row[] {
  const rows: Row[] = [];
  const tours = new Map<number, PointRecord[]>();
  for (const p of points) {
    if (p.iso3 !== iso3) continue;
    if (p.from != null) {
      const code = Number(p.s);
      tours.set(code, [...(tours.get(code) ?? []), p]);
      continue;
    }
    rows.push({
      key: `${p.s}-${p.rnd}`,
      d0: Number(p.d0),
      d1: Number(p.d1),
      title: roundText(p),
      meta: `${dateText(Number(p.d0), Number(p.d1))} · ${[p.venue, p.place && !String(p.venue).includes(String(p.place)) ? p.place : null].filter(Boolean).join(', ')} · ${statusText(p)}`,
      name: typeof p.name === 'string' ? p.name : '',
      done: Boolean(p.done),
    });
  }
  for (const [code, stages] of tours) {
    stages.sort((a, b) => Number(a.d0) - Number(b.d0));
    const first = stages[0];
    const last = stages[stages.length - 1];
    rows.push({
      key: `tour-${code}`,
      d0: Number(first.d0),
      d1: Number(last.d0),
      title: `${tr(seriesOf(code)?.label ?? { zh: '', en: '' })} ${text.stages(String(first.rnd), String(last.rnd))}`,
      meta: `${dateText(Number(first.d0), Number(last.d0))} · ${[...new Set(stages.map((p) => String(p.venue)))].join(', ')} · ${statusText(last)}`,
      name: '',
      done: Boolean(last.done),
    });
  }
  return rows.sort((a, b) => a.d0 - b.d0);
}

export default function RacingPanel(props: PanelExtraProps) {
  if (F1_INDICATORS.has(props.indicator.id)) return <F1Panel {...props} />;
  return <RacingList {...props} />;
}

function RacingList({ topic, indicator, iso3, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const venues = indicator.id === 'venues';
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/${venues ? 'venues' : 'season'}/${item ?? 'all'}.json`);
  const points = useMemo(() => (data ? decodePoints(data) : null), [data]);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!points) return <p className="empty">{t.loading}</p>;
  if (venues) {
    const here = points.filter((p) => p.iso3 === iso3).sort((a, b) => Number(b.n) - Number(a.n));
    return (
      <section className="panel-section">
        <h3>{text.venues(countryName, here.length)}</h3>
        {here.length === 0 ? (
          <p className="empty">{text.noVenue}</p>
        ) : (
          <ul className="plain-list">
            {here.map((p, i) => (
              <li key={i}>
                <span className="plain-title" translate="no">
                  {String(p.name)}
                </span>
                <span className="plain-meta">
                  {typeof p.mix === 'string'
                    ? p.mix
                        .split('|')
                        .map((x) => {
                          const [code, n] = x.split(':');
                          return `${tr(seriesOf(code)?.short ?? { zh: '', en: '' })} ${text.times(Number(n))}`;
                        })
                        .join(' · ')
                    : `${tr(seriesOf(p.s)?.short ?? { zh: '', en: '' })} ${text.times(Number(p.n))}`}
                  {p.first != null && ` · ${p.first === p.last ? p.first : `${p.first}–${p.last}`}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  const rows = seasonRows(points, iso3, text);
  return (
    <section className="panel-section">
      <h3>{text.season(countryName, rows.length)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.noSeason}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((r) => (
            <li key={r.key} style={r.done ? { opacity: 0.75 } : undefined}>
              <span className="plain-title">{r.title}</span>
              {r.name && (
                <span className="plain-meta" translate="no">
                  {r.name}
                </span>
              )}
              <span className="plain-meta">{r.meta}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
