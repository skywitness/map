import { tr } from '../i18n/lang';
import { hsrExtra } from './rail-extra';
import type { TopicDefinition } from './types';

/**
 * 高鐵（2026-10-30，製作手冊第十一批 186：從「交通」拆出來）：各國第一條高速鐵路的通車年份（pipeline/topics/metro.py，
 * Wikidata 的高速鐵路線）。資料沒有搬，還在 public/data/topics/transport/（dataTopic）。
 */
const yearText = (v: number) => tr({ zh: `${Math.round(v)} 年`, en: String(Math.round(v)) });

export const highSpeedRail: TopicDefinition = {
  id: 'high-speed-rail',
  dataTopic: 'transport',
  title: { zh: '高鐵', en: 'High-speed rail' },
  shortTitle: { zh: '高鐵', en: 'High-speed rail' },
  defaultIndicator: 'hsr-first',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（高速鐵路線與開通日期）', en: 'Wikidata (high-speed railway lines and opening dates)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    ...hsrExtra.sources,
  ],
  listPanel: hsrExtra.listPanel,
  note: {
    zh: '高鐵是 Wikidata 標成高速鐵路線、有啟用日期的路線，每一國最早的一條逐一核對過。鐵路的路網與軌距見「鐵路」主題，地鐵見「地鐵與城市軌道」主題。',
    en: 'High-speed lines are those classed as high-speed railway lines in Wikidata with an opening date; each country’s earliest line was checked by hand. For rail networks and track gauges see the Railways topic; for metros, the Metro and urban rail topic.',
  },
  panelExtra: () => import('./panels/HighSpeedRailPanel'),
  indicators: [
    {
      id: 'hsr-first',
      label: { zh: '第一條高鐵', en: 'First high-speed line' },
      description: {
        zh: '這個國家第一條高速鐵路通車的年份（Wikidata 標成高速鐵路線的路線）：1964 年日本的東海道新幹線最早，台灣高鐵是 2007 年。沒有標成高速鐵路線的不算，所以奧地利、瑞士、俄羅斯、美國等沒有值。',
        en: 'The year a country’s first high-speed line opened (lines classed as high-speed railway lines in Wikidata): Japan’s Tōkaidō Shinkansen was first, in 1964; Taiwan High Speed Rail opened in 2007. Lines not classed as high-speed are not counted, so Austria, Switzerland, Russia and the United States, among others, have no value.',
      },
      unit: { zh: '年', en: '' },
      file: 'hsr-first.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1980, 1995, 2005, 2015] } },
      format: yearText,
      formatTick: (v) => String(Math.round(v)),
      missing: { zh: '這一年還沒有高鐵（或 Wikidata 沒有收錄）', en: 'No high-speed line yet (or none in Wikidata)' },
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
      panelChart: false,
    },
    ...hsrExtra.indicators,
  ],
};
