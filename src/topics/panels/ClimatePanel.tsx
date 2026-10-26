import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { latestIndexAtOrBefore, stackedAreaOption } from '../../charts/stackedArea';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { formatLargeNumber, formatLargeTick, formatPercent, formatSignedPercent } from '../../lib/format';
import type { Hue, Tokens } from '../../theme/tokens';
import { usesDimension, type Indicator, type PanelExtraProps } from '../types';

/** 一組逐年序列（百萬公噸 CO₂ 當量）：values 的每個陣列從 from 那一年開始 */
interface Block {
  from: number;
  values: Record<string, (number | null)[]>;
}

/** countries/<ISO3>.json（pipeline/topics/climate.py 的 country_files） */
interface CountryFile {
  /** Global Carbon Project 的二氧化碳，依燃料：coal、gas、oil、cement、flaring、other */
  co2?: Block;
  /** EDGAR 的甲烷、氧化亞氮依部門，含氟氣體依種類：鍵是「氣體:部門」（ch4:rice、fgas:pfc…） */
  edgar?: Block;
  /** CEDS 的燃料燃燒二氧化碳依用途（只看比例）：power、energy、industry、transport、buildings、other */
  uses?: Block;
  /** 環境部國家溫室氣體排放清冊（只有台灣）：co2、ch4、n2o、hfc、pfc、sf6、nf3、total、lulucf（負數）、net */
  inventory?: Block;
  /** EDGAR 併在一起計算的國家（例如蘇丹含南蘇丹） */
  members?: string[];
}

type Gas = 'ghg' | 'co2' | 'ch4' | 'n2o' | 'fgas';

/** 一個類別：名稱、顏色、由哪些資料鍵加總（co2:… 是 GCP，其他是 EDGAR） */
interface Category {
  label: Text;
  hue: Hue;
  keys: string[];
}

// 堆疊由下而上的順序與配色。二氧化碳沿用發電結構驗證過的相鄰配色（燃煤紅、天然氣紫、石油橘…），
// 其他氣體的類別也照「紅、紫、橘、青綠、黃、綠、洋紅、藍」的相鄰順序排
const CO2_CATEGORIES: Category[] = [
  { label: { zh: '燃煤', en: 'Coal' }, hue: 'red', keys: ['co2:coal'] },
  { label: { zh: '天然氣', en: 'Gas' }, hue: 'violet', keys: ['co2:gas'] },
  { label: { zh: '石油', en: 'Oil' }, hue: 'orange', keys: ['co2:oil'] },
  { label: { zh: '水泥', en: 'Cement' }, hue: 'aqua', keys: ['co2:cement'] },
  { label: { zh: '燃除（油氣田燒掉的氣體）', en: 'Flaring (gas burned at oil and gas fields)' }, hue: 'yellow', keys: ['co2:flaring'] },
  { label: { zh: '其他工業', en: 'Other industry' }, hue: 'green', keys: ['co2:other'] },
];

