import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 中國的海外貸款：AidData 的 China's Global Loans and Grants Dataset 1.0（CLG-Global 1.0，pipeline/topics/china_lending.py）。
 * 2000–2023 年中國官方機構對低、中、高所得國家的開發融資的承諾金額，子項目依 Flow_Type_Simplified 分全部、貸款、贈款。
 * 只有一個出資國，不畫從中國出發的流向弧線（使用者 2026-10-28 決定）。側欄在 panels/ChinaLendingPanel.tsx。
 */

const USD = { zh: '美元', en: 'US$' };
const money = (v: number) => usd(formatLargeNumber(v));

/** AidData 有系統地搜尋過的 217 個國家與地區（CountryList 工作表），其中 17 個沒有找到項目（值是 0） */
const COVERED = [
  'ABW', 'AFG', 'AGO', 'ALB', 'AND', 'ARE', 'ARG', 'ARM', 'ASM', 'ATG', 'AUS', 'AUT', 'AZE', 'BDI', 'BEL', 'BEN', 'BFA',
  'BGD', 'BGR', 'BHR', 'BHS', 'BIH', 'BLR', 'BLZ', 'BMU', 'BOL', 'BRA', 'BRB', 'BRN', 'BTN', 'BWA', 'CAF', 'CAN', 'CHE',
  'CHL', 'CIV', 'CMR', 'COD', 'COG', 'COK', 'COL', 'COM', 'CPV', 'CRI', 'CUB', 'CUW', 'CYM', 'CYP', 'CZE', 'DEU', 'DJI',
  'DMA', 'DNK', 'DOM', 'DZA', 'ECU', 'EGY', 'ERI', 'ESP', 'EST', 'ETH', 'FIN', 'FJI', 'FRA', 'FRO', 'FSM', 'GAB', 'GBR',
  'GEO', 'GGY', 'GHA', 'GIB', 'GIN', 'GMB', 'GNB', 'GNQ', 'GRC', 'GRD', 'GRL', 'GTM', 'GUM', 'GUY', 'HND', 'HRV', 'HTI',
  'HUN', 'IDN', 'IMN', 'IND', 'IRL', 'IRN', 'IRQ', 'ISL', 'ISR', 'ITA', 'JAM', 'JEY', 'JOR', 'JPN', 'KAZ', 'KEN', 'KGZ',
  'KHM', 'KIR', 'KNA', 'KOR', 'KWT', 'LAO', 'LBN', 'LBR', 'LBY', 'LCA', 'LIE', 'LKA', 'LSO', 'LTU', 'LUX', 'LVA', 'MAF',
  'MAR', 'MCO', 'MDA', 'MDG', 'MDV', 'MEX', 'MHL', 'MKD', 'MLI', 'MLT', 'MMR', 'MNE', 'MNG', 'MNP', 'MOZ', 'MRT', 'MUS',
  'MWI', 'MYS', 'NAM', 'NCL', 'NER', 'NGA', 'NIC', 'NIU', 'NLD', 'NOR', 'NPL', 'NRU', 'NZL', 'OMN', 'PAK', 'PAN', 'PER',
  'PHL', 'PLW', 'PNG', 'POL', 'PRI', 'PRK', 'PRT', 'PRY', 'PSE', 'PYF', 'QAT', 'ROU', 'RUS', 'RWA', 'SAU', 'SDN', 'SEN',
  'SGP', 'SLB', 'SLE', 'SLV', 'SMR', 'SOM', 'SRB', 'SSD', 'STP', 'SUR', 'SVK', 'SVN', 'SWE', 'SWZ', 'SXM', 'SYC', 'SYR',
  'TCA', 'TCD', 'TGO', 'THA', 'TJK', 'TKM', 'TLS', 'TON', 'TTO', 'TUN', 'TUR', 'TUV', 'TZA', 'UGA', 'UKR', 'URY', 'USA',
  'UZB', 'VCT', 'VEN', 'VGB', 'VIR', 'VNM', 'VUT', 'WSM', 'XKX', 'YEM', 'ZAF', 'ZMB', 'ZWE',
] as const;
const COVERAGE = {
  countries: COVERED,
  reason: { zh: '不在 AidData 搜尋的範圍裡', en: 'Outside AidData’s scope' },
};

const coverageNote = (pc: boolean) => ({
  zh: `高所得國家的大多是給企業的商業融資（併購、飛機與船舶租賃），不是援助。${pc ? '' : '金額是 2023 年的固定美元（已扣掉物價上漲），跟「國際援助與僑匯」的當期美元不能直接比。'}`,
  en: `In high-income countries most of it is commercial finance for companies (acquisitions, aircraft and ship leasing), not aid.${pc ? '' : ' Amounts are in constant 2023 US dollars (adjusted for inflation) and are not directly comparable with the current dollars of the Aid topic.'}`,
});

