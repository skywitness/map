import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 抗藥性（2026-11-03，製作手冊第十九批 293；pipeline/topics/antimicrobial_resistance.py）：
 * WHO GLASS 的大腸桿菌、MRSA 抗藥比例與抗藥性結核（GHO，CC BY 4.0）；台灣用疾管署的抗生素敏感性統計（data.gov.tw 43600）。
 */

const pct = (v: number) => `${fixed(v, 1)}%`;

const CAVEAT = {
  zh: '是有送驗的病人（血流感染）的菌株，不是一般人口；各國參加通報的醫院與菌株數差很多，抗藥比例低有時是因為檢驗量少，100% 或 0% 多半是菌株很少。',
  en: 'These are isolates from tested patients (bloodstream infections), not the general population; participating hospitals and isolate numbers vary widely, so a low rate can reflect little testing, and 100% or 0% usually means very few isolates.',
};

export const antimicrobialResistance: TopicDefinition = {
  id: 'antimicrobial-resistance',
  title: { zh: '抗藥性：細菌對抗生素的抗藥比例', en: 'Antimicrobial resistance' },
  shortTitle: { zh: '抗藥性', en: 'Drug resistance' },
  defaultIndicator: 'ecoli',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'WHO Global Health Observatory：GLASS 抗藥性監測（AMR_INFECT_ECOLI、AMR_INFECT_MRSA）、抗藥性結核的估計新病例數（TB_e_inc_rr_num）',
        en: 'WHO Global Health Observatory: GLASS surveillance (AMR_INFECT_ECOLI, AMR_INFECT_MRSA) and estimated new cases of drug-resistant TB (TB_e_inc_rr_num)',
      },
      url: 'https://www.who.int/data/gho',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（每 10 萬人的人口）', en: 'United Nations, World Population Prospects 2024 (population for rates per 100,000)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '衛生福利部疾病管制署「抗藥性監測通報之抗生素敏感性統計資料分析」（台灣，2021–2025 年）',
        en: 'Taiwan Centers for Disease Control, antimicrobial susceptibility statistics from resistance surveillance (Taiwan, 2021–2025)',
      },
      url: 'https://data.gov.tw/dataset/43600',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: {
        zh: 'ECDC, Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals 2022–2023，附錄 2 國家摘要表（資料由各國公共衛生機關提供）',
        en: 'ECDC, Point prevalence survey of healthcare-associated infections and antimicrobial use in European acute care hospitals 2022–2023, annex 2 country summary sheets (dataset provided by ECDC based on data provided by public health authorities)',
      },
      url: 'https://www.ecdc.europa.eu/en/publications-data/PPS-HAI-AMR-acute-care-europe-2022-2023',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: `抗藥比例來自各國向 WHO 全球抗藥性監測系統（GLASS）的通報，2017 年起，各國用 2 年內最近的一年。${CAVEAT.zh}抗藥性結核是 WHO 估計的 rifampicin 抗藥或多重抗藥結核（RR/MDR-TB）新病例數，每 10 萬人用聯合國的人口自己算。台灣不在 WHO 的資料裡，用疾管署抗藥性監測通報的全國統計（2023 年 315 家醫院）：大腸桿菌對 ceftriaxone、金黃色葡萄球菌對 oxacillin 不敏感的比例。疾管署的統計含所有檢體（不只血流感染），「不敏感」也含中間型，跟 WHO 的定義不同，只能大略比較；2024、2025 年的數字寫在台灣的附註。`,
    en: `Resistance shares come from national reports to WHO’s Global Antimicrobial Resistance and Use Surveillance System (GLASS) from 2017, using each country’s latest year within two years. ${CAVEAT.en} Drug-resistant TB is WHO’s estimate of new rifampicin-resistant or multidrug-resistant (RR/MDR-TB) cases, converted to a rate per 100,000 with UN population. Taiwan is not in WHO’s data; its values are national figures from Taiwan CDC’s resistance surveillance (315 hospitals in 2023): E. coli non-susceptible to ceftriaxone and S. aureus non-susceptible to oxacillin. They cover all specimen types (not just bloodstream infections) and count intermediate isolates as non-susceptible, so they are only roughly comparable with WHO’s definition; 2024 and 2025 figures are in Taiwan’s note.`,
  },
  indicators: [
    {
      id: 'ecoli',
      label: { zh: '大腸桿菌的抗藥比例', en: 'Resistant E. coli' },
      description: {
        zh: `血流感染的大腸桿菌裡，對第三代頭孢菌素（常用的強效抗生素）有抗藥性的比例。2023 年尚比亞 93.5%、迦納 90.6%、埃及 89.4%、印度 80.1%；南韓 38.9%、泰國 38.7%、日本 20.3%；英國 13.2%、德國 9.8%、丹麥 6.3%、挪威 5.7%。台灣（疾管署，對 ceftriaxone 不敏感，所有檢體）2023 年 30.6%、2025 年 33.3%。${CAVEAT.zh}`,
        en: `Share of E. coli from bloodstream infections resistant to third-generation cephalosporins (widely used strong antibiotics). In 2023: Zambia 93.5%, Ghana 90.6%, Egypt 89.4%, India 80.1%; South Korea 38.9%, Thailand 38.7%, Japan 20.3%; the UK 13.2%, Germany 9.8%, Denmark 6.3%, Norway 5.7%. Taiwan (Taiwan CDC, non-susceptible to ceftriaxone, all specimens): 30.6% in 2023, 33.3% in 2025. ${CAVEAT.en}`,
      },
      unit: '%',
      file: 'ecoli.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 40, 60, 80] } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'mrsa',
      label: { zh: 'MRSA 的比例', en: 'MRSA' },
      description: {
        zh: `血流感染的金黃色葡萄球菌裡，抗甲氧西林（MRSA，對大部分 β-內醯胺類抗生素都有抗藥性）的比例。2023 年伊拉克 89.7%、埃及 88.9%、印度 53.6%、南韓 45.2%、日本 32.5%；英國 9.9%、芬蘭 0.4%。台灣（疾管署，所有檢體）2023 年 45.5%、2025 年 47.3%。${CAVEAT.zh}`,
        en: `Share of Staphylococcus aureus from bloodstream infections that are methicillin-resistant (MRSA, resistant to most beta-lactam antibiotics). In 2023: Iraq 89.7%, Egypt 88.9%, India 53.6%, South Korea 45.2%, Japan 32.5%; the UK 9.9%, Finland 0.4%. Taiwan (Taiwan CDC, all specimens): 45.5% in 2023, 47.3% in 2025. ${CAVEAT.en}`,
      },
      unit: '%',
      file: 'mrsa.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 70] } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'mdr-tb',
      label: { zh: '抗藥性結核', en: 'Drug-resistant TB' },
      description: {
        zh: '每 10 萬人有幾個抗藥性結核（rifampicin 抗藥或多重抗藥）的新病例，WHO 的估計。2024 年巴布亞紐幾內亞 36.9、吉爾吉斯 36.2、蒙古 28.8、烏克蘭 25.6、菲律賓 24.2；全世界約 39 萬例。',
        en: 'Estimated new cases of drug-resistant TB (rifampicin-resistant or multidrug-resistant) per 100,000 people (WHO). In 2024: Papua New Guinea 36.9, Kyrgyzstan 36.2, Mongolia 28.8, Ukraine 25.6, the Philippines 24.2; about 390,000 cases worldwide.',
      },
      unit: { zh: '每 10 萬人', en: 'per 100,000' },
      file: 'mdr-tb.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 5, 10, 20] } },
      format: (v) => tr({ zh: `每 10 萬人 ${fixed(v, 1)} 例`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mdr-tb-cases',
      label: { zh: '抗藥性結核的病例數', en: 'Drug-resistant TB cases' },
      description: {
        zh: '抗藥性結核的估計新病例數：2024 年印度約 13 萬例最多，其次是菲律賓、中國（各約 2.8 萬）、俄羅斯、印尼（各約 2.6 萬）。',
        en: 'Estimated new cases of drug-resistant TB: in 2024 India had the most, about 130,000, followed by the Philippines and China (about 28,000 each) and Russia and Indonesia (about 26,000 each).',
      },
      unit: { zh: '例', en: 'cases' },
      file: 'mdr-tb-cases.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 例`, en: `${formatLargeNumber(v)} cases` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'hai-prevalence',
      label: { zh: '醫院裡的醫療照護相關感染（歐洲）', en: 'Healthcare-associated infections in hospitals (Europe)' },
      description: {
        zh: '急性照護醫院的住院病人裡，調查當天有至少一項「在醫院或醫療過程中得到的感染」（醫療照護相關感染，例如肺炎、手術部位感染、泌尿道感染、血流感染）的比例。歐洲疾病預防管制中心（ECDC）2022–2023 年的點盛行率調查，31 國：賽普勒斯 13.8%、希臘 12.2%、葡萄牙 11.6%、瑞典 10.4%、義大利 9.8%；德國 4.2%、羅馬尼亞 3.1%、拉脫維亞 3.0%。這是一天的切面，不是一年的發生率；病人組成（加護病房多不多、住院多久）影響很大，低的國家也可能是沒找出來，不等於感染控制比較好。滑過國家看調查期間與信賴區間。這跟上面的「抗藥比例」不同：那是細菌的抗藥性，這是病人在醫院得到感染的比例。台灣不在這份調查裡。',
        en: 'Share of patients in acute-care hospitals who, on the survey day, had at least one infection acquired in hospital or through health care (such as pneumonia, surgical-site, urinary-tract or bloodstream infections). From the European Centre for Disease Prevention and Control (ECDC) point prevalence survey 2022–2023, 31 countries: Cyprus 13.8%, Greece 12.2%, Portugal 11.6%, Sweden 10.4%, Italy 9.8%; Germany 4.2%, Romania 3.1%, Latvia 3.0%. It is a one-day snapshot, not an annual incidence; case mix (share of intensive care, length of stay) matters a lot, and low values may reflect missed infections rather than better infection control. Hover over a country for the survey period and confidence interval. Unlike the resistance shares above (how resistant bacteria are), this is how many patients picked up an infection in hospital. Taiwan is not in this survey.',
      },
      unit: '%',
      file: 'hai-prevalence.json',
      timeless: true,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 5, 6, 7, 8, 10] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'hospital-antibiotic-use',
      label: { zh: '住院病人用抗生素的比例（歐洲）', en: 'Hospital patients on antibiotics (Europe)' },
      description: {
        zh: '急性照護醫院的住院病人裡，調查當天正在使用至少一種抗微生物製劑（多半是抗生素）的比例（ECDC 2022–2023 年點盛行率調查，31 國）。科索沃 62.8%、賽普勒斯 56.5%、希臘 55.3%、蒙特內哥羅 48.7%、保加利亞 47.9%；匈牙利 20.8%、法國 22.7%、德國 26.2%。抗生素用得越多，抗藥性越容易出現。滑過國家看調查期間與信賴區間；台灣不在這份調查裡。',
        en: 'Share of patients in acute-care hospitals receiving at least one antimicrobial (mostly antibiotics) on the survey day (ECDC point prevalence survey 2022–2023, 31 countries). Kosovo 62.8%, Cyprus 56.5%, Greece 55.3%, Montenegro 48.7%, Bulgaria 47.9%; Hungary 20.8%, France 22.7%, Germany 26.2%. The more antibiotics are used, the more resistance tends to emerge. Hover over a country for the survey period and confidence interval; Taiwan is not in this survey.',
      },
      unit: '%',
      file: 'hospital-antibiotic-use.json',
      timeless: true,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 30, 35, 40, 45, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};
