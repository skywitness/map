import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent, formatSignedPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import {
  overlayEpoch,
  type IndicatorDef,
  type LinesOverlayDef,
  type ListPanelDef,
  type ListRow,
  type PointRecord,
  type PointsOverlayDef,
  type TopicDefinition,
} from './types';
import { withParts } from './parts';
import { urbanHeatPart } from './urban-heat';

/**
 * 城市（pipeline/topics/cities.py）：JRC GHS-WUP R2025A（聯合國《World Urbanization Prospects 2025》用的那一份）的
 * 約 2.2 萬個城市（連續的市區，不是行政區），1950–2100 每 5 年一期；各國的都市化率、住在城市的比例、最大城市占全國
 * 人口、百萬人口以上的城市數、最大城市的人口、建物面積。
 */

/** GHS-WUP 的各期：1950–1970 是回推的，2025 年起是推估 */
export const EPOCHS = Array.from({ length: 31 }, (_, i) => 1950 + i * 5);
const PROJECTION_FROM = 2025;
/** 1975 年起才有網格（城市的面積）；之前是用聯合國的資料回推 */
const GRID_FROM = 1975;

const PEOPLE = { zh: '人', en: 'people' };
const CITIES_UNIT = { zh: '個', en: 'cities' };

/**
 * 某一期的人口（prefix 'p'）或面積 km²（'a'）。cities.json（pipeline/topics/cities.py 的 _encode()）的 `f`、`l` 是
 * 第一期與最後一期是城市的年份；p1950…p2100、a1975…a2100 存的是跟前一個有值的期的差（f 到 l 之外是 0，之間偶爾
 * 不是城市的期是 null），所以一路加到那一期。那一期還不是城市（或已經併進別的城市）時是 null。
 */
export function cityValue(p: PointRecord, prefix: 'p' | 'a', epoch: number): number | null {
  if (typeof p.f !== 'number' || typeof p.l !== 'number' || epoch < p.f || epoch > p.l) return null;
  if (prefix === 'a' && epoch < GRID_FROM) return null;
  let acc = 0;
  for (const y of EPOCHS) {
    const v = p[`${prefix}${y}`];
    if (typeof v === 'number') acc += v;
    if (y === epoch) return typeof v === 'number' ? acc : null;
  }
  return null;
}

/** 第一次成為城市的一期 */
export function firstEpoch(p: PointRecord): number | null {
  return typeof p.f === 'number' ? p.f : null;
}

/** 城市的名稱：中文介面用 Wikidata 的中文名稱（沒有時用英文），英文介面用 GHS-WUP 的英文名稱 */
export function cityName(p: PointRecord): string {
  return getLang() === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.name ?? '');
}

/** 跟哪一期比成長：10 年前（1955 年跟 1950 年比）；那一期還不是城市時是 null */
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
 * 5 萬人的城市放大到 1.1 px，世界全圖時才看得見。2025 年最大的雅加達（4,200 萬人）約 23 px。
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
 * 上萬個點一起畫在世界全圖上會糊成一片，也看不出大小。
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
    const projected =
      epoch >= PROJECTION_FROM
        ? tr({ zh: '（推估）', en: ' (projected)' })
        : epoch < GRID_FROM
          ? tr({ zh: '（回推）', en: ' (back-cast)' })
          : '';
    parts.push(tr({ zh: `${epoch} 年 ${people(pop)}${projected}`, en: `${people(pop)} in ${epoch}${projected}` }));
  }
  if (pop !== null && area) {
    parts.push(tr({ zh: `${km2(area)}（${density(pop / area)}）`, en: `${km2(area)} (${density(pop / area)})` }));
  }
  const growth = growthText(p, epoch);
  if (growth) parts.push(growth);
  const zh = getLang() === 'zh' && typeof p.zh === 'string';
  return {
    title: cityName(p),
    detail: parts.join(' · '),
    // 中文名稱下面寫 GHS-WUP 的英文名稱
    properNoun: zh ? String(p.name ?? '') : undefined,
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
  // cities.json 只有曾經到過 30 萬人的城市（3 級以下只畫這些），其餘的在 cities-more.json，放大到 3.5 級才下載
  // （pipeline/topics/cities.py 的 IMPORTANT_POP，2026-10-31）
  more: { minZoom: 3.5 },
  sizeLegend: {
    title: { zh: '人口', en: 'Population' },
    values: [1e6, 1e7, 4e7],
    format: formatLargeTick,
  },
  tooltip: cityTooltip,
};

