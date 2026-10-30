import type { TopicDefinition } from './types';
import { VENUE_INDICATOR, VENUE_OVERLAYS } from './olympic-venues';
import { olympicsPart, PLACES } from './olympics';

/**
 * 運動（2026-10-30，製作手冊第七批 121）：原本是「奧運獎牌」與「F1 賽道與冠軍」合成的主題；
 * 2026-10-30（第九批 160）F1 搬到「賽車」（racing.ts），這裡只剩奧運獎牌（指標、說明與資料來源照舊寫在 olympics.ts）；
 * 同一天（第九批 161）加奧運的比賽場館（olympic-venues.ts）。
 * 資料在 public/data/topics/sports/。舊網址 t/olympics/ 轉到這裡、t/f1/ 與這裡的 F1 指標轉到賽車（redirects.ts）。
 * 之後如果做足球（使用者 2026-10-29 決定先不做）也放這裡。
 */
export const sports: TopicDefinition = {
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
  ],
  note: {
    zh: `奧運：${olympicsPart.note.zh} 比賽場館：照各屆維基百科條目的場館表，場館是表上連結的條目、座標用 Wikidata；條目沒有連結或查不到座標的 57 個場館與路線（早期的場館、馬拉松等路線）不畫，少數沒有座標的用所在行政區的位置（tooltip 寫明）。不收帕運、青年奧運；台灣沒有辦過奧運（高雄世運、台北世大運不是奧運）。資料檔依 CC BY-SA 4.0 分享。F1 在「賽車」主題。`,
    en: `Olympics: ${olympicsPart.note.en} Venues follow the venue tables of each Games’ Wikipedia article, using the linked articles with Wikidata coordinates; 57 venues and courses with no link or no coordinates (early venues, marathon and other courses) are not shown, and a few without coordinates are placed at their town (noted in the tooltip). Paralympic and Youth Games are not included; Taiwan has never hosted the Olympics (the Kaohsiung World Games and Taipei Universiade are not Olympic Games). Data files are shared under CC BY-SA 4.0. Formula One is in the Racing topic.`,
  },
  // 奧運的歷史隊伍（蘇聯、東西德…）
  places: PLACES,
  panelExtra: () => import('./panels/SportsPanel'),
  overlays: VENUE_OVERLAYS,
  indicators: [...olympicsPart.indicators, VENUE_INDICATOR],
};
