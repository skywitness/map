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
 * 娛樂用大麻、迷幻蘑菇的持有（pipeline/sources/recreational_drugs.py，2026-11-03，「大麻」階段）：從寬到嚴是循序的，
 * 「各地不同」不在順序上，用灰色（跟博弈一樣）
 */
const VARIES_COLOR = '#7a776f';
const CANNABIS: CategoryDef[] = [
  { value: 1, label: { zh: '合法，可以合法取得', en: 'Legal, with legal supply' } },
  { value: 2, label: { zh: '可以持有、自種，不准販賣', en: 'Possession and home growing legal, no sale' } },
  { value: 3, label: { zh: '除罪化', en: 'Decriminalised' } },
  { value: 4, label: { zh: '違法，但常不取締或有例外', en: 'Illegal, but often unenforced or with exceptions' } },
  { value: 5, label: { zh: '違法', en: 'Illegal' } },
  { value: 6, label: { zh: '各地不同', en: 'Varies by region' }, color: VARIES_COLOR },
];
const PSILOCYBIN: CategoryDef[] = [
  { value: 1, label: { zh: '合法', en: 'Legal' } },
  { value: 2, label: { zh: '除罪化', en: 'Decriminalised' } },
  { value: 3, label: { zh: '違法，但常不取締', en: 'Illegal, but often unenforced' } },
  { value: 4, label: { zh: '違法', en: 'Illegal' } },
  { value: 5, label: { zh: '各地不同或不明確', en: 'Varies or unclear' }, color: VARIES_COLOR },
];
const labelOf = (categories: CategoryDef[]) => (v: number) => tr(categories.find((c) => c.value === v)?.label ?? '');

/** 徵兵制（pipeline/sources/conscription.py，2026-11-03）：從嚴到寬，越嚴越深 */
const CONSCRIPTION: CategoryDef[] = [
  { value: 1, label: { zh: '徵兵，男女都要', en: 'Conscription for men and women' } },
  { value: 2, label: { zh: '徵兵', en: 'Conscription' } },
  { value: 3, label: { zh: '法律上有，但暫停或不實施', en: 'In law, but suspended or not applied' } },
  { value: 4, label: { zh: '只有志願役', en: 'Volunteers only' } },
  { value: 5, label: { zh: '沒有軍隊', en: 'No army' } },
];
/** 強制投票（pipeline/sources/compulsory_voting.py，2026-11-03）：從嚴到寬，「各地不同」是灰色 */
/** 民主與自由主題的投票率側欄也用（DemocracyPanel） */
export const COMPULSORY_VOTING: CategoryDef[] = [
  { value: 1, label: { zh: '強制投票，有執行', en: 'Compulsory and enforced' } },
  { value: 2, label: { zh: '強制投票，不執行或不明', en: 'Compulsory, not enforced or unclear' } },
  { value: 3, label: { zh: '曾經強制，已廢除', en: 'Formerly compulsory' } },
  { value: 4, label: { zh: '沒有強制投票', en: 'Not compulsory' } },
  { value: 5, label: { zh: '各地不同', en: 'Varies by region' }, color: VARIES_COLOR },
];
/** 墮胎（pipeline/sources/abortion.py，2026-11-03）：全國都准許的最寬理由，從寬到嚴，「各地不同」是灰色 */
const ABORTION: CategoryDef[] = [
  { value: 1, label: { zh: '可以依請求', en: 'On request' } },
  { value: 2, label: { zh: '社會經濟理由', en: 'Social or economic grounds' } },
  { value: 3, label: { zh: '健康、強暴或胎兒異常', en: 'Health, rape or fetal impairment' } },
  { value: 4, label: { zh: '只為救命', en: 'Only to save a life' } },
  { value: 5, label: { zh: '全面禁止', en: 'Prohibited' } },
  { value: 6, label: { zh: '各地不同', en: 'Varies by region' }, color: VARIES_COLOR },
];
/** 安樂死（pipeline/sources/abortion.py，2026-11-03）：從寬到嚴 */
const EUTHANASIA: CategoryDef[] = [
  { value: 1, label: { zh: '安樂死合法', en: 'Euthanasia legal' } },
  { value: 2, label: { zh: '已立法，還沒生效', en: 'Passed, not yet in force' } },
  { value: 3, label: { zh: '只准協助自殺', en: 'Assisted suicide only' } },
  { value: 4, label: { zh: '沒有合法化', en: 'Not legal' } },
];

