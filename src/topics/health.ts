import { tr } from '../i18n/lang';
import { fixed, formatLargeTick, intlDollars, usd } from '../lib/format';
import { LONG_RUN_CAVEAT, LONG_RUN_SOURCE } from './longRun';
import type { CategoryDef, DimensionDef, TopicDefinition } from './types';
import { COVID, FLU_1918 } from './events';
import { topicPart } from './merge';

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

/** 健保制度（pipeline/topics/health_systems.py）：OECD 的四類、英文維基的五類，不互相對應 */
const OECD_SYSTEMS: CategoryDef[] = [
  { value: 1, label: { zh: '國家衛生服務', en: 'National health system' } },
  { value: 2, label: { zh: '單一保險人', en: 'Single insurance fund' } },
  { value: 3, label: { zh: '多個保險人', en: 'Multiple insurers' } },
  { value: 4, label: { zh: '地方衛生體系', en: 'Local health systems' } },
];
const FINANCING: CategoryDef[] = [
  { value: 1, label: { zh: '政府單一支付', en: 'Single-payer' } },
  { value: 2, label: { zh: '社會保險', en: 'Social insurance' } },
  { value: 3, label: { zh: '公私混合', en: 'Public–private mix' } },
  { value: 4, label: { zh: '私人保險為主', en: 'Private insurance' } },
  { value: 5, label: { zh: '社區健康保險', en: 'Community-based insurance' } },
];
const categoryLabel = (cats: CategoryDef[]) => (v: number) =>
  tr(cats.find((c) => c.value === v)?.label ?? { zh: '其他', en: 'Other' });

