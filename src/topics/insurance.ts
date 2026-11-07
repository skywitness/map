import { tr } from '../i18n';
import { fixed } from '../lib/format';
import type { DimensionDef, TopicDefinition } from './types';

/**
 * 保險的規模與普及程度（新主題，2026-11-07，製作手冊第二十五批 462，合併候選 1104、1125；pipeline/topics/insurance.py）：
 * OECD Global Insurance Statistics（含台灣），經濟的「金融服務」小類。台灣側欄另外列保發中心的投保率
 */
const TYPE: DimensionDef = {
  label: { zh: '險種', en: 'Line' },
  options: [
    { id: 'total', label: { zh: '全部', en: 'All' } },
    { id: 'life', label: { zh: '壽險', en: 'Life' } },
    { id: 'nonlife', label: { zh: '非壽險（產險、健康險等）', en: 'Non-life (property, health…)' } },
  ],
  defaultOption: 'total',
};

export const insurance: TopicDefinition = {
  id: 'insurance',
  title: { zh: '保險的規模與普及程度', en: 'Insurance markets' },
  shortTitle: { zh: '保險', en: 'Insurance' },
  defaultIndicator: 'penetration',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD Global Insurance Statistics（保險指標 DSD_INS@DF_IND）', en: 'OECD Global Insurance Statistics (insurance indicators, DSD_INS@DF_IND)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_INS%40DF_IND&df[ag]=OECD.DAF.CM',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '財團法人保險事業發展中心「保險密度、滲透度及人壽保險投保率表」（台灣側欄）', en: 'Taiwan Insurance Institute, insurance density, penetration and life insurance ownership (Taiwan panel)' },
      url: 'https://data.gov.tw/dataset/13514',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '保費是保險公司收的毛保費（含再保前），用市場匯率換成美元，匯率變動會造成假漲跌（台幣 2022 年貶值，台灣的保險密度從 4,852 美元掉到 3,676 美元，一部分是匯率）。盧森堡、愛爾蘭、香港是跨境保險中心：在當地設立、賣到歐洲各國或中國大陸的保單也算在當地，分母卻是當地的 GDP，不代表當地人買得特別多。壽險含投資型與儲蓄型保單，高滲透度有一部分是把保險當投資。非壽險是否含健康保險各國不同：荷蘭、美國的私人健康保險算在裡面，台灣的全民健保不算。中國大陸不在 OECD 的保險統計裡，印度只到 2020 年、印尼到 2021 年、泰國到 2011 年。各國最新一年不同（2024 年 52 國、2023 年 57 國），地圖用 1 年內最近一年並標年份。OECD 的台灣數字是保險事業發展中心報的；保發中心自己的滲透度用的 GDP 版本不同（2024 年 10.54%，OECD 是 10.79%），台灣側欄另外列保發中心 2025 年的數字與人壽保險投保率。',
    en: 'Premiums are gross premiums written (before reinsurance), converted to US dollars at market exchange rates, so currency moves create false rises and falls (the Taiwan dollar weakened in 2022 and Taiwan’s density fell from US$4,852 to US$3,676, partly because of that). Luxembourg, Ireland and Hong Kong are cross-border insurance centres: policies sold from there to the rest of Europe or to mainland China count locally, but the denominator is local GDP, so it does not mean residents buy much more insurance. Life insurance includes investment and savings policies, so part of high penetration is insurance used as investment. Whether non-life includes health insurance differs: private health insurance in the Netherlands and the US is included, while Taiwan’s National Health Insurance is not. Mainland China is not in the OECD insurance statistics; India’s data end in 2020, Indonesia’s in 2021 and Thailand’s in 2011. Latest years differ (52 countries for 2024, 57 for 2023), so the map uses each country’s latest year within 1 year and labels it. The OECD’s figures for Taiwan come from the Taiwan Insurance Institute; the institute’s own penetration uses a different GDP vintage (10.54% for 2024 against the OECD’s 10.79%), and Taiwan’s panel also lists its 2025 figures and life insurance ownership rate.',
  },
  panelExtra: () => import('./panels/InsurancePanel'),
  indicators: [
    {
      id: 'penetration',
      label: { zh: '保險滲透度（保費占 GDP）', en: 'Insurance penetration (premiums, % of GDP)' },
      description: {
        zh: '一年的保費占 GDP 的比例，可以拆成壽險與非壽險。2024 年盧森堡 33.0%（跨境保險中心）、香港 18.5%、美國 12.7%、南非 12.7%（2023 年）、瑞典 12.4%、英國 11.8%、愛爾蘭 11.7%、丹麥 11.6%、法國 11.0%，台灣 10.8% 第 10，OECD 合計 9.4%；南韓 9.9%（2023 年）、日本 7.7%、德國 5.9%；最低埃及 0.6%（2023 年）、羅馬尼亞 1.1%、巴拉圭 1.2%。只看壽險，台灣 9.7% 是第 5，盧森堡、香港、瑞典、南非在前面；非壽險是美國 7.8%、荷蘭 7.1%（都含私人健康保險）最高。台灣 2018 年 20.0%，之後一路降到 2024 年的 10.8%。',
        en: 'A year’s premiums as a share of GDP, split into life and non-life. In 2024 Luxembourg 33.0% (a cross-border insurance centre), Hong Kong 18.5%, the US 12.7%, South Africa 12.7% (2023), Sweden 12.4%, the UK 11.8%, Ireland 11.7%, Denmark 11.6% and France 11.0%, with Taiwan 10th at 10.8% and the OECD total at 9.4%; South Korea 9.9% (2023), Japan 7.7%, Germany 5.9%; lowest are Egypt 0.6% (2023), Romania 1.1% and Paraguay 1.2%. For life insurance alone Taiwan ranks 5th at 9.7%, behind Luxembourg, Hong Kong, Sweden and South Africa; in non-life the US (7.8%) and the Netherlands (7.1%) lead, both including private health insurance. Taiwan was at 20.0% in 2018 and fell steadily to 10.8% in 2024.',
      },
      unit: '%',
      file: 'penetration/{item}.json',
      dimension: TYPE,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2, 4, 6, 8, 10, 14] },
        itemScales: {
          life: { type: 'sequential', thresholds: [1, 2, 3, 5, 7, 10] },
          nonlife: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 4, 6] },
        },
      },
      format: (v) => `${fixed(v, 2)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: false,
      defaultYear: 2024,
    },
    {
      id: 'density',
      label: { zh: '保險密度（每人一年保費）', en: 'Insurance density (premiums per person)' },
      description: {
        zh: '平均每人一年繳多少保費（美元，市場匯率）。2024 年盧森堡 45,754 美元（跨境業務）、愛爾蘭 13,128、美國 10,885、香港 10,015、丹麥 8,268、瑞典 7,070、新加坡 7,045（2023 年）、瑞士 7,036、英國 6,186，OECD 合計 4,641；台灣 3,609、南韓 3,519（2023 年）、德國 3,269、日本 2,668；最低埃及 23（2023 年）、尼加拉瓜 42、玻利維亞 64。',
        en: 'Average premiums paid per person per year (US dollars at market exchange rates). In 2024 Luxembourg US$45,754 (cross-border business), Ireland 13,128, the US 10,885, Hong Kong 10,015, Denmark 8,268, Sweden 7,070, Singapore 7,045 (2023), Switzerland 7,036 and the UK 6,186, against an OECD total of 4,641; Taiwan 3,609, South Korea 3,519 (2023), Germany 3,269, Japan 2,668; lowest are Egypt 23 (2023), Nicaragua 42 and Bolivia 64.',
      },
      unit: { zh: '美元/人', en: 'US$ per person' },
      file: 'density/{item}.json',
      dimension: TYPE,
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [250, 500, 1000, 2500, 5000, 8000] },
        itemScales: {
          life: { type: 'sequential', thresholds: [100, 250, 500, 1500, 3000, 5000] },
          nonlife: { type: 'sequential', thresholds: [100, 250, 500, 1000, 2000, 3500] },
        },
      },
      format: (v) => tr({ zh: `${fixed(v, 0)} 美元`, en: `US$${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: false,
      defaultYear: 2024,
    },
    {
      id: 'life-share',
      label: { zh: '壽險占保費的比例', en: 'Life insurance share of premiums' },
      description: {
        zh: '壽險（含年金、投資型保單）占全部保費的比例。2024 年台灣 89.1% 最高，香港 84.8%、盧森堡 84.5%、瑞典 81.3%、南非 76.8%（2023 年）、丹麥 74.9%、日本 74.6%；美國 40.7%、南韓 44.6%（2023 年）、瑞士 29.4%、德國 24.2%、荷蘭 13.9%；冰島 9.7% 最低。比例高的國家多半是壽險兼做儲蓄與投資，比例低的國家健康險或產險占比大。',
        en: 'Life insurance (including annuities and investment-linked policies) as a share of all premiums. In 2024 Taiwan was highest at 89.1%, followed by Hong Kong 84.8%, Luxembourg 84.5%, Sweden 81.3%, South Africa 76.8% (2023), Denmark 74.9% and Japan 74.6%; the US 40.7%, South Korea 44.6% (2023), Switzerland 29.4%, Germany 24.2% and the Netherlands 13.9%; Iceland lowest at 9.7%. High shares usually mean life policies double as savings and investment; low shares mean health or property insurance weighs more.',
      },
      unit: '%',
      file: 'life-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 65, 75, 85] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: false,
      defaultYear: 2024,
    },
  ],
};
