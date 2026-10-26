import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 摩天大樓（pipeline/topics/skyscrapers.py）：Wikidata 收錄的 150 m 以上的大樓（完工、還沒拆除的），每一棟一個點；
 * 各國 300 m 以上的棟數、最高建築的高度，1930 年起每一年。
 *
 * Wikidata 對 150、200 m 的大樓收錄很不完整（跟 CTBUH 的總數比，200 m 以上約兩成、中國約一成），國家之間不能比，
 * 所以國家的棟數只做 300 m 以上（約六成五），150、200 m 的只畫成點、在側欄列出。
 */

/** 跟 CTBUH 的 2025 年底總數比的涵蓋率（%），pipeline 會核對（skyscrapers.py 的 check_topic） */
export const COVERAGE_WORLD_200 = 21;
export const COVERAGE_WORLD_300 = 66;
export const COVERAGE_CHINA_200 = 9;
/** CTBUH 的 2025 年底總數（Skyscraper Center 的 2026 Trends & Forecasts） */
export const CTBUH_WORLD_200 = 2596;
export const CTBUH_WORLD_300 = 258;
export const CTBUH_CHINA_200 = 1361;
export const CTBUH_URL = 'https://www.skyscrapercenter.com/trends-and-forecasts/2026';

/** 高度分段（點的顏色、側欄的分段棟數）：下限 m */
export const BANDS: { min: number; label: Text }[] = [
  { min: 150, label: { zh: '150–199 m', en: '150–199 m' } },
  { min: 200, label: { zh: '200–299 m', en: '200–299 m' } },
  { min: 300, label: { zh: '300–599 m（超高層）', en: '300–599 m (supertall)' } },
  { min: 600, label: { zh: '600 m 以上（巨型）', en: '600 m+ (megatall)' } },
];

/** 點的顏色依高度：青綠、琥珀、洋紅、深紫，都有白框；比例圓是半透明的紫色大圓，面量圖是橘色 */
const HEIGHT_COLORS: ColorClasses = {
  field: 'h',
  title: { zh: '高度', en: 'Height' },
  thresholds: [200, 300, 600],
  classes: [
    { color: MAP_TOKENS.categorical[0], label: BANDS[0].label },
    { color: MAP_TOKENS.hues.yellow, label: BANDS[1].label },
    { color: MAP_TOKENS.categorical[7], label: BANDS[2].label },
    { color: MAP_TOKENS.categorical[6], label: BANDS[3].label },
  ],
};

export const metres = (v: number) => `${fixed(v, Number.isInteger(v) ? 0 : 1)} m`;
const buildingsText = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 棟`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'building' : 'buildings'}` });

/** 大樓的名稱：中文介面用 Wikidata 的中文名稱（沒有時用英文），英文介面用英文名稱 */
export function buildingName(p: PointRecord, lang = getLang()): string {
  return lang === 'zh' && typeof p.zh === 'string' ? p.zh : String(p.name ?? '');
}

export function cityName(p: PointRecord, lang = getLang()): string | null {
  if (lang === 'zh' && typeof p.cityZh === 'string') return p.cityZh;
  return typeof p.city === 'string' ? p.city : null;
}

function buildingTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const parts = [metres(p.h as number)];
  if (typeof p.fl === 'number') parts.push(tr({ zh: `${p.fl} 層`, en: `${p.fl} floors` }));
  parts.push(tr({ zh: `${p.y} 年完工`, en: `completed ${p.y}` }));
  const city = cityName(p);
  const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
  // 城市國家（新加坡、摩納哥）只寫一次
  if (city && country && city !== country) parts.push(tr({ zh: `${city}，${country}`, en: `${city}, ${country}` }));
  else if (city || country) parts.push(city ?? country ?? '');
  const extra: string[] = [];
  if (typeof p.d === 'number') extra.push(tr({ zh: `${p.d} 年拆除或毀損`, en: `demolished or destroyed in ${p.d}` }));
  if (p.n === 2) extra.push(tr({ zh: '雙塔（算 2 棟）', en: 'Twin towers (counted as two)' }));
  const zh = getLang() === 'zh' && typeof p.zh === 'string';
  return {
    title: buildingName(p),
    detail: parts.join(' · '),
    extra: extra.length ? extra : undefined,
    properNoun: zh ? String(p.name ?? '') : undefined,
  };
}

