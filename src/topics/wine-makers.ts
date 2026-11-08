import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';
import type { TopicPart } from './parts';
import { withTerritories } from './osm-territories';

/**
 * 菸酒的擴充：酒廠與葡萄酒產區（2026-11-07，製作手冊第二十四批 429）。
 * pipeline/topics/alcohol_makers.py：OSM 的蒸餾廠與酒莊、Wikidata 的威士忌蒸餾廠與清酒酒藏、台灣的國庫署統計；
 * pipeline/topics/wine_pdo.py：歐盟葡萄酒 PDO 的範圍（Scientific Data 2022 的 CC0 資料）。
 */

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(tr({ zh: '・', en: ' · ' }));

function names(p: PointRecord, unnamed: Text): { title: string; proper?: string } {
  const n = String(p.n ?? '');
  const zh = String(p.nz ?? '');
  const en = String(p.ne ?? '');
  if (getLang() === 'zh') return zh ? { title: zh, proper: n && n !== zh ? n : undefined } : { title: n || en || tr(unnamed) };
  return en ? { title: en, proper: n && n !== en ? n : undefined } : { title: n || zh || tr(unnamed) };
}

// ── OSM 的蒸餾廠與酒莊 ──
const MAKERS = [
  { value: 1, label: { zh: '蒸餾廠（craft=distillery）', en: 'Distillery (craft=distillery)' }, color: MAP_TOKENS.categorical[5] },
  { value: 2, label: { zh: '酒莊（craft=winery）', en: 'Winery (craft=winery)' }, color: MAP_TOKENS.categorical[6] },
];
const makerKind = (p: PointRecord) => tr(MAKERS.find((k) => k.value === p.k)?.label ?? MAKERS[0].label);
const UNNAMED_MAKER = { zh: '（沒有名稱）', en: '(unnamed)' };

const MAKER_POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'alcohol-makers',
  file: 'distilleries-points.json',
  indicators: ['distilleries-per-million', 'wineries-per-million'],
  label: { zh: '蒸餾廠與酒莊（OpenStreetMap）', en: 'Distilleries and wineries (OpenStreetMap)' },
  radius: 2.4,
  color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [2], classes: MAKERS },
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p, UNNAMED_MAKER);
    return { title, detail: join([makerKind(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]), properNoun: proper };
  },
};

const MAKER_LIST: ListPanelDef = {
  label: { zh: '蒸餾廠與酒莊（依國家）', en: 'Distilleries and wineries by country' },
  indicators: ['distilleries-per-million', 'wineries-per-million'],
  file: 'distilleries-points.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return points
      .filter((p) => (p.n || p.nz || p.ne) && typeof p.iso3 === 'string' && (!country || p.iso3 === country))
      .map((p, i) => ({ p, i, group: countryName(String(p.iso3)), name: names(p, UNNAMED_MAKER) }))
      .sort((a, b) => collator.compare(a.group, b.group) || Number(a.p.k) - Number(b.p.k) || collator.compare(a.name.title, b.name.title))
      .map(({ p, i, group, name }): ListRow => ({
        key: `m${i}`,
        title: name.title,
        properNoun: name.proper,
        lines: [makerKind(p)],
        group,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 14 },
      }));
  },
};

// ── Wikidata 的威士忌蒸餾廠與清酒酒藏 ──
const SPIRITS = [
  { value: 1, label: { zh: '威士忌蒸餾廠', en: 'Whisky distillery' }, color: MAP_TOKENS.categorical[2] },
  { value: 2, label: { zh: '清酒酒藏', en: 'Sake brewery' }, color: MAP_TOKENS.categorical[0] },
  { value: 3, label: { zh: '已關閉', en: 'Closed' }, color: MAP_TOKENS.categorical[6] },
];
const spiritKind = (p: PointRecord) => tr(SPIRITS.find((k) => k.value === p.k)?.label ?? SPIRITS[0].label);
const founded = (p: PointRecord) => (typeof p.y === 'number' ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null);
const UNNAMED_SPIRIT = { zh: '（沒有名稱）', en: '(unnamed)' };

