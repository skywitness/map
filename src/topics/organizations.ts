import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 國際組織（pipeline/topics/organizations.py；成員與日期是 pipeline/sources/igo_members.py 手工整理的表）。
 * 組織是子項目；「成員身分」是每年年底的類別圖（今年是資料產生當天的狀態），「參加幾個組織」是面量圖。
 * 類別代碼跟 pipeline 的 CODES 一致：1 成員、2 申請或加入中、3 夥伴或觀察員、4 暫停參與、0 非成員（其他）。
 */

const REGIONAL: Text = { zh: '區域組織', en: 'Regional' };
const POLITICAL: Text = { zh: '政治與安全', en: 'Politics & security' };
const FORUMS: Text = { zh: '高峰會論壇', en: 'Summit forums' };
const ECONOMY: Text = { zh: '經濟與貿易', en: 'Economy & trade' };

export interface OrgDef {
  id: string;
  /** 子項目選單與標題：台灣的通用譯名（外交部、經濟部的寫法） */
  label: Text;
  /** 側欄清單用的簡稱 */
  short: Text;
  group: Text;
  /** 側欄「關於這個組織」：「成員」是什麼意思、從哪一年算起、前身 */
  about: Text;
}

export const ORGS: OrgDef[] = [
  {
    id: 'eu',
    label: { zh: '歐洲聯盟（歐盟）', en: 'European Union' },
    short: { zh: '歐盟', en: 'EU' },
    group: REGIONAL,
    about: {
      zh: '從 1958 年的歐洲經濟共同體算起（1993 年改為歐洲聯盟，2009 年里斯本條約明定歐盟承接歐洲共同體）。「申請或加入中」含已申請、候選國與潛在候選國（科索沃）。地圖另外畫出不在歐盟內的格陵蘭（1985 年退出）與法羅群島；法國海外省等「最外圍地區」屬於歐盟，但不另外上色。',
      en: 'Counted from the European Economic Community of 1958 (the European Union from 1993; under the 2009 Lisbon Treaty the EU replaced and succeeded the European Community). Applicants include candidate countries and the potential candidate Kosovo. Greenland (which left in 1985) and the Faroe Islands are shown separately as outside the EU; outermost regions such as the French overseas departments are part of the EU but not shaded separately.',
    },
  },
  {
    id: 'asean',
    label: { zh: '東南亞國家協會（東協）', en: 'ASEAN' },
    short: { zh: '東協', en: 'ASEAN' },
    group: REGIONAL,
    about: {
      zh: '1967 年成立，東帝汶 2025 年成為第 11 個成員。「夥伴或觀察員」是對話夥伴、部門對話夥伴與觀察員（巴布亞紐幾內亞）；發展夥伴沒有畫。',
      en: 'Founded in 1967; Timor-Leste became the 11th member in 2025. Partners are dialogue partners, sectoral dialogue partners and the observer Papua New Guinea; development partners are not shown.',
    },
  },
  {
    id: 'au',
    label: { zh: '非洲聯盟（非盟）', en: 'African Union' },
    short: { zh: '非盟', en: 'AU' },
    group: REGIONAL,
    about: {
      zh: '從 1963 年的非洲團結組織算起（2002 年改組為非洲聯盟）。發生政變等違憲更迭政府的國家，會被和平與安全理事會暫停參與，恢復憲政後解除。成員名單列有撒拉威阿拉伯民主共和國，畫在西撒哈拉的範圍。',
      en: 'Counted from the Organisation of African Unity of 1963 (the African Union from 2002). Countries with coups or other unconstitutional changes of government are suspended by the Peace and Security Council until constitutional order returns. The member list includes the Sahrawi Arab Democratic Republic, shown on Western Sahara.',
    },
  },
  {
    id: 'arab-league',
    label: { zh: '阿拉伯國家聯盟（阿盟）', en: 'Arab League' },
    short: { zh: '阿盟', en: 'Arab League' },
    group: REGIONAL,
    about: {
      zh: '1945 年成立，22 個成員含巴勒斯坦。觀察員的名單各來源不一致，官網也查不到，所以沒有畫。',
      en: 'Founded in 1945; its 22 members include Palestine. Observer lists differ between sources and the official website could not be reached, so observers are not shown.',
    },
  },
  {
    id: 'nato',
    label: { zh: '北大西洋公約組織（北約）', en: 'NATO' },
    short: { zh: '北約', en: 'NATO' },
    group: POLITICAL,
    about: {
      zh: '1949 年成立。「申請或加入中」是受邀加入、入盟行動計畫（MAP）、北約承諾未來接納（2008 年布加勒斯特峰會的喬治亞、烏克蘭）與已申請的國家；「夥伴」是和平夥伴關係、地中海對話、伊斯坦堡合作倡議與全球夥伴。',
      en: 'Founded in 1949. Applicants include invited countries, Membership Action Plan participants, the aspirants named at the 2008 Bucharest summit (Georgia and Ukraine) and formal applicants; partners are the Partnership for Peace, Mediterranean Dialogue, Istanbul Cooperation Initiative and partners across the globe.',
    },
  },
  {
    id: 'sco',
    label: { zh: '上海合作組織（上合組織）', en: 'Shanghai Cooperation Organisation' },
    short: { zh: '上合組織', en: 'SCO' },
    group: POLITICAL,
    about: {
      zh: '2001 年成立，前身是 1996 年的上海五國。「夥伴或觀察員」是觀察員與對話夥伴；2026 年比斯凱克峰會前，俄羅斯外長表示兩者將合併為「上合組織夥伴」。',
      en: 'Founded in 2001 from the Shanghai Five of 1996. Partners are observers and dialogue partners; before the 2026 Bishkek summit Russia said the two would be merged into a single "SCO partner" status.',
    },
  },
  {
    id: 'commonwealth',
    label: { zh: '大英國協', en: 'Commonwealth' },
    short: { zh: '大英國協', en: 'Commonwealth' },
    group: POLITICAL,
    about: {
      zh: '從 1949 年倫敦宣言起的現代大英國協算起（英國與舊自治領的成員資格可追溯到 1931 年西敏法令）。成員多是前英國屬地，莫三比克、盧安達、加彭、多哥不是；違反哈拉雷原則的成員會被暫停參與。',
      en: 'Counted from the modern Commonwealth of the 1949 London Declaration (membership of the UK and the old dominions dates back to the 1931 Statute of Westminster). Most members are former British territories, but Mozambique, Rwanda, Gabon and Togo are not; members that breach the Harare principles can be suspended.',
    },
  },
  {
    id: 'g7',
    label: { zh: '七大工業國集團（G7）', en: 'G7' },
    short: { zh: 'G7', en: 'G7' },
    group: FORUMS,
    about: {
      zh: '1975 年起的高峰會論壇，沒有成立條約與秘書處，「成員」是固定出席高峰會的國家；歐盟 1977 年起參加，不在地圖上。俄羅斯 1998–2014 年參加，稱為八大工業國組織（G8）。',
      en: 'A summit forum since 1975 with no founding treaty or secretariat; "members" are the countries that attend every summit. The EU has taken part since 1977 and is not on the map. Russia took part in 1998–2014, when the group was the G8.',
    },
  },
  {
    id: 'g20',
    label: { zh: '二十國集團（G20）', en: 'G20' },
    short: { zh: 'G20', en: 'G20' },
    group: FORUMS,
    about: {
      zh: '1999 年成立的財長與央行總裁論壇，2008 年起召開高峰會；沒有成立條約，「成員」是固定出席的國家。歐盟（1999 年起）與非洲聯盟（2023 年起）也是成員，不在地圖上；西班牙是常任受邀國。',
      en: 'Founded in 1999 as a forum of finance ministers and central bank governors, with leaders\' summits since 2008; it has no founding treaty, so "members" are the countries that always attend. The EU (since 1999) and the African Union (since 2023) are also members but not on the map; Spain is a permanent guest.',
    },
  },
  {
    id: 'brics',
    label: { zh: '金磚國家（BRICS）', en: 'BRICS' },
    short: { zh: '金磚國家', en: 'BRICS' },
    group: FORUMS,
    about: {
      zh: '2009 年起的高峰會論壇（金磚四國，2010 年南非加入），沒有成立條約。2024–2025 年擴大；沙烏地阿拉伯 2023 年受邀但沒有正式確認，算「受邀加入」。2025 年起有「夥伴國」。',
      en: 'A summit forum since 2009 (BRIC, joined by South Africa in 2010) with no founding treaty. It expanded in 2024–2025; Saudi Arabia was invited in 2023 but has not formally confirmed, so it is shown as invited. Partner countries were added from 2025.',
    },
  },
  {
    id: 'wto',
    label: { zh: '世界貿易組織（WTO）', en: 'World Trade Organization' },
    short: { zh: 'WTO', en: 'WTO' },
    group: ECONOMY,
    about: {
      zh: '1995 年成立，不畫前身關稅暨貿易總協定（GATT）。會員可以是國家或個別關稅領域：台灣（中華台北）、香港、澳門以自己的名義加入，歐盟本身也是會員。「申請或加入中」是正在談判加入的觀察員。',
      en: 'Founded in 1995; its predecessor, the GATT, is not shown. Members can be countries or separate customs territories: Taiwan (Chinese Taipei), Hong Kong and Macao are members in their own right, and so is the EU itself. Applicants are observers negotiating accession.',
    },
  },
  {
    id: 'oecd',
    label: { zh: '經濟合作暨發展組織（OECD）', en: 'OECD' },
    short: { zh: 'OECD', en: 'OECD' },
    group: ECONOMY,
    about: {
      zh: '1961 年公約生效起算，不畫前身歐洲經濟合作組織（OEEC，1948）。「申請或加入中」是正在進行入會討論的國家；「夥伴」是 2007 年起的主要夥伴。',
      en: 'Counted from the entry into force of the 1961 Convention; its predecessor, the OEEC of 1948, is not shown. Applicants are countries in accession talks; partners are the Key Partners since 2007.',
    },
  },
  {
    id: 'apec',
    label: { zh: '亞太經濟合作（APEC）', en: 'APEC' },
    short: { zh: 'APEC', en: 'APEC' },
    group: ECONOMY,
    about: {
      zh: '1989 年成立，成員稱為「經濟體」：台灣以「中華台北」、香港以「中國香港」參加。1997 年起暫停接受新成員，名單一直是 21 個。',
      en: 'Founded in 1989; its members are called economies, with Taiwan taking part as Chinese Taipei and Hong Kong as Hong Kong, China. New membership has been on hold since 1997, leaving 21 members.',
    },
  },
  {
    id: 'cptpp',
    label: { zh: '跨太平洋夥伴全面進步協定（CPTPP）', en: 'CPTPP' },
    short: { zh: 'CPTPP', en: 'CPTPP' },
    group: ECONOMY,
    about: {
      zh: '2018 年 12 月 30 日生效的自由貿易協定，「成員」是協定已經對它生效的締約方；已簽署、還沒生效的算「加入中」。台灣 2021 年以「臺澎金馬個別關稅領域」申請加入。',
      en: 'A free trade agreement in force since 30 December 2018; members are parties for which it has entered into force, and signatories awaiting entry into force are shown as acceding. Taiwan applied in 2021 as the Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu.',
    },
  },
  {
    id: 'rcep',
    label: { zh: '區域全面經濟夥伴協定（RCEP）', en: 'RCEP' },
    short: { zh: 'RCEP', en: 'RCEP' },
    group: ECONOMY,
    about: {
      zh: '2020 年 11 月簽署、2022 年起生效的自由貿易協定，「成員」是協定已經對它生效的締約方。2026 年 9 月為香港、斯里蘭卡、智利、孟加拉成立加入工作小組。',
      en: 'A free trade agreement signed in November 2020 and in force from 2022; members are parties for which it has entered into force. An accession working group for Hong Kong, Sri Lanka, Chile and Bangladesh was set up in September 2026.',
    },
  },
  {
    id: 'opec',
    label: { zh: '石油輸出國組織（OPEC）', en: 'OPEC' },
    short: { zh: 'OPEC', en: 'OPEC' },
    group: ECONOMY,
    about: {
      zh: '1960 年成立。阿聯 2026 年 5 月 1 日退出。成員自己「暫停會籍」（印尼、厄瓜多）算退出。「夥伴」是 2016 年起參加 OPEC+ 合作宣言的非 OPEC 產油國。',
      en: 'Founded in 1960. The UAE left on 1 May 2026. Members that "suspended" their own membership (Indonesia, Ecuador) are treated as having left. Partners are the non-OPEC producers in the OPEC+ Declaration of Cooperation since 2016.',
    },
  },
];

