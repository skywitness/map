import type { TopicDefinition } from './types';
import { stationsPart } from './antarctic-stations';
import { penguinsPart } from './penguins';
import { lakesPart } from './subglacial-lakes';

/**
 * 南極（2026-10-30，製作手冊第七批 116）：原本的「南極研究站」「企鵝在哪裡」「南極的冰下湖」三個主題合成一個，
 * 各自的指標、疊加圖層、說明與資料來源照舊寫在原本的檔（antarctic-stations.ts、penguins.ts、subglacial-lakes.ts），
 * 這裡只組起來。資料都在 public/data/topics/antarctica/（pipeline 的三個步驟各自輸出）。
 * 舊網址 t/antarctic-stations/、t/penguins/、t/subglacial-lakes/ 轉到這裡（redirects.ts）。臭氧洞照舊是獨立的主題（使用者決定）。
 */
export const antarctica: TopicDefinition = {
  id: 'antarctica',
  title: { zh: '南極', en: 'Antarctica' },
  shortTitle: { zh: '南極', en: 'Antarctica' },
  defaultIndicator: 'operating',
  defaultYear: 2026,
  // 打開時地圖轉到南極上空（預設以台灣為中心的地球儀看不到南極）
  focus: [-180, -88, 180, -62],
  sources: [...stationsPart.sources, ...penguinsPart.sources, ...lakesPart.sources],
  note: {
    zh: `研究站：${stationsPart.note.zh} 企鵝：${penguinsPart.note.zh} 冰下湖：${lakesPart.note.zh}`,
    en: `Research stations: ${stationsPart.note.en} Penguins: ${penguinsPart.note.en} Subglacial lakes: ${lakesPart.note.en}`,
  },
  panelExtra: () => import('./panels/AntarcticStationsPanel'),
  overlays: [...stationsPart.overlays, ...penguinsPart.overlays, ...lakesPart.overlays],
  indicators: [...stationsPart.indicators, ...penguinsPart.indicators, ...lakesPart.indicators],
};
