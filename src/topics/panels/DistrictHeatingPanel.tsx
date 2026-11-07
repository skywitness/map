import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 區域供熱的側欄（2026-11-07，製作手冊第二十七批 611；pipeline/topics/district_heating.py 的 detail.json）：
 * 最近一年的網路數、管線長度、用戶數，與送出的熱依用戶（住宅與服務業、工業、其他）。
 */
interface Row {
  year: number;
  networks: number | null;
  km: number | null;
  customers: number | null;
  heat: (number | null)[];
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年的區域供熱`,
    networks: (v: number) => `${fixed(v, 0)} 個網路`,
    km: (v: number) => `管線 ${fixed(v, 0)} 公里`,
    customers: (v: number) => `用戶 ${fixed(v, 0)}`,
    heat: '送出的熱給誰',
    parts: ['住宅與服務業', '工業', '其他'],
    tj: (v: number) => `${fixed(v, 0)} TJ`,
    aria: (c: string) => `${c}：區域供熱送給誰`,
    sep: '、',
  },
  en: {
    title: (y: number) => `District heating in ${y}`,
    networks: (v: number) => `${fixed(v, 0)} networks`,
    km: (v: number) => `${fixed(v, 0)} km of pipes`,
    customers: (v: number) => `${fixed(v, 0)} customers`,
    heat: 'Who receives the heat',
    parts: ['Households and services', 'Industry', 'Other'],
    tj: (v: number) => `${fixed(v, 0)} TJ`,
    aria: (c: string) => `${c}: district heat by customer`,
    sep: ', ',
  },
});

export default function DistrictHeatingPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<{ countries: Record<string, Row> }>(`topics/${topic.id}/detail.json`).data;
  const row = d?.countries[iso3];
  if (!row) return null;
  const facts = [row.networks && text.networks(row.networks), row.km && text.km(row.km), row.customers && text.customers(row.customers)].filter(Boolean);
  const items: BarListItem[] = row.heat
    .map((v, i) => ({ key: String(i), label: text.parts[i], value: v ?? 0 }))
    .filter((x) => x.value > 0);
  const total = items.reduce((s, x) => s + x.value, 0);
  return (
    <section className="panel-section">
      <h3>{text.title(row.year)}</h3>
      {facts.length > 0 && <p>{facts.join(text.sep)}</p>}
      {items.length > 0 && (
        <>
          <h3>{text.heat}</h3>
          <BarList items={items} format={text.tj} total={total} ariaLabel={text.aria(countryName)} />
        </>
      )}
    </section>
  );
}
