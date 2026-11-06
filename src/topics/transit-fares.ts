import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 大眾運輸的月票與計程車車資（2026-11-05，製作手冊第二十三批 409；pipeline/topics/transit_fares.py）：Eurostat Urban Audit
 * 的城市點。月票放「地鐵與城市軌道」，計程車車資照手冊的建議放「叫車服務」。國家不上色，排名表是有資料的城市數。
 */

const SOURCE: SourceDef = {
  name: { zh: 'Eurostat Urban Audit：城市的月票與計程車車資（urb_ctran 的 TT1080V、TT1081V）', en: 'Eurostat Urban Audit: city monthly passes and taxi fares (urb_ctran TT1080V, TT1081V)' },
  url: 'https://ec.europa.eu/eurostat/web/cities/database',
  license: 'CC BY 4.0',
};
const euro = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 2 : 1)} 歐元`, en: `€${fixed(v, v < 10 ? 2 : 1)}` });
const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個城市`, en: `${fixed(v, 0)} cities` });
const NOT_TW = { zh: '台灣沒有可以比的城市統計。', en: 'Taiwan has no comparable city statistics.' };
const COLORS = ['#e6efd9', '#bcd9a0', '#86bd63', '#4f9a37', '#2a6520'];

function place(p: PointRecord, countryName: (iso3: string) => string): string {
  return [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, p.g === 1 ? tr({ zh: '大城市範圍', en: 'greater city' }) : null]
    .filter(Boolean)
    .join(' · ');
}

function part(opts: {
  id: string;
  file: string;
  layerLabel: { zh: string; en: string };
  what: (v: number, y: number) => string;
  thresholds: number[];
  classLabels: { zh: string; en: string }[];
  indicator: Omit<IndicatorDef, 'id' | 'file' | 'layer' | 'format' | 'formatTick' | 'unit'>;
}): { overlay: PointsOverlayDef; listPanel: ListPanelDef; indicator: IndicatorDef } {
  const facts = (p: PointRecord, countryName: (iso3: string) => string) => [place(p, countryName), opts.what(Number(p.v), Number(p.y))];
  return {
    overlay: {
      kind: 'points',
      id: opts.file,
      file: `${opts.file}.json`,
      indicators: [opts.id],
      label: opts.layerLabel,
      radius: 5,
      color: { field: 'v', title: opts.layerLabel, thresholds: opts.thresholds, classes: opts.classLabels.map((label, i) => ({ label, color: COLORS[i] })) },
      sortField: 'v',
      tooltip: (p, { countryName }) => ({ title: String(p.n ?? ''), properNoun: String(p.n ?? ''), extra: facts(p, countryName) }),
    },
    listPanel: {
      label: opts.layerLabel,
      indicators: [opts.id],
      file: `${opts.file}.json`,
      countryField: 'iso3',
      rows: (points, { countryName }) =>
        [...points]
          .sort((a, b) => Number(b.v) - Number(a.v))
          .map((p, i): ListRow => ({
            key: `${p.n}-${i}`,
            title: String(p.n ?? ''),
            titleProper: true,
            lines: facts(p, countryName),
            target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
          })),
    },
    indicator: {
      ...opts.indicator,
      id: opts.id,
      unit: { zh: '個城市', en: 'cities' },
      file: `${opts.id}.json`,
      layer: { kind: 'none' },
      format: count,
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
    },
  };
}

