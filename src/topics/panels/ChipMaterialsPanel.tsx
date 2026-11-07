import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { MATERIAL_LABELS, MEASURE_LABELS } from '../chip-materials';
import type { PanelExtraProps } from '../types';

/**
 * 晶片原料管制的側欄（2026-11-07，製作手冊第二十七批 594；pipeline/topics/chip_materials.py 的 detail.json）：
 * 這一國那一年的措施，同一種材料、同一類措施併成一列（幾項、最早的開始日期），嚴的排前面。
 */
interface Detail {
  years: number[];
  countries: Record<string, Record<string, [string, string, number, string][]>>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年管了哪些材料`,
    head: ['材料', '措施', '項', '最早開始'],
    none: (y: number) => `${y} 年清冊裡沒有這一國對這些材料的出口限制。`,
    note: '一項是對一個 HS 碼的一種限制；開始日期是清冊記的「Date of introduction」（日／月／年）。',
  },
  en: {
    title: (y: number) => `Materials restricted, ${y}`,
    head: ['Material', 'Measure', 'No.', 'Since'],
    none: (y: number) => `No restrictions on these materials for this country in the ${y} inventory.`,
    note: 'One measure is one restriction on one HS code; the start date is the inventory’s “date of introduction” (day/month/year).',
  },
});

export default function ChipMaterialsPanel({ topic, iso3, year }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  if (!d) return null;
  const y = Math.min(year, d.years[d.years.length - 1]);
  const rows = d.countries[iso3]?.[String(y)];
  if (!rows) return d.countries[iso3] ? <p className="empty">{text.none(y)}</p> : null;
  return (
    <section className="panel-section">
      <h3>{text.title(y)}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            {text.head.map((h, i) => (
              <th key={h} className={i >= 2 ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([material, type, n, since]) => (
            <tr key={`${material}-${type}`}>
              <td>{MATERIAL_LABELS[material]?.[lang] ?? material}</td>
              <td>{MEASURE_LABELS[type]?.[lang] ?? type}</td>
              <td className="num">{n}</td>
              <td className="num">{since}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
