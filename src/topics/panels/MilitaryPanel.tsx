import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { flowSelection } from '../../map/flows';
import type { FlowFile, PanelExtraProps } from '../types';

/**
 * 軍事主題的側欄（海外軍事基地的兩個指標才有）：這個國家在哪些國家有軍事基地、哪些國家在這裡有軍事基地，
 * 讀流向檔（pipeline/topics/overseas_bases.py），有爭議或要說明的組合（克里米亞…）寫在國名後面。
 */

const BASES_INDICATORS = new Set(['bases-abroad', 'foreign-bases']);

const TEXT = defineMessages({
  zh: {
    abroad: (country: string, n: number) => `${country}在 ${n} 個國家有軍事基地`,
    hosted: (country: string, n: number) => `${n} 個國家在${country}有軍事基地`,
    none: (country: string) => `列表上沒有${country}在國外的軍事基地，也沒有外國在這裡的軍事基地。`,
    note: '依英文維基百科的列表（2026 年 10 月 23 日的版本），依列表上的順序。',
    listSep: '、',
  },
  en: {
    abroad: (country, n) => `${country} has military bases in ${n} ${n === 1 ? 'country' : 'countries'}`,
    hosted: (country, n) => `${n} ${n === 1 ? 'country has' : 'countries have'} military bases in ${country}`,
    none: (country) => `The list shows no military bases of ${country} abroad and no foreign bases in it.`,
    note: 'From the English Wikipedia list (revision of 23 October 2026), in the order listed there.',
    listSep: ', ',
  },
});

export default function MilitaryPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const shown = BASES_INDICATORS.has(indicator.id);
  const flows = useJson<FlowFile>(shown ? `topics/${topic.id}/bases-flows.json` : null);
  const countries = useJson<CountryTable>(shown ? 'countries.json' : null).data;
  const lists = useMemo(() => {
    if (!flows.data) return null;
    return (['export', 'import'] as const).map((direction) => {
      const sel = flowSelection(flows.data!, iso3, direction);
      return {
        direction,
        rows: sel.links.map((l) => ({ iso3: l.iso3, note: sel.notes?.[l.iso3]?.[lang === 'en' ? 1 : 0] })),
      };
    });
  }, [flows.data, iso3, lang]);
  if (!shown) return null;
  if (flows.error) return <p className="empty">{t.loadFailed(flows.error.message)}</p>;
  if (!lists || !countries) return <p className="empty">{t.loading}</p>;
  // 目前的指標那個方向放前面
  const ordered = indicator.id === 'foreign-bases' ? [lists[1], lists[0]] : lists;
  if (ordered.every((l) => l.rows.length === 0)) {
    return (
      <section className="panel-section">
        <p className="empty">{text.none(countryName)}</p>
      </section>
    );
  }
  return (
    <section className="panel-section">
      {ordered
        .filter((l) => l.rows.length > 0)
        .map(({ direction, rows }) => (
          <div key={direction}>
            <h3>{direction === 'export' ? text.abroad(countryName, rows.length) : text.hosted(countryName, rows.length)}</h3>
            <ul className="plain-list">
              {rows.map((r) => (
                <li key={r.iso3}>
                  <span className="plain-title">{nameOf(r.iso3, countries)}</span>
                  {r.note && <span className="plain-meta">{r.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      <p className="note">{text.note}</p>
    </section>
  );
}
