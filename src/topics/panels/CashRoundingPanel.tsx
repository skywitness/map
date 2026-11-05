import { defineMessages, tr, useLang } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { CASH_STEPS } from '../cash-rounding';
import type { PanelExtraProps } from '../types';

/** cash-rounding-detail.json（pipeline/topics/prices_cash_rounding.py）：[開始年, 結束年, 級距]，開始年 null 是條目沒寫 */
interface Detail {
  revid: number;
  countries: Record<string, { periods: [number | null, number | null, number][]; how: string | null }>;
}

const SHORT: Record<number, string> = { 1: '5', 2: '10', 3: '0.25', 4: '0.50', 5: '1', 6: '1,000' };

const TEXT = defineMessages({
  zh: {
    title: '付現金時湊整：各國的開始年份',
    country: '國家或地區',
    step: '湊到',
    since: '開始',
    unknown: '沒寫',
    ended: (end: number) => `（到 ${end} 年）`,
    note: '依英文維基「Cash rounding」整理；「湊到 5」是 5 個最小單位（0.05 元、5 福林…）。條目沒寫開始年份的排在最後。',
    aria: '各國付現金時湊整的級距與開始年份',
  },
  en: {
    title: 'Cash rounding: when each country started',
    country: 'Country or territory',
    step: 'To',
    since: 'Since',
    unknown: 'n/a',
    ended: (end: number) => ` (until ${end})`,
    note: 'Compiled from the Wikipedia article “Cash rounding”; “5” means 5 minor units (0.05, 5 forints…). Countries with no start year in the article are listed last.',
    aria: 'Cash rounding interval and start year by country',
  },
});

export default function CashRoundingPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const detail = useJson<Detail>(`topics/${topic.dataTopic ?? topic.id}/cash-rounding-detail.json`).data;
  const countries = useJson<CountryTable>('countries.json').data;
  if (!detail) return null;
  // 每個國家最後一段（現在的級距；克羅埃西亞是已經結束的那一段）
  const rows = Object.entries(detail.countries)
    .map(([code, { periods }]) => {
      const last = periods[periods.length - 1];
      const first = periods.find(([start]) => start !== null)?.[0] ?? null;
      return { code, step: last[2], since: last[0], end: last[1], first };
    })
    .sort((a, b) => (a.first ?? 9999) - (b.first ?? 9999) || a.code.localeCompare(b.code));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <thead>
          <tr>
            <th scope="col">{text.country}</th>
            <th scope="col" className="num">{text.step}</th>
            <th scope="col" className="num">{text.since}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className={r.code === iso3 ? 'is-current' : undefined}>
              <th scope="row" title={tr(CASH_STEPS.find((c) => c.value === r.step)?.label ?? '', lang)}>
                {nameOf(r.code, countries, lang)}
              </th>
              <td className="num">{SHORT[r.step]}</td>
              <td className="num">
                {r.since ?? text.unknown}
                {r.end !== null && text.ended(r.end)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
