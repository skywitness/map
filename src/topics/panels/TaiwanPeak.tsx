import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Tokens } from '../../theme/tokens';
import type { Indicator } from '../types';

/**
 * 「發電量」台灣側欄的尖峰負載與備用容量率（2026-11-07，製作手冊第二十五批 531；pipeline/topics/taiwan_peak.py）：
 * 台電的歷年資料（1982 年起）。兩個量的單位不同，畫成上下兩張圖（不用雙軸）
 */
interface PeakFile {
  years: number[];
  peak: number[];
  reserve: number[];
}

const TEXT = defineMessages({
  zh: {
    title: '尖峰負載與備用容量率',
    peak: '尖峰負載（MW）',
    reserve: '備用容量率（%）',
    peakAria: '台灣歷年尖峰負載，1982 年起',
    reserveAria: '台灣歷年備用容量率，1982 年起',
    note: (y: number, p: string, r: string) =>
      `台灣電力公司統計。${y} 年尖峰負載 ${p} MW、備用容量率 ${r}%；備用容量率是尖峰時還有多少發電容量沒用到，1991–1996 年只有 4.2–6.7%，2024 年 11.0%。國際上沒有可用的各國尖峰負載資料，只有台灣。`,
  },
  en: {
    title: 'Peak load and reserve margin',
    peak: 'Peak load (MW)',
    reserve: 'Reserve margin (%)',
    peakAria: 'Taiwan peak electricity load by year, from 1982',
    reserveAria: 'Taiwan reserve margin by year, from 1982',
    note: (y: number, p: string, r: string) =>
      `Taipower statistics. In ${y} peak load was ${p} MW with a reserve margin of ${r}%; the reserve margin is how much generating capacity is left over at the peak, which was only 4.2–6.7% in 1991–1996 and 11.0% in 2024. No usable peak-load data exist for other countries, so this is Taiwan only.`,
  },
});

export function TaiwanPeak({ topicId, year, tokens }: { topicId: string; year: number; tokens: Tokens }) {
  const text = TEXT[useLang()];
  const { data } = useJson<PeakFile>(`topics/${topicId}/tw-peak.json`);
  const charts = useMemo(() => {
    if (!data) return null;
    const at = Math.min(Math.max(year, data.years[0]), data.years[data.years.length - 1]);
    const make = (values: number[], name: string, unit: (v: number) => string, color: string) =>
      timeSeriesOption({
        years: data.years,
        lines: [{ name, values, color }],
        year: at,
        indicator: {
          format: unit,
          formatTick: (v: number) => fixed(v, 0),
          layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1] } },
        } as Pick<Indicator, 'format' | 'formatTick' | 'layer'> as Indicator,
        tokens,
      });
    return {
      peak: make(data.peak, text.peak, (v) => `${fixed(v, 0)} MW`, tokens.hues.blue),
      reserve: make(data.reserve, text.reserve, (v) => `${fixed(v, 1)}%`, tokens.hues.orange),
    };
  }, [data, text, tokens, year]);
  if (!data || !charts) return null;
  const last = data.years.length - 1;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <h4>{text.peak}</h4>
      <Chart spec={charts.peak} height={160} ariaLabel={text.peakAria} />
      <h4>{text.reserve}</h4>
      <Chart spec={charts.reserve} height={160} ariaLabel={text.reserveAria} />
      <p className="note">{text.note(data.years[last], fixed(data.peak[last], 0), fixed(data.reserve[last], 1))}</p>
    </section>
  );
}
