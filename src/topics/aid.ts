import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, usd } from '../lib/format';
import type { FlowLabels, FlowLayer, IndicatorDef, Text, TopicDefinition } from './types';

/**
 * 國際援助與僑匯：OECD DAC 的政府開發援助（ODA，援助國與受援國）與流向，世界銀行的僑匯（個人匯款）。
 * 流向圖沿用貿易主題的 flow 圖層：援助國 → 受援國，只畫國家；多邊機構（IDA、歐盟機構、聯合國各機構…）
 * 在地圖上沒有位置，列在側欄（panels/AidPanel.tsx）。雙邊的僑匯流向沒有開放授權的資料，沒有弧線。
 */

const USD = { zh: '美元', en: 'US$' };
const money = (v: number) => usd(formatLargeNumber(v));
const OECD_TERMS = { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/**
 * 向 OECD 申報援助的國家（DAC 會員與其他申報國，含台灣），pipeline/topics/aid.py 的 oda.json；
 * 其他國家（中國大陸、印度、巴西、俄羅斯…）也有對外援助，但沒有向 OECD 申報。
 */
const DONORS = [
  'ARE', 'AUS', 'AUT', 'AZE', 'BEL', 'BGR', 'CAN', 'CHE', 'CYP', 'CZE', 'DEU', 'DNK', 'ESP', 'EST', 'FIN', 'FRA', 'GBR',
  'GRC', 'HRV', 'HUN', 'IRL', 'ISL', 'ISR', 'ITA', 'JPN', 'KAZ', 'KOR', 'KWT', 'LIE', 'LTU', 'LUX', 'LVA', 'MCO', 'MLT',
  'NLD', 'NOR', 'NZL', 'POL', 'PRT', 'QAT', 'ROU', 'SAU', 'SVK', 'SVN', 'SWE', 'THA', 'TLS', 'TUR', 'TWN', 'USA',
] as const;
const NOT_DONOR = { zh: '沒有向 OECD 申報援助', en: 'Does not report its aid to the OECD' };

/** 1960 年以來曾經在 OECD 受援國名單上、有收到 ODA 資料的國家（oda-received.json） */
const RECIPIENTS = [
  'ABW', 'AFG', 'AGO', 'AIA', 'ALB', 'ARE', 'ARG', 'ARM', 'ATG', 'AZE', 'BDI', 'BEN', 'BFA', 'BGD', 'BHR', 'BHS', 'BIH',
  'BLR', 'BLZ', 'BMU', 'BOL', 'BRA', 'BRB', 'BRN', 'BTN', 'BWA', 'CAF', 'CHL', 'CHN', 'CIV', 'CMR', 'COD', 'COG', 'COK',
  'COL', 'COM', 'CPV', 'CRI', 'CUB', 'CYM', 'CYP', 'DJI', 'DMA', 'DOM', 'DZA', 'ECU', 'EGY', 'ERI', 'ETH', 'FJI', 'FSM',
  'GAB', 'GEO', 'GHA', 'GIB', 'GIN', 'GMB', 'GNB', 'GNQ', 'GRD', 'GTM', 'GUY', 'HKG', 'HND', 'HRV', 'HTI', 'IDN', 'IND',
  'IRN', 'IRQ', 'ISR', 'JAM', 'JOR', 'KAZ', 'KEN', 'KGZ', 'KHM', 'KIR', 'KNA', 'KOR', 'KWT', 'LAO', 'LBN', 'LBR', 'LBY',
  'LCA', 'LKA', 'LSO', 'MAC', 'MAR', 'MDA', 'MDG', 'MDV', 'MEX', 'MHL', 'MKD', 'MLI', 'MLT', 'MMR', 'MNE', 'MNG', 'MNP',
  'MOZ', 'MRT', 'MSR', 'MUS', 'MWI', 'MYS', 'MYT', 'NAM', 'NCL', 'NER', 'NGA', 'NIC', 'NIU', 'NPL', 'NRU', 'OMN', 'PAK',
  'PAN', 'PER', 'PHL', 'PLW', 'PNG', 'PRK', 'PRY', 'PSE', 'PYF', 'QAT', 'RWA', 'SAU', 'SDN', 'SEN', 'SGP', 'SHN', 'SLB',
  'SLE', 'SLV', 'SOM', 'SRB', 'SSD', 'STP', 'SUR', 'SVN', 'SWZ', 'SXM', 'SYC', 'SYR', 'TCA', 'TCD', 'TGO', 'THA', 'TJK',
  'TKL', 'TKM', 'TLS', 'TON', 'TTO', 'TUN', 'TUR', 'TUV', 'TWN', 'TZA', 'UGA', 'UKR', 'URY', 'UZB', 'VCT', 'VEN', 'VGB',
  'VNM', 'VUT', 'WLF', 'WSM', 'XKX', 'YEM', 'ZAF', 'ZMB', 'ZWE',
] as const;
const NOT_RECIPIENT = { zh: '不在 OECD 的受援國名單上', en: 'Not on the OECD list of aid recipients' };
/** 台灣 1960–1996 年在受援國名單上（主要是 1960 年代的美援），之後沒有資料 */
const TAIWAN_RECEIVED = { TWN: { zh: '1997 年起沒有資料', en: 'No data since 1997' } };

const AID_LABELS: Record<'export' | 'import', FlowLabels> = {
  export: {
    partners: { zh: '援助對象', en: 'aid recipients' },
    main: { zh: '主要援助對象（雙邊）', en: 'Main recipients of bilateral aid' },
    verb: (origin, partner) => tr({ zh: `${origin}給${partner}的雙邊援助`, en: `Bilateral aid from ${origin} to ${partner}` }),
  },
  import: {
    partners: { zh: '援助來源', en: 'aid donors' },
    main: { zh: '主要援助國', en: 'Main donor countries' },
    verb: (origin, partner) => tr({ zh: `${origin}從${partner}收到的援助`, en: `Aid to ${origin} from ${partner}` }),
  },
};
const AID_LEGEND = { zh: '由援助國（淺）到受援國（深）', en: 'From donor (light) to recipient (dark)' };

function flowIndicator(id: string, label: Text, description: Text, file: string, layer: Omit<FlowLayer, 'kind'>): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: USD,
    file,
    layer: { kind: 'flow', ...layer },
    format: money,
    formatTick: formatLargeTick,
    shareOfWorld: true,
    coverage: file === 'oda.json' ? { countries: DONORS, reason: NOT_DONOR } : { countries: RECIPIENTS, reason: NOT_RECIPIENT },
    ...(file === 'oda-received.json' && { noValue: TAIWAN_RECEIVED }),
  };
}

