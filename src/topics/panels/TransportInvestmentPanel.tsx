import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatLargeTick } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * 交通基礎建設投資的側欄（2026-11-07，製作手冊第二十七批 584；pipeline/topics/transport_investment.py 的 detail.json）：
 * 這一國各運具的投資與養護，ITF 的 2015 年價格（歐元，百萬），1995 年起的堆疊面積，加上選的那一年的長條。
 * 運具的顏色跟著運具走（公路橘、鐵路藍、內河青綠、港口紫、機場黃），不依名次換色。
 */
interface Detail {
  years: number[];
  modes: Mode[];
  countries: Record<string, { inv?: Partial<Record<Mode, (number | null)[]>>; mnt?: Partial<Record<Mode, (number | null)[]>> }>;
}
type Mode = 'road' | 'rail' | 'iww' | 'mar' | 'air';

const HUES: Record<Mode, Hue> = { road: 'orange', rail: 'blue', iww: 'aqua', mar: 'violet', air: 'yellow' };

const TEXT = defineMessages({
  zh: {
    inv: '各運具的投資',
    mnt: '各運具的養護',
    year: (k: string, y: number) => `${y} 年${k}`,
    mode: { road: '公路', rail: '鐵路', iww: '內河航道', mar: '港口（海運）', air: '機場（航空）' } as Record<Mode, string>,
    eur: (v: number) => `${formatLargeNumber(v * 1e6)} 歐元`,
    aria: (c: string, k: string) => `${c}${k}的歷年變化`,
    note: '2015 年價格的歐元：ITF 用各國的物價指數換成 2015 年的價格、再用 2015 年的匯率換成歐元，長期的變化不受通膨與匯率影響（地圖上是當年價格）。各國申報的範圍不同，有的含地方政府或民間投資。',
  },
  en: {
    inv: 'Investment by mode',
    mnt: 'Maintenance by mode',
    year: (k: string, y: number) => `${k}, ${y}`,
    mode: { road: 'Road', rail: 'Rail', iww: 'Inland waterways', mar: 'Ports (maritime)', air: 'Airports (air)' } as Record<Mode, string>,
    eur: (v: number) => `€${formatLargeNumber(v * 1e6)}`,
    aria: (c: string, k: string) => `${k} in ${c} over time`,
    note: 'In 2015 euros: the ITF converts each country’s spending to 2015 prices with its own price index and then to euros at 2015 exchange rates, so long-run changes are free of inflation and currency swings (the map uses current prices). Coverage differs between countries; some include local government or private investment.',
  },
});

export default function TransportInvestmentPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  const sections = useMemo(() => {
    const row = d?.countries[iso3];
    if (!d || !row) return [];
    return (['inv', 'mnt'] as const).flatMap((key) => {
      const src = row[key];
      if (!src) return [];
      const modes = d.modes.filter((m) => src[m]?.some((v) => v != null));
      if (!modes.length) return [];
      const start = d.years.findIndex((_, i) => modes.some((m) => src[m]![i] != null));
      const years = d.years.slice(start);
      const series: StackedSeries[] = modes.map((m) => ({ name: text.mode[m], values: src[m]!.slice(start), color: tokens.hues[HUES[m]] }));
      const index = latestIndexAtOrBefore(years, year, (i) => series.some((s) => (s.values[i] ?? 0) > 0));
      if (index < 0) return [];
      const option = stackedAreaOption({ years, series, year, format: text.eur, formatTick: (v) => formatLargeTick(v * 1e6) });
      const items: BarListItem[] = modes
        .map((m, n) => ({ key: m, label: text.mode[m], value: series[n].values[index] ?? 0, color: tokens.hues[HUES[m]] }))
        .filter((x) => x.value > 0);
      return [{ key, title: text[key], option, items, year: years[index] }];
    });
  }, [d, iso3, year, text, tokens]);
  if (!sections.length) return null;
  return (
    <>
      {sections.map((s) => (
        <section className="panel-section" key={s.key}>
          <h3>{s.title}</h3>
          <Chart spec={s.option} height={200} ariaLabel={text.aria(countryName, s.title)} />
          <h4>{text.year(s.title, s.year)}</h4>
          <BarList items={s.items} format={text.eur} total={s.items.reduce((a, x) => a + x.value, 0)} ariaLabel={text.year(s.title, s.year)} />
        </section>
      ))}
      <p className="note">{text.note}</p>
    </>
  );
}
