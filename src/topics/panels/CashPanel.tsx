import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/** 現金的指標（digital.ts，2026-11-05）才顯示這個區塊 */
const CASH_INDICATORS = ['cash-only', 'cash-on-delivery', 'cash-habit'];

/** cash-detail.json（pipeline/topics/digital_cash.py）：各國在店裡付現金的五個原因（2024 年）、台灣各場域的行動支付滲透率 */
interface CashDetail {
  /** [商家只收現金, 用卡或手機比較貴, 不信任卡或手機付款, 習慣付現金, 其他]，% 的 15 歲以上 */
  reasons: Record<string, (number | null)[]>;
  taiwan: { year: number; source: string; venues: [string, number][] };
}

/** 順序跟 pipeline 的 REASONS 一樣 */
const REASONS: Text[] = [
  { zh: '商家只收現金', en: 'Merchant only accepts cash' },
  { zh: '用卡或手機比較貴', en: 'Cards or phones cost more' },
  { zh: '不信任卡或手機付款', en: 'Distrust card or phone payments' },
  { zh: '習慣付現金', en: 'Used to paying in cash' },
  { zh: '其他原因', en: 'Other' },
];

const TEXT = defineMessages({
  zh: {
    reasonsTitle: '在店裡付現金的主要原因（2024 年）',
    reasonsAria: (country: string) => `${country}在店裡付現金的主要原因`,
    reasonsNote: '占全部 15 歲以上的比例（每人只選一個主要原因；沒有在店裡付過現金的人不算），世界銀行 Global Findex 2025。',
    venuesTitle: (year: number) => `台灣：在各場域用過行動支付的比例（${year} 年）`,
    venuesAria: '台灣各場域的行動支付滲透率',
    venuesNote: (year: number) =>
      `Findex 對台灣沒有問現金的題目，這裡列數位發展部「國內各場域行動支付滲透率」${year} 年的調查：一年內曾經在這類場域用過行動支付的比例，跟 Findex 的題目不同，不能直接比較。`,
  },
  en: {
    reasonsTitle: 'Main reason for paying cash in shops (2024)',
    reasonsAria: (country) => `Main reasons for paying cash in shops in ${country}`,
    reasonsNote: 'Share of all adults (15+); each person gives one main reason, and people who did not pay cash in shops are not counted. World Bank Global Findex 2025.',
    venuesTitle: (year) => `Taiwan: share who used mobile payments, by venue (${year})`,
    venuesAria: 'Mobile payment use by venue in Taiwan',
    venuesNote: (year) =>
      `Findex did not ask Taiwan the cash questions, so this lists the Ministry of Digital Affairs survey of mobile payment use by venue in ${year}: the share who used mobile payments at each kind of place in the past year. The question differs from Findex and is not directly comparable.`,
  },
});

/** 數位部調查的 24 個場域（2024 年版的名稱）的英文；沒列到的照原文 */
const VENUES: { zh: string; en: string }[] = [
  { zh: '便利商店', en: 'Convenience stores' },
  { zh: '量販店', en: 'Hypermarkets' },
  { zh: '網路商店', en: 'Online shops' },
  { zh: '超級市場', en: 'Supermarkets' },
  { zh: '連鎖餐飲', en: 'Restaurant chains' },
  { zh: '百貨或購物中心', en: 'Department stores and malls' },
  { zh: '連鎖商店', en: 'Chain stores' },
  { zh: '交通運輸', en: 'Transport' },
  { zh: '繳費', en: 'Bill payments' },
  { zh: '外送平台', en: 'Food delivery platforms' },
  { zh: 'APP平台', en: 'App platforms' },
  { zh: '連鎖藥局藥妝店', en: 'Pharmacy and drugstore chains' },
  { zh: '3C電信', en: 'Electronics and telecom stores' },
  { zh: '娛樂場所', en: 'Entertainment venues' },
  { zh: '住宿飯店', en: 'Hotels' },
  { zh: '自營餐飲', en: 'Independent restaurants' },
  { zh: '夜市攤販', en: 'Night market stalls' },
  { zh: '醫療院所', en: 'Clinics and hospitals' },
  { zh: '路邊攤或小吃攤', en: 'Street food stalls' },
  { zh: '校園', en: 'Campuses' },
  { zh: '果菜漁市場', en: 'Produce and fish markets' },
  { zh: '宮廟', en: 'Temples' },
  { zh: '汽機車維修及美容店', en: 'Car and scooter repair shops' },
  { zh: '美髮及美容美體店', en: 'Hair and beauty salons' },
];
const venueText = (name: string, lang: 'zh' | 'en') => (lang === 'en' ? (VENUES.find((v) => v.zh === name)?.en ?? name) : name);

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function CashPanel({ topic, indicator, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const show = CASH_INDICATORS.includes(indicator.id);
  const data = useJson<CashDetail>(show ? `topics/${topic.id}/cash-detail.json` : null).data;
  const reasons = useMemo(() => {
    const row = data?.reasons[iso3];
    if (!row) return null;
    return REASONS.flatMap((label, i) =>
      row[i] == null ? [] : [{ key: String(i), label: tr(label, lang), value: row[i]!, color: tokens.hues.blue }],
    );
  }, [data, iso3, lang, tokens]);
  if (!show || !data) return null;
  if (iso3 === 'TWN') {
    const { year, venues } = data.taiwan;
    return (
      <section className="panel-section">
        <h3>{text.venuesTitle(year)}</h3>
        <BarList
          items={venues.map(([name, value]) => ({ key: name, label: venueText(name, lang), value }))}
          format={pct}
          max={100}
          ariaLabel={text.venuesAria}
        />
        <p className="note">{text.venuesNote(year)}</p>
      </section>
    );
  }
  if (!reasons?.length) return null;
  return (
    <section className="panel-section">
      <h3>{text.reasonsTitle}</h3>
      <BarList items={reasons} format={pct} ariaLabel={text.reasonsAria(countryName)} />
      <p className="note">{text.reasonsNote}</p>
    </section>
  );
}
