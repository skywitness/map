import { tr } from '../i18n/lang';
import { fixed, formatPercent, formatSignedPercent } from '../lib/format';
import type { GridSpec, TopicDefinition } from './types';

/**
 * 分級門檻（nW/cm²/sr）。國家平均與網格圖磚共用同一組：
 * pipeline/topics/night_lights_tiles.py 的 THRESHOLDS 要一樣，產生圖磚時會檢查。
 */
export const LIGHT_THRESHOLDS = [0.1, 0.3, 1, 3, 10, 30];

const RADIANCE = 'nW/cm²/sr';
const MW_SR = 'MW/sr';
const W_SR_PER_PERSON = { zh: 'W/sr/人', en: 'W/sr per person' };

/** 有效位數 3 位（數值從 0.001 到上千） */
function sig3(v: number): string {
  const a = Math.abs(v);
  return fixed(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 2 : a >= 0.01 ? 3 : 4);
}
const tick = (v: number) => (v < 1 ? String(v) : fixed(v, 0));

const NIGHT_GRID: GridSpec = {
  dir: 'night-lights',
  label: { zh: '約 500 m 網格', en: '~500 m grid' },
  subtitle: {
    zh: '每個約 500 m 見方的格子一整年的平均夜間亮度（VIIRS 衛星的年度合成，已去掉野火等短暫的光源）：城市、公路、油氣田的燃燒塔都看得到；漁船會移動，大多被當成短暫的光源去掉，只有固定的大漁場（例如阿根廷外海的魷釣船隊）留下來。',
    en: 'Average night-time brightness over a year in each cell about 500 m across (annual VIIRS composite, with short-lived light such as wildfires removed): cities, highways and gas flares all show up; fishing boats move around and are mostly removed as short-lived light, so only large fixed fishing grounds (such as the squid fleet off Argentina) remain.',
  },
  epochNote: (epoch) =>
    tr({ zh: `${epoch} 年 · 縮小時為範圍內平均`, en: `${epoch} · averaged when zoomed out` }),
  empty: {
    zh: '北緯 75° 以北、南緯 62° 以南（沒有資料）',
    en: 'North of 75°N and south of 62°S (no data)',
  },
  defaultOn: true,
};

