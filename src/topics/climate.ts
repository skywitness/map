import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { withParts } from './parts';
import { co2StationsPart } from './co2-stations';
import type { IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

/**
 * 溫室氣體排放（pipeline/topics/climate.py）：
 * - 二氧化碳：Global Carbon Project（Our World in Data 轉載），化石燃料與水泥等工業，1850–2024 年
 * - 甲烷、氧化亞氮、含氟氣體：EDGAR 2026 年版（歐盟 JRC），1970–2025 年（含氟氣體 1990–2024 年）
 * - 全部溫室氣體 = 兩者相加，1990–2024 年；CO₂ 當量用 IPCC AR5 的 GWP-100，不含土地利用變化
 * EDGAR 自己的二氧化碳是 CC BY-NC-ND 4.0（IEA-EDGAR CO₂），不用（DESIGN.md 第 8 節第 14 點）。
 *
 * 「人均排放」「年排放量」有「氣體」子項目；舊網址的 co2-per-capita、co2 是這兩個指標選二氧化碳（indicatorAliases），
 * 資料檔還是同一個（co2-per-capita.json、co2.json）。
 */

const TONNES = { zh: '公噸', en: 'tonnes' };
const PER_PERSON = { zh: '公噸/人', en: 'tonnes/person' };
const CO2E = { zh: '公噸 CO₂ 當量', en: 'tonnes CO₂e' };
const CO2E_PER_PERSON = { zh: '公噸 CO₂ 當量/人', en: 'tonnes CO₂e/person' };
const KG_PER_DOLLAR = { zh: '公斤/國際元', en: 'kg/int$' };
const tonnes = (v: number) => `${formatLargeNumber(v)} ${tr(TONNES)}`;
const tonnesTick = (v: number) => `${formatLargeTick(v)}${tr({ zh: '噸', en: ' t' })}`;
/** 人均：含氟氣體這類很小的值多一位小數 */
const perPerson = (v: number) => `${fixed(v, Math.abs(v) < 0.1 ? 3 : Math.abs(v) < 10 ? 2 : 1)} ${tr(PER_PERSON)}`;

const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });
/** 圖例刻度：門檻寫幾位小數就顯示幾位（1.5、0.15、0.02） */
const decimals = (v: number) => [0, 1, 2, 3].find((d) => Math.abs(Math.round(v * 10 ** d) - v * 10 ** d) < 1e-9) ?? 3;
const thresholdTick = (v: number) => fixed(v, decimals(v));

/** 氣體（子項目）：id 是資料檔名的開頭（ghg.json、ghg-per-capita.json…） */
const GASES: { id: string; label: Text; perCapita: number[] }[] = [
  { id: 'ghg', label: { zh: '全部溫室氣體', en: 'Greenhouse gas' }, perCapita: [1.5, 3, 5, 8, 12, 20] },
  { id: 'co2', label: { zh: '二氧化碳', en: 'CO₂' }, perCapita: [1, 2, 4, 6, 10, 15] },
  { id: 'ch4', label: { zh: '甲烷（CH₄）', en: 'Methane (CH₄)' }, perCapita: [0.3, 0.5, 0.75, 1, 1.5, 3] },
  { id: 'n2o', label: { zh: '氧化亞氮（N₂O）', en: 'Nitrous oxide (N₂O)' }, perCapita: [0.1, 0.15, 0.2, 0.3, 0.5, 1] },
  { id: 'fgas', label: { zh: '含氟氣體', en: 'F-gas' }, perCapita: [0.02, 0.05, 0.1, 0.2, 0.4, 0.8] },
];

/**
 * EDGAR 併在別國計算的國家（pipeline 的 edgar.MEMBERS）：沒有單獨的甲烷、氧化亞氮、含氟氣體，所以也沒有全部溫室氣體。
 * 二氧化碳（GCP）有單獨的值，選二氧化碳時照常顯示。
 */
const merged = (host: Text): Text => ({
  zh: `EDGAR 把它併在${tr(host, 'zh')}計算，沒有單獨的甲烷、氧化亞氮與含氟氣體`,
  en: `EDGAR includes it in ${tr(host, 'en')}: no separate methane, nitrous oxide or F-gas figures`,
});
const SUDAN = { zh: '蘇丹', en: 'Sudan' };
const SERBIA = { zh: '塞爾維亞', en: 'Serbia' };
const ITALY = { zh: '義大利', en: 'Italy' };
const MERGED: Record<string, Text> = {
  SSD: merged(SUDAN),
  PSE: merged({ zh: '以色列', en: 'Israel' }),
  MNE: merged(SERBIA),
  XKX: merged(SERBIA),
  LIE: merged({ zh: '瑞士', en: 'Switzerland' }),
  MCO: merged({ zh: '法國', en: 'France' }),
  AND: merged({ zh: '西班牙', en: 'Spain' }),
  SMR: merged(ITALY),
  VAT: merged(ITALY),
};