/**
 * 代理孕母（pipeline/sources/surrogacy.py，2026-11-04，製作手冊第二十批 340）：從寬到嚴，
 * 「沒有法律規範」（中灰）「各地不同」（深灰，跟其他指標同色）不在順序上
 */
const SURROGACY: CategoryDef[] = [
  { value: 1, label: { zh: '商業代孕合法', en: 'Commercial surrogacy legal' } },
  { value: 2, label: { zh: '只准無償代孕', en: 'Altruistic surrogacy only' } },
  { value: 3, label: { zh: '全面禁止', en: 'Prohibited' } },
  // 用中灰：categoricalOther 的淡灰跟色階最淡的「全面禁止」太像
  { value: 4, label: { zh: '沒有法律規範', en: 'Not regulated' }, color: '#a9a69c' },
  { value: 5, label: { zh: '各地不同', en: 'Varies by region' }, color: VARIES_COLOR },
];

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
        zh: '全國法規資料庫（台灣的法定年齡：憲法、公民投票法、民法、兒童及少年福利與權益保障法、道路交通安全規則、刑法；墮胎、安樂死：優生保健法與施行細則、病人自主權利法；代理孕母：人工生殖法）',
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
        zh: '英文維基百科「Legality of cannabis」的 Recreational、Medical 欄（娛樂用與醫療用大麻，2026 年 10 月）、「Legal status of psilocybin mushrooms」（迷幻蘑菇，2026 年 11 月）',
        en: 'Wikipedia, “Legality of cannabis”, Recreational and Medical columns (October 2026) and “Legal status of psilocybin mushrooms” (November 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Legality_of_cannabis&oldid=1378590397',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: 'CIA, The World Factbook：Military service age and obligation（徵兵制；factbook.json 鏡像 2026-09-11 的版本）',
        en: 'CIA, The World Factbook: Military service age and obligation (conscription; factbook.json mirror as of 11 September 2026)',
      },
      url: 'https://github.com/factbook/factbook.json',
      license: { zh: '公有領域（美國政府作品）；鏡像 CC0 1.0', en: 'Public domain (US government work); mirror CC0 1.0' },
    },
    {
      name: { zh: '英文維基百科「Compulsory voting」（強制投票，2026 年 11 月）', en: 'Wikipedia, “Compulsory voting” (November 2026)' },
      url: 'https://en.wikipedia.org/w/index.php?title=Compulsory_voting&oldid=1383198941',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Abortion law」「Legality of euthanasia」（墮胎、安樂死，2026 年 10–11 月）',
        en: 'Wikipedia, “Abortion law” and “Legality of euthanasia” (October–November 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Abortion_law&oldid=1383125224',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Surrogacy laws by country」（代理孕母，2026 年 11 月的版本）',
        en: 'Wikipedia, “Surrogacy laws by country” (surrogacy, November 2026 revision)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Surrogacy_laws_by_country&oldid=1382714270',
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
      '博弈的合法性依英文維基百科「Gambling age」的年齡欄分類（2026 年 10 月，CC BY-SA 4.0，資料檔也依 CC BY-SA 4.0 分享）：寫「全部禁止（賭場）、彩券 18 歲」這類的算只准彩券等特許，只寫年齡的算賭場合法（條目沒有分賭場與彩券，沒有逐國查證賭場是否真的存在），非營利的賓果、摸彩不算；台灣、香港、日本、印度、馬來西亞、美國、澳門依法條或條目的說明另外判斷，寫在附註。' +
      '代理孕母依英文維基百科「Surrogacy laws by country」2026 年 11 月的版本（CC BY-SA 4.0，資料檔也依 CC BY-SA 4.0 分享）逐國的段落自己分類，只分代孕本身合不合法，親權怎麼登記寫在附註：歐盟不准商業代孕，條目寫希臘「完全合法」的算只准無償；泰國條目寫泰國夫妻可以商業代孕，跟 2015 年的法律不符，依法條算只准無償；以色列可以補償費用以外的時間與收入損失，算商業代孕合法；葡萄牙的法律被判違憲、暫停，不畫；台灣依人工生殖法。',
    en:
      'The death penalty is compiled from Wikipedia articles (October 2026, CC BY-SA 4.0) and shows the situation at the end of each year, with the years of abolition and the last execution in the panel notes; the data file of this indicator is shared under CC BY-SA 4.0 as well. ' +
      '“Abolished in practice” means the death penalty is still in law but there were no executions in that year or the 9 years before, judged from the year of each country’s last execution: earlier years count as having executions unless the articles record a gap of 10 years or more (such as Myanmar in 1988–2022 and the Gambia in 1981–2012). ' +
      '“Abolished for ordinary crimes only” keeps it for exceptions such as wartime or military law. Countries are shown within today’s borders, with the law and executions of the area before independence; Germany in 1949–1990 is West Germany. ' +
      'Legal ages are as of 2026, compiled from Wikipedia articles (CC BY-SA 4.0, and the data files are shared under CC BY-SA 4.0 as well), with Taiwan checked against its statutes: the general age without parental or judicial consent is shown and exceptions are in the notes; where it varies by region, the value for most of the population; for marriage, the age for women (for men where women always need a guardian’s consent); for alcohol, the purchase age, and the lowest where it differs by drink; for driving, not counting accompanied or learner driving; for criminal responsibility, the minimum age. ' +
      'The legality of gambling is classified from the age column of the Wikipedia article “Gambling age” (October 2026, CC BY-SA 4.0, and the data file is shared under CC BY-SA 4.0 as well): entries such as “illegal for all ages (casinos), 18 (lotteries)” count as lotteries or licensed betting only, and entries giving only an age count as casinos legal (the article does not separate casinos from lotteries, and whether casinos actually operate was not checked country by country); non-profit bingo and raffles are ignored. Taiwan, Hong Kong, Japan, India, Malaysia, the US and Macao are classified from their laws or the article’s notes, as given in the panel notes. ' +
      'Surrogacy is classified from the country sections of the November 2026 revision of the Wikipedia article “Surrogacy laws by country” (CC BY-SA 4.0, and the data file is shared under CC BY-SA 4.0 as well), covering only whether surrogacy itself is legal, with how parentage is registered in the notes: commercial surrogacy is not allowed in the EU, so Greece, described as “fully legal”, counts as altruistic only; the article says Thai couples may use commercial contracts, which does not match the 2015 Act, so Thailand counts as altruistic only under the Act; Israel allows compensation beyond expenses for time and lost earnings, so it counts as commercial; Portugal’s law was struck down as unconstitutional and suspended, so it is left blank; Taiwan follows the Assisted Reproduction Act.',
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
    {
      id: 'cannabis',
      label: { zh: '娛樂用大麻', en: 'Recreational cannabis' },
      description: {
        zh: '2026 年非醫療用途的大麻合不合法：合法而且可以合法取得（加拿大、烏拉圭的販售，德國、馬爾他的非營利大麻俱樂部）、可以持有與自種但不准販賣（捷克、盧森堡、南非、墨西哥、喬治亞）、除罪化（持有少量不是刑事罪，例如葡萄牙、西班牙、荷蘭的咖啡店是容許、不是合法）、違法但常不取締或有例外、違法，美國、澳洲依州而定。泰國 2022 年開放，2025 年沒有處方的產品又列為違法。台灣的大麻是第二級毒品，施用、持有都有刑責；201 個國家或地區裡 144 個違法。',
        en: 'Whether non-medical cannabis is legal in 2026: legal with a legal supply (sales in Canada and Uruguay, non-profit cannabis clubs in Germany and Malta), possession and home growing legal but no sale (Czechia, Luxembourg, South Africa, Mexico, Georgia), decriminalised (possessing small amounts is not a crime, as in Portugal and Spain; Dutch coffeeshops are tolerated rather than legal), illegal but often unenforced or with exceptions, or illegal; it varies by state in the US and Australia. Thailand opened up in 2022 and recriminalised unprescribed products in 2025. In Taiwan cannabis is a Schedule 2 narcotic, and use and possession are criminal offences; it is illegal in 144 of the 201 countries and territories.',
      },
      unit: '',
      file: 'cannabis.json',
      layer: { kind: 'categorical', categories: CANNABIS, ordinal: true },
      format: labelOf(CANNABIS),
      defaultYear: 2026,
    },
    {
      id: 'psilocybin',
      label: { zh: '迷幻蘑菇的持有', en: 'Magic mushroom possession' },
      description: {
        zh: '2026 年持有迷幻蘑菇（含 psilocybin 的蕈類）合不合法，只收英文維基表上的 63 個國家或地區（其他國家沒有資料，不代表合法）：合法（奧地利、巴西、牙買加、尼泊爾、巴哈馬；荷蘭 2008 年起禁止迷幻蘑菇，但「迷幻松露」合法）、除罪化（葡萄牙、西班牙、瑞士、捷克等）、違法但常不取締（印尼、泰國、越南、加拿大等）、違法；美國依州、市而定。醫療用途見「醫療用大麻」的說明。台灣的 psilocybin 是第二級毒品。',
        en: 'Whether possessing magic mushrooms (fungi containing psilocybin) is legal in 2026, for the 63 countries and territories in the English Wikipedia table only (no data elsewhere, which does not mean legal): legal (Austria, Brazil, Jamaica, Nepal, the Bahamas; the Netherlands banned the mushrooms in 2008 but “magic truffles” are legal), decriminalised (Portugal, Spain, Switzerland, Czechia and others), illegal but often unenforced (Indonesia, Thailand, Vietnam, Canada and others), or illegal; in the US it varies by state and city. For medical use, see “Medical cannabis”. In Taiwan psilocybin is a Schedule 2 narcotic.',
      },
      unit: '',
      file: 'psilocybin.json',
      layer: { kind: 'categorical', categories: PSILOCYBIN, ordinal: true },
      format: labelOf(PSILOCYBIN),
      defaultYear: 2026,
    },
    {
      id: 'conscription',
      label: { zh: '徵兵制', en: 'Conscription' },
      description: {
        zh: '各國有沒有義務役，依 CIA《世界概況》（World Factbook，多數是 2025 年的狀態）的「兵役年齡與義務」逐國分類：徵兵而且男女都要（以色列、北韓、挪威、瑞典、丹麥、緬甸等 16 國）、徵兵（多數只徵男性，選擇性徵兵、抽籤也算，例如南韓、新加坡、泰國、土耳其、俄羅斯）、法律上有但暫停或不實施（德國、荷蘭、阿根廷、印尼等）、只有志願役（日本、美國、英國、法國等 88 國）、沒有軍隊（冰島、哥斯大黎加、巴拿馬等 20 國）。台灣 2024 年起 2005 年以後出生的男性要服 12 個月的義務役。《世界概況》2026 年 2 月停刊，2026 年才開始或恢復的（克羅埃西亞、約旦、柬埔寨）依它寫的計畫，附註有寫明。',
        en: 'Whether countries have compulsory military service, classified country by country from “Military service age and obligation” in the CIA World Factbook (mostly as of 2025): conscription for men and women (16 countries, including Israel, North Korea, Norway, Sweden, Denmark and Myanmar), conscription (mostly men only; selective service and lotteries count, as in South Korea, Singapore, Thailand, Türkiye and Russia), in law but suspended or not applied (Germany, the Netherlands, Argentina, Indonesia and others), volunteers only (88 countries, including Japan, the US, the UK and France), or no army (20, including Iceland, Costa Rica and Panama). In Taiwan men born in 2005 or later have served 12 months since 2024. The Factbook ceased publication in February 2026; changes due in 2026 (Croatia, Jordan, Cambodia) follow its stated plans, as noted.',
      },
      unit: '',
      file: 'conscription.json',
      layer: { kind: 'categorical', categories: CONSCRIPTION, ordinal: true },
      format: labelOf(CONSCRIPTION),
      defaultYear: 2026,
    },
    {
      id: 'compulsory-voting',
      label: { zh: '強制投票', en: 'Compulsory voting' },
      description: {
        zh: '法律有沒有規定一定要投票：有執行（澳洲、巴西、阿根廷、新加坡、祕魯、北韓等 13 個）、有規定但不執行或執行情況不明（比利時、希臘、墨西哥、泰國、土耳其、智利等 12 國）、曾經有、已經廢除（義大利、荷蘭、奧地利、委內瑞拉等 14 國）、沒有（台灣與其他國家）；瑞士只有沙夫豪森邦，算各地不同。依英文維基「Compulsory voting」的列表，不在列表上的國家算沒有強制投票。',
        en: 'Whether the law requires people to vote: compulsory and enforced (13, including Australia, Brazil, Argentina, Singapore, Peru and North Korea), compulsory but not enforced or unclear (12, including Belgium, Greece, Mexico, Thailand, Türkiye and Chile), formerly compulsory (14, including Italy, the Netherlands, Austria and Venezuela), or not compulsory (Taiwan and everywhere else); in Switzerland only the canton of Schaffhausen has it. From the English Wikipedia list “Compulsory voting”; countries not on the list count as not compulsory.',
      },
      unit: '',
      file: 'compulsory-voting.json',
      layer: { kind: 'categorical', categories: COMPULSORY_VOTING, ordinal: true },
      format: labelOf(COMPULSORY_VOTING),
      defaultYear: 2026,
    },
    {
      id: 'abortion',
      label: { zh: '墮胎', en: 'Abortion' },
      description: {
        zh: '全國都可以合法人工流產的最寬理由：可以依請求（68 個，例如中國、南韓、德國、法國、加拿大，多數有週數上限）、社會經濟理由（台灣、日本、英國、印度等 14 個）、只限健康、強暴或胎兒異常（71 個）、只為救命（37 個）、全面禁止（菲律賓、尼加拉瓜、宏都拉斯、薩爾瓦多等 7 國）；美國、墨西哥各州差很多，算各地不同。台灣依優生保健法，懷孕會影響心理健康或家庭生活時可以人工流產，24 週以內，有配偶的人要配偶同意，不能單純依請求。游標移到國家上看週數上限。',
        en: 'The widest ground on which abortion is legal nationwide: on request (68 countries and territories, including China, South Korea, Germany, France and Canada, mostly with a gestational limit), social or economic grounds (14, including Taiwan, Japan, the UK and India), only health, rape or fetal impairment (71), only to save the woman’s life (37), or prohibited altogether (7, including the Philippines, Nicaragua, Honduras and El Salvador); the US and Mexico vary widely by state. In Taiwan the Eugenic Health Act allows abortion when pregnancy would affect mental health or family life, within 24 weeks, with a spouse’s consent for married women, but not on request alone. Hover over a country for the gestational limit.',
      },
      unit: '',
      file: 'abortion.json',
      layer: { kind: 'categorical', categories: ABORTION, ordinal: true },
      format: labelOf(ABORTION),
      defaultYear: 2026,
    },
    {
      id: 'euthanasia',
      label: { zh: '安樂死', en: 'Euthanasia' },
      description: {
        zh: '醫師可以應病人要求施打致死藥物的安樂死：合法的有荷蘭、比利時（2002 年起）、盧森堡、哥倫比亞、加拿大、西班牙、紐西蘭、厄瓜多、烏拉圭（2026 年 4 月起）與澳洲各州；法國、葡萄牙已立法還沒生效；瑞士、德國、奧地利與美國部分州只准協助自殺（病人自己服藥）。台灣沒有合法化：病人自主權利法只准依預立醫療決定撤除或不施行維生治療，受囑託殺人與幫助自殺是刑法第 275 條的罪。不在英文維基表上的國家算沒有合法化。',
        en: 'Euthanasia, where a doctor administers a lethal drug at the patient’s request, is legal in the Netherlands, Belgium (since 2002), Luxembourg, Colombia, Canada, Spain, New Zealand, Ecuador, Uruguay (since April 2026) and the Australian states; France and Portugal have passed laws not yet in force; Switzerland, Germany, Austria and some US states allow only assisted suicide (the patient takes the drug). Taiwan has not legalised it: the Patient Right to Autonomy Act only allows life-sustaining treatment to be withheld or withdrawn under an advance decision, and killing on request and assisting suicide are crimes under Art. 275 of the Criminal Code. Countries not in the English Wikipedia table count as not legal.',
      },
      unit: '',
      file: 'euthanasia.json',
      layer: { kind: 'categorical', categories: EUTHANASIA, ordinal: true },
      format: labelOf(EUTHANASIA),
      defaultYear: 2026,
    },
    {
      id: 'surrogacy',
      label: { zh: '代理孕母', en: 'Surrogacy' },
      description: {
        zh: '代理孕母（替別人懷孕生子）合不合法：商業代孕也合法（俄羅斯、烏克蘭、喬治亞、伊朗、以色列、吉爾吉斯）、只准無償代孕、只能補償費用（英國、加拿大、澳洲、印度、荷蘭、希臘、泰國、越南等 13 個）、全面禁止（法國、德國、義大利、西班牙、中國、台灣等 15 個）、沒有法律規範（日本、南韓、比利時、愛爾蘭等 10 國）；美國、墨西哥各州不同。台灣依人工生殖法只能為妻子能自己懷孕的夫妻施行，不能做代孕。依英文維基「Surrogacy laws by country」2026 年 11 月的版本逐國分類，條目沒寫到的國家不畫；這幾年變動很快（義大利 2024 年把在國外代孕也入罪）。游標移到國家上看細節。',
        en: 'Whether surrogacy (carrying a child for someone else) is legal: commercial surrogacy legal too (Russia, Ukraine, Georgia, Iran, Israel, Kyrgyzstan), altruistic surrogacy only, with expenses reimbursed (13, including the UK, Canada, Australia, India, the Netherlands, Greece, Thailand and Vietnam), prohibited (15, including France, Germany, Italy, Spain, China and Taiwan), or not regulated (10, including Japan, South Korea, Belgium and Ireland); it varies by state in the US and Mexico. In Taiwan the Assisted Reproduction Act only allows treatment for couples where the wife can carry the pregnancy, so surrogacy cannot be performed. Classified country by country from the November 2026 revision of the English Wikipedia article “Surrogacy laws by country”; countries the article does not cover are left blank. The law is changing fast (in 2024 Italy made surrogacy abroad a crime too). Hover over a country for details.',
      },
      unit: '',
      file: 'surrogacy.json',
      layer: { kind: 'categorical', categories: SURROGACY, ordinal: true },
      format: labelOf(SURROGACY),
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
