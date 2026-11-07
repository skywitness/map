// 機場與旅客（主題 id aviation）的側欄：這國的大型機場與有定期航班的中型機場（2026-10-30 第十一批 186 起；
// 航空公司、最長航線的側欄搬到航線與航空公司的 AirRoutesPanel）。
// 跑道的指標（第二十三批 399）選台灣時，另列民航局「民航機場設施與能量」的官方跑道長寬、起降容量與進場燈光。
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { FACILITY_IDS } from '../aviation-facilities';
import { FLIGHT_IDS } from '../aviation-flights';
import { RUNWAY_INDICATORS } from '../aviation-runways';
import type { PanelExtraProps } from '../types';
import { AirportFacilitiesSection } from './AirportFacilitiesPanel';
import { FlightsTwSection } from './FlightsTwPanel';
import { AirportsSection } from './TransportPanel';

/** runways-tw.json（pipeline/topics/airport_runways.py）：[機場, 性質, [[跑道代號, 長, 寬, 起降容量], …], 最大機型, 進場燈光] */
interface CaaFile {
  year: number;
  airports: [string, string, [string, number | null, number | null, string][], string, string][];
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `民航局的跑道資料（${y} 年）`,
    aria: '民航局的跑道資料',
    airport: '機場',
    runway: '跑道（長 × 寬，公尺）',
    capacity: '起降容量（架次／小時）',
    aircraft: (a: string) => `營運中最大機型：${a}`,
    note: '交通部民用航空局「民航機場設施與能量」表 72。起降容量是民航局依跑道型式與航管作業推估的；進場燈光的代號見原表附註（CAT-II APCH 是 ICAO 第二類進場燈系統、PAPI 是精確下滑指示燈）。恆春機場目前沒有定期航班。',
    approach: (a: string) => `進場燈光：${a}`,
    sep: '；',
  },
  en: {
    title: (y: number) => `Runways according to Taiwan’s CAA (${y})`,
    aria: 'Runways according to Taiwan’s Civil Aeronautics Administration',
    airport: 'Airport',
    runway: 'Runway (length × width, m)',
    capacity: 'Capacity (movements per hour)',
    aircraft: (a: string) => `Largest aircraft in service: ${a}`,
    note: 'Table 72, “Facilities and capacity of civil airports”, Civil Aeronautics Administration, Ministry of Transportation and Communications. Capacity is the CAA’s estimate from runway layout and air traffic control practice; approach lighting codes are explained in the original table (CAT-II APCH is an ICAO Category II approach lighting system, PAPI a precision approach path indicator). Hengchun currently has no scheduled flights.',
    approach: (a: string) => `Approach lighting: ${a}`,
    sep: '; ',
  },
});

function TaiwanRunways({ topic }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<CaaFile>(`topics/${topic.id}/runways-tw.json`).data;
  if (!d) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(d.year)}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <thead>
          <tr>
            <th scope="col">{text.airport}</th>
            <th scope="col">{text.runway}</th>
            <th scope="col">{text.capacity}</th>
          </tr>
        </thead>
        <tbody>
          {d.airports.map(([name, , runways, aircraft, approach]) => (
            <tr key={name}>
              <th scope="row">
                {name}
                <div className="plain-meta">
                  {[aircraft && text.aircraft(aircraft), approach && text.approach(approach)].filter(Boolean).join(text.sep)}
                </div>
              </th>
              <td className="num">
                {runways.map(([id, len, width]) => (
                  <div key={id || 'r'}>
                    {id && `${id} `}
                    {len != null ? fixed(len, 0) : '–'} × {width != null ? fixed(width, 0) : '–'}
                  </div>
                ))}
              </td>
              <td className="num">
                {runways.map(([id, , , cap]) => (
                  <div key={id || 'r'}>{cap || '–'}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}

export default function AviationPanel(props: PanelExtraProps) {
  const runway = RUNWAY_INDICATORS.includes(props.indicator.id);
  return (
    <>
      {runway && props.iso3 === 'TWN' && <TaiwanRunways {...props} />}
      {FACILITY_IDS.includes(props.indicator.id) && <AirportFacilitiesSection {...props} />}
      {FLIGHT_IDS.includes(props.indicator.id) && props.iso3 === 'TWN' && <FlightsTwSection {...props} />}
      <AirportsSection {...props} />
    </>
  );
}
