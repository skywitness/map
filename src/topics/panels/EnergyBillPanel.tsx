import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { BILL_PARTS, eurPerKwh } from '../energy-bills';
import type { PanelExtraProps } from '../types';

/**
 * 帳單組成的側欄（2026-11-07，製作手冊第二十七批 607；pipeline/topics/energy_bills.py 的 bill-detail.json）：
 * 這一國最近一年家庭電費（瓦斯費）的四個組成，歐元/度與占總價的比例；稅費可以是負的（荷蘭的退稅），所以用清單不用長條。
 */
interface Detail {
  countries: Record<string, Partial<Record<'electricity' | 'gas', number[]>>>;
}

const TEXT = defineMessages({
  zh: {
    title: (item: string, y: number) => `${y} 年家庭${item}的組成`,
    electricity: '電費',
    gas: '瓦斯費',
    row: (k: string, v: string, p: string) => `${k}：${v}（${p}）`,
    sum: (v: string) => `合計：${v}`,
  },
  en: {
    title: (item: string, y: number) => `Household ${item} bill in ${y}`,
    electricity: 'electricity',
    gas: 'gas',
    row: (k: string, v: string, p: string) => `${k}: ${v} (${p})`,
    sum: (v: string) => `Total: ${v}`,
  },
});

export default function EnergyBillPanel({ topic, indicator, iso3, item }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/bill-detail.json`).data;
  if (!d || indicator.id !== 'bill-tax-share') return null;
  const key = item === 'gas' ? 'gas' : 'electricity';
  const row = d.countries[iso3]?.[key];
  if (!row) return null;
  const [year, ...vals] = row;
  const total = vals.reduce((s, v) => s + v, 0);
  return (
    <section className="panel-section">
      <h3>{text.title(text[key], year)}</h3>
      <ul className="plain-list">
        {BILL_PARTS.map((p, i) => (
          <li key={p.id}>
            {text.row(p.label[lang], eurPerKwh(vals[i]), `${fixed((vals[i] / total) * 100, 1)}%`)}
          </li>
        ))}
        <li>
          <strong>{text.sum(eurPerKwh(total))}</strong>
        </li>
      </ul>
    </section>
  );
}
