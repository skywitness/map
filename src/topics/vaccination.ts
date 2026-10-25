import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 疫苗與防疫（pipeline/topics/vaccination.py）：WHO/UNICEF 的兒童常規疫苗接種率與零劑兒童，
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
const NOT_WHO = { zh: '不在 WHO/UNICEF 的估計裡', en: 'Not in WHO/UNICEF estimates' };
const IN_CHINA = { zh: 'WHO 算在「中國」裡', en: 'Counted under China by WHO' };

export const vaccination: TopicDefinition = {
  id: 'vaccination',
  title: { zh: '疫苗與防疫', en: 'Vaccination and COVID-19' },
  shortTitle: { zh: '疫苗與防疫', en: 'Vaccines' },
  defaultIndicator: 'dtp3',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'WHO/UNICEF Estimates of National Immunization Coverage（WUENIC）2025 年版、WHO HPV 疫苗涵蓋率估計（WHO Global Health Observatory，2000 年起）',
        en: 'WHO/UNICEF Estimates of National Immunization Coverage (WUENIC), 2025 revision, and WHO HPV coverage estimates (WHO Global Health Observatory, from 2000)',
      },
      url: 'https://www.who.int/data/gho/data/themes/topics/immunization',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（WUENIC 的 DTP3、麻疹 1980–1999 年）',
        en: 'World Bank, World Development Indicators (WUENIC DTP3 and measles, 1980–1999)',
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
        zh: '衛生福利部疾病管制署「預防接種統計」各年幼兒常規疫苗接種完成率、COVID-19 疫苗接種統計（台灣）',
        en: 'Taiwan Centers for Disease Control: annual routine childhood vaccination completion rates and COVID-19 vaccination statistics',
      },
      url: 'https://www.cdc.gov.tw/Category/MPage/S2UF2-VuMgfzgzpy7qdvlA',
      license: { zh: '疾管署政府網站資料開放宣告（政府資料開放授權條款）', en: 'Taiwan CDC open data declaration (Open Government Data License)' },
    },
    {
      name: {
        zh: '衛生福利部統計處 死因統計（COVID-19 死亡，台灣）、國民健康署 HPV 疫苗接種（衛福部新聞稿）',
        en: 'Ministry of Health and Welfare (Taiwan): cause-of-death statistics (COVID-19) and HPV vaccination press release',
      },
      url: 'https://dep.mohw.gov.tw/DOS/np-6602-113.html',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: '兒童常規疫苗的接種率是 WHO 與 UNICEF 依各國通報與調查做的估計（WUENIC），每年改版都會修訂整個序列；零劑兒童是沒有打過任何一劑白喉、破傷風、百日咳疫苗（DTP1）的嬰兒，這裡用聯合國的存活嬰兒數乘上沒有打 DTP1 的比例算的，各國加總跟 WHO/UNICEF 公布的全球數字（2025 年 1,350 萬人）差 1% 以內。COVID-19 的確診死亡是各國向 WHO 通報的人數，會受檢驗量、死因認定與通報方式影響，各國不完全可比；超額死亡是 The Economist 的模型估計的死亡人數比沒有疫情時多出多少，沒有全死因死亡統計的國家完全靠模型推估，誤差很大。WHO 的「中國」含香港、澳門與台灣通報的確診死亡。COVID-19 的資料都已停止更新：確診死亡到 2026 年 8 月、疫苗接種到 2024 年 8 月、超額死亡到 2024 年 6 月。超額死亡的資料依 MIT 授權使用：Copyright (c) 2021 The Economist Newspaper.',
    en: 'Childhood vaccine coverage figures are WHO and UNICEF estimates (WUENIC) based on country reports and surveys; each revision updates the whole series. Zero-dose children are infants who received no dose of diphtheria-tetanus-pertussis vaccine (DTP1); they are computed here as UN surviving infants times the share without DTP1, and the country total is within 1% of the global figure published by WHO/UNICEF (13.5 million in 2025). Confirmed COVID-19 deaths are the numbers countries reported to WHO and depend on testing, cause-of-death rules and reporting, so they are not fully comparable; excess deaths are The Economist’s model estimates of deaths above what would have been expected without the pandemic, and in countries without all-cause death statistics they rest entirely on the model and are very uncertain. WHO’s figure for China includes confirmed deaths reported by Hong Kong, Macao and Taiwan. The COVID-19 data are no longer updated: confirmed deaths run to August 2026, vaccinations to August 2024 and excess deaths to June 2024. Excess death data used under the MIT License: Copyright (c) 2021 The Economist Newspaper.',
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
        zh: '滿 1 歲的嬰兒打了第一劑含麻疹成分疫苗（MCV1）的比例；兩劑都要 95% 以上才擋得住麻疹流行。WHO/UNICEF 的估計；台灣是疾管署公布的 MMR 第一劑完成率。',
        en: 'Share of one-year-olds who received a first dose of measles-containing vaccine (MCV1); stopping measles outbreaks takes 95% coverage with both doses. WHO/UNICEF estimates; Taiwan uses Taiwan CDC’s completion rate for the first MMR dose.',
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
        zh: '在各國規定的年齡打了第二劑含麻疹成分疫苗（MCV2）的比例。還沒有把第二劑納入常規接種的國家是 0%。WHO/UNICEF 的估計。',
        en: 'Share of children who received a second dose of measles-containing vaccine (MCV2) by the nationally recommended age. Countries that have not added the second dose to their routine schedule show 0%. WHO/UNICEF estimates.',
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
      id: 'zero-dose',
      label: { zh: '零劑兒童', en: 'Zero-dose children' },
      description: {
        zh: '一年裡沒有打過任何一劑白喉、破傷風、百日咳疫苗（DTP1）的嬰兒人數，通常也錯過其他常規疫苗。用聯合國的存活嬰兒數乘上 WHO/UNICEF 估計的沒有打 DTP1 的比例。圓的面積與人數成正比。',
        en: 'Infants in a year who received no dose of diphtheria-tetanus-pertussis vaccine (DTP1) and usually miss other routine vaccines too. UN surviving infants times the share without DTP1 estimated by WHO/UNICEF. Circle area is proportional to the number.',
      },
      unit: { zh: '人', en: 'children' },
      file: 'zero-dose.json',
      layer: { kind: 'bubble', legendValues: [10000, 100000, 1000000] },
      // 中文的「萬」只取整數，10 萬以下寫出完整的數字（6,720 人，不是 1 萬人）
      format: (v) => tr({ zh: `${v < 1e5 ? fixed(v, 0) : formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} children` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
      noValue: { TWN: NOT_WHO },
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
  ],
};