const healthOwn: TopicDefinition = {
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
        zh: 'World Bank, World Development Indicators（WHO 醫療支出與醫事人力資料、孕產婦死亡率的 MMEIG 估計）',
        en: 'World Bank, World Development Indicators (WHO health spending and workforce data, MMEIG maternal mortality estimates)',
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
      name: { zh: '內政部戶政司，出生數（台灣的孕產婦死亡率）', en: 'Department of Household Registration, MOI (Taiwan), births (maternal mortality)' },
      url: 'https://www.ris.gov.tw/app/portal/346',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'WHO 健康平均餘命與平均壽命（Global Health Estimates 2023）', en: 'WHO healthy life expectancy and life expectancy (Global Health Estimates 2023)' },
      url: 'https://data.who.int/indicators/i/C64284D',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'IMF, World Economic Outlook（台灣的購買力平價）', en: 'IMF, World Economic Outlook (PPP rate for Taiwan)' },
      url: 'https://www.imf.org/external/datamapper/',
      license: { zh: '註明出處', en: 'Attribution' },
    },
    {
      name: {
        zh: 'OECD Health Statistics：Long-term care resources and utilisation（長照床數、使用長照的人）',
        en: 'OECD Health Statistics: Long-term care resources and utilisation (beds and recipients)',
      },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: 'OECD Health Statistics：Intensive care unit beds（加護病床）',
        en: 'OECD Health Statistics: Intensive care unit beds',
      },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: 'OECD Health Statistics：Surgical procedures（腹腔鏡手術的比例）',
        en: 'OECD Health Statistics: Surgical procedures (laparoscopic share)',
      },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: '衛生福利部中央健康保險署「診療項目醫令申報量(年)」（台灣的腹腔鏡手術比例，2016–2025 年）',
        en: 'National Health Insurance Administration (Taiwan), annual claims by procedure code (Taiwan laparoscopic shares, 2016–2025)',
      },
      url: 'https://data.gov.tw/dataset/175960',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'OECD Health Care Quality Indicators：Patient safety（產道撕裂傷）',
        en: 'OECD Health Care Quality Indicators: Patient safety (obstetric trauma)',
      },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: { zh: 'OECD Health Statistics：Doctors consultations（遠距問診）', en: 'OECD Health Statistics: Doctors consultations (teleconsultations)' },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: '衛生福利部：醫事機構服務量統計年報表 18（一般護理之家）、社會福利公務統計 2.4.6（老人長期照顧、安養機構概況）、4.1（長照 2.0 照顧服務，附註）',
        en: 'Ministry of Health and Welfare (Taiwan): health facility service statistics table 18 (nursing homes), social welfare statistics 2.4.6 (long-term care institutions for the elderly) and 4.1 (Long-term Care 2.0 care services, in the notes)',
      },
      url: 'https://dep.mohw.gov.tw/DOS/np-5308-113.html',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'OECD, Health System Characteristics Survey 2023（基本醫療保障的主要來源）', en: 'OECD, Health System Characteristics Survey 2023 (main source of basic coverage)' },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
    {
      name: {
        zh: '英文維基百科「Health care systems by country」（revid 1379352169）與「Universal health care」（revid 1382403456）的表（醫療的主要財源、全民健保的開辦年份）',
        en: 'English Wikipedia, “Health care systems by country” (revid 1379352169) and “Universal health care” (revid 1382403456) tables (financing, start of universal coverage)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Health_care_systems_by_country&oldid=1379352169',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '全國法規資料庫，全民健康保險法（台灣的保險人）', en: 'Laws & Regulations Database (Taiwan), National Health Insurance Act' },
      url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0060001',
      license: OPEN_DATA_TW,
    },
    LONG_RUN_SOURCE,
  ],
  note: {
    zh: '平均壽命與嬰幼兒死亡率是聯合國用同一套方法估計的，可能跟各國官方統計不同。台灣改用內政部的簡易生命表（1992 年起），聯合國對台灣嬰幼兒死亡率的估計低了不少，例如 2023 年的嬰兒死亡率聯合國估 3.0‰，內政部是 4.3‰。醫療支出、醫師、護理人員與病床數的台灣資料來自衛生福利部；台灣的家庭自付含營養保健食品與民俗療法，範圍比多數國家寬。' +
      '健康平均餘命與不健康的年數是 WHO 的估計（Global Health Estimates 2023，到 2023 年，地圖在之後的年份用 2023 年的值），每次發布會整個重算；台灣用衛福部的 2010、2020 年男女數字，算法不同（Sullivan 法、失能比例取自國健署的調查），不能直接比，衛福部沒有兩性合計。醫療的主要財源、全民健保的開辦年份取自英文維基百科的表（CC BY-SA 4.0），這兩個資料檔也依 CC BY-SA 4.0 分享。',
    en: "Life expectancy and child mortality are UN estimates made with one method for every country and may differ from official national figures. For Taiwan the Ministry of the Interior's abridged life tables are used instead (from 1992), as the UN estimates of Taiwan's child mortality are noticeably lower: 3.0‰ versus the official 4.3‰ for infant mortality in 2023, for example. Taiwan's health spending, physician, nurse and hospital bed figures come from the Ministry of Health and Welfare; Taiwan's out-of-pocket spending also counts health supplements and folk remedies, a wider scope than most countries. " +
      'Healthy life expectancy and years in poor health are WHO estimates (Global Health Estimates 2023, to 2023; later years on the map show 2023), recalculated in full with each release. Taiwan uses the Ministry of Health and Welfare’s figures for men and women in 2010 and 2020, calculated differently (the Sullivan method with disability rates from Health Promotion Administration surveys), so they are not directly comparable; the ministry gives no figure for both sexes. Health financing and the start of universal coverage come from English Wikipedia tables (CC BY-SA 4.0), and those two data files are shared under CC BY-SA 4.0 as well.',
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
        zh: '出生時預期能健康地（沒有失能或重病）活幾年，WHO 依各年齡的死亡率與失能程度估計。2023 年新加坡 72.9、日本 72.2、南韓 72.0 歲最高，中非 44.7、賴索托 47.9 歲最低，美國 64.6 歲。台灣用衛福部的數字（2020 年男性 70.9、女性 75.8 歲），算法跟 WHO 不同、只有男女分開，在女性、男性看得到。',
        en: 'How many years a newborn can expect to live in good health (without disability or serious illness), estimated by WHO from death rates and levels of disability at each age. In 2023 Singapore (72.9), Japan (72.2) and South Korea (72.0) were highest, the Central African Republic (44.7) and Lesotho (47.9) lowest, and the US at 64.6. Taiwan uses Ministry of Health and Welfare figures (70.9 for men and 75.8 for women in 2020), calculated differently and only for men and women, so Taiwan appears under Women and Men.',
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
        zh: '平均壽命減掉健康平均餘命：一生中預期有幾年帶著疾病或失能（都用 WHO 同一次的估計）。2023 年美國 13.9、加拿大與澳洲 13.5 年最多；平均壽命短的國家反而少（索馬利亞 7.0 年），因為能活到慢性病多的老年的人少。台灣 2020 年男性 7.2、女性 8.9 年（衛福部）。',
        en: 'Life expectancy minus healthy life expectancy: the years a person can expect to live with illness or disability (both from the same WHO estimates). In 2023 the US (13.9 years), Canada and Australia (13.5) were highest; countries with short lives have fewer (Somalia 7.0) because fewer people reach the older ages when chronic illness is common. Taiwan: 7.2 years for men and 8.9 for women in 2020 (Ministry of Health and Welfare).',
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
      id: 'maternal-mortality',
      label: { zh: '孕產婦死亡率', en: 'Maternal mortality ratio' },
      description: {
        zh: '每 10 萬個活產，有幾位母親在懷孕期間或產後 42 天內因懷孕相關的原因死亡（不含意外），WHO 等機構的模型估計。2023 年奈及利亞 993、查德 748 最高，挪威、白俄羅斯 1 最低，日本 3、南韓 4、中國 16、美國 17；世界 197。台灣依同樣的定義用衛福部死因統計自己算，2023 年約 9。',
        en: 'Deaths of mothers from pregnancy-related causes during pregnancy or within 42 days after (excluding accidents) per 100,000 live births, modelled estimates by WHO and partner agencies. In 2023 Nigeria (993) and Chad (748) were highest and Norway and Belarus lowest at 1; Japan 3, South Korea 4, China 16, the US 17; 197 worldwide. Taiwan is computed with the same definition from its death statistics: about 9 in 2023.',
      },
      unit: { zh: '每十萬活產', en: 'per 100,000 live births' },
      file: 'maternal-mortality.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 50, 100, 200, 500] } },
      format: (v) => tr({ zh: `每十萬活產 ${fixed(v, v < 10 ? 1 : 0)}`, en: `${fixed(v, v < 10 ? 1 : 0)} per 100,000` }),
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
        zh: '常說的「醫病比」：每 1,000 人有幾位醫師（西醫，含一般科與專科，不含中醫等傳統醫學）。例如每千人 2.5 位，等於每位醫師服務 400 人。很多國家不是每年都有統計。WHO 另有「傳統與輔助醫學專業人員數」，但只在 GHO 資料庫、WHO 資料平臺（data.who.int）沒有這個指標，依本站的規則不用；台灣的中醫師人數見「台灣的中醫」主題（2025 年底 8,234 人，是西醫師的 14.6%）。',
        en: 'The doctor-to-population ratio: medical doctors per 1,000 people (generalists and specialists, excluding traditional medicine). 2.5 per 1,000, for example, means 400 people per doctor. Many countries do not report every year. WHO also publishes a count of traditional and complementary medicine professionals, but only in the GHO database and not on the WHO Data platform (data.who.int), so under this site’s rules it is not used; for Taiwan’s Chinese medicine physicians see the Chinese medicine in Taiwan topic (8,234 at the end of 2025, 14.6% as many as Western medicine physicians).',
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
      id: 'icu-beds',
      label: { zh: '加護病床', en: 'Intensive care beds' },
      description: {
        zh: '每十萬人有幾張加護病床（ICU，含成人、兒科、新生兒加護），是重症的承載力，跟「每千人病床數」算的是全部病床不同。土耳其 57.3、捷克 52.5、阿根廷 41.7、愛沙尼亞 40.1 最多，台灣 32.8（2025 年，衛福部的加護病床加燒傷加護病床），法國 31.6、德國 31.1、美國 29.4，南韓 23.2、日本 20.8；愛爾蘭 6.6、瑞典 5.6、冰島 5.2、哥斯大黎加 4.3 最少。各國的定義差很多：捷克、土耳其、愛沙尼亞把高依賴病床也算進去，瑞典、荷蘭只算真正的加護病床，OECD 自己也說只能大略比較。只有 OECD 的 35 國與台灣，各國用 5 年內最近的一年。',
        en: 'Intensive care (ICU) beds per 100,000 people, including adult, paediatric and neonatal ICUs: capacity for critical care, unlike “hospital beds per 1,000”, which counts all beds. Türkiye (57.3), Czechia (52.5), Argentina (41.7) and Estonia (40.1) have the most; Taiwan 32.8 (2025, intensive care plus burn intensive care beds from the Ministry of Health and Welfare), France 31.6, Germany 31.1, the US 29.4, South Korea 23.2, Japan 20.8; Ireland (6.6), Sweden (5.6), Iceland (5.2) and Costa Rica (4.3) the fewest. Definitions differ widely: Czechia, Türkiye and Estonia include high-dependency beds while Sweden and the Netherlands count only true ICU beds, and the OECD itself says comparisons are limited. Only the 35 OECD-reporting countries and Taiwan; each shows its latest year within five.',
      },
      unit: { zh: '每十萬人', en: 'per 100,000' },
      file: 'icu-beds.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 12, 18, 25, 32, 40] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 1)} 床`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'icu-beds-adult',
      label: { zh: '成人加護病床', en: 'Adult intensive care beds' },
      description: {
        zh: '每十萬人有幾張成人加護病床（OECD 的 33 國）。捷克 44.5、愛沙尼亞 40.1、土耳其 38.3、德國 27.7、法國 26.4 最多；南韓 19.3、日本 15.5；愛爾蘭 6.2、荷蘭 5.6、瑞典 4.4、哥斯大黎加 2.5 最少。台灣的統計不分成人、兒科，見「加護病床」。定義各國不同，只能大略比較。',
        en: 'Adult intensive care beds per 100,000 people (33 OECD-reporting countries). Czechia (44.5), Estonia (40.1), Türkiye (38.3), Germany (27.7) and France (26.4) have the most; South Korea 19.3, Japan 15.5; Ireland (6.2), the Netherlands (5.6), Sweden (4.4) and Costa Rica (2.5) the fewest. Taiwan does not separate adult and paediatric beds; see “Intensive care beds”. Definitions differ between countries, so comparisons are approximate.',
      },
      unit: { zh: '每十萬人', en: 'per 100,000' },
      file: 'icu-beds-adult.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 12, 18, 25, 32, 40] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 1)} 床`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'surgery',
      label: { zh: '每十萬人手術量', en: 'Surgical procedures per 100,000' },
      description: {
        zh: '一年在開刀房、要全身或區域麻醉的手術，每十萬人幾次（世界銀行，原始來源是 Lancet 全球外科委員會）。哥倫比亞 2015 年 27,385、瑞士 2012 年 25,923、丹麥 21,197 最多；孟加拉、葉門、烏干達不到 200，查德、剛果共和國約 50，差了 500 倍。台灣用衛福部的醫院手術人次，2025 年每十萬人約 1 萬次（含門診小手術，定義比較寬）。年份很零散，2015 年以前全球幾乎沒有手術統計，各國用 10 年內最近的一年；哥倫比亞第一可能是把門診小手術也算進去，不代表醫療最發達。',
        en: 'Surgical procedures in an operating theatre under general or regional anaesthesia per 100,000 people per year (World Bank, from the Lancet Commission on Global Surgery). Colombia (27,385 in 2015), Switzerland (25,923 in 2012) and Denmark (21,197) are highest; Bangladesh, Yemen and Uganda are below 200, and Chad and the Republic of the Congo about 50, a 500-fold gap. Taiwan uses hospital operations from the Ministry of Health and Welfare, about 10,000 per 100,000 in 2025 (including minor outpatient procedures, a broader definition). Years are scattered, since there were almost no surgical statistics before 2015; each country shows its latest year within ten. Colombia may rank first because minor outpatient procedures are included, not because its care is the most advanced.',
      },
      unit: { zh: '每十萬人', en: 'per 100,000' },
      file: 'surgery.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 3000, 5000, 10000, 15000] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 0)} 次`, en: `${fixed(v, 0)} per 100,000` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'surgical-workforce',
      label: { zh: '外科、麻醉、婦產科醫師', en: 'Surgical, anaesthesia and obstetric specialists' },
      description: {
        zh: '每十萬人有幾位外科、麻醉科與婦產科專科醫師（世界銀行，2013–2018 年，各國用 10 年內最近的一年）。摩納哥 195.6、希臘 163.5、義大利 142.4 最多；索馬利亞、獅子山不到 0.2，阿富汗 0.03。Lancet 全球外科委員會建議至少每十萬人 20 位。台灣沒有這項統計。',
        en: 'Surgical, anaesthesia and obstetric specialists per 100,000 people (World Bank, 2013–2018; each country shows its latest year within ten). Monaco (195.6), Greece (163.5) and Italy (142.4) are highest; Somalia and Sierra Leone are below 0.2 and Afghanistan 0.03. The Lancet Commission on Global Surgery recommends at least 20 per 100,000. Taiwan has no matching statistic.',
      },
      unit: { zh: '每十萬人', en: 'per 100,000' },
      file: 'surgical-workforce.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 20, 50, 100] } },
      format: (v) => tr({ zh: `每十萬人 ${fixed(v, 1)} 位`, en: `${fixed(v, 1)} per 100,000` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'laparoscopic',
      label: { zh: '微創（腹腔鏡）手術的比例', en: 'Laparoscopic (keyhole) surgery share' },
      description: {
        zh: '常見手術裡，用腹腔鏡（微創、開小洞）做的占幾 %，選上方的「手術」切換（OECD，同一年的腹腔鏡手術數 ÷ 全部手術數，住院加當日手術）。疝氣修補：挪威 76.9%、盧森堡 71.7%、丹麥 70.8%、瑞士 65.1%；瑞典 10.3%、克羅埃西亞 9.9%、義大利 7.8%、塞爾維亞 5.0%、北馬其頓 2.0%。闌尾切除：加拿大 96.3%、荷蘭、以色列 95.8%；羅馬尼亞 39.4%、哥倫比亞 28.5%、保加利亞 25.6%。膽囊切除幾乎都是腹腔鏡（冰島 98.4%、挪威 97.8%），墨西哥 55.0% 最低。只有 OECD 的約 40 國，各國用 5 年內最近的一年。台灣用健保署的醫令申報量（申報量不是病人數，疝氣是鼠蹊加股疝氣）：2024 年闌尾切除 91.9%、膽囊切除 91.5%、疝氣修補 48.4%（2016 年只有 13.7%；2022 年新的腹腔鏡代碼上路後跳了一階）。',
        en: 'Share of common operations done laparoscopically (keyhole surgery); switch with “Operation” above (OECD; laparoscopic procedures ÷ all procedures in the same year, inpatient plus day cases). Hernia repair: Norway 76.9%, Luxembourg 71.7%, Denmark 70.8%, Switzerland 65.1%; Sweden 10.3%, Croatia 9.9%, Italy 7.8%, Serbia 5.0%, North Macedonia 2.0%. Appendectomy: Canada 96.3%, the Netherlands and Israel 95.8%; Romania 39.4%, Colombia 28.5%, Bulgaria 25.6%. Gallbladder removal is almost always laparoscopic (Iceland 98.4%, Norway 97.8%), with Mexico lowest at 55.0%. Only about 40 OECD-reporting countries; each shows its latest year within five. Taiwan uses National Health Insurance claims (claims rather than patients; hernia is inguinal plus femoral): in 2024 appendectomy 91.9%, gallbladder removal 91.5% and hernia repair 48.4% (only 13.7% in 2016, with a jump in 2022 after new laparoscopic codes took effect).',
      },
      unit: '%',
      file: 'laparoscopic-{item}.json',
      dimension: {
        label: { zh: '手術', en: 'Operation' },
        options: [
          { id: 'hernia', label: { zh: '腹股溝疝氣修補', en: 'Inguinal hernia repair' } },
          { id: 'appendix', label: { zh: '闌尾切除', en: 'Appendectomy' } },
          { id: 'gallbladder', label: { zh: '膽囊切除', en: 'Cholecystectomy' } },
        ],
        defaultOption: 'hernia',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 20, 30, 45, 60, 70] },
        itemScales: {
          appendix: { type: 'sequential', thresholds: [40, 60, 75, 85, 90, 95] },
          gallbladder: { type: 'sequential', thresholds: [70, 85, 90, 93, 95, 97] },
        },
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'obstetric-trauma',
      label: { zh: '生產造成的產道嚴重撕裂傷', en: 'Obstetric trauma in childbirth' },
      description: {
        zh: '每 100 次陰道生產，發生三度、四度產道撕裂傷（傷到肛門括約肌）的次數，選上方的「生產方式」切換（OECD 的病人安全指標）。器械助產（真空吸引或產鉗）：加拿大 16.1（2023 年）、美國 11.7、丹麥 11.6、瑞典 9.4；以色列 1.8、立陶宛 1.4、波蘭 1.2。非器械助產：加拿大 4.0、冰島 3.1、丹麥 3.0；波蘭 0.3。注意：高的國家多半是記錄得完整（產後有仔細檢查、照實編碼），低的國家可能是漏記，OECD 自己也提醒這點，這張圖主要看通報文化，不是照護好壞。只有 32 國，各國用 5 年內最近的一年；台灣沒有向 OECD 回報。',
        en: 'Third- and fourth-degree perineal tears (reaching the anal sphincter) per 100 vaginal deliveries; switch with “Delivery” above (an OECD patient-safety indicator). With instruments (vacuum or forceps): Canada 16.1 (2023), the US 11.7, Denmark 11.6, Sweden 9.4; Israel 1.8, Lithuania 1.4, Poland 1.2. Without instruments: Canada 4.0, Iceland 3.1, Denmark 3.0; Poland 0.3. Note that high rates mostly reflect thorough recording (careful post-birth checks and accurate coding), while low rates may mean under-recording, as the OECD itself warns: this map mainly shows reporting culture, not quality of care. Only 32 countries; each shows its latest year within five. Taiwan does not report to the OECD.',
      },
      unit: { zh: '每 100 次生產', en: 'per 100 deliveries' },
      file: 'obstetric-trauma-{item}.json',
      dimension: {
        label: { zh: '生產方式', en: 'Delivery' },
        options: [
          { id: 'instrument', label: { zh: '器械助產（真空吸引、產鉗）', en: 'With instruments (vacuum, forceps)' } },
          { id: 'spontaneous', label: { zh: '非器械助產', en: 'Without instruments' } },
        ],
        defaultOption: 'instrument',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [2, 4, 5, 6, 8, 10] },
        itemScales: { spontaneous: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2, 2.5, 3] } },
      },
      format: (v) => tr({ zh: `每 100 次 ${fixed(v, 1)} 次`, en: `${fixed(v, 1)} per 100` }),
      formatTick: (v) => fixed(v, v < 2 ? 1 : 0),
    },
    {
      id: 'teleconsult-share',
      label: { zh: '遠距問診的比例', en: 'Share of doctor consultations held remotely' },
      description: {
        zh: '看醫師的次數裡，用電話或視訊（遠距）的占幾 %（OECD，遠距問診 ÷ 全部問診）。愛沙尼亞 36.2%（2024 年，2015 年才 5.9%）、以色列 30.7%（2025 年）、葡萄牙 25.9%、瑞典 25.0%、丹麥 24.2%、芬蘭 23.8%；德國 1.0%，南韓、盧森堡、羅馬尼亞是 0。拉時間軸看 2020 年 COVID-19 的跳升與之後回落：加拿大 2020 年 27.7%、2023 年 10.0%，法國 2019 年 0、2020 年 5.7%。「什麼算遠距問診」各國不同（電話算不算、有沒有給付），只有 OECD 的 25 國算得出來，各國用 3 年內最近的一年；台灣健保有通訊診察治療的申報，但沒有可下載的全國數字。',
        en: 'Share of doctor consultations held by phone or video (OECD; teleconsultations ÷ all consultations). Estonia 36.2% (2024, up from 5.9% in 2015), Israel 30.7% (2025), Portugal 25.9%, Sweden 25.0%, Denmark 24.2%, Finland 23.8%; Germany 1.0%, and zero in South Korea, Luxembourg and Romania. Drag the timeline to see the COVID-19 jump in 2020 and the fall after: Canada 27.7% in 2020 and 10.0% in 2023; France from zero in 2019 to 5.7% in 2020. Countries count teleconsultations differently (whether phone calls count, whether they are billed); only 25 OECD countries can be computed, each showing its latest year within three. Taiwan’s insurer reports telemedicine claims, but no downloadable national figures were found.',
      },
      unit: '%',
      file: 'teleconsult-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 15, 20, 30] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'teleconsult-per-person',
      label: { zh: '每人每年遠距問診次數', en: 'Teleconsultations per person a year' },
      description: {
        zh: '平均每人一年跟醫師遠距問診幾次（OECD，27 國）。以色列 3.1 次（2025 年）、愛沙尼亞 2.1、克羅埃西亞與丹麥 1.6、西班牙 1.5、葡萄牙 1.4；南韓、盧森堡、羅馬尼亞、希臘是 0。OECD 只到小數一位，不到 0.05 次的寫成 0。',
        en: 'Average teleconsultations with a doctor per person a year (OECD, 27 countries). Israel 3.1 (2025), Estonia 2.1, Croatia and Denmark 1.6, Spain 1.5, Portugal 1.4; zero in South Korea, Luxembourg, Romania and Greece. The OECD reports one decimal place, so anything under 0.05 shows as zero.',
      },
      unit: { zh: '次', en: 'consultations' },
      file: 'teleconsult-per-person.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.3, 0.6, 1, 1.5, 2] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 次`, en: `${fixed(v, 1)}` }),
      formatTick: (v) => fixed(v, 1),
    },
    {
      id: 'ltc-beds',
      label: { zh: '長照機構床數（每千名 65 歲以上）', en: 'Long-term care beds per 1,000 aged 65+' },
      description: {
        zh: '護理之家等長期照顧機構的床數，每 1,000 名 65 歲以上的人有幾床（OECD，不含醫院的病床）。盧森堡 77、荷蘭 68、瑞典 63、比利時 62 最多；德國 53、加拿大 43、英國 41；美國 27、日本 27、韓國 25；土耳其 9、葡萄牙 4、希臘 1。台灣 21（2025 年）：衛福部的一般護理之家加上社家署的老人長期照顧機構（不含安養機構、榮民之家）。各國對「長照機構」的定義不同，南歐多由家人照顧。',
        en: 'Beds in nursing homes and other long-term care institutions per 1,000 people aged 65 and over (OECD; hospital beds are not included). Luxembourg 77, the Netherlands 68, Sweden 63 and Belgium 62 are highest; Germany 53, Canada 43, the UK 41; the US 27, Japan 27, South Korea 25; Türkiye 9, Portugal 4, Greece 1. Taiwan 21 (2025): general nursing homes (Ministry of Health and Welfare) plus long-term care institutions for the elderly (Social and Family Affairs Administration), excluding residential homes and veterans’ homes. Definitions differ between countries, and in southern Europe families provide much of the care.',
      },
      unit: { zh: '床/千名 65 歲以上', en: 'per 1,000 aged 65+' },
      file: 'ltc-beds.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] } },
      format: (v) => tr({ zh: `每千名長者 ${fixed(v, 1)} 床`, en: `${fixed(v, 1)} per 1,000 aged 65+` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'ltc-recipients',
      label: { zh: '65 歲以上使用長照的比例', en: 'Aged 65+ receiving long-term care' },
      description: {
        zh: '65 歲以上的人有多少比例在使用長期照顧（住在機構加上在家接受服務，OECD，兩者同一年都有的國家）。立陶宛 47%、以色列 33%、瑞士 24%、德國 24%；瑞典 15%、韓國 12%、荷蘭 11%、法國 9%、波蘭 5%。各國算法差很多：立陶宛、以色列算進領現金給付的人，所以特別高。台灣沒有可以比的數字（長照 2.0 的服務人數見附註）。',
        en: 'Share of people aged 65 and over receiving long-term care (in institutions plus at home, OECD; countries reporting both for the same year). Lithuania 47%, Israel 33%, Switzerland 24%, Germany 24%; Sweden 15%, South Korea 12%, the Netherlands 11%, France 9%, Poland 5%. Definitions vary widely: Lithuania and Israel count people receiving cash benefits, which makes them especially high. There is no comparable figure for Taiwan (see the notes for Long-term Care 2.0 service users).',
      },
      unit: '%',
      file: 'ltc-recipients.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: (v) => tr({ zh: `${fixed(v, 1)}% 使用長照`, en: `${fixed(v, 1)}% receiving care` }),
      formatTick: percentTick,
      noValue: { TWN: { zh: '沒有可以跟 OECD 比的數字', en: 'No figure comparable with the OECD data' } },
    },
    {
      id: 'health-system',
      label: { zh: '健保制度（OECD 的分類）', en: 'Health coverage system (OECD)' },
      description: {
        zh: '基本醫療保障主要來自哪一種制度（OECD 2023 年的問卷，各國自己回答，32 國）：國家衛生服務（稅收支應的公立體系，英國、加拿大、北歐、南歐等 11 國）、單一保險人（一個公營保險，韓國、法國、波蘭等 9 國）、多個保險人（德國、日本、荷蘭、瑞士、美國等 11 國）、地方衛生體系（瑞典）。多數國家其實是混合制。台灣不在 OECD 裡，依《全民健康保險法》由中央健康保險署擔任唯一的保險人，是單一保險人。其他國家看「醫療的主要財源」。',
        en: 'Where basic health coverage mainly comes from (OECD 2023 survey, self-reported, 32 countries): a national health system (tax-funded public system: the UK, Canada, the Nordic and southern European countries, 11 in all), a single insurance fund (one public insurer: South Korea, France, Poland and others, 9), multiple insurers (Germany, Japan, the Netherlands, Switzerland, the US and others, 11) or local health systems (Sweden). Most countries are in fact mixed. Taiwan is not in the OECD; under the National Health Insurance Act the National Health Insurance Administration is the sole insurer, a single insurance fund. For other countries see “Health financing”.',
      },
      unit: '',
      file: 'health-system.json',
      layer: { kind: 'categorical', categories: OECD_SYSTEMS },
      format: categoryLabel(OECD_SYSTEMS),
      unranked: true,
      rankingBars: false,
      panelChart: false,
      coverage: {
        countries: ['AUS', 'AUT', 'BEL', 'BGR', 'CAN', 'CRI', 'CZE', 'DEU', 'ESP', 'EST', 'FIN', 'FRA', 'GBR', 'GRC', 'HUN', 'IRL', 'ISL', 'ISR', 'JPN', 'KOR', 'LTU', 'LUX', 'LVA', 'NLD', 'NOR', 'POL', 'PRT', 'SVK', 'SVN', 'SWE', 'CHE', 'USA', 'CHL', 'TWN'],
        reason: { zh: '不在 OECD 的調查裡（見「醫療的主要財源」）', en: 'Not in the OECD survey (see “Health financing”)' },
      },
    },
    {
      id: 'health-financing',
      label: { zh: '醫療的主要財源（維基百科的分類）', en: 'Health financing (Wikipedia)' },
      description: {
        zh: '英文維基百科「Health care systems by country」表整理的主要財源（2026 年 10 月 9 日的版本，99 國；表上 N/A 的不畫）：政府單一支付（40 國，稅收的國家衛生服務與單一公營保險都算，英國、加拿大、巴西、台灣）、社會保險（41 國：日本、韓國、中國、印尼、俄羅斯）、公私混合（10 國：澳洲、墨西哥、阿根廷、土耳其；美國是沒有全民保障的混合制）、私人保險為主（強制投保：荷蘭、瑞士、以色列、列支敦斯登）、社區健康保險（衣索比亞、馬利、塞內加爾、坦尚尼亞）。分類跟 OECD 不同，不能對應；各國的附註寫表上的原文與出處。',
        en: 'Main source of health financing as compiled in the English Wikipedia table “Health care systems by country” (version of 9 October 2026, 99 countries; N/A entries are not shown): single-payer (40, covering both tax-funded national health services and single public insurers: the UK, Canada, Brazil, Taiwan), social insurance (41: Japan, South Korea, China, Indonesia, Russia), public–private mix (10: Australia, Mexico, Argentina, Türkiye; the US is a mixed, non-universal system), private insurance (compulsory: the Netherlands, Switzerland, Israel, Liechtenstein) and community-based insurance (Ethiopia, Mali, Senegal, Tanzania). The categories differ from the OECD’s and cannot be matched; each country’s note gives the table entry and its source.',
      },
      unit: '',
      file: 'health-financing.json',
      defaultYear: 2026,
      layer: { kind: 'categorical', categories: FINANCING },
      format: categoryLabel(FINANCING),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'uhc-start',
      label: { zh: '全民健保的開辦年份', en: 'Universal health care since' },
      description: {
        zh: '開始有全民醫療保障的年份（英文維基百科「Universal health care」的表，44 個國家與地區，出處是紐約州衛生署）：俄羅斯 1918（蘇聯）、紐西蘭 1938、德國 1941、英國 1948、日本 1961、加拿大 1966、韓國 1988、台灣 1995、泰國 2001、中國 2009、印尼 2014、亞美尼亞 2023。各國的定義不一，有的寫立法的年份，有的寫全面涵蓋的年份。',
        en: 'The year universal health coverage began (English Wikipedia, “Universal health care” table, 44 countries and territories, citing the New York State Department of Health): Russia 1918 (Soviet), New Zealand 1938, Germany 1941, the UK 1948, Japan 1961, Canada 1966, South Korea 1988, Taiwan 1995, Thailand 2001, China 2009, Indonesia 2014, Armenia 2023. Definitions vary: some years are when the law passed, others when coverage became universal.',
      },
      unit: { zh: '年', en: 'year' },
      file: 'uhc-start.json',
      defaultYear: 2026,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1950, 1960, 1970, 1980, 1990, 2000] } },
      format: (v) => tr({ zh: `${v} 年`, en: `since ${v}` }),
      formatTick: (v) => String(v),
      unranked: true,
      rankingBars: false,
      panelChart: false,
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
    {
      id: 'under5-mortality-1800',
      label: { zh: '五歲以下死亡率（1800 年起）', en: 'Under-5 mortality (since 1800)' },
      description: {
        zh: `1800–2021 年每 1,000 個活產嬰兒中未滿 5 歲就死亡的人數（‰）：1800 年各國多在 300–500‰，也就是三到五成的孩子活不到 5 歲。1950 年起主要是聯合國兒童死亡率機構間小組（UN IGME）與 WPP 的估計，跟上面的指標略有不同；2022 年起的值跟之前接不起來（各國在 2021、2022 年之間都有一個落差，應該是換成推估），不收。${LONG_RUN_CAVEAT.zh}`,
        en: `Deaths before age 5 per 1,000 live births (‰), 1800–2021: in 1800 most countries were at 300–500‰, meaning three to five in ten children died before turning five. From 1950 mostly UN IGME and WPP estimates, which differ slightly from the indicator above; from 2022 the series does not join up with earlier years (every country has a jump between 2021 and 2022, most likely a switch to projections), so those years are left out. ${LONG_RUN_CAVEAT.en}`,
      },
      unit: '‰',
      file: 'under5-mortality-1800.json',
      events: [FLU_1918],
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 30, 100, 200, 300, 400] } },
      format: perThousand,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
  ],
};

