import { defineMessages, useLang } from '../../i18n';
import { SECTORS } from '../energy-use';
import type { PanelExtraProps } from '../types';
import { ShareStack } from './ShareStack';

/**
 * 各部門最終能源消費的側欄（2026-11-07，第二十五批 523）：這一國各部門占比的堆疊面積圖，讀地圖用的同一組
 * sector-share/<部門>.json；顏色依部門的順序取 MAP_TOKENS.categorical，跟地圖的圓餅一樣
 */
const TEXT = defineMessages({
  zh: {
    title: '各部門占最終能源消費的比例（歷年）',
    none: '沒有這個國家的部門資料。',
    note: '聯合國統計司能源平衡表（1990–2023）；台灣是經濟部能源署（2005–2025）。不含非能源用。',
  },
  en: {
    title: 'Share of final energy use by sector over time',
    none: 'No sector data for this country.',
    note: 'UN Statistics Division energy balances (1990–2023); Taiwan from the Energy Administration, MOEA (2005–2025). Non-energy use excluded.',
  },
});

export default function EnergyUsePanel({ topic, iso3, year }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const files = SECTORS.map((s) => `topics/${topic.id}/sector-share/${s.id}.json`);
  return <ShareStack files={files} groups={SECTORS} iso3={iso3} year={year} {...text} />;
}
