import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, PointRecord, TopicDefinition } from './types';

/**
 * 長途步道（pipeline/topics/trails.py，DESIGN.md 第 8 節第 149 點）：OpenStreetMap 的國際級、國家級步道路線
 * （route=hiking，network=iwn、nwn），台灣再用觀光署「步道」開放資料補上 OSM 沒有的國家步道。
 * cloud 連不到 Overpass，OSM 的路線由本機 session 執行 map-plan 的 scripts/osm_hiking_routes.py 下載、簡化。
 */

/** 路線的等級（pipeline 的 TYPES） */
export const LEVELS: { value: number; label: Text; short: Text; color: string }[] = [
  {
    value: 1,
    label: { zh: '國際級（例如歐洲長途步道 E1–E12）', en: 'International (such as the European E-paths)' },
    short: { zh: '國際級', en: 'International' },
    color: MAP_TOKENS.categorical[7],
  },
  { value: 2, label: { zh: '國家級', en: 'National' }, short: { zh: '國家級', en: 'National' }, color: MAP_TOKENS.categorical[1] },
];
/** 等級的短名稱（tooltip、側欄、清單用；圖例用完整的 label） */
export const levelLabel = (t: unknown) => tr(LEVELS.find((l) => l.value === t)?.short ?? '');

/** 路線的名稱：中文介面優先用中文名，其次英文名、原文；英文介面用英文名，其次原文 */
export function trailName(p: { n?: unknown; e?: unknown; z?: unknown; ref?: unknown }, lang = getLang()): string {
  const pick = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const name = lang === 'zh' ? (pick(p.z) ?? pick(p.e) ?? pick(p.n)) : (pick(p.e) ?? pick(p.n) ?? pick(p.z));
  return name ?? String(p.ref ?? '');
}

export const kmText = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });

function trailTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const name = trailName(p);
  const countries = typeof p.c === 'string' && p.c ? p.c.split(',').map((c) => ctx.countryName(c)).join(tr({ zh: '、', en: ', ' })) : null;
  const facts = [levelLabel(p.t), typeof p.km === 'number' ? kmText(p.km) : null, typeof p.ref === 'string' && p.ref !== name ? p.ref : null];
  return {
    title: name,
    detail: facts.filter(Boolean).join(' · '),
    extra: [countries, p.s === 2 ? tr({ zh: '觀光署「步道」開放資料的國家步道', en: 'National trail from the Tourism Administration’s open data' }) : null].filter(
      (x): x is string => Boolean(x),
    ),
    // 原文名稱（跟顯示的名稱不同時）
    properNoun: typeof p.n === 'string' && p.n !== name ? p.n : undefined,
  };
}

const TRAILS: LinesOverlayDef = {
  kind: 'lines',
  id: 'trails',
  file: 'trails.json',
  label: { zh: '長途步道', en: 'Long-distance trails' },
  width: 1.4,
  color: { title: { zh: '等級', en: 'Level' }, classes: LEVELS.map(({ value, label, color }) => ({ value, label, color })) },
  groupField: 'r',
  hoverHalo: true,
  tooltip: trailTooltip,
  indicators: ['map'],
};

const ABOUT: Text = {
  zh: 'OSM 的「國際級」「國家級」由各國的社群標記，用法不一：歐洲標得多、路線密，其他地方少；美國國家步道系統的佛羅里達步道、日本的九州自然步道等沒有標成國際級或國家級，沒有算進來。阿帕拉契山徑、大陸分水嶺步道跟更長的國際級路線（東部大陸步道、北美分水嶺步道）重疊，算在國際級那條。',
  en: 'OSM’s “international” and “national” levels are tagged by each country’s mappers, and usage varies: Europe has many, densely tagged routes and elsewhere there are few; some trails, such as the Florida Trail of the US National Trails System and Japan’s Kyushu Nature Trail, are not tagged as international or national and are not included. The Appalachian and Continental Divide trails overlap longer international routes (the Eastern Continental Trail and the Divide Trails) and are counted under those.',
};

