import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 疫苗與防疫（pipeline/topics/vaccination.py）：WHO/UNICEF 的兒童常規疫苗接種率（零劑兒童 2026-11-04 拿掉：DTP1 只在 WHO GHO），
 * 以及 COVID-19 的確診死亡、疫苗接種與超額死亡。台灣不在 WHO 的資料裡：常規疫苗用疾管署的完成率，
 * COVID-19 死亡用衛福部死因統計（附註、側欄另外對照疾管署通報的確診死亡）。
 */

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const pct = (v: number) => `${fixed(v, v % 1 ? 1 : 0)}%`;
const pctTick = (v: number) => `${v}%`;
const per100k = (v: number) => tr({ zh: `每 10 萬人 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per 100,000` });
const per100kTick = (v: number) => fixed(v, 0);
const PER_100K = { zh: '每 10 萬人', en: 'per 100,000' };

/** 三種兒童常規疫苗用同一組門檻：90% 是 WHO 免疫議程 2030 的目標，95% 是麻疹群體免疫需要的涵蓋率 */
const COVERAGE_SCALE: ScaleSpec = { type: 'sequential', thresholds: [50, 70, 80, 85, 90, 95] };
/** 確診死亡與超額死亡用同一組門檻，兩張圖可以對照 */
const DEATHS_SCALE: ScaleSpec = { type: 'sequential', thresholds: [10, 50, 100, 200, 300, 500] };
const IN_CHINA = { zh: 'WHO 算在「中國」裡', en: 'Counted under China by WHO' };

/** mRNA 技術移轉（pipeline/topics/vaccine_production.py） */
const MRNA_HUB: CategoryDef[] = [
  { value: 1, label: { zh: '樞紐（南非）', en: 'Hub (South Africa)' } },
  { value: 2, label: { zh: '夥伴國', en: 'Partner country' } },
];

