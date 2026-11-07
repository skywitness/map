import { fixed } from '../lib/format';
import type { Text, TopicDefinition } from './types';

/**
 * 家裡的能源花在哪（2026-11-07，製作手冊第二十五批 524；pipeline/topics/household_energy.py）：Eurostat nrg_d_hhq 的家戶
 * 能源用途（暖氣、冷氣、熱水、炊事、照明與家電）與暖氣的燃料，2010–2024，歐洲 36 國（英國、科索沃不收）。
 * 側欄是這一國兩組比例的堆疊面積圖（panels/HouseholdEnergyPanel.tsx，用 ShareStack）。
 */
export const USES: { id: string; label: Text }[] = [
  { id: 'heating', label: { zh: '空間暖氣', en: 'Space heating' } },
  { id: 'water', label: { zh: '熱水', en: 'Water heating' } },
  { id: 'cooking', label: { zh: '炊事', en: 'Cooking' } },
  { id: 'lighting', label: { zh: '照明與家電', en: 'Lighting and appliances' } },
  { id: 'cooling', label: { zh: '空間冷氣', en: 'Space cooling' } },
  { id: 'other', label: { zh: '其他', en: 'Other' } },
];
export const HEATING_FUELS: { id: string; label: Text }[] = [
  { id: 'gas', label: { zh: '天然氣', en: 'Natural gas' } },
  { id: 'electricity', label: { zh: '電', en: 'Electricity' } },
  { id: 'district-heat', label: { zh: '區域供熱', en: 'District heating' } },
  { id: 'oil', label: { zh: '燃油', en: 'Oil' } },
  { id: 'coal', label: { zh: '煤', en: 'Coal' } },
  { id: 'wood', label: { zh: '木柴等固體生質燃料', en: 'Wood and other solid biofuels' } },
  { id: 'other-renewables', label: { zh: '其他再生能源（熱泵、太陽熱能…）', en: 'Other renewables (heat pumps, solar thermal…)' } },
];

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const NO_TWN = {
  TWN: {
    zh: '沒有：台灣沒有家戶能源的用途統計（台電只有用電量），而且幾乎不需要空間暖氣',
    en: 'None: Taiwan has no statistics on household energy by end use (Taipower only reports electricity sales), and needs very little space heating',
  },
};

