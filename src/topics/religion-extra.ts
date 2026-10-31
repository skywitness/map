import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 各國宗教的擴充（2026-10-31，製作手冊第十批 184；pipeline/topics/religion_extra.py，DESIGN.md 第 8 節第 266 點）：
 * 最大的宗教建築（教堂、清真寺、印度教寺廟各自排名）、朝聖地（Wikidata，台灣補媽祖進香的廟）與朝聖之路（OpenStreetMap）。
 */

const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function names(p: PointRecord): { title: string; proper?: string } {
  const zh = str(p.zh);
  const en = str(p.en) ?? '';
  return getLang() === 'zh' && zh ? { title: zh, proper: en && en !== zh ? en : undefined } : { title: en || zh || '' };
}
const country = (p: PointRecord, countryName: (iso3: string) => string) => (typeof p.iso3 === 'string' ? countryName(p.iso3) : null);

// ── 最大的宗教建築 ──

const BUILDING_KINDS: { value: number; label: Text; short: Text; color: string }[] = [
  { value: 1, label: { zh: '教堂（依室內面積）', en: 'Churches (by interior area)' }, short: { zh: '教堂', en: 'Church' }, color: C[1] },
  { value: 2, label: { zh: '清真寺（依容納人數）', en: 'Mosques (by capacity)' }, short: { zh: '清真寺', en: 'Mosque' }, color: C[3] },
  { value: 3, label: { zh: '印度教寺廟（依面積）', en: 'Hindu temples (by area)' }, short: { zh: '印度教寺廟', en: 'Hindu temple' }, color: C[5] },
];
// 面積到百萬平方公尺以上才用「萬」（吳哥窟 162.6 萬），教堂這種幾萬平方公尺的寫完整的數字
const area = (v: number) =>
  v >= 1e6 ? tr({ zh: `${formatLargeNumber(v)} 平方公尺`, en: `${formatLargeNumber(v)} m²` }) : tr({ zh: `${fixed(v, 0)} 平方公尺`, en: `${fixed(v, 0)} m²` });
const people = (v: number) => tr({ zh: `可容納 ${v >= 1e5 ? formatLargeNumber(v) : fixed(v, 0)} 人`, en: `capacity ${v >= 1e5 ? formatLargeNumber(v) : fixed(v, 0)}` });

function buildingFacts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const kind = BUILDING_KINDS.find((k) => k.value === p.r);
  return [
    [kind ? tr(kind.short) : null, typeof p.rank === 'number' ? tr({ zh: `第 ${p.rank} 名`, en: `No. ${p.rank}` }) : null, country(p, countryName)]
      .filter(Boolean)
      .join(' · '),
    [
      typeof p.a === 'number' ? (p.r === 1 ? tr({ zh: `室內 ${area(p.a)}`, en: `${area(p.a)} interior` }) : area(p.a)) : null,
      typeof p.cap === 'number' ? people(p.cap) : null,
      typeof p.y === 'number' ? tr({ zh: `${p.y} 年`, en: String(p.y) }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    str(p.den) ?? '',
  ].filter(Boolean);
}

const BUILDINGS: PointsOverlayDef = {
  kind: 'points',
  id: 'religious-buildings',
  file: 'religious-buildings.json',
  label: { zh: '各宗教最大的建築', en: 'Largest religious buildings' },
  indicators: ['buildings'],
  // 各宗教自己排名：名次越前面越大（不跨宗教比大小）
  radius: { field: 'rank', stops: [[1, 9], [5, 6], [20, 4], [60, 2.6], [160, 2]] },
  color: { field: 'r', title: { zh: '宗教', en: 'Religion' }, thresholds: [1.5, 2.5], classes: BUILDING_KINDS.map(({ label, color }) => ({ label, color })) },
  sortField: 'a',
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    return { title, extra: buildingFacts(p, countryName), properNoun: proper };
  },
};

const BUILDING_LIST: ListPanelDef = {
  label: { zh: '各宗教最大的建築', en: 'Largest religious buildings' },
  indicators: ['buildings'],
  file: 'religious-buildings.json',
  rows: (points, { countryName }) => {
    const rows: ListRow[] = [];
    for (const kind of BUILDING_KINDS) {
      const list = points.filter((p) => p.r === kind.value && typeof p.rank === 'number').sort((a, b) => Number(a.rank) - Number(b.rank));
      list.forEach((p, i) => {
        const { title, proper } = names(p);
        rows.push({
          key: `${kind.value}-${p.rank}`,
          title: `${p.rank}. ${title}`,
          lines: buildingFacts(p, countryName).slice(1).concat(country(p, countryName) ?? []),
          properNoun: proper,
          badge: i === 0 ? tr(kind.short) : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
        });
      });
    }
    return rows;
  },
};

