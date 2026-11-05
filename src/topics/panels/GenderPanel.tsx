import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import { LEAVE_INDICATORS } from '../gender';
import type { IndicatorData, PanelExtraProps } from '../types';

/** leave-detail.json（pipeline/topics/gender.py 的 build_leave()） */
interface LeaveDetail {
  year: number;
  /** WBL 2024：[母親, 父親, 共用]（天） */
  parental: Record<string, [number, number, number]>;
  oecdYear: number;
  /** OECD PF2.1：母親、父親可請的有薪假週數與全薪等值週數 */
  oecd: Record<string, { motherWeeks: number; motherFre: number; fatherWeeks: number; fatherFre: number }>;
  /** WBL 2026 年版：[母親可請的有薪假合計, 父親的]（天，新方法、含育嬰假） */
  wbl2026: Record<string, [number | null, number | null]>;
}

const TEXT = defineMessages({
  zh: {
    title: '育嬰假的細節',
    split: (year: number, m: string, f: string, s: string) => `${year} 年的育嬰假：母親 ${m} 天、父親 ${f} 天、兩人共用 ${s} 天。`,
    oecd: (year: number, mw: string, mf: string, fw: string, ff: string) =>
      `OECD 換算（${year} 年 4 月的制度）：母親可請的有薪假合計 ${mw} 週、相當於全薪 ${mf} 週；父親專屬的 ${fw} 週、相當於全薪 ${ff} 週。`,
    wbl2026: (m: string, f: string) =>
      `世界銀行 2026 年版（新方法，2025 年 10 月 1 日的法律）：母親可請的有薪假合計 ${m} 天、父親 ${f} 天（含育嬰假，跟地圖上的天數不能直接比）。`,
    note: '全薪等值週數是有薪假的週數乘上平均給付比例（以全職平均薪資的人計算），給付高的國家換算後比較長，最能跨國比較，但只有 OECD 與歐盟 43 國。',
  },
  en: {
    title: 'Parental leave details',
    split: (year, m, f, s) => `Parental leave in ${year}: ${m} days for the mother, ${f} for the father and ${s} shared.`,
    oecd: (year, mw, mf, fw, ff) =>
      `OECD figures (rules as of April ${year}): ${mw} weeks of paid leave in total for mothers, worth ${mf} weeks at full pay; ${fw} weeks reserved for fathers, worth ${ff} weeks at full pay.`,
    wbl2026: (m, f) =>
      `World Bank 2026 edition (new method, laws as of 1 October 2025): ${m} days of paid leave in total for mothers and ${f} for fathers (including parental leave; not directly comparable with the days on the map).`,
    note: 'Full-rate equivalent weeks are the weeks of paid leave multiplied by the average payment rate (for someone on average full-time earnings), the most comparable measure across countries, but available only for the 43 OECD and EU countries.',
  },
});

const n = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : fixed(v, digits));

export default function GenderPanel(props: PanelExtraProps) {
  if (props.indicator.id === 'women-political-empowerment') return <Empowerment {...props} />;
  return <Leave {...props} />;
}

function Leave({ topic, indicator, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const show = LEAVE_INDICATORS.includes(indicator.id);
  const { data } = useJson<LeaveDetail>(show ? `topics/${topic.id}/leave-detail.json` : null);
  if (!show) return null;
  if (!data) return <p className="empty">{t.loading}</p>;
  const split = data.parental[iso3];
  const oecd = data.oecd[iso3];
  const latest = data.wbl2026[iso3];
  if (!split && !oecd && !latest) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {split && <p className="note">{text.split(data.year, n(split[0]), n(split[1]), n(split[2]))}</p>}
      {latest && <p className="note">{text.wbl2026(n(latest[0]), n(latest[1]))}</p>}
      {oecd && (
        <>
          <p className="note">
            {text.oecd(data.oecdYear, n(oecd.motherWeeks, 1), n(oecd.motherFre, 1), n(oecd.fatherWeeks, 1), n(oecd.fatherFre, 1))}
          </p>
          <p className="note">{text.note}</p>
        </>
      )}
    </section>
  );
}

