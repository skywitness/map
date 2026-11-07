import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 實質利率與食物價格通膨的側欄（2026-11-07，第二十五批 461）：
 * - 實質利率：名目放款利率、GDP 平減指數變動率、實質利率三條線（real-interest-rate/lending.json、deflator.json）；
 * - 食物價格通膨：食物與總指數的年增率兩條線（food-inflation/food.json、general.json，FAOSTAT；台灣是主計總處）。
 * 資料是 pipeline/topics/prices_food_rates.py 輸出到 fiscal/ 的
 */
const TEXT = defineMessages({
  zh: {
    rateTitle: '放款利率、通膨與實質利率',
    lending: '放款利率',
    deflator: '通膨（GDP 平減指數）',
    real: '實質利率',
    rateNote: '實質利率約等於放款利率減通膨；兩條線差距越大，借錢的實際成本越高。',
    foodTitle: '食物與整體物價的年增率',
    food: '食物',
    general: '整體（總指數）',
    foodNote: '食物的線在整體上面，表示吃的東西漲得比較快。',
    none: '這個國家沒有資料。',
  },
  en: {
    rateTitle: 'Lending rate, inflation and the real rate',
    lending: 'Lending rate',
    deflator: 'Inflation (GDP deflator)',
    real: 'Real interest rate',
    rateNote: 'The real rate is roughly the lending rate minus inflation; the wider the gap, the more borrowing really costs.',
    foodTitle: 'Food and overall price inflation',
    food: 'Food',
    general: 'All items',
    foodNote: 'When the food line is above the other, food prices are rising faster.',
    none: 'No data for this country.',
  },
});

const FILES = {
  'real-interest-rate': ['real-interest-rate/lending', 'real-interest-rate/deflator', 'real-interest-rate'],
  'food-inflation': ['food-inflation/food', 'food-inflation/general'],
} as const;

export default function PricesRatesPanel({ topic, indicator, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const isRate = indicator.id === 'real-interest-rate';
  const files = FILES[isRate ? 'real-interest-rate' : 'food-inflation'];
  const paths = useMemo(() => files.map((f) => `topics/${topic.dataTopic ?? topic.id}/${f}.json`), [files, topic.dataTopic, topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);

  const option = useMemo(() => {
    if (!loaded.every(Boolean)) return undefined;
    const years = loaded[0]!.years;
    const own = loaded.map((d) => d!.values[iso3] ?? []);
    // 從主要那條線（實質利率、食物）有值的第一年畫起：巴西 1990 年代的惡性通膨（平減指數 2,700%）會把線壓扁
    const main = own[isRate ? 2 : 0];
    const has = (i: number) => own.some((v) => v[i] != null);
    const first = years.findIndex((_, i) => main[i] != null);
    if (first < 0) return null;
    let last = years.length - 1;
    while (!has(last)) last--;
    const names = isRate ? [text.lending, text.deflator, text.real] : [text.food, text.general];
    const colors = isRate ? [tokens.hues.orange, tokens.inkMuted, tokens.hues.blue] : [tokens.hues.orange, tokens.hues.blue];
    return timeSeriesOption({
      years: years.slice(first, last + 1),
      lines: own.map((v, i) => ({ name: names[i], values: v.slice(first, last + 1), color: colors[i] })),
      year,
      indicator: { ...indicator, format: (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v) >= 100 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)}%` },
      tokens,
      sparse: isRate,
    });
  }, [loaded, iso3, year, indicator, tokens, text, isRate]);

  if (option === undefined) return <p className="empty">{t.loading}</p>;
  const title = isRate ? text.rateTitle : text.foodTitle;
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      {option ? (
        <>
          <Chart spec={option} height={200} ariaLabel={title} />
          <p className="note">{isRate ? text.rateNote : text.foodNote}</p>
        </>
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );
}
