import { useEffect } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import {
  capitalLine,
  flippedOverlayFor,
  formatLatLon,
  km,
  LAND_COLOR,
  pct,
  SEA_COLOR,
  targetName,
  type AntipodesPanelData,
  type SeasFile,
} from '../antipodes';
import type { PanelExtraProps } from '../types';

const TEXT = defineMessages({
  zh: {
    shareTitle: '國土的對蹠點落在哪裡',
    shareAria: (country: string, parts: string[]) => `${country}的國土的對蹠點：${parts.join('、')}`,
    allSea: (country: string) => `${country}的國土翻到地球另一邊，全部落在海上。`,
    land: (share: string) => `${share} 的國土對著陸地`,
    other: '其他',
    shareNote: (area: string) =>
      `每 3 公里一點的等面積網格取樣（國土約 ${area}），每一點的對蹠點在哪一國或哪一片海；海是 IHO 的海域。`,
    showFootprint: '移到地球另一邊',
    footprintNote: '地圖上紫色的是這一國翻過去的形狀。',
    capitalTitle: (city: string, kind: number) => (kind === 1 ? `首都${city}的對蹠點` : `${city}的對蹠點`),
    nearest: (place: string, country: string, distance: string) => `最近的城鎮：${place}（${country}），${distance}`,
    nearestSea: (place: string, distance: string) => `最近的城鎮：${place}，${distance}`,
    border: (distance: string) => `離國界約 ${distance}（Natural Earth 1:10m）`,
    goThere: '移到對蹠點',
    markHere: (city: string) => city,
    markThere: (city: string) => `${city}的對蹠點`,
    marksNote: '地圖上的兩個紫色記號是首都與它的對蹠點，點一下記號移到另一個。',
  },
  en: {
    shareTitle: 'Where its antipodes fall',
    shareAria: (country, parts) => `Antipodes of ${country}: ${parts.join(', ')}`,
    allSea: (country) => `Moved to the other side of the Earth, all of ${country} lands on sea.`,
    land: (share) => `${share} of its land is opposite land`,
    other: 'Other',
    shareNote: (area) =>
      `Sampled on an equal-area grid with a point every 3 km (about ${area} of land), placing each point’s antipode in a country or an IHO sea area.`,
    showFootprint: 'Go to the other side',
    footprintNote: 'The purple shape on the map is this country moved to its antipodes.',
    capitalTitle: (city, kind) => (kind === 1 ? `Antipode of the capital, ${city}` : `Antipode of ${city}`),
    nearest: (place, country, distance) => `Nearest town: ${place} (${country}), ${distance}`,
    nearestSea: (place, distance) => `Nearest town: ${place}, ${distance}`,
    border: (distance) => `About ${distance} from a border (Natural Earth 1:10m)`,
    goThere: 'Go to the antipode',
    markHere: (city) => city,
    markThere: (city) => `Antipode of ${city}`,
    marksNote: 'The two purple marks on the map are the capital and its antipode; click one to go to the other.',
  },
});

export default function AntipodesPanel({ topic, indicator, iso3, countryName: selectedName, highlightLine, focusBox, setMarks }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, loading } = useJson<AntipodesPanelData>(`topics/${topic.id}/panel.json`);
  const seas = useJson<SeasFile>(`topics/${topic.id}/seas.json`).data;
  const countries = useJson<CountryTable>('countries.json').data;
  const country = data?.countries[iso3];
  const overlay = flippedOverlayFor(indicator.id);
  const group = country?.g;
  const cap = country?.capital;

  // 打開側欄就在地圖上標出這一國翻過去的形狀（換國家、關掉側欄時取消）
  useEffect(() => {
    if (group === undefined) return;
    highlightLine?.(overlay, group);
    return () => highlightLine?.(overlay, null);
  }, [overlay, group, highlightLine]);

  // 首都與它的對蹠點的標記：點一下其中一個，地圖移到另一個
  const city = cap ? (lang === 'en' ? cap.en : cap.zh) : null;
  useEffect(() => {
    if (!cap || !city || !setMarks) return;
    setMarks([
      { lon: cap.lon, lat: cap.lat, label: text.markHere(city), kind: 'here', link: 1 },
      { lon: cap.alon, lat: cap.alat, label: text.markThere(city), kind: 'there', link: 0 },
    ]);
    return () => setMarks(null);
  }, [cap, city, setMarks, text]);

  if (loading) return <p className="empty">{t.loading}</p>;
  if (!country) return null;

  const name = (c: string) => countryName(c, countries, lang);
  const targets = country.targets ?? [];
  const landShare = targets.reduce((sum, [target, share]) => sum + (typeof target === 'string' ? share : 0), 0);
  const parts = [...targets.map(([target, share]) => ({ key: String(target), land: typeof target === 'string', label: targetName(target, seas, name), share }))];
  if (country.other) parts.push({ key: 'other', land: false, label: text.other, share: country.other });
  const colorOf = (p: (typeof parts)[number]) => (p.key === 'other' ? 'var(--grid)' : p.land ? LAND_COLOR : SEA_COLOR);
  const capPlace = cap?.place;
  const box = country.box;

  return (
    <section className="panel-section">
      <h3>{text.shareTitle}</h3>
      {landShare === 0 && <p className="antipode-summary">{text.allSea(selectedName)}</p>}
      {landShare > 0 && <p className="antipode-summary">{text.land(pct(landShare))}</p>}
      <div className="river-share" role="img" aria-label={text.shareAria(selectedName, parts.map((p) => `${p.label} ${pct(p.share)}`))}>
        {parts.map((p) => (
          <span key={p.key} style={{ width: `${p.share}%`, background: colorOf(p) }} />
        ))}
      </div>
      <ol className="antipode-targets">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="bar-key" style={{ background: colorOf(p) }} />
            <span className="antipode-target-name">{p.label}</span>
            <strong>{pct(p.share)}</strong>
          </li>
        ))}
      </ol>
      <p className="note">{text.shareNote(country.km2 ? km2(country.km2) : '—')}</p>
      {box && (
        <>
          <button type="button" className="antipode-go" onClick={() => focusBox?.(box)}>
            {text.showFootprint}
          </button>
          <p className="note">{text.footprintNote}</p>
        </>
      )}

      {cap && city && (
        <>
          <h3>{text.capitalTitle(city, cap.kind)}</h3>
          <p className="antipode-summary">{capitalLine(cap, seas, name)}</p>
          <p className="antipode-coords">
            {formatLatLon(cap.lon, cap.lat)} → {formatLatLon(cap.alon, cap.alat)}
          </p>
          {cap.km === 0 && cap.border != null && <p className="note">{text.border(km(cap.border))}</p>}
          {capPlace && (
            <p className="note">
              {capPlace.iso3
                ? text.nearest(lang === 'en' ? capPlace.en : capPlace.zh, name(capPlace.iso3), km(capPlace.km))
                : text.nearestSea(lang === 'en' ? capPlace.en : capPlace.zh, km(capPlace.km))}
            </p>
          )}
          <button
            type="button"
            className="antipode-go"
            onClick={() => focusBox?.([cap.alon - 1.2, cap.alat - 0.9, cap.alon + 1.2, cap.alat + 0.9])}
          >
            {text.goThere}
          </button>
          <p className="note">{text.marksNote}</p>
        </>
      )}
    </section>
  );
}

/** 面積：100 萬 km² 以下寫完整的數字 */
const km2 = (v: number) => `${fixed(v, 0)} km²`;
