import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, DimensionDef, PlaceDef, TopicDefinition } from './types';

const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
const PER_100K = { zh: '人/十萬人', en: 'per 100,000 people' };
const per100k = (v: number) => tr({ zh: `每十萬人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 100,000` });
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/**
 * 首要死因的分類：WHO Global Health Estimates 第二層死因的代碼（pipeline/topics/disease.py 的 TOP_CAUSES）。
 * 2000–2023 年各國的首要死因只出現這 7 類。順序就是圖例的順序，顏色依序取 MAP_TOKENS.categorical。
 */
const TOP_CAUSES: CategoryDef[] = [
  { value: 1100, label: { zh: '心血管疾病', en: 'Cardiovascular diseases' } },
  { value: 610, label: { zh: '癌症', en: 'Cancers' } },
  { value: 20, label: { zh: '感染與寄生蟲疾病', en: 'Infectious and parasitic diseases' } },
  { value: 380, label: { zh: '呼吸道感染（含 COVID-19）', en: 'Respiratory infections (incl. COVID-19)' } },
  { value: 1520, label: { zh: '事故傷害與天災', en: 'Unintentional injuries and disasters' } },
  { value: 1600, label: { zh: '戰爭、暴力與自殺', en: 'Conflict, violence and self-harm' } },
  { value: 540, label: { zh: '營養不良', en: 'Nutritional deficiencies' } },
];
const causeLabel = new Map(TOP_CAUSES.map((c) => [c.value, c.label]));

/**
 * 死亡最多的癌症（2026-10-29 擴充）：GHE 第三層癌症部位的代碼（pipeline/topics/disease.py 的 CANCER_ICD10）。
 * 2000–2023 年、三個子項目出現過的前 8 類，其他（白血病、口腔癌等，合計不到 3%）併成「其他」
 */
const CANCER_SITES: CategoryDef[] = [
  { value: 680, label: { zh: '肺癌', en: 'Lung' } },
  { value: 700, label: { zh: '乳癌', en: 'Breast' } },
  { value: 710, label: { zh: '子宮頸癌', en: 'Cervix' } },
  { value: 740, label: { zh: '攝護腺癌', en: 'Prostate' } },
  { value: 660, label: { zh: '肝癌', en: 'Liver' } },
  { value: 640, label: { zh: '胃癌', en: 'Stomach' } },
  { value: 650, label: { zh: '大腸直腸癌', en: 'Colon and rectum' } },
  { value: 630, label: { zh: '食道癌', en: 'Oesophagus' } },
];
const OTHER_SITES: Record<number, { zh: string; en: string }> = {
  770: { zh: '白血病', en: 'Leukaemia' },
  620: { zh: '口腔與口咽癌', en: 'Mouth and oropharynx' },
  760: { zh: '淋巴瘤與多發性骨髓瘤', en: 'Lymphoma and multiple myeloma' },
  752: { zh: '膽囊與膽道癌', en: 'Gallbladder and biliary tract' },
  751: { zh: '腦與神經系統癌', en: 'Brain and nervous system' },
};
const siteLabel = new Map(CANCER_SITES.map((c) => [c.value, c.label]));
const CANCER_SEX: DimensionDef = {
  label: { zh: '性別', en: 'Sex' },
  options: [
    { id: 'total', label: { zh: '兩性', en: 'Both sexes' } },
    { id: 'female', label: { zh: '女性', en: 'Women' } },
    { id: 'male', label: { zh: '男性', en: 'Men' } },
  ],
  defaultOption: 'total',
};

