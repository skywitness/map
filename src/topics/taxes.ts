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
    {
      name: { zh: 'OECD, Corporate Tax Statistics：前瞻性有效稅率（DF_ETR_BASELINE）', en: 'OECD, Corporate Tax Statistics: forward-looking effective tax rates (DF_ETR_BASELINE)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_ETR%40DF_ETR_BASELINE&df[ag]=OECD.CTP.TPS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD 全球稅收統計（遺產、繼承與贈與稅 T_4300）', en: 'OECD Global Revenue Statistics (estate, inheritance and gift taxes, T_4300)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_REV_COMP_GLOBAL%40DF_RSGLOBAL&df[ag]=OECD.CTP.TPS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD Net Effective Carbon Rates（淨有效碳稅率，DF_NECRS）', en: 'OECD Net Effective Carbon Rates (DF_NECRS)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_NECR%40DF_NECRS&df[ag]=OECD.CTP.TPS',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '財政部 財政統計資料庫：稅目別實徵淨額（台灣的遺產及贈與稅）', en: 'Ministry of Finance (Taiwan), fiscal statistics: net tax collections by tax (estate and gift tax)' },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjspf2',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '都是法律規定的稅率，不是實際繳了多少：各國有很多減免、扣除與優惠，實際收到多少稅（稅收占 GDP）見這個主題的「稅收占 GDP」。' +
      '公司稅有 146 個國家與地區（OECD Corporate Tax Statistics）；個人所得稅、加值型營業稅與勞動稅負只有 OECD 38 個會員國，' +
      'OECD 以外的國家沒有開放授權、又有逐國出處的資料（PwC、KPMG、EY 的稅務摘要是商業內容，Tax Foundation 限非商業使用），留灰色。' +
      '台灣不在 OECD 的資料裡，依所得稅法、加值型及非加值型營業稅法與財政部的公告；起徵點用主計總處的平均薪資換算。',
    en:
      'These are statutory rates set by law, not what is actually paid: countries have many exemptions, deductions and incentives. For tax actually collected, see this topic’s tax revenue as a share of GDP. ' +
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
    {
      id: 'eatr',
      label: { zh: '企業新投資實際負擔的稅率', en: 'Effective average tax rate on new investment' },
      description: {
        zh: '上面的營所稅是法定稅率；這裡把折舊攤提、資產類別、通膨與利率都算進去，一筆有利可圖的新投資實際負擔的平均稅率（OECD 的前瞻性有效平均稅率 EATR，固定的利率與通膨情境，各類資產合計）。2025 年喀麥隆 46.6%、尚比亞 42.1%、哥倫比亞 32.9%、巴西 32.5%、阿根廷 32.4% 最高；日本 28.4%、德國 26.8%、南韓 24.9%、印度 24.0%、中國大陸 23.0%、英國 22.5%、美國 22.1%、新加坡 16.1%、香港 14.3%、愛爾蘭 12.4%；開曼群島、巴哈馬、澤西等沒有企業所得稅的轄區是 0。法定稅率高但折舊優惠大的國家，實際稅率會低很多。這是模型算的稅率，不是企業實際繳的稅除以利潤。台灣不在 OECD 的資料裡（法定營所稅率 20%）。',
        en: 'The corporate tax above is the statutory rate; this folds in depreciation allowances, asset types, inflation and interest rates to give the average tax rate a profitable new investment actually bears (the OECD’s forward-looking effective average tax rate, EATR, fixed interest and inflation scenario, all asset types combined). In 2025 Cameroon (46.6%), Zambia (42.1%), Colombia (32.9%), Brazil (32.5%) and Argentina (32.4%) were highest; Japan 28.4%, Germany 26.8%, South Korea 24.9%, India 24.0%, mainland China 23.0%, the UK 22.5%, the US 22.1%, Singapore 16.1%, Hong Kong 14.3% and Ireland 12.4%; jurisdictions with no corporate income tax such as the Cayman Islands, the Bahamas and Jersey are 0. Countries with high statutory rates but generous depreciation have much lower effective rates. It is a modelled rate, not taxes actually paid divided by profits. Taiwan is not in the OECD data (statutory rate 20%).',
      },
      unit: '%',
      file: 'eatr.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25, 30] } },
      format: rate,
      formatTick: rateTick,
      noValue: {
        TWN: { zh: 'OECD 沒有算台灣的（法定 20%）', en: 'Not computed for Taiwan by the OECD (statutory 20%)' },
      },
    },
    {
      id: 'inheritance-tax',
      label: { zh: '遺產及贈與稅占 GDP', en: 'Estate, inheritance and gift taxes (% of GDP)' },
      description: {
        zh: '遺產稅、繼承稅與贈與稅一年的稅收占 GDP（OECD 全球稅收統計的 4300 類，1990 年起；台灣用財政部的遺產及贈與稅實徵淨額，含撥入長照基金的部分）。2024 年法國 0.734%、比利時 0.618%、南韓 0.600%、日本 0.550%、芬蘭 0.461% 最高，英國 0.286%、台灣 0.284%、丹麥 0.283%、德國 0.231%、瑞士 0.176%、美國 0.130%；瑞典、奧地利等是 0（瑞典 2004 年、奧地利 2008 年廢除）。0 可能是沒有這種稅，也可能是有稅但收得很少；加拿大這類在死亡時視同出售、對資本利得課稅的國家不算在這一類。',
        en: 'Revenue from estate, inheritance and gift taxes as a share of GDP (OECD Global Revenue Statistics category 4300, from 1990; Taiwan uses the Ministry of Finance’s net estate and gift tax collections, including the part earmarked for long-term care). In 2024 France (0.734%), Belgium (0.618%), South Korea (0.600%), Japan (0.550%) and Finland (0.461%) were highest; the UK 0.286%, Taiwan 0.284%, Denmark 0.283%, Germany 0.231%, Switzerland 0.176% and the US 0.130%; Sweden and Austria are 0 (abolished in 2004 and 2008). Zero may mean no such tax or a tax that raises very little; countries such as Canada that treat death as a sale and tax the capital gains are not counted here.',
      },
      unit: '%',
      file: 'inheritance-tax.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5] } },
      format: (v) => `${fixed(v, v === 0 ? 0 : 3)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'net-carbon-tax',
      label: { zh: '一噸碳實際被課多少稅', en: 'Net effective carbon rate' },
      description: {
        zh: '把碳稅、排放交易的許可價格、汽柴油等燃料的貨物稅加起來，減掉化石燃料補貼，換算成每排一噸二氧化碳當量平均要付多少歐元（OECD 的淨有效碳稅率，依排放量加權，2018、2021、2023 三期）。2023 年瑞士 168.8、盧森堡 125.1、義大利 110.8、荷蘭 110.7、丹麥 108.1 歐元最高；法國 47.1、加拿大 42.0、英國 35.2、南韓 27.4、澳洲 20.4、中國大陸 8.6、日本 5.7；14 國是負的，斯里蘭卡 −49.4、厄瓜多 −44.0、馬來西亞 −26.5：補貼比碳相關的稅還多，等於政府付錢讓人排碳。把汽柴油稅算成碳價是 OECD 的方法，不一定是各國立法的用意。跟「碳定價」不同：這裡算的是淨稅負，美國在這份資料裡沒有值；台灣不在資料裡（環境部對大排放源 2025 年的排放量起計收碳費，每噸 300 元，2026 年起繳）。',
        en: 'Carbon taxes, emissions-trading permit prices and fuel excise taxes (on petrol, diesel and so on), minus fossil fuel subsidies, expressed as euros per tonne of CO2-equivalent emitted on average (the OECD’s net effective carbon rate, emissions-weighted; 2018, 2021 and 2023). In 2023 Switzerland (€168.8), Luxembourg (125.1), Italy (110.8), the Netherlands (110.7) and Denmark (108.1) were highest; France 47.1, Canada 42.0, the UK 35.2, South Korea 27.4, Australia 20.4, mainland China 8.6 and Japan 5.7; 14 countries were negative, Sri Lanka −49.4, Ecuador −44.0 and Malaysia −26.5: subsidies exceed carbon-related taxes, in effect paying people to emit. Counting fuel excise as a carbon price is the OECD’s method, not necessarily the lawmakers’ intent. Unlike carbon pricing alone, this is the net burden; the US has no value in this dataset, and Taiwan is not covered (its Ministry of Environment charges large emitters a carbon fee of NT$300 a tonne on emissions from 2025, payable from 2026).',
      },
      unit: { zh: '歐元／噸 CO2e', en: '€/tCO2e' },
      file: 'net-carbon-tax.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-80, -30, -1, 1, 30, 80] } },
      format: (v) => tr({ zh: `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)} 歐元`, en: `${v < 0 ? '−' : ''}€${fixed(Math.abs(v), 1)}` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2023,
      noValue: { TWN: { zh: '台灣不在 OECD 的資料裡', en: 'Taiwan is not in the OECD data' } },
    },
  ],
};
