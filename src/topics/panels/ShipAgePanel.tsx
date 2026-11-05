import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { dataFolder, type PanelExtraProps } from '../types';

/** fleet-age-detail.json（pipeline/topics/shipping_efficiency.py）：UNCTAD 最近一年各船種的艘數與平均船齡，跟全世界比 */
interface AgeDetail {
  years: number[];
  countries: Record<string, { year: number; types: Record<string, [number | null, number | null]>; age: (number | null)[] }>;
}

const TYPES = ['all', 'oil', 'bulk', 'general', 'container', 'other'] as const;

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `各船種的艘數與平均船齡（${y} 年 1 月 1 日，UNCTAD）`,
    aria: '各船種的艘數與平均船齡',
    type: '船種',
    ships: '艘數',
    age: '平均船齡',
    world: '全世界',
    names: { all: '全部', oil: '油輪', bulk: '散裝船', general: '雜貨船', container: '貨櫃船', other: '其他' } as Record<string, string>,
    years: (v: number) => `${fixed(v, 1)} 年`,
    small: (n: number) => `這一年只有 ${fixed(n, 0)} 艘，地圖不上色（平均船齡容易被幾艘老船拉高）。`,
  },
  en: {
    title: (y: number) => `Ships and average age by type (1 January ${y}, UNCTAD)`,
    aria: 'Ships and average age by type',
    type: 'Type',
    ships: 'Ships',
    age: 'Average age',
    world: 'World',
    names: { all: 'All', oil: 'Oil tankers', bulk: 'Bulk carriers', general: 'General cargo', container: 'Container ships', other: 'Other' } as Record<string, string>,
    years: (v: number) => `${fixed(v, 1)} yrs`,
    small: (n: number) => `Only ${fixed(n, 0)} ships this year, so the map leaves it unshaded (a few old vessels can skew the average).`,
  },
});

export default function ShipAgePanel({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<AgeDetail>(`topics/${dataFolder(topic)}/fleet-age-detail.json`).data;
  const c = d?.countries[iso3];
  const w = d?.countries.WLD;
  if (!c || !w) return null;
  const total = c.types.all[0];
  return (
    <section className="panel-section">
      <h3>{text.title(c.year)}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <thead>
          <tr>
            <th scope="col">{text.type}</th>
            <th scope="col" className="num">{text.ships}</th>
            <th scope="col" className="num">{text.age}</th>
            <th scope="col" className="num">{text.world}</th>
          </tr>
        </thead>
        <tbody>
          {TYPES.map((t) => {
            const [n, a] = c.types[t] ?? [null, null];
            const wa = w.types[t]?.[1];
            return (
              <tr key={t}>
                <th scope="row">{text.names[t]}</th>
                <td className="num">{n != null ? fixed(n, 0) : '–'}</td>
                <td className="num">{a != null && n ? text.years(a) : '–'}</td>
                <td className="num">{wa != null ? text.years(wa) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {total != null && total < 100 && <p className="note">{text.small(total)}</p>}
    </section>
  );
}
