import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { transportExtra } from './rail-extra';
import type { CategoryDef, TopicDefinition } from './types';

const KM = { zh: '公里', en: 'km' };
const KM_PER_1000 = { zh: '公里/千平方公里', en: 'km per 1,000 km²' };
const km = (v: number) => `${fixed(v, 0)} ${tr(KM)}`;

type Bilingual = { zh: string; en: string };

/** 「標準軌（1,435 mm）」；name 為 null 是不在分類裡的軌距，只寫毫米數 */
export function gaugeText(name: Bilingual | null, mm: number): Bilingual {
  const n = fixed(mm, 0);
  return name ? { zh: `${name.zh}（${n} mm）`, en: `${name.en} (${n} mm)` } : { zh: `${n} mm`, en: `${n} mm` };
}

/**
 * 軌距的分類（pipeline/topics/rail_gauge.py 的 CLASSES，代碼要一致）。代碼 8（1,000 mm 以下的窄軌、1,372 mm 等）
 * 不列在 categories 裡，歸到類別圖的「其他軌距」；mm 是側欄判斷某個軌距屬於哪一類用的。
 */
export const GAUGES: (CategoryDef & { name: Bilingual; mm: number[] })[] = [
  { value: 1, mm: [1435], name: { zh: '標準軌', en: 'Standard' } },
  { value: 2, mm: [1520, 1524], name: { zh: '俄規寬軌', en: 'Russian broad' } },
  { value: 3, mm: [1676], name: { zh: '印度寬軌', en: 'Indian broad' } },
  { value: 4, mm: [1668], name: { zh: '伊比利寬軌', en: 'Iberian broad' } },
  { value: 5, mm: [1600], name: { zh: '愛爾蘭寬軌', en: 'Irish broad' } },
  { value: 6, mm: [1067], name: { zh: '開普軌', en: 'Cape gauge' } },
  { value: 7, mm: [1000], name: { zh: '米軌', en: 'Metre gauge' } },
].map((g) => ({ ...g, label: gaugeText(g.name, g.mm[0]) }));
export const OTHER_GAUGE = { zh: '其他軌距', en: 'Other gauges' };
const gaugeLabel = (v: number) => tr(GAUGES.find((g) => g.value === v)?.label ?? OTHER_GAUGE);

/**
 * 鐵路（主題 id 照舊是 transport；2026-10-30，製作手冊第十一批 186 把「交通」拆成鐵路、高鐵、地鐵與城市軌道，
 * 地鐵站、第一條高鐵搬到 metro.ts、high-speed-rail.ts，資料檔都還在 public/data/topics/transport/）
 */
