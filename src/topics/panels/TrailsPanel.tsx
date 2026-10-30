import { useEffect, useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { kmText, LEVELS, levelLabel, trailName } from '../trails';
import type { PanelExtraProps } from '../types';

/**
 * 長途步道的側欄：經過這個國家的路線（依在這國的長度排），滑過或點一下在地圖上標出那條路線。
 * 讀 routes.json（pipeline/topics/trails.py）：[編號, 名稱, 英文名, 中文名, 代號, 等級, 全長, [[國家, 長度], …]]
 */

const SHOWN = 40;

interface RoutesFile {
  fields: string[];
  rows: [number, string | null, string | null, string | null, string | null, number, number | null, [string, number][]][];
}

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `經過${country}的路線（${n} 條）`,
    none: 'OSM 沒有經過這裡、標成國際級或國家級的步道路線。',
    inCountry: (here: string, all: string) => `在這裡 ${here}（全長 ${all}）`,
    also: (list: string) => `也經過${list}`,
    more: (n: number) => `還有 ${n} 條比較短的路線沒有列出`,
    note: '依在這個國家的長度排；滑過路線在地圖上標出來。',
    sep: '、',
  },
  en: {
    title: (country, n) => `Routes through ${country} (${n})`,
    none: 'No international or national hiking routes pass through here in OSM.',
    inCountry: (here, all) => `${here} here (${all} in all)`,
    also: (list) => `Also through ${list}`,
    more: (n) => `${n} shorter routes not listed`,
    note: 'Sorted by length in this country; hover over a route to show it on the map.',
    sep: ', ',
  },
});

export default function TrailsPanel({ topic, iso3, countryName, highlightLine }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<RoutesFile>(`topics/${topic.id}/routes.json`);
  const countries = useJson<CountryTable>('countries.json').data;
  useEffect(() => () => highlightLine?.('trails', null), [iso3, highlightLine]);
  const rows = useMemo(() => {
    if (!data) return null;
    return data.rows
      .map((r) => ({ r, here: r[7].find(([c]) => c === iso3)?.[1] ?? 0 }))
      .filter((x) => x.here > 0)
      .sort((a, b) => b.here - a.here);
  }, [data, iso3]);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows || !countries) return <p className="empty">{t.loading}</p>;
  if (rows.length === 0) return <p className="empty">{text.none}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, rows.length)}</h3>
      <ol className="river-systems">
        {rows.slice(0, SHOWN).map(({ r, here }) => {
          const [g, n, e, z, ref, type, km, through] = r;
          const name = trailName({ n, e, z, ref });
          const others = through.filter(([c]) => c !== iso3).map(([c]) => nameOf(c, countries));
          const show = () => highlightLine?.('trails', g);
          const hide = () => highlightLine?.('trails', null);
          return (
            <li key={g}>
              <button type="button" className="river-system" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClick={show}>
                <span className="bar-key" style={{ background: LEVELS.find((l) => l.value === type)?.color }} />
                <span className="river-system-name" translate={lang === 'en' && name !== e ? 'no' : undefined}>
                  {name}
                </span>
                <span className="stat-meta">
                  {levelLabel(type)} · {text.inCountry(kmText(here), km !== null ? kmText(km) : '—')}
                </span>
                {others.length > 0 && <span className="stat-meta">{text.also(others.slice(0, 8).join(text.sep))}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {rows.length > SHOWN && <p className="note">{text.more(rows.length - SHOWN)}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
