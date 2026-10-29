import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Lang, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeTick, formatPercent } from '../../lib/format';
import type { Hue, Tokens } from '../../theme/tokens';
import { count } from '../ev';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/ev.py 輸出的各國組成：新車與保有量的純電／插電式、慢充／快充／超快充 */
interface CompositionFile {
  years: number[];
  values: Partial<Record<SeriesKey, (number | null)[]>>;
}

type SeriesKey =
  | 'sales-bev'
  | 'sales-phev'
  | 'stock-bev'
  | 'stock-phev'
  | 'chargers-slow'
  | 'chargers-fast'
  | 'chargers-ultrafast';

interface Part {
  key: SeriesKey;
  label: Text;
  hue: Hue;
}

interface Row {
  key: SeriesKey;
  label: string;
  /** null 是 IEA 沒有這一項（不是 0） */
  value: number | null;
  color: string;
}

// 標籤要短：側欄約 340 px，還要放數值與占比（英文的「150 kW and above」在 1280 寬會被截斷）
const BEV: Text = { zh: '純電（BEV）', en: 'Battery-electric' };
const PHEV: Text = { zh: '插電式混合（PHEV）', en: 'Plug-in hybrid' };
const SALES: Part[] = [
  { key: 'sales-bev', label: BEV, hue: 'blue' },
  { key: 'sales-phev', label: PHEV, hue: 'orange' },
];
const STOCK: Part[] = [
  { key: 'stock-bev', label: BEV, hue: 'blue' },
  { key: 'stock-phev', label: PHEV, hue: 'orange' },
];
const CHARGERS: Part[] = [
  { key: 'chargers-slow', label: { zh: '慢充（≤22 kW）', en: 'Slow (≤22 kW)' }, hue: 'aqua' },
  { key: 'chargers-fast', label: { zh: '快充（22–150 kW）', en: 'Fast (22–150 kW)' }, hue: 'violet' },
  { key: 'chargers-ultrafast', label: { zh: '超快充（150 kW 以上）', en: 'Ultra-fast (150+ kW)' }, hue: 'red' },
];

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的電動車組成資料。',
    title: '純電與插電式混合',
    chartAria: (country: string) => `${country}歷年電動車新車銷售量（純電、插電式混合）堆疊面積圖`,
    sales: (year: number) => `${year} 年新車`,
    stock: (year: number) => `${year} 年底保有量`,
    salesAria: (country: string, year: number) => `${country}${year} 年電動車新車的組成`,
    stockAria: (country: string, year: number) => `${country}${year} 年底電動車保有量的組成`,
    chargersTitle: '公共充電樁的速度',
    chargers: (year: number) => `${year} 年底`,
    fastShare: (share: string) => `快充與超快充（22 kW 以上）占 ${share}。`,
    chargersAria: (country: string, year: number) => `${country}${year} 年底公共充電樁依充電速度分`,
    partial: 'IEA 沒有其中一項的數字，所以不列占比。',
  },
  en: {
    noCountry: 'No breakdown of electric cars for this country.',
    title: 'Battery-electric and plug-in hybrid',
    chartAria: (country) => `Stacked area chart of new electric car sales in ${country} over time, battery-electric and plug-in hybrid`,
    sales: (year) => `New cars, ${year}`,
    stock: (year) => `On the road, end of ${year}`,
    salesAria: (country, year) => `New electric cars in ${country} by type, ${year}`,
    stockAria: (country, year) => `Electric cars on the road in ${country} by type, end of ${year}`,
    chargersTitle: 'Public chargers by speed',
    chargers: (year) => `End of ${year}`,
    fastShare: (share) => `Fast and ultra-fast (above 22 kW): ${share}.`,
    chargersAria: (country, year) => `Public charging points in ${country} by charging speed, end of ${year}`,
    partial: 'The IEA has no figure for one of the items, so shares are not shown.',
  },
});

const CARS = { zh: '輛', en: 'cars' };
const POINTS = { zh: '個', en: 'chargers' };

/** 占比：很小的寫「<0.1%」，不寫成 0.0% */
function share(value: number, total: number): string {
  const pct = (value / total) * 100;
  if (pct > 0 && pct < 0.1) return `<${formatPercent(0.1, 1)}`;
  return formatPercent(pct, pct < 10 ? 1 : 0);
}

