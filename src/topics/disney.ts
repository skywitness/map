import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 迪士尼（新主題，2026-11-08，製作手冊第二十八批 673，候選 1478、1484、1492；旅遊・樂園；pipeline/topics/disney.py）。
 * 據點是手工白名單（pipeline/data/disney/places.csv）的 QID，座標與面積從 Wikidata；人次沿用景點地圖的樂園人次。
 * 商標的硬規則（手冊第二十八批）：不放任何 logo 或品牌配色（顏色用網站的分類色盤），說明文字自己寫，不放購票或官網連結，
 * 不寫「官方」「合作」「授權」這類字。度假區與樂園是兩層，不混算。
 */

const C = MAP_TOKENS.categorical;

/** 度假區（pipeline 的 RESORTS 同樣的順序，代碼是索引 + 1） */
export const RESORTS: { id: string; label: Text }[] = [
  { id: 'wdw', label: { zh: '華特迪士尼世界（佛羅里達）', en: 'Walt Disney World (Florida)' } },
  { id: 'dlr', label: { zh: '加州迪士尼樂園度假區', en: 'Disneyland Resort (California)' } },
  { id: 'tdr', label: { zh: '東京迪士尼度假區', en: 'Tokyo Disney Resort' } },
  { id: 'dlp', label: { zh: '巴黎迪士尼樂園度假區', en: 'Disneyland Paris' } },
  { id: 'hkdr', label: { zh: '香港迪士尼樂園度假區', en: 'Hong Kong Disneyland Resort' } },
  { id: 'shdr', label: { zh: '上海迪士尼度假區', en: 'Shanghai Disney Resort' } },
  { id: 'adr', label: { zh: '阿布達比（已宣布）', en: 'Abu Dhabi (announced)' } },
];
const KINDS: { label: Text; color: string }[] = [
  { label: { zh: '主題樂園', en: 'Theme park' }, color: C[0] },
  { label: { zh: '水上樂園', en: 'Water park' }, color: C[1] },
  { label: { zh: '度假區', en: 'Resort' }, color: C[4] },
  { label: { zh: '其他（小島、室內遊樂館）', en: 'Other (island, indoor centre)' }, color: C[3] },
];
const STATUS: Text[] = [
  { zh: '營運中', en: 'Open' },
  { zh: '已關閉', en: 'Closed' },
  { zh: '已宣布', en: 'Announced' },
];

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);
const at = <T,>(list: T[], code: unknown) => list[(typeof code === 'number' ? code : 1) - 1] ?? list[0];

