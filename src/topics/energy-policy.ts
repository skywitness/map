import { tr } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 能源政策（2026-10-31，製作手冊第十批 167；pipeline/topics/energy_policy.py）：各國的核能政策、燃煤發電的退場年份、
 * 是否加入棄用煤炭發電聯盟。使用者決定 709、710 合成一個新主題，放科技的「能源」欄。國家指標，沒有點或線，不做左側欄。
 */

/** 核能政策（pipeline 的 EXPANDING…BANNED、NONE）：使用者決定的七類，加上沒有核電 */
const NUCLEAR: CategoryDef[] = [
  { value: 1, label: { zh: '擴建中', en: 'Expanding' } },
  { value: 2, label: { zh: '維持', en: 'Maintaining' } },
  { value: 3, label: { zh: '新建第一座', en: 'Building its first' } },
  { value: 4, label: { zh: '規劃中', en: 'Planning' } },
  { value: 5, label: { zh: '逐步廢核', en: 'Phasing out' } },
  { value: 6, label: { zh: '已廢核', en: 'Phased out' } },
  { value: 7, label: { zh: '法律禁止', en: 'Banned by law' } },
  { value: 0, label: { zh: '沒有核電', en: 'No nuclear power' }, color: MAP_TOKENS.categoricalOther },
];
/** 燃煤發電的退場年份：值是年份本身（已完成的是完成的年份），0 是沒有承諾；表裡沒有的國家沒有值 */
const COAL: CategoryDef[] = [
  { value: 1900, max: 2025, label: { zh: '已完成', en: 'Completed' } },
  { value: 2026, max: 2030, label: { zh: '2026–2030 年', en: '2026–2030' } },
  { value: 2031, max: 2039, label: { zh: '2031–2039 年', en: '2031–2039' } },
  { value: 2040, max: 2049, label: { zh: '2040–2049 年', en: '2040–2049' } },
  { value: 0, label: { zh: '沒有承諾', en: 'Not committed' }, color: MAP_TOKENS.categoricalOther },
];
/** 棄用煤炭發電聯盟：值是加入年份，1 是網站沒有寫年份的會員，0 不是會員 */
const PPCA: CategoryDef[] = [
  { value: 2017, label: { zh: '2017 年（創始）', en: '2017 (founding)' } },
  { value: 2018, max: 2020, label: { zh: '2018–2020 年', en: '2018–2020' } },
  { value: 2021, max: 2023, label: { zh: '2021–2023 年', en: '2021–2023' } },
  { value: 2024, max: 2026, label: { zh: '2024–2026 年', en: '2024–2026' } },
  { value: 1, label: { zh: '會員，加入年份不明', en: 'Member, year unknown' }, color: MAP_TOKENS.context },
  { value: 0, label: { zh: '不是會員', en: 'Not a member' }, color: MAP_TOKENS.categoricalOther },
];
const categoryText = (list: CategoryDef[], v: number) =>
  tr(list.find((c) => v >= c.value && v <= (c.max ?? c.value))?.label ?? { zh: '', en: '' });

const WIKI = (title: string, rev: number) => `https://en.wikipedia.org/w/index.php?title=${title}&oldid=${rev}`;