/** 某一組在 year（或之前最近一年有資料的年份）的組成；IEA 沒有的項目是 null，不當成 0 */
function breakdown(data: CompositionFile, parts: Part[], year: number, tokens: Tokens, lang: Lang) {
  const present = parts.filter((p) => data.values[p.key]);
  if (present.length === 0) return null;
  const index = latestIndexAtOrBefore(data.years, year, (i) => present.some((p) => (data.values[p.key]![i] ?? 0) > 0));
  if (index < 0) return null;
  const rows: Row[] = present.map((p) => ({
    key: p.key,
    label: tr(p.label, lang),
    value: data.values[p.key]![index] ?? null,
    color: tokens.hues[p.hue],
  }));
  // 有一項沒有數字時，合計不完整，占比也就不列
  const complete = rows.every((r) => r.value !== null);
  return { year: data.years[index], rows, total: complete ? rows.reduce((sum, r) => sum + r.value!, 0) : null };
}

/** 長條清單，版面同 charts/BarList，但能標出「無資料」與很小的占比 */
function CompositionList({
  rows,
  total,
  format,
  ariaLabel,
}: {
  rows: Row[];
  total: number | null;
  format: (value: number) => string;
  ariaLabel: string;
}) {
  const t = useT();
  const max = Math.max(...rows.map((r) => r.value ?? 0), 0);
  return (
    <ul className="bar-list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className="bar-label">
            <span className="bar-key" style={{ background: row.color }} />
            {row.label}
          </span>
          <span className={row.value === null ? 'bar-value muted' : 'bar-value'}>
            {row.value === null ? t.noData : format(row.value)}
          </span>
          {total !== null && total > 0 && row.value !== null && <span className="bar-share">{share(row.value, total)}</span>}
          <span className="bar-track" aria-hidden="true">
            {row.value !== null && (
              <span
                className="bar-fill"
                style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%`, background: row.color }}
              />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function EvPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<CompositionFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const cars = (v: number) => `${count(v)} ${tr(CARS, lang)}`;
    const sales = SALES.filter((p) => data.values[p.key]);
    const option =
      sales.length > 0
        ? stackedAreaOption({
            years: data.years,
            series: sales.map((p) => ({ name: tr(p.label, lang), values: data.values[p.key]!, color: tokens.hues[p.hue] })),
            year,
            format: cars,
            formatTick: formatLargeTick,
            tokens,
          })
        : null;
    return {
      cars,
      points: (v: number) => `${count(v)} ${tr(POINTS, lang)}`,
      option,
      sales: breakdown(data, SALES, year, tokens, lang),
      stock: breakdown(data, STOCK, year, tokens, lang),
      chargers: breakdown(data, CHARGERS, year, tokens, lang),
    };
  }, [data, year, tokens, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const chargers = view.chargers;
  const fast = chargers?.rows.filter((r) => r.key !== 'chargers-slow').reduce((sum, r) => sum + (r.value ?? 0), 0) ?? 0;
  const partial = [view.sales, view.stock].some((b) => b && b.total === null);
  return (
    <>
      {(view.option || view.sales || view.stock) && (
        <section className="panel-section">
          <h3>{text.title}</h3>
          {view.option && <Chart spec={view.option} height={200} ariaLabel={text.chartAria(countryName)} />}
          {view.sales && (
            <>
              <h4>
                {text.sales(view.sales.year)}
                {view.sales.year !== year && <span className="muted">{t.yearMissing(year)}</span>}
              </h4>
              <CompositionList
                rows={view.sales.rows}
                total={view.sales.total}
                format={view.cars}
                ariaLabel={text.salesAria(countryName, view.sales.year)}
              />
            </>
          )}
          {view.stock && (
            <>
              <h4>
                {text.stock(view.stock.year)}
                {view.stock.year !== year && <span className="muted">{t.yearMissing(year)}</span>}
              </h4>
              <CompositionList
                rows={view.stock.rows}
                total={view.stock.total}
                format={view.cars}
                ariaLabel={text.stockAria(countryName, view.stock.year)}
              />
            </>
          )}
          {partial && <p className="note">{text.partial}</p>}
        </section>
      )}
      {chargers && (
        <section className="panel-section">
          <h3>{text.chargersTitle}</h3>
          <h4>
            {text.chargers(chargers.year)}
            {chargers.year !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <CompositionList
            rows={chargers.rows}
            total={chargers.total}
            format={view.points}
            ariaLabel={text.chargersAria(countryName, chargers.year)}
          />
          {chargers.total !== null && chargers.total > 0 ? (
            <p className="note">{text.fastShare(share(fast, chargers.total))}</p>
          ) : (
            chargers.total === null && <p className="note">{text.partial}</p>
          )}
        </section>
      )}
    </>
  );
}