export const skyscrapers: TopicDefinition = {
  id: 'skyscrapers',
  title: { zh: '摩天大樓', en: 'Skyscrapers' },
  shortTitle: { zh: '摩天大樓', en: 'Skyscrapers' },
  defaultIndicator: 'supertall',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'Wikidata（大樓的高度、樓層、完工年份、位置）', en: 'Wikidata (heights, floors, completion years, locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'CTBUH Skyscraper Center：2026 Trends & Forecasts（只引用總數對照涵蓋率）', en: 'CTBUH Skyscraper Center: 2026 Trends & Forecasts (totals cited only to check coverage)' },
      url: CTBUH_URL,
      license: { zh: '只引用事實', en: 'facts cited only' },
    },
    {
      name: { zh: 'GHSL Urban Centre Database（部分大樓的城市名稱，同城市主題）', en: 'GHSL Urban Centre Database (city names for some buildings, as in the Cities topic)' },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      `大樓是 Wikidata 收錄、有高度的 150 m 以上的建築：摩天大樓、辦公、住宅、旅館大樓等給人使用的樓；電視塔、觀景塔、煙囪、教堂的尖塔不算（跟 CTBUH 一樣）。` +
      `高度是建築高度（含尖塔、不含天線），Wikidata 有標「建築高度」的用它，沒有的用一般寫的高度。完工年份依序用 Wikidata 的建造結束、啟用日期、成立時間；沒有年份的不算。` +
      `Wikidata 的收錄很不完整：跟 CTBUH 統計的 2025 年底總數比，200 m 以上只有約 ${COVERAGE_WORLD_200}%（全世界 ${fixed(CTBUH_WORLD_200, 0)} 棟；中國 ${fixed(CTBUH_CHINA_200, 0)} 棟，這裡約 ${COVERAGE_CHINA_200}%），` +
      `300 m 以上約 ${COVERAGE_WORLD_300}%（${CTBUH_WORLD_300} 棟），所以國家的棟數只做 300 m 以上，150、200 m 以上的只畫成點、在側欄列出，不拿來比較國家。各國最高的建築也可能漏收。` +
      `300 m 以上的每一棟、各國最高的建築都逐一看過，修正了幾個明顯錯誤的高度與年份（例如帝國大廈、高雄 85 大樓），排除了電視塔與還沒完工的。` +
      `名稱用 Wikidata 的中文名稱，沒有的用英文。`,
    en:
      `Buildings are those in Wikidata with a height of 150 m or more that are made for people to use – skyscrapers and office, residential and hotel towers; TV and observation towers, chimneys and church spires are excluded, as by the CTBUH. ` +
      `Heights are architectural heights (including spires, not antennas): Wikidata’s “architectural height” where given, otherwise the plain height. Completion years come from Wikidata’s end of construction, opening date or inception, in that order; buildings without one are not counted. ` +
      `Wikidata’s coverage is far from complete: compared with the CTBUH’s totals at the end of 2025, it has only about ${COVERAGE_WORLD_200}% of buildings of 200 m or more (${fixed(CTBUH_WORLD_200, 0)} worldwide; about ${COVERAGE_CHINA_200}% of China’s ${fixed(CTBUH_CHINA_200, 0)}) ` +
      `and about ${COVERAGE_WORLD_300}% of those of 300 m or more (${CTBUH_WORLD_300}). Country counts therefore cover only 300 m+; buildings of 150 and 200 m+ are shown as dots and listed in the side panel, not compared between countries. A country’s tallest building may also be missing. ` +
      `Every building of 300 m or more and every country’s tallest were checked by hand, fixing a few clearly wrong heights and years (such as the Empire State Building and Kaohsiung’s 85 Sky Tower) and removing TV towers and unfinished buildings.`,
  },
  panelExtra: () => import('./panels/SkyscrapersPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'buildings',
      file: 'buildings.json',
      label: { zh: '150 m 以上的大樓（縮小時只畫高的）', en: 'Buildings 150 m+ (only the tallest when zoomed out)' },
      radius: { field: 'h', stops: [[150, 1.6], [200, 2.2], [300, 3.2], [500, 4.8], [830, 7]] },
      color: HEIGHT_COLORS,
      sortField: 'h',
      timeField: 'y',
      endField: 'd',
      // 世界全圖（圖磚 0–2 級）只畫 300 m 以上，3–4 級 200 m 以上，5 級起全部
      minValue: { field: 'h', stops: [[0, 300], [3, 200], [5, 0]] },
      // 大小跟顏色都是高度，圖例只列顏色的分段
      tooltip: buildingTooltip,
    },
  ],
  indicators: [
    {
      id: 'supertall',
      label: { zh: '300 m 以上的大樓數', en: 'Buildings 300 m+' },
      description: {
        zh: `這一年還在的 300 m 以上的大樓（CTBUH 叫「超高層」），依 Wikidata，約收錄 CTBUH 統計的 ${COVERAGE_WORLD_300}%。150、200 m 以上的收錄太少（200 m 以上約 ${COVERAGE_WORLD_200}%，中國約 ${COVERAGE_CHINA_200}%），只畫成點。拖動時間軸，從 1930 年紐約的克萊斯勒大樓看起。`,
        en: `Buildings of 300 m or more (“supertall”, in CTBUH terms) standing in the year, from Wikidata, which has about ${COVERAGE_WORLD_300}% of the CTBUH’s count. Buildings of 150 and 200 m+ are too incompletely covered (about ${COVERAGE_WORLD_200}% of 200 m+, ${COVERAGE_CHINA_200}% in China) and are shown only as dots. Drag the slider from New York’s Chrysler Building in 1930.`,
      },
      unit: { zh: '棟', en: 'buildings' },
      file: 'supertall.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      overlayTime: 'cumulative',
      format: buildingsText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'tallest',
      label: { zh: '最高建築的高度', en: 'Tallest building' },
      description: {
        zh: '這一年這個國家最高的大樓（Wikidata 收錄的 150 m 以上的建築，不含電視塔）。1931–1972 年世界最高是紐約的帝國大廈，2004–2010 年是台北 101，2010 年起是杜拜的哈里發塔（828 m）。',
        en: 'The tallest building standing in the country in the year (buildings of 150 m or more in Wikidata, not TV towers). The world’s tallest was the Empire State Building in New York in 1931–1972, Taipei 101 in 2004–2010 and the Burj Khalifa in Dubai (828 m) since 2010.',
      },
      unit: 'm',
      file: 'tallest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [200, 250, 300, 400, 500] } },
      overlayTime: 'cumulative',
      format: metres,
      formatTick: (v) => fixed(v, 0),
      coverage: {
        countries: [],
        reason: { zh: 'Wikidata 沒有這一年 150 m 以上的大樓', en: 'No building of 150 m or more in Wikidata for this year' },
      },
    },
  ],
};
