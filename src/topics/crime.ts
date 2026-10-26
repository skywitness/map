import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const PER_100K = { zh: '人/十萬人', en: 'per 100,000 people' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };
const per100k = (v: number) => {
  const digits = v < 1 ? 2 : 1;
  return tr({ zh: `${fixed(v, digits)} 人`, en: `${fixed(v, digits)} per 100,000` });
};
// 全部、女性、男性被害率共用同一組門檻，才能互相比較
const HOMICIDE_SCALE = { type: 'sequential' as const, thresholds: [0.5, 1, 2.5, 5, 10, 25] };
const tick = (v: number) => fixed(v, v % 1 === 0 ? 0 : 1);

/**
 * 監禁人口率只收有開放授權資料的國家（Eurostat 的歐洲各國、台灣、美國、加拿大、澳洲、日本）。
 * 要跟 pipeline/topics/crime.py 算出來的國家一致（pipeline 會檢查，不一致就報錯並印出正確的清單）。
 */
const PRISON_COVERAGE = 'ALB AUS AUT BEL BGR BIH CAN CHE CYP CZE DEU DNK ESP EST FIN FRA GBR GRC HRV HUN IRL ISL ITA JPN LIE LTU LUX LVA MKD MLT MNE NLD NOR POL PRT ROU SRB SVK SVN SWE TUR TWN USA XKX';

