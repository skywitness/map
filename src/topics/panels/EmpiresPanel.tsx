import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { COLONIZER_NAMES, yearBare, yearText, type CountriesFile } from '../empires';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/empires.py 的 countries.json（今天的國土在各取樣年份屬於哪些政體，連續相同的合併：
 * [起, 迄, 政體的英文名稱, 占國土的 %]）與 colonial.json（COLDAT：[殖民國, mean 起, mean 迄, max 起, max 迄,
 * 只有部分地區, 自己補的]）
 */
interface ColonialFile {
  countries: Record<string, [string, number | null, number | null, number | null, number | null, number, number][]>;
}

const TEXT = defineMessages({
  zh: {
    history: (name: string) => `今天的${name}歷代屬於誰`,
    none: '這個國家的範圍在 Cliopatria 裡沒有畫在任何政體裡。',
    share: (p: number) => `約 ${p}%`,
    shown: '時間軸的這一年',
    colonial: '殖民時期（COLDAT）',
    noColonial: '不是 COLDAT 收錄的 8 個歐洲殖民國的殖民地。',
    range: (a: string, b: string) => `${a}–${b}`,
    maxRange: (a: string, b: string) => `最寬的說法 ${a}–${b}`,
    partial: '部分地區',
    added: '自己補的',
    note: '取樣的年份（西元前每 100 年、1800 年以前每 50 年、之後每 5 年）之間的變化看不到，相鄰的取樣年份是同一個政體就合成一段；占今天國土不到 3% 的不列。點一段換到那一年。',
  },
  en: {
    history: (name) => `Who held today’s ${name}`,
    none: 'No polity in Cliopatria covers this country’s territory.',
    share: (p) => `about ${p}%`,
    shown: 'Year shown',
    colonial: 'Colonial rule (COLDAT)',
    noColonial: 'Not a colony of the eight European powers in COLDAT.',
    range: (a, b) => `${a}–${b}`,
    maxRange: (a, b) => `widest dating ${a}–${b}`,
    partial: 'part of the territory',
    added: 'added here',
    note: 'Changes between snapshots (every 100 years BCE, every 50 years until 1800 and every 5 years after) are not visible; consecutive snapshots with the same polity are merged into one span. Polities covering less than 3% of today’s territory are not listed. Click a span to jump to that year.',
  },
});

export default function EmpiresPanel({ topic, iso3, year, countryName, selectYear }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<CountriesFile>(`topics/${topic.id}/countries.json`);
  const colonial = useJson<ColonialFile>(`topics/${topic.id}/colonial.json`).data;
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const spans = data.countries[iso3] ?? [];
  const name = (n: string) => (lang === 'en' ? n : (data.names[n] ?? n));
  const col = colonial?.countries[iso3] ?? [];
  const yr = (y: number | null) => (y === null ? '?' : yearBare(y));

  return (
    <>
      <section className="panel-section">
        <h3>{text.history(countryName)}</h3>
        {spans.length === 0 ? (
          <p className="note">{text.none}</p>
        ) : (
          <ol className="eclipse-list">
            {spans.map(([a, b, n, share], i) => {
              const current = a <= year && year <= b;
              return (
                <li key={`${a}-${n}-${i}`}>
                  <button
                    type="button"
                    className={`eclipse-row${current ? ' is-picked' : ''}`}
                    aria-pressed={current}
                    onClick={() => selectYear?.(a)}
                  >
                    <span />
                    <span className="eclipse-date">{name(n)}</span>
                    <span className="eclipse-kind">{share < 95 ? text.share(share) : ''}</span>
                    <span className="stat-meta">
                      <span>{a === b ? yearText(a) : text.range(yr(a), yearText(b))}</span>
                      {current && <span className="year-tag is-shown">{text.shown}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section className="panel-section">
        <h3>{text.colonial}</h3>
        {col.length === 0 ? (
          <p className="note">{text.noColonial}</p>
        ) : (
          <ul className="plain-list">
            {col.map(([c, a, b, maxA, maxB, partial, added]) => (
              <li key={c}>
                <span className="plain-title">
                  {(COLONIZER_NAMES[c] ?? { zh: c, en: c })[lang]} {text.range(yr(a), yr(b))}
                </span>
                <span className="plain-meta">
                  {[
                    (maxA !== a || maxB !== b) && text.maxRange(yr(maxA), yr(maxB)),
                    partial ? text.partial : null,
                    added ? text.added : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="note">{text.note}</p>
      </section>
    </>
  );
}
