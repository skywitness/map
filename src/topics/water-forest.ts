import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, formatSignedPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { DimensionDef, PointsOverlayDef, TopicDefinition } from './types';
import { topicPart } from './merge';

const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** Aqueduct 的分數（0–5）與等級：0–1 低（<10%）、1–2 低到中（10–20%）、2–3 中到高（20–40%）、3–4 高（40–80%）、4–5 極高（>80%） */
const AQUEDUCT_LEVELS = [
  { zh: '低，<10%', en: 'low, <10%' },
  { zh: '低到中，10–20%', en: 'low–medium, 10–20%' },
  { zh: '中到高，20–40%', en: 'medium–high, 20–40%' },
  { zh: '高，40–80%', en: 'high, 40–80%' },
  { zh: '極高，>80%', en: 'extremely high, >80%' },
];
const aqueductText = (v: number) => {
  const level = AQUEDUCT_LEVELS[Math.min(4, Math.max(0, Math.floor(v)))];
  return tr({ zh: `${fixed(v, 1)}（${level.zh}）`, en: `${fixed(v, 1)} (${level.en})` });
};

/** 取水量的用途（pipeline/topics/water_use.py 的 SECTORS；2026-11-05，製作手冊第二十二批 387） */
const WATER_USE: DimensionDef = {
  label: { zh: '用途', en: 'Use' },
  options: [
    { id: 'agriculture', label: { zh: '農業', en: 'Agriculture' } },
    { id: 'industry', label: { zh: '工業（含電廠冷卻）', en: 'Industry (incl. power-plant cooling)' } },
    { id: 'domestic', label: { zh: '家戶與都市', en: 'Municipal' } },
  ],
  defaultOption: 'agriculture',
};
const BILLION_M3 = { zh: '十億立方公尺', en: 'billion m³' };
const billionM3 = (v: number) =>
  tr({ zh: `${fixed(v, v < 1 ? 3 : v < 10 ? 2 : 1)} 十億立方公尺`, en: `${fixed(v, v < 1 ? 3 : v < 10 ? 2 : 1)} billion m³` });

/** 汙水的指標（2026-11-05，製作手冊第二十二批 388）：汙水處理廠的點只在這三個指標畫 */
const WASTEWATER_INDICATORS = ['wastewater-secondary', 'wastewater-treated', 'wastewater-facilities'];
/** OpenStreetMap 的汙水處理廠（pipeline/topics/water_wastewater.py；ODbL）：縮小時只畫有名稱的，其餘放大到 6 級才載入 */
const WASTEWATER_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'wastewater-plants',
  file: 'wastewater-plants.json',
  indicators: WASTEWATER_INDICATORS,
  label: { zh: '汙水處理廠（OpenStreetMap）', en: 'Wastewater treatment plants (OpenStreetMap)' },
  radius: 2.2,
  color: MAP_TOKENS.hues.blue,
  more: { minZoom: 6 },
  tooltip: (p, { countryName }) => ({
    title: typeof p.n === 'string' && p.n ? p.n : tr({ zh: '（沒有名稱的汙水處理廠）', en: '(unnamed wastewater plant)' }),
    extra: [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : ''],
    properNoun: typeof p.n === 'string' && p.n ? p.n : undefined,
  }),
};

