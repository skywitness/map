import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 農田的養分流失的側欄（2026-11-07，第二十五批 484）：這一國那一年每公頃耕地的氮收支——輸入 5 項、作物帶走、
 * 盈餘與其中淋溶、揮發的量（長條的長度都對輸入總量）。資料是 pipeline/topics/nutrients.py 輸出的 budget/{iso3}.json，
 * items 的順序：化肥、糞肥、生物固氮、大氣沉降、種子、作物收穫、殘體移除、淋溶、揮發（公斤/公頃）
 */
interface BudgetFile {
  items: string[];
  years: Record<string, (number | null)[]>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年每公頃耕地的氮收支`,
    inputs: '輸入',
    outputs: '去向',
    labels: ['化肥', '糞肥', '生物固氮', '大氣沉降', '種子'],
    harvest: '作物收穫帶走',
    surplus: '盈餘（留在環境裡）',
    leach: '其中淋溶到地下水',
    volat: '其中揮發到空氣',
    total: (v: string) => `輸入合計 ${v} 公斤`,
    residue: (v: string) => `另有殘體移除 ${v} 公斤，不算進輸出。`,
    none: '這個國家沒有氮收支的資料。',
    kg: (v: string) => `${v} 公斤`,
  },
  en: {
    title: (y: number) => `Nitrogen budget per hectare of cropland, ${y}`,
    inputs: 'Inputs',
    outputs: 'Where it goes',
    labels: ['Mineral fertiliser', 'Manure', 'Biological fixation', 'Atmospheric deposition', 'Seed'],
    harvest: 'Removed in harvest',
    surplus: 'Surplus (left in the environment)',
    leach: 'of which leached to groundwater',
    volat: 'of which volatilised to air',
    total: (v: string) => `Total input ${v} kg`,
    residue: (v: string) => `A further ${v} kg is removed as crop residues and not counted as output.`,
    none: 'No nitrogen budget for this country.',
    kg: (v: string) => `${v} kg`,
  },
});

export default function NutrientsPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<BudgetFile>(`topics/${topic.id}/budget/${iso3}.json`);
  if (error) return <p className="empty">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const years = Object.keys(data.years).map(Number).sort((a, b) => a - b);
  if (!years.length) return <p className="empty">{text.none}</p>;
  // 選的年份沒有收支（Flag X 的那幾年）時用不晚於它的最近一年，都沒有用最早一年
  const y = [...years].reverse().find((v) => year == null || v <= year) ?? years[0];
  const [fert, manure, fix, dep, seed, harvest, residue, leach, volat] = data.years[String(y)];
  const inputs = [fert, manure, fix, dep, seed].map((v) => v ?? 0);
  const total = inputs.reduce((a, b) => a + b, 0);
  const surplus = total - (harvest ?? 0);
  const width = (v: number) => `${total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0}%`;
  const row = (label: string, v: number, color: string) => (
    <li key={label}>
      <span className="bar-label">{label}</span>
      <span className="bar-value">{text.kg(fixed(v, 1))}</span>
      <span className="bar-track" aria-hidden="true">
        <span className="bar-fill" style={{ width: width(v), background: color }} />
      </span>
    </li>
  );
  return (
    <section className="panel-section">
      <h3>{text.title(y)}</h3>
      <p className="note">{text.inputs} · {text.total(fixed(total, 1))}</p>
      <ul className="bar-list">{inputs.map((v, i) => row(text.labels[i], v, tokens.hues.green))}</ul>
      <p className="note">{text.outputs}</p>
      <ul className="bar-list">
        {row(text.harvest, harvest ?? 0, tokens.hues.blue)}
        {row(text.surplus, surplus, tokens.hues.orange)}
        {leach != null && row(text.leach, leach, tokens.hues.orange)}
        {volat != null && row(text.volat, volat, tokens.hues.orange)}
      </ul>
      {residue != null && residue > 0 && <p className="note">{text.residue(fixed(residue, 1))}</p>}
    </section>
  );
}
