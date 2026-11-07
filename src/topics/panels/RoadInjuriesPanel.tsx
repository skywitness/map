import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption, type TimeSeriesLine } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 車禍的死亡、受傷、事故件數三條線（2026-11-07，製作手冊第二十七批 575；pipeline/topics/road_injuries.py 的
 * road-injuries-detail.json）：大小差兩個數量級，不用雙軸，三條都以第一個三者都有（台灣沒有事故件數：前兩者都有）的年份 = 100。
 */
interface Detail {
  years: number[];
  countries: Record<string, { f: (number | null)[]; i: (number | null)[]; c: (number | null)[] }>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `死亡、受傷、事故件數（${y} 年 = 100）`,
    aria: (c: string) => `${c}車禍的死亡、受傷與事故件數，以第一年為 100`,
    deaths: '死亡',
    injured: '受傷',
    crashes: '事故件數',
    note: '三條線各自以同一年為 100，看的是誰降得多、誰降得少；實際的人數見地圖上的指標。',
  },
  en: {
    title: (y: number) => `Deaths, injured and crashes (${y} = 100)`,
    aria: (c: string) => `Road deaths, injured and crashes in ${c}, indexed to the first year`,
    deaths: 'Deaths',
    injured: 'Injured',
    crashes: 'Crashes',
    note: 'Each line is indexed to the same year, to show which fell faster; see the map indicators for actual numbers.',
  },
});

export function RoadInjuriesSection({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const data = useJson<Detail>(`topics/${dataFolder(topic)}/road-injuries-detail.json`).data;
  const chart = useMemo(() => {
    const row = data?.countries[iso3];
    if (!data || !row) return null;
    const hasCrashes = row.c.some((v) => v != null);
    const base = data.years.findIndex((_, k) => row.f[k] != null && row.i[k] != null && (!hasCrashes || row.c[k] != null));
    if (base < 0) return null;
    const index = (s: (number | null)[]) => s.slice(base).map((v) => (v == null || !s[base] ? null : (v / s[base]!) * 100));
    const lines: TimeSeriesLine[] = [
      { name: text.deaths, values: index(row.f), color: tokens.hues.blue },
      { name: text.injured, values: index(row.i), color: tokens.hues.orange },
    ];
    if (hasCrashes) lines.push({ name: text.crashes, values: index(row.c), color: tokens.hues.aqua });
    const spec = timeSeriesOption({
      years: data.years.slice(base),
      lines,
      year,
      indicator: { ...indicator, format: (v: number) => fixed(v, 0), formatTick: (v: number) => fixed(v, 0), integer: false },
      tokens,
    });
    return { spec, from: data.years[base] };
  }, [data, iso3, indicator, year, tokens, text]);
  if (!chart) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(chart.from)}</h3>
      <Chart spec={chart.spec} height={200} ariaLabel={text.aria(countryName)} />
      <p className="note">{text.note}</p>
    </section>
  );
}
