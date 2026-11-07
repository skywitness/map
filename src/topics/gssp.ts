import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 地質年代的「金釘子」（新主題，2026-11-07，製作手冊第二十七批 544，候選 1228；pipeline/topics/gssp.py）。
 * 地質年代表上每一個階的底界由一處岩層剖面定義（GSSP）；Wikidata 的 88 個項目去掉重複與 2024 年被取代的，畫 81 個點。
 */

const C = MAP_TOKENS.categorical;

/** 界線的年代（百萬年）→「1.741 億年前」「6,600 萬年前」「8,236 年前」 */
export function ago(ma: number): string {
  const years = ma * 1e6;
  const trim = (v: number, digits: number) => fixed(Number(v.toFixed(digits)), (String(Number(v.toFixed(digits))).split('.')[1] ?? '').length);
  const n = fixed(Math.round(years), 0);
  if (years >= 1e8) return tr({ zh: `${trim(years / 1e8, 4)} 億年前`, en: `${trim(ma, 3)} million years ago` });
  if (years >= 1e6) return tr({ zh: `${trim(years / 1e4, 2)} 萬年前`, en: `${trim(ma, 3)} million years ago` });
  if (years >= 1e4) return tr({ zh: `${trim(years / 1e4, 2)} 萬年前`, en: `${n} years ago` });
  return tr({ zh: `${n} 年前`, en: `${n} years ago` });
}

const ERA_CLASSES = [
  { color: C[2], label: { zh: '新生代（6600 萬年內）', en: 'Cenozoic (last 66 million years)' } },
  { color: C[0], label: { zh: '中生代（2.519 億到 6600 萬年前）', en: 'Mesozoic (251.9–66 million years ago)' } },
  { color: C[1], label: { zh: '古生代（5.388 億到 2.519 億年前）', en: 'Paleozoic (538.8–251.9 million years ago)' } },
];

const stageName = (p: PointRecord, upper: boolean) => {
  const zh = upper ? p.u : p.l;
  const en = upper ? p.uEn : p.lEn;
  return String((getLang() === 'zh' ? zh || en : en || zh) ?? '');
};
const boundary = (p: PointRecord) =>
  p.uEn || p.u
    ? tr({ zh: `${stageName(p, true)}底界`, en: `Base of the ${stageName(p, true)}` })
    : tr({ zh: 'Wikidata 沒寫是哪一條界線', en: 'Boundary not given in Wikidata' });
const placeName = (p: PointRecord, countryName: (iso3: string) => string) =>
  String((getLang() === 'zh' ? p.zh || p.en : p.en || p.zh) ?? '') || (typeof p.iso3 === 'string' ? countryName(p.iso3) : '');
const placeLine = (p: PointRecord, countryName: (iso3: string) => string) => {
  const place = placeName(p, countryName);
  const country = typeof p.iso3 === 'string' ? countryName(p.iso3) : '';
  return [place, place !== country ? country : null].filter(Boolean).join(' · ');
};
const span = (p: PointRecord) =>
  [p.a != null ? ago(Number(p.a)) : null, p.lEn || p.l ? `${stageName(p, false)} → ${stageName(p, true)}` : null].filter(Boolean).join(' · ');

const GSSP_POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'gssp-points',
  file: 'gssp.json',
  label: { zh: '金釘子（GSSP）', en: 'Golden spikes (GSSPs)' },
  indicators: ['gssp'],
  radius: 6,
  color: { field: 'e', title: { zh: '界線在哪一代', en: 'Era of the boundary' }, thresholds: [2, 3], classes: ERA_CLASSES },
  sortField: 'a',
  tooltip: (p, { countryName }) => ({
    title: boundary(p),
    detail: placeLine(p, countryName),
    extra: [span(p)],
  }),
};

const LIST: ListPanelDef = {
  label: { zh: '金釘子（由新到舊）', en: 'Golden spikes, youngest first' },
  indicators: ['gssp'],
  file: 'gssp.json',
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.a ?? 1e9) - Number(b.a ?? 1e9))
      .map((p, i): ListRow => ({
        key: `gssp-${i}-${p.q}`,
        title: boundary(p),
        lines: [span(p), placeLine(p, countryName)].filter(Boolean),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
      })),
};

