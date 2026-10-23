import { tr, type Text } from '../i18n/lang';
import { countryName, type CountryTable } from '../lib/countries';
import { fixed } from '../lib/format';
import type { CategoryDef, DimensionDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 護照與簽證（pipeline/topics/passport.py）：Passport Index 的 199 本護照到 199 個目的地的簽證待遇，2026-02-17 的快照。
 * 子項目是護照（ISO alpha-3），followsSelection：點地圖、排名表或搜尋選到國家時，地圖改畫那本護照。
 */

/**
 * 類別代碼（sources/passport_index.py）：1–5 跟台灣的外交主題的 VISA 一樣（側欄直接拿來跟領事事務局的名單比對），
 * 6 不准入境、7 另用通行證（兩岸、港澳，歸到「其他」）。
 * 地圖用發散色，從最難到最容易：不准入境、需事先申請、電子簽證是橘色（出發前要先拿到核准），
 * 落地簽證、需旅行授權的免簽證、免簽證是青綠（出發前不必等核准，也就是算進「護照實力」的三類）。
 * 6 類剛好一邊 3 類，沒有中間的中性色。
 */
export const PASSPORT_VISA: CategoryDef[] = [
  { value: 6, label: { zh: '不准入境', en: 'No admission' } },
  { value: 5, label: { zh: '需事先申請簽證', en: 'Visa required in advance' } },
  { value: 4, label: { zh: '電子簽證', en: 'E-visa' } },
  { value: 3, label: { zh: '落地簽證', en: 'Visa on arrival' } },
  { value: 2, label: { zh: '免簽證（需旅行授權）', en: 'Visa-free with eTA' } },
  { value: 1, label: { zh: '免簽證', en: 'Visa-free' } },
];
export const PERMIT: Text = { zh: '另用通行證（兩岸、港澳）', en: 'Travel permit (cross-strait, HK, Macao)' };
/** 護照實力、開放程度算進去的類別（出發前不必等核准） */
export const EASY = new Set([1, 2, 3]);
export const DATA_DATE = '2026-02-17';

const visaLabel = (v: number) => tr(PASSPORT_VISA.find((c) => c.value === v)?.label ?? PERMIT);

/**
 * 護照（Passport Index 的 199 本）依地區分組，「ISO3:ISO2」：ISO2 給 Intl.DisplayNames 查國名（跟 lib/countries 同一套），
 * 不必把 199 個中英文國名寫進首頁的 bundle。地區大致依聯合國 M49（賽普勒斯放歐洲）。
 * pipeline/topics/passport.py 會檢查這張表跟資料一致。
 */
const REGIONS: [Text, string][] = [
  [{ zh: '東亞', en: 'East Asia' }, 'CHN:CN HKG:HK JPN:JP KOR:KR MAC:MO MNG:MN PRK:KP TWN:TW'],
  [{ zh: '東南亞', en: 'Southeast Asia' }, 'BRN:BN IDN:ID KHM:KH LAO:LA MMR:MM MYS:MY PHL:PH SGP:SG THA:TH TLS:TL VNM:VN'],
  [
    { zh: '南亞與中亞', en: 'South and Central Asia' },
    'AFG:AF BGD:BD BTN:BT IND:IN IRN:IR KAZ:KZ KGZ:KG LKA:LK MDV:MV NPL:NP PAK:PK TJK:TJ TKM:TM UZB:UZ',
  ],
  [
    { zh: '西亞', en: 'West Asia' },
    'ARE:AE ARM:AM AZE:AZ BHR:BH GEO:GE IRQ:IQ ISR:IL JOR:JO KWT:KW LBN:LB OMN:OM PSE:PS QAT:QA SAU:SA SYR:SY TUR:TR YEM:YE',
  ],
  [
    { zh: '歐洲', en: 'Europe' },
    'ALB:AL AND:AD AUT:AT BEL:BE BGR:BG BIH:BA BLR:BY CHE:CH CYP:CY CZE:CZ DEU:DE DNK:DK ESP:ES EST:EE FIN:FI FRA:FR ' +
      'GBR:GB GRC:GR HRV:HR HUN:HU IRL:IE ISL:IS ITA:IT LIE:LI LTU:LT LUX:LU LVA:LV MCO:MC MDA:MD MKD:MK MLT:MT MNE:ME ' +
      'NLD:NL NOR:NO POL:PL PRT:PT ROU:RO RUS:RU SMR:SM SRB:RS SVK:SK SVN:SI SWE:SE UKR:UA VAT:VA XKX:XK',
  ],
  [
    { zh: '非洲', en: 'Africa' },
    'AGO:AO BDI:BI BEN:BJ BFA:BF BWA:BW CAF:CF CIV:CI CMR:CM COD:CD COG:CG COM:KM CPV:CV DJI:DJ DZA:DZ EGY:EG ERI:ER ' +
      'ETH:ET GAB:GA GHA:GH GIN:GN GMB:GM GNB:GW GNQ:GQ KEN:KE LBR:LR LBY:LY LSO:LS MAR:MA MDG:MG MLI:ML MOZ:MZ MRT:MR ' +
      'MUS:MU MWI:MW NAM:NA NER:NE NGA:NG RWA:RW SDN:SD SEN:SN SLE:SL SOM:SO SSD:SS STP:ST SWZ:SZ SYC:SC TCD:TD TGO:TG ' +
      'TUN:TN TZA:TZ UGA:UG ZAF:ZA ZMB:ZM ZWE:ZW',
  ],
  [
    { zh: '北美洲、中美洲與加勒比海', en: 'North and Central America, Caribbean' },
    'ATG:AG BHS:BS BLZ:BZ BRB:BB CAN:CA CRI:CR CUB:CU DMA:DM DOM:DO GRD:GD GTM:GT HND:HN HTI:HT JAM:JM KNA:KN LCA:LC ' +
      'MEX:MX NIC:NI PAN:PA SLV:SV TTO:TT USA:US VCT:VC',
  ],
  [{ zh: '南美洲', en: 'South America' }, 'ARG:AR BOL:BO BRA:BR CHL:CL COL:CO ECU:EC GUY:GY PER:PE PRY:PY SUR:SR URY:UY VEN:VE'],
  [{ zh: '大洋洲', en: 'Oceania' }, 'AUS:AU FJI:FJ FSM:FM KIR:KI MHL:MH NRU:NR NZL:NZ PLW:PW PNG:PG SLB:SB TON:TO TUV:TV VUT:VU WSM:WS'],
];

/** 地圖上有形狀、但 Passport Index 沒有收的地方（沒有自己護照的屬地、索馬利蘭、北賽普勒斯等），pipeline 會檢查 */
const NOT_COVERED = 'ABW AIA ALA ASM ATA ATF BLM BMU COK CUW CYM ESH FLK FRO GGY GRL GUM HMD IMN IOT JEY MAF MNP MSR NCL NFK NIU PCN PRI PYF SGS SHN SPM SXM TCA VGB VIR WLF _CYN _IOT _SIA _SOL';
const NOT_COVERED_TEXT: Text = { zh: 'Passport Index 沒有收這個地方', en: 'Not covered by Passport Index' };

let options: DimensionDef['options'] | undefined;
/**
 * 護照選單：第一次打開這個主題時才查國名、排序（getter），其他主題的首頁不必做這些事。
 * 各地區裡依繁中國名排序（介面預設是中文）。
 */
function passportOptions(): DimensionDef['options'] {
  if (options) return options;
  const table: CountryTable = {};
  const groups = REGIONS.map(([group, list]) => {
    const ids = list.split(' ').map((pair) => {
      const [iso3, iso2] = pair.split(':');
      table[iso3] = { iso2, name: iso3 === 'XKX' ? 'Kosovo' : iso3 };
      return iso3;
    });
    return { group, ids };
  });
  const collator = new Intl.Collator('zh-TW');
  options = groups.flatMap(({ group, ids }) =>
    ids
      .map((id) => ({ id, label: { zh: countryName(id, table, 'zh'), en: countryName(id, table, 'en') }, group }))
      .sort((a, b) => collator.compare(a.label.zh, b.label.zh)),
  );
  return options;
}

const countFormat = (unit: Text, one: string) => (v: number) =>
  tr({ zh: `${fixed(v, 0)} ${tr(unit, 'zh')}`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? one : tr(unit, 'en')}` });

const POWER_UNIT: Text = { zh: '個目的地', en: 'destinations' };
const OPENNESS_UNIT: Text = { zh: '本護照', en: 'passports' };
/** 護照實力：最多 198；歐盟、日本、南韓、新加坡約 160，台灣 112，阿富汗 22 */
const POWER_SCALE: ScaleSpec = { type: 'sequential', thresholds: [50, 75, 100, 125, 150] };
/** 開放程度：最多 198（太平洋、非洲有不少對所有護照開放的） */
const OPENNESS_SCALE: ScaleSpec = { type: 'sequential', thresholds: [25, 50, 75, 100, 150, 190] };

export const passport: TopicDefinition = {
  id: 'passport',
  title: { zh: '護照與簽證', en: 'Passports and visas' },
  shortTitle: { zh: '護照與簽證', en: 'Passports' },
  defaultIndicator: 'visa',
  defaultYear: 2026,
  dimension: {
    label: { zh: '護照', en: 'Passport' },
    get options() {
      return passportOptions();
    },
    defaultOption: 'TWN',
    followsSelection: true,
    selfLabel: { zh: '本國護照', en: 'Own passport' },
  },
  sources: [
    {
      name: { zh: 'Passport Index 資料集（imorte/passport-index-data，2026-02-17）', en: 'Passport Index data (imorte/passport-index-data, 2026-02-17)' },
      url: 'https://github.com/imorte/passport-index-data',
      license: 'MIT',
    },
    {
      name: { zh: 'Passport Index（Arton Capital，資料集整理自這個網站）', en: 'Passport Index by Arton Capital (source of the dataset)' },
      url: 'https://www.passportindex.org/',
      license: { zh: '見網站', en: 'see website' },
    },
    {
      name: { zh: '領事事務局免簽證名單（台灣護照的比對）', en: 'BOCA visa list (Taiwan passport comparison)' },
      url: 'https://data.gov.tw/dataset/30749',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License 1.0' },
    },
  ],
  note: {
    zh: 'Passport Index 2026 年 2 月 17 日的資料（從 passportindex.org 整理），199 本護照、199 個目的地，沒有自己護照的屬地不收。兩岸與港澳之間用通行證入境，不照資料集的分類。各國規定時常變動，出發前請以各國公告為準。',
    en: 'Passport Index data as of 17 February 2026 (compiled from passportindex.org): 199 passports and 199 destinations; territories without their own passports are not covered. Travel between mainland China, Taiwan, Hong Kong and Macao uses travel permits and does not follow the dataset categories. Rules change often; check the destination’s announcements before travelling.',
  },
  noValue: Object.fromEntries(NOT_COVERED.split(' ').map((id) => [id, NOT_COVERED_TEXT])),
  panelExtra: () => import('./panels/PassportPanel'),
  indicators: [
    {
      id: 'visa',
      // 英文標題是「<護照> visa access」（Taiwan visa access）；原本的 Passport visa requirements 在 1280px 寬時控制列會換行
      label: { zh: '護照的簽證待遇', en: 'Visa access' },
      description: {
        zh: '持這本護照前往各國要不要簽證（2026 年 2 月）。點地圖或排名表裡的國家就換成那國的護照。青綠的出發前不必等核准，橘色要先拿到簽證；「需旅行授權」是要先上網申請 ESTA、eTA 這類授權。',
        en: 'Whether this passport needs a visa for each destination (February 2026); select a country to switch to its passport. Teal needs no approval before travel (“with eTA”: an online authorisation such as ESTA), orange needs a visa first.',
      },
      unit: '',
      file: 'visa/{item}.json',
      layer: { kind: 'categorical', categories: PASSPORT_VISA, other: PERMIT, diverging: true },
      format: visaLabel,
    },
    {
      id: 'power',
      label: { zh: '護照實力', en: 'Passport power' },
      description: {
        zh: '持這本護照可以免簽證、落地簽證或只要上網申請旅行授權就入境的目的地數（最多 198 個）。跟 Henley 護照指數一樣不算電子簽證；Passport Index 網站另外算進 3 天內核發的電子簽證，數字比較大。',
        en: 'Destinations this passport can enter visa-free, with a visa on arrival or with just an online travel authorisation (out of 198). As in the Henley Passport Index, e-visas are not counted; the Passport Index website also counts e-visas issued within 3 days, so its scores are higher.',
      },
      unit: POWER_UNIT,
      file: 'power.json',
      layer: { kind: 'choropleth', scale: POWER_SCALE },
      format: countFormat(POWER_UNIT, 'destination'),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'openness',
      label: { zh: '開放程度', en: 'Openness' },
      description: {
        zh: '有幾本護照（其他 198 本裡）可以免簽證、落地簽證，或只要旅行授權就能入境這個國家，是護照實力反過來看。',
        en: 'How many of the other 198 passports can enter this country visa-free, with a visa on arrival or with just a travel authorisation: passport power seen from the destination side.',
      },
      unit: OPENNESS_UNIT,
      file: 'openness.json',
      layer: { kind: 'choropleth', scale: OPENNESS_SCALE },
      format: countFormat(OPENNESS_UNIT, 'passport'),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
