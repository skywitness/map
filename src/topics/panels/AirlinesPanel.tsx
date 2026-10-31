import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { dataFolder, type PanelExtraProps } from '../types';

/** pipeline/topics/airlines.py 的 countries/<ISO3>.json：rows 是 [中文名, 英文名, 成立, 停業, IATA, ICAO, 國家航空] */
interface AirlinesData {
  fields: string[];
  rows: [string | null, string, number | null, number | null, string | null, string | null, number][];
}

const TEXT = defineMessages({
  zh: {
    operating: (country: string, year: number) => `${country}在 ${year} 年營運中的航空公司`,
    closed: (year: number) => `${year} 年以前停業的`,
    later: (year: number) => `${year} 年以後才成立的`,
    none: 'Wikidata 沒有這個國家的航空公司。',
    founded: (y: number) => `${y} 年成立`,
    foundedUnknown: '成立年份不詳',
    ceased: (y: number) => `${y} 年停業`,
    flag: '國家航空',
    note: '依 Wikidata；沒有停業日期、也沒有 IATA 或 ICAO 代碼的不列。',
  },
  en: {
    operating: (country, year) => `Airlines of ${country} operating in ${year}`,
    closed: (year) => `Closed before ${year}`,
    later: (year) => `Founded after ${year}`,
    none: 'Wikidata lists no airline for this country.',
    founded: (y) => `founded ${y}`,
    foundedUnknown: 'founding year unknown',
    ceased: (y) => `closed ${y}`,
    flag: 'flag carrier',
    note: 'From Wikidata; airlines with neither a closing date nor an IATA or ICAO code are not listed.',
  },
});

export default function AirlinesPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 沒有航空公司的國家沒有檔案（讀取失敗就當成沒有）
  const { data, error } = useJson<AirlinesData>(`topics/${dataFolder(topic)}/airlines/${iso3}.json`);
  const groups = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      // 成立年份不詳的營運中航空公司只算在最後一年（跟地圖的家數一樣）
      operating: rows.filter(([, , f, c]) => (f == null ? year >= 2026 : f <= year) && (c == null || c > year)),
      closed: rows.filter(([, , , c]) => c != null && c <= year),
      later: rows.filter(([, , f]) => f != null && f > year),
    };
  }, [data, year]);
  if (error) return <p className="empty">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const list = (rows: AirlinesData['rows']) => (
    <ul className="plain-list">
      {rows.map(([zh, en, founded, ceased, iata, icao, flag], i) => {
        const name = lang === 'zh' && zh ? zh : en;
        const codes = [iata, icao].filter(Boolean).join(' / ');
        const facts = [
          founded != null ? text.founded(founded) : text.foundedUnknown,
          ceased != null ? text.ceased(ceased) : null,
          codes || null,
          flag ? text.flag : null,
        ].filter(Boolean);
        return (
          <li key={i}>
            <span className="plain-title">{name}</span>
            {name !== en && (
              <span className="plain-meta" translate="no">
                {en}
              </span>
            )}
            <span className="plain-meta">{facts.join(' · ')}</span>
          </li>
        );
      })}
    </ul>
  );
  return (
    <section className="panel-section">
      <h3>{text.operating(countryName, year)}</h3>
      {list(groups.operating)}
      {groups.closed.length > 0 && (
        <>
          <h3>{text.closed(year)}</h3>
          {list(groups.closed)}
        </>
      )}
      {groups.later.length > 0 && (
        <>
          <h3>{text.later(year)}</h3>
          {list(groups.later)}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
