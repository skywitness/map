import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent } from '../lib/format';
import { LONG_RUN_CAVEAT, LONG_RUN_SOURCE } from './longRun';
import type { TopicDefinition } from './types';

const PEOPLE = { zh: '人', en: 'people' };
const PER_KM2 = { zh: '人/km²', en: 'people/km²' };
const YEARS = { zh: '歲', en: 'years' };

export const population: TopicDefinition = {
  id: 'population',
  title: { zh: '各國人口', en: 'Population by country' },
  shortTitle: { zh: '人口', en: 'Population' },
  defaultIndicator: 'total',
  defaultYear: 2023,
  boxEstimate: { indicator: 'total', label: { zh: '人口', en: 'population' }, grid: 'grid.json', taiwan: 'taiwan-segis.json' },
  sources: [
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（中推估）',
        en: 'United Nations, World Population Prospects 2024 (medium variant)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'European Commission JRC, GHS-POP R2023A（人口密度的 1 km 網格、框選估算）',
        en: 'European Commission JRC, GHS-POP R2023A (1 km population density grid and area estimates)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '內政部統計處 SEGIS：統計區人口統計（最小統計區，data.gov.tw 18681）、最小統計區圖（data.gov.tw 25128）：台灣框選的戶籍人口（只用中心點與人口，資料已變更）',
        en: 'Ministry of the Interior (Taiwan), SEGIS: population by smallest statistical area (data.gov.tw 18681) and statistical area maps (25128): registered population for boxes over Taiwan (centres and totals only; data modified)',
      },
      url: 'https://data.gov.tw/dataset/18681',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    LONG_RUN_SOURCE,
  ],
  indicators: [
    {
      id: 'total',
      label: { zh: '總人口', en: 'Total population' },
      description: {
        zh: '每年 7 月 1 日的年中人口。圓的面積與人口數成正比。',
        en: 'Mid-year population on 1 July. Circle area is proportional to population.',
      },
      unit: PEOPLE,
      file: 'total.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: (v) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'density',
      label: { zh: '人口密度', en: 'Population density' },
      description: { zh: '每平方公里的人數。', en: 'People per square kilometre.' },
      unit: PER_KM2,
      file: 'density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 250, 500] } },
      format: (v) => `${fixed(v, v < 100 ? 1 : 0)} ${tr(PER_KM2)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      grid: { dir: 'population-density' },
    },
    {
      id: 'growth',
      label: { zh: '人口年增率', en: 'Population growth' },
      description: {
        zh: '相較前一年的人口變化，含自然增加與移民。橘色為人口減少、綠色為增加。',
        en: 'Change in population from the previous year, including natural increase and migration. Orange means shrinking, green means growing.',
      },
      unit: '%',
      file: 'growth.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-2, -1, -0.25, 0.25, 1, 2] } },
      format: (v) => formatSignedPercent(v),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 2),
      compareWorld: true,
    },
    {
      id: 'median-age',
      label: { zh: '年齡中位數', en: 'Median age' },
      description: {
        zh: '一半人口比這個年齡年輕、一半比較年長，可以看出人口老化程度。',
        en: 'Half the population is younger and half is older than this age, a measure of population ageing.',
      },
      unit: YEARS,
      file: 'median-age.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 45] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'total-1800',
      label: { zh: '總人口（1800 年起）', en: 'Total population (since 1800)' },
      description: {
        zh: `1800–2023 年的人口，1950 年起跟聯合國的 WPP 相同、之前用歷史研究回推。${LONG_RUN_CAVEAT.zh}`,
        en: `Population 1800–2023: UN WPP figures from 1950, historical reconstructions before that. ${LONG_RUN_CAVEAT.en}`,
      },
      unit: PEOPLE,
      file: 'total-1800.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: (v) => `${formatLargeNumber(v)} ${tr(PEOPLE)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
