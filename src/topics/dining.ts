import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/** 米其林三星餐廳（2026-11-04，製作手冊第二十一批 368；pipeline/topics/michelin.py）：英文維基的清單，位置用 Wikidata */
const MICHELIN: PointsOverlayDef = {
  kind: 'points',
  id: 'michelin',
  file: 'michelin.json',
  indicators: ['michelin-3', 'michelin-3-per-10m'],
  label: { zh: '米其林三星餐廳', en: 'Michelin three-star restaurants' },
  radius: 4,
  color: MAP_TOKENS.categorical[7],
  tooltip: (p, { countryName }) => ({
    title: String(p.n ?? ''),
    extra: [
      [String(p.p ?? ''), typeof p.iso3 === 'string' ? countryName(p.iso3) : ''].filter(Boolean).join(' · '),
      [p.chef ? tr({ zh: `主廚：${p.chef}`, en: `Chef: ${p.chef}` }) : null, p.y ? tr({ zh: `${p.y} 年起三星`, en: `Three stars since ${p.y}` }) : null]
        .filter(Boolean)
        .join(' · '),
      p.e === 1 ? '' : tr({ zh: '位置是所在城市', en: 'Placed at its city' }),
    ].filter(Boolean),
    properNoun: String(p.n ?? ''),
  }),
};

/** 卡拉OK包廂（2026-11-08，製作手冊第二十七批 665，候選 1455；pipeline/topics/ent_venues.py 的 karaoke）：OSM amenity=karaoke_box */
const kStr = (v: unknown) => (typeof v === 'string' && v ? v : null);
const karaokeName = (p: PointRecord) =>
  (getLang() === 'zh' ? (kStr(p.nz) ?? kStr(p.n) ?? kStr(p.ne)) : (kStr(p.ne) ?? kStr(p.n))) ?? tr({ zh: '（沒有名稱的卡拉OK）', en: '(unnamed karaoke)' });
const KARAOKE: PointsOverlayDef = {
  kind: 'points',
  id: 'karaoke',
  file: 'karaoke-points.json',
  indicators: ['karaoke-per', 'karaoke'],
  label: { zh: '卡拉OK包廂（OSM）', en: 'Karaoke boxes (OSM)' },
  radius: 2.6,
  color: MAP_TOKENS.categorical[4],
  tooltip: (p, { countryName }) => ({
    title: karaokeName(p),
    detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
    properNoun: getLang() === 'en' && !kStr(p.ne) && kStr(p.n) ? String(p.n) : undefined,
  }),
};

const MICHELIN_NOTE = {
  zh: '米其林只在有出版指南的地方評星，沒有顏色的國家是沒有三星餐廳或沒有被評，不是 0。',
  en: 'Michelin only rates places where it publishes a guide; uncoloured countries have no three-star restaurant or are not rated, which is not the same as zero.',
};

/**
 * 外食與喝一杯（2026-11-04，製作手冊第二十一批 342；pipeline/topics/dining.py）：
 * OpenStreetMap（經 QLever）上各國的餐廳、速食、咖啡館、酒吧與冰淇淋店，每十萬人幾家。
 * 只畫 OSM 覆蓋良好的國家（pipeline/sources/osm_coverage.py，第二十一批的 OSM 題目共用）。
 */

