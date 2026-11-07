import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { dataFolder, type PanelExtraProps } from '../types';

/** 內河船隊的建造年份組成（2026-11-07，製作手冊第二十七批 583；pipeline/topics/inland_fleet.py 的 inland-fleet-detail.json） */
interface Detail {
  years: number[];
  countries: Record<string, Record<string, Record<string, (number | null)[]>>>;
}

const AGES = ['le1974', '1975-1999', 'ge2000'] as const;

const TEXT = defineMessages({
  zh: {
    title: (y: number, tug: boolean) => `${y} 年的${tug ? '推拖船' : '自航貨船'}依建造年份`,
    age: { le1974: '1974 年以前', '1975-1999': '1975–1999 年', ge2000: '2000 年以後' },
    aria: (c: string) => `${c}的內河船隊依建造年份`,
    n: (v: number) => `${fixed(v, 0)} 艘`,
    none: 'Eurostat 沒有這一國這一年的建造年份分項。',
  },
  en: {
    title: (y: number, tug: boolean) => `${tug ? 'Tugs and pushers' : 'Self-propelled cargo vessels'} by year built, ${y}`,
    age: { le1974: '1974 or earlier', '1975-1999': '1975–1999', ge2000: '2000 or later' },
    aria: (c: string) => `Inland fleet of ${c} by year of construction`,
    n: (v: number) => fixed(v, 0),
    none: 'Eurostat has no construction-year breakdown for this country and year.',
  },
});

export default function InlandFleetPanel({ topic, indicator, iso3, year, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Detail>(`topics/${dataFolder(topic)}/inland-fleet-detail.json`).data;
  if (!d) return null;
  const tug = indicator.id === 'inland-pushers';
  const row = d.countries[iso3]?.[tug ? 't' : 'b'];
  const i = d.years.indexOf(year);
  const items = AGES.map((a, n) => ({ key: a, label: text.age[a], value: (row && i >= 0 && row[a]?.[i]) || 0, color: MAP_TOKENS.categorical[n] })).filter(
    (x) => x.value > 0,
  );
  return (
    <section className="panel-section">
      <h3>{text.title(year, tug)}</h3>
      {items.length ? (
        <BarList items={items} format={text.n} total={items.reduce((s, x) => s + x.value, 0)} ariaLabel={text.aria(countryName)} />
      ) : (
        <p className="empty">{text.none}</p>
      )}
    </section>
  );
}
