import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { GROUPS, RETROFIT_GROUPS } from '../energy-poverty';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 能源貧窮的側欄（2026-11-07，第二十五批 525）：目前指標的全部、貧窮線以下、以上三條線（地圖用的同一組檔），
 * 看得出窮人跟其他人差多少。節能改造（第二十七批 628）改成這一年各族群的長條（自住／租屋、獨棟／公寓、貧窮風險）
 */
const TEXT = defineMessages({
  zh: {
    title: '貧窮線以下與以上（歷年）',
    aria: (c: string) => `${c}貧窮線以下與以上的比例，歷年`,
    groups: (y: number) => `${y} 年各族群的比例`,
    groupsAria: (c: string, y: number) => `${c}${y} 年各族群做過節能改造的比例`,
  },
  en: {
    title: 'Below and above the poverty line over time',
    aria: (c: string) => `${c}: below and above the poverty line over time`,
    groups: (y: number) => `By group, ${y}`,
    groupsAria: (c: string, y: number) => `${c}: share with energy efficiency improvements by group, ${y}`,
  },
});
const HUES = ['inkSecondary', 'red', 'blue'] as const;

export default function EnergyPovertyPanel({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const retrofit = indicator.id === 'retrofit';
  const groups = retrofit ? RETROFIT_GROUPS : GROUPS;
  const files = useJsonMany<IndicatorData>(groups.map((g) => `topics/${topic.id}/${indicator.id}/${g.id}.json`));
  const bars = useMemo(() => {
    if (!retrofit || !files.every(Boolean)) return null;
    const years = files[0]!.years;
    // 這一年或之前最近一個有「全部」的年份
    let i = years.length - 1;
    while (i >= 0 && (years[i] > year || files[0]!.values[iso3]?.[i] == null)) i--;
    if (i < 0) return null;
    const items: BarListItem[] = groups
      .map((g, k) => ({ key: g.id, label: tr(g.label, lang), value: files[k]!.values[iso3]?.[i] ?? NaN }))
      .filter((it) => Number.isFinite(it.value));
    return { year: years[i], items };
  }, [retrofit, files, groups, iso3, year, lang]);
  const option = useMemo(() => {
    if (retrofit || !files.every(Boolean)) return null;
    const years = files[0]!.years;
    const lines = groups.map((g, i) => ({
      name: tr(g.label, lang),
      values: files[i]!.values[iso3] ?? years.map(() => null),
      color: HUES[i] === 'inkSecondary' ? tokens.inkSecondary : tokens.hues[HUES[i] as 'red' | 'blue'],
    }));
    if (lines.every((l) => l.values.every((v) => v === null))) return null;
    return timeSeriesOption({ years, lines, year, indicator, tokens });
  }, [retrofit, files, groups, iso3, year, indicator, tokens, lang]);
  if (bars) {
    return (
      <section className="panel-section">
        <h3>{text.groups(bars.year)}</h3>
        <BarList items={bars.items} max={100} format={(v) => `${fixed(v, 1)}%`} ariaLabel={text.groupsAria(countryName, bars.year)} />
      </section>
    );
  }
  if (!option) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={option} height={220} ariaLabel={text.aria(countryName)} />
    </section>
  );
}
