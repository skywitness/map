import { tr } from '../i18n/lang';
import type { CategoryDef, TopicDefinition } from './types';

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/**
 * 死刑（pipeline/sources/death_penalty.py）：從保留排到全面廢除（diverging），
 * 法律上還有死刑的在橘色那一側、已經廢除的在青綠那一側，越靠兩端越深。
 */
const DEATH_PENALTY: CategoryDef[] = [
  { value: 1, label: { zh: '保留', en: 'Retained' } },
  { value: 2, label: { zh: '事實上廢除（10 年以上沒有執行）', en: 'Abolished in practice (no executions for 10+ years)' } },
  { value: 3, label: { zh: '只廢除普通犯罪', en: 'Abolished for ordinary crimes only' } },
  { value: 4, label: { zh: '全面廢除', en: 'Abolished for all crimes' } },
];
const deathPenaltyLabel = (v: number) => tr(DEATH_PENALTY.find((c) => c.value === v)?.label ?? '');

export const laws: TopicDefinition = {
  id: 'laws',
  title: { zh: '法律與制度', en: 'Laws and institutions' },
  shortTitle: { zh: '法律與制度', en: 'Laws' },
  defaultIndicator: 'death-penalty',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Capital punishment by country」與各國的死刑條目（2026 年 10 月）',
        en: 'Wikipedia, “Capital punishment by country” and country articles on capital punishment (October 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1382474148',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '法務部新聞稿（2025 年 1 月 16 日執行死刑）', en: 'Ministry of Justice (Taiwan), press release on the execution of 16 January 2025' },
      url: 'https://www.moj.gov.tw/2204/2795/2796/231525/post',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '死刑依英文維基百科的條目自行整理（2026 年 10 月，CC BY-SA 4.0），是每年年底的狀態，各國廢除的年份與最後一次執行寫在側欄的附註；這個指標的資料檔也依 CC BY-SA 4.0 分享。' +
      '「事實上廢除」是法律上還有死刑、但那一年與之前 9 年都沒有執行，依各國最後一次執行的年份判斷：只知道最後一次執行的國家，之前的年份當成有在執行，中間另有 10 年以上空檔的（例如緬甸 1988–2022 年、甘比亞 1981–2012 年）只算進條目寫明的。' +
      '「只廢除普通犯罪」是戰時、軍法等例外仍有死刑。國家畫在今天的國界上，獨立以前用那個地方當時的法律與執行紀錄；德國 1949–1990 年是西德。',
    en:
      'The death penalty is compiled from Wikipedia articles (October 2026, CC BY-SA 4.0) and shows the situation at the end of each year, with the years of abolition and the last execution in the panel notes; the data file of this indicator is shared under CC BY-SA 4.0 as well. ' +
      '“Abolished in practice” means the death penalty is still in law but there were no executions in that year or the 9 years before, judged from the year of each country’s last execution: earlier years count as having executions unless the articles record a gap of 10 years or more (such as Myanmar in 1988–2022 and the Gambia in 1981–2012). ' +
      '“Abolished for ordinary crimes only” keeps it for exceptions such as wartime or military law. Countries are shown within today’s borders, with the law and executions of the area before independence; Germany in 1949–1990 is West Germany.',
  },
  indicators: [
    {
      id: 'death-penalty',
      label: { zh: '死刑', en: 'Death penalty' },
      description: {
        zh: '每年年底的死刑制度：全面廢除、只廢除普通犯罪、事實上廢除（10 年以上沒有執行）或保留。台灣保留死刑，最後一次執行在 2025 年。',
        en: 'The death penalty at the end of each year: abolished for all crimes, for ordinary crimes only, in practice (no executions for 10 years or more), or retained. Taiwan retains it; its last execution was in 2025.',
      },
      unit: '',
      file: 'death-penalty.json',
      layer: { kind: 'categorical', categories: DEATH_PENALTY, diverging: true },
      format: deathPenaltyLabel,
    },
  ],
};
