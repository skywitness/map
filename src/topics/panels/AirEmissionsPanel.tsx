import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 空氣品質主題的排放量側欄（2026-11-07，第二十五批 483）：看「空氣污染物的排放量」「每人的空氣污染物排放」時，
 * 列出這一國這種污染物最新一年的部門組成（長條）與最高的那一年、比高峰少了幾 %。
 * 資料是 pipeline/topics/air_emissions.py 輸出的 emissions-detail.json（s 依 groups 的順序，% 取整數；p 高峰年；c 變化 %）
 */
interface DetailFile {
  year: number;
  groups: string[];
  countries: Record<string, Record<string, { s: number[]; p: number; c: number | null }>>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年的排放來自哪裡`,
    groups: {
      power: '發電與供熱',
      fuel: '能源業（煉油、採礦、逸散）',
      industry: '工業（燃燒與製程）',
      transport: '交通運輸',
      buildings: '住宅與商業',
      agriculture: '農業',
      waste: '廢棄物與污水',
      other: '其他',
    } as Record<string, string>,
    peak: (p: number, c: string) => `1970 年以來最高是 ${p} 年，最新一年比那時 ${c}。`,
    atPeak: '最新一年就是 1970 年以來最高。',
    none: '這個國家沒有 CEDS 的部門資料。',
    note: 'CEDS 的部門（33 類）併成 8 大類；國際航空與航運不算在任何國家。',
  },
  en: {
    title: (y: number) => `Where emissions came from in ${y}`,
    groups: {
      power: 'Power and heat',
      fuel: 'Fuel production (refining, mining, leaks)',
      industry: 'Industry (combustion and processes)',
      transport: 'Transport',
      buildings: 'Residential and commercial',
      agriculture: 'Agriculture',
      waste: 'Waste and wastewater',
      other: 'Other',
    } as Record<string, string>,
    peak: (p: number, c: string) => `The highest year since 1970 was ${p}; the latest year is ${c}.`,
    atPeak: 'The latest year is the highest since 1970.',
    none: 'No CEDS sector data for this country.',
    note: 'CEDS’s 33 sectors are grouped into 8; international aviation and shipping are not assigned to any country.',
  },
});

export default function AirEmissionsPanel({ topic, indicator, iso3, item, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const show = indicator.id === 'emissions' || indicator.id === 'emissions-pc';
  const data = useJson<DetailFile>(show ? `topics/${topic.id}/emissions-detail.json` : null).data;
  if (!show) return null;
  if (!data) return <p className="empty">{t.loading}</p>;
  const d = data.countries[iso3]?.[item ?? 'so2'];
  if (!d || !d.s.length) return <p className="empty">{text.none}</p>;
  const rows = data.groups.map((g, i) => ({ g, v: d.s[i] })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
  const change = d.c == null ? '' : `${d.c > 0 ? '+' : '−'}${fixed(Math.abs(d.c), 1)}%`;
  return (
    <section className="panel-section">
      <h3>{text.title(data.year)}</h3>
      <ul className="bar-list">
        {rows.map((r) => (
          <li key={r.g}>
            <span className="bar-label">{text.groups[r.g] ?? r.g}</span>
            <span className="bar-value">{r.v}%</span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${r.v}%`, background: tokens.hues.blue }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="note">{d.p === data.year ? text.atPeak : text.peak(d.p, change)}</p>
      <p className="note">{text.note}</p>
    </section>
  );
}
