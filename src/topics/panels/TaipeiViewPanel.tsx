import { useMemo } from 'react';
import { geoAzimuthalEquidistant, geoCircle, geoInterpolate, geoPath } from 'd3-geo';
import type { Topology } from 'topojson-specification';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { toCountryFeatures } from '../../map/geometry';
import { bearingText, kmText, TAIPEI } from '../taipei-view';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 晝夜與季節主題的首都檔（pipeline/topics/daylight.py）：[緯度, 經度, 時區, 標準時差, 中文, 英文, 種類] */
interface CapitalsFile {
  capitals: Record<string, [number, number, string, number, string, string, number]>;
}

const SIZE = 320;
/** 距離圈（公里）：圓盤的半徑是 20,015 公里（對蹠點） */
const RINGS = [5000, 10000, 15000];
const EARTH_KM = 6371.0088;

const TEXT = defineMessages({
  zh: {
    title: '以台北為中心的世界',
    aria: (country: string) => `以台北為中心的方位等距世界圖，標出${country}與航線`,
    route: (city: string, km: string, dir: string) => `台北 → ${city}：${km}，一開始朝${dir}。`,
    taipei: '這裡就是台北：圓盤的中心。',
    note: '方位等距投影：從圓心往外的直線就是大圓航線，到圓心的距離照比例（每一圈 5,000 公里），最外圈是台北的對蹠點（巴拉圭附近）；越外圈形狀越扭曲。上方是北。',
  },
  en: {
    title: 'The world centred on Taipei',
    aria: (country) => `Azimuthal equidistant world map centred on Taipei, highlighting ${country} and the route`,
    route: (city, km, dir) => `Taipei → ${city}: ${km}, setting off ${dir}.`,
    taipei: 'This is Taipei, at the centre of the disc.',
    note: 'Azimuthal equidistant projection: every straight line from the centre is a great-circle route and distance from the centre is to scale (rings every 5,000 km); the edge is Taipei’s antipode (near Paraguay), and shapes are increasingly distorted towards it. North is up.',
  },
});

export default function TaipeiViewPanel({ topic, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const topo = useJson<Topology>('geo/countries-110m.json').data;
  const capitals = useJson<CapitalsFile>('topics/daylight/capitals.json').data;
  const distance = useJson<IndicatorData>(`topics/${topic.id}/distance.json`).data;
  const bearing = useJson<IndicatorData>(`topics/${topic.id}/bearing-deg.json`).data;

  const drawing = useMemo(() => {
    if (!topo) return null;
    // 台北在圓心、北在上；clipAngle 180 畫到對蹠點為止（整個地球是一個圓盤）
    const projection = geoAzimuthalEquidistant()
      .rotate([-TAIPEI[0], -TAIPEI[1]])
      .clipAngle(179.9)
      .scale(SIZE / 2 / Math.PI)
      .translate([SIZE / 2, SIZE / 2]);
    const path = geoPath(projection);
    const countries = toCountryFeatures(topo).map((c) => ({ iso3: c.iso3, d: path(c.feature) ?? '' }));
    const rings = RINGS.map((km) => ({
      km,
      d: path(geoCircle().center(TAIPEI).radius((km / EARTH_KM) * (180 / Math.PI))()) ?? '',
    }));
    return { projection, path, countries, rings };
  }, [topo]);

  if (!drawing || !capitals) return <p className="empty">{t.loading}</p>;
  const cap = capitals.capitals[iso3];
  const target: [number, number] | null = cap ? [cap[1], cap[0]] : null;
  const route =
    target && iso3 !== 'TWN'
      ? drawing.path({ type: 'LineString', coordinates: Array.from({ length: 65 }, (_, i) => geoInterpolate(TAIPEI, target)(i / 64)) })
      : null;
  const end = target && iso3 !== 'TWN' ? drawing.projection(target) : null;
  const km = distance?.values[iso3]?.[0] ?? null;
  const deg = bearing?.values[iso3]?.[0] ?? null;
  const city = cap ? (lang === 'zh' ? cap[4] : cap[5]) : countryName;
  const r = SIZE / 2;

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {iso3 === 'TWN' ? (
        <p className="panel-figure">{text.taipei}</p>
      ) : (
        km !== null && deg !== null && <p className="panel-figure">{text.route(city, kmText(km), bearingText(deg))}</p>
      )}
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={text.aria(countryName)} style={{ maxWidth: SIZE }}>
        <circle cx={r} cy={r} r={r - 0.5} fill={tokens.page} stroke={tokens.inkMuted} strokeWidth={1} />
        {drawing.countries.map((c) => (
          <path
            key={c.iso3}
            d={c.d}
            fill={c.iso3 === iso3 ? tokens.accent : tokens.axis}
            stroke={tokens.page}
            strokeWidth={0.4}
          />
        ))}
        {drawing.rings.map((ring) => (
          <path key={ring.km} d={ring.d} fill="none" stroke={tokens.inkMuted} strokeWidth={0.8} strokeDasharray="3 3" />
        ))}
        {route && <path d={route} fill="none" stroke={tokens.ink} strokeWidth={1.5} />}
        {end && <circle cx={end[0]} cy={end[1]} r={3.5} fill={tokens.ink} stroke={tokens.page} strokeWidth={1.5} />}
        <circle cx={r} cy={r} r={3.5} fill={tokens.ink} stroke={tokens.page} strokeWidth={1.5} />
        {drawing.rings.map((ring) => (
          <text key={ring.km} x={r + 3} y={r - (ring.km / 20015) * r + 11} fontSize={9} fill={tokens.inkMuted}>
            {fixed(ring.km, 0)}
          </text>
        ))}
      </svg>
      <p className="note">{text.note}</p>
    </section>
  );
}
