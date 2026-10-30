import type { TopicDefinition } from './types';
import { f1Part } from './f1';
import { olympicsPart, PLACES } from './olympics';

/**
 * 運動（2026-10-30，製作手冊第七批 121）：「奧運獎牌」與「F1 賽道與冠軍」合成一個主題，
 * 各自的指標、疊加圖層、說明與資料來源照舊寫在原本的檔（olympics.ts、f1.ts），這裡只組起來。
 * 資料都在 public/data/topics/sports/。舊網址 t/olympics/、t/f1/ 轉到這裡（redirects.ts）。
 * 之後如果做足球（使用者 2026-10-29 決定先不做）也放這裡。
 */
export const sports: TopicDefinition = {
  id: 'sports',
  title: { zh: '運動', en: 'Sports' },
  shortTitle: { zh: '運動', en: 'Sports' },
  defaultIndicator: 'medals-total',
  defaultYear: 2026,
  sources: [...olympicsPart.sources, ...f1Part.sources],
  note: {
    zh: `奧運：${olympicsPart.note.zh} F1：${f1Part.note.zh}`,
    en: `Olympics: ${olympicsPart.note.en} Formula One: ${f1Part.note.en}`,
  },
  // 奧運的歷史隊伍（蘇聯、東西德…）
  places: PLACES,
  panelExtra: () => import('./panels/SportsPanel'),
  overlays: [...f1Part.overlays],
  indicators: [...olympicsPart.indicators, ...f1Part.indicators],
};
