import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { FUELS, OPERATING_PLANTS, powerPlants } from './power-plants';
import type { IndicatorDef, Text, TopicDefinition } from './types';
import { electricityPeakPart } from './electricity-peak';
import { withParts } from './parts';

const twh = (v: number) => `${fixed(v, v < 10 ? 2 : v < 1000 ? 1 : 0)} TWh`;
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const KWH = { zh: '度', en: 'kWh' };

function share(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '%',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: pct,
    formatTick: pctTick,
    compareWorld: true,
  };
}

/**
 * 各能源的發電占比（2026-10-31，製作手冊第十批 162）：Ember 2025 年只有 91 國，其他停在 2024 年，
 * 使用者決定各國用自己最新的一年（指標檔的 latestWithin，地圖與 tooltip 標出實際年份），預設看 2025 年
 */
function fuelShare(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return { ...share(id, label, description, thresholds), defaultYear: 2025 };
}

const NO_TWN = { TWN: { zh: '沒有（見附註）', en: 'None (see note)' } };

const fuel = (id: string) => FUELS.find((f) => f.id === id)!.color;
/** 總發電量的圓餅：化石燃料（燃煤、燃氣、其他化石）、核能、再生能源（水力、風力、太陽能、生質能、其他再生）依序排 */
const GENERATION_MIX = [
  { indicator: 'coal-share', color: fuel('coal'), label: { zh: '燃煤', en: 'Coal' } },
  { indicator: 'gas-share', color: fuel('oil-gas'), label: { zh: '燃氣', en: 'Gas' } },
  { indicator: 'other-fossil-share', color: '#8f8a84', label: { zh: '燃油等其他化石', en: 'Oil and other fossil' } },
  { indicator: 'nuclear-share', color: fuel('nuclear'), label: { zh: '核能', en: 'Nuclear' } },
  { indicator: 'hydro-share', color: fuel('hydro'), label: { zh: '水力', en: 'Hydro' } },
  { indicator: 'wind-share', color: fuel('wind'), label: { zh: '風力', en: 'Wind' } },
  { indicator: 'solar-share', color: fuel('solar'), label: { zh: '太陽能', en: 'Solar' } },
  { indicator: 'bioenergy-share', color: fuel('bioenergy'), label: { zh: '生質能', en: 'Bioenergy' } },
  { indicator: 'other-renewables-share', color: fuel('geothermal'), label: { zh: '地熱等其他再生', en: 'Geothermal and other renewables' } },
];

