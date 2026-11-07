import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { landslidesPart } from './landslides';
import {
  liveQuakesOverlay,
  PLATE_AREAS,
  PLATE_BOUNDARIES,
  PLATE_LABELS,
  platePin,
  platePointer,
  PLATES_INDICATOR,
  PLATES_WORLD_PANEL,
} from './plates-pb2002';
import type { CategoryDef, ColorClasses, IndicatorDef, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

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
/**
 * 板塊內部的火山（熱點火山，2026-10-30）：青綠色三角形，跟深褐色的隱沒帶、裂谷火山，地震的紅、黃、紫都分得開。
 * 代碼跟 pipeline/topics/earthquakes.py 的 TECTONIC 一致：1 隱沒帶、2 裂谷、3 板塊內部、0 不明
 */
const INTRAPLATE_COLOR = MAP_TOKENS.categorical[0];
const VOLCANO_COLORS: ColorClasses = {
  field: 'ts',
  title: { zh: '構造環境（GVP）', en: 'Tectonic setting (GVP)' },
  thresholds: [3],
  classes: [
    { color: VOLCANO_COLOR, label: { zh: '隱沒帶、裂谷', en: 'Subduction zones and rifts' } },
    { color: INTRAPLATE_COLOR, label: { zh: '板塊內部（不等於熱點）', en: 'Intraplate (not the same as hotspots)' } },
  ],
};
const TECTONIC: Record<number, { zh: string; en: string }> = {
  1: { zh: '隱沒帶', en: 'Subduction zone' },
  2: { zh: '裂谷', en: 'Rift zone' },
  3: { zh: '板塊內部', en: 'Intraplate' },
};
const CRUST: Record<number, { zh: string; en: string }> = {
  1: { zh: '大陸地殼', en: 'continental crust' },
  2: { zh: '中間型地殼', en: 'intermediate crust' },
  3: { zh: '海洋地殼', en: 'oceanic crust' },
};

/** 「板塊內部・海洋地殼」：GVP 的構造環境 */
function tectonicSetting(p: PointRecord): string | null {
  const zone = typeof p.ts === 'number' ? TECTONIC[p.ts] : undefined;
  if (!zone) return null;
  const crust = typeof p.crust === 'number' ? CRUST[p.crust] : undefined;
  return crust ? tr({ zh: `${zone.zh}・${crust.zh}`, en: `${zone.en}, ${crust.en}` }) : tr(zone);
}

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
    // USGS 的地名只剩國名時（「Taiwan」）跟上一行的國名重複，不再寫一次
    properNoun:
      typeof p.place === 'string' && !(typeof p.iso3 === 'string' && p.place === ctx.countryName(p.iso3)) ? p.place : undefined,
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

/** 主要岩性（2026-11-07，製作手冊 538）：pipeline 的 gvp.ROCK_CODES */
export const VOLCANO_ROCKS: Record<number, { zh: string; en: string }> = {
  1: { zh: '安山岩與玄武安山岩', en: 'Andesite and basaltic andesite' },
  2: { zh: '玄武岩與苦橄玄武岩', en: 'Basalt and picrobasalt' },
  3: { zh: '英安岩', en: 'Dacite' },
  4: { zh: '粗面玄武岩與碧玄岩', en: 'Trachybasalt and tephrite-basanite' },
  5: { zh: '流紋岩', en: 'Rhyolite' },
  6: { zh: '粗面岩與粗面英安岩', en: 'Trachyte and trachydacite' },
  7: { zh: '粗面安山岩與玄武粗安岩', en: 'Trachyandesite and basaltic trachyandesite' },
  8: { zh: '似長岩', en: 'Foidite' },
  9: { zh: '響岩', en: 'Phonolite' },
  10: { zh: '響岩質碧玄岩與碧玄質響岩', en: 'Phonotephrite and tephriphonolite' },
};

/** 「主要岩性：安山岩與玄武安山岩」；沒有資料是 null */
export function volcanoRock(rock: unknown): string | null {
  const label = typeof rock === 'number' ? VOLCANO_ROCKS[rock] : undefined;
  return label ? tr({ zh: `主要岩性：${label.zh}`, en: `Main rock: ${label.en}` }) : null;
}

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
  const setting = tectonicSetting(p);
  const extra = [setting ? tr({ zh: `構造環境：${setting}`, en: `Tectonic setting: ${setting}` }) : null, volcanoRock(p.rock)].filter(
    (x): x is string => Boolean(x),
  );
  return {
    title: volcanoType(p.type),
    detail: parts.join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
    extra: extra.length ? extra : undefined,
  };
}

/** 更新世的火山（2026-11-07，製作手冊 538）：類型、海拔、國家，一律註明不是活火山 */
function pleistoceneTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const parts: string[] = [];
  if (typeof p.elev === 'number') parts.push(elevation(p.elev));
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  return {
    title: tr({ zh: `${volcanoType(p.type)}（更新世）`, en: `${volcanoType(p.type)} (Pleistocene)` }),
    detail: parts.join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
    extra: [tr({ zh: '最後一次噴發在約 1 萬 1,700 年前以前，現在不算活火山', en: 'Last erupted before about 11,700 years ago; not considered active' })],
  };
}

/**
 * 這一年最大的地震（第十二批 192）：「當年的地震」指標時，時間軸那一年規模最大的 50 個（規模 6 以上的 quakes.json），
 * 依規模（同規模的死亡多的在前）；每列：規模與國家、日期、死亡人數（有的話）、USGS 的英文地名
 */
