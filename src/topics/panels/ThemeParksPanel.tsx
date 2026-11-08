import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { HUE_ORDER } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * 樂園的側欄（2026-11-08，製作手冊第二十七批 630；pipeline/topics/theme_parks.py 的 taiwan.json）：只有台灣——
 * 觀光署 25 處民營遊樂園最近一年的人次（附全票價格）與各月合計（看得出暑假與連假的旺季）。
 * 集團的指標（第二十七批 631，groups.json）：選了國家時畫總部在這一國的集團歷年人次。
 */
interface GroupsFile {
  years: number[];
  groups: [string, string, (number | null)[]][];
}
interface Park {
  name: string;
  county: string;
  price: number | null;
  priceYear: number | null;
  years: number[];
  annual: number[];
  months: number[] | null;
  monthYear: number | null;
}
interface TaiwanFile {
  parks: Park[];
}

const TEXT = defineMessages({
  zh: {
    visitors: (y: number) => `${y} 年各樂園的人次`,
    visitorsAria: (y: number) => `台灣各樂園 ${y} 年的人次`,
    months: (y: number) => `${y} 年各月的人次（各樂園合計）`,
    monthsAria: (y: number) => `台灣樂園 ${y} 年各月的人次合計`,
    month: (m: number) => `${m} 月`,
    label: (p: Park) => `${p.name}（${p.county}${p.price ? `，全票 ${fixed(p.price, 0)} 元` : ''}）`,
    v: (v: number) => (v >= 10000 ? `${fixed(v / 10000, 1)} 萬人次` : `${fixed(v, 0)} 人次`),
    groups: '總部在這一國的樂園集團（百萬人次）',
    groupsAria: '總部在這一國的樂園集團歷年人次',
    note: '交通部觀光署的民營遊樂園（觀光遊樂業）25 處；人次來自「主要觀光遊憩據點遊客人數」，麗寶、義大含購物中心與飯店。全票價格是觀光署資料裡最後一次更新的（多半是 2018 年），不是現價；沒有人次的園區不列。',
  },
  en: {
    visitors: (y: number) => `Visitors by park, ${y}`,
    visitorsAria: (y: number) => `Visitors to Taiwan’s amusement parks, ${y}`,
    months: (y: number) => `Visitors by month, ${y} (all parks)`,
    monthsAria: (y: number) => `Monthly visitors to Taiwan’s amusement parks, ${y}`,
    month: (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }),
    label: (p: Park) => `${p.name}${p.price ? ` (adult NT$${fixed(p.price, 0)})` : ''}`,
    v: (v: number) => fixed(v, 0),
    groups: 'Theme park groups headquartered here (millions)',
    groupsAria: 'Attendance of theme park groups headquartered here, by year',
    note: 'Taiwan’s 25 private amusement parks registered with the Tourism Administration; visitors come from its counts for major attractions (Lihpao and E-DA include malls and hotels). Adult ticket prices are the last update in the Tourism Administration data (mostly 2018), not current prices; parks without visitor counts are not listed.',
  },
});

export default function ThemeParksPanel({ topic, indicator, iso3, year: selectedYear, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<TaiwanFile>(`topics/${topic.id}/taiwan.json`).data;
  const g = useJson<GroupsFile>(`topics/${topic.id}/groups.json`).data;
  const groupChart = useMemo(() => {
    if (indicator.id !== 'groups' || !g) return null;
    const mine = g.groups.filter(([, c]) => c === iso3);
    if (!mine.length) return null;
    return timeSeriesOption({
      years: g.years,
      lines: mine.map(([name, , v], i) => ({ name, values: v.map((x) => (x == null ? null : x / 1000)), color: tokens.hues[HUE_ORDER[i % HUE_ORDER.length]] })),
      year: selectedYear,
      indicator,
      tokens,
    });
  }, [indicator, g, iso3, selectedYear, tokens]);
  if (groupChart) {
    return (
      <section className="panel-section">
        <h3>{text.groups}</h3>
        <Chart spec={groupChart} height={220} ariaLabel={text.groupsAria} />
      </section>
    );
  }
  if (iso3 !== 'TWN' || !d || indicator.id === 'groups') return null;
  const withVisits = d.parks.filter((p) => p.annual.length && p.monthYear);
  if (!withVisits.length) return null;
  const year = Math.max(...withVisits.map((p) => p.monthYear!));
  const latest = withVisits.filter((p) => p.monthYear === year);
  const items: BarListItem[] = latest.map((p) => ({ key: p.name, label: text.label(p), value: p.annual[p.annual.length - 1] }));
  const monthItems: BarListItem[] = Array.from({ length: 12 }, (_, i) => ({
    key: String(i + 1),
    label: text.month(i + 1),
    value: latest.reduce((s, p) => s + (p.months?.[i] ?? 0), 0),
  }));
  return (
    <>
      <section className="panel-section">
        <h3>{text.visitors(year)}</h3>
        <BarList items={items} format={text.v} ariaLabel={text.visitorsAria(year)} />
        <p className="note">{text.note}</p>
      </section>
      <section className="panel-section">
        <h3>{text.months(year)}</h3>
        <BarList items={monthItems} format={text.v} ariaLabel={text.monthsAria(year)} />
      </section>
    </>
  );
}
