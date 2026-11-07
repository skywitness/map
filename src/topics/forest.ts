import { hostOnly, topicPart } from './merge';
import { oilPalm } from './oil-palm';
import { withParts } from './parts';
import { plantedForests } from './planted-forests';
import type { TopicDefinition } from './types';
import { forestCoverPart } from './water-forest';
import { forestDisturbance } from './forest-disturbance';

/**
 * 森林（2026-11-04，主題整併 併3）：水資源與森林的森林覆蓋率、森林面積年變化率，加上人工林、油棕園合成一個主題
 * （水資源與森林只留水的部分，改名「各國水資源」）。資料都照舊在原本的資料夾（topics/merge.ts）；
 * 油棕園原本整個主題對著東南亞（focus），併進來以後只有油棕園的指標對著東南亞。
 * 舊網址 t/planted-forests/、t/oil-palm/、t/water-forest/?ind=forest-cover 轉到這裡（redirects.ts）
 */
export const forest: TopicDefinition = withParts(
  hostOnly({
    id: 'forest',
    // 頁尾的「資料產生於」讀水資源與森林的 manifest.json（森林覆蓋的資料）
    dataTopic: 'water-forest',
    title: { zh: '森林：覆蓋率、人工林與油棕園', en: 'Forests: cover, planted forests and oil palm' },
    shortTitle: { zh: '森林', en: 'Forests' },
    defaultIndicator: 'forest-cover',
    defaultYear: 2025,
    sources: [],
    indicators: [],
  }),
  forestCoverPart,
  topicPart(plantedForests),
  topicPart(oilPalm),
  // 2026-11-07（製作手冊第二十五批 497）
  topicPart(forestDisturbance),
);
