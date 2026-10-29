import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MONTHS } from '../months';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/birth_season.py 的 months.json：每國有資料的年份、每年 1–12 月的每日平均出生數、是否依登記月份 */
interface MonthsFile {
  countries: Record<string, { years: number[]; daily: number[][]; registration: number[] }>;
}

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家逐月的出生數。',
    title: (year: number) => `${year} 年每個月的出生數（每日平均）`,
    aria: (country: string, year: number) => `${country}${year} 年每個月每日平均的出生數`,
    perDay: (v: string) => `${v} 人／天`,
    peak: (month: string, pct: string) => `最多的是 ${month}，比全年平均多 ${pct}。`,
    registration: '這一年是依登記日期的月份，不是出生日期（出生後一段時間內登記，會跟著假期移動）。',
    years: (first: number, last: number) => `有 ${first}–${last} 年中的資料；拖動時間軸看其他年份。`,
  },
  en: {
    noCountry: 'No monthly birth figures for this country.',
    title: (year) => `Births by month, ${year} (daily average)`,
    aria: (country, year) => `Average births per day in each month in ${country}, ${year}`,
    perDay: (v) => `${v} a day`,
    peak: (month, pct) => `${month} is highest, ${pct} above the yearly average.`,
    registration: 'This year counts births by month of registration, not of birth (registration happens some time after birth and shifts with holidays).',
    years: (first, last) => `Data for years between ${first} and ${last}; drag the timeline for other years.`,
  },
});

export default function BirthSeasonPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<MonthsFile>(`topics/${topic.id}/months.json`);
  const row = data?.countries[iso3];

  const view = useMemo(() => {
    if (!row) return null;
    const i = latestIndexAtOrBefore(row.years, year, () => true);
    if (i < 0) return null;
    const daily = row.daily[i];
    const mean = daily.reduce((a, b) => a + b, 0) / 12;
    const peak = daily.indexOf(Math.max(...daily));
    return {
      shown: row.years[i],
      registration: row.registration[i] === 1,
      items: daily.map((v, m) => ({ key: String(m + 1), label: tr(MONTHS[m].label, lang), value: v, color: MONTHS[m].color })),
      peak: tr(MONTHS[peak].label, lang),
      above: ((daily[peak] - mean) / mean) * 100,
    };
  }, [row, year, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  if (!row || !view) return <p className="empty">{text.noCountry}</p>;

  // 小國每天不到 10 個出生，寫到小數一位
  const small = Math.max(...view.items.map((i) => i.value)) < 10;
  return (
    <section className="panel-section">
      <h3>
        {text.title(view.shown)}
        {view.shown !== year && <span className="muted">{t.yearMissing(year)}</span>}
      </h3>
      <BarList
        items={view.items}
        format={(v) => text.perDay(fixed(v, small ? 1 : 0))}
        ariaLabel={text.aria(countryName, view.shown)}
      />
      <p className="note">{text.peak(view.peak, `${fixed(view.above, 1)}%`)}</p>
      {view.registration && <p className="note">{text.registration}</p>}
      <p className="note">{text.years(row.years[0], row.years[row.years.length - 1])}</p>
    </section>
  );
}