/** 類別（代碼跟 pipeline 一致）。非成員（0）是「其他」，所以地圖不會整片灰色 */
export const STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '成員', en: 'Member' } },
  { value: 2, label: { zh: '申請或加入中', en: 'Applicant or acceding' } },
  { value: 3, label: { zh: '夥伴或觀察員', en: 'Partner or observer' } },
  { value: 4, label: { zh: '成員（暫停參與）', en: 'Member (suspended)' } },
];
export const NOT_MEMBER: Text = { zh: '非成員', en: 'Not a member' };

/** 側欄的細分種類（pipeline/sources/igo_members.py 的 kind） */
export const KINDS: Record<string, Text> = {
  applied: { zh: '已申請加入', en: 'Applied' },
  candidate: { zh: '候選國', en: 'Candidate country' },
  potential: { zh: '潛在候選國（已申請）', en: 'Potential candidate (applied)' },
  invited: { zh: '受邀加入', en: 'Invited' },
  signed: { zh: '已簽署，協定還沒對它生效', en: 'Signed, not yet in force for it' },
  accession: { zh: '加入談判中', en: 'Accession talks' },
  map: { zh: '入盟行動計畫（MAP）', en: 'Membership Action Plan' },
  aspirant: { zh: '北約承諾未來接納', en: 'Aspirant (2008 Bucharest pledge)' },
  inprinciple: { zh: '原則同意接納，觀察員', en: 'Admitted in principle; observer' },
  observer: { zh: '觀察員', en: 'Observer' },
  dialogue: { zh: '對話夥伴', en: 'Dialogue partner' },
  sectoral: { zh: '部門對話夥伴', en: 'Sectoral dialogue partner' },
  consultative: { zh: '諮商夥伴', en: 'Consultative partner' },
  pfp: { zh: '和平夥伴關係', en: 'Partnership for Peace' },
  md: { zh: '地中海對話', en: 'Mediterranean Dialogue' },
  ici: { zh: '伊斯坦堡合作倡議', en: 'Istanbul Cooperation Initiative' },
  global: { zh: '全球夥伴', en: 'Partner across the globe' },
  partner: { zh: '夥伴國', en: 'Partner country' },
  key: { zh: '主要夥伴', en: 'Key partner' },
  doc: { zh: 'OPEC+ 合作宣言參與國', en: 'OPEC+ Declaration of Cooperation' },
  guest: { zh: '常任受邀國', en: 'Permanent guest' },
  g8: { zh: '八大工業國組織（G8）', en: 'G8' },
  partial: { zh: '部分暫停', en: 'Partially suspended' },
};

