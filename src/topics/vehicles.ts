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
      name: { zh: 'Eurostat：依車齡的小客車數（road_eqs_carage，歐洲 2013–2025 年）', en: 'Eurostat: passenger cars by age (road_eqs_carage, Europe 2013–2025)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/road_eqs_carage/default/table',
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
        zh: '主計總處 家庭收支調查：家庭主要設備普及率（有家用汽車、機車的家庭，台灣的附註）',
        en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure: household equipment (households with a car or motorcycle, in Taiwan’s note)',
      },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908&sms=11530',
      license: { zh: '主計總處政府網站資料開放宣告（政府資料開放授權條款）', en: 'DGBAS open data declaration (Open Government Data License)' },
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
  // 小客車的車齡（2026-11-05，製作手冊第二十三批 403）：側欄列五組車齡
  panelExtra: () => import('./panels/CarAgePanel'),
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
    {
      id: 'car-age-20',
      label: { zh: '車齡超過 20 年的小客車（歐洲）', en: 'Passenger cars over 20 years old (Europe)' },
      description: {
        zh: '小客車裡車齡超過 20 年的占幾成（Eurostat，2013 年起，歐洲 30 國）。喬治亞 49.4%（2025 年）、阿爾巴尼亞 43.2%（2024 年）、羅馬尼亞 39.1%、芬蘭 36.3%、塞爾維亞 35.3%、波蘭 35.1%（2024 年）、愛沙尼亞 34.7% 最多，東歐很多是從西歐進口的二手車；盧森堡 6.9%、丹麥 8.0%、列支敦斯登 8.9%、比利時、荷蘭、挪威各 9.0% 最少，德國 10.7%。側欄列五組車齡。Eurostat 沒有平均車齡；台灣沒有車齡的開放資料；英國與科索沃照 Eurostat 的授權不收。',
        en: 'Share of passenger cars more than 20 years old (Eurostat, from 2013, 30 European countries). Georgia 49.4% (2025), Albania 43.2% (2024), Romania 39.1%, Finland 36.3%, Serbia 35.3%, Poland 35.1% (2024) and Estonia 34.7% are the highest, many in Eastern Europe being used imports from the West; Luxembourg 6.9%, Denmark 8.0%, Liechtenstein 8.9% and Belgium, the Netherlands and Norway at 9.0% are the lowest, with Germany at 10.7%. The side panel lists all five age bands. Eurostat gives no average age; Taiwan publishes no open data on car age; the UK and Kosovo are left out under Eurostat’s licence.',
      },
      unit: '%',
      file: 'car-age-20.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 40] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'car-age-new',
      label: { zh: '未滿 2 年的新車（歐洲）', en: 'Passenger cars under 2 years old (Europe)' },
      description: {
        zh: '小客車裡車齡未滿 2 年的占幾成，看車隊換新得多快（Eurostat，2013 年起，歐洲 30 國）。2025 年盧森堡 19.8%（很多是公司車）、土耳其 16.9%、德國 15.5%、比利時 14.9%、挪威 14.7%、奧地利 13.5%、瑞典 13.2% 最高；阿爾巴尼亞 1.5%（2024 年）、喬治亞 1.8%、塞爾維亞 2.1%、波士尼亞與蒙特內哥羅各 2.6% 最低，跟車齡超過 20 年的比例剛好相反。',
        en: 'Share of passenger cars under 2 years old, a gauge of how fast the fleet is renewed (Eurostat, from 2013, 30 European countries). In 2025 Luxembourg 19.8% (many company cars), Türkiye 16.9%, Germany 15.5%, Belgium 14.9%, Norway 14.7%, Austria 13.5% and Sweden 13.2% are the highest; Albania 1.5% (2024), Georgia 1.8%, Serbia 2.1% and Bosnia and Montenegro at 2.6% are the lowest, the mirror image of the share over 20 years old.',
      },
      unit: '%',
      file: 'car-age-new.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 15] } },
      format: pct,
      formatTick: pctTick,
    },
  ],
};
