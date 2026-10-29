import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { monthShort, monthText, viewsText, wikiName } from '../reads';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/reads.py 的 countries/<ISO3>.json：articles 是這國上榜過的條目 [原文標題, 維基百科的語言代碼,
 * 中文名稱, 英文名稱]（名稱來自 Wikidata，跟原文一樣或沒有是 null），months 是每個月（2000 年 1 月起的第幾個月）的
 * 前 10 名 [articles 的索引, 瀏覽次數]
 */
type Article = [string, string, string | null, string | null];
interface CountryReads {
  articles: Article[];
  months: Record<string, [number, number][]>;
}
/** 一列：[原文標題, 語言, 瀏覽次數, 中文名稱, 英文名稱] */
type Row = [string, string, number, string | null, string | null];

const TEXT = defineMessages({
  zh: {
    title: (month: string) => `${month}讀最多的條目`,
    none: '這個月沒有公布的瀏覽量（人少或差分隱私的門檻）。',
    noCountry: '沒有公布的瀏覽量：人口少的國家常常全部低於差分隱私的門檻。',
    history: '每個月的第一名',
    note: '瀏覽次數是那個月每天公布的數字相加（加了差分隱私的雜訊）。名稱是原文，中文、英文名稱來自 Wikidata。點「每個月的第一名」裡的月份可以換到那個月。',
  },
  en: {
    title: (month) => `Most-read articles, ${month}`,
    none: 'No published views this month (small population or the privacy threshold).',
    noCountry: 'No published views: in countries with few readers every page falls below the privacy threshold.',
    history: 'Top article each month',
    note: 'Views are the sum of the published daily counts for the month (with differential-privacy noise). Titles are as written in each Wikipedia; Chinese and English names come from Wikidata. Click a month under “Top article each month” to switch to it.',
  },
});

export default function ReadsPanel({ topic, iso3, year, selectYear }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<CountryReads>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="note">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const rowsOf = (m: number): Row[] =>
    (data.months[String(m)] ?? []).map(([i, views]) => {
      const [title, wiki, zh, en] = data.articles[i];
      return [title, wiki, views, zh, en];
    });
  const rows = rowsOf(year);
  const max = rows[0]?.[2] ?? 1;
  const name = (r: Row) => (lang === 'en' ? r[4] : r[3]) ?? r[0];
  // 沒有目前語言的名稱時寫原文：標上原文的語言（日文、中文的字形不同），也不是要翻譯的介面文字
  const label = (r: Row) => {
    const own = lang === 'en' ? r[4] : r[3];
    return own ? (
      own
    ) : (
      <span translate="no" lang={r[1]}>
        {r[0]}
      </span>
    );
  };
  const months = Object.keys(data.months).map(Number).sort((a, b) => b - a);

  return (
    <>
      <section className="panel-section">
        <h3>{text.title(monthText(year))}</h3>
        {rows.length === 0 ? (
          <p className="note">{text.none}</p>
        ) : (
          <ol className="bar-list reads-list">
            {rows.map((r, i) => (
              <li key={`${r[1]}:${r[0]}`}>
                <span className="bar-label">
                  <span className="reads-rank">{i + 1}</span>
                  {label(r)}
                </span>
                <span className="bar-value">{viewsText(r[2])}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(r[2] / max) * 100}%` }} />
                </span>
                <span className="reads-meta">
                  {wikiName(r[1])}
                  {name(r) !== r[0] && (
                    <>
                      {' · '}
                      <span translate="no" lang={r[1]}>
                        {r[0]}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="panel-section">
        <h3>{text.history}</h3>
        <dl className="reads-history">
          {months.map((m) => {
            const first = rowsOf(m)[0];
            return (
              <div key={m} className={m === year ? 'is-current' : undefined}>
                <dt>
                  <button type="button" className="eclipse-more" onClick={() => selectYear?.(m)}>
                    {monthShort(m)}
                  </button>
                </dt>
                <dd>{first ? label(first) : '—'}</dd>
              </div>
            );
          })}
        </dl>
        <p className="note">{text.note}</p>
      </section>
    </>
  );
}
