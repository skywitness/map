import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 能源的淨有效稅率（2026-11-07，製作手冊第二十五批 528；pipeline/topics/energy_taxes.py）：OECD Net Effective Energy Rates
 * （Taxing Energy Use 系列，2018、2021、2023），每 GJ 能源被課的稅減掉化石燃料補貼。子項目是部門。跟「稅」主題的
 * 「一噸碳實際被課多少稅」（第二十五批 459）同一個 OECD 系列，那個以每噸 CO2 算、這個以每 GJ 能源算。
 */

const SECTOR = {
  label: { zh: '部門', en: 'Sector' },
  options: [
    { id: 'all', label: { zh: '全部能源', en: 'All energy' } },
    { id: 'road', label: { zh: '公路運輸', en: 'Road transport' } },
    { id: 'non-road', label: { zh: '公路以外', en: 'Everything but road' } },
    { id: 'electricity', label: { zh: '發電', en: 'Electricity' } },
    { id: 'buildings', label: { zh: '住宅與商業', en: 'Residential and commercial' } },
    { id: 'industry', label: { zh: '工業', en: 'Industry' } },
  ],
  defaultOption: 'all',
};

const eur = (v: number) => {
  const sign = v < 0 ? '−' : '';
  return tr({ zh: `${sign}${fixed(Math.abs(v), 2)} 歐元/GJ`, en: `${sign}€${fixed(Math.abs(v), 2)}/GJ` });
};
const UNIT = { zh: '歐元/GJ', en: '€/GJ' };
const NO_TWN = { TWN: { zh: '台灣不在 OECD 的資料裡', en: 'Taiwan is not in the OECD data' } };
const diverging = (t: number[]): ScaleSpec => ({ type: 'diverging', thresholds: t });

const common: Pick<IndicatorDef, 'unit' | 'dimension' | 'format' | 'formatTick' | 'defaultYear' | 'compareWorld' | 'noValue'> = {
  unit: UNIT,
  dimension: SECTOR,
  format: eur,
  // 中間一級的門檻是 ±0.2（工業 ±0.05），整數會寫成「-0」
  formatTick: (v) => fixed(v, v === 0 || Math.abs(v) >= 1 ? 0 : Math.abs(v) >= 0.1 ? 1 : 2),
  defaultYear: 2023,
  compareWorld: false,
  noValue: NO_TWN,
};