const CATEGORIES: Record<Gas, Category[]> = {
  ghg: [
    { label: { zh: '燃煤（二氧化碳）', en: 'Coal (CO₂)' }, hue: 'red', keys: ['co2:coal'] },
    { label: { zh: '天然氣（二氧化碳）', en: 'Gas (CO₂)' }, hue: 'violet', keys: ['co2:gas'] },
    { label: { zh: '石油（二氧化碳）', en: 'Oil (CO₂)' }, hue: 'orange', keys: ['co2:oil'] },
    {
      label: { zh: '工業製程', en: 'Industrial processes' },
      hue: 'aqua',
      keys: ['co2:cement', 'co2:other', 'ch4:industry', 'n2o:industry', 'fgas:hfc', 'fgas:pfc', 'fgas:sf6', 'fgas:nf3'],
    },
    {
      label: { zh: '化石燃料開採', en: 'Fossil fuel production' },
      hue: 'yellow',
      keys: ['co2:flaring', 'ch4:fugitive', 'n2o:fugitive'],
    },
    {
      label: { zh: '農業', en: 'Agriculture' },
      hue: 'green',
      keys: ['ch4:enteric', 'ch4:manure', 'ch4:rice', 'ch4:burning', 'n2o:manure', 'n2o:soils', 'n2o:burning'],
    },
    {
      label: { zh: '廢棄物', en: 'Waste' },
      hue: 'magenta',
      keys: ['ch4:solidwaste', 'ch4:wastewater', 'n2o:solidwaste', 'n2o:wastewater'],
    },
    {
      label: { zh: '其他', en: 'Other' },
      hue: 'blue',
      keys: ['ch4:combustion', 'n2o:combustion', 'n2o:indirect'],
    },
  ],
  co2: CO2_CATEGORIES,
  ch4: [
    { label: { zh: '化石燃料開採（逸散）', en: 'Fossil fuel production' }, hue: 'yellow', keys: ['ch4:fugitive'] },
    { label: { zh: '燃料燃燒', en: 'Fuel combustion' }, hue: 'red', keys: ['ch4:combustion'] },
    { label: { zh: '工業製程', en: 'Industrial processes' }, hue: 'aqua', keys: ['ch4:industry'] },
    { label: { zh: '畜牧（腸胃發酵、糞尿）', en: 'Livestock (digestion, manure)' }, hue: 'green', keys: ['ch4:enteric', 'ch4:manure'] },
    { label: { zh: '稻田', en: 'Rice paddies' }, hue: 'orange', keys: ['ch4:rice'] },
    { label: { zh: '燃燒生質', en: 'Burning biomass' }, hue: 'violet', keys: ['ch4:burning'] },
    { label: { zh: '垃圾掩埋等', en: 'Landfills and solid waste' }, hue: 'magenta', keys: ['ch4:solidwaste'] },
    { label: { zh: '廢水處理', en: 'Wastewater' }, hue: 'blue', keys: ['ch4:wastewater'] },
  ],
  n2o: [
    { label: { zh: '燃料燃燒', en: 'Fuel combustion' }, hue: 'red', keys: ['n2o:combustion'] },
    { label: { zh: '化石燃料開採', en: 'Fossil fuel production' }, hue: 'yellow', keys: ['n2o:fugitive'] },
    { label: { zh: '化學工業', en: 'Chemical industry' }, hue: 'aqua', keys: ['n2o:industry'] },
    { label: { zh: '農地土壤（施肥等）', en: 'Farm soils (fertiliser)' }, hue: 'green', keys: ['n2o:soils'] },
    { label: { zh: '畜牧糞尿', en: 'Manure' }, hue: 'orange', keys: ['n2o:manure'] },
    { label: { zh: '燃燒生質', en: 'Burning biomass' }, hue: 'violet', keys: ['n2o:burning'] },
    { label: { zh: '廢棄物與廢水', en: 'Waste and wastewater' }, hue: 'magenta', keys: ['n2o:solidwaste', 'n2o:wastewater'] },
    { label: { zh: '間接排放（氮沉降）', en: 'Indirect (N deposition)' }, hue: 'blue', keys: ['n2o:indirect'] },
  ],
  fgas: [
    { label: { zh: '氫氟碳化物（HFCs，冷媒等）', en: 'HFCs (refrigerants etc.)' }, hue: 'blue', keys: ['fgas:hfc'] },
    { label: { zh: '全氟碳化物（PFCs）', en: 'PFCs' }, hue: 'orange', keys: ['fgas:pfc'] },
    { label: { zh: '六氟化硫（SF₆）', en: 'SF₆' }, hue: 'aqua', keys: ['fgas:sf6'] },
    { label: { zh: '三氟化氮（NF₃）', en: 'NF₃' }, hue: 'violet', keys: ['fgas:nf3'] },
  ],
};

/** 各種氣體（第一段的組成） */
const GAS_PARTS: { gas: Exclude<Gas, 'ghg'>; label: Text; hue: Hue }[] = [
  { gas: 'co2', label: { zh: '二氧化碳', en: 'CO₂' }, hue: 'blue' },
  { gas: 'ch4', label: { zh: '甲烷', en: 'Methane' }, hue: 'orange' },
  { gas: 'n2o', label: { zh: '氧化亞氮', en: 'Nitrous oxide' }, hue: 'aqua' },
  { gas: 'fgas', label: { zh: '含氟氣體', en: 'F-gases' }, hue: 'violet' },
];

