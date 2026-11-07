import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 內河船隊：自航貨船、推拖船與船齡（2026-11-07，製作手冊第二十七批 583，候選 1302；pipeline/topics/inland_fleet.py）：
 * 擴充「河流與流域」的內河航道（第二十三批 411）。Eurostat iww_eq_age。
 */
export const INLAND_FLEET_IDS = ['inland-barges', 'inland-pushers', 'inland-old-share'];

const NOTE: Text = {
  zh: 'Eurostat 的內河船隊（iww_eq_age），只有歐洲；不含客船與遊船，各國最近一年不一樣。英國照網站的規則不畫；台灣沒有可通航的內陸水道。',
  en: 'Eurostat inland fleet (iww_eq_age), Europe only; passenger and leisure boats are excluded and the latest year differs by country. The UK is not shown by the site’s rule; Taiwan has no navigable inland waterways.',
};
const ships = (v: number) => tr({ zh: `${fixed(v, 0)} 艘`, en: fixed(v, 0) });

export const inlandFleetPart: TopicPart = {
  name: { zh: '內河船隊', en: 'Inland fleet' },
  sources: [
    {
      name: { zh: 'Eurostat：內河船舶依建造年份（iww_eq_age）', en: 'Eurostat: inland waterway vessels by year of construction (iww_eq_age)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/iww_eq_age/default/table',
      license: 'CC BY 4.0',
    },
  ],
  panelExtra: () => import('./panels/InlandFleetPanel'),
  indicators: [
    {
      id: 'inland-barges',
      label: { zh: '內河自航貨船', en: 'Self-propelled inland cargo vessels' },
      description: {
        zh: `登記的內河自航貨船（Eurostat，1990 年起）。荷蘭 2024 年 4,283 艘（1990 年 5,772），德國 1,092（2,207）、比利時 799（1,611）、法國 644（2,300，掉了 72%）；烏克蘭 2023 年 1,667 艘（1990 年只有 217，那時只申報部分船隊，是序列中斷，不是真的增加）。${tr(NOTE, 'zh')}點國家看建造年份的組成。`,
        en: `Registered self-propelled inland cargo vessels (Eurostat, from 1990). The Netherlands had 4,283 in 2024 (5,772 in 1990), Germany 1,092 (2,207), Belgium 799 (1,611) and France 644 (2,300, down 72%); Ukraine had 1,667 in 2023 against only 217 in 1990, when only part of the fleet was reported, so this is a break in the series rather than real growth. ${tr(NOTE, 'en')} Click a country for the mix of construction years.`,
      },
      unit: { zh: '艘', en: 'vessels' },
      file: 'inland-barges.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: ships,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2024,
    },
    {
      id: 'inland-pushers',
      label: { zh: '內河推拖船', en: 'Inland tugs and pushers' },
      description: {
        zh: `登記的內河推船與拖船（Eurostat，1990 年起）。荷蘭 2024 年 745 艘（1990 年 1,062），德國 373、比利時 153。${tr(NOTE, 'zh')}`,
        en: `Registered inland tugs and pushers (Eurostat, from 1990). The Netherlands had 745 in 2024 (1,062 in 1990), Germany 373 and Belgium 153. ${tr(NOTE, 'en')}`,
      },
      unit: { zh: '艘', en: 'vessels' },
      file: 'inland-pushers.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: ships,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2024,
    },
    {
      id: 'inland-old-share',
      label: { zh: '1974 年以前造的內河貨船', en: 'Inland cargo vessels built before 1975' },
      description: {
        zh: `自航貨船裡 1974 年以前造的占幾 %（Eurostat）。內河船隊很老：2024 年法國 70.7%（644 艘裡 455 艘）、德國 57.1%（1,092 艘裡 624 艘）、比利時 33.9%；東歐更高，克羅埃西亞 84.6%（13 艘裡 11 艘）、羅馬尼亞 81.0%（189 艘裡 153 艘）、保加利亞 80.0%。荷蘭沒有申報建造年份的分項；波蘭只申報「1974 年以前」一類（等於全部船數），算出來是 100%，不可信，不上色。${tr(NOTE, 'zh')}`,
        en: `Share of self-propelled cargo vessels built in 1974 or earlier (Eurostat). Inland fleets are old: in 2024 France 70.7% (455 of 644), Germany 57.1% (624 of 1,092) and Belgium 33.9%; Eastern Europe is higher still, with Croatia at 84.6% (11 of 13), Romania 81.0% (153 of 189) and Bulgaria 80.0%. The Netherlands does not report construction years; Poland reports only the “1974 or earlier” class (equal to its whole fleet), so its 100% is not reliable and it is not shaded. ${tr(NOTE, 'en')}`,
      },
      unit: '%',
      file: 'inland-old-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 55, 70] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
  ],
};
