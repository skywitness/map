import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { OPERATING_PLANTS, powerPlants } from './power-plants';
import type { IndicatorDef, Text, TopicDefinition } from './types';

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

export const electricity: TopicDefinition = {
  id: 'electricity',
  title: { zh: '各國發電量', en: 'Electricity by country' },
  shortTitle: { zh: '發電量', en: 'Electricity' },
  defaultIndicator: 'generation',
  defaultYear: 2024,
  sources: [
    { name: 'Ember, Yearly Electricity Data', url: 'https://ember-energy.org/data/yearly-electricity-data/', license: 'CC BY 4.0' },
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
        zh: '一年的總發電量，1 TWh 等於 10 億度。圓的面積與發電量成正比。',
        en: 'Total electricity generated in a year; 1 TWh is 1 billion kWh. Circle area is proportional to generation.',
      },
      unit: 'TWh',
      file: 'generation.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
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
        zh: '天然氣發電占總發電量的比例。2025 年世界 21.7%；土庫曼、巴林、千里達及托巴哥、阿爾及利亞幾乎全靠燃氣，卡達 95.9%；台灣 48.7%，是最大的發電來源。',
        en: 'Share of electricity generated from natural gas. 21.7% worldwide in 2025; Turkmenistan, Bahrain, Trinidad and Tobago and Algeria rely almost entirely on gas, and Qatar on it for 95.9%; Taiwan 48.7%, its largest source.',
      },
      [5, 10, 20, 40, 60, 80],
    ),
    fuelShare(
      'hydro-share',
      { zh: '水力占比', en: 'Hydro share' },
      {
        zh: '水力發電占總發電量的比例。2025 年世界 14.0%；不丹、巴拉圭（99.5%）、尼泊爾、衣索比亞（96.5%）幾乎全靠水力，挪威約九成；台灣 1.9%。',
        en: 'Share of electricity generated from hydropower. 14.0% worldwide in 2025; Bhutan, Paraguay (99.5%), Nepal and Ethiopia (96.5%) rely almost entirely on hydro, and Norway on it for about 90%; Taiwan 1.9%.',
      },
      [5, 10, 20, 40, 60, 80],
    ),
    fuelShare(
      'wind-share',
      { zh: '風力占比', en: 'Wind share' },
      {
        zh: '風力發電（陸域加離岸）占總發電量的比例。2025 年世界 8.6%；丹麥 58.7% 最高，立陶宛 44.8%、烏拉圭 40.6%、愛爾蘭 38.0%；台灣 4.2%。',
        en: 'Share of electricity generated from wind (onshore and offshore). 8.6% worldwide in 2025; Denmark is highest at 58.7%, followed by Lithuania (44.8%), Uruguay (40.6%) and Ireland (38.0%); Taiwan 4.2%.',
      },
      [1, 5, 10, 20, 30, 40],
    ),
    fuelShare(
      'solar-share',
      { zh: '太陽能占比', en: 'Solar share' },
      {
        zh: '太陽能發電占總發電量的比例。2025 年世界 8.8%；庫克群島、巴勒斯坦、納米比亞（2024 年）與北馬其頓 31.1%、盧森堡 30.5% 最高；台灣 5.6%。小國的比例年年跳動較大。',
        en: 'Share of electricity generated from solar. 8.8% worldwide in 2025; the Cook Islands, Palestine and Namibia (2024) and North Macedonia (31.1%) and Luxembourg (30.5%) are highest; Taiwan 5.6%. Shares in small countries swing more from year to year.',
      },
      [1, 5, 10, 15, 20, 30],
    ),
    fuelShare(
      'bioenergy-share',
      { zh: '生質能占比', en: 'Bioenergy share' },
      {
        zh: '生質能（木材、農業廢棄物、沼氣、垃圾焚化等）發電占總發電量的比例。2025 年世界 2.2%；史瓦帝尼、貝里斯、澳門約三成（2024 年），烏拉圭 24.9%；台灣 0.7%。',
        en: 'Share of electricity generated from bioenergy (wood, crop waste, biogas, waste incineration and so on). 2.2% worldwide in 2025; Eswatini, Belize and Macao about 30% (2024) and Uruguay 24.9%; Taiwan 0.7%.',
      },
      [1, 2, 5, 10, 20, 30],
    ),
    fuelShare(
      'other-fossil-share',
      { zh: '燃油等其他化石占比', en: 'Oil and other fossil share' },
      {
        zh: '燃煤、燃氣以外的化石燃料（主要是燃油、柴油；Ember 的 Other Fossil）發電占總發電量的比例。2025 年世界 2.6%；甘比亞、格瑞那達、幾內亞比索、東帝汶這類小國與島國幾乎全靠燃油發電（2024 年）；台灣 1.6%。',
        en: 'Share of electricity generated from fossil fuels other than coal and gas (mainly oil and diesel; Ember’s “Other Fossil”). 2.6% worldwide in 2025; small countries and islands such as the Gambia, Grenada, Guinea-Bissau and Timor-Leste rely almost entirely on oil (2024); Taiwan 1.6%.',
      },
      [1, 5, 10, 25, 50, 90],
    ),
    fuelShare(
      'other-renewables-share',
      { zh: '地熱等其他再生占比', en: 'Geothermal and other renewables share' },
      {
        zh: '水力、風力、太陽能、生質能以外的再生能源（主要是地熱，也有潮汐；Ember 的 Other Renewables）占總發電量的比例。2025 年世界 0.3%；肯亞 45.9%、冰島 29.2%（2024 年）、紐西蘭 21.8%、薩爾瓦多 20.7%。Ember 沒有台灣的值。',
        en: 'Share of electricity generated from renewables other than hydro, wind, solar and bioenergy (mainly geothermal, also tidal; Ember’s “Other Renewables”). 0.3% worldwide in 2025; Kenya 45.9%, Iceland 29.2% (2024), New Zealand 21.8% and El Salvador 20.7%. Ember has no value for Taiwan.',
      },
      [0.5, 1, 5, 10, 20, 40],
    ),
    {
      id: 'carbon-intensity',
      label: { zh: '發電碳排強度', en: 'Carbon intensity of electricity' },
      description: {
        zh: '每發一度電排放的二氧化碳（公克）。燃煤越多越高，再生能源與核能越多越低。各國所有部門的排放見「各國溫室氣體排放」主題。',
        en: 'Grams of CO₂ emitted per kWh generated. More coal means higher; more renewables and nuclear means lower. For emissions from all sectors, see Greenhouse gas emissions by country.',
      },
      unit: { zh: 'gCO₂/度', en: 'gCO₂/kWh' },
      file: 'carbon-intensity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 300, 400, 500, 700] } },
      format: (v) => `${fixed(v, 0)} ${tr({ zh: '公克/度', en: 'g/kWh' })}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
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
        zh: '2030 年的再生能源目標減掉最新一年（2025 年，沒有的用 2024 年）的再生能源發電占比，單位是百分點；負的是已經達到。沙烏地阿拉伯差 47.8（目標 50%，2024 年 2.2%）、澳洲 43.3、希臘 33.7、愛爾蘭 32.6；台灣差 17.6（目標 30%，2025 年 12.4%）；巴西、蒙特內哥羅、挪威、奈及利亞已經達到。',
        en: 'The 2030 renewables target minus the latest renewables share of generation (2025, or 2024 where 2025 is missing), in percentage points; negative means already reached. Saudi Arabia is 47.8 points short (target 50%, 2.2% in 2024), Australia 43.3, Greece 33.7 and Ireland 32.6; Taiwan 17.6 (target 30%, 12.4% in 2025); Brazil, Montenegro, Norway and Nigeria have already reached theirs.',
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
  ],
};
