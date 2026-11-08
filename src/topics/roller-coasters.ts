import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 雲霄飛車地圖（新主題，2026-11-08，製作手冊第二十七批 635，候選 1376、1377、1388、1380；pipeline/topics/roller_coasters.py）：
 * OSM 的各國雲霄飛車（同一座的幾段軌道併成一座）與密度、英文維基的 12 張世界紀錄表、Wikidata 的製造商、OSM 的其他遊樂設施。
 * 手冊：兩個來源不能混用計數（各國數量只用 OSM），OSM 沒有啟用年份，做不了時間軸。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const pointName = (p: PointRecord) => {
  const zh = getLang() === 'zh' ? str(p.zh) : null;
  return zh ?? str(p.name) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' });
};

const OSM: PointsOverlayDef = {
  kind: 'points',
  id: 'osm-coasters',
  file: 'osm.json',
  label: { zh: 'OpenStreetMap 上的雲霄飛車', en: 'Roller coasters in OpenStreetMap' },
  indicators: ['count', 'per-million'],
  radius: 2.4,
  color: C[0],
  tooltip: (p, ctx) => ({
    title: pointName(p),
    detail: typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '',
    properNoun: getLang() === 'zh' && str(p.zh) && str(p.name) ? String(p.name) : undefined,
  }),
};