const waterForestOwn: TopicDefinition = {
  id: 'water-forest',
  title: { zh: '各國水資源與森林', en: 'Water and forests by country' },
  shortTitle: { zh: '水資源與森林', en: 'Water & forests' },
  defaultIndicator: 'renewable-water',
  // 各指標的最新年份不同（人均水資源 2023、水資源壓力 2022、飲用水 2024、森林 2025），沒有這一年時用最接近的一年
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'FAO, AQUASTAT（總可再生水資源、世界的水資源壓力、海水淡化；取水量的用途與總量由世界銀行 WDI 轉載）',
        en: 'FAO, AQUASTAT (total renewable water resources, world water stress, desalination; water withdrawal by use and in total via the World Bank WDI)',
      },
      url: 'https://www.fao.org/aquastat/en/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（FAO AQUASTAT 的 SDG 6.4.2 水資源壓力、WHO/UNICEF JMP 飲用水資料）',
        en: 'World Bank, World Development Indicators (FAO AQUASTAT SDG 6.4.2 water stress, WHO/UNICEF JMP drinking water data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: 'FAO, Global Forest Resources Assessment 2025',
      url: 'https://fra-data.fao.org/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '經濟部水利署 水資源利用概況、各標的用水統計、生活用水量統計',
        en: 'Water Resources Agency (Taiwan), water resources utilization and annual water use statistics',
      },
      url: 'https://web.wra.gov.tw/Annualwater/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '農業部林業及自然保育署 全國森林資源調查',
        en: 'Forestry and Nature Conservation Agency (Taiwan), national forest resource inventories',
      },
      url: 'https://www.forest.gov.tw/0000052',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（換算人均水資源）',
        en: 'United Nations, World Population Prospects 2024 (for water per person)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'WRI Aqueduct 4.0 各國排名（缺水壓力的推估；Kuzma et al. 2023）',
        en: 'WRI Aqueduct 4.0 country rankings (projected water stress; Kuzma et al. 2023)',
      },
      url: 'https://www.wri.org/data/aqueduct-40-country-rankings',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '人均水資源是 FAO AQUASTAT 的總可再生水資源（長期平均）除以聯合國的年中人口；水資源壓力用世界銀行轉載的 AQUASTAT（到 2022 年），' +
      '取用量很多國家隔幾年才更新，中間的年份是 FAO 的推估，明顯的錯值已經排除（見各國附註）。' +
      '台灣不在 FAO 與 JMP 的資料中，改用經濟部水利署的數字，口徑見台灣側欄的附註；' +
      '水資源壓力沒有官方的環境流量數字，所以台灣從缺。' +
      '缺水壓力的推估是 WRI Aqueduct 4.0（CC BY 4.0，Kuzma et al. 2023）：用 PCR-GLOBWB 2 水文模型依流域算取水量占可用水量，再依各國用水加權成 0–5 分，有 1979–2019 年的基準與 2030、2050、2080 年三種情境（CMIP6）的推估；跟 SDG 6.4.2 的定義不同，數字不會一致，排名裡也沒有台灣。',
    en:
      "Water per person is FAO AQUASTAT's total renewable water resources (a long-term average) divided by UN " +
      "mid-year population; water stress is AQUASTAT data via the World Bank (to 2022). Many countries report " +
      'withdrawals only every few years, so the years in between are FAO estimates; obvious errors have been ' +
      "removed (see each country's notes). Taiwan is not " +
      "in the FAO or JMP data, so figures from its Water Resources Agency " +
      "are used instead (see the notes in Taiwan's panel); Taiwan has no official environmental flow figure, so its " +
      'water stress is left blank. ' +
      'Projected water stress is from WRI Aqueduct 4.0 (CC BY 4.0, Kuzma et al. 2023): the PCR-GLOBWB 2 hydrological model ' +
      'computes withdrawals as a share of available water per river basin, weighted by each country’s water use into a 0–5 ' +
      'score, for the 1979–2019 baseline and 2030, 2050 and 2080 under three CMIP6 scenarios. It is defined differently from ' +
      'SDG 6.4.2, so the numbers will not match, and Taiwan is not in its rankings.',
  },
  overlays: [WASTEWATER_PLANTS],
  indicators: [
    {
      id: 'renewable-water',
      label: { zh: '人均可再生淡水資源', en: 'Renewable water per person' },
      description: {
        zh: '每人每年分到的可再生淡水：境內降雨形成的河川逕流與地下水，加上從上游國家流入的水，除以人口。低於 1,700 立方公尺是水資源壓力，低於 1,000 是缺水，低於 500 是絕對缺水（Falkenmark 指標）。資源量是長期平均，逐年的變化只來自人口增減。',
        en: 'Renewable freshwater per person per year: river flows and groundwater from rainfall within the country plus inflows from upstream countries, divided by population. Below 1,700 m³ means water stress, below 1,000 scarcity and below 500 absolute scarcity (the Falkenmark indicator). Resources are long-term averages, so changes over time come only from population.',
      },
      unit: { zh: '立方公尺/人/年', en: 'm³ per person per year' },
      file: 'renewable-water.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 1700, 5000, 10000, 50000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 立方公尺`, en: `${fixed(v, 0)} m³` }),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'water-stress',
      label: { zh: '水資源壓力', en: 'Water stress' },
      description: {
        zh: '淡水取用量占可用淡水資源的比例（SDG 6.4.2）；可用資源是可再生淡水扣掉維持河川生態所需的環境流量。FAO 的分級：25% 以下沒有壓力，25–50% 低度、50–75% 中度、75–100% 高度，超過 100% 是嚴重（超抽地下水或靠海水淡化）。',
        en: 'Freshwater withdrawals as a share of available freshwater (SDG 6.4.2), that is renewable resources minus the environmental flows rivers need to stay healthy. FAO levels: below 25% no stress, 25–50% low, 50–75% medium, 75–100% high, above 100% critical (over-pumping groundwater or relying on desalination).',
      },
      unit: '%',
      file: 'water-stress.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 100] } },
      format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'water-use',
      label: { zh: '占取水量', en: 'share of water withdrawal' },
      description: {
        zh: '一年取用的淡水用在哪裡，選上方的「用途」切換（FAO AQUASTAT，世界銀行轉載；多數國家幾年才有一筆，用 10 年內最近一年）。農業：索馬利亞 99.5%、阿富汗 98.2%、印度 90.4%、日本 66.7%、中國 62.1%、美國 39.7%、德國 4.2%。工業含火力與核能電廠的冷卻水，所以蒙特內哥羅與愛沙尼亞 94.2%、奧地利 93.3%、比利時 84.1% 主要是發電，不代表製造業特別多；德國 54.3%、美國 47.2%、中國 17.7%。家戶與都市：德國 41.5%、中國 20.1%、日本 17.0%、美國 13.1%。三項加起來跟 100% 差太多的年份（北馬其頓、賽普勒斯、汶萊等）不用。台灣不在 AQUASTAT 裡，水利署的用水資料還沒接上。',
        en: 'Where a country’s freshwater withdrawals go; switch with “Use” above (FAO AQUASTAT via the World Bank; most countries have a figure only every few years, so the latest within 10 years is used). Agriculture: Somalia 99.5%, Afghanistan 98.2%, India 90.4%, Japan 66.7%, China 62.1%, the US 39.7%, Germany 4.2%. Industry includes cooling water for thermal and nuclear power plants, so Montenegro and Estonia (94.2%), Austria (93.3%) and Belgium (84.1%) mostly reflect power generation rather than manufacturing; Germany 54.3%, the US 47.2%, China 17.7%. Municipal: Germany 41.5%, China 20.1%, Japan 17.0%, the US 13.1%. Years in which the three uses do not add up to about 100% (North Macedonia, Cyprus, Brunei and others) are left out. Taiwan is not in AQUASTAT, and the Water Resources Agency’s figures are not yet included.',
      },
      unit: '%',
      file: 'water-use/{item}.json',
      dimension: WATER_USE,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 70, 90] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'water-withdrawal',
      label: { zh: '年取水量', en: 'Annual water withdrawal' },
      description: {
        zh: '一年從河川、湖泊、地下水等取用的淡水總量（十億立方公尺；FAO AQUASTAT，世界銀行轉載），不含海水淡化與回收水，也不扣蒸發與回歸水，取水不等於耗水。印度 647.5、中國 568.5、美國 444.3、印尼 222.6，世界約 3,853。',
        en: 'Total freshwater withdrawn in a year from rivers, lakes and groundwater (billion m³; FAO AQUASTAT via the World Bank), excluding desalination and reused water and without deducting evaporation or return flows, so withdrawal is not consumption. India 647.5, China 568.5, the US 444.3, Indonesia 222.6; the world about 3,853.',
      },
      unit: BILLION_M3,
      file: 'water-withdrawal.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      format: billionM3,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'desalination',
      label: { zh: '海水淡化產量', en: 'Desalinated water produced' },
      description: {
        zh: '一年海水淡化產出的水（十億立方公尺；FAO AQUASTAT）。2023 年中國 12.81、伊朗 3.50、沙烏地阿拉伯 2.90、阿聯 2.13、科威特 0.76、卡達 0.67，世界 27.27。中國的數字遠高於波灣國家，可能含苦鹹水淡化與廢水回用，口徑可能不同。拖時間軸看波灣國家 1980 年代以後怎麼長起來。台灣（澎湖、金門的海淡廠）不在 AQUASTAT 裡。',
        en: 'Desalinated water produced in a year (billion m³; FAO AQUASTAT). In 2023 China produced 12.81, Iran 3.50, Saudi Arabia 2.90, the UAE 2.13, Kuwait 0.76 and Qatar 0.67; the world 27.27. China’s figure is far above the Gulf states and may include brackish-water desalination and wastewater reuse, so it may not be comparable. Drag the timeline to see the Gulf states grow from the 1980s. Taiwan (plants on Penghu and Kinmen) is not in AQUASTAT.',
      },
      unit: BILLION_M3,
      file: 'desalination.json',
      layer: { kind: 'bubble', legendValues: [0.1, 1, 5] },
      format: billionM3,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      shareOfWorld: true,
    },
    {
      id: 'wastewater-secondary',
      label: { zh: '汙水接到二級處理的人口', en: 'Population connected to secondary wastewater treatment' },
      description: {
        zh: '家裡的汙水接到都市汙水處理廠、而且至少經過二級（生物）處理的人口比例，Eurostat，歐洲 36 國，10 年內最近一年。荷蘭 99.7%、奧地利 99.2%、丹麥 98.0%、瑞士 98.0%、德國 97.1%；克羅埃西亞 36.5%、塞爾維亞 15.5%、阿爾巴尼亞 12.6%。台灣用國土管理署 2024 年的公共污水下水道普及率 39.7%（另有專用下水道與建築物污水設施，合計 72.1%，點台灣看）。英國、科索沃不在 Eurostat 可商用的範圍，沒有放。藍點是 OpenStreetMap 上的汙水處理廠（全球約 9 萬個，法國比美國多，量的是各國畫得多完整，不能比數量）。',
        en: 'Share of the population whose wastewater goes to an urban treatment plant with at least secondary (biological) treatment, from Eurostat for 36 European countries, latest year within 10 years. The Netherlands 99.7%, Austria 99.2%, Denmark and Switzerland 98.0%, Germany 97.1%; Croatia 36.5%, Serbia 15.5%, Albania 12.6%. Taiwan shows the National Land Management Agency’s public sewer connection rate for 2024, 39.7% (dedicated sewers and on-site facilities bring the total to 72.1%; click Taiwan). The UK and Kosovo fall outside the Eurostat data cleared for commercial reuse and are not shown. Blue dots are wastewater plants on OpenStreetMap (about 90,000 worldwide; France has more than the US, which reflects mapping completeness, so counts are not comparable).',
      },
      unit: '%',
      file: 'wastewater-secondary.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 60, 80, 90, 95] } },
      format: percent,
      formatTick: percentTick,
    },
    {
      id: 'wastewater-treated',
      label: { zh: '處理的都市汙水量', en: 'Municipal wastewater treated' },
      description: {
        zh: '一年經過處理的都市汙水量（十億立方公尺，FAO AQUASTAT，10 年內最近一年）。AQUASTAT 的產生、收集、處理量是不同年份與口徑拼起來的，互相除會得到幾千 % 的「處理率」，所以只畫量，不算比例。台灣不在 AQUASTAT 裡。',
        en: 'Municipal wastewater treated in a year (billion m³, FAO AQUASTAT, latest year within 10 years). AQUASTAT’s produced, collected and treated volumes come from different years and definitions, and dividing them gives “treatment rates” of thousands of per cent, so only volumes are shown. Taiwan is not in AQUASTAT.',
      },
      unit: BILLION_M3,
      file: 'wastewater-treated.json',
      layer: { kind: 'bubble', legendValues: [0.1, 1, 10] },
      format: billionM3,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      shareOfWorld: false,
    },
    {
      id: 'wastewater-facilities',
      label: { zh: '都市汙水處理廠數', en: 'Municipal wastewater treatment plants' },
      description: {
        zh: '都市汙水處理廠的座數（FAO AQUASTAT，10 年內最近一年，各國申報的定義不同，大型與村落小廠都算一座）。台灣不在 AQUASTAT 裡，國土管理署的公共污水處理廠名冊有 82 座。',
        en: 'Number of municipal wastewater treatment plants (FAO AQUASTAT, latest year within 10 years; countries report differently, and large plants and village works each count as one). Taiwan is not in AQUASTAT; the National Land Management Agency lists 82 public plants.',
      },
      unit: { zh: '座', en: 'plants' },
      file: 'wastewater-facilities.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: `${fixed(v, 0)} plants` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'aqueduct',
      label: { zh: '缺水壓力的推估（Aqueduct）', en: 'Projected water stress (Aqueduct)' },
      description: {
        zh: 'WRI Aqueduct 4.0 的水資源壓力分數（0–5，取水量占可用水量：0–1 低 <10%、1–2 低到中 10–20%、2–3 中到高 20–40%、3–4 高 40–80%、4–5 極高 >80%），依流域的水文模型算、再依各國用水加權。時間軸是 1979–2019 年的基準與 2030、2050、2080 年的推估，可以選三種情境。跟上面的 SDG 6.4.2「水資源壓力」定義不同，數字不會一致；國家排名沒有台灣（台灣本島所在流域的分數見附註）。',
        en: 'WRI Aqueduct 4.0 water stress score (0–5, withdrawals as a share of available water: 0–1 low <10%, 1–2 low–medium 10–20%, 2–3 medium–high 20–40%, 3–4 high 40–80%, 4–5 extremely high >80%), computed by a hydrological model per river basin and weighted by each country’s water use. The timeline holds the 1979–2019 baseline and projections for 2030, 2050 and 2080 under three scenarios. It is defined differently from the SDG 6.4.2 water stress above, so the numbers will not match; Taiwan is not in the country rankings (see the notes for the basin covering most of the island).',
      },
      unit: { zh: '分（0–5）', en: 'score (0–5)' },
      file: 'aqueduct-{item}.json',
      dimension: {
        label: { zh: '情境', en: 'Scenario' },
        options: [
          { id: 'opt', label: { zh: '樂觀（SSP1-2.6）', en: 'Optimistic (SSP1 RCP2.6)' } },
          { id: 'bau', label: { zh: '照常發展（SSP3-7.0）', en: 'Business as usual (SSP3 RCP7.0)' } },
          { id: 'pes', label: { zh: '悲觀（SSP5-8.5）', en: 'Pessimistic (SSP5 RCP8.5)' } },
        ],
        defaultOption: 'bau',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4] } },
      format: aqueductText,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2019,
      timeAxis: {
        label: { zh: '基準期與推估年份', en: 'Baseline and projection years' },
        year: (y) => (y === 2019 ? tr({ zh: '基準期（1979–2019）', en: 'baseline (1979–2019)' }) : tr({ zh: `${y} 年推估`, en: `${y} projection` })),
        tick: (y) => (y === 2019 ? tr({ zh: '基準', en: 'Baseline' }) : String(y)),
      },
      noValue: { TWN: { zh: 'Aqueduct 的國家排名沒有台灣', en: 'Taiwan is not in Aqueduct’s country rankings' } },
    },
    {
      id: 'safe-water',
      label: { zh: '安全管理的飲用水', en: 'Safely managed drinking water' },
      description: {
        zh: '使用「安全管理」飲用水的人口比例（SDG 6.1.1）：水源經過改善（自來水、受保護的井或泉水等），在住家就有、需要時就有，而且沒有糞便與重要化學物質汙染。很多國家缺水質資料，所以中國、澳洲等國是灰色。',
        en: 'Share of people using safely managed drinking water (SDG 6.1.1): an improved source (piped water, protected wells or springs and so on) on premises, available when needed and free from faecal and priority chemical contamination. Many countries lack water quality data, so China, Australia and others are grey.',
      },
      unit: '%',
      file: 'safe-water.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 75, 90, 95, 99] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'forest-cover',
      label: { zh: '森林覆蓋率', en: 'Forest cover' },
      description: {
        zh: '森林面積占土地面積的比例。森林是 0.5 公頃以上、樹冠覆蓋超過 10%、樹木可長到 5 公尺高的土地，含人工林，不含果園、都市公園與以農業為主的土地。FAO 每 5 年評估一次（2010 年以前每 10 年）。',
        en: 'Forest area as a share of land area. Forest is land over 0.5 ha with tree canopy above 10% and trees able to reach 5 m, including plantations but not orchards, urban parks or land mainly used for farming. FAO assesses it every 5 years (every 10 years before 2010).',
      },
      unit: '%',
      file: 'forest-cover.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 50, 70] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'forest-change',
      label: { zh: '森林面積年變化率', en: 'Annual forest area change' },
      description: {
        zh: '森林面積的平均年變化率：FRA 前後兩個評估年之間的複利年增率，標在後面那一年（2025 年是 2020–2025 年的平均，2000、2010 年是前 10 年的平均），可以避開逐年的雜訊。負值（橘色）是森林減少，正值（青綠色）是增加。',
        en: 'Average yearly change in forest area: the compound annual rate between two FRA assessment years, shown at the later year (2025 is the 2020–2025 average; 2000 and 2010 average the previous 10 years), which smooths out year-to-year noise. Negative (orange) means forest loss, positive (teal) a gain.',
      },
      unit: { zh: '%/年', en: '% per year' },
      file: 'forest-change.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-1, -0.5, -0.1, 0.1, 0.5, 1] } },
      format: (v) => tr({ zh: `${formatSignedPercent(v, 2)}／年`, en: `${formatSignedPercent(v, 2)} a year` }),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
  ],
};

