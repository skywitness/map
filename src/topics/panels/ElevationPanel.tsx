import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatPercent } from '../../lib/format';
import { reliefColor } from '../../map/terrain';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/elevation.py 輸出的 profiles.json */
interface Profiles {
  /** 高度分段的邊界（公尺）；頭尾是 null（負無限大、正無限大） */
  edges: (number | null)[];
  countries: Record<string, Profile>;
}

interface Profile {
  /** 網格算出的陸地面積（km²） */
  area: number;
  /** 各高度分段的面積占比（%），跟 edges 對應 */
  bands: number[];
  high: Point;
  low: Point;
}

/** 有 zh、en 的是 Wikidata 的具名地點；沒有的是 DEM 網格的最高、最低格 */
interface Point {
  e: number;
  lon: number;
  lat: number;
  zh?: string;
  en?: string;
}

const n0 = (v: number) => fixed(v, 0);
const signed = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0)}`;

const TEXT = defineMessages({
  zh: {
    profile: '高度分布',
    profileAria: (country: string) => `${country}各高度的土地面積占比`,
    band: (lo: number | null, hi: number | null) =>
      lo === null ? '低於海平面' : hi === null ? `${n0(lo)} 公尺以上` : `${n0(lo)}–${n0(hi)} 公尺`,
    profileNote: (area: string) => `陸地面積約 ${area} 平方公里（1 公里網格計算，含湖面）。`,
    high: '最高點',
    low: '最低點',
    metres: (v: number) => `${signed(v)} 公尺`,
    seaLevel: '海平面',
    unnamed: '網格的最高格（未命名）',
    unnamedLow: '網格的最低格（未命名）',
    at: (lat: string, lon: string) => `位置 ${lat}、${lon}`,
    pointsNote: '名稱與標高來自 Wikidata；沒有名稱的是 GMTED2010 網格的值（網格會把山頂平均掉，比實際低）。',
  },
  en: {
    profile: 'Elevation profile',
    profileAria: (country) => `Share of land in each elevation band in ${country}`,
    band: (lo, hi) => (lo === null ? 'Below sea level' : hi === null ? `${n0(lo)} m and above` : `${n0(lo)}–${n0(hi)} m`),
    profileNote: (area) => `Land area about ${area} km² (from the 1 km grid, lakes included).`,
    high: 'Highest point',
    low: 'Lowest point',
    metres: (v) => `${signed(v)} m`,
    seaLevel: 'Sea level',
    unnamed: 'Highest grid cell (unnamed)',
    unnamedLow: 'Lowest grid cell (unnamed)',
    at: (lat, lon) => `At ${lat}, ${lon}`,
    pointsNote: 'Names and heights come from Wikidata; unnamed points are GMTED2010 grid values (grids smooth out summits, so they read low).',
  },
});

function coordinate(value: number, positive: string, negative: string): string {
  return `${fixed(Math.abs(value), 2)}°${value >= 0 ? positive : negative}`;
}

export default function ElevationPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, loading } = useJson<Profiles>(`topics/${topic.id}/profiles.json`);
  const profile = data?.countries[iso3];

  const bands = useMemo<BarListItem[]>(() => {
    if (!data || !profile) return [];
    const items = profile.bands.map((share, i) => {
      const lo = data.edges[i];
      const hi = data.edges[i + 1];
      // 分段中間的高度（頭尾兩段沒有邊界，往外推一點）決定顏色，跟地圖上的分層設色一樣
      const mid = lo === null ? (hi ?? 0) - 200 : hi === null ? lo + 500 : (lo + hi) / 2;
      return { key: String(i), label: text.band(lo, hi), value: share, color: reliefColor(mid) };
    });
    // 由高到低排（像地形剖面）；最高那段以上、以及低於海平面但沒有土地的分段不列
    const top = items.findLastIndex((item) => item.value > 0);
    return items.slice(0, top + 1).filter((item, i) => i > 0 || item.value > 0).reverse();
  }, [data, profile, text]);

  if (loading) return <p className="empty">{t.loading}</p>;
  if (!profile) return null;

  const point = (p: Point, kind: 'high' | 'low') => {
    const name = lang === 'en' ? (p.en ?? p.zh) : (p.zh ?? p.en);
    const label = name ?? (kind === 'low' && p.e === 0 ? text.seaLevel : kind === 'high' ? text.unnamed : text.unnamedLow);
    return (
      <div className="elevation-point">
        <span className="stat-label">{kind === 'high' ? text.high : text.low}</span>
        <span className="stat-value">{text.metres(p.e)}</span>
        <span className="stat-meta">
          {label}
          {/* 海平面沒有特定位置 */}
          {!(kind === 'low' && p.e === 0 && !name) && (
            <> · {text.at(coordinate(p.lat, 'N', 'S'), coordinate(p.lon, 'E', 'W'))}</>
          )}
        </span>
      </div>
    );
  };

  return (
    <section className="panel-section">
      <h3>{text.profile}</h3>
      <div className="elevation-bands">
        <BarList items={bands} format={(v) => formatPercent(v, v > 0 && v < 1 ? 2 : 1)} ariaLabel={text.profileAria(countryName)} />
      </div>
      <p className="note">{text.profileNote(fixed(profile.area, 0))}</p>
      <div className="elevation-points">
        {point(profile.high, 'high')}
        {point(profile.low, 'low')}
      </div>
      <p className="note">{text.pointsNote}</p>
    </section>
  );
}
