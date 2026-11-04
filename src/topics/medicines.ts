import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, intlDollars } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 藥品支出與取得（2026-11-03，製作手冊第十九批 295、296、301；pipeline/topics/medicines.py）：
 * OECD 的藥費與學名藥、WHO 國家能力調查的口服嗎啡與胰島素、Persaud 等 2019 年的各國基本藥物清單。
 */

const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const pct = (v: number) => `${fixed(v, 1)}%`;

const AVAILABLE: CategoryDef[] = [
  { value: 1, label: { zh: '普遍拿得到', en: 'Generally available' } },
  { value: 0, label: { zh: '沒有普遍拿得到', en: 'Not generally available' } },
];
const availableLabel = (v: number) => tr(AVAILABLE.find((c) => c.value === v)?.label ?? { zh: '其他', en: 'Other' });

const SURVEY = {
  zh: '是各國衛生部自己回答的有或沒有，「普遍」的門檻由各國自己判斷，不是實際的用量。台灣不是 WHO 會員，不在調查裡，也沒有同樣問法的官方答案。',
  en: 'These are yes-or-no answers from each health ministry, which judges “generally” for itself; they are not actual consumption. Taiwan is not a WHO member, is not in the survey and has no official answer to the same question.',
};

/** 缺藥登錄（pipeline/topics/drug_shortages.py 的 YES、PARTIAL、NO） */
const SHORTAGE_REGISTER: CategoryDef[] = [
  { value: 1, label: { zh: '有線上缺藥登錄', en: 'Online shortage register' } },
  { value: 2, label: { zh: '只登錄部分藥品', en: 'Selected medicines only' } },
  { value: 3, label: { zh: '沒有線上登錄', en: 'No online register' } },
];

