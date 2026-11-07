import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 馬與賽馬場（新主題，2026-11-07，製作手冊第二十四批 427；pipeline/topics/horses.py）。
 * FAOSTAT 的馬匹在養頭數（1961–2024）與每千人幾匹馬；Wikidata 的賽馬場點與各國個數；OSM 的騎馬場個數（只替覆蓋良好的國家上色）。
 */

/** 賽馬場的種類（pipeline 的 k） */
const KINDS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '賽馬場', en: 'Racecourse' }, color: MAP_TOKENS.categorical[1] },
  { value: 2, label: { zh: '輕駕車賽場', en: 'Harness racing track' }, color: MAP_TOKENS.categorical[2] },
  { value: 3, label: { zh: '已關閉（含古代的競技場遺址）', en: 'Closed (incl. ancient hippodrome sites)' }, color: MAP_TOKENS.categorical[6] },
];
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [2, 3],
  classes: KINDS.map((k) => ({ color: k.color, label: k.label })),
};
const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? KINDS[0].label);

function venueName(p: PointRecord): { title: string; properNoun?: string } {
  const zh = getLang() === 'zh' && typeof p.nz === 'string' && p.nz ? p.nz : null;
  const title = zh ?? String(p.n ?? p.nz ?? '');
  return { title, properNoun: zh && typeof p.n === 'string' && p.n !== zh ? p.n : undefined };
}

const venueFacts = (p: PointRecord) =>
  [kindLabel(p.k), typeof p.y === 'number' ? tr({ zh: `${p.y} 年啟用`, en: `opened ${p.y}` }) : null].filter(Boolean).join(' · ');

