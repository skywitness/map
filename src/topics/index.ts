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
  /** 依小標題分段（能源、交通只有一段、沒有小標題） */
  sections: { label: Text | null; topics: TopicSummary[] }[];
  /** 分類裡的所有主題（依小標題的順序） */
  topics: TopicSummary[];
  /** 下拉選單每一欄放幾段（registry.ts 的 columns，使用者指定的排法）；沒有時自動分欄 */
  columns?: number[];
}

/** 頂列的主題分類（registry.ts），主題只有名稱與指標名稱（主題目錄 catalog.gen.ts） */
export const TOPIC_GROUPS: TopicGroup[] = TOPIC_GROUP_SPECS.map((g) => {
  const sections = g.sections.map((s) => ({ label: s.label, topics: s.topics.map((id) => CATALOG.topics[id]) }));
  return { id: g.id, label: g.label, sections, topics: sections.flatMap((s) => s.topics), columns: g.columns };
});

const GROUP_OF = new Map(TOPIC_GROUPS.flatMap((g) => g.topics.map((t) => [t.id, g.id] as const)));

/**
 * 本機匯入的新主題（topics/localTopics.ts，只有這個瀏覽器匯入過才會呼叫）：放進分類的最後一段、主題清單。
 * 主題目錄（CATALOG）由呼叫的人先加好
 */
export function addLocalTopic(id: string, groupId: string): void {
  const group = TOPIC_GROUPS.find((g) => g.id === groupId) ?? TOPIC_GROUPS[TOPIC_GROUPS.length - 1];
  const summary = CATALOG.topics[id];
  if (!summary || GROUP_OF.has(id)) return;
  group.sections[group.sections.length - 1].topics.push(summary);
  group.topics.push(summary);
  GROUP_OF.set(id, group.id);
  TOPICS.push(summary);
}

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

/**
 * 主題定義讀到後再加工（本機匯入的指標、圖層，topics/localTopics.ts 的 installLocal）：沒有匯入過的瀏覽器是 null。
 * 設定時已經在記憶體裡的主題（人口、純地圖）也一起加工
 */
let augmenter: ((topic: TopicDefinition) => TopicDefinition) | null = null;
export function setTopicAugmenter(fn: (topic: TopicDefinition) => TopicDefinition): void {
  augmenter = fn;
  for (const [key, topic] of loaded) loaded.set(key, fn(topic));
}

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
      const own = topicOf(module, key);
      const topic = augmenter ? augmenter(own) : own;
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
