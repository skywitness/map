import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { PlaceDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 學生能力（PISA，pipeline/topics/pisa.py）：OECD PISA 2025 Volume I 附錄的表（CC BY 4.0），參加 2025 年的 91 個國家與經濟體
 * 與它們之前每一次的成績。三個科目是子項目，每個指標的資料檔是 `<指標>/<科目>.json`。
 * 只有部分地區參加的（北京上海江蘇浙江、杜尚別、庫德斯坦地區、烏克蘭的部分地區）是主題自訂的地點，畫成點、不塗整個國家。
 */

const POINTS = { zh: '分', en: 'points' };

/** 四捨五入到整數再決定正負號，−0.4 不會寫成「−0」 */
function signed(value: number): string {
  const r = Math.round(value);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${fixed(Math.abs(r), 0)}`;
}

const score = (v: number) => tr({ zh: `${fixed(v, 0)} 分`, en: `${fixed(v, 0)} points` });
const change = (v: number) =>
  tr({ zh: `${signed(v)} 分`, en: `${signed(v)} point${Math.abs(Math.round(v)) === 1 ? '' : 's'}` });
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${v}%`;
const gap = (v: number) => {
  const r = Math.round(v);
  if (r === 0) return tr({ zh: '男女差不多', en: 'No gap' });
  return r > 0
    ? tr({ zh: `男生高 ${fixed(r, 0)} 分`, en: `Boys +${fixed(r, 0)}` })
    : tr({ zh: `女生高 ${fixed(-r, 0)} 分`, en: `Girls +${fixed(-r, 0)}` });
};

/** 三個科目共用同一組門檻，換科目時顏色才能互相比較 */
const SCORE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [390, 420, 450, 480, 510, 540] };

/** 只有部分地區參加的參加者：畫成點（鍵跟 pipeline 的 oecd_pisa.NAMES 一致；代碼是 PISA 自己的，去掉底線後顯示） */
export const PLACES: PlaceDef[] = [
  { id: '_QCI', name: { zh: '北京、上海、江蘇、浙江（中國）', en: 'B-S-J-Z (China)' }, lon: 119.4, lat: 33.0 },
  { id: '_QUA', name: { zh: '烏克蘭的部分地區', en: 'Ukrainian regions' }, lon: 30.52, lat: 50.45 },
  { id: '_QKI', name: { zh: '庫德斯坦地區（伊拉克）', en: 'Kurdistan Region (Iraq)' }, lon: 44.01, lat: 36.19 },
  { id: '_QTJ', name: { zh: '杜尚別（塔吉克）', en: 'Dushanbe (Tajikistan)' }, lon: 68.78, lat: 38.56 },
];

/** OECD 不比較趨勢的參加者（PISA 2025 的 Reader's Guide）：兩個變化指標寫原因，不寫「無資料」 */
const NO_TREND = {
  ALB: { zh: 'OECD 不比較阿爾巴尼亞的趨勢（2025 年抽樣有問題）', en: 'The OECD does not compare trends for Albania (2025 sampling issues)' },
  VNM: { zh: 'OECD 不比較越南的趨勢（2025 年改用電腦測驗）', en: 'The OECD does not compare trends for Viet Nam (computer-based testing from 2025)' },
};

export const pisa: TopicDefinition = {
  id: 'pisa',
  title: { zh: '學生能力（PISA）', en: 'Student skills (PISA)' },
  shortTitle: { zh: '學生能力', en: 'PISA' },
  defaultIndicator: 'mean',
  defaultYear: 2025,
  places: PLACES,
  dimension: {
    label: { zh: '科目', en: 'Subject' },
    options: [
      { id: 'math', label: { zh: '數學', en: 'Mathematics' } },
      { id: 'reading', label: { zh: '閱讀', en: 'Reading' } },
      { id: 'science', label: { zh: '科學', en: 'Science' } },
    ],
    defaultOption: 'math',
  },
  // 只有部分地區參加的國家不塗顏色，說明原因（那些地區畫成點）
  noValue: {
    CHN: {
      zh: '中國大陸沒有全國的成績，只有北京、上海、江蘇、浙江參加（畫成點）',
      en: 'No national results for China: only Beijing, Shanghai, Jiangsu and Zhejiang take part (shown as a dot)',
    },
    UKR: {
      zh: '只有部分地區參加（2025 年是 27 個裡的 17 個，畫成點）',
      en: 'Only some regions take part (17 of 27 in 2025; shown as a dot)',
    },
    IRQ: { zh: '只有庫德斯坦地區參加（畫成點）', en: 'Only the Kurdistan Region takes part (shown as a dot)' },
    TJK: { zh: '只有首都杜尚別參加（畫成點）', en: 'Only the capital, Dushanbe, takes part (shown as a dot)' },
  },
  sources: [
    {
      name: {
        zh: 'OECD (2026), PISA 2025 Results (Volume I): Future-Ready Students（附錄 B1 的表）',
        en: 'OECD (2026), PISA 2025 Results (Volume I): Future-Ready Students (Annex B1 tables)',
      },
      url: 'https://doi.org/10.1787/73451bc5-en',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '臺灣 PISA 國家研究中心（國立臺灣師範大學）PISA 2025 記者會簡報（臺灣的歷屆名次）',
        en: "Taiwan PISA National Center (National Taiwan Normal University), PISA 2025 press briefing (Taiwan's ranks)",
      },
      url: 'https://pr.ntnu.edu.tw/archive/file/PISA%2025%E8%A8%98%E8%80%85%E6%9C%83%E7%B0%A1%E5%A0%B1.pdf',
      license: { zh: '只引用臺灣的名次（事實）', en: "Taiwan's ranks only (facts)" },
    },
  ],
  note: {
    zh:
      '只收參加 PISA 2025 的 91 個國家與經濟體（含它們之前每一次的成績）；俄羅斯、2009 與 2012 年的上海、列支敦斯登等沒有參加 2025 年的，' +
      '只在 2024 年 7 月以前出版、不是 CC BY 4.0 的報告裡，沒有收。只有部分地區參加的（北京上海江蘇浙江、烏克蘭的部分地區、' +
      '伊拉克的庫德斯坦地區、塔吉克的杜尚別）畫成點，不塗整個國家；臺灣在 PISA 的名稱是「Chinese Taipei」。' +
      'This is an adaptation of an original work by the OECD：本站的改作（換成地圖的代碼、算出變化、翻譯）不代表 OECD 或其會員國的官方觀點，中文跟原文有出入時以 OECD 的英文原文為準。',
    en:
      'Only the 91 countries and economies in PISA 2025 are included, with their results from earlier cycles; participants that did not take part in 2025 ' +
      '(Russia, Shanghai in 2009 and 2012, Liechtenstein and others) appear only in reports published before July 2024, which are not CC BY 4.0, and are left out. ' +
      'Participants covering only part of a country (Beijing-Shanghai-Jiangsu-Zhejiang, Ukrainian regions, the Kurdistan Region of Iraq, Dushanbe) are shown as dots rather than colouring the whole country; ' +
      'Taiwan takes part as “Chinese Taipei”. This is an adaptation of an original work by the OECD. The opinions expressed and arguments employed in this adaptation ' +
      'should not be reported as representing the official views of the OECD or of its Member countries.',
  },
  panelExtra: () => import('./panels/PisaPanel'),
  indicators: [
    {
      id: 'mean',
      label: { zh: '平均分數', en: 'Mean score' },
      description: {
        zh: '15 歲學生的平均分數。PISA 沒有滿分，分數大約以平均 500、標準差 100 定出，能力水準每差一級約 60–75 分。2025 年 OECD 38 國平均：數學 463、閱讀 461、科學 482 分。',
        en: 'Average score of 15-year-old students. PISA has no maximum score: the scales were set at a mean of about 500 and a standard deviation of about 100, and each proficiency level spans roughly 60–75 points. OECD averages (38 countries) in 2025: mathematics 463, reading 461, science 482.',
      },
      unit: POINTS,
      file: 'mean/{item}.json',
      layer: { kind: 'choropleth', scale: SCORE_SCALE },
      format: score,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'low',
      label: { zh: '低成就比例', en: 'Low performers' },
      description: {
        zh: '沒有達到第 2 級的學生比例：第 2 級是 OECD 所說能在日常生活用上這個科目的基本能力。比例越低越好，名次由低排到高。',
        en: 'Share of students below Level 2, the baseline the OECD sees as needed to use the subject in everyday life. Lower is better; ranks run from lowest to highest.',
      },
      unit: '%',
      file: 'low/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 45, 60, 75] } },
      format: pct,
      formatTick: pctTick,
      lowerIsBetter: true,
    },
    {
      id: 'top',
      label: { zh: '高成就比例', en: 'Top performers' },
      description: {
        zh: '達到第 5、6 級（最高的兩級）的學生比例：能處理複雜、不熟悉的問題，比較、評估不同的解法。',
        en: 'Share of students at Level 5 or 6, the two highest levels: able to handle complex, unfamiliar problems and to compare and evaluate different approaches.',
      },
      unit: '%',
      file: 'top/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 30] } },
      format: pct,
      formatTick: pctTick,
    },
    {
      id: 'change',
      label: { zh: '比上一次', en: 'Change since last cycle' },
      description: {
        zh: '跟上一次 PISA（3 或 4 年前）比，平均分數進步（青綠）或退步（橘色）幾分；上一次沒有參加的不算。差 5 分以內大多在誤差範圍內。2018 → 2022 年多數國家受疫情影響退步。阿爾巴尼亞、越南 OECD 不比較趨勢。',
        en: 'Change in the mean score since the previous PISA cycle (3 or 4 years earlier): up in teal, down in orange; participants that skipped the previous cycle are not shown. Changes within about 5 points are mostly within the margin of error. Most countries fell between 2018 and 2022, during the pandemic. The OECD does not compare trends for Albania or Viet Nam.',
      },
      unit: POINTS,
      file: 'change/{item}.json',
      noValue: NO_TREND,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-20, -10, -5, 5, 10, 20] } },
      format: change,
      formatTick: signed,
    },
    {
      id: 'change-2012',
      label: { zh: '跟 2012 年比', en: 'Change since 2012' },
      description: {
        zh: '跟 2012 年比，平均分數進步（青綠）或退步（橘色）幾分。2012 年三個科目都已經可以前後比較；OECD 23 國的平均到 2025 年數學少了 29 分、閱讀 36 分、科學 19 分。',
        en: 'Change in the mean score since 2012, when all three subjects could already be compared over time: up in teal, down in orange. By 2025 the average of 23 OECD countries had fallen by 29 points in mathematics, 36 in reading and 19 in science.',
      },
      unit: POINTS,
      file: 'change-2012/{item}.json',
      noValue: NO_TREND,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-40, -25, -10, 10, 25, 40] } },
      format: change,
      formatTick: signed,
    },
    {
      id: 'gender',
      label: { zh: '男女差距', en: 'Gender gap' },
      description: {
        zh: '男生減女生的平均分數（2015 年起）：青綠是男生比較高、橘色是女生比較高。閱讀幾乎每個國家都是女生高，數學多半是男生高。',
        en: 'Boys’ mean score minus girls’ (from 2015): teal where boys score higher, orange where girls do. Girls lead in reading almost everywhere; boys usually lead in mathematics.',
      },
      unit: POINTS,
      file: 'gender/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-40, -20, -5, 5, 20, 40] } },
      format: gap,
      formatTick: signed,
      unranked: true,
    },
  ],
};
