import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 化石燃料基礎建設的側欄（2026-11-07，製作手冊第二十七批 613；pipeline/topics/fossil_infrastructure.py 的 detail.json）：
 * 燃煤機組的指標列各技術的 MW，煤礦的指標列各煤種的產能。
 */
interface Detail {
  countries: Record<string, { tech?: number[]; grades?: number[]; mines?: number }>;
}

const TEXT = defineMessages({
  zh: {
    tech: '運轉中的燃煤發電容量依技術',
    techs: ['亞臨界', '超臨界', '超超臨界', 'IGCC（煤氣化複循環）', '技術不明'],
    grades: (n: number) => `運轉中 ${fixed(n, 0)} 座煤礦的產能依煤種`,
    gradeNames: ['動力煤', '冶金煤（焦煤）', '動力煤與冶金煤', '化工用煤', '煤種不明'],
    mw: (v: number) => `${fixed(v, 0)} MW`,
    mt: (v: number) => `${fixed(v, v < 10 ? 1 : 0)} 百萬公噸`,
    aria: (c: string, k: string) => `${c}：${k}`,
  },
  en: {
    tech: 'Operating coal power capacity by technology',
    techs: ['Subcritical', 'Supercritical', 'Ultra-supercritical', 'IGCC', 'Unknown'],
    grades: (n: number) => `Capacity of ${fixed(n, 0)} operating mines by coal type`,
    gradeNames: ['Thermal', 'Metallurgical (coking)', 'Thermal and metallurgical', 'Chemical', 'Unknown'],
    mw: (v: number) => `${fixed(v, 0)} MW`,
    mt: (v: number) => `${fixed(v, v < 10 ? 1 : 0)} Mt`,
    aria: (c: string, k: string) => `${c}: ${k}`,
  },
});

export default function FossilInfraPanel({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  const row = d?.countries[iso3];
  if (!row) return null;
  if (indicator.id === 'coal-plant-tech' && row.tech) {
    const items: BarListItem[] = row.tech.map((v, i) => ({ key: String(i), label: text.techs[i], value: v })).filter((x) => x.value > 0);
    const total = items.reduce((s, x) => s + x.value, 0);
    return (
      <section className="panel-section">
        <h3>{text.tech}</h3>
        <BarList items={items} format={text.mw} total={total} ariaLabel={text.aria(countryName, text.tech)} />
      </section>
    );
  }
  if ((indicator.id === 'coal-mine-capacity' || indicator.id === 'coal-mine-workforce') && row.grades && row.mines) {
    const items: BarListItem[] = row.grades.map((v, i) => ({ key: String(i), label: text.gradeNames[i], value: v })).filter((x) => x.value > 0);
    if (!items.length) return null;
    const total = items.reduce((s, x) => s + x.value, 0);
    const title = text.grades(row.mines);
    return (
      <section className="panel-section">
        <h3>{title}</h3>
        <BarList items={items} format={text.mt} total={total} ariaLabel={text.aria(countryName, title)} />
      </section>
    );
  }
  return null;
}
