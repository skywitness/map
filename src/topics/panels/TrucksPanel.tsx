import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * 貨車依動力的組成（2026-11-07，製作手冊第二十七批 577；pipeline/topics/trucks_buses.py 的 trucks-energy.json）：
 * 這一國那一年的輕型貨車與重型卡車，柴油、汽油（都不含油電混合）、電、油電混合、天然氣、LPG、其他，互不重疊。
 */
interface Energy {
  years: number[];
  countries: Record<string, { l?: Record<string, (number | null)[]>; h?: Record<string, (number | null)[]> }>;
}

const KINDS = ['diesel', 'petrol', 'electric', 'hybrid', 'gas', 'lpg', 'other'] as const;

const TEXT = defineMessages({
  zh: {
    light: (y: number) => `${y} 年的輕型貨車依動力`,
    heavy: (y: number) => `${y} 年的重型卡車依動力`,
    aria: (c: string, heavy: boolean) => `${c}的${heavy ? '重型卡車' : '輕型貨車'}依動力`,
    kind: { diesel: '柴油', petrol: '汽油', electric: '電動', hybrid: '油電混合', gas: '天然氣', lpg: '液化石油氣', other: '其他' },
    n: (v: number) => `${formatLargeNumber(v)} 輛`,
    none: 'Eurostat 沒有這一國這一年依動力的貨車數（只有歐洲各國，2013 年起）。',
  },
  en: {
    light: (y: number) => `Light goods vehicles by motor energy, ${y}`,
    heavy: (y: number) => `Heavy lorries by motor energy, ${y}`,
    aria: (c: string, heavy: boolean) => `${heavy ? 'Heavy lorries' : 'Light goods vehicles'} in ${c} by motor energy`,
    kind: { diesel: 'Diesel', petrol: 'Petrol', electric: 'Electric', hybrid: 'Hybrid', gas: 'Natural gas', lpg: 'LPG', other: 'Other' },
    n: (v: number) => formatLargeNumber(v),
    none: 'Eurostat has no lorry counts by motor energy for this country and year (European countries only, from 2013).',
  },
});

export function TrucksSection({ indicator, iso3, year, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  // 指標檔是 ../road-safety/…（汽機車併在汽機車與電動車）：側欄的檔跟著指標的資料夾
  const folder = indicator.file.startsWith('../') ? indicator.file.split('/')[1] : 'road-safety';
  const d = useJson<Energy>(`topics/${folder}/trucks-energy.json`).data;
  if (!d) return null;
  const i = d.years.indexOf(year);
  const row = d.countries[iso3];
  const sections = (['l', 'h'] as const).map((k) => {
    const src = row?.[k];
    const items = KINDS.map((kind, n) => ({
      key: kind,
      label: text.kind[kind],
      value: (i >= 0 && src?.[kind]?.[i]) || 0,
      color: kind === 'other' ? MAP_TOKENS.categoricalOther : MAP_TOKENS.categorical[n],
    })).filter((x) => x.value > 0);
    return { k, items };
  });
  if (sections.every((s) => !s.items.length)) return <p className="empty">{text.none}</p>;
  return (
    <>
      {sections.map(({ k, items }) =>
        items.length ? (
          <section className="panel-section" key={k}>
            <h3>{k === 'h' ? text.heavy(year) : text.light(year)}</h3>
            <BarList items={items} format={text.n} total={items.reduce((s, x) => s + x.value, 0)} ariaLabel={text.aria(countryName, k === 'h')} />
          </section>
        ) : null,
      )}
    </>
  );
}
