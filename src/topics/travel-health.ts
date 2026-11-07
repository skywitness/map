import { tr } from '../i18n/lang';
import type { CategoryDef, IndicatorDef } from './types';
import type { TopicPart } from './parts';

/**
 * 旅行實用的擴充：入境的健康規定（2026-11-07，製作手冊第二十四批 434；pipeline/topics/travel_health.py）。
 * WHO《International Travel and Health》Country list 2021（PDF 剖析）的黃熱病入境規定、WHO 的疫苗建議、瘧疾預防型別，
 * 每一國的英文原文在側欄的附註；台灣不在 WHO 的名單上，台灣的角度用疾管署的國際旅遊處方箋（建議等級、瘧疾預防用藥）。
 * 類別代碼跟 pipeline 的 YF_*、REC_*、MAL_*、CDC_LEVEL 一致；有序類別圖的第一類最深。
 */

const labelOf = (categories: CategoryDef[]) => (v: number) => tr(categories.find((c) => c.value === v)?.label ?? '');

const YF_ENTRY: CategoryDef[] = [
  { value: 3, label: { zh: '所有旅客都要', en: 'Required for all travellers' } },
  { value: 2, label: { zh: '來自疫區（或在疫區轉機）的旅客要', en: 'Required if arriving from (or transiting) a risk country' } },
  { value: 1, label: { zh: '不需要', en: 'Not required' } },
];
const YF_WHO: CategoryDef[] = [
  { value: 5, label: { zh: '建議（9 個月以上都打）', en: 'Recommended (everyone aged 9 months or over)' } },
  { value: 4, label: { zh: '建議，部分地區除外', en: 'Recommended, except some areas' } },
  { value: 3, label: { zh: '只建議去部分地區的人打', en: 'Recommended only for some areas' } },
  { value: 2, label: { zh: '一般不建議', en: 'Generally not recommended' } },
  { value: 1, label: { zh: '不建議', en: 'Not recommended' } },
];
const MALARIA: CategoryDef[] = [
  { value: 6, label: { zh: 'C：防蚊加預防藥（惡性瘧）', en: 'C: bite prevention plus chemoprophylaxis (P. falciparum)' } },
  { value: 5, label: { zh: '依地區不同（B 或 C、A 或 C）', en: 'Varies by area (B or C, A or C)' } },
  { value: 4, label: { zh: 'B：防蚊加預防藥（非惡性瘧）', en: 'B: bite prevention plus chemoprophylaxis (non-falciparum)' } },
  { value: 3, label: { zh: 'A：只要防蚊', en: 'A: mosquito-bite prevention only' } },
  { value: 7, label: { zh: '風險極低，不必特別預防', en: 'Very limited risk, no prevention needed' } },
  { value: 2, label: { zh: '近年認證無瘧疾', en: 'Recently certified malaria-free' } },
  { value: 1, label: { zh: 'WHO 沒有列瘧疾風險', en: 'No malaria risk listed' }, color: '#a9a69c' },
];
const CDC_LEVELS: CategoryDef[] = [
  { value: 3, label: { zh: '第三級：警告（避免非必要旅遊）', en: 'Level 3: Warning (avoid non-essential travel)' } },
  { value: 2, label: { zh: '第二級：警示（加強防護）', en: 'Level 2: Alert (enhanced precautions)' } },
  { value: 1, label: { zh: '第一級：注意（一般預防）', en: 'Level 1: Watch (usual precautions)' } },
];
const CDC_DRUG: CategoryDef[] = [{ value: 1, label: { zh: '處方箋列了瘧疾預防用藥', en: 'Malaria prophylaxis listed' } }];

