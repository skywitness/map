import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/brands.py 的 list/{item}.json：[維基百科的語言數, 英文名, 中文名, 創立年份, 國家]，依語言數排 */
interface ListData {
  fields: string[];
  rows: [number, string, string | null, number | null, string][];
}

const SHOWN = 40;

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}創立的品牌（${n} 個）`,
    none: 'Wikidata 裡沒有這個國家創立、還沒有停業的這類品牌。',
    founded: (y: number) => `${y} 年創立`,
    more: (n: number) => `還有 ${n} 個`,
    note: '依 Wikidata，依維基百科有幾種語言的條目排列（越前面越有名）。',
  },
  en: {
    title: (country, n) => `Brands founded in ${country} (${n})`,
    none: 'Wikidata has no current brand of this kind founded in this country.',
    founded: (y) => `founded ${y}`,
    more: (n) => `${n} more`,
    note: 'From Wikidata, ordered by how many Wikipedia language editions cover each brand.',
  },
});

export default function BrandsPanel({ topic, iso3, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<ListData>(`topics/${topic.id}/list/${item ?? 'fashion'}.json`);
  const rows = useMemo(() => (data ? data.rows.filter((r) => r[4] === iso3) : null), [data, iso3]);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <>
          <h3>{text.title(countryName, rows.length)}</h3>
          <ul className="plain-list">
            {rows.slice(0, SHOWN).map(([, en, zh, founded], i) => {
              const name = lang === 'zh' && zh ? zh : en;
              return (
                <li key={i}>
                  <span className="plain-title">{name}</span>
                  {name !== en && (
                    <span className="plain-meta" translate="no">
                      {en}
                    </span>
                  )}
                  {founded ? <span className="plain-meta">{text.founded(founded)}</span> : null}
                </li>
              );
            })}
          </ul>
          {rows.length > SHOWN && <p className="note">{text.more(rows.length - SHOWN)}</p>}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
