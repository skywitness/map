import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * 家庭交通支出的側欄（2026-11-07，製作手冊第二十七批 585；pipeline/topics/household_transport.py 的 detail.json）：
 * 歐洲各國：買車、養車與油錢、搭車的費用三個子項目占家庭消費支出的比例（堆疊面積，加起來是交通的比例）。
 * 台灣：主計總處的「交通及資通訊」（含電信費）1976 年起的折線，跟歐洲的口徑不同。
 */
interface Detail {
  years: number[];
  countries: Record<string, Record<Part, (number | null)[]>>;
  tw: { years: number[]; values: number[] };
}
type Part = 'vehicles' | 'operation' | 'services';
const PARTS: Part[] = ['vehicles', 'operation', 'services'];
const HUES: Record<Part, Hue> = { vehicles: 'blue', operation: 'orange', services: 'aqua' };

const TEXT = defineMessages({
  zh: {
    title: '交通支出的組成',
    part: { vehicles: '買車', operation: '養車與油錢', services: '搭車的費用' } as Record<Part, string>,
    aria: (c: string) => `${c}的家庭交通支出占消費支出的比例，依子項目`,
    tw: '台灣：交通及資通訊占家庭消費支出',
    twSeries: '交通及資通訊',
    twAria: '台灣的交通及資通訊占家庭消費支出的比例，1976 年起',
    twNote: (y: number, v: string) =>
      `主計總處家庭收支調查，${y} 年 ${v}。這個分類含電話、網路等通訊費（2016 年以前叫「運輸交通及通訊」），比歐洲的交通支出多算了一塊，不能直接比。`,
  },
  en: {
    title: 'What transport spending goes on',
    part: { vehicles: 'Buying vehicles', operation: 'Running vehicles', services: 'Transport services' } as Record<Part, string>,
    aria: (c: string) => `Transport share of household spending in ${c}, by sub-item`,
    tw: 'Taiwan: transport and communications, % of household spending',
    twSeries: 'Transport and communications',
    twAria: 'Transport and communications as a share of household spending in Taiwan, since 1976',
    twNote: (y: number, v: string) =>
      `DGBAS Survey of Family Income and Expenditure, ${v} in ${y}. This category includes phone and internet bills, so it covers more than European transport spending and is not directly comparable.`,
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function HouseholdTransportPanel({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  const chart = useMemo(() => {
    const row = d?.countries[iso3];
    if (!d || !row) return null;
    const start = d.years.findIndex((_, i) => PARTS.some((p) => row[p][i] != null));
    if (start < 0) return null;
    const years = d.years.slice(start);
    const series: StackedSeries[] = PARTS.map((p) => ({ name: text.part[p], values: row[p].slice(start), color: tokens.hues[HUES[p]] }));
    if (latestIndexAtOrBefore(years, year, (i) => series.some((s) => s.values[i] != null)) < 0) return null;
    return stackedAreaOption({ years, series, year, format: pct, formatTick: (v) => `${fixed(v, 0)}%` });
  }, [d, iso3, year, text, tokens]);
  const tw = useMemo(() => {
    if (!d || iso3 !== 'TWN') return null;
    const option = timeSeriesOption({
      years: d.tw.years,
      lines: [{ name: text.twSeries, values: d.tw.values, color: tokens.accent }],
      year,
      indicator,
      tokens,
    });
    const last = d.tw.years.length - 1;
    // 主計總處公布到小數兩位，跟地圖 tooltip 的寫法一致
    return { option, note: text.twNote(d.tw.years[last], `${fixed(d.tw.values[last], 2)}%`) };
  }, [d, iso3, year, text, tokens, indicator]);
  if (tw) {
    return (
      <section className="panel-section">
        <h3>{text.tw}</h3>
        <Chart spec={tw.option} height={200} ariaLabel={text.twAria} />
        <p className="note">{tw.note}</p>
      </section>
    );
  }
  if (!chart) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={chart} height={200} ariaLabel={text.aria(countryName)} />
    </section>
  );
}
