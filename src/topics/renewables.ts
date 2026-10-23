import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { GridSpec, TopicDefinition } from './types';

/**
 * 分級門檻。國家平均與網格圖磚共用同一組：
 * pipeline/topics/renewables_grid_tiles.py 的 SOLAR_THRESHOLDS、WIND_THRESHOLDS 要一樣，產生圖磚時會檢查。
 */
const SOLAR_THRESHOLDS = [3.0, 3.4, 3.8, 4.2, 4.6, 5.0];
const WIND_THRESHOLDS = [100, 200, 300, 400, 600, 800];

const PV_UNIT = { zh: 'kWh/kWp/日', en: 'kWh/kWp/day' };
const WIND_UNIT = 'W/m²';
const pv = (v: number) => `${fixed(v, 2)} ${tr(PV_UNIT)}`;
const watts = (v: number) => `${fixed(v, 0)} ${WIND_UNIT}`;
const wattsTick = (v: number) => fixed(v, 0);

const GRID_LABEL = { zh: '約 2 km 網格', en: '~2 km grid' };

const SOLAR_GRID: GridSpec = {
  dir: 'renewables-solar',
  label: GRID_LABEL,
  subtitle: {
    zh: '每個約 2 km 見方的陸地格子，1 kWp 的太陽光電系統平均每天可以發多少度電（Global Solar Atlas 的 PVOUT，長期平均）。',
    en: 'Average daily output of 1 kWp of solar PV in each land cell about 2 km across (Global Solar Atlas PVOUT, long-term average).',
  },
  epochNote: () =>
    tr({
      zh: '長期平均（各地起始年不同，到 2025 年）· 縮小時為範圍內平均',
      en: 'Long-term average (start year varies, to 2025) · averaged when zoomed out',
    }),
  empty: {
    zh: '海面、北緯 65° 以北（俄羅斯大多是 60° 以北）、冰島、南極洲（沒有資料）',
    en: 'Sea, north of 65°N (60°N in most of Russia), Iceland and Antarctica (no data)',
  },
};

const WIND_GRID: GridSpec = {
  dir: 'renewables-wind',
  label: GRID_LABEL,
  subtitle: {
    zh: '每個約 2 km 見方的格子，離地 100 公尺的平均風功率密度，陸地與各國的專屬經濟海域都有（Global Wind Atlas，2008–2017 年）。',
    en: 'Mean wind power density 100 m above ground in each cell about 2 km across, over land and each country’s exclusive economic zone (Global Wind Atlas, 2008–2017).',
  },
  epochNote: () =>
    tr({ zh: '2008–2017 年平均 · 縮小時為範圍內平均', en: '2008–2017 average · averaged when zoomed out' }),
  empty: {
    zh: '公海（專屬經濟海域以外）、北緯 80° 以北、南極洲（沒有資料）',
    en: 'High seas (beyond exclusive economic zones), north of 80°N and Antarctica (no data)',
  },
};

const windScale = { kind: 'choropleth' as const, scale: { type: 'sequential' as const, thresholds: WIND_THRESHOLDS } };