/** 中文介面用官方或常用的中文名，沒有就用英文（不自己翻譯） */
export function disneyName(p: PointRecord): { title: string; proper?: string } {
  const en = String(p.en ?? '');
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

const visitorsText = (v: number) => tr({ zh: `${formatLargeNumber(v)} 人次`, en: `${formatLargeNumber(v)} visitors` });
const areaText = (km2: number) =>
  km2 >= 1 ? tr({ zh: `${fixed(km2, 1)} 平方公里`, en: `${fixed(km2, 1)} km²` }) : tr({ zh: `${fixed(km2 * 100, 0)} 公頃`, en: `${fixed(km2 * 100, 0)} ha` });

function facts(p: PointRecord): string[] {
  const y = num(p, 'y');
  const yc = num(p, 'yc');
  const area = num(p, 'area');
  const v24 = num(p, 'v2024');
  const v19 = num(p, 'v2019');
  const out: string[] = [];
  if (y) out.push(yc ? tr({ zh: `${y}–${yc} 年`, en: `${y}–${yc}` }) : tr({ zh: `${y} 年開幕`, en: `Opened ${y}` }));
  else out.push(tr({ zh: '還沒有開幕年', en: 'No opening year yet' }));
  if (v24) out.push(tr({ zh: `2024 年 ${visitorsText(v24)}`, en: `${visitorsText(v24)} in 2024` }) + (v19 ? tr({ zh: `（2019 年 ${formatLargeNumber(v19)}）`, en: ` (2019: ${formatLargeNumber(v19)})` }) : ''));
  if (area) out.push(tr({ zh: `面積 ${areaText(area)}（Wikidata）`, en: `Area ${areaText(area)} (Wikidata)` }));
  if (getLang() === 'zh' && typeof p.note === 'string' && p.note) out.push(p.note);
  return out;
}

function tooltip(p: PointRecord, { countryName }: { countryName: (iso3: string) => string }) {
  const { title, proper } = disneyName(p);
  const detail = [tr(at(KINDS, p.kind).label), num(p, 'kind') === 3 ? null : tr(at(RESORTS, p.resort).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
    .filter(Boolean)
    .join(' · ');
  return { title, detail, extra: facts(p), properNoun: proper };
}

/** 樂園那一層的點沒有度假區（度假區另一層畫大圈），所以只分主題樂園、水上樂園、其他（代碼 4） */
const KIND_COLORS = {
  field: 'kind',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5, 2.5],
  classes: [KINDS[0], KINDS[1], KINDS[3]].map(({ label, color }) => ({ label, color })),
};

const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-sites',
  file: 'sites.json',
  label: { zh: '迪士尼的樂園（依開幕年出現，已關閉的在關閉那年消失）', en: 'Disney parks (appear in their opening year; closed ones disappear)' },
  indicators: ['parks'],
  radius: { field: 'kind', stops: [[1, 6], [2, 4], [4, 3]] },
  color: KIND_COLORS,
  timeField: 'y',
  endField: 'yc',
  sortField: 'kind',
  tooltip,
};
const RESORT_RINGS: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-resorts',
  file: 'resorts.json',
  label: { zh: '度假區', en: 'Resorts' },
  indicators: ['parks'],
  radius: 11,
  look: 'faint',
  color: KINDS[2].color,
  timeField: 'y',
  tooltip,
};
const PLANNED: PointsOverlayDef = {
  kind: 'points',
  id: 'disney-planned',
  file: 'planned.json',
  label: { zh: '已宣布、還沒開幕', en: 'Announced, not yet open' },
  indicators: ['parks'],
  radius: 6,
  look: 'hollow',
  color: KINDS[0].color,
  tooltip,
};

/** 清單的組：六個度假區、已關閉、已宣布 */
function groupOf(p: PointRecord): { order: number; label: string } {
  if (p.status === 2) return { order: 90, label: tr({ zh: '已關閉', en: 'Closed' }) };
  if (p.status === 3) return { order: 91, label: tr({ zh: '已宣布', en: 'Announced' }) };
  const i = (typeof p.resort === 'number' ? p.resort : 1) - 1;
  return { order: i, label: tr(RESORTS[i].label) };
}