// ── 朝聖地與朝聖之路 ──

const FAITHS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '基督宗教', en: 'Christian' }, color: C[1] },
  { value: 2, label: { zh: '佛教', en: 'Buddhist' }, color: C[2] },
  { value: 3, label: { zh: '伊斯蘭教', en: 'Islamic' }, color: C[3] },
  { value: 4, label: { zh: '印度教', en: 'Hindu' }, color: C[5] },
  { value: 5, label: { zh: '其他宗教', en: 'Other religions' }, color: C[0] },
  { value: 6, label: { zh: '台灣的媽祖進香（手工補）', en: 'Mazu pilgrimages in Taiwan (added by hand)' }, color: C[7] },
  { value: 0, label: { zh: 'Wikidata 沒有寫宗教', en: 'Religion not given in Wikidata' }, color: MAP_TOKENS.context },
];
const faith = (f: unknown) => tr(FAITHS.find((x) => x.value === f)?.label ?? '');

function siteFacts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const note = getLang() === 'zh' ? str(p.note) : str(p.noteEn);
  return [[faith(p.f), country(p, countryName)].filter(Boolean).join(' · '), note ?? ''].filter(Boolean);
}

const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'pilgrimage-sites',
  file: 'pilgrimage-sites.json',
  label: { zh: '朝聖地（Wikidata）', en: 'Pilgrimage sites (Wikidata)' },
  indicators: ['pilgrimage'],
  radius: { field: 'sl', stops: [[0, 2.2], [10, 3.2], [30, 5], [80, 7]] },
  // 依序：0 不明、1 基督宗教…6 台灣
  color: {
    field: 'f',
    title: { zh: '宗教', en: 'Religion' },
    thresholds: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
    classes: [FAITHS[6], ...FAITHS.slice(0, 6)].map(({ label, color }) => ({ label, color })),
  },
  sortField: 'sl',
  // 世界全圖只畫維基條目多的（台灣的媽祖進香一直畫）
  minValue: { field: 'sl', stops: [[0, 5], [4, 0]] },
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    return { title, extra: siteFacts(p, countryName), properNoun: proper };
  },
};

const ROUTES: LinesOverlayDef = {
  kind: 'lines',
  id: 'pilgrimage-routes',
  file: 'pilgrimage-routes.json',
  label: { zh: '朝聖之路（OpenStreetMap）', en: 'Pilgrimage routes (OpenStreetMap)' },
  indicators: ['pilgrimage'],
  width: 1.6,
  color: C[6],
  groupField: 'r',
  hoverHalo: true,
  tooltip: (p) => ({
    title: String(p.n ?? ''),
    detail: tr({ zh: `朝聖之路 · ${fixed(Number(p.km), 0)} 公里`, en: `Pilgrimage route · ${fixed(Number(p.km), 0)} km` }),
    properNoun: str(p.o) ?? undefined,
  }),
};

const SITE_LIST: ListPanelDef = {
  label: { zh: '朝聖地（依宗教）', en: 'Pilgrimage sites by religion' },
  indicators: ['pilgrimage'],
  file: 'pilgrimage-sites.json',
  // 維基百科 10 種語言以上有條目的，加上台灣的媽祖進香；依宗教分組、組內依條目數
  rows: (points, { countryName }) => {
    const rows: ListRow[] = [];
    for (const f of [6, 1, 2, 3, 4, 5, 0]) {
      const list = points.filter((p) => p.f === f && (f === 6 || Number(p.sl) >= 10)).sort((a, b) => Number(b.sl) - Number(a.sl));
      list.forEach((p, i) => {
        const { title, proper } = names(p);
        rows.push({
          key: `${f}-${i}-${p.en}`,
          title,
          lines: siteFacts(p, countryName),
          properNoun: proper,
          badge: i === 0 ? faith(f) : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
        });
      });
    }
    return rows;
  },
};

