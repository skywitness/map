import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/diet.py 輸出的各國熱量來源（每人每日大卡） */
interface CaloriesFile {
  years: number[];
  methodBreak?: number;
  groups: string[];
  values: Record<string, (number | null)[]>;
}

// 堆疊由下而上：動物性在下面（前三層加起來接近動物性食物占的熱量），植物性在上，「其他」最上面。
// 配色沿用發電結構驗證過的相鄰順序（紅、紫、橘、青綠、藍、洋紅、黃、綠），相鄰兩層在色盲模擬下也分得開。
const GROUPS: Record<string, { label: Text; hue: Hue | null }> = {
  meat: { label: { zh: '肉類（含內臟）', en: 'Meat (incl. offal)' }, hue: 'red' },
  fish: { label: { zh: '水產', en: 'Fish and seafood' }, hue: 'violet' },
  'dairy-eggs': { label: { zh: '乳品與蛋', en: 'Dairy and eggs' }, hue: 'orange' },
  fats: { label: { zh: '油脂（植物油、動物油脂）', en: 'Oils and fats (vegetable and animal)' }, hue: 'aqua' },
  sugar: { label: { zh: '糖與甜味劑', en: 'Sugar and sweeteners' }, hue: 'blue' },
  roots: { label: { zh: '薯類', en: 'Starchy roots' }, hue: 'magenta' },
  cereals: { label: { zh: '穀物', en: 'Cereals' }, hue: 'yellow' },
  'fruit-veg': { label: { zh: '蔬菜水果', en: 'Fruit and vegetables' }, hue: 'green' },
  other: { label: { zh: '其他（豆類、堅果、酒類等）', en: 'Other (pulses, nuts, alcohol, etc.)' }, hue: null },
};

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的熱量來源資料。',
    title: '熱量從哪裡來',
    chartAria: (country: string) => `${country}歷年各類食物提供的熱量堆疊面積圖`,
    byGroup: (year: number) => `${year} 年各類食物提供的熱量`,
    listAria: (country: string, year: number) => `${country}${year} 年的熱量來源`,
    other: '「其他」包含乾豆類、堅果、油料作物、酒類、咖啡茶與香料等。',
  },
  en: {
    noCountry: 'No calorie data by food group for this country.',
    title: 'Where the calories come from',
    chartAria: (country) => `Stacked area chart of calories by food group in ${country} over time`,
    byGroup: (year) => `Calories by food group, ${year}`,
    listAria: (country, year) => `Sources of calories in ${country}, ${year}`,
    other: '“Other” covers pulses, nuts, oil crops, alcoholic beverages, coffee, tea, spices and more.',
  },
});

const kcal = (v: number) => `${fixed(v, 0)} ${tr({ zh: '大卡', en: 'kcal' })}`;

export default function DietPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<CaloriesFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const label = (group: string) => tr(GROUPS[group].label, lang);
    const color = (group: string) => {
      const hue = GROUPS[group].hue;
      return hue ? tokens.hues[hue] : tokens.context;
    };
    // 新版糧食平衡表沒有的國家（例如日本）2010 年以後全是空的，圖只畫到有資料的最後一年
    const last = latestIndexAtOrBefore(data.years, Infinity, (i) => data.groups.some((g) => data.values[g][i] != null));
    if (last < 0) return null;
    const years = data.years.slice(0, last + 1);
    const series = data.groups.map((g) => ({ name: label(g), values: data.values[g].slice(0, last + 1), color: color(g) }));
    const index = latestIndexAtOrBefore(years, year, (i) => data.groups.some((g) => (data.values[g][i] ?? 0) > 0));
    const items = data.groups
      .map((g) => ({ key: g, label: label(g), value: data.values[g][index] ?? 0, color: color(g) }))
      .filter((item) => item.value > 0);
    const option = stackedAreaOption({
      years,
      series,
      year,
      methodBreak: data.methodBreak,
      format: kcal,
      formatTick: (v) => fixed(v, 0),
      tokens,
    });
    return { option, items, shownYear: index >= 0 ? years[index] : null, methodBreak: data.methodBreak };
  }, [data, year, tokens, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  if (!view) return <p className="empty">{text.noCountry}</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  // 長條依熱量由大到小排，顏色跟堆疊圖一致
  const sorted = [...view.items].sort((a, b) => b.value - a.value);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <EChart option={view.option} height={220} ariaLabel={text.chartAria(countryName)} />
      {view.methodBreak !== undefined && view.option && <p className="note">{t.methodBreak(view.methodBreak)}</p>}
      {view.shownYear !== null && total > 0 && (
        <>
          <h4>
            {text.byGroup(view.shownYear)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <BarList items={sorted} format={kcal} total={total} ariaLabel={text.listAria(countryName, view.shownYear)} />
          <p className="note">{text.other}</p>
        </>
      )}
    </section>
  );
}
