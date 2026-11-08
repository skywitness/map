import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { energyLossesPart } from './energy-losses';
import { withParts } from './parts';
import type { Text, TopicDefinition } from './types';

/**
 * 各部門的最終能源消費（2026-11-07，製作手冊第二十五批 523；pipeline/topics/energy_use.py）：聯合國統計司的能源平衡表
 * （1990–2023），台灣用經濟部能源署的國內能源消費（2005–2025）。能源大類新的小類「能源的使用與政策」的第一個主題。
 * 側欄是這一國各部門占比的堆疊面積圖（panels/EnergyUsePanel.tsx，用 ShareStack）。
 */

/** 部門（跟 pipeline 的 SECTORS 同順序）；地圖子項目、圓餅、側欄的顏色都依這個順序取 MAP_TOKENS.categorical */
export const SECTORS: { id: string; label: Text }[] = [
  { id: 'industry', label: { zh: '工業', en: 'Industry' } },
  { id: 'transport', label: { zh: '運輸', en: 'Transport' } },
  { id: 'households', label: { zh: '家戶（住宅）', en: 'Households' } },
  { id: 'commerce', label: { zh: '商業與公共服務', en: 'Commerce and public services' } },
  { id: 'agriculture', label: { zh: '農林漁業', en: 'Agriculture, forestry and fishing' } },
  { id: 'other', label: { zh: '其他未分類', en: 'Not elsewhere specified' } },
];

const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const pj = (v: number) => `${fixed(v, v < 10 ? 2 : v < 100 ? 1 : 0)} PJ`;

