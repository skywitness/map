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
 * 上網用什麼的側欄（2026-11-07，製作手冊第二十七批 587；pipeline/topics/web_platforms.py 的 countries/<ISO3>.json）：
 * 最近一個月搜尋引擎、瀏覽器、作業系統各家的百分比，與目前這個指標那一類的歷年曲線（年平均曾經到 5% 的品牌）。
 */
type Stat = 'search' | 'browser' | 'os';
const STATS: Stat[] = ['search', 'browser', 'os'];
const STAT_OF: Record<string, Stat> = { 'search-leader': 'search', 'browser-leader': 'browser', 'os-leader': 'os', 'ios-android': 'os' };

interface Block {
  /** [品牌, %]；品牌是空字串的是其他 */
  latest?: [string, number][];
  years?: number[];
  lines?: [string, number[]][];
}
type Detail = { month: string } & Partial<Record<Stat, Block>>;

const TEXT = defineMessages({
  zh: {
    stat: { search: '搜尋引擎', browser: '瀏覽器', os: '作業系統' } as Record<Stat, string>,
    latest: (s: string, m: string) => `${m}的${s}`,
    month: (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`,
    history: (s: string) => `歷年的${s}（年平均）`,
    other: '其他',
    brand: { Baidu: '百度' } as Record<string, string>,
    aria: (c: string, s: string) => `${c}各家${s}的市占`,
    lineAria: (c: string, s: string) => `${c}歷年各家${s}的市占折線圖`,
  },
  en: {
    stat: { search: 'search engines', browser: 'browsers', os: 'operating systems' } as Record<Stat, string>,
    latest: (s: string, m: string) => `${s[0].toUpperCase()}${s.slice(1)}, ${m}`,
    month: (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    history: (s: string) => `${s[0].toUpperCase()}${s.slice(1)} over time (annual average)`,
    other: 'Other',
    brand: {} as Record<string, string>,
    aria: (c: string, s: string) => `${c}: share of ${s}`,
    lineAria: (c: string, s: string) => `${c}: share of ${s} over time`,
  },
});

export default function WebPlatformsPanel({ topic, indicator, iso3, countryName, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/countries/${iso3}.json`).data;
  const current = STAT_OF[indicator.id] ?? 'search';
  const history = useMemo(() => {
    const b = d?.[current];
    if (!b?.years || !b.lines) return null;
    return timeSeriesOption({
      years: b.years,
      lines: b.lines.map(([name, values], i) => ({ name: text.brand[name] ?? name, values, color: tokens.hues[HUE_ORDER[i % HUE_ORDER.length]] })),
      year,
      indicator: { ...indicator, unit: '%', format: (v: number) => `${fixed(v, 1)}%`, formatTick: (v: number) => `${fixed(v, 0)}%` },
      tokens,
    });
  }, [d, current, year, indicator, tokens]);
  if (!d) return null;
  const month = text.month(d.month);
  const order = [current, ...STATS.filter((s) => s !== current)];
  return (
    <>
      {history && (
        <section className="panel-section">
          <h3>{text.history(text.stat[current])}</h3>
          <Chart spec={history} height={200} ariaLabel={text.lineAria(countryName, text.stat[current])} />
        </section>
      )}
      {order.map((s) => {
        const latest = d[s]?.latest;
        if (!latest?.length) return null;
        const items: BarListItem[] = latest.map(([name, v]) => ({ key: name || '_other', label: name ? (text.brand[name] ?? name) : text.other, value: v }));
        return (
          <section className="panel-section" key={s}>
            <h3>{text.latest(text.stat[s], month)}</h3>
            <BarList items={items} max={100} format={(v) => `${fixed(v, v < 1 ? 2 : 1)}%`} ariaLabel={text.aria(countryName, text.stat[s])} properNouns />
          </section>
        );
      })}
    </>
  );
}
