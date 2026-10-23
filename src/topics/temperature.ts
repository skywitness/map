import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const CELSIUS = '°C';
const MM = { zh: '毫米', en: 'mm' };
/** 用真正的減號（−3.2 °C），不用連字號 */
const signed = (v: number, digits: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`;
const plusMinus = (v: number, digits: number) => `${v > 0 ? '+' : ''}${signed(v, digits)}`;

/**
 * 暖化的分級門檻（°C）。國家平均與 0.5° 網格圖磚共用同一組：
 * pipeline/topics/temperature_grid_tiles.py 的 WARMING_THRESHOLDS 要一樣，產生圖磚時會檢查。
 */
const WARMING_THRESHOLDS = [-2, -1, -0.3, 0.3, 1, 2];

export const temperature: TopicDefinition = {
  id: 'temperature',
  title: { zh: '各國氣溫與降雨', en: 'Temperature and rainfall by country' },
  shortTitle: { zh: '氣溫與降雨', en: 'Temperature' },
  defaultIndicator: 'temperature',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'CRU TS v4.10（東英吉利大學氣候研究中心、英國國家大氣科學中心 NCAS；Harris et al. 2020, Scientific Data）',
        en: 'CRU TS v4.10 (Climatic Research Unit, University of East Anglia; NCAS; Harris et al. 2020, Scientific Data)',
      },
      url: 'https://crudata.uea.ac.uk/cru/data/hrg/',
      license: 'Open Database License (ODbL)',
    },
    {
      name: { zh: '中央氣象署（台灣交叉比對）', en: 'Central Weather Administration, Taiwan (cross-check)' },
      url: 'https://www.cwa.gov.tw/V8/C/C/Statistics/monthlymean.html',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: 'CRU TS 由各地測站的逐月觀測內插成 0.5° 的陸地網格（不含南極洲），各國的值是國界內格子依面積加權的平均，含高山與沙漠，跟首都或平地測站的數字可能差很多（例如台灣含中央山脈，比平地測站低約 4 °C）。離測站太遠的格子直接填 1961–1990 年的平均值，所以測站很少的地方變化看起來偏小：20 世紀初的非洲、南美內陸、北極，以及到現在都是如此的太平洋小島與新幾內亞。暖化的基準期因此用測站較多的 1951–1980 年。國土比一個格子還小、或網格上沒有陸地的小島國，用涵蓋它或最近的陸地格子，附註會說明。各國平均與 0.5° 網格是 CRU TS 的衍生資料庫，跟 CRU TS 一樣以 Open Database License（ODbL）提供。',
    en: 'CRU TS interpolates monthly station observations onto a 0.5° land grid (Antarctica excluded). Country values are area-weighted averages of the cells within each border, mountains and deserts included, so they can differ a lot from figures for capitals or lowland stations (Taiwan, for example, includes its Central Mountain Range and comes out about 4 °C cooler than lowland stations). Cells too far from any station are filled with their 1961–1990 average, so places with few stations show less change than they probably had: Africa, inland South America and the Arctic in the early 20th century, and Pacific islands and New Guinea to this day. That is why warming is measured against 1951–1980, when stations were far more numerous. Small islands smaller than a grid cell, or with no land cell on the grid, use the cell covering them or the nearest land cell, as noted per country. The country averages and the 0.5° grid are derived from CRU TS and, like it, are available under the Open Database License (ODbL).',
  },
  panelExtra: () => import('./panels/TemperaturePanel'),
  indicators: [
    {
      id: 'temperature',
      label: { zh: '年平均氣溫', en: 'Mean annual temperature' },
      description: {
        zh: '全國陸地的年平均氣溫（12 個月的月均溫平均，依面積加權，含高山）。',
        en: 'Mean annual temperature over the country’s land area (average of the 12 monthly means, area-weighted, mountains included).',
      },
      unit: CELSIUS,
      file: 'temperature.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 6, 12, 18, 24, 27] } },
      format: (v) => `${signed(v, 1)} °C`,
      formatTick: (v) => signed(v, Number.isInteger(v) ? 0 : 1),
      compareWorld: true,
    },
    {
      id: 'precipitation',
      label: { zh: '年降雨量', en: 'Annual precipitation' },
      description: {
        zh: '全國陸地一年的平均降水量（含降雪換算的水量，依面積加權）。',
        en: 'Average yearly precipitation over the country’s land area (rain plus the water equivalent of snow, area-weighted).',
      },
      unit: MM,
      file: 'precipitation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [250, 500, 1000, 1500, 2000, 3000] } },
      format: (v) => `${fixed(v, 0)} ${tr(MM)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'warming',
      label: { zh: '暖化', en: 'Warming' },
      description: {
        zh: '近 10 年的平均氣溫比 1951–1980 年平均高多少（例如 2025 年是 2016–2025 年的平均）。可以切換成 0.5° 網格，看國內各地的差別。',
        en: 'How much warmer the past 10 years were than the 1951–1980 average (for 2025, the 2016–2025 average). Switch to the 0.5° grid to see differences within countries.',
      },
      unit: CELSIUS,
      file: 'warming.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: WARMING_THRESHOLDS, reverse: true } },
      format: (v) => `${plusMinus(v, 2)} °C`,
      formatTick: (v) => plusMinus(v, Number.isInteger(v) ? 0 : 1),
      compareWorld: true,
      grid: {
        dir: 'warming',
        label: { zh: '0.5° 網格', en: '0.5° grid' },
        subtitle: {
          zh: '每個 0.5°（赤道約 55 km）見方的陸地格子，近 10 年平均氣溫比 1951–1980 年平均高多少（CRU TS，每年一期）。',
          en: 'How much warmer each 0.5° land cell (about 55 km across at the equator) was over the past 10 years than in 1951–1980 (CRU TS, one map per year).',
        },
        epochNote: (epoch) =>
          tr({
            zh: `${epoch - 9}–${epoch} 年平均 · 相對 1951–1980 年 · 縮小時為範圍內平均`,
            en: `${epoch - 9}–${epoch} average vs 1951–1980 · averaged when zoomed out`,
          }),
        empty: { zh: '海洋、南極洲（沒有資料）', en: 'Ocean and Antarctica (no data)' },
      },
    },
  ],
};