const percent = (v: number, digits: number) => `${fixed(v, digits)}%`;

export const aid: TopicDefinition = {
  id: 'aid',
  title: { zh: '國際援助與僑匯', en: 'Development aid and remittances' },
  shortTitle: { zh: '援助與僑匯', en: 'Aid' },
  defaultIndicator: 'oda-gni',
  defaultYear: 2024,
  sources: [
    {
      name: {
        zh: 'OECD (2026), DAC1: Flows by provider (ODA+OOF+Private), OECD Data Explorer（2026-10-26 查閱；援助國的 ODA）',
        en: 'OECD (2026), DAC1: Flows by provider (ODA+OOF+Private), OECD Data Explorer (accessed on 2026-10-26; ODA by donor)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalCloud&df[id]=DSD_DAC1%40DF_DAC1&df[ag]=OECD.DCD.FSD',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'OECD (2026), DAC2A: Aid (ODA) disbursements to countries and regions, OECD Data Explorer（2026-10-26 查閱；受援國與流向）',
        en: 'OECD (2026), DAC2A: Aid (ODA) disbursements to countries and regions, OECD Data Explorer (accessed on 2026-10-26; recipients and flows)',
      },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalCloud&df[id]=DSD_DAC2%40DF_DAC2A&df[ag]=OECD.DCD.FSD',
      license: OECD_TERMS,
    },
    {
      name: {
        zh: 'World Bank, World Development Indicators（個人匯款：世界銀行依 IMF 國際收支統計的估計）',
        en: 'World Bank, World Development Indicators (personal remittances: World Bank estimates based on IMF balance of payments data)',
      },
      url: 'https://data.worldbank.org/indicator/BX.TRF.PWKR.CD.DT',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '中央銀行 統計資料庫（國際收支：個人移轉、薪資；新臺幣匯率）',
        en: 'Central Bank of the Republic of China (Taiwan), statistical database (balance of payments: personal transfers, compensation of employees; exchange rates)',
      },
      url: 'https://cpx.cbc.gov.tw/',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '行政院主計總處 總體統計資料庫（台灣的 GDP）', en: "DGBAS (Taiwan), National Statistics Database (Taiwan's GDP)" },
      url: 'https://nstatdb.dgbas.gov.tw/',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh:
      '政府開發援助（ODA）是政府與多邊機構給開發中國家、以促進經濟發展與福利為目的的贈款與優惠貸款。援助國的 ODA 在 2017 年以前是淨撥付，2018 年起是 DAC 的新口徑「贈與等值」（貸款只算贈與的成分），兩段不完全可比；2025 年是 OECD 2026 年 4 月公布的初步數字。' +
      '受援國收到的 ODA 是所有官方援助者（雙邊與多邊）的淨撥付，扣掉償還的貸款本金，所以可能是負的。流向圖只畫國家之間的雙邊援助，每個國家列前 15 名；多邊機構（世界銀行的國際開發協會、歐盟機構、聯合國各機構、區域開發銀行…）地圖上沒有位置，列在側欄。' +
      '台灣不是 DAC 會員，但向 OECD 申報援助（OECD 列為 Chinese Taipei），定義相同；台灣申報的雙邊援助大多沒有分到特定國家。' +
      '僑匯是個人匯款：個人之間的移轉加上在國外短期工作的薪資（IMF 國際收支手冊第 6 版），只計正式管道。有些高所得國家的收入多半是跨境通勤者的薪資（例如法國、德國、比利時）。台灣用中央銀行的國際收支統計，同一個定義。' +
      '雙邊的僑匯流向沒有開放授權的資料，沒有畫弧線；僑匯大致跟著移民走，可以參考「移民與難民」主題的僑民去向。' +
      '中國沒有向 OECD 申報，它的對外援助與貸款見「中國的海外貸款」主題（AidData，承諾金額，跟這裡的撥付不能直接比）。' +
      '依 OECD 的資料條款註明：OECD (2026), DAC1、DAC2A, OECD Data Explorer（2026-10-26 查閱）。',
    en:
      'Official development assistance (ODA) is grants and concessional loans from governments and multilateral institutions to developing countries to promote economic development and welfare. Donor ODA is net disbursements until 2017 and, from 2018, the DAC’s grant-equivalent measure (loans count only for their grant element), so the two periods are not fully comparable; 2025 figures are the OECD’s preliminary data of April 2026. ' +
      'ODA received is net disbursements from all official donors (bilateral and multilateral), after repayments of loan principal, so it can be negative. The flow maps show only bilateral aid between countries, the top 15 partners of each country; multilateral institutions (the World Bank’s International Development Association, EU institutions, UN agencies, regional development banks and others) have no place on the map and are listed in the side panel. ' +
      'Taiwan is not a DAC member but reports its aid to the OECD (as Chinese Taipei) under the same definitions; most of the bilateral aid it reports is not allocated to specific countries. ' +
      'Remittances are personal remittances: personal transfers plus compensation of short-term workers abroad (IMF Balance of Payments Manual, 6th edition), through formal channels only. In some high-income countries, receipts are mostly the wages of cross-border commuters (France, Germany and Belgium, for example). Taiwan uses the central bank’s balance of payments, with the same definition. ' +
      'No openly licensed data on bilateral remittance flows exist, so there are no remittance arcs; remittances broadly follow migration, so see where emigrants live in the Migration topic. ' +
      'China does not report to the OECD; for its aid and lending, see the Chinese development finance topic (AidData commitments, not directly comparable with the disbursements here). ' +
      'Attribution under the OECD terms: OECD (2026), DAC1 and DAC2A, OECD Data Explorer (accessed on 2026-10-26).',
  },
  panelExtra: () => import('./panels/AidPanel'),
  indicators: [
    {
      id: 'oda-gni',
      label: { zh: 'ODA 占 GNI（援助國）', en: 'ODA as % of GNI (donors)' },
      description: {
        zh: '政府開發援助占國民所得毛額（GNI）的比例。聯合國 1970 年的決議要已開發國家提高到 0.7%，深色的兩級是 0.7% 以上。2018 年起是贈與等值，2025 年是初步數字。',
        en: 'Official development assistance as a share of gross national income (GNI). A 1970 UN resolution set a target of 0.7% for developed countries; the two darkest classes are 0.7% and above. Grant equivalents from 2018; 2025 figures are preliminary.',
      },
      unit: '%',
      file: 'oda-gni.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.2, 0.3, 0.5, 0.7, 1] } },
      format: (v) => percent(v, 2),
      formatTick: (v) => `${v}%`,
      coverage: { countries: DONORS, reason: NOT_DONOR },
    },
    {
      id: 'oda',
      label: { zh: '援助金額（援助國）', en: 'ODA given (donors)' },
      description: {
        zh: '援助國一年的政府開發援助，含雙邊援助與給多邊機構的捐款。圓的面積與金額成正比。2018 年起是贈與等值，2025 年是初步數字。',
        en: 'A donor’s official development assistance in a year, bilateral aid plus contributions to multilateral institutions. Circle area is proportional to the amount. Grant equivalents from 2018; 2025 figures are preliminary.',
      },
      unit: USD,
      file: 'oda.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 5e10] },
      format: money,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      coverage: { countries: DONORS, reason: NOT_DONOR },
    },
    flowIndicator(
      'flows-donor',
      { zh: '流向：援助對象', en: 'Flows: aid recipients' },
      {
        zh: '點選援助國，弧線連到它的雙邊援助最多的 15 個國家，線寬與金額成正比（淨撥付）。沒有分到特定國家的援助與給多邊機構的捐款不畫，寫在側欄。',
        en: 'Click a donor to draw arcs to the 15 countries receiving the most of its bilateral aid; line width is proportional to the amount (net disbursements). Aid not allocated to a country and contributions to multilateral institutions are not drawn; see the side panel.',
      },
      'oda.json',
      { file: 'flows/{year}.json', direction: 'export', labels: AID_LABELS, legendKey: AID_LEGEND },
    ),
    {
      id: 'oda-received',
      label: { zh: '收到的援助', en: 'ODA received' },
      description: {
        zh: '受援國一年收到的政府開發援助（所有官方援助者，雙邊加多邊的淨撥付）。圓的面積與金額成正比；償還的貸款比新的援助多的國家（例如中國大陸、越南）是負的，不畫圓。',
        en: 'Official development assistance received in a year from all official donors, bilateral and multilateral (net disbursements). Circle area is proportional to the amount; countries repaying more loans than they receive in new aid (China and Viet Nam, for example) have negative figures and no circle.',
      },
      unit: USD,
      file: 'oda-received.json',
      layer: { kind: 'bubble', legendValues: [1e9, 5e9, 2e10] },
      format: money,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      coverage: { countries: RECIPIENTS, reason: NOT_RECIPIENT },
      noValue: TAIWAN_RECEIVED,
    },
    {
      id: 'oda-received-gni',
      label: { zh: '收到的援助占 GNI', en: 'ODA received, % of GNI' },
      description: {
        zh: '受援國收到的政府開發援助占它的國民所得毛額（GNI）的比例，看援助對這個國家的經濟有多重要。',
        en: 'Official development assistance received as a share of the recipient’s gross national income (GNI): how much aid matters to its economy.',
      },
      unit: '%',
      file: 'oda-received-gni.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2.5, 5, 10, 20] } },
      // 中國大陸、越南是很小的負數（−0.002%）
      format: (v) => percent(v, Math.abs(v) < 0.01 ? 3 : Math.abs(v) < 1 ? 2 : 1),
      formatTick: (v) => `${v}%`,
      coverage: { countries: RECIPIENTS, reason: NOT_RECIPIENT },
      noValue: { TWN: { zh: 'OECD 沒有算這個比例', en: 'Not computed by the OECD' } },
    },
    {
      id: 'oda-received-pc',
      label: { zh: '每人收到的援助', en: 'ODA received per person' },
      description: {
        zh: '受援國收到的政府開發援助除以人口。太平洋島國人口少，每人收到的援助特別多。',
        en: 'Official development assistance received divided by population. Pacific island states have small populations, so aid per person is especially high.',
      },
      unit: USD,
      file: 'oda-received-pc.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 100, 250] } },
      format: (v) => usd(fixed(v, Math.abs(v) < 100 ? 1 : 0)),
      formatTick: (v) => usd(`${v}`),
      coverage: { countries: RECIPIENTS, reason: NOT_RECIPIENT },
      noValue: TAIWAN_RECEIVED,
    },
    flowIndicator(
      'flows-recipient',
      { zh: '流向：援助來源', en: 'Flows: aid donors' },
      {
        zh: '點選受援國，弧線連到給它最多援助的 15 個國家，線寬與金額成正比（淨撥付）。多邊機構（世界銀行、歐盟機構、聯合國…）的援助列在側欄。排名表是收到的援助。',
        en: 'Click a recipient to draw arcs to the 15 countries giving it the most aid; line width is proportional to the amount (net disbursements). Aid from multilateral institutions (World Bank, EU institutions, UN and others) is listed in the side panel. The ranking shows ODA received.',
      },
      'oda-received.json',
      { file: 'flows/{year}.json', direction: 'import', labels: AID_LABELS, legendKey: AID_LEGEND },
    ),
    {
      id: 'remit-in',
      label: { zh: '僑匯收入', en: 'Remittances received' },
      description: {
        zh: '從國外匯進來的個人匯款：在國外工作的人寄回家的錢，加上在國外短期工作的薪資，只算銀行、匯款公司等正式管道。圓的面積與金額成正比。',
        en: 'Personal remittances received from abroad: money sent home by people working abroad, plus the wages of short-term workers abroad, through formal channels such as banks and money transfer operators only. Circle area is proportional to the amount.',
      },
      unit: USD,
      file: 'remit-in.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 5e10] },
      format: money,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'remit-gdp',
      label: { zh: '僑匯收入占 GDP', en: 'Remittances received, % of GDP' },
      description: {
        zh: '僑匯收入占國內生產毛額的比例。塔吉克、東加、尼泊爾、中美洲國家有兩成以上，很多家庭靠在國外工作的家人匯錢回來。',
        en: 'Remittances received as a share of gross domestic product. In Tajikistan, Tonga, Nepal and several Central American countries they exceed a fifth of GDP, and many households rely on family members working abroad.',
      },
      unit: '%',
      file: 'remit-gdp.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2.5, 5, 10, 20] } },
      format: (v) => percent(v, v < 1 ? 2 : 1),
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'remit-out',
      label: { zh: '僑匯支出', en: 'Remittances paid' },
      description: {
        zh: '匯到國外的個人匯款，多半是住在這個國家的移民、移工寄回家的錢。圓的面積與金額成正比。',
        en: 'Personal remittances paid abroad, mostly money sent home by migrants and migrant workers living in the country. Circle area is proportional to the amount.',
      },
      unit: USD,
      file: 'remit-out.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 5e10] },
      format: money,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
