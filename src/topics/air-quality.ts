import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, IndicatorDef, PointsOverlayDef, ScaleSpec, Text, TopicDefinition } from './types';

const UG = 'μg/m³';
const PER_100K = { zh: '人/十萬人', en: 'per 100,000 people' };
const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 100,000` });
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 兩個死亡率用同一組門檻，切換時顏色可以直接比 */
function deathRate(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_100K,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 100, 150] } },
    format: per100k,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

// ── 2026-11-07（製作手冊第二十五批 483）：七種空氣污染物的排放量（CEDS）與台灣的 1 公里網格清冊（環境部 TEDS） ──
const SPECIES = [
  { id: 'so2', label: { zh: '二氧化硫（SO₂）', en: 'Sulphur dioxide (SO₂)' } },
  { id: 'nox', label: { zh: '氮氧化物（NOx，以 NO₂ 計）', en: 'Nitrogen oxides (NOx, as NO₂)' } },
  { id: 'nh3', label: { zh: '氨（NH₃）', en: 'Ammonia (NH₃)' } },
  { id: 'bc', label: { zh: '黑碳（BC，以碳計）', en: 'Black carbon (BC, as C)' } },
  { id: 'oc', label: { zh: '有機碳（OC，以碳計）', en: 'Organic carbon (OC, as C)' } },
  { id: 'co', label: { zh: '一氧化碳（CO）', en: 'Carbon monoxide (CO)' } },
  { id: 'nmvoc', label: { zh: '非甲烷揮發性有機物（NMVOC）', en: 'Non-methane volatile organic compounds (NMVOC)' } },
];
const SPECIES_DIM = { label: { zh: '污染物', en: 'Pollutant' }, options: SPECIES, defaultOption: 'so2' };
const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (v: number) => tr({ zh: formatLargeNumber(v) + ' 公噸', en: formatLargeNumber(v) + ' t' });
const KG = { zh: '公斤/人', en: 'kg per person' };
const seq = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });
const PC_SCALES: Record<string, ScaleSpec> = {
  so2: seq([1, 2, 4, 8, 15, 40]),
  nox: seq([4, 8, 12, 16, 25, 40]),
  nh3: seq([3, 5, 7, 10, 15, 25]),
  bc: seq([0.25, 0.5, 0.75, 1, 1.5, 2.5]),
  oc: seq([0.5, 1, 1.5, 2.5, 4, 6]),
  co: seq([20, 30, 45, 65, 100, 150]),
  nmvoc: seq([8, 12, 15, 20, 30, 45]),
};
const EMISSIONS_NOTE: Text = {
  zh: '排放量來自 CEDS（美國太平洋西北國家實驗室的社群排放資料系統，v_2025_03_18），依燃料用量、產量與排放係數推估，不是實測；開發中國家早年的不確定性大。各污染物的計算基準不同（氮氧化物以 NO₂ 計、黑碳與有機碳以碳計），不能互相加總；國際航空與航運不算在任何國家。甲烷與氧化亞氮在「溫室氣體排放」主題（EDGAR）。',
  en: 'Emissions are from CEDS (the Community Emissions Data System of the US Pacific Northwest National Laboratory, v_2025_03_18), estimated from fuel use, production and emission factors rather than measured; early values for developing countries are uncertain. Pollutants are reported on different bases (NOx as NO₂, black and organic carbon as carbon) and cannot be added together; international aviation and shipping are not assigned to any country. Methane and nitrous oxide are in Greenhouse gas emissions (EDGAR).',
};

/** 台灣 TEDS 1 公里網格（公噸／年）：每一種污染物一個點圖層，依格子的排放量分 7 級 */
const TEDS_ITEMS = [
  { id: 'pm25', label: { zh: '細懸浮微粒（PM2.5）', en: 'Fine particulate matter (PM2.5)' }, thresholds: [0.1, 0.5, 1, 3, 10, 50] },
  { id: 'pm10', label: { zh: '懸浮微粒（PM10）', en: 'Particulate matter (PM10)' }, thresholds: [0.3, 1, 3, 8, 30, 100] },
  { id: 'sox', label: { zh: '硫氧化物（SOx）', en: 'Sulphur oxides (SOx)' }, thresholds: [0.05, 0.2, 1, 5, 25, 200] },
  { id: 'nox', label: { zh: '氮氧化物（NOx）', en: 'Nitrogen oxides (NOx)' }, thresholds: [0.5, 2, 5, 15, 50, 300] },
  { id: 'nmhc', label: { zh: '非甲烷碳氫化合物（NMHC，含植物）', en: 'Non-methane hydrocarbons (NMHC, incl. plants)' }, thresholds: [2, 5, 10, 30, 80, 200] },
];
const tpy = (v: number) => tr({ zh: fixed(v, v < 10 ? 2 : 0) + ' 公噸／年', en: fixed(v, v < 10 ? 2 : 0) + ' t/yr' });
function tedsOverlay(item: (typeof TEDS_ITEMS)[number]): PointsOverlayDef {
  const color: ColorClasses = {
    field: item.id,
    title: { zh: '1 公里網格一年的排放量', en: 'Annual emissions per 1 km cell' },
    thresholds: item.thresholds,
    classes: MAP_TOKENS.sequential.map((c, i) => ({
      color: c,
      label:
        i === 0
          ? '< ' + tpy(item.thresholds[0])
          : i === item.thresholds.length
            ? '≥ ' + tpy(item.thresholds[i - 1])
            : fixed(item.thresholds[i - 1], 2) + '–' + tpy(item.thresholds[i]),
    })),
  };
  return {
    kind: 'points',
    id: 'teds-' + item.id,
    file: 'teds.json',
    label: { zh: '台灣的排放網格（TEDS）', en: 'Taiwan emission grid (TEDS)' },
    indicators: ['teds'],
    items: [item.id],
    radius: 1.6,
    // 這種污染物是 0 的格子不畫
    minValue: { field: item.id, stops: [[0, 0.001]] },
    color,
    sortField: item.id,
    tooltip: (p) => ({
      title: tr(item.label),
      detail: tpy(Number(p[item.id] ?? 0)),
      extra: [tr({ zh: '1 公里網格，民國 112 年（2023）推估', en: '1 km cell, 2023 estimate' })],
    }),
  };
}

export const airQuality: TopicDefinition = {
  id: 'air-quality',
  title: { zh: '各國空氣品質', en: 'Air quality by country' },
  shortTitle: { zh: '空氣品質', en: 'Air quality' },
  defaultIndicator: 'pm25',
  defaultYear: 2023,
  // 2026-11-03（製作手冊第十七批 282）：「二氧化氮（衛星影像）」指標鋪那一年 1 月中旬前兩週合成的 OMI 對流層二氧化氮
  // （NASA GIBS，2005 年起）；其他指標的國家有顏色，影像在國家的面下面看不到，所以只在這個指標畫
  satellite: {
    product: 'no2',
    label: { zh: '二氧化氮（1 月中旬兩週合成，NASA OMI；淡黃到暗紅，越紅越多）', en: 'Nitrogen dioxide (two-week composite in mid-January, NASA OMI; pale yellow to dark red, redder is more)' },
    date: ({ year, indicator }) => (indicator === 'no2' && year >= 2005 ? `${year}-01-15` : null),
  },
  sources: [
    {
      name: {
        zh: 'WHO, Global Health Observatory（SDG 11.6.2 PM2.5 濃度、SDG 3.9.1 空氣污染死亡率）',
        en: 'WHO, Global Health Observatory (SDG 11.6.2 PM2.5 concentrations, SDG 3.9.1 air pollution mortality)',
      },
      url: 'https://www.who.int/data/gho/data/themes/air-pollution',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'WashU Atmospheric Composition Analysis Group, SatPM2.5 V6.GL.02 各國人口加權統計（Shen et al., 2024）',
        en: 'WashU Atmospheric Composition Analysis Group, SatPM2.5 V6.GL.02 country-level population-weighted statistics (Shen et al., 2024)',
      },
      url: 'https://sites.wustl.edu/acag/datasets/surface-pm2-5/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '環境部 全國細懸浮微粒手動監測資料', en: 'Ministry of Environment (Taiwan), manual PM2.5 monitoring data' },
      url: 'https://data.moenv.gov.tw/dataset/detail/AQX_P_10',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '環境部 空氣污染物濃度測值（全國 PM2.5 年平均，交叉比對用）',
        en: 'Ministry of Environment (Taiwan), air pollutant concentrations (national PM2.5 annual mean, for cross-checking)',
      },
      url: 'https://data.gov.tw/dataset/89030',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'NASA GIBS：OMI 對流層二氧化氮每日影像（Aura）。We acknowledge the use of imagery provided by services from NASA’s Global Imagery Browse Services (GIBS), part of NASA’s Earth Science Data and Information System (ESDIS).',
        en: 'NASA GIBS: OMI tropospheric nitrogen dioxide daily imagery (Aura). We acknowledge the use of imagery provided by services from NASA’s Global Imagery Browse Services (GIBS), part of NASA’s Earth Science Data and Information System (ESDIS).',
      },
      url: 'https://nasa-gibs.github.io/gibs-api-docs/',
      license: { zh: 'NASA 開放資料（CC0，依要求標示 GIBS）', en: 'NASA open data (CC0; GIBS acknowledged as requested)' },
    },
    {
      name: { zh: '環境部 空氣品質監測月值（台灣測站的二氧化氮）', en: 'Ministry of Environment (Taiwan), monthly air quality monitoring values (NO₂ at Taiwan’s stations)' },
      url: 'https://data.gov.tw/dataset/28202',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'CEDS v_2025_03_18（PNNL，Community Emissions Data System）：七種空氣污染物的各國排放與部門',
        en: 'CEDS v_2025_03_18 (PNNL, Community Emissions Data System): emissions of seven air pollutants by country and sector',
      },
      url: 'https://doi.org/10.5281/zenodo.15059443',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '環境部 空氣污染排放量推估結果（TEDS 13，1 公里網格，民國 112 年）', en: 'Ministry of Environment (Taiwan), air pollutant emission estimates (TEDS 13, 1 km grid, 2023)' },
      url: 'https://data.moenv.gov.tw/dataset/detail/AQX_P_24',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》：人均排放的人口', en: 'UN World Population Prospects 2024: population for per-person emissions' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh:
      'PM2.5 年平均與死亡率是 WHO 用同一套方法估計的（衛星、化學傳輸模式、地面測站與人口分布），不是各國測站的直接量測，可能跟各國官方數字不同。' +
      'WHO 2021 年把 PM2.5 年平均的指引值從 10 下修到 5 μg/m³，另訂 35、25、15、10 μg/m³ 四個過渡目標，地圖的分級對齊這些值。' +
      '超過指引值的人口比例來自另一套衛星推估（WashU ACAG）。' +
      '台灣不在 WHO 資料庫中：PM2.5 年平均用環境部手動監測站的平均（2015 年起），是測站的平均、不是人口加權；死亡率沒有同樣方法的台灣數字，留空。' +
      EMISSIONS_NOTE.zh,
    en:
      'The PM2.5 annual means and death rates are WHO estimates made with one method for every country (satellites, chemical transport models, ground monitors and population distribution), ' +
      'not direct measurements at national monitoring stations, so they may differ from official national figures. ' +
      'In 2021 WHO lowered its guideline for annual mean PM2.5 from 10 to 5 μg/m³ and set four interim targets of 35, 25, 15 and 10 μg/m³; the map classes follow these values. ' +
      'The share of people above the guideline comes from a different satellite-based estimate (WashU ACAG). ' +
      "Taiwan is not in the WHO database: its PM2.5 annual mean is the average of the Ministry of Environment's manual monitoring stations (from 2015), " +
      'a station average rather than a population-weighted one; there is no Taiwanese death rate made with the same method, so it is left blank. ' +
      EMISSIONS_NOTE.en,
  },
  overlays: TEDS_ITEMS.map(tedsOverlay),
  panelExtra: () => import('./panels/AirEmissionsPanel'),
  indicators: [
    {
      id: 'emissions',
      label: { zh: '空氣污染物的排放量', en: 'Air pollutant emissions' },
      description: {
        zh: '一年排放到空氣中的污染物（CEDS 推估，1970–2023 年），子項目七種。二氧化硫 2023 年中國 1,082 萬公噸、印度 986 萬、俄羅斯 545 萬、沙烏地阿拉伯 343 萬；美國 149 萬，比 1980 年的 2,375 萬少 94%；台灣 4.06 萬，比 1980 年的 85.6 萬少 95%。氮氧化物中國 2,060 萬、印度 932 萬、美國 720 萬，台灣 21.5 萬。氨中國 1,199 萬、印度 1,050 萬、美國 431 萬，台灣 15.2 萬，反而比 1980 年的 10.3 萬多，主要來自農業（施肥與糞肥）；氨是 PM2.5 的前驅物。黑碳中國 109 萬、印度 81 萬，台灣 2.41 萬。側欄有這一國這種污染物的部門組成。',
        en: 'Pollutants emitted into the air each year (CEDS estimates, 1970–2023), seven options. Sulphur dioxide in 2023: China 10.82 million tonnes, India 9.86 million, Russia 5.45 million, Saudi Arabia 3.43 million; the US 1.49 million, 94% below its 23.75 million in 1980; Taiwan 40,600, 95% below its 856,000 in 1980. Nitrogen oxides: China 20.6 million, India 9.32 million, the US 7.20 million, Taiwan 215,000. Ammonia: China 12.0 million, India 10.5 million, the US 4.31 million, and Taiwan 152,000, up from 103,000 in 1980, mostly from agriculture (fertiliser and manure); ammonia is a precursor of PM2.5. Black carbon: China 1.09 million, India 809,000, Taiwan 24,100. The side panel shows the sector breakdown for the selected pollutant.',
      },
      unit: TONNES,
      file: 'emissions/{item}.json',
      dimension: SPECIES_DIM,
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: tonnes,
      formatTick: (v) => formatLargeTick(v),
      defaultYear: 2023,
    },
    {
      id: 'emissions-pc',
      label: { zh: '每人的空氣污染物排放', en: 'Air pollutant emissions per person' },
      description: {
        zh: '排放量除以人口（聯合國人口），公斤／人。產油國與煤電多的國家二氧化硫、氮氧化物高（2023 年沙烏地阿拉伯二氧化硫 103 公斤／人），畜牧多的國家氨高（紐西蘭 42.0、烏拉圭 35.6 公斤／人）；台灣二氧化硫 1.74、氮氧化物 9.20、氨 6.52、黑碳 1.03 公斤／人。人口少的島國與產油小國常因為一兩座設施而排在最前面。',
        en: 'Emissions divided by population (UN), in kilograms per person. Oil producers and coal-heavy power systems are high in sulphur dioxide and nitrogen oxides (Saudi Arabia emitted 103 kg of SO₂ per person in 2023), livestock economies in ammonia (New Zealand 42.0 and Uruguay 35.6 kg per person); Taiwan emitted 1.74 kg of SO₂, 9.20 of NOx, 6.52 of ammonia and 1.03 of black carbon per person. Small islands and oil states can top the list because of one or two facilities.',
      },
      unit: KG,
      file: 'emissions-pc/{item}.json',
      dimension: SPECIES_DIM,
      layer: { kind: 'choropleth', scale: PC_SCALES.so2, itemScales: PC_SCALES },
      format: (v) => tr({ zh: fixed(v, v < 10 ? 2 : 1) + ' 公斤/人', en: fixed(v, v < 10 ? 2 : 1) + ' kg per person' }),
      formatTick: (v) => fixed(v, v < 1 ? 2 : 0),
      defaultYear: 2023,
    },
    {
      id: 'teds',
      label: { zh: '台灣的排放網格（TEDS）', en: 'Taiwan emission grid (TEDS)' },
      description: {
        zh: '環境部的空氣污染物排放清冊（TEDS 13）把台灣本島與附近小島的排放推估到 1 公里 × 1 公里的網格（民國 112 年＝2023 年，點源、線源、面源與植物等生物源加總），每個點是一格，顏色是一年的排放量（公噸）。可以看到西部走廊的工業區、火力電廠與都市的交通；全台合計 PM2.5 約 3.26 萬公噸、硫氧化物 3.96 萬、氮氧化物 19.4 萬、非甲烷碳氫化合物 35.2 萬（含植物排放，山區也會偏高）。含綠島、蘭嶼、小琉球、龜山島，澎湖、金門、馬祖不在這份資料；跟上面 CEDS 的台灣數字是不同的推估方法。',
        en: 'Taiwan’s Ministry of Environment emission inventory (TEDS 13) allocates emissions on Taiwan island and its nearby islets to a 1 km × 1 km grid (2023, point, line, area and biogenic sources combined); each dot is a cell, coloured by annual emissions (tonnes). The western corridor’s industrial zones, coal-fired power plants and urban traffic stand out; island-wide totals are about 32,600 tonnes of PM2.5, 39,600 of sulphur oxides, 194,000 of nitrogen oxides and 352,000 of non-methane hydrocarbons (including plants, so mountains also show up). Green Island, Orchid Island, Xiaoliuqiu and Guishan Island are included, but Penghu, Kinmen and Matsu are not; this is a different estimate from the CEDS figure for Taiwan above.',
      },
      unit: '',
      file: 'teds-{item}.json',
      dimension: { label: { zh: '污染物', en: 'Pollutant' }, options: TEDS_ITEMS.map(({ id, label }) => ({ id, label })), defaultOption: 'pm25' },
      layer: { kind: 'none' },
      // 換到這個指標時移到台灣（只有台灣的 1 公里網格）
      focus: [119.9, 21.8, 122.1, 25.4],
      timeless: true,
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，只有台灣的 1 公里網格', en: 'Countries are not coloured; Taiwan’s 1 km grid only' },
    },
    {
      id: 'pm25',
      label: { zh: 'PM2.5 年平均濃度', en: 'PM2.5 annual mean' },
      description: {
        zh: '細懸浮微粒（直徑 2.5 微米以下，能深入肺部）的年平均濃度，依人口分布加權，也就是一般人平均吸到的濃度。WHO 的空氣品質指引值是 5 μg/m³，四個過渡目標是 35、25、15、10 μg/m³。',
        en: 'Annual mean concentration of fine particulate matter (particles under 2.5 micrometres across, which reach deep into the lungs), weighted by where people live: what the average person breathes. The WHO air quality guideline is 5 μg/m³, with interim targets of 35, 25, 15 and 10 μg/m³.',
      },
      unit: UG,
      file: 'pm25.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 25, 35, 50] } },
      format: (v) => `${fixed(v, 1)} ${UG}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'pm25-above-guideline',
      label: { zh: '超過 WHO 指引值的人口比例', en: 'People above WHO guideline' },
      description: {
        zh: '住在 PM2.5 年平均 5 μg/m³（WHO 指引值）以上地方的人口比例，全世界超過 99% 的人都是。來自 WashU ACAG 的衛星推估，跟「PM2.5 年平均濃度」（WHO 的估計）是不同的模型，同一國的兩個數字可能對不上。',
        en: "Share of people living where annual mean PM2.5 is 5 μg/m³ (the WHO guideline) or higher; over 99% of the world's population does. From WashU ACAG's satellite-based estimates, a different model from the WHO estimates behind “PM2.5 annual mean”, so the two figures for a country may not match.",
      },
      unit: '%',
      file: 'pm25-above-guideline.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 75, 90, 99] } },
      format: (v) => `${fixed(v, v >= 99.95 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'no2',
      label: { zh: '二氧化氮（衛星影像）', en: 'Nitrogen dioxide (satellite image)' },
      description: {
        zh: '那一年 1 月中旬前兩週，NASA Aura 衛星的 OMI 測到的對流層二氧化氮（主要來自汽機車、電廠與工廠的燃燒）：淡黃到暗紅，越紅越多，看得到大城市、工業區與航道。每天的軌道之間、雲多的地方沒有資料，用前幾天的補（顯示的是最近一天有值的，不是平均），兩週都被雲擋住的地方（例如冬天的華南）是空的。只有圖、沒有數值，國家不上色；台灣的附註是環境部測站的年平均。',
        en: 'Tropospheric nitrogen dioxide measured by OMI on NASA’s Aura satellite over the two weeks before mid-January of the selected year (mostly from vehicles, power plants and factories): pale yellow to dark red, redder is more, showing big cities, industrial areas and shipping lanes. Gaps between orbits and under clouds are filled from earlier days (the latest day with data is shown, not an average); places cloudy for the whole two weeks (such as southern China in winter) stay blank. Image only, with no values, so countries are not coloured; Taiwan’s note gives the annual mean at its monitoring stations.',
      },
      unit: '',
      file: 'no2-years.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看衛星影像', en: 'Countries are not coloured; see the satellite image' },
    },
    deathRate(
      'air-pollution-deaths',
      { zh: '戶外與室內空氣污染死亡率', en: 'All air pollution deaths' },
      {
        zh: '聯合國永續發展目標 SDG 3.9.1：戶外空氣污染，加上家裡用柴火、木炭、煤炭等固體燃料煮飯取暖造成的室內空氣污染，每十萬人一年的歸因死亡，年齡標準化，只有 2021 年。撒哈拉以南非洲、南亞很多家庭還在用固體燃料，所以特別高；WHO 算的是兩者的合併效果，不是直接相加。',
        en: 'Outdoor plus household air pollution (UN Sustainable Development Goal indicator 3.9.1): deaths per 100,000 people a year attributable to outdoor air pollution and to household air pollution from cooking and heating with solid fuels such as wood, charcoal and coal, age-standardised; 2021 only. Especially high in sub-Saharan Africa and South Asia, where many households still use solid fuels; WHO estimates the joint effect, not a simple sum.',
      },
    ),
  ],
};