/**
 * 2026-11-04 主題整併（併3）：森林的兩個指標（森林覆蓋率、森林面積年變化率）搬到「森林」主題（forest.ts，跟人工林、油棕園一起），
 * 這個主題只留水資源。資料照舊在 water-forest/，舊網址的 ind=forest-cover 由 redirects.ts 轉過去
 */
const FOREST_INDICATORS = ['forest-cover', 'forest-change'];
/** 資料來源的順序：AQUASTAT、WDI、FRA 2025、水利署、林保署、WPP、Aqueduct；森林用 FRA 與林保署 */
const FOREST_SOURCES = [2, 4];

export const forestCoverPart = topicPart(
  {
    ...waterForestOwn,
    // 汙水處理廠的點只屬於水資源，不要跟著搬到森林
    overlays: [],
    sources: waterForestOwn.sources.filter((_, i) => FOREST_SOURCES.includes(i)),
    note: {
      zh: '森林用 FAO 全球森林資源評估 FRA 2025，只有 1990、2000、2010、2015、2020、2025 年。台灣不在 FAO 的資料中，改用林業及自然保育署的全國森林資源調查，口徑見台灣側欄的附註。',
      en: "Forest data are from the FAO Global Forest Resources Assessment 2025 and cover only 1990, 2000, 2010, 2015, 2020 and 2025. Taiwan is not in the FAO data, so the national forest inventory of its Forestry and Nature Conservation Agency is used instead (see the notes in Taiwan's panel).",
    },
  },
  { only: FOREST_INDICATORS, name: { zh: '森林覆蓋', en: 'Forest cover' } },
);

export const waterForest: TopicDefinition = {
  ...waterForestOwn,
  title: { zh: '各國水資源', en: 'Water resources by country' },
  shortTitle: { zh: '水資源', en: 'Water' },
  sources: waterForestOwn.sources.filter((_, i) => !FOREST_SOURCES.includes(i)),
  indicators: waterForestOwn.indicators.filter((i) => !FOREST_INDICATORS.includes(i.id)),
};
