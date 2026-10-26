import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { FlowLabels, IndicatorDef, PointsOverlayDef, Text, TopicDefinition } from './types';

/**
 * 塑膠污染（pipeline/topics/plastic.py）：
 * - Cottom 等人（2024）SPOT 模型的 2020 年塑膠污染排放（碎片＋露天焚燒）、塑膠垃圾產生量、沒有垃圾收集服務的人口
 * - Meijer 等人（2021）的河川入海塑膠（2015 年），國家合計加上河口的點
 * - BACI 的塑膠廢料（HS 3915）貿易流向，1995–2024 年，公噸
 * 前兩個都是模型估計值，說明與附註寫明；台灣的官方統計（環境部、財政部）只在附註與側欄，是不同的量測。
 */

const TONNES = { zh: '公噸', en: 'tonnes' };
const KG = { zh: '公斤', en: 'kg' };

export const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` });
export const kgPerPerson = (v: number) => {
  const digits = v === 0 ? 0 : v < 1 ? 2 : v < 10 ? 1 : 0;
  return tr({ zh: `${fixed(v, digits)} 公斤`, en: `${fixed(v, digits)} kg` });
};

/**
 * 內陸國（Marine Regions 第 12 版的 Landlocked country 加上科索沃，跟 pipeline/topics/plastic.py 的 landlocked 同一份）：
 * Meijer 的模型只算河口，上游國家的塑膠算在出海口所在的國家。模型把裏海也當成海，裏海沿岸國照算
 */
const LANDLOCKED = [
  'AFG', 'AND', 'ARM', 'AUT', 'BDI', 'BFA', 'BLR', 'BOL', 'BTN', 'BWA', 'CAF', 'CHE', 'CZE', 'ETH', 'HUN', 'KGZ',
  'LAO', 'LIE', 'LSO', 'LUX', 'MDA', 'MKD', 'MLI', 'MNG', 'MWI', 'NER', 'NPL', 'PRY', 'RWA', 'SMR', 'SRB', 'SSD',
  'SVK', 'SWZ', 'TCD', 'TJK', 'UGA', 'UZB', 'VAT', 'XKX', 'ZMB', 'ZWE',
];

const LANDLOCKED_REASON: Text = {
  zh: '內陸國：模型只算河口，上游的塑膠算在出海口所在的國家',
  en: 'Landlocked: the model counts river mouths, so upstream plastic counts for the country at the mouth',
};

const MODEL_NOTE = {
  zh: 'Cottom 等人（2024）的 SPOT 模型估計，誤差大（側欄有 90% 區間）。',
  en: 'Estimates from the Cottom et al. (2024) SPOT model, with wide uncertainty (90% interval in the side panel).',
};

const FORM_TEXT = {
  zh: '一般垃圾裡大於 5 mm 的塑膠跑到環境裡，包括留在環境的碎片與露天焚燒的（2020 年，不含漁具等海上來源）。',
  en: 'plastic over 5 mm from municipal waste escaping into the environment, as debris or by open burning (2020; sea-based sources such as fishing gear excluded).',
};

const FLOW_LABELS: Record<'export' | 'import', FlowLabels> = {
  export: {
    partners: { zh: '塑膠廢料的去向', en: 'plastic waste destinations' },
    main: { zh: '塑膠廢料出口到', en: 'Plastic waste exported to' },
    verb: (origin, partner) =>
      tr({ zh: `${origin}出口到${partner}的塑膠廢料`, en: `Plastic waste exported from ${origin} to ${partner}` }),
  },
  import: {
    partners: { zh: '塑膠廢料的來源', en: 'plastic waste sources' },
    main: { zh: '塑膠廢料進口自', en: 'Plastic waste imported from' },
    verb: (origin, partner) =>
      tr({ zh: `${origin}從${partner}進口的塑膠廢料`, en: `Plastic waste imported into ${origin} from ${partner}` }),
  },
};

const TRADE_TEXT = {
  zh: 'HS 3915 塑膠的廢料、下腳及碎屑（含工廠的下腳料）。中國 2018 年起禁止進口後，改流向東南亞、土耳其等地。',
  en: 'HS 3915 waste, parings and scrap of plastics (including factory offcuts). After China banned imports from 2018, flows shifted to Southeast Asia, Turkey and elsewhere.',
};

function flow(direction: 'export' | 'import', label: Text, description: Text): IndicatorDef {
  return {
    id: direction,
    label,
    description,
    unit: TONNES,
    file: `${direction}.json`,
    layer: { kind: 'flow', file: 'flows/{year}.json', direction, labels: FLOW_LABELS },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
    defaultYear: 2024,
  };
}

const RIVERS: PointsOverlayDef = {
  kind: 'points',
  id: 'rivers',
  file: 'rivers.json',
  label: { zh: '河口（Meijer 等人的模型）', en: 'River mouths (Meijer et al. model)' },
  indicators: ['ocean'],
  radius: { field: 't', stops: [[1, 1.2], [100, 2.4], [1000, 4], [10000, 8], [60000, 15]] },
  color: MAP_TOKENS.categorical[7],
  sortField: 't',
  // 世界全圖只畫每年 100 公噸以上的河口（約 1,500 個，占八成），放大才畫小的
  minValue: { field: 't', stops: [[0, 100], [3, 20], [4, 5], [6, 1]] },
  sizeLegend: {
    title: { zh: '每年流入海洋（公噸）', en: 'Tonnes a year into the ocean' },
    values: [100, 1000, 10000],
    format: (v) => formatLargeNumber(v),
  },
  tooltip: (p, { countryName }) => {
    const t = Number(p.t);
    const rank = Number(p.r);
    const where = typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null;
    return {
      title: tr({ zh: '河口（模型估計，2015 年）', en: 'River mouth (model estimate, 2015)' }),
      // 河口的量寫到個位數（中文的「萬」取整數，6.3 萬會變成 6 萬）
      detail: tr({
        zh: `每年約 ${fixed(t, t < 10 ? 1 : 0)} 公噸的塑膠流入海洋`,
        en: `About ${fixed(t, t < 10 ? 1 : 0)} t of plastic a year into the ocean`,
      }),
      extra: [
        tr({ zh: `全世界 31,819 個河口的第 ${rank.toLocaleString('en-US')} 名`, en: `#${rank.toLocaleString('en-US')} of 31,819 river mouths` }),
        ...(where ? [where] : []),
      ],
    };
  },
};

