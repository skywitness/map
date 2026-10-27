import { tr } from '../i18n';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 稅率：整數不留小數（20%），其他留一位（25.6%、12.5%） */
export const rate = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${fixed(r, Number.isInteger(r) ? 0 : 1)}%`;
};
const rateTick = (v: number) => `${v}%`;
/** 起徵點是平均薪資的幾倍 */
export const times = (v: number) => tr({ zh: `${fixed(v, 1)} 倍`, en: `${fixed(v, 1)}×` });
const timesTick = (v: number) => tr({ zh: `${v} 倍`, en: `${v}×` });

/** OECD 的 38 個會員國加台灣：個人所得稅、加值型營業稅只有這些國家 */
const OECD_AND_TAIWAN = (
  'AUS AUT BEL CAN CHL COL CRI CZE DNK EST FIN FRA DEU GRC HUN ISL IRL ISR ITA JPN KOR LVA LTU LUX MEX ' +
  'NLD NZL NOR POL PRT SVK SVN ESP SWE CHE TUR GBR USA TWN'
).split(' ');
/** OECD Corporate Tax Statistics 的 146 個轄區加台灣（pipeline/topics/taxes.py 的 cit.json） */
const CIT_COVERAGE = (
  'ABW AGO AIA ALB AND ARE ARG ARM ATG AUS AUT AZE BEL BEN BFA BGR BHR BHS BIH BLZ BMU BRA BRB BRN BWA CAN CHE ' +
  'CHL CHN CIV CMR COD COG COK COL CPV CRI CUW CYM CZE DEU DJI DMA DNK DOM EGY ESP EST FIN FJI FRA FRO GAB GBR ' +
  'GEO GGY GIB GRC GRD GRL GTM HKG HND HRV HTI HUN IDN IMN IND IRL ISL ISR ITA JAM JEY JOR JPN KAZ KEN KNA KOR ' +
  'KWT LBR LCA LIE LKA LTU LUX LVA MAC MAR MCO MDA MDV MEX MKD MLT MNE MNG MRT MSR MUS MYS NAM NGA NLD NOR NZL ' +
  'OMN PAK PAN PER PHL PNG POL PRT PRY QAT ROU SAU SEN SGP SLE SMR SRB SVK SVN SWE SWZ SYC TCA TGO THA TTO TUN ' +
  'TUR TWN UKR URY USA UZB VCT VGB VNM WSM ZAF ZMB'
).split(' ');
/** OECD 只整理會員國；其他國家沒有開放授權、又有逐國出處的資料（頁尾的說明） */
const OECD_ONLY = { zh: 'OECD 以外沒有開放資料', en: 'No open data outside the OECD' };

export const taxes: TopicDefinition = {
  id: 'taxes',
  title: { zh: '各國稅率', en: 'Tax rates by country' },
  shortTitle: { zh: '稅率', en: 'Tax rates' },
  defaultIndicator: 'cit',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'OECD, Corporate Tax Statistics（法定公司稅率）', en: 'OECD, Corporate Tax Statistics (statutory corporate tax rates)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_TAX_CIT%40DF_CIT&df[ag]=OECD.CTP.TPS',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'OECD Tax Database 表 I.7（個人所得稅最高稅率與起徵點）',
        en: 'OECD Tax Database, Table I.7 (top statutory personal income tax rate and threshold)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_TAX_PIT%40DF_PIT_TOP_EARN_THRESH&df[ag]=OECD.CTP.TPS',
      license: OECD_TERMS,
    },
    {
      name: { zh: 'OECD, Taxing Wages（勞動稅負）', en: 'OECD, Taxing Wages (tax wedge)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_TAX_WAGES_COMP%40DF_TW_COMP&df[ag]=OECD.CTP.TPS',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'OECD《Consumption Tax Trends 2024》附錄表 2.A.1（加值型營業稅標準稅率）',
        en: 'OECD, Consumption Tax Trends 2024, Annex Table 2.A.1 (standard VAT/GST rates)',
      },
      url: 'https://doi.org/10.1787/dcd4dd36-en',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'OECD《Tax Policy Reforms 2025》《Tax Policy Reforms 2026》（2025、2026 年的加值型營業稅調整）',
        en: 'OECD, Tax Policy Reforms 2025 and 2026 (VAT rate changes for 2025 and 2026)',
      },
      url: 'https://doi.org/10.1787/43d18a55-en',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '所得稅法（全國法規資料庫）', en: 'Income Tax Act (Laws & Regulations Database of Taiwan)' },
      url: 'https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=G0340003',
      license: { zh: '法律條文（不受著作權保護）', en: 'Statute (not subject to copyright)' },
    },
    {
      name: {
        zh: '財政部財政資訊中心 綜合所得稅申報核定統計專冊、賦稅署公告、臺北國稅局（台灣的級距與扣除額）',
        en: 'Ministry of Finance (Taiwan): Fiscal Information Agency income tax statistics, Taxation Administration notices, National Taxation Bureau of Taipei (brackets and deductions)',
      },
      url: 'https://www.dot.gov.tw/multiplehtml/ch26',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '主計總處 薪資及生產力統計（台灣的平均薪資）', en: 'DGBAS (Taiwan), earnings and productivity statistics (average earnings)' },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '都是法律規定的稅率，不是實際繳了多少：各國有很多減免、扣除與優惠，實際收到多少稅（稅收占 GDP）見「物價與財政」主題。' +
      '公司稅有 146 個國家與地區（OECD Corporate Tax Statistics）；個人所得稅、加值型營業稅與勞動稅負只有 OECD 38 個會員國，' +
      'OECD 以外的國家沒有開放授權、又有逐國出處的資料（PwC、KPMG、EY 的稅務摘要是商業內容，Tax Foundation 限非商業使用），留灰色。' +
      '台灣不在 OECD 的資料裡，依所得稅法、加值型及非加值型營業稅法與財政部的公告；起徵點用主計總處的平均薪資換算。',
    en:
      'These are statutory rates set by law, not what is actually paid: countries have many exemptions, deductions and incentives. For tax actually collected (tax revenue as a share of GDP), see the Prices & debt topic. ' +
      'Corporate rates cover 146 countries and territories (OECD Corporate Tax Statistics); personal income tax, VAT and the tax wedge cover only the 38 OECD members, ' +
      'since there are no openly licensed data with country-by-country sources for the rest (the PwC, KPMG and EY tax summaries are proprietary, and Tax Foundation data are for non-commercial use only), so they are left grey. ' +
      "Taiwan is not in the OECD data; its rates follow its Income Tax Act, its Business Tax Act and Ministry of Finance notices, and the threshold is converted using DGBAS average earnings.",
  },
  panelExtra: () => import('./panels/TaxesPanel'),
  indicators: [
    {
      id: 'cit',
      label: { zh: '營所稅', en: 'Corporate tax' },
      description: {
        zh: '營利事業所得稅（公司稅）：公司賺的錢（課稅所得）要繳的法定稅率，中央加地方合計；美國、德國、日本這類各州、各市稅率不同的國家，是 OECD 選的代表值。0% 的多是避稅天堂（開曼群島、百慕達、巴哈馬）。很多國家另有給小公司的低稅率，這裡不算。',
        en: 'The statutory tax rate on company profits, central and local combined; where rates vary by state or city (the United States, Germany, Japan) it is a representative rate chosen by the OECD. Zero rates are mostly tax havens (the Cayman Islands, Bermuda, the Bahamas). Lower rates for small companies in many countries are not included.',
      },
      unit: '%',
      file: 'cit.json',
      // 2025 年：0%（避稅天堂）、9%（匈牙利、阿聯）、12.5%（愛爾蘭）、17%（新加坡）、20%（台灣）、25%（中國、英國）、30% 以上（德國、法國、巴西）
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: rate,
      formatTick: rateTick,
      coverage: {
        countries: CIT_COVERAGE,
        reason: { zh: 'OECD 的資料沒有收', en: 'Not in the OECD data' },
      },
    },
    {
      id: 'pit-top',
      label: { zh: '所得稅最高稅率', en: 'Top income tax' },
      description: {
        zh: '個人所得稅（綜合所得稅）最高一級的法定稅率，含地方稅與附加稅。台灣是 40%（2015–2017 年 45%）。只有 OECD 會員國與台灣。',
        en: 'The top statutory personal income tax rate, including local taxes and surcharges. Taiwan’s is 40% (45% in 2015–2017). OECD members and Taiwan only.',
      },
      unit: '%',
      file: 'pit-top.json',
      // 2025 年：匈牙利 15%、愛沙尼亞 22%，美國 43.6%、英國 45%，日本、丹麥 55.9%
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 45, 50, 55] } },
      format: rate,
      formatTick: rateTick,
      coverage: { countries: OECD_AND_TAIWAN, reason: OECD_ONLY },
    },
    {
      id: 'pit-threshold',
      label: { zh: '最高稅率起徵點', en: 'Top rate threshold' },
      description: {
        zh: '薪水要領到平均薪資的幾倍，才開始適用最高稅率（單身、只有薪資，已經加回標準的免稅額與扣除額）。0 是單一稅率（匈牙利）；歐洲多半 1–3 倍，台灣約 7 倍，韓國、智利、墨西哥 20 倍左右。數值沒有好壞，不排名次。',
        en: 'How many times the average wage a single wage earner must make before the top income tax rate applies (after standard exemptions and deductions). Zero means a flat tax (Hungary); most of Europe is at 1–3 times, Taiwan about 7 and Korea, Chile and Mexico around 20. Values are neither good nor bad, so they are not ranked.',
      },
      unit: { zh: '倍', en: '× average wage' },
      file: 'pit-threshold.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1.5, 2, 3, 5, 10, 20] } },
      format: times,
      formatTick: timesTick,
      unranked: true,
      coverage: { countries: OECD_AND_TAIWAN, reason: OECD_ONLY },
    },
    {
      id: 'vat',
      label: { zh: '營業稅（VAT）', en: 'VAT' },
      description: {
        zh: '買東西、買服務時內含的加值型營業稅（加值稅，VAT、GST）的標準稅率，每年 1 月 1 日的稅率；食物、藥品等常有較低的稅率，這裡不算。台灣的 5% 跟加拿大的聯邦 GST（各省另有銷售稅）一樣是這裡最低的。美國沒有全國性的加值稅。',
        en: 'The standard rate of value-added tax (VAT or GST) on goods and services, as of 1 January each year; reduced rates on food, medicines and the like are not included. Taiwan’s 5% is the lowest here, level with Canada’s federal GST (provinces add their own sales taxes). The United States has no national VAT.',
      },
      unit: '%',
      file: 'vat.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 12, 16, 20, 22, 25] } },
      format: rate,
      formatTick: rateTick,
      noValue: {
        USA: { zh: '沒有全國性的加值稅（各州課銷售稅）', en: 'No national VAT (states levy sales taxes)' },
      },
      coverage: { countries: OECD_AND_TAIWAN, reason: OECD_ONLY },
    },
    {
      id: 'tax-wedge',
      label: { zh: '勞動稅負', en: 'Tax wedge' },
      description: {
        zh: '單身、沒有小孩、領平均薪資的受僱者，所得稅加上勞雇雙方繳的社會安全捐（勞保、健保這類保費），占雇主付出的總人事成本的比例（OECD 的 tax wedge）。只有 OECD 會員國。',
        en: 'Income tax plus employee and employer social security contributions as a share of total labour costs, for a single worker without children on the average wage (the OECD tax wedge). OECD members only.',
      },
      unit: { zh: '% 人事成本', en: '% of labour costs' },
      file: 'tax-wedge.json',
      // 2025 年：哥倫比亞 0%、智利 7%，紐西蘭 21%、韓國 25%，OECD 平均 35%，德國 49%、比利時 52%
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 25, 30, 35, 40, 45] } },
      format: rate,
      formatTick: rateTick,
      noValue: {
        TWN: { zh: 'OECD 沒有算台灣的', en: 'Not computed for Taiwan by the OECD' },
      },
      coverage: { countries: OECD_AND_TAIWAN, reason: OECD_ONLY },
    },
  ],
};