/** USRDS 的透析人數只有次國家的地區：畫成點（鍵跟 pipeline/topics/dialysis.py 的 NAMES 一致） */
const PLACES: PlaceDef[] = [
  { id: '_MX-AGU', name: { zh: '阿瓜斯卡連特斯州（墨西哥）', en: 'Aguascalientes (Mexico)' }, lon: -102.29, lat: 21.88 },
  { id: '_BE-NL', name: { zh: '比利時荷語區', en: 'Belgium, Dutch-speaking' }, lon: 4.4, lat: 51.05 },
  { id: '_BE-FR', name: { zh: '比利時法語區', en: 'Belgium, French-speaking' }, lon: 4.87, lat: 50.4 },
  { id: '_GB-EWN', name: { zh: '英格蘭、威爾斯與北愛爾蘭', en: 'England, Wales and Northern Ireland' }, lon: -1.5, lat: 52.6 },
  { id: '_GB-SCT', name: { zh: '蘇格蘭', en: 'Scotland' }, lon: -4.2, lat: 56.6 },
];

const DIALYSIS_PUBLIC: CategoryDef[] = [
  { value: 1, label: { zh: '可以', en: 'Generally available' } },
  { value: 0, label: { zh: '不行', en: 'Not generally available' } },
];

export const disease: TopicDefinition = {
  id: 'disease',
  title: { zh: '各國疾病與死因', en: 'Disease and causes of death' },
  shortTitle: { zh: '疾病', en: 'Disease' },
  defaultIndicator: 'top-cause',
  defaultYear: 2023,
  places: PLACES,
  sources: [
    {
      name: {
        zh: 'WHO, Global Health Estimates 2023（死因）、Global Health Observatory（NCD-RisC 糖尿病與肥胖估計）',
        en: 'WHO, Global Health Estimates 2023 (causes of death) and Global Health Observatory (NCD-RisC diabetes and obesity estimates)',
      },
      url: 'https://www.who.int/data/global-health-estimates',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（UNAIDS 愛滋、WHO 結核病與瘧疾資料）',
        en: 'World Bank, World Development Indicators (UNAIDS HIV and WHO tuberculosis and malaria data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部統計處（死因統計、衛生福利統計指標）', en: 'Ministry of Health and Welfare (Taiwan), cause-of-death statistics and health indicators' },
      url: 'https://dep.mohw.gov.tw/dos/',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United States Renal Data System, 2025 Annual Data Report 第 11 章 International Comparisons（透析人數，各國腎臟登錄系統提供）',
        en: 'United States Renal Data System, 2025 Annual Data Report, chapter 11 International Comparisons (dialysis; data supplied by national renal registries)',
      },
      url: 'https://usrds-adr.niddk.nih.gov/2025/end-stage-renal-disease/11-international-comparisons',
      license: { zh: 'NIDDK：大部分沒有著作權，可以自由轉載，註明 NIDDK', en: 'NIDDK: mostly copyright free, may be reproduced with acknowledgement of NIDDK' },
    },
    {
      name: {
        zh: 'WHO, Noncommunicable Disease Country Capacity Survey（公立體系的透析，GHO NCD_CCS_dialysis）',
        en: 'WHO, Noncommunicable Disease Country Capacity Survey (dialysis in the public health system, GHO NCD_CCS_dialysis)',
      },
      url: 'https://www.who.int/data/gho/data/indicators',
      license: 'CC BY 4.0',
    },
    {
      name: 'United Nations, World Population Prospects 2024',
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '國民健康署，癌症發生統計（台灣的附註）', en: 'Health Promotion Administration (Taiwan), cancer incidence statistics (notes on Taiwan)' },
      url: 'https://data.gov.tw/dataset/6399',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '死因的數字是 WHO 用同一套方法估計的，已經把不明原因的死亡依比例分到各類，可能跟各國官方統計不同。台灣不在 WHO 資料庫中：死因結構、首要死因與 30–70 歲死亡機率用衛福部死因統計依 WHO 的分類自己計算（2008 年起），癌症死亡率與結核病用衛福部的統計；糖尿病、肥胖、愛滋、瘧疾沒有跟國際定義一致的數字，側欄附上官方數字。癌症發生率沒有放：GLOBOCAN（IARC）大量轉載要書面授權，IHME 只限非商業使用。',
    en: "Cause-of-death figures are WHO estimates made with one method for every country, with ill-defined deaths redistributed across causes, so they may differ from official national figures. Taiwan is not in the WHO database: its cause-of-death structure, leading cause and probability of dying at 30–70 are calculated here from the Ministry of Health and Welfare's death statistics using WHO's categories (from 2008), and its cancer death rate and tuberculosis figures come from the Ministry's statistics. For diabetes, obesity, HIV and malaria there are no Taiwanese figures with the international definitions; the official figures are given in the side panel. Cancer incidence is not included: GLOBOCAN (IARC) requires written permission for large-scale reproduction, and IHME data are for non-commercial use only.",
  },
  panelExtra: () => import('./panels/DiseasePanel'),
  indicators: [
    {
      id: 'top-cause',
      label: { zh: '首要死因', en: 'Leading cause of death' },
      description: {
        zh: '死亡人數最多的一類死因（WHO 的分類）。心血管疾病含心臟病、中風與高血壓性疾病，癌症是所有癌症合計。台灣的十大死因把心臟病、腦血管疾病分開排，合起來仍少於癌症。',
        en: "The group of causes that kills the most people (WHO's categories). Cardiovascular diseases include heart disease, stroke and hypertensive disease; cancers are all cancers combined. Taiwan's official top-ten list ranks heart disease and stroke separately; together they still kill fewer people than cancer.",
      },
      unit: '',
      file: 'top-cause.json',
      layer: { kind: 'categorical', categories: TOP_CAUSES },
      format: (v) => tr(causeLabel.get(v) ?? { zh: '其他', en: 'Other' }),
    },
    {
      id: 'ncd-mortality',
      label: { zh: '慢性病過早死亡率', en: 'Premature deaths from chronic disease' },
      description: {
        zh: '30 歲的人在 70 歲以前死於心血管疾病、癌症、糖尿病或慢性呼吸道疾病的機率（聯合國永續發展目標 3.4.1）。',
        en: 'The probability that a 30-year-old dies before 70 from cardiovascular disease, cancer, diabetes or chronic respiratory disease (UN Sustainable Development Goal indicator 3.4.1).',
      },
      unit: '%',
      file: 'ncd-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 13, 16, 20, 25, 30] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'cancer-mortality',
      label: { zh: '癌症死亡率', en: 'Cancer death rate' },
      description: {
        zh: '每十萬人一年有幾人死於癌症，用 WHO 世界標準人口做年齡標準化，扣掉各國人口老化程度的差異。',
        en: 'Cancer deaths per 100,000 people a year, age-standardised to the WHO world standard population so that differences in population ageing are taken out.',
      },
      unit: PER_100K,
      file: 'cancer-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [70, 85, 100, 115, 130, 145] } },
      format: per100k,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'top-cancer',
      label: { zh: '死亡最多的癌症', en: 'Deadliest cancer' },
      description: {
        zh: '死亡人數最多的癌症部位（WHO Global Health Estimates，不算「其他惡性腫瘤」）。2023 年肺癌在 80 國最多，乳癌 32 國、子宮頸癌 18 國（多在非洲）、肝癌 17 國；選男性、女性看攝護腺癌與乳癌。台灣男女都是肺癌。只能畫死亡，不能畫發生（新診斷）：國際的癌症發生資料（GLOBOCAN）不准大量轉載。',
        en: 'The cancer site that kills the most people (WHO Global Health Estimates, leaving out “other malignant neoplasms”). In 2023 lung cancer led in 80 countries, breast cancer in 32, cervical cancer in 18 (mostly in Africa) and liver cancer in 17; choose Men or Women for prostate and breast cancer. In Taiwan it is lung cancer for both sexes. Only deaths can be shown, not new cases: the international incidence data (GLOBOCAN) may not be redistributed in bulk.',
      },
      unit: '',
      file: 'top-cancer/{item}.json',
      dimension: CANCER_SEX,
      layer: { kind: 'categorical', categories: CANCER_SITES, other: { zh: '其他（白血病、口腔癌等）', en: 'Other (leukaemia, mouth cancer and others)' } },
      format: (v) => tr(siteLabel.get(v) ?? OTHER_SITES[v] ?? { zh: '其他', en: 'Other' }),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'dialysis',
      label: { zh: '每百萬人的透析人數', en: 'People on dialysis per million' },
      description: {
        zh: '年底正在洗腎（血液透析或腹膜透析）的人數，每百萬人有幾人（2023 年，各國腎臟登錄系統提供給美國 USRDS 的數字，沒有年齡調整）。台灣 3,522 人最多，日本 2,667、泰國 2,317、新加坡 2,216、韓國 2,178（2022 年）、美國 1,677；北歐、英國多在 400 以下，南非 116、奈及利亞 13。只有約 50 個有登錄系統的國家或地區，非洲幾乎沒有。這是盛行率：洗腎的人活得越久、腎臟移植越少，數字越高，各國收集的方法也不同。墨西哥只有阿瓜斯卡連特斯州，比利時、英國分區，畫成點。',
        en: 'People on dialysis (haemodialysis or peritoneal dialysis) at year end per million population (2023, from national renal registries reporting to the US Renal Data System, unadjusted). Taiwan is highest at 3,522, then Japan 2,667, Thailand 2,317, Singapore 2,216, South Korea 2,178 (2022) and the US 1,677; the Nordic countries and the UK are mostly under 400, South Africa 116 and Nigeria 13. Only about 50 countries or regions with registries are included, almost none in Africa. This is prevalence: longer survival on dialysis and fewer kidney transplants raise it, and data collection differs between countries. Mexico is represented by Aguascalientes state, and Belgium and the UK by their regions, drawn as dots.',
      },
      unit: { zh: '人/百萬人', en: 'per million' },
      file: 'dialysis.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [200, 500, 800, 1100, 1500, 2000] } },
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 0)} 人`, en: `${fixed(v, 0)} per million` }),
      formatTick: (v) => fixed(v, 0),
      noValue: {
        MEX: { zh: '只有阿瓜斯卡連特斯州（見地圖上的點）', en: 'Only Aguascalientes state (see the dot on the map)' },
        BEL: { zh: '分成荷語區與法語區（見地圖上的點）', en: 'Reported for the Dutch- and French-speaking regions (see the dots)' },
        GBR: { zh: '分成英格蘭威爾斯北愛爾蘭與蘇格蘭（見地圖上的點）', en: 'Reported for England, Wales and Northern Ireland, and for Scotland (see the dots)' },
      },
    },
    {
      id: 'dialysis-public',
      label: { zh: '公立醫療能不能洗腎', en: 'Dialysis in public health care' },
      description: {
        zh: '各國政府回答 WHO 的非傳染病國家能力調查：公立醫療體系是不是普遍提供透析（2015–2021 年，每兩年）。2021 年 137 國可以、47 國不行（多在非洲與太平洋島國），10 國沒有回答或不知道。是政府自己回答的「有沒有普遍提供」，不是有多少人洗得到。台灣不在調查裡，全民健保給付透析，編成「可以」。',
        en: 'Government answers to the WHO Noncommunicable Disease Country Capacity Survey: is dialysis generally available in the public health system (2015–2021, every two years)? In 2021, 137 countries said yes and 47 no (mostly in Africa and the Pacific islands); 10 did not answer or did not know. It is a self-reported yes or no, not how many people get treatment. Taiwan is not in the survey; National Health Insurance covers dialysis, so it is coded as available.',
      },
      unit: '',
      file: 'dialysis-public.json',
      layer: { kind: 'categorical', categories: DIALYSIS_PUBLIC, ordinal: true },
      format: (v) => tr(DIALYSIS_PUBLIC.find((c) => c.value === v)?.label ?? { zh: '其他', en: 'Other' }),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'diabetes',
      label: { zh: '糖尿病盛行率', en: 'Diabetes prevalence' },
      description: {
        zh: '18 歲以上有糖尿病的比例（空腹血糖或糖化血色素過高，或正在服藥），年齡標準化；NCD-RisC 依各國健康調查估計。',
        en: 'The share of adults (18+) with diabetes (high fasting glucose or HbA1c, or on medication), age-standardised; NCD-RisC estimates from national health surveys.',
      },
      unit: '%',
      file: 'diabetes.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [6, 8, 10, 14, 18, 24] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'obesity',
      label: { zh: '成人肥胖率', en: 'Adult obesity' },
      description: {
        zh: '18 歲以上身體質量指數（BMI）30 以上的比例，年齡標準化；NCD-RisC 依各國實測身高體重的調查估計。台灣的肥胖標準是 BMI 27 以上，比這裡寬。',
        en: 'The share of adults (18+) with a body mass index (BMI) of 30 or more, age-standardised; NCD-RisC estimates from surveys that measured height and weight.',
      },
      unit: '%',
      file: 'obesity.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'hiv',
      label: { zh: '愛滋感染率', en: 'HIV prevalence' },
      description: {
        zh: '15–49 歲感染 HIV 的比例，含未確診者的估計。UNAIDS 沒有公布多數高所得國家的數字，所以很多國家是灰色。',
        en: 'The share of people aged 15–49 living with HIV, including estimated undiagnosed infections. UNAIDS does not publish figures for most high-income countries, so many countries are grey.',
      },
      unit: '%',
      file: 'hiv.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.3, 0.5, 1, 5, 10] } },
      format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'tb-incidence',
      label: { zh: '結核病發生率', en: 'Tuberculosis incidence' },
      description: {
        zh: '每十萬人一年有幾個新的結核病例（WHO 的估計，含沒有通報的病例）。',
        en: 'New tuberculosis cases per 100,000 people a year (WHO estimates, including cases that are not reported).',
      },
      unit: PER_100K,
      file: 'tb-incidence.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 200, 400] } },
      format: per100k,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'malaria',
      label: { zh: '瘧疾發生率', en: 'Malaria incidence' },
      description: {
        zh: '有瘧疾流行風險的人口中，每千人一年有幾個新病例。沒有本土瘧疾的國家沒有數值，所以大多是灰色。',
        en: 'New malaria cases per 1,000 people at risk a year. Countries without local transmission have no value, so most of them are grey.',
      },
      unit: { zh: '人/千名風險人口', en: 'per 1,000 people at risk' },
      file: 'malaria.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 50, 100, 200, 300] } },
      format: (v) => tr({ zh: `每千人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per 1,000` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'ncd-deaths-share',
      label: { zh: '慢性病死亡占比', en: 'Deaths from chronic disease' },
      description: {
        zh: '全部死亡中，死於癌症、心血管疾病、糖尿病、失智症等非傳染性疾病的比例。',
        en: 'The share of all deaths caused by non-communicable diseases such as cancer, cardiovascular disease, diabetes and dementia.',
      },
      unit: '%',
      file: 'ncd-deaths-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 50, 60, 70, 80, 90] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'communicable-deaths-share',
      label: { zh: '傳染病死亡占比', en: 'Deaths from infectious disease' },
      description: {
        zh: '全部死亡中，死於傳染病（含肺炎、COVID-19）、孕產期與新生兒疾病、營養不良的比例。',
        en: 'The share of all deaths caused by communicable diseases (including pneumonia and COVID-19), maternal and neonatal conditions and malnutrition.',
      },
      unit: '%',
      file: 'communicable-deaths-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 40, 50] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'injury-deaths-share',
      label: { zh: '傷害死亡占比', en: 'Deaths from injuries' },
      description: {
        zh: '全部死亡中，死於交通事故、跌倒、溺水、天災、自殺、暴力與戰爭等傷害的比例。',
        en: 'The share of all deaths caused by injuries: road crashes, falls, drowning, disasters, suicide, violence and war.',
      },
      unit: '%',
      file: 'injury-deaths-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 6, 8, 10, 12, 15] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
  ],
};