const TOP_QUAKES = 50;
const YEAR_LIST: ListPanelDef = {
  label: { zh: '這一年最大的地震', en: 'Largest earthquakes this year' },
  indicators: ['quakes'],
  file: 'quakes.json',
  empty: { zh: '這一年沒有規模 6 以上的地震紀錄', en: 'No M6+ earthquakes recorded this year' },
  rows: (points, { countryName, year }) =>
    points
      .filter((p) => p.year === year && typeof p.mag === 'number')
      .sort((a, b) => Number(b.mag) - Number(a.mag) || Number(b.deaths ?? 0) - Number(a.deaths ?? 0) || Number(a.md) - Number(b.md))
      .slice(0, TOP_QUAKES)
      .map((p, i): ListRow => {
        const country = typeof p.iso3 === 'string' ? countryName(p.iso3) : null;
        const place = typeof p.place === 'string' && p.place !== country ? p.place : undefined;
        return {
          key: `${p.year}-${p.md}-${i}`,
          title: `${magnitude(p.mag as number)}${country ? ` · ${country}` : ''}`,
          properNoun: place,
          lines: [
            [`${quakeDate(p.year as number, p.md as number | null)} UTC`, typeof p.depth === 'number' ? tr({ zh: `深度 ${n0(p.depth)} 公里`, en: `depth ${n0(p.depth)} km` }) : null]
              .filter(Boolean)
              .join(' · '),
            typeof p.deaths === 'number' && p.deaths > 0 ? deaths(p.deaths) : null,
          ].filter((x): x is string => Boolean(x)),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
        };
      }),
};

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
    // 2026-11-02（新8）：陸地與海底都鋪淡的地形陰影，看得出地震沿著海溝、山脈排列
    shade: 'land-sea',
    overlayTime: 'cumulative',
    format: (v) => tr({ zh: `1900 年起規模 6 以上 ${quakes(v)}`, en: `${quakes(v)} of M6+ since 1900` }),
    formatTick: n0,
  },
  {
    id: 'quakes',
    label: { zh: '當年的地震', en: 'Earthquakes by year' },
    description: {
      zh: '時間軸那一年的規模 6 以上地震（全球每年約 100–200 次）；滑鼠移到國家上可看當年的次數（震央在國界內或離岸 50 公里以內）。按播放看每一年的變化；左邊的清單依規模列出那一年最大的 50 個。',
      en: 'M6+ earthquakes in the selected year (about 100–200 a year worldwide); hover over a country for its count that year (epicentres on land or within 50 km of the coast). Press play to step through the years; the list on the left shows the year’s 50 largest by magnitude.',
    },
    unit: QUAKES_UNIT,
    file: 'count-year.json',
    layer: { kind: 'none' },
    // 2026-11-02（新8）：陸地與海底都鋪淡的地形陰影，看得出地震沿著海溝、山脈排列
    shade: 'land-sea',
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
      zh: '過去約 11,700 年（全新世）曾經噴發或有活動跡象的火山（Smithsonian 全球火山計畫），含離岸 50 公里以內的海底火山。地圖上青綠色的三角形是板塊內部的火山（GVP 的構造環境，149 座，例如夏威夷的基拉韋亞、冒納羅亞），其他是隱沒帶與裂谷的火山；板塊內部不等於熱點：冰島在 GVP 歸為裂谷，有的板塊內部火山跟地函熱點無關。灰色的小三角形是更新世的火山（GVP 另一份清單，1,452 座：全新世以前噴發、地形還看得出來，但現在不算活火山）；台灣因此多 7 座：草嶺山、基隆火山群、彭佳嶼、花瓶嶼、棉花嶼、小蘭嶼、綠島。',
      en: 'Volcanoes that have erupted or shown signs of activity in the last 11,700 years or so (the Holocene), per the Smithsonian Global Volcanism Program, including submarine volcanoes within 50 km of the coast. Teal triangles on the map are intraplate volcanoes (the GVP tectonic setting; 149 of them, such as Kīlauea and Mauna Loa in Hawaii); the rest sit on subduction zones and rifts. Intraplate does not mean hotspot: GVP classes Iceland as a rift, and some intraplate volcanoes have nothing to do with mantle plumes. Small grey triangles are Pleistocene volcanoes (a separate GVP list of 1,452 that erupted before the Holocene and still show as landforms but are not considered active); they add seven in Taiwan: Tsaolingshan, the Chilung volcano group, Pengchiahsu, Huapinghsu, Mienhuayu, Hsiaolanyu and Lutao (Green Island).',
    },
    unit: { zh: '座', en: 'volcanoes' },
    file: 'volcanoes-count.json',
    layer: { kind: 'bubble', legendValues: [5, 25, 100] },
    format: (v) => tr({ zh: `${n0(v)} 座`, en: `${n0(v)} ${Math.round(v) === 1 ? 'volcano' : 'volcanoes'}` }),
    formatTick: n0,
    shareOfWorld: true,
  },
];

// ── 地震的損失、房屋、受傷，史上最大的規模與密度（2026-11-07，製作手冊第二十七批 540；pipeline/topics/quake_extra.py）──

