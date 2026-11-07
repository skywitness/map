import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 科學家流動的側欄（2026-11-07，製作手冊第二十七批 600；pipeline/topics/scientist_mobility.py 的 flows.json）：
 * 這一國前 10 個來源與去向（流入、流出與淨流入的人數卡片上已經有）：淨流入的兩個指標兩邊都列，流向指標只列它那一邊。
 */
interface Flows {
  export: Record<string, [number, [string, number][]]>;
  import: Record<string, [number, [string, number][]]>;
}

const TEXT = defineMessages({
  zh: {
    from: '流入的科學家從哪裡來（2010–2024 年）',
    to: '流出的科學家去了哪裡',
    n: (v: number) => `${fixed(v, 0)} 人`,
    aria: (c: string, k: string) => `${c}：${k}`,
  },
  en: {
    from: 'Where incoming scientists came from (2010–2024)',
    to: 'Where departing scientists went',
    n: (v: number) => fixed(v, 0),
    aria: (c: string, k: string) => `${c}: ${k}`,
  },
});

export default function ScientistMobilityPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Flows>(`topics/${topic.id}/flows.json`).data;
  const countries = useJson<CountryTable>('countries.json').data;
  if (!d) return null;
  const inn = indicator.id === 'scientists-out' ? undefined : d.import[iso3];
  const out = indicator.id === 'scientists-in' ? undefined : d.export[iso3];
  if (!inn && !out) return null;
  const name = (c: string) => nameOf(c, countries, lang);
  const bars = (rows: [string, number][] | undefined): BarListItem[] => (rows ?? []).slice(0, 10).map(([c, v]) => ({ key: c, label: name(c), value: v }));
  return (
    <section className="panel-section">
      {inn && (
        <>
          <h3>{text.from}</h3>
          <BarList items={bars(inn[1])} format={text.n} ariaLabel={text.aria(countryName, text.from)} />
        </>
      )}
      {out && (
        <>
          <h3>{text.to}</h3>
          <BarList items={bars(out[1])} format={text.n} ariaLabel={text.aria(countryName, text.to)} />
        </>
      )}
    </section>
  );
}
