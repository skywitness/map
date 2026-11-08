import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 動畫是哪裡做的（新主題，2026-11-08，製作手冊第二十七批 654，候選 1432–1435；pipeline/topics/media_works.py 的 anime）：
 * Wikidata 的動畫工作室（點）、動畫電影（依原產國與年份累計）、電視動畫、聲優與配音員、奧斯卡最佳動畫長片。
 * 日本動画協会的產業報告不准轉載，所以只做「誰做的、做了幾部」，沒有產業規模。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const nameOf = (p: PointRecord) => (getLang() === 'zh' ? (str(p.zh) ?? str(p.en)) : str(p.en)) ?? '';
const proper = (p: PointRecord) => (getLang() === 'zh' && str(p.zh) && str(p.en) && p.zh !== p.en ? String(p.en) : undefined);
const KINDS: Text[] = [
  { zh: '還在營運', en: 'Active' },
  { zh: '已解散', en: 'Defunct' },
];
const years = (p: PointRecord) =>
  [typeof p.y === 'number' ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null, typeof p.end === 'number' ? tr({ zh: `${p.end} 年解散`, en: `defunct ${p.end}` }) : null]
    .filter(Boolean)
    .join(' · ');

const STUDIOS: PointsOverlayDef = {
  kind: 'points',
  id: 'studios',
  file: 'studios.json',
  label: { zh: '動畫工作室（Wikidata）', en: 'Animation studios (Wikidata)' },
  indicators: ['studios'],
  radius: 3,
  color: {
    field: 'k',
    title: { zh: '狀態', en: 'Status' },
    thresholds: [1.5],
    classes: KINDS.map((label, i) => ({ color: [C[4], MAP_TOKENS.categoricalOther][i], label })),
  },
  sortField: 'k',
  tooltip: (p, { countryName }) => ({
    title: nameOf(p),
    detail: [tr(KINDS[(Number(p.k) || 1) - 1]), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: years(p) ? [years(p)] : [],
    properNoun: proper(p),
  }),
};
const STUDIO_LIST: ListPanelDef = {
  label: { zh: '這一國的動畫工作室', en: 'Animation studios here' },
  tabLabel: { zh: '工作室', en: 'Studios' },
  indicators: ['studios'],
  file: 'studios.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡沒有有座標的動畫工作室', en: 'No animation studios with coordinates here in Wikidata' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.k) - Number(b.k) || (Number(a.y) || 9999) - (Number(b.y) || 9999))
      .map((p, i): ListRow => ({
        key: `st-${i}`,
        title: nameOf(p),
        properNoun: proper(p),
        lines: [[tr(KINDS[(Number(p.k) || 1) - 1]), years(p)].filter(Boolean).join(' · ')],
        group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      })),
};