const WHO_SOURCE = {
  name: {
    zh: 'WHO《International Travel and Health》Country list（2021-05-12）',
    en: 'WHO, International Travel and Health: Country list (12 May 2021)',
  },
  url: 'https://cdn.who.int/media/docs/default-source/documents/emergencies/travel-advice/ith2021_countrylist.pdf',
  license: {
    zh: 'CC BY-NC-SA 3.0 IGO（只准非商業使用；黃熱病與瘧疾的資料檔同樣用這個授權分享）',
    en: 'CC BY-NC-SA 3.0 IGO (non-commercial only; the yellow fever and malaria data files are shared under the same licence)',
  },
};
const CDC_SOURCE = {
  name: { zh: '衛生福利部疾病管制署「國際旅遊處方箋網頁內容」（2026-10-21）', en: 'Taiwan CDC, travel medicine prescription web content (21 Oct 2026)' },
  url: 'https://data.gov.tw/dataset/42781',
  license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
};

const common = {
  unit: '',
  unranked: true,
  rankingBars: false,
  panelChart: false,
} satisfies Partial<IndicatorDef>;

export const travelHealthPart: TopicPart = {
  name: { zh: '入境的健康規定', en: 'Health entry requirements' },
  sources: [WHO_SOURCE, CDC_SOURCE],
  note: {
    zh: '入境的健康規定跟簽證是兩回事：持免簽護照，沒有黃熱病疫苗證明（俗稱「黃皮書」）一樣可能被拒絕入境或隔離。黃熱病與瘧疾取自 WHO《International Travel and Health》2021 年 5 月的國家清單，各國條目標的年份從 2013 年以前到 2021 年不等，WHO 自己也寫「各國的規定隨時會改」，出發前請向該國使領館確認。「來自疫區」的定義逐國不同（年齡門檻 9 個月或 1 歲、轉機算不算、轉機幾小時以上算），滑過看摘要，點國家看英文原文（沒有逐條中譯）；「X 見 Y」的屬地（例如美屬薩摩亞）不套用 Y 的規定，沒有上色。瘧疾的 A、B、C 是 WHO 建議的預防方式、不是風險高低，而且只適用於有風險的地區，不是全國。台灣不在 WHO 的名單上；疾管署的國際旅遊疫情建議等級與處方箋是台灣的角度，跟外交部的旅遊警示（「旅遊警示」主題）是不同的兩套。各國國民自己的疫苗接種率見「疫苗與防疫」。',
    en: 'Health entry rules are separate from visas: even with visa-free entry, travellers without a yellow fever certificate can be refused entry or quarantined. Yellow fever and malaria come from WHO’s International Travel and Health country list of May 2021; individual entries date from before 2013 to 2021, and WHO itself says country requirements can change at any time, so check with the embassy before travelling. What counts as coming from a risk country varies (age limits of 9 months or 1 year, whether transit counts and for how long): hover for a summary and select a country for the original English text. Territories listed as “see” another country (such as American Samoa) are not given that country’s rules and are not coloured. Malaria types A, B and C are WHO’s recommended prevention, not levels of risk, and apply only to risk areas, not the whole country. Taiwan is not in WHO’s list; Taiwan CDC’s travel health notices and prescriptions give Taiwan’s view, separate from the foreign ministry’s travel warnings (see the Travel advisories topic). For vaccination coverage among each country’s own people, see Vaccination.',
  },
  indicators: [
    {
      ...common,
      id: 'yellow-fever-entry',
      label: { zh: '入境要黃熱病疫苗證明嗎', en: 'Yellow fever certificate at entry' },
      description: {
        zh: 'WHO 2021 年清單上 217 個國家或地區，入境要不要黃熱病疫苗證明：20 個所有旅客都要（19 個在非洲，例如安哥拉、迦納、剛果民主共和國、烏干達，另一個是法屬圭亞那；多半是 9 個月或 1 歲以上），103 個只要求來自有黃熱病傳播風險國家的旅客（阿爾巴尼亞 1 歲以上；阿爾及利亞 9 個月以上，在疫區機場轉機超過 12 小時也算；印度沒有證明的人會被隔離最多 6 天），94 個不需要（日本、美國、阿富汗）。黃熱病是《國際衛生條例》下唯一可以要求旅客出示疫苗證明的疾病，2016 年 7 月起一劑終身有效。',
        en: 'Whether 217 countries and territories in WHO’s 2021 list require a yellow fever vaccination certificate at entry: 20 require it of all travellers (19 in Africa, such as Angola, Ghana, the Democratic Republic of the Congo and Uganda, plus French Guiana; mostly from age 9 months or 1 year), 103 only of travellers arriving from countries with risk of transmission (Albania from age 1; Algeria from 9 months, including transit of more than 12 hours at an airport in a risk country; India may detain travellers without one for up to 6 days), and 94 do not require it (Japan, the United States, Afghanistan). Yellow fever is the only disease for which proof of vaccination can be required under the International Health Regulations; since July 2016 one dose is valid for life.',
      },
      file: 'yellow-fever-entry.json',
      layer: { kind: 'categorical', categories: YF_ENTRY, ordinal: true },
      format: labelOf(YF_ENTRY),
      missing: { zh: '不在 WHO 的清單上（或寫「見」另一國）', en: 'Not in WHO’s list (or listed as “see” another country)' },
    },
    {
      ...common,
      id: 'yellow-fever-who',
      label: { zh: 'WHO 建議打黃熱病疫苗嗎', en: 'WHO yellow fever vaccine advice' },
      description: {
        zh: 'WHO 建議旅客打不打黃熱病疫苗（依這國有沒有傳播風險），跟上一張圖的入境規定不一定同步：阿爾巴尼亞法規要證明、WHO 不建議打；巴西入境不需要，但 WHO 建議去大部分地區的人打。25 個建議 9 個月以上的旅客都打（安哥拉、奈及利亞、蓋亞那），7 個建議但部分地區除外（哥倫比亞的波哥大、巴拿馬運河區），10 個只建議去部分地區的人打（阿根廷東北的兩省、巴西、秘魯的亞馬遜地區），6 個一般不建議（坦尚尼亞、盧安達），170 個不建議。',
        en: 'Whether WHO recommends yellow fever vaccination for travellers (based on whether there is risk of transmission), which does not always match the entry rule: Albania requires a certificate but WHO does not recommend the vaccine there, while Brazil requires none but WHO recommends it for most areas. 25 are recommended for everyone aged 9 months or over (Angola, Nigeria, Guyana), 7 recommended except some areas (Bogotá in Colombia, Panama’s canal area), 10 only for some areas (two provinces in north-eastern Argentina, Brazil, the Amazon regions of Peru), 6 generally not recommended (Tanzania, Rwanda) and 170 not recommended.',
      },
      file: 'yellow-fever-who.json',
      layer: { kind: 'categorical', categories: YF_WHO, ordinal: true },
      format: labelOf(YF_WHO),
      missing: { zh: '不在 WHO 的清單上（或寫「見」另一國）', en: 'Not in WHO’s list (or listed as “see” another country)' },
    },
    {
      ...common,
      id: 'malaria-prevention',
      label: { zh: '瘧疾怎麼預防（WHO）', en: 'Malaria prevention (WHO)' },
      description: {
        zh: 'WHO 建議去瘧疾風險區的旅客怎麼預防：71 個國家或地區是 C（惡性瘧，防蚊加 atovaquone-proguanil、doxycycline 或 mefloquine 等預防藥，非洲大部分、阿富汗、印度、印尼），8 個依地區不同（巴西是間日瘧區 B、惡性瘧區 C；秘魯是間日瘧區 B、洛雷托大區 C；泰國大部分 A、柬埔寨與緬甸邊界 C），3 個是 B（玻利維亞、汶萊、瓜地馬拉），13 個只要防蚊（中國、南韓、北韓、墨西哥、菲律賓），5 個風險極低、WHO 寫不必預防（埃及、土耳其），阿根廷、阿爾及利亞、巴拉圭 2018–2019 年認證無瘧疾。這是預防方式、不是風險高低，而且只適用於風險區（阿富汗是 5 到 11 月、海拔 2000 公尺以下），點國家看 WHO 的範圍描述。',
        en: 'How WHO recommends travellers to malaria risk areas protect themselves: 71 countries and territories are type C (P. falciparum; bite prevention plus atovaquone-proguanil, doxycycline or mefloquine — most of Africa, Afghanistan, India, Indonesia), 8 vary by area (Brazil is B in P. vivax areas and C in P. falciparum areas; Peru is B in P. vivax areas and C in Loreto; Thailand is mostly A but C near the Cambodian and Myanmar borders), 3 are B (Bolivia, Brunei, Guatemala), 13 need bite prevention only (China, both Koreas, Mexico, the Philippines), 5 have very limited risk with no prevention advised (Egypt, Türkiye), and Argentina, Algeria and Paraguay were certified malaria-free in 2018–2019. These are prevention types, not risk levels, and apply only to risk areas (in Afghanistan, May to November below 2,000 m); select a country for WHO’s description.',
      },
      file: 'malaria-prevention.json',
      layer: { kind: 'categorical', categories: MALARIA, ordinal: true },
      format: labelOf(MALARIA),
      missing: { zh: '不在 WHO 的清單上（或寫「見」另一國）', en: 'Not in WHO’s list (or listed as “see” another country)' },
    },
    {
      ...common,
      id: 'cdc-epidemic-level',
      label: { zh: '疾管署的旅遊疫情建議等級', en: 'Taiwan CDC travel health notice' },
      description: {
        zh: '衛福部疾管署「國際旅遊疫情建議等級」現在每個國家或地區最高的一級（任一疾病、任一地區），滑過看是哪些疾病：剛果民主共和國因伊波拉是第三級警告；29 個第二級警示（中國的新型 A 型流感、越南與古巴的登革熱、印度的屈公病與瘧疾、墨西哥的麻疹）；其餘都是第一級注意：處方箋的 246 個國家或地區都列了新冠併發重症第一級（日期都是 2023 年 11 月 1 日）。這是疾病風險的提醒，跟外交部的旅遊警示是兩套。',
        en: 'The highest current level of Taiwan CDC’s international travel health notices for each country or territory (any disease, any area); hover for the diseases. The Democratic Republic of the Congo is at Level 3 Warning for Ebola; 29 are at Level 2 Alert (avian influenza in China, dengue in Vietnam and Cuba, chikungunya and malaria in India, measles in Mexico); all the rest are at Level 1 Watch: every one of the 246 countries and territories in the prescriptions lists severe COVID-19 at Level 1 (all dated 1 November 2023). These are disease notices, separate from the foreign ministry’s travel warnings.',
      },
      file: 'cdc-epidemic-level.json',
      layer: { kind: 'categorical', categories: CDC_LEVELS, ordinal: true },
      format: labelOf(CDC_LEVELS),
      missing: { zh: '疾管署沒有這個國家或地區的建議等級', en: 'No Taiwan CDC notice for this country' },
    },
    {
      ...common,
      id: 'cdc-malaria-drug',
      label: { zh: '疾管署建議帶瘧疾預防藥', en: 'Taiwan CDC: malaria prophylaxis' },
      description: {
        zh: '疾管署國際旅遊處方箋的「預防接種規定及建議」列了「瘧疾預防用藥」的 110 個國家或地區（開放資料只有項目名稱，沒有藥名、地區與季節）。跟 WHO 2021 年的清單不完全一致：阿根廷、阿爾及利亞、巴拉圭在 WHO 寫已認證無瘧疾，俄羅斯、新加坡、斯里蘭卡、賽普勒斯、吉爾吉斯、烏茲別克 WHO 沒有列瘧疾風險，處方箋仍列了預防用藥；WHO 列 C 型的國家則全都有列。',
        en: 'The 110 countries and territories whose Taiwan CDC travel prescription lists malaria prophylaxis under vaccination requirements and recommendations (the open data give only the item name, not the drug, area or season). This does not fully match WHO’s 2021 list: Argentina, Algeria and Paraguay are certified malaria-free by WHO, and WHO lists no malaria risk for Russia, Singapore, Sri Lanka, Cyprus, Kyrgyzstan or Uzbekistan, yet their prescriptions still list prophylaxis; every country WHO lists as type C is included.',
      },
      file: 'cdc-malaria-drug.json',
      layer: { kind: 'categorical', categories: CDC_DRUG },
      format: labelOf(CDC_DRUG),
      missing: { zh: '處方箋沒有列瘧疾預防用藥', en: 'No malaria prophylaxis listed' },
    },
  ],
};
