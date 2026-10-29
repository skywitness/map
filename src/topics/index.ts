import type { Text } from '../i18n';
import type { TopicSummary } from './catalog';
import { CATALOG } from './catalog.gen';
import { pureMap } from './map';
import { population } from './population';
import { TOPIC_GROUP_SPECS, TOPIC_MODULES, topicOf } from './registry';
import type { TopicDefinition } from './types';

export type { TopicSummary } from './catalog';

export interface TopicGroup {
  id: string;
  label: Text;
  topics: TopicSummary[];
}

/** 頂列的主題分類（registry.ts），主題只有名稱與指標名稱（主題目錄 catalog.gen.ts） */
export const TOPIC_GROUPS: TopicGroup[] = TOPIC_GROUP_SPECS.map((g) => ({
  id: g.id,
  label: g.label,
  topics: g.topics.map((id) => CATALOG.topics[id]),
}));

const GROUP_OF = new Map(TOPIC_GROUPS.flatMap((g) => g.topics.map((t) => [t.id, g.id] as const)));

/** 主題所在的分類 id（分類代表色、圖示）；純地圖不屬於任何分類，是 null */
export function groupOfTopic(id: string): string | null {
  return GROUP_OF.get(id) ?? null;
}

/** 純地圖頁不屬於任何分類，在頂列最前面單獨一顆按鈕 */
export const TOPICS: TopicSummary[] = [CATALOG.topics[pureMap.id], ...TOPIC_GROUPS.flatMap((g) => g.topics)];

// 開發模式下給 scripts/topic-thumbs.mjs 用（主題總覽的縮圖）：所有主題的 id
if (import.meta.env?.DEV) (window as unknown as { __topics?: string[] }).__topics = TOPICS.map((t) => t.id);

/** 網址的主題；沒指定（或不存在）時開人口，不是排在第一個的純地圖 */
export function topicIdOf(id: string | null): string {
  return id && CATALOG.topics[id] ? id : population.id;
}

/** 已經下載的主題定義。人口（預設主題）與純地圖放在首頁的程式裡，其他主題各自一個 chunk（registry.ts） */
const loaded = new Map<string, TopicDefinition>([
  [pureMap.id, pureMap],
  [population.id, population],
]);
const loading = new Map<string, Promise<TopicDefinition>>();

/** 主題的定義；還沒下載時是 null（先 loadTopic） */
export function loadedTopic(id: string | null): TopicDefinition | null {
  return loaded.get(topicIdOf(id)) ?? null;
}

/** 下載主題的定義（一個主題約 3–15 KB，gzip 後）；同一個主題只下載一次，失敗的下次重試 */
export function loadTopic(id: string | null): Promise<TopicDefinition> {
  const key = topicIdOf(id);
  const done = loaded.get(key);
  if (done) return Promise.resolve(done);
  let promise = loading.get(key);
  if (!promise) {
    promise = TOPIC_MODULES[key]().then((module) => {
      const topic = topicOf(module, key);
      loaded.set(key, topic);
      return topic;
    });
    promise.catch(() => loading.delete(key));
    loading.set(key, promise);
  }
  return promise;
}

/** 預先下載（滑到選單上的主題時），換過去就不必等 */
export function prefetchTopic(id: string): void {
  loadTopic(id).catch(() => {});
}