const WHISKY_POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'whisky',
  file: 'whisky-points.json',
  indicators: ['whisky-distilleries'],
  label: { zh: '威士忌蒸餾廠與清酒酒藏（Wikidata）', en: 'Whisky distilleries and sake breweries (Wikidata)' },
  radius: { field: 'sl', stops: [[0, 3], [5, 3.6], [15, 4.6], [40, 6]] },
  sortField: 'sl',
  color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [2, 3], classes: SPIRITS },
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p, UNNAMED_SPIRIT);
    return { title, detail: join([spiritKind(p), founded(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]), properNoun: proper };
  },
};

const WHISKY_LIST: ListPanelDef = {
  label: { zh: '威士忌蒸餾廠與清酒酒藏（依國家）', en: 'Whisky distilleries and sake breweries by country' },
  indicators: ['whisky-distilleries'],
  file: 'whisky-points.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return points
      .filter((p) => typeof p.iso3 === 'string' && (!country || p.iso3 === country))
      .map((p) => ({ p, group: countryName(String(p.iso3)), name: names(p, UNNAMED_SPIRIT) }))
      .sort(
        (a, b) =>
          collator.compare(a.group, b.group) ||
          Number(a.p.k === 3) - Number(b.p.k === 3) ||
          Number(a.p.y ?? 9999) - Number(b.p.y ?? 9999) ||
          collator.compare(a.name.title, b.name.title),
      )
      .map(({ p, group, name }): ListRow => ({
        key: String(p.id),
        title: name.title,
        properNoun: name.proper,
        lines: [join([spiritKind(p), founded(p)])],
        muted: p.k === 3,
        group,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      }));
  },
};

// ── 歐盟葡萄酒 PDO 的範圍 ──
/** 酒的類別（pipeline/topics/wine_pdo.py 的 TYPE_BITS） */
const WINE_TYPES: { bit: number; label: Text }[] = [
  { bit: 1, label: { zh: '葡萄酒', en: 'wine' } },
  { bit: 2, label: { zh: '氣泡酒', en: 'sparkling' } },
  { bit: 4, label: { zh: '優質氣泡酒', en: 'quality sparkling' } },
  { bit: 8, label: { zh: '微氣泡酒', en: 'semi-sparkling' } },
  { bit: 16, label: { zh: '加烈葡萄酒', en: 'liqueur wine' } },
  { bit: 32, label: { zh: '風乾或過熟葡萄釀的酒', en: 'raisined or overripe grapes' } },
  { bit: 64, label: { zh: '部分發酵的葡萄汁', en: 'partially fermented must' } },
];
const wineTypes = (p: PointRecord) =>
  WINE_TYPES.filter((t) => Number(p.t) & t.bit)
    .map((t) => tr(t.label))
    .join(tr({ zh: '、', en: ', ' }));

function pdoYield(p: PointRecord): string | null {
  if (typeof p.hl === 'number') return tr({ zh: `每公頃最多 ${fixed(p.hl, 0)} 公石`, en: `max ${fixed(p.hl, 0)} hl/ha` });
  if (typeof p.kg === 'number') return tr({ zh: `每公頃最多 ${formatLargeNumber(p.kg)} 公斤葡萄`, en: `max ${formatLargeNumber(p.kg)} kg of grapes/ha` });
  return null;
}

const PDO_AREAS: LinesOverlayDef = {
  kind: 'lines',
  id: 'wine-pdo-areas',
  file: 'wine-pdo-areas.json',
  indicators: ['wine-pdo'],
  label: { zh: '葡萄酒法定產區（歐盟 PDO）', en: 'Wine protected designations of origin (EU PDOs)' },
  width: 0.6,
  color: MAP_TOKENS.categorical[6],
  opacity: 0.6,
  fill: { field: 'f', value: 1, opacity: 0.1, darkOpacity: 0.16, holeField: 'k', hover: true },
  groupField: 'r',
  hoverHalo: true,
  tooltip: (p, { countryName }) => ({
    title: String(p.n ?? ''),
    properNoun: String(p.n ?? ''),
    detail: join([typeof p.c === 'string' ? countryName(p.c) : null, wineTypes(p)]),
    extra: [pdoYield(p)].filter((x): x is string => Boolean(x)),
  }),
};

