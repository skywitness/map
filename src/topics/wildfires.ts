import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
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

/** 燒毀面積的圓餅（新28，pipeline 的 landcover/<類別>.json，GWIS 的 MODIS 土地覆蓋） */
const LANDCOVER_PIE = (
  [
    ['forest', 'green', { zh: '森林', en: 'Forest' }],
    ['savannas', 'yellow', { zh: '疏林草原', en: 'Savannas' }],
    ['shrublands_grasslands', 'magenta', { zh: '灌叢與草地', en: 'Shrublands and grasslands' }],
    ['croplands', 'blue', { zh: '農地', en: 'Croplands' }],
    ['other', 'aqua', { zh: '其他', en: 'Other' }],
  ] as const
).map(([id, hue, label]) => ({ indicator: `landcover-${id}`, file: `landcover/${id}.json`, color: MAP_TOKENS.hues[hue], label }));

export const wildfires: TopicDefinition = {
  id: 'wildfires',
  title: { zh: '各國野火燒毀面積', en: 'Wildfire burned area by country' },
  shortTitle: { zh: '野火', en: 'Wildfires' },
  defaultIndicator: 'burned-share',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'FAOSTAT：Emissions from Fires（GI，FAO TIER 1；NASA MODIS MCD64A1 與 GFED 的係數）', en: 'FAOSTAT: Emissions from Fires (GI, FAO Tier 1; NASA MODIS MCD64A1 and GFED factors)' },
      url: 'https://www.fao.org/faostat/en/#data/GI',
      license: 'CC BY 4.0',
    },
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
        zh: '一年內衛星偵測到燒過的土地面積，含森林、草原、灌叢與農地。圓的面積與燒毀面積成正比，各片是燒到的土地覆蓋：森林、疏林草原、灌叢與草地、農地與其他。',
        en: 'Land the satellite detected as burned in a year, including forests, grasslands, shrublands and croplands. Circle area is proportional to burned area; the slices show the land cover that burned: forest, savannas, shrublands and grasslands, croplands and other.',
      },
      unit: KM2,
      file: 'burned-area.json',
      // 2026-11-02（新28）：圓畫成燒到的土地覆蓋的圓餅（森林、疏林草原、灌叢與草地、農地、其他），顏色跟側欄的堆疊圖一樣
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000], pie: { parts: LANDCOVER_PIE } },
      format: km2,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'fire-co2',
      label: { zh: '森林火災的二氧化碳排放', en: 'CO₂ from forest fires' },
      description: {
        zh: '森林火災一年排出的二氧化碳（公噸，FAOSTAT 用 NASA MODIS 燒毀面積與係數推估），1996 年起。2025 年全世界約 20.6 億公噸：尚比亞 2.99 億、剛果民主共和國 2.97 億、緬甸 2.47 億、中非 2.26 億、莫三比克 1.83 億、安哥拉 1.73 億、印度 8,369 萬、坦尚尼亞 7,000 萬、加拿大 6,839 萬、巴西 5,282 萬。2024 年全世界 28.3 億公噸，玻利維亞 5.16 億、巴西 4.60 億最多。草原火災的二氧化碳依 IPCC 的算法當年就被植物吸收回去，不算。台灣是 0：MODIS 看不到台灣這種小面積的火，不是沒有森林火災。',
        en: 'Carbon dioxide released by forest fires in a year (tonnes, estimated by FAOSTAT from NASA MODIS burned area and emission factors), from 1996. The 2025 world total was about 2.06 billion tonnes: Zambia 299 million, DR Congo 297 million, Myanmar 247 million, Central African Republic 226 million, Mozambique 183 million, Angola 173 million, India 83.7 million, Tanzania 70.0 million, Canada 68.4 million, Brazil 52.8 million. In 2024 the world total was 2.83 billion, led by Bolivia (516 million) and Brazil (460 million). CO₂ from savanna fires is counted as reabsorbed by vegetation within the year under IPCC rules and is excluded. Taiwan shows 0 because MODIS cannot see fires that small, not because there are none.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'fire-co2.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => tr({ zh: formatLargeNumber(v) + ' 公噸', en: formatLargeNumber(v) + ' t' }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'fao-burned',
      label: { zh: '森林與草原火災的燒毀面積（1996 年起）', en: 'Forest and savanna burned area (since 1996)' },
      description: {
        zh: 'FAOSTAT 依 IPCC 分類的燒毀面積（公頃），比上面的 GWIS 早到 1996 年，但分類與數字跟 GWIS 不同、不能接起來。全世界的森林火災 1996 年 1,526 萬公頃、2010 年 4,046 萬、2024 年 3,312 萬、2025 年 2,432 萬；草原火災 2025 年 2.77 億公頃，是森林的 11 倍。1996–1999 年平均到 2015–2024 年平均，森林火災變多的有尚比亞 60 萬 → 352 萬公頃、莫三比克 17 萬 → 335 萬、中非 48 萬 → 312 萬；變少的有印尼 176 萬 → 16 萬、奈及利亞 90 萬 → 5 萬。1990–1995 年是同一個回推的數字，不畫。',
        en: 'Burned area by IPCC class from FAOSTAT (hectares), reaching back to 1996, earlier than GWIS above, but with different classes and figures, so the two cannot be joined. Forest fires burned 15.3 million ha worldwide in 1996, 40.5 million in 2010, 33.1 million in 2024 and 24.3 million in 2025; savanna fires burned 277 million ha in 2025, 11 times as much. From the 1996–1999 average to the 2015–2024 average, forest fires grew in Zambia (0.60 → 3.52 million ha), Mozambique (0.17 → 3.35 million) and the Central African Republic (0.48 → 3.12 million) and shrank in Indonesia (1.76 → 0.16 million) and Nigeria (0.90 → 0.05 million). 1990–1995 are a single back-cast figure and are not shown.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'fao-burned/{item}.json',
      dimension: {
        label: { zh: '火災', en: 'Fire type' },
        options: [
          { id: 'forest', label: { zh: '森林火災', en: 'Forest fires' } },
          { id: 'savanna', label: { zh: '草原火災', en: 'Savanna fires' } },
        ],
        defaultOption: 'forest',
      },
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: (v) => tr({ zh: formatLargeNumber(v) + ' 公頃', en: formatLargeNumber(v) + ' ha' }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
