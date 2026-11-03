import { tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, TopicDefinition } from './types';

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

/** 博弈的合法性（pipeline/sources/gambling.py）：從寬到嚴是循序的，「各地不同」不在順序上，用灰色 */
const GAMBLING: CategoryDef[] = [
  { value: 1, label: { zh: '賭場合法', en: 'Casinos legal' } },
  { value: 2, label: { zh: '只准彩券等特許', en: 'Lotteries or licensed betting only' } },
  { value: 3, label: { zh: '全部禁止', en: 'All gambling banned' } },
  { value: 4, label: { zh: '各地不同', en: 'Varies by region' }, color: '#7a776f' }, // 跟法定年齡的「禁止」同一個灰色
];
const gamblingLabel = (v: number) => tr(GAMBLING.find((c) => c.value === v)?.label ?? '');

/** 醫療用大麻（pipeline/sources/medical_cannabis.py，2026-11-03，製作手冊第十九批 299）：從寬到嚴是循序的（跟博弈同方向） */
const MEDICAL_CANNABIS: CategoryDef[] = [
  { value: 1, label: { zh: '合法', en: 'Legal' } },
  { value: 2, label: { zh: '有條件或各地不同', en: 'Restricted or varies by region' } },
  { value: 3, label: { zh: '只准特定藥品或 CBD', en: 'Specific medicines or CBD only' } },
  { value: 4, label: { zh: '非法', en: 'Illegal' } },
];
const medicalCannabisLabel = (v: number) => tr(MEDICAL_CANNABIS.find((c) => c.value === v)?.label ?? '');

/**
 * 法定年齡（pipeline/sources/legal_ages.py）：值是歲數，0 是沒有規定、1 是禁止。
 * 類別圖、循序色，年齡越大越深；「禁止」「沒有規定」不在年齡的順序上，用灰色（categories.ts 不讓它們占色階）
 */
const NONE = 0;
const PROHIBITED = 1;
const PROHIBITED_COLOR = '#7a776f';
const age = (n: number): Text => ({ zh: `${n} 歲`, en: `${n} years` });
const ages = (list: (number | [number, number, Text])[], none?: Text, prohibited?: boolean): CategoryDef[] => [
  ...list.map((a) => (typeof a === 'number' ? { value: a, label: age(a) } : { value: a[0], max: a[1], label: a[2] })),
  ...(prohibited ? [{ value: PROHIBITED, label: { zh: '禁止', en: 'Prohibited' }, color: PROHIBITED_COLOR }] : []),
  ...(none ? [{ value: NONE, label: none, color: MAP_TOKENS.categoricalOther }] : []),
];
const NO_LIMIT = { zh: '沒有規定', en: 'No legal minimum' };
const ageLabel = (categories: CategoryDef[]) => (v: number) =>
  v === NONE || v === PROHIBITED ? tr(categories.find((c) => c.value === v)?.label ?? '') : tr(age(v));

const VOTING = ages([21, 20, 18, 17, 16], { zh: '沒有選舉', en: 'No elections' });
const DRINKING = ages([21, 20, 19, 18, 17, [14, 16, { zh: '16 歲以下', en: '16 or under' }]], NO_LIMIT, true);
const MARRIAGE = ages([21, 20, 19, 18, 17, 16, 15], NO_LIMIT);
const DRIVING = ages([18, 17, 16, [14, 15, { zh: '15 歲以下', en: '15 or under' }]]);
const CRIMINAL = ages(
  [16, 15, 14, 13, 12, [10, 11, { zh: '10–11 歲', en: '10–11 years' }], [7, 9, { zh: '7–9 歲', en: '7–9 years' }]],
  NO_LIMIT,
);

const ageIndicator = (id: string, label: Text, description: Text, categories: CategoryDef[]): IndicatorDef => ({
  id: `${id}-age`,
  label,
  description,
  unit: { zh: '歲', en: 'years' },
  file: `${id}-age.json`,
  layer: { kind: 'categorical', categories, ordinal: true },
  format: ageLabel(categories),
});

