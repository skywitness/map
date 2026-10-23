import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { categoryScale } from '../../map/categories';
import { MAP_TOKENS } from '../../theme/tokens';
import { BEVERAGE_CATEGORIES } from '../tobacco-alcohol';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 各類酒有登記的人均消費量（pipeline/topics/tobacco_alcohol.py 的 BEVERAGES），順序是畫面上的順序。
 * code 是「主要酒類」的代碼：長條的顏色跟地圖上的類別色一樣
 */
const TYPES: { id: string; label: Text; code: number }[] = [
  { id: 'beer', label: { zh: '啤酒', en: 'Beer' }, code: 1 },
  { id: 'wine', label: { zh: '葡萄酒', en: 'Wine' }, code: 2 },
  { id: 'spirits', label: { zh: '烈酒', en: 'Spirits' }, code: 3 },
  { id: 'other', label: { zh: '其他', en: 'Other' }, code: 4 },
];
const MAP_COLORS = categoryScale({ categories: BEVERAGE_CATEGORIES.map((c) => ({ value: c.value, label: '' })) }, MAP_TOKENS);

const TEXT = defineMessages({
  zh: {
    title: '喝的是哪一種酒',
    split: (year: number) => `${year} 年有登記的人均消費量（純酒精）`,
    listAria: (country: string, year: number) => `${country} ${year} 年各類酒的人均消費量`,
    note: '只算有登記的銷售量（生產加進口減出口，或稅務、業界的銷售統計），不含自釀、走私酒，所以加起來可能比「人均飲酒量」少。「其他」含各地的傳統釀造酒、米酒、蘋果酒等。',
    noData: '沒有這個國家各類酒的消費量資料。',
  },
  en: {
    title: 'What people drink',
    split: (year) => `Recorded consumption per person, ${year} (pure alcohol)`,
    listAria: (country, year) => `Recorded consumption of each type of drink per person in ${country}, ${year}`,
    note: 'Recorded sales only (production plus imports minus exports, or tax and industry sales figures), excluding home-made and smuggled drinks, so the total can be lower than "alcohol consumption". "Other" covers traditional brews, rice wine, cider and so on.',
    noData: 'No data on types of drink for this country.',
  },
});

const litres = (v: number) => tr({ zh: `${fixed(v, 2)} 公升`, en: `${fixed(v, 2)} l` });

export default function TobaccoAlcoholPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => TYPES.map((p) => `topics/${topic.id}/beverage/${p.id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const data = loaded as IndicatorData[];
    const series = data.map((d) => d.values[iso3]);
    const years = data[0].years;
    const index = latestIndexAtOrBefore(years, year, (i) => series.some((s) => s?.[i] != null));
    if (index < 0) return { items: [], total: 0, shownYear: null };
    const items = TYPES.map((p, i) => ({
      key: p.id,
      label: tr(p.label, lang),
      value: series[i]?.[index] ?? 0,
      color: MAP_COLORS.color(p.code) ?? undefined,
    })).filter((item) => item.value > 0);
    return { items, total: items.reduce((sum, item) => sum + item.value, 0), shownYear: years[index] };
  }, [loaded, iso3, year, lang]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.shownYear === null || view.items.length === 0 ? (
        <p className="empty">{text.noData}</p>
      ) : (
        <>
          <h4>
            {text.split(view.shownYear)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <BarList items={view.items} format={litres} total={view.total} ariaLabel={text.listAria(countryName, view.shownYear)} />
          <p className="note">{text.note}</p>
        </>
      )}
    </section>
  );
}
