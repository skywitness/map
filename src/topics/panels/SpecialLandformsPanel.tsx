import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { tr } from '../../i18n/lang';
import { decodePoints } from '../../map/overlayData';
import { KINDS } from '../special-landforms';
import type { PanelExtraProps, PointsData } from '../types';

/** 每一類一開始列出幾個，其他收在「顯示其餘」 */
const SHOWN = 8;

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的特殊地形（${n} 處）`,
    kind: (name: string, n: number) => `${name}（${n}）`,
    none: 'Wikidata 沒有這個國家的這幾類地形。',
    more: (n: number) => `顯示其餘 ${n} 處`,
    note: '依 Wikidata，每一類依維基百科條目數排列；Wikidata 收得多不多跟各國有沒有人整理有關。',
  },
  en: {
    title: (country, n) => `Landforms in ${country} (${n})`,
    kind: (name, n) => `${name} (${n})`,
    none: 'Wikidata lists none of these landforms in this country.',
    more: (n) => `Show ${n} more`,
    note: 'From Wikidata, each kind sorted by number of Wikipedia articles; coverage depends on who has catalogued what.',
  },
});

export default function SpecialLandformsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<PointsData>(`topics/${topic.id}/points.json`);
  const rows = useMemo(
    () => (data ? decodePoints(data).filter((p) => p.iso3 === iso3).sort((a, b) => Number(b.sl) - Number(a.sl)) : null),
    [data, iso3],
  );
  if (!rows) return <p className="empty">{t.loading}</p>;
  const name = (p: (typeof rows)[number]) => (lang === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.en ?? p.zh ?? ''));
  const item = (p: (typeof rows)[number], i: number) => {
    const shown = name(p);
    return (
      <li key={i}>
        <span className="plain-title">{shown}</span>
        {lang === 'zh' && typeof p.en === 'string' && p.en !== shown && (
          <span className="plain-meta" translate="no">
            {p.en}
          </span>
        )}
      </li>
    );
  };
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      {rows.length === 0 && <p className="empty">{text.none}</p>}
      {KINDS.map((k) => {
        const own = rows.filter((p) => p.k === k.value);
        if (!own.length) return null;
        return (
          <div key={k.value} className="panel-subsection">
            <h4>{text.kind(tr(k.plural), own.length)}</h4>
            <ul className="plain-list">{own.slice(0, SHOWN).map(item)}</ul>
            {own.length > SHOWN && (
              <details>
                <summary className="note">{text.more(own.length - SHOWN)}</summary>
                <ul className="plain-list">{own.slice(SHOWN).map(item)}</ul>
              </details>
            )}
          </div>
        );
      })}
      <p className="note">{text.note}</p>
    </section>
  );
}
