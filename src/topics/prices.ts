import { pricesPart } from './fiscal';
import { hostOnly } from './merge';
import { withParts } from './parts';
import type { TopicDefinition } from './types';

/**
 * 物價與消費（2026-11-04，主題整併 整3：從「各國物價與財政」拆出來）：通膨率、物價水準，與家庭的錢花在吃、休閒與文化、
 * 餐廳與旅館的比例。資料照舊在 fiscal/（topics/merge.ts），舊網址 t/fiscal/?ind=inflation 等由 redirects.ts 轉過來
 */
export const prices: TopicDefinition = withParts(
  hostOnly({
    id: 'prices',
    dataTopic: 'fiscal',
    title: { zh: '物價與消費', en: 'Prices and household spending' },
    shortTitle: { zh: '物價與消費', en: 'Prices' },
    defaultIndicator: 'inflation',
    defaultYear: 2025,
    sources: [],
    indicators: [],
  }),
  pricesPart,
);
