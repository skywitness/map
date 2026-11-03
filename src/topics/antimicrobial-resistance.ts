import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 抗藥性（2026-11-03，製作手冊第十九批 293；pipeline/topics/antimicrobial_resistance.py）：
 * WHO GLASS 的大腸桿菌、MRSA 抗藥比例與抗藥性結核（GHO，CC BY 4.0）。
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
  ],
  note: {
    zh: `抗藥比例來自各國向 WHO 全球抗藥性監測系統（GLASS）的通報，2017 年起，各國用 2 年內最近的一年。${CAVEAT.zh}抗藥性結核是 WHO 估計的 rifampicin 抗藥或多重抗藥結核（RR/MDR-TB）新病例數，每 10 萬人用聯合國的人口自己算。台灣不在 WHO 的資料裡；疾管署有醫院通報的抗生素敏感性統計，但下載點從國外連不上，這次沒有放（定義也跟 WHO 不同：WHO 只算血流感染）。`,
    en: `Resistance shares come from national reports to WHO’s Global Antimicrobial Resistance and Use Surveillance System (GLASS) from 2017, using each country’s latest year within two years. ${CAVEAT.en} Drug-resistant TB is WHO’s estimate of new rifampicin-resistant or multidrug-resistant (RR/MDR-TB) cases, converted to a rate per 100,000 with UN population. Taiwan is not in WHO’s data.`,
  },
  indicators: [
    {
      id: 'ecoli',
      label: { zh: '大腸桿菌的抗藥比例', en: 'Resistant E. coli' },
      description: {
        zh: `血流感染的大腸桿菌裡，對第三代頭孢菌素（常用的強效抗生素）有抗藥性的比例。2023 年尚比亞 93.5%、迦納 90.6%、埃及 89.4%、印度 80.1%；南韓 38.9%、泰國 38.7%、日本 20.3%；英國 13.2%、德國 9.8%、丹麥 6.3%、挪威 5.7%。${CAVEAT.zh}`,
        en: `Share of E. coli from bloodstream infections resistant to third-generation cephalosporins (widely used strong antibiotics). In 2023: Zambia 93.5%, Ghana 90.6%, Egypt 89.4%, India 80.1%; South Korea 38.9%, Thailand 38.7%, Japan 20.3%; the UK 13.2%, Germany 9.8%, Denmark 6.3%, Norway 5.7%. ${CAVEAT.en}`,
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
        zh: `血流感染的金黃色葡萄球菌裡，抗甲氧西林（MRSA，對大部分 β-內醯胺類抗生素都有抗藥性）的比例。2023 年伊拉克 89.7%、埃及 88.9%、印度 53.6%、南韓 45.2%、日本 32.5%；英國 9.9%、芬蘭 0.4%。${CAVEAT.zh}`,
        en: `Share of Staphylococcus aureus from bloodstream infections that are methicillin-resistant (MRSA, resistant to most beta-lactam antibiotics). In 2023: Iraq 89.7%, Egypt 88.9%, India 53.6%, South Korea 45.2%, Japan 32.5%; the UK 9.9%, Finland 0.4%. ${CAVEAT.en}`,
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
  ],
};