const indicators: IndicatorDef[] = [
  {
    id: 'per-capita',
    label: { zh: '人均排放', en: 'Emissions per person' },
    description: {
      zh: `每人每年排放的塑膠（公斤）：${FORM_TEXT.zh}${MODEL_NOTE.zh}`,
      en: `Plastic emitted per person per year (kg): ${FORM_TEXT.en} ${MODEL_NOTE.en}`,
    },
    unit: KG,
    file: 'per-capita/{item}.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 2, 5, 10, 15] } },
    format: kgPerPerson,
    formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
    compareWorld: true,
  },
  {
    id: 'total',
    label: { zh: '年排放量', en: 'Annual emissions' },
    description: {
      zh: `一年排放的塑膠（公噸）：${FORM_TEXT.zh}全世界約 5,200 萬公噸，57% 是露天焚燒。${MODEL_NOTE.zh}`,
      en: `Plastic emitted in a year (tonnes): ${FORM_TEXT.en} About 52 million tonnes worldwide, 57% burned in the open. ${MODEL_NOTE.en}`,
    },
    unit: TONNES,
    file: 'total/{item}.json',
    layer: { kind: 'bubble', legendValues: [1e5, 1e6, 5e6] },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  },
  {
    id: 'generation',
    label: { zh: '人均塑膠垃圾', en: 'Plastic waste per person' },
    description: {
      zh: '每人每年產生的塑膠垃圾（公斤，2020 年，SPOT 模型估計），不論後來回收、焚化、掩埋還是跑到環境裡。產生得多不等於污染多：垃圾有收集、處理的國家，排放只是很小一部分。',
      en: 'Plastic waste generated per person per year (kg, 2020, SPOT model estimate), whether later recycled, incinerated, landfilled or released. More waste does not mean more pollution: where waste is collected and managed, little escapes.',
    },
    unit: KG,
    file: 'generation.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 25, 35, 45, 60, 80] } },
    format: kgPerPerson,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  },
  {
    id: 'no-collection',
    label: { zh: '沒有垃圾收集的人口', en: 'People without waste collection' },
    description: {
      zh: '沒有垃圾收集服務的人口比例（2020 年，SPOT 模型估計）。沒收的垃圾常被丟棄或燒掉，是塑膠污染最大的來源；全世界約 15%、近 12 億人。',
      en: 'Share of people without municipal waste collection (2020, SPOT model estimate). Uncollected waste is often dumped or burned and is the largest source of plastic pollution; about 15% of people worldwide, nearly 1.2 billion.',
    },
    unit: '%',
    file: 'no-collection.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 75] } },
    format: (v) => formatPercent(v, v < 10 ? 1 : 0),
    formatTick: (v) => `${fixed(v, 0)}%`,
    compareWorld: true,
  },
  {
    id: 'ocean',
    label: { zh: '河川流入海洋的塑膠', en: 'River plastic into the ocean' },
    description: {
      zh: '每年經河川流進海洋的漂浮塑膠（公噸，2015 年，Meijer 等人 2021 年的模型估計），依河口位置加總到國家（裏海也當成海）。全世界約 100 萬公噸（範圍 80 萬–270 萬），一千多條河占八成，多是熱帶的都市小河。點是河口。',
      en: 'Floating plastic carried into the ocean by rivers each year (tonnes, 2015, Meijer et al. 2021 model estimate), summed by the country of the river mouth (the Caspian counts as sea). About 1 million tonnes worldwide (range 0.8–2.7 million); some 1,000 rivers, mostly small urban ones in the tropics, carry 80%. Dots are river mouths.',
    },
    unit: TONNES,
    file: 'ocean.json',
    layer: { kind: 'bubble', legendValues: [1e3, 1e4, 1e5] },
    format: tonnes,
    formatTick: formatLargeTick,
    shareOfWorld: true,
    noValue: Object.fromEntries(LANDLOCKED.map((iso) => [iso, LANDLOCKED_REASON])),
  },
  flow(
    'export',
    { zh: '塑膠廢料出口', en: 'Plastic waste exports' },
    {
      zh: `點選國家，弧線連到前 15 大出口對象，線寬與公噸數成正比。${TRADE_TEXT.zh}`,
      en: `Click a country to draw arcs to its top 15 destinations; line width is proportional to tonnes. ${TRADE_TEXT.en}`,
    },
  ),
  flow(
    'import',
    { zh: '塑膠廢料進口', en: 'Plastic waste imports' },
    {
      zh: `點選國家，弧線連到前 15 大進口來源，線寬與公噸數成正比。${TRADE_TEXT.zh}`,
      en: `Click a country to draw arcs to its top 15 sources; line width is proportional to tonnes. ${TRADE_TEXT.en}`,
    },
  ),
];