/** CEDS 的燃料燃燒用途 */
const USES: { key: string; label: Text; hue: Hue }[] = [
  { key: 'power', label: { zh: '發電與供熱', en: 'Electricity and heat' }, hue: 'red' },
  { key: 'energy', label: { zh: '煉油、煉焦等能源業自用', en: 'Refining and other energy industries' }, hue: 'yellow' },
  { key: 'industry', label: { zh: '工業', en: 'Industry' }, hue: 'aqua' },
  { key: 'transport', label: { zh: '運輸', en: 'Transport' }, hue: 'orange' },
  { key: 'buildings', label: { zh: '住宅與商業', en: 'Homes and businesses' }, hue: 'violet' },
  { key: 'other', label: { zh: '農林漁業與其他', en: 'Farming, fishing and other' }, hue: 'green' },
];

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的排放來源資料。',
    gasTitle: '各種溫室氣體',
    gasChartAria: (country: string) => `${country}歷年各種溫室氣體排放量堆疊面積圖`,
    gasList: (year: number) => `${year} 年各種氣體`,
    gasListAria: (country: string, year: number) => `${country}${year} 年各種溫室氣體排放量`,
    gasNote: '二氧化碳是化石燃料與工業（Global Carbon Project），甲烷、氧化亞氮、含氟氣體是 EDGAR；含氟氣體 1990 年起。二氧化碳當量用 IPCC AR5 的 GWP-100。',
    sourceTitle: (gas: string) => (gas === 'ghg' ? '排放來源' : `${gas}的排放來源`),
    fgasTitle: '含氟氣體的種類',
    sourceChartAria: (country: string, gas: string) => `${country}歷年${gas}排放來源堆疊面積圖`,
    sourceList: (year: number) => `${year} 年各來源`,
    sourceListAria: (country: string, year: number) => `${country}${year} 年排放來源`,
    ghgSourceNote:
      '燃煤、天然氣、石油是燃燒化石燃料的二氧化碳（Global Carbon Project）。工業製程是水泥等的二氧化碳、化工的甲烷與氧化亞氮、含氟氣體；化石燃料開採是煤礦與油氣田逸散的甲烷與燃除；農業是畜牧、稻田、施肥；廢棄物是垃圾掩埋與廢水；其他是燃燒產生的甲烷、氧化亞氮與間接排放（EDGAR）。發電、運輸、住商的二氧化碳見下一段。',
    usesTitle: '燃料燃燒的二氧化碳用在哪裡',
    usesList: (year: number) => `${year} 年的比例`,
    usesAria: (country: string, year: number) => `${country}${year} 年燃料燃燒的二氧化碳各用途比例`,
    usesNote: (last: number) =>
      `比例來自 CEDS（美國太平洋西北國家實驗室，到 ${last} 年）。它估計的總量跟上面的 Global Carbon Project 不同，所以只列比例。`,
    usesLatest: (last: number) => `（CEDS 最新是 ${last} 年）`,
    members: (names: string, own: string) =>
      `EDGAR 的甲烷、氧化亞氮與含氟氣體含${names}（沒有分開計算）；這裡的二氧化碳只有${own}，地圖上的全部溫室氣體另外加上${names}的二氧化碳。`,
    invTitle: '跟環境部國家溫室氣體排放清冊比較',
    invChartAria: '台灣歷年溫室氣體排放：本站與環境部清冊',
    invOurs: '本站',
    invTotal: '清冊',
    invNet: '清冊扣除碳匯',
    invTable: (year: number) => `${year} 年（公噸 CO₂ 當量）`,
    invCaption: (year: number) => `台灣 ${year} 年各種溫室氣體：本站與環境部清冊`,
    colGas: '氣體',
    colOurs: '本站',
    colInv: '清冊',
    colDiff: '差',
    total: '合計（不含碳匯）',
    lulucf: '森林等吸收（LULUCF）',
    net: '淨排放',
    invNote:
      '本站是 Global Carbon Project 的二氧化碳加上 EDGAR 的其他氣體；清冊是環境部氣候變遷署《2026 年中華民國國家溫室氣體排放清冊報告》（政府資料開放平臺 16024），甲烷一律用 GWP 28，「扣除碳匯」是減去森林等的吸收。' +
      '二氧化碳兩邊差不多；EDGAR 估計的甲烷大很多，主要是廢水處理與垃圾掩埋（台灣的垃圾大多焚化）。清冊另外算了森林等的吸收（土地利用、土地利用變化及林業），本站的指標不含。',
  },
  en: {
    noCountry: 'No emissions-by-source data for this country.',
    gasTitle: 'Greenhouse gases',
    gasChartAria: (country) => `Stacked area chart of greenhouse gas emissions by gas in ${country} over time`,
    gasList: (year) => `By gas, ${year}`,
    gasListAria: (country, year) => `Greenhouse gas emissions by gas in ${country}, ${year}`,
    gasNote:
      'CO₂ from fossil fuels and industry is from the Global Carbon Project; methane, nitrous oxide and F-gases are from EDGAR. F-gases from 1990. CO₂-equivalents use IPCC AR5 GWP-100.',
    sourceTitle: (gas) => (gas === 'ghg' ? 'Emissions by source' : `Sources of ${gas}`),
    fgasTitle: 'F-gases by type',
    sourceChartAria: (country, gas) => `Stacked area chart of ${gas} emissions by source in ${country} over time`,
    sourceList: (year) => `By source, ${year}`,
    sourceListAria: (country, year) => `Emissions by source in ${country}, ${year}`,
    ghgSourceNote:
      'Coal, gas and oil are CO₂ from burning fossil fuels (Global Carbon Project). Industrial processes are CO₂ from cement and the like, methane and nitrous oxide from chemicals, and F-gases; fossil fuel production is methane leaking from coal mines and oil and gas fields, plus flaring; agriculture is livestock, rice and fertiliser; waste is landfills and wastewater; other is methane and nitrous oxide from combustion and indirect emissions (EDGAR). CO₂ by use (power, transport, buildings) is in the next section.',
    usesTitle: 'Where CO₂ from burning fuel comes from',
    usesList: (year) => `Shares, ${year}`,
    usesAria: (country, year) => `Shares of CO₂ from fuel combustion by use in ${country}, ${year}`,
    usesNote: (last) =>
      `Shares from CEDS (Pacific Northwest National Laboratory, up to ${last}). Its totals differ from the Global Carbon Project figures above, so only shares are shown.`,
    usesLatest: (last) => ` (latest CEDS year is ${last})`,
    members: (names, own) =>
      `EDGAR's methane, nitrous oxide and F-gas figures include ${names} (not reported separately); CO₂ here is ${own} only, while the all-gas total on the map also adds the CO₂ of ${names}.`,
    invTitle: "Compared with Taiwan's national greenhouse gas inventory",
    invChartAria: "Taiwan's greenhouse gas emissions over time: this site and the national inventory",
    invOurs: 'This site',
    invTotal: 'Inventory',
    invNet: 'Inventory, net',
    invTable: (year) => `${year} (tonnes CO₂e)`,
    invCaption: (year) => `Taiwan's greenhouse gases in ${year}: this site and the national inventory`,
    colGas: 'Gas',
    colOurs: 'Here',
    colInv: 'Inventory',
    colDiff: 'Diff.',
    total: 'Total (excl. removals)',
    lulucf: 'Removals by forests etc. (LULUCF)',
    net: 'Net emissions',
    invNote:
      "This site combines Global Carbon Project CO₂ with EDGAR's other gases; the inventory is the Ministry of Environment's 2026 National Greenhouse Gas Inventory Report (government open data 16024), with methane at GWP 28 throughout, and 'net' subtracts removals by forests and other land. " +
      "CO₂ is nearly the same; EDGAR's methane is much higher, mostly from wastewater and landfills (most of Taiwan's rubbish is incinerated). The inventory also counts removals by forests and other land (LULUCF), which the indicators here exclude.",
  },
});