const PARK_LIST: ListPanelDef = {
  label: { zh: '迪士尼的樂園', en: 'Disney parks' },
  tabLabel: { zh: '樂園', en: 'Parks' },
  indicators: ['parks'],
  file: 'places.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    points
      .filter((p) => p.kind !== 3)
      .map((p) => ({ p, g: groupOf(p) }))
      .sort((a, b) => a.g.order - b.g.order || (num(b.p, 'v2024') ?? -1) - (num(a.p, 'v2024') ?? -1) || (num(a.p, 'y') ?? 9999) - (num(b.p, 'y') ?? 9999))
      .map(({ p, g }): ListRow => {
        const { title, proper } = disneyName(p);
        const v24 = num(p, 'v2024');
        const y = num(p, 'y');
        const yc = num(p, 'yc');
        return {
          key: String(p.qid),
          title,
          properNoun: proper,
          group: g.label,
          muted: p.status !== 1,
          lines: [
            [tr(at(KINDS, p.kind).label), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '),
            [
              y ? (yc ? tr({ zh: `${y}–${yc} 年`, en: `${y}–${yc}` }) : tr({ zh: `${y} 年開幕`, en: `opened ${y}` })) : tr(STATUS[2]),
              v24 ? tr({ zh: `2024 年 ${visitorsText(v24)}`, en: `${visitorsText(v24)} in 2024` }) : '',
            ]
              .filter(Boolean)
              .join(tr({ zh: '，', en: ', ' })),
          ],
          link: { href: `https://www.wikidata.org/wiki/${String(p.qid)}`, label: tr({ zh: `資料出處 Wikidata ${String(p.qid)}`, en: `Source: Wikidata ${String(p.qid)}` }) },
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
        };
      }),
};

export const disney: TopicDefinition = {
  id: 'disney',
  title: { zh: '迪士尼在哪裡：樂園、郵輪、飯店與影視部門', en: 'Where Disney is: parks, cruise ships, hotels and studios' },
  shortTitle: { zh: '迪士尼', en: 'Disney' },
  defaultIndicator: 'parks',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（據點的座標與面積，經 QLever 查詢；據點是手工整理的白名單）', en: 'Wikidata (coordinates and areas, via QLever; sites from a hand-checked list)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: {
        zh: '英文維基百科「Disney Experiences」（revid 1382282208，開幕年）與各已關閉據點的條目（關閉年）',
        en: 'English Wikipedia, “Disney Experiences” (revid 1382282208, opening years) and the articles on closed sites (closing years)',
      },
      url: 'https://en.wikipedia.org/wiki/Disney_Experiences?oldid=1382282208',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of amusement park rankings」（樂園人次，數字原本來自 TEA／AECOM）',
        en: 'English Wikipedia, “List of amusement park rankings” (park attendance, originally from TEA/AECOM)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_amusement_park_rankings?oldid=1377863670',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '這個主題整理的是 Wikidata、OpenStreetMap 與維基百科上的公開資料，不是迪士尼公司提供的。度假區（例如華特迪士尼世界）與裡面的主題樂園是兩層，「幾座樂園」只算主題樂園。台灣沒有迪士尼的樂園、飯店或郵輪靠港。',
    en: 'This topic compiles public data from Wikidata, OpenStreetMap and Wikipedia; it is not provided by The Walt Disney Company. Resorts (such as Walt Disney World) and the theme parks inside them are two levels, and park counts include theme parks only. Taiwan has no Disney park, hotel or cruise call.',
  },
  overlays: [RESORT_RINGS, SITES, PLANNED],
  listPanel: PARK_LIST,
  indicators: [
    {
      id: 'parks',
      label: { zh: '迪士尼的主題樂園', en: 'Disney theme parks' },
      description: {
        zh: '各國營運中的迪士尼主題樂園數（比例圓），拖時間軸看 1955 年加州的迪士尼樂園到 2016 年上海怎麼一座座開起來。2026 年共 12 座、在 6 個度假區：美國 6 座（佛羅里達的華特迪士尼世界 4 座：神奇王國 1971、艾波卡特 1982、好萊塢夢工場 1989、動物王國 1998；加州 2 座：迪士尼樂園 1955、加州冒險 2001）、日本 2 座（東京迪士尼樂園 1983、東京迪士尼海洋 2001）、法國 2 座（1992、2002）、香港 1 座（2005）、上海 1 座（2016）；第七個度假區阿布達比已宣布，還沒有開幕年（空心的點）。地圖上的大圈是度假區，小點是樂園、水上樂園與已關閉的地方（River Country 1976–2001、Discovery Island 1974–1999、DisneyQuest 1998–2017）。台灣沒有迪士尼的樂園，最近的是香港與上海。',
        en: 'Number of Disney theme parks open in each country (proportional circles); drag the timeline to watch them open one by one, from Disneyland in California in 1955 to Shanghai in 2016. In 2026 there are 12 parks at 6 resorts: the US has 6 (4 at Walt Disney World in Florida: Magic Kingdom 1971, Epcot 1982, Hollywood Studios 1989, Animal Kingdom 1998; 2 in California: Disneyland 1955, California Adventure 2001), Japan 2 (Tokyo Disneyland 1983, Tokyo DisneySea 2001), France 2 (1992, 2002), Hong Kong 1 (2005) and Shanghai 1 (2016); a seventh resort in Abu Dhabi has been announced with no opening year (hollow point). Large rings are resorts; small points are parks, water parks and closed sites (River Country 1976–2001, Discovery Island 1974–1999, DisneyQuest 1998–2017). Taiwan has no Disney park; the nearest are Hong Kong and Shanghai.',
      },
      unit: { zh: '座', en: 'parks' },
      file: 'parks.json',
      layer: { kind: 'bubble', legendValues: [1, 2, 6] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} ${v === 1 ? 'park' : 'parks'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      overlayTime: 'cumulative',
    },
  ],
};