export const energyPolicy: TopicDefinition = {
  id: 'energy-policy',
  title: { zh: '能源政策（核能政策、煤電退場）', en: 'Energy policy: nuclear power and coal phase-out' },
  shortTitle: { zh: '能源政策', en: 'Energy policy' },
  defaultIndicator: 'nuclear-policy',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Global Energy Monitor：Global Integrated Power Tracker（核電機組的狀態，2026 年 9 月版）',
        en: 'Global Energy Monitor, Global Integrated Power Tracker (status of nuclear units, September 2026)',
      },
      url: 'https://globalenergymonitor.org/projects/global-integrated-power-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Nuclear power phase-out」（revid 1381033908）、「Nuclear energy policy by country」（revid 1381945093），逐國對照條目內文與官方資料（2026-10-31）',
        en: 'English Wikipedia, “Nuclear power phase-out” (revision 1381033908) and “Nuclear energy policy by country” (revision 1381945093), checked country by country against the article text and official sources (31 Oct 2026)',
      },
      url: WIKI('Nuclear_power_phase-out', 1381033908),
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「Coal phase-out」的各國退場年份表（revid 1377174595，年份引 Ember）',
        en: 'English Wikipedia, “Coal phase-out”, table of phase-out years by country (revision 1377174595, years from Ember)',
      },
      url: WIKI('Coal_phase-out', 1377174595),
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Ember：Coal generation in OECD countries falls below half of its peak', en: 'Ember, Coal generation in OECD countries falls below half of its peak' },
      url: 'https://ember-energy.org/latest-insights/coal-generation-in-oecd-countries-falls-below-half-of-its-peak/',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '棄用煤炭發電聯盟（Powering Past Coal Alliance）的國家會員與加入年份（2026-10-31 讀取，只用會籍這個事實）',
        en: 'Powering Past Coal Alliance, national government members and joining years (read 31 Oct 2026; membership facts only)',
      },
      url: 'https://poweringpastcoal.org/members/',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
    {
      name: {
        zh: '國家發展委員會：臺灣 2050 淨零排放路徑及策略總說明（2022-03-30，台灣的減煤）',
        en: 'National Development Council (Taiwan), 2050 net-zero pathway overview (30 March 2022; Taiwan’s coal policy)',
      },
      url: 'https://www.ndc.gov.tw/Content_List.aspx?n=FD76ECBAE77D9811',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '台灣的核電重啟：核能安全委員會、中央選舉委員會的公告（中央社 2026-08-28、08-31 報導）',
        en: 'Taiwan’s nuclear restart: Nuclear Safety Commission and Central Election Commission announcements (as reported by CNA, 28 and 31 Aug 2026)',
      },
      url: 'https://www.cna.com.tw/news/afe/202608310275.aspx',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
  ],
  note: {
    zh: '核能政策的「擴建中、維持、新建第一座、規劃中」依 Global Energy Monitor（2026 年 9 月版）各國核電機組的狀態：有運轉中又有興建中、只有運轉中、只有興建中、只有籌備或宣布；「逐步廢核、已廢核、法律禁止」是政策，依英文維基的兩個條目逐國對照（表格很多過時，以條目內文較新的段落與官方資料為準，2026-10-31），滑過或點國家看依據與日期。煤電退場的年份是英文維基「Coal phase-out」的表（Ember 的 OECD 分析，另有保加利亞、摩洛哥）與越南一節，其他國家沒有資料，不是沒有承諾。',
    en: 'For nuclear policy, “expanding”, “maintaining”, “building its first” and “planning” follow the status of each country’s nuclear units in Global Energy Monitor (September 2026): operating and under construction, operating only, under construction only, or proposed only. “Phasing out”, “phased out” and “banned by law” are policies, checked country by country against two English Wikipedia articles (many rows in the table are out of date, so newer passages of the article text and official sources take precedence, 31 Oct 2026); hover over or click a country for the basis and dates. Coal phase-out years come from the table in English Wikipedia’s “Coal phase-out” (Ember’s analysis of OECD countries, plus Bulgaria and Morocco) and its section on Vietnam; other countries have no data, which is not the same as no commitment.',
  },
  indicators: [
    {
      id: 'nuclear-policy',
      label: { zh: '核能政策', en: 'Nuclear power policy' },
      description: {
        zh: '各國對核電的政策。擴建中的 13 國有運轉中又有興建中的機組（中國、印度、俄羅斯、美國、英國、日本、南韓等）；新建第一座的是土耳其、孟加拉、埃及、烏茲別克；規劃中 15 國（波蘭、越南、印尼、沙烏地等）。逐步廢核的西班牙（2027–2035 年）與瑞士（2026 年國會通過取消禁令，要公投），已廢核的德國 2023 年、立陶宛 2009 年、義大利 1990 年、台灣 2025 年（2026 年宣布重啟），法律禁止的奧地利、澳洲、丹麥、愛爾蘭、烏拉圭。比利時 2025 年廢止廢核法、南韓 2022 年取消廢核，現在都不算廢核。',
        en: 'Each country’s policy on nuclear power. The 13 expanding countries have units both operating and under construction (China, India, Russia, the US, the UK, Japan, South Korea and others); Türkiye, Bangladesh, Egypt and Uzbekistan are building their first; 15 are planning (Poland, Vietnam, Indonesia, Saudi Arabia and others). Spain (2027–2035) and Switzerland (Parliament voted to lift its ban in 2026, pending a referendum) are phasing out; Germany (2023), Lithuania (2009), Italy (1990) and Taiwan (2025; a restart was announced in 2026) have phased out; Austria, Australia, Denmark, Ireland and Uruguay ban it by law. Belgium repealed its phase-out law in 2025 and South Korea dropped its phase-out in 2022, so neither counts as phasing out.',
      },
      unit: '',
      file: 'nuclear-policy.json',
      layer: { kind: 'categorical', categories: NUCLEAR },
      format: (v) => categoryText(NUCLEAR, v),
      timeless: true,
    },
    {
      id: 'coal-phaseout',
      label: { zh: '燃煤發電的退場年份', en: 'Coal power phase-out year' },
      description: {
        zh: '各國停用燃煤發電的年份。已完成的 13 國：冰島 1950、瑞士 1961、盧森堡 1998、比利時 2016、奧地利與瑞典 2020、英國 2024、芬蘭與愛爾蘭 2025 等；2030 年前的有法國、加拿大、西班牙、紐西蘭等，德國與義大利 2038、南韓與摩洛哥 2040、波蘭 2049。澳洲、日本、墨西哥、土耳其、哥倫比亞與台灣沒有承諾。表只有 OECD 國家與保加利亞、摩洛哥，中國、印度、印尼等煤電大國沒有資料（越南依條目的越南一節是 2040 年代）。「退場」有的是燃煤發電歸零、有的是最後一座關廠，滑過看各國的說明。',
        en: 'The year each country stops generating power from coal. The 13 that have finished include Iceland (1950), Switzerland (1961), Luxembourg (1998), Belgium (2016), Austria and Sweden (2020), the UK (2024), and Finland and Ireland (2025); France, Canada, Spain and New Zealand are among those aiming for 2030 or earlier, Germany and Italy for 2038, South Korea and Morocco for 2040 and Poland for 2049. Australia, Japan, Mexico, Türkiye, Colombia and Taiwan have not committed. The table covers only OECD countries plus Bulgaria and Morocco, so large coal users such as China, India and Indonesia have no data (Vietnam’s 2040s pledge comes from the article’s section on Vietnam). “Phase-out” means zero coal generation for some countries and closing the last plant for others; hover for details.',
      },
      unit: '',
      file: 'coal-phaseout.json',
      layer: { kind: 'categorical', categories: COAL, ordinal: true },
      format: (v) =>
        v === 0
          ? tr({ zh: '沒有承諾', en: 'Not committed' })
          : v <= 2025
            ? tr({ zh: `${v} 年已完成`, en: `Completed in ${v}` })
            : tr({ zh: `目標 ${v} 年`, en: `Target: ${v}` }),
      missing: { zh: '沒有資料（表只有 OECD 國家與保加利亞、摩洛哥）', en: 'No data (the table covers only OECD countries, Bulgaria and Morocco)' },
      timeless: true,
    },
    {
      id: 'ppca',
      label: { zh: '棄用煤炭發電聯盟', en: 'Powering Past Coal Alliance' },
      description: {
        zh: '有沒有加入「棄用煤炭發電聯盟」（PPCA）與加入的年份。英國與加拿大 2017 年在聯合國氣候會議（COP23）發起，國家會員承諾停用沒有減排設備的燃煤發電（OECD 與歐盟國家 2030 年、其他國家 2050 年）、不再蓋新的燃煤電廠。2026 年有 65 個國家會員，德國 2019、美國 2023、南韓 2025 年加入；中國、印度、日本、澳洲不是會員，台灣也不是。聯盟另有州、城市、企業與金融機構會員，這裡只算國家。',
        en: 'Whether a country has joined the Powering Past Coal Alliance (PPCA), and when. The UK and Canada launched it at the UN climate conference (COP23) in 2017; national members commit to phasing out unabated coal power (by 2030 for OECD and EU countries, by 2050 elsewhere) and to building no new coal plants. In 2026 it has 65 national members: Germany joined in 2019, the US in 2023 and South Korea in 2025, while China, India, Japan, Australia and Taiwan are not members. The alliance also has state, city, business and financial members; only countries are shown here.',
      },
      unit: '',
      file: 'ppca.json',
      layer: { kind: 'categorical', categories: PPCA, ordinal: true },
      format: (v) =>
        v === 0
          ? tr({ zh: '不是會員', en: 'Not a member' })
          : v === 1
            ? tr({ zh: '會員（網站沒有寫加入年份）', en: 'Member (joining year not given)' })
            : tr({ zh: `${v} 年加入`, en: `Joined in ${v}` }),
      timeless: true,
    },
  ],
};
