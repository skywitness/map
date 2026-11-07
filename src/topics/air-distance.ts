import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 飛多遠、搭什麼機型（2026-11-07，製作手冊第二十七批 572，候選 1289；pipeline/topics/air_distance.py）：擴充「航線與航空公司」。
 * Eurostat avia_paodis 的機上旅客依航程級距與機型的比例（歐洲，2008–2024）；機型名稱照 Eurostat 的代碼表 AIRCRAFT。
 */
export const AIR_DISTANCE_IDS = ['flight-distance', 'aircraft-type'];

export const DISTANCE_ITEMS: { id: string; label: Text }[] = [
  { id: 'lt300', label: { zh: '不到 300 公里', en: 'Under 300 km' } },
  { id: '300-499', label: { zh: '300–499 公里', en: '300–499 km' } },
  { id: '500-999', label: { zh: '500–999 公里', en: '500–999 km' } },
  { id: '1000-1499', label: { zh: '1,000–1,499 公里', en: '1,000–1,499 km' } },
  { id: '1500-1999', label: { zh: '1,500–1,999 公里', en: '1,500–1,999 km' } },
  { id: 'ge2000', label: { zh: '2,000 公里以上', en: '2,000 km or more' } },
];

/** Eurostat 代碼表 AIRCRAFT：AC_NJ Narrow-body jet、AC_WJ Wide-body jet、AC_JJ Jumbo jet、AC_RJ Regional jet、AC_RT Regional turboprop */
export const AIRCRAFT_ITEMS: { id: string; label: Text }[] = [
  { id: 'narrow', label: { zh: '窄體噴射機', en: 'Narrow-body jet' } },
  { id: 'wide', label: { zh: '廣體噴射機', en: 'Wide-body jet' } },
  { id: 'jumbo', label: { zh: '巨型噴射機（Jumbo jet）', en: 'Jumbo jet' } },
  { id: 'regional-jet', label: { zh: '區域噴射機', en: 'Regional jet' } },
  { id: 'turboprop', label: { zh: '區域渦輪螺旋槳機', en: 'Regional turboprop' } },
];
export const AIRCRAFT_OTHER: { id: string; label: Text }[] = [
  { id: 'other', label: { zh: '其他', en: 'Other' } },
  { id: 'unknown', label: { zh: '不明', en: 'Unknown' } },
];

const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;
const EUROPE: Text = {
  zh: '機上旅客（每一段航班的起降都算），只有向 Eurostat 申報的歐洲各國，英國照網站的規則不畫；台灣沒有。點國家看各級距與各機型的人次。',
  en: 'Passengers on board (counted on each flight stage), only for European countries reporting to Eurostat; the UK is not shown by the site’s rule and Taiwan is not covered. Click a country for passengers by distance band and aircraft type.',
};

export const airDistance: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: { zh: 'Eurostat：機上旅客依航程與機型（avia_paodis）', en: 'Eurostat: passengers on board by distance band and aircraft type (avia_paodis)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/avia_paodis/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'flight-distance',
      // 卡片與圖例的標題是子項目接指標名稱：「不到 300 公里航程的旅客比例」
      label: { zh: '航程的旅客比例', en: 'flights: share of passengers' },
      description: {
        zh: `機上旅客裡，航程（大圓距離）在這個級距的占幾 %（Eurostat，2008–2024 年）。歐盟 27 國 2024 年共 1,056,009,471 人次：2,000 公里以上 330,281,131（31.3%）、500–999 公里 235,770,589（22.3%）、1,000–1,499 公里 211,066,303（20.0%）、1,500–1,999 公里 153,341,079（14.5%）、300–499 公里 85,948,160（8.1%），不到 300 公里只有 39,602,209（3.8%），正好回答「短程航線該不該改搭火車」：歐洲大部分的旅客本來就飛得比火車能取代的遠。不到 300 公里的人次西班牙 12,823,368、希臘 6,417,890 最多；比例蒙特內哥羅 22.7%、愛沙尼亞 19.4% 最高。${tr(EUROPE, 'zh')}`,
        en: `Share of passengers on board whose flight (great-circle distance) falls in this band (Eurostat, 2008–2024). The EU-27 had 1,056,009,471 in 2024: 2,000 km or more 330,281,131 (31.3%), 500–999 km 235,770,589 (22.3%), 1,000–1,499 km 211,066,303 (20.0%), 1,500–1,999 km 153,341,079 (14.5%), 300–499 km 85,948,160 (8.1%) and under 300 km only 39,602,209 (3.8%), which speaks to whether short flights should move to rail: most European passengers already fly farther than trains can replace. Spain (12,823,368) and Greece (6,417,890) have the most passengers under 300 km; by share Montenegro (22.7%) and Estonia (19.4%) are highest. ${tr(EUROPE, 'en')}`,
      },
      unit: '%',
      file: 'flight-distance/{item}.json',
      dimension: { label: { zh: '航程', en: 'Distance' }, options: DISTANCE_ITEMS, defaultOption: 'lt300' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 30, 45] } },
      format: pct,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
    {
      id: 'aircraft-type',
      // 卡片與圖例的標題是子項目接指標名稱：「窄體噴射機載客的比例」
      label: { zh: '載客的比例', en: 'share of passengers' },
      description: {
        zh: `機上旅客裡，搭這一類飛機的占幾 %（Eurostat，2008–2024 年；機型分類照 Eurostat 的代碼表）。歐盟 27 國 2024 年：窄體噴射機 774,088,902 人次（73.3%）、廣體噴射機 174,479,385（16.5%）、區域噴射機 45,220,985（4.3%）、巨型噴射機（Jumbo jet）9,857,719（0.9%），區域渦輪螺旋槳機只有 6,847,460（0.65%），而挪威一國就有 3,735,141、愛爾蘭 1,370,279；比例盧森堡 20.1%、挪威 9.7% 最高。廣體噴射機的人次土耳其 54,979,856、法國 36,893,561 最多。${tr(EUROPE, 'zh')}`,
        en: `Share of passengers on board flying on this class of aircraft (Eurostat, 2008–2024; classes follow Eurostat’s code list). The EU-27 in 2024: narrow-body jets 774,088,902 (73.3%), wide-body jets 174,479,385 (16.5%), regional jets 45,220,985 (4.3%), jumbo jets 9,857,719 (0.9%) and regional turboprops only 6,847,460 (0.65%), of which Norway alone had 3,735,141 and Ireland 1,370,279; by share Luxembourg (20.1%) and Norway (9.7%) are highest. Türkiye (54,979,856) and France (36,893,561) have the most wide-body passengers. ${tr(EUROPE, 'en')}`,
      },
      unit: '%',
      file: 'aircraft-type/{item}.json',
      dimension: { label: { zh: '機型', en: 'Aircraft' }, options: AIRCRAFT_ITEMS, defaultOption: 'turboprop' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 25, 50, 75] } },
      format: pct,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
  ],
};