/**
 * 城市的範圍（使用者 2026-10-30 決定每一期都畫）：GHS-WUP-MTUC 1975–2100 每一期的多邊形，放大到 6 級才下載畫面上的
 * 10° 分區（boundaries/<分區>.json）。每個環的 `a`、`b` 是那個範圍從哪一期用到哪一期之前（連續幾期一樣的只存一次），
 * 指標的 overlayTime 是 'cumulative'，所以只畫時間軸那一年的範圍；1975 年以前沒有範圍。
 */
const EXTENT_LAYER: LinesOverlayDef = {
  kind: 'lines',
  id: 'city-extent',
  file: 'boundaries.json',
  label: { zh: '城市的範圍（放大才畫）', en: 'City extents (when zoomed in)' },
  indicators: ['map'],
  width: 0.6,
  color: MAP_TOKENS.accent,
  fill: { field: 'f', value: 1, opacity: 0.12, darkOpacity: 0.2, holeField: 'k' },
  timeField: 'a',
  endField: 'b',
  detail: { minZoom: 6 },
};

/**
 * 人口最多的城市（第十二批 198）：城市地圖，時間軸那一期（1950–2100 每 5 年）人口最多的 50 個城市，排名跟著年份變；
 * 每列：名次與城市、國家、人口（推估、回推的標出來）。跟選取的國家連動（那一國人口最多的 50 個）；點了移過去並標出那一點
 */
