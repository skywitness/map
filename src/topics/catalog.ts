/**
 * 主題目錄：頂列選單、主題總覽、主題搜尋只需要每個主題的名稱、指標名稱與子項目名稱，不必下載整份主題定義
 * （說明、附註、資料來源，所有主題加起來約 220 KB，gzip 後）。scripts/topic-catalog.mjs 用這裡的函式
 * 從主題定義產生 catalog.gen.ts；npm run dev、npm run build 會先跑一次。
 */
import type { Text } from '../i18n/lang';
import { dimensionOf, usesDimension, type TopicDefinition } from './types';

export interface TopicSummary {
  id: string;
  title: Text;
  shortTitle: Text;
  pure?: boolean;
  indicators: { id: string; label: Text }[];
}

/**
 * 主題搜尋比對的子項目（農產品、礦產、連鎖品牌…）：選到之後開的主題、指標與子項目。
 * 主題與指標的名稱在 TopicSummary 裡，topicSearch.ts 再算比對用的 key
 */
export interface TopicSearchItem {
  topic: string;
  indicator: string;
  item: string;
  label: Text;
}

export interface TopicCatalog {
  topics: Record<string, TopicSummary>;
  items: TopicSearchItem[];
}

export function summarize(topic: TopicDefinition): TopicSummary {
  return {
    id: topic.id,
    title: topic.title,
    shortTitle: topic.shortTitle,
    ...(topic.pure && { pure: true }),
    indicators: topic.indicators.map((ind) => ({ id: ind.id, label: ind.label })),
  };
}

/**
 * 主題搜尋比對的子項目。子項目就是國家的（護照的「護照」、聯合國投票的「比較對象」）不收，
 * 國家本身已經有國家搜尋。
 */
export function searchItems(topic: TopicDefinition): TopicSearchItem[] {
  const out: TopicSearchItem[] = [];
  const seen = new Set<string>();
  for (const ind of topic.indicators) {
    const dim = dimensionOf(topic, ind);
    if (!dim || dim.followsSelection || !usesDimension(ind)) continue;
    for (const option of dim.options) {
      // 子項目是國家（聯合國投票的「比較對象」）：交給國家搜尋，打「日本」不必多一筆主題結果
      if (/^_?[A-Z]{3}$/.test(option.id)) continue;
      // 同一個子項目通常好幾個指標都有，只收第一個（主題預設的指標排前面的話就是它）
      if (seen.has(option.id)) continue;
      seen.add(option.id);
      const indicator = preferredIndicator(topic, option.id) ?? ind.id;
      out.push({ topic: topic.id, indicator, item: option.id, label: option.label });
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
