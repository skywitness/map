import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { monthText } from '../reads';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 台灣的機場起降架次（2026-11-07，製作手冊第二十七批 571；pipeline/topics/airport_flights.py 的 flights-tw.json）：
 * 民航局「民航運輸各機場營運量－按機場分」的總計，每年（2016 年起）與最近 13 個月。口徑跟 Eurostat 的航班架次不同。
 */
interface FlightsTw {
  version: string;
  annual: [number, number][];
  /** [月份編號（2000 年 1 月起）, 架次] */
  monthly: [number, number][];
}

const TEXT = defineMessages({
  zh: {
    title: '台灣各機場的起降架次（民航局）',
    aria: '台灣各機場合計的起降架次',
    year: (y: number) => `${y} 年`,
    months: '最近 13 個月',
    n: (v: number) => `${fixed(v, 0)} 架次`,
    note: '起降架次是起飛加降落，國內線在兩端各算一次，跟地圖上 Eurostat 的航班架次口徑不同，地圖上沒有替台灣上色。',
  },
  en: {
    title: 'Aircraft movements at Taiwan’s airports (CAA)',
    aria: 'Aircraft movements at all of Taiwan’s airports',
    year: (y: number) => String(y),
    months: 'Last 13 months',
    n: (v: number) => fixed(v, 0),
    note: 'Movements count take-offs plus landings, with domestic flights counted at both ends, a different basis from Eurostat’s flights on the map, so Taiwan is not shaded.',
  },
});

export function FlightsTwSection({ topic }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<FlightsTw>(`topics/${dataFolder(topic)}/flights-tw.json`).data;
  if (!d) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <tbody>
          {d.annual.map(([y, n]) => (
            <tr key={y}>
              <th scope="row">{text.year(y)}</th>
              <td className="num">{text.n(n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>{text.months}</h3>
      <table className="mini-table" aria-label={text.months}>
        <tbody>
          {d.monthly.map(([m, n]) => (
            <tr key={m}>
              <th scope="row">{monthText(m)}</th>
              <td className="num">{text.n(n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