export const plastic: TopicDefinition = {
  id: 'plastic',
  title: { zh: '塑膠污染', en: 'Plastic pollution' },
  shortTitle: { zh: '塑膠污染', en: 'Plastics' },
  defaultIndicator: 'per-capita',
  defaultYear: 2020,
  // 頁尾的來源與說明要短：英文版太長會把地圖擠扁（完整的引用在 manifest.json 與 DESIGN.md 第 8 節第 78 點）
  sources: [
    {
      name: { zh: 'Cottom 等人（2024），Nature 633（SPOT 模型）', en: 'Cottom et al. (2024), Nature 633 (SPOT model)' },
      url: 'https://doi.org/10.5061/dryad.8cz8w9gxb',
      license: 'CC0 1.0',
    },
    {
      name: { zh: 'Meijer 等人（2021），Science Advances 7', en: 'Meijer et al. (2021), Science Advances 7' },
      url: 'https://doi.org/10.6084/m9.figshare.14515590.v1',
      license: 'CC BY 4.0',
    },
    {
      name: 'CEPII, BACI (HS 3915)',
      url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
      license: 'Etalab 2.0',
    },
    {
      name: { zh: '環境部（台灣的對照）', en: 'Ministry of Environment, Taiwan (comparison)' },
      url: 'https://data.moenv.gov.tw/dataset/detail/STAT_P_45',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: '財政部（台灣 HS 3915 的對照）', en: 'Ministry of Finance, Taiwan (HS 3915 comparison)' },
      url: 'https://web02.mof.gov.tw/njswww/WebMain.aspx?sys=100&funid=defjsptgl',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '排放與河川入海量是模型估計值，不是實測；兩個模型的年份、範圍不同，不能相加。台灣的官方統計（環境部、財政部）是另一種量測，寫在附註與側欄。台灣在 BACI 是「Other Asia, nes」，數字來自貿易夥伴。海洋見「海洋與漁業」，所有商品的貿易見「國際貿易流向」。',
    en: 'Emissions and river inputs are model estimates, not measurements; the two models differ in year and scope and cannot be added. Taiwan’s official statistics are a different measure, given in the notes and side panel. Taiwan appears in BACI as “Other Asia, nes”, based on partner reports. See also Oceans and fisheries, and International trade flows.',
  },
  dimension: {
    label: { zh: '排放形式', en: 'Form' },
    // 圖例與標題是「子項目＋指標」：「塑膠碎片人均排放」「Plastic debris emissions per person」
    options: [
      { id: 'all', label: { zh: '全部塑膠', en: 'All plastic' } },
      { id: 'debris', label: { zh: '塑膠碎片', en: 'Plastic debris' } },
      { id: 'burn', label: { zh: '露天焚燒的塑膠', en: 'Openly burned plastic' } },
    ],
    defaultOption: 'all',
  },
  panelExtra: () => import('./panels/PlasticPanel'),
  overlays: [RIVERS],
  indicators,
};
