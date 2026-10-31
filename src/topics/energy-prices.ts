import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

/**
 * 電價與油價（2026-10-31，製作手冊第十批 164；pipeline/topics/energy_prices.py）：家庭、工業電價（每度），
 * 95 無鉛汽油、柴油（每公升），都含稅、用當年的平均匯率換成美元，一年一個值。
 * 官方長序列（Eurostat、EU Weekly Oil Bulletin、美國 EIA、台電）照年平均；其他國家是政府、主管機關或新聞的價格，
 * 只有某一天的就用那一天（附註寫出處與日期），各國用 3 年內最新的一年（指標檔的 latestWithin）。
 * 沒選國家時的側欄是世界銀行 1960 年起的國際能源價格（panels/EnergyPricesWorld.tsx）。
 */

const PER_KWH = { zh: '美元/度', en: 'US$/kWh' };
const PER_LITRE = { zh: '美元/公升', en: 'US$/litre' };

/** 圖例刻度：只寫需要的小數位（0.05、0.1、1.25） */
function tick(v: number): string {
  const d = [0, 1, 2, 3].find((n) => Math.abs(v * 10 ** n - Math.round(v * 10 ** n)) < 1e-9) ?? 3;
  return fixed(v, d);
}

/** 電價：0.100 美元/度、US$0.100/kWh（各國差在小數第二、三位，寫到三位） */
const perKwh = (v: number) => tr({ zh: `${fixed(v, 3)} 美元/度`, en: `US$${fixed(v, 3)}/kWh` });
/** 油價：1.09 美元/公升、US$1.09/litre */
const perLitre = (v: number) => tr({ zh: `${fixed(v, 2)} 美元/公升`, en: `US$${fixed(v, 2)}/litre` });

const MISSING: Text = {
  zh: '沒有找到官方或可查證的價格（只收歐洲、美國、G20 與台灣周邊）',
  en: 'No official or verifiable price found (only Europe, the US, the G20 and Taiwan’s neighbours are covered)',
};

function price(
  id: string,
  label: Text,
  description: Text,
  unit: Text,
  format: (v: number) => string,
  thresholds: number[],
): IndicatorDef {
  return {
    id,
    label,
    description,
    unit,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format,
    formatTick: tick,
    missing: MISSING,
  };
}

