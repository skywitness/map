import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { kindsText, railwayName, yearText } from '../heritage-railways';
import type { PanelExtraProps, PointsData } from '../types';

/** 一開始列出幾個，其他收在「顯示其餘」 */
const SHOWN = 12;

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的觀光鐵道與登山鐵路（${n} 條）`,
    none: 'Wikidata 沒有這個國家有座標的觀光鐵道或登山鐵路。',
    more: (n: number) => `顯示其餘 ${n} 條`,
    note: '依 Wikidata，依開通年份排列（年份不詳的在最後）；只列有座標的。',
  },
  en: {
    title: (country, n) => `Heritage and mountain railways in ${country} (${n})`,
    none: 'Wikidata lists no heritage or mountain railway with coordinates in this country.',
    more: (n) => `Show ${n} more`,
    note: 'From Wikidata, by opening year (unknown years last); only railways with coordinates.',
  },
});

export default function HeritageRailwaysPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useJsonMany<PointsData>([`topics/${topic.id}/lines.json`, `topics/${topic.id}/lines-undated.json`]);
  const rows = useMemo(() => {
    if (files.some((f) => !f)) return null;
    return files
      .flatMap((f) => decodePoints(f as PointsData))
      .filter((p) => p.iso3 === iso3)
      .sort((a, b) => (Number(a.y) || 9999) - (Number(b.y) || 9999));
  }, [files, iso3]);
  if (!rows) return <p className="empty">{t.loading}</p>;
  const item = (p: (typeof rows)[number], i: number) => {
    const name = railwayName(p, lang);
    return (
      <li key={i}>
        <span className="plain-title">{name}</span>
        {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
          <span className="plain-meta" translate="no">
            {p.en}
          </span>
        )}
        <span className="plain-meta">{[kindsText(p), yearText(p)].join(' · ')}</span>
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
