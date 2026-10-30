import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { festivalFacts, festivalName, nameIsOriginal } from '../festivals';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的節慶（${n} 個）`,
    none: 'Wikidata 與文資局的資料裡沒有這個國家的節慶。',
    note: '有月份的依月份排在前面，其他依維基百科條目數（比較有名的在前）。',
  },
  en: {
    title: (country, n) => `Festivals in ${country} (${n})`,
    none: 'Neither Wikidata nor the Taiwanese registry lists a festival here.',
    note: 'Festivals with a known month come first, by month; the rest by number of Wikipedia articles (best known first).',
  },
});

export default function FestivalsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const dated = useJson<PointsData>(`topics/${topic.id}/festivals.json`);
  const undated = useJson<PointsData>(`topics/${topic.id}/festivals-undated.json`);
  const rows = useMemo(() => {
    if (!dated.data || !undated.data) return null;
    const a = decodePoints(dated.data).filter((p) => p.iso3 === iso3).sort((x, y) => Number(x.m) - Number(y.m));
    const b = decodePoints(undated.data).filter((p) => p.iso3 === iso3).sort((x, y) => Number(y.sl) - Number(x.sl));
    return [...a, ...b];
  }, [dated.data, undated.data, iso3]);
  if (dated.error || undated.error) return <p className="empty">{t.loadFailed((dated.error ?? undated.error)!.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <>
          <h3>{text.title(countryName, rows.length)}</h3>
          <ul className="plain-list">
            {rows.slice(0, 300).map((p, i) => {
              const name = festivalName(p);
              return (
                <li key={i}>
                  {nameIsOriginal(p) ? (
                    <span className="plain-title" translate="no" lang="zh-Hant">
                      {name}
                    </span>
                  ) : (
                    <span className="plain-title">{name}</span>
                  )}
                  {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
                    <span className="plain-meta" translate="no">
                      {p.en}
                    </span>
                  )}
                  <span className="plain-meta">{festivalFacts(p)}</span>
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
