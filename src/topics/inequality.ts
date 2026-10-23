import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;

export const inequality: TopicDefinition = {
  id: 'inequality',
  title: { zh: '貧富差距', en: 'Income inequality' },
  shortTitle: { zh: '貧富差距', en: 'Inequality' },
  defaultIndicator: 'gini',
  defaultYear: 2022,
  sources: [
    {
      name: { zh: 'World Bank, Poverty and Inequality Platform（WDI）', en: 'World Bank, Poverty and Inequality Platform (WDI)' },
      url: 'https://pip.worldbank.org/',
      license: 'CC BY 4.0',
    },
    { name: 'World Inequality Database (WID.world)', url: 'https://wid.world/', license: 'CC BY 4.0' },
    {
      name: { zh: '行政院主計總處，家庭收支調查', en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure' },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '吉尼係數與極端貧窮來自各國的家庭調查，有的國家量所得、有的量消費（消費的差距通常比所得小），調查年份也不一樣，每個國家顯示 10 年內最近一次調查。' +
      '所得份額是 WID 結合調查、稅務資料與國民所得帳估計的稅前國民所得（20 歲以上，夫妻平分），含台灣，比家庭調查更能掌握最高所得者，所以不平等通常比吉尼係數顯示的大。台灣的吉尼係數用主計總處家庭收支調查的每人可支配所得。',
    en:
      "The Gini index and extreme poverty come from household surveys; some countries measure income and others consumption (consumption is usually more equal), and survey years differ, so each country shows its latest survey within 10 years. " +
      "Income shares are WID estimates of pre-tax national income (adults 20+, split equally between spouses) combining surveys, tax data and national accounts, Taiwan included. They capture top incomes better than surveys, so inequality usually looks larger than the Gini suggests. Taiwan's Gini uses per-capita disposable income from DGBAS's household survey.",
  },
  indicators: [
    {
      id: 'gini',
      label: { zh: '吉尼係數', en: 'Gini index' },
      description: {
        zh: '所得（或消費）分配的不平均程度，0 是每個人都一樣、100 是一個人拿走全部。北歐約 25–28，南部非洲超過 50。',
        en: 'How unequally income (or consumption) is distributed: 0 means everyone has the same, 100 means one person has everything. About 25–28 in the Nordic countries, above 50 in southern Africa.',
      },
      unit: '',
      file: 'gini.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [27.5, 30, 32.5, 35, 40, 45] } },
      format: (v) => fixed(v, 1),
      formatTick: (v) => fixed(v, v % 1 ? 1 : 0),
    },
    {
      id: 'top10',
      label: { zh: '所得最高 10% 的份額', en: 'Income share of the top 10%' },
      description: {
        zh: '所得最高的 10% 成人拿走全國稅前所得的比例（WID）。如果完全平均會是 10%。',
        en: 'Share of national pre-tax income going to the top 10% of adults (WID). It would be 10% if everyone earned the same.',
      },
      unit: '%',
      file: 'top10.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [32.5, 37.5, 42.5, 47.5, 52.5, 57.5] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 1)}%`,
      compareWorld: true,
    },
    {
      id: 'bottom50',
      label: { zh: '所得最低 50% 的份額', en: 'Income share of the bottom 50%' },
      description: {
        zh: '所得較低的一半成人拿到全國稅前所得的比例（WID），顏色越深越平均。如果完全平均會是 50%。',
        en: 'Share of national pre-tax income going to the bottom half of adults (WID); darker means more equal. It would be 50% if everyone earned the same.',
      },
      unit: '%',
      file: 'bottom50.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 10, 12, 14, 17, 20] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
    },
    {
      id: 'poverty',
      label: { zh: '極端貧窮人口比例', en: 'Extreme poverty' },
      description: {
        zh: '每人每天生活費不到 3 美元（2021 年購買力平價）的人口比例，世界銀行的國際貧窮線。',
        en: "Share of people living on less than $3.00 a day (2021 PPP), the World Bank's international poverty line.",
      },
      unit: '%',
      file: 'poverty.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 25, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, v < 10 && v % 1 ? 1 : 0)}%`,
    },
  ],
};