const statusLabel = (v: number) => tr(STATUS.find((c) => c.value === v)?.label ?? NOT_MEMBER);
const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個組織`, en: `${fixed(v, 0)} of 16` });

// 不是主權國家、沒有自己成員身分的地方：tooltip 與側欄寫原因，不寫「無資料」。
// 有值的組織照常顯示（歐盟的格陵蘭、WTO 的香港），只有沒有值的組織顯示這些說明。
const NO_MEMBERSHIP =
  'ABW AIA ASM ATA ATF BES BLM BMU BVT CCK CXR CYM FLK GGY GIB GUM HMD IMN IOT JEY MAF MNP MSR NCL NFK PCN PRI PYF SGS SHN SPM SXM TCA TKL UMI VGB VIR WLF _IOT';
const NO_MEMBERSHIP_TEXT: Text = {
  zh: '海外領地或屬地，沒有自己的成員身分（隨主權國家參加的不另外上色）',
  en: 'A dependent territory with no membership of its own (not shaded separately)',
};
/**
 * 主權國家本身的一部分：隨主權國家參加，地圖上不另外上色（另外塗色的話，圖例的國家／地區數會跟成員數對不上）。
 * 只有歐盟的格陵蘭、法羅群島另外畫（不在歐盟內，跟丹麥不同）。
 */
const DENMARK: Text = {
  zh: '丹麥王國的一部分，隨丹麥參加各組織，不另外上色（歐盟例外：格陵蘭 1985 年退出，法羅群島從未加入）',
  en: 'Part of the Kingdom of Denmark; takes part through Denmark and is not shaded separately (except for the EU, which Greenland left in 1985 and the Faroe Islands never joined)',
};
const FRANCE: Text = {
  zh: '法國的海外省（也是歐盟的最外圍地區），隨法國參加各組織，不另外上色',
  en: 'An overseas department of France (and an outermost region of the EU); takes part through France and is not shaded separately',
};
const PART_OF: Record<string, Text> = {
  GRL: DENMARK,
  FRO: DENMARK,
  ALA: {
    zh: '芬蘭的自治區，隨芬蘭參加各組織，不另外上色',
    en: 'An autonomous region of Finland; takes part through Finland and is not shaded separately',
  },
  SJM: { zh: '挪威的一部分，隨挪威參加各組織，不另外上色', en: 'Part of Norway; takes part through Norway and is not shaded separately' },
  ...Object.fromEntries('GUF GLP MTQ REU MYT'.split(' ').map((id) => [id, FRANCE])),
};

export const organizations: TopicDefinition = {
  id: 'organizations',
  title: { zh: '國際組織', en: 'International organisations' },
  // 英文的頂列在 1280px 寬只放得下約 11 個字元
  shortTitle: { zh: '國際組織', en: "Int'l orgs" },
  defaultIndicator: 'membership',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '各組織官網的成員名單（史實自行整理，網址見側欄與 igo_members.py）',
        en: "Member lists on each organisation's website (compiled; links in the side panel)",
      },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/sources/igo_members.py',
      license: { zh: '史實自行整理', en: 'facts compiled by hand' },
    },
    {
      name: { zh: '維基百科各組織的成員國條目（交叉比對）', en: 'Wikipedia member-state articles (cross-checking)' },
      url: 'https://en.wikipedia.org/wiki/Member_states_of_the_African_Union',
      license: 'CC BY-SA 4.0',
    },
  ],
  // 頁尾要短：英文版在 1280×800 太長會把地圖擠扁（細節在指標說明、側欄與 DESIGN.md）
  note: {
    zh: '每年 12 月 31 日的狀態，今年是資料產生當天。用今天的國界：獨立以前算非成員，德國 1990 年以前是西德。台灣以「中華台北」參加 APEC、以「臺澎金馬個別關稅領域」參加 WTO。',
    en: "Status on 31 December of each year; the current year shows the status on the generation date. Today's borders are used: countries count as non-members before independence, and Germany before 1990 is West Germany. Taiwan takes part in APEC as Chinese Taipei and in the WTO as the Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu.",
  },
  dimension: {
    label: { zh: '組織', en: 'Organisation' },
    options: ORGS.map(({ id, label, group }) => ({ id, label, group })),
    defaultOption: 'eu',
  },
  noValue: {
    ...Object.fromEntries(NO_MEMBERSHIP.split(' ').map((id) => [id, NO_MEMBERSHIP_TEXT])),
    ...PART_OF,
    HKG: {
      zh: '香港特別行政區：以「中國香港」參加 WTO、APEC，申請加入 RCEP；其他組織不另外上色',
      en: 'Hong Kong SAR: a member of the WTO and APEC as Hong Kong, China, and an RCEP applicant; not shaded for other organisations',
    },
    MAC: {
      zh: '澳門特別行政區：以「中國澳門」參加 WTO；其他組織不另外上色',
      en: 'Macao SAR: a WTO member as Macao, China; not shaded for other organisations',
    },
    CUW: {
      zh: '庫拉索（荷蘭王國的自治國）：以自己的名義申請加入 WTO；其他組織不另外上色',
      en: 'Curaçao (part of the Kingdom of the Netherlands): applying to the WTO in its own right; not shaded for other organisations',
    },
    ESH: {
      zh: '西撒哈拉：主權有爭議；非洲聯盟的成員名單列有撒拉威阿拉伯民主共和國，所以只在非洲聯盟上色',
      en: 'Western Sahara: sovereignty is disputed; the African Union lists the Sahrawi Arab Democratic Republic as a member, so it is shaded only for the AU',
    },
    _SOL: {
      zh: '索馬利蘭：國際上一般視為索馬利亞的一部分，沒有自己的成員身分',
      en: 'Somaliland: generally regarded as part of Somalia; no membership of its own',
    },
    _CYN: {
      zh: '北賽普勒斯：國際上一般視為賽普勒斯的一部分（只有土耳其承認），沒有自己的成員身分；歐盟法在這裡暫停適用',
      en: 'Northern Cyprus: generally regarded as part of Cyprus (recognised only by Türkiye); no membership of its own, and EU law is suspended there',
    },
    _SIA: {
      zh: '錫亞琴冰川：印度與巴基斯坦的爭議地區，不另外上色',
      en: 'Siachen Glacier: disputed between India and Pakistan; not shaded separately',
    },
  },
  panelExtra: () => import('./panels/OrganizationsPanel'),
  indicators: [
    {
      id: 'membership',
      label: { zh: '成員身分', en: 'Membership' },
      description: {
        zh: '各國在這個組織的身分，每年 12 月 31 日的狀態（今年是資料產生當天），拖動時間軸看加入與退出。G7、G20、金磚國家是沒有條約的論壇，「成員」指固定出席高峰會的國家；CPTPP、RCEP 的「成員」是協定已對它生效的締約方。',
        en: "Each country's status in the selected organisation on 31 December of each year (the current year: the generation date); drag the time slider to follow accessions and departures. The G7, G20 and BRICS are forums without treaties, so members are the countries that attend every summit; CPTPP and RCEP members are parties for which the agreement is in force.",
      },
      unit: '',
      file: 'membership/{item}.json',
      layer: { kind: 'categorical', categories: STATUS, other: NOT_MEMBER },
      format: statusLabel,
    },
    {
      id: 'count',
      label: { zh: '參加幾個組織', en: 'Number of memberships' },
      description: {
        zh: '這裡列的 16 個組織裡，這個國家是成員的有幾個（暫停參與的也算），每年 12 月 31 日的狀態。申請、夥伴與觀察員不算；只是挑出來的 16 個，不代表一個國家參加的所有國際組織。',
        en: 'How many of the 16 organisations listed here the country belongs to (suspended members included), on 31 December of each year. Applicants, partners and observers are not counted; this is a selection of 16, not every organisation a country belongs to.',
      },
      unit: { zh: '個', en: '' },
      file: 'count.json',
      // 2026 年最多是加拿大的 8 個；0 個（不屬於任何一個）是第一級
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 5, 6] } },
      format: count,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
