import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 機隊的規模與年齡（2026-11-05，製作手冊第二十三批 400；pipeline/topics/air_fleet.py）：擴充「航線與航空公司」。
 * 民航機隊架數用 CIA World Factbook 2022 年版（多數 2020 年），20 年以上老飛機的比例用 Eurostat（歐洲 33 國，依營運國）；
 * 台灣的側欄列民航局的國籍航空器登記。
 */

export const FLEET_INDICATORS = ['fleet-aircraft', 'old-aircraft'];

export const airFleet: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'CIA World Factbook 2022 年 12 月的版本（民航機隊架數、航空公司家數，factbook/factbook.json 的 commit 61dadec0）',
        en: 'CIA World Factbook, December 2022 edition (registered aircraft and air carriers; factbook/factbook.json commit 61dadec0)',
      },
      url: 'https://github.com/factbook/factbook.json/tree/61dadec0c9c9a38eb4c9665aa779977c47dd0481',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Eurostat（依營運國的商用飛機機齡，avia_eq_arc_age）', en: 'Eurostat (commercial aircraft by age, by operating country, avia_eq_arc_age)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/avia_eq_arc_age/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '交通部民用航空局「國籍航空器登記架數及機型」（台灣的側欄）', en: 'Taiwan Civil Aeronautics Administration, registered aircraft by operator and type (Taiwan’s side panel)' },
      url: 'https://data.gov.tw/dataset/19797',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  indicators: [
    {
      id: 'fleet-aircraft',
      label: { zh: '民航機隊有幾架飛機', en: 'Registered airline aircraft' },
      description: {
        zh: '在這國登記的航空公司營運的飛機有幾架（CIA World Factbook 2022 年版，多數是 2020 年；之後的版本把這一欄刪了），圓的面積與它成正比；滑過國家看有幾家航空公司。188 國：美國 7,249 架最多，中國 2,890、德國 1,113、俄羅斯 958、加拿大 879、英國 794、日本 673、土耳其 618、印尼 611、澳洲 583；台灣 216 架、7 家航空公司。民航局 2026 年 8 月的國籍航空器登記是 334 架（含通用航空與政府機關，長榮 90、華航 86、星宇 36、台灣虎航 18），列在台灣的側欄。',
        en: 'Aircraft operated by airlines registered in the country (CIA World Factbook, December 2022 edition, mostly 2020; later editions dropped the field); circle area is proportional to it, and hovering shows the number of airlines. Across 188 countries the US leads with 7,249, then China 2,890, Germany 1,113, Russia 958, Canada 879, the UK 794, Japan 673, Turkey 618, Indonesia 611 and Australia 583; Taiwan has 216 aircraft and 7 airlines. Taiwan’s Civil Aeronautics Administration registered 334 aircraft in August 2026 (including general aviation and government; EVA Air 90, China Airlines 86, Starlux 36, Tigerair Taiwan 18), listed in Taiwan’s side panel.',
      },
      unit: { zh: '架', en: 'aircraft' },
      file: 'fleet-aircraft.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 架`, en: `${fixed(v, 0)} aircraft` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'old-aircraft',
      label: { zh: '20 年以上的老飛機占幾成', en: 'Share of aircraft 20+ years old' },
      description: {
        zh: '商用飛機裡機齡 20 年以上的占幾成（Eurostat，依營運的國家，歐洲 33 國，2000–2025 年；機隊不到 10 架的年份不算）。2025 年斯洛維尼亞 56.0%（25 架）、保加利亞 55.4%、克羅埃西亞 50.0%、冰島 48.2% 最老；德國 25.6%、法國 22.8%、西班牙 17.3%、荷蘭 17.2%；土耳其 11.7%、愛爾蘭 11.3%（瑞安航空的機隊很新）、馬爾他 8.5%、拉脫維亞 5.5% 最年輕。機隊小的國家幾架老飛機就拉高比例，側欄列五個機齡層的架數。全世界與台灣沒有公開、可用的機齡統計。',
        en: 'Share of commercial aircraft aged 20 years or more (Eurostat, by operating country, 33 European countries, 2000–2025; years with fewer than 10 aircraft are left out). In 2025 Slovenia (56.0%, of 25 aircraft), Bulgaria 55.4%, Croatia 50.0% and Iceland 48.2% are the oldest; Germany 25.6%, France 22.8%, Spain 17.3% and the Netherlands 17.2%; Turkey 11.7%, Ireland 11.3% (Ryanair’s young fleet), Malta 8.5% and Latvia 5.5% are the youngest. In small fleets a few old aircraft raise the share a lot; the side panel lists all five age bands. There are no open, usable aircraft-age statistics for the world or Taiwan.',
      },
      unit: '%',
      file: 'old-aircraft.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 35, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