const RACECOURSES: PointsOverlayDef = {
  kind: 'points',
  id: 'racecourses',
  file: 'racecourses.json',
  label: { zh: '賽馬場（Wikidata）', en: 'Racecourses (Wikidata)' },
  radius: { field: 'sl', stops: [[0, 2.6], [5, 3.2], [12, 4.2], [40, 5.5]] },
  color: KIND_COLORS,
  sortField: 'sl',
  indicators: ['racecourses-count'],
  tooltip: (p, { countryName }) => {
    const { title, properNoun } = venueName(p);
    return {
      title,
      detail: [venueFacts(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      properNoun,
    };
  },
};

const RACECOURSE_LIST: ListPanelDef = {
  label: { zh: '賽馬場', en: 'Racecourses' },
  indicators: ['racecourses-count'],
  file: 'racecourses.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return points
      .filter((p) => typeof p.iso3 === 'string' && (!country || p.iso3 === country))
      .map((p) => ({ p, group: countryName(String(p.iso3)), name: venueName(p) }))
      .sort((a, b) => collator.compare(a.group, b.group) || (a.p.k === 3 ? 1 : 0) - (b.p.k === 3 ? 1 : 0) || collator.compare(a.name.title, b.name.title))
      .map(({ p, group, name }): ListRow => ({
        key: String(p.id),
        title: name.title,
        properNoun: name.properNoun,
        lines: [venueFacts(p)],
        muted: p.k === 3,
        group,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
      }));
  },
};

const HORSES: Text = { zh: '匹', en: 'horses' };
const horsesText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 匹`, en: `${formatLargeNumber(v)} horses` });

export const horses: TopicDefinition = {
  id: 'horses',
  title: { zh: '馬與賽馬場', en: 'Horses and racecourses' },
  shortTitle: { zh: '馬與賽馬', en: 'Horses' },
  defaultIndicator: 'horses-per-1000',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'FAO, FAOSTAT 農作物與畜產品生產（QCL）：馬的在養頭數', en: 'FAO, FAOSTAT Crops and livestock products (QCL): horse stocks' },
      url: 'https://www.fao.org/faostat/en/#data/QCL',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Wikidata 的賽馬場（horse racing venue 與子類別；用 QLever 查詢）', en: 'Wikidata horse racing venues and subclasses (queried via QLever)' },
      url: 'https://www.wikidata.org/wiki/Q11822917',
      license: 'CC0',
    },
    {
      name: { zh: 'OpenStreetMap 的騎馬場（leisure=horse_riding），經 QLever，2026 年 11 月', en: 'OpenStreetMap riding centres (leisure=horse_riding), via QLever, November 2026' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0，© OpenStreetMap 貢獻者', en: 'ODbL 1.0, © OpenStreetMap contributors' },
    },
  ],
  note: {
    zh:
      '馬匹頭數是 FAOSTAT 的在養頭數（農業普查與 FAO 的估計），不分賽馬、騎乘、役用與馬奶馬肉用的馬，所以不能當成馬術運動有多普遍。FAO 標成「外部機構提供」（Flag X）的數字依第三方資料的條款不畫（多半是 1990 年以前的零星年份）；蘇聯、南斯拉夫等已解體的國家不畫。比利時、奧地利、瑞典、西班牙等國 FAOSTAT 的數字只到 2017 年，德國、義大利到 2022–2023 年，最近幾年是灰色（滑過看最後一年）。每千人幾匹馬用人口主題的聯合國人口推估。' +
      '賽馬場是 Wikidata 收錄的 horse racing venue 與它的子類別（含輕駕車賽場與古代的競技場），有座標的畫點、國家依座標；有關閉日期或標成停用、拆除的算已關閉，名稱看得出是古希臘羅馬或拜占庭城市的競技場遺址（君士坦丁堡、奧林匹亞、德爾斐…）也算。各國個數反映 Wikidata 的收錄，不是正式的統計。台灣沒有合法的賽馬，Wikidata 也沒有台灣的賽馬場。' +
      '騎馬場是 OpenStreetMap 標成 leisure=horse_riding 的馬術中心與騎馬場，各國測繪的細緻程度差很多，只替 OSM 覆蓋良好的國家上色。',
    en:
      'Horse numbers are FAOSTAT stocks (agricultural censuses and FAO estimates) and do not distinguish racehorses, riding horses, working animals or horses kept for milk and meat, so the map is not a measure of equestrian sport. Figures FAO flags as from an external organisation (Flag X) are not shown under its third-party data terms (mostly scattered years before 1990), and dissolved states such as the USSR and Yugoslavia are not shown. FAOSTAT figures for Belgium, Austria, Sweden, Spain and others end in 2017, and for Germany and Italy in 2022–2023, so recent years are grey (hover for the last year). Horses per 1,000 people use the UN population estimates from the population topic. ' +
      'Racecourses are Wikidata horse racing venues and subclasses (including harness tracks and ancient hippodromes); those with coordinates are drawn as dots, assigned to countries by location, and those with a closing date or marked disused or demolished count as closed, as do ancient Greek, Roman and Byzantine hippodrome sites identifiable by name (Constantinople, Olympia, Delphi…). Counts reflect Wikidata’s coverage, not an official tally. Horse racing is not legal in Taiwan, and Wikidata lists no racecourse there. ' +
      'Riding centres are places tagged leisure=horse_riding on OpenStreetMap; mapping detail varies widely, so only countries where OSM is reasonably complete are shaded.',
  },
  overlays: [RACECOURSES],
  listPanel: RACECOURSE_LIST,
  indicators: [
    {
      id: 'horses-per-1000',
      label: { zh: '每千人幾匹馬', en: 'Horses per 1,000 people' },
      description: {
        zh: '在養的馬匹數 ÷ 人口 × 1,000（FAOSTAT 與聯合國人口推估，1961–2024）。全世界平均約每千人 7 匹。2024 年蒙古 1,347 匹最多（468 萬匹馬、348 萬人，馬比人多），哈薩克 211、冰島 127、烏拉圭 121、東加 114、吉爾吉斯 77、查德 76；阿根廷 57、墨西哥 49、巴西 27、美國 18、愛爾蘭 18、英國 11、法國 4.4、中國大陸 2.5、日本 0.11；台灣 873 匹，每千人 0.038 匹。按播放看 1961 年以來的變化。',
        en: 'Horse stocks ÷ population × 1,000 (FAOSTAT and UN population estimates, 1961–2024). The world average is about 7 per 1,000. In 2024 Mongolia led with 1,347 (4.68 million horses and 3.48 million people: more horses than people), followed by Kazakhstan 211, Iceland 127, Uruguay 121, Tonga 114, Kyrgyzstan 77 and Chad 76; Argentina 57, Mexico 49, Brazil 27, the US 18, Ireland 18, the UK 11, France 4.4, mainland China 2.5 and Japan 0.11. Taiwan has 873 horses, 0.038 per 1,000. Press play for the change since 1961.',
      },
      unit: { zh: '匹／千人', en: 'per 1,000 people' },
      file: 'horses-per-1000.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 2, 10, 25, 100, 500] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, v < 1 ? 3 : v < 10 ? 1 : 0)} 匹`, en: `${fixed(v, v < 1 ? 3 : v < 10 ? 1 : 0)} per 1,000` }),
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
    },
    {
      id: 'horses',
      label: { zh: '馬匹頭數', en: 'Number of horses' },
      description: {
        zh: '在養的馬匹數（FAOSTAT，1961–2024）。2024 年全世界 5,621 萬匹：墨西哥 642 萬、美國 622 萬、巴西 570 萬、蒙古 468 萬、哈薩克 435 萬、中國大陸 352 萬、阿根廷 259 萬、衣索比亞 229 萬。中國大陸 1978 年有 1,145 萬匹最多，2024 年 352 萬；日本從 1961 年的 64 萬匹減到 1.3 萬匹；台灣從 1961 年的 202 匹增加到 873 匹。',
        en: 'Horse stocks (FAOSTAT, 1961–2024). In 2024 the world had 56.2 million: Mexico 6.42 million, the US 6.22 million, Brazil 5.70 million, Mongolia 4.68 million, Kazakhstan 4.35 million, mainland China 3.52 million, Argentina 2.59 million and Ethiopia 2.29 million. Mainland China peaked at 11.45 million in 1978, against 3.52 million in 2024; Japan fell from 640,000 in 1961 to 13,000; Taiwan rose from 202 in 1961 to 873.',
      },
      unit: HORSES,
      file: 'horses.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: horsesText,
      formatTick: (v) => formatLargeTick(v),
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'racecourses-count',
      label: { zh: '賽馬場', en: 'Racecourses' },
      description: {
        zh: 'Wikidata 收錄的賽馬場（含輕駕車賽場），不含已關閉的。全世界 971 個，營運中（或沒寫關閉）的 878 個、64 國：法國 226 個最多，其次是美國 90、英國 68、日本 55、義大利 43、德國 37、瑞典 35、芬蘭 33（多半是輕駕車賽場）、愛爾蘭 27、澳洲 26、加拿大 20。台灣 0 個：台灣沒有合法的賽馬。點是有座標的 855 個，滑過看名稱與啟用年份，左邊的清單依國家列出，點了地圖移過去。',
        en: 'Racecourses in Wikidata (including harness racing tracks), excluding closed ones. Of 971 in total, 878 in 64 countries are open or not marked closed: France leads with 226, followed by the US 90, the UK 68, Japan 55, Italy 43, Germany 37, Sweden 35, Finland 33 (mostly harness tracks), Ireland 27, Australia 26 and Canada 20. Taiwan has none, as horse racing is not legal there. The dots are the 855 with coordinates; hover for the name and opening year, and the list on the left groups them by country (click to move the map).',
      },
      unit: { zh: '個', en: 'racecourses' },
      file: 'racecourses-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50, 100] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${v === 1 ? 'racecourse' : 'racecourses'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      missing: { zh: 'Wikidata 沒有這個國家的賽馬場', en: 'No racecourse in Wikidata' },
    },
    {
      id: 'riding-centres',
      label: { zh: '騎馬場（OpenStreetMap）', en: 'Riding centres (OpenStreetMap)' },
      description: {
        zh: 'OpenStreetMap 標成 leisure=horse_riding 的馬術中心與騎馬場：全世界 21,859 處、144 國。德國 5,093 處最多，其次是法國 3,232、英國 2,825、美國 1,665、波蘭 856、義大利 846、奧地利 824；台灣 5 處。各國的差距有一部分是測繪的細緻程度，所以只替 OSM 覆蓋良好的 86 國上色。',
        en: 'Equestrian and riding centres tagged leisure=horse_riding on OpenStreetMap: 21,859 in 144 countries. Germany leads with 5,093, followed by France 3,232, the UK 2,825, the US 1,665, Poland 856, Italy 846 and Austria 824; Taiwan has 5. Part of the difference between countries is mapping detail, so only the 86 countries where OSM is reasonably complete are shaded.',
      },
      unit: { zh: '處', en: 'centres' },
      file: 'riding-centres.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${v === 1 ? 'centre' : 'centres'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
    },
  ],
};
