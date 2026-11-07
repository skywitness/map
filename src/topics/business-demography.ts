import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 企業的誕生、死亡與存活（新主題，2026-11-07，製作手冊第二十五批 468，候選 1119；pipeline/topics/business_demography.py）：
 * Eurostat 的企業人口統計（新設率、歇業率、1／3／5 年存活率），經濟的「企業」小類。台灣用商業發展署的公司登記算新設率與歇業率
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const tick = (v: number) => `${v}%`;

export const businessDemography: TopicDefinition = {
  id: 'business-demography',
  title: { zh: '企業的誕生、死亡與存活', en: 'Business births, deaths and survival' },
  shortTitle: { zh: '企業的生與死', en: 'Business demography' },
  defaultIndicator: 'birth',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'Eurostat：Business demography（bd_size 2021 年起、bd_9bd_sz_cl_r2 2020 年以前）', en: 'Eurostat: Business demography (bd_size from 2021, bd_9bd_sz_cl_r2 up to 2020)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/bd_size/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '經濟部商業發展署 新設立、現有、解散撤銷及廢止的公司登記家數（台灣）', en: 'Administration of Commerce (Taiwan), company registrations, dissolutions and companies on the register' },
      url: 'https://data.gov.tw/dataset/29260',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: 'Eurostat 的企業包括一人公司與自營作業者，只算當年有營運（有營業額或員工）的企業，範圍是工業、營造與服務業，不含控股公司。2020 年以前用舊的資料集（行業範圍差一點），2020、2021 年之間有斷點。存活率的時間軸是成立的年份：選 2021 年、3 年存活率，是 2021 年成立的企業到 2024 年還有幾成在；5 年存活率新的資料集只有芬蘭、土耳其、冰島，其他國家到 2015 年成立的那一批。愛沙尼亞 2024 年歇業率 29.2% 是大量休眠公司被一次清理，阿爾巴尼亞 0.8% 明顯漏報。台灣用商業發展署的公司登記：新設立公司家數、解散撤銷及廢止的家數，除以 12 月底登記在案的公司家數（2024 年 791,478 家）；分母含沒有營運的公司、不含行號，所以比歐洲的比例低，不能直接比。台灣沒有存活率。',
    en: 'Eurostat counts enterprises including sole proprietors and one-person companies that were active (with turnover or employees) during the year, across industry, construction and services excluding holding companies. Years up to 2020 come from the older dataset (a slightly different activity scope), so there is a break between 2020 and 2021. Survival rates are placed on the year of birth: choosing 2021 with three-year survival shows the share of enterprises born in 2021 still active in 2024. The new dataset has five-year survival only for Finland, Turkey and Iceland; for other countries the latest cohort is those born in 2015. Estonia’s 29.2% death rate in 2024 reflects a one-off clean-up of dormant companies, and Albania’s 0.8% is clearly under-reported. Taiwan uses the Administration of Commerce’s company register: new registrations and dissolutions, revocations and annulments divided by companies on the register at the end of December (791,478 in 2024). The denominator includes dormant companies and excludes sole proprietorships, so the rates are lower than Europe’s and not directly comparable. There are no survival rates for Taiwan.',
  },
  panelExtra: () => import('./panels/BusinessDemographyPanel'),
  indicators: [
    {
      id: 'birth',
      label: { zh: '新設率', en: 'Business birth rate' },
      description: {
        zh: '當年新設立的企業占活躍企業的比例。2024 年立陶宛 17.5%、葡萄牙 16.1%、土耳其 15.8%、馬爾他 14.4%、法國 14.2%、拉脫維亞 13.9% 最高；義大利 7.9%、德國 7.8%、丹麥 7.2%、奧地利 6.3% 最低。台灣用公司登記算是 5.9%（2024 年新設立 46,805 家），口徑不同、偏低。',
        en: 'New enterprises as a share of active enterprises in the year. In 2024 Lithuania (17.5%), Portugal (16.1%), Turkey (15.8%), Malta (14.4%), France (14.2%) and Latvia (13.9%) were highest; Italy (7.9%), Germany (7.8%), Denmark (7.2%) and Austria (6.3%) lowest. Taiwan’s rate from company registrations is 5.9% (46,805 new companies in 2024), on a different and lower basis.',
      },
      unit: '%',
      file: 'birth.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6, 8, 10, 12, 14, 16] } },
      format: pct,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'death',
      label: { zh: '歇業率', en: 'Business death rate' },
      description: {
        zh: '當年停止營運的企業占活躍企業的比例（最新一年常是初值）。2024 年愛沙尼亞 29.2%（一次清理休眠公司）、愛爾蘭 16.9%、立陶宛 15.6%、北馬其頓與保加利亞 15.0%、斯洛伐克 14.5% 最高；法國 10.9%、德國 10.2%、義大利 6.4%；希臘 3.9%、阿爾巴尼亞 0.8%（漏報）最低。台灣用公司解散、撤銷及廢止算是 3.4%（2024 年 26,658 家）。',
        en: 'Enterprises that stopped operating as a share of active enterprises (the latest year is often provisional). In 2024 Estonia (29.2%, a one-off clean-up of dormant companies), Ireland (16.9%), Lithuania (15.6%), North Macedonia and Bulgaria (15.0%) and Slovakia (14.5%) were highest; France 10.9%, Germany 10.2%, Italy 6.4%; Greece (3.9%) and Albania (0.8%, under-reported) lowest. Taiwan’s rate from company dissolutions, revocations and annulments is 3.4% (26,658 in 2024).',
      },
      unit: '%',
      file: 'death.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 7, 9, 11, 13, 16] } },
      format: pct,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'survival',
      label: { zh: '新企業的存活率', en: 'Survival of new businesses' },
      description: {
        zh: '某一年成立的企業，1、3、5 年後還在營運的比例（時間軸是成立的年份）。1 年：2023 年成立的，荷蘭 95.9%、奧地利 92.3%、比利時 89.7% 最高，丹麥 72.6%、立陶宛 67.5% 最低。3 年：2021 年成立的，荷蘭 78.1%、比利時 74.9%、希臘 72.5%，法國 48.9%、丹麥 45.4%、立陶宛 43.5%，大約一半撐不過 3 年。5 年：2015 年成立的，荷蘭 64.7%、盧森堡 56.1%，德國 37.1%、挪威 32.0%、立陶宛 27.2%。台灣沒有存活率的統計。',
        en: 'The share of enterprises born in a given year still active one, three or five years later (the timeline is the year of birth). One year, born in 2023: the Netherlands (95.9%), Austria (92.3%) and Belgium (89.7%) highest, Denmark (72.6%) and Lithuania (67.5%) lowest. Three years, born in 2021: the Netherlands 78.1%, Belgium 74.9%, Greece 72.5%; France 48.9%, Denmark 45.4%, Lithuania 43.5%, so about half do not last three years. Five years, born in 2015: the Netherlands 64.7%, Luxembourg 56.1%; Germany 37.1%, Norway 32.0%, Lithuania 27.2%. Taiwan has no survival statistics.',
      },
      unit: '%',
      file: 'survival/{item}.json',
      dimension: {
        label: { zh: '幾年後', en: 'After' },
        options: [
          { id: 'y1', label: { zh: '1 年', en: '1 year' } },
          { id: 'y3', label: { zh: '3 年', en: '3 years' } },
          { id: 'y5', label: { zh: '5 年', en: '5 years' } },
        ],
        defaultOption: 'y3',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [45, 50, 55, 60, 65, 70] },
        itemScales: {
          y1: { type: 'sequential', thresholds: [70, 75, 80, 85, 90, 95] },
          y5: { type: 'sequential', thresholds: [30, 35, 40, 45, 50, 55] },
        },
      },
      format: pct,
      formatTick: tick,
      compareWorld: false,
      defaultYear: 'latest',
      noValue: { TWN: { zh: '台灣沒有企業存活率的統計', en: 'Taiwan publishes no business survival rates' } },
    },
  ],
};
