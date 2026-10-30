import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { SEASONS } from './olympics';
import type { IndicatorDef, PointRecord, PointsOverlayDef } from './types';

/**
 * 奧運場館（2026-10-30，製作手冊第九批順序 161，pipeline/topics/olympic_venues.py）：各屆奧運的比賽場館，運動主題的一個指標。
 * 時間軸是各屆：點是到這一屆為止用過的場館（大小是用過幾屆），這一屆用的有顏色、以前的是灰色；夏季、冬季是子項目。
 */

/** 各屆（pipeline 的 REVISIONS）：預定的標「預定」 */
const EDITIONS = {
  summer: [1896, 1900, 1904, 1908, 1912, 1920, 1924, 1928, 1932, 1936, 1948, 1952, 1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028, 2032],
  winter: [1924, 1928, 1932, 1936, 1948, 1952, 1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026, 2030],
};
const PLANNED_FROM = 2027;

const yearsOf = (p: PointRecord) => String(p.ed ?? '').split(',').map(Number).filter(Boolean);
const yearText = (y: number) => (y >= PLANNED_FROM ? tr({ zh: `${y}（預定）`, en: `${y} (planned)` }) : String(y));

function tooltip(season: 'summer' | 'winter') {
  return (p: PointRecord, ctx: { countryName: (iso3: string) => string }) => {
    const years = yearsOf(p);
    const games = tr(season === 'summer' ? { zh: '夏季奧運', en: 'Summer Games' } : { zh: '冬季奧運', en: 'Winter Games' });
    const sports = typeof p.sp === 'string' ? p.sp.split('|').map((x) => {
      const [y, ...rest] = x.split(':');
      return `${yearText(Number(y))}: ${rest.join(':')}`;
    }) : [];
    return {
      title: String(p.name ?? ''),
      detail: [
        tr({ zh: `${years.map(yearText).join('、')} 年${games}`, en: `${games} ${years.map(yearText).join(', ')}` }),
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '',
      ].filter(Boolean).join(' · '),
      extra: [
        ...sports,
        ...(p.approx ? [tr({ zh: '位置是所在的行政區（場館沒有座標）', en: 'Located at its town (no coordinates for the venue)' })] : []),
      ],
    };
  };
}

const venueLayer = (season: 'summer' | 'winter', label: Text, color: string): PointsOverlayDef => ({
  kind: 'points',
  id: `venues-${season}`,
  file: `venues/${season}.json`,
  label,
  // 到這一屆為止用過幾屆（n）、這一屆有沒有用（now）；還沒用過的不畫（n 是 null，minValue 篩掉）
  epochs: {
    years: EDITIONS[season],
    values: (p, epoch) => {
      const years = yearsOf(p);
      const n = years.filter((y) => y <= epoch).length;
      return { n: n || null, now: years.includes(epoch) ? 1 : 0 };
    },
  },
  minValue: { field: 'n', stops: [[0, 1]] },
  radius: { field: 'n', stops: [[1, 3.2], [2, 4.6], [3, 5.8]] },
  color: {
    field: 'now',
    title: { zh: '場館', en: 'Venues' },
    thresholds: [0.5],
    classes: [
      { color: MAP_TOKENS.context, label: { zh: '以前幾屆用過', en: 'Used at earlier Games' } },
      { color, label: { zh: '這一屆用的', en: 'Used at these Games' } },
    ],
  },
  sortField: 'now',
  sizeLegend: { title: { zh: '用過幾屆', en: 'Games held' }, values: [1, 2, 3], format: (v) => fixed(v, 0) },
  indicators: ['venues'],
  items: [season],
  tooltip: tooltip(season),
});

export const VENUE_OVERLAYS: PointsOverlayDef[] = [
  venueLayer('summer', { zh: '夏季奧運的比賽場館', en: 'Summer Games venues' }, MAP_TOKENS.hues.orange),
  venueLayer('winter', { zh: '冬季奧運的比賽場館', en: 'Winter Games venues' }, MAP_TOKENS.hues.blue),
];

const venuesText = (v: number) => tr({ zh: `${fixed(v, 0)} 個場館`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'venue' : 'venues'}` });

export const VENUE_INDICATOR: IndicatorDef = {
  id: 'venues',
  label: { zh: '比賽場館', en: 'Venues' },
  description: {
    zh: '各屆奧運的比賽場館（不含選手村、轉播中心與只辦典禮的場地）：拖時間軸換屆別，有顏色的是這一屆用的，灰色的是以前幾屆用過的，點的大小是到這一屆為止用過幾屆；同一個場館（例如洛杉磯紀念體育場 1932、1984、2028）辦過好幾屆就累計。2028 洛杉磯、2030 法國阿爾卑斯、2032 布里斯本是預定的場館。滑到國家上看到這一屆為止用過的場館數。國家依今天的國界。',
    en: 'Competition venues of each Olympic Games (not athletes’ villages, broadcast centres or ceremony-only sites): drag the time slider to change Games; coloured dots were used at those Games, grey ones at earlier Games, and dot size shows how many Games each venue has hosted so far (the Los Angeles Memorial Coliseum: 1932, 1984 and 2028). Venues for Los Angeles 2028, the French Alps 2030 and Brisbane 2032 are planned. Hover over a country for the venues used up to those Games. Countries follow today’s borders.',
  },
  unit: { zh: '個', en: 'venues' },
  file: 'venue-count/{item}.json',
  // 點是主角：國家不上色，場館數給 tooltip、排名表、側欄
  layer: { kind: 'none' },
  format: venuesText,
  formatTick: (v) => fixed(v, 0),
  integer: true,
  defaultYear: 2024,
  dimension: SEASONS,
  projectionLabel: { tag: { zh: '預定', en: 'planned' }, from: () => tr({ zh: '2028 起為預定', en: 'Planned from 2028' }) },
  missing: { zh: '還沒有辦過奧運', en: 'Has not hosted the Olympics' },
};