export const energyPrices: TopicDefinition = {
  id: 'energy-prices',
  title: { zh: '電價與油價', en: 'Electricity and fuel prices' },
  shortTitle: { zh: '電價油價', en: 'Energy prices' },
  defaultIndicator: 'household',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: 'Eurostat：家庭與非家庭電價（nrg_pc_204、nrg_pc_205）', en: 'Eurostat: electricity prices for household and non-household consumers (nrg_pc_204, nrg_pc_205)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '歐盟執委會 Weekly Oil Bulletin（含稅零售價的歷史檔）', en: 'European Commission, Weekly Oil Bulletin (price history with taxes)' },
      url: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '美國能源資訊署（EIA）Monthly Energy Review 表 9.4、9.8', en: 'US Energy Information Administration, Monthly Energy Review, tables 9.4 and 9.8' },
      url: 'https://www.eia.gov/totalenergy/data/monthly/',
      license: { zh: '公有領域（美國政府著作）', en: 'Public domain (US government work)' },
    },
    {
      name: { zh: '台灣電力公司：歷年售電量及平均單價、各國電價比較', en: 'Taipower: electricity sales and average prices by year; international electricity price comparison' },
      url: 'https://data.gov.tw/dataset/17080',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '經濟部能源署 油價資訊管理與分析系統：汽柴油參考零售價', en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): reference retail prices of gasoline and diesel' },
      url: 'https://www2.moeaea.gov.tw/oil111/Gasoline/RetailPrice',
      license: { zh: '政府網站資料開放宣告（註明出處即可利用）', en: 'Government website open data declaration (free reuse with attribution)' },
    },
    {
      name: { zh: '世界銀行 Commodity Price Data（Pink Sheet）', en: 'World Bank, Commodity Price Data (Pink Sheet)' },
      url: 'https://www.worldbank.org/en/research/commodity-markets',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '世界銀行 WDI：官方匯率（PA.NUS.FCRF）；中央銀行：新臺幣對美元匯率', en: 'World Bank WDI: official exchange rate (PA.NUS.FCRF); Central Bank of the Republic of China (Taiwan): NT$ per US$' },
      url: 'https://data.worldbank.org/indicator/PA.NUS.FCRF',
      license: { zh: 'CC BY 4.0；政府資料開放授權條款第 1 版', en: 'CC BY 4.0; Open Government Data License, version 1.0' },
    },
    {
      name: { zh: '各國政府、能源主管機關與新聞（每個值的出處見各國附註）', en: 'National governments, energy regulators and news reports (the source of each value is in the country notes)' },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/data/energy-prices/research.jsonl',
      license: { zh: '事實數據，各附註寫出處', en: 'Facts; each note cites its source' },
    },
  ],
  note: {
    zh: '價格都含稅，用當年的平均匯率換成美元（台灣用中央銀行的年平均匯率，其他用世界銀行的官方匯率），所以本國貨幣升貶也會讓價格跟著變。電價的定義各國不同：歐洲是 Eurostat 固定用電級距（家庭年用電 2,500–4,999 度、工業 2,000–19,999 千度）的價格，美國、台灣是總收入除以售電量的平均單價，其他國家多半是公告的費率，附註寫明。油價歐盟、英國是每週含稅零售價的年平均，美國是 EIA 的年平均（汽油用高級汽油），台灣是中油牌價依天數加權的年平均，其他國家是政府公告價或新聞，有的只是某一天的價格。',
    en: 'All prices include taxes and are converted to US dollars at that year’s average exchange rate (Taiwan uses the central bank’s annual average, others the World Bank’s official rate), so currency movements also change the price. Electricity prices are defined differently: Europe uses Eurostat’s fixed consumption bands (households using 2,500–4,999 kWh a year, industry 2,000–19,999 MWh), the US and Taiwan the average revenue per kWh sold, and most other countries published tariffs, as noted. Fuel prices for the EU and the UK are annual averages of weekly retail prices with taxes, the US the EIA annual average (premium for gasoline), Taiwan CPC’s posted prices averaged over the days each was in force, and other countries government-set prices or news reports, some for a single day.',
  },
  worldPanel: {
    title: { zh: '國際能源價格', en: 'International energy prices' },
    load: () => import('./panels/EnergyPricesWorld'),
  },
  indicators: [
    price(
      'household',
      { zh: '家庭電價', en: 'Household electricity price' },
      {
        zh: '家庭每度電的價格，含所有稅費，換成美元。',
        en: 'Price of a kWh of electricity for households, including all taxes, in US dollars.',
      },
      PER_KWH,
      perKwh,
      [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
    ),
    price(
      'industrial',
      { zh: '工業電價', en: 'Industrial electricity price' },
      {
        zh: '工業用電每度的價格，含所有稅費，換成美元。',
        en: 'Price of a kWh of electricity for industry, including all taxes, in US dollars.',
      },
      PER_KWH,
      perKwh,
      [0.05, 0.075, 0.1, 0.15, 0.2, 0.25],
    ),
    price(
      'gasoline',
      { zh: '汽油價格', en: 'Gasoline price' },
      {
        zh: '每公升 95 無鉛汽油的零售價，含稅，換成美元。',
        en: 'Retail price of a litre of 95-octane unleaded gasoline, including taxes, in US dollars.',
      },
      PER_LITRE,
      perLitre,
      [0.5, 0.8, 1.1, 1.4, 1.7, 2],
    ),
    price(
      'diesel',
      { zh: '柴油價格', en: 'Diesel price' },
      {
        zh: '每公升柴油的零售價，含稅，換成美元。',
        en: 'Retail price of a litre of diesel, including taxes, in US dollars.',
      },
      PER_LITRE,
      perLitre,
      [0.5, 0.8, 1.1, 1.4, 1.7, 2],
    ),
  ],
};
