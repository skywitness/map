import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 死因的三大類（WHO Global Health Estimates），加起來是 100% */
const GROUPS: { id: string; label: Text; hue: Hue }[] = [
  { id: 'ncd-deaths-share', label: { zh: '慢性病（非傳染性疾病）', en: 'Chronic (non-communicable) diseases' }, hue: 'blue' },
  {
    id: 'communicable-deaths-share',
    label: { zh: '傳染病、孕產期、新生兒與營養', en: 'Infectious, maternal, neonatal and nutritional' },
    hue: 'orange',
  },
  { id: 'injury-deaths-share', label: { zh: '傷害（事故、自殺、暴力）', en: 'Injuries (accidents, suicide, violence)' }, hue: 'aqua' },
];

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `死因結構（${year} 年）`,
    aria: (country: string) => `${country}的死因結構`,
    world: (parts: string[]) => `世界：${parts.join('、')}。`,
  },
  en: {
    title: (year) => `Causes of death by group (${year})`,
    aria: (country) => `Causes of death by group in ${country}`,
    world: (parts) => `World: ${parts.join(', ')}.`,
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function DiseasePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const files = useMemo(() => GROUPS.map((g) => `topics/${topic.id}/${g.id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const data = loaded as IndicatorData[];
    const own = data.map((d) => d.values[iso3]);
    if (!own.every(Boolean)) return null;
    const years = data[0].years;
    const index = latestIndexAtOrBefore(years, year, (i) => own.every((s) => s![i] != null));
    if (index < 0) return null;
    const world = data.map((d) => d.aggregates?.WLD?.[index] ?? null);
    return {
      year: years[index],
      items: GROUPS.map((g, i) => ({ key: g.id, label: tr(g.label, lang), value: own[i]![index]!, color: tokens.hues[g.hue] })),
      world: world.every((v) => v != null)
        ? GROUPS.map((g, i) => `${tr(g.label, lang)} ${pct(world[i]!)}`)
        : null,
    };
  }, [loaded, iso3, year, tokens, lang]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(view.year)}</h3>
      <BarList items={view.items} format={pct} max={100} ariaLabel={text.aria(countryName)} />
      {view.world && <p className="note">{text.world(view.world)}</p>}
    </section>
  );
}
