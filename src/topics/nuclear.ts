import { nuclearPolicyPart } from './energy-policy';
import { hostOnly, topicPart } from './merge';
import { nuclearAccidents } from './nuclear-accidents';
import { nuclearWaste } from './nuclear-waste';
import { withParts } from './parts';
import { powerPlants } from './power-plants';
import { smrPart } from './smr';
import type { TopicDefinition } from './types';

/**
 * 核能（2026-11-04，主題整併 併1）：能源政策的「核能政策」、發電廠地圖的核電機組數與核電裝置容量（發電廠地圖照樣保留）、
 * 核子事故、核廢料的最終處置場合成一個主題，取代能源政策、核子事故、核廢料三個主題（燃煤退場的兩個指標併進石油、天然氣與煤）。
 * 資料都照舊在原本的資料夾（topics/merge.ts）；核子事故與核廢料的指標原本都叫 map，改名 accidents、repositories。
 * 舊網址 t/energy-policy/、t/nuclear-accidents/、t/nuclear-waste/ 轉到這裡（redirects.ts）。2026-11-07 加小型模組化反應爐（smr.ts）
 */
export const nuclear: TopicDefinition = withParts(
  hostOnly({
    id: 'nuclear',
    // 頁尾的「資料產生於」讀發電廠地圖的 manifest.json（核電機組的資料）
    dataTopic: 'power-plants',
    title: { zh: '核能：政策、核電廠、核子事故與核廢料', en: 'Nuclear power: policy, plants, accidents and waste' },
    shortTitle: { zh: '核能', en: 'Nuclear power' },
    defaultIndicator: 'nuclear-units',
    defaultYear: 2026,
    sources: [],
    indicators: [],
  }),
  // 發電廠地圖的資料來源只帶核電用得到的：GEM、能源署的裝置容量、維基的核電廠條目（抽蓄水力、電池儲能的不帶）
  topicPart(
    { ...powerPlants, sources: powerPlants.sources.filter((_, i) => [0, 1, 3].includes(i)) },
    { only: ['nuclear-units', 'nuclear-capacity'], name: { zh: '核電廠', en: 'Nuclear plants' } },
  ),
  nuclearPolicyPart,
  topicPart(nuclearAccidents, { rename: { map: 'accidents' } }),
  topicPart(nuclearWaste, { rename: { map: 'repositories' } }),
  // 2026-11-07（製作手冊第二十五批 532）小型模組化反應爐的設計案
  smrPart,
);
