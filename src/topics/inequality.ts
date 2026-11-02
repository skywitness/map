import { fixed, intlDollars } from '../lib/format';
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
      name: {
        zh: 'World Bank, Poverty and Inequality Platform（WDI 與 PIP API）',
        en: 'World Bank, Poverty and Inequality Platform (WDI and PIP API)',
      },
      url: 'https://pip.worldbank.org/',
      license: 'CC BY 4.0',
    },
    { name: 'World Inequality Database (WID.world)', url: 'https://wid.world/', license: 'CC BY-NC-SA 4.0' },
    {
      name: { zh: '行政院主計總處，家庭收支調查', en: 'DGBAS (Taiwan), Survey of Family Income and Expenditure' },
      url: 'https://www.stat.gov.tw/News.aspx?n=3908',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '吉尼係數與極端貧窮來自各國的家庭調查，有的國家量所得、有的量消費（消費的差距通常比所得小），調查年份也不一樣，每個國家顯示 10 年內最近一次調查。' +
      '所得份額是 WID 結合調查、稅務資料與國民所得帳估計的稅前國民所得（20 歲以上，夫妻平分），含台灣，比家庭調查更能掌握最高所得者，所以不平等通常比吉尼係數顯示的大。' +
      '每人每日所得中位數與繁榮差距也是 PIP 依同一次調查算的，以 2021 年購買力平價的美元計；繁榮差距是世界銀行 2024 年起用的指標，以每天 28 美元為「繁榮線」。' +
      'WDI 轉載的 PIP 沒有台灣，台灣用 PIP API 的「Taiwan, China」（主計總處家庭收支調查經盧森堡所得研究整理，1981–2021 年），跟其他國家同一套算法；主計總處自己公布的吉尼係數（2025 年每人 0.272、以戶計算 0.341）定義不同，寫在附註。',
    en:
      "The Gini index and extreme poverty come from household surveys; some countries measure income and others consumption (consumption is usually more equal), and survey years differ, so each country shows its latest survey within 10 years. " +
      "Income shares are WID estimates of pre-tax national income (adults 20+, split equally between spouses) combining surveys, tax data and national accounts, Taiwan included. They capture top incomes better than surveys, so inequality usually looks larger than the Gini suggests. " +
      'Median income per day and the prosperity gap are computed by PIP from the same surveys, in 2021 PPP dollars; the prosperity gap, used by the World Bank since 2024, measures distance from a prosperity standard of $28 a day. ' +
      "The PIP data republished in WDI exclude Taiwan, so Taiwan comes from the PIP API, listed as \"Taiwan, China\" (DGBAS's Family Income and Expenditure Survey as harmonised by the Luxembourg Income Study, 1981–2021), the same method as for other countries; DGBAS's own Gini figures (0.272 per person and 0.341 per household in 2025) use different definitions and are given in the note.",
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
      id: 'median',
      label: { zh: '每人每日所得中位數', en: 'Median income per day' },
      description: {
        zh: '把全國的人依每人每天的所得（或消費）排隊，正中間那個人的金額，單位是國際元（2021 年購買力平價的美元，已扣掉各國物價的差別）。比平均數更接近「一般人」：台灣 2021 年 46.1、日本 42.2、韓國 54.3、美國 72.1、印度 5.9。',
        en: 'The daily income (or consumption) per person of someone in the middle of the national distribution, in international dollars (2021 PPP, adjusted for price differences). Closer to the typical person than the mean: Taiwan Int$46.1 in 2021, Japan 42.2, South Korea 54.3, the US 72.1, India 5.9.',
      },
      unit: { zh: '國際元／天', en: 'Int$/day' },
      file: 'median.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 6, 10, 20, 40, 60] } },
      format: (v) => intlDollars(fixed(v, 1)),
      formatTick: (v) => `${fixed(v, 0)}`,
    },
    {
      id: 'prosperity-gap',
      label: { zh: '繁榮差距', en: 'Prosperity gap' },
      description: {
        zh: '離「每天 28 美元」的繁榮線平均有多遠（2021 年購買力平價）：每個人的繁榮線 ÷ 自己的所得，全國平均。1 是平均剛好在線上，越大離得越遠，所得低的人權重大，所以同時反映所得高低與分配。台灣 2021 年 0.70、美國 1.32、印度 4.95、剛果民主共和國 26.1。',
        en: 'How far incomes are, on average, from a prosperity standard of $28 a day (2021 PPP): the standard divided by each person’s income, averaged over the population. 1 means the average is right at the line; larger is farther. Poorer people weigh more, so it reflects both income levels and inequality. Taiwan 0.70 in 2021, the US 1.32, India 4.95, DR Congo 26.1.',
      },
      unit: '',
      file: 'prosperity-gap.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5, 8, 12] } },
      format: (v) => fixed(v, 2),
      formatTick: (v) => fixed(v, 0),
      lowerIsBetter: true,
      compareWorld: true,
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
