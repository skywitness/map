import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { dataFolder, type PanelExtraProps } from '../types';

/** fleet-detail.json（pipeline/topics/air_fleet.py）：Eurostat 最近一年的五個機齡層、台灣民航局的國籍航空器登記 */
interface FleetDetail {
  ages: string[];
  eurostat: Record<string, { year: number; ages: (number | null)[]; total: number }>;
  taiwan: { month: string; total: number; companies: [string, number, [string, number][]][] };
}

const TEXT = defineMessages({
  zh: {
    ages: (y: number) => `機齡（${y} 年，Eurostat）`,
    ageAria: '機齡層的架數',
    bands: ['不到 5 年', '5–9 年', '10–14 年', '15–19 年', '20 年以上'],
    total: '合計',
    count: (n: number) => `${fixed(n, 0)} 架`,
    taiwan: (m: string) => `國籍航空器登記（民航局，${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月）`,
    taiwanAria: '國籍航空器登記',
    company: '公司或機關',
    types: '機型',
    note: '民航局的登記含通用航空、學校與政府機關的飛機，跟 Factbook 的「航空公司營運的飛機」口徑不同；遠東航空已停業，飛機還在登記簿上。',
  },
  en: {
    ages: (y: number) => `Aircraft age (${y}, Eurostat)`,
    ageAria: 'Aircraft by age band',
    bands: ['Under 5 years', '5–9 years', '10–14 years', '15–19 years', '20 years or more'],
    total: 'Total',
    count: (n: number) => `${fixed(n, 0)}`,
    taiwan: (m: string) => `Registered aircraft (Civil Aeronautics Administration, ${m})`,
    taiwanAria: 'Registered aircraft in Taiwan',
    company: 'Operator',
    types: 'Types',
    note: 'The register includes general aviation, school and government aircraft, a different basis from the Factbook’s aircraft operated by airlines; Far Eastern Air Transport has ceased operations but its aircraft remain registered.',
  },
});

export default function FleetPanel({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<FleetDetail>(`topics/${dataFolder(topic)}/fleet-detail.json`).data;
  if (!d) return null;
  const eu = d.eurostat[iso3];
  return (
    <>
      {eu && (
        <section className="panel-section">
          <h3>{text.ages(eu.year)}</h3>
          <table className="mini-table" aria-label={text.ageAria}>
            <tbody>
              {eu.ages.map((n, i) => (
                <tr key={d.ages[i]}>
                  <th scope="row">{text.bands[i]}</th>
                  <td className="num">{n != null ? text.count(n) : '–'}</td>
                  <td className="num">{n != null && eu.total ? `${fixed((n / eu.total) * 100, 1)}%` : ''}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">{text.total}</th>
                <td className="num">{text.count(eu.total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </section>
      )}
      {iso3 === 'TWN' && (
        <section className="panel-section">
          <h3>{text.taiwan(d.taiwan.month)}</h3>
          <table className="mini-table" aria-label={text.taiwanAria}>
            <thead>
              <tr>
                <th scope="col">{text.company}</th>
                <th scope="col">{text.types}</th>
                <th scope="col" className="num">{text.total}</th>
              </tr>
            </thead>
            <tbody>
              {[...d.taiwan.companies]
                .sort((a, b) => b[1] - a[1])
                .map(([name, n, types]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{types.map(([t, k]) => `${t} × ${k}`).join(', ')}</td>
                    <td className="num">{fixed(n, 0)}</td>
                  </tr>
                ))}
              <tr>
                <th scope="row">{text.total}</th>
                <td />
                <td className="num">{fixed(d.taiwan.total, 0)}</td>
              </tr>
            </tbody>
          </table>
          <p className="note">{text.note}</p>
        </section>
      )}
    </>
  );
}
