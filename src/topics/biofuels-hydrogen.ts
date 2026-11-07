import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 生質燃料與氫：產量與產能（新主題，2026-11-07，製作手冊第二十七批 620，候選 1356、1357；能源・再生能源）：
 * EIA 的全世界生質燃料產量、Eurostat 的歐洲生質燃料產能與氫的產能（pipeline/topics/biofuels_hydrogen.py）。
 */
const EUROSTAT_ONLY = { zh: 'Eurostat 只有歐洲', en: 'Eurostat covers Europe only' };
const mt = (v: number) => tr({ zh: `${fixed(v, v < 1 ? 3 : v < 10 ? 2 : 1)} 百萬公噸`, en: `${fixed(v, v < 1 ? 3 : v < 10 ? 2 : 1)} Mt` });
const kt = (v: number) => tr({ zh: `每年 ${fixed(v, v < 10 ? 1 : 0)} 千公噸`, en: `${fixed(v, v < 10 ? 1 : 0)} kt/y` });
const PRODUCTS: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: [
    { id: 'all', label: { zh: '合計', en: 'All' } },
    { id: 'ethanol', label: { zh: '乙醇（生質汽油）', en: 'Ethanol' } },
    { id: 'biodiesel', label: { zh: '生質柴油', en: 'Biodiesel' } },
  ],
  defaultOption: 'all',
};
const CAPACITY: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: [
    { id: 'all', label: { zh: '合計', en: 'All' } },
    { id: 'biodiesel', label: { zh: '生質柴油', en: 'Biodiesel' } },
    { id: 'biogasoline', label: { zh: '生質汽油（乙醇等）', en: 'Biogasoline (ethanol…)' } },
    { id: 'biojet', label: { zh: '生質航空燃油（永續航空燃油）', en: 'Bio jet kerosene (sustainable aviation fuel)' } },
    { id: 'other', label: { zh: '其他液體生質燃料', en: 'Other liquid biofuels' } },
  ],
  defaultOption: 'all',
};

