import { tr, type Text } from '../i18n/lang';
import { formatLargeNumber, formatLargeTick } from '../lib/format';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 卡車、貨車與公車（含電動卡車）（2026-11-07，製作手冊第二十七批 577，候選 1293；pipeline/topics/trucks_buses.py）：
 * 擴充「汽機車」（併在汽機車與電動車）。Eurostat 的貨車依載重與動力、大客車；台灣用交通部的機動車輛登記數。
 */
export const TRUCK_IDS = ['light-vans', 'heavy-trucks', 'electric-trucks', 'buses'];

const TW_NOTE: Text = {
  zh: '台灣用交通部的機動車輛登記數（年底）；台灣的大小貨車也以總重 3.5 公噸分界，但車種分類跟 Eurostat 不完全相同（特種車另計）。英國照網站的規則不畫。',
  en: 'Taiwan uses its Ministry of Transportation’s registrations (year end); Taiwan also splits lorries at 3.5 tonnes gross weight, but its vehicle classes differ somewhat from Eurostat’s (special-purpose vehicles are separate). The UK is not shown by the site’s rule.',
};
const vehicles = (v: number) => tr({ zh: `${formatLargeNumber(v)} 輛`, en: formatLargeNumber(v) });

export const trucks: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'Eurostat：貨車依載重與動力（road_eqs_lormot）、大客車與遊覽車（road_eqs_busveh）',
        en: 'Eurostat: lorries by load capacity and motor energy (road_eqs_lormot), motor coaches and buses (road_eqs_busveh)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/road_eqs_lormot/default/table',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'light-vans',
      label: { zh: '輕型貨車（3.5 公噸以下）', en: 'Light goods vehicles (up to 3.5 t)' },
      description: {
        zh: `登記的輕型貨車（載重 3.5 公噸以下，Eurostat，2013 年起，各國最近一年）。網購與最後一哩的配送讓它大增：歐盟 27 國 2013 年 23,339,758 輛 → 2024 年 28,484,721 輛；同期 3.5 公噸以上的重型卡車反而從 3,730,266 輛減到 3,589,974 輛。法國 5,116,070 輛（2024 年）最多，土耳其 4,914,441（2013 年 2,933,050）、義大利 4,136,002、西班牙 3,530,308、德國 3,380,345（2025 年）。台灣的小貨車 2025 年 976,590 輛。${tr(TW_NOTE, 'zh')}點國家看依動力的組成。`,
        en: `Registered light goods vehicles (up to 3.5 tonnes, Eurostat, from 2013, latest year for each country). Online shopping and last-mile delivery drove them up: the EU-27 went from 23,339,758 in 2013 to 28,484,721 in 2024, while heavy lorries over 3.5 tonnes fell from 3,730,266 to 3,589,974. France has the most, 5,116,070 (2024), then Türkiye 4,914,441 (2,933,050 in 2013), Italy 4,136,002, Spain 3,530,308 and Germany 3,380,345 (2025). Taiwan had 976,590 light goods vehicles in 2025. ${tr(TW_NOTE, 'en')} Click a country for the mix of motor energy.`,
      },
      unit: { zh: '輛', en: 'vehicles' },
      file: 'light-vans.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: vehicles,
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2025,
    },
    {
      id: 'heavy-trucks',
      label: { zh: '重型卡車（3.5 公噸以上）', en: 'Heavy lorries (over 3.5 t)' },
      description: {
        zh: `登記的重型卡車（載重 3.5 公噸以上，Eurostat，2013 年起，各國最近一年）。歐盟 27 國 2013 年 3,730,266 輛 → 2024 年 3,589,974 輛，十年下來反而減少。2025 年土耳其 682,864 輛、義大利 519,663、德國 514,582、西班牙 371,856；台灣的大貨車 2025 年 176,540 輛。${tr(TW_NOTE, 'zh')}`,
        en: `Registered heavy lorries (over 3.5 tonnes, Eurostat, from 2013, latest year for each country). The EU-27 went from 3,730,266 in 2013 to 3,589,974 in 2024, a decline over the decade. In 2025 Türkiye had 682,864, Italy 519,663, Germany 514,582 and Spain 371,856; Taiwan had 176,540 heavy goods vehicles in 2025. ${tr(TW_NOTE, 'en')}`,
      },
      unit: { zh: '輛', en: 'vehicles' },
      file: 'heavy-trucks.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: vehicles,
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2025,
    },
    {
      id: 'electric-trucks',
      label: { zh: '電動重型卡車', en: 'Electric heavy lorries' },
      description: {
        zh: '登記的純電動重型卡車（3.5 公噸以上，Eurostat，2013 年起）。歐盟 27 國 2013 年只有 184 輛，2024 年 14,057 輛；2025 年德國 11,220 輛最多，挪威 2,517、瑞典 1,538、瑞士 1,413、丹麥 1,411，荷蘭 1,537（2024 年）。跟柴油卡車比還很少：德國 2025 年的重型卡車有 497,031 輛是柴油（不含油電混合）。台灣沒有依動力的貨車統計。',
        en: 'Registered battery-electric heavy lorries (over 3.5 tonnes, Eurostat, from 2013). The EU-27 had only 184 in 2013 and 14,057 in 2024; in 2025 Germany had the most, 11,220, then Norway 2,517, Sweden 1,538, Switzerland 1,413 and Denmark 1,411, with the Netherlands at 1,537 (2024). They are still few next to diesel: 497,031 of Germany’s heavy lorries in 2025 ran on diesel (excluding hybrids). Taiwan has no lorry statistics by motor energy.',
      },
      unit: { zh: '輛', en: 'vehicles' },
      file: 'electric-trucks.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: vehicles,
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2025,
    },
    {
      id: 'buses',
      label: { zh: '大客車與遊覽車', en: 'Buses and coaches' },
      description: {
        zh: `登記的大客車、遊覽車與無軌電車（Eurostat，1970 年起，各國最近一年）。土耳其 2025 年 753,594 輛（1990 年 188,099 輛），歐盟 27 國合計 737,142 輛（2024 年）；義大利 102,655、法國 94,760、德國 87,529、西班牙 69,145、羅馬尼亞 58,540。台灣的大客車 2025 年 29,677 輛。${tr(TW_NOTE, 'zh')}`,
        en: `Registered buses, coaches and trolleybuses (Eurostat, from 1970, latest year for each country). Türkiye had 753,594 in 2025 (188,099 in 1990), against an EU-27 total of 737,142 (2024); Italy 102,655, France 94,760, Germany 87,529, Spain 69,145 and Romania 58,540. Taiwan had 29,677 buses and coaches in 2025. ${tr(TW_NOTE, 'en')}`,
      },
      unit: { zh: '輛', en: 'vehicles' },
      file: 'buses.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: vehicles,
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2025,
    },
  ],
};
