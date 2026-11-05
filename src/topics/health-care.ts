import { healthCarePart } from './health';
import { hospitalQuality } from './hospital-quality';
import { medicalImaging } from './medical-imaging';
import { hostOnly, topicPart } from './merge';
import { withParts } from './parts';
import type { TopicDefinition } from './types';

/**
 * 醫療人力與設備（2026-11-04，主題整併 整1：從「健康與醫療」拆出來，加上「醫學影像與放射治療設備」「醫院的表現」）：
 * 醫師、護理人員、病床、加護病床、手術、遠距問診、長照，醫學影像的設備與檢查，醫院的 30 天死亡率、髖骨折開刀、等多久。
 * 資料照舊在 health/、medical-imaging/、hospital-quality/（topics/merge.ts）；舊網址由 redirects.ts 轉過來
 */
export const healthCare: TopicDefinition = withParts(
  hostOnly({
    id: 'health-care',
    dataTopic: 'health',
    title: { zh: '醫療人力與設備：醫師、病床、醫學影像與醫院的表現', en: 'Health workforce and facilities: doctors, beds, imaging and hospital performance' },
    shortTitle: { zh: '醫療人力與設備', en: 'Health care' },
    defaultIndicator: 'physicians',
    defaultYear: 2023,
    sources: [],
    indicators: [],
  }),
  healthCarePart,
  topicPart(medicalImaging),
  topicPart(hospitalQuality),
);
