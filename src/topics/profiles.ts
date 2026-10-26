import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, PointRecord, TopicDefinition } from './types';

/**
 * 國家小檔案（pipeline/topics/profiles.py）：主角是側欄的小檔案（ProfilesPanel），地圖畫政體形式、貨幣、鄰國數、內陸國。
 * 單一快照（timeless）。類別代碼跟 pipeline 的 PRES… OTHER、EURO… OWN、DOUBLY… COASTAL 一致。
 */

/** 政體形式（pipeline 的 PRES、SEMI…）。屬地（8）不列在類別裡，歸到 other（淺的中性色） */
export const GOVERNMENT: CategoryDef[] = [
  { value: 1, label: { zh: '總統制共和國', en: 'Presidential republic' } },
  { value: 2, label: { zh: '半總統制共和國', en: 'Semi-presidential republic' } },
  { value: 3, label: { zh: '議會制共和國', en: 'Parliamentary republic' } },
  { value: 4, label: { zh: '議會制君主立憲', en: 'Parliamentary monarchy' } },
  { value: 5, label: { zh: '君主握有實權的君主立憲', en: 'Monarchy with an active monarch' } },
  { value: 6, label: { zh: '絕對君主制', en: 'Absolute monarchy' } },
  { value: 7, label: { zh: '一黨制', en: 'One-party state' } },
  { value: 9, label: { zh: '其他（軍政府、過渡政府、神權、委員會制）', en: 'Other (military, transitional, theocratic, directorial)' } },
];
export const TERRITORY: Text = { zh: '屬地或自治領土（主權屬於他國）', en: 'Dependent or autonomous territory' };

/** 貨幣（pipeline 的 EURO、USD、CFA、SHARED、OWN）。本國貨幣（5）歸到 other */
export const CURRENCY: CategoryDef[] = [
  { value: 1, label: { zh: '歐元', en: 'Euro' } },
  { value: 2, label: { zh: '美元（正式採用或法定貨幣之一）', en: 'US dollar (adopted or legal tender)' } },
  { value: 3, label: { zh: '非洲法郎（XOF、XAF）', en: 'CFA franc (XOF, XAF)' } },
  { value: 4, label: { zh: '跟其他國家或地區共用的貨幣', en: 'Currency shared with other countries' } },
];
const OWN_CURRENCY: Text = { zh: '自己的貨幣', en: 'Own currency' };

/** 內陸國（pipeline 的 DOUBLY、LANDLOCKED、COASTAL）：雙重內陸國排第一、顏色最深 */
export const LANDLOCKED: CategoryDef[] = [
  { value: 1, label: { zh: '雙重內陸國（鄰國也都是內陸國）', en: 'Doubly landlocked' } },
  { value: 2, label: { zh: '內陸國', en: 'Landlocked' } },
  { value: 3, label: { zh: '沿海', en: 'Coastal' } },
];

/** 屬地跟主權國的關係（pipeline 的 TERRITORIES、RELATION_TEXT） */
export const RELATIONS: Record<string, Text> = {
  nl: { zh: '荷蘭王國的構成國', en: 'Constituent country of the Kingdom of the Netherlands' },
  'uk-ot': { zh: '英國海外領土', en: 'British Overseas Territory' },
  'uk-cd': { zh: '英國皇家屬地', en: 'British Crown Dependency' },
  fi: { zh: '芬蘭的自治區', en: 'Autonomous region of Finland' },
  us: { zh: '美國的屬地', en: 'United States territory' },
  fr: { zh: '法國的海外屬地', en: 'French overseas territory' },
  'nz-assoc': { zh: '與紐西蘭自由聯合的自治國', en: 'Self-governing state in free association with New Zealand' },
  nz: { zh: '紐西蘭的屬地', en: 'Territory of New Zealand' },
  dk: { zh: '丹麥王國的自治領土', en: 'Autonomous territory of the Kingdom of Denmark' },
  'cn-sar': { zh: '中國的特別行政區', en: 'Special administrative region of China' },
  au: { zh: '澳洲的海外領地', en: 'External territory of Australia' },
};

/**
 * 地位或主權有爭議的地方：照事實寫各方的主張，不替任何一方下判斷（DESIGN.md 第 8 節）。
 * 也用在地圖的「無資料」原因（noValue）與側欄最上面的說明。
 */
