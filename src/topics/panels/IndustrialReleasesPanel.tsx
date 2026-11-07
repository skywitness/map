import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { tr } from '../../i18n/lang';
import { fixed, formatLargeNumber } from '../../lib/format';
import { useAllPoints } from '../../lib/points';
import { POLLUTANTS, SECTORS, sectorIndex } from '../industrial-releases';
import type { PanelExtraProps } from '../types';

/**
 * 歐洲的工業污染排放設施的側欄（2026-11-07，第二十五批 488）：這一國這一年這一種污染物排放最多的 10 座設施。
 * 直接讀設施點的檔（facilities-{item}.json，地圖的點圖層已經讀過，快取裡有），依 iso3 與年份篩選
 */
const SHOWN = 10;

const TEXT = defineMessages({
  zh: {
    title: (p: string, y: number) => `${y} 年${p}排放最多的設施`,
    head: ['設施', '部門', '排放'],
    count: (n: number) => `這一年有 ${n} 座設施申報。`,
    none: '這一年這個國家沒有設施申報這種污染物。',
  },
  en: {
    title: (p: string, y: number) => `Largest ${p} sources, ${y}`,
    head: ['Facility', 'Sector', 'Release'],
    count: (n: number) => `${n} facilities reported this year.`,
    none: 'No facility in this country reported this pollutant this year.',
  },
});

export default function IndustrialReleasesPanel({ topic, iso3, year, item }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const pollutant = POLLUTANTS.find((p) => p.id === item) ?? POLLUTANTS[0];
  const { points } = useAllPoints(`topics/${topic.id}/facilities-${pollutant.id}.json`, false);
  const rows = useMemo(
    () => (points ? points.filter((p) => p.iso3 === iso3 && Number(p.y) === year).sort((a, b) => Number(b.v) - Number(a.v)) : null),
    [points, iso3, year],
  );
  if (!rows) return <p className="empty">{t.loading}</p>;
  if (!rows.length) return <p className="empty">{text.none}</p>;
  const unit = tr(pollutant.unit);
  return (
    <section className="panel-section">
      <h3>{text.title(tr(pollutant.label), year ?? 0)}</h3>
      <table className="mini-table">
        <thead>
          <tr>
            {text.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, SHOWN).map((r, i) => {
            const v = Number(r.v);
            return (
              <tr key={i}>
                <td>{String(r.n ?? '')}</td>
                <td>{tr(SECTORS[sectorIndex(Number(r.s))])}</td>
                <td>
                  {v < 10 ? fixed(v, 1) : formatLargeNumber(v)} {unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">{text.count(rows.length)}</p>
    </section>
  );
}
