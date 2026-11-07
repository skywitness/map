import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 家庭花在交通上的錢（新主題，2026-11-07，製作手冊第二十七批 585，候選 1304；交通的小類「交通政策與投資」）：
 * Eurostat nama_10_co3_p3 用百萬歐元自己算比例，pipeline/topics/household_transport.py。
 * 台灣主計總處的「交通及資通訊」含電信費，不能比，只在側欄（panels/HouseholdTransportPanel.tsx）。
 */
export const householdTransport: TopicDefinition = {
  id: 'household-transport',
  title: { zh: '家庭花在交通上的錢', en: 'Household spending on transport' },
  shortTitle: { zh: '家庭交通支出', en: 'Transport spending' },
  defaultIndicator: 'transport-spending',
  defaultYear: 2022,
  sources: [
    {
      name: {
        zh: 'Eurostat：Final consumption expenditure of households by consumption purpose（nama_10_co3_p3）',
        en: 'Eurostat: Final consumption expenditure of households by consumption purpose (nama_10_co3_p3)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nama_10_co3_p3/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處：家庭收支調查－家庭消費支出結構按消費型態分（政府資料開放平臺 6588）', en: 'DGBAS: Survey of Family Income and Expenditure, consumption expenditure by purpose (data.gov.tw 6588)' },
      url: 'https://data.gov.tw/dataset/6588',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '家庭消費支出是國民所得帳的家庭最終消費（含自有住宅的設算租金），交通（COICOP 07）分成買車（汽機車、自行車）、養車與油錢（燃料、保養、零件、停車、過路費、駕訓）、搭車的費用（大眾運輸、計程車、機票、渡輪、搬家）。比例用百萬歐元的金額自己算（Eurostat 公布的比例四捨五入到整數，而且很多國家沒有）。不含通勤花的時間與公司車。英國照網站的規則不收。台灣主計總處的分類是「交通及資通訊」，含電話、網路費，不能跟歐洲比，只放在側欄。',
    en: 'Household consumption is final consumption by households in the national accounts (including imputed rent on owner-occupied homes). Transport (COICOP 07) is split into buying vehicles (cars, motorcycles, bicycles), running them (fuel, servicing, parts, parking, tolls, driving lessons) and transport services (public transport, taxis, air fares, ferries, removals). Shares are computed from the amounts in millions of euros (Eurostat’s published shares are rounded to whole numbers and missing for many countries). Commuting time and company cars are not included. The UK is excluded under the site’s rules. Taiwan’s statistics group transport with communications (phone and internet bills), so they are not comparable and appear only in the side panel.',
  },
  panelExtra: () => import('./panels/HouseholdTransportPanel'),
  indicators: [
    {
      id: 'transport-spending',
      label: { zh: '占家庭消費支出', en: 'Share of household spending' },
      description: {
        zh: '家庭消費支出裡花在交通上的比例（Eurostat，1995 年起；2023 年以後只有一部分國家，預設 2022 年、36 國）。2022 年土耳其 18.3%、斯洛維尼亞 17.5%、立陶宛 16.1%、挪威 15.7%、盧森堡 15.4%、冰島 14.4%、保加利亞 13.7%、法國 13.6%、德國 13.5% 最高；斯洛伐克 5.6%、阿爾巴尼亞 6.7%、波士尼亞 7.9%、克羅埃西亞 8.2%、北馬其頓 8.7%、瑞士 9.4% 最低。1995 年是斯洛維尼亞 17.0%、賽普勒斯 16.4% 最高。子項目差很多：2023 年希臘的「搭車的費用」占 5.5%（島嶼之間的渡輪），盧森堡只有 1.1%，盧森堡的「養車與油錢」則占 9.8%。點國家看三個子項目的歷年變化。',
        en: 'Share of household consumption spent on transport (Eurostat, from 1995; only some countries after 2022, so the default is 2022 with 36 countries). In 2022 Turkey 18.3%, Slovenia 17.5%, Lithuania 16.1%, Norway 15.7%, Luxembourg 15.4%, Iceland 14.4%, Bulgaria 13.7%, France 13.6% and Germany 13.5% were highest; Slovakia 5.6%, Albania 6.7%, Bosnia 7.9%, Croatia 8.2%, North Macedonia 8.7% and Switzerland 9.4% lowest. In 1995 Slovenia (17.0%) and Cyprus (16.4%) led. The sub-items differ a lot: in 2023 transport services took 5.5% in Greece (ferries between the islands) but only 1.1% in Luxembourg, where running vehicles took 9.8%. Click a country for the three sub-items over time.',
      },
      unit: '%',
      file: 'share/{item}.json',
      dimension: {
        label: { zh: '花在哪裡', en: 'Spent on' },
        options: [
          { id: 'all', label: { zh: '交通', en: 'Transport' } },
          { id: 'vehicles', label: { zh: '買車', en: 'Buying vehicles' } },
          { id: 'operation', label: { zh: '養車與油錢', en: 'Running vehicles' } },
          { id: 'services', label: { zh: '搭車的費用', en: 'Transport services' } },
        ],
        defaultOption: 'all',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [8, 10, 12, 14, 16] },
        itemScales: {
          all: { type: 'sequential', thresholds: [8, 10, 12, 14, 16] },
          vehicles: { type: 'sequential', thresholds: [1, 2, 3, 4, 5] },
          operation: { type: 'sequential', thresholds: [4, 5, 6, 7, 8] },
          services: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 4] },
        },
      },
      format: (v) => `${fixed(v, 1)}%`,
    },
  ],
};