const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (mt: number) => `${formatLargeNumber(mt * 1e6)} ${tr(TONNES)}`;
const tick = (mt: number) => formatLargeTick(mt * 1e6);
/** 對照表裡不寫單位（寫在表頭），英文才不會換行 */
const amount = (mt: number) => formatLargeNumber(mt * 1e6);
/** 本站比清冊多（少）多少：差 10% 以內寫到小數一位 */
const diff = (ours: number, inv: number) => {
  const pct = (ours / inv - 1) * 100;
  return formatSignedPercent(pct, Math.abs(pct) < 10 ? 1 : 0);
};

/** 一組類別在 [first, last] 每一年的加總（百萬公噸）；沒有任何資料的類別不放 */
function sumCategories(file: CountryFile, categories: Category[], first: number, last: number) {
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const get = (key: string, y: number): number | null => {
    const block = key.startsWith('co2:') ? file.co2 : file.edgar;
    const v = block?.values[key.slice(key.startsWith('co2:') ? 4 : 0)]?.[y - (block?.from ?? 0)];
    return v ?? null;
  };
  const series = categories
    .map((c) => ({
      category: c,
      values: years.map((y) => {
        const parts = c.keys.map((k) => get(k, y)).filter((v): v is number => v != null);
        return parts.length ? parts.reduce((s, v) => s + v, 0) : null;
      }),
    }))
    .filter((s) => s.values.some((v) => v != null && v > 0));
  return { years, series };
}

