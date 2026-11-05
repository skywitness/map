import { healthSpendingPart } from './health';
import { hostOnly } from './merge';
import { withParts } from './parts';
import type { TopicDefinition } from './types';

/**
 * 醫療支出與健保（2026-11-04，主題整併 整1：從「健康與醫療」拆出來）：人均醫療支出、占 GDP、自付比例、政府與健保支出占比、
 * 健保制度、醫療的主要財源、全民健保的開辦年份。資料照舊在 health/（topics/merge.ts），
 * 舊網址 t/health/?ind=health-spending-per-capita 等由 redirects.ts 的 INDICATOR_MOVES 轉過來
 */
export const healthSpending: TopicDefinition = withParts(
  hostOnly({
    id: 'health-spending',
    dataTopic: 'health',
    title: { zh: '醫療支出與健保', en: 'Health spending and insurance' },
    shortTitle: { zh: '醫療支出與健保', en: 'Health spending' },
    defaultIndicator: 'health-spending-per-capita',
    defaultYear: 2023,
    sources: [],
    indicators: [],
  }),
  healthSpendingPart,
);