function perCapita(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_PERSON,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: sequential([1, 2, 4, 6, 10, 15]) },
    format: (v) => `${fixed(v, v < 10 ? 2 : 1)} ${tr(PER_PERSON)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const climate: TopicDefinition = withParts({
  id: 'climate',
  title: { zh: '各國溫室氣體排放', en: 'Greenhouse gas emissions by country' },
  shortTitle: { zh: '氣候', en: 'Climate' },
  defaultIndicator: 'ghg-per-capita',
  defaultYear: 2024,
  dimension: {
    label: { zh: '氣體', en: 'Gas' },
    options: GASES.map(({ id, label }) => ({ id, label })),
    defaultOption: 'ghg',
  },
  // 舊網址：原本的「人均排放」「年排放量」只有二氧化碳，現在是選二氧化碳的那一項
  indicatorAliases: {
    'co2-per-capita': { indicator: 'ghg-per-capita', item: 'co2' },
    co2: { indicator: 'ghg', item: 'co2' },
  },
  sources: [
    {
      name: {
        zh: 'Global Carbon Project（Our World in Data, CO₂ and Greenhouse Gas Emissions）：二氧化碳',
        en: 'Global Carbon Project (Our World in Data, CO₂ and Greenhouse Gas Emissions): CO₂',
      },
      url: 'https://github.com/owid/co2-data',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'EDGAR 2026（歐盟執委會聯合研究中心 JRC，EDGAR_2026_GHG）：甲烷、氧化亞氮、含氟氣體',
        en: 'EDGAR 2026 (European Commission JRC, EDGAR_2026_GHG): methane, nitrous oxide, F-gases',
      },
      url: 'https://edgar.jrc.ec.europa.eu/dataset_ghg2026',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'CEDS v_2025_03_18（PNNL）：燃料燃燒的二氧化碳用途（側欄）',
        en: 'CEDS v_2025_03_18 (PNNL): CO₂ from fuel combustion by use (side panel)',
      },
      url: 'https://doi.org/10.5281/zenodo.15059443',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》：人均的人口', en: 'UN World Population Prospects 2024: population for per-person values' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '環境部氣候變遷署《2026 年中華民國國家溫室氣體排放清冊報告》：台灣的對照',
        en: "Taiwan Ministry of Environment, 2026 National Greenhouse Gas Inventory Report: Taiwan's comparison",
      },
      url: 'https://data.gov.tw/dataset/16024',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '二氧化碳只計化石燃料燃燒與水泥等工業製程（Global Carbon Project），甲烷、氧化亞氮、含氟氣體用 EDGAR；' +
      '全部溫室氣體是兩者相加，1990 年起（含氟氣體從 1990 年才有）。換算成二氧化碳當量用 IPCC 第五次評估報告的 100 年全球暖化潛勢' +
      '（甲烷化石來源 30、生物來源 28，氧化亞氮 265），跟 EDGAR 一樣。都不含土地利用變化（砍伐森林、森林吸收等，另有一個指標）；' +
      '國際航空與航運不屬於任何國家，所以各國加總小於世界合計。EDGAR 自己的二氧化碳以 IEA 的資料為基礎、授權禁止改作，所以沒有用。' +
      '1 億公噸 ＝ 100 百萬公噸（Mt）。發電的碳排強度見「各國發電量」主題，暖化見「各國氣溫與降雨」主題。',
    en:
      'CO₂ covers fossil fuels and industrial processes such as cement only (Global Carbon Project); methane, nitrous oxide and ' +
      'F-gases come from EDGAR, and all greenhouse gases are the sum of the two, from 1990 (F-gas data start in 1990). ' +
      'CO₂-equivalents use the 100-year global warming potentials of the IPCC Fifth Assessment Report (methane 30 from fossil ' +
      'sources and 28 from biogenic ones, nitrous oxide 265), as EDGAR does. Land-use change (deforestation, forest uptake) is ' +
      'excluded except in its own indicator; international aviation and shipping belong to no country, so country totals add up ' +
      "to less than the world. EDGAR's own CO₂ is based on IEA data under a no-derivatives licence and is not used. " +
      'See Electricity by country for the carbon intensity of power and Temperature and rainfall by country for warming.',
  },
  panelExtra: () => import('./panels/ClimatePanel'),
  indicators: [
    {
      id: 'ghg-per-capita',
      label: { zh: '人均排放', en: 'Emissions per person' },
      description: {
        zh: '一年的溫室氣體排放量除以人口（二氧化碳當量），依排放發生的地點計算（生產端）。選上方的「氣體」看二氧化碳、甲烷、氧化亞氮或含氟氣體；EDGAR 只估計了約 150 國的含氟氣體。',
        en: 'Annual greenhouse gas emissions divided by population, in CO₂-equivalents and counted where the emissions occur (production-based). Use "Gas" above for CO₂, methane, nitrous oxide or F-gases; EDGAR estimates F-gases for about 150 countries.',
      },
      unit: CO2E_PER_PERSON,
      file: '{item}-per-capita.json',
      layer: {
        kind: 'choropleth',
        scale: sequential(GASES[0].perCapita),
        itemScales: Object.fromEntries(GASES.map((g) => [g.id, sequential(g.perCapita)])),
      },
      format: perPerson,
      formatTick: thresholdTick,
      compareWorld: true,
      noValue: MERGED,
    },
    {
      id: 'ghg',
      label: { zh: '年排放量', en: 'Annual emissions' },
      description: {
        zh: '一年的溫室氣體排放總量（二氧化碳當量）。圓的面積與排放量成正比。選上方的「氣體」看各種氣體。',
        en: 'Total greenhouse gas emissions in a year, in CO₂-equivalents. Circle area is proportional to emissions. Use "Gas" above for each gas.',
      },
      unit: CO2E,
      file: '{item}.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
      noValue: MERGED,
    },
    {
      id: 'cumulative-co2',
      label: { zh: '累積二氧化碳', en: 'Cumulative CO₂' },
      description: {
        zh: '從 1750 年到當年的二氧化碳排放總和，可以看出歷史責任。圓的面積與累積排放量成正比。',
        en: 'Total CO₂ emitted from 1750 up to the selected year, a measure of historical responsibility. Circle area is proportional to cumulative emissions.',
      },
      unit: TONNES,
      file: 'cumulative-co2.json',
      layer: { kind: 'bubble', legendValues: [1e9, 1e10, 1e11] },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    perCapita(
      'consumption-co2-per-capita',
      { zh: '人均消費端二氧化碳', en: 'Consumption-based CO₂ per person' },
      {
        zh: '把進出口商品生產時的二氧化碳排放算給最後消費的國家。出口大國會比生產端的人均排放低，進口大國會比較高。1990 年起。',
        en: 'CO₂ emitted in producing traded goods is assigned to the country that finally consumes them, so big exporters come out lower than their production-based figure and big importers higher. From 1990.',
      },
    ),
    {
      id: 'co2-per-gdp',
      label: { zh: '每單位 GDP 的二氧化碳', en: 'CO₂ per unit of GDP' },
      description: {
        zh: '每創造 1 國際元（2011 年購買力平價）的 GDP 排放多少公斤二氧化碳，越低代表經濟越低碳。到 2022 年。',
        en: 'Kilograms of CO₂ emitted per international dollar of GDP (2011 PPP); lower means a less carbon-intensive economy. Up to 2022.',
      },
      unit: KG_PER_DOLLAR,
      file: 'co2-per-gdp.json',
      layer: { kind: 'choropleth', scale: sequential([0.1, 0.15, 0.2, 0.3, 0.5, 0.8]) },
      format: (v) => `${fixed(v, 3)} ${tr(KG_PER_DOLLAR)}`,
      formatTick: (v) => fixed(v, 2),
      compareWorld: true,
    },
    {
      id: 'luc-co2-per-capita',
      label: { zh: '土地利用變化的二氧化碳', en: 'Land-use change CO₂' },
      description: {
        zh: '砍伐森林、開墾等土地利用變化排放的二氧化碳，扣掉森林再生長吸收的，除以人口；負值（青綠）是淨吸收。Global Carbon Project 用模型估計，不確定性很大，跟各國清冊的算法也不同，不算在其他指標裡。',
        en: 'CO₂ from deforestation and other land-use change, minus regrowth uptake, divided by population; negative values (teal) are net removals. Modelled by the Global Carbon Project with large uncertainty and on a different basis from national inventories; not included in the other indicators.',
      },
      unit: PER_PERSON,
      file: 'luc-co2-per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-2, -0.5, -0.1, 0.1, 0.5, 2], reverse: true } },
      format: (v) => `${fixed(v, Math.abs(v) < 10 ? 2 : 1)} ${tr(PER_PERSON)}`,
      formatTick: thresholdTick,
      compareWorld: true,
      noValue: {
        TWN: { zh: 'Global Carbon Project 沒有估計台灣', en: 'Not estimated for Taiwan by the Global Carbon Project' },
      },
    },
  ],
}, co2StationsPart);
