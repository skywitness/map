import type { TopicDefinition } from './types';
import { brandsPart } from './brands';
import { oldestCompaniesPart } from './oldest-companies';
import { companySites } from './company-sites';
import { companyRankingsPart } from './company-rankings';
import { hostOnly, topicPart } from './merge';
import { withParts } from './parts';

/**
 * 企業與品牌（2026-10-30，製作手冊第七批 120）：「最古老的公司」與「品牌的發源地（時尚、汽車）」合成一個主題，
 * 各自的指標、疊加圖層、說明與資料來源照舊寫在原本的檔（oldest-companies.ts、brands.ts），這裡只組起來。
 * 資料都在 public/data/topics/companies/。舊網址 t/oldest-companies/、t/brands/ 轉到這裡（redirects.ts）。
 * 便利商店與連鎖品牌不併（店數密度，性質不同）。
 */
const companiesOwn: TopicDefinition = {
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

/**
 * 企業與品牌（2026-11-04，主題整併 併4）：「大企業的據點」併進來，資料照舊在 company-sites/（topics/merge.ts）；
 * 據點的「有幾家在這裡」原本也叫 companies，改名 site-companies。「依公司」的子項目只有據點的指標用。
 * 舊網址 t/company-sites/ 轉到這裡（redirects.ts）
 */
export const companies: TopicDefinition = withParts(
  {
    ...hostOnly(companiesOwn),
    title: { zh: '企業與品牌：最古老的公司、品牌與大企業的據點', en: 'Companies and brands: oldest companies, brands and big companies’ sites' },
  },
  topicPart(companySites, { rename: { companies: 'site-companies' } }),
  // 2026-11-07（第二十五批 465）：Forbes 2000、前 50 大營收、最有價值的品牌、獨角獸（英文維基的轉引表），資料在 companies/
  companyRankingsPart,
);
