import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 唱片公司與錄音室在哪裡（新主題，2026-11-08，製作手冊第二十七批 664，候選 1453、1454；pipeline/topics/record_labels.py）：
 * Wikidata 的唱片公司（點是公司或總部，已解散的另一色）、各國家數與每百萬人；OSM 有 studio=* 子標籤的錄音室、廣播、電視與影片攝影棚。
 * IFPI 與 CISAC 的市場數字不准轉載，所以只做「在哪裡」。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const nameOf = (p: PointRecord) => (getLang() === 'zh' ? (str(p.zh) ?? str(p.en)) : str(p.en)) ?? '';
const proper = (p: PointRecord) => (getLang() === 'zh' && str(p.zh) && str(p.en) && p.zh !== p.en ? String(p.en) : undefined);
const osmName = (p: PointRecord) =>
  (getLang() === 'zh' ? (str(p.nz) ?? str(p.n) ?? str(p.ne)) : (str(p.ne) ?? str(p.n))) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' });
const osmProper = (p: PointRecord) => (getLang() === 'en' && !str(p.ne) && str(p.n) ? String(p.n) : undefined);

const LABEL_KINDS: Text[] = [
  { zh: '還在營運', en: 'Active' },
  { zh: '已解散', en: 'Defunct' },
];
const yearsText = (p: PointRecord) =>
  [
    typeof p.y === 'number' ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null,
    typeof p.end === 'number' ? tr({ zh: `${p.end} 年解散`, en: `defunct ${p.end}` }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
const parentText = (p: PointRecord) => (str(p.parent) ? tr({ zh: `母公司：${p.parent}`, en: `Parent: ${p.parent}` }) : null);

const LABELS: PointsOverlayDef = {
  kind: 'points',
  id: 'labels',
  file: 'labels.json',
  label: { zh: '唱片公司（Wikidata）', en: 'Record labels (Wikidata)' },
  indicators: ['labels', 'labels-per'],
  radius: 2.8,
  color: {
    field: 'k',
    title: { zh: '狀態', en: 'Status' },
    thresholds: [1.5],
    classes: LABEL_KINDS.map((label, i) => ({ color: [C[3], MAP_TOKENS.categoricalOther][i], label })),
  },
  sortField: 'k',
  tooltip: (p, { countryName }) => ({
    title: nameOf(p),
    detail: [tr(LABEL_KINDS[(Number(p.k) || 1) - 1]), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: [yearsText(p), parentText(p)].filter((x): x is string => Boolean(x)),
    properNoun: proper(p),
  }),
};

const LABEL_LIST: ListPanelDef = {
  label: { zh: '這一國的唱片公司', en: 'Record labels here' },
  tabLabel: { zh: '唱片公司', en: 'Labels' },
  indicators: ['labels', 'labels-per'],
  file: 'labels.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡沒有有座標的唱片公司', en: 'No record labels with coordinates here in Wikidata' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.k) - Number(b.k) || (Number(a.y) || 9999) - (Number(b.y) || 9999))
      .map((p, i): ListRow => ({
        key: `rl-${i}`,
        title: nameOf(p),
        properNoun: proper(p),
        lines: [[tr(LABEL_KINDS[(Number(p.k) || 1) - 1]), yearsText(p)].filter(Boolean).join(' · '), parentText(p) ?? ''],
        group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      })),
};

const STUDIO_KINDS: Text[] = [
  { zh: '錄音室', en: 'Recording studio' },
  { zh: '廣播電台', en: 'Radio studio' },
  { zh: '電視攝影棚', en: 'Television studio' },
  { zh: '影片攝影棚', en: 'Video studio' },
];
const STUDIOS: PointsOverlayDef = {
  kind: 'points',
  id: 'studios',
  file: 'studios.json',
  label: { zh: '錄音室與攝影棚（OSM）', en: 'Studios (OSM)' },
  indicators: ['studios'],
  radius: 2.5,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5],
    classes: STUDIO_KINDS.map((label, i) => ({ color: [C[0], C[1], C[2], C[4]][i], label })),
  },
  sortField: 'k',
  tooltip: (p, { countryName }) => ({
    title: osmName(p),
    detail: [tr(STUDIO_KINDS[(Number(p.k) || 1) - 1]), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: osmProper(p),
  }),
};
const STUDIO_LIST: ListPanelDef = {
  label: { zh: '這一國的錄音室與攝影棚', en: 'Studios here' },
  tabLabel: { zh: '錄音室', en: 'Studios' },
  indicators: ['studios'],
  file: 'studios.json',
  countryField: 'iso3',
  empty: { zh: 'OpenStreetMap 上這裡沒有標了種類的錄音室或攝影棚', en: 'No studios with a type here in OpenStreetMap' },
  rows: (points) =>
    [...points]
      .sort((a, b) => Number(a.k) - Number(b.k) || osmName(a).localeCompare(osmName(b)))
      .map((p, i): ListRow => ({
        key: `st-${i}`,
        title: osmName(p),
        properNoun: osmProper(p),
        lines: [tr(STUDIO_KINDS[(Number(p.k) || 1) - 1])],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      })),
};