/** V-Dem 女性政治賦權指數的三個子指數（pipeline/topics/gender_vdem.py 的 SUBINDICES，檔在 vdem/），線的顏色依類別色的順序 */
const SUBINDICES: { id: string; label: Text; hue: Hue }[] = [
  { id: 'civil-liberties', label: { zh: '公民自由', en: 'Civil liberties' }, hue: 'blue' },
  { id: 'civil-society', label: { zh: '公民社會參與', en: 'Civil society participation' }, hue: 'orange' },
  { id: 'political-participation', label: { zh: '政治參與', en: 'Political participation' }, hue: 'aqua' },
];

const EMPOWERMENT_TEXT = defineMessages({
  zh: {
    title: '三個子指數',
    chartAria: (country: string) => `${country}歷年的女性公民自由、公民社會參與與政治參與指數`,
    interval: (year: number, value: string, low: string, high: string) =>
      `${year} 年的女性政治賦權指數 ${value}（68% 可信區間 ${low}–${high}）。`,
    note: '總指數是三個子指數的平均（同等權重）。公民自由看國內遷徙、財產權、不受強迫勞動與訴諸司法；公民社會參與看公開討論政治、參加公民團體與女性記者；政治參與看國會女性比例與權力分配。',
  },
  en: {
    title: 'The three sub-indices',
    chartAria: (country) => `Women’s civil liberties, civil society participation and political participation indices in ${country} over time`,
    interval: (year, value, low, high) => `Women’s political empowerment index in ${year}: ${value} (68% credible interval ${low}–${high}).`,
    note: 'The overall index is the average of the three sub-indices (equal weights). Civil liberties covers freedom of movement, property rights, freedom from forced labour and access to justice; civil society participation covers open discussion of politics, civil society organisations and women journalists; political participation covers women’s share of legislative seats and the distribution of power.',
  },
});

function Empowerment({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = EMPOWERMENT_TEXT[lang];
  const files = useMemo(
    () => [
      ...SUBINDICES.map((d) => `topics/${topic.id}/vdem/${d.id}.json`),
      `topics/${topic.id}/${indicator.id}.json`,
      `topics/${topic.id}/intervals/${indicator.id}-low.json`,
      `topics/${topic.id}/intervals/${indicator.id}-high.json`,
    ],
    [topic.id, indicator.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);
  const view = useMemo(() => {
    const subs = loaded.slice(0, SUBINDICES.length);
    if (!subs.every(Boolean)) return null;
    const own = subs.map((d) => d!.values[iso3]);
    if (!own.every(Boolean)) return null;
    const years = subs[0]!.years;
    const base = timeSeriesOption({
      years,
      lines: SUBINDICES.map((d, i) => ({ name: tr(d.label, lang), values: own[i]!, color: tokens.hues[d.hue] })),
      year,
      indicator,
      tokens,
    });
    const option: ChartSpec = { ...base, y: { ...base.y, min: 0, max: 1 } };
    const [main, low, high] = loaded.slice(SUBINDICES.length);
    let interval: string | null = null;
    const series = main?.values[iso3];
    if (series && low && high) {
      const at = latestIndexAtOrBefore(main!.years, year, (i) => series[i] != null);
      const lo = low.values[iso3]?.[at];
      const hi = high.values[iso3]?.[at];
      if (at >= 0 && lo != null && hi != null) interval = text.interval(main!.years[at], fixed(series[at]!, 2), fixed(lo, 2), fixed(hi, 2));
    }
    return { option, interval };
  }, [loaded, iso3, year, indicator, tokens, lang, text]);
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.interval && <p>{view.interval}</p>}
      <Chart spec={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      <p className="note">{text.note}</p>
    </section>
  );
}
