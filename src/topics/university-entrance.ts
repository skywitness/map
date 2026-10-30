import { tr } from '../i18n/lang';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 大學入學考試（pipeline/sources/admission_tests.py）：各國上大學的主要方式，依英文維基百科的兩份清單自行整理，
 * 只有 2026 年。四類沒有強弱順序，用一般的類別色；各國的考試名稱寫在附註（指標檔的 notes），tooltip 也列出來。
 */
const ROUTES: CategoryDef[] = [
  { value: 1, label: { zh: '全國統一入學考試', en: 'National entrance exam' } },
  { value: 2, label: { zh: '高中畢業會考當入學資格', en: 'School-leaving exam as entry qualification' } },
  { value: 3, label: { zh: '各校申請審查', en: 'Application review by each university' } },
  { value: 4, label: { zh: '各校自辦考試', en: 'Each university’s own exam' } },
];
const routeLabel = (v: number) => tr(ROUTES.find((c) => c.value === v)?.label ?? '');

/** tooltip 加一行考試名稱（附註的第一句） */
function tooltipLines(iso3: string, { source }: { source: unknown }): string[] {
  const data = source as { notes?: Record<string, string>; notesEn?: Record<string, string> } | null;
  const text = tr({ zh: data?.notes?.[iso3] ?? '', en: data?.notesEn?.[iso3] ?? '' });
  if (!text) return [];
  const first = text.split(/[；;]/)[0];
  return [first.length > 70 ? `${first.slice(0, 68)}…` : first];
}

export const universityEntrance: TopicDefinition = {
  id: 'university-entrance',
  title: { zh: '各國的大學入學考試', en: 'University entrance by country' },
  shortTitle: { zh: '大學入學考試', en: 'University entrance' },
  defaultIndicator: 'main-route',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of admission tests to colleges and universities」「List of secondary school leaving qualifications」',
        en: 'Wikipedia, “List of admission tests to colleges and universities” and “List of secondary school leaving qualifications”',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381783633',
      license: { zh: 'CC BY-SA 4.0（資料檔同樣用 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (the data file is shared under CC BY-SA 4.0 too)' },
    },
    {
      name: { zh: '大學入學考試中心（台灣的學測與分科測驗）', en: 'College Entrance Examination Center (Taiwan’s GSAT and Advanced Subjects Test)' },
      url: 'https://www.ceec.edu.tw/',
      license: { zh: '只引用考試名稱與月份', en: 'only exam names and months are cited' },
    },
  ],
  note: {
    zh:
      '依英文維基百科的兩份清單（2026 年 10 月版，CC BY-SA 4.0）自行整理，約 70 國；兩份清單都沒列的國家沒有資料。很多國家好幾種管道並存（推薦、在校成績、各校考試），這裡只取主要的一種，各國的考試名稱寫在附註。' +
      '「全國統一入學考試」是專為上大學辦的考試，跟高中畢業考試分開；高中畢業與大學入學合一的考試（俄羅斯、越南）算「高中畢業會考」。' +
      '維基的台灣段落只寫到指定科目考試，改成 2022 年起的分科測驗；日本 2021 年起是大學入學共通測驗。這張表的資料檔依 CC BY-SA 4.0 分享。',
    en:
      'Compiled from two English Wikipedia lists (October 2026 revisions, CC BY-SA 4.0), covering about 70 countries; countries in neither list have no data. Many countries have several routes at once (recommendations, school grades, universities’ own exams); only the main one is shown, with each country’s exams in the notes. ' +
      'A national entrance exam is held specifically for university entry, separately from school-leaving exams; exams that serve as both (Russia, Viet Nam) count as school-leaving exams. ' +
      'Wikipedia’s entry for Taiwan stops at the Department Required Test, so it is updated to the Advanced Subjects Test used since 2022; Japan has used the Common Test for University Admissions since 2021. The data file is shared under CC BY-SA 4.0.',
  },
  tooltipLines,
  indicators: [
    {
      id: 'main-route',
      label: { zh: '主要的入學方式', en: 'Main route to university' },
      description: {
        zh: '上大學主要靠全國統一的入學考試、高中畢業會考的成績、各校審查申請，還是各校自己的考試。台灣是學科能力測驗（1 月）與分科測驗（7 月）。',
        en: 'Whether entry to university mainly depends on a national entrance exam, school-leaving exam results, each university reviewing applications, or each university’s own exam. Taiwan uses the General Scholastic Ability Test (January) and the Advanced Subjects Test (July).',
      },
      unit: '',
      file: 'main-route.json',
      layer: { kind: 'categorical', categories: ROUTES },
      format: routeLabel,
      unranked: true,
      panelChart: false,
    },
  ],
};
