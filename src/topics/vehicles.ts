import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 汽機車（2026-10-30，製作手冊第十一批 186：從「交通安全」拆出來）：每千人機車數、機車占機動車輛的比例、每千人汽車數
 * （各國向 WHO 通報的登記車輛數）與歐洲的每千人小客車數（Eurostat），台灣用交通部的登記數。
 * 資料沒有搬，還在 public/data/topics/road-safety/（dataTopic，pipeline/topics/road_safety.py）。
 */

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;

const GSRRS_LICENSE = 'CC BY-NC-SA 3.0 IGO';

export const vehicles: TopicDefinition = {
  id: 'vehicles',
  dataTopic: 'road-safety',
  title: { zh: '汽機車', en: 'Cars and motorcycles' },
  shortTitle: { zh: '汽機車', en: 'Vehicles' },
  defaultIndicator: 'motorcycles-per-1000',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'WHO《Global status report on road safety 2023》各國指標（登記車輛數與機車數）',
        en: 'WHO, Global status report on road safety 2023, country indicators (registered vehicles and motorcycles)',
      },
      url: 'https://www.who.int/teams/social-determinants-of-health/safety-and-mobility/global-status-report-on-road-safety-2023',
      license: GSRRS_LICENSE,
    },
    {
      name: {
        zh: 'Eurostat：每千人小客車數（road_eqs_carhab，歐洲 1990–2025 年）',
        en: 'Eurostat: passenger cars per thousand inhabitants (road_eqs_carhab, Europe 1990–2025)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carhab/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '交通部統計查詢網：機動車輛登記數（台灣）',
        en: 'MOTC statistics database: registered motor vehicles (Taiwan)',
      },
      url: 'https://statis.motc.gov.tw/motc/Statistics/Display?Seq=127',
      license: { zh: '交通部政府網站資料開放宣告（政府資料開放授權條款）', en: 'MOTC open data declaration (Open Government Data License)' },
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（每千人的人口）',
        en: 'United Nations, World Population Prospects 2024 (population for the per-1,000 figures)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '登記的機車、汽車數是各國 2020 或 2021 年向 WHO 通報的數字（《Global status report on road safety 2023》），通報不完整或單位填錯的國家可能有偏差，明顯填錯的沒有畫；歐洲的每千人小客車數是 Eurostat 的（定義不同，不能直接跟「每千人汽車數」比）。台灣用交通部的年底登記數。每千人機車數、機車比例與每千人汽車數的資料取自 WHO（CC BY-NC-SA 3.0 IGO），這幾個資料檔也依 CC BY-NC-SA 3.0 IGO 分享。機車騎士的死亡占比見「交通安全」主題。',
    en: 'Registered motorcycles and cars are figures countries reported to WHO for 2020 or 2021 (Global status report on road safety 2023) and may be biased where reporting is incomplete or units are wrong; clearly misreported figures are not shown. Passenger cars per 1,000 in Europe come from Eurostat (a different definition, not directly comparable with “Cars per 1,000 people”). Taiwan uses registrations at year end from the Ministry of Transportation and Communications. The motorcycle, motorcycle-share and car data come from WHO (CC BY-NC-SA 3.0 IGO), and those data files are shared under CC BY-NC-SA 3.0 IGO as well. For the share of road deaths who were motorcyclists, see the Road safety topic.',
  },
  indicators: [
    {
      id: 'motorcycles-per-1000',
      label: { zh: '每千人機車數', en: 'Motorcycles per 1,000 people' },
      description: {
        zh: '每 1,000 人有幾輛登記的機車（二、三輪機動車，含嘟嘟車這類三輪車），各國 2020 或 2021 年向 WHO 通報的數字 ÷ 聯合國的人口。越南 709、台灣 635（2025 年底，交通部）、印尼 439、泰國 305、斯里蘭卡 265；義大利 174、巴西 144、中國 56、德國 54、韓國 43、美國 25。日本、印度、馬來西亞沒有通報機車數。',
        en: 'Registered motorcycles (powered two- and three-wheelers, including auto-rickshaws) per 1,000 people, from figures countries reported to WHO for 2020 or 2021, divided by UN population. Viet Nam 709, Taiwan 635 (end of 2025, Ministry of Transportation and Communications), Indonesia 439, Thailand 305, Sri Lanka 265; Italy 174, Brazil 144, China 56, Germany 54, South Korea 43, the US 25. Japan, India and Malaysia did not report motorcycles.',
      },
      unit: { zh: '輛/千人', en: 'per 1,000 people' },
      file: 'motorcycles-per-1000.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 200, 400] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 0)} 輛`, en: `${fixed(v, 0)} per 1,000 people` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'motorcycle-share',
      label: { zh: '機車占機動車輛的比例', en: 'Motorcycle share of vehicles' },
      description: {
        zh: '登記的機動車輛裡機車（二、三輪機動車）的比例。越南 93%、馬爾地夫 87%、印尼與緬甸 83%、巴基斯坦與尼泊爾 79%；台灣 63%；巴西 27%、中國 20%、義大利 19%、韓國 8%、美國 3%。菲律賓、喬治亞、賽普勒斯、查德、南蘇丹通報的機車比車輛總數還多（單位填錯），沒有畫。',
        en: 'Motorcycles (powered two- and three-wheelers) as a share of registered motor vehicles. Viet Nam 93%, the Maldives 87%, Indonesia and Myanmar 83%, Pakistan and Nepal 79%; Taiwan 63%; Brazil 27%, China 20%, Italy 19%, South Korea 8%, the US 3%. The Philippines, Georgia, Cyprus, Chad and South Sudan reported more motorcycles than vehicles in total (a unit error) and are not shown.',
      },
      unit: '%',
      file: 'motorcycle-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
      format: (v) => tr({ zh: `機車占 ${pct(v)}`, en: `${pct(v)} motorcycles` }),
      formatTick: pctTick,
    },
    {
      id: 'cars-per-1000',
      label: { zh: '每千人汽車數', en: 'Cars per 1,000 people' },
      description: {
        zh: '每 1,000 人有幾輛登記的汽車（小客車與四輪輕型車，含皮卡、輕型貨車），各國 2020 或 2021 年向 WHO 通報的數字 ÷ 聯合國的人口。紐西蘭 792、美國 764、冰島 740、澳洲 704、盧森堡 687、波蘭 680、義大利 667；韓國 396、台灣 323（2025 年底，只算小客車）、中國 181、印度 31。美國的皮卡多，所以特別高。日本等國沒有通報；越南、菲律賓、查德與每千人不到 3 輛的國家（喬治亞、賽普勒斯、肯亞等）數字明顯填錯，沒有畫。',
        en: 'Registered cars (passenger cars and 4-wheeled light vehicles, including pickups and vans) per 1,000 people, from figures countries reported to WHO for 2020 or 2021, divided by UN population. New Zealand 792, the US 764, Iceland 740, Australia 704, Luxembourg 687, Poland 680, Italy 667; South Korea 396, Taiwan 323 (end of 2025, passenger cars only), China 181, India 31. Pickups make the US especially high. Some countries, such as Japan, did not report; figures from Viet Nam, the Philippines, Chad and countries under 3 per 1,000 (Georgia, Cyprus, Kenya and others) are clearly misreported and not shown.',
      },
      unit: { zh: '輛/千人', en: 'per 1,000 people' },
      file: 'cars-per-1000.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 200, 400, 600] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 0)} 輛`, en: `${fixed(v, 0)} per 1,000 people` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'passenger-cars',
      label: { zh: '每千人小客車數（歐洲）', en: 'Passenger cars per 1,000 (Europe)' },
      description: {
        zh: '歐洲各國每 1,000 人有幾輛小客車（Eurostat，1990 年起每年，不含輕型貨車），加上台灣（交通部表 101 的年底登記小客車數）。2025 年列支敦斯登 769、義大利 709、芬蘭 671、賽普勒斯 670、盧森堡 668、波蘭 639、德國 593；拉脫維亞 435、土耳其 203；台灣 323。波蘭 1990 年只有 138，東歐的汽車數這 30 年成長好幾倍。跟「每千人汽車數」的定義不同，不能直接比。',
        en: 'Passenger cars per 1,000 people in European countries (Eurostat, yearly since 1990, excluding light goods vehicles), plus Taiwan (passenger cars registered at year end, MOTC table 101). In 2025: Liechtenstein 769, Italy 709, Finland 671, Cyprus 670, Luxembourg 668, Poland 639, Germany 593; Latvia 435, Türkiye 203; Taiwan 323. Poland had only 138 in 1990; car ownership in Eastern Europe has multiplied over three decades. The definition differs from “Cars per 1,000 people”, so the two are not directly comparable.',
      },
      unit: { zh: '輛/千人', en: 'per 1,000 people' },
      file: 'passenger-cars.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 300, 400, 500, 600] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, 0)} 輛`, en: `${fixed(v, 0)} per 1,000 people` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
