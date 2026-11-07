import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 區域供熱：管線長度、用戶與送出多少熱（新主題，2026-11-07，製作手冊第二十七批 611，候選 1341；能源・電力）：
 * Eurostat 的區域供熱網路統計（歐洲），pipeline/topics/district_heating.py；側欄 panels/DistrictHeatingPanel.tsx。
 */
export const districtHeating: TopicDefinition = {
  id: 'district-heating',
  title: { zh: '區域供熱：管線、用戶與送出多少熱', en: 'District heating: networks, customers and heat delivered' },
  shortTitle: { zh: '區域供熱', en: 'District heating' },
  defaultIndicator: 'dh-heat-per-capita',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'Eurostat：區域供熱與供冷網路的數量與長度、用戶、送出的能源（nrg_dhdc_n、nrg_dhdc_c、nrg_dhdc_e）',
        en: 'Eurostat: district heating and cooling networks, customers and energy supplied (nrg_dhdc_n, nrg_dhdc_c, nrg_dhdc_e)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_dhdc_n/default/table',
      license: 'CC BY 4.0',
    },
    { name: { zh: '聯合國《世界人口展望》（人口）', en: 'UN World Population Prospects (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '區域供熱是在發電廠、垃圾焚化廠或鍋爐集中產生熱水或蒸汽，經地下管線送到住宅、辦公室與工廠取暖或供應熱水。資料是 Eurostat 2016–2024 年的申報，只有歐洲約 30 國，很多國家有些年份沒有申報（丹麥沒有申報管線長度、瑞典沒有申報網路數），沒有申報不等於沒有；各國用 3 年內最近的一年。用戶數的定義各國不同（有的算建築、有的算住戶），所以只放在側欄。台灣沒有區域供熱。',
    en: 'District heating produces hot water or steam centrally at power plants, waste incinerators or boilers and pipes it underground to homes, offices and factories for space heating and hot water. Data are Eurostat returns for 2016–2024, covering only about 30 European countries, and many skip some years (Denmark does not report pipe length, Sweden not the number of networks), so missing does not mean none; each country’s latest year within three years is shown. Customer counts are defined differently (buildings in some countries, dwellings in others), so they appear only in the side panel. Taiwan has no district heating.',
  },
  panelExtra: () => import('./panels/DistrictHeatingPanel'),
  indicators: [
    {
      id: 'dh-heat-per-capita',
      label: { zh: '每人每年送出的區域供熱', en: 'District heat supplied per person' },
      description: {
        zh: '區域供熱一年送出的熱除以人口（GJ／人）。2024 年丹麥 18.4 GJ、瑞典 17.1、拉脫維亞 10.7、盧森堡 7.2、奧地利 6.8，斯洛維尼亞、保加利亞 2.7，羅馬尼亞、法國 1.4，義大利 0.6；芬蘭（2022 年）21.2、愛沙尼亞（2023 年）11.0。點國家看網路數、管線長度、用戶數與熱送到哪裡。',
        en: 'Heat supplied by district heating in a year divided by population (GJ per person). In 2024 Denmark 18.4 GJ, Sweden 17.1, Latvia 10.7, Luxembourg 7.2 and Austria 6.8, Slovenia and Bulgaria 2.7, Romania and France 1.4 and Italy 0.6; Finland 21.2 (2022) and Estonia 11.0 (2023). Click a country for networks, pipe length, customers and where the heat goes.',
      },
      unit: { zh: 'GJ／人', en: 'GJ per person' },
      file: 'heat-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 2, 5, 10, 15] } },
      format: (v) => tr({ zh: `${fixed(v, v < 1 ? 2 : 1)} GJ／人`, en: `${fixed(v, v < 1 ? 2 : 1)} GJ per person` }),
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      defaultYear: 'latest',
      missing: { zh: '沒有申報（只有歐洲）', en: 'Not reported (Europe only)' },
    },
    {
      id: 'dh-length',
      label: { zh: '區域供熱管線的長度', en: 'Length of district heating pipes' },
      description: {
        zh: '區域供熱網路的管線總長。2024 年羅馬尼亞 14,051 公里（476 個網路）、法國 7,728（877 個）、奧地利 6,200（1,200 個）、義大利 5,367、拉脫維亞 3,535、保加利亞 3,189（只有 42 個網路）；芬蘭 2022 年 15,143 公里。丹麥、瑞典沒有申報長度。',
        en: 'Total pipe length of district heating networks. In 2024 Romania 14,051 km (476 networks), France 7,728 (877), Austria 6,200 (1,200), Italy 5,367, Latvia 3,535 and Bulgaria 3,189 (only 42 networks); Finland 15,143 km in 2022. Denmark and Sweden do not report length.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'length.json',
      layer: { kind: 'bubble', legendValues: [500, 5000, 15000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` }),
      formatTick: formatLargeTick,
      defaultYear: 'latest',
      missing: { zh: '沒有申報', en: 'Not reported' },
    },
  ],
};