export const STATUS: Record<string, Text> = {
  XKX: {
    zh: '2008 年宣布脫離塞爾維亞獨立；塞爾維亞不承認，聯合國會員國約有一半承認。',
    en: 'Declared independence from Serbia in 2008; Serbia does not recognise it, and about half of UN member states do.',
  },
  PSE: {
    zh: '巴勒斯坦國：聯合國的觀察員國，多數聯合國會員國承認，以色列與部分國家不承認；巴勒斯坦自治政府管理約旦河西岸的部分地區。',
    en: 'State of Palestine: a UN observer state recognised by most UN members but not by Israel and some others; the Palestinian Authority administers parts of the West Bank.',
  },
  ESH: {
    zh: '西撒哈拉：主權有爭議。摩洛哥控制大部分地區並主張主權；撒拉威阿拉伯民主共和國（波利薩里奧陣線）也主張主權，控制東部。聯合國把它列為非自治領土。這裡不列首都、元首與政體。',
    en: 'Western Sahara: sovereignty is disputed. Morocco controls most of the territory and claims it; the Sahrawi Arab Democratic Republic (Polisario Front) also claims it and controls the east. The UN lists it as a non-self-governing territory. No capital, head of state or system of government is listed here.',
  },
  _SOL: {
    zh: '索馬利蘭：1991 年自行宣布獨立，有自己的政府；國際上一般視為索馬利亞的一部分。',
    en: 'Somaliland: declared independence in 1991 and has its own government; generally regarded internationally as part of Somalia.',
  },
  _CYN: {
    zh: '北賽普勒斯：1983 年宣布獨立，只有土耳其承認；國際上一般視為賽普勒斯的一部分。',
    en: 'Northern Cyprus: declared independence in 1983 and is recognised only by Türkiye; generally regarded internationally as part of Cyprus.',
  },
  FLK: { zh: '阿根廷也主張主權（馬爾維納斯群島）。', en: 'Argentina also claims sovereignty (as the Malvinas).' },
  SGS: { zh: '阿根廷也主張主權。', en: 'Argentina also claims sovereignty.' },
  GIB: { zh: '西班牙也主張主權。', en: 'Spain also claims sovereignty.' },
  IOT: {
    zh: '模里西斯主張主權（查哥斯群島）；英國與模里西斯 2025 年簽約，同意移交主權並租回迪亞哥加西亞島。',
    en: 'Mauritius claims sovereignty (the Chagos Archipelago); in 2025 the UK and Mauritius signed a treaty to transfer sovereignty, with the UK leasing back Diego Garcia.',
  },
  ATA: {
    zh: '南極洲：依《南極條約》，各國的領土主張凍結，沒有政府。',
    en: 'Antarctica: territorial claims are frozen under the Antarctic Treaty; there is no government.',
  },
  _SIA: {
    zh: '錫亞琴冰川：印度與巴基斯坦都主張主權的冰川地區（印度實際控制）。',
    en: 'Siachen Glacier: claimed by both India and Pakistan (controlled by India).',
  },
};

/** 首都的補充說明（首都有爭議、或首都與政府所在地不同） */
export const CAPITAL_NOTES: Record<string, Text> = {
  ISR: {
    zh: '以色列定耶路撒冷為首都；國際上對耶路撒冷的地位有爭議（聯合國安理會第 478 號決議等），多數國家的大使館設在特拉維夫一帶。',
    en: 'Israel designates Jerusalem as its capital; its status is disputed internationally (UN Security Council Resolution 478 and others), and most embassies are in the Tel Aviv area.',
  },
  PSE: {
    zh: '巴勒斯坦宣告東耶路撒冷為首都，東耶路撒冷由以色列控制；巴勒斯坦自治政府設在拉馬拉。',
    en: 'Palestine proclaims East Jerusalem as its capital, which is controlled by Israel; the Palestinian Authority is based in Ramallah.',
  },
  YEM: {
    zh: '憲法上的首都沙那 2014 年起由胡塞運動控制，國際承認的政府以亞丁為臨時首都。',
    en: 'The constitutional capital, Sanaa, has been held by the Houthis since 2014; the internationally recognised government uses Aden as its temporary capital.',
  },
  BOL: {
    zh: '憲法規定的首都是蘇克雷（最高法院所在地），總統府與國會在拉巴斯。',
    en: 'The constitutional capital is Sucre (seat of the Supreme Court); the presidency and legislature are in La Paz.',
  },
  NLD: {
    zh: '憲法規定的首都是阿姆斯特丹，國會、政府與國王的辦公處在海牙。',
    en: 'The constitutional capital is Amsterdam; parliament, government and the king’s office are in The Hague.',
  },
  CIV: {
    zh: '法定首都是雅穆索戈（1983 年起），多數政府機關仍在阿必尚。',
    en: 'Yamoussoukro has been the official capital since 1983, but most government offices remain in Abidjan.',
  },
  MYS: { zh: '吉隆坡是首都，聯邦政府的行政中心在布城。', en: 'Kuala Lumpur is the capital; the federal government is based in Putrajaya.' },
  CHL: { zh: '國會設在瓦爾帕萊索。', en: 'Congress sits in Valparaíso.' },
  CHE: {
    zh: '瑞士憲法沒有規定首都，伯恩是聯邦政府所在的「聯邦城市」。',
    en: 'The Swiss constitution names no capital; Bern is the “federal city” where the federal government sits.',
  },
  NRU: { zh: '諾魯沒有法定首都，政府機關在亞倫區。', en: 'Nauru has no official capital; government offices are in Yaren District.' },
  MSR: {
    zh: '原本的首府普利茅斯 1997 年起因火山爆發廢棄，政府改設在布萊茲。',
    en: 'The original capital, Plymouth, has been abandoned since the 1997 volcanic eruptions; the government operates from Brades.',
  },
};

