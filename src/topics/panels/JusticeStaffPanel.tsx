import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/** staff-detail.json（pipeline/topics/crime_staff.py）：[年, 每十萬人, 人數, 女性比例（%）, 女性比例的年份] */
type Row = [number, number, number | null, number | null, number | null];
type Detail = Record<string, Partial<Record<Occupation, Row>>>;
type Occupation = 'police' | 'judges' | 'prison-staff' | 'juvenile-staff';

const OCCUPATIONS: { id: Occupation; label: Text }[] = [
  { id: 'police', label: { zh: '警察', en: 'Police officers' } },
  { id: 'judges', label: { zh: '職業法官', en: 'Professional judges' } },
  { id: 'prison-staff', label: { zh: '成人監所管理員', en: 'Adult prison staff' } },
  { id: 'juvenile-staff', label: { zh: '少年矯正機構職員', en: 'Juvenile detention staff' } },
];

const TEXT = defineMessages({
  zh: {
    title: '警察、法官與監所管理員（最近一年）',
    occupation: '職業',
    year: '年',
    rate: '每十萬人',
    count: '人數',
    women: '女性',
    note: 'Eurostat crim_just_job。少年矯正機構職員各國的範圍差很多（波蘭、瑞典每十萬人 40 多，其他國家多半個位數），只列在這裡、不畫地圖。',
    aria: (country: string) => `${country}的警察、法官與監所管理員人數`,
  },
  en: {
    title: 'Police, judges and prison staff (latest year)',
    occupation: 'Occupation',
    year: 'Year',
    rate: 'Per 100k',
    count: 'Number',
    women: 'Women',
    note: 'Eurostat crim_just_job. The scope of juvenile detention staff differs widely (over 40 per 100,000 in Poland and Sweden, single digits in most others), so it is listed here only and not mapped.',
    aria: (country) => `Police, judges and prison staff in ${country}`,
  },
});

export default function JusticeStaffPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const detail = useJson<Detail>(`topics/${topic.id}/staff-detail.json`).data;
  const rows = detail?.[iso3];
  if (!rows) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <table className="mini-table" aria-label={text.aria(countryName)}>
        <thead>
          <tr>
            <th scope="col">{text.occupation}</th>
            <th scope="col" className="num">{text.year}</th>
            <th scope="col" className="num">{text.rate}</th>
            <th scope="col" className="num">{text.count}</th>
            <th scope="col" className="num">{text.women}</th>
          </tr>
        </thead>
        <tbody>
          {OCCUPATIONS.map(({ id, label }) => {
            const row = rows[id];
            if (!row) return null;
            const [year, rate, count, women, womenYear] = row;
            return (
              <tr key={id}>
                <th scope="row">{tr(label)}</th>
                <td className="num">{year}</td>
                <td className="num">{fixed(rate, 1)}</td>
                <td className="num">{count == null ? '–' : fixed(count, 0)}</td>
                <td className="num">
                  {women == null ? '–' : `${fixed(women, 1)}%`}
                  {women != null && womenYear !== year ? ` (${womenYear})` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
