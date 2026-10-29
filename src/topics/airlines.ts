import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 各國的航空公司（pipeline/topics/airlines.py）：Wikidata 的航空公司，各國每年營運中的家數。
 * 使用者 2026-10-29 決定：地圖預設只算營運中的（2026 年），停業的放時間軸（拖到以前的年份就算那一年營運中的）。
 */

const airlineCount = (v: number) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'airline' : 'airlines'}` });

export const airlines: TopicDefinition = {
  id: 'airlines',
  title: { zh: '各國的航空公司', en: 'Airlines by country' },
  shortTitle: { zh: '航空公司', en: 'Airlines' },
  defaultIndicator: 'operating',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Wikidata（航空公司的國家、成立與停業年份、IATA 與 ICAO 代碼、名稱）', en: 'Wikidata (countries, founding and closing years, IATA and ICAO codes, names)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh:
      '航空公司是 Wikidata 標成航空公司（含低成本、國家、區域、包機航空公司）的，加上有 IATA 或 ICAO 航空公司代碼、標成一般公司的（例如台灣虎航）；只做貨運、直升機的不算。' +
      '營運中是沒有停業日期、也有 IATA 或 ICAO 代碼的；Wikidata 很多停業的航空公司沒寫停業日期，所以還是會多算一些，各國的收錄也不一樣多，家數只是大概。' +
      '停業的依成立到停業的年份算在時間軸上；成立年份不詳的營運中航空公司（約 240 家）只算在 2026 年，所以 2026 年比 2025 年多。國家照 Wikidata 的國家，北歐航空這類兩國以上的每國都算，沒有國家的用總部所在的國家。' +
      '威航在 Wikidata 沒有停業日期，照它 2016 年 10 月停止營運改成 2016 年。',
    en:
      'Airlines are Wikidata items classed as airlines (including low-cost, flag, regional and charter airlines), plus items with an IATA or ICAO airline code classed as ordinary companies (such as Tigerair Taiwan); cargo-only and helicopter operators are left out. ' +
      'An airline counts as operating if it has no closing date and has an IATA or ICAO code. Many defunct airlines in Wikidata have no closing date, so some are still overcounted, and coverage varies between countries; counts are approximate. ' +
      'Defunct airlines are counted in the timeline from founding to closing; operating airlines with an unknown founding year (about 240) count only in 2026, which is why 2026 is higher than 2025. Countries follow Wikidata, airlines of two or more countries, such as SAS, count in each, and those without a country use the country of their headquarters. ' +
      'V Air has no closing date in Wikidata; it stopped flying in October 2016 and is treated as closed that year.',
  },
  panelExtra: () => import('./panels/AirlinesPanel'),
  indicators: [
    {
      id: 'operating',
      label: { zh: '營運中的航空公司', en: 'Operating airlines' },
      description: {
        zh: '這一年營運中的航空公司家數，圓的面積與它成正比。2026 年全世界約 1,800 家，美國 173、俄羅斯 75、加拿大 68、中國 65、德國 54、英國 53 家；台灣 8 家（中華、長榮、華信、立榮、德安、台灣虎航、星宇，加上荷蘭航空在台灣登記的子公司）。拖動時間軸看以前：1909 年德國的飛船航空公司 DELAG 最早，1919 年有荷蘭皇家航空等 23 家，1950 年約 300 家；台灣 1990 年代開放天空後一度有 17 家。點國家列出它的航空公司。',
        en: 'Airlines operating in the year; circle area is proportional to the count. In 2026 there are about 1,800 worldwide: the US 173, Russia 75, Canada 68, China 65, Germany 54 and the UK 53; Taiwan 8 (China Airlines, EVA Air, Mandarin Airlines, UNI Air, Daily Air, Tigerair Taiwan and Starlux, plus KLM’s subsidiary registered in Taiwan). Drag the timeline back to Germany’s airship airline DELAG in 1909, the first; 23 airlines including KLM by 1919 and about 300 by 1950. Taiwan briefly had 17 after it opened its skies in the 1990s. Select a country for its airlines.',
      },
      unit: { zh: '家', en: 'airlines' },
      file: 'operating.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: airlineCount,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
};