export const biofuelsHydrogen: TopicDefinition = {
  id: 'biofuels-hydrogen',
  title: { zh: '生質燃料與氫：產量與產能', en: 'Biofuels and hydrogen: output and capacity' },
  shortTitle: { zh: '生質燃料與氫', en: 'Biofuels and hydrogen' },
  defaultIndicator: 'biofuel-production',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'U.S. Energy Information Administration：International Energy Statistics（生質燃料產量）', en: 'U.S. Energy Information Administration: International Energy Statistics (biofuel production)' },
      url: 'https://www.eia.gov/international/data/world',
      license: { zh: '公有領域（美國政府著作）', en: 'Public domain (US government work)' },
    },
    {
      name: {
        zh: 'Eurostat：液體生質燃料的產能（nrg_inf_lbpc）、氫、氨與電燃料的產能（nrg_inf_h2stpc）',
        en: 'Eurostat: liquid biofuels production capacities (nrg_inf_lbpc); production capacity of hydrogen, ammonia and e-fuels (nrg_inf_h2stpc)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_inf_h2stpc/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '生質燃料的「產量」是 EIA 的全世界資料（千公噸換成百萬公噸）；「產能」是一年最多能做多少，只有 Eurostat 的歐洲（英國、科索沃照網站的規則不收）。氫的產能是 Eurostat 2022 年起才有的申報，含既有的天然氣、石油產品製氫設備（俗稱灰氫），不是「氫能計畫」；全世界最大的電解槽市場中國沒有資料。台灣：EIA 有生質柴油的產量，沒有氫的統計（只有示範案）。',
    en: 'Biofuel output is EIA data for the whole world (thousand tonnes converted to million tonnes); capacity, the most that can be made in a year, is Eurostat data for Europe only (the UK and Kosovo are excluded under this site’s rules). Hydrogen capacity is reported to Eurostat only from 2022 and includes existing plants making hydrogen from natural gas and oil products (“grey” hydrogen); it does not measure hydrogen projects. China, the largest market for electrolysers, is not covered. Taiwan: EIA has biodiesel output figures; there are no hydrogen statistics (only demonstration projects).',
  },
  indicators: [
    {
      id: 'biofuel-production',
      label: { zh: '生質燃料的產量', en: 'Biofuel production' },
      description: {
        zh: '一年生產多少液體生質燃料（百萬公噸；EIA，子項目是燃料）。2024 年全世界 159.6：美國 65.4（乙醇 48.2）、巴西 36.5（乙醇 28.6）、印尼 11.4（全部是生質柴油）、中國 6.6、印度 5.2、德國 4.2、泰國 2.5。歐洲各國的產能比美國、巴西小很多。台灣 2024 年生質柴油 0.12 百萬公噸。',
        en: 'Liquid biofuels produced in a year (million tonnes; EIA; sub-items are fuels). In 2024 the world made 159.6: the US 65.4 (48.2 of it ethanol), Brazil 36.5 (ethanol 28.6), Indonesia 11.4 (all biodiesel), China 6.6, India 5.2, Germany 4.2 and Thailand 2.5. European capacity is far smaller than US or Brazilian output. Taiwan produced 0.12 million tonnes of biodiesel in 2024.',
      },
      unit: { zh: '百萬公噸', en: 'Mt' },
      file: 'production/{item}.json',
      dimension: PRODUCTS,
      layer: { kind: 'bubble', legendValues: [0.1, 1, 10, 50] },
      format: mt,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      shareOfWorld: true,
      missing: { zh: 'EIA 沒有或不到 1,000 公噸', en: 'None in EIA or under 1,000 tonnes' },
    },
    {
      id: 'biofuel-capacity',
      label: { zh: '歐洲的生質燃料產能', en: 'Biofuel production capacity in Europe' },
      description: {
        zh: '液體生質燃料一年最多能做多少（千公噸/年；Eurostat，子項目是燃料）。2024 年 26 國合計 36,659：德國 10,832、西班牙 4,701、法國 4,200、荷蘭 2,711、波蘭 2,684、義大利 2,544。生質柴油 22,300、生質汽油 6,789，生質航空燃油只有 304（芬蘭 300、奧地利 4），不到 1%，永續航空燃油還在起步。',
        en: 'Maximum liquid biofuel output in a year (thousand tonnes a year; Eurostat; sub-items are fuels). In 2024 the 26 reporting countries had 36,659 in all: Germany 10,832, Spain 4,701, France 4,200, the Netherlands 2,711, Poland 2,684 and Italy 2,544. Biodiesel made up 22,300 and biogasoline 6,789, but bio jet kerosene only 304 (Finland 300, Austria 4), under 1%: sustainable aviation fuel is still in its infancy.',
      },
      unit: { zh: '千公噸/年', en: 'kt/y' },
      file: 'capacity/{item}.json',
      dimension: CAPACITY,
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: kt,
      formatTick: formatLargeTick,
      missing: EUROSTAT_ONLY,
    },
    {
      id: 'hydrogen-capacity',
      label: { zh: '歐洲的氫產能', en: 'Hydrogen production capacity in Europe' },
      description: {
        zh: '一年最多能產多少氫（PJ，1 PJ＝1,000 兆焦耳；Eurostat，2022 年起）。2024 年德國 148.5 最多，荷蘭 70.5、西班牙 57.3、希臘 46.6、波蘭 45.7、法國 39.6、義大利 39.5、瑞典 33.2。申報國合計 614.7 PJ，依原料：天然氣 56.2%、石油產品 30.5%、電解 3.7%、其他 2.9%。',
        en: 'Maximum hydrogen output in a year (PJ; Eurostat, from 2022). In 2024 Germany led with 148.5, then the Netherlands 70.5, Spain 57.3, Greece 46.6, Poland 45.7, France 39.6, Italy 39.5 and Sweden 33.2. Of the 614.7 PJ reported in all, natural gas accounts for 56.2%, oil products 30.5%, electrolysis 3.7% and other sources 2.9%.',
      },
      unit: { zh: 'PJ/年', en: 'PJ/y' },
      file: 'hydrogen-capacity.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => tr({ zh: `每年 ${fixed(v, v < 10 ? 2 : 1)} PJ`, en: `${fixed(v, v < 10 ? 2 : 1)} PJ/y` }),
      formatTick: (v) => fixed(v, 0),
      missing: EUROSTAT_ONLY,
    },
    {
      id: 'hydrogen-electrolysis',
      label: { zh: '氫產能裡電解的比例', en: 'Share of hydrogen capacity from electrolysis' },
      description: {
        zh: '氫的產能有多少是用電解水（可以用再生能源的電，俗稱綠氫的來源），其餘主要是天然氣與石油產品。2024 年申報國的電解產能合計 22,546 兆焦耳，只占全部的 3.7%：丹麥 13.1%、法國 11.4%、德國 10.8%（16,072 兆焦耳）、瑞典 3.4%；荷蘭、波蘭、義大利是 0。',
        en: 'Share of hydrogen capacity using water electrolysis (which can run on renewable electricity, the basis of “green” hydrogen); the rest comes mainly from natural gas and oil products. In 2024 reporting countries had 22,546 TJ of electrolysis capacity, just 3.7% of the total: Denmark 13.1%, France 11.4%, Germany 10.8% (16,072 TJ) and Sweden 3.4%; the Netherlands, Poland and Italy 0.',
      },
      unit: '%',
      file: 'hydrogen-electrolysis.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 2, 5, 10, 20] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, v < 1 ? 1 : 0)}%`,
      missing: { zh: 'Eurostat 只有歐洲；沒有申報電解', en: 'Eurostat covers Europe only; electrolysis not reported' },
    },
  ],
};
