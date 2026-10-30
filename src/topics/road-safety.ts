import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 交通安全（pipeline/topics/road_safety.py）：WHO 的道路交通死亡率與各國通報的死亡組成；
 * 台灣不在 WHO 的資料裡，用交通部的 30 日內死亡人數（跟 WHO 同樣是 30 天定義）。
 */

const n0 = (v: number) => fixed(v, 0);
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;

const WHO_LICENSE = 'CC BY 4.0';
const GSRRS_LICENSE = 'CC BY-NC-SA 3.0 IGO';

export const roadSafety: TopicDefinition = {
  id: 'road-safety',
  title: { zh: '交通安全', en: 'Road safety' },
  shortTitle: { zh: '交通安全', en: 'Road safety' },
  defaultIndicator: 'rate',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'WHO Global Health Observatory：道路交通死亡率估計值（RS_198）、2016 年的死亡組成與登記車輛數（RS_246、RS_194）',
        en: 'WHO Global Health Observatory: estimated road traffic death rates (RS_198); 2016 deaths by road user and registered vehicles (RS_246, RS_194)',
      },
      url: 'https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/road-safety',
      license: WHO_LICENSE,
    },
    {
      name: {
        zh: 'WHO《Global status report on road safety 2023》各國指標（2021 年的死亡組成、登記車輛數與機車數）',
        en: 'WHO, Global status report on road safety 2023, country indicators (2021 deaths by road user, registered vehicles and motorcycles)',
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
        zh: '交通部統計查詢網：道路交通事故（30 日內）按駕乘車種分、機動車輛登記數（台灣）',
        en: 'MOTC statistics database: road traffic deaths within 30 days by mode, registered motor vehicles (Taiwan)',
      },
      url: 'https://statis.motc.gov.tw/motc/Statistics/Display?Seq=127',
      license: { zh: '交通部政府網站資料開放宣告（政府資料開放授權條款）', en: 'MOTC open data declaration (Open Government Data License)' },
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（死亡人數與台灣死亡率的人口）',
        en: 'United Nations, World Population Prospects 2024 (population for death counts and Taiwan’s rate)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '死亡率是 WHO 的估計值，用 30 天的定義（事故後 30 天內死亡），各國可以比較；死亡人數是 WHO 的死亡率乘上聯合國的人口。行人、機車騎士占比與登記車輛數是各國向 WHO 通報的資料（2016、2021 年前後兩輪調查），通報不完整的國家可能有偏差。台灣不在 WHO 的資料裡，用交通部的 30 日內死亡人數；警察機關常見的 A1 類事故只算 24 小時內死亡，數字少很多，不能拿來跟其他國家比。2021 年的死亡組成與登記車輛數取自《Global status report on road safety 2023》（WHO，CC BY-NC-SA 3.0 IGO），行人與機車騎士占比、每萬輛機動車死亡數、每千人機車數與機車比例、每千人汽車數的資料檔也依 CC BY-NC-SA 3.0 IGO 分享。',
    en: 'Death rates are WHO estimates using the 30-day definition (death within 30 days of the crash), so countries can be compared; death counts are the WHO rate times the UN population. Pedestrian and motorcyclist shares and registered vehicles are figures countries reported to WHO (two survey rounds, around 2016 and 2021) and may be biased where reporting is incomplete. Taiwan is not in the WHO data and uses Ministry of Transportation and Communications deaths within 30 days; the police A1 figures often quoted count only deaths within 24 hours, which are much lower and not comparable. The 2021 road-user and vehicle data come from the WHO Global status report on road safety 2023 (CC BY-NC-SA 3.0 IGO), and the pedestrian, motorcyclist, per-vehicle, motorcycle and car data files are shared under CC BY-NC-SA 3.0 IGO as well.',
  },
  panelExtra: () => import('./panels/RoadSafetyPanel'),
  indicators: [
    {
      id: 'rate',
      label: { zh: '道路交通死亡率', en: 'Road death rate' },
      description: {
        zh: '每 10 萬人有幾人死於道路交通事故（事故後 30 天內死亡），WHO 的估計值。台灣是交通部的 30 日內死亡人數。',
        en: 'Road traffic deaths per 100,000 people (death within 30 days of the crash), WHO estimates. Taiwan uses Ministry of Transportation and Communications deaths within 30 days.',
      },
      unit: { zh: '每 10 萬人', en: 'per 100,000' },
      file: 'rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 6, 10, 15, 20, 25] } },
      format: (v) => tr({ zh: `每 10 萬人 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: n0,
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'deaths',
      label: { zh: '道路交通死亡人數', en: 'Road deaths' },
      description: {
        zh: '一年死於道路交通事故的人數（事故後 30 天內死亡）：WHO 的死亡率乘上聯合國的年中人口。圓的面積與人數成正比。',
        en: 'Road traffic deaths in a year (within 30 days of the crash): the WHO rate times the UN mid-year population. Circle area is proportional to deaths.',
      },
      unit: { zh: '人', en: 'deaths' },
      file: 'deaths.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} deaths` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'pedestrians',
      label: { zh: '行人死亡占比', en: 'Pedestrian share' },
      description: {
        zh: '道路交通死亡者裡行人的比例，各國向 WHO 通報的數字（2016、2021 年前後兩輪調查，地圖用 5 年內最近一次）。台灣是交通部的 30 日內死亡人數。',
        en: 'Share of road deaths who were pedestrians, as reported by countries to WHO (survey rounds around 2016 and 2021; the map uses the latest within 5 years). Taiwan uses Ministry of Transportation and Communications deaths within 30 days.',
      },
      unit: '%',
      file: 'pedestrians.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 40] } },
      format: (v) => tr({ zh: `行人占 ${pct(v)}`, en: `${pct(v)} pedestrians` }),
      formatTick: pctTick,
    },
    {
      id: 'motorcyclists',
      label: { zh: '機車騎士死亡占比', en: 'Motorcyclist share' },
      description: {
        zh: '道路交通死亡者裡騎乘二輪、三輪機動車（機車）的比例，各國向 WHO 通報的數字。東南亞、台灣大多超過一半。台灣的機車只算騎士，乘客另外一類。',
        en: 'Share of road deaths who were riding powered two- or three-wheelers (motorcycles), as reported by countries to WHO. In Southeast Asia and Taiwan it is mostly over half. Taiwan’s figure counts riders only; passengers form a separate group.',
      },
      unit: '%',
      file: 'motorcyclists.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 65] } },
      format: (v) => tr({ zh: `機車騎士占 ${pct(v)}`, en: `${pct(v)} motorcyclists` }),
      formatTick: pctTick,
    },
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
    {
      id: 'per-vehicles',
      label: { zh: '每萬輛機動車死亡數', en: 'Deaths per 10,000 vehicles' },
      description: {
        zh: 'WHO 估計的死亡人數 ÷ 各國通報的登記機動車輛數（含機車）× 1 萬。車輛少的國家數字很高；台灣是交通部的 30 日內死亡人數 ÷ 年底登記的機動車輛數。',
        en: 'WHO-estimated deaths ÷ registered motor vehicles (including motorcycles) reported by each country × 10,000. Countries with few vehicles score very high. Taiwan: 30-day deaths ÷ registered motor vehicles at year end.',
      },
      unit: { zh: '每萬輛', en: 'per 10,000 vehicles' },
      file: 'per-vehicles.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 30] } },
      format: (v) => tr({ zh: `每萬輛 ${fixed(v, v < 10 ? 2 : 0)} 人`, en: `${fixed(v, v < 10 ? 2 : 0)} per 10,000 vehicles` }),
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      lowerIsBetter: true,
    },
  ],
};