export const nightLights: TopicDefinition = {
  id: 'night-lights',
  title: { zh: '夜間燈光', en: 'Night lights' },
  shortTitle: { zh: '夜間燈光', en: 'Night lights' },
  defaultIndicator: 'mean',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Earth Observation Group（科羅拉多礦業學院 Payne Institute）Annual VNL V2（VIIRS 夜間燈光年度合成，average_masked），檔案取自 Hengl (2025) 在 Zenodo 的轉存（doi:10.5281/zenodo.17294744）',
        en: 'Earth Observation Group, Payne Institute for Public Policy, Colorado School of Mines, Annual VNL V2 (VIIRS nighttime lights, average_masked); files from the Zenodo copy by Hengl (2025), doi:10.5281/zenodo.17294744',
      },
      url: 'https://eogdata.mines.edu/products/vnl/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'European Commission JRC, GHS-POP R2023A（住在沒有燈光地方的人口）',
        en: 'European Commission JRC, GHS-POP R2023A (population in unlit areas)',
      },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人均）', en: 'United Nations, World Population Prospects 2024 (per capita)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'Natural Earth 1:10m 第一級行政區（燈光最多的地區）',
        en: 'Natural Earth 1:10m admin-1 states and provinces (regions with the most light)',
      },
      url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/',
      license: { zh: '公有領域', en: 'Public domain' },
    },
  ],
  note: {
    zh: 'This product was made utilizing VIIRS Nighttime Lights (Annual VNL V2) data produced by the Earth Observation Group, Payne Institute for Public Policy, Colorado School of Mines. 夜間燈光是 Suomi NPP 衛星 VIIRS 的日夜波段（DNB，0.5–0.9 µm）在無雲、無月光的夜晚量到的輻射亮度，EOG 把每月平均再合成一年（average_masked：去掉野火等短暫的光源與沒有燈光的背景）。2012 年只有 4–12 月，所以從 2013 年開始；這裡用的檔案 2017 年起有燈光的格子突然多很多（處理方式不同），跟之前的年份不完全可比，所以變化從 2017 年算起。網格只有 2013、2017、2020、2024 年四期（時間軸挑那一年以前最近的一期）。各國的值只算國界內的陸地，海上的漁船與油氣平台不算；北緯 75° 以北沒有資料。燈光總量是亮度 × 面積（1 nW/cm²/sr 在 1 km² 上是 10 W/sr）。「有燈光」是年平均亮度 1 nW/cm²/sr 以上（這裡用的轉存檔只到整數，比 1 暗的都是 0）。「住在沒有燈光的地方」用 GHS-POP 約 1 km 的人口格子，格子裡完全沒有燈光的人口比例，是電力普及的粗略指標：有電但燈太少、太暗的村莊衛星看不到，所以會比沒有電的人口多。DNB 對藍光不敏感，路燈換成白光 LED 後量到的亮度會變低，所以燈光變暗不一定是用電減少。',
    en: 'This product was made utilizing VIIRS Nighttime Lights (Annual VNL V2) data produced by the Earth Observation Group, Payne Institute for Public Policy, Colorado School of Mines. Night lights are the radiance measured by the day/night band (DNB, 0.5–0.9 µm) of the VIIRS instrument on the Suomi NPP satellite on cloud-free, moonless nights; EOG averages the monthly composites into a year (average_masked: short-lived light such as wildfires and the unlit background removed). 2012 only covers April to December, so the series starts in 2013; in the files used here many more cells are lit from 2017 on (different processing), so earlier years are not fully comparable and change is measured from 2017. The grid has four editions, 2013, 2017, 2020 and 2024 (the time slider shows the latest one up to the chosen year). Country values cover land within each border only, so fishing boats and offshore platforms are not counted; there are no data north of 75°N. Total light is radiance × area (1 nW/cm²/sr over 1 km² is 10 W/sr). Lit means an annual mean radiance of at least 1 nW/cm²/sr (the copies used here only hold whole numbers, so anything dimmer is 0). Population in unlit areas is the share of people in GHS-POP cells about 1 km across with no light at all, a rough proxy for lack of electricity: villages with power but few or dim lights are invisible to the satellite, so it overstates the population without electricity. The DNB is insensitive to blue light, so switching street lights to white LEDs lowers measured radiance; dimmer lights do not always mean less electricity use.',
  },
  panelExtra: () => import('./panels/NightLightsPanel'),
  indicators: [
    {
      id: 'mean',
      label: { zh: '平均亮度', en: 'Average brightness' },
      description: {
        zh: '全國陸地一整年的平均夜間亮度（沒有燈光的地方算 0），可以切換成約 500 m 的網格，看城市、公路、燃燒塔與大漁場在哪裡。',
        en: 'Average night-time radiance over the country’s land for a year (unlit areas count as zero). Switch to the ~500 m grid to see where the cities, highways, gas flares and large fishing grounds are.',
      },
      unit: RADIANCE,
      file: 'mean.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: LIGHT_THRESHOLDS } },
      format: (v) => `${sig3(v)} ${RADIANCE}`,
      formatTick: tick,
      compareWorld: true,
      grid: NIGHT_GRID,
    },
    {
      id: 'total',
      label: { zh: '燈光總量', en: 'Total light' },
      description: {
        zh: '全國陸地的亮度 × 面積（向上的可見光與近紅外光的輻射強度，MW/sr）。圓的面積與燈光總量成正比。',
        en: 'Radiance × area over the country’s land (upward radiant intensity in visible and near-infrared light, MW/sr). Circle area is proportional to total light.',
      },
      unit: MW_SR,
      file: 'total.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => `${sig3(v)} ${MW_SR}`,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'per-capita',
      label: { zh: '人均燈光', en: 'Light per person' },
      description: {
        zh: '燈光總量 ÷ 人口（W/sr/人）。燃燒天然氣的產油國、地廣人稀的富國特別高。',
        en: 'Total light ÷ population (W/sr per person). Highest in oil producers that flare gas and in wealthy, sparsely populated countries.',
      },
      unit: W_SR_PER_PERSON,
      file: 'per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5] } },
      format: (v) => `${sig3(v)} ${tr(W_SR_PER_PERSON)}`,
      formatTick: tick,
      compareWorld: true,
    },
    {
      id: 'lit-share',
      label: { zh: '有燈光的土地', en: 'Lit land' },
      description: {
        zh: '年平均亮度 1 nW/cm²/sr 以上的土地占國土的比例。',
        en: 'Share of the country’s land with an annual mean radiance of at least 1 nW/cm²/sr.',
      },
      unit: '%',
      file: 'lit-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 10, 20, 40, 60] } },
      format: (v) => formatPercent(v, v < 10 ? 1 : 0),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'unlit-pop',
      label: { zh: '住在沒有燈光的地方', en: 'People in unlit areas' },
      description: {
        zh: '人口格子（約 1 km）裡完全沒有燈光的人占全國人口的比例，是電力普及的粗略指標（會高估沒有電的人口）。',
        en: 'Share of people living in cells about 1 km across with no detectable light, a rough proxy for lack of electricity (it overstates the population without power).',
      },
      unit: '%',
      file: 'unlit-pop.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 75] } },
      format: (v) => formatPercent(v, v < 10 ? 1 : 0),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'change',
      label: { zh: '燈光比 2017 年', en: 'Light vs 2017' },
      description: {
        zh: '燈光總量比 2017 年多或少幾 %（之前的年份處理方式不同，不能直接比）。綠色是變亮、橘色是變暗；換成 LED 路燈、戰爭、停電都會讓燈光變暗。燈光很少的國家不算。',
        en: 'Change in total light since 2017 (earlier years were processed differently and are not directly comparable). Green is brighter, orange dimmer; LED street lights, war and power cuts all make lights dimmer. Countries with very little light are left out.',
      },
      unit: '%',
      file: 'change.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-50, -20, -5, 5, 20, 50] } },
      format: (v) => formatSignedPercent(v, 0),
      formatTick: (v) => formatSignedPercent(v, 0),
      compareWorld: true,
    },
  ],
};
