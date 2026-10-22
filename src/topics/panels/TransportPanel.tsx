import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

interface TransportFile {
  railKm: number;
  airports: { name: string; iata: string; city: string; large: boolean }[];
}

export default function TransportPanel({ topic, iso3 }: PanelExtraProps) {
  const { data, error } = useJson<TransportFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (error) return <p className="empty">地圖資料上沒有這個國家的鐵路或機場。</p>;
  if (!data) return <p className="empty">載入中…</p>;

  const large = data.airports.filter((a) => a.large);
  const medium = data.airports.filter((a) => !a.large);

  return (
    <section className="panel-section">
      <h3>鐵路</h3>
      <p className="panel-figure">
        {data.railKm > 0 ? `地圖上約 ${fixed(data.railKm, 0)} 公里` : '地圖資料上沒有鐵路'}
      </p>

      <h3>機場（{data.airports.length} 座）</h3>
      {data.airports.length === 0 && <p className="empty">沒有大型機場或有定期航班的中型機場。</p>}
      {[
        { title: '大型機場', list: large },
        { title: '中型機場（有定期航班）', list: medium },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title}>
              <h4>
                {title} · {list.length} 座
              </h4>
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
      <p className="note">機場名稱與城市為 OurAirports 的英文原名。</p>
    </section>
  );
}
