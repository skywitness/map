import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

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
