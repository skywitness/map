import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { CONSTELLATIONS, GNSS_SYSTEMS, ORBIT_LAYERS } from '../space-orbits';
import type { PanelExtraProps } from '../types';

/**
 * 軌道、巨型星座與衛星導航的側欄（2026-11-07，製作手冊第二十七批 605；pipeline/topics/space_orbits.py 的 space-orbits-detail.json）：
 * 軌道層的指標列這一國各層的顆數，巨型星座列各星座，衛星導航列這一國的系統與全世界六個系統的在軌顆數。
 */
interface Detail {
  year: number;
  gnss: Record<string, number>;
  countries: Record<string, { layers?: number[]; mega?: Record<string, number>; gnss?: Record<string, number> }>;
}

const TEXT = defineMessages({
  zh: {
    layers: (y: number) => `${y} 年在軌的酬載依軌道層`,
    mega: '各星座在軌的衛星',
    gnss: '六個衛星導航系統在軌的衛星（含已停用的）',
    n: (v: number) => `${fixed(v, 0)} 顆`,
    aria: (c: string, k: string) => `${c}：${k}`,
  },
  en: {
    layers: (y: number) => `Payloads in orbit in ${y} by layer`,
    mega: 'Satellites in orbit by constellation',
    gnss: 'Satellites in orbit in the six navigation systems (including defunct ones)',
    n: (v: number) => fixed(v, 0),
    aria: (c: string, k: string) => `${c}: ${k}`,
  },
});

export default function SpaceOrbitsPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/space-orbits-detail.json`).data;
  if (!d) return null;
  const row = d.countries[iso3];
  if (indicator.id === 'gnss') {
    const own = new Set(Object.keys(row?.gnss ?? {}));
    const items: BarListItem[] = GNSS_SYSTEMS.map((s) => ({
      key: s.id,
      label: s.label[lang],
      value: d.gnss[s.id] ?? 0,
      color: own.has(s.id) ? MAP_TOKENS.categorical[0] : MAP_TOKENS.categoricalOther,
    }));
    return (
      <section className="panel-section">
        <h3>{text.gnss}</h3>
        <BarList items={items} format={text.n} ariaLabel={text.aria(countryName, text.gnss)} />
      </section>
    );
  }
  if (indicator.id === 'megaconstellations') {
    if (!row?.mega) return null;
    const items: BarListItem[] = CONSTELLATIONS.filter((c) => row.mega?.[c.id]).map((c) => ({ key: c.id, label: c.label[lang], value: row.mega![c.id] }));
    return (
      <section className="panel-section">
        <h3>{text.mega}</h3>
        <BarList items={items} format={text.n} ariaLabel={text.aria(countryName, text.mega)} />
      </section>
    );
  }
  if (!row?.layers) return null;
  const total = row.layers.reduce((s, v) => s + v, 0);
  const items: BarListItem[] = ORBIT_LAYERS.map((l, i) => ({
    key: String(l.value),
    label: typeof l.label === 'string' ? l.label : l.label[lang],
    value: row.layers![i] ?? 0,
  })).filter((x) => x.value > 0);
  return (
    <section className="panel-section">
      <h3>{text.layers(d.year)}</h3>
      <BarList items={items} format={text.n} total={total} ariaLabel={text.aria(countryName, text.layers(d.year))} />
    </section>
  );
}
