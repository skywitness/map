import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { RELATED } from '../olympics';
import type { PanelExtraProps } from '../types';

/** countries/<鍵>.json（pipeline/topics/olympics.py）：季節 → [[年, 金, 銀, 銅], …]（只有得牌的那幾屆） */
type CountryFile = Partial<Record<'summer' | 'winter', [number, number, number, number][]>>;

/** 一開始列出幾屆，其他收在「顯示其餘」 */
const SHOWN = 10;
const SEP = { zh: '、', en: ', ' };
const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    title: (season: string) => `歷屆${season}的獎牌`,
    games: '奧運',
    gold: '金',
    silver: '銀',
    bronze: '銅',
    total: '合計',
    summary: (n: number, g: number, s: number, b: number) => `${n} 屆得牌，共 ${n0(g + s + b)} 面（金 ${n0(g)}、銀 ${n0(s)}、銅 ${n0(b)}）。`,
    best: (year: number, total: number) => `最多的一屆：${year} 年 ${n0(total)} 面。`,
    none: (season: string) => `${season}沒有得過獎牌。`,
    more: (n: number) => `顯示其餘 ${n} 屆`,
    relatedTeams: (names: string) => `另外的歷史隊伍（不算在這裡）：${names}。`,
    successors: (names: string) => `今天對應的國家：${names}。`,
    note: '依維基百科各屆的獎牌榜，年份是奧運舉辦的年份（2020 年東京奧運在 2021 年舉行）。',
  },
  en: {
    title: (season) => `Medals at the ${season}`,
    games: 'Games',
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
    total: 'Total',
    summary: (n, g, s, b) => `Medals at ${n} Games, ${n0(g + s + b)} in all (${n0(g)} gold, ${n0(s)} silver, ${n0(b)} bronze).`,
    best: (year, total) => `Best Games: ${year}, ${n0(total)} medals.`,
    none: (season) => `No medals at the ${season}.`,
    more: (n) => `Show ${n} more`,
    relatedTeams: (names) => `Separate historical teams (not counted here): ${names}.`,
    successors: (names) => `Today: ${names}.`,
    note: 'From the Wikipedia medal tables; years are the Olympic years (the Tokyo 2020 Games were held in 2021).',
  },
});

const SEASON = { summer: { zh: '夏季奧運', en: 'Summer Games' }, winter: { zh: '冬季奧運', en: 'Winter Games' } };

export default function OlympicsPanel({ topic, iso3, year, item }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const season = item === 'winter' ? 'winter' : 'summer';
  const index = useJson<string[]>(`topics/${topic.id}/countries/index.json`);
  const listed = index.data?.includes(iso3) ?? false;
  const country = useJson<CountryFile>(listed ? `topics/${topic.id}/countries/${iso3}.json` : null);
  const countries = useJson<CountryTable>('countries.json').data;
  // 換國家時不能拿上一個國家的資料來顯示
  const data = listed && !country.loading ? country.data : null;

  const rows = useMemo(() => (data?.[season] ?? []).filter((r) => r[0] <= year).reverse(), [data, season, year]);
  const related = (RELATED[iso3] ?? []).map((k) => nameOf(k, countries, lang)).join(tr(SEP, lang));

  if (index.error) return <p className="empty">{t.loadFailed(index.error.message)}</p>;
  if (!index.data || (listed && !data)) return <p className="empty">{t.loading}</p>;

  const seasonName = tr(SEASON[season], lang);
  const sum = (i: number) => rows.reduce((a, r) => a + r[i], 0);
  const best = rows.reduce<[number, number, number, number] | null>((b, r) => (!b || r[1] + r[2] + r[3] > b[1] + b[2] + b[3] ? r : b), null);
  const row = (r: [number, number, number, number]) => (
    <tr key={r[0]}>
      <td>{r[0]}</td>
      <td className="num">{r[1]}</td>
      <td className="num">{r[2]}</td>
      <td className="num">{r[3]}</td>
      <td className="num">{r[1] + r[2] + r[3]}</td>
    </tr>
  );
  const head = (
    <thead>
      <tr>
        <th scope="col">{text.games}</th>
        <th scope="col" className="num">{text.gold}</th>
        <th scope="col" className="num">{text.silver}</th>
        <th scope="col" className="num">{text.bronze}</th>
        <th scope="col" className="num">{text.total}</th>
      </tr>
    </thead>
  );

  return (
    <section className="panel-section">
      <h3>{text.title(seasonName)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none(seasonName)}</p>
      ) : (
        <>
          <p className="panel-year-note">
            {text.summary(rows.length, sum(1), sum(2), sum(3))} {best && text.best(best[0], best[1] + best[2] + best[3])}
          </p>
          <table className="mini-table">
            {head}
            <tbody>{rows.slice(0, SHOWN).map(row)}</tbody>
          </table>
          {rows.length > SHOWN && (
            <details>
              <summary className="note">{text.more(rows.length - SHOWN)}</summary>
              <table className="mini-table">
                <tbody>{rows.slice(SHOWN).map(row)}</tbody>
              </table>
            </details>
          )}
        </>
      )}
      {related && <p className="note">{iso3.startsWith('_') ? text.successors(related) : text.relatedTeams(related)}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
