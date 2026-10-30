import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { rockOf } from '../lithology';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/lithology.py 的 panel.json：每國各岩類的面積千分比 [[GLiM 代碼, ‰], …]（≥ 1‰ 的才列，由大到小） */
interface PanelData {
  countries: Record<string, [number, number][]>;
}

const pct = (permille: number) => `${fixed(permille / 10, permille < 100 ? 1 : 0)}%`;

const TEXT = defineMessages({
  zh: {
    title: '國土的岩石種類',
    none: '這個國家太小，0.5° 網格沒有格子落在國界內。',
    note: '依 0.5° 格子的面積（依緯度加權），每格只算面積最多的岩類，大湖不算。',
  },
  en: {
    title: 'Rock types across the country',
    none: 'This country is too small for the 0.5° grid: no cell falls inside it.',
    note: 'By the area of 0.5° cells (weighted by latitude), each counted only as its dominant rock type; large lakes excluded.',
  },
});

export default function LithologyPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PanelData>(`topics/${topic.id}/panel.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const rows = (data.countries[iso3] ?? []).filter(([code]) => rockOf(code));
  if (!rows.length) return <p className="note">{text.none}</p>;
  const max = rows[0][1];

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <ul className="bar-list">
        {rows.map(([code, v]) => {
          const c = rockOf(code)!;
          return (
            <li key={code}>
              <span className="bar-label">
                <span className="bar-key" style={{ background: c.color }} />
                {c.label[lang]}
              </span>
              <span className="bar-value">{pct(v)}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: c.color }} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="note">{text.note}</p>
    </section>
  );
}
