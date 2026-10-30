import type { TopicDefinition } from './types';
import { olympicsPart, PLACES } from './olympics';

/**
 * 運動（2026-10-30，製作手冊第七批 121）：原本是「奧運獎牌」與「F1 賽道與冠軍」合成的主題；
 * 2026-10-30（第九批 160）F1 搬到「賽車」（racing.ts），這裡只剩奧運獎牌（指標、說明與資料來源照舊寫在 olympics.ts）。
 * 資料在 public/data/topics/sports/。舊網址 t/olympics/ 轉到這裡、t/f1/ 與這裡的 F1 指標轉到賽車（redirects.ts）。
 * 之後如果做足球（使用者 2026-10-29 決定先不做）也放這裡。
 */
export const sports: TopicDefinition = {
  id: 'sports',
  title: { zh: '運動', en: 'Sports' },
  shortTitle: { zh: '運動', en: 'Sports' },
  defaultIndicator: 'medals-total',
  defaultYear: 2026,
  sources: [...olympicsPart.sources],
  note: {
    zh: `奧運：${olympicsPart.note.zh} F1 在「賽車」主題。`,
    en: `Olympics: ${olympicsPart.note.en} Formula One is in the Racing topic.`,
  },
  // 奧運的歷史隊伍（蘇聯、東西德…）
  places: PLACES,
  panelExtra: () => import('./panels/OlympicsPanel'),
  indicators: [...olympicsPart.indicators],
};