export const vaccination: TopicDefinition = {
  id: 'vaccination',
  title: { zh: '疫苗與防疫', en: 'Vaccination and COVID-19' },
  shortTitle: { zh: '疫苗與防疫', en: 'Vaccines' },
  defaultIndicator: 'dtp3',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'WHO/UNICEF Estimates of National Immunization Coverage（WUENIC）2025 年版的 DTP3、麻疹第二劑，WHO HPV 疫苗涵蓋率估計（2000 年起；data.who.int 有指標頁）',
        en: 'WHO/UNICEF Estimates of National Immunization Coverage (WUENIC), 2025 revision, for DTP3 and the second measles dose, and WHO HPV coverage estimates (from 2000; indicator pages on data.who.int)',
      },
      url: 'https://data.who.int/indicators/i/48D7D19/F8E084C',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'WHO 資料平臺：PCV3 immunization coverage（age 1）（WHO/UNICEF 的估計，2008–2024）', en: 'WHO data: PCV3 immunization coverage (age 1) (WHO/UNICEF estimates, 2008–2024)' },
      url: 'https://data.who.int/indicators/i/4B4DAF2/D45F91C',
      license: { zh: 'CC BY 4.0（另有 WHO 的附加條款）', en: 'CC BY 4.0 (with WHO’s additional terms)' },
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（WUENIC 的 DTP3 1980–1999 年、麻疹第一劑 1980–2024 年）',
        en: 'World Bank, World Development Indicators (WUENIC DTP3, 1980–1999, and first measles dose, 1980–2024)',
      },
      url: 'https://data.worldbank.org/indicator/SH.IMM.IDPT',
      license: 'CC BY 4.0',
    },
    {
      name: 'United Nations, World Population Prospects 2024',
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: 'Our World in Data, COVID-19 dataset（確診死亡來自 WHO COVID-19 dashboard；疫苗接種是 OWID 整理各國官方的數字）',
        en: 'Our World in Data, COVID-19 dataset (confirmed deaths from the WHO COVID-19 dashboard; vaccinations compiled by OWID from official sources)',
      },
      url: 'https://ourworldindata.org/coronavirus',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Johns Hopkins University CSSE, COVID-19 Data Repository（OWID 轉載；台灣到 2023 年 2 月的確診死亡與 WHO「中國」的對照）',
        en: 'Johns Hopkins University CSSE, COVID-19 Data Repository (via OWID; Taiwan confirmed deaths to February 2023 and the check of WHO’s China figure)',
      },
      url: 'https://github.com/owid/covid-19-data/tree/master/public/data/jhu',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'The Economist and Solstad, S., 2021, “The pandemic’s true death toll”（超額死亡模型，到 2024 年 6 月）',
        en: 'The Economist and Solstad, S., 2021, “The pandemic’s true death toll” (excess deaths model, to June 2024)',
      },
      url: 'https://github.com/TheEconomist/covid-19-the-economist-global-excess-deaths-model',
      license: 'MIT License, Copyright (c) 2021 The Economist Newspaper',
    },
    {
      name: {
        zh: 'Karlinsky & Kobak 2021, World Mortality Dataset（各國每週或每月死亡數，超額死亡與少報倍數自己算）',
        en: 'Karlinsky & Kobak 2021, World Mortality Dataset (weekly or monthly deaths; excess deaths and undercount computed here)',
      },
      url: 'https://github.com/akarlinsky/world_mortality',
      license: 'MIT License, Copyright (c) 2021 Ariel Karlinsky',
    },
    {
      name: {
        zh: '衛生福利部疾病管制署「預防接種統計」各年幼兒常規疫苗接種完成率、COVID-19 疫苗接種統計（台灣）',
        en: 'Taiwan Centers for Disease Control: annual routine childhood vaccination completion rates and COVID-19 vaccination statistics',
      },
      url: 'https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA',
      license: { zh: '疾管署政府網站資料開放宣告（政府資料開放授權條款）', en: 'Taiwan CDC open data declaration (Open Government Data License)' },
    },
    {
      name: {
        zh: '衛生福利部疾病管制署「各縣市衛生所及合約醫院診所 2024 年預防接種完成率統計」、內政部「村里戶數、單一年齡人口」2024 年 12 月（台灣的麻疹第二劑，依 5 歲人口加權自算）',
        en: 'Taiwan CDC: 2024 immunization coverage by county at health stations and contracted clinics; Ministry of the Interior: village households and population by single year of age, December 2024 (Taiwan’s second measles dose, weighted by population aged five)',
      },
      url: 'https://data.gov.tw/dataset/24457',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '衛生福利部統計處 死因統計（COVID-19 死亡，台灣）、國民健康署 HPV 疫苗接種（衛福部新聞稿）',
        en: 'Ministry of Health and Welfare (Taiwan): cause-of-death statistics (COVID-19) and HPV vaccination press release',
      },
      url: 'https://dep.mohw.gov.tw/DOS/np-6602-113.html',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'OECD Health Statistics：Immunisation（65 歲以上的流感疫苗接種率）', en: 'OECD Health Statistics: Immunisation (influenza vaccination, aged 65+)' },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: 'WHO Prequalification：預認證疫苗、品管實驗室清單；WHO mRNA Technology Transfer Programme（事實自行整理）',
        en: 'WHO Prequalification: prequalified vaccines and quality control labs; WHO mRNA Technology Transfer Programme (facts compiled)',
      },
      url: 'https://extranet.who.int/prequal/vaccines/prequalified/export?page&_format=csv',
      license: { zh: '事實自行整理', en: 'facts compiled by hand' },
    },
  ],
  note: {
    zh: '兒童常規疫苗的接種率是 WHO 與 UNICEF 依各國通報與調查做的估計（WUENIC），每年改版都會修訂整個序列；麻疹第一劑用世界銀行轉載的 2024 年版（到 2024 年，2025 年顯示 2024 年的值），WHO 自己的 2025 年版只在 WHO GHO 資料庫，2026 年 11 月起不用，零劑兒童（要用 DTP1 算）也因此拿掉。COVID-19 的確診死亡是各國向 WHO 通報的人數，會受檢驗量、死因認定與通報方式影響，各國不完全可比；超額死亡是 The Economist 的模型估計的死亡人數比沒有疫情時多出多少，沒有全死因死亡統計的國家完全靠模型推估，誤差很大。WHO 的「中國」含香港、澳門與台灣通報的確診死亡。COVID-19 的資料都已停止更新：確診死亡到 2026 年 8 月、疫苗接種到 2024 年 8 月、超額死亡到 2024 年 6 月。超額死亡的資料依 MIT 授權使用：Copyright (c) 2021 The Economist Newspaper.',
    en: 'Childhood vaccine coverage figures are WHO and UNICEF estimates (WUENIC) based on country reports and surveys; each revision updates the whole series. The first measles dose uses the 2024 revision republished by the World Bank (to 2024; 2025 shows the 2024 value), because WHO’s 2025 revision is only in its Global Health Observatory, which this site stopped using in November 2026; zero-dose children, which need DTP1, were removed for the same reason. Confirmed COVID-19 deaths are the numbers countries reported to WHO and depend on testing, cause-of-death rules and reporting, so they are not fully comparable; excess deaths are The Economist’s model estimates of deaths above what would have been expected without the pandemic, and in countries without all-cause death statistics they rest entirely on the model and are very uncertain. WHO’s figure for China includes confirmed deaths reported by Hong Kong, Macao and Taiwan. The COVID-19 data are no longer updated: confirmed deaths run to August 2026, vaccinations to August 2024 and excess deaths to June 2024. Excess death data used under the MIT License: Copyright (c) 2021 The Economist Newspaper.',
  },
  panelExtra: () => import('./panels/VaccinationPanel'),
  indicators: [
    {
      id: 'dtp3',
      label: { zh: 'DTP3 接種率', en: 'DTP3 coverage' },
      description: {
        zh: '滿 1 歲的嬰兒打完三劑白喉、破傷風、百日咳疫苗（DTP3）的比例，常用來衡量常規預防接種做得好不好。WHO/UNICEF 的估計；台灣是疾管署公布的五合一疫苗第三劑完成率。',
        en: 'Share of one-year-olds who received three doses of diphtheria-tetanus-pertussis vaccine (DTP3), a common measure of routine immunization. WHO/UNICEF estimates; Taiwan uses Taiwan CDC’s completion rate for the third five-in-one dose.',
      },
      unit: '%',
      file: 'dtp3.json',
      layer: { kind: 'choropleth', scale: COVERAGE_SCALE },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'mcv1',
      label: { zh: '麻疹疫苗第一劑', en: 'Measles, 1st dose' },
      description: {
        zh: '滿 1 歲的嬰兒打了第一劑含麻疹成分疫苗（MCV1）的比例；兩劑都要 95% 以上才擋得住麻疹流行。WHO/UNICEF 的估計（世界銀行轉載的 2024 年版，到 2024 年）；台灣是疾管署公布的 MMR 第一劑完成率。',
        en: 'Share of one-year-olds who received a first dose of measles-containing vaccine (MCV1); stopping measles outbreaks takes 95% coverage with both doses. WHO/UNICEF estimates (2024 revision as republished by the World Bank, to 2024); Taiwan uses Taiwan CDC’s completion rate for the first MMR dose.',
      },
      unit: '%',
      file: 'mcv1.json',
      layer: { kind: 'choropleth', scale: COVERAGE_SCALE },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'mcv2',
      label: { zh: '麻疹疫苗第二劑', en: 'Measles, 2nd dose' },
      description: {
        zh: '在各國規定的年齡打了第二劑含麻疹成分疫苗（MCV2）的比例。還沒有把第二劑納入常規接種的國家是 0%。WHO/UNICEF 的估計；台灣只有 2024 年，是疾管署各縣市的 MMR 第二劑完成率依各縣市 5 歲人口加權自算的估計。',
        en: 'Share of children who received a second dose of measles-containing vaccine (MCV2) by the nationally recommended age. Countries that have not added the second dose to their routine schedule show 0%. WHO/UNICEF estimates; Taiwan (2024 only) is an estimate from Taiwan CDC’s county completion rates for the second MMR dose, weighted by each county’s population aged five.',
      },
      unit: '%',
      file: 'mcv2.json',
      layer: { kind: 'choropleth', scale: COVERAGE_SCALE },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      noValue: { TWN: { zh: '沒有逐年的全國數字', en: 'No national figure by year' } },
    },
    {
      id: 'pcv3',
      label: { zh: '肺炎鏈球菌疫苗第三劑', en: 'Pneumococcal, 3rd dose' },
      description: {
        zh: '滿 1 歲的嬰兒打完三劑結合型肺炎鏈球菌疫苗（PCV3）的比例，預防肺炎、腦膜炎與菌血症（5 歲以下兒童肺炎死亡的主因之一）。還沒有把 PCV 納入常規接種的國家是 0%（例如中國，PCV 是自費疫苗）；世界 2008 年 4%、2024 年 67%，印度 95%、日本 91%、美國 84%。WHO/UNICEF 的估計；台灣只有 2024 年，是疾管署各縣市的完成率依各縣市 1 歲人口加權自算的估計（97.1%）。',
        en: 'Share of one-year-olds who received three doses of pneumococcal conjugate vaccine (PCV3), which prevents pneumonia, meningitis and bacteraemia (pneumonia is a leading killer of children under five). Countries that have not added PCV to their routine schedule show 0% (China, for example, where it is a paid vaccine); the world rose from 4% in 2008 to 67% in 2024, with India at 95%, Japan 91% and the US 84%. WHO/UNICEF estimates; Taiwan (2024 only) is an estimate from Taiwan CDC’s county completion rates, weighted by each county’s population aged one (97.1%).',
      },
      unit: '%',
      file: 'pcv3.json',
      layer: { kind: 'choropleth', scale: COVERAGE_SCALE },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      noValue: { TWN: { zh: '沒有逐年的全國數字', en: 'No national figure by year' } },
    },
    {
      id: 'hpv',
      label: { zh: 'HPV 疫苗（女孩第一劑）', en: 'HPV, girls (1st dose)' },
      description: {
        zh: '9–14 歲女孩這個主要接種世代打了第一劑人類乳突病毒（HPV）疫苗的比例，預防子宮頸癌；WHO 的 2030 年目標是 90%。還沒有 HPV 疫苗計畫的國家沒有值。WHO 的估計。',
        en: 'Share of girls in the primary target cohort (aged 9–14) who received a first dose of human papillomavirus (HPV) vaccine, which prevents cervical cancer; the WHO target for 2030 is 90%. Countries without an HPV programme have no value. WHO estimates.',
      },
      unit: '%',
      file: 'hpv.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 70, 80, 90] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
      noValue: { TWN: { zh: '定義不同（只公布完成兩劑）', en: 'Different definition (two doses)' } },
    },
    {
      id: 'flu-elderly',
      label: { zh: '65 歲以上打流感疫苗的比例', en: 'Flu vaccination, people aged 65+' },
      description: {
        zh: '65 歲以上長者一年打流感疫苗的比例（OECD，60 國含幾個非會員）。2024 年 44 國的中位數約 51%：墨西哥 85.9%、南韓 83.4%、愛爾蘭 75.7%、丹麥 75.6%、英國 74.9%；拉脫維亞 16.7%、塞爾維亞 14.1%、波蘭 12.2%、斯洛伐克 11.0%、烏克蘭 0.2%。歐盟的目標是 75%。拉時間軸看 2020–2021 年 COVID-19 期間普遍上升、之後回落。流感季跨年，有的國家報「2024/25 季」有的報曆年；超過 95% 的多半是分母用公費配額，不是全部 65 歲以上的人。各國用 3 年內最近的一年；台灣不在 OECD 的資料裡。',
        en: 'Share of people aged 65 and over vaccinated against influenza in a year (OECD, 60 countries including a few non-members). In 2024 the median of 44 countries was about 51%: Mexico 85.9%, South Korea 83.4%, Ireland 75.7%, Denmark 75.6%, the UK 74.9%; Latvia 16.7%, Serbia 14.1%, Poland 12.2%, Slovakia 11.0%, Ukraine 0.2%. The EU target is 75%. Drag the timeline to see the general rise during COVID-19 in 2020–2021 and the fall afterwards. Flu seasons span two years, and some countries report seasons while others report calendar years; values above 95% usually use the publicly funded allocation, not all people aged 65+, as the denominator. Each country shows its latest year within three; Taiwan is not in OECD data.',
      },
      unit: '%',
      file: 'flu-elderly.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 60, 70, 75] } },
      format: pct,
      formatTick: pctTick,
      noValue: { TWN: { zh: '不在 OECD 的資料裡', en: 'Not in OECD data' } },
    },
    {
      id: 'pq-vaccines',
      label: { zh: 'WHO 預認證的疫苗', en: 'WHO-prequalified vaccines' },
      description: {
        zh: '聯合國兒童基金會等聯合國機構只採購經過 WHO「預認證」的疫苗。287 項預認證疫苗依負責監管的機關所在國算（不是工廠所在地）：印度 131 項（血清研究所等），南韓 24、比利時 21（葛蘭素史克）、印尼 17、中國 14、美國 12、保加利亞 8、法國 6；歐盟 EMA 監管的 23 項不屬於單一國家，沒有畫。台灣不在預認證體系裡。清單是 2026 年 11 月的現況，退出的產品不會留下。',
        en: 'UNICEF and other UN agencies buy only vaccines prequalified by WHO. The 287 prequalified vaccines are counted by the country of the responsible regulator (not the factory): India 131 (Serum Institute of India and others), South Korea 24, Belgium 21 (GSK), Indonesia 17, China 14, the US 12, Bulgaria 8, France 6; the 23 regulated by the EU’s EMA belong to no single country and are not shown. Taiwan is not part of prequalification. The list is the status as of November 2026; withdrawn products are not kept.',
      },
      unit: { zh: '項', en: 'vaccines' },
      file: 'pq-vaccines.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 項`, en: `${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'pq-labs',
      label: { zh: 'WHO 預認證的藥品品管實驗室', en: 'WHO-prequalified quality control labs' },
      description: {
        zh: '通過 WHO 預認證、可以替聯合國採購檢驗藥品品質的實驗室，68 間、37 國：巴基斯坦 8 間最多，印度 6、中國 5，俄羅斯、南非、烏克蘭、比利時、巴西各 3。滑過國家看實驗室名稱。',
        en: 'Laboratories prequalified by WHO to test the quality of medicines for UN procurement: 68 in 37 countries. Pakistan has the most (8), then India 6, China 5, and Russia, South Africa, Ukraine, Belgium and Brazil 3 each. Hover over a country for lab names.',
      },
      unit: { zh: '間', en: 'labs' },
      file: 'pq-labs.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [1, 3, 8] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 間`, en: `${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mrna-hub',
      label: { zh: 'mRNA 疫苗技術移轉', en: 'mRNA vaccine technology transfer' },
      description: {
        zh: 'COVID-19 時全球南方很難拿到 mRNA 疫苗，WHO 2021 年在南非成立 mRNA 技術移轉樞紐（Afrigen Biologics、南非醫學研究理事會、Biovac），把製造技術傳給 6 個 WHO 區域的 14 個夥伴國：阿根廷、孟加拉、巴西、埃及、印度、印尼、肯亞、奈及利亞、巴基斯坦、塞內加爾、塞爾維亞、突尼西亞、烏克蘭、越南。各國的進度差很多，這裡只畫是不是夥伴。',
        en: 'With mRNA vaccines hard to obtain in the Global South during COVID-19, WHO set up an mRNA technology transfer hub in South Africa in 2021 (Afrigen Biologics, the South African Medical Research Council and Biovac) to pass manufacturing know-how to 14 partner countries across the six WHO regions: Argentina, Bangladesh, Brazil, Egypt, India, Indonesia, Kenya, Nigeria, Pakistan, Senegal, Serbia, Tunisia, Ukraine and Viet Nam. Progress varies widely; the map shows only who is a partner.',
      },
      unit: '',
      file: 'mrna-hub.json',
      timeless: true,
      layer: { kind: 'categorical', categories: MRNA_HUB },
      format: (v) => tr(MRNA_HUB.find((c) => c.value === v)?.label ?? ''),
      unranked: true,
    },
    {
      id: 'covid-deaths',
      label: { zh: 'COVID-19 確診死亡（累計）', en: 'COVID-19 confirmed deaths' },
      description: {
        zh: '2020 年起到那一年年底，各國向 WHO 通報的 COVID-19 確診死亡（每 10 萬人）。數字會受檢驗量、死因認定與通報方式影響，檢驗少、死亡登記不完整的國家可能少很多，比較疫情的整體影響可以看超額死亡。台灣用衛福部死因統計。',
        en: 'Confirmed COVID-19 deaths reported to WHO from 2020 to the end of each year, per 100,000 people. Figures depend on testing, cause-of-death rules and reporting, and can be far too low where testing is limited or death registration incomplete; see excess deaths for the overall toll. Taiwan uses Ministry of Health and Welfare cause-of-death statistics.',
      },
      unit: PER_100K,
      file: 'covid-deaths.json',
      layer: { kind: 'choropleth', scale: DEATHS_SCALE },
      format: per100k,
      formatTick: per100kTick,
      compareWorld: true,
      unranked: true,
      noValue: { HKG: IN_CHINA, MAC: IN_CHINA },
    },
    {
      id: 'covid-vaccinated',
      label: { zh: '完成 COVID-19 基礎劑', en: 'COVID-19 primary series' },
      description: {
        zh: '完成 COVID-19 疫苗基礎劑（多數疫苗是兩劑）的人占全部人口的比例，每年最後一次公布的數字；那一年沒有公布的國家顯示前一年。Our World in Data 整理各國官方的數字，到 2024 年 8 月。',
        en: 'Share of the whole population that completed the COVID-19 primary series (two doses for most vaccines), as of the last update each year; countries that published nothing that year show the year before. Official figures compiled by Our World in Data, to August 2024.',
      },
      unit: '%',
      file: 'covid-vaccinated.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 50, 60, 70, 80] } },
      format: pct,
      formatTick: pctTick,
      compareWorld: true,
    },
    {
      id: 'covid-doses',
      label: { zh: 'COVID-19 疫苗總劑次', en: 'COVID-19 vaccine doses' },
      description: {
        zh: '每 100 人累計打了幾劑 COVID-19 疫苗（含基礎劑與加強劑），每年最後一次公布的數字。2023 年底古巴 412 劑、日本 347、智利 342、台灣 291、汶萊 284；世界 172；蒲隆地 0.3、葉門 3.4、海地 5.9、巴布亞紐幾內亞 7.2。Our World in Data 整理各國官方的數字，多數國家 2023 年就停止公布（滑過國家看最後一次公布的日期）；台灣是疾管署的數字，到 2023 年 9 月。',
        en: 'Cumulative COVID-19 vaccine doses (primary and booster) per 100 people, as of the last update each year. End of 2023: Cuba 412, Japan 347, Chile 342, Taiwan 291, Brunei 284; world 172; Burundi 0.3, Yemen 3.4, Haiti 5.9, Papua New Guinea 7.2. Official figures compiled by Our World in Data; most countries stopped reporting in 2023 (hover to see the last report date). Taiwan’s figures are from Taiwan CDC, to September 2023.',
      },
      unit: { zh: '劑/百人', en: 'doses per 100' },
      file: 'covid-doses.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 150, 200, 250] } },
      format: (v) => tr({ zh: `每百人 ${fixed(v, 0)} 劑`, en: `${fixed(v, 0)} per 100` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'covid-boosters',
      label: { zh: 'COVID-19 加強劑', en: 'COVID-19 booster doses' },
      description: {
        zh: '每 100 人累計打了幾劑 COVID-19 加強劑。這是劑次：一個人打兩次加強劑算兩劑，所以可能超過 100，不是「打過加強劑的人」的比例。2023 年底日本、智利 141 劑、比利時 116、台灣 109；世界 36；非洲多數國家不到 15 劑（奈及利亞 7.5、肯亞 3.7、烏干達 1.6），蒲隆地、布吉納法索幾乎是 0。基礎劑的貧富差距到 2023 年縮小不少，加強劑沒有。Our World in Data 整理各國官方的數字（滑過國家看最後一次公布的日期）。',
        en: 'Cumulative COVID-19 booster doses per 100 people. These are doses: someone with two boosters counts twice, so values can exceed 100; it is not the share of people who had a booster. End of 2023: Japan and Chile 141, Belgium 116, Taiwan 109; world 36; most African countries under 15 (Nigeria 7.5, Kenya 3.7, Uganda 1.6), and Burundi and Burkina Faso almost zero. The rich–poor gap in primary doses had narrowed by 2023, but not for boosters. Official figures compiled by Our World in Data (hover to see the last report date).',
      },
      unit: { zh: '劑/百人', en: 'doses per 100' },
      file: 'covid-boosters.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 15, 30, 50, 75, 100] } },
      format: (v) => tr({ zh: `每百人 ${fixed(v, 1)} 劑`, en: `${fixed(v, 1)} per 100` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'excess-deaths',
      label: { zh: '超額死亡（累計，估計）', en: 'Excess deaths (estimate)' },
      description: {
        zh: '2020 年起到那一年年底，全部死亡比沒有疫情時預期的多出多少（每 10 萬人），The Economist 的模型估計，含沒有確診的 COVID-19 死亡與疫情的間接影響。有全死因死亡統計的國家貼近實際，沒有的國家完全靠模型推估，誤差很大（側欄有 95% 區間）。',
        en: 'Deaths from all causes above what would have been expected without the pandemic, from 2020 to the end of each year, per 100,000 people; The Economist’s model estimates, including unconfirmed COVID-19 deaths and indirect effects. Close to observed data where all-cause deaths are reported; elsewhere purely modelled and very uncertain (the side panel gives the 95% range).',
      },
      unit: PER_100K,
      file: 'excess-deaths.json',
      layer: { kind: 'choropleth', scale: DEATHS_SCALE },
      format: per100k,
      formatTick: per100kTick,
      compareWorld: true,
      unranked: true,
    },
    {
      id: 'excess-wmd',
      label: { zh: '超額死亡（實際死亡統計）', en: 'Excess deaths (registered deaths)' },
      description: {
        zh: '2020 年起到那一年年底，全部死亡比照 2015–2019 年的趨勢與季節預期的多出多少（每 10 萬人），用各國實際登記的每週或每月死亡數自己算（World Mortality Dataset，122 國，跟 Karlinsky 與 Kobak 的方法一樣）。2023 年底白俄羅斯 986、俄羅斯 928、保加利亞 919 最高；紐西蘭、日本、台灣到 2021 年底還是負的（比預期少死）。台灣 2023 年底每 10 萬人 166（3.9 萬人），2022 年 Omicron 以後才變正。只有死亡登記完整的國家有資料，非洲幾乎全是空白；跟上面 The Economist 的模型估計是不同的方法，不能混著比。',
        en: 'Deaths from all causes above the 2015–2019 trend and seasonal pattern, from 2020 to the end of each year, per 100,000 people, computed here from each country’s registered weekly or monthly deaths (World Mortality Dataset, 122 countries, following Karlinsky and Kobak). By the end of 2023 Belarus (986), Russia (928) and Bulgaria (919) were highest; New Zealand, Japan and Taiwan were still negative at the end of 2021 (fewer deaths than expected). Taiwan reached 166 per 100,000 (39,000 deaths) by the end of 2023, turning positive only after Omicron in 2022. Only countries with complete death registration are covered, so Africa is almost blank; this is a different method from The Economist’s model above, so the two should not be compared directly.',
      },
      unit: PER_100K,
      file: 'excess-wmd.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-100, -25, 25, 100, 300, 600] } },
      format: per100k,
      formatTick: per100kTick,
      unranked: true,
    },
    {
      id: 'undercount',
      label: { zh: '官方少報的倍數', en: 'Undercount of COVID-19 deaths' },
      description: {
        zh: '上面自己算的超額死亡，是同一天以前官方通報的 COVID-19 死亡的幾倍（通報不到 50 人或超額死亡不是正的不算）。1 倍左右代表通報跟實際差不多；遠大於 1 代表很多 COVID-19 死亡沒有被算到，或疫情的間接影響很大。2023 年底塔吉克 122 倍、尼加拉瓜 73 倍、烏茲別克 63 倍、埃及 15 倍；台灣 2.2 倍（疾管署的通報只到 2023 年 2 月，偏高）。',
        en: 'How many times the excess deaths above exceed the COVID-19 deaths officially reported by the same date (not computed when fewer than 50 deaths were reported or excess deaths were not positive). Around 1 means the reports match reality; far above 1 means many COVID-19 deaths went uncounted or the pandemic had large indirect effects. By the end of 2023: Tajikistan 122 times, Nicaragua 73, Uzbekistan 63, Egypt 15; Taiwan 2.2 (Taiwan CDC’s daily reports stop in February 2023, so this is too high).',
      },
      unit: { zh: '倍', en: 'times' },
      file: 'undercount.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 1.5, 2, 3, 5, 10] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 倍`, en: `${fixed(v, 1)}×` }),
      formatTick: (v) => fixed(v, v < 2 ? 1 : 0),
      unranked: true,
    },
  ],
};
