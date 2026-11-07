import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 石油、天然氣與煤的擴充：蘊藏量還能採幾年（R/P 比，2026-11-07，製作手冊第二十七批 616，候選 1348；
 * pipeline/topics/reserves_ratio.py，資料在 public/data/topics/fossil-fuels/rp-ratio/）。
 * 蘊藏量與產量都是原主題已經列過的來源（CIA World Factbook、EIA）。
 */
const FUELS: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: [
    { id: 'oil', label: { zh: '原油', en: 'Crude oil' } },
    { id: 'gas', label: { zh: '天然氣', en: 'Natural gas' } },
    { id: 'coal', label: { zh: '煤', en: 'Coal' } },
  ],
  defaultOption: 'oil',
};

export const reservesRatioPart: TopicPart = {
  name: { zh: '蘊藏量還能採幾年', en: 'Reserves-to-production ratio' },
  sources: [],
  note: {
    zh: 'R/P 比是探明蘊藏量 ÷ 一年的產量，意思是「照現在的產量、現在已知的蘊藏，可以採幾年」，不是幾年後就會用完：蘊藏量會隨油價與開採技術重估，新的油氣田也會被發現。原油、天然氣的蘊藏量是 CIA World Factbook 的 2021 年估計、產量是 EIA 的 2024 年，兩邊年份不同；煤的蘊藏量與產量都是 EIA、同一年相除。',
    en: 'The reserves-to-production (R/P) ratio is proved reserves divided by one year’s output: how many years current known reserves would last at the current rate, not when they will run out, since reserves are revised with prices and technology and new fields are found. Oil and gas reserves are CIA World Factbook estimates for 2021 and production is EIA data for 2024, so the years differ; for coal both reserves and production come from EIA for the same year.',
  },
  indicators: [
    {
      id: 'rp-ratio',
      label: { zh: '蘊藏量還能採幾年（R/P 比）', en: 'Reserves-to-production ratio' },
      description: {
        zh: '探明蘊藏量 ÷ 一年的產量（年）。原油（2021 年蘊藏量 ÷ 2024 年產量）：委內瑞拉 964 年（產量掉到 863 千桶/日），伊朗 145、科威特 109、加拿大 98、伊拉克 89、沙烏地 77、阿聯 73、卡達 53、俄羅斯 22、中國 17、挪威 12、巴西 10、美國 7.9。天然氣：伊拉克 361（產量只有 10.3 十億立方公尺）、委內瑞拉 223、卡達 140、伊朗 122、沙烏地 76、俄羅斯 74、中國 26、美國 13、挪威 12、加拿大 10。煤（2023 年）：美國 473、德國 346、俄羅斯 338、澳洲 337、印度 132、印尼 45、南非 42、中國 36。R/P 不是「幾年後用完」：蘊藏量會重估，例如 Factbook 的美國原油蘊藏量，2020 年估計是 471 億桶、2021 年估計是 382 億桶。',
        en: 'Proved reserves divided by one year’s production, in years. Crude oil (2021 reserves over 2024 output): Venezuela 964 years (output having fallen to 863 thousand b/d), Iran 145, Kuwait 109, Canada 98, Iraq 89, Saudi Arabia 77, the UAE 73, Qatar 53, Russia 22, China 17, Norway 12, Brazil 10 and the US 7.9. Natural gas: Iraq 361 (with output of only 10.3 billion cubic metres), Venezuela 223, Qatar 140, Iran 122, Saudi Arabia 76, Russia 74, China 26, the US 13, Norway 12 and Canada 10. Coal (2023): the US 473, Germany 346, Russia 338, Australia 337, India 132, Indonesia 45, South Africa 42 and China 36. The ratio is not a countdown: reserves get revised; the Factbook put US crude reserves at 47.1 billion barrels for 2020 and 38.2 billion for 2021.',
      },
      unit: { zh: '年', en: 'years' },
      file: 'rp-ratio/{item}.json',
      dimension: FUELS,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 50, 100, 200] } },
      format: (v) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 年`, en: `${fixed(v, v < 10 ? 1 : 0)} years` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
      missing: { zh: '沒有蘊藏量資料或產量太少', en: 'No reserves data or little production' },
    },
  ],
};