const TOP_CITIES = 50;
const TOP_LIST: ListPanelDef = {
  label: { zh: '人口最多的城市', en: 'Largest cities' },
  indicators: ['map'],
  file: 'cities.json',
  layered: true,
  countryField: 'iso3',
  rows: (points, { countryName, year }) => {
    const epoch = overlayEpoch(CITY_LAYER, year) ?? PROJECTION_FROM;
    const note =
      epoch >= PROJECTION_FROM ? tr({ zh: '（推估）', en: ' (projected)' }) : epoch < GRID_FROM ? tr({ zh: '（回推）', en: ' (back-cast)' }) : '';
    return points
      .map((p) => ({ p, pop: cityValue(p, 'p', epoch) }))
      .filter((x): x is { p: PointRecord; pop: number } => x.pop !== null)
      .sort((a, b) => b.pop - a.pop)
      .slice(0, TOP_CITIES)
      .map(({ p, pop }, i): ListRow => {
        const zh = getLang() === 'zh' && typeof p.zh === 'string';
        return {
          key: `${p.name}-${p.lon}-${p.lat}`,
          title: `${i + 1}. ${cityName(p)}`,
          properNoun: zh ? String(p.name ?? '') : undefined,
          lines: [
            typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
            tr({ zh: `${epoch} 年 ${people(pop)}${note}`, en: `${people(pop)} in ${epoch}${note}` }),
          ].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      });
  },
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
      zh: '全球的城市（連續的市區，不是行政區：臺北、新北、桃園、基隆連成一片，算一個城市；2025 年約 1.2 萬個），圓的面積與人口成正比；拖動時間軸看 1950 年到 2100 年的變化（1975 年以前是回推、2025 年起是推估）。縮小時只畫大城市，放大才看得到小城市；放大到一個地區時畫出那一年的城市範圍（1975 年起）。左邊的清單列出那一年人口最多的 50 個城市。',
      en: 'Cities worldwide (continuous urban areas, not administrative units: Taipei, New Taipei, Taoyuan and Keelung form one city; about 12,000 in 2025), with circle area proportional to population; drag the time slider to see the change from 1950 to 2100 (back-cast before 1975, projected from 2025). Only large cities are shown when zoomed out; zoom in to a region to see each city’s extent in that year (from 1975). The list on the left shows that year’s 50 largest cities.',
    },
    unit: '%',
    file: 'city-share.json',
    layer: { kind: 'none' },
    // 城市範圍的線依時間軸篩選：畫那一期用到下一次改變之前的範圍
    overlayTime: 'cumulative',
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
      zh: `住在城市的人口比例。${CITY_DEFINITION.zh}。2025 年全世界約 45%，1950 年是 20%、1975 年是 31%，推估 2100 年是 53%。`,
      en: `Share of people living in cities. ${CITY_DEFINITION.en}. About 45% of the world's people lived in cities in 2025, up from 20% in 1950 and 31% in 1975; 53% is projected for 2100.`,
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
      zh: '最大的城市（連續的市區）的人口，圓的面積與人口成正比。好幾個城市連成一片時，人口會跳一階：珠江三角洲的廣州在 1990 年代後期跟周圍的城市連成一片，從 1990 年的 414 萬人變成 2000 年的 1,897 萬人。跨越國界的城市（澳門與珠海、直布羅陀、摩納哥）比所在的國家還大。',
      en: 'Population of the largest city (continuous urban area); circle area is proportional to population. When several cities merge into one, the figure jumps: Guangzhou in the Pearl River Delta merged with neighbouring cities in the late 1990s, going from 4.1 million people in 1990 to 19.0 million in 2000. Cities that straddle a border (Macao and Zhuhai, Gibraltar, Monaco) are bigger than the country they are placed in.',
    },
    unit: PEOPLE,
    file: 'largest.json',
    layer: { kind: 'bubble', legendValues: [1e6, 1e7, 4e7] },
    format: people,
    formatTick: formatLargeTick,
  },
  // 建物面積（2026-10-29 擴充，製作手冊第五批 38）：GHS-COUNTRY-STATS 的 BU_S_km2_L1，屋頂覆蓋的面積，不是建成區的範圍
  {
    id: 'built',
    label: { zh: '建物面積', en: 'Built-up surface' },
    description: {
      zh: '全國建築物屋頂覆蓋的面積（km²，衛星影像判讀），不是市區的範圍，圓的面積與它成正比。全世界從 1975 年的約 17 萬 km² 變成 2020 年的 46 萬 km²，推估 2100 年約 106 萬 km²；台灣從 494 km² 變成 1,309 km²，約占國土 3.6%。1975 年以前沒有資料，2025 年起是推估。',
      en: 'The area covered by building roofs nationwide (km², from satellite imagery), not the extent of urban areas; circle area is proportional to it. Worldwide it grew from about 174,000 km² in 1975 to 465,000 km² in 2020 and is projected at about 1.06 million km² in 2100; Taiwan’s grew from 494 to 1,309 km², about 3.6% of its land. There are no figures before 1975, and values from 2025 on are projections.',
    },
    unit: { zh: 'km²', en: 'km²' },
    file: 'built.json',
    layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
    format: (v) => `${fixed(v, v < 100 ? 1 : 0)} km²`,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'built-per-capita',
    label: { zh: '人均建物面積', en: 'Built-up surface per person' },
    description: {
      zh: '建物面積除以人口：每個人分到多少屋頂覆蓋的面積（m²），不是住宅的室內面積（多層樓只算一次，工廠、商場也算）。地廣人稀、獨棟住宅多的國家高（澳洲約 200 m²），人口密集或貧窮的國家低；台灣 2020 年約 55 m²。',
      en: 'Built-up surface divided by population: the roof area per person (m²), not floor space (a multi-storey building counts once, and factories and shops are included). It is high in spacious countries of detached houses (about 200 m² in Australia) and low in crowded or poor ones; Taiwan had about 55 m² in 2020.',
    },
    unit: { zh: 'm²/人', en: 'm² per person' },
    file: 'built-per-capita.json',
    layer: { kind: 'choropleth', scale: seq([20, 40, 60, 80, 120, 160]) },
    format: (v) => tr({ zh: `${fixed(v, 0)} m²`, en: `${fixed(v, 0)} m²` }),
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  },
  {
    id: 'built-growth',
    label: { zh: '建物面積比 1975 年多幾倍', en: 'Built-up surface growth since 1975' },
    description: {
      zh: '這一年的建物面積是 1975 年的幾倍。全世界 2020 年是 2.7 倍；中國約 4.9 倍、孟加拉 5.9 倍、衣索比亞與肯亞 8 倍以上，美國 1.9 倍、日本 1.6 倍，台灣 2.65 倍。1975 年建物太少（不到 1 km²）的不算。',
      en: 'Built-up surface in the selected year as a multiple of 1975. Worldwide it was 2.7 times in 2020; about 4.9 in China, 5.9 in Bangladesh and over 8 in Ethiopia and Kenya, against 1.9 in the US, 1.6 in Japan and 2.65 in Taiwan. Countries with under 1 km² built up in 1975 are not shown.',
    },
    unit: { zh: '倍', en: 'times' },
    file: 'built-growth.json',
    layer: { kind: 'choropleth', scale: seq([1.5, 2, 2.5, 3, 4, 6]) },
    format: (v) => tr({ zh: `${fixed(v, 2)} 倍`, en: `×${fixed(v, 2)}` }),
    formatTick: (v) => fixed(v, 1),
    compareWorld: true,
  },
];

