import { agriculture } from './agriculture';
import { ai } from './ai';
import { climate } from './climate';
import { electricity } from './electricity';
import { income } from './income';
import { industry } from './industry';
import { military } from './military';
import { pureMap } from './map';
import { population } from './population';
import { sectors } from './sectors';
import { trade } from './trade';
import { transport } from './transport';
import type { TopicDefinition } from './types';

/** 主題選單的順序。新增主題時在這裡註冊。 */
export const TOPICS: TopicDefinition[] = [
  pureMap,
  population,
  income,
  electricity,
  sectors,
  industry,
  agriculture,
  trade,
  ai,
  transport,
  climate,
  military,
];

export function getTopic(id: string | null): TopicDefinition {
  // 沒指定主題時開人口，不是排在第一個的純地圖
  return TOPICS.find((t) => t.id === id) ?? population;
}
