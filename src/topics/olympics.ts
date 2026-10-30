import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { PlaceDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 奧運（pipeline/topics/olympics.py）：夏季、冬季奧運的金牌數與獎牌數（單屆、歷屆累計）與每千萬人獎牌數。
 * 代表隊照當屆的名義算：蘇聯、東西德、南斯拉夫等歷史隊伍不併到繼承國，是主題自訂的地點（PLACES），畫在當時的首都附近。
 */

/** 歷史隊伍與特殊代表團（鍵跟 pipeline 的 HISTORIC 一致）；同一個城市有好幾隊時稍微錯開，滑鼠才分得開 */
export const PLACES: PlaceDef[] = [
  { id: '_URS', name: { zh: '蘇聯（1952–1988）', en: 'Soviet Union (1952–1988)' }, lon: 37.62, lat: 55.75 },
  { id: '_EUN', name: { zh: '獨立國協聯隊（1992）', en: 'Unified Team (1992)' }, lon: 27.56, lat: 53.9 },
  { id: '_RU1', name: { zh: '俄羅斯帝國（1908、1912）', en: 'Russian Empire (1908, 1912)' }, lon: 30.31, lat: 59.94 },
  { id: '_OAR', name: { zh: '俄羅斯奧林匹克選手（OAR，2018）', en: 'Olympic Athletes from Russia (OAR, 2018)' }, lon: 40.4, lat: 56.6 },
  { id: '_ROC', name: { zh: '俄羅斯奧會（ROC，2020–2022）', en: 'ROC – Russian Olympic Committee (2020–2022)' }, lon: 34.9, lat: 56.6 },
  { id: '_AIN', name: { zh: '中立個人選手（AIN，2024–2026）', en: 'Individual Neutral Athletes (AIN, 2024–2026)' }, lon: 37.62, lat: 57.9 },
  { id: '_GDR', name: { zh: '東德（1968–1988）', en: 'East Germany (1968–1988)' }, lon: 13.4, lat: 52.52 },
  { id: '_FRG', name: { zh: '西德（1968–1988）', en: 'West Germany (1968–1988)' }, lon: 7.1, lat: 50.73 },
  { id: '_EUA', name: { zh: '德國聯隊（1956–1964）', en: 'United Team of Germany (1956–1964)' }, lon: 8.68, lat: 50.11 },
  { id: '_TCH', name: { zh: '捷克斯洛伐克（1920–1992）', en: 'Czechoslovakia (1920–1992)' }, lon: 15.6, lat: 49.8 },
  { id: '_BOH', name: { zh: '波希米亞（1900–1912）', en: 'Bohemia (1900–1912)' }, lon: 14.44, lat: 50.08 },
  { id: '_YUG', name: { zh: '南斯拉夫（1920–1992）', en: 'Yugoslavia (1920–1992)' }, lon: 20.46, lat: 44.82 },
  {
    id: '_SCG',
    name: { zh: '南斯拉夫聯盟、塞爾維亞與蒙特內哥羅（1996–2004）', en: 'FR Yugoslavia / Serbia and Montenegro (1996–2004)' },
    lon: 19.9,
    lat: 43.7,
  },
  { id: '_IOP', name: { zh: '獨立奧林匹克參賽者（1992）', en: 'Independent Olympic Participants (1992)' }, lon: 21.4, lat: 45.6 },
  { id: '_ANZ', name: { zh: '澳大拉西亞（1908、1912）', en: 'Australasia (1908, 1912)' }, lon: 144.96, lat: -37.81 },
  { id: '_BWI', name: { zh: '英屬西印度群島（1960）', en: 'British West Indies (1960)' }, lon: -61.51, lat: 10.65 },
  { id: '_UAR', name: { zh: '阿拉伯聯合共和國（1960）', en: 'United Arab Republic (1960)' }, lon: 31.24, lat: 30.04 },
  { id: '_AHO', name: { zh: '荷屬安地列斯（1988）', en: 'Netherlands Antilles (1988)' }, lon: -68.93, lat: 12.11 },
];

/**
 * 歷史隊伍跟今天的國家的關係（側欄寫出來）：國家 → 相關的歷史隊伍，歷史隊伍 → 今天的國家
 */
export const RELATED: Record<string, string[]> = {
  DEU: ['_EUA', '_FRG', '_GDR'],
  RUS: ['_RU1', '_URS', '_EUN', '_OAR', '_ROC', '_AIN'],
  CZE: ['_BOH', '_TCH'],
  SVK: ['_TCH'],
  SRB: ['_YUG', '_SCG', '_IOP'],
  MNE: ['_SCG'],
  AUS: ['_ANZ'],
  NZL: ['_ANZ'],
  EGY: ['_UAR'],
  SYR: ['_UAR'],
  _URS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'GEO', 'ARM', 'AZE', 'LTU', 'LVA', 'EST', 'MDA', 'KGZ', 'TJK', 'TKM'],
  _EUN: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'GEO', 'ARM', 'AZE', 'MDA', 'KGZ', 'TJK', 'TKM'],
  _RU1: ['RUS'],
  _OAR: ['RUS'],
  _ROC: ['RUS'],
  _AIN: ['RUS', 'BLR'],
  _GDR: ['DEU'],
  _FRG: ['DEU'],
  _EUA: ['DEU'],
  _TCH: ['CZE', 'SVK'],
  _BOH: ['CZE'],
  _YUG: ['SVN', 'HRV', 'BIH', 'SRB', 'MNE', 'MKD', 'XKX'],
  _SCG: ['SRB', 'MNE'],
  _IOP: ['SRB', 'MNE'],
  _ANZ: ['AUS', 'NZL'],
  _BWI: ['JAM', 'TTO', 'BRB'],
  _UAR: ['EGY', 'SYR'],
  _AHO: ['CUW', 'SXM', 'BES'],
};

