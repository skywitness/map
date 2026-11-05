import { covidPolicy } from './covid-policy';
import { hostOnly, topicPart } from './merge';
import { withParts } from './parts';
import type { TopicDefinition } from './types';
import { covidVaccinationPart } from './vaccination';

/**
 * COVID-19（2026-11-04，主題整併 整2）：「疫苗與防疫」的 COVID-19 指標（確診死亡、疫苗、超額死亡、少報的倍數，每年一筆）
 * 與「疫情期間的防疫管制」（每 7 天一筆，時間軸是日期，covid-policy.ts 的 timeAxis）合成一個主題。
 * 資料照舊在 vaccination/、covid-policy/（topics/merge.ts）；換到時間軸意思不同的指標時年份回到那個指標的預設（App.tsx）。
 * 舊網址 t/covid-policy/ 與 t/vaccination/?ind=covid-deaths 等轉到這裡（redirects.ts）
 */
export const covid: TopicDefinition = withParts(
  hostOnly({
    id: 'covid',
    dataTopic: 'vaccination',
    title: { zh: 'COVID-19：死亡、疫苗與防疫管制', en: 'COVID-19: deaths, vaccines and restrictions' },
    shortTitle: { zh: 'COVID-19', en: 'COVID-19' },
    defaultIndicator: 'covid-deaths',
    defaultYear: 2025,
    sources: [],
    indicators: [],
  }),
  covidVaccinationPart,
  topicPart(covidPolicy),
);
