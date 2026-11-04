import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

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

export const dining: TopicDefinition = {
  id: 'dining',
  title: { zh: '外食與喝一杯：餐廳、咖啡館、酒吧有多密', en: 'Eating and drinking out: restaurants, cafés and bars' },
  shortTitle: { zh: '外食與喝一杯', en: 'Eating out' },
  defaultIndicator: 'eat-out',
  defaultYear: 2026,
  timeless: true,
  sources: [
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
  note: {
    zh: '店數是 OpenStreetMap 上標成餐廳（restaurant）、速食（fast_food）、咖啡館（cafe）、酒吧（bar）、酒館（pub）、冰淇淋店（ice_cream）的地點，2026 年 11 月的快照（© OpenStreetMap contributors，資料檔依 ODbL 1.0 分享），不是官方的店家普查；只算固定店面，夜市與攤販不算。OSM 是志願者畫的，各國畫得完不完整差很多：印度、奈及利亞每十萬人只有個位數，不是現實。所以只替 OSM 覆蓋良好的國家上色：OSM 上的餐飲店除以那一國住宿及餐飲業的就業人數（ILO、加拿大統計局、主計總處），每千名就業者 20 家以上才畫（一家店大約對 10–20 名就業者），其他國家滑過去看原因。覆蓋良好的國家之間也還有差別，只能看大概。餐廳與速食的界線各國的繪圖者判斷不一，所以預設看兩者合計；酒吧（bar）與酒館（pub）是文化性的標籤（日本的居酒屋常標成 pub），合在一起算。人口不到 10 萬的地方不畫。',
    en: 'Counts are places tagged on OpenStreetMap as restaurant, fast_food, cafe, bar, pub or ice_cream, as of November 2026 (© OpenStreetMap contributors; the data files are shared under ODbL 1.0), not an official business census; only fixed premises count, not night markets or street stalls. OpenStreetMap is mapped by volunteers and completeness varies a lot: India and Nigeria show single-digit figures per 100,000, which is not reality. So only countries where OSM is reasonably complete are coloured: OSM food and drink places divided by employment in accommodation and food services (ILO, Statistics Canada, DGBAS) must be at least 20 per 1,000 workers (a place typically has 10–20 workers); hover over other countries for the reason. Even among those countries completeness differs, so treat comparisons as approximate. Mappers draw the line between restaurants and fast food differently, so the default combines both; bar and pub are culturally loaded tags (Japanese izakaya are often tagged as pubs), so they are combined too. Places with fewer than 100,000 people are not shown.',
  },
  indicators: [
    indicator(
      'eat-out',
      { zh: '餐廳與速食店', en: 'Restaurants and fast food' },
      {
        zh: '每十萬人有幾家餐廳加速食店（OpenStreetMap）。奧地利 276.8 家最多，瑞士、馬爾他、盧森堡、蒙特內哥羅、希臘、葡萄牙都超過 200；台灣 185.8 家（餐廳 38,058、速食 4,696），比法國 190.8 略少、比德國 175.6、南韓 160.8、義大利 156.3 多；英國 119.1、美國 112.5、日本 110.1。只畫 OSM 覆蓋良好的 93 國。',
        en: 'Restaurants plus fast-food outlets per 100,000 people (OpenStreetMap). Austria leads with 276.8, and Switzerland, Malta, Luxembourg, Montenegro, Greece and Portugal all exceed 200; Taiwan has 185.8 (38,058 restaurants and 4,696 fast-food outlets), slightly below France 190.8 and above Germany 175.6, South Korea 160.8 and Italy 156.3; the UK 119.1, the US 112.5 and Japan 110.1. Only the 93 countries where OSM is reasonably complete are shown.',
      },
      [25, 50, 100, 150, 200],
    ),
    indicator(
      'restaurants',
      { zh: '餐廳', en: 'Restaurants' },
      {
        zh: '每十萬人有幾家餐廳（不含速食）。奧地利 229.5、瑞士 205.7、盧森堡 194.2 最多，台灣 165.4 家（38,058 家）、南韓 151.9，日本 90.0、美國 65.5、英國 53.3：英美的外食多半在速食店與酒館。',
        en: 'Restaurants (excluding fast food) per 100,000 people. Austria 229.5, Switzerland 205.7 and Luxembourg 194.2 lead; Taiwan has 165.4 (38,058 restaurants) and South Korea 151.9, while Japan has 90.0, the US 65.5 and the UK 53.3, where much eating out happens in fast-food outlets and pubs.',
      },
      [20, 50, 100, 150, 200],
    ),
    indicator(
      'fast-food',
      { zh: '速食店', en: 'Fast food' },
      {
        zh: '每十萬人有幾家速食店（OpenStreetMap 的 fast_food，含漢堡、披薩外帶、烤肉串等）。丹麥 103.1 最多，冰島 84.3、紐西蘭 73.2、英國 65.8，加拿大 56.9、德國 52.8、美國 46.9；台灣 20.4、日本 20.1、南韓 8.9。',
        en: 'Fast-food outlets per 100,000 people (OpenStreetMap’s fast_food, including burgers, takeaway pizza, kebabs and so on). Denmark leads with 103.1, followed by Iceland 84.3, New Zealand 73.2 and the UK 65.8; Canada 56.9, Germany 52.8 and the US 46.9; Taiwan 20.4, Japan 20.1 and South Korea 8.9.',
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
        zh: '每十萬人有幾家酒吧（bar）加酒館（pub）。愛爾蘭 98.2、西班牙 87.2、斯洛伐克 80.6、捷克 66.3、英國 65.7 多；日本 30.1（居酒屋常標成 pub）；台灣只有 2.2 家、南韓 8.5、美國 11.2：台灣喝酒多半在餐廳與熱炒店，不是獨立的酒吧。伊斯蘭國家幾乎沒有。',
        en: 'Bars plus pubs per 100,000 people. Ireland 98.2, Spain 87.2, Slovakia 80.6, Czechia 66.3 and the UK 65.7 are high; Japan has 30.1 (izakaya are often tagged as pubs); Taiwan only 2.2, South Korea 8.5 and the US 11.2: in Taiwan drinking mostly happens in restaurants and stir-fry joints rather than stand-alone bars. Muslim-majority countries have almost none.',
      },
      [2, 5, 10, 25, 50],
    ),
    indicator(
      'ice-cream',
      { zh: '冰淇淋店', en: 'Ice-cream shops' },
      {
        zh: '每十萬人有幾家冰淇淋店。冰島 11.2、斯洛伐克 11.1、義大利 10.4（gelato）、克羅埃西亞 9.2、丹麥 8.7 最多；美國 3.7、台灣 2.0、南韓 1.2、日本 0.8。',
        en: 'Ice-cream shops per 100,000 people. Iceland 11.2, Slovakia 11.1, Italy 10.4 (gelato), Croatia 9.2 and Denmark 8.7 lead; the US 3.7, Taiwan 2.0, South Korea 1.2 and Japan 0.8.',
      },
      [0.5, 1, 2, 4, 8],
    ),
  ],
};
