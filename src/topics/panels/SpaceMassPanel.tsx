import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { tonnes } from '../space-mass';
import type { PanelExtraProps } from '../types';

/**
 * 在軌質量與再入的側欄（2026-11-07，製作手冊第二十七批 604；pipeline/topics/space_mass.py 的 space-mass-detail.json）：
 * 質量的指標列這一國現在在軌最重的 10 顆酬載，再入的指標列最近再入的 10 個物體。
 */
interface Detail {
  countries: Record<string, { heavy: [string, number, number, string][]; recent: [string, string, string][] }>;
}

const TYPES: Record<string, { zh: string; en: string }> = {
  P: { zh: '酬載', en: 'payload' },
  R: { zh: '火箭殘骸', en: 'rocket body' },
  D: { zh: '碎片', en: 'debris' },
  C: { zh: '零件', en: 'component' },
};

const TEXT = defineMessages({
  zh: {
    heavy: '現在在軌最重的酬載',
    recent: '最近再入的物體',
    est: '＊是 GCAT 估計的質量；軌道是 GCAT 的軌道類別（LEO 低軌道、GEO 同步軌道等）。',
    aria: (c: string, k: string) => `${c}：${k}`,
    none: '這一國沒有再入的編目物體。',
  },
  en: {
    heavy: 'Heaviest payloads now in orbit',
    recent: 'Most recent re-entries',
    est: '* Mass estimated by GCAT. The orbit is GCAT’s orbit class (LEO low Earth orbit, GEO geostationary and so on).',
    aria: (c: string, k: string) => `${c}: ${k}`,
    none: 'No catalogued objects of this country have re-entered.',
  },
});

export default function SpaceMassPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/space-mass-detail.json`).data;
  if (!d) return null;
  const row = d.countries[iso3];
  if (indicator.id === 'in-orbit-mass') {
    if (!row?.heavy.length) return null;
    const items: BarListItem[] = row.heavy.map(([name, kg, est, orbit], i) => ({
      key: `${name}-${i}`,
      label: `${name}${est ? '*' : ''}${orbit && orbit !== '-' ? ` · ${orbit}` : ''}`,
      value: kg,
    }));
    return (
      <section className="panel-section">
        <h3>{text.heavy}</h3>
        <BarList items={items} format={(v) => tonnes(v)} ariaLabel={text.aria(countryName, text.heavy)} properNouns />
        <p className="note">{text.est}</p>
      </section>
    );
  }
  return (
    <section className="panel-section">
      <h3>{text.recent}</h3>
      {row?.recent.length ? (
        <ul className="plain-list">
          {row.recent.map(([date, name, type], i) => (
            <li key={i}>
              <span translate="no">{name}</span> · {TYPES[type]?.[lang] ?? type} · {date}
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">{text.none}</p>
      )}
    </section>
  );
}