export const cities: TopicDefinition = withParts({
  id: 'cities',
  title: { zh: '城市', en: 'Cities and urbanisation' },
  shortTitle: { zh: '城市', en: 'Cities' },
  defaultIndicator: 'map',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'European Commission JRC, GHS-WUP-MTUC R2025A V1.1（每個城市 1950–2100 年的人口與面積，聯合國《World Urbanization Prospects 2025》用的那一份）',
        en: 'European Commission JRC, GHS-WUP-MTUC R2025A V1.1 (population and area of every city, 1950–2100, as used in the UN World Urbanization Prospects 2025)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_wup_mtuc_r2025a.php',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'European Commission JRC, GHS-WUP-COUNTRY-STATS R2025A（各國依城鄉程度的人口、建物面積）',
        en: 'European Commission JRC, GHS-WUP-COUNTRY-STATS R2025A (population by Degree of Urbanisation, built-up surface)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_wup_country_stats_r2025a.php',
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
    zh: '城市與城鄉人口都來自歐盟執委會聯合研究中心（JRC）的全球人類住區圖層（GHSL）為聯合國《世界都市化展望 2025》（World Urbanization Prospects 2025）做的 GHS-WUP R2025A：用 1 km 的人口網格（總數配合聯合國 WPP 2024）套用「城鄉程度」（Degree of Urbanisation）定義。城市是每 km² 1,500 人以上的格子連成一片、合計 5 萬人以上的連續市區；城鎮與半密集區是每 km² 300 人以上、合計 5,000 人以上的地方；其他是鄉村。城市不是行政區：好幾個行政區連成一片的市區算一個城市（臺北、新北、桃園、基隆是一個），一個大的行政區也可能只有一部分算城市。每一期的城市範圍各自劃定，所以城市跟鄰近的城市連成一片的那一年人口會跳一階，被併進去的城市從那一期起不再畫。1975–2020 年是依各國普查分配的網格；1950–1970 年沒有網格，是用聯合國的資料回推的（沒有面積）；2025 年起是 JRC 的 CRISP 模型推估到 2100 年，不是觀測值。城市的名稱是 GHS-WUP 依 GISCO、OpenStreetMap 等取的英文名稱，中文名稱來自 Wikidata，對不到的用英文。跨越國界的城市（澳門與珠海、直布羅陀與西班牙的拉利內阿、摩納哥與周圍的法國市鎮）算在所在的小國，沒有「最大城市占全國人口」。依 GHSL 的使用條件（CC BY 4.0）引用：Schiavina, M., Melchiorri, M., Mari Rivero, I., Florio, P., Freire, S. et al. (2025): GHSL WUP Projections Data Package 2025 – Public release GHS-WUP R2025, Publications Office of the European Union, doi:10.2760/2416436。',
    en: 'Cities and urban–rural populations come from GHS-WUP R2025A, produced by the European Commission’s Joint Research Centre (Global Human Settlement Layer) for the UN World Urbanization Prospects 2025: the Degree of Urbanisation applied to a 1 km population grid (national totals aligned with UN WPP 2024). A city is a continuous urban area of cells with at least 1,500 people per km² and 50,000 people in total; towns and semi-dense areas have at least 300 people per km² and 5,000 people in total; the rest is rural. Cities are not administrative units: a built-up area spanning several municipalities is one city (Taipei, New Taipei, Taoyuan and Keelung form one), and only part of a large municipality may count. City boundaries are drawn separately for each period, so a city’s population jumps in the year it merges with a neighbour, and the absorbed city is no longer drawn from then on. 1975–2020 come from grids built from national censuses; 1950–1970 have no grid and are back-cast from UN data (no area); values from 2025 to 2100 are projections from the JRC’s CRISP model, not observations. City names are GHS-WUP’s English names (from GISCO, OpenStreetMap and other sources). Cities straddling a border (Macao and Zhuhai, Gibraltar and La Línea in Spain, Monaco and the surrounding French towns) are placed in the smaller country and have no largest-city share. Citation under the GHSL conditions of use (CC BY 4.0): Schiavina, M., Melchiorri, M., Mari Rivero, I., Florio, P., Freire, S. et al. (2025): GHSL WUP Projections Data Package 2025 – Public release GHS-WUP R2025, Publications Office of the European Union, doi:10.2760/2416436.',
  },
  panelExtra: () => import('./panels/CitiesPanel'),
  listPanel: TOP_LIST,
  overlays: [EXTENT_LAYER, CITY_LAYER],
  indicators,
}, urbanHeatPart);
