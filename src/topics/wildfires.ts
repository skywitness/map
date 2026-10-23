import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

const KM2 = { zh: '平方公里', en: 'km²' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 面積：台灣這類小的值只有零點幾平方公里（一個網格約 0.21 平方公里），大的到 90 萬平方公里 */
function km2Number(v: number): string {
  if (v === 0) return '0';
  return fixed(v, v < 1 ? 2 : v < 100 ? 1 : 0);
}
const km2 = (v: number) => `${km2Number(v)} ${tr(KM2)}`;

/** 占國土比例：非洲疏林草原國家每年 20–40%，台灣只有萬分之幾 */
function percent(v: number): string {
  if (v === 0) return '0%';
  return `${fixed(v, v < 0.01 ? 4 : v < 0.1 ? 3 : v < 1 ? 2 : 1)}%`;
}

export const wildfires: TopicDefinition = {
  id: 'wildfires',
  title: { zh: '各國野火燒毀面積', en: 'Wildfire burned area by country' },
  shortTitle: { zh: '野火', en: 'Wildfires' },
  defaultIndicator: 'burned-share',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'GWIS 全球野火資訊系統（歐盟執委會 JRC、Copernicus）, MODIS Global Monthly Burned Area',
        en: 'Global Wildfire Information System (GWIS; European Commission JRC, Copernicus), MODIS Global Monthly Burned Area',
      },
      url: 'https://gwis.jrc.ec.europa.eu/apps/country.profile/downloads',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'NASA MODIS MCD64A1 燒毀面積產品（Giglio、Justice、Boschetti、Roy，LP DAAC）',
        en: 'NASA MODIS MCD64A1 Burned Area product (Giglio, Justice, Boschetti and Roy; LP DAAC)',
      },
      url: 'https://doi.org/10.5067/MODIS/MCD64A1.061',
      license: { zh: '沒有使用限制（NASA 地球科學資料政策）', en: 'no restrictions on use (NASA Earth science data policy)' },
    },
    {
      name: {
        zh: '農業部林業及自然保育署 林業保育統計年報（森林災害）',
        en: 'Forestry and Nature Conservation Agency (Taiwan), annual forestry statistics (forest damage)',
      },
      url: 'https://www.forest.gov.tw/0000574',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '燒毀面積是 NASA MODIS 衛星的 MCD64A1 產品（約 500 公尺的網格）偵測到的燒過的地表，由 GWIS 依 GADM 國界加總，不分起火原因：' +
      '野火之外也含農地燒除與草原的計畫性燒除，所以非洲、澳洲北部的熱帶草原面積最大。幾公頃的小火、樹冠下的地表火與被雲遮住的火常常偵測不到。' +
      '年份是曆年，南半球跨年的火季（例如澳洲 2019–2020 年）分在兩年。占國土比例的分母是 GADM 國界的總面積（含湖泊等內陸水域）。' +
      '台灣的衛星燒毀面積很小、很多年是 0，台灣側欄對照林業及自然保育署的森林火災統計。',
    en:
      "Burned area is the burned ground detected by NASA's MODIS MCD64A1 product (a grid of about 500 m), summed by GWIS within " +
      'GADM boundaries regardless of cause: besides wildfires it includes crop-residue burning and prescribed burning of grasslands, ' +
      'which is why tropical savannas in Africa and northern Australia dominate. Fires of a few hectares, surface fires under tree ' +
      'canopies and fires hidden by cloud are often missed. Years are calendar years, so Southern Hemisphere fire seasons that span ' +
      "the new year (such as Australia's 2019–2020 season) are split across two years. The share of country area uses the total " +
      "area within GADM boundaries (inland water such as lakes included). Taiwan's satellite-detected burned area is tiny and zero in " +
      "many years; Taiwan's panel compares it with forest fire statistics from the Forestry and Nature Conservation Agency.",
  },
  panelExtra: () => import('./panels/WildfiresPanel'),
  indicators: [
    {
      id: 'burned-share',
      label: { zh: '燒毀面積占國土比例', en: 'Burned area, % of country area' },
      description: {
        zh: '一年內燒過的土地占國土面積的比例。熱帶草原國家每年乾季大面積燃燒，常超過一成；溫帶與乾燥地區的國家多半不到 0.1%。',
        en: 'Land burned in a year as a share of the country’s area. Countries with tropical savannas burn widely every dry season, often over a tenth of their area; most temperate and arid countries burn less than 0.1%.',
      },
      unit: '%',
      file: 'burned-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 0.1, 0.5, 2, 5, 15] } },
      format: percent,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'burned-area',
      label: { zh: '燒毀面積', en: 'Burned area' },
      description: {
        zh: '一年內衛星偵測到燒過的土地面積，含森林、草原、灌叢與農地。圓的面積與燒毀面積成正比。',
        en: 'Land the satellite detected as burned in a year, including forests, grasslands, shrublands and croplands. Circle area is proportional to burned area.',
      },
      unit: KM2,
      file: 'burned-area.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: km2,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
