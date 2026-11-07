import { defineMessages, useLang } from '../../i18n';
import { useAllPoints } from '../../lib/points';
import { fixed } from '../../lib/format';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 機場的設施（2026-11-07，製作手冊第二十七批 570；pipeline/topics/airport_facilities.py 的 airport-facilities.json）：
 * 這一國向 Eurostat 申報的機場，各取最近有登機門數字的一年。缺值寫「—」，不當 0。
 */

const TEXT = defineMessages({
  zh: {
    title: '各機場的設施（Eurostat）',
    aria: (country: string) => `${country}各機場的設施`,
    airport: '機場（年份）',
    gates: '登機門（空橋）',
    checkin: '報到櫃台（自助）',
    parking: '停車位',
    runways: '跑道',
    none: 'Eurostat 沒有這個國家的機場設施資料（只有歐洲各國自願申報的機場；英國照網站的規則不畫）。',
    note: '各機場自願申報，年份不一，「—」是那一年沒有申報。',
    /** 「229（136）」：括號裡是其中有空橋的登機門、自助櫃台 */
    pair: (a: string, b: string) => `${a}（${b}）`,
  },
  en: {
    title: 'Facilities by airport (Eurostat)',
    aria: (country: string) => `Facilities at airports in ${country}`,
    airport: 'Airport (year)',
    gates: 'Gates (jet bridges)',
    checkin: 'Check-in (self)',
    parking: 'Parking',
    runways: 'Runways',
    none: 'Eurostat has no airport facility data for this country (only airports in Europe that report voluntarily; the UK is not shown by the site’s rule).',
    note: 'Airports report voluntarily and years differ; “—” means not reported that year.',
    pair: (a: string, b: string) => `${a} (${b})`,
  },
});

const cell = (v: unknown) => (typeof v === 'number' ? fixed(v, 0) : '—');


export function AirportFacilitiesSection({ topic, iso3, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const { points } = useAllPoints(`topics/${dataFolder(topic)}/airport-facilities.json`, false);
  if (!points) return null;
  const pair = (v: unknown, sub: unknown) => (typeof sub === 'number' ? text.pair(cell(v), fixed(sub, 0)) : cell(v));
  const rows = points.filter((p) => p.iso3 === iso3).sort((a, b) => Number(b.g) - Number(a.g));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {rows.length ? (
        <div className="mini-table-scroll">
          <table className="mini-table" aria-label={text.aria(countryName)}>
            <thead>
              <tr>
                <th scope="col">{text.airport}</th>
                <th scope="col" className="num">{text.gates}</th>
                <th scope="col" className="num">{text.checkin}</th>
                <th scope="col" className="num">{text.parking}</th>
                <th scope="col" className="num">{text.runways}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={String(p.icao)}>
                  <th scope="row" translate="no">
                    {String(p.iata || p.icao)} ({String(p.y)})
                  </th>
                  <td className="num">{pair(p.g, p.bb)}</td>
                  <td className="num">{pair(p.ck, p.cs)}</td>
                  <td className="num">{cell(p.pk)}</td>
                  <td className="num">{cell(p.rw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">{text.none}</p>
      )}
      {rows.length > 0 && <p className="note">{text.note}</p>}
    </section>
  );
}
