import { defineMessages, useLang } from '../../i18n';
import { SERVICE_GROUPS } from '../trade';
import { ShareStack } from './ShareStack';

/**
 * 貿易主題服務出口指標的側欄（2026-11-02，製作手冊第十七批 271）：這一國 2005 年起服務出口的五類比例，堆疊面積圖。
 * 讀 services-mix/<類>.json（地圖用的同一組檔），顏色跟「服務出口」的圓餅一樣
 */

const TEXT = defineMessages({
  zh: {
    title: '服務出口的組成',
    none: '沒有這個國家服務出口的組成（運輸、旅行、電信電腦與資訊、保險與金融四類要都有）。',
    note: 'IMF 國際收支（世界銀行 WDI 轉載），占服務出口的比例；其他服務是 100% 減四類。台灣用中央銀行國際收支。',
  },
  en: {
    title: 'Service exports by type',
    none: 'No breakdown of service exports for this country (transport, travel, ICT and insurance and finance are all needed).',
    note: 'IMF balance of payments (via the World Bank WDI), as a share of service exports; other services are 100% minus the four types. Taiwan uses Central Bank balance-of-payments data.',
  },
});

const FILES = (topicId: string) => SERVICE_GROUPS.map((g) => `topics/${topicId}/services-mix/${g.id}.json`);

export function TradeServices({ topicId, iso3, year }: { topicId: string; iso3: string; year: number }) {
  const text = TEXT[useLang()];
  return <ShareStack files={FILES(topicId)} groups={SERVICE_GROUPS} iso3={iso3} year={year} {...text} />;
}
