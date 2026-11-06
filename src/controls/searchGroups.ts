import { tr, type Lang } from '../i18n';
import { parseCombo } from '../lib/comboSearch';
import { makeKey, normalize, scoreKey, searchCountries, type SearchEntry } from '../lib/countrySearch';
import type { useUI } from '../lib/strings';
import { searchTopics, type TopicTarget } from '../lib/topicSearch';
import { groupOfTopic, TOPIC_GROUPS } from '../topics';
import { CATALOG } from '../topics/catalog.gen';
import type { PaletteAction } from './CommandPalette';

/**
 * 控制列的搜尋框（CountrySearch.tsx）與指令面板（CommandPaletteDialog.tsx）共用的搜尋結果（2026-11-05，使用者要搜尋框跟指令面板
 * 一樣的功能）：組合搜尋（「日本 2010 人口」）、主題、國家、這個主題地圖上的地點、指令；沒打字時是最近看過的主題與所有指令。
 * 各組依最好的比對分數排，畫法兩邊各自（搜尋框的國家附目前的數值、指令面板有圖示）。
 */

/** 搜尋到的地圖上的一點：選了地圖飛過去、打開那一點的小卡片（App.tsx 的 searchPlaces） */
export interface PlaceOption {
  key: string;
  name: string;
  meta: string;
  score: number;
  run: () => void;
}

/** 組合搜尋選到的：主題（null 是目前的主題）、國家、年份，沒有的是 null */
export interface ComboTarget {
  target: TopicTarget | null;
  iso3: string | null;
  year: number | null;
}

export type SearchOption =
  | { kind: 'topic'; key: string; target: TopicTarget; name: string; meta: string; tag?: string }
  | { kind: 'country'; key: string; iso3: string; name: string; meta: string }
  | { kind: 'place'; key: string; name: string; meta: string; run: () => void }
  | { kind: 'action'; key: string; action: PaletteAction }
  | { kind: 'combo'; key: string; combo: ComboTarget; name: string; meta: string };

export interface SearchGroup {
  heading: string;
  options: SearchOption[];
  best: number;
}

export interface SearchSources {
  /** 國家搜尋的範圍（App.tsx 的 searchIndex） */
  index: SearchEntry[];
  currentTopic: string;
  /** 指令（App.tsx 的 paletteActions）；沒有就不列 */
  actions?: PaletteAction[];
  /** 這個主題地圖上的點（App.tsx 的 searchPlaces）；沒有點圖層的主題回傳空的 */
  places?: (query: string, limit: number) => PlaceOption[];
  /** 有沒有搜尋主題（主題、指標、子項目） */
  topics: boolean;
  /** 有沒有組合搜尋 */
  combo: boolean;
  /** 最近看過的主題（lib/recentTopics.ts，打開時讀） */
  recent: string[];
}

type UI = ReturnType<typeof useUI>;

/** 空白時列出的最近看過的主題數 */
const RECENT_COUNT = 6;

/** 分類的名稱（最近看過的主題寫在第二行） */
const TOPIC_GROUP_LABELS = new Map(TOPIC_GROUPS.map((g) => [g.id, g.label]));