const amountIndicator = (id: 'cumulative' | 'annual', label: Text, description: Text, legendValues: number[]): IndicatorDef => ({
  id,
  label,
  description,
  unit: USD,
  file: `{item}-${id}.json`,
  layer: { kind: 'bubble', legendValues },
  format: money,
  formatTick: formatLargeTick,
  shareOfWorld: true,
  coverage: COVERAGE,
});

export const chinaLending: TopicDefinition = {
  id: 'china-lending',
  title: { zh: '中國的海外貸款', en: 'Chinese development finance' },
  shortTitle: { zh: '中國貸款', en: 'China lending' },
  defaultIndicator: 'cumulative',
  defaultYear: 2023,
  dimension: {
    label: { zh: '類型', en: 'Type' },
    options: [
      { id: 'all', label: { zh: '全部', en: 'All' } },
      { id: 'loan', label: { zh: '貸款', en: 'Loans' } },
      { id: 'grant', label: { zh: '贈款', en: 'Grants' } },
    ],
    defaultOption: 'all',
  },
  noValue: {
    CHN: { zh: '出資國', en: 'The lender' },
    TWN: { zh: '不是中國官方開發融資的對象', en: 'Not a recipient of Chinese official finance' },
  },
  sources: [
    {
      name: {
        zh: 'AidData, China’s Global Loans and Grants Dataset, Version 1.0（2025 年 11 月 18 日發布；William & Mary）',
        en: 'AidData, China’s Global Loans and Grants Dataset, Version 1.0 (released 18 November 2025; William & Mary)',
      },
      url: 'https://www.aiddata.org/data/chinas-global-loans-and-grants-dataset-1-0',
      license: 'ODC-By 1.0',
    },
    {
      name: { zh: 'IMF World Economic Outlook、World Bank（GDP，見「人均收入」主題）', en: 'IMF World Economic Outlook, World Bank (GDP; see the Income topic)' },
      url: 'https://www.imf.org/en/Publications/WEO',
      license: { zh: 'IMF 資料條款、CC BY 4.0', en: 'IMF terms of use, CC BY 4.0' },
    },
    {
      name: { zh: '聯合國 World Population Prospects 2024（人口）', en: 'UN World Population Prospects 2024 (population)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh:
      '中國政府、政策性銀行（國家開發銀行、中國進出口銀行）、國有商業銀行與國有企業等官方機構，2000–2023 年對 217 個低、中、高所得國家與地區的開發融資：贈款、貸款、債務重整、技術援助、獎學金等，AidData 依官方文件、新聞、受援國與企業的資料逐筆整理（TUFF 4.0 方法）。' +
      '金額是承諾（簽約時的金額），不是實際撥款，也不是現在還欠的債務；只算 AidData 建議加總的項目（已承諾、執行中與完成的，不含取消、暫停、只有承諾意向的與傘狀協議），也扣掉央行換匯與紓困貸款的短期展期（AidData 的 Adjusted Amount），30,133 筆合計約 2.17 兆美元（2023 年固定美元）。' +
      '「全部」除了貸款與贈款，還有債務重整與類型不明的項目；有些項目（物資捐贈、技術援助、獎學金）沒有金額。跨國、區域性的項目沒有受援國，只算在世界合計。' +
      '這一版起高所得國家也收進來（CLG-HIC），那裡大多是中國的銀行給企業的商業融資：併購、飛機與船舶租賃、聯貸，所以美國、澳洲、英國的累計金額排在前面；中低所得國家（CLG-LMIC）才是傳統說的援助與基礎建設貸款。' +
      'AidData 搜尋過 217 個國家與地區，其中 17 個沒有找到項目（值是 0）；範圍外的地方沒有值。台灣不是中國官方開發融資的對象。' +
      '占 GDP 的比例分子分母都用當期美元（累計承諾金額 ÷ 那一年的 GDP），每人金額用 2023 年固定美元除以那一年的人口。' +
      '這個主題跟「國際援助與僑匯」互補：那個主題是向 OECD 申報的援助國（不含中國），金額是當期美元的淨撥付或贈與等值，跟這裡的承諾金額不能直接比。' +
      '依 AidData 的授權（Open Data Commons Attribution License，ODC-By 1.0）註明出處：AidData. 2025. China’s Global Loans and Grants Dataset, Version 1.0. Retrieved from www.aiddata.org/data/chinas-global-loans-and-grants-dataset-1-0',
    en:
      'Development finance committed in 2000–2023 by official institutions in China (the government, the policy banks China Development Bank and China Eximbank, state-owned commercial banks, state-owned enterprises and others) to 217 low-, middle- and high-income countries and territories: grants, loans, debt rescheduling, technical assistance, scholarships and more, compiled record by record by AidData from official documents, news reports, recipient-country and company data (the TUFF 4.0 methodology). ' +
      'Amounts are commitments (the value when the agreement was signed), not disbursements and not outstanding debt. Only the records AidData recommends for aggregates are counted (committed, in implementation or completed; excluding cancelled, suspended and pledged-only projects and umbrella agreements), and short-term rollovers of central-bank swaps and rescue loans are removed (AidData’s Adjusted Amount): 30,133 records worth about $2.17 trillion in constant 2023 US dollars. ' +
      '“All” includes debt rescheduling and records of unclear type as well as loans and grants; some records (in-kind donations, technical assistance, scholarships) have no amount. Multi-country and regional projects have no recipient country and count only in the world total. ' +
      'This edition adds high-income countries (CLG-HIC), where most of the money is commercial finance from Chinese banks to companies (acquisitions, aircraft and ship leasing, syndicated loans), which is why the United States, Australia and the United Kingdom rank near the top; the aid and infrastructure lending usually associated with China is in low- and middle-income countries (CLG-LMIC). ' +
      'AidData searched 217 countries and territories and found no records in 17 of them (value 0); places outside its scope have no value. Taiwan is not a recipient of Chinese official finance. ' +
      'Shares of GDP use current dollars for both the numerator and denominator (cumulative commitments ÷ that year’s GDP); per-person amounts are constant 2023 dollars divided by that year’s population. ' +
      'This topic complements the Aid topic, which covers donors reporting to the OECD (China does not) in current-dollar net disbursements or grant equivalents, so the amounts are not directly comparable with these commitments. ' +
      'Attribution under the Open Data Commons Attribution License (ODC-By 1.0): AidData. 2025. China’s Global Loans and Grants Dataset, Version 1.0. Retrieved from www.aiddata.org/data/chinas-global-loans-and-grants-dataset-1-0',
  },
  panelExtra: () => import('./panels/ChinaLendingPanel'),
  indicators: [
    amountIndicator(
      'cumulative',
      { zh: '累計承諾金額', en: 'Cumulative commitments' },
      {
        zh: `2000 年到時間軸那一年，中國官方機構承諾給這個國家的開發融資合計（2023 年固定美元），圓的面積與金額成正比。是簽約時的承諾，不是實際撥款或現在的債務。${coverageNote(false).zh}`,
        en: `Development finance committed by official institutions in China to the country from 2000 up to the selected year (constant 2023 US dollars); circle area is proportional to the amount. These are commitments at signing, not disbursements or current debt. ${coverageNote(false).en}`,
      },
      [1e9, 1e10, 1e11],
    ),
    amountIndicator(
      'annual',
      { zh: '當年承諾金額', en: 'Commitments in the year' },
      {
        zh: `那一年簽約的開發融資（2023 年固定美元），圓的面積與金額成正比。大型貸款一簽就是幾十億美元，逐年起伏很大。${coverageNote(false).zh}`,
        en: `Development finance committed in the selected year (constant 2023 US dollars); circle area is proportional to the amount. A single large loan can be worth billions, so amounts swing a lot from year to year. ${coverageNote(false).en}`,
      },
      [1e8, 1e9, 1e10],
    ),
    {
      id: 'gdp',
      label: { zh: '累計承諾金額占 GDP', en: 'Cumulative commitments, % of GDP' },
      description: {
        zh: `2000 年到那一年的累計承諾金額占那一年國內生產毛額的比例（都用當期美元），看中國的融資對這個國家的經濟有多大。馬紹爾群島、百慕達特別高，是給在那裡登記的航運公司的船舶融資。${coverageNote(true).zh}`,
        en: `Commitments from 2000 up to the selected year as a share of that year’s gross domestic product (both in current US dollars): how large Chinese finance is relative to the economy. The Marshall Islands and Bermuda stand out because of ship financing for shipping companies registered there. ${coverageNote(true).en}`,
      },
      unit: '%',
      file: '{item}-gdp.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [1, 2.5, 5, 10, 25, 50] },
        itemScales: { grant: { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1, 2.5, 5] } },
      },
      format: (v) => `${fixed(v, v < 1 ? 2 : v < 10 ? 1 : 0)}%`,
      formatTick: (v) => `${v}%`,
      coverage: COVERAGE,
    },
    {
      id: 'per-capita',
      label: { zh: '每人累計承諾金額', en: 'Cumulative commitments per person' },
      description: {
        zh: `2000 年到那一年的累計承諾金額（2023 年固定美元）除以那一年的人口。人口少的島國與航運、郵輪公司登記的地方（馬紹爾群島、百慕達、摩納哥）很容易偏高。${coverageNote(true).zh}`,
        en: `Commitments from 2000 up to the selected year (constant 2023 US dollars) divided by that year’s population. Small island states with few people and places where shipping and cruise companies are registered (the Marshall Islands, Bermuda, Monaco) easily come out high. ${coverageNote(true).en}`,
      },
      unit: USD,
      file: '{item}-per-capita.json',
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [25, 100, 250, 500, 1000, 2500] },
        itemScales: { grant: { type: 'sequential', thresholds: [2.5, 10, 25, 50, 100, 250] } },
      },
      format: (v) => usd(v < 1000 ? fixed(v, v < 10 ? 1 : 0) : formatLargeNumber(v)),
      formatTick: (v) => usd(formatLargeTick(v)),
      coverage: COVERAGE,
    },
  ],
};
