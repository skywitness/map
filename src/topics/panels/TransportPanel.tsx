import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

interface TransportFile {
  railKm: number;
  airports: { name: string; iata: string; city: string; large: boolean }[];
}

const TEXT = defineMessages({
  zh: {
    noCountry: '地圖資料上沒有這個國家的鐵路或機場。',
    railways: '鐵路',
    railKm: (km: string) => `地圖上約 ${km} 公里`,
    noRail: '地圖資料上沒有鐵路',
    airports: (n: number) => `機場（${n} 座）`,
    noAirports: '沒有大型機場或有定期航班的中型機場。',
    large: '大型機場',
    medium: '中型機場（有定期航班）',
    group: (title: string, n: number) => `${title} · ${n} 座`,
    note: '機場名稱與城市為 OurAirports 的英文原名。',
  },
  en: {
    noCountry: 'The map data has no railways or airports for this country.',
    railways: 'Railways',
    railKm: (km) => `About ${km} km on the map`,
    noRail: 'No railways in the map data',
    airports: (n) => `Airports (${n})`,
    noAirports: 'No large airports or medium airports with scheduled flights.',
    large: 'Large airports',
    medium: 'Medium airports (scheduled flights)',
    group: (title, n) => `${title} · ${n}`,
    note: 'Airport and city names are the original names from OurAirports.',
  },
});

export default function TransportPanel({ topic, iso3 }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const t = useT();
  const { data, error } = useJson<TransportFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const large = data.airports.filter((a) => a.large);
  const medium = data.airports.filter((a) => !a.large);

  return (
    <section className="panel-section">
      <h3>{text.railways}</h3>
      <p className="panel-figure">{data.railKm > 0 ? text.railKm(fixed(data.railKm, 0)) : text.noRail}</p>

      <h3>{text.airports(data.airports.length)}</h3>
      {data.airports.length === 0 && <p className="empty">{text.noAirports}</p>}
      {[
        { title: text.large, list: large },
        { title: text.medium, list: medium },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title}>
              <h4>{text.group(title, list.length)}</h4>
              <ul className="plain-list">
                {list.map((a) => (
                  <li key={`${a.name}-${a.iata}`}>
                    <span className="plain-title">
                      {a.iata && <span className="iata">{a.iata}</span>}
                      {a.name}
                    </span>
                    {a.city && <span className="plain-meta">{a.city}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
