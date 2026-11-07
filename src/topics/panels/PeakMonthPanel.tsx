import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MONTHS } from '../months';
import type { PanelExtraProps } from '../types';

/**
 * 用電尖峰月份的側欄（2026-11-07，製作手冊第二十七批 608；pipeline/topics/electricity_peak.py 的 peak-month-detail.json）：
 * 最近 5 個完整年各月的每日平均需求，依月份排（不排序），顏色跟地圖的月份一樣。自發自用的指標沒有側欄區塊。
 */
interface Detail {
  countries: Record<string, [number, number, number[]]>;
}

const TEXT = defineMessages({
  zh: {
    title: (a: number, b: number) => `${a}–${b} 年每天平均的用電`,
    v: (twh: number) => `${fixed(twh * 1000, twh >= 0.1 ? 0 : 1)} 百萬度`,
    aria: (c: string) => `${c}：各月每天平均的用電`,
  },
  en: {
    title: (a: number, b: number) => `Average daily demand, ${a}–${b}`,
    v: (twh: number) => `${fixed(twh * 1000, twh >= 0.1 ? 0 : 1)} GWh`,
    aria: (c: string) => `${c}: average daily demand by month`,
  },
});

export default function PeakMonthPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/peak-month-detail.json`).data;
  if (!d || indicator.id !== 'peak-month') return null;
  const row = d.countries[iso3];
  if (!row) return null;
  const [a, b, months] = row;
  const items: BarListItem[] = months.map((v, i) => ({
    key: String(i + 1),
    label: typeof MONTHS[i].label === 'string' ? MONTHS[i].label : MONTHS[i].label[lang],
    value: v,
    color: MONTHS[i].color,
  }));
  return (
    <section className="panel-section">
      <h3>{text.title(a, b)}</h3>
      <BarList items={items} format={text.v} ariaLabel={text.aria(countryName)} />
    </section>
  );
}
