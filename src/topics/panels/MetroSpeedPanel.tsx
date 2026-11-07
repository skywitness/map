import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 都會區網速差距的側欄（2026-11-07，製作手冊第二十七批 591；pipeline/topics/metro_speed.py 的 areas.json）：
 * 這一國那一年最快與最慢各 5 個功能性都會區，比全國平均快或慢幾 %（子項目決定固網或行動）。
 */
interface Areas {
  years: number[];
  names: Record<string, string>;
  countries: Record<string, Partial<Record<'fixed' | 'mobile', Record<string, [string, number][]>>>>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number, mobile: boolean) => `${y} 年${mobile ? '行動網路' : '固網'}最快與最慢的都會區`,
    head: ['都會區', '比全國平均'],
    note: '下載速度跟全國平均比快或慢幾 %（OECD 彙總 Ookla 的測速）；都會區名稱照 OECD 的寫法。',
  },
  en: {
    title: (y: number, mobile: boolean) => `Fastest and slowest metro areas, ${mobile ? 'mobile' : 'fixed broadband'}, ${y}`,
    head: ['Metro area', 'vs national average'],
    note: 'Download speed relative to the national average (OECD aggregation of Ookla tests); area names as given by the OECD.',
  },
});

export default function MetroSpeedPanel({ topic, iso3, year, item }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Areas>(`topics/${topic.id}/metro-gap/areas.json`).data;
  const net = item === 'mobile' ? 'mobile' : 'fixed';
  const byYear = d?.countries[iso3]?.[net];
  if (!d || !byYear) return null;
  const y = [...d.years].reverse().find((v) => v <= year && byYear[String(v)]);
  if (y == null) return null;
  const rows = byYear[String(y)];
  return (
    <section className="panel-section">
      <h3>{text.title(y, net === 'mobile')}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th>{text.head[0]}</th>
            <th className="num">{text.head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, v]) => (
            <tr key={code}>
              <td translate="no">{d.names[code] ?? code}</td>
              <td className="num">{`${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
