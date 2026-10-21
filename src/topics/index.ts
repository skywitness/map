import { population } from './population';
import type { TopicDefinition } from './types';

/** 已上線的主題。新增主題時在這裡註冊。 */
export const TOPICS: TopicDefinition[] = [population];

/** 規劃中的主題，只顯示在主題選單上（不可點）。完成後移到 TOPICS。 */
export const PLANNED_TOPICS = ['人均收入', '發電量', '產業結構', '工業', '農業'];

export function getTopic(id: string | null): TopicDefinition {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0];
}
