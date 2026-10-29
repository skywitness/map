import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { decodePoints } from '../../map/Overlays';
import { iucnLabel, parkFacts, parkName } from '../national-parks';
import type { PanelExtraProps, PointsData } from '../types';

/** 一開始列出幾個，其他收在「顯示其餘」 */
const SHOWN = 12;

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的國家公園（${n} 座）`,
    none: 'Wikidata 沒有這個國家的國家公園。',
    more: (n: number) => `顯示其餘 ${n} 座`,
    note: '依 Wikidata，依設立年份排列；各國對「國家公園」的定義不同。',
  },
  en: {
    title: (country, n) => `National parks in ${country} (${n})`,
    none: 'Wikidata lists no national park in this country.',
    more: (n) => `Show ${n} more`,
    note: 'From Wikidata, by year established; countries define “national park” differently.',
  },
});

export default function NationalParksPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useJsonMany<PointsData>([`topics/${topic.id}/parks.json`, `topics/${topic.id}/parks-undated.json`]);
  const rows = useMemo(() => {
    if (files.some((f) => !f)) return null;
    return files
      .flatMap((f) => decodePoints(f as PointsData))
      .filter((p) => p.iso3 === iso3)
      .sort((a, b) => (Number(a.y) || 9999) - (Number(b.y) || 9999));
  }, [files, iso3]);
  if (!rows) return <p className="empty">{t.loading}</p>;
  const item = (p: (typeof rows)[number], i: number) => {
    const name = parkName(p, lang);
    return (
      <li key={i}>
        <span className="plain-title">{name}</span>
        {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
          <span className="plain-meta" translate="no">
            {p.en}
          </span>
        )}
        <span className="plain-meta">{[parkFacts(p), iucnLabel(p.c)].join(' · ')}</span>
      </li>
    );
  };
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <>
          <ul className="plain-list">{rows.slice(0, SHOWN).map(item)}</ul>
          {rows.length > SHOWN && (
            <details>
              <summary className="note">{text.more(rows.length - SHOWN)}</summary>
              <ul className="plain-list">{rows.slice(SHOWN).map(item)}</ul>
            </details>
          )}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
