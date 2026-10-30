import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { regionFacts } from '../cloud-regions';
import type { PanelExtraProps, PointsData } from '../types';

const TEXT = defineMessages({
  zh: {
    title: (country: string, year: number) => `${country}在 ${year} 年的雲端區域`,
    preview: '預覽中',
    none: '這一年三家業者在這裡都還沒有開放的區域。',
    note: '依開放年份排列；點在業者寫的城市，不是機房的位置。',
  },
  en: {
    title: (country, year) => `Cloud regions in ${country}, ${year}`,
    preview: 'In preview',
    none: 'None of the three providers had a region open here by this year.',
    note: 'By opening year; dots are at the city the provider names, not the data centre.',
  },
});

export default function CloudRegionsPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const regions = useJson<PointsData>(`topics/${topic.id}/regions.json`);
  const preview = useJson<PointsData>(`topics/${topic.id}/preview.json`);
  const rows = useMemo(
    () => (regions.data ? decodePoints(regions.data).filter((p) => p.iso3 === iso3 && Number(p.y) <= year) : null),
    [regions.data, iso3, year],
  );
  const previewRows = useMemo(
    () => (preview.data ? decodePoints(preview.data).filter((p) => p.iso3 === iso3) : []),
    [preview.data, iso3],
  );
  if (regions.error) return <p className="empty">{t.loadFailed(regions.error.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  const list = (items: typeof rows) => (
    <ul className="plain-list">
      {items.map((p) => (
        <li key={String(p.code)}>
          <span className="plain-title" translate="no">
            {String(p.name)}
          </span>
          <span className="plain-meta">{regionFacts(p)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, year)}</h3>
      {rows.length === 0 ? <p className="empty">{text.none}</p> : list(rows)}
      {previewRows.length > 0 && (
        <>
          <h3>{text.preview}</h3>
          {list(previewRows)}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
