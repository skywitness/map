import type { Text } from '../i18n';
import { agriculture } from './agriculture';
import { ai } from './ai';
import { airQuality } from './air-quality';
import { climate } from './climate';
import { conflict } from './conflict';
import { crime } from './crime';
import { democracy } from './democracy';
import { diet } from './diet';
import { digital } from './digital';
import { diplomacy } from './diplomacy';
import { disease } from './disease';
import { earthquakes } from './earthquakes';
import { education } from './education';
import { employment } from './employment';
import { gender } from './gender';
import { electricity } from './electricity';
import { elevation } from './elevation';
import { ev } from './ev';
import { fertility } from './fertility';
import { fiscal } from './fiscal';
import { happiness } from './happiness';
import { health } from './health';
import { housing } from './housing';
import { income } from './income';
import { industry } from './industry';
import { inequality } from './inequality';
import { innovation } from './innovation';
import { language } from './language';
import { migration } from './migration';
import { minerals } from './minerals';
import { military } from './military';
import { nobel } from './nobel';
import { olympics } from './olympics';
import { organizations } from './organizations';
import { passport } from './passport';
import { pureMap } from './map';
import { population } from './population';
import { powerPlants } from './power-plants';
import { religion } from './religion';
import { renewables } from './renewables';
import { reserves } from './reserves';
import { roadSafety } from './road-safety';
import { sectors } from './sectors';
import { semiconductors } from './semiconductors';
import { stockMarket } from './stock-market';
import { space } from './space';
import { submarineCables } from './submarine-cables';
import { temperature } from './temperature';
import { tobaccoAlcohol } from './tobacco-alcohol';
import { tourism } from './tourism';
import { trade } from './trade';
import { travel } from './travel';
import { transport } from './transport';
import { unVotes } from './un-votes';
import { wages } from './wages';
import { wealth } from './wealth';
import type { TopicDefinition } from './types';
import { typhoons } from './typhoons';
import { waterForest } from './water-forest';
import { wildfires } from './wildfires';
import { worldHeritage } from './world-heritage';

export interface TopicGroup {
  id: string;
  label: Text;
  topics: TopicDefinition[];
}

/**
 * 頂列的主題分類，每一類是一個下拉選單；順序就是畫面上的順序。
 * 新增主題時加進最接近的一類。分類名稱要短，1280px 寬的螢幕要放得下整列（英文也是）。
 */
export const TOPIC_GROUPS: TopicGroup[] = [
  { id: 'society', label: { zh: '社會', en: 'People' }, topics: [population, fertility, health, disease, tobaccoAlcohol, education, diet, housing, religion, inequality, gender, crime, happiness, nobel, olympics] },
  { id: 'economy', label: { zh: '經濟', en: 'Economy' }, topics: [income, wages, employment, wealth, fiscal, reserves, stockMarket, sectors, industry, agriculture, minerals] },
  { id: 'global', label: { zh: '國際', en: 'Global' }, topics: [trade, migration, tourism, passport, military, conflict, democracy, organizations, unVotes, diplomacy] },
  { id: 'energy', label: { zh: '能源', en: 'Energy' }, topics: [electricity, powerPlants, renewables, climate, temperature, airQuality, waterForest, ev] },
  { id: 'tech', label: { zh: '科技與交通', en: 'Tech & transport' }, topics: [ai, semiconductors, digital, innovation, submarineCables, space, transport, roadSafety] },
  { id: 'geo', label: { zh: '地理', en: 'Geography' }, topics: [language, elevation, earthquakes, typhoons, wildfires, worldHeritage, travel] },
];

/** 純地圖頁不屬於任何分類，在頂列最前面單獨一顆按鈕 */
export const TOPICS: TopicDefinition[] = [pureMap, ...TOPIC_GROUPS.flatMap((g) => g.topics)];

export function getTopic(id: string | null): TopicDefinition {
  // 沒指定主題時開人口，不是排在第一個的純地圖
  return TOPICS.find((t) => t.id === id) ?? population;
}
