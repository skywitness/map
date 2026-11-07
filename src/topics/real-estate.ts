import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { housePricesPart } from './house-prices';
import type { ColorClasses, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 房價與房租（新主題，2026-11-07，製作手冊第二十五批 470，候選 1121；新小類「不動產」）：
 * - 社會類「住宅與房價」的 5 個房價指標搬過來（house-prices.ts 的 housePricesPart，資料照舊在 housing/，舊網址由
 *   redirects.ts 的 INDICATOR_MOVES 轉過來）；
 * - Eurostat 派駐地城市的房租與台灣六都的實價登錄租金（pipeline/topics/real_estate_rents.py 的 housing/rents.json），
 *   城市的點、依房型分五個子項目，時間軸 2013–2025
 */
const FIRST = 2013;
const LAST = 2025;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const TYPES = [
  { id: 'flat1', label: { zh: '一房公寓', en: 'One-bedroom flat' } },
  { id: 'flat2', label: { zh: '兩房公寓', en: 'Two-bedroom flat' } },
  { id: 'flat3', label: { zh: '三房公寓', en: 'Three-bedroom flat' } },
  { id: 'house-d', label: { zh: '獨棟住宅', en: 'Detached house' } },
  { id: 'house-nd', label: { zh: '連棟住宅', en: 'Non-detached house' } },
];
const THRESHOLDS = [600, 900, 1200, 1600, 2200, 3000];
const euro = (v: number) => `${fixed(v, 0)} €`;
const RENT_COLORS: ColorClasses = {
  field: 'r',
  title: { zh: '一個月的房租', en: 'Monthly rent' },
  thresholds: THRESHOLDS,
  classes: MAP_TOKENS.sequential.map((color, i) => ({
    color,
    label:
      i === 0
        ? `< ${euro(THRESHOLDS[0])}`
        : i === THRESHOLDS.length
          ? `≥ ${euro(THRESHOLDS[i - 1])}`
          : `${fixed(THRESHOLDS[i - 1], 0)}–${euro(THRESHOLDS[i])}`,
  })),
};

const num = (p: PointRecord, f: string) => (typeof p[f] === 'number' ? (p[f] as number) : null);
const cityName = (p: PointRecord) => tr({ zh: String(p.name ?? ''), en: String(p.nameEn ?? p.name ?? '') });
const clampYear = (y: number) => Math.min(LAST, Math.max(FIRST, y));

function facts(p: PointRecord, type: string, year: number): string[] {
  const v = num(p, `${type}_${year}`);
  if (v == null) return [tr({ zh: `${year} 年沒有這種房型的資料`, en: `No data for this dwelling type in ${year}` })];
  if (p.tw === 1) {
    const ntd = num(p, `${type}_ntd`) ?? 0;
    const n = num(p, `${type}_n`) ?? 0;
    return [
      tr({ zh: `月租中位數 ${fixed(ntd, 0)} 元（約 ${euro(v)}）`, en: `Median rent NT$${fixed(ntd, 0)} a month (about ${euro(v)})` }),
      tr({
        zh: `實價登錄 2026 年第 3 季發布、${fixed(n, 0)} 筆整戶出租的住宅`,
        en: `${fixed(n, 0)} whole-unit residential leases filed in the 2026 Q3 release of the actual price register`,
      }),
    ];
  }
  return [tr({ zh: `${year} 年一個月 ${euro(v)}`, en: `${euro(v)} a month in ${year}` })];
}

function overlay(type: (typeof TYPES)[number]): PointsOverlayDef {
  return {
    kind: 'points',
    id: `rent-${type.id}`,
    file: 'rents.json',
    label: { zh: '城市的房租', en: 'City rents' },
    indicators: ['city-rent'],
    items: [type.id],
    epochs: { years: YEARS, values: (p, y) => ({ r: num(p, `${type.id}_${y}`) }) },
    minValue: { field: 'r', stops: [[0, 1]] },
    radius: 6,
    color: RENT_COLORS,
    sortField: 'r',
    tooltip: (p, { year }) => ({
      title: cityName(p),
      detail: tr(type.label),
      extra: facts(p, type.id, clampYear(year ?? LAST)),
    }),
  };
}

const LIST: ListPanelDef = {
  label: { zh: '城市的房租', en: 'City rents' },
  indicators: ['city-rent'],
  file: 'rents.json',
  rows: (points, { year, item }) => {
    const type = item ?? 'flat1';
    const y = clampYear(year);
    return points
      .filter((p) => num(p, `${type}_${y}`) != null)
      .sort((a, b) => (num(b, `${type}_${y}`) ?? 0) - (num(a, `${type}_${y}`) ?? 0))
      .map(
        (p, i): ListRow => ({
          key: `rent-${type}-${i}-${p.nameEn}`,
          title: `${i + 1}. ${cityName(p)} · ${euro(num(p, `${type}_${y}`)!)}`,
          lines: p.tw === 1 ? facts(p, type, y) : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 6 },
        }),
      );
  },
};

