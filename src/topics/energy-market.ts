import { fixed } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 電力市場的管制與再生能源的補貼（2026-11-07，製作手冊第二十五批 527；pipeline/topics/energy_policy_tools.py）：
 * OECD 產品市場管制（PMR）的電力、天然氣分項直接讀「市場管制」主題的檔（同一份資料不另存）；OECD 環境政策嚴格度
 * 指數（EPS）的太陽能、風力支持分數（1990–2020）。台灣 EPS 沒有，側欄畫能源署公告的躉購費率（panels/EnergyMarketPanel.tsx）。
 */

const score = (v: number) => fixed(v, 2);
const tick = (v: number) => fixed(v, 1);
const SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.5, 1, 2, 3, 4, 5] };

export const energyMarket: TopicDefinition = {
  id: 'energy-market',
  title: { zh: '電力市場的管制與再生能源的補貼', en: 'Power market regulation and support for renewables' },
  shortTitle: { zh: '電力市場與補貼', en: 'Power markets & subsidies' },
  defaultIndicator: 'regulation',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'OECD：產品市場管制指標（PMR，2018、2023 年）', en: 'OECD, Product Market Regulation indicators (PMR, 2018 and 2023)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PMR%40DF_PMR&df[ag]=OECD.ECO.GCRD',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD：環境政策嚴格度指數（EPS，1990–2020）', en: 'OECD, Environmental Policy Stringency Index (EPS, 1990–2020)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_EPS%40DF_EPS&df[ag]=OECD.ECO.MAD',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '經濟部能源署：再生能源電能躉購費率及其計算公式（台灣，2010–2023）',
        en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): feed-in tariffs for renewable electricity, 2010–2023',
      },
      url: 'https://data.gov.tw/dataset/6031',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
  ],
  note: {
    zh: '兩個指數都是 OECD 把法規與政策編碼成 0–6 分，不是金額。產品市場管制分數越高管制越多（進入門檻、公營比重、垂直整合、價格管制）；再生能源支持分數越高，躉購費率或競標的保證價格越高、涵蓋越廣。低管制不等於電價便宜，高補貼也不等於再生能源多。',
    en: 'Both indices are OECD codings of laws and policies on a 0–6 scale, not money amounts. A higher product market regulation score means more regulation (entry barriers, public ownership, vertical integration, price controls); a higher renewables support score means more generous and broader feed-in tariffs or auction prices. Light regulation does not mean cheap power, and generous support does not mean more renewables.',
  },
  panelExtra: () => import('./panels/EnergyMarketPanel'),
  indicators: [
    {
      id: 'regulation',
      label: { zh: '電力與天然氣市場的管制程度', en: 'Regulation of electricity and gas markets' },
      description: {
        zh: 'OECD 產品市場管制（PMR）的電力與天然氣分項，0 分最自由、6 分管制最多；2018 與 2023 年兩期，56 個經濟體（天然氣 50 個），跟「市場管制」主題是同一份資料。2023 年電力：英國 0.05、澳洲與荷蘭 0.18、葡萄牙 0.27 最自由；馬來西亞 4.63、泰國 4.61、肯亞 4.24、摩洛哥 4.22 最管制；台灣 3.42。天然氣：台灣 5.02 最高，亞美尼亞 4.36、瑞士 3.93 其次；德國 0.41 最低。分數低不代表電價便宜：英國的家庭電價是歐洲最貴的幾國之一。',
        en: 'Electricity and natural gas components of the OECD Product Market Regulation (PMR) indicators, from 0 (least regulated) to 6 (most); two waves, 2018 and 2023, 56 economies (50 for gas), the same data as the “Market regulation” topic. Electricity in 2023: the UK (0.05), Australia and the Netherlands (0.18) and Portugal (0.27) are least regulated; Malaysia (4.63), Thailand (4.61), Kenya (4.24) and Morocco (4.22) most; Taiwan 3.42. Gas: Taiwan is highest at 5.02, followed by Armenia (4.36) and Switzerland (3.93); Germany lowest at 0.41. A low score does not mean cheap power: UK household electricity is among the dearest in Europe.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: '../market-regulation/sector/{item}.json',
      dimension: {
        label: { zh: '市場', en: 'Market' },
        options: [
          { id: 'electricity', label: { zh: '電力', en: 'Electricity' } },
          { id: 'gas', label: { zh: '天然氣', en: 'Natural gas' } },
        ],
        defaultOption: 'electricity',
      },
      layer: { kind: 'choropleth', scale: SCALE },
      format: score,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'res-support',
      label: { zh: '對太陽能、風力的補貼（躉購費率與競標）', en: 'Support for solar and wind (feed-in tariffs and auctions)' },
      description: {
        zh: 'OECD 環境政策嚴格度指數（EPS）裡對太陽能、風力發電的支持：躉購費率或競標保證價格的水準編成 0–6 分（不是金額），1990–2020 年，40 國，資料只到 2020 年。2020 年太陽能：澳洲、盧森堡、土耳其 6 分；荷蘭、義大利、匈牙利、瑞士、中國 5 分；西班牙、瑞典、日本、南韓、巴西、南非等 19 國 0 分。風力：德國、日本、芬蘭、盧森堡、瑞士、印尼 6 分。西班牙的太陽能 2012 年還是 4 分，2013 年起是 0 分。台灣不在評分裡，點台灣看能源署公告的躉購費率。',
        en: 'Support for solar and wind power in the OECD Environmental Policy Stringency Index (EPS): the level of feed-in tariffs or guaranteed auction prices coded from 0 to 6 (not money amounts), 1990–2020, 40 countries; the data stop in 2020. Solar in 2020: Australia, Luxembourg and Türkiye score 6; the Netherlands, Italy, Hungary, Switzerland and China 5; 19 countries including Spain, Sweden, Japan, South Korea, Brazil and South Africa 0. Wind: Germany, Japan, Finland, Luxembourg, Switzerland and Indonesia score 6. Spain’s solar score was still 4 in 2012 and 0 from 2013. Taiwan is not scored; click Taiwan for the feed-in tariffs announced by its Energy Administration.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'res-support/{item}.json',
      dimension: {
        label: { zh: '能源', en: 'Source' },
        options: [
          { id: 'solar', label: { zh: '太陽能', en: 'Solar' } },
          { id: 'wind', label: { zh: '風力', en: 'Wind' } },
        ],
        defaultOption: 'solar',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 5, 6] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2020,
      compareWorld: false,
      noValue: {
        TWN: {
          zh: '不在 OECD 的評分裡；側欄有能源署公告的躉購費率',
          en: 'Not scored by the OECD; the side panel shows the Energy Administration’s feed-in tariffs',
        },
      },
    },
  ],
};