const PDO_LIST: ListPanelDef = {
  label: { zh: '葡萄酒法定產區（依國家）', en: 'Wine PDOs by country' },
  indicators: ['wine-pdo'],
  file: 'wine-pdo-areas.json',
  lines: { groupField: 'r' },
  countryField: 'c',
  rows: (records, { countryName, country }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return records
      .filter((p) => !country || p.c === country)
      .map((p) => ({ p, group: countryName(String(p.c)) }))
      .sort((a, b) => collator.compare(a.group, b.group) || collator.compare(String(a.p.n), String(b.p.n)))
      .map(({ p, group }): ListRow => ({
        key: `pdo-${p.r}`,
        title: String(p.n ?? ''),
        properNoun: String(p.n ?? ''),
        lines: [join([wineTypes(p), pdoYield(p)])],
        group,
        target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
        line: { overlay: 'wine-pdo-areas', group: Number(p.r) },
      }));
  },
};

const perMillion = (v: number) => tr({ zh: `每百萬人 ${fixed(v, 1)} 處`, en: `${fixed(v, 1)} per million` });
const count = (unit: Text) => (v: number) => tr({ zh: `${fixed(v, 0)} ${tr(unit)}`, en: `${fixed(v, 0)} ${tr(unit)}` });

const INDICATORS: IndicatorDef[] = [
  {
    id: 'distilleries-per-million',
    label: { zh: '蒸餾廠', en: 'Distilleries' },
    description: {
      zh: 'OpenStreetMap 上的蒸餾廠，全世界 3,016 處、108 個國家或地區：美國 633、德國 527、英國 273、法國 270、西班牙 101、加拿大 94、義大利 94；台灣 11 處（金車威士忌酒廠、南投威士忌蒸餾工場、埔里、嘉義、馬祖、東引酒廠等）。國家的顏色是每百萬人幾處，只替 OSM 覆蓋良好的國家上色：斯洛伐克 12.5 最多，奧地利 9.7、盧森堡 8.7、丹麥 7.5、匈牙利 7.1、德國 6.3；愛爾蘭 5.2、法國 4.0、英國 3.9、美國 1.8、日本 0.52、台灣 0.48。大廠、農家的小蒸餾室與酒廠博物館混在一起，墨西哥、中國、印度明顯是沒人畫，只能看大概。台灣另有財政部國庫署的統計：2026 年 9 月有酒類製造執照的業者 316 家，2025 年國產蒸餾酒 28,497 公噸、進口 24,640 公噸。',
      en: 'Distilleries on OpenStreetMap: 3,016 in 108 countries and territories. The US has 633, Germany 527, the UK 273, France 270, Spain 101, Canada 94 and Italy 94; Taiwan has 11 (including Kavalan’s whisky distillery, Nantou whisky distillery and the Puli, Chiayi, Matsu and Dongyin distilleries). Countries are shaded by distilleries per million people, only where OSM is reasonably complete: Slovakia leads with 12.5, followed by Austria 9.7, Luxembourg 8.7, Denmark 7.5, Hungary 7.1 and Germany 6.3; Ireland 5.2, France 4.0, the UK 3.9, the US 1.8, Japan 0.52 and Taiwan 0.48. Large plants, small farm stills and distillery museums are mixed together, and Mexico, China and India are clearly under-mapped, so treat comparisons as approximate. Taiwan’s National Treasury Administration counts 316 licensed alcohol makers in September 2026; in 2025 Taiwan made 28,497 tonnes of spirits and imported 24,640 tonnes.',
    },
    unit: { zh: '處／百萬人', en: 'per million' },
    file: 'distilleries-per-million.json',
    defaultYear: 2026,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 6, 9] } },
    format: perMillion,
    formatTick: (v) => `${v}`,
    panelChart: false,
  },
  {
    id: 'wineries-per-million',
    label: { zh: '酒莊', en: 'Wineries' },
    description: {
      zh: 'OpenStreetMap 上的酒莊（多半是葡萄酒莊），全世界 17,541 處、119 個國家或地區：法國 3,159、德國 2,797、美國 2,199、義大利 1,751、西班牙 1,464、奧地利 627、澳洲 610；台灣 9 處。每百萬人奧地利 68.9 最多，匈牙利 51.9、盧森堡 49.5、法國 47.3、克羅埃西亞 37.9、捷克 37.9；義大利 29.7、美國 6.3、日本 0.66、台灣 0.39。只替 OSM 覆蓋良好的國家上色；點跟蒸餾廠畫在一起。',
      en: 'Wineries on OpenStreetMap (mostly wine estates): 17,541 in 119 countries and territories. France has 3,159, Germany 2,797, the US 2,199, Italy 1,751, Spain 1,464, Austria 627 and Australia 610; Taiwan has 9. Per million people Austria leads with 68.9, followed by Hungary 51.9, Luxembourg 49.5, France 47.3, Croatia 37.9 and Czechia 37.9; Italy 29.7, the US 6.3, Japan 0.66 and Taiwan 0.39. Only countries where OSM is reasonably complete are shaded; the dots are shown with the distilleries.',
    },
    unit: { zh: '處／百萬人', en: 'per million' },
    file: 'wineries-per-million.json',
    defaultYear: 2026,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 35, 50] } },
    format: perMillion,
    formatTick: (v) => `${v}`,
    panelChart: false,
  },
  {
    id: 'whisky-distilleries',
    label: { zh: '威士忌蒸餾廠（Wikidata）', en: 'Whisky distilleries (Wikidata)' },
    description: {
      zh: 'Wikidata 收錄、有座標的威士忌蒸餾廠（含子類別，不含已關閉的）263 個：英國 214 個（211 個在蘇格蘭）、日本 14、美國 11、愛爾蘭 9、法國 6、德國 2；台灣 1 個，是 2005 年成立的噶瑪蘭酒廠。地圖另畫 Wikidata 的清酒酒藏 31 個（Wikidata 只收了一部分，不做各國比較）。點的大小是有幾種語言的維基百科條目；滑過看成立年份，左邊的清單依國家、年份列出。Wikidata 沒寫關閉日期的都畫成還在營運，裡面可能有早就關閉的。',
      en: 'Whisky distilleries with coordinates in Wikidata (including subclasses, excluding closed ones): 263. The UK has 214 (211 of them in Scotland), Japan 14, the US 11, Ireland 9, France 6 and Germany 2; Taiwan has 1, the Kavalan distillery founded in 2005. Wikidata’s sake breweries (31) are also drawn (Wikidata covers only some, so countries are not compared). Dot size reflects how many language editions of Wikipedia have an article; hover for the founding year, and the list on the left groups them by country and year. Distilleries without a closing date in Wikidata are drawn as operating, so a few may have closed long ago.',
    },
    unit: { zh: '個', en: 'distilleries' },
    file: 'whisky-distilleries.json',
    defaultYear: 2026,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50, 100] } },
    format: count({ zh: '個', en: 'distilleries' }),
    formatTick: (v) => `${v}`,
    integer: true,
    panelChart: false,
    missing: { zh: 'Wikidata 沒有這個國家的威士忌蒸餾廠', en: 'No whisky distillery in Wikidata' },
  },
  {
    id: 'wine-pdo',
    label: { zh: '葡萄酒法定產區（歐盟）', en: 'Wine PDOs (EU)' },
    description: {
      zh: '歐盟登記的葡萄酒受保護原產地名稱（PDO）有幾個、範圍在哪裡（2021 年底的登記簿，Scientific Data 2022 的資料），共 1,177 個、21 國：義大利 408、法國 361、西班牙 99、保加利亞 52、羅馬尼亞 40、希臘 33、匈牙利 33、葡萄牙 30、奧地利 24、德國 19；英國 3 個（脫歐前登記）。地圖畫出每個產區的範圍，香檳、波爾多、奇揚地、利奧哈都看得到，滑過看酒的類別與每公頃最高產量，左邊的清單依國家列出。範圍是用鄉鎮界拼的，不是葡萄園的界線；大產區裡有小產區，同一塊地可能同時屬於好幾個 PDO。這是歐盟的制度，美國、澳洲、智利、南非等的產區不在裡面，台灣也沒有。',
      en: 'How many wine protected designations of origin (PDOs) are registered in the EU and where they lie (the register at the end of 2021, from a 2022 Scientific Data paper): 1,177 in 21 countries. Italy has 408, France 361, Spain 99, Bulgaria 52, Romania 40, Greece 33, Hungary 33, Portugal 30, Austria 24 and Germany 19; the UK has 3 (registered before Brexit). The map draws each area, so Champagne, Bordeaux, Chianti and Rioja are all visible; hover for the wine types and the maximum yield per hectare, and the list on the left groups them by country. Areas are built from municipal boundaries, not vineyard edges; large regions contain smaller ones, so one plot can belong to several PDOs. This is the EU’s system: regions in the US, Australia, Chile, South Africa and elsewhere are not included, and Taiwan has none.',
    },
    unit: { zh: '個', en: 'PDOs' },
    file: 'wine-pdo.json',
    defaultYear: 2021,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 300] } },
    format: count({ zh: '個', en: 'PDOs' }),
    formatTick: (v) => `${v}`,
    integer: true,
    panelChart: false,
    missing: { zh: '不在歐盟的登記制度裡', en: 'Not covered by the EU register' },
  },
];

