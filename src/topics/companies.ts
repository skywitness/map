import type { TopicDefinition } from './types';
import { brandsPart } from './brands';
import { oldestCompaniesPart } from './oldest-companies';

/**
 * 企業與品牌（2026-10-30，製作手冊第七批 120）：「最古老的公司」與「品牌的發源地（時尚、汽車）」合成一個主題，
 * 各自的指標、疊加圖層、說明與資料來源照舊寫在原本的檔（oldest-companies.ts、brands.ts），這裡只組起來。
 * 資料都在 public/data/topics/companies/。舊網址 t/oldest-companies/、t/brands/ 轉到這裡（redirects.ts）。
 * 便利商店與連鎖品牌不併（店數密度，性質不同）。
 */
export const companies: TopicDefinition = {
  id: 'companies',
  title: { zh: '企業與品牌', en: 'Companies and brands' },
  shortTitle: { zh: '企業與品牌', en: 'Companies' },
  defaultIndicator: 'companies',
  defaultYear: 2026,
  sources: [...oldestCompaniesPart.sources, ...brandsPart.sources.filter((s) => s.url !== 'https://www.wikidata.org/')],
  note: {
    zh: `最古老的公司：${oldestCompaniesPart.note.zh} 品牌：${brandsPart.note.zh}`,
    en: `Oldest companies: ${oldestCompaniesPart.note.en} Brands: ${brandsPart.note.en}`,
  },
  panelExtra: () => import('./panels/CompaniesPanel'),
  overlays: [...oldestCompaniesPart.overlays, ...brandsPart.overlays],
  indicators: [...oldestCompaniesPart.indicators, ...brandsPart.indicators],
};