export const medicines: TopicDefinition = {
  id: 'medicines',
  title: { zh: '藥品支出與取得', en: 'Spending on and access to medicines' },
  shortTitle: { zh: '藥品支出', en: 'Medicines' },
  defaultIndicator: 'pharma-share',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'OECD Health Statistics：Health expenditure and financing（SHA，HC.5.1 藥品與其他醫療非耐久財）、Generic market（學名藥市場）',
        en: 'OECD Health Statistics: Health expenditure and financing (SHA, HC.5.1 pharmaceuticals and other medical non-durable goods) and Generic market',
      },
      url: 'https://data-explorer.oecd.org/',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: '衛生福利部統計處：國民醫療保健支出統計表（表1、表11，台灣的藥費）',
        en: 'Ministry of Health and Welfare (Taiwan): National Health Expenditure tables 1 and 11 (Taiwan’s pharmaceutical spending)',
      },
      url: 'https://dep.mohw.gov.tw/dos/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'IMF, World Economic Outlook（台灣的購買力平價）', en: 'IMF, World Economic Outlook (PPP rate for Taiwan)' },
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明出處', en: 'Attribution' },
    },
    {
      name: {
        zh: 'WHO, Noncommunicable Disease Country Capacity Survey（公立醫療體系的口服嗎啡與胰島素，GHO NCD_CCS_OralMorph、NCD_CCS_Insulin）',
        en: 'WHO, Noncommunicable Disease Country Capacity Survey (oral morphine and insulin in the public health system, GHO NCD_CCS_OralMorph and NCD_CCS_Insulin)',
      },
      url: 'https://www.who.int/data/gho/data/indicators',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Persaud N, et al. Comparison of essential medicines lists in 137 countries. Bull World Health Organ 2019;97:394–404C，表1',
        en: 'Persaud N, et al. Comparison of essential medicines lists in 137 countries. Bull World Health Organ 2019;97:394–404C, Table 1',
      },
      url: 'https://doi.org/10.2471/BLT.18.222448',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: 'openFDA drug/enforcement（美國 FDA 的藥品回收，2012 年起）', en: 'openFDA drug/enforcement (US FDA drug recalls, from 2012)' },
      url: 'https://open.fda.gov/apis/drug/enforcement/',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '食藥署「藥品回收」「未註銷藥品許可證」開放資料（台灣的附註）', en: 'Taiwan FDA open data: drug recalls and drug licences (Taiwan note)' },
      url: 'https://data.fda.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'EMA，Public information on medicine shortages（各國的缺藥登錄一覽）', en: 'EMA, Public information on medicine shortages (national registers)' },
      url: 'https://www.ema.europa.eu/en/human-regulatory-overview/post-authorisation/medicine-shortages-availability-issues/public-information-medicine-shortages',
      license: { zh: 'EMA 條款（可轉載，需註明 EMA）', en: 'EMA terms (reuse with acknowledgement of EMA)' },
    },
    {
      name: { zh: 'openFDA drug/shortages（美國 FDA 的缺藥資料庫）', en: 'openFDA drug/shortages (US FDA drug shortages)' },
      url: 'https://open.fda.gov/apis/drug/drugshortages/',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '食藥署開放資料：藥品供應通報（有替代、無替代、已解除）', en: 'Taiwan FDA open data: medicine supply reports (with/without alternatives, resolved)' },
      url: 'https://data.fda.gov.tw/',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '藥費是 OECD 的醫療支出帳（SHA）裡的「藥品與其他醫療非耐久財」（HC.5.1），也就是門診拿的處方藥與成藥；住院用的藥算在住院醫療裡，不在這裡。台灣不在 OECD 裡，用衛生福利部國民醫療保健支出統計（同樣的口徑），每人藥費再用 IMF 的購買力平價換算。學名藥只有十幾個 OECD 國家，台灣沒有同樣口徑的統計。止痛藥與胰島素、基本藥物清單都沒有台灣：台灣不是 WHO 會員，也沒有「國家基本藥物清單」（健保的給付清單性質不同）。依 OECD 的資料條款註明：OECD (2026), Health expenditure and financing、Generic market, OECD Data Explorer（2026-11-03 查閱）。',
    en: 'Pharmaceutical spending is “pharmaceuticals and other medical non-durable goods” (HC.5.1) in the OECD System of Health Accounts: prescription and over-the-counter medicines dispensed to outpatients; medicines used in hospital count as inpatient care. Taiwan is not in the OECD; its figures come from the Ministry of Health and Welfare’s National Health Expenditure statistics on the same basis, with per-capita amounts converted at the IMF’s PPP rate. Generic shares cover only a dozen or so OECD countries. Taiwan is not in the pain relief, insulin or essential medicines data: it is not a WHO member and has no national essential medicines list (its insurance reimbursement list is a different thing). Source per OECD terms: OECD (2026), Health expenditure and financing and Generic market, OECD Data Explorer (accessed 2026-11-03).',
  },
  indicators: [
    {
      id: 'pharma-share',
      label: { zh: '藥費占醫療支出', en: 'Medicines’ share of health spending' },
      description: {
        zh: '藥費（門診拿的處方藥與成藥）占經常性醫療支出的比例。2024 年保加利亞 28.8%、希臘 26.8%、匈牙利 22.9%、南韓 19.6%、台灣 16.3%、德國 14.0%、美國 11.8%、英國 9.1%、荷蘭 6.3%；2023 年喬治亞 40.5% 最高、日本 17.2%。醫療總支出低的國家，藥費的比例常常比較高；住院用的藥不算在這裡。',
        en: 'Spending on medicines dispensed to outpatients (prescription and over-the-counter) as a share of current health expenditure. In 2024: Bulgaria 28.8%, Greece 26.8%, Hungary 22.9%, South Korea 19.6%, Taiwan 16.3%, Germany 14.0%, the US 11.8%, the UK 9.1%, the Netherlands 6.3%; in 2023 Georgia was highest at 40.5% and Japan was at 17.2%. Countries with lower total health spending often have higher shares; medicines used in hospital are not included.',
      },
      unit: '%',
      file: 'pharma-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 12, 16, 20, 25] } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'pharma-per-capita',
      label: { zh: '每人藥費', en: 'Spending on medicines per person' },
      description: {
        zh: '每人一年花多少錢在藥上（購買力平價換算的國際元，當年價格）。2024 年美國 1,752、德國 1,338、瑞士 1,193、保加利亞 1,079、加拿大 1,053、南韓 1,000、台灣約 900、法國 851、英國 635、荷蘭 552；2023 年日本 1,026、泰國 51；2024 年印尼 27。',
        en: 'Spending on medicines per person per year (international dollars at purchasing power parity, current prices). In 2024: the US 1,752, Germany 1,338, Switzerland 1,193, Bulgaria 1,079, Canada 1,053, South Korea 1,000, Taiwan about 900, France 851, the UK 635, the Netherlands 552; in 2023 Japan 1,026 and Thailand 51; in 2024 Indonesia 27.',
      },
      unit: { zh: '國際元', en: 'Int$' },
      file: 'pharma-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [200, 400, 600, 800, 1000, 1300] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'generics',
      label: { zh: '學名藥的比例', en: 'Generics’ share' },
      description: {
        zh: '學名藥（專利過期後，別家藥廠做的同成分藥）占藥品市場的數量比例。加拿大 79.0%（2022 年）、拉脫維亞 76.0%（2023 年）、斯洛伐克 64.4%、捷克 62.6%、土耳其 59.2%、挪威 55.7%、葡萄牙 51.6%、日本 50.6%（2022 年）、義大利 28.4%、瑞士 24.6%。OECD 把藥品市場分成全部、健保給付、社區藥局、醫院四種，又分數量與金額，同一種算法只有十幾國；這裡用「全部市場的數量」。用金額算的比例低很多，因為學名藥便宜。',
        en: 'Generics (same-ingredient medicines made by other companies once a patent expires) as a share of the pharmaceutical market by volume. Canada 79.0% (2022), Latvia 76.0% (2023), Slovakia 64.4%, Czechia 62.6%, Türkiye 59.2%, Norway 55.7%, Portugal 51.6%, Japan 50.6% (2022), Italy 28.4%, Switzerland 24.6%. The OECD splits the market four ways (total, reimbursed, community pharmacy, hospital) and by volume or value, and each combination covers only a dozen or so countries; this map uses volume in the total market. Shares by value are much lower, because generics are cheap.',
      },
      unit: '%',
      file: 'generics.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70] } },
      format: pct,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'oral-morphine',
      label: { zh: '口服嗎啡拿得到嗎', en: 'Oral morphine available?' },
      description: {
        zh: `各國衛生部回答 WHO 的非傳染病國家能力調查：公立醫療體系是不是普遍拿得到口服嗎啡（癌症末期與重度疼痛用的止痛藥），2013–2021 年。2021 年 97 國回答有、80 國沒有、17 國不知道或沒回答。美國、英國、巴西、印度、奈及利亞回答有；中國、泰國、越南、菲律賓、印尼、巴基斯坦回答沒有。${SURVEY.zh}`,
        en: `Answers from health ministries to the WHO Noncommunicable Disease Country Capacity Survey: is oral morphine (for pain in terminal cancer and other severe pain) generally available in the public health system? 2013–2021. In 2021, 97 countries said yes, 80 no and 17 did not know or did not answer. The US, the UK, Brazil, India and Nigeria said yes; China, Thailand, Vietnam, the Philippines, Indonesia and Pakistan said no. ${SURVEY.en}`,
      },
      unit: '',
      file: 'oral-morphine.json',
      layer: { kind: 'categorical', categories: AVAILABLE, ordinal: true },
      format: availableLabel,
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'insulin',
      label: { zh: '胰島素拿得到嗎', en: 'Insulin available?' },
      description: {
        zh: `同一份 WHO 調查：公立醫療體系是不是普遍拿得到胰島素（第 1 型糖尿病一定要用）。2021 年 154 國回答有、33 國沒有、7 國不知道或沒回答；中國、越南、印尼、巴基斯坦回答沒有，奈及利亞 2021 年第一次回答有。${SURVEY.zh}`,
        en: `The same WHO survey: is insulin (essential for type 1 diabetes) generally available in the public health system? In 2021, 154 countries said yes, 33 no and 7 did not know or did not answer; China, Vietnam, Indonesia and Pakistan said no, and Nigeria said yes for the first time. ${SURVEY.en}`,
      },
      unit: '',
      file: 'insulin.json',
      layer: { kind: 'categorical', categories: AVAILABLE, ordinal: true },
      format: availableLabel,
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'essential-medicines',
      label: { zh: '基本藥物清單收了幾種藥', en: 'Medicines on the essential list' },
      description: {
        zh: '各國「國家基本藥物清單」收了幾種藥（Persaud 等 2019 年整理 137 國的清單）。斯洛伐克 983 種最多，其次是敘利亞 964、葡萄牙 905、伊朗 886、捷克 802、越南 743；泰國 547、菲律賓 519、俄羅斯 518、巴西 405、印度 367、中國 289、印尼 275、南非 192；柬埔寨 44 最少；中位數 310。各國清單的年份從 2001 到 2017 年都有（游標移到國家上看是哪一年的清單、跟 WHO 示範清單相同的有幾種），不能直接比；收越多不一定越好，WHO 示範清單是給各國挑選的起點。日本、南韓、美國、英國等不在這 137 國裡。',
        en: 'How many medicines each national essential medicines list contains (137 lists compiled by Persaud et al., 2019). Slovakia has the most, 983, followed by Syria 964, Portugal 905, Iran 886, Czechia 802 and Vietnam 743; Thailand 547, the Philippines 519, Russia 518, Brazil 405, India 367, China 289, Indonesia 275, South Africa 192; Cambodia has the fewest, 44; the median is 310. Lists date from 2001 to 2017 (hover over a country for the year and how many medicines it shares with the WHO Model List), so they are not directly comparable, and more is not necessarily better: the WHO Model List is a starting point for countries to choose from. Japan, South Korea, the US and the UK are among those not in the 137.',
      },
      unit: { zh: '種', en: 'medicines' },
      file: 'essential-medicines.json',
      timeless: true,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [200, 300, 400, 600, 800] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} medicines` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'fda-recalls',
      label: { zh: '被美國 FDA 回收的藥品', en: 'US FDA drug recalls by firm country' },
      description: {
        zh: '美國 FDA 2012 年起要求回收的藥品，依回收廠商所在國算回收次數（同一次回收的好幾個產品、批號算一次）。這是美國的紀錄，九成五的廠商在美國（4,477 次），其次是印度 102、加拿大 50、中國 18、墨西哥 18，台灣 2；畫的是「有幾次是這一國廠商的藥被美國 FDA 回收」，不是各國的藥品品質。一級回收是可能造成嚴重健康危害的（滑過國家看件數）。台灣食藥署自己公告的藥品回收寫在台灣的附註。openFDA 的說明：不要依這些資料做醫療決定，所有結果都應視為未經驗證。',
        en: 'Drug recalls requested by the US FDA since 2012, counted by the recalling firm’s country (several products and lots in one recall count once). This is a US record: 95% of firms are in the US (4,477 recalls), followed by India 102, Canada 50, China 18, Mexico 18 and Taiwan 2. It shows how often a country’s firms had drugs recalled by the US FDA, not the quality of each country’s medicines. Class I recalls are those that could cause serious harm (hover over a country). Recalls announced by Taiwan’s own Food and Drug Administration are in Taiwan’s note. openFDA: do not rely on these data to make decisions regarding medical care; assume all results are unvalidated.',
      },
      unit: { zh: '次', en: 'recalls' },
      file: 'fda-recalls.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 次`, en: `${formatLargeNumber(v)} recalls` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'shortage-register',
      label: { zh: '有沒有國家級的線上缺藥登錄', en: 'National online medicine shortage register' },
      description: {
        zh: '政府有沒有公開的線上缺藥登錄，讓醫師、藥師與民眾查現在缺哪些藥、多久會恢復。歐盟與 EEA 30 國照歐洲藥品管理局（EMA）的一覽：25 國有（荷蘭只登錄部分藥品），賽普勒斯、盧森堡、馬爾他、列支敦斯登、波蘭沒有人用藥的線上登錄；美國 FDA 與台灣（衛福部藥品供應通報處理中心）也有。各國登錄的品項數不能互相比（美國依包裝、台灣依許可證算，EMA 自己只收影響一個以上會員國的短缺），數字寫在滑過的說明裡。其他國家沒有整理，顯示無資料。openFDA 的說明：不要依這些資料做醫療決定，所有結果都應視為未經驗證。',
        en: 'Whether the government runs a public online register of medicine shortages where doctors, pharmacists and the public can check what is short and when it should be back. For the 30 EU/EEA countries, per the European Medicines Agency (EMA): 25 have one (the Netherlands lists selected medicines only), while Cyprus, Luxembourg, Malta, Liechtenstein and Poland have no online register for human medicines; the US FDA and Taiwan (the Ministry of Health and Welfare’s supply reporting centre) have one too. Item counts are not comparable between registers (the US counts packages, Taiwan licences, and EMA lists only shortages affecting more than one member state), so they appear only in the hover text. Other countries were not compiled and show no data. openFDA: do not rely on these data to make decisions regarding medical care; assume all results are unvalidated.',
      },
      unit: '',
      file: 'shortage-register.json',
      timeless: true,
      layer: { kind: 'categorical', categories: SHORTAGE_REGISTER },
      format: (v) => tr(SHORTAGE_REGISTER.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
    },
  ],
};
