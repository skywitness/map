import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, IndicatorDef, SourceDef } from './types';

/**
 * 鐵路用哪一種電、鐵路車輛（2026-11-07，製作手冊第二十七批 564，候選 1276、1278；pipeline/topics/rail_power.py）：擴充「鐵路」。
 * Eurostat 的電氣化路線依供電制度（rail_if_electri）與機車、動力客車、貨車的數量；台灣的制度依英文維基百科的清單。
 */
const POWER: CategoryDef[] = [
  { value: 1, label: { zh: '25 kV 交流', en: '25 kV AC' } },
  { value: 2, label: { zh: '15 kV 16.7 Hz 交流', en: '15 kV 16.7 Hz AC' } },
  { value: 3, label: { zh: '3 kV 直流', en: '3 kV DC' } },
  { value: 4, label: { zh: '1.5 kV 直流', en: '1.5 kV DC' } },
  { value: 5, label: { zh: '其他交流', en: 'Other AC' } },
  { value: 6, label: { zh: '其他直流', en: 'Other DC' } },
];

const STOCK_ITEMS = [
  { id: 'loco-electric', label: { zh: '電力機車', en: 'Electric locomotives' } },
  { id: 'loco-diesel', label: { zh: '柴油機車', en: 'Diesel locomotives' } },
  { id: 'railcars', label: { zh: '動力客車', en: 'Railcars' } },
  { id: 'wagons', label: { zh: '貨車', en: 'Freight wagons' } },
];

export const railPower: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: {
        zh: 'Eurostat：電氣化路線的供電制度（rail_if_electri）、機車與動力客車（rail_eq_locon）、貨車（rail_eq_wagon）',
        en: 'Eurostat: electrified lines by power supply (rail_if_electri), locomotives and railcars (rail_eq_locon), freight wagons (rail_eq_wagon)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/rail_if_electri/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of railway electrification systems」（revid 1383379414；台灣的供電制度）',
        en: 'English Wikipedia, “List of railway electrification systems” (revision 1383379414; Taiwan’s power supply)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_railway_electrification_systems?oldid=1383379414',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
  ],
  indicators: [
    {
      id: 'rail-power',
      label: { zh: '鐵路用哪一種電', en: 'Railway electrification system' },
      description: {
        zh: '電氣化鐵路里程最長的供電制度（Eurostat，各國最近一年，德國是 2021 年），滑過看每一種的里程。看得出區域集團：德國、奧地利、瑞士、瑞典、挪威是 15 kV 16.7 Hz 交流（德國 20,809 km），波蘭（12,216 km 全部）、義大利、西班牙、比利時、捷克、斯洛維尼亞是 3 kV 直流，荷蘭是 1.5 kV 直流（1,977 km，所以荷蘭的火車跑不快），法國、土耳其、克羅埃西亞等新建的路線多是 25 kV 交流。法國是四種都有的大國：25 kV 10,978 km、1.5 kV 直流 5,702 km（南部與巴黎周邊），還有 15 kV 14 km。歐盟電氣化的路線從 1990 年 87,986 km 增加到 2024 年 116,275 km。台灣不在 Eurostat 裡，依英文維基百科的清單，臺鐵與台灣高鐵都是 25 kV 60 Hz 交流（沒有里程）。只有歐洲與台灣；其他國家的維基清單是系統、不是里程，沒有畫。',
        en: 'The power supply system with the longest electrified length (Eurostat, latest year for each country; 2021 for Germany); hover for the length of each. Regional blocs show up: Germany, Austria, Switzerland, Sweden and Norway use 15 kV 16.7 Hz AC (20,809 km in Germany); Poland (all 12,216 km), Italy, Spain, Belgium, the Czech Republic and Slovenia use 3 kV DC; the Netherlands uses 1.5 kV DC (1,977 km, one reason Dutch trains are not fast); France, Türkiye, Croatia and others mostly use 25 kV AC on newer lines. France is the large country with four systems: 25 kV on 10,978 km, 1.5 kV DC on 5,702 km (the south and around Paris) and 15 kV on 14 km. Electrified lines in the EU grew from 87,986 km in 1990 to 116,275 km in 2024. Taiwan is not in Eurostat; English Wikipedia’s list puts Taiwan Railway and Taiwan High Speed Rail on 25 kV 60 Hz AC (no lengths). Europe and Taiwan only; Wikipedia’s list for other countries gives systems rather than lengths and is not mapped.',
      },
      unit: '',
      file: 'rail-power.json',
      layer: { kind: 'categorical', categories: POWER },
      format: (v) => tr(POWER.find((c) => c.value === v)?.label ?? ''),
      timeless: true,
    },
    {
      id: 'rail-stock',
      // 卡片與圖例的標題是子項目接指標名稱：「電力機車數量」
      label: { zh: '數量', en: 'in service' },
      description: {
        zh: '各國鐵路的機車、動力客車與貨車數量（Eurostat，比例圓；機車與動力客車 1990 年起，貨車 1970 年起，只有歐洲）。客運從機車拖的客車換成動力分散的電聯車：法國電力機車 1990 年 2,298 輛 → 2024 年 1,008 輛、柴油機車 3,356 → 1,757，動力客車卻從 1,768 → 8,400；義大利動力客車 1995 年 1,443 → 2024 年 9,767、荷蘭 722 → 4,180、瑞士 252 → 3,426（2020 年）。貨車大幅減少：德國 1970 年 321,046 輛 → 2020 年 103,991、法國 302,440 → 69,284、羅馬尼亞 1990 年 166,086 → 40,788、烏克蘭 1991 年 300,000 → 2023 年 118,336；一部分是貨車移到租賃公司、不再列在鐵路公司的申報裡。德國的動力客車只到 2005 年，各國對動力客車的定義也不完全一樣。',
        en: 'Locomotives, railcars and freight wagons operated by each country’s railways (Eurostat, bubbles; locomotives and railcars from 1990, wagons from 1970, Europe only). Passenger services moved from locomotive-hauled coaches to multiple units: in France electric locomotives fell from 2,298 in 1990 to 1,008 in 2024 and diesel ones from 3,356 to 1,757, while railcars rose from 1,768 to 8,400; Italy’s railcars rose from 1,443 in 1995 to 9,767 in 2024, the Netherlands’ from 722 to 4,180 and Switzerland’s from 252 to 3,426 (2020). Freight wagons fell sharply: Germany from 321,046 in 1970 to 103,991 in 2020, France from 302,440 to 69,284, Romania from 166,086 in 1990 to 40,788 and Ukraine from 300,000 in 1991 to 118,336 in 2023; part of the fall is wagons moving to leasing companies and out of the railways’ returns. Germany’s railcars stop in 2005, and definitions of railcars differ somewhat between countries.',
      },
      unit: { zh: '輛', en: 'vehicles' },
      file: 'rail-stock/{item}.json',
      dimension: { label: { zh: '車種', en: 'Type' }, options: STOCK_ITEMS, defaultOption: 'railcars' },
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 輛`, en: fixed(v, 0) }),
      defaultYear: 2024,
    },
  ],
};
