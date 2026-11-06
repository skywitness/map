import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';
import { VENUE_INDICATOR, VENUE_LIST, VENUE_OVERLAYS } from './olympic-venues';
import { olympicsPart, PLACES } from './olympics';
import { withParts } from './parts';
import { hostOnly, topicPart } from './merge';
import { roadRaces } from './road-races';
import { sportsEconomyPart } from './sports-economy';

/**
 * 運動（2026-10-30，製作手冊第七批 121）：原本是「奧運獎牌」與「F1 賽道與冠軍」合成的主題；
 * 2026-10-30（第九批 160）F1 搬到「賽車」（racing.ts），這裡只剩奧運獎牌（指標、說明與資料來源照舊寫在 olympics.ts）；
 * 同一天（第九批 161）加奧運的比賽場館（olympic-venues.ts）。
 * 資料在 public/data/topics/sports/。舊網址 t/olympics/ 轉到這裡、t/f1/ 與這裡的 F1 指標轉到賽車（redirects.ts）。
 * 之後如果做足球（使用者 2026-10-29 決定先不做）也放這裡。
 */
/** 去現場看運動比賽（2026-11-04，製作手冊第二十一批 361；pipeline/topics/sports_attendance.py）：Eurostat ilc_scp04 */
const ATTEND_SPORTS: IndicatorDef = {
  id: 'attend-sports',
  label: { zh: '去現場看運動比賽的人', en: 'People who attended sports events' },
  description: {
    zh: '16 歲以上的人過去 12 個月至少去現場看過一次運動比賽的比例（Eurostat 的歐盟所得與生活狀況調查，2015、2022 年）。2022 年愛爾蘭 39.9%、盧森堡 37.4%、荷蘭 36.9%、挪威 36.7%、瑞士 35.0% 最高；立陶宛 12.7%、拉脫維亞 12.4%、阿爾巴尼亞 10.8%、保加利亞 7.1%、羅馬尼亞 7.0% 最低，差 5.7 倍。只有歐洲 30 國；台灣沒有同一題的調查。',
    en: 'Share of people aged 16+ who attended at least one live sports event in the past 12 months (Eurostat EU-SILC, 2015 and 2022). In 2022 Ireland 39.9%, Luxembourg 37.4%, the Netherlands 36.9%, Norway 36.7% and Switzerland 35.0% are highest; Lithuania 12.7%, Latvia 12.4%, Albania 10.8%, Bulgaria 7.1% and Romania 7.0% lowest, a 5.7-fold gap. Only 30 European countries; Taiwan has no matching survey.',
  },
  unit: '%',
  file: 'attend-sports.json',
  defaultYear: 2022,
  layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] } },
  format: (v) => `${fixed(v, 1)}%`,
  formatTick: (v) => `${v}%`,
};

const sportsOwn: TopicDefinition = {
  id: 'sports',
  title: { zh: '運動', en: 'Sports' },
  shortTitle: { zh: '運動', en: 'Sports' },
  defaultIndicator: 'medals-total',
  defaultYear: 2026,
  sources: [
    ...olympicsPart.sources,
    {
      name: {
        zh: '英文維基百科各屆奧運的場館條目（Venues of the … Olympics；1896–1936 年夏季、2024 年夏季、2030 年冬季用各屆條目的場館一節），固定版本',
        en: 'English Wikipedia articles on the venues of each Olympic Games (the venues section of the Games article for the Summer Games of 1896–1936 and 2024 and the 2030 Winter Games), fixed revisions',
      },
      url: 'https://en.wikipedia.org/wiki/Venues_of_the_2024_Summer_Olympics_and_Paralympics',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（場館的座標）', en: 'Wikidata (venue coordinates)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'Eurostat：文化與運動活動的參與（ilc_scp04，運動比賽）', en: 'Eurostat: participation in cultural and sport activities (ilc_scp04, sports events)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/ilc_scp04/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: `奧運：${olympicsPart.note.zh} 比賽場館：照各屆維基百科條目的場館表，場館是表上連結的條目、座標用 Wikidata；條目沒有連結或查不到座標的 57 個場館與路線（早期的場館、馬拉松等路線）不畫，少數沒有座標的用所在行政區的位置（tooltip 寫明）。不收帕運、青年奧運；台灣沒有辦過奧運（高雄世運、台北世大運不是奧運）。資料檔依 CC BY-SA 4.0 分享。F1 在「賽車」主題。`,
    en: `Olympics: ${olympicsPart.note.en} Venues follow the venue tables of each Games’ Wikipedia article, using the linked articles with Wikidata coordinates; 57 venues and courses with no link or no coordinates (early venues, marathon and other courses) are not shown, and a few without coordinates are placed at their town (noted in the tooltip). Paralympic and Youth Games are not included; Taiwan has never hosted the Olympics (the Kaohsiung World Games and Taipei Universiade are not Olympic Games). Data files are shared under CC BY-SA 4.0. Formula One is in the Racing topic.`,
  },
  // 奧運的歷史隊伍（蘇聯、東西德…）
  places: PLACES,
  panelExtra: () => import('./panels/SportsPanel'),
  overlays: VENUE_OVERLAYS,
  listPanel: VENUE_LIST,
  indicators: [...olympicsPart.indicators, VENUE_INDICATOR, ATTEND_SPORTS],
};

/** 路跑賽事的指標併進來以後的 id（races 以前是運動主題的 F1 指標、已經轉到賽車，所以改名） */
export const ROAD_RACE_IDS: Record<string, string> = { races: 'road-races', founded: 'road-races-founded' };

/**
 * 運動（2026-11-04，主題整併 併12）：「馬拉松、超馬與鐵人賽事」併進來，資料照舊在 road-races/（topics/merge.ts），
 * 舊網址 t/road-races/ 轉到這裡（redirects.ts）
 */
export const sports: TopicDefinition = withParts(
  hostOnly(sportsOwn),
  topicPart(roadRaces, { rename: ROAD_RACE_IDS }),
  // 2026-11-06（第二十四批 425）：運動業的就業與政府的運動與休閒支出
  sportsEconomyPart,
);
