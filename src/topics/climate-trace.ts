import { getLang, tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatSignedPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, DimensionDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 溫室氣體排放（climate.ts）的 Climate TRACE 部分（pipeline/topics/climate_trace.py，製作手冊第十七批 268，2026-11-02）：
 * - 各國的年排放量（Climate TRACE）：2015 年到最新的完整一年，依部門（子項目），跟 GCP、EDGAR 的序列並列、不混在一起。
 * - 最新一年 1 月到資料的最新月份，比前一年同期增減幾 %（使用者 2026-11-02 決定另做一個指標，不放進時間軸）。
 * - 排放源地圖：電廠、鋼鐵、水泥、煉油、礦場、機場、港口等設施的點，大小是年排放量，顏色是類別；左側欄依排放量排名。
 * 使用者 2026-11-02 的決定：用 Zenodo 的版本；國家值取自 EDGAR／CEDS 的子部門不算二氧化碳（IEA-EDGAR CO₂ 禁止改作）；
 * 排放源只收 Climate TRACE 自己估計的設施。
 * 版本、年份、月份都跟著資料走（pipeline 每次抓 Zenodo 的最新版），這裡不寫死：比去年同期的年份欄位是 YYYYMM，
 * 排放源的年份是點檔裡有的 e<年> 欄位，說明不寫會過時的數字，用的版本寫在側欄（climate-trace-manifest.json）。
 */

const SOURCE_FIRST = 2021;
/** 排放源的各期：比資料多列到 2040 年，資料沒有的年份點檔裡沒有那一欄（emissionsAt() 往前找有資料的一年） */
const SOURCE_YEARS = Array.from({ length: 2040 - SOURCE_FIRST + 1 }, (_, i) => SOURCE_FIRST + i);
/** 縮小時只畫這麼多公噸以上的排放源（跟 pipeline 的 POINT_IMPORTANT 一致，其餘在 trace-sources-more.json） */
export const SOURCE_MIN = 1e6;

const CO2E = { zh: '公噸 CO₂ 當量', en: 'tonnes CO₂e' };
const CO2E_PER_PERSON = { zh: '公噸 CO₂ 當量/人', en: 'tonnes CO₂e/person' };
const tonnes = (v: number) => `${formatLargeNumber(v)} ${tr(CO2E)}`;
const tonnesTick = (v: number) => `${formatLargeTick(v)}${tr({ zh: '噸', en: ' t' })}`;
/** 比去年同期的期間：資料的年份欄位是 YYYYMM（202608 = 2026 年 1–8 月） */
const period = (v: number) => {
  const year = Math.floor(v / 100);
  const month = v % 100;
  return tr({ zh: `${year} 年 1–${month} 月`, en: `Jan–${MONTHS_EN[month - 1]} ${year}` });
};
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 部門（子項目）：id 跟 pipeline 的 SECTORS 一致，total 是全部部門（不含森林與土地利用） */
const SECTOR_DIM: DimensionDef = {
  label: { zh: '部門', en: 'Sector' },
  options: [
    { id: 'total', label: { zh: '全部部門', en: 'All sectors' } },
    { id: 'power', label: { zh: '電力', en: 'Power' } },
    { id: 'manufacturing', label: { zh: '製造業', en: 'Manufacturing' } },
    { id: 'fossil-fuels', label: { zh: '化石燃料的開採與煉製', en: 'Fossil fuel operations' } },
    { id: 'transport', label: { zh: '交通運輸（含國際航空、海運）', en: 'Transport (incl. international aviation and shipping)' } },
    { id: 'buildings', label: { zh: '建築物（住宅與商業的燃料）', en: 'Buildings (fuel burned on site)' } },
    { id: 'agriculture', label: { zh: '農業', en: 'Agriculture' } },
    { id: 'waste', label: { zh: '廢棄物', en: 'Waste' } },
    { id: 'fgas', label: { zh: '含氟氣體', en: 'Fluorinated gases' } },
    { id: 'mining', label: { zh: '礦物開採', en: 'Mineral extraction' } },
  ],
  defaultOption: 'total',
};

/**
 * 排放源的類別（點的 s 是子部門代碼，pipeline 的 SUB_CODES）。顏色取自 MAP_TOKENS.categorical（地圖的 8 色，任兩色在一般視覺與
 * 紅、綠色盲下都分得開）：電廠用跟發電廠地圖燃煤一樣的鏽紅，港口用淡黃（多半在海邊，淡黃在藍色的海上看得清楚，在淺色陸地上不明顯）
 */
interface Category {
  label: Text;
  color: string;
  subs: number[];
}
const C = MAP_TOKENS.categorical;
export const CATEGORIES: Category[] = [
  { label: { zh: '電廠', en: 'Power plants' }, color: C[5], subs: [1] },
  { label: { zh: '鋼鐵', en: 'Iron and steel' }, color: C[6], subs: [2] },
  { label: { zh: '水泥', en: 'Cement' }, color: C[1], subs: [3] },
  { label: { zh: '鋁、化學、石化、紙漿', en: 'Aluminium, chemicals, petrochemicals, pulp' }, color: C[7], subs: [4, 5, 6, 7] },
  { label: { zh: '煉油', en: 'Oil refineries' }, color: C[2], subs: [8] },
  { label: { zh: '油氣田、煤礦、金屬礦', en: 'Oil and gas fields, coal and metal mines' }, color: C[3], subs: [9, 10, 11, 12, 13] },
  { label: { zh: '機場', en: 'Airports' }, color: C[0], subs: [14] },
  { label: { zh: '港口', en: 'Ports' }, color: C[4], subs: [15] },
];
const categoryOf = (sub: unknown) => CATEGORIES.findIndex((c) => c.subs.includes(sub as number));

/** 子部門（tooltip 第一行）：鋁、化學、礦場等併成一類的才寫得出是哪一種 */
const SUBSECTORS: Record<number, Text> = {
  1: { zh: '電廠', en: 'Power plant' },
  2: { zh: '鋼鐵廠', en: 'Steel plant' },
  3: { zh: '水泥廠', en: 'Cement plant' },
  4: { zh: '鋁廠', en: 'Aluminium plant' },
  5: { zh: '化學工廠', en: 'Chemical plant' },
  6: { zh: '石化廠（輕油裂解）', en: 'Petrochemical plant (steam cracking)' },
  7: { zh: '紙漿與造紙廠', en: 'Pulp and paper mill' },
  8: { zh: '煉油廠', en: 'Oil refinery' },
  9: { zh: '油氣盆地（開採與輸送）', en: 'Oil and gas basin (production and transport)' },
  10: { zh: '煤礦', en: 'Coal mine' },
  11: { zh: '銅礦', en: 'Copper mine' },
  12: { zh: '鐵礦', en: 'Iron mine' },
  13: { zh: '鋁土礦', en: 'Bauxite mine' },
  14: { zh: '機場（國內與國際航班）', en: 'Airport (domestic and international flights)' },
  15: { zh: '港口（國內與國際航運）', en: 'Port (domestic and international shipping)' },
};

/** 類型（source_type）裡常見的字：電廠的燃料、鋼鐵的製程、鋁與化學的產品；認不得的不寫 */
const TYPE_WORDS: Record<string, Text> = {
  coal: { zh: '燃煤', en: 'coal' },
  gas: { zh: '燃氣', en: 'gas' },
  oil: { zh: '燃油', en: 'oil' },
  biomass: { zh: '生質', en: 'biomass' },
  waste: { zh: '廢棄物', en: 'waste' },
  other_fossil: { zh: '其他化石燃料', en: 'other fossil fuels' },
  'BF/BOF': { zh: '高爐－轉爐', en: 'blast furnace–basic oxygen furnace' },
  EAF: { zh: '電弧爐', en: 'electric arc furnace' },
  'DRI-EAF': { zh: '直接還原鐵－電弧爐', en: 'direct reduced iron–electric arc furnace' },
  Smelting: { zh: '電解鋁', en: 'smelter' },
  Refinery: { zh: '氧化鋁', en: 'alumina refinery' },
  ammonia: { zh: '氨', en: 'ammonia' },
  methanol: { zh: '甲醇', en: 'methanol' },
  soda_ash: { zh: '純鹼', en: 'soda ash' },
  Underground: { zh: '地下開採', en: 'underground' },
  Surface: { zh: '露天開採', en: 'surface' },
};
function typeText(p: PointRecord): string | null {
  if (typeof p.t !== 'string') return null;
  const words = p.t
    .split(/\s*,\s*/)
    .map((w) => TYPE_WORDS[w])
    .filter((w): w is Text => Boolean(w));
  return words.length ? words.map((w) => tr(w)).join(tr({ zh: '、', en: ', ' })) : null;
}

/**
 * 點檔裡有資料的哪一年：時間軸在 2021 年以前用 2021 年；比資料的最後一年晚（點檔沒有那一欄）時往前找有欄位的一年。
 * 欄位在、值是 null 的是那一年沒有排放（還沒蓋好、已經關閉），不往前找
 */
function sourceYear(p: PointRecord, year: number): number {
  let y = Math.max(SOURCE_FIRST, year);
  while (y > SOURCE_FIRST && !(`e${y}` in p)) y--;
  return y;
}
const emissionsAt = (p: PointRecord, year: number) => {
  const v = p[`e${sourceYear(p, year)}`];
  return typeof v === 'number' ? v : null;
};

const SOURCE_COLORS: ColorClasses = {
  field: 'cat',
  title: { zh: '排放源', en: 'Emission sources' },
  thresholds: CATEGORIES.slice(1).map((_, i) => i + 0.5),
  classes: CATEGORIES.map((c) => ({ color: c.color, label: c.label })),
};

/**
 * 半徑（px，縮放 2 時）：面積大約與排放量成正比（半徑 ≈ 1.6 × √百萬公噸）；1 萬到 10 萬公噸放大到 0.8–1.1 px，世界全圖才看得見。
 * 最大的西西伯利亞油氣盆地約 3 億公噸、28 px，最大的電廠（印度 Vindhyachal）約 3,300 萬公噸、9 px
 */
const RADIUS: [number, number][] = [
  [1e4, 0.8],
  [1e5, 1.1],
  [1e6, 1.8],
  [1e7, 5],
  [1e8, 16],
  [3e8, 27.7],
];

/** 台灣的排放源對照環境部的事業溫室氣體年排放量（pipeline 的 TAIWAN_MATCH） */
function taiwanLine(p: PointRecord): string | null {
  if (typeof p.tw !== 'number' || typeof p.twn !== 'string') return null;
  const year = typeof p.twy === 'number' ? p.twy : '';
  return tr({
    zh: `環境部申報（${year} 年，${p.twn}的直接排放）：${tonnes(p.tw)}；申報範圍不一定跟這個排放源相同`,
    en: `Reported to Taiwan’s Ministry of Environment (${year}, direct emissions of ${p.twn}): ${tonnes(p.tw)}; the reporting boundary may differ`,
  });
}

const INDICATORS = ['trace-sources'];

const SOURCES: PointsOverlayDef = {
  kind: 'points',
  id: 'trace-sources',
  file: 'trace-sources.json',
  label: { zh: '排放源（Climate TRACE，年排放 1 萬公噸以上）', en: 'Emission sources (Climate TRACE, 10,000 t+ a year)' },
  indicators: INDICATORS,
  radius: { field: 'e', stops: RADIUS },
  color: SOURCE_COLORS,
  // 那一年的排放（點檔沒有那一年時用前面有資料的一年，見 sourceYear）與類別；那一年沒有排放的不畫
  epochs: {
    years: SOURCE_YEARS,
    values: (p, year) => ({ e: emissionsAt(p, year), cat: categoryOf(p.s) }),
  },
  // 縮小時只畫 100 萬公噸以上的（trace-sources.json 只有這些），其餘的放大到 3.5 級才下載
  minValue: { field: 'e', stops: [[0, SOURCE_MIN], [4, 0]] },
  more: { minZoom: 3.5 },
  cluster: {
    maxZoom: 3,
    radius: 70,
    weight: 'e',
    size: (total) => Math.min(32, 8 + 0.6 * Math.sqrt(total / 1e6)),
    format: tonnesTick,
    title: { zh: '這一區排放源的年排放量 ', en: 'Annual emissions of the sources in this area: ' },
  },
  sizeLegend: { title: { zh: '年排放量', en: 'Annual emissions' }, values: [1e5, 1e6, 1e7, 1e8], format: tonnesTick },
  tooltip: (p, ctx) => {
    const year = sourceYear(p, ctx.year);
    const v = emissionsAt(p, year);
    const sub = SUBSECTORS[p.s as number];
    const tw = taiwanLine(p);
    return {
      title: `${sub ? tr(sub) : ''}${v !== null ? ` · ${tonnes(v)}` : ''}`,
      detail: [
        tr({ zh: `${year} 年`, en: String(year) }),
        typeText(p),
        typeof p.cap === 'number' ? `${fixed(p.cap, 0)} MW` : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: tw ? [tw] : undefined,
    };
  },
};

/** 清單一次最多列幾個（全世界的前幾名；依類別時每一類） */
const LIST_TOP = 300;
const LIST_PER_CATEGORY = 40;

const SOURCES_LIST: ListPanelDef = {
  label: { zh: '最大的排放源', en: 'Largest emission sources' },
  indicators: INDICATORS,
  file: 'trace-sources.json',
  layered: true,
  countryField: 'iso3',
  sorts: [
    { id: 'emissions', label: { zh: '依排放量', en: 'By emissions' } },
    { id: 'category', label: { zh: '依類別', en: 'By category' } },
  ],
  empty: { zh: '這一年沒有排放源的資料。', en: 'No emission sources for this year.' },
  rows: (points, { countryName, year, sort, country }) => {
    const ranked = points
      .map((p) => ({ p, v: emissionsAt(p, year) }))
      .filter((r): r is { p: PointRecord; v: number } => r.v !== null && r.v > 0)
      .sort((a, b) => b.v - a.v);
    const row = ({ p, v }: { p: PointRecord; v: number }, i: number, group?: string): ListRow => {
      const sub = SUBSECTORS[p.s as number];
      // 台灣對到環境部的事業時，中文介面寫環境部的事業名稱，Climate TRACE 的英文名稱另起一行
      const zhName = getLang() === 'zh' && typeof p.twn === 'string' ? p.twn : null;
      return {
        key: `${p.name}-${p.lon}-${p.lat}`,
        title: zhName ?? String(p.name),
        titleProper: true,
        ...(zhName ? { properNoun: String(p.name) } : {}),
        lines: [
          [`${i + 1}. ${tonnes(v)}`, sub ? tr(sub) : null, typeof p.iso3 === 'string' ? countryName(p.iso3) : null]
            .filter(Boolean)
            .join(' · '),
        ],
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 9 },
        ...(group ? { group } : {}),
      };
    };
    const limit = country ? Infinity : LIST_TOP;
    if (sort !== 'category') return ranked.slice(0, limit).map((r, i) => row(r, i));
    return CATEGORIES.flatMap((c) => {
      const label = tr(c.label);
      return ranked
        .filter((r) => c.subs.includes(r.p.s as number))
        .slice(0, country ? Infinity : LIST_PER_CATEGORY)
        .map((r, i) => row(r, i, label));
    });
  },
};

const trace = (id: string, file: string, label: Text, description: Text) => ({ id, file, label, description });

export const climateTracePart: TopicPart = {
  name: { zh: 'Climate TRACE', en: 'Climate TRACE' },
  sources: [
    {
      name: {
        zh: 'Climate TRACE Emissions Inventory（Zenodo 每月一版，用的版本與資料到哪個月寫在國家側欄）',
        en: 'Climate TRACE Emissions Inventory (monthly releases on Zenodo; the version used and the latest month are shown in the country panel)',
      },
      url: 'https://doi.org/10.5281/zenodo.15014790',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '環境部「溫室氣體年排放量」（事業依法登錄、查驗的年排放量，data.gov.tw 16059）：台灣排放源的對照',
        en: 'Taiwan Ministry of Environment, annual GHG emissions reported by regulated facilities (data.gov.tw 16059): Taiwan comparison',
      },
      url: 'https://data.gov.tw/dataset/16059',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh:
      'Climate TRACE 是非營利聯盟用衛星、船舶與飛航訊號、工廠產能等資料，以模型估計每個排放源每月的排放，多數不是申報值，跟各國清冊、Global Carbon Project、EDGAR 的方法不同，數字也不同，所以做成另外的指標，不混進上面的序列。' +
      'Climate TRACE 每個月底出一版，網站跟著換（用的版本與資料到哪個月寫在國家側欄）；新一版的授權例外跟核對過的不同時，照用上一版。CO₂ 當量用 IPCC 第六次評估報告的 100 年全球暖化潛勢（甲烷約 27–30），網站其他指標用第五次（AR5）。國家合計跟 Climate TRACE 一樣不含森林與土地利用；國際航空、海運算在出發的機場、港口所在的國家，這點跟 GCP、EDGAR 不同。' +
      'Climate TRACE 有一部分子部門（5.12.0 版是其他能源使用、鐵路、其他製造、玻璃、石灰、其他化學、食品、紡織、掩埋場、含氟氣體等 18 個）的國家值直接取自 EDGAR v8.0 與 CEDS，其中 EDGAR 燃料燃燒的二氧化碳（IEA-EDGAR CO₂）授權禁止改作，又分不出每一國用的是哪一份，所以這些子部門的二氧化碳不算（甲烷、氧化亞氮、含氟氣體照算），因此比 Climate TRACE 網站公布的小，約少一成（台灣少了多少寫在台灣的附註）。' +
      '排放源地圖只收 Climate TRACE 自己估計的設施（電廠、鋼鐵、水泥、鋁、化學、石化、紙漿、煉油、油氣田、煤礦、金屬礦、機場、港口），有一年排放 1 萬公噸以上的才畫；其他製造、掩埋場等有一部分取自其他國家的申報資料庫，不畫。油氣田以盆地為單位，點在盆地中間；化學的城市合計（Climate TRACE 名稱裡有城市名）點在城市；不是一個地方的不畫：各國其餘油氣盆地的合計、以國名命名的純鹼合計（點在國家中間）。' +
      '台灣的電廠、鋼鐵廠、水泥廠、煉油廠等，對照環境部「溫室氣體年排放量」最新一年的申報（事業的直接排放）；兩邊的範圍不一定相同（例如中鋼的申報含廠內的電廠），麥寮的電廠、煉油廠與輕油裂解廠範圍切法不同，沒有對照。',
    en:
      'Climate TRACE is a non-profit coalition that models monthly emissions for each source from satellite imagery, ship and aircraft signals, plant capacities and other data; most figures are estimates rather than reported values, and its methods differ from national inventories, the Global Carbon Project and EDGAR, so it is kept as separate indicators. ' +
      'Climate TRACE publishes a new release at the end of each month and the site follows it (the version used and its latest month are shown in the country panel); if a new release changes the licence exceptions, the previous one is kept. CO₂-equivalents use the 100-year global warming potentials of the IPCC Sixth Assessment Report (methane about 27–30); the site’s other indicators use the Fifth (AR5). As in Climate TRACE, country totals exclude forestry and land use; international aviation and shipping are assigned to the country of the departure airport or port, unlike GCP and EDGAR. ' +
      'For some subsectors (in version 5.12.0, 18 of them: other energy use, railways, other manufacturing, glass, lime, other chemicals, food, textiles, landfills, fluorinated gases and others) Climate TRACE takes country values from EDGAR v8.0 and CEDS. EDGAR’s fuel-combustion CO₂ (IEA-EDGAR CO₂) may not be adapted under its licence, and the files do not say which source each country uses, so CO₂ from these subsectors is left out (methane, nitrous oxide and F-gases are kept), which makes the figures roughly a tenth lower than those on the Climate TRACE website (Taiwan’s note gives its amount). ' +
      'The source map shows only facilities estimated by Climate TRACE itself (power plants, steel, cement, aluminium, chemicals, petrochemicals, pulp, refineries, oil and gas fields, coal and metal mines, airports and ports): those that emitted 10,000 tonnes or more in some year. Other manufacturing, landfills and the like partly come from other countries’ reporting databases and are not shown. Oil and gas fields are whole basins, plotted at their centre; city-level chemical totals are plotted at the city; totals that are not one place (each country’s remaining oil and gas basins, national soda-ash totals plotted at the country’s centre) are not shown. ' +
      'Taiwan’s power plants, steel and cement plants, refineries and the like are compared with the latest direct emissions the facilities reported to the Ministry of Environment, whose boundaries may differ (China Steel’s report includes its on-site power plant); the Mailiao power plants, refinery and crackers are split differently and are not compared.',
  },
  panelExtra: () => import('./panels/TracePanel'),
  overlays: [SOURCES],
  listPanel: [SOURCES_LIST],
  indicators: [
    {
      ...trace(
        'trace',
        'trace/{item}.json',
        { zh: '年排放量（Climate TRACE）', en: 'Annual emissions (Climate TRACE)' },
        {
          zh: 'Climate TRACE 以模型估計的年排放量（CO₂ 當量，AR6），2015 年到最新的完整一年。圓的面積與排放量成正比。選上方的「部門」看電力、製造業、交通運輸等。跟上面的 GCP、EDGAR 方法不同；取自 EDGAR、CEDS 的二氧化碳不算（見說明）。',
          en: 'Annual emissions modelled by Climate TRACE (CO₂-equivalents, AR6), from 2015 to the latest full year. Circle area is proportional to emissions. Use "Sector" above for power, manufacturing, transport and more. Methods differ from GCP and EDGAR above, and CO₂ taken from EDGAR and CEDS is left out (see the note).',
        },
      ),
      unit: CO2E,
      dimension: SECTOR_DIM,
      defaultYear: 'latest',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: tonnes,
      formatTick: tonnesTick,
      shareOfWorld: true,
    },
    {
      ...trace(
        'trace-per-capita',
        'trace-per-capita.json',
        { zh: '人均排放（Climate TRACE）', en: 'Emissions per person (Climate TRACE)' },
        {
          zh: 'Climate TRACE 估計的全部部門排放除以人口（UN WPP 2024），2015 年到最新的完整一年；人口不到 10 萬的不算。國際航空、海運算在出發的國家，新加坡這類轉運大國會比其他算法高。',
          en: 'Climate TRACE’s all-sector estimate divided by population (UN WPP 2024), from 2015 to the latest full year; places under 100,000 people are left out. International aviation and shipping count for the departure country, so hubs such as Singapore come out higher than in other estimates.',
        },
      ),
      unit: CO2E_PER_PERSON,
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1.5, 3, 5, 8, 12, 20] } },
      format: (v) => `${fixed(v, v < 10 ? 2 : 1)} ${tr(CO2E_PER_PERSON)}`,
      formatTick: (v) => fixed(v, v % 1 === 0 ? 0 : 1),
      compareWorld: true,
    },
    {
      ...trace(
        'trace-change',
        'trace-change/{item}.json',
        { zh: '排放比去年同期（Climate TRACE）', en: 'Change from a year earlier (Climate TRACE)' },
        {
          zh: 'Climate TRACE 估計的今年 1 月到資料最新一個月的排放，比去年同期增減幾 %（期間寫在時間軸上；去年同期不到 10 萬公噸的不算）。選上方的「部門」看各部門，世界的值寫在排名表上面。每個月的估計之後還會修正。',
          en: 'Climate TRACE’s estimate from January of the latest year to its latest month, compared with the same months a year earlier (the period is shown on the timeline; countries under 100,000 tonnes in the earlier period are left out). Use "Sector" above for each sector; the world figure is at the top of the ranking. Monthly estimates are revised later.',
        },
      ),
      unit: '%',
      dimension: SECTOR_DIM,
      timeAxis: { label: { zh: '期間', en: 'Period' }, year: period, tick: period },
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-10, -5, -2, 2, 5, 10], reverse: true } },
      format: (v) => formatSignedPercent(v, 1),
      formatTick: (v) => formatSignedPercent(v, 0),
      unranked: true,
      panelChart: false,
    },
    {
      ...trace(
        'trace-sources',
        'trace-sources-total.json',
        { zh: '排放源地圖（Climate TRACE）', en: 'Emission sources map (Climate TRACE)' },
        {
          zh: '每個點是一個排放源（電廠、鋼鐵廠、水泥廠、煉油廠、礦場、機場、港口…），大小是那一年的排放量（CO₂ 當量，AR6），顏色是類別，2021 年到最新的完整一年。縮小時只畫 100 萬公噸以上的，放大後才有較小的。左邊清單依排放量排名，點了移過去。國家的值是地圖上這一國的排放源合計（不是全國的排放）。',
          en: 'Each dot is an emission source (power plant, steel or cement plant, refinery, mine, airport, port…), sized by that year’s emissions (CO₂-equivalents, AR6) and coloured by category, from 2021 to the latest full year. Zoomed out, only sources of 1 million tonnes or more are drawn. The list on the left ranks them; click one to go there. A country’s value is the total of its sources on the map, not its national emissions.',
        },
      ),
      unit: CO2E,
      defaultYear: 'latest',
      layer: { kind: 'none' },
      format: tonnes,
      formatTick: tonnesTick,
    },
  ],
};