const usdMillions = (v: number) => tr({ zh: `${formatLargeNumber(v * 1e6)} 美元`, en: `US$${formatLargeNumber(v * 1e6)}` });
const quakeExtraIndicators: IndicatorDef[] = [
  {
    id: 'quake-damage',
    label: { zh: '地震的經濟損失', en: 'Earthquake damage' },
    description: {
      zh: 'NOAA 重大地震資料庫 1900 年起地震造成的經濟損失（美元，當年的名目金額，沒有通膨調整；只算有確切金額的 667 次，含引發的海嘯與火災；記在受災的國家）。日本 4,324 億美元最多，約一半是 2011 年東北地震（2,201 億），其次中國 1,176 億、土耳其 676 億、美國 598 億、義大利 551 億、智利 353 億、紐西蘭 287 億、委內瑞拉 198 億，台灣 196 億第 9（1999 年集集地震 140 億），墨西哥、印尼各 189 億。點國家看損失最大的幾次。',
      en: 'Economic losses from earthquakes since 1900 in NOAA’s Significant Earthquake Database (US dollars at the time, not adjusted for inflation; only the 667 events with an exact figure, including resulting tsunamis and fires; counted in the country affected). Japan leads with US$432.4 billion, about half of it from the 2011 Tōhoku earthquake (US$220.1 billion), followed by China 117.6 billion, Türkiye 67.6 billion, the US 59.8 billion, Italy 55.1 billion, Chile 35.3 billion, New Zealand 28.7 billion and Venezuela 19.8 billion; Taiwan is ninth with 19.6 billion (14.0 billion from the 1999 Chi-Chi earthquake), and Mexico and Indonesia have 18.9 billion each. Select a country for its costliest earthquakes.',
    },
    unit: { zh: '美元（當年）', en: 'US$ (current)' },
    file: 'quake-damage.json',
    layer: { kind: 'bubble', legendValues: [100, 10000, 100000] },
    timeless: true,
    format: usdMillions,
    formatTick: (v) => formatLargeTick(v * 1e6),
    shareOfWorld: true,
  },
  {
    id: 'quake-houses',
    label: { zh: '地震全毀的房屋', en: 'Houses destroyed by earthquakes' },
    description: {
      zh: 'NOAA 重大地震資料庫 1900 年起地震全毀的房屋棟數（只算有確切棟數的 820 次，含海嘯）。中國 935 萬棟最多，日本 127 萬、土耳其 95 萬、尼泊爾 53 萬、印度 48 萬、印尼 42 萬；台灣 75,607 棟（第 19）。各國對「全毀」的認定不同，棟數也不分大小。',
      en: 'Houses destroyed by earthquakes since 1900 in NOAA’s Significant Earthquake Database (only the 820 events with an exact count, including tsunamis). China leads with 9.35 million, then Japan 1.27 million, Türkiye 952,000, Nepal 532,000, India 479,000 and Indonesia 425,000; Taiwan has 75,607 (19th). What counts as destroyed differs between countries, and a house is a house regardless of size.',
    },
    unit: { zh: '棟', en: 'houses' },
    file: 'quake-houses.json',
    layer: { kind: 'bubble', legendValues: [1000, 100000, 1000000] },
    timeless: true,
    format: (v) => tr({ zh: `${formatLargeNumber(v)} 棟`, en: `${formatLargeNumber(v)} houses` }),
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'quake-injuries',
    label: { zh: '地震受傷人數', en: 'Earthquake injuries' },
    description: {
      zh: 'NOAA 重大地震資料庫 1900 年起地震造成的受傷人數（只算有確切人數的）。中國 131 萬人最多，土耳其 31.8 萬、海地 31.3 萬、伊朗 20.7 萬、印度 20.2 萬、巴基斯坦 16.9 萬、日本 15.1 萬；台灣 32,852 人（第 13）。',
      en: 'People injured by earthquakes since 1900 in NOAA’s Significant Earthquake Database (only events with an exact count). China leads with 1.31 million, then Türkiye 318,000, Haiti 313,000, Iran 207,000, India 202,000, Pakistan 169,000 and Japan 151,000; Taiwan has 32,852 (13th).',
    },
    unit: { zh: '人', en: 'people' },
    file: 'quake-injuries.json',
    layer: { kind: 'bubble', legendValues: [1000, 100000, 1000000] },
    timeless: true,
    format: (v) => tr({ zh: `${formatLargeNumber(v)} 人受傷`, en: `${formatLargeNumber(v)} injured` }),
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'max-magnitude',
    label: { zh: '史上最大的地震規模', en: 'Largest earthquake on record' },
    description: {
      zh: '1900 年起這一國最大的地震規模（USGS；震央在國界內或離岸 50 公里以內，更遠但有人死亡的照 NOAA 記的國家）。智利 1960 年的 9.5 最大，美國阿拉斯加 1964 年 9.2、日本 2011 年東北地震 9.1、印尼 2004 年蘇門答臘 9.1、俄羅斯堪察加 1952 年 9.0、厄瓜多 1906 年 8.8。台灣是 1920 年 6 月花蓮外海的 8.2，1999 年集集地震是 7.7。1970 年代以前的規模是後來重新估的，1960 年以前的誤差比較大。',
      en: 'The largest earthquake since 1900 in each country (USGS; epicentre on land or within 50 km of the coast, or farther out if NOAA records deaths in that country). Chile’s 1960 M9.5 is the largest, followed by Alaska (US) 1964 M9.2, Japan’s 2011 Tōhoku M9.1, Sumatra (Indonesia) 2004 M9.1, Kamchatka (Russia) 1952 M9.0 and Ecuador 1906 M8.8. Taiwan’s is the M8.2 off Hualien in June 1920; the 1999 Chi-Chi earthquake was M7.7. Magnitudes before the 1970s were re-estimated later, and those before 1960 are less certain.',
    },
    unit: { zh: '規模', en: 'magnitude' },
    file: 'max-magnitude.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6.5, 7, 7.5, 8, 8.5, 9] } },
    timeless: true,
    format: magnitude,
    formatTick: (v) => fixed(v, 1),
  },
  {
    id: 'quake-density',
    label: { zh: '地震的密度', en: 'Earthquake density' },
    description: {
      zh: '1900 年起規模 6 以上的地震，平均每萬平方公里陸地有幾次（國家歸屬同「歷年地震」，含離岸 50 公里內的海域地震，所以小島國特別高；陸地面積用 FAOSTAT）。北馬里亞納 613 次、瓦利斯和富圖納 352、萬那杜 252、東加 250、關島 240、索羅門群島 97.2，台灣 52.5（186 次）、斐濟 50.4、巴布亞紐幾內亞 14.6、哥斯大黎加 13.7、菲律賓 13.6、日本 11.1。',
      en: 'M6+ earthquakes since 1900 per 10,000 km² of land (countries assigned as in the cumulative earthquake view, including quakes within 50 km offshore, which is why small island states rank high; land area from FAOSTAT). The Northern Mariana Islands lead with 613, then Wallis and Futuna 352, Vanuatu 252, Tonga 250, Guam 240 and the Solomon Islands 97.2; Taiwan has 52.5 (186 quakes), Fiji 50.4, Papua New Guinea 14.6, Costa Rica 13.7, the Philippines 13.6 and Japan 11.1.',
    },
    unit: { zh: '次／萬平方公里', en: 'per 10,000 km²' },
    file: 'quake-density.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 25] } },
    timeless: true,
    format: (v) => tr({ zh: `每萬平方公里 ${fixed(v, v >= 100 ? 0 : 1)} 次`, en: `${fixed(v, v >= 100 ? 0 : 1)} per 10,000 km²` }),
    formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
  },
];

