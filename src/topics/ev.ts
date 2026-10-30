import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, TopicDefinition } from './types';

const CARS = { zh: '輛', en: 'cars' };
const CHARGERS = { zh: '個', en: 'chargers' };
const PER_CHARGER = { zh: '輛/樁', en: 'EVs/charger' };
const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

/** 去掉小數尾端多餘的 0：44.00M → 44M、1.10M → 1.1M、3.0 → 3 */
const trimZeros = (s: string) => s.replace(/\.(\d*?)0+(?!\d)/, (_m, d: string) => (d ? `.${d}` : ''));

/** IEA 只有兩位有效數字，照兩位有效數字顯示：97、9.6、0.45、3（台灣自己算的值也一樣） */
export function sig2(v: number): string {
  if (v === 0) return fixed(0, 0);
  return trimZeros(fixed(v, Math.max(0, 1 - Math.floor(Math.log10(Math.abs(v))))));
}

/**
 * 輛數、充電樁數：100 萬以下寫完整數字（142,370），以上中文用萬、億（7,500 萬），英文用 M（44M、1.1M）。
 * 共用的 formatLargeNumber 在中文會把萬取整數（14 萬），這裡的數字多半在幾千到幾十萬，所以不用它。
 */
export function count(v: number): string {
  return Math.abs(v) < 1e6 ? fixed(v, 0) : trimZeros(formatLargeNumber(v));
}

const percent = (v: number) => `${sig2(v)}%`;

/** 停售燃油新車的年份（pipeline/topics/ev_phaseout.py）：值是年份本身，0 是沒有宣布 */
const PHASEOUT_YEAR: CategoryDef[] = [
  { value: 2000, max: 2025, label: { zh: '2025 年以前', en: 'By 2025' } },
  { value: 2026, max: 2039, label: { zh: '2030 年代', en: '2030s' } },
  { value: 2040, max: 2049, label: { zh: '2040 年代', en: '2040s' } },
  { value: 2050, max: 2059, label: { zh: '2050 年代', en: '2050s' } },
  { value: 0, label: { zh: '沒有宣布', en: 'None announced' }, color: MAP_TOKENS.categoricalOther },
];
/** 停售的狀態（pipeline 的 LEGISLATED、POLICY、DECLARATION、NONE） */
const PHASEOUT_STATUS: CategoryDef[] = [
  { value: 1, label: { zh: '已立法或已實施', en: 'Legislated or in force' } },
  { value: 2, label: { zh: '政策目標', en: 'Policy target' } },
  { value: 3, label: { zh: '只簽了格拉斯哥宣言', en: 'Glasgow Declaration only' } },
  { value: 0, label: { zh: '沒有宣布', en: 'None announced' }, color: MAP_TOKENS.categoricalOther },
];
const categoryText = (list: CategoryDef[], v: number) =>
  tr(list.find((c) => v >= c.value && v <= (c.max ?? c.value))?.label ?? { zh: '', en: '' });
const WIKI_PHASEOUT = 'https://en.wikipedia.org/w/index.php?title=Phase-out_of_fossil_fuel_vehicles&oldid=1380317959';