/** 各地不同的國家（指標檔的 varies）：tooltip 加一行 */
function tooltipLines(iso3: string, { indicator, source }: { indicator: string; source: unknown }): string[] {
  if (!indicator.endsWith('-age')) return [];
  const varies = (source as { varies?: string[] } | null)?.varies;
  return varies?.includes(iso3) ? [tr({ zh: '各地不同，這裡是住最多人的那個值（見附註）', en: 'Varies by region; the value for most of the population (see notes)' })] : [];
}

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
    {
      name: {
        zh: '英文維基百科「Voting age」「Legal drinking age」「Marriageable age」「List of minimum driving ages」「Age of criminal responsibility」（2026 年 10 月）',
        en: 'Wikipedia, “Voting age”, “Legal drinking age”, “Marriageable age”, “List of minimum driving ages” and “Age of criminal responsibility” (October 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1382143687',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '全國法規資料庫（台灣的法定年齡：憲法、公民投票法、民法、兒童及少年福利與權益保障法、道路交通安全規則、刑法）',
        en: 'Laws & Regulations Database of Taiwan (legal ages in Taiwan)',
      },
      url: 'https://law.moj.gov.tw/',
      license: { zh: '法律條文不是著作權的標的（著作權法第 9 條）', en: 'Statutes are not subject to copyright (Copyright Act, Article 9)' },
    },
    {
      name: { zh: '英文維基百科「Gambling age」（博弈的合法性，2026 年 10 月）', en: 'Wikipedia, “Gambling age” (legality of gambling, October 2026)' },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1379514800',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Legality of cannabis」的 Medical 欄（醫療用大麻，2026 年 10 月）、「Legal status of psilocybin mushrooms」（迷幻蘑菇）',
        en: 'Wikipedia, “Legality of cannabis”, Medical column (medical cannabis, October 2026) and “Legal status of psilocybin mushrooms”',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Legality_of_cannabis&oldid=1378590397',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '衛生福利部食品藥物管理署：未註銷藥品許可證資料集（台灣的大麻二酚藥品）',
        en: 'Taiwan Food and Drug Administration: unrevoked drug licences (cannabidiol medicine in Taiwan)',
      },
      url: 'https://data.gov.tw/dataset/9123',
      license: OPEN_DATA_TW,
    },
  ],
  tooltipLines,
  note: {
    zh:
      '死刑依英文維基百科的條目自行整理（2026 年 10 月，CC BY-SA 4.0），是每年年底的狀態，各國廢除的年份與最後一次執行寫在側欄的附註；這個指標的資料檔也依 CC BY-SA 4.0 分享。' +
      '「事實上廢除」是法律上還有死刑、但那一年與之前 9 年都沒有執行，依各國最後一次執行的年份判斷：只知道最後一次執行的國家，之前的年份當成有在執行，中間另有 10 年以上空檔的（例如緬甸 1988–2022 年、甘比亞 1981–2012 年）只算進條目寫明的。' +
      '「只廢除普通犯罪」是戰時、軍法等例外仍有死刑。國家畫在今天的國界上，獨立以前用那個地方當時的法律與執行紀錄；德國 1949–1990 年是西德。' +
      '法定年齡是 2026 年的現況，依英文維基百科的條目自行整理（CC BY-SA 4.0，資料檔也依 CC BY-SA 4.0 分享），台灣用法條核對：取不需父母同意、法院許可的一般年齡，例外寫在附註；各地不同的取住最多人的那個值；結婚取女性的年齡（女性一律要監護人同意的國家取男性的）；飲酒取購買年齡，酒類不同時取最低的；汽車駕照不算有人陪同、學習駕照；刑事責任取可以負刑事責任的最低年齡。' +
      '博弈的合法性依英文維基百科「Gambling age」的年齡欄分類（2026 年 10 月，CC BY-SA 4.0，資料檔也依 CC BY-SA 4.0 分享）：寫「全部禁止（賭場）、彩券 18 歲」這類的算只准彩券等特許，只寫年齡的算賭場合法（條目沒有分賭場與彩券，沒有逐國查證賭場是否真的存在），非營利的賓果、摸彩不算；台灣、香港、日本、印度、馬來西亞、美國、澳門依法條或條目的說明另外判斷，寫在附註。',
    en:
      'The death penalty is compiled from Wikipedia articles (October 2026, CC BY-SA 4.0) and shows the situation at the end of each year, with the years of abolition and the last execution in the panel notes; the data file of this indicator is shared under CC BY-SA 4.0 as well. ' +
      '“Abolished in practice” means the death penalty is still in law but there were no executions in that year or the 9 years before, judged from the year of each country’s last execution: earlier years count as having executions unless the articles record a gap of 10 years or more (such as Myanmar in 1988–2022 and the Gambia in 1981–2012). ' +
      '“Abolished for ordinary crimes only” keeps it for exceptions such as wartime or military law. Countries are shown within today’s borders, with the law and executions of the area before independence; Germany in 1949–1990 is West Germany. ' +
      'Legal ages are as of 2026, compiled from Wikipedia articles (CC BY-SA 4.0, and the data files are shared under CC BY-SA 4.0 as well), with Taiwan checked against its statutes: the general age without parental or judicial consent is shown and exceptions are in the notes; where it varies by region, the value for most of the population; for marriage, the age for women (for men where women always need a guardian’s consent); for alcohol, the purchase age, and the lowest where it differs by drink; for driving, not counting accompanied or learner driving; for criminal responsibility, the minimum age. ' +
      'The legality of gambling is classified from the age column of the Wikipedia article “Gambling age” (October 2026, CC BY-SA 4.0, and the data file is shared under CC BY-SA 4.0 as well): entries such as “illegal for all ages (casinos), 18 (lotteries)” count as lotteries or licensed betting only, and entries giving only an age count as casinos legal (the article does not separate casinos from lotteries, and whether casinos actually operate was not checked country by country); non-profit bingo and raffles are ignored. Taiwan, Hong Kong, Japan, India, Malaysia, the US and Macao are classified from their laws or the article’s notes, as given in the panel notes.',
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
    {
      id: 'gambling',
      label: { zh: '博弈的合法性', en: 'Legality of gambling' },
      description: {
        zh: '2026 年各國賭博合法的程度：有合法的賭場、賭場違法但准彩券或賽馬等特許項目、全部禁止，或依州（邦）不同。台灣賭場違法（刑法第 266 條），公益彩券合法、不得賣給未滿 18 歲的人；離島可以經公投設賭場，但專法沒有制定，至今沒有賭場。',
        en: 'How far gambling is legal in 2026: legal casinos, casinos banned but lotteries, racing or other licensed betting allowed, all gambling banned, or varying by state. In Taiwan casinos are illegal (Article 266 of the Criminal Code), while the public welfare lottery is legal from 18; outlying islands may allow casinos after a referendum, but the required law has never been passed, so there are none.',
      },
      unit: '',
      file: 'gambling.json',
      layer: { kind: 'categorical', categories: GAMBLING, ordinal: true },
      format: gamblingLabel,
      defaultYear: 2026,
    },
    {
      id: 'medical-cannabis',
      label: { zh: '醫療用大麻', en: 'Medical cannabis' },
      description: {
        zh: '2026 年醫療用大麻合不合法：合法（可能要處方或執照）、有條件或各地不同（只限特定病人、特別許可、試辦，或法律上可以但沒有供應的制度；美國依州而定）、只准特定的大麻藥品（Sativex、Epidiolex 等）或 CBD、非法。約 50 國合法，例如德國、加拿大、澳洲、泰國、以色列、阿根廷、烏拉圭；日本、南韓、新加坡只准特定藥品或 CBD。台灣的大麻是第二級毒品，但食藥署 2024 年核准大麻二酚口服液 Epidyolex 治療兩種罕見的癲癇，歸「只准特定藥品」。迷幻蘑菇（psilocybin）的醫療用途更少：澳洲 2023 年 7 月起准許授權的精神科醫師開給難治型憂鬱症，捷克 2026 年 1 月起准許在精神科醫院輔助治療；在台灣是第二級毒品。',
        en: 'Whether medical cannabis is legal in 2026: legal (possibly with a prescription or licence), restricted or varying by region (only certain patients, special permits, trials, or legal but with no supply system; by state in the US), specific cannabis medicines (Sativex, Epidiolex and the like) or CBD only, or illegal. About 50 countries allow it, including Germany, Canada, Australia, Thailand, Israel, Argentina and Uruguay; Japan, South Korea and Singapore allow only specific medicines or CBD. In Taiwan cannabis is a Schedule 2 narcotic, but in 2024 the Taiwan FDA licensed the cannabidiol oral solution Epidyolex for two rare forms of epilepsy, so it counts as specific medicines only. Medical use of psilocybin mushrooms is rarer still: since July 2023 authorised psychiatrists in Australia may prescribe it for treatment-resistant depression, and since January 2026 the Czech Republic has allowed psilocybin-assisted therapy in psychiatric hospitals; in Taiwan it is a Schedule 2 narcotic.',
      },
      unit: '',
      file: 'medical-cannabis.json',
      layer: { kind: 'categorical', categories: MEDICAL_CANNABIS, ordinal: true },
      format: medicalCannabisLabel,
      defaultYear: 2026,
    },
    ageIndicator(
      'voting',
      { zh: '投票年齡', en: 'Voting age' },
      {
        zh: '全國選舉可以投票的最低年齡。台灣 20 歲（公民投票 18 歲），是少數還在 20 歲的國家。',
        en: 'The minimum age to vote in national elections. Taiwan’s is 20 (18 for referendums), one of the few still at 20.',
      },
      VOTING,
    ),
    ageIndicator(
      'drinking',
      { zh: '法定飲酒年齡', en: 'Legal drinking age' },
      {
        zh: '可以買酒的最低年齡（沒有規定購買年齡的用飲用年齡；酒類不同時取最低的）。台灣 18 歲。',
        en: 'The minimum age to buy alcohol (the drinking age where no purchase age is set; the lowest where it differs by drink). 18 in Taiwan.',
      },
      DRINKING,
    ),
    ageIndicator(
      'marriage',
      { zh: '最低結婚年齡', en: 'Minimum marriage age' },
      {
        zh: '不需父母或法院同意就能結婚的年齡（男女不同時取女性的）。台灣 2023 年起男女都是 18 歲。',
        en: 'The age at which people can marry without parental or judicial consent (for women where it differs by sex). 18 for both in Taiwan since 2023.',
      },
      MARRIAGE,
    ),
    ageIndicator(
      'driving',
      { zh: '汽車駕照的最低年齡', en: 'Minimum driving age' },
      {
        zh: '可以考汽車駕照、自己開車的最低年齡（不算有人陪同、學習駕照）。台灣 18 歲。',
        en: 'The minimum age for a car driving licence to drive on one’s own (not counting accompanied or learner driving). 18 in Taiwan.',
      },
      DRIVING,
    ),
    ageIndicator(
      'criminal',
      { zh: '刑事責任年齡', en: 'Age of criminal responsibility' },
      {
        zh: '可以負刑事責任的最低年齡。台灣 14 歲（刑法），12–14 歲適用少年事件處理法。',
        en: 'The minimum age of criminal responsibility. 14 in Taiwan under the Criminal Code; children aged 12–13 come under the Juvenile Justice Act.',
      },
      CRIMINAL,
    ),
  ],
};