export function searchGroups(query: string, src: SearchSources, lang: Lang, UI: UI): SearchGroup[] {
  const P = UI.palette;
  const actions = src.actions ?? [];
  const actionOption = (action: PaletteAction): SearchOption => ({ kind: 'action', key: `action/${action.id}`, action });
  const q = normalize(query).replace(/ /g, '');
  if (!q) {
    const recentTopics = src.topics ? src.recent.filter((t) => t !== src.currentTopic && CATALOG.topics[t]).slice(0, RECENT_COUNT) : [];
    return [
      {
        heading: P.recent,
        best: 2,
        options: recentTopics.map((topicId): SearchOption => {
          const group = groupOfTopic(topicId);
          return {
            kind: 'topic',
            key: `recent/${topicId}`,
            target: { topic: topicId, indicator: null, item: null },
            name: tr(CATALOG.topics[topicId].title, lang),
            meta: group ? tr(TOPIC_GROUP_LABELS.get(group)!, lang) : '',
          };
        }),
      },
      { heading: P.commands, best: 1, options: actions.map(actionOption) },
    ].filter((g) => g.options.length);
  }
  const topics = src.topics ? searchTopics(query, 6) : [];
  const countries = searchCountries(src.index, query, lang, 5);
  const placeHits = src.places?.(query, 6) ?? [];
  const matched = actions
    .map((action) => {
      const key = makeKey(action.label, 3);
      return { action, score: key ? scoreKey(q, key) : 0 };
    })
    .filter((a) => a.score >= 500)
    .sort((a, b) => b.score - a.score);
  // 組合搜尋：拆得出年份、國家、主題時最上面多一個（主題名稱完全比對到時排在主題後面，分數 900 > 850）
  const combo = src.combo ? parseCombo(query, src.index) : null;
  const comboOptions: SearchOption[] = [];
  if (combo) {
    const entry = combo.topic?.entry;
    const country = combo.iso3 ? src.index.find((e) => e.iso3 === combo.iso3) : undefined;
    const parts = [
      entry ? tr(entry.label, lang) : tr(CATALOG.topics[src.currentTopic]?.title ?? '', lang),
      country ? (lang === 'en' ? country.en : country.zh) : null,
      combo.year !== null ? P.year(combo.year) : null,
    ].filter(Boolean);
    comboOptions.push({
      kind: 'combo',
      key: `combo/${entry?.target.topic ?? src.currentTopic}/${entry?.target.indicator}/${entry?.target.item}/${combo.iso3}/${combo.year}`,
      combo: { target: entry?.target ?? null, iso3: combo.iso3, year: combo.year },
      name: parts.join(' · '),
      meta: !entry ? P.currentTopic : entry.kind === 'topic' ? tr(entry.groupLabel, lang) : tr(entry.topicTitle, lang),
    });
  }
  const list: SearchGroup[] = [
    { heading: P.combo, best: 850, options: comboOptions },
    {
      heading: UI.search.topics,
      best: topics[0]?.score ?? 0,
      options: topics.map(({ entry }) => ({
        kind: 'topic',
        key: `${entry.target.topic}/${entry.target.indicator}/${entry.target.item}`,
        target: entry.target,
        name: tr(entry.label, lang),
        meta: entry.kind === 'topic' ? tr(entry.groupLabel, lang) : tr(entry.topicTitle, lang),
        tag: UI.search.kinds[entry.kind],
      })),
    },
    {
      heading: UI.search.countries,
      best: countries[0]?.score ?? 0,
      options: countries.map(({ entry }) => ({
        kind: 'country',
        key: entry.iso3,
        iso3: entry.iso3,
        name: lang === 'en' ? entry.en : entry.zh,
        meta: lang === 'en' ? entry.iso3 : `${entry.en} · ${entry.iso3}`,
      })),
    },
    {
      heading: P.places,
      best: placeHits[0]?.score ?? 0,
      options: placeHits.map((p) => ({ kind: 'place', key: `place/${p.key}`, name: p.name, meta: p.meta, run: p.run })),
    },
    { heading: P.commands, best: matched[0]?.score ?? 0, options: matched.map((a) => actionOption(a.action)) },
  ];
  return list.filter((g) => g.options.length).sort((a, b) => b.best - a.best);
}

/** 選項的圖示與分類色依哪個主題：主題、組合（沒寫主題的是目前的主題）；國家、地點、指令沒有 */
export function optionTopic(option: SearchOption, currentTopic: string): string | null {
  if (option.kind === 'topic') return option.target.topic;
  if (option.kind === 'combo') return option.combo.target?.topic ?? currentTopic;
  return null;
}
