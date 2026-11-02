import { defineMessages, useLang } from '../../i18n';
import { SITC_GROUPS } from '../industry';
import { ShareStack } from './ShareStack';

/**
 * 工業主題「出口組成（1962 年起）」「最大的出口類別」的側欄（2026-11-02，製作手冊第十七批 270）：這一國 1962–2024 年
 * 出口的 SITC 八大類比例，堆疊面積圖。讀 exports-sitc/<類>.json（地圖用的同一組檔）；顏色依類別的順序取 MAP_TOKENS.categorical，
 * 跟「最大的出口類別」地圖的圖例一樣
 */

const TEXT = defineMessages({
  zh: {
    title: '出口組成的變化（SITC，1962 年起）',
    none: '沒有這個國家的出口組成。',
    note: 'Harvard Atlas 的 SITC Rev. 2，占全部商品出口的比例；不含服務。台灣的值來自貿易夥伴的申報。',
  },
  en: {
    title: 'Export mix over time (SITC, from 1962)',
    none: 'No export mix for this country.',
    note: 'Harvard Atlas SITC Rev. 2, as a share of all goods exports; services excluded. Taiwan’s figures come from its partners’ reports.',
  },
});

const FILES = (topicId: string) => SITC_GROUPS.map((g) => `topics/${topicId}/exports-sitc/${g.id}.json`);

export function IndustrySitc({ topicId, iso3, year }: { topicId: string; iso3: string; year: number }) {
  const text = TEXT[useLang()];
  return <ShareStack files={FILES(topicId)} groups={SITC_GROUPS} iso3={iso3} year={year} {...text} />;
}
