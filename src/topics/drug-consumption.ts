import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 各國吃多少藥（2026-11-03，製作手冊第十九批 297；pipeline/topics/drug_consumption.py）：
 * OECD 藥品消費，每千人每天的定義每日劑量（DDD），8 類藥。
 */

const UNIT = { zh: 'DDD／每千人每天', en: 'DDD per 1,000 people per day' };
/** 卡片與 tooltip 只寫數字，「每千人每天」在單位與圖例 */
const format = (v: number) => `${fixed(v, 1)} DDD`;

function ddd(id: string, label: { zh: string; en: string }, description: { zh: string; en: string }, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: UNIT,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format,
    formatTick: (v) => fixed(v, 0),
  };
}

export const drugConsumption: TopicDefinition = {
  id: 'drug-consumption',
  title: { zh: '各國吃多少藥', en: 'How much medicine countries take' },
  shortTitle: { zh: '吃多少藥', en: 'Medicine use' },
  defaultIndicator: 'antidepressants',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OECD Health Statistics：Pharmaceutical consumption（每千人每天的定義每日劑量）',
        en: 'OECD Health Statistics: Pharmaceutical consumption (defined daily doses per 1,000 people per day)',
      },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: { zh: '衛生福利部中央健康保險署：抗憂鬱藥物使用人數（data.gov.tw 146577）', en: 'National Health Insurance Administration (Taiwan): antidepressant users (data.gov.tw 146577)' },
      url: 'https://data.gov.tw/dataset/146577',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '定義每日劑量（DDD）是 WHO 為每種藥訂的「成人一天的平均維持劑量」，用來比較不同藥、不同國家的用量；每千人每天 100 DDD，大約是每天有一成的人在吃這類藥（實際的處方劑量可能不同）。資料多半來自健保或藥局的給付紀錄，各國的範圍不同：有的只算健保給付的藥、有的含自費或醫院用藥，所以某些國家特別低（例如波蘭、匈牙利的安眠藥幾乎是 0），不一定是真的很少用。沒有美國；日本只有抗生素。台灣沒有 DDD 的統計，健保署只有抗憂鬱藥的使用人數，寫在「抗憂鬱劑」的說明。依 OECD 的資料條款註明：OECD (2026), Pharmaceutical consumption, OECD Data Explorer（2026-11-03 查閱）。',
    en: 'A defined daily dose (DDD) is WHO’s assumed average adult maintenance dose per day for each drug, used to compare use across drugs and countries; 100 DDD per 1,000 people per day means roughly one person in ten taking that kind of drug every day (actual prescribed doses may differ). Data mostly come from insurance or pharmacy claims, and coverage differs: some countries count only reimbursed drugs, others include private or hospital use, so some very low figures (hypnotics in Poland and Hungary are almost zero) may not mean little use. The US is not included, and Japan reports only antibiotics. Taiwan has no DDD statistics; the National Health Insurance Administration publishes only the number of antidepressant users, given under “Antidepressants”. Source per OECD terms: OECD (2026), Pharmaceutical consumption, OECD Data Explorer (accessed 2026-11-03).',
  },
  indicators: [
    ddd(
      'antidepressants',
      { zh: '抗憂鬱劑', en: 'Antidepressants' },
      {
        zh: '抗憂鬱劑（ATC N06A）。2024 年冰島 167.7、葡萄牙 161.7、英國 139.7、加拿大 134.9、瑞典 121.8 最多；德國 70.5、法國 66.7；南韓 40.7、匈牙利 31.4、拉脫維亞 28.5、祕魯 8.1 最少。台灣沒有 DDD：健保署統計 2025 年有 180 萬人用過抗憂鬱藥（約每 13 人有 1 人），2005 年是 79 萬人；人數跟每天的劑量是不同的指標，不能直接比。',
        en: 'Antidepressants (ATC N06A). In 2024 Iceland 167.7, Portugal 161.7, the UK 139.7, Canada 134.9 and Sweden 121.8 were highest; Germany 70.5, France 66.7; South Korea 40.7, Hungary 31.4, Latvia 28.5 and Peru 8.1 lowest. Taiwan has no DDD figures: the National Health Insurance Administration counted 1.8 million people who used antidepressants in 2025 (about 1 in 13), up from 790,000 in 2005; a count of users is a different measure from daily doses and cannot be compared directly.',
      },
      [20, 40, 70, 100, 130],
    ),
    ddd(
      'anxiolytics',
      { zh: '抗焦慮劑', en: 'Anxiolytics' },
      {
        zh: '抗焦慮劑（ATC N05B，多半是苯二氮平類）。2024 年葡萄牙 74.7、西班牙 55.5、法國 39.5、希臘 31.8 最多；南韓 14.6；德國 2.7、義大利 2.1、波蘭 0.2 很少（可能是統計範圍不含自費處方，不一定是很少人吃）。',
        en: 'Anxiolytics (ATC N05B, mostly benzodiazepines). In 2024 Portugal 74.7, Spain 55.5, France 39.5 and Greece 31.8 were highest; South Korea 14.6; Germany 2.7, Italy 2.1 and Poland 0.2 very low (possibly because privately paid prescriptions are not counted, rather than little use).',
      },
      [3, 10, 20, 35, 55],
    ),
    ddd(
      'hypnotics',
      { zh: '安眠鎮靜劑', en: 'Sleeping pills' },
      {
        zh: '安眠鎮靜劑（ATC N05C）。2024 年瑞典 78.7、冰島 74.5、智利 60.4、挪威 54.5、芬蘭 53.7 最多；法國 36.4、南韓 17.5、英國 11.2；德國 3.2；波蘭、匈牙利幾乎是 0（可能是統計範圍不同，不一定是沒人吃）。',
        en: 'Hypnotics and sedatives (ATC N05C). In 2024 Sweden 78.7, Iceland 74.5, Chile 60.4, Norway 54.5 and Finland 53.7 were highest; France 36.4, South Korea 17.5, the UK 11.2; Germany 3.2; Poland and Hungary almost zero (possibly a difference in coverage rather than no use).',
      },
      [3, 10, 20, 40, 60],
    ),
    ddd(
      'dementia',
      { zh: '失智症用藥', en: 'Dementia drugs' },
      {
        zh: '失智症用藥（ATC N06D，例如 donepezil、memantine）。2024 年南韓 35.5 遠高於其他國家，其次是葡萄牙 17.7、芬蘭 16.6、斯洛伐克 16.3；法國 0.5（2018 年起不再給付這類藥）。',
        en: 'Anti-dementia drugs (ATC N06D, such as donepezil and memantine). In 2024 South Korea, at 35.5, was far above the rest, followed by Portugal 17.7, Finland 16.6 and Slovakia 16.3; France 0.5 (it stopped reimbursing these drugs in 2018).',
      },
      [2, 5, 10, 15, 25],
    ),
    ddd(
      'lipid',
      { zh: '降血脂藥', en: 'Cholesterol drugs' },
      {
        zh: '降血脂藥（ATC C10，多半是 statin）。2024 年丹麥 252.5、芬蘭 246.0、捷克 223.7、英國 214.8 最多；南韓 101.6；土耳其 44.9、祕魯 12.3 最少。',
        en: 'Lipid-lowering drugs (ATC C10, mostly statins). In 2024 Denmark 252.5, Finland 246.0, Czechia 223.7 and the UK 214.8 were highest; South Korea 101.6; Türkiye 44.9 and Peru 12.3 lowest.',
      },
      [50, 100, 150, 200, 240],
    ),
    ddd(
      'raas',
      { zh: '降血壓藥（ACEI／ARB）', en: 'Blood pressure drugs (ACEI/ARB)' },
      {
        zh: '作用在腎素-血管收縮素系統的降血壓藥（ATC C09，血管張力素轉化酶抑制劑與受體阻斷劑，最常用的一類降血壓藥）。2024 年德國 416.9、匈牙利 370.1、芬蘭 311.5、波蘭 274.6 最多；英國 203.3；南韓 62.7、祕魯 39.9 最少。只是降血壓藥的一類，各國常用的種類不同。',
        en: 'Drugs acting on the renin–angiotensin system (ATC C09: ACE inhibitors and angiotensin receptor blockers, the most used blood pressure drugs). In 2024 Germany 416.9, Hungary 370.1, Finland 311.5 and Poland 274.6 were highest; the UK 203.3; South Korea 62.7 and Peru 39.9 lowest. This is only one class of blood pressure drugs, and countries favour different classes.',
      },
      [80, 150, 200, 250, 320],
    ),
    ddd(
      'diabetes',
      { zh: '糖尿病用藥', en: 'Diabetes drugs' },
      {
        zh: '糖尿病用藥（ATC A10，含胰島素與口服降血糖藥）。2024 年加拿大 221.3、芬蘭 128.7、德國 112.6、法國 111.3 最多；南韓 88.8；奧地利 60.6、拉脫維亞 58.2、祕魯 11.0 最少。',
        en: 'Drugs used in diabetes (ATC A10, insulin and oral glucose-lowering drugs). In 2024 Canada 221.3, Finland 128.7, Germany 112.6 and France 111.3 were highest; South Korea 88.8; Austria 60.6, Latvia 58.2 and Peru 11.0 lowest.',
      },
      [60, 80, 100, 120, 150],
    ),
    ddd(
      'antibiotics',
      { zh: '抗生素', en: 'Antibiotics' },
      {
        zh: '全身性的抗生素（ATC J01）。2024 年土耳其 37.7、南韓 33.6、希臘 29.9、紐西蘭與法國 26.5 最多；奧地利 11.8、荷蘭 9.8 最少；日本 2021 年 10.0。抗生素用得多，細菌比較容易產生抗藥性（看「抗藥性」）。',
        en: 'Antibiotics for systemic use (ATC J01). In 2024 Türkiye 37.7, South Korea 33.6, Greece 29.9, and New Zealand and France 26.5 were highest; Austria 11.8 and the Netherlands 9.8 lowest; Japan 10.0 in 2021. Heavy antibiotic use helps bacteria develop resistance (see “Antimicrobial resistance”).',
      },
      [12, 16, 20, 25, 30],
    ),
  ],
};
