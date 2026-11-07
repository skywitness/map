import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { GLWD_CLASSES, groupOfClass } from '../wetlands';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/wetlands.py 的 classes.json（2026-11-07，製作手冊 549）：陸地、濕地合計與面積最大的 10 類 [類別, km²] */
interface Classes {
  countries: Record<string, { land: number; wet: number; top: [number, number][] }>;
}

const TEXT = defineMessages({
  zh: {
    title: '面積最大的濕地類別',
    aria: (country: string) => `${country}面積最大的濕地類別`,
    km2: (v: number) => `${fixed(v, 0)} km²`,
    note: (wet: string, land: string) =>
      `濕地合計 ${wet}、陸地 ${land}。長條的顏色是地圖上的 7 組；每格的濕地面積都算給那一格面積最大的一類，所以各類是近似值。`,
    none: 'GLWD 在這裡沒有濕地。',
  },
  en: {
    title: 'Largest wetland classes',
    aria: (country) => `Largest wetland classes in ${country}`,
    km2: (v) => `${fixed(v, 0)} km²`,
    note: (wet, land) =>
      `Wetlands total ${wet} of ${land} of land. Bar colours are the seven groups on the map; each cell’s wetland area is credited to its dominant class, so class areas are approximate.`,
    none: 'GLWD records no wetlands here.',
  },
});

export default function WetlandsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<Classes>(`topics/${topic.id}/classes.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const row = data.countries[iso3];
  if (!row) return null;
  const items = row.top.map(([cls, km2]) => ({
    key: String(cls),
    label: tr(GLWD_CLASSES[cls] ?? { zh: String(cls), en: String(cls) }, lang),
    value: km2,
    color: groupOfClass(cls)?.color,
  }));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {items.length > 0 ? (
        <BarList items={items} format={text.km2} total={row.land} ariaLabel={text.aria(countryName)} />
      ) : (
        <p className="empty">{text.none}</p>
      )}
      <p className="note">{text.note(text.km2(row.wet), text.km2(row.land))}</p>
    </section>
  );
}