export const energyTaxes: TopicDefinition = {
  id: 'energy-taxes',
  title: { zh: '能源的淨有效稅率：課稅減補貼', en: 'Net effective energy tax rates: taxes minus subsidies' },
  shortTitle: { zh: '能源稅與補貼', en: 'Energy taxes & subsidies' },
  defaultIndicator: 'net',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'OECD：Net Effective Energy Rates（Taxing Energy Use，2018、2021、2023 年）',
        en: 'OECD, Net Effective Energy Rates (Taxing Energy Use, 2018, 2021 and 2023)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_NEER%40DF_NEERS&df[ag]=OECD.CTP.TPS',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '每用掉 1 GJ（十億焦耳）的能源平均被課多少歐元：能源稅（汽柴油、燃料的貨物稅）、碳稅、排放交易、電力稅，減掉 OECD 盤點的化石燃料補貼（依各國的能源用量加權，79 國，不含美國）。補貼多半是把電價、油價壓在成本以下，不是直接發現金。跟「稅」主題的「一噸碳實際被課多少稅」是同一個 OECD 系列：那個以每噸二氧化碳算、這個以每 GJ 能源算，核能、水力這些不排碳的能源也算進來。',
    en: 'Average euros levied per gigajoule of energy used: energy taxes (excise on petrol, diesel and fuels), carbon taxes, emissions trading and electricity taxes, minus the fossil fuel subsidies in the OECD inventory (weighted by each country’s energy use; 79 countries, not including the US). Most subsidies keep power and fuel prices below cost rather than paying out cash. This belongs to the same OECD series as “Net effective carbon rate” in the Taxes topic: that one is per tonne of CO2, this one per GJ of energy, so carbon-free energy such as nuclear and hydro is counted too.',
  },
  indicators: [
    {
      ...common,
      id: 'net',
      label: { zh: '能源的淨有效稅率（課稅減補貼）', en: 'Net effective energy rate (taxes minus subsidies)' },
      description: {
        zh: '每 GJ 能源實際被課（正）或被補貼（負）多少歐元。2023 年全部能源：荷蘭 9.97、瑞士 8.27、義大利 7.83、盧森堡 7.82、賽普勒斯 6.93 歐元最高；南韓 2.06、中國大陸 0.84、日本 0.58；18 國是負的，斯里蘭卡 −7.46、厄瓜多 −5.08、布吉納法索 −4.31、哈薩克 −3.47、奈及利亞 −2.81 最低。公路運輸的稅最重：瑞士 24.42、以色列 21.98、芬蘭 20.06。',
        en: 'Euros actually levied (positive) or subsidised (negative) per GJ of energy. All energy in 2023: the Netherlands (€9.97), Switzerland (8.27), Italy (7.83), Luxembourg (7.82) and Cyprus (6.93) were highest; South Korea 2.06, mainland China 0.84, Japan 0.58; 18 countries were negative, lowest Sri Lanka (−7.46), Ecuador (−5.08), Burkina Faso (−4.31), Kazakhstan (−3.47) and Nigeria (−2.81). Road transport is taxed the most: Switzerland 24.42, Israel 21.98, Finland 20.06.',
      },
      file: 'net/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: diverging([-5, -2, -0.2, 0.2, 2, 6]),
        itemScales: {
          road: diverging([-8, -3, -0.5, 0.5, 8, 16]),
          electricity: diverging([-10, -3, -0.2, 0.2, 2, 6]),
          buildings: diverging([-10, -3, -0.2, 0.2, 2, 6]),
          industry: diverging([-1.5, -0.5, -0.05, 0.05, 1, 3]),
        },
      },
    },
    {
      ...common,
      id: 'tax',
      label: { zh: '能源被課的稅（不扣補貼）', en: 'Effective energy tax rate (before subsidies)' },
      description: {
        zh: '能源稅、碳稅、排放交易與電力稅加起來，每 GJ 多少歐元，還沒扣補貼。2023 年全部能源：荷蘭 10.20、瑞士 8.27、盧森堡 7.92、義大利 7.88、德國 7.80 最高；奈及利亞、馬來西亞、厄瓜多、孟加拉幾乎是 0。',
        en: 'Energy taxes, carbon taxes, emissions trading and electricity taxes combined, in euros per GJ, before subsidies. All energy in 2023: the Netherlands (€10.20), Switzerland (8.27), Luxembourg (7.92), Italy (7.88) and Germany (7.80) were highest; Nigeria, Malaysia, Ecuador and Bangladesh were close to zero.',
      },
      file: 'tax/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 6, 8] },
        itemScales: { road: { type: 'sequential', thresholds: [2, 5, 10, 14, 18, 22] } },
      },
    },
    {
      ...common,
      id: 'subsidy',
      label: { zh: '化石燃料補貼', en: 'Fossil fuel subsidies' },
      description: {
        zh: '每 GJ 能源平均被補貼多少歐元（OECD 盤點的化石燃料補貼，多半是把電價、油價壓在成本以下）。2023 年全部能源：斯里蘭卡 5.26、厄瓜多 4.94、英國 3.56、布吉納法索 3.33、哈薩克 3.20、摩洛哥 2.81 最多；瑞士、加拿大、澳洲、丹麥等是 0。',
        en: 'Average euros of subsidy per GJ of energy (fossil fuel subsidies in the OECD inventory, mostly keeping power and fuel prices below cost). All energy in 2023: Sri Lanka (€5.26), Ecuador (4.94), the UK (3.56), Burkina Faso (3.33), Kazakhstan (3.20) and Morocco (2.81) were highest; Switzerland, Canada, Australia, Denmark and others were zero.',
      },
      file: 'subsidy/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.5, 1, 2, 3, 5] } },
    },
  ],
};