export const medals = (v: number) => tr({ zh: `${fixed(v, 0)} 面`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'medal' : 'medals'}` });
const golds = (v: number) => tr({ zh: `金牌 ${fixed(v, 0)} 面`, en: `${fixed(v, 0)} gold ${Math.round(v) === 1 ? 'medal' : 'medals'}` });
const MEDALS_UNIT: Text = { zh: '面', en: 'medals' };

/** 每千萬人：第一個門檻 ANY 把「沒有得牌」（0）跟「有得牌」分開，圖例寫「> 0」 */
const ANY = 0.001;
const SUMMER_CAPITA: ScaleSpec = { type: 'sequential', thresholds: [ANY, 1, 3, 10, 30, 100] };
const WINTER_CAPITA: ScaleSpec = { type: 'sequential', thresholds: [ANY, 0.5, 2, 5, 15, 40] };
const capitaTick = (v: number) => (v === ANY ? '> 0' : fixed(v, v < 1 ? 1 : 0));

/** 奧運的子項目（夏季、冬季）：運動主題裡是奧運 5 個指標自己的 dimension */
export const SEASONS = {
  label: { zh: '季節', en: 'Season' },
  options: [
    { id: 'summer', label: { zh: '夏季奧運', en: 'Summer Games' } },
    { id: 'winter', label: { zh: '冬季奧運', en: 'Winter Games' } },
  ],
  defaultOption: 'summer',
};

/** 運動主題（sports.ts）的奧運部分：2026-10-30（第七批 121）起跟 F1 合成一個主題 */
export const olympicsPart = {
  sources: [
    {
      name: {
        zh: '英文維基百科：各屆夏季、冬季奧運獎牌榜（1896–2026）與「All-time Olympic Games medal table」',
        en: 'Wikipedia: Summer and Winter Olympics medal tables (1896–2026) and “All-time Olympic Games medal table”',
      },
      url: 'https://en.wikipedia.org/wiki/All-time_Olympic_Games_medal_table',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（每千萬人的人口）',
        en: 'United Nations, World Population Prospects 2024 (population for per-capita figures)',
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '獎牌數依維基百科各屆的獎牌榜（反映禁藥取消與重新分配等官方更動），代表隊照當屆的名義算，跟國際奧會一樣不併到繼承國：蘇聯、獨立國協聯隊、東德、西德、德國聯隊、捷克斯洛伐克、南斯拉夫、澳大拉西亞等歷史隊伍，以及 2018–2026 年以中立名義參賽的俄羅斯選手，畫在當時的首都附近（位置只是代表）。所以德國只有以德國名義參賽的年份，俄羅斯只有 1996–2014 年。混合隊、難民奧運隊、獨立奧運選手只算進世界合計。台灣以「中華台北」名義參賽，1960、1968 年以中華民國名義得到的獎牌也算在台灣。維基百科是 CC BY-SA 4.0 授權，這個主題的衍生資料檔、匯出的地圖圖片與 CSV 也依 CC BY-SA 4.0 分享。',
    en: 'Medal counts follow the Wikipedia medal tables for each Games (reflecting official changes such as doping disqualifications and reallocations). Teams are counted under the name they competed as and, like the IOC, are not merged into successor states: historical teams such as the Soviet Union, the Unified Team, East and West Germany, the United Team of Germany, Czechoslovakia, Yugoslavia and Australasia, as well as Russian athletes competing under neutral names in 2018–2026, are drawn near their capitals at the time (positions are indicative only). Germany therefore covers only the Games it entered as Germany, and Russia only 1996–2014. Mixed teams, the Refugee Olympic Team and Independent Olympic Athletes count only in the world total. Taiwan competes as Chinese Taipei; medals won as the Republic of China in 1960 and 1968 are counted for Taiwan too. Wikipedia is licensed under CC BY-SA 4.0, and the derived data files, map images and CSV files of this topic are shared under CC BY-SA 4.0 as well.',
  },
  indicators: [
    {
      id: 'medals-total',
      label: { zh: '累計獎牌', en: 'All-time medals' },
      description: {
        zh: '第一屆到這一屆累計的金、銀、銅牌總數。圓的面積與獎牌數成正比；蘇聯、東西德等歷史隊伍畫在當時的首都附近。',
        en: 'Gold, silver and bronze medals won from the first Games up to the selected Games. Circle area is proportional to medals; historical teams such as the Soviet Union and East and West Germany are drawn near their capitals at the time.',
      },
      unit: MEDALS_UNIT,
      file: 'medals-total/{item}.json',
      dimension: SEASONS,
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: medals,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'gold-total',
      label: { zh: '累計金牌', en: 'All-time gold' },
      description: {
        zh: '第一屆到這一屆累計的金牌數。',
        en: 'Gold medals won from the first Games up to the selected Games.',
      },
      unit: MEDALS_UNIT,
      file: 'gold-total/{item}.json',
      dimension: SEASONS,
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: golds,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'medals',
      label: { zh: '單屆獎牌', en: 'Medals' },
      description: {
        zh: '這一屆奧運得到的金、銀、銅牌總數。拖動時間軸一屆一屆看。',
        en: 'Gold, silver and bronze medals won at the selected Games. Drag the time slider to step through the Games.',
      },
      unit: MEDALS_UNIT,
      file: 'medals/{item}.json',
      dimension: SEASONS,
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: medals,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'gold',
      label: { zh: '單屆金牌', en: 'Gold' },
      description: {
        zh: '這一屆奧運得到的金牌數。',
        en: 'Gold medals won at the selected Games.',
      },
      unit: MEDALS_UNIT,
      file: 'gold/{item}.json',
      dimension: SEASONS,
      layer: { kind: 'bubble', legendValues: [1, 10, 40] },
      format: golds,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'per-capita',
      label: { zh: '每千萬人獎牌', en: 'Medals per 10M' },
      description: {
        zh: '這一屆的獎牌數 ÷ 當年人口 × 1,000 萬（聯合國 WPP，1952 年起）。人口少的國家一面就很高，例如 2024 年的格瑞那達、多米尼克、聖露西亞。歷史隊伍沒有人口，不算。',
        en: 'Medals at the selected Games ÷ population that year × 10 million (UN WPP, from 1952). Small countries score very high with a single medal, such as Grenada, Dominica and Saint Lucia in 2024. Historical teams have no population and are not included.',
      },
      unit: { zh: '面／千萬人', en: 'medals / 10M people' },
      file: 'per-capita/{item}.json',
      dimension: SEASONS,
      layer: { kind: 'choropleth', scale: SUMMER_CAPITA, itemScales: { winter: WINTER_CAPITA } },
      format: (v) => tr({ zh: `每千萬人 ${fixed(v, v < 1 ? 2 : 1)} 面`, en: `${fixed(v, v < 1 ? 2 : 1)} per 10M people` }),
      formatTick: capitaTick,
      compareWorld: true,
    },
  ],
} satisfies Partial<TopicDefinition>;
