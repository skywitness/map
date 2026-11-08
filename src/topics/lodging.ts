import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 旅館、民宿與旅行社（新主題，2026-11-08，製作手冊第二十七批 670、671，候選 1473、1474；pipeline/topics/lodging.py）：
 * OSM 的旅館與民宿每十萬人與家數（全球的點太多不畫），台灣畫觀光署 15,665 家旅館民宿的點；OECD 的旅行社家數與就業，
 * 台灣用觀光署的旅行業名錄。手冊把兩題排成兩個新主題，這裡合成一個（都是旅行的服務業）。
 */
const CLASSES: Text[] = [
  { zh: '國際觀光旅館', en: 'International tourist hotel' },
  { zh: '一般觀光旅館', en: 'Standard tourist hotel' },
  { zh: '一般旅館', en: 'Hotel' },
  { zh: '民宿', en: 'B&B (minsu)' },
];
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const classText = (p: PointRecord) => tr(CLASSES[(Number(p.k) || 4) - 1]);
const roomsText = (p: PointRecord) =>
  typeof p.r === 'number' ? tr({ zh: `${fixed(p.r, 0)} 間房`, en: `${fixed(p.r, 0)} ${p.r === 1 ? 'room' : 'rooms'}` }) : null;

const TAIWAN: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan',
  file: 'taiwan.json',
  label: { zh: '台灣的旅館與民宿（觀光署）', en: 'Hotels and B&Bs in Taiwan (Tourism Administration)' },
  indicators: ['hotels-per', 'hotels', 'guest-houses-per', 'guest-houses'],
  radius: { field: 'k', stops: [[1, 4.5], [2, 4], [3, 2.6], [4, 2]] },
  color: {
    field: 'k',
    title: { zh: '類別', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5],
    classes: CLASSES.map((label, i) => ({ color: [C[7], C[5], C[1], C[0]][i], label })),
  },
  sortField: 'k',
  tooltip: (p) => ({
    title: str(p.n) ?? '',
    detail: classText(p),
    extra: [roomsText(p), str(p.t)].filter((x): x is string => Boolean(x)),
    properNoun: undefined,
  }),
};

const TAIWAN_LIST: ListPanelDef = {
  label: { zh: '台灣的旅館與民宿（依縣市）', en: 'Hotels and B&Bs in Taiwan by county' },
  tabLabel: { zh: '台灣旅宿', en: 'Taiwan' },
  indicators: ['hotels-per', 'hotels', 'guest-houses-per', 'guest-houses'],
  file: 'taiwan.json',
  empty: { zh: '只有台灣有逐家的名單', en: 'Only Taiwan has a list of individual places' },
  rows: (points) =>
    [...points]
      .sort((a, b) => String(a.t ?? '').localeCompare(String(b.t ?? ''), 'zh-Hant') || Number(a.k) - Number(b.k) || (Number(b.r) || 0) - (Number(a.r) || 0))
      .map((p, i): ListRow => ({
        key: `tw-${i}`,
        title: str(p.n) ?? '',
        lines: [[classText(p), roomsText(p)].filter(Boolean).join(' · ')],
        group: str(p.t)?.slice(0, 3) ?? undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      })),
};

