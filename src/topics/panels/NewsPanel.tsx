import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { eventsText, isoOf, kindsText, linkText, placesOf, type NewsFile } from '../news';
import type { PanelExtraProps } from '../types';

/**
 * 此刻世界的新聞熱點的側欄：這個國家最近 15 分鐘的新聞事件，依地點列出種類與原始新聞的連結（GDELT 的 SOURCEURL）。
 * 新聞是各媒體的，只列網域與連結，另開分頁。
 */

/** 列出的地點數、每個地點的連結數 */
const PLACES_SHOWN = 30;
const LINKS_SHOWN = 5;

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: string) => `${country}最近 15 分鐘的新聞事件（${n}）`,
    none: '這 15 分鐘的新聞裡沒有這個國家的事件。',
    loading: '正在讀 GDELT 的最新一批事件…',
    countryOnly: '只寫到國家',
    colon: '：',
    more: (n: number) => `還有 ${n} 個地點沒有列出`,
    note: '依地點列出，事件多的在前；連結是 GDELT 抽出事件的原始新聞（各媒體的網站，另開分頁），同一則新聞常抽出好幾個事件。',
  },
  en: {
    title: (country, n) => `News events in ${country}, last 15 minutes (${n})`,
    none: 'No events here in these 15 minutes of news.',
    loading: 'Reading the latest batch of GDELT events…',
    countryOnly: 'country only',
    colon: ': ',
    more: (n) => `${n} more places not listed`,
    note: 'Listed by place, busiest first. Links go to the original articles GDELT extracted the events from (publishers’ sites, opening in a new tab); one article often yields several events.',
  },
});

export default function NewsPanel({ iso3, countryName, live }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const file = live && typeof live === 'object' && Array.isArray((live as NewsFile).events) ? (live as NewsFile) : null;
  const places = useMemo(() => (file ? placesOf(file).filter((p) => isoOf(p.fips) === iso3) : null), [file, iso3]);
  if (!places) return <p className="empty">{live === null ? text.loading : t.loading}</p>;
  if (places.length === 0) return <p className="empty">{text.none}</p>;
  const total = places.reduce((s, p) => s + p.events.length, 0);
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, eventsText(total))}</h3>
      <ul className="plain-list">
        {places.slice(0, PLACES_SHOWN).map((p) => (
          <li key={p.key}>
            <span className="plain-title" translate="no">
              {p.place}
            </span>
            <span className="plain-meta">
              {eventsText(p.events.length)}
              {text.colon}
              {kindsText(p.kinds)}
              {p.countryOnly && ` · ${text.countryOnly}`}
            </span>
            {p.urls.slice(0, LINKS_SHOWN).map((u) => (
              <a key={u} className="plain-meta" href={u} target="_blank" rel="noopener noreferrer" translate="no">
                {linkText(u)}
              </a>
            ))}
          </li>
        ))}
      </ul>
      {places.length > PLACES_SHOWN && <p className="note">{text.more(places.length - PLACES_SHOWN)}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