export const wineMakersPart: TopicPart = {
  name: { zh: '酒廠與葡萄酒產區', en: 'Distilleries, wineries and wine regions' },
  sources: [
    {
      name: { zh: 'Wikidata 的威士忌蒸餾廠與清酒酒藏（用 QLever 查詢）', en: 'Wikidata whisky distilleries and sake breweries (queried via QLever)' },
      url: 'https://www.wikidata.org/wiki/Q10373548',
      license: 'CC0',
    },
    {
      name: {
        zh: 'Oliveira Aguiar 等（2022）歐洲葡萄酒 PDO 的地理與法規資料，Scientific Data 9, 394',
        en: 'Oliveira Aguiar et al. (2022), a geospatial inventory of regulatory information for wine PDOs in Europe, Scientific Data 9, 394',
      },
      url: 'https://doi.org/10.6084/m9.figshare.c.5877659',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '財政部國庫署 菸酒業者家數、國產及進口蒸餾酒數量', en: 'Taiwan National Treasury Administration, licensed alcohol makers and spirits volumes' },
      url: 'https://data.gov.tw/dataset/25098',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: withTerritories({
    zh: '蒸餾廠與酒莊是 OpenStreetMap 上標成 craft=distillery、craft=winery 的地方（2026 年 11 月的快照，© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），只替 OSM 覆蓋良好的國家上色。威士忌蒸餾廠與清酒酒藏是 Wikidata 收錄、有座標的項目（含子類別），有解散日期的算已關閉；清酒酒藏 Wikidata 只收了一部分，只畫點。葡萄酒法定產區是歐盟的登記制度，範圍用鄉鎮界拼成，有些每公頃最高產量明顯是錯字（6,635 公石）沒有畫。',
    en: 'Distilleries and wineries are places tagged craft=distillery and craft=winery on OpenStreetMap (a November 2026 snapshot, © OpenStreetMap contributors; the data files are shared under ODbL 1.0); only countries where OSM is reasonably complete are shaded. Whisky distilleries and sake breweries are Wikidata items with coordinates (including subclasses); those with a dissolution date count as closed, and Wikidata covers only some sake breweries, so they are shown as dots only. Wine PDOs follow the EU register, with areas built from municipal boundaries; a few maximum yields that are clearly typos (6,635 hl) are not shown.',
  }),
  overlays: [MAKER_POINTS, WHISKY_POINTS, PDO_AREAS],
  listPanel: [MAKER_LIST, WHISKY_LIST, PDO_LIST],
  indicators: INDICATORS,
};

