import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { monthShort, monthText, projectName, viewsText, wikiName } from '../reads';
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

/** pipeline/topics/reads_languages.py 的 langs/<ISO3>.json：每月讀的前 5 種語言 [代碼, %]、編輯者最多的前 8 個計畫 [計畫, 人] */
interface CountryLangs {
  read: Record<string, [string, number][]>;
  edit: Record<string, [string, number][]>;
}
const LANG_INDICATORS = new Set(['read-language', 'editors', 'editors-english', 'edit-language']);

const LANG_TEXT = defineMessages({
  zh: {
    read: (month: string) => `${month}讀哪幾種語言的維基百科`,
    readAria: (country: string) => `${country}的維基百科瀏覽次數依語言版本的比例`,
    edit: (month: string) => `${month}編輯者最多的計畫`,
    editAria: (country: string) => `${country}的維基媒體計畫依編輯者人數`,
    editNote: '各計畫的編輯者人數（含只編 1–4 次的），加了差分隱私的雜訊，太小的格子不公布；同一個人編好幾個計畫會各算一次。',
    none: '沒有公布的資料（人少、差分隱私的門檻，或在 Wikimedia 的保護名單上）。',
    shownInstead: (month: string) => `這個月沒有資料，顯示${month}。`,
  },
  en: {
    read: (month) => `Wikipedia language editions read, ${month}`,
    readAria: (country) => `Share of Wikipedia views in ${country} by language edition`,
    edit: (month) => `Projects with the most editors, ${month}`,
    editAria: (country) => `Wikimedia projects by number of editors in ${country}`,
    editNote: 'Editors per project (including those with only 1–4 edits), with differential-privacy noise and small cells suppressed; someone editing several projects counts once for each.',
    none: 'No published data (few users, the privacy threshold, or Wikimedia’s list of protected countries).',
    shownInstead: (month) => `No data this month; showing ${month}.`,
  },
});

/** 讀與寫的語言（2026-11-07，製作手冊第二十七批 558）：這一國讀哪些語言版本、編輯者在哪些計畫 */
function ReadsLanguages({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = LANG_TEXT[lang];
  const t = useT();
  const { data, error } = useJson<CountryLangs>(`topics/${topic.id}/langs/${iso3}.json`);
  if (error) return <p className="note">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  // 時間軸的月份沒有資料時用那之前最近的一個月（讀與寫的月份範圍不同）
  const pick = (by: Record<string, [string, number][]>) => {
    const months = Object.keys(by).map(Number).filter((m) => m <= year).sort((a, b) => b - a);
    const m = months[0] ?? Object.keys(by).map(Number).sort((a, b) => a - b)[0];
    return m === undefined ? null : { month: m, rows: by[String(m)] };
  };
  const read = pick(data.read);
  const edit = pick(data.edit);
  const readItems: BarListItem[] = (read?.rows ?? []).map(([code, share]) => ({ key: code, label: wikiName(code), value: share }));
  const editItems: BarListItem[] = (edit?.rows ?? []).map(([project, n]) => ({ key: project, label: projectName(project), value: n }));
  return (
    <>
      {read && (
        <section className="panel-section">
          <h3>{text.read(monthText(read.month))}</h3>
          {read.month !== year && <p className="note">{text.shownInstead(monthText(read.month))}</p>}
          <BarList
            items={readItems}
            format={(v) => `${fixed(v, v < 10 ? 1 : 0)}%`}
            max={100}
            ariaLabel={text.readAria(countryName)}
          />
        </section>
      )}
      {edit && (
        <section className="panel-section">
          <h3>{text.edit(monthText(edit.month))}</h3>
          {edit.month !== year && <p className="note">{text.shownInstead(monthText(edit.month))}</p>}
          <BarList items={editItems} format={(v) => fixed(v, 0)} ariaLabel={text.editAria(countryName)} />
          <p className="note">{text.editNote}</p>
        </section>
      )}
      {!read && !edit && <p className="note">{text.none}</p>}
    </>
  );
}

export default function ReadsPanel(props: PanelExtraProps) {
  return LANG_INDICATORS.has(props.indicator.id) ? <ReadsLanguages {...props} /> : <TopArticles {...props} />;
}

function TopArticles({ topic, iso3, year, selectYear }: PanelExtraProps) {
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