export const ev: TopicDefinition = {
  id: 'ev',
  title: { zh: '各國電動車', en: 'Electric cars by country' },
  shortTitle: { zh: '電動車', en: 'EVs' },
  defaultIndicator: 'sales-share',
  defaultYear: 2025,
  sources: [
    {
      name: 'IEA, Global EV Data Explorer (Global EV Outlook 2026)',
      url: 'https://www.iea.org/data-and-statistics/data-tools/global-ev-data-explorer',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '交通部公路局 統計查詢網（新車領牌數、機動車輛登記數，按使用燃料分）',
        en: 'Highway Bureau, Ministry of Transportation and Communications (Taiwan), vehicle registrations by fuel type',
      },
      url: 'https://stat.thb.gov.tw/hb01/webMain.aspx?sys=100&funid=defjsp',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: '交通部 新聞稿（台灣的公共充電樁數，見附註）',
        en: 'Ministry of Transportation and Communications (Taiwan), press releases (public charging points in Taiwan, see notes)',
      },
      url: 'https://www.motc.gov.tw/ch/app/data/view?module=news&id=14&serno=3df3fb48-8179-4028-944c-6f4f7e99e2e9',
      license: { zh: '交通部政府資料開放宣告', en: 'MOTC open data declaration' },
    },
    {
      name: {
        zh: '英文維基百科「Phase-out of fossil fuel vehicles」（停售燃油車的年份與狀態）',
        en: 'English Wikipedia, "Phase-out of fossil fuel vehicles" (phase-out years and status)',
      },
      url: WIKI_PHASEOUT,
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '國發會《臺灣2050淨零排放路徑及策略總說明》（台灣的停售年份）',
        en: "National Development Council (Taiwan), Taiwan's 2050 net-zero pathway (Taiwan's phase-out year)",
      },
      url: 'https://www.ndc.gov.tw/Content_List.aspx?n=FD76ECBAE77D9811',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '「電動車」跟 IEA 的定義一樣，是純電（BEV）加插電式混合（PHEV，含增程式），只算小客車，不含燃料電池車與不能外接充電的油電混合車。' +
      'IEA 只涵蓋約 40–60 個主要汽車市場（銷售占比 61 國、保有量 46 國、充電樁 43 國），其他國家在地圖上是灰色；數值四捨五入到兩位有效數字，世界值是 IEA 自己的估計。' +
      '台灣不在 IEA 的資料中，改用交通部公路局的小客車領牌與登記數，充電樁沒有逐年統計而從缺，見台灣側欄的附註。' +
      '停售燃油車的年份與狀態依英文維基百科條目的國家表（2026 年 10 月的版本），逐國分成已立法、政策目標、只簽格拉斯哥宣言；表裡沒有的歐盟國家依歐盟 2035 年的法規補上。',
    en:
      '"Electric cars" follows the IEA definition: battery-electric (BEV) plus plug-in hybrid (PHEV, including range-extended) passenger cars, excluding fuel-cell cars and conventional hybrids that cannot be plugged in. ' +
      'The IEA covers only about 40–60 major car markets (61 countries for sales share, 46 for stock, 43 for chargers), so other countries are grey on the map; values are rounded to two significant figures and world values are the IEA\'s own estimates. ' +
      'Taiwan is not in the IEA data, so passenger car registrations from the Highway Bureau are used instead; there is no yearly series of public chargers, so those are left blank. See the notes in Taiwan\'s panel. ' +
      'Phase-out years and status follow the country table in the English Wikipedia article (October 2026 revision), sorted by hand into legislated, policy target or Glasgow Declaration only; EU members not in the table are added under the EU\'s 2035 rule.',
  },
  panelExtra: () => import('./panels/EvPanel'),
  indicators: [
    {
      id: 'sales-share',
      label: { zh: '電動車新車占比', en: 'EV share of new car sales' },
      description: {
        zh: '一年內新賣出的小客車中，電動車（純電＋插電式混合）所占的比例。',
        en: 'Share of new passenger cars sold in the year that are electric (battery-electric plus plug-in hybrid).',
      },
      unit: '%',
      file: 'sales-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 60] } },
      format: percent,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'stock',
      label: { zh: '電動車保有量', en: 'Electric cars on the road' },
      description: {
        zh: '年底在路上的電動小客車（純電＋插電式混合）總數。圓的面積與輛數成正比。',
        en: 'Electric passenger cars (battery-electric plus plug-in hybrid) on the road at year end. Circle area is proportional to the number of cars.',
      },
      unit: CARS,
      file: 'stock.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: (v) => `${count(v)} ${tr(CARS)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'stock-share',
      label: { zh: '電動車保有量占比', en: 'EV share of cars on the road' },
      description: {
        zh: '電動小客車占全部小客車保有量的比例。新車換成電動車，要好幾年才會反映到路上的車。',
        en: 'Share of all passenger cars on the road that are electric. It takes years for new-car sales to show up in the fleet.',
      },
      unit: '%',
      file: 'stock-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: percent,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'chargers',
      label: { zh: '公共充電樁', en: 'Public charging points' },
      description: {
        zh: '開放給大眾使用的充電樁數（一個充電點同時只能充一輛車），含慢充（22 kW 以下）、快充（22–150 kW）與超快充（150 kW 以上）。圓的面積與數量成正比。',
        en: 'Publicly available charging points (each can charge one vehicle at a time): slow (up to 22 kW), fast (22–150 kW) and ultra-fast (150 kW and above). Circle area is proportional to the number.',
      },
      unit: CHARGERS,
      file: 'chargers.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: (v) => `${count(v)} ${tr(CHARGERS)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'evs-per-charger',
      label: { zh: '車樁比', en: 'EVs per public charger' },
      description: {
        zh: '電動輕型車（小客車與輕型商用車，純電＋插電式混合）除以公共充電樁數，數字越大，每個公共充電樁要服務的車越多。在家充電普遍的國家通常比較高。',
        en: 'Electric light-duty vehicles (cars and vans, battery-electric plus plug-in hybrid) per public charging point. Higher means each public charger serves more vehicles; it tends to be higher where home charging is common.',
      },
      unit: PER_CHARGER,
      file: 'evs-per-charger.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 50] } },
      format: (v) => `${sig2(v)} ${tr(PER_CHARGER)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    {
      id: 'phaseout-year',
      label: { zh: '停售燃油車的年份', en: 'Combustion car phase-out year' },
      description: {
        zh: '各國宣布不再賣汽油、柴油（或所有會排放廢氣的）新車的年份。歐盟 2035 年起新車要零排放（德國、義大利要求重新檢討）；挪威 2025 年的目標幾乎達成，衣索比亞 2024 年起禁止進口燃油車。很多是政策目標或只簽了不具約束力的格拉斯哥宣言（2040 年），見「停售的狀態」。滑過看範圍。',
        en: 'The year each country has announced it will stop sales of new petrol and diesel (or all tailpipe-emitting) vehicles. The EU requires zero-emission new cars from 2035 (Germany and Italy have asked for a review); Norway has almost met its 2025 target and Ethiopia banned combustion-car imports in 2024. Many dates are policy targets or come only from signing the non-binding Glasgow Declaration (2040); see Phase-out status. Hover to see the scope.',
      },
      unit: '',
      file: 'phaseout-year.json',
      layer: { kind: 'categorical', categories: PHASEOUT_YEAR, ordinal: true },
      format: (v) => (v === 0 ? tr({ zh: '沒有宣布', en: 'None announced' }) : tr({ zh: `${v} 年`, en: String(v) })),
      defaultYear: 2026,
    },
    {
      id: 'phaseout-status',
      label: { zh: '停售的狀態', en: 'Phase-out status' },
      description: {
        zh: '停售燃油新車的年份是法律、政策目標，還是只簽了 2021 年格拉斯哥氣候會議不具約束力的宣言（2040 年全球、主要市場 2035 年新車零排放）。依維基百科條目的表逐國判斷：歐盟法規與衣索比亞的進口禁令算已立法或已實施，政府的計畫、氣候計畫與提案算政策目標。',
        en: "Whether the phase-out date is law, a policy target, or only comes from signing the non-binding Glasgow Declaration of the 2021 climate conference (zero-emission new cars by 2040 globally and 2035 in leading markets). Classified country by country from the Wikipedia article's table: the EU rule and Ethiopia's import ban count as legislated or in force; government plans, climate plans and proposals count as policy targets.",
      },
      unit: '',
      file: 'phaseout-status.json',
      layer: { kind: 'categorical', categories: PHASEOUT_STATUS },
      format: (v) => categoryText(PHASEOUT_STATUS, v),
      defaultYear: 2026,
    },
  ],
};