const KM: Text = { zh: '公里', en: 'km' };

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '步道地圖', en: 'Trail map' },
    description: {
      zh: `OpenStreetMap 標成國際級、國家級的步道路線（洋紅是國際級，例如歐洲長途步道 E1–E12；紫色是國家級）。重疊的路段只畫一次、算給國際級。滑到線上看路線的名稱、長度與經過的國家；左邊的清單列出最長的 100 條，點了地圖移過去。台灣另用觀光署的開放資料補上 OSM 沒有的國家步道。${ABOUT.zh}`,
      en: `Hiking routes tagged in OpenStreetMap as international or national (magenta for international, such as the European E-paths; purple for national). Shared sections are drawn once and counted for the international route. Hover over a line for the route’s name, length and countries; the list on the left shows the 100 longest, and clicking one moves the map there. For Taiwan, national trails missing from OSM are added from the Tourism Administration’s open data. ${ABOUT.en}`,
    },
    unit: KM,
    file: 'length.json',
    layer: { kind: 'none' },
    format: kmText,
    formatTick: (v) => fixed(v, 0),
    unranked: true,
    rankingBars: false,
  },
  {
    id: 'length',
    label: { zh: '步道總長', en: 'Total length' },
    description: {
      zh: `國土裡國際級、國家級步道的總長（重疊的路段只算一次；長度用簡化前的路線算，依路段經過的國家分）。${ABOUT.zh}`,
      en: `The total length of international and national hiking routes within the country (shared sections counted once; lengths use the unsimplified routes, split by the countries each section passes through). ${ABOUT.en}`,
    },
    unit: KM,
    file: 'length.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 500, 1000, 3000, 10000, 30000] } },
    format: kmText,
    formatTick: (v) => formatLargeNumber(v),
    integer: true,
    missing: { zh: 'OSM 沒有標成國際級、國家級的步道', en: 'No international or national routes in OSM' },
  },
];

/** 左邊的清單：最長的 100 條路線（list.json），點了移到那條路線的範圍 */
const LIST: ListPanelDef = {
  label: { zh: '最長的步道', en: 'Longest trails' },
  file: 'list.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(b.km) - Number(a.km))
      .map((p) => {
        const name = trailName(p);
        const countries = typeof p.c === 'string' && p.c ? p.c.split(',').map((c) => countryName(c)).join(tr({ zh: '、', en: ', ' })) : '';
        return {
          key: String(p.r),
          title: name,
          // 英文介面沒有英文名時，顯示的是原文名稱
          titleProper: getLang() === 'en' && name !== p.e,
          lines: [[levelLabel(p.t), kmText(Number(p.km))].join(' · '), countries].filter(Boolean),
          properNoun: typeof p.n === 'string' && p.n !== name ? p.n : undefined,
          target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] as [number, number, number, number] },
        };
      }),
};

export const trails: TopicDefinition = {
  id: 'trails',
  title: { zh: '長途步道', en: 'Long-distance trails' },
  shortTitle: { zh: '長途步道', en: 'Trails' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 的步道路線（route=hiking，國際級、國家級），經 Overpass API', en: 'OpenStreetMap hiking routes (route=hiking, international and national), via the Overpass API' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap 貢獻者；資料檔也是）', en: 'ODbL 1.0 (© OpenStreetMap contributors; so are the data files)' },
    },
    {
      name: { zh: '台灣：交通部觀光署「步道」開放資料（OSM 沒有的國家步道）', en: 'Taiwan: Tourism Administration, “Trails” open data (national trails missing from OSM)' },
      url: 'https://data.gov.tw/dataset/41653',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: 'OSM 的路線由每條路線的 way 依端點接成線，簡化到約 300 公尺（世界全圖再簡化到約 1 公里）；長度用簡化前的路線算。同一段路屬於好幾條路線時只算給一條（國際級優先）。路線分到國家依每一段的中點。台灣在 OSM 有 38 條標成國家級的路線（八通關古道、淡蘭國家級綠道等，也有國家公園裡的短步道），另用觀光署「步道」開放資料補上 OSM 沒有的 18 條（多是林業保育署的國家步道，線有一半以上落在 OSM 路線 200 公尺內的算 OSM 已經有），長度是觀光署寫的。',
    en: 'OSM routes are joined from their ways and simplified to about 300 m (about 1 km on the world map); lengths use the unsimplified routes. A section shared by several routes is counted for one only (international first). Routes are split between countries by the midpoint of each section. Taiwan has 38 routes tagged as national in OSM (such as the Batongguan Historic Trail and the Tamsui-Kavalan trails, plus some short trails in national parks); 18 more that OSM lacks, mostly national trails of the Forestry and Nature Conservation Agency, are added from the Tourism Administration’s open trail data with their published lengths (a trail with more than half its length within 200 m of an OSM route counts as already in OSM).',
  },
  panelExtra: () => import('./panels/TrailsPanel'),
  listPanel: LIST,
  overlays: [TRAILS],
  indicators,
};
