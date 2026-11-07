import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent, intlDollars, usd } from '../lib/format';
import { LONG_RUN_CAVEAT, LONG_RUN_SOURCE } from './longRun';
import type { TopicDefinition } from './types';
import { COVID, FINANCIAL_CRISIS } from './events';

export const income: TopicDefinition = {
  id: 'income',
  title: { zh: '各國人均收入', en: 'Income by country' },
  shortTitle: { zh: '人均收入', en: 'Income' },
  defaultIndicator: 'gdp-per-capita',
  defaultYear: 2025,
  sources: [
    {
      name: 'IMF, World Economic Outlook (October 2026)',
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明來源即可使用', en: 'free to use with attribution' },
    },
    { name: 'World Bank, World Development Indicators', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    LONG_RUN_SOURCE,
    {
      name: { zh: 'ILOSTAT：SDG 10.4.1 勞動報酬占 GDP（DF_SDG_1041_NOC_RT，ILO 模型估計）', en: 'ILOSTAT: SDG 10.4.1 labour share of GDP (DF_SDG_1041_NOC_RT, ILO modelled estimates)' },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '2026 年起為 IMF 推估值。古巴、格陵蘭等 IMF 未涵蓋的地區改用世界銀行資料。',
    en: 'Figures from 2026 onward are IMF projections. Places the IMF does not cover, such as Cuba and Greenland, use World Bank data.',
  },
  indicators: [
    {
      id: 'gdp-per-capita',
      label: { zh: '人均 GDP', en: 'GDP per capita' },
      description: {
        zh: '每人平均國內生產毛額，以當年匯率換算成美元。',
        en: 'Gross domestic product per person, converted to US dollars at current exchange rates.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'gdp-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2500, 5000, 10000, 25000, 50000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp-per-capita-ppp',
      label: { zh: '人均 GDP（購買力平價）', en: 'GDP per capita (PPP)' },
      description: {
        zh: '用購買力平價換算，扣除各國物價差異，比較實際生活水準。單位是國際元。',
        en: 'Converted at purchasing power parity to remove price differences between countries, so living standards can be compared. In international dollars.',
      },
      unit: { zh: '國際元', en: 'international $' },
      file: 'gdp-per-capita-ppp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2500, 5000, 10000, 25000, 50000, 75000] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'gdp',
      label: { zh: 'GDP 總額', en: 'GDP' },
      description: {
        zh: '國內生產毛額，以當年匯率換算成美元。圓的面積與經濟規模成正比。',
        en: 'Gross domestic product in US dollars at current exchange rates. Circle area is proportional to the size of the economy.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'gdp.json',
      layer: { kind: 'bubble', legendValues: [1e11, 1e12, 1e13] },
      format: (v) => usd(formatLargeNumber(v)),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'gdp-growth',
      label: { zh: '經濟成長率', en: 'GDP growth' },
      description: {
        zh: '實質 GDP 相較前一年的變化（已扣除物價上漲）。橘色為經濟衰退、綠色為成長。',
        en: 'Change in real GDP from the previous year (adjusted for inflation). Orange means contraction, green means growth.',
      },
      unit: '%',
      file: 'gdp-growth.json',
      events: [FINANCIAL_CRISIS, COVID],
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-5, -2, -0.5, 0.5, 2, 5] } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
    {
      id: 'gdp-per-capita-1800',
      label: { zh: '人均 GDP（1800 年起）', en: 'GDP per capita (since 1800)' },
      description: {
        zh: `1800–2024 年的人均 GDP，購買力平價、2021 年的國際元（已扣除物價上漲），單位跟上面 IMF 的指標不同，不能直接比。1990 年起跟世界銀行相同，之前主要用 Maddison Project 回推。${LONG_RUN_CAVEAT.zh}`,
        en: `GDP per capita 1800–2024 at purchasing power parity in constant 2021 international dollars (adjusted for inflation), so not directly comparable with the IMF indicators above. World Bank figures from 1990, mostly Maddison Project reconstructions before that. ${LONG_RUN_CAVEAT.en}`,
      },
      unit: { zh: '2021 年國際元', en: '2021 international $' },
      file: 'gdp-per-capita-1800.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 2500, 5000, 10000, 25000, 50000] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'labour-share',
      label: { zh: '勞動報酬占 GDP', en: 'Labour share of GDP' },
      description: {
        zh: '一年產出的所得裡有幾成付給勞動（受僱者的薪資與雇主負擔的保費，加上自僱者所得裡推估屬於勞動的部分），聯合國永續發展目標 10.4.1（ILO 的模型估計，2004 年起；2025 年以後是推估）。2024 年德國 62.0%、法國 60.0%、南韓 58.1%、美國 55.5%、日本 54.8%、台灣 51.9%、中國大陸 51.2%、新加坡 42.8%，世界 52.5%；瑞士 71.3% 最高之一，石油國卡達 27.8%、巴林 27.5% 偏低。奈及利亞 75.1% 這類極端值是非正式就業多、自僱所得多半算成勞動報酬，不代表勞工分得多。跟人均 GDP 一起看：經濟成長了，薪水有沒有跟上。',
        en: 'The share of the income an economy produces in a year that goes to labour (employees’ pay and employers’ social contributions, plus the part of self-employment income estimated to be labour), UN Sustainable Development Goal indicator 10.4.1 (ILO modelled estimates from 2004; projections from 2025). In 2024 Germany was 62.0%, France 60.0%, South Korea 58.1%, the US 55.5%, Japan 54.8%, Taiwan 51.9%, mainland China 51.2% and Singapore 42.8%, against a world 52.5%; Switzerland’s 71.3% is among the highest, while oil states such as Qatar (27.8%) and Bahrain (27.5%) are low. Extremes like Nigeria’s 75.1% reflect widespread informal work, with self-employment income counted largely as labour, not a better deal for workers. Read it alongside GDP per capita: has pay kept up with growth?',
      },
      unit: '%',
      file: 'labour-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [35, 42, 48, 53, 58, 63] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 2024,
    },
  ],
};
