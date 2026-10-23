import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, PointRecord, TopicDefinition } from './types';

/**
 * 地震與火山（pipeline/topics/earthquakes.py）。
 * 地圖上的點是疊加圖層（overlays，畫的順序 = 陣列順序，後面的疊在上面）：板塊邊界 → 火山 → 規模 5–6 → 規模 6 以上。
 * 地震的點依時間軸篩選，篩選方式看指標的 overlayTime：只有那一年、累積到那一年，或那一年起的十年。
 */

const n0 = (v: number) => fixed(v, 0);
const QUAKES_UNIT = { zh: '次', en: 'earthquakes' };
const quakes = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'earthquake' : 'earthquakes'}` });
// 死亡人數寫完整的數字：formatLargeNumber 的中文萬取整數，5 萬 6,754 人會變成「6 萬」（最多 32 萬，寫得下）
const deaths = (v: number) => tr({ zh: `${n0(v)} 人死亡`, en: `${n0(v)} ${Math.round(v) === 1 ? 'death' : 'deaths'}` });

/** 地震的日期（UTC）：md 是月 × 100 + 日（pipeline 的 quake_rows）；NOAA 沒有日期的舊事件月或日是 0 */
export function quakeDate(year: number, md: number | null): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  const month = Math.floor((md ?? 0) / 100);
  const day = (md ?? 0) % 100;
  if (!month) return String(year);
  return day ? `${year}-${pad(month)}-${pad(day)}` : `${year}-${pad(month)}`;
}

/** 規模：一位小數（M7.7） */
export const magnitude = (v: number) => `M${fixed(v, 1)}`;

/**
 * 震源深度的分級（地震學慣用的淺源 < 70 公里、中源 70–300、深源 > 300）。
 * 顏色取自 MAP_TOKENS，跟藍色的海、火山的深褐色都分得開（OKLab ΔE×100，一般／紅色盲／綠色盲）：
 * 紅 ↔ 琥珀 21/22/15、紅 ↔ 紫 26/21/27、琥珀 ↔ 紫 41/40/42；三色跟火山 ≥ 21、跟海 ≥ 21。
 */
const DEPTH: ColorClasses = {
  field: 'depth',
  title: { zh: '震源深度', en: 'Focal depth' },
  thresholds: [70, 300],
  classes: [
    { color: MAP_TOKENS.hues.red, label: { zh: '淺源（70 公里以內）', en: 'Shallow (under 70 km)' } },
    { color: MAP_TOKENS.hues.yellow, label: { zh: '中源（70–300 公里）', en: 'Intermediate (70–300 km)' } },
    { color: MAP_TOKENS.categorical[6], label: { zh: '深源（300 公里以上）', en: 'Deep (over 300 km)' } },
  ],
};
/** 火山：深褐色三角形（ORANGE 700），跟地震的三色在形狀、亮度上都分得開 */
const VOLCANO_COLOR = MAP_TOKENS.sequential[6];
/** 板塊邊界用中性色，不跟地震的顏色搶；三類用實線、虛線與淺灰分開 */
const PLATE_DARK = MAP_TOKENS.inkSecondary;
const PLATE_LIGHT = MAP_TOKENS.inkMuted;

/** 半徑（px，縮放 2 時）：規模每大 1 級，半徑約加倍（面積約 4 倍） */
const MAG_STOPS: [number, number][] = [
  [5, 1],
  [6, 1.8],
  [7, 3.6],
  [8, 7],
  [9, 12],
  [9.5, 14],
];

/** 地震的 tooltip：「M7.7 · 1999-09-20 UTC」，第二行深度、國家、死亡人數，最後是 USGS 的英文地名 */
function quakeTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const mag = p.mag as number | null;
  const date = quakeDate(p.year as number, p.md as number | null);
  const parts: string[] = [];
  if (typeof p.depth === 'number') parts.push(tr({ zh: `深度 ${n0(p.depth)} 公里`, en: `Depth ${n0(p.depth)} km` }));
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  if (typeof p.deaths === 'number' && p.deaths > 0) parts.push(deaths(p.deaths));
  return {
    title: `${mag === null ? '' : `${magnitude(mag)} · `}${date} UTC`,
    detail: parts.join(' · '),
    properNoun: typeof p.place === 'string' ? p.place : undefined,
  };
}

/** GVP 的主要火山類型（pipeline 已經去掉單複數標記），沒列的顯示英文原文 */
export const VOLCANO_TYPES: Record<string, Text> = {
  Stratovolcano: { zh: '層狀火山', en: 'Stratovolcano' },
  'Volcanic field': { zh: '火山群', en: 'Volcanic field' },
  Shield: { zh: '盾狀火山', en: 'Shield volcano' },
  Caldera: { zh: '破火山口', en: 'Caldera' },
  Complex: { zh: '複式火山', en: 'Complex volcano' },
  Compound: { zh: '複合火山', en: 'Compound volcano' },
  'Fissure vent': { zh: '裂隙噴發口', en: 'Fissure vent' },
  'Pyroclastic cone': { zh: '火山碎屑錐', en: 'Pyroclastic cone' },
  'Pyroclastic shield': { zh: '火山碎屑盾', en: 'Pyroclastic shield' },
  'Lava dome': { zh: '熔岩穹丘', en: 'Lava dome' },
  'Lava cone': { zh: '熔岩錐', en: 'Lava cone' },
  Maar: { zh: '低平火山口（瑪珥）', en: 'Maar' },
  'Crater rows': { zh: '火山口列', en: 'Crater rows' },
  'Tuff cone': { zh: '凝灰岩錐', en: 'Tuff cone' },
  'Tuff ring': { zh: '凝灰岩環', en: 'Tuff ring' },
  Cone: { zh: '火山錐', en: 'Cone' },
  'Explosion crater': { zh: '爆裂火山口', en: 'Explosion crater' },
};

export function volcanoType(type: string | number | null): string {
  if (typeof type !== 'string' || !type) return tr({ zh: '火山', en: 'Volcano' });
  return VOLCANO_TYPES[type] ? tr(VOLCANO_TYPES[type]) : type;
}

/** 最近一次噴發的年份：負數是西元前，null 是年代不明（只知道是全新世） */
export function lastEruption(year: number | string | null): string {
  if (typeof year !== 'number') return tr({ zh: '最近一次噴發的年代不明', en: 'Date of last eruption unknown' });
  if (year < 0) return tr({ zh: `最近一次噴發：西元前 ${n0(-year)} 年`, en: `Last eruption: ${n0(-year)} BCE` });
  return tr({ zh: `最近一次噴發：${year} 年`, en: `Last eruption: ${year}` });
}

/** 海拔：海底火山是負數，用真正的減號 */
export const elevation = (v: number) =>
  tr({ zh: `海拔 ${v < 0 ? '−' : ''}${n0(Math.abs(v))} 公尺`, en: `Elevation ${v < 0 ? '−' : ''}${n0(Math.abs(v))} m` });

function volcanoTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const parts: string[] = [];
  if (typeof p.elev === 'number') parts.push(elevation(p.elev));
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  parts.push(lastEruption(p.last));
  return {
    title: volcanoType(p.type),
    detail: parts.join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

/** 有地震點的指標（火山數不畫地震，只畫火山與板塊邊界） */
const QUAKE_INDICATORS = ['quakes-cumulative', 'quakes', 'quakes-decade', 'deaths'];

const M6_DESCRIPTION = {
  zh: '震央在國界內或離岸 50 公里以內的規模 6 以上地震',
  en: 'M6+ earthquakes with the epicentre on land or within 50 km of the coast',
};

const indicators: IndicatorDef[] = [
  {
    id: 'quakes-cumulative',
    label: { zh: '歷年地震（累積）', en: 'Earthquakes (cumulative)' },
    description: {
      zh: '1900 年起到時間軸那一年的規模 6 以上地震：圓點越大規模越大，顏色是震源深度，大多沿著環太平洋的板塊邊界。拖動時間軸看地震一年年累積；滑鼠移到國家上可看累積次數（震央在國界內或離岸 50 公里以內）。',
      en: 'All M6+ earthquakes from 1900 up to the selected year: larger dots are stronger quakes, colours show focal depth, and most follow the plate boundaries around the Pacific. Drag the time slider to watch them accumulate; hover over a country for its running total (epicentres on land or within 50 km of the coast).',
    },
    unit: QUAKES_UNIT,
    file: 'count-cumulative.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    format: (v) => tr({ zh: `1900 年起規模 6 以上 ${quakes(v)}`, en: `${quakes(v)} of M6+ since 1900` }),
    formatTick: n0,
  },
  {
    id: 'quakes',
    label: { zh: '當年的地震', en: 'Earthquakes by year' },
    description: {
      zh: '時間軸那一年的規模 6 以上地震（全球每年約 100–200 次）；滑鼠移到國家上可看當年的次數（震央在國界內或離岸 50 公里以內）。按播放看每一年的變化。',
      en: 'M6+ earthquakes in the selected year (about 100–200 a year worldwide); hover over a country for its count that year (epicentres on land or within 50 km of the coast). Press play to step through the years.',
    },
    unit: QUAKES_UNIT,
    file: 'count-year.json',
    layer: { kind: 'none' },
    overlayTime: 'year',
    format: (v) => tr({ zh: `規模 6 以上 ${quakes(v)}`, en: `${quakes(v)} of M6+` }),
    formatTick: n0,
    shareOfWorld: true,
  },
  {
    id: 'quakes-decade',
    label: { zh: '每十年的地震次數', en: 'Earthquakes per decade' },
    description: {
      zh: `每十年（1990 是 1990–1999 年）${M6_DESCRIPTION.zh}次數；地圖上同時畫出那十年的地震。2020 年代只到今年。`,
      en: `${M6_DESCRIPTION.en} in each decade (1990 means 1990–1999), with that decade's quakes drawn on the map. The 2020s run only to the current year.`,
    },
    unit: QUAKES_UNIT,
    file: 'count-decade.json',
    layer: { kind: 'bubble', legendValues: [10, 50, 150] },
    overlayTime: 10,
    format: quakes,
    formatTick: n0,
    shareOfWorld: true,
  },
  {
    id: 'deaths',
    label: { zh: '地震死亡人數', en: 'Earthquake deaths' },
    description: {
      zh: '每十年地震造成的死亡人數（NOAA 重大地震資料庫，所有規模，含地震引發的海嘯、山崩與火災），算在震央所在或離岸 50 公里內的國家；2004 年印度洋海嘯在斯里蘭卡、印度、泰國的死者都算在印尼。',
      en: 'Earthquake deaths per decade (NOAA Significant Earthquake Database, all magnitudes, including tsunamis, landslides and fires the quake set off), counted in the country of the epicentre or within 50 km of it; deaths from the 2004 Indian Ocean tsunami in Sri Lanka, India and Thailand all count towards Indonesia.',
    },
    unit: { zh: '人', en: 'deaths' },
    file: 'deaths-decade.json',
    layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
    overlayTime: 10,
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'volcanoes',
    label: { zh: '全新世火山數', en: 'Holocene volcanoes' },
    description: {
      zh: '過去約 11,700 年（全新世）曾經噴發或有活動跡象的火山（Smithsonian 全球火山計畫），含離岸 50 公里以內的海底火山。',
      en: 'Volcanoes that have erupted or shown signs of activity in the last 11,700 years or so (the Holocene), per the Smithsonian Global Volcanism Program, including submarine volcanoes within 50 km of the coast.',
    },
    unit: { zh: '座', en: 'volcanoes' },
    file: 'volcanoes-count.json',
    layer: { kind: 'bubble', legendValues: [5, 25, 100] },
    format: (v) => tr({ zh: `${n0(v)} 座`, en: `${n0(v)} ${Math.round(v) === 1 ? 'volcano' : 'volcanoes'}` }),
    formatTick: n0,
    shareOfWorld: true,
  },
];

