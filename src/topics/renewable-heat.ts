import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 太陽能熱水器與熱泵：不發電的再生能源（新主題，2026-11-07，製作手冊第二十七批 619，候選 1354、1355；能源・再生能源）：
 * Eurostat 的太陽熱集熱板面積、太陽熱能產量與熱泵的環境熱，加上能源署的台灣太陽熱能（pipeline/topics/renewable_heat.py）。
 */
const EUROSTAT_NOTE = { zh: 'Eurostat 只有歐洲', en: 'Eurostat covers Europe only' };
const kwh = (v: number) => tr({ zh: `每人 ${fixed(v, v < 10 ? 1 : 0)} 度`, en: `${fixed(v, v < 10 ? 1 : 0)} kWh per person` });
const HP: DimensionDef = {
  label: { zh: '熱源', en: 'Source' },
  options: [
    { id: 'total', label: { zh: '全部', en: 'All' } },
    { id: 'air', label: { zh: '空氣源', en: 'Air source' } },
    { id: 'ground', label: { zh: '地熱源（地下）', en: 'Ground source' } },
    { id: 'water', label: { zh: '水源（河湖、地下水）', en: 'Water source' } },
  ],
  defaultOption: 'total',
};

export const renewableHeat: TopicDefinition = {
  id: 'renewable-heat',
  title: { zh: '太陽能熱水器與熱泵：不發電的再生能源', en: 'Solar water heaters and heat pumps: renewable heat' },
  shortTitle: { zh: '太陽能熱水器與熱泵', en: 'Solar heat and heat pumps' },
  defaultIndicator: 'collector-per-capita',
  defaultYear: 2024,
  // 資料幾乎都在歐洲：打開時對著歐洲（含土耳其、賽普勒斯）
  focus: [-25, 34, 45, 71],
  sources: [
    {
      name: {
        zh: 'Eurostat：太陽熱集熱板面積（nrg_inf_stcs）、再生能源與廢棄物的供給（nrg_cb_rw）、熱泵的環境熱（nrg_ind_hpind）',
        en: 'Eurostat: solar thermal collectors’ surface (nrg_inf_stcs), renewables and wastes supply (nrg_cb_rw), heat pumps – ambient heat (nrg_ind_hpind)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_inf_stcs/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '經濟部能源署：能源供給年資料（data.gov.tw 8309）', en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): annual energy supply (data.gov.tw 8309)' },
      url: 'https://data.gov.tw/dataset/8309',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '再生能源不只發電：屋頂的太陽能熱水器直接把陽光變成熱水，熱泵從空氣、地下或水裡把熱「搬」進屋內。資料是 Eurostat 的歐洲各國（英國、科索沃照網站的規則不收），全世界最大的太陽能熱水器市場中國沒有資料；台灣只有能源署能源供給表裡的太陽熱能（2005–2021 年）。集熱板面積不等於能量；熱泵的「環境熱」是從環境搬進來、統計上算再生能源的那一份熱，不是熱泵的出力，也不是台數。',
    en: 'Renewable energy is not only electricity: rooftop solar water heaters turn sunlight straight into hot water, and heat pumps move heat indoors from the air, ground or water. The data are Eurostat figures for European countries (the UK and Kosovo are excluded under this site’s rules); China, the world’s largest solar water heater market, is not covered, and Taiwan has only the solar thermal figure from the Energy Administration’s energy supply table (2005–2021). Collector area is not energy; heat pumps’ “ambient heat” is the heat drawn from the environment that statistics count as renewable, not heat-pump output or the number of units.',
  },
  indicators: [
    {
      id: 'collector-per-capita',
      label: { zh: '每千人的太陽熱集熱板面積', en: 'Solar thermal collector area per 1,000 people' },
      description: {
        zh: '裝上去的太陽能熱水器（太陽熱集熱板）每千人有幾平方公尺。2024 年賽普勒斯 864 平方公尺最多，希臘 584、奧地利 477、丹麥 265、德國 262、土耳其 252、葡萄牙 144；西班牙 95、義大利 88、法國 66。陽光多的南歐不一定最多，奧地利、德國、丹麥都比西班牙高。',
        en: 'Square metres of installed solar water heaters (solar thermal collectors) per 1,000 people. In 2024 Cyprus led with 864 m², then Greece 584, Austria 477, Denmark 265, Germany 262, Türkiye 252 and Portugal 144; Spain had 95, Italy 88 and France 66. Sunny southern Europe does not always lead: Austria, Germany and Denmark are all above Spain.',
      },
      unit: { zh: '平方公尺/千人', en: 'm² per 1,000 people' },
      file: 'collector-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 200, 400] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, v < 10 ? 1 : 0)} 平方公尺`, en: `${fixed(v, v < 10 ? 1 : 0)} m² per 1,000 people` }),
      formatTick: (v) => fixed(v, 0),
      missing: EUROSTAT_NOTE,
    },
    {
      id: 'collector-area',
      label: { zh: '太陽熱集熱板的總面積', en: 'Total solar thermal collector area' },
      description: {
        zh: '裝上去的太陽熱集熱板總面積（千平方公尺）。2024 年德國 22,157 最多、土耳其 22,025 幾乎一樣多，希臘 5,871、義大利 5,211、西班牙 4,531、法國 4,421、奧地利 4,354、波蘭 3,631。德國 2010 年是 13,914、土耳其 12,350。',
        en: 'Total installed solar thermal collector area (thousand m²). In 2024 Germany led with 22,157, with Türkiye almost level at 22,025, then Greece 5,871, Italy 5,211, Spain 4,531, France 4,421, Austria 4,354 and Poland 3,631. In 2010 Germany had 13,914 and Türkiye 12,350.',
      },
      unit: { zh: '千平方公尺', en: 'thousand m²' },
      file: 'collector-area.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 千平方公尺`, en: `${fixed(v, v < 10 ? 1 : 0)} thousand m²` }),
      formatTick: formatLargeTick,
      missing: EUROSTAT_NOTE,
    },
    {
      id: 'solar-heat',
      label: { zh: '太陽熱能：每人每年產多少熱', en: 'Solar thermal heat per person' },
      description: {
        zh: '太陽能熱水器這類設備一年產生的熱，換算成每人幾度（1 度＝1 千瓦小時）。2024 年賽普勒斯每人 678 度，希臘 399、西班牙 372、奧地利 238、丹麥 137、葡萄牙 132、土耳其 127、德國 104、義大利 55。台灣用能源署的數字：2020 年每人 46 度（跟義大利的 46 度差不多），2021 年 36 度；2022 年起表上寫 0。',
        en: 'Heat produced in a year by solar water heaters and similar equipment, in kWh per person. In 2024 Cyprus had 678 kWh per person, Greece 399, Spain 372, Austria 238, Denmark 137, Portugal 132, Türkiye 127, Germany 104 and Italy 55. Taiwan, from Energy Administration figures, had 46 kWh per person in 2020 (about the same as Italy’s 46) and 36 in 2021; the table shows 0 from 2022.',
      },
      unit: { zh: '度/人', en: 'kWh per person' },
      file: 'solar-heat.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 200, 400] } },
      format: kwh,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: 'Eurostat 只有歐洲；台灣只到 2021 年', en: 'Eurostat covers Europe only; Taiwan to 2021' },
    },
    {
      id: 'ambient-heat-per-capita',
      label: { zh: '熱泵：每人每年搬進多少環境熱', en: 'Heat pumps: ambient heat per person' },
      description: {
        zh: '熱泵從空氣、地下、水裡搬進來的熱（統計上算再生能源），換算成每人幾度。2024 年挪威每人 2,219 度最多，瑞典 2,052、芬蘭 1,707、愛沙尼亞 1,206、丹麥 1,033；葡萄牙 797、奧地利 785、法國 780、義大利 574；德國只有 234。',
        en: 'Heat that heat pumps draw from the air, ground or water (counted as renewable), in kWh per person. In 2024 Norway led with 2,219 kWh per person, then Sweden 2,052, Finland 1,707, Estonia 1,206 and Denmark 1,033; Portugal 797, Austria 785, France 780 and Italy 574; Germany only 234.',
      },
      unit: { zh: '度/人', en: 'kWh per person' },
      file: 'ambient-heat-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 250, 500, 1000, 2000] } },
      format: kwh,
      formatTick: (v) => fixed(v, 0),
      missing: EUROSTAT_NOTE,
    },
    {
      id: 'ambient-heat',
      label: { zh: '熱泵搬進來的環境熱（依熱源）', en: 'Ambient heat from heat pumps, by source' },
      description: {
        zh: '熱泵一年搬進來的環境熱（PJ，1 PJ＝1,000 兆焦耳；子項目是熱源）。2024 年法國 186.8 PJ 最多（2014 年 68.5），義大利 122.5、瑞典 78.4、德國 71.3、西班牙 60.8、挪威 44.5、芬蘭 34.5。地熱源（埋管到地下）瑞典 44.3 PJ 占 57%，法國只占 7%，幾乎都是空氣源。',
        en: 'Ambient heat drawn in by heat pumps in a year (PJ; sub-items are heat sources). In 2024 France led with 186.8 PJ (68.5 in 2014), then Italy 122.5, Sweden 78.4, Germany 71.3, Spain 60.8, Norway 44.5 and Finland 34.5. Ground-source pumps supplied 44.3 PJ in Sweden, 57% of the total, but only 7% in France, where nearly all are air-source.',
      },
      unit: 'PJ',
      file: 'ambient-heat/{item}.json',
      dimension: HP,
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => `${fixed(v, v < 10 ? 2 : 1)} PJ`,
      formatTick: (v) => fixed(v, 0),
      missing: EUROSTAT_NOTE,
    },
  ],
};