function blockLast(block: Block | undefined): number | null {
  if (!block) return null;
  const length = Math.max(...Object.values(block.values).map((v) => v.length));
  return block.from + length - 1;
}

/** 某一類在 [first, last] 每一年的值（block 沒有的年份是 null） */
function blockSeries(block: Block | undefined, key: string, first: number, last: number): (number | null)[] {
  return Array.from({ length: last - first + 1 }, (_, i) => block?.values[key]?.[first + i - block.from] ?? null);
}

export default function ClimatePanel({ indicator, iso3, year, item, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<CountryFile>(`topics/climate/countries/${iso3}.json`);
  const countries = useJson<CountryTable>('countries.json').data;
  // 有「氣體」子項目的指標依選的氣體；累積、消費端、每單位 GDP、土地利用變化都是二氧化碳
  const gas: Gas = usesDimension(indicator) ? ((item as Gas | null) ?? 'ghg') : 'co2';

  const view = useMemo(() => {
    if (!data) return null;
    const co2Last = blockLast(data.co2);
    const edgarLast = blockLast(data.edgar);

    // 第一段：各種氣體（要有 EDGAR）；年份到二氧化碳的最後一年
    let gases = null;
    if (data.edgar && co2Last !== null) {
      const first = data.edgar.from;
      const parts = GAS_PARTS.map((p) => {
        const keys = p.gas === 'co2' ? [] : Object.keys(data.edgar!.values).filter((k) => k.startsWith(`${p.gas}:`));
        const values =
          p.gas === 'co2'
            ? Array.from({ length: co2Last - first + 1 }, (_, i) => {
                const vals = Object.values(data.co2!.values).map((s) => s[first + i - data.co2!.from]);
                return vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
              })
            : Array.from({ length: co2Last - first + 1 }, (_, i) => {
                const vals = keys.map((k) => data.edgar!.values[k][i]);
                return vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
              });
        return { ...p, values };
      });
      const years = Array.from({ length: co2Last - first + 1 }, (_, i) => first + i);
      gases = chartAndList(
        years,
        parts.map((p) => ({ key: p.gas, label: tr(p.label, lang), color: tokens.hues[p.hue], values: p.values })),
        year,
        tokens,
      );
    }

    // 第二段：排放來源，依選的氣體
    // 沒有 EDGAR 的國家（EDGAR 併在別國計算的南蘇丹等）退回二氧化碳的燃料別
    const sourceGas: Gas = data.edgar ? gas : 'co2';
    const categories = CATEGORIES[sourceGas];
    const range: [number, number] | null =
      sourceGas === 'co2'
        ? data.co2 && co2Last !== null ? [data.co2.from, co2Last] : null
        : sourceGas === 'ghg'
          ? data.edgar && co2Last !== null ? [data.edgar.from, co2Last] : null
          : data.edgar && edgarLast !== null ? [sourceGas === 'fgas' ? 1990 : data.edgar.from, edgarLast] : null;
    let sources = null;
    if (range) {
      const { years, series } = sumCategories(data, categories, range[0], range[1]);
      if (series.length) {
        sources = chartAndList(
          years,
          series.map((s) => ({
            key: s.category.keys.join(),
            label: tr(s.category.label, lang),
            color: tokens.hues[s.category.hue],
            values: s.values,
          })),
          year,
          tokens,
        );
      }
    }

    // 第三段：燃料燃燒的二氧化碳用途（CEDS 的比例），只在全部溫室氣體與二氧化碳時
    let uses = null;
    const usesLast = blockLast(data.uses);
    if (data.uses && usesLast !== null && (gas === 'ghg' || gas === 'co2')) {
      const index = latestIndexAtOrBefore(
        Array.from({ length: usesLast - data.uses.from + 1 }, (_, i) => data.uses!.from + i),
        year,
        (i) => USES.some((u) => (data.uses!.values[u.key]?.[i] ?? 0) > 0),
      );
      if (index >= 0) {
        const total = USES.reduce((s, u) => s + (data.uses!.values[u.key]?.[index] ?? 0), 0);
        const items: BarListItem[] = USES.map((u) => ({
          key: u.key,
          label: tr(u.label, lang),
          value: ((data.uses!.values[u.key]?.[index] ?? 0) / total) * 100,
          color: tokens.hues[u.hue],
        }))
          .filter((i) => i.value > 0)
          .sort((a, b) => b.value - a.value);
        uses = { items, shownYear: data.uses.from + index, last: usesLast };
      }
    }

    // 台灣：跟環境部清冊比較
    let inventory = null;
    const inv = data.inventory;
    const invLast = blockLast(inv);
    if (inv && invLast !== null && data.edgar && co2Last !== null) {
      const first = inv.from;
      const last = Math.min(invLast, co2Last);
      const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
      const sumGas = (g: Exclude<Gas, 'ghg'>, y: number): number | null => {
        if (g === 'co2') {
          const vals = Object.values(data.co2!.values).map((s) => s[y - data.co2!.from]);
          return vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
        }
        const vals = Object.entries(data.edgar!.values)
          .filter(([k]) => k.startsWith(`${g}:`))
          .map(([, s]) => s[y - data.edgar!.from]);
        return vals.some((v) => v != null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
      };
      const ours = years.map((y) => {
        const parts = GAS_PARTS.map((p) => sumGas(p.gas, y));
        return parts.slice(0, 3).every((v) => v != null) ? parts.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
      });
      const base: Indicator = {
        ...indicator,
        format: tonnes,
        formatTick: tick,
        layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [] } },
      };
      const option = timeSeriesOption({
        years,
        lines: [
          { name: text.invOurs, values: ours, color: tokens.accent },
          { name: text.invTotal, values: blockSeries(inv, 'total', first, last), color: tokens.hues.orange },
          { name: text.invNet, values: blockSeries(inv, 'net', first, last), color: tokens.hues.green },
        ],
        year,
        indicator: base,
        tokens,
      });
      const tableYear = Math.min(Math.max(year, first), last);
      const v = (key: string) => inv.values[key]?.[tableYear - first] ?? null;
      const fgasInv = ['hfc', 'pfc', 'sf6', 'nf3'].reduce((s, k) => s + (v(k) ?? 0), 0);
      const rows = [
        ...GAS_PARTS.map((p) => ({
          key: p.gas,
          label: tr(p.label, lang),
          ours: sumGas(p.gas, tableYear),
          inv: p.gas === 'fgas' ? fgasInv : v(p.gas),
        })),
        { key: 'total', label: text.total, ours: ours[tableYear - first], inv: v('total') },
      ];
      inventory = { option, rows, tableYear, lulucf: v('lulucf'), net: v('net') };
    }

    return { gases, sources, sourceGas, uses, inventory };
  }, [data, gas, year, tokens, lang, indicator, text]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data || !view) return <p className="empty">{t.loading}</p>;

  const gasName = GAS_PARTS.find((p) => p.gas === view.sourceGas)?.label;
  const sourceTitle =
    view.sourceGas === 'fgas' ? text.fgasTitle : text.sourceTitle(view.sourceGas === 'ghg' ? 'ghg' : tr(gasName!, lang));
  const memberNames = (data.members ?? []).slice(1).map((m) => nameOf(m, countries, lang));
  const missing = (shown: number | null) => shown !== null && shown !== year && <span className="muted">{t.yearMissing(year)}</span>;

  return (
    <section className="panel-section">
      {view.gases && (
        <div className="panel-subsection">
          <h3>{text.gasTitle}</h3>
          <EChart option={view.gases.option} height={200} ariaLabel={text.gasChartAria(countryName)} />
          {view.gases.shownYear !== null && (
            <>
              <h4>
                {text.gasList(view.gases.shownYear)}
                {missing(view.gases.shownYear)}
              </h4>
              <BarList items={view.gases.items} format={tonnes} total={view.gases.total} ariaLabel={text.gasListAria(countryName, view.gases.shownYear)} />
            </>
          )}
          <p className="note">{text.gasNote}</p>
          {memberNames.length > 0 && <p className="note">{text.members(memberNames.join(tr({ zh: '、', en: ', ' }, lang)), countryName)}</p>}
        </div>
      )}
      {view.sources && (
        <div className="panel-subsection">
          <h3>{sourceTitle}</h3>
          <EChart option={view.sources.option} height={220} ariaLabel={text.sourceChartAria(countryName, gasName ? tr(gasName, lang) : '')} />
          {view.sources.shownYear !== null && (
            <>
              <h4>
                {text.sourceList(view.sources.shownYear)}
                {missing(view.sources.shownYear)}
              </h4>
              <BarList items={view.sources.items} format={tonnes} total={view.sources.total} ariaLabel={text.sourceListAria(countryName, view.sources.shownYear)} />
            </>
          )}
          {view.sourceGas === 'ghg' && <p className="note">{text.ghgSourceNote}</p>}
        </div>
      )}
      {view.uses && (
        <div className="panel-subsection">
          <h3>{text.usesTitle}</h3>
          <h4>
            {text.usesList(view.uses.shownYear)}
            {view.uses.shownYear !== year && year > view.uses.last && <span className="muted">{text.usesLatest(view.uses.last)}</span>}
          </h4>
          <BarList items={view.uses.items} format={(v) => formatPercent(v, v < 10 ? 1 : 0)} ariaLabel={text.usesAria(countryName, view.uses.shownYear)} />
          <p className="note">{text.usesNote(view.uses.last)}</p>
        </div>
      )}
      {view.inventory && (
        <div className="panel-subsection">
          <h3>{text.invTitle}</h3>
          <EChart option={view.inventory.option} height={200} ariaLabel={text.invChartAria} />
          <table className="mini-table climate-inventory" aria-label={text.invCaption(view.inventory.tableYear)}>
            <thead>
              <tr>
                <th scope="col">{text.invTable(view.inventory.tableYear)}</th>
                <th scope="col" className="num">{text.colOurs}</th>
                <th scope="col" className="num">{text.colInv}</th>
                <th scope="col" className="num">{text.colDiff}</th>
              </tr>
            </thead>
            <tbody>
              {view.inventory.rows.map((r) => (
                <tr key={r.key} className={r.key === 'total' ? 'is-current' : undefined}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{r.ours != null ? amount(r.ours) : '—'}</td>
                  <td className="num">{r.inv != null ? amount(r.inv) : '—'}</td>
                  <td className="num">{r.ours != null && r.inv ? diff(r.ours, r.inv) : '—'}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">{text.lulucf}</th>
                <td className="num">—</td>
                <td className="num">{view.inventory.lulucf != null ? amount(view.inventory.lulucf) : '—'}</td>
                <td className="num" />
              </tr>
              <tr>
                <th scope="row">{text.net}</th>
                <td className="num">—</td>
                <td className="num">{view.inventory.net != null ? amount(view.inventory.net) : '—'}</td>
                <td className="num" />
              </tr>
            </tbody>
          </table>
          <p className="note">{text.invNote}</p>
        </div>
      )}
      {!view.gases && !view.sources && !view.uses && <p className="empty">{text.noCountry}</p>}
    </section>
  );
}

/** 堆疊面積圖＋選定年份（沒有就往前找）的長條清單 */
function chartAndList(
  years: number[],
  series: { key: string; label: string; color: string; values: (number | null)[] }[],
  year: number,
  tokens: Tokens,
) {
  const kept = series.filter((s) => s.values.some((v) => v != null && v > 0));
  const index = latestIndexAtOrBefore(years, year, (i) => kept.some((s) => (s.values[i] ?? 0) > 0));
  const all = kept.map((s) => ({ key: s.key, label: s.label, value: index >= 0 ? (s.values[index] ?? 0) : 0, color: s.color }));
  const total = all.reduce((sum, i) => sum + Math.max(i.value, 0), 0);
  // 不到 0.05% 的類別（占比會寫成 0.0%）不列
  const items: BarListItem[] = all.filter((i) => i.value > 0 && i.value >= total * 0.0005).sort((a, b) => b.value - a.value);
  const option = stackedAreaOption({
    years,
    series: kept.map((s) => ({ name: s.label, values: s.values, color: s.color })),
    year,
    format: tonnes,
    formatTick: tick,
    tokens,
  });
  return { option, items, total, shownYear: index >= 0 ? years[index] : null };
}