export const electricity: TopicDefinition = withParts({
  id: 'electricity',
  title: { zh: '各國發電量', en: 'Electricity by country' },
  shortTitle: { zh: '發電量', en: 'Electricity' },
  defaultIndicator: 'generation',
  defaultYear: 2024,
  sources: [
    { name: 'Ember, Yearly Electricity Data', url: 'https://ember-energy.org/data/yearly-electricity-data/', license: 'CC BY 4.0' },
    // 2026-11-07（第二十五批 520–522、531）輸配電損失、地熱與海洋能、離岸風電、再生能源占最終能源消費、台灣尖峰負載
    {
      name: {
        zh: '美國能源資訊署（EIA）International Energy Statistics：輸配電損失、淨發電量、地熱與海洋能的裝置容量',
        en: 'US Energy Information Administration (EIA), International Energy Statistics: distribution losses, net generation, geothermal and ocean capacity',
      },
      url: 'https://www.eia.gov/international/data/world',
      license: { zh: '公有領域（美國政府著作）', en: 'Public domain (US government work)' },
    },
    {
      name: { zh: 'Global Energy Monitor：Global Integrated Power Tracker（離岸風電機組，2026 年 9 月版）', en: 'Global Energy Monitor, Global Integrated Power Tracker (offshore wind units, September 2026)' },
      url: 'https://globalenergymonitor.org/projects/global-integrated-power-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '世界銀行 WDI：再生能源占最終能源消費（EG.FEC.RNEW.ZS，原始資料 IEA）；Eurostat：再生能源占比（nrg_ind_ren）',
        en: 'World Bank WDI: renewable energy share of final energy consumption (EG.FEC.RNEW.ZS, from the IEA); Eurostat: share of renewable energy (nrg_ind_ren)',
      },
      url: 'https://data.worldbank.org/indicator/EG.FEC.RNEW.ZS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '台灣電力公司：歷年尖峰負載及備用容量率', en: 'Taipower: peak load and reserve margin by year' },
      url: 'https://data.gov.tw/dataset/8307',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
    {
      name: 'Ember, Global Renewable Power Sector Targets 2030',
      url: 'https://ember-energy.org/data/global-renewable-power-sector-targets-2030/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院：能源配比及電價政策專案報告（2024-10-29）、能源轉型路徑規劃（2017-06-13，台灣的再生能源目標）', en: 'Executive Yuan: report on the energy mix and electricity prices (29 Oct 2024) and Energy Transition Pathway Plan (13 Jun 2017) (Taiwan’s renewables targets)' },
      url: 'https://www.ey.gov.tw/File/D3AAA937ED1EEB09',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '世界銀行 WDI：電力普及率（EG.ELC.ACCS.ZS）、人口（SP.POP.TOTL）', en: 'World Bank WDI: access to electricity (EG.ELC.ACCS.ZS), population (SP.POP.TOTL)' },
      url: 'https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS',
      license: 'CC BY 4.0',
    },
    // 預設關閉的電廠圖層（發電廠地圖主題的資料）
    powerPlants.sources[0],
  ],
  note: {
    zh: '1 TWh（太瓦時）＝ 10 億度電。各能源的占比在 2025 年只有 91 國有值，其他國家用 2024 年並標出年份。2030 年的再生能源目標取 Ember 整理、標記採用的最新一份文件（有的文件寫小數，換成 %；不用它的彙總表，因為彙總表會把不同文件的數字加在一起）；比利時、馬來西亞是 Ember 依現況的推估，美國、挪威是第三方研究，不是政府目標。台灣不在 Ember 的目標檔，用行政院公布的目標。電力普及率是世界銀行依家戶調查整理的，高所得國家多半直接當成 100%。',
    en: '1 TWh (terawatt-hour) = 1 billion kWh. Shares by source cover only 91 countries in 2025; the others use 2024, with the year shown. 2030 renewable targets take the latest document Ember has compiled and marked as used (some documents give fractions, converted to %; Ember’s summary table is not used because it adds up figures from different documents); Belgium and Malaysia are Ember’s own estimates and the US and Norway third-party studies, not government targets. Taiwan is not in Ember’s target file and uses the targets published by the Executive Yuan. Electricity access is the World Bank’s compilation of household surveys; most high-income countries are simply taken as 100%.',
  },
  panelExtra: () => import('./panels/ElectricityPanel'),
  // 運轉中的電廠點借用發電廠地圖主題的資料檔（OverlayBase.topic），預設關閉、第一次打開才下載
  overlays: [{ ...OPERATING_PLANTS, topic: 'power-plants', hidden: true }],
  indicators: [
    {
      id: 'generation',
      label: { zh: '總發電量', en: 'Electricity generation' },
      description: {
        zh: '一年的總發電量，1 TWh 等於 10 億度。圓的面積與發電量成正比，圓餅的各片是各能源的占比（燃煤、燃氣、核能、水力、風力、太陽能…）。',
        en: 'Total electricity generated in a year; 1 TWh is 1 billion kWh. Circle area is proportional to generation, and the slices show each source’s share (coal, gas, nuclear, hydro, wind, solar…).',
      },
      unit: 'TWh',
      file: 'generation.json',
      // 圓餅（2026-11-01）：各能源的占比，顏色跟發電廠地圖的燃料一樣（燃煤、燃氣、核能…）
      layer: { kind: 'bubble', legendValues: [10, 100, 1000], pie: { parts: GENERATION_MIX } },
      format: twh,
      formatTick: (v) => `${fixed(v, 0)} TWh`,
      shareOfWorld: true,
    },
    {
      id: 'demand-per-capita',
      label: { zh: '人均用電量', en: 'Electricity use per person' },
      description: {
        zh: '全國用電量除以人口，含家庭、工業與商業用電。單位是度（kWh）。',
        en: 'National electricity demand divided by population, including households, industry and businesses. In kWh.',
      },
      unit: KWH,
      file: 'demand-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2500, 5000, 7500, 10000] } },
      format: (v) => `${fixed(v, 0)} ${tr(KWH)}`,
      formatTick: (v) =>
        v >= 1000 ? `${fixed(v / 1000, v % 1000 === 0 ? 0 : 1)}${tr({ zh: '千', en: 'K' })}` : fixed(v, 0),
      compareWorld: true,
    },
    share(
      'renewables-share',
      { zh: '再生能源占比', en: 'Renewables share' },
      {
        zh: '水力、風力、太陽能、生質能等再生能源占總發電量的比例。',
        en: 'Share of electricity generated from renewables such as hydro, wind, solar and bioenergy.',
      },
      [10, 20, 30, 50, 70, 90],
    ),
    share(
      'clean-share',
      { zh: '低碳能源占比', en: 'Low-carbon share' },
      {
        zh: '再生能源加上核能，也就是發電時幾乎不排放二氧化碳的能源。',
        en: 'Renewables plus nuclear: sources that emit almost no CO₂ when generating electricity.',
      },
      [10, 20, 30, 50, 70, 90],
    ),
    share(
      'coal-share',
      { zh: '燃煤占比', en: 'Coal share' },
      { zh: '燃煤發電占總發電量的比例。', en: 'Share of electricity generated from coal.' },
      [5, 10, 20, 40, 60, 80],
    ),
    share(
      'nuclear-share',
      { zh: '核能占比', en: 'Nuclear share' },
      {
        zh: '核能發電占總發電量的比例。沒有核電廠的國家顯示為 0。',
        en: 'Share of electricity generated from nuclear power. Countries without nuclear plants show 0.',
      },
      [1, 5, 10, 20, 30, 50],
    ),
    fuelShare(
      'gas-share',
      { zh: '燃氣占比', en: 'Gas share' },
      {
        zh: '天然氣發電占總發電量的比例。2025 年世界 21.7%；土庫曼、巴林、千里達及托巴哥、阿爾及利亞幾乎全靠燃氣，卡達 96.0%（2024 年）；台灣 48.8%，是最大的發電來源。',
        en: 'Share of electricity generated from natural gas. 21.7% worldwide in 2025; Turkmenistan, Bahrain, Trinidad and Tobago and Algeria rely almost entirely on gas, and Qatar on it for 96.0% (2024); Taiwan 48.8%, its largest source.',
      },
      [5, 10, 20, 40, 60, 80],
    ),
    fuelShare(
      'hydro-share',
      { zh: '水力占比', en: 'Hydro share' },
      {
        zh: '水力發電占總發電量的比例。2025 年世界 13.9%；不丹、巴拉圭（99.5%）、尼泊爾、衣索比亞（96.5%）幾乎全靠水力，挪威約九成；台灣 1.9%。',
        en: 'Share of electricity generated from hydropower. 13.9% worldwide in 2025; Bhutan, Paraguay (99.5%), Nepal and Ethiopia (96.5%) rely almost entirely on hydro, and Norway on it for about 90%; Taiwan 1.9%.',
      },
      [5, 10, 20, 40, 60, 80],
    ),
    fuelShare(
      'wind-share',
      { zh: '風力占比', en: 'Wind share' },
      {
        zh: '風力發電（陸域加離岸）占總發電量的比例。2025 年世界 8.5%；丹麥 56.9% 最高，立陶宛 45.0%、烏拉圭 40.5%、愛爾蘭 37.3%；台灣 4.2%。',
        en: 'Share of electricity generated from wind (onshore and offshore). 8.5% worldwide in 2025; Denmark is highest at 56.9%, followed by Lithuania (45.0%), Uruguay (40.5%) and Ireland (37.3%); Taiwan 4.2%.',
      },
      [1, 5, 10, 20, 30, 40],
    ),
    fuelShare(
      'solar-share',
      { zh: '太陽能占比', en: 'Solar share' },
      {
        zh: '太陽能發電占總發電量的比例。2025 年世界 8.8%；庫克群島、巴勒斯坦、納米比亞、黎巴嫩（2024 年）與盧森堡 30.9%、北馬其頓 28.2% 最高；台灣 5.5%。小國的比例年年跳動較大。',
        en: 'Share of electricity generated from solar. 8.8% worldwide in 2025; the Cook Islands, Palestine, Namibia and Lebanon (2024) and Luxembourg (30.9%) and North Macedonia (28.2%) are highest; Taiwan 5.5%. Shares in small countries swing more from year to year.',
      },
      [1, 5, 10, 15, 20, 30],
    ),
    fuelShare(
      'bioenergy-share',
      { zh: '生質能占比', en: 'Bioenergy share' },
      {
        zh: '生質能（木材、農業廢棄物、沼氣、垃圾焚化等）發電占總發電量的比例。2025 年世界 2.0%；史瓦帝尼、貝里斯、澳門約三成（2024 年），盧森堡 25.9%、烏拉圭 24.7%；台灣 0.8%。',
        en: 'Share of electricity generated from bioenergy (wood, crop waste, biogas, waste incineration and so on). 2.0% worldwide in 2025; Eswatini, Belize and Macao about 30% (2024), Luxembourg 25.9% and Uruguay 24.7%; Taiwan 0.8%.',
      },
      [1, 2, 5, 10, 20, 30],
    ),
    fuelShare(
      'other-fossil-share',
      { zh: '燃油等其他化石占比', en: 'Oil and other fossil share' },
      {
        zh: '燃煤、燃氣以外的化石燃料（主要是燃油、柴油；Ember 的 Other Fossil）發電占總發電量的比例。2025 年世界 2.8%；甘比亞、格瑞那達、幾內亞比索、蒙哲臘這類小國與島國幾乎全靠燃油發電（2024 年）；台灣 1.5%。',
        en: 'Share of electricity generated from fossil fuels other than coal and gas (mainly oil and diesel; Ember’s “Other Fossil”). 2.8% worldwide in 2025; small countries and islands such as the Gambia, Grenada, Guinea-Bissau and Montserrat rely almost entirely on oil (2024); Taiwan 1.5%.',
      },
      [1, 5, 10, 25, 50, 90],
    ),
    fuelShare(
      'other-renewables-share',
      { zh: '地熱等其他再生占比', en: 'Geothermal and other renewables share' },
      {
        zh: '水力、風力、太陽能、生質能以外的再生能源（主要是地熱，也有潮汐；Ember 的 Other Renewables）占總發電量的比例。2025 年世界 0.3%；肯亞 45.9%、冰島 28.7%、薩爾瓦多 24.2%、紐西蘭 22.2%。Ember 沒有台灣的值。',
        en: 'Share of electricity generated from renewables other than hydro, wind, solar and bioenergy (mainly geothermal, also tidal; Ember’s “Other Renewables”). 0.3% worldwide in 2025; Kenya 45.9%, Iceland 28.7%, El Salvador 24.2% and New Zealand 22.2%. Ember has no value for Taiwan.',
      },
      [0.5, 1, 5, 10, 20, 40],
    ),
    {
      id: 'carbon-intensity',
      label: { zh: '發電碳排強度', en: 'Carbon intensity of electricity' },
      description: {
        zh: '每發一度電排放的溫室氣體（公克二氧化碳當量，含甲烷等；2026-11-07 起用 Ember 的新檔，之前只算二氧化碳）。燃煤越多越高，再生能源與核能越多越低：法國靠核能、巴拉圭靠水力，結果一樣低。2025 年（沒有的用 2024 年）台灣 634、印度 671、中國 528、澳洲 518、日本 474、南韓 418、美國 384、德國 334；法國 41、瑞典 35、巴拉圭 25、衣索比亞 23；土庫曼 1,306（2024 年）、烏茲別克 1,000 最高。各國所有部門的排放見「各國溫室氣體排放」主題。',
        en: 'Greenhouse gases emitted per kWh generated, in grams of CO₂ equivalent (including methane and others; from 7 November 2026 this uses Ember’s new file, which previously counted CO₂ only). More coal means higher; more renewables and nuclear means lower: France with nuclear and Paraguay with hydropower both end up low. In 2025 (2024 where 2025 is missing): Taiwan 634, India 671, China 528, Australia 518, Japan 474, South Korea 418, the US 384, Germany 334; France 41, Sweden 35, Paraguay 25, Ethiopia 23; Turkmenistan (1,306 in 2024) and Uzbekistan (1,000) are highest. For emissions from all sectors, see Greenhouse gas emissions by country.',
      },
      unit: { zh: 'gCO₂e/度', en: 'gCO₂e/kWh' },
      file: 'carbon-intensity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 300, 400, 500, 700] } },
      format: (v) => `${fixed(v, 0)} ${tr({ zh: '公克/度', en: 'g/kWh' })}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      // 2025 年只有 94 國，其他用 2024 年（指標檔的 latestWithin）
      defaultYear: 2025,
    },
    {
      id: 'renewables-target',
      label: { zh: '2030 年再生能源目標', en: '2030 renewables target' },
      description: {
        zh: '各國 2030 年再生能源發電占比的目標（Ember 整理的國家能源計畫、法規等，取最新的一份）。德國 75%、日本 38%、印度 42.3%、越南 47%、南韓 20%；台灣 30%（行政院 2024 年的專案報告；原本是 2025 年 20%）。比利時、馬來西亞是 Ember 依現況的推估，美國、挪威是第三方研究，不是政府目標（滑過地圖有寫）。中國、英國、瑞典等 20 國只有裝置容量的目標，沒有占比，地圖留白。',
        en: 'Each country’s target share of renewables in electricity generation for 2030 (from national energy plans, laws and other documents compiled by Ember; the latest one is used). Germany 75%, Japan 38%, India 42.3%, Viet Nam 47%, South Korea 20%; Taiwan 30% (the Executive Yuan’s 2024 report; the earlier goal was 20% by 2025). Belgium and Malaysia are Ember’s own estimates and the US and Norway third-party studies, not government targets (noted on hover). China, the UK, Sweden and 17 other countries have only capacity targets, with no share, and are left blank.',
      },
      unit: '%',
      file: 'renewables-target.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 70, 90] } },
      format: (v) => tr({ zh: `目標 ${fixed(v, v % 1 === 0 ? 0 : 1)}%`, en: `Target ${fixed(v, v % 1 === 0 ? 0 : 1)}%` }),
      formatTick: pctTick,
      timeless: true,
      missing: { zh: '沒有 2030 年的占比目標（或 Ember 沒有收錄）', en: 'No 2030 share target (or none compiled by Ember)' },
    },
    {
      id: 'renewables-gap',
      label: { zh: '距離 2030 年目標', en: 'Gap to the 2030 target' },
      description: {
        zh: '2030 年的再生能源目標減掉最新一年（2025 年，沒有的用 2024 年）的再生能源發電占比，單位是百分點；負的是已經達到。沙烏地阿拉伯差 45.8（目標 50%，2025 年 4.2%）、澳洲 42.2、希臘 33.7、愛爾蘭 33.6；台灣差 17.6（目標 30%，2025 年 12.4%）；巴西、蒙特內哥羅、奈及利亞、挪威已經超過，冰島、阿爾巴尼亞剛好達到。',
        en: 'The 2030 renewables target minus the latest renewables share of generation (2025, or 2024 where 2025 is missing), in percentage points; negative means already reached. Saudi Arabia is 45.8 points short (target 50%, 4.2% in 2025), Australia 42.2, Greece 33.7 and Ireland 33.6; Taiwan 17.6 (target 30%, 12.4% in 2025); Brazil, Montenegro, Nigeria and Norway have already passed theirs, and Iceland and Albania have exactly reached them.',
      },
      unit: { zh: '百分點', en: 'pp' },
      file: 'renewables-gap.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 5, 10, 20, 30] } },
      format: (v) =>
        v <= 0
          ? tr({ zh: `已達到（超過 ${fixed(-v, 1)} 個百分點）`, en: `Reached (${fixed(-v, 1)} pp above)` })
          : tr({ zh: `還差 ${fixed(v, 1)} 個百分點`, en: `${fixed(v, 1)} pp short` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
      lowerIsBetter: true,
      missing: { zh: '沒有 2030 年的占比目標', en: 'No 2030 share target' },
    },
    {
      id: 'access',
      label: { zh: '電力普及率', en: 'Access to electricity' },
      description: {
        zh: '能用電的人口比例（世界銀行的全球電氣化資料庫，依各國的家戶調查）。2024 年世界 91.9%；南蘇丹 5.4%、查德 13.4%、馬拉威 15.6%、中非 18.2% 最低，印度、印尼 99.9%，北韓 61.4%。121 國是 100%（高所得國家多半直接當成 100%，不是調查值）。夜間燈光主題的「住在沒有燈光的地方」是衛星推估，跟這裡不同。',
        en: 'Share of the population with access to electricity (the World Bank’s Global Electrification Database, from household surveys). 91.9% worldwide in 2024; South Sudan (5.4%), Chad (13.4%), Malawi (15.6%) and the Central African Republic (18.2%) are lowest, India and Indonesia 99.9%, North Korea 61.4%. 121 countries are at 100% (most high-income countries are simply taken as 100%, not surveyed). The night lights topic’s “living without lights” is a satellite estimate and differs from this.',
      },
      unit: '%',
      file: 'access.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 75, 90, 99] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      noValue: NO_TWN,
    },
    {
      id: 'without-access',
      label: { zh: '沒有電的人數', en: 'People without electricity' },
      description: {
        zh: '沒有電可用的人數：100% 減電力普及率，乘上人口（世界銀行）。圓的面積與人數成正比。2024 年世界約 6.57 億人，奈及利亞 8,730 萬、剛果民主共和國 8,470 萬、衣索比亞 5,730 萬、坦尚尼亞 3,260 萬最多。',
        en: 'People without access to electricity: 100% minus the access rate, times population (World Bank). Circle area is proportional to the number. About 657 million worldwide in 2024; Nigeria (87.3 million), DR Congo (84.7 million), Ethiopia (57.3 million) and Tanzania (32.6 million) have the most.',
      },
      unit: { zh: '人', en: 'people' },
      file: 'without-access.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 5e7] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} people` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
      noValue: NO_TWN,
    },
    // 2026-11-07（製作手冊第二十五批 519、520）裝置容量、容量因數、輸配電損失率（pipeline/topics/electricity_capacity.py）
    {
      id: 'capacity',
      label: { zh: '發電裝置容量', en: 'Installed generating capacity' },
      description: {
        zh: '蓋了多少電廠（不是發了多少電）：各國年底的發電裝置容量（Ember，2000–2025）。2024 年合計：中國 3,193 GW、美國 1,294、印度 505、日本 320、德國 248、巴西 245；台灣 62.15 GW（燃氣 19.39、燃煤 18.90、太陽光電 14.28、風力 3.91、水力 2.12、核能 0.95）。太陽光電從 2000 年全世界約 1 GW 長到 2024 年約 1,870 GW，中國 887 GW。容量是年底值、只算併網；台灣經濟部能源署的數字含自用發電設備，比較大。',
        en: 'How much generating capacity has been built (not how much electricity was produced): installed capacity at year end (Ember, 2000–2025). Totals in 2024: China 3,193 GW, the US 1,294, India 505, Japan 320, Germany 248, Brazil 245; Taiwan 62.15 GW (gas 19.39, coal 18.90, solar 14.28, wind 3.91, hydro 2.12, nuclear 0.95). Solar grew from about 1 GW worldwide in 2000 to about 1,870 GW in 2024, 887 GW of it in China. Capacity is at year end and grid-connected only; Taiwan’s Energy Administration figures include autoproducers and are larger.',
      },
      unit: 'GW',
      file: 'capacity/{item}.json',
      dimension: {
        label: { zh: '能源', en: 'Source' },
        options: [
          { id: 'total', label: { zh: '合計', en: 'Total' } },
          { id: 'coal', label: { zh: '燃煤', en: 'Coal' } },
          { id: 'gas', label: { zh: '燃氣', en: 'Gas' } },
          { id: 'other-fossil', label: { zh: '其他化石燃料', en: 'Other fossil' } },
          { id: 'nuclear', label: { zh: '核能', en: 'Nuclear' } },
          { id: 'hydro', label: { zh: '水力', en: 'Hydro' } },
          { id: 'wind', label: { zh: '風力', en: 'Wind' } },
          { id: 'solar', label: { zh: '太陽能', en: 'Solar' } },
          { id: 'bioenergy', label: { zh: '生質能', en: 'Bioenergy' } },
        ],
        defaultOption: 'total',
      },
      layer: { kind: 'bubble', legendValues: [1, 10, 100, 1000] },
      format: (v) => `${fixed(v, v < 10 ? 2 : 1)} GW`,
      formatTick: (v) => `${v} GW`,
    },
    {
      id: 'capacity-factor',
      label: { zh: '容量因數：蓋了多少、真正發了多少', en: 'Capacity factor' },
      description: {
        zh: '一年真正發的電占「整年滿載」的比例（Ember 的發電量 ÷ 前一年與當年年底的平均容量）。容量一年變動超過 ±20%、平均不到 1 GW 的不畫，太陽能超過 35%、風力超過 60% 的也不畫（容量沒申報，例如巴基斯坦的屋頂太陽能）。2024 年太陽能：泰國 31.1%、阿聯 26.5%、墨西哥 26.2%，英國 9.5% 最低，台灣 13.0%；風力：阿根廷 46.0%、紐西蘭 42.6%、巴西 39.6%，南韓 19.3% 最低（台灣離岸風電一年長了超過兩成，不畫）；核能：羅馬尼亞 95.8%、美國 92.7%、瑞士 92.4%，法國 70.7%、南非 46.1%、日本 29.3%；燃煤：多明尼加 77.5%、哥倫比亞與馬來西亞 76.9%，台灣 69.8%，法國 5.9%、芬蘭 7.5%、義大利 8.4%（只剩備用）；燃氣台灣 75.8% 僅次於哈薩克。',
        en: 'Electricity actually generated in a year as a share of running at full capacity all year (Ember generation ÷ the average of the previous and current year-end capacity). Not shown where capacity changed by more than ±20% in a year or averaged under 1 GW, or where solar exceeds 35% or wind 60% (unreported capacity, such as rooftop solar in Pakistan). Solar in 2024: Thailand 31.1%, the UAE 26.5%, Mexico 26.2%, lowest the UK 9.5%, Taiwan 13.0%; wind: Argentina 46.0%, New Zealand 42.6%, Brazil 39.6%, lowest South Korea 19.3% (Taiwan’s offshore wind grew more than 20% in a year and is not shown); nuclear: Romania 95.8%, the US 92.7%, Switzerland 92.4%, France 70.7%, South Africa 46.1%, Japan 29.3%; coal: the Dominican Republic 77.5%, Colombia and Malaysia 76.9%, Taiwan 69.8%, France 5.9%, Finland 7.5%, Italy 8.4% (backup only); Taiwan’s gas plants run at 75.8%, second only to Kazakhstan.',
      },
      unit: '%',
      file: 'capacity-factor/{item}.json',
      dimension: {
        label: { zh: '能源', en: 'Source' },
        options: [
          { id: 'solar', label: { zh: '太陽能', en: 'Solar' } },
          { id: 'wind', label: { zh: '風力', en: 'Wind' } },
          { id: 'nuclear', label: { zh: '核能', en: 'Nuclear' } },
          { id: 'coal', label: { zh: '燃煤', en: 'Coal' } },
          { id: 'gas', label: { zh: '燃氣', en: 'Gas' } },
          { id: 'hydro', label: { zh: '水力', en: 'Hydro' } },
        ],
        defaultOption: 'solar',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [20, 35, 50, 65, 80, 90] },
        itemScales: { solar: { type: 'sequential', thresholds: [10, 13, 16, 19, 22, 25] }, wind: { type: 'sequential', thresholds: [20, 25, 30, 35, 40, 45] } },
      },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'grid-losses',
      label: { zh: '輸配電損失率', en: 'Transmission and distribution losses' },
      description: {
        zh: '發出來的電有多少在輸配電的路上漏掉：EIA 的輸配電損失 ÷ 淨發電量（淨發電量 10 TWh 以上才畫）。損失含竊電，印度、巴西等的高值有很大一部分是偷電。2024 年：伊拉克 59.9%、宏都拉斯 32.2%、蘇丹 26.9%、肯亞 24.9%、衣索比亞 23.9%、阿根廷 22.7%；最低新加坡 0.2%、不丹 0.8%、台灣 2.6%、巴林 2.6%、冰島 3.0%、中國與南韓 3.5%。',
        en: 'How much generated electricity is lost on the way through transmission and distribution: EIA distribution losses ÷ net generation (shown where net generation is at least 10 TWh). Losses include theft, which accounts for much of the high values in places such as India and Brazil. 2024: Iraq 59.9%, Honduras 32.2%, Sudan 26.9%, Kenya 24.9%, Ethiopia 23.9%, Argentina 22.7%; lowest Singapore 0.2%, Bhutan 0.8%, Taiwan 2.6%, Bahrain 2.6%, Iceland 3.0%, China and South Korea 3.5%.',
      },
      unit: '%',
      file: 'grid-losses.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 8, 12, 18, 25] } },
      format: pct,
      formatTick: pctTick,
      lowerIsBetter: true,
      defaultYear: 2024,
    },
    // 2026-11-07（製作手冊第二十五批 521）離岸風電（GEM）、地熱與海洋能（EIA）（pipeline/topics/electricity_renewables_extra.py）
    {
      id: 'offshore-wind',
      label: { zh: '離岸風電的裝置容量', en: 'Offshore wind capacity' },
      description: {
        zh: '運轉中的離岸風電容量（GEM 全球電力追蹤 2026 年 9 月版，依機組的啟用與退役年份累計；固定式、浮動式與基礎型式不明的都算）。2026 年 20 國合計約 91.4 GW：中國 45,807 MW、英國 15,974、德國 9,026、荷蘭 6,836、台灣 3,585 MW 世界第 5，丹麥 2,653、比利時 2,256、法國 1,995、越南 1,835、日本 421。浮動式只有 5 國約 248 MW：挪威 98、英國 79.5、葡萄牙與法國各 25、西班牙 20。',
        en: 'Operating offshore wind capacity (GEM Global Integrated Power Tracker, September 2026, accumulated by unit start and retirement years; fixed, floating and unknown foundations all count). About 91.4 GW in 20 countries in 2026: China 45,807 MW, the UK 15,974, Germany 9,026, the Netherlands 6,836, Taiwan 3,585 MW (fifth in the world), Denmark 2,653, Belgium 2,256, France 1,995, Vietnam 1,835, Japan 421. Floating wind is only about 248 MW in 5 countries: Norway 98, the UK 79.5, Portugal and France 25 each, Spain 20.',
      },
      unit: 'MW',
      file: 'offshore-wind/{item}.json',
      dimension: {
        label: { zh: '型式', en: 'Type' },
        options: [
          { id: 'all', label: { zh: '全部離岸', en: 'All offshore' } },
          { id: 'floating', label: { zh: '浮動式', en: 'Floating' } },
        ],
        defaultOption: 'all',
      },
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => `${fixed(v, v < 100 ? 1 : 0)} MW`,
      formatTick: formatLargeTick,
      defaultYear: 2026,
    },
    {
      id: 'geothermal',
      label: { zh: '地熱發電的裝置容量', en: 'Geothermal power capacity' },
      description: {
        zh: '地熱發電的裝置容量（EIA，1980–2024）。2024 年 29 國合計約 15.36 GW：美國 2,696 MW、印尼 2,639、菲律賓 1,952、土耳其 1,734、紐西蘭 1,275、墨西哥 999、肯亞 940、冰島 788、義大利 772、日本 461；台灣 7.49 MW。跟發電廠地圖（GEM）的統計方式不同，數字不完全一樣。',
        en: 'Installed geothermal generating capacity (EIA, 1980–2024). About 15.36 GW in 29 countries in 2024: the US 2,696 MW, Indonesia 2,639, the Philippines 1,952, Türkiye 1,734, New Zealand 1,275, Mexico 999, Kenya 940, Iceland 788, Italy 772, Japan 461; Taiwan 7.49 MW. The counting differs from GEM in the power plant map, so figures do not match exactly.',
      },
      unit: 'MW',
      file: 'geothermal.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => `${fixed(v, v < 10 ? 2 : 0)} MW`,
      formatTick: formatLargeTick,
      defaultYear: 2024,
    },
    {
      id: 'ocean',
      label: { zh: '海洋能（潮汐與波浪）的裝置容量', en: 'Ocean power (tidal and wave) capacity' },
      description: {
        zh: '一張「沒長大的能源」的圖：潮汐與波浪發電的裝置容量（EIA 把兩者合在一起，1980–2024）。2024 年全世界只有約 495 MW，幾乎都是兩座潮汐電廠：南韓 255.6 MW（始華湖）、法國 212 MW（朗斯，1966 年啟用）；英國 10 MW，其他都在 5 MW 以下。台灣沒有商轉的海洋能電廠。',
        en: 'A map of an energy source that never took off: installed tidal and wave capacity (EIA combines the two, 1980–2024). Only about 495 MW worldwide in 2024, almost all in two tidal plants: South Korea 255.6 MW (Sihwa Lake) and France 212 MW (La Rance, opened 1966); the UK 10 MW and everyone else under 5 MW. Taiwan has no commercial ocean power plant.',
      },
      unit: 'MW',
      file: 'ocean.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => `${fixed(v, v < 10 ? 2 : 1)} MW`,
      formatTick: formatLargeTick,
      defaultYear: 2024,
    },
    // 2026-11-07（製作手冊第二十五批 522）再生能源占最終能源消費：WDI（IEA）與 Eurostat 的部門別（pipeline/topics/renewables_final.py）
    {
      id: 'renewable-final',
      label: { zh: '再生能源占最終能源消費（不只電力）', en: 'Renewables in final energy consumption (not just power)' },
      description: {
        zh: '分母是整個最終能源消費（工廠的蒸汽、家裡的暖氣、車子的油都算），所以比「再生能源發電占比」低很多（世界銀行 WDI，原始資料是 IEA；2022 年只有 71 國，其他各國用 2021 年）。最高的國家幾乎都是燒柴與木炭的傳統生質能，不是綠能模範生：2022 年索馬利亞 95.4%、賴比瑞亞 92.8%、烏干達與中非共和國 90.9%、幾內亞比索 87.4%、馬達加斯加 83.1%。2021 年冰島 82.4%、挪威 61.4%、巴西 46.5%、印度 34.9%、德國 17.6%、中國 15.2%、美國 10.9%、日本 8.8%、南韓 3.6%；世界 2020 年 19.7%。',
        en: 'The denominator is all final energy consumption (factory steam, home heating and vehicle fuel included), so the share is far lower than the renewable share of electricity (World Bank WDI, originally from the IEA; only 71 countries have 2022, the rest use 2021). The highest values are almost all traditional biomass, wood and charcoal, not green leaders: in 2022 Somalia 95.4%, Liberia 92.8%, Uganda and the Central African Republic 90.9%, Guinea-Bissau 87.4%, Madagascar 83.1%. In 2021 Iceland 82.4%, Norway 61.4%, Brazil 46.5%, India 34.9%, Germany 17.6%, China 15.2%, the US 10.9%, Japan 8.8%, South Korea 3.6%; the world 19.7% in 2020.',
      },
      unit: '%',
      file: 'renewable-final.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      defaultYear: 2022,
      noValue: {
        TWN: {
          zh: '沒有：台灣不在 IEA 與世界銀行的資料裡；能源署只有「再生能源供給占初級能源總供給」（2025 年 5.2%），分母不同',
          en: 'None: Taiwan is not in the IEA or World Bank data; the Energy Administration only publishes renewables as a share of total primary energy supply (5.2% in 2025), a different denominator',
        },
      },
    },
    {
      id: 'renewable-final-eu',
      label: { zh: '歐洲的再生能源占比：電力、暖氣、運輸', en: 'Renewable share in Europe: power, heating, transport' },
      description: {
        zh: '歐盟再生能源指令的算法（Eurostat，2004 年起，36 國；英國與科索沃的 Eurostat 資料只准非商業使用，不收），分成整體、電力、暖氣與冷氣、運輸，看得出「電力綠了，運輸還沒」。2024 年整體：冰島 79.3%、挪威 77.9%、瑞典 62.8%、芬蘭 52.1%、丹麥 46.5%；最低比利時 14.3%、盧森堡 14.7%、愛爾蘭 16.1%。電力會超過 100%：分子的水力與風力用常態化的發電量、分母是國內的用電，挪威 115.1%、阿爾巴尼亞 105.2%、冰島 102.4%。暖氣與冷氣：冰島 79.5%、蒙特內哥羅 68.3%、瑞典 67.8%。運輸：挪威 33.6%、瑞典 26.4%、芬蘭 20.3%、荷蘭 19.7%，北馬其頓 0.0%。2025 年目前只有 30 國。',
        en: 'Calculated under the EU Renewable Energy Directive (Eurostat, from 2004, 36 countries; Eurostat data for the UK and Kosovo are for non-commercial use only and are left out), split into overall, electricity, heating and cooling, and transport, which shows how power went green while transport did not. 2024 overall: Iceland 79.3%, Norway 77.9%, Sweden 62.8%, Finland 52.1%, Denmark 46.5%; lowest Belgium 14.3%, Luxembourg 14.7%, Ireland 16.1%. Electricity can exceed 100% because hydro and wind use normalised output against domestic consumption: Norway 115.1%, Albania 105.2%, Iceland 102.4%. Heating and cooling: Iceland 79.5%, Montenegro 68.3%, Sweden 67.8%. Transport: Norway 33.6%, Sweden 26.4%, Finland 20.3%, the Netherlands 19.7%, North Macedonia 0.0%. 2025 has only 30 countries so far.',
      },
      unit: '%',
      file: 'renewable-final-eu/{item}.json',
      dimension: {
        label: { zh: '部門', en: 'Sector' },
        options: [
          { id: 'total', label: { zh: '整體', en: 'Overall' } },
          { id: 'electricity', label: { zh: '電力', en: 'Electricity' } },
          { id: 'heating', label: { zh: '暖氣與冷氣', en: 'Heating and cooling' } },
          { id: 'transport', label: { zh: '運輸', en: 'Transport' } },
        ],
        defaultOption: 'total',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 75, 100] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
    },
  ],
}, electricityPeakPart);
