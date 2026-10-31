import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption, type TimeSeriesLine } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Indicator, WorldPanelProps } from '../types';

/** commodities.json（pipeline/topics/energy_prices.py 的 commodity_history）：世界銀行 Pink Sheet 月資料的年平均 */
interface CommodityFile {
  years: number[];
  series: Record<string, (number | null)[]>;
  /** 月資料的最後一個月（「2026-09」）：最後一年只平均到這個月 */
  lastMonth: string;
}

type Group = 'oil' | 'gas' | 'coal';
/** 每組一張圖（單位不同，不畫在同一個 y 軸）；顏色依序取固定的三個類別色 */
const GROUPS: { id: Group; series: string[] }[] = [
  { id: 'oil', series: ['brent', 'dubai', 'wti'] },
  { id: 'gas', series: ['gas-europe', 'lng-japan', 'gas-us'] },
  { id: 'coal', series: ['coal-australia', 'coal-south-africa'] },
];

const TEXT = defineMessages({
  zh: {
    intro: (last: number, month: number) =>
      `世界銀行整理的國際批發行情，名目美元的年平均（${last} 年只平均到 ${month} 月）。地圖上的電價、油價是各國的零售價，含稅、運費與利潤，會跟著這些行情變，但通常慢幾個月，也受補貼與稅率影響。`,
    group: { oil: '原油', gas: '天然氣', coal: '煤' } as Record<Group, string>,
    unit: { oil: '美元/桶', gas: '美元/百萬英熱單位', coal: '美元/公噸' } as Record<Group, string>,
    chartAria: (group: string, unit: string) => `${group}的國際價格，1960 年起每年的平均（${unit}）`,
    names: {
      brent: '布蘭特',
      dubai: '杜拜',
      wti: 'WTI',
      'gas-europe': '歐洲',
      'lng-japan': '日本 LNG',
      'gas-us': '美國',
      'coal-australia': '澳洲',
      'coal-south-africa': '南非',
    } as Record<string, string>,
    tableTitle: (year: number) => `${year} 年的平均價格`,
    tableCaption: (year: number) => `${year} 年各項國際能源價格的年平均，以及 1960 年以來最高的一年`,
    colItem: '項目',
    colYear: (year: number) => `${year} 年`,
    colPeak: '最高（年）',
    peak: (v: string, year: number) => `${v}（${year}）`,
    title: (group: string, unit: string) => `${group}（${unit}）`,
    note:
      '布蘭特是北海原油，杜拜是中東原油，WTI 是美國西德州原油；美國天然氣是路易斯安那州 Henry Hub 的現貨價，日本 LNG 是進口到岸價；澳洲煤是紐卡索港、南非煤是理查茲灣港的離岸價。' +
      '序列的定義換過：杜拜 1960–1984 年是沙烏地輕原油；歐洲天然氣 2015 年 4 月起是荷蘭 TTF 的價格，之前是進口邊境價；澳洲煤 2022 年 2 月起是紐卡索期貨價，之前是現貨價。WTI 1982 年起、日本 LNG 1977 年起、澳洲煤 1970 年起、南非煤 1984 年起才有。價格多引自 Bloomberg 等商業來源，世界銀行整理後以 CC BY 4.0 公布。',
    hint: '點地圖上的國家看那個國家的電價與油價。',
  },
  en: {
    intro: (last, month) =>
      `International wholesale prices compiled by the World Bank, as annual averages in nominal US dollars (${last} averages January–${monthName(month)} only). The electricity and fuel prices on the map are retail prices including taxes, transport and margins; they follow these prices, usually a few months later, and are also shaped by subsidies and tax rates.`,
    group: { oil: 'Crude oil', gas: 'Natural gas', coal: 'Coal' },
    unit: { oil: 'US$/barrel', gas: 'US$/mmBtu', coal: 'US$/tonne' },
    chartAria: (group, unit) => `International ${group.toLowerCase()} prices, annual averages since 1960 (${unit})`,
    names: {
      brent: 'Brent',
      dubai: 'Dubai',
      wti: 'WTI',
      'gas-europe': 'Europe',
      'lng-japan': 'Japan LNG',
      'gas-us': 'US',
      'coal-australia': 'Australia',
      'coal-south-africa': 'South Africa',
    },
    tableTitle: (year) => `Average prices in ${year}`,
    tableCaption: (year) => `Annual average international energy prices in ${year}, and the highest year since 1960`,
    colItem: 'Series',
    colYear: (year) => String(year),
    colPeak: 'Peak (year)',
    peak: (v, year) => `${v} (${year})`,
    title: (group, unit) => `${group} (${unit})`,
    note:
      'Brent is North Sea crude, Dubai Middle Eastern crude and WTI US West Texas Intermediate; US gas is the Henry Hub (Louisiana) spot price and Japan LNG the import price delivered (cif); Australian coal is f.o.b. Newcastle and South African coal f.o.b. Richards Bay. ' +
      'Some series have changed definition: Dubai for 1960–1984 is Saudi Arabian Light; European gas is the Dutch TTF price from April 2015 and an import border price before that; Australian coal is the Newcastle futures price from February 2022 and a spot price before that. WTI starts in 1982, Japan LNG in 1977, Australian coal in 1970 and South African coal in 1984. Most prices come from commercial sources such as Bloomberg; the World Bank publishes its compilation under CC BY 4.0.',
    hint: 'Click a country on the map to see its electricity and fuel prices.',
  },
});

