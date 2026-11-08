import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 遊戲公司在哪裡（新主題，2026-11-08，製作手冊第二十七批 652，候選 1426、1428；pipeline/topics/game_companies.py）：
 * Wikidata 上的遊戲開發商與發行商（點是公司或總部的座標，已解散的另一色）、各國家數與每百萬人、遊戲引擎從哪一國來。
 * 跟已排除的 134「電玩遊戲從哪裡來」不同：這裡數的是公司，不是遊戲。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const nameOf = (p: PointRecord) => (getLang() === 'zh' ? (str(p.zh) ?? str(p.en)) : str(p.en)) ?? '';
const proper = (p: PointRecord) => (getLang() === 'zh' && str(p.zh) && str(p.en) && p.zh !== p.en ? String(p.en) : undefined);

const KINDS: Text[] = [
  { zh: '開發商（含兼發行）', en: 'Developer (incl. publishing)' },
  { zh: '發行商', en: 'Publisher' },
  { zh: '已解散', en: 'Defunct' },
];
const kindText = (p: PointRecord) => tr(KINDS[(Number(p.k) || 1) - 1]);
const yearsText = (p: PointRecord) =>
  [
    typeof p.y === 'number' ? tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }) : null,
    typeof p.end === 'number' ? tr({ zh: `${p.end} 年解散`, en: `defunct ${p.end}` }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

const COMPANIES: PointsOverlayDef = {
  kind: 'points',
  id: 'companies',
  file: 'companies.json',
  label: { zh: '遊戲開發商與發行商（Wikidata）', en: 'Game developers and publishers (Wikidata)' },
  indicators: ['companies', 'companies-per'],
  radius: 2.8,
  color: {
    field: 'k',
    title: { zh: '類型', en: 'Type' },
    thresholds: [1.5, 2.5],
    classes: KINDS.map((label, i) => ({ color: [C[0], C[1], MAP_TOKENS.categoricalOther][i], label })),
  },
  sortField: 'k',
  tooltip: (p, { countryName }) => ({
    title: nameOf(p),
    detail: [kindText(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    extra: [yearsText(p), str(p.parent) ? tr({ zh: `母公司：${p.parent}`, en: `Parent: ${p.parent}` }) : null].filter((x): x is string => Boolean(x)),
    properNoun: proper(p),
  }),
};

const COMPANY_LIST: ListPanelDef = {
  label: { zh: '這一國的遊戲公司', en: 'Game companies here' },
  tabLabel: { zh: '公司', en: 'Companies' },
  indicators: ['companies', 'companies-per'],
  file: 'companies.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡沒有有座標的遊戲公司', en: 'No game companies with coordinates here in Wikidata' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.k === 3) - Number(b.k === 3) || (Number(a.y) || 9999) - (Number(b.y) || 9999))
      .map((p, i): ListRow => ({
        key: `gc-${i}`,
        title: nameOf(p),
        properNoun: proper(p),
        lines: [[kindText(p), yearsText(p)].filter(Boolean).join(' · '), str(p.parent) ? tr({ zh: `母公司：${p.parent}`, en: `Parent: ${p.parent}` }) : ''],
        group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
      })),
};

const ENGINE_LIST: ListPanelDef = {
  label: { zh: '遊戲引擎（依開發商的國家）', en: 'Game engines (by developer country)' },
  tabLabel: { zh: '引擎', en: 'Engines' },
  indicators: ['engines'],
  file: 'engines.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡沒有遊戲引擎', en: 'No game engines from here in Wikidata' },
  rows: (points, { countryName }) =>
    points.map(
      (p, i): ListRow => ({
        key: `ge-${i}`,
        title: nameOf(p),
        properNoun: proper(p),
        lines: [[str(p.dev), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · ')],
        group: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
      }),
    ),
};

export const gameCompanies: TopicDefinition = {
  id: 'game-companies',
  title: { zh: '遊戲公司在哪裡：開發商、發行商與遊戲引擎', en: 'Where game companies are: developers, publishers and engines' },
  shortTitle: { zh: '遊戲公司', en: 'Game companies' },
  defaultIndicator: 'companies',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Wikidata：遊戲開發商（Q210167）、發行商（Q1137109）、遊戲引擎（Q193564）與它們的國家、座標、成立與解散年份（經 QLever 查詢）',
        en: 'Wikidata: video game developers (Q210167), publishers (Q1137109) and game engines (Q193564), with countries, coordinates and founding and closing years (via QLever)',
      },
      url: 'https://www.wikidata.org/wiki/Q210167',
      license: 'CC0',
    },
    { name: { zh: '聯合國《世界人口展望 2024》（每百萬人的家數）', en: 'UN World Population Prospects 2024 (per million people)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '公司是 Wikidata 上類別（含子類別）是遊戲開發商或遊戲發行商的項目，國家用 Wikidata 的「國家」（常是現在的註冊地，不一定是創立地），點用公司本身或總部的座標；有解散日期的算已解散，國家的家數不算它們。Wikidata 的收錄偏英語圈與日本，中國大陸與東南亞明顯低估，家數反映的是 Wikidata 寫得多完整，不是產業的真實規模。遊戲引擎用開發商的國家，沒有開發商國家的用原產國；很多商用自研引擎不在 Wikidata 上。',
    en: 'Companies are Wikidata items classed (including subclasses) as video game developers or publishers. Countries are Wikidata’s “country” (often today’s place of registration, not necessarily where the company was founded), and dots use the company’s own or its headquarters’ coordinates; companies with a dissolution date count as defunct and are left out of country counts. Wikidata covers the English-speaking world and Japan best and badly undercounts mainland China and Southeast Asia, so counts reflect how complete Wikidata is rather than the true size of the industry. Game engines use the developer’s country, or the country of origin when that is missing; many proprietary in-house engines are not in Wikidata.',
  },
  overlays: [COMPANIES],
  listPanel: [COMPANY_LIST, ENGINE_LIST],
  indicators: [
    {
      id: 'companies',
      label: { zh: '遊戲公司家數', en: 'Game companies' },
      description: {
        zh: 'Wikidata 上標成遊戲開發商或發行商的公司：7,631 家，其中 749 家已解散；有國家而且還在的 4,072 家、87 國。美國 849 家最多，日本 689、英國 446、加拿大 198、法國 175、德國 165、中國 151、波蘭 129、西班牙 110、瑞典 105；台灣 43 家。地圖上的點是有座標的 2,949 家（已解散的 539 家另一色），左邊列出這一國的公司。Wikidata 的收錄偏英語圈與日本，中國大陸與東南亞明顯低估。',
        en: 'Companies tagged as video game developers or publishers in Wikidata: 7,631, of which 749 are defunct; 4,072 active ones with a country, in 87 countries. The US has the most (849), followed by Japan (689), the UK (446), Canada (198), France (175), Germany (165), China (151), Poland (129), Spain (110) and Sweden (105); Taiwan has 43. Dots are the 2,949 with coordinates (the 539 defunct ones in another colour), and the list on the left shows the companies in a country. Wikidata covers the English-speaking world and Japan best and badly undercounts mainland China and Southeast Asia.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'companies-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 800] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'company' : 'companies'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'companies-per',
      label: { zh: '每百萬人有幾家遊戲公司', en: 'Game companies per million people' },
      description: {
        zh: '還在營運的遊戲公司家數 ÷ 2024 年人口（人口不到 100 萬的不畫）。賽普勒斯每百萬人 11.0 家最多，瑞典 9.9、芬蘭 9.8、愛沙尼亞 7.4、丹麥 6.7、英國 6.5、日本 5.6、加拿大 5.0；美國 2.5、台灣 1.9、南韓 1.5、中國 0.1。數字跟著 Wikidata 的收錄走，北歐、英語圈收得最完整。',
        en: 'Active game companies divided by 2024 population (countries under 1 million people are not shown). Cyprus has the most per million people (11.0), followed by Sweden (9.9), Finland (9.8), Estonia (7.4), Denmark (6.7), the UK (6.5), Japan (5.6) and Canada (5.0); the US has 2.5, Taiwan 1.9, South Korea 1.5 and China 0.1. The figures follow Wikidata’s coverage, which is most complete for the Nordic and English-speaking countries.',
      },
      unit: { zh: '家／百萬人', en: 'per million people' },
      file: 'companies-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.2, 0.5, 1, 2, 4, 8] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => `${v}`,
    },
    {
      id: 'engines',
      label: { zh: '遊戲引擎從哪裡來', en: 'Where game engines come from' },
      description: {
        zh: 'Wikidata 上的遊戲引擎 620 個，有開發商國家（或原產國）的 236 個、23 國：美國 106 個最多，日本 26、英國 22、加拿大 18、法國 12、德國 9、瑞典 8；台灣沒有。國家用開發商的國家，沒有的用原產國。左邊依國家列出，位置是開發商的座標（沒有座標的只算在國家的個數裡）。Wikidata 的收錄偏開源與有維基條目的引擎，很多日本、中國的自研引擎沒有。',
        en: '620 game engines in Wikidata, 236 of them with a developer country (or country of origin), in 23 countries: the US has the most (106), followed by Japan (26), the UK (22), Canada (18), France (12), Germany (9) and Sweden (8); Taiwan has none. Countries use the developer’s country, or the country of origin when that is missing. The list on the left groups them by country, located at the developer (engines without coordinates count only towards the country total). Wikidata favours open-source engines and those with Wikipedia articles, and many Japanese and Chinese in-house engines are missing.',
      },
      unit: { zh: '個', en: 'engines' },
      file: 'engines-count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'engine' : 'engines'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
  ],
};