const cityRent: IndicatorDef = {
  id: 'city-rent',
  label: { zh: '城市的房租', en: 'City rents' },
  description: {
    zh: '歐盟派駐地城市（Eurostat 替歐盟職員算生活補正係數的調查，不是各國主要城市的樣本）一個月的房租，依房型分，拖時間軸看 2013 年起的變化；台灣六都是實價登錄的月租中位數，換成歐元比。2025 年一房公寓：日內瓦 2,550 歐元、斯德哥爾摩 2,100、都柏林與奧斯陸 2,000、盧森堡與雷克雅維克 1,900、慕尼黑 1,650、巴黎 1,550、里斯本 1,400、柏林 1,350；華沙 840、布加勒斯特 670、安卡拉 610，斯科普里 330 最低。臺北市約 852 歐元（月租中位數 30,000 元），新北市約 565、高雄市約 483、桃園市約 409 歐元。倫敦、Culham（英國）與普里斯提納照網站的規則不收。左邊的清單依租金列出。',
    en: 'Monthly rent in the EU’s staff duty-station cities (a Eurostat survey used to set cost-of-living coefficients for EU staff, not a sample of each country’s main cities), by dwelling type; drag the time slider to see changes since 2013. Taiwan’s six special municipalities show median rents from the actual price register, converted to euros. In 2025 a one-bedroom flat cost €2,550 a month in Geneva, €2,100 in Stockholm, €2,000 in Dublin and Oslo, €1,900 in Luxembourg and Reykjavík, €1,650 in Munich, €1,550 in Paris, €1,400 in Lisbon and €1,350 in Berlin; €840 in Warsaw, €670 in Bucharest, €610 in Ankara and €330 in Skopje, the lowest. Taipei is about €852 (a median of NT$30,000), New Taipei about €565, Kaohsiung €483 and Taoyuan €409. London, Culham (UK) and Pristina are left out under the site’s rules. The list on the left ranks the cities.',
  },
  unit: '',
  file: 'city-rent/{item}.json',
  layer: { kind: 'none' },
  dimension: {
    label: { zh: '房型', en: 'Dwelling' },
    options: TYPES,
    defaultOption: 'flat1',
  },
  unranked: true,
  rankingBars: false,
  panelChart: false,
  format: () => '',
  missing: { zh: '國家不上色，看地圖上的城市', en: 'Countries are not coloured; see the cities on the map' },
  defaultYear: LAST,
};

export const realEstate: TopicDefinition = {
  id: 'real-estate',
  dataTopic: 'housing',
  title: { zh: '房價與房租', en: 'House prices and rents' },
  shortTitle: { zh: '房價與房租', en: 'Prices & rents' },
  defaultIndicator: 'real-price-10y',
  defaultYear: 2025,
  sources: [
    ...housePricesPart.sources,
    {
      name: { zh: 'Eurostat：Average rent per month in cities by type of dwelling（prc_colc_rents）', en: 'Eurostat: Average rent per month in cities by type of dwelling (prc_colc_rents)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/prc_colc_rents/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '內政部 不動產成交案件實際資訊（租賃，2026 年第 3 季）', en: 'Ministry of the Interior (Taiwan), actual price register (leases, 2026 Q3)' },
      url: 'https://plvr.land.moi.gov.tw/DownloadOpenData',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'Natural Earth 1:10m populated places（城市位置）', en: 'Natural Earth 1:10m populated places (city locations)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'Public domain' },
    },
  ],
  note: {
    zh:
      `${housePricesPart.note.zh} ` +
      '城市的房租是 Eurostat 給歐盟職員算生活補正係數的派駐地調查：調查的是外派人員會租的典型住宅，比當地人實際付的高，金額是到百位的概數；城市名單有卡爾斯魯厄、波昂、瓦雷澤（伊斯普拉的聯合研究中心）這類小地方，沒有巴塞隆納、米蘭、漢堡。非歐元區的城市換成歐元，匯率也會影響。台灣六都用內政部實價登錄 2026 年第 3 季發布的租賃案件：整戶出租的公寓、華廈、住宅大樓，住家用、至少一廳，依房間數對到一到三房，月租扣掉車位的租金後取中位數，再用 Eurostat 2025 年的歐元兌新台幣年平均匯率（35.196）換成歐元，放在 2025 年；只有有申報的租約，房東沒申報的很多，筆數寫在滑過的說明，不能當成全市的租金水準。',
    en:
      `${housePricesPart.note.en} ` +
      'City rents come from Eurostat’s survey of EU staff duty stations, used to set cost-of-living coefficients: it covers the kind of dwelling an expatriate would rent, which costs more than what locals actually pay, and amounts are rounded to the hundred. The list includes small places such as Karlsruhe, Bonn and Varese (for the Joint Research Centre at Ispra) but not Barcelona, Milan or Hamburg. Rents outside the euro area are converted to euros, so exchange rates matter too. Taiwan’s six special municipalities use leases from the 2026 Q3 release of the Ministry of the Interior’s actual price register: whole-unit lets of apartments and residential towers for residential use with at least one living room, matched to one to three bedrooms by room count, with any parking rent deducted; the median is converted to euros at Eurostat’s 2025 average rate (NT$35.196 per euro) and shown for 2025. Only registered leases are included, and many landlords do not register, so the count is shown on hover and the figures are not a citywide rent level.',
  },
  panelExtra: () => import('./panels/HousePricesPanel'),
  overlays: TYPES.map(overlay),
  listPanel: [LIST],
  indicators: [...housePricesPart.indicators.map((i) => ({ ...i, defaultYear: 2025 })), cityRent],
};
