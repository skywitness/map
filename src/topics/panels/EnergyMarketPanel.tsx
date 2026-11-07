import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Indicator, PanelExtraProps } from '../types';

/**
 * 電力市場與補貼主題的側欄（2026-11-07，第二十五批 527）：台灣畫能源署公告的躉購費率（pipeline/topics/energy_policy_tools.py 的
 * tw-fit.json：屋頂型太陽光電最小級距、地面型太陽光電、陸域風力、離岸風力固定 20 年，2010–2023，元/度）
 */
interface TwFit {
  years: number[];
  series: Record<'rooftop' | 'ground' | 'onshore' | 'offshore', (number | null)[]>;
}

const SERIES = ['rooftop', 'ground', 'onshore', 'offshore'] as const;
const HUES = ['orange', 'yellow', 'aqua', 'blue'] as const;

const TEXT = defineMessages({
  zh: {
    title: '台灣的再生能源躉購費率',
    aria: '台灣的再生能源躉購費率，2010–2023 年，元/度',
    labels: ['屋頂型太陽光電（最小級距）', '地面型太陽光電', '陸域風力', '離岸風力（固定 20 年）'],
    unit: (v: string) => `${v} 元/度`,
    note: '經濟部能源署每年公告的費率（元/度，20 年保證收購）；有分上下半年的取上半年（第一期），有分是否併聯特高壓的取沒有併聯的。2023 年的太陽光電是上限費率。2024 年以後的公告不在這份開放資料裡。',
  },
  en: {
    title: 'Feed-in tariffs for renewables in Taiwan',
    aria: 'Feed-in tariffs for renewables in Taiwan, 2010–2023, NT$ per kWh',
    labels: ['Rooftop solar (smallest size band)', 'Ground-mounted solar', 'Onshore wind', 'Offshore wind (fixed 20-year rate)'],
    unit: (v: string) => `NT$${v}/kWh`,
    note: 'Rates announced each year by the Energy Administration (NT$ per kWh, guaranteed for 20 years); where a year has two periods the first is shown, and where rates differ by extra-high-voltage connection the unconnected rate is shown. Solar rates for 2023 are ceilings. Announcements from 2024 on are not in this open dataset.',
  },
});

export default function EnergyMarketPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const { data } = useJson<TwFit>(`topics/${topic.id}/tw-fit.json`);
  const option = useMemo(() => {
    if (!data) return null;
    const indicator: Pick<Indicator, 'format' | 'formatTick' | 'layer'> = {
      format: (v: number) => text.unit(fixed(v, 2)),
      formatTick: (v: number) => fixed(v, 0),
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1] } },
    };
    return timeSeriesOption({
      years: data.years,
      lines: SERIES.map((s, i) => ({ name: text.labels[i], values: data.series[s], color: tokens.hues[HUES[i]] })),
      year: Math.min(Math.max(year, data.years[0]), data.years[data.years.length - 1]),
      indicator: indicator as Indicator,
      tokens,
    });
  }, [data, text, tokens, year]);
  if (iso3 !== 'TWN' || !option) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={option} height={220} ariaLabel={text.aria} />
      <p className="note">{text.note}</p>
    </section>
  );
}