function monthName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
}

/** 依大小決定小數位：100 以上整數、10 以上 1 位，更小的 2 位 */
function num(v: number): string {
  return fixed(v, v >= 100 ? 0 : v >= 10 ? 1 : 2);
}

/** 圖表用的指標：只借 format 與刻度，用循序的圖層，折線圖才不會在 0 畫一條橫線 */
function chartIndicator(base: Indicator, unit: string): Indicator {
  return {
    ...base,
    format: (v) => `${num(v)} ${unit}`,
    formatTick: (v) => fixed(v, 0),
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [] } },
  };
}

export default function EnergyPricesWorld({ topic, indicator, year, tokens }: WorldPanelProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data } = useJson<CommodityFile>(`topics/${topic.id}/commodities.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const colors = [tokens.hues.blue, tokens.hues.orange, tokens.hues.aqua];
    // 年份滑桿最多到 2025 年；commodities 到今年，參考線畫在選的年份
    const shown = Math.min(year, data.years[data.years.length - 1]);
    const at = data.years.indexOf(shown);
    const charts = GROUPS.map((g) => {
      const lines: TimeSeriesLine[] = g.series.map((key, i) => ({
        name: text.names[key],
        values: data.series[key] ?? [],
        color: colors[i],
      }));
      return {
        id: g.id,
        title: text.title(text.group[g.id], text.unit[g.id]),
        aria: text.chartAria(text.group[g.id], text.unit[g.id]),
        spec: timeSeriesOption({ years: data.years, lines, year: shown, indicator: chartIndicator(indicator, text.unit[g.id]), tokens }),
      };
    });
    const groups = GROUPS.map((g) => ({
      id: g.id,
      title: text.title(text.group[g.id], text.unit[g.id]),
      rows: g.series.map((key) => {
        const values = data.series[key] ?? [];
        let peak = -1;
        values.forEach((v, i) => {
          if (v != null && (peak < 0 || v > values[peak]!)) peak = i;
        });
        const v = at >= 0 ? values[at] : null;
        return {
          key,
          name: text.names[key],
          value: v == null ? '—' : num(v),
          peak: peak < 0 ? '—' : text.peak(num(values[peak]!), data.years[peak]),
        };
      }),
    }));
    const [lastYear, lastMonth] = data.lastMonth.split('-').map(Number);
    return { charts, groups, shown, intro: text.intro(lastYear, lastMonth) };
  }, [data, year, indicator, tokens, text]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <p className="note">{view.intro}</p>
      {view.charts.map((c) => (
        <div key={c.id}>
          <h3>{c.title}</h3>
          <Chart spec={c.spec} height={170} ariaLabel={c.aria} />
        </div>
      ))}
      <h3>{text.tableTitle(view.shown)}</h3>
      <table className="mini-table" aria-label={text.tableCaption(view.shown)}>
        <thead>
          <tr>
            <th scope="col">{text.colItem}</th>
            <th scope="col" className="num">
              {text.colYear(view.shown)}
            </th>
            <th scope="col" className="num">
              {text.colPeak}
            </th>
          </tr>
        </thead>
        {view.groups.map((g) => (
          <tbody key={g.id}>
            <tr>
              <th scope="colgroup" colSpan={3}>
                {g.title}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.name}</th>
                <td className="num">{r.value}</td>
                <td className="num">{r.peak}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="note">{text.note}</p>
      <p className="note">{text.hint}</p>
    </section>
  );
}
