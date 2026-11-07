import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 石油、天然氣與煤的擴充：天然氣燒去哪裡、石油煉出來做什麼、非能源用途（2026-11-07，製作手冊第二十七批 615，
 * 候選 1345、1346、1347；pipeline/topics/fuel_uses.py，資料在 public/data/topics/fossil-fuels/）。
 * 來源（UNSD 能源平衡表、EIA）已經在 coal-types.ts 與原主題列過。
 */
const pct = (v: number) => `${fixed(v, v > 0 && v < 1 ? 1 : 0)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;
const SCALE = { type: 'sequential' as const, thresholds: [5, 15, 30, 50, 75] };
const GAS_USES: DimensionDef = {
  label: { zh: '用途', en: 'Use' },
  options: [
    { id: 'power', label: { zh: '電廠與汽電共生', en: 'Power, heat and CHP plants' } },
    { id: 'industry', label: { zh: '工業', en: 'Industry' } },
    { id: 'households', label: { zh: '家戶', en: 'Households' } },
    { id: 'transport', label: { zh: '運輸', en: 'Transport' } },
    { id: 'non-energy', label: { zh: '非能源用（化肥、化工原料）', en: 'Non-energy use (fertiliser, chemical feedstock)' } },
    { id: 'other', label: { zh: '其他（商業服務、液化、能源業自用等）', en: 'Other (commerce, liquefaction, energy industry own use…)' } },
  ],
  defaultOption: 'power',
};
const PRODUCTS: DimensionDef = {
  label: { zh: '成品油', en: 'Product' },
  options: [
    { id: 'gasoline', label: { zh: '汽油', en: 'Gasoline' } },
    { id: 'diesel', label: { zh: '柴油與取暖油（柴餾油）', en: 'Diesel and heating oil (distillate)' } },
    { id: 'jet', label: { zh: '航空燃油', en: 'Jet fuel' } },
    { id: 'kerosene', label: { zh: '煤油', en: 'Kerosene' } },
    { id: 'fuel-oil', label: { zh: '燃料油（重油）', en: 'Residual fuel oil' } },
    { id: 'lpg', label: { zh: '液化石油氣', en: 'LPG' } },
  ],
  defaultOption: 'gasoline',
};

export const fuelUsesPart: TopicPart = {
  name: { zh: '天然氣與石油的用途', en: 'Uses of gas and oil' },
  sources: [],
  note: {
    zh: '天然氣的用途是 UNSD 能源平衡表，分母是轉換投入加最終消費（跟煤一樣），全部用途至少 10 PJ 的國家才畫。成品油的組成是 EIA 的消費量（千桶/日）占六種合計的比例，是體積不是熱值。非能源用途是能源當原料用掉、沒有燒掉的部分（塑膠、化肥、瀝青等）占總供給的比例，各國的歸類不完全一樣。台灣不在 UNSD 裡，成品油的組成有。',
    en: 'Gas uses come from UNSD energy balances, with transformation inputs plus final consumption as the denominator (as for coal), for countries using at least 10 PJ. Oil product shares are EIA consumption (thousand barrels a day) as a share of the six products combined, by volume rather than energy content. Non-energy use is energy used as feedstock rather than burned (plastics, fertiliser, bitumen and so on) as a share of total supply; classification varies by country. Taiwan is not in the UNSD data but does have oil product figures.',
  },
  indicators: [
    {
      id: 'gas-use',
      label: { zh: '天然氣燒去哪裡', en: 'Where natural gas is used' },
      description: {
        zh: '天然氣的各種用途占全部用途的 %（子項目是用途）。2023 年日本、沙烏地各 70% 進電廠，南韓 55%、俄羅斯 55%、美國 46%；德國只有 27% 發電、30% 燒在家裡、26% 工業；英國 37% 家戶；中國 41% 工業；印度 37% 是非能源用（做尿素等化肥與化工原料）、印尼 18%；千里達及托巴哥 74% 是非能源用（甲醇與氨）。',
        en: 'Share of natural gas going to each use (sub-items are uses). In 2023 Japan and Saudi Arabia sent 70% to power plants, South Korea and Russia 55% and the US 46%; Germany only 27% to power, 30% to households and 26% to industry; the UK 37% to households; China 41% to industry; India 37% to non-energy use (urea fertiliser and chemical feedstock) and Indonesia 18%; Trinidad and Tobago 74% to non-energy use (methanol and ammonia).',
      },
      unit: '%',
      file: 'gas-use/{item}.json',
      dimension: GAS_USES,
      layer: { kind: 'choropleth', scale: SCALE },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2023,
      missing: { zh: '用天然氣太少或不在 UNSD 裡', en: 'Little gas use or not in UNSD' },
    },
    {
      id: 'oil-products',
      label: { zh: '石油煉出來做什麼（成品油的消費組成）', en: 'Oil product consumption mix' },
      description: {
        zh: '各種成品油占消費量的 %（體積，子項目是成品油）。2024 年美國 16,116 千桶/日：汽油 56%、柴餾油 24%、航空燃油 10%、液化石油氣 8%；中國 11,397：柴餾油 33%、汽油 31%、液化石油氣 22%；印度柴餾油 46%；德國柴餾油 53%；奈及利亞汽油 65%；沙烏地燃料油 29%；日本煤油 8%；台灣 500：汽油 38%、柴餾油 23%、航空燃油 14%、液化石油氣 13%、燃料油 12%。',
        en: 'Share of each oil product in consumption (by volume; sub-items are products). In 2024 the US used 16,116 thousand barrels a day: gasoline 56%, distillate 24%, jet fuel 10% and LPG 8%; China 11,397: distillate 33%, gasoline 31% and LPG 22%; distillate made up 46% in India and 53% in Germany; gasoline 65% in Nigeria; fuel oil 29% in Saudi Arabia; kerosene 8% in Japan; Taiwan 500: gasoline 38%, distillate 23%, jet fuel 14%, LPG 13% and fuel oil 12%.',
      },
      unit: '%',
      file: 'oil-products/{item}.json',
      dimension: PRODUCTS,
      layer: { kind: 'choropleth', scale: SCALE },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
      missing: { zh: '用油太少（不到 1 萬桶/日）', en: 'Little oil use (under 10,000 b/d)' },
    },
    {
      id: 'non-energy-share',
      label: { zh: '非能源用途占能源總供給', en: 'Non-energy use as a share of energy supply' },
      description: {
        zh: '能源當原料用掉（做塑膠、化肥、瀝青等，沒有燒掉）占總供給的 %。2023 年千里達及托巴哥 61.9%（甲醇與氨廠）、沙烏地 20.3%、新加坡 19.3%、荷蘭 18.0%、南韓 17.7%、科威特 15.1%、卡達 13.9%；俄羅斯、中國 9.5%，美國 7.1%、德國 7.0%、日本 6.8%、印度 4.2%。以化工出口為主的國家比例特別高。',
        en: 'Share of total energy supply used as feedstock (for plastics, fertiliser, bitumen and so on) rather than burned. In 2023 Trinidad and Tobago 61.9% (methanol and ammonia plants), Saudi Arabia 20.3%, Singapore 19.3%, the Netherlands 18.0%, South Korea 17.7%, Kuwait 15.1% and Qatar 13.9%; Russia and China 9.5%, the US 7.1%, Germany 7.0%, Japan 6.8% and India 4.2%. Countries focused on chemical exports run especially high.',
      },
      unit: '%',
      file: 'non-energy-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 7, 10, 15] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: pctTick,
      defaultYear: 2023,
      missing: { zh: '不在 UNSD 裡', en: 'Not in UNSD' },
    },
  ],
};
