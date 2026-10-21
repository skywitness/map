import { BarList } from '../../charts/BarList';
import { useJson } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

interface YearTop {
  total: number;
  /** [品項代碼, 數值]，由大到小 */
  top: [number, number][];
}

interface AgricultureFile {
  production: Record<string, YearTop>;
  exports: Record<string, YearTop>;
  imports: Record<string, YearTop>;
}

const SECTIONS = [
  { key: 'production', title: '主要農產品（依產值）', unit: '國際元', note: '2014–2016 年固定價格。右側為占農業總產值比重。' },
  { key: 'exports', title: '主要出口農產品', unit: '美元', note: '右側為占農產品出口總額比重。' },
  { key: 'imports', title: '主要進口農產品', unit: '美元', note: '右側為占農產品進口總額比重。' },
] as const;

const SHOWN = 8;

export default function AgriculturePanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const { data, error } = useJson<AgricultureFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const names = useJson<Record<string, string>>(`topics/${topic.id}/items.json`).data;
  if (error) return <p className="empty">沒有這個國家的農業資料。</p>;
  if (!data || !names) return <p className="empty">載入中…</p>;

  return (
    <section className="panel-section">
      {SECTIONS.map(({ key, title, unit, note }) => {
        const byYear = data[key];
        const shownYear = latestYear(byYear, year);
        if (shownYear === null) return null;
        const entry = byYear[shownYear];
        const format = (v: number) => `${formatLargeNumber(v)} ${unit}`;
        return (
          <div key={key} className="panel-subsection">
            <h3>{title}</h3>
            <p className="panel-year-note">
              {shownYear} 年 · 合計 {format(entry.total)}
              {shownYear !== year && <span className="muted">（{year} 年無資料，顯示最近一年）</span>}
            </p>
            <BarList
              items={entry.top.slice(0, SHOWN).map(([code, value]) => ({
                key: String(code),
                label: names[code] ?? String(code),
                value,
              }))}
              total={entry.total}
              format={format}
              ariaLabel={`${countryName}${title}`}
            />
            <p className="note">{note}</p>
          </div>
        );
      })}
    </section>
  );
}

function latestYear(byYear: Record<string, YearTop>, year: number): number | null {
  const years = Object.keys(byYear).map(Number).filter((y) => y <= year);
  return years.length ? Math.max(...years) : null;
}
