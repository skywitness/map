import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 溫室氣體排放的 Climate TRACE 指標（climate-trace.ts）的側欄：這一國各部門那一年的排放（trace/<部門>.json）。
 * 時間軸的年份不在 2015–2025 年時用最接近的一年（2026 年比去年同期的指標也是看 2025 年全年）。
 */

const SECTORS = ['power', 'manufacturing', 'fossil-fuels', 'transport', 'buildings', 'agriculture', 'waste', 'fgas', 'mining'] as const;

const TEXT = defineMessages({
  zh: {
    title: 'Climate TRACE 的部門',
    year: (year: number, total: string) => `${year} 年 · 合計 ${total}`,
    note: '單位公噸 CO₂ 當量（AR6）；不含森林與土地利用，也不含取自 EDGAR、CEDS 的二氧化碳（見主題說明）。交通運輸含國際航空與海運。',
    none: 'Climate TRACE 沒有這個國家的資料。',
    power: '電力',
    manufacturing: '製造業',
    'fossil-fuels': '化石燃料的開採與煉製',
    transport: '交通運輸',
    buildings: '建築物的燃料',
    agriculture: '農業',
    waste: '廢棄物',
    fgas: '含氟氣體',
    mining: '礦物開採',
  },
  en: {
    title: 'Climate TRACE by sector',
    year: (year, total) => `${year} · Total ${total}`,
    note: 'Tonnes CO₂e (AR6), excluding forestry and land use and the CO₂ taken from EDGAR and CEDS (see the topic note). Transport includes international aviation and shipping.',
    none: 'Climate TRACE has no data for this country.',
    power: 'Power',
    manufacturing: 'Manufacturing',
    'fossil-fuels': 'Fossil fuel operations',
    transport: 'Transport',
    buildings: 'Fuel burned in buildings',
    agriculture: 'Agriculture',
    waste: 'Waste',
    fgas: 'Fluorinated gases',
    mining: 'Mineral extraction',
  },
});

export default function TracePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useJsonMany<IndicatorData>(SECTORS.map((s) => `topics/${topic.id}/trace/${s}.json`));
  if (files.some((f) => !f)) return <p className="empty">{t.loading}</p>;
  const years = files[0]!.years;
  const shown = Math.min(years[years.length - 1], Math.max(years[0], year));
  const i = years.indexOf(shown);
  const items: BarListItem[] = SECTORS.map((s, k) => ({
    key: s,
    label: text[s],
    value: files[k]!.values[iso3]?.[i] ?? 0,
    color: tokens.accent,
  })).filter((item) => item.value > 0);
  if (!items.length) return <p className="empty">{text.none}</p>;
  items.sort((a, b) => b.value - a.value);
  const total = SECTORS.reduce((sum, _s, k) => sum + (files[k]!.values[iso3]?.[i] ?? 0), 0);
  return (
    <section className="panel-section">
      <div className="panel-subsection">
        <h3>{text.title}</h3>
        <p className="panel-year-note">
          {text.year(shown, formatLargeNumber(total))}
          {shown !== year && <span className="muted">{t.yearMissing(year)}</span>}
        </p>
        <BarList items={items} total={total} format={formatLargeNumber} ariaLabel={`${countryName} · ${text.title}`} />
        <p className="note">{text.note}</p>
      </div>
    </section>
  );
}