const empty = { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' };

export const religionExtra: { sources: SourceDef[]; overlays: (PointsOverlayDef | LinesOverlayDef)[]; indicators: IndicatorDef[]; listPanel: ListPanelDef[] } = {
  sources: [
    {
      name: {
        zh: '英文維基百科「List of largest church buildings」「List of largest mosques」「List of largest Hindu temples」（revid 1382619422、1373241539、1376887205）',
        en: 'English Wikipedia, “List of largest church buildings”, “List of largest mosques” and “List of largest Hindu temples” (revisions 1382619422, 1373241539, 1376887205)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_largest_church_buildings&oldid=1382619422',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    { name: { zh: 'Wikidata（建築的座標、朝聖地）', en: 'Wikidata (building locations, pilgrimage sites)' }, url: 'https://www.wikidata.org/wiki/Q15135589', license: 'CC0' },
    {
      name: { zh: 'OpenStreetMap 的朝聖之路（Wikidata 有 OSM relation 的），經 Overpass API', en: 'OpenStreetMap pilgrimage routes (those linked from Wikidata), via the Overpass API' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0（© OpenStreetMap 貢獻者；路線的資料檔也是）', en: 'ODbL 1.0 (© OpenStreetMap contributors; so is the route data file)' },
    },
  ],
  overlays: [BUILDINGS, ROUTES, SITES],
  listPanel: [BUILDING_LIST, SITE_LIST],
  indicators: [
    {
      id: 'buildings',
      label: { zh: '最大的宗教建築', en: 'Largest religious buildings' },
      description: {
        zh: '各宗教最大的建築，各自排名、不跨宗教比大小（量法不同）：教堂依室內面積（英文維基的表 161 座，梵蒂岡的聖伯多祿大殿 25,616 平方公尺第一），清真寺依容納人數（62 座，麥加禁寺可容納 400 萬人、面積 40 萬平方公尺），印度教寺廟依面積（36 座，柬埔寨的吳哥窟 162.6 公頃，金氏世界紀錄的「最大宗教建築」）。點越大名次越前面。表上的數字多半出處薄弱、量法不一（室內面積、整個寺院範圍、容納人數），佛寺沒有對應的列表；台灣沒有建築在這三張表上。左邊的清單依宗教分組、依名次排。',
        en: 'The largest buildings of each religion, ranked separately and not compared across religions (they are measured differently): churches by interior area (161 in English Wikipedia’s list, led by St Peter’s Basilica at 25,616 m²), mosques by capacity (62, led by the Masjid al-Haram in Mecca with room for 4 million and 400,000 m²) and Hindu temples by area (36, led by Angkor Wat in Cambodia at 162.6 ha, which Guinness calls the largest religious structure). Larger dots rank higher. Many figures are thinly sourced and measured differently (interior area, whole temple grounds, capacity), and there is no list for Buddhist temples; no building in Taiwan is on these lists. The list on the left is grouped by religion and sorted by rank.',
      },
      unit: '',
      file: 'buildings.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: empty,
    },
    {
      id: 'pilgrimage',
      label: { zh: '朝聖地與朝聖之路', en: 'Pilgrimage sites and routes' },
      description: {
        zh: 'Wikidata 標成朝聖地（含子類別）、有座標的 1,330 處，依宗教上色：多半是天主教的朝聖教堂與聖母朝聖地（德國 239、義大利 225、西班牙 163 處），以及日本四國遍路等的靈場；麥加在 Wikidata 是「聖城」，不在這個類別。宗教依 Wikidata 的宗教屬性，沒有寫的依類別判斷（朝聖教堂算基督宗教、靈場算佛教），都沒有的是灰色。紫色的線是 OpenStreetMap 的朝聖之路（Wikidata 有連到 OSM 的 54 條，例如聖雅各之路的法國之路 1,092 公里）。台灣在 Wikidata 沒有朝聖地，洋紅色的點是手工補的媽祖進香：大甲媽祖遶境進香（大甲鎮瀾宮到新港奉天宮）與白沙屯媽祖進香（白沙屯拱天宮到北港朝天宮），路線沒有開放資料，只畫廟。左邊的清單依宗教分組，列出維基百科 10 種語言以上有條目的。',
        en: 'The 1,330 places with coordinates that Wikidata classes as pilgrimage sites (including subclasses), coloured by religion: mostly Catholic pilgrimage churches and Marian shrines (Germany 239, Italy 225, Spain 163) and Japanese temples on routes such as the Shikoku pilgrimage; Mecca is a “holy city” in Wikidata and not in this class. Religion follows Wikidata’s religion property, or else the type of place (pilgrimage churches count as Christian, reijō temples as Buddhist); grey means neither is given. Purple lines are OpenStreetMap pilgrimage routes (the 54 linked from Wikidata, such as the French Way of the Camino de Santiago, 1,092 km). Wikidata has no pilgrimage sites in Taiwan, so the magenta dots mark the Mazu pilgrimages, added by hand: Dajia (from Jenn Lann Temple to Fongtien Temple in Singang) and Baishatun (from Gong Tian Temple to Chaotian Temple in Beigang); their routes have no open data, so only the temples are shown. The list on the left, grouped by religion, shows sites with Wikipedia articles in 10 or more languages.',
      },
      unit: '',
      file: 'pilgrimage.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: empty,
    },
  ],
};
