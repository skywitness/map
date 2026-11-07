import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import type { PanelExtraProps } from '../types';

/**
 * 獨立紀念日的側欄（2026-11-07，製作手冊 560）：這一國在表上的每一個紀念日。
 * pipeline/topics/independence.py 的 details.json：countries[ISO3] = [紀念的事件（英文原文）, 月-日, 年, 從誰獨立（英文）[]]
 */
interface Details {
  countries: Record<string, [string, string | null, number | null, string[]][]>;
  rulersZh: Record<string, string>;
}

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `${country}的獨立紀念日`,
    date: (md: string | null, year: number | null) =>
      [year ? `${year} 年` : '', md ? `${Number(md.slice(0, 2))} 月 ${Number(md.slice(3))} 日` : ''].filter(Boolean).join(' '),
    from: (names: string) => `從${names}`,
    sep: '、',
    none: '不在英文維基百科的獨立紀念日列表上（國慶日不一定是獨立紀念日）。',
    taiwan: '表上的台灣是臺灣光復節（1945 年日本統治結束），那是統治結束、不是獨立，所以地圖不上色；中華民國國慶日是 10 月 10 日，紀念 1911 年武昌起義。',
    note: '紀念日的名稱照英文維基百科的原文；已經不存在的國家照原文，不換成今天的繼承國。',
  },
  en: {
    title: (country) => `Independence days of ${country}`,
    date: (md, year) =>
      [md ? new Date(Date.UTC(2000, Number(md.slice(0, 2)) - 1, Number(md.slice(3)))).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '', year ? String(year) : '']
        .filter(Boolean)
        .join(' '),
    from: (names) => `from ${names}`,
    sep: ', ',
    none: 'Not on English Wikipedia’s list of independence days (a national day is not always an independence day).',
    taiwan: 'The list gives Taiwan’s Retrocession Day (the end of Japanese rule in 1945), which marks the end of colonial rule rather than independence, so Taiwan is not coloured; the Republic of China’s National Day is 10 October, marking the 1911 Wuchang Uprising.',
    note: 'Names of the commemorations are as written in English Wikipedia; states that no longer exist are kept as written rather than mapped to today’s successors.',
  },
});

export default function IndependencePanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<Details>(`topics/${topic.id}/details.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const rows = data.countries[iso3] ?? [];
  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map(([event, md, year, rulers], i) => (
            <li key={i}>
              <span className="plain-title" translate="no">
                {event}
              </span>
              <span className="plain-meta">
                {[
                  text.date(md, year),
                  rulers.length ? text.from(rulers.map((r) => (lang === 'zh' ? (data.rulersZh[r] ?? r) : r)).join(text.sep)) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {iso3 === 'TWN' && <p className="note">{text.taiwan}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
