import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 《世界幸福報告》用六個因素解釋各國分數的差距；順序跟報告的圖一樣（pipeline/topics/happiness.py 的 FACTORS） */
const FACTORS: { id: string; label: Text; hue: Hue }[] = [
  { id: 'gdp', label: { zh: '人均 GDP', en: 'GDP per capita' }, hue: 'blue' },
  { id: 'social-support', label: { zh: '社會支持', en: 'Social support' }, hue: 'aqua' },
  { id: 'healthy-life', label: { zh: '健康平均壽命', en: 'Healthy life expectancy' }, hue: 'green' },
  { id: 'freedom', label: { zh: '人生選擇的自由', en: 'Freedom to make life choices' }, hue: 'yellow' },
  { id: 'generosity', label: { zh: '慷慨', en: 'Generosity' }, hue: 'orange' },
  { id: 'corruption', label: { zh: '貪腐觀感（越少越好）', en: 'Perceptions of corruption (less is better)' }, hue: 'red' },
  { id: 'dystopia', label: { zh: '反烏托邦基準＋殘差', en: 'Dystopia + residual' }, hue: 'violet' },
];

const FILES = ['rank.json', 'ci-low.json', 'ci-high.json', ...FACTORS.map((f) => `factors/${f.id}.json`)];

const TEXT = defineMessages({
  zh: {
    title: '《世界幸福報告》',
    rank: (edition: number, rank: number, total: number) => `《世界幸福報告 ${edition}》排名第 ${rank} 名（共 ${total} 國）`,
    ci: (low: string, high: string) => `95% 信賴區間 ${low}–${high} 分`,
    split: (year: number) => `${year} 年的分數由哪些因素解釋`,
    listAria: (country: string, year: number) => `${country} ${year} 年生活評價分數的組成`,
    note: '報告用跨國的迴歸，看六個因素各「解釋」了多少分：每一項是這個國家在該因素上比假想的最差國家（反烏托邦）多出的分數，最後一項是反烏托邦的基準分數加上解釋不了的部分（殘差），全部加起來就是生活評價。這是統計上的拆解，不代表因果。',
    noFactors: '這一年沒有因素拆解（報告 2020 年版起才有）。',
    noData: '這個國家沒有《世界幸福報告》的資料。',
  },
  en: {
    title: 'World Happiness Report',
    rank: (edition, rank, total) => `Ranked ${rank} of ${total} in the World Happiness Report ${edition}`,
    ci: (low, high) => `95% confidence interval ${low}–${high}`,
    split: (year) => `What explains the ${year} score`,
    listAria: (country, year) => `Components of the life evaluation score of ${country}, ${year}`,
    note: 'The report uses a cross-country regression to estimate how much of each score six factors "explain": each bar is how far the country is above an imaginary worst-off country (Dystopia) on that factor, and the last bar is the Dystopia baseline plus what the factors leave unexplained (the residual). The bars add up to the life evaluation. It is a statistical breakdown, not a causal one.',
    noFactors: 'No breakdown for this year (available from the 2020 edition of the report).',
    noData: 'No World Happiness Report data for this country.',
  },
});

const points = (v: number) => fixed(v, 2);

export default function HappinessPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const loaded = useJsonMany<IndicatorData>(useMemo(() => FILES.map((f) => `topics/${topic.id}/${f}`), [topic.id]));

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const [rank, low, high, ...factors] = loaded as IndicatorData[];
    const years = rank.years;
    const ranks = rank.values[iso3];
    const index = ranks ? latestIndexAtOrBefore(years, year, (i) => ranks[i] != null) : -1;
    if (index < 0) return { shownYear: null } as const;
    const total = Object.values(rank.values).filter((s) => s[index] != null).length;
    const items = FACTORS.map((f, i) => ({
      key: f.id,
      label: tr(f.label, lang),
      value: factors[i].values[iso3]?.[index] ?? NaN,
      color: tokens.hues[f.hue],
    }));
    const lo = low.values[iso3]?.[index];
    const hi = high.values[iso3]?.[index];
    return {
      shownYear: years[index],
      rank: ranks![index]!,
      total,
      ci: lo != null && hi != null ? [lo, hi] : null,
      items: items.every((item) => Number.isFinite(item.value)) ? items : null,
    } as const;
  }, [loaded, iso3, year, tokens, lang]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.shownYear === null ? (
        <p className="empty">{text.noData}</p>
      ) : (
        <>
          <p className="panel-figure">
            {text.rank(view.shownYear + 1, view.rank, view.total)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </p>
          {view.ci && <p className="note">{text.ci(points(view.ci[0]), points(view.ci[1]))}</p>}
          <h4>{text.split(view.shownYear)}</h4>
          {view.items ? (
            <>
              <BarList
                // 殘差可能是負的：長條畫成 0 寬，數字照寫
                items={view.items}
                format={points}
                ariaLabel={text.listAria(countryName, view.shownYear)}
              />
              <p className="note">{text.note}</p>
            </>
          ) : (
            <p className="empty">{text.noFactors}</p>
          )}
        </>
      )}
    </section>
  );
}
