import type { Text } from '../i18n';
import { agriculture } from './agriculture';
import { aid } from './aid';
import { ai } from './ai';
import { airQuality } from './air-quality';
import { chainStores } from './chain-stores';
import { cities } from './cities';
import { climate } from './climate';
import { conflict } from './conflict';
import { daylight } from './daylight';
import { crime } from './crime';
import { democracy } from './democracy';
import { developers } from './developers';
import { diet } from './diet';
import { digital } from './digital';
import { diplomacy } from './diplomacy';
import { disease } from './disease';
import { earthquakes } from './earthquakes';
import { education } from './education';
import { employment } from './employment';
import { gender } from './gender';
import { governance } from './governance';
import { electricity } from './electricity';
import { elevation } from './elevation';
import { ev } from './ev';
import { fertility } from './fertility';
import { fiscal } from './fiscal';
import { flags } from './flags';
import { happiness } from './happiness';
import { health } from './health';
import { height } from './height';
import { housePrices } from './house-prices';
import { housing } from './housing';
import { income } from './income';
import { industry } from './industry';
import { inequality } from './inequality';
import { innovation } from './innovation';
import { internetSpeed } from './internet-speed';
import { language } from './language';
import { marriage } from './marriage';
import { migration } from './migration';
import { minerals } from './minerals';
import { military } from './military';
import { nightLights } from './night-lights';
import { nobel } from './nobel';
import { oceans } from './oceans';
import { olympics } from './olympics';
import { organizations } from './organizations';
import { passport } from './passport';
import { pisa } from './pisa';
import { plastic } from './plastic';
import { pureMap } from './map';
import { population } from './population';
import { powerPlants } from './power-plants';
import { profiles } from './profiles';
import { publications } from './publications';
import { religion } from './religion';
import { renewables } from './renewables';
import { reserves } from './reserves';
import { rivers } from './rivers';
import { roadSafety } from './road-safety';
import { sectors } from './sectors';
import { shipping } from './shipping';
import { skyscrapers } from './skyscrapers';
import { semiconductors } from './semiconductors';
import { stockMarket } from './stock-market';
import { space } from './space';
import { submarineCables } from './submarine-cables';
import { temperature } from './temperature';
import { taxes } from './taxes';
import { tobaccoAlcohol } from './tobacco-alcohol';
import { tourism } from './tourism';
import { trade } from './trade';
import { travel } from './travel';
import { transport } from './transport';
import { unVotes } from './un-votes';
import { vaccination } from './vaccination';
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
  { id: 'society', label: { zh: '社會', en: 'People' }, topics: [population, fertility, marriage, cities, health, disease, vaccination, height, tobaccoAlcohol, education, pisa, diet, housing, religion, inequality, gender, crime, happiness, nobel, olympics] },
  { id: 'economy', label: { zh: '經濟', en: 'Economy' }, topics: [income, wages, employment, wealth, fiscal, taxes, reserves, stockMarket, housePrices, sectors, industry, agriculture, minerals, chainStores] },
  { id: 'global', label: { zh: '國際', en: 'Global' }, topics: [trade, migration, aid, tourism, passport, military, conflict, democracy, governance, organizations, unVotes, diplomacy] },
  { id: 'energy', label: { zh: '能源', en: 'Energy' }, topics: [electricity, powerPlants, renewables, climate, temperature, airQuality, waterForest, plastic, ev] },
  { id: 'tech', label: { zh: '科技與交通', en: 'Tech & transport' }, topics: [ai, semiconductors, digital, internetSpeed, developers, innovation, publications, submarineCables, space, transport, shipping, roadSafety] },
  { id: 'geo', label: { zh: '地理', en: 'Geography' }, topics: [profiles, flags, language, elevation, rivers, oceans, daylight, earthquakes, typhoons, wildfires, nightLights, worldHeritage, skyscrapers, travel] },
];

/** 純地圖頁不屬於任何分類，在頂列最前面單獨一顆按鈕 */
export const TOPICS: TopicDefinition[] = [pureMap, ...TOPIC_GROUPS.flatMap((g) => g.topics)];

// 開發模式下給 scripts/topic-thumbs.mjs 用（主題總覽的縮圖）：所有主題的 id
if (import.meta.env?.DEV) (window as unknown as { __topics?: string[] }).__topics = TOPICS.map((t) => t.id);

export function getTopic(id: string | null): TopicDefinition {
  // 沒指定主題時開人口，不是排在第一個的純地圖
  return TOPICS.find((t) => t.id === id) ?? population;
}