export const monthlyPass = {
  source: SOURCE,
  ...part({
    id: 'monthly-pass',
    file: 'fares',
    layerLabel: { zh: '大眾運輸月票（歐洲城市）', en: 'Public transport monthly pass (European cities)' },
    what: (v, y) => tr({ zh: `月票 ${euro(v)}（${y} 年）`, en: `Monthly pass ${euro(v)} (${y})` }),
    thresholds: [25, 40, 55, 75],
    classLabels: [
      { zh: '不到 25 歐元', en: 'Under €25' },
      { zh: '25–40 歐元', en: '€25–40' },
      { zh: '40–55 歐元', en: '€40–55' },
      { zh: '55–75 歐元', en: '€55–75' },
      { zh: '75 歐元以上', en: '€75 or more' },
    ],
    indicator: {
      label: { zh: '大眾運輸月票多少錢（歐洲城市）', en: 'Monthly public transport pass (European cities)' },
      description: {
        zh: `歐洲 199 個城市市中心 5–10 公里、所有大眾運輸通用的月票價格（Eurostat Urban Audit，2019 年以後每個城市最近一年；更早的年份幣別有錯，不用）。芬蘭的萬塔 110.4 歐元（2024 年）、埃斯波 99.4 歐元最貴，蘇黎世、溫特圖爾 91.0 歐元、巴塞爾 90.0 歐元、漢堡 89.5 歐元（2019 年，德國 2023 年起有全國通用的 Deutschlandticket）；保加利亞的維丁 10.23 歐元（2022 年）、匈牙利的凱奇凱梅特 12.65 歐元最便宜。年份不同、各國物價也不同，只能大略比較。${NOT_TW.zh}`,
        en: `Price of a monthly pass for all public transport within 5–10 km of the city centre in 199 European cities (Eurostat Urban Audit; each city’s latest year from 2019, as earlier years have currency errors). Vantaa in Finland is most expensive at €110.4 (2024), then Espoo €99.4, Zurich and Winterthur €91.0, Basel €90.0 and Hamburg €89.5 (2019; Germany has had the nationwide Deutschlandticket since 2023); Vidin in Bulgaria (€10.23, 2022) and Kecskemét in Hungary (€12.65) are cheapest. Years and price levels differ, so compare only roughly. ${NOT_TW.en}`,
      },
    },
  }),
};

export const taxiFare = {
  source: SOURCE,
  ...part({
    id: 'taxi-fare',
    file: 'taxi-fares',
    layerLabel: { zh: '計程車 5 公里的車資（歐洲城市）', en: 'Taxi fare for 5 km (European cities)' },
    what: (v, y) => tr({ zh: `白天 5 公里到市中心 ${euro(v)}（${y} 年）`, en: `${euro(v)} for 5 km to the centre by day (${y})` }),
    thresholds: [5, 10, 15, 20],
    classLabels: [
      { zh: '不到 5 歐元', en: 'Under €5' },
      { zh: '5–10 歐元', en: '€5–10' },
      { zh: '10–15 歐元', en: '€10–15' },
      { zh: '15–20 歐元', en: '€15–20' },
      { zh: '20 歐元以上', en: '€20 or more' },
    ],
    indicator: {
      label: { zh: '計程車 5 公里多少錢（歐洲城市）', en: 'Taxi fare for 5 km (European cities)' },
      description: {
        zh: `歐洲 367 個城市白天搭計程車到市中心 5 公里的車資（Eurostat Urban Audit，2018 年以後每個城市最近一年）。瑞士最貴：蘇黎世 35.0 歐元、溫特圖爾 34.0 歐元、盧加諾、伯恩 30.0 歐元（2024 年）；波蘭、斯洛伐克、保加利亞的城市 2–3 歐元最便宜。${NOT_TW.zh}`,
        en: `Daytime taxi fare for a 5 km ride to the city centre in 367 European cities (Eurostat Urban Audit; each city’s latest year from 2018). Switzerland is most expensive: Zurich €35.0, Winterthur €34.0, and Lugano and Bern €30.0 (2024); cities in Poland, Slovakia and Bulgaria are cheapest at €2–3. ${NOT_TW.en}`,
      },
    },
  }),
};

/**
 * 全國通用的月票或免費大眾運輸（2026-11-06，製作手冊第二十三批 409 的後半；pipeline/topics/national_passes.py）：
 * 使用者決定只收有方案的國家、逐國查官網；其他國家灰色寫「沒查到全國方案」，不判定沒有。台灣的 TPASS 算「區域」。
 */