const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per 100,000` });
const UNIT = { zh: '家／十萬人', en: 'per 100,000 people' };

const indicator = (id: string, label: IndicatorDef['label'], description: IndicatorDef['description'], thresholds: number[]): IndicatorDef => ({
  id,
  label,
  description,
  unit: UNIT,
  file: `${id}.json`,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
  format: per100k,
  formatTick: (v) => `${v}`,
});

/** 不賣酒的飲料店（第二十四批 414，2026-11-06）：比較少，用每百萬人 */
const perMillion = (v: number) => tr({ zh: `每百萬人 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per million` });
const indicatorPerMillion = (...args: Parameters<typeof indicator>): IndicatorDef => ({
  ...indicator(...args),
  unit: { zh: '家／百萬人', en: 'per million people' },
  format: perMillion,
});

/** 各國的「喝一杯」場所類型（第二十一批 367；pipeline/topics/dining.py 的 _drink_types） */
const DRINK_TYPES: CategoryDef[] = [
  { value: 1, label: { zh: '酒吧（bar）為主', en: 'Mostly bars' } },
  { value: 2, label: { zh: '酒館（pub）為主', en: 'Mostly pubs' } },
  { value: 3, label: { zh: '啤酒花園', en: 'Beer gardens' } },
  { value: 4, label: { zh: '喝酒的店很少', en: 'Few drinking places' } },
];

export const dining: TopicDefinition = {
  id: 'dining',
  title: { zh: '外食與喝一杯：餐廳、咖啡館、酒吧有多密', en: 'Eating and drinking out: restaurants, cafés and bars' },
  shortTitle: { zh: '外食與喝一杯', en: 'Eating out' },
  defaultIndicator: 'eat-out',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: '經濟部商業發展署：商業登記（依營業項目別）－飲料店業（台灣的官方對照）',
        en: 'Administration of Commerce, Ministry of Economic Affairs (Taiwan): business registrations, beverage shops (official comparison for Taiwan)',
      },
      url: 'https://data.gov.tw/dataset/32685',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
    {
      name: { zh: 'OpenStreetMap 貢獻者（經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL',
    },
    {
      name: { zh: 'UN World Population Prospects 2024（2026 年的推估人口）', en: 'UN World Population Prospects 2024 (2026 population projection)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '英文維基百科「List of Michelin 3-star restaurants」（revid 1377608286，2026-09-30；米其林三星）',
        en: 'English Wikipedia, “List of Michelin 3-star restaurants” (revision 1377608286, 30 September 2026; Michelin three stars)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_Michelin_3-star_restaurants&oldid=1377608286',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（米其林三星餐廳與城市的位置）', en: 'Wikidata (locations of three-star restaurants and their cities)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'ILOSTAT：依行業的就業人數（判斷 OSM 的完整度）', en: 'ILOSTAT: employment by economic activity (to judge OSM completeness)' },
      url: 'https://ilostat.ilo.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '加拿大統計局 表 14-10-0023-01（加拿大的餐飲業就業人數）', en: 'Statistics Canada, Table 14-10-0023-01 (Canadian food-service employment)' },
      url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410002301',
      license: { zh: '加拿大開放政府授權', en: 'Open Government Licence – Canada' },
    },
    {
      name: { zh: '行政院主計總處 人力資源調查（台灣的住宿及餐飲業就業人數）', en: 'DGBAS Manpower Survey (Taiwan’s food-service employment)' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=100&funid=dgbasall',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: withTerritories({
    zh: '店數是 OpenStreetMap 上標成餐廳（restaurant）、速食（fast_food）、咖啡館（cafe）、酒吧（bar）、酒館（pub）、冰淇淋店（ice_cream）的地點（2026-11-06 加手搖飲、茶館、茶葉行、咖啡豆行），2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方的店家普查；只算固定店面，夜市與攤販不算。OSM 是志願者畫的，各國畫得完不完整差很多：印度、奈及利亞每十萬人只有個位數，不是現實。所以只替 OSM 覆蓋良好的國家上色：OSM 上的餐飲店除以那一國住宿及餐飲業的就業人數（ILO、加拿大統計局、主計總處），每千名就業者 20 家以上才畫（一家店大約對 10–20 名就業者），其他國家滑過去看原因。覆蓋良好的國家之間也還有差別，只能看大概。餐廳與速食的界線各國的繪圖者判斷不一，所以預設看兩者合計；酒吧（bar）與酒館（pub）是文化性的標籤（日本的居酒屋常標成 pub），合在一起算。人口不到 10 萬的地方不畫。',
    en: 'Counts are places tagged on OpenStreetMap as restaurant, fast_food, cafe, bar, pub or ice_cream (plus bubble tea, tea houses, tea shops and coffee bean shops since 6 November 2026), as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0), not an official business census; only fixed premises count, not night markets or street stalls. OpenStreetMap is mapped by volunteers and completeness varies a lot: India and Nigeria show single-digit figures per 100,000, which is not reality. So only countries where OSM is reasonably complete are coloured: OSM food and drink places divided by employment in accommodation and food services (ILO, Statistics Canada, DGBAS) must be at least 20 per 1,000 workers (a place typically has 10–20 workers); hover over other countries for the reason. Even among those countries completeness differs, so treat comparisons as approximate. Mappers draw the line between restaurants and fast food differently, so the default combines both; bar and pub are culturally loaded tags (Japanese izakaya are often tagged as pubs), so they are combined too. Places with fewer than 100,000 people are not shown.',
  }),
  indicators: [
    indicator(
      'eat-out',
      { zh: '餐廳與速食店', en: 'Restaurants and fast food' },
      {
        zh: '每十萬人有幾家餐廳加速食店（OpenStreetMap）。觀光客多的阿魯巴 424.4 家、庫拉索 307.9 家最多，其次是奧地利 276.8；瑞士、馬爾他、盧森堡、蒙特內哥羅、希臘、葡萄牙都超過 200；台灣 185.8 家（餐廳 38,058、速食 4,696），比法國 188.9 略少、比德國 175.6、南韓 160.8、義大利 156.3 多；英國 119.1、美國 111.5、日本 110.1。只畫 OSM 覆蓋良好的 96 個國家或地區。',
        en: 'Restaurants plus fast-food outlets per 100,000 people (OpenStreetMap). Aruba (424.4) and Curaçao (307.9), islands with many tourists, lead, followed by Austria 276.8; Switzerland, Malta, Luxembourg, Montenegro, Greece and Portugal all exceed 200; Taiwan has 185.8 (38,058 restaurants and 4,696 fast-food outlets), slightly below France 188.9 and above Germany 175.6, South Korea 160.8 and Italy 156.3; the UK 119.1, the US 111.5 and Japan 110.1. Only the 96 countries and territories where OSM is reasonably complete are shown.',
      },
      [25, 50, 100, 150, 200],
    ),
    indicator(
      'restaurants',
      { zh: '餐廳', en: 'Restaurants' },
      {
        zh: '每十萬人有幾家餐廳（不含速食）。觀光客多的阿魯巴 337.5、庫拉索 271.8 最多，其次是奧地利 229.5、瑞士 205.7、盧森堡 194.2；台灣 165.4 家（38,058 家）、南韓 151.9，日本 90.0、美國 64.9、英國 53.3：英美的外食多半在速食店與酒館。',
        en: 'Restaurants (excluding fast food) per 100,000 people. Aruba (337.5) and Curaçao (271.8), islands with many tourists, lead, followed by Austria 229.5, Switzerland 205.7 and Luxembourg 194.2; Taiwan has 165.4 (38,058 restaurants) and South Korea 151.9, while Japan has 90.0, the US 64.9 and the UK 53.3, where much eating out happens in fast-food outlets and pubs.',
      },
      [20, 50, 100, 150, 200],
    ),
    indicator(
      'fast-food',
      { zh: '速食店', en: 'Fast food' },
      {
        zh: '每十萬人有幾家速食店（OpenStreetMap 的 fast_food，含漢堡、披薩外帶、烤肉串等）。丹麥 103.1 最多，阿魯巴 86.9、冰島 84.3、紐西蘭 73.2、英國 65.8，加拿大 56.9、德國 52.8、美國 46.6；台灣 20.4、日本 20.1、南韓 8.9。',
        en: 'Fast-food outlets per 100,000 people (OpenStreetMap’s fast_food, including burgers, takeaway pizza, kebabs and so on). Denmark leads with 103.1, followed by Aruba 86.9, Iceland 84.3, New Zealand 73.2 and the UK 65.8; Canada 56.9, Germany 52.8 and the US 46.6; Taiwan 20.4, Japan 20.1 and South Korea 8.9.',
      },
      [5, 10, 20, 40, 60],
    ),
    indicator(
      'cafes',
      { zh: '咖啡館', en: 'Cafés' },
      {
        zh: '每十萬人有幾家咖啡館。地中海一帶最多：葡萄牙 138.5、克羅埃西亞 137.4、蒙特內哥羅 126.9、希臘 124.2；台灣 31.7、南韓 25.9、日本 23.6。美國只有 15.0、丹麥卻是 61.0：各國對 cafe 與 fast_food、restaurant 的標法不同，咖啡連鎖店有時標成速食。',
        en: 'Cafés per 100,000 people. The Mediterranean leads: Portugal 138.5, Croatia 137.4, Montenegro 126.9 and Greece 124.2; Taiwan 31.7, South Korea 25.9 and Japan 23.6. The US has only 15.0 against Denmark’s 61.0: tagging of cafe versus fast_food or restaurant differs by country, and coffee chains are sometimes tagged as fast food.',
      },
      [5, 10, 25, 50, 100],
    ),
    indicator(
      'bars',
      { zh: '酒吧與酒館', en: 'Bars and pubs' },
      {
        zh: '每十萬人有幾家酒吧（bar）加酒館（pub）。愛爾蘭 98.2、西班牙 87.2、斯洛伐克 80.6、捷克 66.3、英國 65.7 多；日本 30.1（居酒屋常標成 pub）；台灣只有 2.2 家、南韓 8.5、美國 11.1：台灣喝酒多半在餐廳與熱炒店，不是獨立的酒吧。伊斯蘭國家幾乎沒有。',
        en: 'Bars plus pubs per 100,000 people. Ireland 98.2, Spain 87.2, Slovakia 80.6, Czechia 66.3 and the UK 65.7 are high; Japan has 30.1 (izakaya are often tagged as pubs); Taiwan only 2.2, South Korea 8.5 and the US 11.1: in Taiwan drinking mostly happens in restaurants and stir-fry joints rather than stand-alone bars. Muslim-majority countries have almost none.',
      },
      [2, 5, 10, 25, 50],
    ),
    indicator(
      'ice-cream',
      { zh: '冰淇淋店', en: 'Ice-cream shops' },
      {
        zh: '每十萬人有幾家冰淇淋店。冰島 11.2、斯洛伐克 11.1、義大利 10.4（gelato）、克羅埃西亞 9.2、阿魯巴 9.2、丹麥 8.7 最多；美國 3.6、台灣 2.0、南韓 1.2、日本 0.8。',
        en: 'Ice-cream shops per 100,000 people. Iceland 11.2, Slovakia 11.1, Italy 10.4 (gelato), Croatia 9.2, Aruba 9.2 and Denmark 8.7 lead; the US 3.6, Taiwan 2.0, South Korea 1.2 and Japan 0.8.',
      },
      [0.5, 1, 2, 4, 8],
    ),
    indicator(
      'nightclubs',
      { zh: '夜店', en: 'Nightclubs' },
      {
        zh: '每十萬人有幾家夜店（OpenStreetMap 的 nightclub；有些國家把 live house、KTV 也標進去，對應很鬆）。賽普勒斯 5.9、蒙特內哥羅 4.8、克羅埃西亞 4.3 多；美國 0.5、日本 0.4、台灣、南韓 0.2。',
        en: 'Nightclubs per 100,000 people (OpenStreetMap’s nightclub; some countries also tag live houses or karaoke, so the match to nightlife is loose). Cyprus 5.9, Montenegro 4.8 and Croatia 4.3 are high; the US 0.5, Japan 0.4, Taiwan and South Korea 0.2.',
      },
      [0.25, 0.5, 1, 2, 3],
    ),
    // 第二十七批 665（2026-11-08）：卡拉OK包廂
    indicatorPerMillion(
      'karaoke-per',
      { zh: '卡拉OK包廂', en: 'Karaoke boxes' },
      {
        zh: '每百萬人有幾家包廂式卡拉OK（OpenStreetMap 的 amenity=karaoke_box），點是每一家。全球 2,886 處、65 個國家或地區：日本 1,494、南韓 320、中國 243、印尼 130、美國 98、台灣 89、越南 88 最多。每百萬人日本 12.1、南韓 6.2、不丹 5.1、台灣 3.8、蒙古 2.6；法國 0.5、美國 0.3、英國 0.1。幾乎只有東亞與東南亞上色。歐美的卡拉OK酒吧多半標成酒吧加 karaoke=yes、台灣很多 KTV 標成夜店，都不在這裡，所以歐美與台灣都低估。',
        en: 'Box-style karaoke venues per million people (OpenStreetMap’s amenity=karaoke_box); dots show each one. There are 2,886 in 65 countries and territories, led by Japan (1,494), South Korea (320), China (243), Indonesia (130), the US (98), Taiwan (89) and Vietnam (88). Per million people: Japan 12.1, South Korea 6.2, Bhutan 5.1, Taiwan 3.8 and Mongolia 2.6; France 0.5, the US 0.3 and the UK 0.1. Almost only East and Southeast Asia is shaded. Karaoke bars in Europe and America are usually tagged as bars with karaoke=yes, and many KTVs in Taiwan as nightclubs, so neither is counted here and both are undercounted.',
      },
      [0.1, 0.5, 1, 2, 5],
    ),
    {
      id: 'karaoke',
      label: { zh: '卡拉OK包廂的家數', en: 'Karaoke boxes (count)' },
      description: {
        zh: 'OpenStreetMap 上包廂式卡拉OK的家數（比例圓，不看 OSM 覆蓋）：日本 1,494、南韓 320、中國 243、印尼 130、美國 98、台灣 89、越南 88、菲律賓 59、馬來西亞 35、法國 34。',
        en: 'Number of box-style karaoke venues in OpenStreetMap (bubbles, regardless of OSM coverage): Japan 1,494, South Korea 320, China 243, Indonesia 130, the US 98, Taiwan 89, Vietnam 88, the Philippines 59, Malaysia 35 and France 34.',
      },
      unit: { zh: '家', en: 'venues' },
      file: 'karaoke.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    // 第二十四批 414（2026-11-06）：不賣酒的飲料店依「賣什麼」分，每百萬人
    indicatorPerMillion(
      'bubble-tea',
      { zh: '手搖飲店', en: 'Bubble tea shops' },
      {
        zh: '每百萬人有幾家手搖飲店（OpenStreetMap 的 cuisine=bubble_tea）。台灣 104.1 家（2,395 家）世界第一，是第二名新加坡 33.5 的三倍，汶萊 31.9、阿魯巴 27.7、加拿大 19.1、紐西蘭 15.5、澳洲 14.7；美國 7.3、南韓 3.3、日本 0.7。台灣第一同時反映台灣真的多，跟台灣的 OSM 志願者愛標手搖飲。中國實際上有十幾萬家，但 OSM 上標的很少，也不在覆蓋良好的名單裡，沒有上色。有些手搖飲同時標成咖啡館，跟「咖啡館」會重複算。台灣的官方對照：經濟部商業登記的「飲料店業」核准設立 48,779 家（只含獨資、合夥商號、不含公司，所有飲料店都算），OSM 標到的只是一部分，滑過台灣看縣市。',
        en: 'Bubble tea shops per million people (OpenStreetMap’s cuisine=bubble_tea). Taiwan leads with 104.1 (2,395 shops), three times second-placed Singapore at 33.5, followed by Brunei 31.9, Aruba 27.7, Canada 19.1, New Zealand 15.5 and Australia 14.7; the US 7.3, South Korea 3.3 and Japan 0.7. Taiwan’s lead reflects both how many shops there are and how keen Taiwan’s OSM volunteers are to map them. China has well over a hundred thousand in reality but few are mapped, and it is not among the well-covered countries, so it is not shaded. Some shops are also tagged as cafés and so counted under Cafés as well. For an official comparison, Taiwan’s business registry lists 48,779 beverage shops in operation (sole proprietorships and partnerships only, not companies, and all kinds of beverage shop), so OSM captures only part of them; hover over Taiwan for the largest municipalities.',
      },
      [1, 2, 5, 10, 20],
    ),
    indicatorPerMillion(
      'tea-houses',
      { zh: '茶館', en: 'Tea houses' },
      {
        zh: '每百萬人有幾家坐下來喝茶的茶館（OpenStreetMap 的 cuisine=tea）。法國 3.3、斯洛伐克 2.2、汶萊 2.1、捷克 1.9、台灣 1.8（42 家）；美國 0.7、日本 0.5。數量都很少，只能看大概。',
        en: 'Sit-down tea houses per million people (OpenStreetMap’s cuisine=tea). France 3.3, Slovakia 2.2, Brunei 2.1, Czechia 1.9 and Taiwan 1.8 (42); the US 0.7 and Japan 0.5. Numbers are small, so treat them as approximate.',
      },
      [0.25, 0.5, 1, 1.5, 2.5],
    ),
    indicatorPerMillion(
      'tea-shops',
      { zh: '茶葉行', en: 'Tea shops' },
      {
        zh: '每百萬人有幾家賣茶葉的店（OpenStreetMap 的 shop=tea）。台灣 19.3 家（444 家）最多，科威特 17.0、德國 9.9、瑞士 9.5、法國與奧地利 9.4；日本 7.4、美國 2.1。',
        en: 'Shops selling tea leaves per million people (OpenStreetMap’s shop=tea). Taiwan leads with 19.3 (444 shops), then Kuwait 17.0, Germany 9.9, Switzerland 9.5, and France and Austria 9.4; Japan 7.4 and the US 2.1.',
      },
      [1, 2, 5, 8, 12],
    ),
    indicatorPerMillion(
      'coffee-shops',
      { zh: '咖啡豆與器材行', en: 'Coffee bean shops' },
      {
        zh: '每百萬人有幾家賣咖啡豆與咖啡器材的店（OpenStreetMap 的 shop=coffee，不是坐下來喝的咖啡館）。阿爾巴尼亞 49.8、希臘 26.4、科威特 25.7、阿曼 21.2、賽普勒斯 21.0、奧地利 19.2 多；台灣 7.9（181 家）、美國 5.1、日本 4.8。',
        en: 'Shops selling coffee beans and equipment per million people (OpenStreetMap’s shop=coffee, not sit-down cafés). Albania 49.8, Greece 26.4, Kuwait 25.7, Oman 21.2, Cyprus 21.0 and Austria 19.2 are high; Taiwan 7.9 (181 shops), the US 5.1 and Japan 4.8.',
      },
      [2, 5, 10, 15, 20],
    ),
    {
      id: 'drink-type',
      label: { zh: '在哪裡喝一杯', en: 'Where people go for a drink' },
      description: {
        zh: '依 OpenStreetMap 上每十萬人的酒吧（bar）、酒館（pub）、啤酒花園（biergarten）分類：三者合計不到 10 家算「喝酒的店很少」；啤酒花園占一成五以上的只有德國；其他看酒館與酒吧哪個多。酒館為主的有英國、愛爾蘭、捷克、比利時、匈牙利、荷蘭、瑞典、挪威、芬蘭與日本（居酒屋常標成 pub）；南歐、法國、瑞士、奧地利、美國是酒吧為主；台灣、南韓、新加坡、以色列與伊斯蘭國家是喝酒的店很少（台灣喝酒多在餐廳、熱炒店）。這是 OSM 標籤的文化分布，不是設施普查：啤酒花園幾乎只有德語區在用這個標籤。只畫 OSM 覆蓋良好的國家。',
        en: 'Classified from OpenStreetMap bars, pubs and beer gardens per 100,000 people: under 10 in total counts as “few drinking places”; beer gardens at 15% or more of the three applies only to Germany; otherwise whichever of pubs or bars is more common. Pubs dominate in the UK, Ireland, Czechia, Belgium, Hungary, the Netherlands, Sweden, Norway, Finland and Japan (izakaya are often tagged as pubs); bars in southern Europe, France, Switzerland, Austria and the US; few drinking places in Taiwan, South Korea, Singapore, Israel and Muslim-majority countries (in Taiwan people mostly drink in restaurants). This reflects how OSM tags are used, not a census of venues: the beer-garden tag is used almost only in German-speaking countries. Only countries where OSM is reasonably complete are shown.',
      },
      unit: '',
      file: 'drink-type.json',
      layer: { kind: 'categorical', categories: DRINK_TYPES },
      format: (v) => tr(DRINK_TYPES.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
    },
    {
      id: 'michelin-3',
      label: { zh: '米其林三星餐廳', en: 'Michelin three-star restaurants' },
      description: {
        zh: `米其林三星餐廳的家數（英文維基百科的清單，2025 年版指南，共 161 家）。法國 30 家最多（加上摩納哥 1 家），日本 20、西班牙與美國 16、義大利 14、德國 12、英國 10、香港 7、中國 4、瑞士 4，台灣 3 家（JL Studio、頤宮、態芮），跟新加坡、丹麥一樣多。點是餐廳（沒有自己位置的畫在城市，157 個點裡 92 個）；另有 4 家在英文維基沒有條目、清單也沒連到城市，算在家數裡、沒畫。${MICHELIN_NOTE.zh}`,
        en: `Number of Michelin three-star restaurants (English Wikipedia’s list, 2025 guides, 161 in total). France has the most at 30 (plus 1 in Monaco), followed by Japan 20, Spain and the US 16, Italy 14, Germany 12, the UK 10, Hong Kong 7, China 4 and Switzerland 4; Taiwan has 3 (JL Studio, Le Palais and Taïrroir), as many as Singapore and Denmark. Dots are the restaurants (those without their own location are placed at their city: 92 of the 157 dots); another 4 have no English Wikipedia article and no linked city, so they are counted but not drawn. ${MICHELIN_NOTE.en}`,
      },
      unit: { zh: '家', en: 'restaurants' },
      file: 'michelin-3.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 30] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: fixed(v, 0) }),
      integer: true,
    },
    {
      id: 'michelin-3-per-10m',
      label: { zh: '每千萬人的米其林三星', en: 'Michelin three stars per 10 million people' },
      description: {
        zh: `米其林三星餐廳除以人口，每千萬人。摩納哥（1 家、人口不到 4 萬）與澳門、香港這類城市特別高；國家裡法國 4.5、西班牙 3.3、義大利 2.4、日本 1.6、德國與英國 1.4、台灣 1.3、美國 0.5、南韓 0.2、中國 0.03。${MICHELIN_NOTE.zh}`,
        en: `Michelin three-star restaurants per 10 million people. Monaco (1 restaurant, under 40,000 people), Macau and Hong Kong are extreme because they are cities; among countries France has 4.5, Spain 3.3, Italy 2.4, Japan 1.6, Germany and the UK 1.4, Taiwan 1.3, the US 0.5, South Korea 0.2 and China 0.03. ${MICHELIN_NOTE.en}`,
      },
      unit: { zh: '家／千萬人', en: 'per 10 million' },
      file: 'michelin-3-per-10m.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8] } },
      format: (v) => tr({ zh: `每千萬人 ${fixed(v, 2)} 家`, en: `${fixed(v, 2)} per 10 million` }),
      formatTick: (v) => `${v}`,
    },
  ],
  overlays: [MICHELIN, KARAOKE],
};
