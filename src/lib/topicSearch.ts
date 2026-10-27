/**
 * 主題搜尋：跟國家搜尋用同一個搜尋框（CountrySearch.tsx）。比對主題名稱、指標名稱與子項目（農產品、礦產、
 * 連鎖品牌…），中英文都能搜尋，計分跟國家搜尋一樣（countrySearch.ts 的 scoreKey）。
 * 子項目就是國家的（護照的「護照」、聯合國投票的「比較對象」）不收，國家本身已經有國家搜尋。
 */
import { TOPIC_GROUPS, TOPICS } from '../topics';
import { dimensionOf, usesDimension, type TopicDefinition } from '../topics/types';
import type { Text } from '../i18n/lang';
import { makeKey, normalize, scoreKey, type SearchKey } from './countrySearch';

/** 選到之後要去的地方 */
export interface TopicTarget {
  topic: string;
  indicator: string | null;
  item: string | null;
}

export interface TopicEntry {
  target: TopicTarget;
  kind: 'topic' | 'indicator' | 'item';
  /** 比對到的名稱（主題、指標或子項目） */
  label: Text;
  /** 所屬的主題與分類，結果清單的第二行 */
  topicTitle: Text;
  groupLabel: Text;
  keys: SearchKey[];
}

/** 中文名稱比英文名稱優先一點（跟國家搜尋一樣）；兩種語言一樣的名稱（7-Eleven）只是一個字串 */
function keysOf(text: Text, weight: number): SearchKey[] {
  const keys = typeof text === 'string' ? [makeKey(text, weight + 1)] : [makeKey(text.zh, weight + 1), makeKey(text.en, weight)];
  return keys.filter((k): k is SearchKey => k !== null);
}

function buildTopicIndex(): TopicEntry[] {
  const out: TopicEntry[] = [];
  const groupOf = new Map(TOPIC_GROUPS.flatMap((g) => g.topics.map((t) => [t.id, g.label] as const)));
  const seen = new Set<string>();
  for (const topic of TOPICS) {
    const groupLabel = groupOf.get(topic.id) ?? topic.shortTitle;
    const base = { topicTitle: topic.title, groupLabel };
    out.push({
      ...base,
      target: { topic: topic.id, indicator: null, item: null },
      kind: 'topic',
      label: topic.title,
      keys: [...keysOf(topic.title, 4), ...keysOf(topic.shortTitle, 4)],
    });
    for (const ind of topic.indicators) {
      out.push({
        ...base,
        target: { topic: topic.id, indicator: ind.id, item: null },
        kind: 'indicator',
        label: ind.label,
        keys: keysOf(ind.label, 2),
      });
      const dim = dimensionOf(topic, ind);
      if (!dim || dim.followsSelection || !usesDimension(ind)) continue;
      for (const option of dim.options) {
        // 子項目是國家（聯合國投票的「比較對象」）：交給國家搜尋，打「日本」不必多一筆主題結果
        if (/^_?[A-Z]{3}$/.test(option.id)) continue;
        // 同一個子項目通常好幾個指標都有，只收第一個（主題預設的指標排前面的話就是它）
        const key = `${topic.id}/${option.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          ...base,
          target: { topic: topic.id, indicator: preferredIndicator(topic, option.id) ?? ind.id, item: option.id },
          kind: 'item',
          label: option.label,
          keys: keysOf(option.label, 1),
        });
      }
    }
  }
  return out;
}

/** 選到子項目時開哪個指標：主題的預設指標有這個子項目就用它 */
function preferredIndicator(topic: TopicDefinition, option: string): string | undefined {
  const def = topic.indicators.find((i) => i.id === topic.defaultIndicator);
  const dim = def && dimensionOf(topic, def);
  return def && usesDimension(def) && dim?.options.some((o) => o.id === option) ? def.id : undefined;
}

let index: TopicEntry[] | null = null;

export interface TopicHit {
  entry: TopicEntry;
  score: number;
}

/** 同一個主題只留分數最高的一筆（主題名稱、指標、子項目都比對到時不重複列出） */
export function searchTopics(query: string, limit = 5): TopicHit[] {
  return matchTopics(query).slice(0, limit);
}

/** 所有比對到的主題（主題總覽的篩選用），分數高的在前 */
export function matchTopics(query: string): TopicHit[] {
  const q = normalize(query).replace(/ /g, '');
  if (!q) return [];
  index ??= buildTopicIndex();
  const best = new Map<string, TopicHit>();
  for (const entry of index) {
    let score = 0;
    for (const key of entry.keys) score = Math.max(score, scoreKey(q, key));
    // 拼錯容忍、跳字比對對主題太雜（指標名稱很多），只收片段以上的比對
    if (score < 500) continue;
    // 同分時主題名稱 > 指標 > 子項目
    score += entry.kind === 'topic' ? 0.3 : entry.kind === 'indicator' ? 0.2 : 0.1;
    const id = entry.target.topic;
    if ((best.get(id)?.score ?? 0) < score) best.set(id, { entry, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}
