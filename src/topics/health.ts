import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, intlDollars, usd } from '../lib/format';
import { LONG_RUN_CAVEAT, LONG_RUN_SOURCE } from './longRun';
import type { DimensionDef, TopicDefinition } from './types';
import { COVID, FLU_1918 } from './events';

const perThousand = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}‰`;
const YEARS = { zh: '歲', en: 'years' };
const PER_1000 = { zh: '人/千人', en: 'per 1,000 people' };
const percent = (v: number) => `${fixed(v, 1)}%`;
const percentTick = (v: number) => `${v}%`;
const perThousandPeople = (v: number) => tr({ zh: `${fixed(v, 2)} 人`, en: `${fixed(v, 2)} per 1,000` });
const perThousandTick = (v: number) => fixed(v, v % 1 === 0 ? 0 : 1);
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 健康平均餘命、不健康的年數的性別（pipeline/topics/hale.py 的 hale/{total,female,male}.json）：台灣只有女性、男性 */
const SEX: DimensionDef = {
  label: { zh: '性別', en: 'Sex' },
  options: [
    { id: 'total', label: { zh: '兩性', en: 'Both sexes' } },
    { id: 'female', label: { zh: '女性', en: 'Women' } },
    { id: 'male', label: { zh: '男性', en: 'Men' } },
  ],
  defaultOption: 'total',
};

export const health: TopicDefinition = {
  id: 'health',
  title: { zh: '各國健康與醫療', en: 'Health by country' },
  shortTitle: { zh: '健康', en: 'Health' },
  defaultIndicator: 'life-expectancy',
  defaultYear: 2023,
  sources: [
    {
      name: 'United Nations, World Population Prospects 2024',
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '內政部簡易生命表', en: 'Ministry of the Interior (Taiwan), abridged life tables' },
      url: 'https://www.moi.gov.tw/cl.aspx?n=2906',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（WHO 醫療支出與醫事人力資料）',
        en: 'World Bank, World Development Indicators (WHO health spending and workforce data)',
      },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部統計處', en: 'Ministry of Health and Welfare (Taiwan), Department of Statistics' },
      url: 'https://dep.mohw.gov.tw/dos/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'WHO 健康平均餘命與平均壽命（Global Health Estimates 2021）', en: 'WHO healthy life expectancy and life expectancy (Global Health Estimates 2021)' },
      url: 'https://data.who.int/indicators/i/C64284D',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'IMF, World Economic Outlook（台灣的購買力平價）', en: 'IMF, World Economic Outlook (PPP rate for Taiwan)' },
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明出處', en: 'Attribution' },
    },
    LONG_RUN_SOURCE,
  ],
  note: {
    zh: '平均壽命與嬰幼兒死亡率是聯合國用同一套方法估計的，可能跟各國官方統計不同。台灣改用內政部的簡易生命表（1992 年起），聯合國對台灣嬰幼兒死亡率的估計低了不少，例如 2023 年的嬰兒死亡率聯合國估 3.0‰，內政部是 4.3‰。醫療支出、醫師、護理人員與病床數的台灣資料來自衛生福利部；台灣的家庭自付含營養保健食品與民俗療法，範圍比多數國家寬。' +
      '健康平均餘命與不健康的年數是 WHO 的估計（到 2021 年，地圖在之後的年份用 2021 年的值），每次發布會整個重算；台灣用衛福部的 2010、2020 年男女數字，算法不同（Sullivan 法、失能比例取自國健署的調查），不能直接比，衛福部沒有兩性合計。',
    en: "Life expectancy and child mortality are UN estimates made with one method for every country and may differ from official national figures. For Taiwan the Ministry of the Interior's abridged life tables are used instead (from 1992), as the UN estimates of Taiwan's child mortality are noticeably lower: 3.0‰ versus the official 4.3‰ for infant mortality in 2023, for example. Taiwan's health spending, physician, nurse and hospital bed figures come from the Ministry of Health and Welfare; Taiwan's out-of-pocket spending also counts health supplements and folk remedies, a wider scope than most countries. " +
      'Healthy life expectancy and years in poor health are WHO estimates (to 2021; later years on the map show 2021), recalculated in full with each release. Taiwan uses the Ministry of Health and Welfare’s figures for men and women in 2010 and 2020, calculated differently (the Sullivan method with disability rates from Health Promotion Administration surveys), so they are not directly comparable; the ministry gives no figure for both sexes.',
  },
  panelExtra: () => import('./panels/HealthPanel'),
  indicators: [
    {
      id: 'life-expectancy',
      label: { zh: '平均壽命', en: 'Life expectancy' },
      description: {
        zh: '出生時的平均餘命：照當年各年齡的死亡率，一個新生兒預期可以活幾歲。',
        en: "Life expectancy at birth: how long a newborn would live on average at that year's death rates for each age.",
      },
      unit: YEARS,
      file: 'life-expectancy.json',
      events: [COVID],
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 60, 65, 70, 75, 80] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'hale',
      label: { zh: '健康平均餘命', en: 'Healthy life expectancy' },
      description: {
        zh: '出生時預期能健康地（沒有失能或重病）活幾年，WHO 依各年齡的死亡率與失能程度估計。2021 年新加坡 73.6、日本 73.4、南韓 72.5 歲最高，賴索托 44.6 歲最低，美國 63.9 歲。台灣用衛福部的數字（2020 年男性 70.9、女性 75.8 歲），算法跟 WHO 不同、只有男女分開，在女性、男性看得到。',
        en: 'How many years a newborn can expect to live in good health (without disability or serious illness), estimated by WHO from death rates and levels of disability at each age. In 2021 Singapore (73.6), Japan (73.4) and South Korea (72.5) were highest, Lesotho lowest at 44.6, and the US at 63.9. Taiwan uses Ministry of Health and Welfare figures (70.9 for men and 75.8 for women in 2020), calculated differently and only for men and women, so Taiwan appears under Women and Men.',
      },
      unit: YEARS,
      file: 'hale/{item}.json',
      dimension: SEX,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 55, 60, 65, 70] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'unhealthy',
      label: { zh: '不健康的年數', en: 'Years in poor health' },
      description: {
        zh: '平均壽命減掉健康平均餘命：一生中預期有幾年帶著疾病或失能（都用 WHO 同一次的估計）。2021 年澳洲、美國 12.5 年最多；平均壽命短的國家反而少（索馬利亞 6.5 年），因為能活到慢性病多的老年的人少。台灣 2020 年男性 7.2、女性 8.9 年（衛福部）。',
        en: 'Life expectancy minus healthy life expectancy: the years a person can expect to live with illness or disability (both from the same WHO estimates). In 2021 Australia and the US were highest at 12.5 years; countries with short lives have fewer (Somalia 6.5) because fewer people reach the older ages when chronic illness is common. Taiwan: 7.2 years for men and 8.9 for women in 2020 (Ministry of Health and Welfare).',
      },
      unit: YEARS,
      file: 'unhealthy/{item}.json',
      dimension: SEX,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 9, 10, 11, 12] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'infant-mortality',
      label: { zh: '嬰兒死亡率', en: 'Infant mortality' },
      description: {
        zh: '每 1,000 個活產嬰兒中，未滿 1 歲就死亡的人數（‰）。顏色越深死亡率越高。',
        en: 'Deaths before age 1 per 1,000 live births (‰). Darker means higher mortality.',
      },
      unit: '‰',
      file: 'infant-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 100] } },
      format: perThousand,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'under5-mortality',
      label: { zh: '五歲以下死亡率', en: 'Under-5 mortality' },
      description: {
        zh: '每 1,000 個活產嬰兒中，未滿 5 歲就死亡的人數（‰）。顏色越深死亡率越高。',
        en: 'Deaths before age 5 per 1,000 live births (‰). Darker means higher mortality.',
      },
      unit: '‰',
      file: 'under5-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 150] } },
      format: perThousand,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'health-spending-per-capita',
      label: { zh: '人均醫療支出', en: 'Health spending per person' },
      description: {
        zh: '全國一年的經常性醫療支出（政府、保險與民眾自付合計）除以人口，以當年匯率換算成美元。',
        en: 'Current health spending in a year (government, insurance and out-of-pocket combined) divided by population, in US dollars at current exchange rates.',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'health-spending-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 250, 500, 1000, 2500, 5000] } },
      format: (v) => usd(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'health-spending-gdp',
      label: { zh: '醫療支出占 GDP', en: 'Health spending, % of GDP' },
      description: { zh: '經常性醫療支出占國內生產毛額的比例。', en: 'Current health spending as a share of GDP.' },
      unit: '%',
      file: 'health-spending-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 4, 5, 6, 8, 10] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'oop-share',
      label: { zh: '自付醫療費占比', en: 'Out-of-pocket share of health spending' },
      description: {
        zh: '經常性醫療支出中，由民眾看病、買藥時自己掏腰包付的比例（部分負擔、自費項目、非處方藥），不含保費與稅金。比例越高，生病時的經濟負擔越重。',
        en: 'The share of current health spending that people pay directly when they use care (co-payments, uncovered services, over-the-counter medicines), excluding insurance premiums and taxes. The higher it is, the heavier the financial burden of falling ill.',
      },
      unit: '%',
      file: 'oop-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 65] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'oop-per-capita',
      label: { zh: '人均自付醫療費', en: 'Out-of-pocket spending per person' },
      description: {
        zh: '平均每人一年自己付的醫療費，用購買力平價（國際元）換算，扣掉各國物價的差異。',
        en: 'Health spending paid directly by people, per person per year, in purchasing-power-parity international dollars so that price differences between countries are taken out.',
      },
      unit: { zh: '國際元', en: 'Int$' },
      file: 'oop-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 250, 500, 1000] } },
      format: (v) => intlDollars(fixed(v, 0)),
      formatTick: formatLargeTick,
      compareWorld: true,
    },
    {
      id: 'government-share',
      label: { zh: '政府與健保支出占比', en: 'Government & compulsory insurance share' },
      description: {
        zh: '經常性醫療支出中，由政府預算與全民健保、社會保險這類強制性保險支付的比例；其餘是民眾自付、私人保險與國外援助。',
        en: 'The share of current health spending paid by government budgets and compulsory schemes such as national or social health insurance; the rest is out-of-pocket, private insurance and foreign aid.',
      },
      unit: '%',
      file: 'government-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 65, 75, 85] } },
      format: percent,
      formatTick: percentTick,
      compareWorld: true,
    },
    {
      id: 'physicians',
      label: { zh: '每千人醫師數（醫病比）', en: 'Physicians per 1,000 people' },
      description: {
        zh: '常說的「醫病比」：每 1,000 人有幾位醫師（西醫，含一般科與專科，不含中醫等傳統醫學）。例如每千人 2.5 位，等於每位醫師服務 400 人。很多國家不是每年都有統計。',
        en: 'The doctor-to-population ratio: medical doctors per 1,000 people (generalists and specialists, excluding traditional medicine). 2.5 per 1,000, for example, means 400 people per doctor. Many countries do not report every year.',
      },
      unit: PER_1000,
      file: 'physicians.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.2, 0.5, 1, 2, 3, 4] } },
      format: perThousandPeople,
      formatTick: perThousandTick,
      compareWorld: true,
    },
    {
      id: 'nurses',
      label: { zh: '每千人護理人員', en: 'Nurses and midwives per 1,000 people' },
      description: {
        zh: '每 1,000 人有幾位護理與助產人員。台灣常說的「護病比」是醫院裡一位護理人員一班照顧幾位住院病人（衛福部的全日平均護病比），各國沒有一致的這種統計，只有少數研究調查過，所以國際比較用每千人的護理人力。很多國家不是每年都有統計。',
        en: "Nurses and midwives per 1,000 people. Taiwan's usual nurse-to-patient ratio counts the inpatients one hospital nurse looks after per shift; there are no consistent international data on that, only a few research surveys, so international comparisons use the nursing workforce per 1,000 people. Many countries do not report every year.",
      },
      unit: PER_1000,
      file: 'nurses.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 8, 12] } },
      format: perThousandPeople,
      formatTick: perThousandTick,
      compareWorld: true,
    },
    {
      id: 'hospital-beds',
      label: { zh: '每千人病床數', en: 'Hospital beds per 1,000 people' },
      description: {
        zh: '每 1,000 人有幾張醫院病床（公私立的一般與專科醫院，含急性與慢性病床）。很多國家不是每年都有統計。',
        en: 'Hospital beds per 1,000 people (public and private general and specialised hospitals, acute and long-term beds). Many countries do not report every year.',
      },
      unit: { zh: '床/千人', en: 'per 1,000 people' },
      file: 'hospital-beds.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 4, 6, 8] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 床`, en: `${fixed(v, 1)} per 1,000` }),
      formatTick: perThousandTick,
      compareWorld: true,
    },
    {
      id: 'life-expectancy-1800',
      label: { zh: '平均壽命（1800 年起）', en: 'Life expectancy (since 1800)' },
      description: {
        zh: `1800–2023 年出生時的平均餘命。1950 年起主要是 IHME 全球疾病負擔研究的估計，跟上面聯合國 WPP 的指標略有不同。戰爭、饑荒、疫情的年份會突然下降。${LONG_RUN_CAVEAT.zh}`,
        en: `Life expectancy at birth 1800–2023. From 1950 mostly IHME Global Burden of Disease estimates, which differ slightly from the UN WPP indicator above. Wars, famines and epidemics show as sudden drops. ${LONG_RUN_CAVEAT.en}`,
      },
      unit: YEARS,
      file: 'life-expectancy-1800.json',
      events: [FLU_1918, COVID],
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 80] } },
      format: (v) => `${fixed(v, 1)} ${tr(YEARS)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
  ],
};