/**
 * 2026-11-04 主題整併（整1）：健康與醫療原本 31 個指標，拆成三個主題（資料都照舊在 health/，topics/merge.ts）：
 * - 這個主題只留壽命與死亡（平均壽命、健康平均餘命、嬰幼兒與孕產婦死亡、1800 年起的長期序列），改名「各國壽命與死亡率」；
 * - 醫療支出與健保（health-spending.ts）；
 * - 醫療人力與設備（health-care.ts，醫學影像、醫院的表現也併進去）。
 * 舊網址的指標由 redirects.ts 的 INDICATOR_MOVES 轉過去。資料來源依內容分到三個主題（WDI、衛福部統計處三邊都用）；
 * 原本的說明都在講壽命與死亡，留在這裡；側欄的男女平均壽命也只在這裡
 */
const SPENDING_INDICATORS = [
  'health-spending-per-capita',
  'health-spending-gdp',
  'oop-share',
  'oop-per-capita',
  'government-share',
  'health-system',
  'health-financing',
  'uhc-start',
];
const CARE_INDICATORS = [
  'physicians',
  'nurses',
  'hospital-beds',
  'icu-beds',
  'icu-beds-adult',
  'surgery',
  'surgical-workforce',
  'laparoscopic',
  'obstetric-trauma',
  'teleconsult-share',
  'teleconsult-per-person',
  'ltc-beds',
  'ltc-recipients',
];
/**
 * 資料來源的順序：WPP、內政部生命表、WDI、衛福部統計處、戶政司出生數、WHO GHE、IMF、OECD 長照、OECD 加護病床、
 * OECD 手術、健保署醫令、OECD 病人安全、OECD 遠距問診、衛福部長照統計、OECD 健保制度、維基的健保表、全民健康保險法
 */
