import { hostOnly } from './merge';
import { withParts } from './parts';
import { travelHabitsPart } from './tourism';
import type { TopicDefinition } from './types';

/**
 * 旅遊習慣（2026-11-04，主題整併 整4：從「各國國際觀光」拆出來，放休閒的「日常休閒」）：居民一年去幾趟、出國幾趟、
 * 住哪裡、搭飛機或跟團、網路訂、每趟住幾夜花多少、沒去旅遊的原因。資料照舊在 tourism/（topics/merge.ts），
 * 舊網址 t/tourism/?ind=trips-per-resident 等由 redirects.ts 轉過來
 */
export const travelHabits: TopicDefinition = withParts(
  hostOnly({
    id: 'travel-habits',
    dataTopic: 'tourism',
    title: { zh: '旅遊習慣：去幾趟、住哪裡、花多少', en: 'Travel habits: how often, where people stay and what they spend' },
    shortTitle: { zh: '旅遊習慣', en: 'Travel habits' },
    defaultIndicator: 'trips-per-resident',
    defaultYear: 2019,
    sources: [],
    indicators: [],
  }),
  travelHabitsPart,
);