// ── 火山的類型、岩性、噴發史（2026-11-07，製作手冊第二十七批 538；pipeline/topics/volcano_extra.py）──

/** 有火山點的指標：更新世的火山只畫在這些指標上 */
const VOLCANO_INDICATORS = [
  'volcanoes',
  'volcano-type',
  'volcano-rock',
  'eruptions',
  'eruptions-2000',
  'max-vei',
  'volcano-deaths',
  'volcano-pop',
  'volcano-pop-share',
];
/** 住在火山旁邊的人：半徑（volcano_people.py 的 RADII） */
const RADIUS_DIMENSION = {
  label: { zh: '離火山', en: 'Distance' },
  options: [
    { id: '10', label: { zh: '10 公里內', en: 'Within 10 km' } },
    { id: '30', label: { zh: '30 公里內', en: 'Within 30 km' } },
    { id: '100', label: { zh: '100 公里內', en: 'Within 100 km' } },
  ],
  defaultOption: '30',
};

/** 主要火山類型的 9 類：代碼跟 volcano_extra.py 的 TYPE_GROUPS 一致，依全世界的座數排 */
const TYPE_CATEGORIES: CategoryDef[] = [
  { value: 1, label: { zh: '層狀火山', en: 'Stratovolcano' } },
  { value: 4, label: { zh: '火山群', en: 'Volcanic field' } },
  { value: 2, label: { zh: '盾狀火山', en: 'Shield volcano' } },
  { value: 3, label: { zh: '破火山口', en: 'Caldera' } },
  { value: 5, label: { zh: '複式與複合火山', en: 'Complex and compound volcano' } },
  { value: 7, label: { zh: '火山錐與火口（火山碎屑錐、熔岩錐、瑪珥等）', en: 'Cones and craters (pyroclastic and lava cones, maars, etc.)' } },
  { value: 6, label: { zh: '裂隙噴發口與火山口列', en: 'Fissure vents and crater rows' } },
  { value: 8, label: { zh: '熔岩穹丘', en: 'Lava dome' } },
];
/** 代碼 9（冰下火山等其他類型）畫成類別圖的「其他」；2026-11-07 沒有一國以這一類最多 */
const OTHER_TYPE: Text = { zh: '其他', en: 'Other' };
/** 主要岩性的 7 類（volcano_extra.py 的 ROCK_GROUPS） */
const ROCK_CATEGORIES: CategoryDef[] = [
  { value: 1, label: { zh: '安山岩與玄武安山岩', en: 'Andesite and basaltic andesite' } },
  { value: 2, label: { zh: '玄武岩', en: 'Basalt' } },
  { value: 3, label: { zh: '英安岩', en: 'Dacite' } },
  { value: 4, label: { zh: '粗面玄武岩與碧玄岩', en: 'Trachybasalt and tephrite-basanite' } },
  { value: 5, label: { zh: '流紋岩', en: 'Rhyolite' } },
  { value: 6, label: { zh: '粗面岩與粗面安山岩', en: 'Trachyte and trachyandesite' } },
  { value: 7, label: { zh: '鹼性岩（似長岩、響岩）', en: 'Alkaline rocks (foidite, phonolite)' } },
];
/** 最大的噴發：VEI 7 到 0–1 的順序類別 */
const VEI_CATEGORIES: CategoryDef[] = [
  ...[7, 6, 5, 4, 3, 2].map((n) => ({ value: n, label: { zh: `VEI ${n}`, en: `VEI ${n}` } })),
  { value: 0, max: 1, label: { zh: 'VEI 0–1', en: 'VEI 0–1' } },
];
const categoryLabel = (categories: CategoryDef[], other?: Text) => (v: number) => {
  const c = categories.find((x) => v >= x.value && v <= (x.max ?? x.value));
  return c ? tr(c.label) : other ? tr(other) : String(v);
};
const formatPeople = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} people` });
const eruptions = (v: number) => tr({ zh: `${n0(v)} 次噴發`, en: `${n0(v)} ${Math.round(v) === 1 ? 'eruption' : 'eruptions'}` });

const volcanoIndicators: IndicatorDef[] = [
  {
    id: 'volcano-type',
    label: { zh: '最多的火山類型', en: 'Most common volcano type' },
    description: {
      zh: '這一國的全新世火山最多是哪一種（GVP 的主要類型，一樣多時取全世界比較多的那一類）。全世界 1,214 座：層狀火山 660 座最多，火山群 138、盾狀火山 113（含火山碎屑盾）、破火山口 85、複式與複合火山 66、火山錐與火口 63、裂隙噴發口與火山口列 57、熔岩穹丘 31。60 國以層狀火山最多（日本、印尼、美國、智利等環太平洋的國家）；以火山群最多的 16 國多在板塊內部，例如中國、澳洲、加拿大、墨西哥、德國、沙烏地阿拉伯；盾狀火山最多的有肯亞、南非、留尼旺、薩摩亞等 10 個；西班牙是裂隙噴發口、法國是熔岩穹丘。台灣的 2 座：龜山島是層狀火山、大屯火山群是熔岩穹丘。火山群與裂隙噴發口不是單一座山，座數不能跟層狀火山直接比。',
      en: 'The most common kind of Holocene volcano in each country (GVP primary volcano type; ties go to the type that is more common worldwide). Of 1,214 volcanoes, 660 are stratovolcanoes, then volcanic fields 138, shield volcanoes 113 (including pyroclastic shields), calderas 85, complex and compound volcanoes 66, cones and craters 63, fissure vents and crater rows 57 and lava domes 31. Stratovolcanoes dominate in 60 countries (Japan, Indonesia, the US, Chile and others around the Pacific); the 16 where volcanic fields dominate lie mostly within plates, such as China, Australia, Canada, Mexico, Germany and Saudi Arabia; shield volcanoes lead in 10, including Kenya, South Africa, Réunion and Samoa; Spain’s are mostly fissure vents and France’s lava domes. Taiwan’s two are Kueishantao, a stratovolcano, and the Tatun volcano group, a lava dome. Volcanic fields and fissure vents are not single mountains, so their counts are not comparable with stratovolcanoes.',
    },
    unit: '',
    file: 'volcano-type.json',
    layer: { kind: 'categorical', categories: TYPE_CATEGORIES, other: OTHER_TYPE },
    timeless: true,
    format: categoryLabel(TYPE_CATEGORIES, OTHER_TYPE),
    missing: { zh: '沒有全新世火山', en: 'No Holocene volcanoes' },
  },
  {
    id: 'volcano-rock',
    label: { zh: '火山最多的岩性', en: 'Most common volcanic rock' },
    description: {
      zh: '這一國的全新世火山最多是哪一種岩石（GVP 的主要岩性，沒有資料的 66 座不算，一樣多時取全世界比較多的那一類）。全世界安山岩與玄武安山岩 504 座最多，玄武岩 383、英安岩 79、粗面玄武岩與碧玄岩 56、粗面岩與粗面安山岩 55、流紋岩 53、鹼性岩（似長岩、響岩）18。安山岩跟玄武岩各是 36 國的第一：安山岩多在隱沒帶（日本、印尼、智利、美國、台灣），玄武岩多在裂谷與板塊內部（冰島、衣索比亞、中國、加拿大、肯亞）；義大利、澳洲、西班牙等 10 國是粗面玄武岩，德國、維德角、烏干達是鹼性岩。台灣的 2 座都是安山岩。',
      en: 'The most common rock among each country’s Holocene volcanoes (GVP major rock type; the 66 without data are left out, and ties go to the rock that is more common worldwide). Worldwide, andesite and basaltic andesite lead with 504 volcanoes, then basalt 383, dacite 79, trachybasalt and tephrite-basanite 56, trachyte and trachyandesite 55, rhyolite 53 and alkaline rocks (foidite, phonolite) 18. Andesite and basalt each lead in 36 countries: andesite mostly along subduction zones (Japan, Indonesia, Chile, the US, Taiwan), basalt in rifts and plate interiors (Iceland, Ethiopia, China, Canada, Kenya); trachybasalt leads in 10 countries including Italy, Australia and Spain, and alkaline rocks in Germany, Cabo Verde and Uganda. Both of Taiwan’s volcanoes are andesitic.',
    },
    unit: '',
    file: 'volcano-rock.json',
    layer: { kind: 'categorical', categories: ROCK_CATEGORIES },
    timeless: true,
    format: categoryLabel(ROCK_CATEGORIES),
    missing: { zh: '沒有全新世火山，或沒有岩性的資料', en: 'No Holocene volcanoes, or no rock data' },
  },
  {
    id: 'eruptions',
    label: { zh: '1500 年起的火山噴發', en: 'Volcanic eruptions since 1500' },
    description: {
      zh: '1500 年起到時間軸那一年 GVP 確認的火山噴發次數（不含「不確定」的噴發；一次噴發可能持續好幾年，算在開始那一年；海底火山不算任何國家）。到今年全世界有國家的 6,453 次：印尼 1,273 次最多，日本 862、俄羅斯 513、美國 489、智利 386、紐西蘭 237、巴布亞紐幾內亞 222、厄瓜多 219、尼加拉瓜 195、菲律賓 191、法屬留尼旺 189。台灣 2 次。越早的紀錄越不完整（偏向有文字紀錄的地方），次數一路往上爬，大半是紀錄變好，不是火山變活躍。',
      en: 'Confirmed volcanic eruptions from 1500 up to the selected year, per GVP (excluding “uncertain” eruptions; an eruption lasting several years counts in the year it began; submarine volcanoes belong to no country). To date, countries account for 6,453: Indonesia leads with 1,273, then Japan 862, Russia 513, the US 489, Chile 386, New Zealand 237, Papua New Guinea 222, Ecuador 219, Nicaragua 195, the Philippines 191 and French Réunion 189. Taiwan has 2. Earlier records are less complete (biased towards places with written records), so most of the steady rise reflects better recording, not more active volcanoes.',
    },
    unit: { zh: '次', en: 'eruptions' },
    file: 'eruptions.json',
    layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
    defaultYear: 2026,
    format: eruptions,
    formatTick: n0,
    shareOfWorld: true,
  },
  {
    id: 'eruptions-2000',
    label: { zh: '2000 年起的火山噴發', en: 'Volcanic eruptions since 2000' },
    description: {
      zh: '2000 年以後開始、GVP 確認的火山噴發次數：全世界有國家的 941 次，印尼 182 次最多，俄羅斯 91、日本 85、美國 58、巴布亞紐幾內亞 58、尼加拉瓜 57、菲律賓 40、智利 39。台灣 0 次。',
      en: 'Confirmed eruptions that began in 2000 or later, per GVP: countries account for 941, led by Indonesia with 182, then Russia 91, Japan 85, the US 58, Papua New Guinea 58, Nicaragua 57, the Philippines 40 and Chile 39. Taiwan has none.',
    },
    unit: { zh: '次', en: 'eruptions' },
    file: 'eruptions-2000.json',
    layer: { kind: 'bubble', legendValues: [5, 25, 100] },
    timeless: true,
    format: eruptions,
    formatTick: n0,
    shareOfWorld: true,
  },
  {
    id: 'max-vei',
    label: { zh: '最大的火山噴發', en: 'Largest volcanic eruption' },
    description: {
      zh: '這一國全新世（約 1 萬 1,700 年來）確認的噴發裡，火山爆發指數（VEI）最大的一次；VEI 每多 1 級，噴出物大約多 10 倍，沒有估 VEI 的噴發不算。VEI 7 的 7 次在 6 國：印尼的坦博拉（GVP 記開始於 1812 年，1815 年最猛烈）與林賈尼（1257 年）、希臘的聖托里尼（西元前 1610 年）、阿根廷的 Cerro Blanco（西元前 2300 年）、日本的鬼界破火山口（西元前 4350 年）、美國的火山口湖（西元前 5680 年）、俄羅斯堪察加的庫里爾湖（西元前 6440 年）。VEI 6 的有 15 國。台灣最大的是 VEI 2。',
      en: 'The largest confirmed Holocene eruption (the last 11,700 years or so) in each country, by Volcanic Explosivity Index; each step up in VEI means roughly ten times more erupted material, and eruptions without a VEI estimate are left out. The seven VEI 7 eruptions fall in six countries: Tambora (which GVP dates from 1812; it peaked in 1815) and Rinjani (1257) in Indonesia, Santorini in Greece (1610 BCE), Cerro Blanco in Argentina (2300 BCE), the Kikai caldera in Japan (4350 BCE), Crater Lake in the US (5680 BCE) and Kurile Lake in Kamchatka, Russia (6440 BCE). Fifteen countries have had a VEI 6. Taiwan’s largest is VEI 2.',
    },
    unit: 'VEI',
    file: 'max-vei.json',
    layer: { kind: 'categorical', ordinal: true, categories: VEI_CATEGORIES },
    timeless: true,
    format: categoryLabel(VEI_CATEGORIES),
    missing: { zh: '沒有全新世火山，或沒有估 VEI 的噴發', en: 'No Holocene volcanoes, or no eruptions with a VEI estimate' },
  },
  // 2026-11-07（製作手冊 539）：NOAA 重大火山噴發的死亡人數、住在火山旁邊的人（pipeline/topics/volcano_people.py）
  {
    id: 'volcano-deaths',
    label: { zh: '火山噴發的死亡人數', en: 'Deaths from volcanic eruptions' },
    description: {
      zh: 'NOAA 重大火山噴發資料庫裡，火山噴發造成的死亡人數（有紀錄以來的總和，含引發的海嘯、泥流與事後的饑荒、疾病；國家照 NOAA 寫的國名，馬提尼克、留尼旺等屬地另外算）。903 筆噴發合計 335,760 人：印尼 143,504 人最多，薩爾瓦多 30,327、馬提尼克 29,523、哥倫比亞 25,475、義大利 23,072、日本 22,680、瓜地馬拉 11,725、冰島 10,188、菲律賓 7,930、美國 5,568。最慘的五次：印尼的坦博拉 1815 年 60,000 人、喀拉喀托 1883 年 36,417 人，薩爾瓦多的 Ilopango 450 年前後 30,000 人，馬提尼克的培雷火山 1902 年 28,000 人，哥倫比亞的內瓦多德魯伊斯 1985 年 23,080 人。古代的人數是推估。台灣有 1 筆（1853 年，VEI 2），沒有死亡紀錄。點國家看這一國死亡最多的噴發與死因。',
      en: 'Deaths caused by volcanic eruptions in NOAA’s Significant Volcanic Eruptions Database (all recorded eruptions combined, including resulting tsunamis, lahars and later famine and disease; countries follow NOAA’s names, so territories such as Martinique and Réunion count separately). Its 903 eruptions killed 335,760 people: Indonesia leads with 143,504, then El Salvador 30,327, Martinique 29,523, Colombia 25,475, Italy 23,072, Japan 22,680, Guatemala 11,725, Iceland 10,188, the Philippines 7,930 and the US 5,568. The five worst: Tambora in Indonesia in 1815 (60,000) and Krakatau in 1883 (36,417), Ilopango in El Salvador around 450 (30,000), Mount Pelée on Martinique in 1902 (28,000) and Nevado del Ruiz in Colombia in 1985 (23,080). Ancient tolls are estimates. Taiwan has one entry (1853, VEI 2) with no recorded deaths. Select a country for its deadliest eruptions and their causes.',
    },
    unit: { zh: '人', en: 'deaths' },
    file: 'volcano-deaths.json',
    layer: { kind: 'bubble', legendValues: [100, 5000, 50000] },
    timeless: true,
    format: deaths,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'volcano-pop',
    label: { zh: '住在活火山旁邊的人', en: 'People living near active volcanoes' },
    description: {
      zh: '住在陸上的全新世火山 10、30 或 100 公里內的人數（JRC GHS-POP 2020 年的 1 公里人口網格；海面下的火山不算；離兩座火山都近的人只算一次）。100 公里內全世界 8.03 億人（10.2%），跟 Brown 等人用 LandScan 2011 算的 8.02 億差不多；30 公里內 2.15 億、10 公里內 2,740 萬。100 公里內人數最多的是印尼 1.93 億，其次菲律賓 8,798 萬、日本 8,570 萬、墨西哥 6,020 萬、衣索比亞 4,925 萬。台灣 30 公里內有 792 萬人（大屯火山群就在台北盆地北邊）。半徑不等於危險範圍：火山碎屑流十幾公里，火山灰可以飄幾百公里。',
      en: 'People living within 10, 30 or 100 km of a Holocene volcano on land (JRC GHS-POP 1 km population grid for 2020; submarine volcanoes are excluded, and anyone near two volcanoes is counted once). Within 100 km live 803 million people worldwide (10.2%), close to the 802 million that Brown and colleagues estimated with LandScan 2011; within 30 km, 215 million, and within 10 km, 27.4 million. Indonesia has the most within 100 km at 193 million, followed by the Philippines 88.0 million, Japan 85.7 million, Mexico 60.2 million and Ethiopia 49.3 million. In Taiwan, 7.92 million people live within 30 km (the Tatun volcano group sits just north of the Taipei Basin). The radius is not a hazard zone: pyroclastic flows reach a dozen or so kilometres, while ash can drift hundreds.',
    },
    unit: { zh: '人', en: 'people' },
    file: 'volcano-pop/{item}.json',
    dimension: RADIUS_DIMENSION,
    layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
    timeless: true,
    format: formatPeople,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'volcano-pop-share',
    label: { zh: '住在活火山旁邊的人口比例', en: 'Share of people near active volcanoes' },
    description: {
      zh: '住在陸上全新世火山 10、30 或 100 公里內的人占全國人口的比例（GHS-POP 2020 年）。加勒比海與太平洋的火山小島幾乎全國都在：蒙哲臘 10 公里內就有 99.9%（蘇弗里耶爾丘火山），30 公里內多米尼克、格瑞那達、聖克里斯多福、美屬薩摩亞、馬約特都是 100%，梵蒂岡也在羅馬東南方 Colli Albani 火山的 30 公里內。人口百萬以上的國家，30 公里內薩爾瓦多 90.9% 最高，哥斯大黎加 71.5%、瓜地馬拉 48.4%、尼加拉瓜 45.7%、赤道幾內亞 42.9%、紐西蘭 36.6%、台灣 33.4%、厄瓜多 27.4%、印尼 27.0%，日本 10.6%。100 公里內的話，薩爾瓦多、吉布地、亞美尼亞、哥斯大黎加幾乎全國都在，印尼 71.3%、日本 68.5%、台灣 50.1%。',
      en: 'Share of each country’s population living within 10, 30 or 100 km of a Holocene volcano on land (GHS-POP 2020). Volcanic islands in the Caribbean and Pacific are almost entirely covered: 99.9% of Montserrat lies within 10 km (of Soufrière Hills), and Dominica, Grenada, Saint Kitts and Nevis, American Samoa and Mayotte are at 100% within 30 km, as is the Vatican, within 30 km of the Colli Albani volcano south-east of Rome. Among countries of a million or more, El Salvador is highest within 30 km at 90.9%, then Costa Rica 71.5%, Guatemala 48.4%, Nicaragua 45.7%, Equatorial Guinea 42.9%, New Zealand 36.6%, Taiwan 33.4%, Ecuador 27.4% and Indonesia 27.0%; Japan 10.6%. Within 100 km, nearly everyone in El Salvador, Djibouti, Armenia and Costa Rica is included, as are 71.3% in Indonesia, 68.5% in Japan and 50.1% in Taiwan.',
    },
    unit: '%',
    file: 'volcano-pop-share/{item}.json',
    dimension: RADIUS_DIMENSION,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 75] } },
    timeless: true,
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${v}%`,
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
      name: { zh: 'NOAA NCEI 全球重大火山噴發資料庫（死亡人數）', en: 'NOAA NCEI Global Significant Volcanic Eruptions Database (deaths)' },
      url: 'https://doi.org/10.7289/V5JW8BSH',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: {
        zh: 'Global Volcanism Program, Smithsonian Institution：Volcanoes of the World（全新世火山與噴發、更新世火山）',
        en: 'Global Volcanism Program, Smithsonian Institution: Volcanoes of the World (Holocene volcanoes and eruptions, Pleistocene volcanoes)',
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
    {
      name: {
        zh: 'USGS 即時地震資料（最近 7 天規模 4.5 以上，瀏覽器直接讀）',
        en: 'USGS real-time earthquake feed (M4.5+ in the last 7 days, read by your browser)',
      },
      url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: {
        zh: 'JRC GHS-POP R2023A（各板塊的人口、各國跨幾塊板塊、住在火山旁邊的人）',
        en: 'JRC GHS-POP R2023A (population by plate; plates per country; people near volcanoes)',
      },
      url: 'https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE',
      license: 'CC BY 4.0',
    },
    ...landslidesPart.sources,
    {
      name: { zh: 'Terrain Tiles（陸地與海底的地形陰影，Mapzen、AWS Open Data）', en: 'Terrain Tiles (land and sea-floor hillshade; Mapzen, AWS Open Data)' },
      url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
      license: { zh: '依各資料來源標示', en: 'attribution per data source' },
    },
  ],
  note: {
    zh: '地震是 USGS 目錄裡規模 6 以上（1900 年起）與規模 5–6（1973 年起，預設關閉）的地震，日期是世界標準時間（UTC），台灣時間要加 8 小時（集集地震是台灣時間 9 月 21 日凌晨）。1970 年代以前的地震來自重新定位的 ISC-GEM 目錄，小一點的地震可能有缺漏。國家的次數只算震央在國界內或離岸 50 公里以內的地震，深海、洋脊上的地震不算任何國家。死亡人數來自 NOAA 的重大地震資料庫，跟 USGS 的地震依時間與距離配對，含地震引發的海嘯，算在震央附近的國家。火山是 Smithsonian 全球火山計畫的全新世火山清單（Global Volcanism Program, Smithsonian Institution），依 GVP 的構造環境把板塊內部的 149 座另外上色（青綠色）。板塊內部不等於熱點：熱點（地函柱）的數目與位置學界沒有共識（有的列 40 個、有的列 100 個以上），冰島、亞速爾與加拉巴哥群島的火山（多數）在 GVP 歸為裂谷，這裡不另外整理熱點清單。台灣的大屯火山群、龜山島是隱沒帶的火山。' +
      '山崩事件是 NASA 全球山崩目錄（GLC，NASA Goddard 太空飛行中心從 2007 年起從新聞、災害資料庫與報告整理，以降雨引發的為主）2007–2025 年的 11,357 件（目錄裡 2007 年以前零星補的 82 件不收；民眾回報的 Landslide Reporter 不收）；目錄的國名不可靠（台灣的都寫中國），國家一律依座標判斷。英語新聞多的國家收得比較完整，國與國之間不能直接比。',
    en: 'Earthquakes are M6+ events from the USGS catalogue since 1900 and M5–6 events since 1973 (off by default); dates are UTC, so add 8 hours for Taiwan time (the Chi-Chi earthquake struck in the early hours of 21 September local time). Events before the 1970s come from the relocated ISC-GEM catalogue, and smaller ones may be missing. Country counts include only epicentres on land or within 50 km of the coast; quakes in the deep ocean or on mid-ocean ridges belong to no country. Deaths come from the NOAA Significant Earthquake Database, matched to USGS events by time and distance; they include tsunami deaths and are counted in the country near the epicentre. Volcanoes are the Holocene volcano list of the Global Volcanism Program, Smithsonian Institution; the 149 intraplate volcanoes in the GVP tectonic setting are coloured teal. Intraplate is not the same as hotspot: there is no scientific consensus on how many hotspots (mantle plumes) exist or where (lists range from about 40 to over 100), GVP classes Iceland and most volcanoes of the Azores and Galápagos as rifts, and no separate hotspot list is drawn here. Taiwan’s Tatun volcanoes and Kueishantao are subduction-zone volcanoes.' +
      ' Landslides are the 11,357 events of 2007–2025 in NASA’s Global Landslide Catalog (GLC, compiled at NASA Goddard Space Flight Center since 2007 from news reports, disaster databases and research, mostly rain-triggered); the 82 older events added sporadically and the citizen reports of Landslide Reporter are not included. The catalogue’s country names are unreliable (those in Taiwan say China), so countries are assigned by location. Countries with more English-language news are covered more completely, so countries are not directly comparable.',
  },
  panelExtra: () => import('./panels/EarthquakesPanel'),
  listPanel: [YEAR_LIST, landslidesPart.listPanel],
  overlays: [
    ...landslidesPart.overlays,
    // 板塊邊界（2026-11-06 起依相對速度變粗、加上地質圖的符號）與「板塊」指標的面、名稱（plates-pb2002.ts）
    PLATE_AREAS,
    PLATE_BOUNDARIES,
    PLATE_LABELS,
    // 2026-11-07（製作手冊 538）：更新世的火山，灰色、比全新世的小，只畫在火山的指標
    {
      kind: 'points',
      id: 'pleistocene-volcanoes',
      file: 'pleistocene-volcanoes.json',
      label: { zh: '更新世的火山（不是活火山）', en: 'Pleistocene volcanoes (not active)' },
      indicators: VOLCANO_INDICATORS,
      shape: 'triangle',
      radius: 2.5,
      // 灰色（MAP_TOKENS.inkMuted）：跟全新世火山的深褐色、板塊內部的青綠色都分得開，看得出不是活火山
      color: MAP_TOKENS.inkMuted,
      tooltip: pleistoceneTooltip,
    },
    {
      kind: 'points',
      id: 'volcanoes',
      file: 'volcanoes.json',
      label: { zh: '火山（全新世）', en: 'Volcanoes (Holocene)' },
      shape: 'triangle',
      radius: 3.5,
      color: VOLCANO_COLORS,
      // 板塊內部的畫在上面
      sortField: 'ts',
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
      heatmap: {
        maxZoom: 3,
        weight: { field: 'mag', stops: [[5, 0.12], [6, 0.3]] },
        label: { zh: '縮小時畫成密度（累積、十年的指標，依規模加權，越紅越多）', en: 'Zoomed out: density (cumulative and decade views, weighted by magnitude; redder is more)' },
      },
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
      // 累積、十年的指標點很多：世界全圖畫依規模加權的密度（規模每多 1 級約 2.5 倍），放大到 3–4 級換成一個個地震（2026-11-01）
      heatmap: {
        maxZoom: 3,
        weight: { field: 'mag', stops: [[6, 0.3], [7, 0.75], [8, 1.9], [9, 4.7]] },
        label: { zh: '縮小時畫成密度（累積、十年的指標，依規模加權，越紅越多）', en: 'Zoomed out: density (cumulative and decade views, weighted by magnitude; redder is more)' },
      },
      sizeLegend: { title: { zh: '規模', en: 'Magnitude' }, values: [6, 7, 8, 9], format: magnitude },
      tooltip: quakeTooltip,
    },
    // 2026-11-06（板6）：USGS 最近 7 天規模 4.5 以上的地震，瀏覽器直接讀，每 5 分鐘重讀（預設關閉）
    liveQuakesOverlay([...QUAKE_INDICATORS, 'plates'], DEPTH, MAG_STOPS),
  ],
  indicators: [...indicators, ...quakeExtraIndicators, ...volcanoIndicators, PLATES_INDICATOR, ...landslidesPart.indicators],
  // 2026-11-06（板4、板5）：「板塊」指標滑到任一點寫在哪一塊板塊、離最近的邊界多遠；「定位我」放的觀察點也寫；左側欄是各板塊的人口
  pointer: platePointer,
  pin: platePin,
  worldPanel: PLATES_WORLD_PANEL,
};
