import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { ORG_TYPES } from '../research-orgs';
import type { PanelExtraProps } from '../types';

/**
 * 研究機構主題的側欄（2026-11-07，製作手冊第二十七批 597；pipeline/topics/research_orgs.py 的 detail.json）：
 * 這一國 ROR 機構的類型組成，與機構最多的 10 個城市。
 */
interface Detail {
  types: string[];
  countries: Record<string, { types: number[]; cities: [string, number][] }>;
}

const TEXT = defineMessages({
  zh: {
    types: '機構的類型',
    cities: '機構最多的城市',
    n: (v: number) => `${fixed(v, 0)} 個`,
    aria: (c: string, k: string) => `${c}：${k}`,
  },
  en: {
    types: 'Types of organisation',
    cities: 'Cities with the most organisations',
    n: (v: number) => fixed(v, 0),
    aria: (c: string, k: string) => `${c}: ${k}`,
  },
});

export default function ResearchOrgsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  const row = d?.countries[iso3];
  if (!d || !row) return null;
  const types: BarListItem[] = ORG_TYPES.map((t, i) => ({
    key: t.id,
    label: t.label[lang],
    value: row.types[d.types.indexOf(t.id)] ?? 0,
    color: t.id === 'other' ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[i],
  }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const cities: BarListItem[] = row.cities.map(([name, n]) => ({ key: name, label: name, value: n }));
  const total = types.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <section className="panel-section">
        <h3>{text.types}</h3>
        <BarList items={types} format={text.n} total={total} ariaLabel={text.aria(countryName, text.types)} />
      </section>
      {cities.length > 1 && (
        <section className="panel-section">
          <h3>{text.cities}</h3>
          <BarList items={cities} format={text.n} ariaLabel={text.aria(countryName, text.cities)} properNouns />
        </section>
      )}
    </>
  );
}