const PASS_KINDS: CategoryDef[] = [
  { value: 1, label: { zh: '全國大眾運輸免費', en: 'Free public transport nationwide' } },
  { value: 2, label: { zh: '全國通用的月票或年票', en: 'Nationwide monthly or annual pass' } },
  { value: 3, label: { zh: '區域或只限鐵路的通用票', en: 'Regional or rail-only pass' } },
];

export const nationalPass: { sources: SourceDef[]; indicator: IndicatorDef } = {
  sources: [
    {
      name: {
        zh: '各國政府與業者官網：盧森堡政府、Malta Public Transport、德國聯邦政府、奧地利交通部、Alliance SwissPass、MÁV、Renfe、葡萄牙政府、行政院',
        en: 'Government and operator websites: Luxembourg government, Malta Public Transport, German Federal Government, Austrian transport ministry, Alliance SwissPass, MÁV, Renfe, Portuguese government, Executive Yuan (Taiwan)',
      },
      url: 'https://gouvernement.lu/fr/actualites/toutes_actualites/communiques/2020/02-fevrier/11-mobilite-gratuite.html',
      license: { zh: '引用官網公告的事實', en: 'facts cited from official websites' },
    },
  ],
  indicator: {
    id: 'national-pass',
    label: { zh: '全國通用的月票或免費大眾運輸', en: 'Nationwide passes and free public transport' },
    description: {
      zh: '一張票搭遍全國的大眾運輸，或乾脆全國免費（2026 年 11 月，逐國查官網，滑過看方案、開始日期與價格）。全國免費：盧森堡 2020 年 3 月 1 日起（火車頭等艙除外）、馬爾他 2022 年 10 月 1 日起（持記名卡的居民搭公車）。全國通用的月票或年票：瑞士的 GA 1898 年就有，奧地利 KlimaTicket 2021 年、德國 Deutschlandticket 與匈牙利的全國月票 2023 年、西班牙 Abono Único 2026 年 1 月；匈牙利、西班牙不含市內交通。只限鐵路或區域的：葡萄牙國鐵的 Passe Ferroviário Verde（2024 年），台灣的 TPASS 行政院通勤月票（2023 年 7 月 1 日起，各生活圈一種，例如基北北桃 1,200 元）。灰色是沒查到全國方案，不代表一定沒有；愛沙尼亞各郡的免費公車、南韓的 K-Pass（全國通用的退款回饋，不是月票）沒有收。',
      en: 'One ticket for public transport across the whole country, or none needed at all (November 2026, checked against official websites; hover for the scheme, start date and price). Free nationwide: Luxembourg from 1 March 2020 (except first class on trains) and Malta from 1 October 2022 (buses, for residents with a personalised card). Nationwide monthly or annual passes: Switzerland’s GA dates from 1898, Austria’s KlimaTicket from 2021, Germany’s Deutschlandticket and Hungary’s national pass from 2023, and Spain’s Abono Único from January 2026; the Hungarian and Spanish passes exclude local transit. Rail-only or regional: Portugal’s Passe Ferroviário Verde for CP trains (2024) and Taiwan’s TPASS commuter passes (from 1 July 2023, one per metropolitan region, e.g. NT$1,200 for Keelung–Taipei–New Taipei–Taoyuan). Grey means no nationwide scheme was found, not that none exists; Estonia’s free county buses and South Korea’s K-Pass (a nationwide fare rebate, not a pass) are not included.',
    },
    unit: '',
    file: 'national-pass.json',
    layer: { kind: 'categorical', categories: PASS_KINDS },
    format: (v) => tr(PASS_KINDS.find((k) => k.value === v)?.label ?? ''),
    unranked: true,
    missing: { zh: '沒查到全國方案', en: 'No nationwide scheme found' },
  },
};
