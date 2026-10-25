import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent, formatSignedPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { overlayEpoch, type IndicatorDef, type PointRecord, type PointsOverlayDef, type TopicDefinition } from './types';

/**
 * 城市（pipeline/topics/cities.py）：GHSL Urban Centre Database 2025 的約 1.1 萬個城市（連續的市區，不是行政區），
 * 1975–2030 每 5 年一期；各國的都市化率、住在城市的比例、最大城市占全國人口、百萬人口以上的城市數、最大城市的人口。
 */

/** GHSL 的各期（2025、2030 是推估） */
export const EPOCHS = [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030];
const PROJECTION_FROM = 2025;

const PEOPLE = { zh: '人', en: 'people' };
const CITIES_UNIT = { zh: '個', en: 'cities' };

/**
 * 某一期的人口（prefix 'p'）或面積 km²（'a'）。cities.json 的 p1975…p2030、a1975…a2030 存的是跟前一期的差
 * （前一期還不是城市時是那一期本身），所以一路加到那一期；那一期還不是城市（或已經不是）時是 null。
 */
export function cityValue(p: PointRecord, prefix: 'p' | 'a', epoch: number): number | null {
  let acc: number | null = null;
  for (const y of EPOCHS) {
    const v = p[`${prefix}${y}`];
    acc = typeof v === 'number' ? (acc === null ? v : acc + v) : null;
    if (y === epoch) return acc;
  }
  return null;
}

/** 第一次成為城市的一期 */
export function firstEpoch(p: PointRecord): number | null {
  return EPOCHS.find((y) => typeof p[`p${y}`] === 'number') ?? null;
}

/** 城市的名稱：中文介面用 Wikidata 的中文名稱（沒有時用英文），英文介面用 UCDB 的英文名稱 */
export function cityName(p: PointRecord): string {
  return getLang() === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.name ?? '');
}

/** 跟哪一期比成長：10 年前（1980 年跟 1975 年比）；那一期還不是城市時是 null */
export function growthBase(p: PointRecord, epoch: number): number | null {
  const base = Math.max(EPOCHS[0], epoch - 10);
  return base < epoch && cityValue(p, 'p', base) !== null ? base : null;
}