const sourcesAt = (idx: number[]) => healthOwn.sources.filter((_, i) => idx.includes(i));
const LIFE_SOURCES = [0, 1, 2, 3, 4, 5];
const SPENDING_SOURCES = [2, 3, 6, 14, 15, 16];
const CARE_SOURCES = [2, 3, 7, 8, 9, 10, 11, 12, 13];

export const health: TopicDefinition = {
  ...healthOwn,
  title: { zh: '各國壽命與死亡率', en: 'Life expectancy and mortality by country' },
  shortTitle: { zh: '壽命與死亡', en: 'Life expectancy' },
  sources: sourcesAt(LIFE_SOURCES),
  indicators: healthOwn.indicators.filter((i) => !SPENDING_INDICATORS.includes(i.id) && !CARE_INDICATORS.includes(i.id)),
};

/** 醫療支出與健保（health-spending.ts 的 withParts 接上；不匯出成主題，registry 的 topicOf 才不會拿錯） */
export const healthSpendingPart = topicPart(
  { ...healthOwn, sources: sourcesAt(SPENDING_SOURCES), note: undefined, panelExtra: undefined },
  { only: SPENDING_INDICATORS, name: { zh: '醫療支出與健保', en: 'Health spending and insurance' } },
);

/** 醫療人力與設備（health-care.ts 的 withParts 接上） */
export const healthCarePart = topicPart(
  { ...healthOwn, sources: sourcesAt(CARE_SOURCES), note: undefined, panelExtra: undefined },
  { only: CARE_INDICATORS, name: { zh: '醫療人力與設備', en: 'Health workforce and facilities' } },
);