export const recordLabels: TopicDefinition = {
  id: 'record-labels',
  title: { zh: '唱片公司與錄音室在哪裡', en: 'Where record labels and studios are' },
  shortTitle: { zh: '唱片公司與錄音室', en: 'Record labels' },
  defaultIndicator: 'labels',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Wikidata：唱片公司（Q18127）與它們的國家、座標、成立與解散年份、母公司（經 QLever 查詢）',
        en: 'Wikidata: record labels (Q18127), with countries, coordinates, founding and closing years and parent companies (via QLever)',
      },
      url: 'https://www.wikidata.org/wiki/Q18127',
      license: 'CC0',
    },
    { name: { zh: 'OpenStreetMap（studio=audio、radio、television、video，經 QLever 查詢）', en: 'OpenStreetMap (studio=audio, radio, television and video, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    { name: { zh: '聯合國《世界人口展望 2024》（每百萬人的家數）', en: 'UN World Population Prospects 2024 (per million people)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: withTerritories({
    zh: '唱片公司是 Wikidata 上類別（含子類別）是唱片公司的項目，國家用 Wikidata 的「國家」，點用公司本身或總部的座標；有解散日期的算已解散，國家的家數不算它們。大集團底下的子廠牌各算一家（還在營運的有 840 家寫了母公司）。Wikidata 的收錄偏歐美與獨立小廠，北歐特別多，亞洲、非洲明顯低估，家數反映的是 Wikidata 寫得多完整，不是唱片業的規模；IFPI 與 CISAC 的市場數字不准轉載，所以沒有營收。錄音室與攝影棚只算 OpenStreetMap 上有 studio=* 子標籤的：很多國家把攝影館、舞蹈教室也標成 amenity=studio，所以沒有子標籤的不算；數量也在量 OSM 畫得多完整。',
    en: 'Record labels are Wikidata items classed (including subclasses) as record labels. Countries are Wikidata’s “country”, and dots use the label’s own or its headquarters’ coordinates; labels with a dissolution date count as defunct and are left out of country counts. Sub-labels of the big groups each count as one (840 active labels have a parent company recorded). Wikidata favours Western and independent labels, with the Nordic countries especially well covered and Asia and Africa clearly undercounted, so counts reflect how complete Wikidata is, not the size of the record industry; IFPI and CISAC market figures may not be reproduced, so there is no revenue. Studios count only places with a studio=* subtag in OpenStreetMap: in many countries photo studios and dance schools are also tagged amenity=studio, so places without a subtag are left out, and counts also reflect how completely OSM is mapped.',
  }),
  overlays: [LABELS, STUDIOS],
  listPanel: [LABEL_LIST, STUDIO_LIST],
  indicators: [
    {
      id: 'labels',
      label: { zh: '唱片公司家數', en: 'Record labels' },
      description: {
        zh: 'Wikidata 上的唱片公司 16,105 家，其中 987 家已解散；有國家而且還在的 10,955 家、139 國。美國 3,364 家最多，英國 1,195、德國 706、日本 530、法國 401、義大利 385、加拿大 335、挪威 314、瑞典 298、南韓 261；台灣 52 家。地圖上的點是有座標的 3,507 家（已解散的 369 家另一色），左邊列出這一國的唱片公司。',
        en: 'Wikidata lists 16,105 record labels, of which 987 are defunct; 10,955 active ones with a country, in 139 countries. The US has the most (3,364), followed by the UK (1,195), Germany (706), Japan (530), France (401), Italy (385), Canada (335), Norway (314), Sweden (298) and South Korea (261); Taiwan has 52. Dots are the 3,507 with coordinates (the 369 defunct ones in another colour), and the list on the left shows the labels in a country.',
      },
      unit: { zh: '家', en: 'labels' },
      file: 'labels-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'label' : 'labels'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'labels-per',
      label: { zh: '每百萬人有幾家唱片公司', en: 'Record labels per million people' },
      description: {
        zh: '還在營運的唱片公司家數 ÷ 2024 年人口（人口不到 100 萬的不畫）。挪威每百萬人 56.3 家最多，芬蘭 34.5、瑞典 28.1、英國 17.3、丹麥 15.7、愛沙尼亞 14.0；美國 9.7、德國 8.4、南韓 5.1、日本 4.3、台灣 2.2、中國 0.02。北歐高，主要是當地的維基編輯者寫得多。',
        en: 'Active record labels divided by 2024 population (countries under 1 million people are not shown). Norway has the most per million people (56.3), followed by Finland (34.5), Sweden (28.1), the UK (17.3), Denmark (15.7) and Estonia (14.0); the US has 9.7, Germany 8.4, South Korea 5.1, Japan 4.3, Taiwan 2.2 and China 0.02. The Nordic figures are high mainly because local Wikidata editors have recorded so many.',
      },
      unit: { zh: '家／百萬人', en: 'per million people' },
      file: 'labels-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'studios',
      label: { zh: '錄音室與攝影棚（OSM）', en: 'Studios (OSM)' },
      description: {
        zh: 'OpenStreetMap 上有種類子標籤的錄音室與攝影棚，子項目切換種類。錄音室（studio=audio）2,014 處、123 個國家或地區：美國 370、德國 211、英國 145、法國 128、義大利 90、日本 89；台灣 6。廣播電台 5,396 處：美國 844、巴西 434、阿根廷 318、菲律賓 279；台灣 23。電視攝影棚 3,298 處：美國 532、巴西 229、中國 212、日本 182；台灣 20。影片攝影棚 2,340 處：美國 506、英國 231、德國 186；台灣 11。',
        en: 'Studios with a type subtag in OpenStreetMap; sub-items switch the type. Recording studios (studio=audio): 2,014 in 123 countries and territories, led by the US (370), Germany (211), the UK (145), France (128), Italy (90) and Japan (89); Taiwan has 6. Radio studios: 5,396, led by the US (844), Brazil (434), Argentina (318) and the Philippines (279); Taiwan has 23. Television studios: 3,298, led by the US (532), Brazil (229), China (212) and Japan (182); Taiwan has 20. Video studios: 2,340, led by the US (506), the UK (231) and Germany (186); Taiwan has 11.',
      },
      unit: { zh: '處', en: 'studios' },
      file: 'studios/{item}.json',
      dimension: {
        label: { zh: '種類', en: 'Type' },
        options: [
          { id: 'audio', label: { zh: '錄音室', en: 'Recording studios' } },
          { id: 'radio', label: { zh: '廣播電台', en: 'Radio studios' } },
          { id: 'television', label: { zh: '電視攝影棚', en: 'Television studios' } },
          { id: 'video', label: { zh: '影片攝影棚', en: 'Video studios' } },
        ],
        defaultOption: 'audio',
      },
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
