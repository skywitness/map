import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { GAUGES, gaugeText } from '../transport';
import type { PanelExtraProps } from '../types';

interface TransportFile {
  railKm: number;
  airports: { name: string; iata: string; city: string; large: boolean }[];
  /** pipeline/topics/metro.py：今年（year）營運中的站數、開通日期不明的站數、最早的開通年份；路網是 [英文, 中文, 通車年份, 站數] */
  metro?: { year: number; stations: number; undated: number; first: number | null; systems: [string | null, string | null, number | null, number][] };
  /** 高鐵路線：[英文, 中文, 通車年份]，依年份排 */
  hsr?: [string, string | null, number][];
}

/**
 * pipeline/topics/rail_gauge.py 的 gauge-detail.json：每國 [來源, 資料年份, [[軌距 mm, 公里（維基百科可能沒有）], …],
 * [[軌距 mm, 軌距 mm, 公里] 雙軌距…], 維基百科條目]。來源 factbook-2022 是世界概況 2022-12-29 的版本
 */
type GaugeRow = ['factbook' | 'factbook-2022' | 'wikipedia', number | null, [number, number | null][], [number, number, number][], string | null];

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
    gauge: '軌距',
    noGauge: '世界概況與英文維基百科都沒有這個國家的軌距。',
    gaugeAria: (country: string) => `${country}各種軌距的鐵路長度`,
    gaugeOnly: '資料只寫了軌距，沒有各種軌距的長度。',
    dual: (a: string, b: string, km: string) => `另有 ${km} 公里是雙軌距（${a} 與 ${b} mm 的車都能走），不算進比例。`,
    factbook: (year: number | null) => `資料：CIA 世界概況${year ? `（${year} 年）` : ''}。`,
    factbook2022: (year: number | null) =>
      `資料：CIA 世界概況 2022 年 12 月的版本${year ? `（${year} 年）` : ''}；之後的版本只列鐵路總長，沒有分軌距。`,
    wikipedia: '資料：英文維基百科條目',
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
    gauge: 'Track gauge',
    noGauge: 'Neither the World Factbook nor English Wikipedia gives a track gauge for this country.',
    gaugeAria: (country) => `Rail length by track gauge in ${country}`,
    gaugeOnly: 'The source gives the gauge but not the length of each gauge.',
    dual: (a, b, km) => `Another ${km} km is dual gauge (usable by ${a} mm and ${b} mm trains) and is not counted in the shares.`,
    factbook: (year) => `Source: CIA World Factbook${year ? ` (${year})` : ''}.`,
    factbook2022: (year) =>
      `Source: CIA World Factbook, December 2022 edition${year ? ` (${year} data)` : ''}; later editions give only the total length, not the gauges.`,
    wikipedia: 'Source: English Wikipedia article',
  },
});

/** 地鐵站數、第一條高鐵這兩個逐年的指標才列地鐵與高鐵；軌距的兩個指標列各種軌距；其他指標照舊列鐵路與機場 */
const METRO_INDICATORS = new Set(['metro-stations', 'hsr-first']);
const GAUGE_INDICATORS = new Set(['gauge', 'standard-share']);

export default function TransportPanel(props: PanelExtraProps) {
  if (METRO_INDICATORS.has(props.indicator.id)) return <MetroSection {...props} />;
  if (GAUGE_INDICATORS.has(props.indicator.id)) return <GaugeSection {...props} />;
  return <RailAirports {...props} />;
}

/** 某個軌距屬於哪一類：名稱與地圖的顏色（不在分類裡的是「其他軌距」的顏色） */
function gaugeKind(mm: number) {
  const index = GAUGES.findIndex((g) => g.mm.includes(mm));
  return index < 0
    ? { label: gaugeText(null, mm), color: MAP_TOKENS.categoricalOther }
    : { label: gaugeText(GAUGES[index].name, mm), color: MAP_TOKENS.categorical[index] };
}

function GaugeSection({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<{ countries: Record<string, GaugeRow> }>(`topics/${topic.id}/gauge-detail.json`);
  if (!data && !error) return <p className="empty">{t.loading}</p>;
  const row = data?.countries[iso3];
  if (!row) return <p className="empty">{text.noGauge}</p>;
  const [src, year, gauges, dual, title] = row;
  const lengths = gauges.every(([, km]) => km !== null);
  const items = gauges.map(([mm, km]) => ({ key: String(mm), value: km ?? 0, ...gaugeKind(mm) }));
  const km = (v: number) => `${fixed(v, 0)} ${tr({ zh: '公里', en: 'km' })}`;
  return (
    <section className="panel-section">
      <h3>{text.gauge}</h3>
      {lengths ? (
        <BarList
          items={items.map((i) => ({ ...i, label: tr(i.label, lang) }))}
          format={km}
          total={items.reduce((sum, i) => sum + i.value, 0)}
          ariaLabel={text.gaugeAria(countryName)}
        />
      ) : (
        <>
          <ul className="plain-list">
            {items.map((i) => (
              <li key={i.key}>
                <span className="plain-title">
                  <span className="bar-key" style={{ background: i.color }} />
                  {tr(i.label, lang)}
                </span>
              </li>
            ))}
          </ul>
          <p className="note">{text.gaugeOnly}</p>
        </>
      )}
      {dual.map(([a, b, length]) => (
        <p key={`${a}-${b}`} className="note">
          {text.dual(fixed(a, 0), fixed(b, 0), fixed(length, 0))}
        </p>
      ))}
      <p className="note">
        {src === 'wikipedia' ? (
          <>
            {text.wikipedia}{' '}
            <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent((title ?? '').replace(/ /g, '_'))}`} target="_blank" rel="noreferrer" translate="no" lang="en">
              {title}
            </a>
          </>
        ) : src === 'factbook-2022' ? (
          text.factbook2022(year)
        ) : (
          text.factbook(year)
        )}
      </p>
    </section>
  );
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