export const people = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} people` });
export const density = (v: number) => tr({ zh: `每 km² ${fixed(v, 0)} 人`, en: `${fixed(v, 0)} per km²` });
export const km2 = (v: number) => `${fixed(v, 0)} km²`;

/** 「比 2015 年 +4%」或「2020 年起成為城市」 */
export function growthText(p: PointRecord, epoch: number): string | null {
  const now = cityValue(p, 'p', epoch);
  const base = growthBase(p, epoch);
  if (now !== null && base !== null) {
    const change = formatSignedPercent((now / cityValue(p, 'p', base)! - 1) * 100, 0);
    return tr({ zh: `比 ${base} 年 ${change}`, en: `${change} since ${base}` });
  }
  const first = firstEpoch(p);
  if (first !== null && first > EPOCHS[0] && first <= epoch) {
    return tr({ zh: `${first} 年起成為城市`, en: `a city since ${first}` });
  }
  return null;
}

/**
 * 城市的半徑（px，縮放 2 時）：圓的面積跟人口成正比（半徑 ≈ 3.5 × √(人口 ÷ 100 萬)），分段線性內插；
 * 5 萬人的城市放大到 1.1 px，世界全圖時才看得見。廣州（珠江三角洲連成的一片，4,300 萬人）約 23 px。
 */
const POP_STOPS: [number, number][] = [
  [5e4, 1.1],
  [3e5, 1.9],
  [1e6, 3.5],
  [3e6, 6.1],
  [1e7, 11],
  [2e7, 15.6],
  [4.5e7, 23.5],
];

/**
 * 依縮放只畫大城市：世界全圖（圖磚 0–1 級）200 萬人以上、2 級 100 萬、3 級 30 萬、4 級 10 萬、5 級起全部。
 * 1.1 萬個點一起畫在世界全圖上會糊成一片，也看不出大小。
 */
const ZOOM_STOPS: [number, number][] = [
  [0, 2e6],
  [2, 1e6],
  [3, 3e5],
  [4, 1e5],
  [5, 0],
];

function cityTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string; year: number }) {
  const epoch = overlayEpoch(CITY_LAYER, ctx.year) ?? PROJECTION_FROM;
  const pop = cityValue(p, 'p', epoch);
  const area = cityValue(p, 'a', epoch);
  const parts: string[] = [];
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  if (pop !== null) {
    const projected = epoch >= PROJECTION_FROM ? tr({ zh: '（推估）', en: ' (projected)' }) : '';
    parts.push(tr({ zh: `${epoch} 年 ${people(pop)}${projected}`, en: `${people(pop)} in ${epoch}${projected}` }));
  }
  if (pop !== null && area) {
    parts.push(tr({ zh: `${km2(area)}（${density(pop / area)}）`, en: `${km2(area)} (${density(pop / area)})` }));
  }
  const growth = growthText(p, epoch);
  if (growth) parts.push(growth);
  const zh = getLang() === 'zh' && typeof p.zh === 'string';
  const more = typeof p.more === 'string' ? p.more : null;
  const covers = more ? tr({ zh: `範圍還有 ${more}`, en: `Also covers ${more}` }) : null;
  return {
    title: cityName(p),
    detail: parts.join(' · '),
    // 中文名稱下面寫 UCDB 的英文名稱；範圍內的其他地名（OpenStreetMap 的原文）也寫在這一行
    properNoun: [zh ? String(p.name ?? '') : null, covers].filter(Boolean).join(' · ') || undefined,
  };
}

/** 城市的點：只畫在城市地圖上（面量圖、比例圓上再疊上萬個點會看不清楚） */
export const CITY_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'cities',
  file: 'cities.json',
  label: { zh: '城市（縮小時只畫大城市）', en: 'Cities (only large ones when zoomed out)' },
  indicators: ['map'],
  radius: { field: 'pop', stops: POP_STOPS },
  color: MAP_TOKENS.accent,
  epochs: {
    years: EPOCHS,
    values: (p, epoch) => ({ pop: cityValue(p, 'p', epoch) }),
  },
  minValue: { field: 'pop', stops: ZOOM_STOPS },
  sizeLegend: {
    title: { zh: '人口', en: 'Population' },
    values: [1e6, 1e7, 4e7],
    format: formatLargeTick,
  },
  tooltip: cityTooltip,
};

const pct = (v: number) => formatPercent(v, v < 10 ? 1 : 0);
const pctTick = (v: number) => `${v}%`;
const seq = (thresholds: number[]) => ({ type: 'sequential' as const, thresholds });

const CITY_DEFINITION = {
  zh: '城市指的是每 km² 1,500 人以上的 1 km 格子連成一片、合計 5 萬人以上的連續市區（聯合國統計委員會採用的「城鄉程度」定義），不是行政區',
  en: 'A city is a continuous urban area of 1 km cells with at least 1,500 people per km² and 50,000 people in total (the Degree of Urbanisation adopted by the UN Statistical Commission), not an administrative unit',
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '城市地圖', en: 'City map' },
    description: {
      zh: '全球約 1.1 萬個城市（連續的市區，不是行政區：臺北、新北、桃園、基隆連成一片，算一個城市），圓的面積與人口成正比；拖動時間軸看 1975 年以來的變化。縮小時只畫大城市，放大才看得到小城市。',
      en: 'Some 11,000 cities worldwide (continuous urban areas, not administrative units: Taipei, New Taipei, Taoyuan and Keelung form one city), with circle area proportional to population; drag the time slider to see the change since 1975. Only large cities are shown when zoomed out.',
    },
    unit: '%',
    file: 'city-share.json',
    layer: { kind: 'none' },
    format: (v) => tr({ zh: `住在城市的人口 ${pct(v)}`, en: `${pct(v)} live in cities` }),
    formatTick: pctTick,
    compareWorld: true,
  },
  {
    id: 'urban',
    label: { zh: '都市化率', en: 'Urbanisation rate' },
    description: {
      zh: '住在城市與城鎮（含半密集區）的人口比例：城市之外，每 km² 300 人以上的格子連成一片、合計 5,000 人以上的地方也算。依同一套 1 km 網格算，各國可以直接比較（各國官方的都市化率定義都不同）。',
      en: 'Share of people living in cities, towns and semi-dense areas: besides cities, clusters of 1 km cells with at least 300 people per km² and 5,000 people in total also count. Computed from the same 1 km grid everywhere, so countries can be compared directly (official national definitions differ).',
    },
    unit: '%',
    file: 'urban.json',
    layer: { kind: 'choropleth', scale: seq([40, 55, 70, 80, 90, 95]) },
    format: pct,
    formatTick: pctTick,
    compareWorld: true,
  },
  {
    id: 'city-share',
    label: { zh: '住在城市的比例', en: 'Living in cities' },
    description: {
      zh: `住在城市的人口比例。${CITY_DEFINITION.zh}。2025 年全世界約 45%，1975 年是 32%。`,
      en: `Share of people living in cities. ${CITY_DEFINITION.en}. About 45% of the world's people lived in cities in 2025, up from 32% in 1975.`,
    },
    unit: '%',
    file: 'city-share.json',
    layer: { kind: 'choropleth', scale: seq([10, 20, 35, 50, 65, 80]) },
    format: pct,
    formatTick: pctTick,
    compareWorld: true,
  },
  {
    id: 'primacy',
    label: { zh: '最大城市占全國人口', en: 'Largest city’s share' },
    description: {
      zh: '最大的城市（連續的市區）住了全國多少比例的人口，比例越高，人口越集中在一個城市（城市首位度）。沒有城市的國家沒有值。',
      en: 'Share of the national population living in the largest city (continuous urban area); the higher it is, the more the country is concentrated in one city (urban primacy). Countries without a city have no value.',
    },
    unit: '%',
    file: 'primacy.json',
    layer: { kind: 'choropleth', scale: seq([5, 10, 20, 30, 45, 60]) },
    format: pct,
    formatTick: pctTick,
  },
  {
    id: 'million',
    label: { zh: '百萬人口城市數', en: 'Million-plus cities' },
    description: {
      zh: '人口 100 萬以上的城市有幾個，圓的面積與城市數成正比。城市是連續的市區，所以連成一片的都會區只算一個。',
      en: 'Number of cities with a million people or more; circle area is proportional to the count. Cities are continuous urban areas, so a merged metropolitan area counts once.',
    },
    unit: CITIES_UNIT,
    file: 'million.json',
    layer: { kind: 'bubble', legendValues: [1, 10, 50] },
    format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'city' : 'cities'}` }),
    formatTick: (v) => fixed(v, 0),
    shareOfWorld: true,
  },
  {
    id: 'largest',
    label: { zh: '最大城市的人口', en: 'Largest city' },
    description: {
      zh: '最大的城市（連續的市區）的人口，圓的面積與人口成正比。好幾個城市連成一片時，人口會跳一階：珠江三角洲的廣州、深圳、東莞、佛山在 1990 年代後期連成一個城市，從 1990 年的 582 萬人變成 2000 年的 2,777 萬人。',
      en: 'Population of the largest city (continuous urban area); circle area is proportional to population. When several cities merge into one, the figure jumps: Guangzhou, Shenzhen, Dongguan and Foshan in the Pearl River Delta merged in the late 1990s, going from 5.8 million people in 1990 to 27.8 million in 2000.',
    },
    unit: PEOPLE,
    file: 'largest.json',
    layer: { kind: 'bubble', legendValues: [1e6, 1e7, 4e7] },
    format: people,
    formatTick: formatLargeTick,
  },
];

const NOT_SEPARATE = {
  zh: 'GHSL 的國家統計把香港、澳門算在中國（GADM 的國界），所以沒有分開的值；地圖上香港、澳門的城市照樣畫出來',
  en: 'GHSL country statistics count Hong Kong and Macao as part of China (GADM borders), so there is no separate value; their cities are still shown on the map',
};

export const cities: TopicDefinition = {
  id: 'cities',
  title: { zh: '城市', en: 'Cities and urbanisation' },
  shortTitle: { zh: '城市', en: 'Cities' },
  defaultIndicator: 'map',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'European Commission JRC, GHS-UCDB R2024A（GHSL Urban Centre Database 2025）',
        en: 'European Commission JRC, GHS-UCDB R2024A (GHSL Urban Centre Database 2025)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'European Commission JRC, GHS-COUNTRY-STATS R2024A（各國依城鄉程度的人口）',
        en: 'European Commission JRC, GHS-COUNTRY-STATS R2024A (population by Degree of Urbanisation)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/download.php',
      license: 'CC BY 4.0',
    },
    { name: { zh: 'Wikidata（城市的中文名稱）', en: 'Wikidata (Chinese city names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '內政部戶政司：村里戶數、人口數（台灣對照）', en: 'Department of Household Registration, MOI: population by village (Taiwan cross-check)' },
      url: 'https://www.ris.gov.tw/app/portal/346',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '城市與城鄉人口都來自歐盟執委會聯合研究中心（JRC）的全球人類住區圖層（GHSL）：用 1 km 的人口網格（GHS-POP R2023A，依各國普查分配到格子，總數配合聯合國 WPP 2022）套用「城鄉程度」（Degree of Urbanisation）定義。城市是每 km² 1,500 人以上的格子連成一片、合計 5 萬人以上的連續市區；城鎮與半密集區是每 km² 300 人以上、合計 5,000 人以上的地方；其他是鄉村。城市不是行政區：好幾個行政區連成一片的市區算一個城市（臺北、新北、桃園、基隆是一個；珠江三角洲的廣州、深圳、東莞、佛山也是一個），一個大的行政區也可能只有一部分算城市。每一期的城市範圍各自劃定，所以城市連成一片的那一年人口會跳一階。2025、2030 年是推估。城市的名稱是 UCDB 依 OpenStreetMap 等取的英文名稱，中文名稱來自 Wikidata，對不到的用英文。GHSL 的國家統計把香港、澳門算在中國。',
    en: 'Cities and urban–rural populations come from the Global Human Settlement Layer (GHSL) of the European Commission’s Joint Research Centre: the Degree of Urbanisation applied to a 1 km population grid (GHS-POP R2023A, census counts allocated to cells, national totals aligned with UN WPP 2022). A city is a continuous urban area of cells with at least 1,500 people per km² and 50,000 people in total; towns and semi-dense areas have at least 300 people per km² and 5,000 people in total; the rest is rural. Cities are not administrative units: a built-up area spanning several municipalities is one city (Taipei, New Taipei, Taoyuan and Keelung form one; so do Guangzhou, Shenzhen, Dongguan and Foshan in the Pearl River Delta), and only part of a large municipality may count. City boundaries are drawn separately for each period, so a city’s population jumps in the year it merges with a neighbour. 2025 and 2030 are projections. City names are the UCDB’s English names (from OpenStreetMap and other sources). GHSL counts Hong Kong and Macao as part of China.',
  },
  noValue: { HKG: NOT_SEPARATE, MAC: NOT_SEPARATE },
  panelExtra: () => import('./panels/CitiesPanel'),
  overlays: [CITY_LAYER],
  indicators,
};