export const renewables: TopicDefinition = {
  id: 'renewables',
  title: { zh: '太陽能與風能潛力', en: 'Solar and wind potential' },
  shortTitle: { zh: '太陽能與風能', en: 'Solar & wind' },
  defaultIndicator: 'solar',
  defaultYear: 2025,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Global Solar Atlas 2.0（Solargis 為世界銀行製作，ESMAP 出資）',
        en: 'Global Solar Atlas 2.0 (Solargis for the World Bank Group, funded by ESMAP)',
      },
      url: 'https://globalsolaratlas.info/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Global Wind Atlas 4.0（丹麥技術大學 DTU 與世界銀行，ESMAP 出資，中尺度模擬由 Vortex 製作）',
        en: 'Global Wind Atlas 4.0 (Technical University of Denmark and the World Bank Group, funded by ESMAP, mesoscale data by Vortex)',
      },
      url: 'https://globalwindatlas.info/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '太陽能是 Global Solar Atlas 的 PVOUT：地面型、最佳傾角的典型太陽光電系統，每 1 kWp 平均每天可發多少度電（kWh），已考慮日照、氣溫與系統損失，但沒有扣除不能蓋電廠的土地（理論潛力）；衛星資料只涵蓋北緯 65° 以南（俄羅斯大多只到 60°），沒有冰島。風能是 Global Wind Atlas 的離地 100 公尺平均風功率密度（W/m²，跟風速的三次方成正比），由 ERA5 再分析資料經 3 km 中尺度模擬再細化到 250 m，這裡用它 0.02°（約 2 km）的縮小版；陸地加上各國的專屬經濟海域都有資料。各國的值是地圖國界內格子依面積加權的平均，含高山與沙漠；風能的平均會被高山稜線上的極端值拉高，所以另外列出「風最強的 10% 土地」與「近岸海域」。國土有資料的部分不到一半的國家（太陽能的俄羅斯、格陵蘭、冰島）不列出，一部分沒有資料的（加拿大、北歐）附註會說明。',
    en: 'Solar is Global Solar Atlas PVOUT: the average daily output in kWh of 1 kWp of a typical ground-mounted PV system at optimum tilt, accounting for sunshine, temperature and system losses but not for land that cannot be built on (theoretical potential); the satellite data only covers land south of 65°N (60°N in most of Russia) and excludes Iceland. Wind is Global Wind Atlas mean wind power density 100 m above ground (W/m², proportional to the cube of wind speed), modelled from ERA5 reanalysis at 3 km and downscaled to 250 m; this map uses its 0.02° (about 2 km) overview, which covers land and every country’s exclusive economic zone. Country values are area-weighted averages of the cells within each border on the map, mountains and deserts included; wind averages are inflated by extreme values on mountain ridges, so the windiest 10% of land and nearshore waters are shown as well. Countries with data for less than half of their land (Russia, Greenland and Iceland for solar) are left out, and partial coverage (Canada, the Nordic countries) is noted per country.',
  },
  indicators: [
    {
      id: 'solar',
      label: { zh: '太陽光電潛力', en: 'Solar PV potential' },
      description: {
        zh: '1 kWp 的太陽光電系統平均每天可以發多少度電（kWh），全國陸地的平均；乘以 365 是一年的發電量。可以切換成約 2 km 的網格。',
        en: 'Average daily output in kWh of 1 kWp of solar PV, averaged over the country’s land; multiply by 365 for a year. Switch to the ~2 km grid to see differences within countries.',
      },
      unit: PV_UNIT,
      file: 'solar.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: SOLAR_THRESHOLDS } },
      format: pv,
      formatTick: (v) => fixed(v, 1),
      compareWorld: true,
      grid: SOLAR_GRID,
    },
    {
      id: 'wind',
      label: { zh: '風能潛力', en: 'Wind power density' },
      description: {
        zh: '離地 100 公尺的平均風功率密度，全國陸地的平均（含高山稜線，風速大約每增加一倍，功率密度變成 8 倍）。可以切換成約 2 km 的網格，海上也有資料。',
        en: 'Mean wind power density 100 m above ground, averaged over the country’s land (mountain ridges included; doubling the wind speed multiplies it about eightfold). Switch to the ~2 km grid, which also covers the sea.',
      },
      unit: WIND_UNIT,
      file: 'wind.json',
      layer: windScale,
      format: watts,
      formatTick: wattsTick,
      compareWorld: true,
      grid: WIND_GRID,
    },
    {
      id: 'wind-top10',
      label: { zh: '風最強的 10% 土地', en: 'Windiest 10% of land' },
      description: {
        zh: '全國陸地中風功率密度最高、合計占 10% 面積的地方的平均（Global Wind Atlas 的國家摘要也用這個），比全國平均更接近「最好的風場有多好」。這些地方在哪裡，請看「風能潛力」的網格。',
        en: 'Average wind power density 100 m above ground over the windiest 10% of the country’s land (as in Global Wind Atlas country summaries): closer to how good the best sites are than the national average. To see where they are, use the wind power density grid.',
      },
      unit: WIND_UNIT,
      file: 'wind-top10.json',
      layer: windScale,
      format: watts,
      formatTick: wattsTick,
      compareWorld: true,
    },
    {
      id: 'offshore',
      label: { zh: '近岸海域的風能', en: 'Nearshore wind' },
      description: {
        zh: '離海岸 50 公里內的海面，離地 100 公尺的平均風功率密度；每一格海面算給最近的陸地所屬的國家，內陸國沒有。海上各處的差別（例如台灣海峽）請看「風能潛力」的網格。',
        en: 'Mean wind power density 100 m above the sea within 50 km of the coast; each sea cell counts towards the country whose land is nearest, so landlocked countries have none. For differences across the sea (such as the Taiwan Strait), see the wind power density grid.',
      },
      unit: WIND_UNIT,
      file: 'offshore.json',
      layer: windScale,
      format: watts,
      formatTick: wattsTick,
      compareWorld: true,
    },
  ],
};
