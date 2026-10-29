import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { LEAVE_INDICATORS } from '../gender';
import type { PanelExtraProps } from '../types';

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

export default function GenderPanel({ topic, indicator, iso3 }: PanelExtraProps) {
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