const count = (unit: { zh: string; en: string }, enOne: string) => (v: number) =>
  tr({ zh: `${fixed(v, 0)} ${unit.zh}`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? enOne : unit.en}` });

export const anime: TopicDefinition = {
  id: 'anime',
  title: { zh: '動畫是哪裡做的：工作室、作品、聲優與獲獎', en: 'Where animation is made: studios, films, voice actors and awards' },
  shortTitle: { zh: '動畫', en: 'Animation' },
  defaultIndicator: 'studios',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Wikidata：動畫工作室（Q1107679）、動畫電影（Q202866）、電視動畫（Q63952888）、聲優與配音員（Q622807、Q2405480）、奧斯卡最佳動畫長片（Q106800）（經 QLever 查詢）',
        en: 'Wikidata: animation studios (Q1107679), animated films (Q202866), anime television series (Q63952888), voice actors and seiyū (Q2405480, Q622807) and the Academy Award for Best Animated Feature (Q106800) (via QLever)',
      },
      url: 'https://www.wikidata.org/wiki/Q1107679',
      license: 'CC0',
    },
    { name: { zh: '聯合國《世界人口展望 2024》（每百萬人）', en: 'UN World Population Prospects 2024 (per million people)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '全部來自 Wikidata（CC0，經 QLever 查詢），算的是寫進 Wikidata 的工作室、作品與人，各國收錄得完不完整差很多（日本、美國、歐洲收得多），只能看大概。國家依 Wikidata 的原產國、國籍或所在國家；蘇聯、捷克斯洛伐克、南斯拉夫、東德分別算在俄羅斯、捷克、塞爾維亞、德國。日本動畫協會的產業報告不准轉載，所以這裡只有「誰做的、做了幾部」，沒有產業規模。',
    en: 'All from Wikidata (CC0, queried via QLever): these are the studios, works and people recorded in Wikidata, and coverage varies a lot by country (Japan, the US and Europe are well covered), so treat the figures as approximate. Countries follow Wikidata’s country of origin, citizenship or location; the Soviet Union, Czechoslovakia, Yugoslavia and East Germany are counted under Russia, Czechia, Serbia and Germany. The Association of Japanese Animations’ industry report may not be reproduced, so this shows who makes animation and how much, not the size of the industry.',
  },
  overlays: [STUDIOS],
  listPanel: [STUDIO_LIST],
  indicators: [
    {
      id: 'studios',
      label: { zh: '動畫工作室', en: 'Animation studios' },
      description: { zh: 'Wikidata 上的動畫工作室共 879 家（105 家已解散），有座標的 529 家畫成點（已解散的另一色）；泡泡是還在營運、知道國家的 630 家（44 國）。日本 280 家最多，美國 74、中國 64、英國 32、南韓 30、法國 20、加拿大 19；台灣 7 家。', en: 'Wikidata lists 879 animation studios (105 defunct); the 529 with coordinates are drawn as points (defunct ones in another colour), and the bubbles count the 630 active studios with a known country (44 countries). Japan has the most (280), followed by the US (74), China (64), the UK (32), South Korea (30), France (20) and Canada (19); Taiwan has 7.' },
      unit: { zh: '家', en: 'studios' },
      file: 'studios-count.json',
      layer: { kind: 'bubble', legendValues: [5, 50, 250] },
      timeless: true,
      integer: true,
      format: count({ zh: '家', en: 'studios' }, 'studio'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'films',
      label: { zh: '動畫電影（依原產國累計）', en: 'Animated films (cumulative, by country of origin)' },
      description: { zh: '動畫電影依原產國、上映年份累計（Wikidata 有年份的 11,995 部；另有 1,361 部沒有年份，沒算進時間軸，滑過國家看）。到 2026 年美國 4,167 部最多，俄羅斯（含蘇聯）2,059、日本 1,785、法國 449、德國 323、丹麥 307；南韓 101、台灣 14。1970 年美國累計 2,716 部、占將近七成，蘇聯 635；日本六成多是 2000 年以後的（2000 年累計 633 部，2026 年 1,785 部）。', en: 'Animated films by country of origin, cumulative by release year (11,995 films with a year in Wikidata; another 1,361 have no year and are left out of the timeline, hover a country for its count). By 2026 the US has the most (4,167), followed by Russia including the Soviet Union (2,059), Japan (1,785), France (449), Germany (323) and Denmark (307); South Korea has 101 and Taiwan 14. By 1970 the US had 2,716, nearly 70% of the total, and the Soviet Union 635; almost two-thirds of Japan’s films date from after 2000 (633 by 2000, 1,785 by 2026).' },
      unit: { zh: '部', en: 'films' },
      file: 'films.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: count({ zh: '部', en: 'films' }, 'film'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'tv-anime',
      label: { zh: '電視動畫', en: 'Anime television series' },
      description: { zh: 'Wikidata 上歸在「電視動畫」（anime television series）的作品 4,436 部，日本 4,392 部占 99%；美國 9、義大利 8、南韓與中國各 5；台灣 1 部。這個類別在 Wikidata 幾乎只用在日本作品，別國的動畫影集不一定歸在這一類，跨國只能看大概。', en: 'Works classed in Wikidata as anime television series: 4,436, of which Japan has 4,392 (99%); the US has 9, Italy 8, and South Korea and China 5 each; Taiwan has 1. Wikidata uses this class almost only for Japanese works, and animated series from elsewhere are not necessarily classed this way, so cross-country comparisons are rough.' },
      unit: { zh: '部', en: 'series' },
      file: 'tv-anime.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 1000] },
      timeless: true,
      integer: true,
      format: count({ zh: '部', en: 'series' }, 'series'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'voice-actors',
      label: { zh: '聲優與配音員', en: 'Voice actors' },
      description: { zh: 'Wikidata 上職業是聲優或配音員的人，依國籍：共 26,499 人、118 國。日本 8,849 人最多，美國 5,897、德國 2,409、中國 1,070、南韓 938、義大利 595、希臘 589、加拿大 580、瑞典 547；台灣 173 人。', en: 'People whose occupation in Wikidata is voice actor or seiyū, by citizenship: 26,499 in 118 countries. Japan has the most (8,849), followed by the US (5,897), Germany (2,409), China (1,070), South Korea (938), Italy (595), Greece (589), Canada (580) and Sweden (547); Taiwan has 173.' },
      unit: { zh: '人', en: 'people' },
      file: 'voice-actors.json',
      layer: { kind: 'bubble', legendValues: [10, 500, 5000] },
      timeless: true,
      integer: true,
      format: count({ zh: '人', en: 'people' }, 'person'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'voice-actors-per',
      label: { zh: '每百萬人有幾位聲優與配音員', en: 'Voice actors per million people' },
      description: { zh: '聲優與配音員人數 ÷ 2024 年人口（聯合國《世界人口展望》），每百萬人幾位。愛沙尼亞 87.5 最多，日本 71.5、希臘 58.6、瑞典 51.6、芬蘭 49.5、挪威 33.2、德國 28.5；南韓 18.1、美國 17.1、台灣 7.5。小國幾個人就差很多，Wikidata 的收錄偏差也很大。', en: 'Voice actors divided by 2024 population (UN World Population Prospects), per million people. Estonia is highest (87.5), followed by Japan (71.5), Greece (58.6), Sweden (51.6), Finland (49.5), Norway (33.2) and Germany (28.5); South Korea has 18.1, the US 17.1 and Taiwan 7.5. A few people make a big difference in small countries, and Wikidata’s coverage is very uneven.' },
      unit: { zh: '人／百萬人', en: 'per million people' },
      file: 'voice-actors-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 50] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'oscar',
      label: { zh: '奧斯卡最佳動畫長片', en: 'Oscar for Best Animated Feature' },
      description: { zh: '奧斯卡最佳動畫長片（2002 年開始頒）得獎片的原產國，一部片有幾個原產國就各算一次：共 35 次、9 國。美國 22 次最多，日本、法國各 3，墨西哥 2；拉脫維亞、哥倫比亞、比利時、英國、澳洲各 1。台灣沒有。', en: 'Countries of origin of films that won the Academy Award for Best Animated Feature (first awarded in 2002), counting each country of a co-production: 35 in all, 9 countries. The US has 22, Japan and France 3 each, and Mexico 2; Latvia, Colombia, Belgium, the UK and Australia have 1 each. Taiwan has none.' },
      unit: { zh: '部', en: 'films' },
      file: 'oscar.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      timeless: true,
      integer: true,
      format: count({ zh: '部', en: 'films' }, 'film'),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
