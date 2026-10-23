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
        zh: 'WHO《Global status report on road safety 2023》各國指標（2021 年的死亡組成與登記車輛數）',
        en: 'WHO, Global status report on road safety 2023, country indicators (2021 deaths by road user and registered vehicles)',
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
  ],
  note: {
    zh: '死亡率是 WHO 的估計值，用 30 天的定義（事故後 30 天內死亡），各國可以比較；死亡人數是 WHO 的死亡率乘上聯合國的人口。行人、機車騎士占比與登記車輛數是各國向 WHO 通報的資料（2016、2021 年前後兩輪調查），通報不完整的國家可能有偏差。台灣不在 WHO 的資料裡，用交通部的 30 日內死亡人數；警察機關常見的 A1 類事故只算 24 小時內死亡，數字少很多，不能拿來跟其他國家比。2021 年的死亡組成與登記車輛數取自《Global status report on road safety 2023》（WHO，CC BY-NC-SA 3.0 IGO），行人與機車騎士占比、每萬輛機動車死亡數的資料檔也依 CC BY-NC-SA 3.0 IGO 分享。',
    en: 'Death rates are WHO estimates using the 30-day definition (death within 30 days of the crash), so countries can be compared; death counts are the WHO rate times the UN population. Pedestrian and motorcyclist shares and registered vehicles are figures countries reported to WHO (two survey rounds, around 2016 and 2021) and may be biased where reporting is incomplete. Taiwan is not in the WHO data and uses Ministry of Transportation and Communications deaths within 30 days; the police A1 figures often quoted count only deaths within 24 hours, which are much lower and not comparable. The 2021 road-user and vehicle data come from the WHO Global status report on road safety 2023 (CC BY-NC-SA 3.0 IGO), and the pedestrian, motorcyclist and per-vehicle data files are shared under CC BY-NC-SA 3.0 IGO as well.',
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
