import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

interface TransportFile {
  railKm: number;
  airports: { name: string; iata: string; city: string; large: boolean }[];
  /** pipeline/topics/metro.py：今年（year）營運中的站數、開通日期不明的站數、最早的開通年份；路網是 [英文, 中文, 通車年份, 站數] */
  metro?: { year: number; stations: number; undated: number; first: number | null; systems: [string | null, string | null, number | null, number][] };
  /** 高鐵路線：[英文, 中文, 通車年份]，依年份排 */
  hsr?: [string, string | null, number][];
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
    metro: '地鐵',
    metroSummary: (n: string, year: number, first: number | null) =>
      `${year} 年營運中 ${n} 個車站${first ? `，最早的在 ${first} 年開通` : ''}。`,
    noMetro: 'Wikidata 沒有這個國家營運中的地鐵站。',
    undated: (n: number, year: number) => `其中 ${n} 個開通日期不明，地圖上只在 ${year} 年出現。`,
    system: (year: number | null, n: number) => [year ? `${year} 年通車` : null, `${n} 站`].filter(Boolean).join(' · '),
    otherSystem: 'Wikidata 沒有寫路網的車站',
    hsr: '高鐵',
    noHsr: 'Wikidata 沒有這個國家通車的高速鐵路線。',
    hsrLine: (year: number) => `${year} 年通車`,
    metroNote: '地鐵站數、路網與高鐵取自 Wikidata，收錄各國不一；名稱沒有中文時用原文。',
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
    metro: 'Metro',
    metroSummary: (n, year, first) => `${n} stations in service in ${year}${first ? `; the first opened in ${first}` : ''}.`,
    noMetro: 'Wikidata has no metro stations in service in this country.',
    undated: (n, year) => `${n} of them have no known opening date and appear on the map only in ${year}.`,
    system: (year, n) => [year ? `opened ${year}` : null, `${n} ${n === 1 ? 'station' : 'stations'}`].filter(Boolean).join(' · '),
    otherSystem: 'Stations without a system in Wikidata',
    hsr: 'High-speed rail',
    noHsr: 'Wikidata has no high-speed line in service in this country.',
    hsrLine: (year) => `Opened ${year}`,
    metroNote: 'Metro stations, systems and high-speed lines come from Wikidata, whose coverage varies by country.',
  },
});

/** 地鐵站數、第一條高鐵這兩個逐年的指標才列地鐵與高鐵；其他指標照舊列鐵路與機場 */
const METRO_INDICATORS = new Set(['metro-stations', 'hsr-first']);

export default function TransportPanel(props: PanelExtraProps) {
  return METRO_INDICATORS.has(props.indicator.id) ? <MetroSection {...props} /> : <RailAirports {...props} />;
}

function MetroSection({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<TransportFile>(`topics/${topic.id}/countries/${iso3}.json`);
  if (!data && !error) return <p className="empty">{t.loading}</p>;
  const metro = data?.metro;
  const hsr = data?.hsr ?? [];
  const name = (en: string | null, zh: string | null) => (lang === 'zh' && zh ? zh : en ?? zh ?? '');
  return (
    <section className="panel-section">
      <h3>{text.metro}</h3>
      {metro && metro.stations > 0 ? (
        <>
          <p className="panel-figure">{text.metroSummary(fixed(metro.stations, 0), metro.year, metro.first)}</p>
          {metro.undated > 0 && <p className="note">{text.undated(metro.undated, metro.year)}</p>}
          <ul className="plain-list">
            {metro.systems.map(([en, zh, year, n]) => (
              <li key={`${en}-${year}`}>
                <span className="plain-title">{en || zh ? name(en, zh) : text.otherSystem}</span>
                <span className="plain-meta">{text.system(year, n)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="empty">{text.noMetro}</p>
      )}
      <h3>{text.hsr}</h3>
      {hsr.length > 0 ? (
        <ul className="plain-list">
          {hsr.map(([en, zh, year]) => (
            <li key={`${en}-${year}`}>
              <span className="plain-title">{name(en, zh)}</span>
              <span className="plain-meta">{text.hsrLine(year)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noHsr}</p>
      )}
      <p className="note">{text.metroNote}</p>
    </section>
  );
}

function RailAirports({ topic, iso3 }: PanelExtraProps) {
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
