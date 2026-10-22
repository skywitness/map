import { agriculture } from './agriculture';
import { ai } from './ai';
import { electricity } from './electricity';
import { income } from './income';
import { industry } from './industry';
import { population } from './population';
import { sectors } from './sectors';
import type { TopicDefinition } from './types';

/** 主題選單的順序。新增主題時在這裡註冊。 */
export const TOPICS: TopicDefinition[] = [population, income, electricity, sectors, industry, agriculture, ai];

export function getTopic(id: string | null): TopicDefinition {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0];
}
