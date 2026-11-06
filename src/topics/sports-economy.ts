import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 運動的擴充：運動業的就業與政府的運動與休閒支出（2026-11-06，製作手冊第二十四批 425；pipeline/topics/sports_economy.py）。
 * Eurostat 的運動就業（sprt_emp_sex）與 COFOG 08.1（gov_10a_exp），台灣用運動部的體育預算占 GDP（定義較窄）。
 */
export const sportsEconomyPart: TopicPart = {
  name: { zh: '運動業的就業與政府的運動支出', en: 'Sport employment and public spending' },
  sources: [
    {
      name: { zh: 'Eurostat：運動業的就業（sprt_emp_sex）、政府支出依功能別（gov_10a_exp，COFOG 08.1）', en: 'Eurostat: employment in sport (sprt_emp_sex) and government expenditure by function (gov_10a_exp, COFOG 08.1)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/sprt_emp_sex/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '運動部：中央與地方政府機關體育運動經費占 GDP 比例（data.gov.tw 104905）', en: 'Sports Administration (Taiwan): central and local sports budgets as a share of GDP (data.gov.tw 104905)' },
      url: 'https://data.gov.tw/dataset/104905',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '運動業的就業是 Eurostat 依行業與職業交叉算的：運動業的所有人，加上其他行業裡做運動相關職業的人，只有歐洲。政府支出是 COFOG 08.1「運動與休閒服務」，含公園、游泳池這類休閒設施，不是純運動。台灣是運動部公布的中央與地方「體育運動組織預算」占 GDP，只算體育，定義比較窄，不能直接跟歐洲比。',
    en: 'Sport employment is Eurostat’s cross of industry and occupation: everyone working in the sport industry plus people in sport occupations in other industries; Europe only. Government spending is COFOG 08.1, recreational and sporting services, which includes parks and swimming pools, not just sport. Taiwan’s figure is the Sports Administration’s central and local sports-organisation budgets as a share of GDP, a narrower definition that cannot be compared directly with Europe.',
  },
  indicators: [
    {
      id: 'sport-employment',
      label: { zh: '運動業的就業（歐洲）', en: 'Employment in sport (Europe)' },
      description: {
        zh: '在運動業或做運動相關工作的人占總就業的比例（Eurostat，2011–2025）。2025 年冰島 2.46% 最高，瑞典 1.59%、丹麥 1.30%、芬蘭 1.25%、西班牙 1.20%、法國 1.16%；德國 0.68%、奧地利 0.63%、波蘭 0.52%；土耳其 0.38%、北馬其頓 0.34%、波赫 0.32%、羅馬尼亞 0.22% 最低，相差 11 倍。',
        en: 'People working in the sport industry or in sport occupations as a share of total employment (Eurostat, 2011–2025). In 2025 Iceland was highest at 2.46%, then Sweden 1.59%, Denmark 1.30%, Finland 1.25%, Spain 1.20% and France 1.16%; Germany 0.68%, Austria 0.63% and Poland 0.52%; Türkiye 0.38%, North Macedonia 0.34%, Bosnia and Herzegovina 0.32% and Romania 0.22% were lowest, an elevenfold gap.',
      },
      unit: '%',
      file: 'sport-employment.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.4, 0.6, 0.8, 1, 1.2, 1.5] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2025,
    },
    {
      id: 'sport-gov-spending',
      label: { zh: '政府的運動與休閒支出', en: 'Public spending on recreation and sport' },
      description: {
        zh: '一般政府花在運動與休閒服務（COFOG 08.1，含公園、游泳池）的錢占 GDP（Eurostat，1995–2025）。2024 年冰島 1.5% 最高，瑞典 0.7%，盧森堡、匈牙利、芬蘭 0.6%，法國、荷蘭、波蘭 0.5%；德國、義大利 0.3%，愛爾蘭、賽普勒斯、保加利亞 0.1%。台灣是運動部的體育預算占 GDP，2022 年 0.12%，只算體育、定義比較窄。',
        en: 'General government spending on recreational and sporting services (COFOG 08.1, including parks and pools) as a share of GDP (Eurostat, 1995–2025). In 2024 Iceland was highest at 1.5%, then Sweden 0.7%, Luxembourg, Hungary and Finland 0.6%, and France, the Netherlands and Poland 0.5%; Germany and Italy 0.3%, and Ireland, Cyprus and Bulgaria 0.1%. Taiwan’s value is the Sports Administration’s sports budget as a share of GDP, 0.12% in 2022, a narrower definition.',
      },
      unit: '%',
      file: 'sport-gov-spending.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.7] } },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
  ],
};
