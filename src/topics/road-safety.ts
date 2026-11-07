import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { roadInjuries } from './road-injuries';
import type { TopicDefinition } from './types';

/**
 * 交通安全（pipeline/topics/road_safety.py）：WHO 的道路交通死亡率與各國通報的死亡組成；
 * 台灣不在 WHO 的資料裡，用交通部的 30 日內死亡人數（跟 WHO 同樣是 30 天定義）。
 * 2026-10-30（第十一批 186）每千人機車數、機車比例、每千人汽車數、歐洲的每千人小客車數拆到「汽機車」（vehicles.ts），
 * 資料檔照舊在這個主題的資料夾。
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
      name: { zh: 'Eurostat：依道路類別的道路交通死亡（tran_sf_roadro）與車公里（road_tf_vehmov）', en: 'Eurostat: road deaths by type of road (tran_sf_roadro) and vehicle-km (road_tf_vehmov)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/tran_sf_roadro/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '交通部高速公路局《113 年國道事故檢討分析》（國道 30 日內死亡人數）', en: 'Freeway Bureau, MOTC (Taiwan), 2024 freeway accident review (deaths within 30 days)' },
      url: 'https://data.gov.tw/dataset/31028',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: {
        zh: 'WHO 資料平臺 data.who.int：道路交通死亡率估計值（RS_198）',
        en: 'WHO data platform (data.who.int): estimated road traffic death rates (RS_198)',
      },
      url: 'https://data.who.int/indicators/i/B9D9E6A/D6176E2',
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
    ...roadInjuries.sources,
  ],
  note: {
    zh: '死亡率是 WHO 的估計值，用 30 天的定義（事故後 30 天內死亡），各國可以比較；死亡人數是 WHO 的死亡率乘上聯合國的人口。行人、機車騎士占比與登記車輛數是各國向 WHO 通報的資料（2021 年前後；2016 年前後的那一輪只在 WHO GHO 資料庫，2026 年 11 月拿掉），通報不完整的國家可能有偏差。台灣不在 WHO 的資料裡，用交通部的 30 日內死亡人數；警察機關常見的 A1 類事故只算 24 小時內死亡，數字少很多，不能拿來跟其他國家比。2021 年的死亡組成與登記車輛數取自《Global status report on road safety 2023》（WHO，CC BY-NC-SA 3.0 IGO），行人與機車騎士占比、每萬輛機動車死亡數的資料檔也依 CC BY-NC-SA 3.0 IGO 分享。每千人機車數、汽車數見「汽機車與電動車」主題。',
    en: 'Death rates are WHO estimates using the 30-day definition (death within 30 days of the crash), so countries can be compared; death counts are the WHO rate times the UN population. Pedestrian and motorcyclist shares and registered vehicles are figures countries reported to WHO (around 2021; the earlier round around 2016 is only in WHO’s Global Health Observatory and was removed in November 2026) and may be biased where reporting is incomplete. Taiwan is not in the WHO data and uses Ministry of Transportation and Communications deaths within 30 days; the police A1 figures often quoted count only deaths within 24 hours, which are much lower and not comparable. The 2021 road-user and vehicle data come from the WHO Global status report on road safety 2023 (CC BY-NC-SA 3.0 IGO), and the pedestrian, motorcyclist and per-vehicle data files are shared under CC BY-NC-SA 3.0 IGO as well. For motorcycles and cars per 1,000 people, see the Vehicles & EVs topic.',
  },
  panelExtra: () => import('./panels/RoadTypePanel'),
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
        zh: '道路交通死亡者裡行人的比例，各國向 WHO 通報的數字（2021 年前後，地圖用 5 年內最近一次）。台灣是交通部的 30 日內死亡人數。',
        en: 'Share of road deaths who were pedestrians, as reported by countries to WHO (around 2021; the map uses the latest within 5 years). Taiwan uses Ministry of Transportation and Communications deaths within 30 days.',
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
    // 死亡車禍發生在哪一種道路（2026-11-05，製作手冊第二十三批 405；pipeline/topics/road_type.py）
    {
      id: 'motorway-death-share',
      label: { zh: '死亡車禍發生在高速公路的比例（歐洲）', en: 'Share of road deaths on motorways (Europe)' },
      description: {
        zh: '道路交通死亡（30 天內）裡，車禍發生在高速公路的占幾成（Eurostat 的 CARE 資料庫，1999 年起，歐洲 29 國；那一年死亡不到 50 人的不算）。最近一年西班牙 20.1%、盧森堡 14.0%、比利時 13.0%、克羅埃西亞 12.1%、荷蘭 11.3%、德國 10.3%；波蘭 3.4%、芬蘭 2.8%、羅馬尼亞 2.5%，挪威、愛沙尼亞、拉脫維亞是 0。比例高不代表高速公路比較危險，多半是高速公路多、車流集中（西班牙的高速公路很長）；多數國家一半以上的死者在郊區道路，側欄列四類道路的人數。台灣 2024 年 3.2%（高速公路局統計的國道 30 日內死亡 95 人，交通部沒有按道路類別分的統計）。',
        en: 'Share of road deaths (within 30 days) in crashes on motorways (Eurostat CARE database, from 1999, 29 European countries; years with fewer than 50 deaths are left out). In the latest year Spain 20.1%, Luxembourg 14.0%, Belgium 13.0%, Croatia 12.1%, the Netherlands 11.3% and Germany 10.3%; Poland 3.4%, Finland 2.8% and Romania 2.5%, with zero in Norway, Estonia and Latvia. A high share does not mean motorways are more dangerous; it mostly reflects a large motorway network carrying much of the traffic (Spain’s is very long). In most countries over half of road deaths are on rural roads; the side panel lists all four road types. Taiwan 3.2% in 2024 (95 deaths within 30 days on national freeways from the Freeway Bureau; no national breakdown by road type is published).',
      },
      unit: '%',
      file: 'motorway-death-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 6, 8, 11, 15] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'deaths-per-vkm',
      label: { zh: '每十億車公里死亡數（歐洲）', en: 'Road deaths per billion vehicle-km (Europe)' },
      description: {
        zh: '道路交通死亡人數 ÷ 國內道路上所有車輛一年跑的車公里（Eurostat，18 國有車公里，年份零散）。考慮了車流量，比每十萬人死亡率更能比較道路本身的安全：羅馬尼亞 2024 年每十億車公里 21.7 人最高，匈牙利 10.0、克羅埃西亞 8.7、捷克 8.2；法國 5.1、荷蘭 4.0、瑞士 3.7、奧地利 3.6、瑞典 2.6，挪威 1.7（2021 年）最低。',
        en: 'Road deaths divided by the vehicle-kilometres driven on the country’s roads by all vehicles (Eurostat; 18 countries have vehicle-km, in scattered years). Accounting for traffic, it compares how safe the roads themselves are better than deaths per 100,000 people: Romania had 21.7 per billion vehicle-km in 2024, Hungary 10.0, Croatia 8.7 and Czechia 8.2; France 5.1, the Netherlands 4.0, Switzerland 3.7, Austria 3.6 and Sweden 2.6, with Norway lowest at 1.7 (2021).',
      },
      unit: { zh: '人/十億車公里', en: 'per billion vehicle-km' },
      file: 'deaths-per-vkm.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 4, 5, 7, 10, 15] } },
      format: (v) => tr({ zh: `每十億車公里 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per billion vehicle-km` }),
      formatTick: (v) => fixed(v, 0),
      lowerIsBetter: true,
    },
    // 2026-11-07（製作手冊第二十七批 575）：受傷人數、事故件數
    ...roadInjuries.indicators,
  ],
};