const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per 100,000` });

export const lodging: TopicDefinition = {
  id: 'lodging',
  title: { zh: '旅館、民宿與旅行社', en: 'Hotels, guest houses and travel agencies' },
  shortTitle: { zh: '旅宿與旅行社', en: 'Lodging' },
  defaultIndicator: 'hotels-per',
  defaultYear: 2026,
  sources: [
    { name: { zh: 'OpenStreetMap（tourism=hotel、guest_house，經 QLever 查詢）', en: 'OpenStreetMap (tourism=hotel and guest_house, via QLever)' }, url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0' },
    {
      name: { zh: '交通部觀光署：旅館民宿－觀光資訊資料庫（data.gov.tw 7780）', en: 'Tourism Administration (Taiwan): hotels and B&Bs, tourism information database (data.gov.tw 7780)' },
      url: 'https://data.gov.tw/dataset/7780',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: 'OECD 觀光統計：Enterprises and employment in tourism（旅行社與旅遊業者）', en: 'OECD tourism statistics: enterprises and employment in tourism (travel agencies and tour operators)' },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: { zh: '交通部觀光署：旅行業基本資料（data.gov.tw 72074）', en: 'Tourism Administration (Taiwan): registered travel agencies (data.gov.tw 72074)' },
      url: 'https://data.gov.tw/dataset/72074',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    { name: { zh: '聯合國《世界人口展望 2024》（每十萬人）', en: 'UN World Population Prospects 2024 (per 100,000 people)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '旅館與民宿是 OpenStreetMap 上標成 tourism=hotel、tourism=guest_house 的地方（2026 年 11 月的快照，© OpenStreetMap contributors），不是官方的登記名錄；每十萬人只替 OSM 覆蓋良好的 93 國上色，數量也在量 OSM 畫得多完整（台灣 OSM 上的旅館 2,297 家，觀光署登記的旅館是 3,272 家、民宿 12,393 家）。各國把什麼叫 guest house 差很多（義大利、波蘭的 B&B、古巴的 casa particular 都算），兩者的界線不一。全球 45 萬家旅館的點太多，只畫台灣：觀光署「旅館民宿－觀光資訊資料庫」的 15,665 家（國際觀光旅館、一般觀光旅館、一般旅館、民宿），點的大小依類別、tooltip 有房間數。旅行社是 OECD 觀光統計的旅行社與旅遊業者（各國最近一年差很多），台灣用觀光署旅行業名錄的總公司數。',
    en: 'Hotels and guest houses are places tagged tourism=hotel and tourism=guest_house in OpenStreetMap (a November 2026 snapshot, © OpenStreetMap contributors), not official registers; per-100,000 rates are shaded only for the 93 countries well covered by OSM, and counts also reflect how completely OSM is mapped (Taiwan has 2,297 hotels in OSM, against 3,272 registered hotels and 12,393 registered B&Bs). What counts as a guest house differs a lot (Italian and Polish B&Bs and Cuban casas particulares all count), and the line between the two tags varies. The 455,000 hotels worldwide are too many to draw, so only Taiwan has dots: the Tourism Administration’s 15,665 registered hotels and B&Bs (international tourist hotels, standard tourist hotels, hotels and minsu), sized by type, with room counts in the tooltip. Travel agencies come from OECD tourism statistics (latest years differ a lot), with Taiwan’s figure from the Tourism Administration register of head offices.',
  },
  overlays: [TAIWAN],
  listPanel: [TAIWAN_LIST],
  indicators: [
    {
      id: 'hotels-per',
      label: { zh: '每十萬人有幾家旅館（OSM）', en: 'Hotels per 100,000 people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成旅館的地方 ÷ 2024 年人口，只替 OSM 覆蓋良好的 93 國上色。觀光小國最多：塞席爾、馬爾地夫每十萬人約 102 家，蒙特內哥羅 94.8、希臘 91.9、冰島 80.6、奧地利 71.2、喬治亞 60.5；德國 29.5、法國 29.2、英國 16.8、美國 13.4、日本 12.1、台灣 9.9、南韓 5.3。點是台灣觀光署登記的每一家旅館與民宿。', en: 'Places tagged as hotels in OpenStreetMap divided by 2024 population, shaded only for the 93 countries well covered by OSM. Small tourist countries lead: Seychelles and the Maldives have about 102 per 100,000 people, Montenegro 94.8, Greece 91.9, Iceland 80.6, Austria 71.2 and Georgia 60.5; Germany has 29.5, France 29.2, the UK 16.8, the US 13.4, Japan 12.1, Taiwan 9.9 and South Korea 5.3. Dots are every hotel and B&B registered with Taiwan’s Tourism Administration.' },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'hotels-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40, 80] } },
      timeless: true,
      format: per100k,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'hotels',
      label: { zh: '旅館家數（OSM）', en: 'Hotels (OSM)' },
      description: { zh: 'OpenStreetMap 上標成旅館的地方：455,068 處、212 國。美國 46,279 處最多，德國 24,898、義大利 23,501、中國 19,617、法國 19,413、俄羅斯 17,150、印度 16,184、西班牙 14,949、日本 14,916；台灣 2,297 處（觀光署登記的旅館 3,272 家：國際觀光旅館 71、一般觀光旅館 45、一般旅館 3,156）。', en: 'Places tagged as hotels in OpenStreetMap: 455,068 in 212 countries. The US has the most (46,279), followed by Germany (24,898), Italy (23,501), China (19,617), France (19,413), Russia (17,150), India (16,184), Spain (14,949) and Japan (14,916); Taiwan has 2,297 (against 3,272 hotels registered with the Tourism Administration: 71 international tourist hotels, 45 standard tourist hotels and 3,156 hotels).' },
      unit: { zh: '家', en: 'hotels' },
      file: 'hotels.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'guest-houses-per',
      label: { zh: '每十萬人有幾家民宿（OSM）', en: 'Guest houses per 100,000 people (OSM)' },
      description: { zh: 'OpenStreetMap 上標成民宿（guest house，含 B&B）的地方 ÷ 2024 年人口。塞席爾每十萬人 239 家最多，冰島 100.9、奧地利 71.4、蒙特內哥羅 66.1、聖露西亞 52.9、馬爾地夫 49.1、克羅埃西亞 47.3；德國 16.4、法國 14.4、英國 11.9、南韓 5.0、日本 2.4、台灣 2.1、美國 1.4。台灣觀光署登記的民宿有 12,393 家，OSM 上只標了 495 處。', en: 'Places tagged as guest houses (including B&Bs) in OpenStreetMap divided by 2024 population. Seychelles has the most per 100,000 people (239), followed by Iceland (100.9), Austria (71.4), Montenegro (66.1), Saint Lucia (52.9), the Maldives (49.1) and Croatia (47.3); Germany has 16.4, France 14.4, the UK 11.9, South Korea 5.0, Japan 2.4, Taiwan 2.1 and the US 1.4. Taiwan’s Tourism Administration registers 12,393 B&Bs, but only 495 are tagged in OSM.' },
      unit: { zh: '家／十萬人', en: 'per 100,000' },
      file: 'guest-houses-per.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] } },
      timeless: true,
      format: per100k,
      formatTick: (v) => `${v}`,
    },
    {
      id: 'guest-houses',
      label: { zh: '民宿家數（OSM）', en: 'Guest houses (OSM)' },
      description: { zh: 'OpenStreetMap 上標成民宿的地方：201,272 處、210 國。義大利 14,012 處最多，德國 13,866、波蘭 9,678、法國 9,607、俄羅斯 8,835、英國 8,234、奧地利 6,510、古巴 6,050（民宿之國：casa particular）；台灣 495 處。', en: 'Places tagged as guest houses in OpenStreetMap: 201,272 in 210 countries. Italy has the most (14,012), followed by Germany (13,866), Poland (9,678), France (9,607), Russia (8,835), the UK (8,234), Austria (6,510) and Cuba (6,050, home of the casa particular); Taiwan has 495.' },
      unit: { zh: '家', en: 'guest houses' },
      file: 'guest-houses.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'travel-agencies',
      label: { zh: '旅行社與旅遊業者', en: 'Travel agencies and tour operators' },
      description: {
        zh: '旅行社與旅遊業者的家數（OECD 觀光統計，各國最近一年差很多，滑過看年份；有的國家算企業、有的算營業場所）。中國 24,944 家（2012）、美國 22,843、南韓 20,903、西班牙 17,404、秘魯 17,261、哥倫比亞 16,189、土耳其 14,310、巴西 13,564（2024）、德國 11,017（2023）；丹麥 603、哥斯大黎加 552、馬爾他 504、盧森堡 72 最少。台灣是觀光署旅行業名錄的總公司 4,250 家（甲種 3,336、綜合 586、乙種 328，不含分公司）。',
        en: 'Number of travel agencies and tour operators (OECD tourism statistics; latest years differ a lot, hover for the year; some countries count enterprises and others establishments). China 24,944 (2012), the US 22,843, South Korea 20,903, Spain 17,404, Peru 17,261, Colombia 16,189, Turkey 14,310, Brazil 13,564 (2024) and Germany 11,017 (2023); Denmark 603, Costa Rica 552, Malta 504 and Luxembourg 72 are lowest. Taiwan’s figure is the 4,250 head offices in the Tourism Administration register (3,336 class A, 586 consolidated and 328 class B, excluding branches).',
      },
      unit: { zh: '家', en: 'businesses' },
      file: 'travel-agencies.json',
      defaultYear: 2026,
      layer: { kind: 'bubble', legendValues: [500, 5000, 20000] },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'travel-agency-jobs',
      label: { zh: '在旅行社工作的人', en: 'Jobs in travel agencies' },
      description: {
        zh: '旅行社與旅遊業者的就業人數（OECD）。印度 51.2 萬（2009）、美國 32.7 萬（2023）、中國 31.8 萬（2012）、德國 8.1 萬、英國 7.2 萬、巴西 7.0 萬、土耳其 7.0 萬、西班牙 6.7 萬、南韓 6.7 萬；丹麥 508 人最少。OECD 沒有台灣。',
        en: 'Employment in travel agencies and tour operators (OECD). India 512,000 (2009), the US 327,000 (2023), China 318,000 (2012), Germany 81,000, the UK 72,000, Brazil 70,000, Turkey 70,000, Spain 67,000 and South Korea 67,000; Denmark is lowest at 508. Taiwan is not covered.',
      },
      unit: { zh: '人', en: 'people' },
      file: 'travel-agency-jobs.json',
      defaultYear: 2026,
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} people` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
