import { useMemo, useState } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { decodePoints } from '../../map/overlayData';
import { cityName } from '../urban-heat';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

/** 一開始列幾個城區，其他的收起來 */
const SHOW = 10;

const TEXT = defineMessages({
  zh: {
    title: (country: string, year: number) => `${country}最大的城區（${year} 年夏季白天）`,
    none: '這裡沒有資料收錄的城區。',
    noValue: '沒有值',
    area: (km2: string) => `${km2} km²`,
    more: (n: number) => `再列出 ${n} 個`,
    less: '收起來',
    note: '依城區面積排列；數值是城區的地表溫度比周圍郊外高幾度（負的是比郊外涼）。',
  },
  en: {
    title: (country, year) => `Largest urban areas in ${country} (summer days, ${year})`,
    none: 'No urban area in the dataset here.',
    noValue: 'no value',
    area: (km2) => `${km2} km²`,
    more: (n) => `Show ${n} more`,
    less: 'Show fewer',
    note: 'Sorted by urban area; values are how much hotter the land surface is than the surroundings (negative means cooler).',
  },
});

const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)} °C`;

export default function UrbanHeatPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const [all, setAll] = useState(false);
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/uhi-areas.json`);
  const rows = useMemo(
    () => (data ? decodePoints(data).filter((p: PointRecord) => p.iso3 === iso3).sort((a, b) => Number(b.area) - Number(a.area)) : null),
    [data, iso3],
  );
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, year)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {shown.map((p) => {
            const v = p[`y${year}`];
            return (
              <li key={String(p.id)}>
                <span className="plain-title">
                  {cityName(p, lang)} · {typeof v === 'number' ? signed(v) : text.noValue}
                </span>
                <span className="plain-meta">{text.area(fixed(Number(p.area), 0))}</span>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > SHOW && (
        <button type="button" className="eclipse-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? text.less : text.more(rows.length - SHOW)}
        </button>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
