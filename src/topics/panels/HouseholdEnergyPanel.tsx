import { defineMessages, useLang } from '../../i18n';
import { HEATING_FUELS, USES } from '../household-energy';
import type { PanelExtraProps } from '../types';
import { ShareStack } from './ShareStack';

/**
 * 家裡的能源花在哪的側欄（2026-11-07，第二十五批 524）：這一國家戶能源的用途、暖氣的燃料，兩張堆疊面積圖（2010–2024），
 * 讀地圖用的同一組檔；顏色依類別的順序取 MAP_TOKENS.categorical
 */
const TEXT = defineMessages({
  zh: {
    uses: '家戶能源的用途（歷年）',
    fuels: '暖氣燒什麼（歷年）',
    none: '沒有這個國家的資料。',
    usesNote: 'Eurostat nrg_d_hhq，占家戶最終能源消費的比例。',
    fuelsNote: '占空間暖氣能源的比例；「其他再生能源」是再生能源合計減掉木柴。',
  },
  en: {
    uses: 'Household energy by end use over time',
    fuels: 'What heats homes over time',
    none: 'No data for this country.',
    usesNote: 'Eurostat nrg_d_hhq, as a share of household final energy consumption.',
    fuelsNote: 'As a share of energy for space heating; “other renewables” is total renewables minus wood.',
  },
});

export default function HouseholdEnergyPanel({ topic, iso3, year }: PanelExtraProps) {
  const text = TEXT[useLang()];
  return (
    <>
      <ShareStack
        files={USES.map((u) => `topics/${topic.id}/end-use/${u.id}.json`)}
        groups={USES}
        iso3={iso3}
        year={year}
        title={text.uses}
        none={text.none}
        note={text.usesNote}
      />
      <ShareStack
        files={HEATING_FUELS.map((f) => `topics/${topic.id}/heating-fuel/${f.id}.json`)}
        groups={HEATING_FUELS}
        iso3={iso3}
        year={year}
        title={text.fuels}
        none={text.none}
        note={text.fuelsNote}
      />
    </>
  );
}