export const crime: TopicDefinition = {
  id: 'crime',
  title: { zh: '各國治安與司法', en: 'Crime and justice by country' },
  shortTitle: { zh: '治安與司法', en: 'Crime' },
  defaultIndicator: 'homicide',
  defaultYear: 2023,
  sources: [
    {
      name: {
        zh: 'World Bank, World Development Indicators（UNODC 國際殺人統計）',
        en: 'World Bank, World Development Indicators (UNODC International Homicide Statistics)',
      },
      url: 'https://data.worldbank.org/indicator/VC.IHR.PSRC.P5',
      license: 'CC BY 4.0',
    },
    {
      name: 'World Bank, Worldwide Governance Indicators',
      url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '衛生福利部死因統計（台灣的他殺死亡）', en: 'Ministry of Health and Welfare (Taiwan), cause-of-death statistics' },
      url: 'https://dep.mohw.gov.tw/DOS/np-6602-113.html',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '內政部警政署警政統計（台灣的附註）', en: 'National Police Agency (Taiwan), police statistics (notes on Taiwan)' },
      url: 'https://ba.npa.gov.tw/statis/webMain.aspx?k=defjsp',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: 'Eurostat 監獄統計（歐洲）', en: 'Eurostat prison statistics' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/crim_pris_cap/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '法務部法務統計年報', en: 'Ministry of Justice (Taiwan) statistical yearbook' },
      url: 'https://www.rjsd.moj.gov.tw/RJSDWeb/book/Book.aspx?category_id=4',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '美國司法統計局（BJS）', en: 'US Bureau of Justice Statistics' },
      url: 'https://bjs.ojp.gov/library/publications/correctional-populations-united-states-2023-statistical-tables',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      // Statistics Canada Open Licence：改作的要寫「Adapted from」與不代表背書
      name: {
        zh: '改作自加拿大統計局表 35-10-0154-01、35-10-0155-01（不代表該局背書）',
        en: 'Adapted from Statistics Canada, Tables 35-10-0154-01, 35-10-0155-01 (not endorsed by Statistics Canada)',
      },
      url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3510015401',
      license: 'Statistics Canada Open Licence',
    },
    {
      name: { zh: '澳洲統計局（ABS）', en: 'Australian Bureau of Statistics' },
      url: 'https://www.abs.gov.au/statistics/people/crime-and-justice/prisoners-australia/2025',
      license: 'CC BY 4.0',
    },
    {
      // 公共データ利用規約 1.0：要寫出處，加工過的要寫明
      name: { zh: '日本法務省《令和 7 年版 犯罪白書》（加工）', en: 'Ministry of Justice (Japan), White Paper on Crime 2025 (adapted)' },
      url: 'https://hakusyo1.moj.go.jp/jp/72/nfm/n72_2_2_4_2_1.html',
      license: 'PDL 1.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（人口）', en: 'United Nations, World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh:
      '各國不是每年都有殺人統計，地圖顯示 5 年內最近一年的資料。故意殺人率是 UNODC 整理的各國警政或衛生統計，定義跟範圍不完全一致。台灣不在 UNODC 與世界銀行的資料中，改用衛福部死因統計的他殺死亡人數 ÷ 聯合國 WPP 的年中人口（警政署的「故意殺人」含未遂，只寫在附註）。' +
      '監禁人口率刻意只收有開放授權資料的國家（UNODC 資料入口不准轉載、World Prison Brief 沒有授權轉載），其他國家不上色；各國的定義不完全一樣，見各國附註。',
    en:
      'Not every country reports homicides every year; the map shows the most recent figure within five years. Homicide rates are compiled by UNODC from national police or health statistics, whose definitions and coverage differ somewhat. ' +
      "Taiwan is not in the UNODC or World Bank data: its rates use deaths from assault in the Ministry of Health and Welfare's cause-of-death statistics ÷ UN WPP mid-year population (the National Police Agency's intentional homicide figures include attempts and are given in the notes only). " +
      'Prison rates deliberately cover only countries with openly licensed data (the UNODC data portal does not allow redistribution and World Prison Brief grants no licence); other countries are left grey. Definitions differ by country; see each country’s note.',
  },
  // 英文的指標名稱取短的（Homicide、Female victims…）：五個並排時 1280px 寬的控制列才是一行（第 8 節第 43 點）
  indicators: [
    {
      id: 'homicide',
      label: { zh: '故意殺人率', en: 'Homicide' },
      description: {
        zh: '每 10 萬人中，一年有幾人被故意殺害身亡（不含戰爭、執法與正當防衛致死，也不含過失致死）。顏色越深越高。',
        en: 'Victims of intentional homicide per 100,000 people in a year (excluding deaths in armed conflict, by law enforcement or in self-defence, and negligent killings). Darker means higher.',
      },
      unit: PER_100K,
      file: 'homicide.json',
      layer: { kind: 'choropleth', scale: HOMICIDE_SCALE },
      format: (v) => per100k(v),
      formatTick: tick,
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'homicide-female',
      label: { zh: '女性被害率', en: 'Female victims' },
      description: {
        zh: '每 10 萬名女性中，一年有幾人被故意殺害身亡。跟男性同一組分級門檻，可以直接比較；多數國家男性被害率高得多，女性的被害人卻常是被伴侶或家人殺害。',
        en: 'Female victims of intentional homicide per 100,000 women in a year. It uses the same classes as the male rate so the two can be compared: in most countries men are far more often killed, but female victims are more often killed by a partner or relative.',
      },
      unit: PER_100K,
      file: 'homicide-female.json',
      layer: { kind: 'choropleth', scale: HOMICIDE_SCALE },
      format: (v) => per100k(v),
      formatTick: tick,
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'homicide-male',
      label: { zh: '男性被害率', en: 'Male victims' },
      description: {
        zh: '每 10 萬名男性中，一年有幾人被故意殺害身亡。跟女性同一組分級門檻。',
        en: 'Male victims of intentional homicide per 100,000 men in a year, on the same classes as the female rate.',
      },
      unit: PER_100K,
      file: 'homicide-male.json',
      layer: { kind: 'choropleth', scale: HOMICIDE_SCALE },
      format: (v) => per100k(v),
      formatTick: tick,
      compareWorld: true,
      lowerIsBetter: true,
    },
    {
      id: 'prison',
      label: { zh: '監禁人口率', en: 'Prison rate' },
      description: {
        zh: '每 10 萬人中，有幾人關在監獄、看守所等矯正機關（含還沒判決的羈押被告）。只收有開放授權資料的國家，其他國家不上色。顏色越深越高。',
        en: 'Persons held in prisons, jails and other correctional institutions per 100,000 people, including pre-trial detainees. Only countries with openly licensed data are shown; the rest are left grey. Darker means higher.',
      },
      unit: PER_100K,
      file: 'prison.json',
      // 2024 年：冰島、日本 30 多，北歐 60–110，美國 540 多
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 75, 100, 150, 250, 400] } },
      format: (v) => per100k(v),
      formatTick: (v) => fixed(v, 0),
      coverage: {
        countries: PRISON_COVERAGE.split(' '),
        reason: { zh: '沒有開放授權的資料', en: 'No openly licensed data' },
      },
    },
    {
      id: 'rule-of-law',
      label: { zh: '法治分數', en: 'Rule of law' },
      description: {
        zh: '世界銀行全球治理指標（WGI）的「法治」：綜合 30 多個調查與評估，大家對警察、法院、契約與財產權的信任，以及犯罪與暴力的風險。0–100 分，越高越好；是看法的綜合，不是犯罪統計。WGI 的六個面向都在「政府治理」主題。',
        en: "The World Bank Worldwide Governance Indicators' rule of law: a composite of more than 30 surveys and expert assessments of confidence in the police, the courts, contract enforcement and property rights, and the likelihood of crime and violence. Scored 0–100, higher is better; it measures perceptions, not crime statistics. All six WGI dimensions are in the Governance topic.",
      },
      unit: { zh: '分', en: 'score' },
      file: 'rule-of-law.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [35, 45, 55, 65, 75, 85] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 分`, en: fixed(v, 1) }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