export const transport: TopicDefinition = {
  id: 'transport',
  title: { zh: '鐵路', en: 'Railways' },
  shortTitle: { zh: '鐵路', en: 'Railways' },
  defaultIndicator: 'network',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Natural Earth（1:10m 鐵路）', en: 'Natural Earth (1:10m railways)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'CIA 世界概況（各國的軌距與長度，factbook.json 的鏡像）', en: 'CIA World Factbook (track gauges and lengths, via the factbook.json mirror)' },
      url: 'https://github.com/factbook/factbook.json',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: '英文維基百科（亞美尼亞、南蘇丹的軌距）', en: 'English Wikipedia (track gauges of Armenia and South Sudan)' },
      url: 'https://en.wikipedia.org/',
      license: 'CC BY-SA 4.0',
    },
    ...transportExtra.sources,
  ],
  note: {
    zh:
      '鐵路取自 Natural Earth 1:10m 地圖資料並經簡化，可能缺少支線；北美只收主要幹線，美國、加拿大的鐵路長度明顯偏低。高鐵、地鐵見「高鐵」「地鐵與城市軌道」主題，機場見「機場與旅客」主題，港口與海運見「航運與港口」主題。' +
      '軌距取自 CIA 世界概況的各軌距公里數，資料年份各國不同（2008–2023 年）；2023 年起歐洲各國、俄羅斯、德國、義大利等只列鐵路總長，改用 2022 年 12 月的版本。' +
      '亞美尼亞、南蘇丹兩個版本都沒有，用英文維基百科的軌距、沒有長度。世界概況幾個明顯的筆誤（瑞士、南非、阿爾及利亞的軌距）已更正。',
    en:
      'Railways come from simplified Natural Earth 1:10m map data and may miss branch lines; North America includes main lines only, so rail lengths for the US and Canada are clearly too low. For high-speed lines and metros see the High-speed rail and Metro and urban rail topics; for airports, the Airports and passengers topic; for ports and sea transport, the Shipping and ports topic. ' +
      'Track gauges come from the kilometres of each gauge in the CIA World Factbook, with data years varying by country (2008–2023); from 2023 the Factbook gives only total length for the European countries, Russia, Germany, Italy and others, so the December 2022 edition is used for them. ' +
      'Neither edition covers Armenia or South Sudan, whose gauges come from English Wikipedia, without lengths. A few obvious Factbook typos (the gauges of Switzerland, South Africa and Algeria) have been corrected. ',
  },
  overlays: [
    // 機場的圖層與航空的指標 2026-10-30 搬到航空主題（aviation.ts，第十一批起叫機場與旅客）
    { id: 'railways', file: 'railways.json', indicators: ['network', 'rail-length', 'rail-density', 'gauge', 'standard-share'] },
  ],
  panelExtra: () => import('./panels/TransportPanel'),
  indicators: [
    {
      id: 'network',
      label: { zh: '路網地圖', en: 'Network map' },
      description: {
        zh: '全球鐵路路線，可在左下角開關圖層；滑鼠移到國家上可看鐵路長度。機場在「機場與旅客」主題。',
        en: 'Railway lines around the world; toggle the layer at the bottom left. Hover over a country to see its rail length. Airports are in the Airports and passengers topic.',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `鐵路 ${km(v)}`, en: `Railways: ${km(v)}` }),
    },
    {
      id: 'rail-length',
      label: { zh: '鐵路長度', en: 'Rail length' },
      description: {
        zh: '依地圖上的鐵路路線計算的總長度（近似值，複線可能重複計算、支線可能缺漏）。',
        en: 'Total length of the railway lines on the map (approximate: multi-track lines may be counted twice and branch lines may be missing).',
      },
      unit: KM,
      file: 'rail-length.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: km,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'rail-density',
      label: { zh: '鐵路密度', en: 'Rail density' },
      description: {
        zh: '每 1,000 平方公里國土上的鐵路長度，比總長度更能比較大小不同的國家。',
        en: 'Kilometres of railway per 1,000 km² of land, which compares countries of different sizes better than total length.',
      },
      unit: KM_PER_1000,
      file: 'rail-density.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 70] } },
      format: (v) => `${fixed(v, 1)} ${tr(KM_PER_1000)}`,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'gauge',
      label: { zh: '主要軌距', en: 'Main track gauge' },
      description: {
        zh: '鐵路長度最多的那一種軌距（兩條鐵軌內側的距離）。1,435 mm 的標準軌最普遍（60 國）；前蘇聯各國與芬蘭是俄規寬軌，日本、台灣、南非、印尼是開普軌，東南亞、東非與南美有不少米軌。軌距不同的車不能直接開過去，國界上要換轉向架或換車。點國家看各種軌距的長度。',
        en: 'The track gauge (the distance between the inner faces of the rails) with the most track. The 1,435 mm standard gauge is the most common (60 countries); the former Soviet states and Finland use Russian broad gauge, Japan, Taiwan, South Africa and Indonesia use Cape gauge, and much of Southeast Asia, East Africa and South America uses metre gauge. Trains cannot run straight onto track of another gauge, so bogies or trains are changed at the border. Click a country for the length of each gauge.',
      },
      unit: '',
      file: 'gauge.json',
      layer: { kind: 'categorical', categories: GAUGES.map(({ value, label }) => ({ value, label })), other: OTHER_GAUGE },
      format: gaugeLabel,
      unranked: true,
      panelChart: false,
    },
    {
      id: 'standard-share',
      label: { zh: '標準軌的比例', en: 'Share of standard gauge' },
      description: {
        zh: '1,435 mm 的標準軌占鐵路總長的比例（雙軌距的路段不算）。台灣 21%（高鐵是標準軌，台鐵是 1,067 mm），日本 18%（新幹線），西班牙 17%（高鐵是標準軌，傳統線是 1,668 mm 的伊比利寬軌）。',
        en: 'Share of all track that is 1,435 mm standard gauge (dual-gauge sections are not counted). Taiwan 21% (the high-speed line is standard gauge, the conventional network 1,067 mm), Japan 18% (the Shinkansen), Spain 17% (high-speed lines are standard gauge, conventional lines 1,668 mm Iberian gauge).',
      },
      unit: '%',
      file: 'standard-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 25, 50, 75, 99] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      unranked: true,
      panelChart: false,
    },
    ...transportExtra.indicators,
  ],
};