/** 世界紀錄的類別（pipeline 的 TABLES：h 高度、d 落差、v 速度、l 長度、i 翻轉、a 俯衝角度） */
const CATS: Record<string, { label: Text; unit: (v: number) => string }> = {
  h: { label: { zh: '高度', en: 'Height' }, unit: (v) => `${fixed(v, 1)} m` },
  d: { label: { zh: '落差', en: 'Drop' }, unit: (v) => `${fixed(v, 1)} m` },
  v: { label: { zh: '速度', en: 'Speed' }, unit: (v) => `${fixed(v, 1)} km/h` },
  l: { label: { zh: '長度', en: 'Length' }, unit: (v) => `${fixed(v, 0)} m` },
  i: { label: { zh: '翻轉次數', en: 'Inversions' }, unit: (v) => tr({ zh: `${fixed(v, 0)} 次`, en: `${fixed(v, 0)}` }) },
  a: { label: { zh: '俯衝角度', en: 'Drop angle' }, unit: (v) => `${fixed(v, 1)}°` },
};
const material = (p: PointRecord) => (p.w === 1 ? tr({ zh: '木製', en: 'wooden' }) : tr({ zh: '鋼製', en: 'steel' }));
function records(p: PointRecord): { cat: string; rank: number | null; value: number; text: string }[] {
  return String(p.rec ?? '')
    .split('|')
    .filter(Boolean)
    .map((r) => {
      const [k, v] = r.split(':');
      const cat = k[0];
      const rank = /^\d+$/.test(k.slice(1)) ? Number(k.slice(1)) : null;
      const value = Number(v);
      const c = CATS[cat];
      const where = rank ? tr({ zh: `第 ${rank} 名`, en: `#${rank}` }) : tr({ zh: '不排名', en: 'unranked' });
      return { cat, rank, value, text: tr({ zh: `${tr(c.label)} ${where}：${c.unit(value)}`, en: `${tr(c.label)} ${where}: ${c.unit(value)}` }) };
    });
}
const RECORDS: PointsOverlayDef = {
  kind: 'points',
  id: 'records',
  file: 'records.json',
  label: { zh: '世界紀錄表上的雲霄飛車', en: 'Roller coasters in the record tables' },
  indicators: ['records'],
  radius: { field: 'nrec', stops: [[1, 4], [4, 7], [8, 10]] },
  color: {
    field: 'best',
    title: { zh: '最好的名次', en: 'Best rank' },
    thresholds: [1.5, 3.5],
    classes: [
      { color: C[3], label: { zh: '世界第一（紀錄保持）', en: 'Record holder' } },
      { color: C[1], label: { zh: '第 2–3 名', en: '2nd–3rd' } },
      { color: C[0], label: { zh: '第 4–10 名', en: '4th–10th' } },
    ],
  },
  sortField: 'nrec',
  tooltip: (p, ctx) => ({
    title: String(p.name),
    detail: [
      [str(p.park), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(', '),
      [material(p), str(p.maker)].filter(Boolean).join(' · '),
    ].join(' · '),
    extra: records(p).map((r) => r.text),
  }),
};
const CAT_ORDER = ['h', 'd', 'v', 'l', 'i', 'a'];
/** 左邊的清單：依紀錄的類別分組（鋼製、木製分開），組內依名次 */
const RECORD_LIST: ListPanelDef = {
  label: { zh: '雲霄飛車的世界紀錄', en: 'Roller coaster records' },
  tabLabel: { zh: '紀錄', en: 'Records' },
  indicators: ['records'],
  file: 'records.json',
  countryField: 'iso3',
  empty: { zh: '這裡沒有上紀錄表的雲霄飛車', en: 'No roller coasters in the record tables here' },
  rows: (points, { countryName }) => {
    const rows: (ListRow & { order: number })[] = [];
    for (const p of points) {
      for (const r of records(p)) {
        rows.push({
          order: CAT_ORDER.indexOf(r.cat) * 1000 + (p.w === 1 ? 500 : 0) + (r.rank ?? 99),
          key: `${p.name}-${r.cat}-${p.w}`,
          title: `${r.rank ? `${r.rank}. ` : ''}${p.name}`,
          titleProper: true,
          lines: [CATS[r.cat].unit(r.value), [str(p.park), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(', ')],
          group: tr({ zh: `${tr(CATS[r.cat].label)}（${material(p)}）`, en: `${tr(CATS[r.cat].label)} (${material(p)})` }),
          target: { lon: p.lon as number, lat: p.lat as number, zoom: 13 },
        });
      }
    }
    return rows.sort((a, b) => a.order - b.order).map(({ order: _order, ...r }) => r);
  },
};

/** 製造商（Wikidata P176 的前 7 家，第 8 類是其他） */
const MAKERS: Text[] = [
  { zh: 'Vekoma（荷蘭）', en: 'Vekoma (Netherlands)' },
  { zh: 'B&M（瑞士）', en: 'B&M (Switzerland)' },
  { zh: 'Intamin（瑞士）', en: 'Intamin (Switzerland)' },
  { zh: 'Mack Rides（德國）', en: 'Mack Rides (Germany)' },
  { zh: 'Arrow Dynamics（美國，已歇業）', en: 'Arrow Dynamics (US, defunct)' },
  { zh: 'Gerstlauer（德國）', en: 'Gerstlauer (Germany)' },
  { zh: 'Zierer（德國）', en: 'Zierer (Germany)' },
  { zh: '其他製造商', en: 'Other manufacturers' },
];
const MAKER_POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'makers',
  file: 'makers.json',
  label: { zh: '有製造商的雲霄飛車（Wikidata）', en: 'Roller coasters with a manufacturer (Wikidata)' },
  indicators: ['makers'],
  radius: 3,
  color: {
    field: 'mk',
    title: { zh: '製造商', en: 'Manufacturer' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
    classes: MAKERS.map((label, i) => ({ color: i < 7 ? C[i] : MAP_TOKENS.categoricalOther, label })),
  },
  sortField: 'mk',
  tooltip: (p, ctx) => ({
    title: pointName(p),
    detail: [str(p.maker), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: getLang() === 'zh' && str(p.zh) && str(p.name) ? String(p.name) : undefined,
  }),
};

const RIDE_OPTIONS = [
  { id: 'big_wheel', label: { zh: '摩天輪', en: 'Ferris wheels' } },
  { id: 'carousel', label: { zh: '旋轉木馬', en: 'Carousels' } },
  { id: 'water_slide', label: { zh: '滑水道（一條算一個）', en: 'Water slides (each slide)' } },
  { id: 'amusement_ride', label: { zh: '其他遊樂設施', en: 'Other rides' } },
];

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 座`, en: v === 1 ? '1 coaster' : `${fixed(v, 0)} coasters` });

export const rollerCoasters: TopicDefinition = {
  id: 'roller-coasters',
  title: { zh: '雲霄飛車地圖：世界紀錄、製造商與遊樂設施', en: 'Roller coasters: records, manufacturers and rides' },
  shortTitle: { zh: '雲霄飛車', en: 'Roller coasters' },
  defaultIndicator: 'count',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'OpenStreetMap（attraction=roller_coaster 與其他遊樂設施，經 QLever 查詢）', en: 'OpenStreetMap (attraction=roller_coaster and other rides, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    {
      name: { zh: '英文維基百科「List of roller coaster rankings」（世界紀錄，底層是 Roller Coaster DataBase）', en: 'English Wikipedia, “List of roller coaster rankings” (records, based on the Roller Coaster DataBase)' },
      url: 'https://en.wikipedia.org/wiki/List_of_roller_coaster_rankings?oldid=1382935577',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（製造商、紀錄表上樂園的位置）', en: 'Wikidata (manufacturers, locations of parks in the record tables)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    { name: { zh: '聯合國《世界人口展望 2024》（人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '各國的雲霄飛車只用 OpenStreetMap：一座雲霄飛車的軌道常畫成好幾段，同一國、同名、相距 3 公里內的併成一座，沒有名稱的各算一座；美國、歐洲畫得特別細，座數也在量 OSM 畫得多完整，每百萬人只替 OSM 覆蓋良好的國家上色。OSM 沒有啟用年份，做不了時間軸。世界紀錄是英文維基的排行榜（底層是 Roller Coaster DataBase，這裡只透過維基引用數字），鋼製與木製分開排，梭子式另列不排名。製造商是 Wikidata 的 P176，只有一部分雲霄飛車有，美國的收錄比別國完整；國家是製造商在 Wikidata 的國家（Intamin 在列支敦斯登註冊、瑞士營運，Wikidata 寫瑞士）。滑水道在 OSM 是一條滑道一條線，一座水上樂園有十幾條，不是設施數。',
    en: 'Country counts use OpenStreetMap only: a coaster’s track is often drawn in several pieces, so pieces with the same name within 3 km in the same country are merged into one, and unnamed ones count individually. The US and Europe are mapped in particular detail, so counts also reflect how completely OSM is mapped; per-million rates are shown only for countries well covered by OSM. OSM has no opening years, so there is no timeline. Records come from the English Wikipedia rankings (based on the Roller Coaster DataBase, cited here only through Wikipedia), with steel and wooden coasters ranked separately and shuttle coasters listed but unranked. Manufacturers are Wikidata’s P176, available for only some coasters and more complete for the US; the country is the manufacturer’s country in Wikidata (Intamin is registered in Liechtenstein and operates from Switzerland; Wikidata gives Switzerland). In OSM each water slide is a separate line, and a water park has a dozen or more, so these are not counts of facilities.',
  },
  overlays: [OSM, RECORDS, MAKER_POINTS],
  listPanel: [RECORD_LIST],
  indicators: [
    {
      id: 'count',
      label: { zh: '各國有幾座雲霄飛車（OSM）', en: 'Roller coasters by country (OSM)' },
      description: {
        zh: 'OpenStreetMap 上標成雲霄飛車（attraction=roller_coaster）的 2,482 個物件，同一座的幾段軌道併起來是 2,211 座、在 86 國。美國 659 座最多，中國 176、法國 169、德國 167、日本 149、英國 128；台灣 10 座。美國、歐洲畫得特別細，座數也在量 OSM 畫得多完整。',
        en: '2,482 OpenStreetMap features tagged as roller coasters (attraction=roller_coaster), which merge into 2,211 coasters in 86 countries once the pieces of one track are combined. The US has the most (659), followed by China (176), France (169), Germany (167), Japan (149) and the UK (128); Taiwan has 10. The US and Europe are mapped in particular detail, so counts also reflect how completely OSM is mapped.',
      },
      unit: { zh: '座', en: 'coasters' },
      file: 'count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      timeless: true,
      integer: true,
      format: count,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'per-million',
      label: { zh: '每百萬人有幾座雲霄飛車', en: 'Roller coasters per million people' },
      description: {
        zh: 'OSM 的雲霄飛車座數 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。丹麥每百萬人 7.53 座最多，芬蘭 4.27、挪威 3.59、比利時 2.90、荷蘭 2.63、法國 2.54；美國 1.91、日本 1.20、台灣 0.43、南韓 0.17。',
        en: 'OSM roller coasters divided by 2024 population, shown only for the 93 countries well covered by OSM. Denmark has the most per million people (7.53), followed by Finland (4.27), Norway (3.59), Belgium (2.90), the Netherlands (2.63) and France (2.54); the US has 1.91, Japan 1.20, Taiwan 0.43 and South Korea 0.17.',
      },
      unit: { zh: '座/百萬人', en: 'per million people' },
      file: 'per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 2, 4] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 2)} 座`, en: `${fixed(v, 2)} per million` }),
      formatTick: (v) => fixed(v, 1),
    },
    {
      id: 'records',
      label: { zh: '雲霄飛車的世界紀錄', en: 'Roller coaster records' },
      description: {
        zh: '英文維基 12 張排行榜（鋼製與木製 × 高度、落差、速度、長度、翻轉次數、俯衝角度）上的雲霄飛車（67 座，畫出樂園有座標的 60 座）；點越大上榜越多次，顏色是最好的名次。沙烏地阿拉伯 Six Flags Qiddiya City 的 Falcons Flight 拿下鋼製的高度 163.0 m、落差 158.0 m、速度 249.9 km/h、長度 4,250 m 四項第一；Cedar Point 的 Top Thrill 2 高 130 m 第二。木製最高是南韓愛寶樂園的 Monimo RUSH 與瑞典 Kolmården 的 Wildfire（都是 56 m），翻轉最多是英國 Alton Towers 的 The Smiler（14 次）。60 座裡美國 29 座，台灣沒有。左邊的清單依類別列名次。',
        en: 'The roller coasters in the 12 English Wikipedia rankings (steel and wooden × height, drop, speed, length, inversions and drop angle): 67 coasters, of which the 60 whose park has coordinates are shown; bigger dots appear in more rankings and colour shows the best rank. Falcons Flight at Six Flags Qiddiya City in Saudi Arabia leads four steel rankings: height 163.0 m, drop 158.0 m, speed 249.9 km/h and length 4,250 m; Top Thrill 2 at Cedar Point is second in height at 130 m. The tallest wooden coasters are Monimo RUSH at Everland in South Korea and Wildfire at Kolmården in Sweden (both 56 m), and The Smiler at Alton Towers in the UK has the most inversions (14). 29 of the 60 are in the US, and none in Taiwan. The list on the left shows the ranks by category.',
      },
      unit: '',
      file: 'count.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      timeless: true,
      missing: { zh: '這個指標只有點，國家不上色', en: 'This indicator shows points only' },
    },
    {
      id: 'makers',
      label: { zh: '雲霄飛車是誰造的（依製造商的國家）', en: 'Who builds roller coasters (by manufacturer’s country)' },
      description: {
        zh: 'Wikidata 有製造商（P176）的 952 座雲霄飛車，依製造商的國家加總；點的顏色是製造商。前幾家是荷蘭 Vekoma 131 座、瑞士 Bolliger & Mabillard 107、Intamin 97、德國 Mack Rides 72、美國 Arrow Dynamics 64（已歇業）、德國 Gerstlauer 61、Zierer 46；依國家是美國 295 座、德國 223（Mack、Gerstlauer、Zierer、Maurer 四家就 207）、瑞士 205、荷蘭 131、義大利 51。Wikidata 只有一部分雲霄飛車有製造商，美國的收錄比別國完整，台灣的沒有。',
        en: 'The 952 roller coasters with a manufacturer (P176) in Wikidata, summed by the manufacturer’s country; dot colour shows the manufacturer. The largest are Vekoma of the Netherlands (131), Bolliger & Mabillard (107) and Intamin (97) of Switzerland, Mack Rides of Germany (72), Arrow Dynamics of the US (64, defunct), and Gerstlauer (61) and Zierer (46) of Germany; by country the US has 295, Germany 223 (207 from Mack, Gerstlauer, Zierer and Maurer), Switzerland 205, the Netherlands 131 and Italy 51. Only some coasters have a manufacturer in Wikidata, coverage is more complete for the US, and none of Taiwan’s are recorded.',
      },
      unit: { zh: '座', en: 'coasters' },
      file: 'maker-country.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 250] },
      timeless: true,
      integer: true,
      format: count,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有這國的製造商', en: 'No manufacturer from here' },
    },
    {
      id: 'rides',
      label: { zh: '其他遊樂設施（OSM）', en: 'Other rides (OSM)' },
      description: {
        zh: 'OpenStreetMap 上各國有幾個摩天輪、旋轉木馬、滑水道與其他遊樂設施（用上面的選單換）。摩天輪 1,287 個：俄羅斯 242、中國 234、美國 120、日本 71，台灣 15；旋轉木馬 3,498 個：美國 514、法國 505、俄羅斯 349，台灣 11；滑水道 27,300 條（一條滑道算一個，不是水上樂園數）：美國 8,183、德國 2,648，台灣 27；其他遊樂設施 8,084 個，台灣 50。',
        en: 'How many Ferris wheels, carousels, water slides and other rides each country has in OpenStreetMap (switch with the menu above). Ferris wheels: 1,287, with Russia 242, China 234, the US 120, Japan 71 and Taiwan 15. Carousels: 3,498, with the US 514, France 505, Russia 349 and Taiwan 11. Water slides: 27,300 (each slide counts, not each water park), with the US 8,183, Germany 2,648 and Taiwan 27. Other rides: 8,084, with Taiwan 50.',
      },
      unit: { zh: '個', en: 'features' },
      file: 'rides/{item}.json',
      dimension: { label: { zh: '設施', en: 'Ride' }, options: RIDE_OPTIONS, defaultOption: 'big_wheel' },
      layer: { kind: 'bubble', legendValues: 'auto' },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
