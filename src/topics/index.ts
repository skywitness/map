import type { Text } from '../i18n';
import { agriculture } from './agriculture';
import { ai } from './ai';
import { climate } from './climate';
import { democracy } from './democracy';
import { diet } from './diet';
import { digital } from './digital';
import { diplomacy } from './diplomacy';
import { disease } from './disease';
import { earthquakes } from './earthquakes';
import { education } from './education';
import { gender } from './gender';
import { electricity } from './electricity';
import { elevation } from './elevation';
import { health } from './health';
import { housing } from './housing';
import { income } from './income';
import { industry } from './industry';
import { inequality } from './inequality';
import { language } from './language';
import { migration } from './migration';
import { military } from './military';
import { nobel } from './nobel';
import { pureMap } from './map';
import { population } from './population';
import { religion } from './religion';
import { sectors } from './sectors';
import { tourism } from './tourism';
import { trade } from './trade';
import { transport } from './transport';
import type { TopicDefinition } from './types';

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
  { id: 'society', label: { zh: '社會', en: 'People' }, topics: [population, health, disease, education, diet, housing, religion, inequality, gender, nobel] },
  { id: 'economy', label: { zh: '經濟', en: 'Economy' }, topics: [income, sectors, industry, agriculture] },
  { id: 'global', label: { zh: '國際', en: 'Global' }, topics: [trade, migration, tourism, military, democracy, diplomacy] },
  { id: 'energy', label: { zh: '能源', en: 'Energy' }, topics: [electricity, climate] },
  { id: 'tech', label: { zh: '科技與交通', en: 'Tech & transport' }, topics: [ai, digital, transport] },
  { id: 'geo', label: { zh: '地理', en: 'Geography' }, topics: [language, elevation, earthquakes] },
];

/** 純地圖頁不屬於任何分類，在頂列最前面單獨一顆按鈕 */
export const TOPICS: TopicDefinition[] = [pureMap, ...TOPIC_GROUPS.flatMap((g) => g.topics)];

export function getTopic(id: string | null): TopicDefinition {
  // 沒指定主題時開人口，不是排在第一個的純地圖
  return TOPICS.find((t) => t.id === id) ?? population;
}
