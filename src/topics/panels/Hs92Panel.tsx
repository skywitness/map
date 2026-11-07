import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { HS92_ITEMS } from '../electronics-hs92';
import type { PanelExtraProps } from '../types';

/**
 * 半導體的 HS92 擴充的側欄（2026-11-07，製作手冊第二十七批 593；pipeline/topics/electronics_hs92.py 的 hs92-countries/<ISO3>.json）：
 * 這一國那一年七類電子產品與晶片的出口與占全世界的比例。
 */
interface Detail {
  years: number[];
  items: Partial<Record<string, (number | null)[]>>;
  world: Record<string, number[]>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年七類電子產品與晶片的出口`,
    head: ['商品（HS92）', '出口', '占全世界'],
    usd: (v: number) => `${formatLargeNumber(v)} 美元`,
    note: 'Harvard Atlas，名目美元，含轉口。',
  },
  en: {
    title: (y: number) => `Exports of seven electronics and chip products, ${y}`,
    head: ['Product (HS92)', 'Exports', 'World share'],
    usd: (v: number) => `US$${formatLargeNumber(v)}`,
    note: 'Harvard Atlas, nominal US dollars, including re-exports.',
  },
});

export default function Hs92Panel({ topic, iso3, year }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/hs92-countries/${iso3}.json`).data;
  if (!d) return null;
  const i = d.years.indexOf(Math.min(year, d.years[d.years.length - 1]));
  if (i < 0) return null;
  const rows = HS92_ITEMS.map((it) => ({ it, v: d.items[it.id]?.[i] ?? null, w: d.world[it.id][i] })).filter((r) => r.v != null);
  if (!rows.length) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(d.years[i])}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th>{text.head[0]}</th>
            <th className="num">{text.head[1]}</th>
            <th className="num">{text.head[2]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ it, v, w }) => (
            <tr key={it.id}>
              <td>{it.label[lang]}</td>
              <td className="num">{text.usd(v!)}</td>
              <td className="num">{w ? `${fixed((v! / w) * 100, 1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