/** 首都的角色（pipeline 的 CAPITAL_ROLES） */
export const CAPITAL_ROLES: Record<string, Text> = {
  exec: { zh: '行政首都', en: 'executive capital' },
  leg: { zh: '立法首都', en: 'legislative capital' },
  jud: { zh: '司法首都', en: 'judicial capital' },
  seat: { zh: '政府所在地', en: 'seat of government' },
  admin: { zh: '聯邦行政中心', en: 'federal administrative centre' },
  dejure: { zh: '法定首都', en: 'de jure capital' },
  claimed: { zh: '宣告的首都', en: 'proclaimed capital' },
  defacto: { zh: '實際的政府所在地', en: 'de facto seat of government' },
  unofficial: { zh: '非正式', en: 'unofficial' },
};

const categoryLabel = (list: CategoryDef[], v: number, other?: Text) =>
  tr(list.find((c) => c.value === v)?.label ?? other ?? '');

const countText = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'country' : 'countries'}` });

/** 首都的點：tooltip 寫首都名稱、國家與角色 */
function capitalTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '';
  const role = typeof p.role === 'string' && CAPITAL_ROLES[p.role] ? tr(CAPITAL_ROLES[p.role]) : '';
  const disputed = p.d ? tr({ zh: '地位有爭議', en: 'status disputed' }) : '';
  const detail = [country, role, disputed].filter(Boolean).join(' · ');
  if (getLang() === 'en') return { title: String(p.en ?? p.zh ?? ''), detail };
  const zh = String(p.zh ?? '');
  const en = String(p.en ?? '');
  return { title: zh, detail, properNoun: en && en !== zh ? en : undefined };
}

export const profiles: TopicDefinition = {
  id: 'profiles',
  title: { zh: '國家小檔案（首都、元首、政體、貨幣、鄰國）', en: 'Country profiles' },
  shortTitle: { zh: '國家小檔案', en: 'Country facts' },
  defaultIndicator: 'government',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Wikidata（首都、元首與政府首長、貨幣、區號、網域、ISO 代碼、國歌、成立時間）', en: 'Wikidata (capitals, heads of state and government, currencies, calling codes, domains, ISO codes, anthems, inception)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: 'Natural Earth 1:50m 國界（鄰國數、內陸國，自行計算）', en: 'Natural Earth 1:50m boundaries (neighbours and landlocked status, computed here)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'FAOSTAT 土地利用（陸地面積）', en: 'FAOSTAT Land Use (land area)' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
    { name: { zh: 'UN WPP 2024（人口）', en: 'UN World Population Prospects 2024 (population)' }, url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: {
    zh: '政體形式是各國憲法（或過渡時期的憲政文件）規定的形式：元首怎麼產生、政府對誰負責，不代表民主程度，民主程度請看「民主與自由」主題（V-Dem 的評分）。Wikidata 的政體欄位很不一致，這裡依憲法逐國歸類，跟 Wikidata 不同的國家在資料管線裡寫了理由。元首與政府首長取自 Wikidata（國家那一邊的陳述，跟擔任職務那一邊的現任者比對，取比較新的），會隨選舉與政變改變，側欄寫出資料日期。鄰國數用地圖本身的國界（Natural Earth 1:50m，依實際控制線劃分）計算，屬地的陸地國界算進主權國。爭議地區照事實陳述各方的主張，地圖上的名稱與國界不代表任何政治立場。',
    en: 'System of government is the form set out in each constitution (or transitional constitutional document): how the head of state is chosen and to whom the government answers. It is not a measure of democracy; see the Democracy topic (V-Dem scores) for that. Wikidata’s field is inconsistent, so countries are classified here one by one from their constitutions, with the reasons for any difference from Wikidata recorded in the data pipeline. Heads of state and government come from Wikidata (the country’s statements compared with the current holders of each office, taking the more recent); they change with elections and coups, so the side panel shows the data date. Neighbour counts use the map’s own boundaries (Natural Earth 1:50m, which follow lines of actual control), with a territory’s land borders counted for its sovereign state. For disputed areas the claims of each side are stated as facts; names and borders on the map do not imply any political position.',
  },
  noValue: {
    ESH: { zh: '主權有爭議，不列政體', en: 'Sovereignty disputed; not classified' },
    ATA: { zh: '南極條約：沒有政府', en: 'Antarctic Treaty: no government' },
    _SIA: { zh: '印度與巴基斯坦的爭議地區', en: 'Disputed between India and Pakistan' },
  },
  panelExtra: () => import('./panels/ProfilesPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'capitals',
      file: 'capitals.json',
      label: { zh: '首都', en: 'Capitals' },
      // 底圖本身已經有首都的點與名稱，疊上去會重複，預設關閉；打開才看得到政府所在地、行政與立法首都的角色
      hidden: true,
      radius: 2.6,
      color: MAP_TOKENS.ink,
      tooltip: capitalTooltip,
    },
  ],
  indicators: [
    {
      id: 'government',
      label: { zh: '政體形式', en: 'System of government' },
      description: {
        zh: '憲法規定的形式：元首是總統還是君主、怎麼產生，政府對總統還是對國會負責。這是制度的形式，不是民主程度：同樣是總統制或議會制，可以是民主國家，也可以是專制國家（見「民主與自由」主題）。總統由國會選出、兼任政府首長的（南非、波札那等）算議會制共和國。',
        en: 'The form set out in the constitution: whether the head of state is a president or a monarch and how they are chosen, and whether the government answers to the president or to parliament. This is formal structure, not a measure of democracy: presidential and parliamentary systems can be democratic or autocratic (see the Democracy topic). Republics whose president is elected by parliament and heads the government (South Africa, Botswana and others) count as parliamentary.',
      },
      unit: '',
      file: 'government.json',
      layer: { kind: 'categorical', categories: GOVERNMENT, other: TERRITORY },
      format: (v) => categoryLabel(GOVERNMENT, v, TERRITORY),
    },
    {
      id: 'currency',
      label: { zh: '貨幣', en: 'Currency' },
      description: {
        zh: '法定貨幣：用歐元、美元、非洲法郎的國家，其他跟別的國家或地區共用的貨幣（澳洲元、瑞士法郎、南非蘭特、紐西蘭元、東加勒比元、印度盧比等），和自己的貨幣。滑過地圖可以看貨幣名稱與 ISO 4217 代碼。',
        en: 'Legal tender: countries using the euro, the US dollar or the CFA franc, other currencies shared with other countries or territories (Australian dollar, Swiss franc, South African rand, New Zealand dollar, East Caribbean dollar, Indian rupee and others), and own currencies. Hover to see the currency names and ISO 4217 codes.',
      },
      unit: '',
      file: 'currency.json',
      layer: { kind: 'categorical', categories: CURRENCY, other: OWN_CURRENCY },
      format: (v) => categoryLabel(CURRENCY, v, OWN_CURRENCY),
    },
    {
      id: 'neighbours',
      label: { zh: '陸地鄰國數', en: 'Land neighbours' },
      description: {
        zh: '有陸地國界相接的國家或地區數，用地圖本身的國界計算（不含只有海上相鄰的）。屬地的陸地國界算進主權國（法國經由法屬圭亞那跟巴西相接），中國不算港澳；1:50m 地圖畫不出來的休達與美利雅、直布羅陀、漢斯島、賽普勒斯的英國基地另外補上。地位有爭議的地區依地圖的劃分算一個。',
        en: 'Number of countries or territories sharing a land border, computed from the map’s own boundaries (maritime neighbours are not counted). A territory’s land borders count for its sovereign state (France borders Brazil through French Guiana), and China’s count excludes Hong Kong and Macao; borders too small for the 1:50m map (Ceuta and Melilla, Gibraltar, Hans Island, the British bases on Cyprus) are added. Disputed areas count as drawn on the map.',
      },
      unit: { zh: '個', en: 'countries' },
      file: 'neighbours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5, 7, 10] } },
      format: countText,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'landlocked',
      label: { zh: '內陸國', en: 'Landlocked' },
      description: {
        zh: '沒有海岸線的國家（裏海不算海，所以哈薩克、土庫曼、亞塞拜然是內陸國）。雙重內陸國是鄰國也都是內陸國，要經過兩個國家才到得了海：列支敦斯登與烏茲別克。',
        en: 'Countries without a coastline (the Caspian does not count as sea, so Kazakhstan, Turkmenistan and Azerbaijan are landlocked). Doubly landlocked countries are surrounded only by landlocked countries, so reaching the sea means crossing two borders: Liechtenstein and Uzbekistan.',
      },
      unit: '',
      file: 'landlocked.json',
      layer: { kind: 'categorical', categories: LANDLOCKED, ordinal: true },
      format: (v) => categoryLabel(LANDLOCKED, v),
    },
  ],
};