export const earthquakes: TopicDefinition = {
  id: 'earthquakes',
  title: { zh: '地震與火山', en: 'Earthquakes and volcanoes' },
  // 英文的頂列放不下 "Earthquakes & volcanoes"（1280px 寬超出 66px），只寫 Earthquakes
  shortTitle: { zh: '地震與火山', en: 'Earthquakes' },
  defaultIndicator: 'quakes-cumulative',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'USGS 地震目錄（ComCat）', en: 'USGS Earthquake Catalog (ComCat)' },
      url: 'https://earthquake.usgs.gov/fdsnws/event/1/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'NOAA NCEI 全球重大地震資料庫（死亡人數）', en: 'NOAA NCEI Global Significant Earthquake Database (deaths)' },
      url: 'https://doi.org/10.7289/V5TD9V7K',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: {
        zh: 'Global Volcanism Program, Smithsonian Institution：Volcanoes of the World（全新世火山）',
        en: 'Global Volcanism Program, Smithsonian Institution: Volcanoes of the World (Holocene)',
      },
      url: 'https://volcano.si.edu/',
      license: {
        zh: '美國政府職務作品（無著作權）；Smithsonian 條款：非商業使用、註明出處',
        en: 'US government work (no copyright); Smithsonian terms: non-commercial use with attribution',
      },
    },
    {
      name: {
        zh: 'PB2002 板塊邊界（Bird 2003；Hugo Ahlenius、Nordpil 整理）',
        en: 'PB2002 plate boundaries (Bird 2003; compiled by Hugo Ahlenius, Nordpil)',
      },
      url: 'https://github.com/fraxen/tectonicplates',
      license: 'ODC-By 1.0',
    },
  ],
  note: {
    zh: '地震是 USGS 目錄裡規模 6 以上（1900 年起）與規模 5–6（1973 年起，預設關閉）的地震，日期是世界標準時間（UTC），台灣時間要加 8 小時（集集地震是台灣時間 9 月 21 日凌晨）。1970 年代以前的地震來自重新定位的 ISC-GEM 目錄，小一點的地震可能有缺漏。國家的次數只算震央在國界內或離岸 50 公里以內的地震，深海、洋脊上的地震不算任何國家。死亡人數來自 NOAA 的重大地震資料庫，跟 USGS 的地震依時間與距離配對，含地震引發的海嘯，算在震央附近的國家。火山是 Smithsonian 全球火山計畫的全新世火山清單（Global Volcanism Program, Smithsonian Institution）。',
    en: 'Earthquakes are M6+ events from the USGS catalogue since 1900 and M5–6 events since 1973 (off by default); dates are UTC, so add 8 hours for Taiwan time (the Chi-Chi earthquake struck in the early hours of 21 September local time). Events before the 1970s come from the relocated ISC-GEM catalogue, and smaller ones may be missing. Country counts include only epicentres on land or within 50 km of the coast; quakes in the deep ocean or on mid-ocean ridges belong to no country. Deaths come from the NOAA Significant Earthquake Database, matched to USGS events by time and distance; they include tsunami deaths and are counted in the country near the epicentre. Volcanoes are the Holocene volcano list of the Global Volcanism Program, Smithsonian Institution.',
  },
  panelExtra: () => import('./panels/EarthquakesPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'plates',
      file: 'plates.json',
      label: { zh: '板塊邊界', en: 'Plate boundaries' },
      width: 1.1,
      // 代碼跟 pipeline/sources/plates.py 的 CONVERGENT、DIVERGENT、TRANSFORM 一致
      color: {
        title: { zh: '邊界類型', en: 'Boundary type' },
        classes: [
          { value: 1, color: PLATE_DARK, label: { zh: '聚合（隱沒帶、碰撞）', en: 'Convergent (subduction, collision)' } },
          { value: 2, color: PLATE_DARK, dash: true, label: { zh: '張裂（中洋脊、裂谷）', en: 'Divergent (ridges, rifts)' } },
          { value: 3, color: PLATE_LIGHT, label: { zh: '轉形斷層', en: 'Transform faults' } },
        ],
      },
    },
    {
      kind: 'points',
      id: 'volcanoes',
      file: 'volcanoes.json',
      label: { zh: '火山（全新世）', en: 'Volcanoes (Holocene)' },
      shape: 'triangle',
      radius: 3.5,
      color: VOLCANO_COLOR,
      tooltip: volcanoTooltip,
    },
    {
      kind: 'points',
      id: 'quakes-m5',
      file: 'quakes-m5.json',
      label: { zh: '規模 5–6 地震（1973 年起）', en: 'M5–6 earthquakes (since 1973)' },
      hidden: true,
      indicators: QUAKE_INDICATORS,
      radius: { field: 'mag', stops: MAG_STOPS },
      color: DEPTH,
      sortField: 'mag',
      timeField: 'year',
      tooltip: quakeTooltip,
    },
    {
      kind: 'points',
      id: 'quakes',
      file: 'quakes.json',
      label: { zh: '規模 6 以上地震', en: 'M6+ earthquakes' },
      indicators: QUAKE_INDICATORS,
      radius: { field: 'mag', stops: MAG_STOPS },
      color: DEPTH,
      sortField: 'mag',
      timeField: 'year',
      sizeLegend: { title: { zh: '規模', en: 'Magnitude' }, values: [6, 7, 8, 9], format: magnitude },
      tooltip: quakeTooltip,
    },
  ],
  indicators,
};