export const energyUse: TopicDefinition = withParts({
  id: 'energy-use',
  title: { zh: '各部門的最終能源消費：工業、運輸、住宅、服務業、農業', en: 'Final energy use by sector: industry, transport, homes, services, farming' },
  shortTitle: { zh: '能源用在哪裡', en: 'Energy use by sector' },
  defaultIndicator: 'sector-share',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: '聯合國統計司：能源平衡表（UNdata 的 SDMX，DF_UNData_EnergyBalance，1990–2023）',
        en: 'UN Statistics Division, Energy Balances (UNdata SDMX, DF_UNData_EnergyBalance, 1990–2023)',
      },
      url: 'https://data.un.org/',
      license: { zh: 'UNdata 使用條款：可自由複製轉載，註明 UNdata 為來源', en: 'UNdata terms of use: free to copy and redistribute, citing UNdata' },
    },
    {
      name: { zh: '經濟部能源署：國內能源消費年資料（台灣，2005–2025）', en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): annual domestic energy consumption, 2005–2025' },
      url: 'https://data.gov.tw/dataset/11158',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
  ],
  note: {
    zh: '最終能源消費是送到使用者手上的能源（電、油、瓦斯、煤、柴、熱），不含發電廠與煉油廠的轉換損失、能源業自用，也不含拿來當石化原料的「非能源用」。部門占比的分母是最終能源消費，六個部門加起來是 100%；有些國家的服務業記在「其他未分類」（例如中國）。台灣不在聯合國的資料裡，用能源署的數字（千公噸油當量換成 TJ），沒有「其他未分類」。標「估計值」的國家是聯合國統計司自己估的。',
    en: 'Final energy consumption is the energy delivered to users (electricity, oil, gas, coal, wood, heat), excluding conversion losses in power plants and refineries, the energy industry’s own use, and non-energy use such as petrochemical feedstock. Sector shares are of final energy consumption and the six sectors add up to 100%; some countries record services under “not elsewhere specified” (China, for example). Taiwan is not in the UN data, so the Energy Administration’s figures are used (converted from ktoe to TJ), with no “not elsewhere specified” category. Countries marked as estimates were estimated by the UN Statistics Division.',
  },
  panelExtra: () => import('./panels/EnergyUsePanel'),
  indicators: [
    {
      id: 'sector-share',
      label: { zh: '各部門占最終能源消費的比例', en: 'Share of final energy use by sector' },
      description: {
        zh: '誰在用能源，不是能源從哪來。2023 年（最終能源消費 100 PJ 以上的 134 國）工業占比最高：赤道幾內亞 85.6%、北韓 61.7%、阿聯 60.8%、印尼 58.7%、新加坡 58.1%、中國 55.0%；運輸最高：玻利維亞 56.0%、厄瓜多 54.4%、利比亞 53.9%、盧森堡 52.5%（加油的過境車多）、阿富汗 51.4%；家戶最高：剛果民主共和國 89.6%、衣索比亞 86.6%、海地 82.9%、馬拉威 77.8%、尼日 69.0%、肯亞 66.6%，這是燒柴與木炭煮飯（見「家戶能源有多少是生質能」），不是家裡很耗電。商業與公共服務：香港 40.7%、阿曼 38.8%、日本 19.0%。台灣 2025 年：工業 49.2%、運輸 24.0%、住宅 12.7%、服務業 12.4%、農業 1.7%。',
        en: 'Who uses energy, not where it comes from. In 2023 (134 countries with final energy use of at least 100 PJ) industry’s share was highest in Equatorial Guinea at 85.6%, North Korea 61.7%, the UAE 60.8%, Indonesia 58.7%, Singapore 58.1% and China 55.0%; transport was highest in Bolivia at 56.0%, Ecuador 54.4%, Libya 53.9%, Luxembourg 52.5% (many vehicles filling up in transit) and Afghanistan 51.4%; households were highest in the DR Congo at 89.6%, Ethiopia 86.6%, Haiti 82.9%, Malawi 77.8%, Niger 69.0% and Kenya 66.6%, which reflects cooking with wood and charcoal (see “Biomass in household energy”) rather than power-hungry homes. Commerce and public services: Hong Kong 40.7%, Oman 38.8%, Japan 19.0%. Taiwan in 2025: industry 49.2%, transport 24.0%, homes 12.7%, services 12.4%, agriculture 1.7%.',
      },
      unit: '%',
      file: 'sector-share/{item}.json',
      dimension: {
        label: { zh: '部門', en: 'Sector' },
        options: SECTORS,
        defaultOption: 'industry',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] },
        itemScales: {
          commerce: { type: 'sequential', thresholds: [3, 6, 9, 12, 16, 20] },
          agriculture: { type: 'sequential', thresholds: [1, 2, 3, 5, 8, 12] },
          other: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 35] },
        },
      },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'final-energy',
      label: { zh: '最終能源消費總量', en: 'Total final energy consumption' },
      description: {
        zh: '一年送到使用者手上的能源有多少（PJ，千兆焦耳；不含非能源用），圓餅是各部門的比例。2023 年：中國 89,148 PJ、美國 59,320、印度 28,872、俄羅斯 18,752、巴西 10,094、日本 9,422；台灣 1,997 PJ（2025 年 1,988）。',
        en: 'Energy delivered to end users in a year (petajoules, excluding non-energy use); the pie shows the sector shares. In 2023: China 89,148 PJ, the US 59,320, India 28,872, Russia 18,752, Brazil 10,094, Japan 9,422; Taiwan 1,997 PJ (1,988 in 2025).',
      },
      unit: 'PJ',
      file: 'final-energy.json',
      layer: {
        kind: 'bubble',
        legendValues: [100, 1000, 10000],
        pie: { parts: SECTORS.map((s, i) => ({ indicator: 'sector-share', item: s.id, color: MAP_TOKENS.categorical[i], label: s.label })) },
      },
      format: pj,
      formatTick: (v) => `${fixed(v, 0)} PJ`,
      shareOfWorld: true,
    },
    {
      id: 'non-energy',
      label: { zh: '非能源用（石化原料等）占最終消費的比例', en: 'Non-energy use (petrochemical feedstock and more) in final consumption' },
      description: {
        zh: '最終消費裡沒有被燒掉、而是拿來做塑膠、化肥、柏油、潤滑油的部分（石油腦、天然氣、煤焦油等），占最終消費（含非能源用）的比例。2023 年（最終能源消費 100 PJ 以上的國家）：千里達及托巴哥 77.7%（天然氣做氨與甲醇）、新加坡 32.5%、沙烏地阿拉伯 29.9%、南韓 27.8%；台灣 2025 年 25.5%（石化業）。',
        en: 'The part of final consumption that is not burned but turned into plastics, fertiliser, asphalt and lubricants (naphtha, natural gas, coal tar and so on), as a share of final consumption including non-energy use. In 2023 (countries with final energy use of at least 100 PJ): Trinidad and Tobago 77.7% (gas for ammonia and methanol), Singapore 32.5%, Saudi Arabia 29.9%, South Korea 27.8%; Taiwan 25.5% in 2025 (petrochemicals).',
      },
      unit: '%',
      file: 'non-energy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 15, 20, 30] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'household-biomass',
      label: { zh: '家戶能源有多少是生質能（柴、木炭、廢棄物）', en: 'Biomass in household energy (wood, charcoal, waste)' },
      description: {
        zh: '家戶用的能源裡，生質能與廢棄物（主要是煮飯的柴與木炭）的比例；家戶能源 100 TJ 以上才畫。2023 年：剛果民主共和國 99.2%、烏干達 98.5%、馬拉威 98.1%、衣索比亞 97.8%，這些國家「家戶占能源消費的比例」高，就是因為這個。台灣沒有資料。',
        en: 'Share of household energy that is biomass and waste (mostly wood and charcoal for cooking); shown where household energy use is at least 100 TJ. In 2023: the DR Congo 99.2%, Uganda 98.5%, Malawi 98.1%, Ethiopia 97.8%, which is why households take such a large share of energy use there. No data for Taiwan.',
      },
      unit: '%',
      file: 'household-biomass.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 70, 90] } },
      format: pct,
      formatTick: pctTick,
      noValue: { TWN: { zh: '沒有資料（能源署沒有分住宅的燃料別）', en: 'No data (the Energy Administration does not break down household fuels)' } },
    },
  ],
}, energyLossesPart);
