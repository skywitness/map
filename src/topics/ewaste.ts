import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 電子垃圾（pipeline/topics/ewaste.py、sources/ewaste_monitor.py）：Global E-waste Monitor 2024 附錄表的 2022 年各國數字。
 * 報告是 CC BY-NC-SA 3.0 IGO，資料檔也用同一種授權（使用者 2026-10-29 決定），頁尾寫明。
 */

const LICENSE = { zh: 'CC BY-NC-SA 3.0 IGO（這個主題的資料檔同樣用 CC BY-NC-SA 3.0 IGO 分享）', en: 'CC BY-NC-SA 3.0 IGO (this topic’s data files are shared under the same licence)' };
const TONNES = { zh: '公噸', en: 'tonnes' };
const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} tonnes` });

export const ewaste: TopicDefinition = {
  id: 'ewaste',
  title: { zh: '電子垃圾', en: 'E-waste' },
  shortTitle: { zh: '電子垃圾', en: 'E-waste' },
  defaultIndicator: 'per-capita',
  defaultYear: 2022,
  sources: [
    {
      name: { zh: 'UNITAR、ITU，Global E-waste Monitor 2024（附錄 2 的各國表）', en: 'UNITAR and ITU, Global E-waste Monitor 2024 (Annex 2 country table)' },
      url: 'https://ewastemonitor.info/the-global-e-waste-monitor-2024/',
      license: LICENSE,
    },
  ],
  note: {
    zh:
      '電子垃圾是丟棄的電器與電子產品（冰箱、冷氣、電視螢幕、燈具、手機與電腦、小家電等），以重量計。產生量多是用銷售量與使用年限推估的模型，正式收集回收量才是各國申報的（有紀錄、經過合格處理的部分），沒有申報的國家回收量與回收率留白，不等於零。' +
      '只有 2022 年。數字取自報告附錄的各國表；台灣的回收量來自環保署（今環境部）。' +
      '報告是 CC BY-NC-SA 3.0 IGO（姓名標示、非商業性、相同方式分享），這個主題的資料檔也用同一種授權。',
    en:
      'E-waste is discarded electrical and electronic equipment (fridges, air conditioners, screens, lamps, phones and computers, small appliances and so on), by weight. Amounts generated are mostly modelled from sales and lifetimes; amounts formally collected and recycled are reported by countries (documented and properly treated), and countries without reports are left blank, which does not mean zero. ' +
      'Only 2022 is available. Figures come from the report’s annex country table; Taiwan’s recycling figure comes from its Environmental Protection Administration (now the Ministry of Environment). ' +
      'The report is licensed CC BY-NC-SA 3.0 IGO (attribution, non-commercial, share-alike), and this topic’s data files are shared under the same licence.',
  },
  indicators: [
    {
      id: 'per-capita',
      label: { zh: '每人產生的電子垃圾', en: 'E-waste per person' },
      description: {
        zh: '2022 年每人產生多少公斤電子垃圾。越富裕、電器越多的國家越多：挪威 26.8、英國 24.5、瑞士 23.4 公斤；尼日、馬拉威、索馬利亞 0.5 公斤。台灣 19.4、日本 21.2、美國 21.3、中國 8.5 公斤；世界平均 7.8。',
        en: 'Kilograms of e-waste generated per person in 2022. It rises with wealth and the number of appliances: Norway 26.8, the UK 24.5 and Switzerland 23.4 kg, against 0.5 kg in Niger, Malawi and Somalia. Taiwan 19.4, Japan 21.2, the US 21.3, China 8.5; 7.8 worldwide.',
      },
      unit: { zh: '公斤/人', en: 'kg per person' },
      file: 'per-capita.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 15, 20, 24] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 公斤`, en: `${fixed(v, 1)} kg` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'generated',
      label: { zh: '電子垃圾產生量', en: 'E-waste generated' },
      description: {
        zh: '2022 年產生的電子垃圾總量，圓的面積與它成正比。全世界約 6,200 萬公噸；中國 1,207 萬、美國 719 萬、印度 414 萬公噸最多，台灣 46 萬公噸。',
        en: 'Total e-waste generated in 2022; circle area is proportional to it. About 62 million tonnes worldwide; China (12.1 million), the US (7.2 million) and India (4.1 million) generated the most, Taiwan 463,000 tonnes.',
      },
      unit: TONNES,
      file: 'generated.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'recycling-rate',
      label: { zh: '正式回收的比例', en: 'Share formally recycled' },
      description: {
        zh: '產生的電子垃圾裡，有紀錄、經過正式收集與合格回收處理的比例。只有 84 國有申報：保加利亞 84%、波蘭 81%、奧地利 76%，歐洲多在四到六成；台灣 31%、日本 23%、美國 56%、中國 16%；世界 22%。其他的多半進了一般垃圾、非正式的拆解或出口。',
        en: 'The share of e-waste that was documented as formally collected and properly recycled. Only 84 countries report it: Bulgaria 84%, Poland 81%, Austria 76%, with most of Europe at 40–60%; Taiwan 31%, Japan 23%, the US 56%, China 16%; 22% worldwide. The rest mostly ends up in household waste, informal dismantling or exports.',
      },
      unit: '%',
      file: 'recycling-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      missing: { zh: '沒有申報正式回收量', en: 'No formal recycling reported' },
    },
    {
      id: 'recycled',
      label: { zh: '正式回收量', en: 'E-waste formally recycled' },
      description: {
        zh: '2022 年有紀錄、經過正式收集與合格回收處理的電子垃圾，圓的面積與它成正比。美國 405 萬、中國 195 萬公噸最多，台灣 14.5 萬公噸。',
        en: 'E-waste documented as formally collected and properly recycled in 2022; circle area is proportional to it. The US (4.05 million tonnes) and China (1.95 million) recycled the most; Taiwan 145,000 tonnes.',
      },
      unit: TONNES,
      file: 'recycled.json',
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: tonnes,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      missing: { zh: '沒有申報正式回收量', en: 'No formal recycling reported' },
    },
  ],
};