export const householdEnergy: TopicDefinition = {
  id: 'household-energy',
  title: { zh: '家裡的能源花在哪：暖氣、熱水、冷氣、炊事', en: 'Where household energy goes: heating, hot water, cooling, cooking' },
  shortTitle: { zh: '家裡的能源', en: 'Household energy' },
  defaultIndicator: 'end-use',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Eurostat：家戶的最終能源消費依用途與燃料（nrg_d_hhq，2010–2024）',
        en: 'Eurostat, disaggregated final energy consumption in households (nrg_d_hhq, 2010–2024)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_d_hhq/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '只有歐洲 36 國（英國與科索沃的 Eurostat 資料只准非商業使用，不收）。比例的分母是家戶的最終能源消費（暖氣用的木柴、瓦斯、燃油，加上電與區域供熱），不是電費。暖氣的燃料裡「其他再生能源」是 Eurostat 的再生能源合計減掉木柴（兩者相加會重複算）。暖氣占比高不代表用得多，只代表其他用途相對少。',
    en: 'Europe only, 36 countries (Eurostat data for the UK and Kosovo are for non-commercial use only and are left out). Shares are of household final energy consumption (wood, gas and oil burned for heat plus electricity and district heating), not of the electricity bill. Among heating fuels, “other renewables” is Eurostat’s total for renewables minus wood (adding the two would double count). A high heating share does not mean more energy used, only that other uses are relatively small.',
  },
  panelExtra: () => import('./panels/HouseholdEnergyPanel'),
  indicators: [
    {
      id: 'end-use',
      label: { zh: '家戶能源的用途', en: 'Household energy by end use' },
      description: {
        zh: '家裡的能源用在哪裡，占家戶能源的比例。2024 年空間暖氣：北馬其頓 78.9%、盧森堡 76.6%、愛沙尼亞 73.0%、比利時 71.2%、波士尼亞 70.6% 最高；馬爾他 20.0%、葡萄牙 28.8%、賽普勒斯 30.9%、西班牙 35.8% 最低。空間冷氣：賽普勒斯 16.0%（2021 年 10.6%、2023 年 12.7%）、馬爾他 15.0%、阿爾巴尼亞 13.4%、希臘 7.4%，北歐幾乎是 0。炊事：葡萄牙 30.8%、蒙特內哥羅 26.2%；照明與家電：西班牙 33.2%、馬爾他 32.2%。',
        en: 'What household energy is used for, as a share of the total. Space heating in 2024: North Macedonia 78.9%, Luxembourg 76.6%, Estonia 73.0%, Belgium 71.2% and Bosnia and Herzegovina 70.6% were highest; Malta 20.0%, Portugal 28.8%, Cyprus 30.9% and Spain 35.8% lowest. Space cooling: Cyprus 16.0% (10.6% in 2021 and 12.7% in 2023), Malta 15.0%, Albania 13.4%, Greece 7.4%, and almost nothing in the Nordics. Cooking: Portugal 30.8%, Montenegro 26.2%; lighting and appliances: Spain 33.2%, Malta 32.2%.',
      },
      unit: '%',
      file: 'end-use/{item}.json',
      dimension: { label: { zh: '用途', en: 'End use' }, options: USES, defaultOption: 'heating' },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 75] },
        itemScales: {
          water: { type: 'sequential', thresholds: [10, 12, 14, 16, 18, 21] },
          cooking: { type: 'sequential', thresholds: [2, 4, 6, 10, 15, 25] },
          lighting: { type: 'sequential', thresholds: [8, 11, 14, 17, 20, 27] },
          cooling: { type: 'sequential', thresholds: [0.1, 0.5, 1, 3, 7, 12] },
          other: { type: 'sequential', thresholds: [0.1, 0.5, 1, 2, 3, 5] },
        },
      },
      format: pct,
      formatTick: pctTick,
      noValue: NO_TWN,
    },
    {
      id: 'heating-fuel',
      label: { zh: '暖氣燒什麼', en: 'What heats homes' },
      description: {
        zh: '空間暖氣的能源，依燃料分的比例。2024 年：荷蘭天然氣 70.3%、義大利 57.8%、德國 44.2%（燃油 24.6%、木柴 14.6%）；瑞典區域供熱 51.0%（電 30.6%）、芬蘭區域供熱 31.4%；挪威電 59.7%；波蘭木柴 32.6% 加煤 26.9%；羅馬尼亞木柴 52.2%、波士尼亞 86.1%；燃油：賽普勒斯 62.9%、愛爾蘭 56.6%、希臘 43.4%。區域供熱在北歐、東歐是主角，南歐幾乎沒有。',
        en: 'Energy used for space heating, by fuel. In 2024: natural gas was 70.3% in the Netherlands, 57.8% in Italy and 44.2% in Germany (oil 24.6%, wood 14.6%); district heating was 51.0% in Sweden (electricity 30.6%) and 31.4% in Finland; electricity 59.7% in Norway; Poland burned wood (32.6%) and coal (26.9%); wood was 52.2% in Romania and 86.1% in Bosnia and Herzegovina; oil 62.9% in Cyprus, 56.6% in Ireland and 43.4% in Greece. District heating dominates in the Nordics and the east and is almost absent in the south.',
      },
      unit: '%',
      file: 'heating-fuel/{item}.json',
      dimension: { label: { zh: '燃料', en: 'Fuel' }, options: HEATING_FUELS, defaultOption: 'gas' },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] },
        itemScales: { coal: { type: 'sequential', thresholds: [0.5, 2, 5, 10, 15, 25] } },
      },
      format: pct,
      formatTick: pctTick,
      noValue: NO_TWN,
    },
  ],
};