const NOTE: Text = {
  zh: '金釘子是國際地層委員會（ICS）提出、國際地質科學聯合會（IUGS）批准的「全球界線層型剖面和點」（GSSP）：地質年代表上的每一個階，從哪一層岩石開始算，由地球上一處實際的剖面定義，剖面上那一點常常真的釘著金色的釘子。ICS 自己的清單寫「all rights reserved」，所以這裡用 Wikidata（CC0）。Wikidata 有 88 個項目：加拿大的特馬豆克階、瑞典的弗洛階、德國的艾菲爾階、突尼西亞的丹麥階各有兩個項目（同一處剖面，只算一個）；威爾斯的兩個（埃隆階、特列奇階）2024 年搬到捷克與西班牙，不算；澳洲的埃迪卡拉紀金釘子沒有座標，不畫點、算進澳洲。界線的年代是 Wikidata 記的各階起點，多半照 ICS 2012–2020 年版的年代表，跟最新版可能差幾十萬到一百多萬年（例如寒武紀與奧陶紀的界線記成 4.854 億年，2023 年版是 4.8685 億年）；全新世的三條界線換算成距西元 2000 年。用年代數字定義、沒有剖面的界線（GSSA，例如成冰紀的底）不在清單裡。Wikidata 有幾階的中文名是錯的（卡拉布里雅階標成「後更新世」、千葉階標成「中更新世」），改成通行的譯名，其餘照 Wikidata，「期」統一寫成「階」。',
  en: 'Golden spikes are Global Boundary Stratotype Sections and Points (GSSPs), proposed by the International Commission on Stratigraphy (ICS) and ratified by the International Union of Geological Sciences (IUGS): the rock layer where each stage of the geologic time scale begins is defined at one real section somewhere on Earth, often marked with an actual golden spike. The ICS’s own list is marked “all rights reserved”, so this map uses Wikidata (CC0). Wikidata has 88 items: the Tremadocian in Canada, the Floian in Sweden, the Eifelian in Germany and the Danian in Tunisia each have two items for the same section, counted once; the two Welsh sections (Aeronian and Telychian) were relocated to the Czech Republic and Spain in 2024 and are not counted; the Ediacaran golden spike in Australia has no coordinates in Wikidata, so it is counted for Australia but not drawn. Ages are the stage start dates recorded in Wikidata, mostly from the 2012–2020 ICS charts, and can differ from the latest chart by up to a million years or more (the Cambrian–Ordovician boundary is recorded as 485.4 million years, against 486.85 in the 2023 chart); the three Holocene boundaries are counted back from AD 2000. Boundaries defined by an age alone without a section (GSSAs, such as the base of the Cryogenian) are not included.',
};

export const gssp: TopicDefinition = {
  id: 'gssp',
  title: { zh: '地質年代的金釘子：時間尺是在哪裡定義的', en: 'Golden spikes: where the geologic time scale is defined' },
  shortTitle: { zh: '金釘子', en: 'Golden spikes' },
  defaultIndicator: 'gssp',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Wikidata 的全球界線層型剖面和點（Q37402）與各階的起訖，經 QLever',
        en: 'Wikidata Global Boundary Stratotype Sections and Points (Q37402) and stage dates, via QLever',
      },
      url: 'https://www.wikidata.org/wiki/Q37402',
      license: 'CC0',
    },
    {
      name: {
        zh: '英文維基百科「Aeronian」（revid 1318292949，2024 年埃隆階與特列奇階的金釘子搬家）',
        en: 'English Wikipedia, “Aeronian” (revid 1318292949; the 2024 relocation of the Aeronian and Telychian GSSPs)',
      },
      url: 'https://en.wikipedia.org/wiki/Aeronian?oldid=1318292949',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: NOTE,
  overlays: [GSSP_POINTS],
  listPanel: LIST,
  indicators: [
    {
      id: 'gssp',
      label: { zh: '有幾個金釘子', en: 'Golden spikes' },
      description: {
        zh: '地質年代表上的每一個「階」從哪一層岩石開始算，由地球上一處實際的岩層剖面定義（全球界線層型剖面和點，GSSP，俗稱金釘子）。Wikidata 收錄、去掉重複與被取代的共 82 個：義大利 13、中國大陸 11、法國 9、英國 8、美國 7、西班牙 7、捷克 4，加拿大、格陵蘭、葡萄牙、摩洛哥、德國、瑞典、俄羅斯各 2，突尼西亞、奧地利、馬爾他、埃及、哈薩克、烏茲別克、印度、日本、澳洲各 1；地球歷史的章節大半是在歐洲定義的。點的顏色是界線在哪一代：古生代 39 個、中生代 21 個、新生代 21 個（另有 1 個前寒武紀的沒有座標）。最新的三條都在全新世：格陵蘭階（1.17 萬年前）與諾斯格瑞比階（8,236 年前）定在格陵蘭，梅加拉亞階（4,250 年前）定在印度的梅加拉亞邦；日本千葉縣市原市的千葉階是 77.41 萬年前。地圖上最老的是加拿大紐芬蘭的寒武紀底界（幸運階，5.388 億年前）；澳洲的埃迪卡拉紀底界（6.35 億年前）更老，但 Wikidata 沒有座標，沒有畫出來。台灣沒有。點國家看那一國的金釘子。',
        en: 'The rock layer where each stage of the geologic time scale begins is defined at one real section somewhere on Earth (a Global Boundary Stratotype Section and Point, GSSP, or golden spike). Wikidata lists 82 once duplicates and replaced sections are removed: Italy 13, mainland China 11, France 9, the UK 8, the US 7, Spain 7 and the Czech Republic 4; Canada, Greenland, Portugal, Morocco, Germany, Sweden and Russia 2 each; Tunisia, Austria, Malta, Egypt, Kazakhstan, Uzbekistan, India, Japan and Australia 1 each. Most chapters of Earth’s history were defined in Europe. Dot colours give the era of the boundary: 39 Paleozoic, 21 Mesozoic and 21 Cenozoic (plus one Precambrian without coordinates). The three youngest are in the Holocene: the Greenlandian (11,700 years ago) and Northgrippian (8,236 years ago) in Greenland and the Meghalayan (4,250 years ago) in Meghalaya, India; the Chibanian at Ichihara, Chiba, Japan begins 774,100 years ago. The oldest on the map is the base of the Cambrian (Fortunian, 538.8 million years ago) in Newfoundland, Canada; the base of the Ediacaran in Australia (635 million years ago) is older but has no coordinates in Wikidata and is not drawn. Taiwan has none. Select a country for its golden spikes.',
      },
      unit: { zh: '個', en: '' },
      file: 'count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 5, 8, 11] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      missing: { zh: '沒有金釘子', en: 'No golden spikes' },
    },
  ],
};
